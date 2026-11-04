import { v4 as uuidv4 } from 'uuid';
import { ConsultationRoom, CreateRoomDTO, RoomParticipant, CallStatus } from '../types/room.types.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

class RoomService {
  // In-memory room store (can be replaced with Redis/DB repository)
  private rooms: Map<string, ConsultationRoom> = new Map();

  /**
   * Create or initialize a consultation room
   */
  public createRoom(dto: CreateRoomDTO): ConsultationRoom {
    const roomId = dto.roomId || `room_${uuidv4().substring(0, 8)}`;

    if (this.rooms.has(roomId)) {
      const existing = this.rooms.get(roomId)!;
      // If room already exists and not ended, return it
      if (existing.status !== 'ended') {
        return existing;
      }
    }

    const room: ConsultationRoom = {
      roomId,
      appointmentId: dto.appointmentId,
      doctorId: dto.doctorId,
      patientId: dto.patientId,
      doctorName: dto.doctorName,
      patientName: dto.patientName,
      status: 'idle',
      participants: new Map<string, RoomParticipant>(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rooms.set(roomId, room);
    logger.info(`Consultation room created: ${roomId} (Doctor: ${dto.doctorId}, Patient: ${dto.patientId})`);
    return room;
  }

  /**
   * Retrieve a room by ID
   */
  public getRoom(roomId: string): ConsultationRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Validate if a user is authorized to join the consultation room
   */
  public validateAccess(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    return room.doctorId === userId || room.patientId === userId;
  }

  /**
   * Add a participant to the room
   */
  public addParticipant(roomId: string, participant: RoomParticipant): ConsultationRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw ApiError.notFound(`Room ${roomId} not found`);
    }

    room.participants.set(participant.odId, participant);
    room.updatedAt = new Date();

    if (room.participants.size >= 2 && room.status === 'idle') {
      room.status = 'ongoing';
      room.startedAt = new Date();
    }

    return room;
  }

  /**
   * Remove a participant from the room by socketId
   */
  public removeParticipant(roomId: string, socketId: string): RoomParticipant | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (participant) {
      room.participants.delete(socketId);
      room.updatedAt = new Date();

      if (room.participants.size === 0 && room.status === 'ongoing') {
        this.endCall(roomId);
      }
    }

    return participant;
  }

  /**
   * Update participant media states (mute audio, turn off video, screen share)
   */
  public updateParticipantMedia(
    roomId: string,
    socketId: string,
    media: { isAudioMuted?: boolean; isVideoStopped?: boolean; isScreenSharing?: boolean }
  ): RoomParticipant | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (participant) {
      if (typeof media.isAudioMuted === 'boolean') participant.isAudioMuted = media.isAudioMuted;
      if (typeof media.isVideoStopped === 'boolean') participant.isVideoStopped = media.isVideoStopped;
      if (typeof media.isScreenSharing === 'boolean') participant.isScreenSharing = media.isScreenSharing;
      room.updatedAt = new Date();
    }

    return participant;
  }

  /**
   * Update status of call
   */
  public updateStatus(roomId: string, status: CallStatus): ConsultationRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.status = status;
    room.updatedAt = new Date();
    if (status === 'ongoing' && !room.startedAt) {
      room.startedAt = new Date();
    }

    return room;
  }

  /**
   * End the call and compute duration
   */
  public endCall(roomId: string): ConsultationRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.status = 'ended';
    room.endedAt = new Date();

    if (room.startedAt) {
      room.durationSeconds = Math.round((room.endedAt.getTime() - room.startedAt.getTime()) / 1000);
    } else {
      room.durationSeconds = 0;
    }

    room.updatedAt = new Date();
    logger.info(`Call ended for room ${roomId}. Duration: ${room.durationSeconds}s`);
    return room;
  }

  /**
   * List all active consultation rooms (formatted for JSON serialization)
   */
  public listActiveRooms(): any[] {
    const active: any[] = [];
    this.rooms.forEach((room) => {
      active.push({
        ...room,
        participants: Array.from(room.participants.values()),
      });
    });
    return active;
  }
}

export const roomService = new RoomService();

