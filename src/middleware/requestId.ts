import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Attaches a unique correlation ID to every incoming request.
 * If the client or reverse proxy supplies `x-request-id`, it is preserved;
 * otherwise, a new UUID v4 is generated.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();
  req.id = correlationId;
  res.setHeader('x-request-id', correlationId);
  next();
};
