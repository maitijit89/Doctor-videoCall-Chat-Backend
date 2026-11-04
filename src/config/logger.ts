import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Custom log format for readable console output in development
const devLogFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  const errorStack = stack ? `\n${stack}` : '';
  return `[${timestamp}] [${level}]: ${message}${errorStack}${metaStr}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.NODE_ENV === 'production' ? json() : devLogFormat
  ),
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'production' ? json() : combine(colorize(), devLogFormat),
    }),
  ],
});
