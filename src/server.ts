import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initializeSocketIO } from './sockets/socketManager.js';
import { keepAliveService } from './services/keepAlive.service.js';

const startServer = async () => {
  // Connect to MongoDB
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO Real-Time Engine
  const io = initializeSocketIO(httpServer);

  // Start Keep-Alive self-pinger if configured
  keepAliveService.start();

  const server = httpServer.listen(env.PORT, () => {
    logger.info(`=================================================`);
    logger.info(`🚀 Doctor Video Call & Chat Sub-Backend Service`);
    logger.info(`📡 Server running on http://localhost:${env.PORT}`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
    logger.info(`🍃 MongoDB Database Connected`);
    logger.info(`💬 Socket.IO Real-Time Engine Ready`);
    logger.info(`🏥 Health check: http://localhost:${env.PORT}/api/v1/health`);
    logger.info(`⚡ Alive Ping:   http://localhost:${env.PORT}/ping (or /alive)`);
    logger.info(`🔗 Main Backend Link: ${env.MAIN_BACKEND_URL}`);
    logger.info(`=================================================`);
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}. Initiating graceful shutdown...`);

    // Stop keep-alive service
    keepAliveService.stop();

    // Stop accepting new HTTP connections
    server.close(async () => {
      logger.info('HTTP server closed.');

      // Close all Socket.IO client connections
      io.close(async () => {
        logger.info('Socket.IO connections closed.');

        // Close MongoDB connection pool
        await disconnectDatabase();

        logger.info('Process terminated gracefully.');
        process.exit(0);
      });
    });

    // Force exit if shutdown hangs over 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err: Error) => {
    logger.error('CRITICAL: Uncaught Exception thrown:', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.error('CRITICAL: Unhandled Promise Rejection:', { reason });
  });
};

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
