import { StatusCodes } from 'http-status-codes';

export class ApiResponse<T = any> {
  public readonly success: boolean;
  public readonly statusCode: number;
  public readonly message: string;
  public readonly data?: T;
  public readonly meta?: Record<string, any>;
  public readonly timestamp: string;

  constructor(statusCode: number = StatusCodes.OK, message: string = 'Success', data?: T, meta?: Record<string, any>) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data?: T, message: string = 'Operation successful', statusCode: number = StatusCodes.OK) {
    return new ApiResponse<T>(statusCode, message, data);
  }

  static created<T>(data?: T, message: string = 'Created successfully') {
    return new ApiResponse<T>(StatusCodes.CREATED, message, data);
  }
}
