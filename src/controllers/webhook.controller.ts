import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { zegoService } from '../services/zego.service.js';
import { roomService } from '../services/room.service.js';
import { mainBackendSyncService } from '../services/mainBackendSync.service.js';
import { logger } from '../config/logger.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const handleZegoWebhook = async (req: Request, res: Response): Promise<void> => {
  const { nonce, timestamp, signature } = req.query as {
    nonce?: string;
    timestamp?: string;
    signature?: string;
  };

  // Reject requests without mandatory cryptographic signature parameters
  if (!nonce || !timestamp || !signature) {
    logger.warn('ZEGOCLOUD webhook rejected: missing signature verification parameters.');
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Missing webhook signature parameters' });
    return;
  }

  // Anti-Replay: Verify timestamp is within 300-second tolerance window
  const eventTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(eventTime) || Math.abs(now - eventTime) > 300) {
    logger.warn(`ZEGOCLOUD webhook replay detected or expired timestamp: ${timestamp} (skew: ${now - eventTime}s)`);
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Webhook timestamp expired / replay detected' });
    return;
  }

  // Cryptographic constant-time signature verification
  const isValid = zegoService.verifyWebhook(nonce, timestamp, signature);
  if (!isValid) {
    logger.warn('ZEGOCLOUD webhook signature verification failed.');
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid webhook signature' });
    return;
  }

  logger.info('Received verified ZEGOCLOUD webhook event:', req.body);

  const { event, room_id } = req.body;

  // Process room close or call end event
  if (event === 'room_close' || event === 'room_destroy' || req.body.action === 'room_close') {
    const roomId = room_id || req.body.roomId;
    if (roomId) {
      logger.info(`ZEGOCLOUD room closed: ${roomId}. Ending call session...`);
      const endedRoom = await roomService.endCall(roomId);

      if (endedRoom) {
        await mainBackendSyncService.notifyCallEnded(endedRoom);
      }
    }
  }

  res.status(StatusCodes.OK).json(ApiResponse.success(null, 'ZEGOCLOUD callback processed'));
};

export const handleCometChatWebhook = async (req: Request, res: Response): Promise<void> => {
  logger.info('Received COMETCHAT webhook event:', req.body);
  res.status(StatusCodes.OK).json(ApiResponse.success(null, 'CometChat callback received'));
};

