import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/agents/logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { agent_name, status, incident_id, limit = '100', offset = '0' } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (agent_name)  { conditions.push(`e.agent_name ILIKE $${p++}`); params.push(`%${agent_name}%`); }
    if (status)      { conditions.push(`e.execution_status = $${p++}`); params.push(status); }
    if (incident_id) { conditions.push(`e.incident_id = $${p++}`); params.push(incident_id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit as string, 10) || 100);
    params.push(parseInt(offset as string, 10) || 0);

    const sql = `
      SELECT e.*,
             i.incident_title,
             i.severity as incident_severity
      FROM agent_execution_logs e
      LEFT JOIN network_incidents i ON i.incident_id = e.incident_id
      ${where}
      ORDER BY e.started_at DESC
      LIMIT $${p++} OFFSET $${p}
    `;
    const result = await query(sql, params);

    const countResult = await query(
      `SELECT COUNT(*) FROM agent_execution_logs e ${where}`,
      params.slice(0, -2)
    );

    // Summary stats — same field names as /api/incidents/stats agent_stats (frontend AgentStat)
    const statsResult = await query(`
      SELECT
        agent_name,
        COUNT(*)::text                                                as total,
        COUNT(*) FILTER (WHERE execution_status = 'success')::text   as success,
        COUNT(*) FILTER (WHERE execution_status = 'failed')::text    as fail,
        COALESCE(ROUND(AVG(duration_ms))::text, '0')                 as avg_ms,
        MAX(started_at) as last_run
      FROM agent_execution_logs
      GROUP BY agent_name
      ORDER BY agent_name
    `);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      agent_stats: statsResult.rows,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (err) {
    console.error('[agents/logs] error:', err);
    res.status(500).json({ error: 'Failed to fetch agent logs', details: (err as Error).message });
  }
});

export default router;
