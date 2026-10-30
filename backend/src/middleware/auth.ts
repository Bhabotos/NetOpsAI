import { Request, Response, NextFunction } from 'express';

/**
 * Simple API-key middleware for protected dashboard endpoints.
 * Set API_KEY env var. If not set, auth is disabled (dev mode only).
 */
export const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = process.env.API_KEY;

  // If no API_KEY configured, allow all (development convenience)
  if (!apiKey) {
    next();
    return;
  }

  const provided = req.headers['x-api-key'] as string | undefined;
  if (!provided || provided !== apiKey) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid X-API-Key header required' });
    return;
  }
  next();
};
