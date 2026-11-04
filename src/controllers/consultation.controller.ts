import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { consultationService } from '../services/consultation.service.js';
import { zegoService } from '../services/zego.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';

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

