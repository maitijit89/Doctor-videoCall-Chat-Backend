import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import hpp from 'hpp';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import apiRoutes from './routes/index.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { mongoSanitizeMiddleware } from './middleware/sanitize.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = (): Application => {
  const app: Application = express();

  // Trust reverse proxy (NGINX, Cloudflare, AWS ALB)
  app.set('trust proxy', 1);

  // Correlation ID tracking
  app.use(requestIdMiddleware);

  // Security HTTP Headers
  app.use(helmet());

  // Strict CORS Configuration
  const allowedOrigins =
    env.CORS_ORIGIN === '*'
      ? '*'
      : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps, curl, or same-origin (where origin is undefined)
        if (!origin) return callback(null, true);

        if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-service-api-key', 'x-request-id'],
    })
  );

  // HTTP Parameter Pollution Protection
  app.use(hpp());

  // Gzip Response Compression
  app.use(compression());

  // Body Parsers with safe limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // NoSQL Operator Injection Sanitization
  app.use(mongoSanitizeMiddleware);

  // General Rate Limiting
  app.use('/api', generalLimiter);

  // Structured HTTP Request Logging
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const correlationId = req.id || '-';
      const logMsg = `[${req.method}] ${req.originalUrl} ${res.statusCode} - ${duration}ms (ReqID: ${correlationId})`;

      if (res.statusCode >= 500) {
        logger.error(logMsg);
      } else if (res.statusCode >= 400) {
        logger.warn(logMsg);
      } else {
        logger.info(logMsg);
      }
    });
    next();
  });

  // Root welcome / service ping
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'Doctor Video Call & Chat Sub-Backend Service',
      version: '1.0.0',
      status: 'active',
      database: 'MongoDB Atlas',
      documentation: '/api/v1/health',
      ping: '/ping',
    });
  });

  // Top-level fast alive ping for uptime monitors, health checks, and Docker/K8s
  app.get('/ping', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      message: 'pong',
      service: 'doctor-videocall-chat-service',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  app.get('/alive', (_req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  // Mount API v1 routes
  app.use('/api/v1', apiRoutes);

  // 404 Route Not Found Handler
  app.use(notFoundHandler);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};
