import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { consultationService } from '../services/consultation.service.js';
import { zegoService } from '../services/zego.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ConsultationModel } from '../models/consultation.model.js';

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

  // BOLA Protection: Verify consultation exists and user is an authorized participant
  const consultation = await ConsultationModel.findOne({ roomId });
  if (!consultation) {
    throw ApiError.notFound(`Consultation room ${roomId} not found`);
  }

  const isParty = consultation.doctorId === userId || consultation.patientId === userId;
  if (!isParty && req.user?.role !== 'admin') {
    throw ApiError.forbidden('You are not authorized to join or obtain credentials for this consultation room');
  }

  // Prevent user identity spoofing if authenticated
  if (req.user && req.user.id !== userId && req.user.role !== 'admin') {
    throw ApiError.forbidden('User ID does not match authenticated token identity');
  }

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

  // BOLA Protection: ensure users can only query their own consultations
  if (req.user && req.user.id !== userId && req.user.role !== 'admin') {
    throw ApiError.forbidden('You are not authorized to view consultations for other users');
  }

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

  // Prevent user impersonation if authenticated
  if (req.user && req.user.id !== userId && req.user.role !== 'admin') {
    throw ApiError.forbidden('You are not authorized to cancel consultations for other users');
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

  // Prevent user impersonation if authenticated
  if (req.user && req.user.id !== userId && req.user.role !== 'admin') {
    throw ApiError.forbidden('You are not authorized to refresh tokens for other users');
  }

  const refreshed = await consultationService.refreshTokens(roomId, userId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(refreshed, 'Tokens refreshed successfully')
  );
};

export const getConsultationLogs = async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.roomId as string;
  const userId = (req.query.userId as string) || req.user?.id;

  const consultation = await ConsultationModel.findOne({ roomId });
  if (!consultation) {
    throw ApiError.notFound(`Consultation room ${roomId} not found`);
  }

  if (userId && req.user?.role !== 'admin') {
    const isParty = consultation.doctorId === userId || consultation.patientId === userId;
    if (!isParty) {
      throw ApiError.forbidden('You are not authorized to view audit logs for this consultation');
    }
  }

  const logs = await consultationService.getConsultationLogs(roomId);

  res.status(StatusCodes.OK).json(
    ApiResponse.success(logs, 'Consultation audit logs retrieved successfully')
  );
};
