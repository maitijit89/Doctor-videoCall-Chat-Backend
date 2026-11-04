import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initializeSocketIO } from './sockets/socketManager.js';

const startServer = async () => {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO Real-Time Engine
  const io = initializeSocketIO(httpServer);

  const server = httpServer.listen(env.PORT, () => {
    logger.info(`=================================================`);
    logger.info(`🚀 Doctor Video Call & Chat Sub-Backend Service`);
    logger.info(`📡 Server running on http://localhost:${env.PORT}`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
    logger.info(`💬 Socket.IO Real-Time Engine Ready`);
    logger.info(`🏥 Health check: http://localhost:${env.PORT}/api/v1/health`);
    logger.info(`🔗 Main Backend Link: ${env.MAIN_BACKEND_URL}`);
    logger.info(`=================================================`);
  });

  // Graceful shutdown handler
  const shutdown = (signal: string) => {
    logger.warn(`Received ${signal}. Initiating graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed.');

      // Close all Socket.IO client connections
      io.close(() => {
        logger.info('Socket.IO connections closed.');
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

