import { DoctorPresenceModel, DoctorStatus } from '../models/doctorPresence.model.js';
import { logger } from '../config/logger.js';

class DoctorPresenceService {
  /**
   * Set or update doctor status (online, busy, offline)
   */
  public async setStatus(
    doctorId: string,
    status: DoctorStatus,
    doctorName?: string,
    socketId?: string,
    activeRoomId?: string
  ): Promise<any> {
    const doc = await DoctorPresenceModel.findOneAndUpdate(
      { doctorId },
      {
        $set: {
          status,
          ...(doctorName && { doctorName }),
          socketId,
          activeRoomId,
          lastHeartbeat: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    logger.debug(`Doctor ${doctorId} presence set to ${status}`);
    return doc;
  }

  /**
   * Record doctor heartbeat from active connection
   */
  public async heartbeat(doctorId: string): Promise<void> {
    await DoctorPresenceModel.updateOne(
      { doctorId },
      { $set: { lastHeartbeat: new Date() } }
    );
  }

  /**
   * Query doctor presence (with stale heartbeat detection)
   */
  public async getPresence(doctorId: string): Promise<{ doctorId: string; status: DoctorStatus; activeRoomId?: string }> {
    const doc = await DoctorPresenceModel.findOne({ doctorId });
    if (!doc) {
      return { doctorId, status: 'offline' };
    }

    // If heartbeat older than 90 seconds, treat as offline
    const now = Date.now();
    const staleThresholdMs = 90 * 1000;
    if (now - doc.lastHeartbeat.getTime() > staleThresholdMs) {
      return { doctorId, status: 'offline' };
    }

    return {
      doctorId: doc.doctorId,
      status: doc.status,
      activeRoomId: doc.activeRoomId,
    };
  }

  /**
   * List all currently online doctors
   */
  public async listOnlineDoctors(): Promise<any[]> {
    const staleTime = new Date(Date.now() - 90 * 1000);
    return await DoctorPresenceModel.find({
      status: { $in: ['online', 'busy'] },
      lastHeartbeat: { $gte: staleTime },
    }).lean();
  }
}

export const doctorPresenceService = new DoctorPresenceService();

