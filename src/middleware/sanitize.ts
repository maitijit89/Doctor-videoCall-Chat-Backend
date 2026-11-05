import { Request, Response, NextFunction } from 'express';

const cleanObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    // Strip keys starting with '$' or containing '.' to prevent NoSQL operator injection
    if (!key.startsWith('$') && !key.includes('.')) {
      cleaned[key] = cleanObject(obj[key]);
    }
  }

  return cleaned;
};

/**
 * Sanitizes incoming request body, query parameters, and route params
 * against MongoDB operator injection attacks.
 */
export const mongoSanitizeMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) req.body = cleanObject(req.body);
  if (req.query) (req as any).query = cleanObject(req.query);
  if (req.params) (req as any).params = cleanObject(req.params);
  next();
};
