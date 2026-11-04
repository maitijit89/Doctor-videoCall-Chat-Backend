import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../constants/roles.js';

export interface IChatAttachment {
  id: string;
  name: string;
  url: string;
  fileType: string;
  sizeBytes: number;
}

export interface IChatMessage extends Document {
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  attachments: IChatAttachment[];
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IChatAttachment>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    senderRole: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    text: { type: String, default: '' },
    attachments: [AttachmentSchema],
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast paginated chat history retrieval
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });

export const ChatMessageModel = mongoose.model<IChatMessage>(
  'ChatMessage',
  ChatMessageSchema
);
