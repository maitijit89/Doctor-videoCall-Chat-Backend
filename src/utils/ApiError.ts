import { StatusCodes } from 'http-status-codes';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: any[];

  constructor(
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    message: string = 'Internal Server Error',
    errors?: any[],
    isOperational: boolean = true,
    stack: string = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string = 'Bad Request', errors?: any[]): ApiError {
    return new ApiError(StatusCodes.BAD_REQUEST, message, errors);
  }

  static unauthorized(message: string = 'Unauthorized', errors?: any[]): ApiError {
    return new ApiError(StatusCodes.UNAUTHORIZED, message, errors);
  }

  static forbidden(message: string = 'Forbidden access', errors?: any[]): ApiError {
    return new ApiError(StatusCodes.FORBIDDEN, message, errors);
  }

  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(StatusCodes.NOT_FOUND, message);
  }

  static conflict(message: string = 'Resource conflict'): ApiError {
    return new ApiError(StatusCodes.CONFLICT, message);
  }

  static internal(message: string = 'Internal Server Error'): ApiError {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message, undefined, false);
  }
}

