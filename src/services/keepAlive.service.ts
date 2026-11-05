import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

class KeepAliveService {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 10 * 60 * 1000; // 10 minutes

  /**
   * Starts periodic keep-alive self-pinging if KEEP_ALIVE_URL is provided
   */
  public start(url?: string, intervalMinutes: number = 10): void {
    const targetUrl = url || env.KEEP_ALIVE_URL;

    if (!targetUrl) {
      logger.debug('KeepAliveService: No KEEP_ALIVE_URL configured, passive ping mode active.');
      return;
    }

    this.intervalMs = intervalMinutes * 60 * 1000;

    logger.info(`🔄 KeepAliveService started: Pinging ${targetUrl} every ${intervalMinutes} minutes.`);

    // Perform initial ping
    this.ping(targetUrl);

    // Schedule periodic pings
    this.timer = setInterval(() => {
      this.ping(targetUrl);
    }, this.intervalMs);
  }

  /**
   * Executes a single ping request
   */
  public async ping(targetUrl: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        logger.debug(`KeepAlive ping to ${targetUrl} succeeded (status ${response.status})`);
        return true;
      }

      logger.warn(`KeepAlive ping to ${targetUrl} returned status ${response.status}`);
      return false;
    } catch (error: any) {
      logger.warn(`KeepAlive ping to ${targetUrl} failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Stops the keep-alive timer
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('KeepAliveService stopped.');
    }
  }
}

export const keepAliveService = new KeepAliveService();
