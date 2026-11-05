import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { authenticateJwt } from './auth.middleware.js';

/**
 * Validates that incoming requests contain the matching internal service API key
 * using a constant-time comparison to protect against timing attacks.
 */
export const requireServiceAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const serviceKey = (req.headers['x-service-api-key'] || req.headers['x-api-key']) as string | undefined;

  if (!serviceKey) {
    return next(ApiError.forbidden('Forbidden: Missing internal service API key'));
  }

  const expectedKey = env.SERVICE_API_KEY;

  // Protect against timing side-channel attacks
  const keyBuffer = Buffer.from(serviceKey, 'utf8');
  const expectedBuffer = Buffer.from(expectedKey, 'utf8');

  if (keyBuffer.length !== expectedBuffer.length || !timingSafeEqual(keyBuffer, expectedBuffer)) {
    return next(ApiError.forbidden('Forbidden: Invalid internal service API key'));
  }

  next();
};

/**
 * Validates either an internal service API key or a valid user JWT.
 * Allows secure server-to-server calls from the main backend while also
 * supporting authenticated doctor/patient client calls.
 */
export const requireServiceOrUserAuth = (req: Request, res: Response, next: NextFunction): void => {
  const serviceKey = (req.headers['x-service-api-key'] || req.headers['x-api-key']) as string | undefined;

  if (serviceKey) {
    const keyBuffer = Buffer.from(serviceKey, 'utf8');
    const expectedBuffer = Buffer.from(env.SERVICE_API_KEY, 'utf8');

    if (keyBuffer.length === expectedBuffer.length && timingSafeEqual(keyBuffer, expectedBuffer)) {
      return next();
    }
    return next(ApiError.forbidden('Forbidden: Invalid internal service API key'));
  }

  // Fall back to JWT authentication
  return authenticateJwt(req, res, next);
};
