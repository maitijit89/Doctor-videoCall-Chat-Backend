import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

export interface CometChatUserCredentials {
  provider: 'cometchat';
  appId: string;
  authKey: string;
  region: string;
  userUid: string;
  userName: string;
  userAuthToken: string;
  receiverUid?: string;
  receiverName?: string;
}

class CometChatService {
  private baseUrl: string;
  private appId: string;
  private authKey: string;
  private restApiKey: string;
  private region: string;

  constructor() {
    this.appId = env.COMETCHAT_APP_ID;
    this.authKey = env.COMETCHAT_AUTH_KEY;
    this.restApiKey = env.COMETCHAT_REST_API_KEY;
    this.region = env.COMETCHAT_REGION;
    this.baseUrl = `https://${this.appId}.api-${this.region}.cometchat.io/v3`;
  }

  private getHeaders(onBehalfOf?: string): Record<string, string> {
    const headers: Record<string, string> = {
      apiKey: this.restApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (onBehalfOf) {
      headers.onBehalfOf = onBehalfOf;
    }

    return headers;
  }

  /**
   * Ensures a user is registered in CometChat. If the user does not exist, registers them.
   */
  public async ensureUser(
    uid: string,
    name: string,
    role: string = 'default',
    avatarUrl?: string
  ): Promise<any> {
    try {
      // 1. Check if user already exists
      const checkRes = await fetch(`${this.baseUrl}/users/${encodeURIComponent(uid)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (checkRes.ok) {
        const body = (await checkRes.json()) as any;
        return body.data;
      }

      // 2. If user not found (404), create the user
      if (checkRes.status === 404) {
        logger.info(`User ${uid} not found on CometChat. Registering new user...`);

        const createRes = await fetch(`${this.baseUrl}/users`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            uid,
            name,
            role,
            ...(avatarUrl && { avatar: avatarUrl }),
          }),
        });

        if (!createRes.ok) {
          const errBody = await createRes.text();
          logger.error(`Failed to create CometChat user ${uid}: ${errBody}`);
          throw ApiError.internal(`CometChat user registration failed: ${errBody}`);
        }

        const createData = (await createRes.json()) as any;
        return createData.data;
      }

      const errText = await checkRes.text();
      throw ApiError.internal(`CometChat API error: ${errText}`);
    } catch (error: any) {
      logger.error(`Error in CometChat ensureUser for ${uid}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates a CometChat user authentication token for client-side SDK login
   */
  public async createAuthToken(uid: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${encodeURIComponent(uid)}/auth_tokens`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          force: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`Failed to generate CometChat auth token for ${uid}: ${errText}`);
        throw ApiError.internal(`CometChat token generation failed: ${errText}`);
      }

      const body = (await response.json()) as any;
      return body.data.authToken;
    } catch (error: any) {
      logger.error(`Error in CometChat createAuthToken for ${uid}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sets up 1-on-1 direct consultation chat between any User and any Doctor
   */
  public async initiateDoctorChat(
    userUid: string,
    userName: string,
    doctorUid: string,
    doctorName: string,
    userRole: string = 'default',
    doctorRole: string = 'default'
  ): Promise<{
    userCredentials: CometChatUserCredentials;
    doctorCredentials: { userUid: string; userName: string; userAuthToken: string };
  }> {
    // 1. Ensure both users exist in CometChat (using standard 'default' role)
    await Promise.all([
      this.ensureUser(userUid, userName, userRole),
      this.ensureUser(doctorUid, doctorName, doctorRole),
    ]);

    // 2. Generate auth tokens for both
    const [userAuthToken, doctorAuthToken] = await Promise.all([
      this.createAuthToken(userUid),
      this.createAuthToken(doctorUid),
    ]);

    return {
      userCredentials: {
        provider: 'cometchat',
        appId: this.appId,
        authKey: this.authKey,
        region: this.region,
        userUid,
        userName,
        userAuthToken,
        receiverUid: doctorUid,
        receiverName: doctorName,
      },
      doctorCredentials: {
        userUid: doctorUid,
        userName: doctorName,
        userAuthToken: doctorAuthToken,
      },
    };
  }

  /**
   * Sends a system announcement or consultation message into the chat
   */
  public async sendTextMessage(
    senderUid: string,
    receiverUid: string,
    text: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(senderUid),
        body: JSON.stringify({
          receiver: receiverUid,
          receiverType: 'user',
          category: 'message',
          type: 'text',
          data: {
            text,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn(`Failed to send CometChat message from ${senderUid} to ${receiverUid}: ${errText}`);
        return null;
      }

      return await response.json();
    } catch (error: any) {
      logger.warn(`Failed to dispatch CometChat message: ${error.message}`);
      return null;
    }
  }
}

export const cometChatService = new CometChatService();
