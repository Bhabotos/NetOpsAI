import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT NOW() as db_time, version() as pg_version');
    res.json({
      status: 'ok',
      service: 'NetOpsAI Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        db_time: result.rows[0].db_time,
        pg_version: result.rows[0].pg_version.split(' ').slice(0, 2).join(' '),
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'NetOpsAI Backend API',
      timestamp: new Date().toISOString(),
      database: { connected: false, error: (err as Error).message },
    });
  }
});

export default router;
