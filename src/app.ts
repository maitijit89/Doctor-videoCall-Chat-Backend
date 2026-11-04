import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = (): Application => {
  const app: Application = express();

  // Trust reverse proxy (e.g., NGINX, Cloudflare, ALB)
  app.set('trust proxy', 1);

  // Security HTTP Headers
  app.use(helmet());

  // CORS Configuration
  const allowedOrigins =
    env.CORS_ORIGIN === '*'
      ? '*'
      : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-service-api-key'],
    })
  );

  // Gzip Response Compression
  app.use(compression());

  // Body Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP Request Logging
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
      if (res.statusCode >= 400) {
        logger.warn(message);
      } else {
        logger.http ? logger.http(message) : logger.info(message);
      }
    });
    next();
  });

  // Root welcome / basic ping endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'Doctor Video Call & Chat Sub-Backend Service',
      version: '1.0.0',
      status: 'active',
      documentation: '/api/v1/health',
    });
  });

  // Mount API v1 routes
  app.use('/api/v1', apiRoutes);

  // 404 Route Not Found Handler
  app.use(notFoundHandler);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};
