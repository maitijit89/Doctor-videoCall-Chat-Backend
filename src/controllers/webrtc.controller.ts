import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { webrtcService } from '../services/webrtc.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const getIceServers = (_req: Request, res: Response): void => {
  const iceServers = webrtcService.getIceServers();
  res.status(StatusCodes.OK).json(
    ApiResponse.success({ iceServers }, 'ICE servers retrieved successfully')
  );
};
