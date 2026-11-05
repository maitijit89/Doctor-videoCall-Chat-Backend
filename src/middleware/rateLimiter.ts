import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/**
 * Standard rate limiter for generic API requests (100 reqs per 15 minutes)
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.badRequest('Too many requests from this IP, please try again in 15 minutes'));
  },
});

/**
 * Strict rate limiter for sensitive operations:
 * Token generation, post-booking session creation, and direct chat initiation (20 reqs per 15 mins)
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.badRequest('Rate limit exceeded for token or session operations. Please wait before retrying.'));
  },
});

/**
 * High-throughput rate limiter for external Webhooks (ZEGOCLOUD / COMETCHAT)
 */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.badRequest('Webhook throughput rate limit reached.'));
  },
});
