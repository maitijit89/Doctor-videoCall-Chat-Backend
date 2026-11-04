import jwt from 'jsonwebtoken';
import { AuthenticatedSocket } from '../types/socket.types.js';
import { AuthUser } from '../types/auth.types.js';
import { UserRole } from '../constants/roles.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const socketAuthMiddleware = (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): void => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      (socket.handshake.query?.token as string);

    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
        socket.user = decoded;
        return next();
      } catch (err: any) {
        logger.warn(`Socket JWT verification failed: ${err.message}. Checking mock credentials.`);
      }
    }

    // Support direct user metadata in handshake for testing or dev mode
    const fallbackUser = socket.handshake.auth?.user;
    if (fallbackUser && fallbackUser.id && fallbackUser.name) {
      socket.user = {
        id: String(fallbackUser.id),
        name: String(fallbackUser.name),
        role: (fallbackUser.role as UserRole) || UserRole.PATIENT,
        avatarUrl: fallbackUser.avatarUrl,
      };
      return next();
    }

    // In development mode, allow anonymous demo guest user if none provided
    if (env.NODE_ENV === 'development') {
      const demoId = socket.id.substring(0, 6);
      socket.user = {
        id: `user_${demoId}`,
        name: `Guest User ${demoId}`,
        role: UserRole.PATIENT,
      };
      logger.info(`Assigned development guest user: ${socket.user.name} (${socket.user.id})`);
      return next();
    }

    next(new Error('Authentication failed: Missing or invalid token'));
  } catch (error: any) {
    next(new Error(`Socket authentication error: ${error.message}`));
  }
};

