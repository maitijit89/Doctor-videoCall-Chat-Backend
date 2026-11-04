import { v4 as uuidv4 } from 'uuid';
import { ConsultationRoom, CreateRoomDTO, RoomParticipant, CallStatus } from '../types/room.types.js';
import { ConsultationModel } from '../models/consultation.model.js';
import { CallLogModel } from '../models/callLog.model.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

class RoomService {
  // In-memory cache for ultra-fast sub-millisecond Socket.IO lookups
  private activeRoomsCache: Map<string, ConsultationRoom> = new Map();

  /**
   * Create or initialize a consultation room in MongoDB & Cache
   */
  public async createRoom(dto: CreateRoomDTO): Promise<ConsultationRoom> {
    const roomId = dto.roomId || `room_${uuidv4().substring(0, 8)}`;

    // Check cache first
    if (this.activeRoomsCache.has(roomId)) {
      const cached = this.activeRoomsCache.get(roomId)!;
      if (cached.status !== 'ended') {
        return cached;
      }
    }

    // Check MongoDB for existing consultation
    let doc = await ConsultationModel.findOne({ roomId });
    if (!doc) {
      doc = await ConsultationModel.create({
        roomId,
        bookingId: dto.appointmentId || roomId.replace('room_', ''),
        appointmentId: dto.appointmentId,
        doctorId: dto.doctorId,
        patientId: dto.patientId,
        doctorName: dto.doctorName,
        patientName: dto.patientName,
        status: 'idle',
        participants: [],
      });
      logger.info(`🍃 MongoDB: Consultation room saved: ${roomId}`);
    }

    const room: ConsultationRoom = {
      roomId: doc.roomId,
      appointmentId: doc.appointmentId,
      doctorId: doc.doctorId,
      patientId: doc.patientId,
      doctorName: doc.doctorName,
      patientName: doc.patientName,
      status: doc.status as CallStatus,
      participants: new Map<string, RoomParticipant>(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    this.activeRoomsCache.set(roomId, room);
    return room;
  }

  /**
   * Retrieve a room by ID from Cache or MongoDB
   */
  public async getRoom(roomId: string): Promise<ConsultationRoom | undefined> {
    if (this.activeRoomsCache.has(roomId)) {
      return this.activeRoomsCache.get(roomId);
    }

    const doc = await ConsultationModel.findOne({ roomId });
    if (!doc) return undefined;

    const room: ConsultationRoom = {
      roomId: doc.roomId,
      appointmentId: doc.appointmentId,
      doctorId: doc.doctorId,
      patientId: doc.patientId,
      doctorName: doc.doctorName,
      patientName: doc.patientName,
      status: doc.status as CallStatus,
      participants: new Map<string, RoomParticipant>(),
      startedAt: doc.startedAt,
      endedAt: doc.endedAt,
      durationSeconds: doc.durationSeconds,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    // Hydrate participants from MongoDB if any
    doc.participants.forEach((p) => {
      room.participants.set(p.socketId, {
        odId: p.socketId,
        userId: p.userId,
        name: p.name,
        role: p.role as any,
        avatarUrl: p.avatarUrl,
        joinedAt: p.joinedAt,
        isAudioMuted: p.isAudioMuted,
        isVideoStopped: p.isVideoStopped,
        isScreenSharing: p.isScreenSharing,
      });
    });

    this.activeRoomsCache.set(roomId, room);
    return room;
  }

  /**
   * Synchronous cached retrieval for hot socket lookups
   */
  public getRoomCached(roomId: string): ConsultationRoom | undefined {
    return this.activeRoomsCache.get(roomId);
  }

  /**
   * Validate if a user is authorized to join the consultation room
   */
  public async validateAccess(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;
    return room.doctorId === userId || room.patientId === userId;
  }

  /**
   * Add a participant to the room
   */
  public async addParticipant(roomId: string, participant: RoomParticipant): Promise<ConsultationRoom> {
    let room = await this.getRoom(roomId);
    if (!room) {
      throw ApiError.notFound(`Room ${roomId} not found`);
    }

    room.participants.set(participant.odId, participant);
    room.updatedAt = new Date();

    if (room.participants.size >= 2 && room.status === 'idle') {
      room.status = 'ongoing';
      room.startedAt = new Date();
    }

    // Persist participant change to MongoDB
    await ConsultationModel.updateOne(
      { roomId },
      {
        status: room.status,
        ...(room.startedAt && { startedAt: room.startedAt }),
        $addToSet: {
          participants: {
            socketId: participant.odId,
            userId: participant.userId,
            name: participant.name,
            role: participant.role,
            avatarUrl: participant.avatarUrl,
            joinedAt: participant.joinedAt,
            isAudioMuted: participant.isAudioMuted,
            isVideoStopped: participant.isVideoStopped,
            isScreenSharing: participant.isScreenSharing,
          },
        },
      }
    );

    return room;
  }

  /**
   * Remove a participant from the room by socketId
   */
  public async removeParticipant(roomId: string, socketId: string): Promise<RoomParticipant | undefined> {
    const room = await this.getRoom(roomId);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (participant) {
      room.participants.delete(socketId);
      room.updatedAt = new Date();

      if (room.participants.size === 0 && room.status === 'ongoing') {
        await this.endCall(roomId);
      }

      // Persist removal to MongoDB
      await ConsultationModel.updateOne(
        { roomId },
        {
          $pull: { participants: { socketId } },
        }
      );
    }

    return participant;
  }

  /**
   * Update participant media states (mute audio, stop video, screen share)
   */
  public async updateParticipantMedia(
    roomId: string,
    socketId: string,
    media: { isAudioMuted?: boolean; isVideoStopped?: boolean; isScreenSharing?: boolean }
  ): Promise<RoomParticipant | undefined> {
    const room = await this.getRoom(roomId);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (participant) {
      if (typeof media.isAudioMuted === 'boolean') participant.isAudioMuted = media.isAudioMuted;
      if (typeof media.isVideoStopped === 'boolean') participant.isVideoStopped = media.isVideoStopped;
      if (typeof media.isScreenSharing === 'boolean') participant.isScreenSharing = media.isScreenSharing;
      room.updatedAt = new Date();

      // Persist to MongoDB
      await ConsultationModel.updateOne(
        { roomId, 'participants.socketId': socketId },
        {
          $set: {
            ...(typeof media.isAudioMuted === 'boolean' && {
              'participants.$.isAudioMuted': media.isAudioMuted,
            }),
            ...(typeof media.isVideoStopped === 'boolean' && {
              'participants.$.isVideoStopped': media.isVideoStopped,
            }),
            ...(typeof media.isScreenSharing === 'boolean' && {
              'participants.$.isScreenSharing': media.isScreenSharing,
            }),
          },
        }
      );
    }

    return participant;
  }

  /**
   * Update status of call
   */
  public async updateStatus(roomId: string, status: CallStatus): Promise<ConsultationRoom | undefined> {
    const room = await this.getRoom(roomId);
    if (!room) return undefined;

    room.status = status;
    room.updatedAt = new Date();
    if (status === 'ongoing' && !room.startedAt) {
      room.startedAt = new Date();
    }

    // Persist status change to MongoDB
    await ConsultationModel.updateOne(
      { roomId },
      {
        status,
        ...(room.startedAt && { startedAt: room.startedAt }),
      }
    );

    return room;
  }

  /**
   * End the call, compute duration, and save to MongoDB
   */
  public async endCall(roomId: string): Promise<ConsultationRoom | undefined> {
    const room = await this.getRoom(roomId);
    if (!room) return undefined;

    room.status = 'ended';
    room.endedAt = new Date();

    if (room.startedAt) {
      room.durationSeconds = Math.round((room.endedAt.getTime() - room.startedAt.getTime()) / 1000);
    } else {
      room.durationSeconds = 0;
    }

    room.updatedAt = new Date();

    // Persist call conclusion to MongoDB
    await ConsultationModel.updateOne(
      { roomId },
      {
        status: 'ended',
        endedAt: room.endedAt,
        durationSeconds: room.durationSeconds,
      }
    );

    // Write audit log
    await CallLogModel.create({
      roomId,
      bookingId: room.appointmentId,
      doctorId: room.doctorId,
      patientId: room.patientId,
      eventType: 'ended',
      durationSeconds: room.durationSeconds,
      timestamp: new Date(),
    });

    logger.info(`🍃 MongoDB: Call ended for room ${roomId}. Duration: ${room.durationSeconds}s`);
    return room;
  }

  /**
   * List all active consultation rooms from MongoDB
   */
  public async listActiveRooms(): Promise<any[]> {
    const docs = await ConsultationModel.find({ status: { $ne: 'ended' } })
      .sort({ createdAt: -1 })
      .lean();
    return docs;
  }
}

export const roomService = new RoomService();
