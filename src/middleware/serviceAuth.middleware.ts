import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validates that incoming requests from the main Full-Stack backend contain the matching
 * internal service API key (e.g. `x-service-api-key`).
 */
export const requireServiceAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const serviceKey = req.headers['x-service-api-key'] || req.headers['x-api-key'];

  if (!serviceKey || serviceKey !== env.SERVICE_API_KEY) {
    return next(ApiError.forbidden('Forbidden: Invalid or missing internal service API key'));
  }

  next();
};

