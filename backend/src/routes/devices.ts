import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/devices
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, type } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (status) { conditions.push(`d.status = $${p++}`); params.push(status); }
    if (type)   { conditions.push(`d.device_type = $${p++}`); params.push(type); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM network_alarms a WHERE a.device_id = d.device_id AND a.processing_status NOT IN ('processed','deduplicated')) as active_alarm_count,
        (SELECT COUNT(*) FROM network_incidents i
         JOIN network_alarms a2 ON a2.alarm_id = i.alarm_id
         WHERE a2.device_id = d.device_id AND i.incident_status NOT IN ('resolved','closed','duplicate')) as active_incident_count
      FROM network_devices d
      ${where}
      ORDER BY d.network_role, d.device_name
    `, params);

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[devices] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch devices', details: (err as Error).message });
  }
});

// GET /api/topology — devices + links for topology visualisation
router.get('/topology', async (_req: Request, res: Response) => {
  try {
    const devicesResult = await query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM network_alarms a
         WHERE a.device_id = d.device_id
         AND a.processing_status NOT IN ('processed','deduplicated')
         AND a.severity IN ('Critical','Major')) as critical_alarm_count,
        -- same counts as /api/devices; the topology page renders these per node
        (SELECT COUNT(*) FROM network_alarms a WHERE a.device_id = d.device_id AND a.processing_status NOT IN ('processed','deduplicated')) as active_alarm_count,
        (SELECT COUNT(*) FROM network_incidents i
         JOIN network_alarms a2 ON a2.alarm_id = i.alarm_id
         WHERE a2.device_id = d.device_id AND i.incident_status NOT IN ('resolved','closed','duplicate')) as active_incident_count
      FROM network_devices d
      ORDER BY d.network_role, d.device_name
    `);

    const linksResult = await query(`
      SELECT l.*,
             sd.device_name as source_name,
             dd.device_name as dest_name
      FROM network_links l
      JOIN network_devices sd ON sd.device_id = l.source_device_id
      JOIN network_devices dd ON dd.device_id = l.dest_device_id
      ORDER BY l.link_name
    `);

    res.json({
      nodes: devicesResult.rows,
      links: linksResult.rows,
    });
  } catch (err) {
    console.error('[topology] error:', err);
    res.status(500).json({ error: 'Failed to fetch topology', details: (err as Error).message });
  }
});

export default router;
