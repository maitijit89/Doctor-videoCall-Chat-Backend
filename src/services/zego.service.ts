import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { generateToken04, verifyZegoCallbackSignature, ZegoPrivilegePayload } from './zegoServerAssistant.js';

export interface ZegoCallCredentials {
  provider: 'zegocloud';
  appId: number;
  appSign: string;
  roomId: string;
  userId: string;
  userName: string;
  token: string;
  expiresInSeconds: number;
}

class ZegoService {
  private appId: number;
  private appSign: string;
  private secret: string;

  constructor() {
    this.appId = env.ZEGO_APP_ID;
    this.appSign = env.ZEGO_APP_SIGN;
    // Callback secret or 32-char secret used for Token04 generation
    this.secret = env.ZEGO_CALLBACK_SECRET.substring(0, 32);
  }

  /**
   * Generates a secure ZEGOCLOUD Token04 for a user to join a video call room
   */
  public generateRoomToken(
    userId: string,
    roomId: string,
    effectiveTimeInSeconds: number = 7200 // 2 hours default
  ): string {
    const payloadObject: ZegoPrivilegePayload = {
      room_id: roomId,
      privilege: {
        1: 1, // loginRoom: 1 = allowed
        2: 1, // publishStream: 1 = allowed
      },
      stream_id_list: null,
    };

    const payload = JSON.stringify(payloadObject);
    const token = generateToken04(this.appId, userId, this.secret, effectiveTimeInSeconds, payload);

    logger.debug(`Generated ZEGOCLOUD Token04 for user ${userId} in room ${roomId}`);
    return token;
  }

  /**
   * Produces the full ZEGOCLOUD configuration needed by the frontend client (Web / Flutter / React Native UIKit)
   */
  public getCallCredentials(
    userId: string,
    userName: string,
    roomId: string,
    effectiveTimeInSeconds: number = 7200
  ): ZegoCallCredentials {
    const token = this.generateRoomToken(userId, roomId, effectiveTimeInSeconds);

    return {
      provider: 'zegocloud',
      appId: this.appId,
      appSign: this.appSign,
      roomId,
      userId,
      userName,
      token,
      expiresInSeconds: effectiveTimeInSeconds,
    };
  }

  /**
   * Verify ZEGOCLOUD webhook signature
   */
  public verifyWebhook(nonce: string, timestamp: string, signature: string): boolean {
    return verifyZegoCallbackSignature(nonce, timestamp, signature, this.secret);
  }
}

export const zegoService = new ZegoService();

