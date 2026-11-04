import { UserRole } from '../constants/roles.js';

export type CallStatus = 'idle' | 'calling' | 'ongoing' | 'ended';

export interface RoomParticipant {
  odId: string; // Socket ID or Client connection ID
  userId: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  joinedAt: Date;
  isAudioMuted: boolean;
  isVideoStopped: boolean;
  isScreenSharing: boolean;
}

export interface ConsultationRoom {
  roomId: string;
  appointmentId?: string;
  doctorId: string;
  patientId: string;
  doctorName?: string;
  patientName?: string;
  status: CallStatus;
  participants: Map<string, RoomParticipant>; // key: socketId
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoomDTO {
  roomId?: string;
  appointmentId?: string;
  doctorId: string;
  patientId: string;
  doctorName?: string;
  patientName?: string;
}
