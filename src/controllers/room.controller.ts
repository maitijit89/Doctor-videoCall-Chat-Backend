import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { roomService } from '../services/room.service.js';
import { mainBackendSyncService } from '../services/mainBackendSync.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { CreateRoomDTO } from '../types/room.types.js';

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  const dto: CreateRoomDTO = req.body;
  const room = await roomService.createRoom(dto);

  const formattedRoom = {
    ...room,
    participants: Array.from(room.participants.values()),
  };

  res.status(StatusCodes.CREATED).json(
    ApiResponse.created(formattedRoom, 'Consultation room created successfully')
  );
};

export const getRoom = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const room = await roomService.getRoom(roomId);

  if (!room) {
    throw ApiError.notFound(`Consultation room ${roomId} not found`);
  }

  const formattedRoom = {
    ...room,
    participants: Array.from(room.participants.values()),
  };

  res.status(StatusCodes.OK).json(
    ApiResponse.success(formattedRoom, 'Consultation room retrieved successfully')
  );
};

export const getActiveRooms = async (_req: Request, res: Response): Promise<void> => {
  const rooms = await roomService.listActiveRooms();
  res.status(StatusCodes.OK).json(
    ApiResponse.success(rooms, 'Active rooms retrieved successfully')
  );
};

export const validateAccess = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const userId = (req.query.userId as string) || req.user?.id;

  if (!userId) {
    throw ApiError.badRequest('User ID is required to validate access');
  }

  const room = await roomService.getRoom(roomId);
  if (!room) {
    throw ApiError.notFound(`Consultation room ${roomId} not found`);
  }

  const hasAccess = await roomService.validateAccess(roomId, userId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(
      {
        hasAccess,
        roomId,
        userId,
        role: room.doctorId === userId ? 'doctor' : room.patientId === userId ? 'patient' : null,
        status: room.status,
      },
      hasAccess ? 'User authorized to enter room' : 'User not authorized to enter room'
    )
  );
};

export const endRoom = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const room = await roomService.endCall(roomId);

  if (!room) {
    throw ApiError.notFound(`Consultation room ${roomId} not found`);
  }

  // Sync with main backend asynchronously
  await mainBackendSyncService.notifyCallEnded(room);

  const formattedRoom = {
    ...room,
    participants: Array.from(room.participants.values()),
  };

  res.status(StatusCodes.OK).json(
    ApiResponse.success(formattedRoom, 'Consultation call ended successfully')
  );
};
