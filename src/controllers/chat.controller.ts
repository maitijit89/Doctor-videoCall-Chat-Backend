import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { chatService } from '../services/chat.service.js';
import { roomService } from '../services/room.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

  const room = await roomService.getRoom(roomId);
  if (!room) {
    throw ApiError.notFound(`Consultation room ${roomId} not found`);
  }

  // If user is authenticated, ensure they belong to this room
  if (req.user && !(await roomService.validateAccess(roomId, req.user.id))) {
    throw ApiError.forbidden('You are not authorized to view messages in this consultation room');
  }

  const result = await chatService.getMessages(roomId, limit, page);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(
      result.messages,
      'Chat history retrieved successfully from MongoDB',
      StatusCodes.OK
    )
  );
};

export const searchChatHistory = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const query = (req.query.q as string) || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  const messages = await chatService.searchMessages(roomId, query, limit);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(messages, 'Search results retrieved successfully')
  );
};

export const deleteChatMessage = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const messageId = req.params.messageId as string;
  const userId = (req.body.userId as string) || req.user?.id;

  if (!userId) {
    throw ApiError.badRequest('User ID is required to delete message');
  }

  await chatService.deleteMessage(roomId, messageId, userId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(null, 'Message deleted successfully')
  );
};

export const createAttachmentUploadConfig = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const { fileName, fileType, sizeBytes } = req.body;

  if (!fileName || !fileType) {
    throw ApiError.badRequest('File name and file type are required');
  }

  const attachment = chatService.generateAttachmentUploadConfig(
    roomId,
    fileName,
    fileType,
    sizeBytes || 0
  );

  res.status(StatusCodes.OK).json(
    ApiResponse.success(attachment, 'Attachment upload metadata generated')
  );
};
