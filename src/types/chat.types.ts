import { UserRole } from '../constants/roles.js';

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  fileType: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  attachments?: ChatAttachment[];
  isRead: boolean;
  createdAt: Date;
}

export interface SendMessageDTO {
  roomId: string;
  text: string;
  attachments?: ChatAttachment[];
}

