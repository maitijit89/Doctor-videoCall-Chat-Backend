import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, SendMessageDTO, ChatAttachment } from '../types/chat.types.js';
import { AuthUser } from '../types/auth.types.js';
import { ChatMessageModel } from '../models/chatMessage.model.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

class ChatService {
  /**
   * Save a new message in MongoDB
   */
  public async saveMessage(dto: SendMessageDTO, user: AuthUser): Promise<ChatMessage> {
    const doc = await ChatMessageModel.create({
      roomId: dto.roomId,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text: dto.text,
      attachments: dto.attachments || [],
      isRead: false,
    });

    const message: ChatMessage = {
      id: doc._id.toString(),
      roomId: doc.roomId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      senderRole: doc.senderRole,
      text: doc.text,
      attachments: doc.attachments,
      isRead: doc.isRead,
      createdAt: doc.createdAt,
    };

    logger.debug(`🍃 MongoDB: Chat message saved in room ${dto.roomId} from ${user.name}`);
    return message;
  }

  /**
   * Get messages for a consultation room with MongoDB pagination
   */
  public async getMessages(
    roomId: string,
    limit: number = 50,
    page: number = 1
  ): Promise<{ messages: ChatMessage[]; total: number; page: number; totalPages: number }> {
    const total = await ChatMessageModel.countDocuments({ roomId });
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = Math.max(0, (page - 1) * limit);

    const docs = await ChatMessageModel.find({ roomId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const messages: ChatMessage[] = docs.map((doc) => ({
      id: (doc as any)._id.toString(),
      roomId: doc.roomId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      senderRole: doc.senderRole,
      text: doc.text,
      attachments: doc.attachments,
      isRead: doc.isRead,
      createdAt: doc.createdAt,
    }));

    return {
      messages,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Search messages within a consultation room
   */
  public async searchMessages(roomId: string, searchText: string, limit: number = 20): Promise<ChatMessage[]> {
    if (!searchText || searchText.trim() === '') {
      return [];
    }

    // Escape regex metacharacters to prevent ReDoS (Regular Expression Denial of Service)
    const sanitizedSearch = searchText.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const docs = await ChatMessageModel.find({
      roomId,
      text: { $regex: sanitizedSearch, $options: 'i' },
    })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 100))
      .lean();

    return docs.map((doc) => ({
      id: (doc as any)._id.toString(),
      roomId: doc.roomId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      senderRole: doc.senderRole,
      text: doc.text,
      attachments: doc.attachments,
      isRead: doc.isRead,
      createdAt: doc.createdAt,
    }));
  }

  /**
   * Delete or redact a message from consultation history
   */
  public async deleteMessage(roomId: string, messageId: string, userId: string): Promise<boolean> {
    const msg = await ChatMessageModel.findOne({ _id: messageId, roomId });
    if (!msg) {
      throw ApiError.notFound('Message not found');
    }

    if (msg.senderId !== userId) {
      throw ApiError.forbidden('You are not authorized to delete this message');
    }

    await ChatMessageModel.deleteOne({ _id: messageId });
    logger.info(`Message ${messageId} deleted from room ${roomId} by user ${userId}`);
    return true;
  }

  /**
   * Generates metadata for medical document uploads (prescriptions, lab tests)
   */
  public generateAttachmentUploadConfig(
    roomId: string,
    fileName: string,
    fileType: string,
    sizeBytes: number
  ): ChatAttachment {
    const attachmentId = uuidv4();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `consultations/${roomId}/${attachmentId}_${sanitizedFileName}`;

    return {
      id: attachmentId,
      name: fileName,
      url: `/uploads/${storagePath}`,
      fileType,
      sizeBytes,
    };
  }

  /**
   * Mark all unread messages in a room as read by recipient in MongoDB
   */
  public async markAsRead(roomId: string, readerUserId: string): Promise<number> {
    const result = await ChatMessageModel.updateMany(
      { roomId, senderId: { $ne: readerUserId }, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return result.modifiedCount;
  }
}

export const chatService = new ChatService();
