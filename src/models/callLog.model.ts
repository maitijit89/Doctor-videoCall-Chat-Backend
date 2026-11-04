import mongoose, { Schema, Document } from 'mongoose';

export interface ICallLog extends Document {
  roomId: string;
  bookingId?: string;
  doctorId: string;
  patientId: string;
  eventType: 'initiated' | 'accepted' | 'rejected' | 'ended' | 'webhook_received';
  durationSeconds?: number;
  byUserId?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

const CallLogSchema = new Schema<ICallLog>(
  {
    roomId: { type: String, required: true, index: true },
    bookingId: { type: String, index: true },
    doctorId: { type: String, required: true, index: true },
    patientId: { type: String, required: true, index: true },
    eventType: {
      type: String,
      enum: ['initiated', 'accepted', 'rejected', 'ended', 'webhook_received'],
      required: true,
      index: true,
    },
    durationSeconds: { type: Number },
    byUserId: { type: String },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
  }
);

export const CallLogModel = mongoose.model<ICallLog>('CallLog', CallLogSchema);
