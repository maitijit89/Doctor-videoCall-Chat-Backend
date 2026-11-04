import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiResponse } from '../utils/ApiResponse.js';
import { env } from '../config/env.js';

export const getHealth = (_req: Request, res: Response): void => {
  const healthData = {
    service: 'doctor-videocall-chat-service',
    status: 'healthy',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryUsage: {
      rssMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
    },
  };

  res.status(StatusCodes.OK).json(ApiResponse.success(healthData, 'Service is healthy'));
};
