import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ConsultationRoom } from '../types/room.types.js';
import { ConsultationModel } from '../models/consultation.model.js';

export interface CallSummaryPayload {
  roomId: string;
  appointmentId?: string;
  doctorId: string;
  patientId: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
}

class MainBackendSyncService {
  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Notify the main Full-Stack backend that a consultation call session has ended.
   * Includes automatic exponential backoff retry (up to 3 attempts).
   */
  public async notifyCallEnded(room: ConsultationRoom, maxRetries: number = 3): Promise<boolean> {
    if (!env.MAIN_BACKEND_URL) return false;

    const payload: CallSummaryPayload = {
      roomId: room.roomId,
      appointmentId: room.appointmentId,
      doctorId: room.doctorId,
      patientId: room.patientId,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      durationSeconds: room.durationSeconds,
    };

    let attempt = 0;
    let delayMs = 1000;

    while (attempt < maxRetries) {
      attempt++;
      try {
        logger.info(
          `Syncing call conclusion for room ${room.roomId} (Attempt ${attempt}/${maxRetries}) to ${env.MAIN_BACKEND_URL}/api/consultations/call-ended`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${env.MAIN_BACKEND_URL}/api/consultations/call-ended`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-api-key': env.SERVICE_API_KEY,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          logger.info(`Successfully synced call conclusion for room ${room.roomId} with main backend.`);

          // Update sync state in MongoDB
          await ConsultationModel.updateOne(
            { roomId: room.roomId },
            {
              isSyncedWithMainBackend: true,
              syncedAt: new Date(),
            }
          );

          return true;
        }

        logger.warn(
          `Main backend sync returned status ${response.status} on attempt ${attempt}`
        );
      } catch (error: any) {
        logger.warn(
          `Sync attempt ${attempt} failed for room ${room.roomId}: ${error.message}`
        );
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.floor(Math.random() * 500);
        await this.delay(delayMs + jitter);
        delayMs *= 2;
      }
    }

    logger.error(`Failed to sync call conclusion for room ${room.roomId} after ${maxRetries} attempts.`);
    return false;
  }
}

export const mainBackendSyncService = new MainBackendSyncService();
