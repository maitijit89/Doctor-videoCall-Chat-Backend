import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../types/socket.types.js';
import { SendMessageDTO } from '../types/chat.types.js';
import { SOCKET_EVENTS } from '../constants/events.js';
import { chatService } from '../services/chat.service.js';
import { logger } from '../config/logger.js';

export const registerChatHandlers = (_io: Server, socket: AuthenticatedSocket): void => {
  /**
   * SEND CHAT MESSAGE
   */
  socket.on(SOCKET_EVENTS.SEND_MESSAGE, (dto: SendMessageDTO) => {
    const user = socket.user;
    if (!user) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized user' });
      return;
    }

    if (!dto.roomId || (!dto.text && (!dto.attachments || dto.attachments.length === 0))) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Message text or attachment is required' });
      return;
    }

    const savedMessage = chatService.saveMessage(dto, user);

    logger.debug(`Broadcast message to room ${dto.roomId} by ${user.name}`);

    // Broadcast message to everyone in the room (including sender confirmation if needed)
    socket.to(dto.roomId).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, savedMessage);

    // Also emit back to sender with acknowledgement ID
    socket.emit(SOCKET_EVENTS.RECEIVE_MESSAGE, savedMessage);
  });

  /**
   * TYPING INDICATOR (START)
   */
  socket.on(SOCKET_EVENTS.TYPING_START, ({ roomId }: { roomId: string }) => {
    const user = socket.user;
    if (!user || !roomId) return;

    socket.to(roomId).emit(SOCKET_EVENTS.USER_TYPING, {
      roomId,
      userId: user.id,
      name: user.name,
      isTyping: true,
    });
  });

  /**
   * TYPING INDICATOR (STOP)
   */
  socket.on(SOCKET_EVENTS.TYPING_STOP, ({ roomId }: { roomId: string }) => {
    const user = socket.user;
    if (!user || !roomId) return;

    socket.to(roomId).emit(SOCKET_EVENTS.USER_TYPING, {
      roomId,
      userId: user.id,
      name: user.name,
      isTyping: false,
    });
  });

  /**
   * MESSAGE READ RECEIPT
   */
  socket.on(SOCKET_EVENTS.MESSAGE_READ, ({ roomId }: { roomId: string }) => {
    const user = socket.user;
    if (!user || !roomId) return;

    chatService.markAsRead(roomId, user.id);

    socket.to(roomId).emit(SOCKET_EVENTS.MESSAGE_READ, {
      roomId,
      readerId: user.id,
      readAt: new Date(),
    });
  });
};
