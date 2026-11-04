import mongoose, { Schema, Document } from 'mongoose';
import { CallStatus } from '../types/room.types.js';

export interface IParticipant {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  avatarUrl?: string;
  joinedAt: Date;
  isAudioMuted: boolean;
  isVideoStopped: boolean;
  isScreenSharing: boolean;
}

export interface IConsultation extends Document {
  roomId: string;
  bookingId: string;
  appointmentId?: string;
  doctorId: string;
  doctorName?: string;
  doctorAvatar?: string;
  patientId: string;
  patientName?: string;
  patientAvatar?: string;
  status: CallStatus;
  participants: IParticipant[];
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds: number;
  zegoRoomId?: string;
  cometChatConversationId?: string;
  isSyncedWithMainBackend: boolean;
  syncedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    socketId: { type: String, required: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    avatarUrl: { type: String },
    joinedAt: { type: Date, default: Date.now },
    isAudioMuted: { type: Boolean, default: false },
    isVideoStopped: { type: Boolean, default: false },
    isScreenSharing: { type: Boolean, default: false },
  },
  { _id: false }
);

const ConsultationSchema = new Schema<IConsultation>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    bookingId: { type: String, required: true, index: true },
    appointmentId: { type: String, index: true },
    doctorId: { type: String, required: true, index: true },
    doctorName: { type: String },
    doctorAvatar: { type: String },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String },
    patientAvatar: { type: String },
    status: {
      type: String,
      enum: ['idle', 'calling', 'ongoing', 'ended'],
      default: 'idle',
      index: true,
    },
    participants: [ParticipantSchema],
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    zegoRoomId: { type: String },
    cometChatConversationId: { type: String },
    isSyncedWithMainBackend: { type: Boolean, default: false },
    syncedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast query lookup
ConsultationSchema.index({ doctorId: 1, status: 1 });
ConsultationSchema.index({ patientId: 1, status: 1 });
ConsultationSchema.index({ createdAt: -1 });

export const ConsultationModel = mongoose.model<IConsultation>(
  'Consultation',
  ConsultationSchema
);
