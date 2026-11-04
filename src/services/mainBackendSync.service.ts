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
   * Notify the main Full-Stack backend that a consultation call session has ended
   */
  public async notifyCallEnded(room: ConsultationRoom): Promise<void> {
    if (!env.MAIN_BACKEND_URL) return;

    const payload: CallSummaryPayload = {
      roomId: room.roomId,
      appointmentId: room.appointmentId,
      doctorId: room.doctorId,
      patientId: room.patientId,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      durationSeconds: room.durationSeconds,
    };

    try {
      logger.info(`Notifying main backend at ${env.MAIN_BACKEND_URL}/api/consultations/call-ended`);

      const response = await fetch(`${env.MAIN_BACKEND_URL}/api/consultations/call-ended`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-api-key': env.SERVICE_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.warn(
          `Main backend sync returned status ${response.status} for room ${room.roomId}`
        );
      } else {
        logger.info(`Successfully synced call conclusion for room ${room.roomId} with main backend`);

        // Update sync state in MongoDB
        await ConsultationModel.updateOne(
          { roomId: room.roomId },
          {
            isSyncedWithMainBackend: true,
            syncedAt: new Date(),
          }
        );
      }
    } catch (error: any) {
      // Log warning but don't crash sub-backend if main backend is temporarily offline
      logger.warn(
        `Failed to reach main backend at ${env.MAIN_BACKEND_URL}: ${error.message}`
      );
    }
  }
}

export const mainBackendSyncService = new MainBackendSyncService();

