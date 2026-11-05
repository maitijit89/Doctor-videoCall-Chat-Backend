import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { doctorPresenceService } from '../services/doctorPresence.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';

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
  await doctorPresenceService.heartbeat(doctorId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(null, 'Heartbeat recorded')
  );
};
