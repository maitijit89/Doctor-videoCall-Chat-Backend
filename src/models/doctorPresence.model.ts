import mongoose, { Schema, Document } from 'mongoose';

export type DoctorStatus = 'online' | 'busy' | 'offline';

export interface IDoctorPresence extends Document {
  doctorId: string;
  doctorName?: string;
  status: DoctorStatus;
  activeRoomId?: string;
  lastHeartbeat: Date;
  socketId?: string;
  metadata?: Record<string, any>;
  updatedAt: Date;
}

const DoctorPresenceSchema = new Schema<IDoctorPresence>(
  {
    doctorId: { type: String, required: true, unique: true, index: true },
    doctorName: { type: String },
    status: {
      type: String,
      enum: ['online', 'busy', 'offline'],
      default: 'offline',
      index: true,
    },
    activeRoomId: { type: String },
    socketId: { type: String },
    lastHeartbeat: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

export const DoctorPresenceModel = mongoose.model<IDoctorPresence>(
  'DoctorPresence',
  DoctorPresenceSchema
);
