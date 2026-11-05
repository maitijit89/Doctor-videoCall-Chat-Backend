import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { consultationService } from '../services/consultation.service.js';
import { zegoService } from '../services/zego.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const createConsultationSession = async (req: Request, res: Response): Promise<void> => {
  const session = await consultationService.createConsultationSession(req.body);

  res.status(StatusCodes.CREATED).json(
    ApiResponse.created(
      session,
      'Post-booking consultation session created with ZEGOCLOUD Video Call & COMETCHAT Chat'
    )
  );
};

export const initiateDirectChat = async (req: Request, res: Response): Promise<void> => {
  const { userUid, userName, doctorUid, doctorName } = req.body;

  const chatConfig = await consultationService.initiateAnyUserDoctorChat(
    userUid,
    userName,
    doctorUid,
    doctorName
  );

  res.status(StatusCodes.OK).json(
    ApiResponse.success(
      chatConfig,
      'CometChat direct messaging session initialized successfully'
    )
  );
};

export const getVideoCallToken = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const userId = req.query.userId as string;
  const userName = (req.query.userName as string) || userId;

  const credentials = zegoService.getCallCredentials(userId, userName, roomId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(
      credentials,
      'ZEGOCLOUD video call token generated successfully'
    )
  );
};

export const getUserConsultations = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const role = req.query.role as 'doctor' | 'patient' | undefined;

  const consultations = await consultationService.getUserConsultations(userId, role);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(consultations, 'User consultations retrieved successfully')
  );
};

export const cancelConsultation = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const userId = (req.body.userId as string) || req.user?.id;
  const reason = req.body.reason as string | undefined;

  if (!userId) {
    throw ApiError.badRequest('User ID is required to cancel consultation');
  }

  const cancelled = await consultationService.cancelConsultation(roomId, userId, reason);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(cancelled, 'Consultation cancelled successfully')
  );
};

export const refreshTokens = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const userId = (req.body.userId as string) || (req.query.userId as string) || req.user?.id;

  if (!userId) {
    throw ApiError.badRequest('User ID is required to refresh tokens');
  }

  const refreshed = await consultationService.refreshTokens(roomId, userId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(refreshed, 'Tokens refreshed successfully')
  );
};

export const getConsultationLogs = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const logs = await consultationService.getConsultationLogs(roomId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(logs, 'Consultation audit logs retrieved successfully')
  );
};
