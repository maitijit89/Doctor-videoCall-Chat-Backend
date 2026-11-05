import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let cachedConnectionPromise: Promise<typeof mongoose> | null = null;

export const connectDatabase = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (cachedConnectionPromise) {
    return cachedConnectionPromise;
  }

  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      logger.info('🍃 MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
    });

    // Production-tuned connection pool options
    cachedConnectionPromise = mongoose.connect(env.MONGODB_URI, {
      autoIndex: env.NODE_ENV !== 'production', // Build indexes in dev, rely on migrations/manual in high-scale prod
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 8000,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority',
    });

    const conn = await cachedConnectionPromise;

    logger.info(`🍃 MongoDB Host: ${conn.connection.host}, Database: ${conn.connection.name} (Pool: 10-50)`);
    return conn;
  } catch (error: any) {
    logger.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
};

export const getDatabaseStats = (): { isConnected: boolean; readyState: number; host?: string; name?: string } => {
  return {
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('🍃 MongoDB connection closed gracefully.');
  } catch (err: any) {
    logger.error('Error closing MongoDB connection:', err.message);
  }
};
