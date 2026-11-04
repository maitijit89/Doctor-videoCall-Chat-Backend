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

  const room = roomService.getRoom(roomId);
  if (!room) {
    throw ApiError.notFound(`Consultation room ${roomId} not found`);
  }

  // If user is authenticated, ensure they belong to this room
  if (req.user && !roomService.validateAccess(roomId, req.user.id)) {
    throw ApiError.forbidden('You are not authorized to view messages in this consultation room');
  }

  const result = chatService.getMessages(roomId, limit, page);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(
      result.messages,
      'Chat history retrieved successfully',
      StatusCodes.OK
    )
  );
};
