import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiResponse } from '../utils/ApiResponse.js';
import { getDatabaseStats } from '../config/database.js';
import { env } from '../config/env.js';

export const getHealth = (_req: Request, res: Response): void => {
  const dbStats = getDatabaseStats();

  const healthData = {
    service: 'doctor-videocall-chat-service',
    status: dbStats.isConnected ? 'healthy' : 'degraded',
    environment: env.NODE_ENV,
    database: {
      status: dbStats.isConnected ? 'connected' : 'disconnected',
      host: dbStats.host,
      databaseName: dbStats.name,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryUsage: {
      rssMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
    },
  };

  const statusCode = dbStats.isConnected ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
  res.status(statusCode).json(ApiResponse.success(healthData, 'Service health verified'));
};

export const getMetrics = (_req: Request, res: Response): void => {
  const memory = process.memoryUsage();
  const dbStats = getDatabaseStats();

  const metrics = {
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
    database: dbStats,
    memory: {
      rssMB: (memory.rss / (1024 * 1024)).toFixed(2),
      heapTotalMB: (memory.heapTotal / (1024 * 1024)).toFixed(2),
      heapUsedMB: (memory.heapUsed / (1024 * 1024)).toFixed(2),
      externalMB: (memory.external / (1024 * 1024)).toFixed(2),
    },
    cpuUsage: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  };

  res.status(StatusCodes.OK).json(ApiResponse.success(metrics, 'System metrics retrieved'));
};

/**
 * Ultra-fast alive ping endpoint for load balancers, uptime monitoring,
 * and container orchestrators.
 */
export const getPing = (_req: Request, res: Response): void => {
  res.status(StatusCodes.OK).json({
    status: 'alive',
    message: 'pong',
    service: 'doctor-videocall-chat-service',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
};

/**
 * Minimal liveness probe for Kubernetes / Docker Swarm (returns 200 OK)
 */
export const getLiveness = (_req: Request, res: Response): void => {
  res.status(StatusCodes.OK).send('OK');
};
