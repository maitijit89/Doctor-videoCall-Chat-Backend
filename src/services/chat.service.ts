import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, SendMessageDTO } from '../types/chat.types.js';
import { AuthUser } from '../types/auth.types.js';
import { ChatMessageModel } from '../models/chatMessage.model.js';
import { logger } from '../config/logger.js';

class ChatService {
  /**
   * Save a new message in MongoDB
   */
  public async saveMessage(dto: SendMessageDTO, user: AuthUser): Promise<ChatMessage> {
    const messageId = uuidv4();

    // Persist to MongoDB
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
      id: doc._id.toString() || messageId,
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
