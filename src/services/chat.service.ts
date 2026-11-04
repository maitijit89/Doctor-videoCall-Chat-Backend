import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, SendMessageDTO } from '../types/chat.types.js';
import { AuthUser } from '../types/auth.types.js';
import { logger } from '../config/logger.js';

class ChatService {
  // Key: roomId, Value: array of ChatMessage
  private messages: Map<string, ChatMessage[]> = new Map();

  /**
   * Save a new message in the room
   */
  public saveMessage(dto: SendMessageDTO, user: AuthUser): ChatMessage {
    const message: ChatMessage = {
      id: uuidv4(),
      roomId: dto.roomId,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text: dto.text,
      attachments: dto.attachments || [],
      isRead: false,
      createdAt: new Date(),
    };

    if (!this.messages.has(dto.roomId)) {
      this.messages.set(dto.roomId, []);
    }

    const roomMsgs = this.messages.get(dto.roomId)!;
    roomMsgs.push(message);

    logger.debug(`Chat message saved in room ${dto.roomId} from ${user.name}`);
    return message;
  }

  /**
   * Get messages for a consultation room with pagination
   */
  public getMessages(
    roomId: string,
    limit: number = 50,
    page: number = 1
  ): { messages: ChatMessage[]; total: number; page: number; totalPages: number } {
    const roomMsgs = this.messages.get(roomId) || [];
    const total = roomMsgs.length;
    const totalPages = Math.ceil(total / limit) || 1;

    // Return messages chronologically, paginated from newest backwards
    const startIndex = Math.max(0, total - page * limit);
    const endIndex = total - (page - 1) * limit;
    const paginated = roomMsgs.slice(startIndex, endIndex);

    return {
      messages: paginated,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Mark all unread messages in a room as read by recipient
   */
  public markAsRead(roomId: string, readerUserId: string): number {
    const roomMsgs = this.messages.get(roomId) || [];
    let updatedCount = 0;

    roomMsgs.forEach((msg) => {
      if (msg.senderId !== readerUserId && !msg.isRead) {
        msg.isRead = true;
        updatedCount++;
      }
    });

    return updatedCount;
  }
}

export const chatService = new ChatService();

