import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import { query } from '../db';

// Stricter rate limit for alarm simulation (10 req/min)
const simulateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many simulation requests. Limit: 10/minute.' },
});

const router = Router();

// GET /api/alarms — list all alarms with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { severity, status, device, limit = '50', offset = '0' } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (severity) { conditions.push(`a.severity = $${p++}`); params.push(severity); }
    if (status)   { conditions.push(`a.processing_status = $${p++}`); params.push(status); }
    if (device)   { conditions.push(`a.device_name ILIKE $${p++}`); params.push(`%${device}%`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit as string, 10) || 50);
    params.push(parseInt(offset as string, 10) || 0);

    const sql = `
      SELECT a.*, d.location, d.vendor
      FROM network_alarms a
      LEFT JOIN network_devices d ON d.device_id = a.device_id
      ${where}
      ORDER BY a.alarm_timestamp DESC
      LIMIT $${p++} OFFSET $${p}
    `;
    const result = await query(sql, params);

    const countSql = `SELECT COUNT(*) FROM network_alarms a ${where}`;
    const countResult = await query(countSql, params.slice(0, -2));

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (err) {
    console.error('[alarms] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch alarms', details: (err as Error).message });
  }
});

// POST /api/alarms/simulate — simulate a new alarm and forward to n8n webhook
const SimulateAlarmSchema = z.object({
  device_name: z.string().min(1).max(100),
  alarm_type:  z.string().min(1).max(100),   // flexible — any alarm type string allowed
  severity:    z.enum(['Critical','Major','Minor','Warning','Info']),
  interface_name: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

router.post('/simulate', simulateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = SimulateAlarmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { device_name, alarm_type, severity, interface_name, description } = parsed.data;

    // Lookup device by name
    const deviceResult = await query(
      'SELECT device_id FROM network_devices WHERE device_name = $1',
      [device_name]
    );
    const device_id = deviceResult.rows[0]?.device_id ?? null;

    // Build alarm payload
    const alarmPayload = {
      alarm_id:        uuidv4(),
      device_name,
      device_id,
      alarm_type,
      severity,
      interface_name:  interface_name ?? null,
      description:     description ?? `Simulated ${alarm_type} alarm on ${device_name}`,
      alarm_timestamp: new Date().toISOString(),
      alarm_source:    'simulate_api',
      raw_payload: {
        source: 'simulate_api',
        raw_type: alarm_type.replace(/\s+/g, '_').toUpperCase(),
        interface: interface_name,
        simulated: true,
      },
    };

    // Store alarm first so the n8n orchestrator can find (and upsert) it by alarm_id
    const insertResult = await query(
      `INSERT INTO network_alarms
         (alarm_id,device_id,device_name,alarm_type,severity,interface_name,description,alarm_source,raw_payload,processing_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'received')
       RETURNING *`,
      [
        alarmPayload.alarm_id, device_id, device_name, alarm_type, severity,
        interface_name ?? null,
        alarmPayload.description,
        'simulate_api',
        JSON.stringify(alarmPayload.raw_payload),
      ]
    );

    // Forward to n8n webhook in the background: the 5-agent pipeline takes far longer
    // than an HTTP request should, so don't block the response on it.
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const webhookQueued = Boolean(webhookUrl);

    if (webhookUrl) {
      axios.post(webhookUrl, alarmPayload, {
        timeout: parseInt(process.env.N8N_WEBHOOK_TIMEOUT_MS || '900000', 10),
        headers: { 'Content-Type': 'application/json' },
      }).then(r => {
        console.log(`[alarms/simulate] n8n processed alarm ${alarmPayload.alarm_id}:`, JSON.stringify(r.data));
      }).catch(async (wErr) => {
        console.warn(`[alarms/simulate] n8n webhook failed for ${alarmPayload.alarm_id}:`, (wErr as Error).message);
        // A timeout only means we stopped waiting — n8n may still finish and update the alarm itself
        if (axios.isAxiosError(wErr) && wErr.code === 'ECONNABORTED') return;
        await query(
          `UPDATE network_alarms SET processing_status = 'failed'
           WHERE alarm_id = $1 AND processing_status IN ('received','processing')`,
          [alarmPayload.alarm_id]
        ).catch(dbErr => console.error('[alarms/simulate] failed to mark alarm failed:', dbErr));
      });
    }

    res.status(202).json({
      message: webhookQueued
        ? 'Alarm accepted — AI pipeline started'
        : 'Alarm stored, but N8N_WEBHOOK_URL is not configured',
      alarm: insertResult.rows[0],
      webhook: { queued: webhookQueued, error: webhookQueued ? null : 'N8N_WEBHOOK_URL not configured' },
    });
  } catch (err) {
    console.error('[alarms/simulate] error:', err);
    res.status(500).json({ error: 'Failed to simulate alarm', details: (err as Error).message });
  }
});

export default router;
