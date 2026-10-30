import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/incidents — list incidents with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { severity, status, limit = '50', offset = '0' } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (severity) { conditions.push(`i.severity = $${p++}`); params.push(severity); }
    if (status)   { conditions.push(`i.incident_status = $${p++}`); params.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit as string, 10) || 50);
    params.push(parseInt(offset as string, 10) || 0);

    const sql = `
      SELECT i.*,
             a.alarm_type, a.device_name as alarm_device, a.alarm_timestamp,
             (SELECT COUNT(*) FROM agent_execution_logs e WHERE e.incident_id = i.incident_id) as agent_count
      FROM network_incidents i
      LEFT JOIN network_alarms a ON a.alarm_id = i.alarm_id
      ${where}
      ORDER BY i.created_at DESC
      LIMIT $${p++} OFFSET $${p}
    `;
    const result = await query(sql, params);

    const countResult = await query(
      `SELECT COUNT(*) FROM network_incidents i ${where}`,
      params.slice(0, -2)
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (err) {
    console.error('[incidents] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch incidents', details: (err as Error).message });
  }
});

// GET /api/incidents/stats — dashboard summary stats
// Response shape matches the frontend DashboardStats interface exactly:
// { data: { alarm_counts, incident_counts, agent_stats, alarm_trend } }
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // alarm_counts — one row per severity
    const alarmCountsResult = await query(`
      SELECT severity, COUNT(*)::text as count
      FROM network_alarms
      WHERE processing_status != 'deduplicated'
      GROUP BY severity
      ORDER BY CASE severity
        WHEN 'Critical' THEN 1 WHEN 'Major' THEN 2 WHEN 'Minor' THEN 3
        WHEN 'Warning' THEN 4 ELSE 5 END
    `);

    // incident_counts — one row per status
    const incCountsResult = await query(`
      SELECT incident_status, COUNT(*)::text as count
      FROM network_incidents
      GROUP BY incident_status
      ORDER BY incident_status
    `);

    // agent_stats — one row per agent_name with totals
    const agentStatsResult = await query(`
      SELECT
        agent_name,
        COUNT(*)::text                                                             as total,
        COUNT(*) FILTER (WHERE execution_status = 'success')::text                as success,
        COUNT(*) FILTER (WHERE execution_status = 'failed')::text                 as fail,
        COALESCE(ROUND(AVG(duration_ms))::text, '0')                              as avg_ms
      FROM agent_execution_logs
      GROUP BY agent_name
      ORDER BY agent_name
    `);

    // alarm_trend — daily total for last 7 days
    const trendResult = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('day', alarm_timestamp), 'YYYY-MM-DD') as day,
        COUNT(*)::text as count
      FROM network_alarms
      WHERE alarm_timestamp >= NOW() - INTERVAL '7 days'
        AND processing_status != 'deduplicated'
      GROUP BY DATE_TRUNC('day', alarm_timestamp)
      ORDER BY DATE_TRUNC('day', alarm_timestamp) ASC
    `);

    res.json({
      data: {
        alarm_counts:    alarmCountsResult.rows,
        incident_counts: incCountsResult.rows,
        agent_stats:     agentStatsResult.rows,
        alarm_trend:     trendResult.rows,
      },
    });
  } catch (err) {
    console.error('[incidents/stats] error:', err);
    res.status(500).json({ error: 'Failed to fetch stats', details: (err as Error).message });
  }
});

// GET /api/incidents/:id — full incident detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      res.status(400).json({ error: 'Invalid incident ID format' });
      return;
    }

    const result = await query(
      `SELECT i.*,
              a.alarm_type, a.device_name as alarm_device, a.alarm_timestamp,
              a.interface_name as alarm_interface, a.description as alarm_description,
              a.raw_payload as alarm_raw_payload
       FROM network_incidents i
       LEFT JOIN network_alarms a ON a.alarm_id = i.alarm_id
       WHERE i.incident_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    // Fetch agent execution logs for this incident
    const logsResult = await query(
      `SELECT * FROM agent_execution_logs WHERE incident_id = $1 ORDER BY started_at ASC`,
      [id]
    );

    res.json({
      ...result.rows[0],
      agent_logs: logsResult.rows,
    });
  } catch (err) {
    console.error('[incidents/:id] error:', err);
    res.status(500).json({ error: 'Failed to fetch incident', details: (err as Error).message });
  }
});

// POST /api/incidents/:id/resolve — mark incident resolved
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      res.status(400).json({ error: 'Invalid incident ID format' });
      return;
    }

    const result = await query(
      `UPDATE network_incidents
       SET incident_status = 'resolved', resolved_at = NOW(), updated_at = NOW()
       WHERE incident_id = $1 AND incident_status NOT IN ('resolved','closed','duplicate')
       RETURNING incident_id, incident_title, incident_status, resolved_at`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Incident not found or already resolved' });
      return;
    }

    // Update related alarms
    await query(
      `UPDATE network_alarms SET processing_status = 'processed'
       WHERE incident_id = $1 AND processing_status = 'processing'`,
      [id]
    );

    res.json({ message: 'Incident resolved successfully', incident: result.rows[0] });
  } catch (err) {
    console.error('[incidents/:id/resolve] error:', err);
    res.status(500).json({ error: 'Failed to resolve incident', details: (err as Error).message });
  }
});

export default router;
