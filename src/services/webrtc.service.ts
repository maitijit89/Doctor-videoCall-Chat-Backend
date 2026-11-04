import { env } from '../config/env.js';

export interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

class WebRTCService {
  /**
   * Generates or fetches the active ICE servers configuration
   */
  public getIceServers(): RTCIceServerConfig[] {
    const iceServers: RTCIceServerConfig[] = [];

    // Parse STUN servers from env
    const stunUrls = env.STUN_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
    if (stunUrls.length > 0) {
      iceServers.push({
        urls: stunUrls,
      });
    }

    // Add TURN server if credentials are configured
    if (env.TURN_SERVER_URL) {
      const turnConfig: RTCIceServerConfig = {
        urls: env.TURN_SERVER_URL,
      };

      if (env.TURN_SERVER_USERNAME) {
        turnConfig.username = env.TURN_SERVER_USERNAME;
      }
      if (env.TURN_SERVER_CREDENTIAL) {
        turnConfig.credential = env.TURN_SERVER_CREDENTIAL;
      }

      iceServers.push(turnConfig);
    }

    return iceServers;
  }
}

export const webrtcService = new WebRTCService();
