import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { doctorPresenceService } from '../services/doctorPresence.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getDoctorPresence = async (req: Request, res: Response): Promise<void> => {
  const doctorId = req.params.doctorId as string;
  const presence = await doctorPresenceService.getPresence(doctorId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(presence, 'Doctor presence retrieved successfully')
  );
};

export const getOnlineDoctors = async (_req: Request, res: Response): Promise<void> => {
  const onlineDoctors = await doctorPresenceService.listOnlineDoctors();

  res.status(StatusCodes.OK).json(
    ApiResponse.success(onlineDoctors, 'Online doctors retrieved successfully')
  );
};

export const postHeartbeat = async (req: Request, res: Response): Promise<void> => {
  const doctorId = req.params.doctorId as string;

  // Authorization: ensure caller cannot spoof another doctor's heartbeat
  if (req.user && req.user.id !== doctorId && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only update your own doctor presence heartbeat');
  }

  await doctorPresenceService.heartbeat(doctorId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(null, 'Heartbeat recorded')
  );
};

