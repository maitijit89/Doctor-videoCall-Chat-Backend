import { Socket } from 'socket.io';
import { AuthUser } from './auth.types.js';

export interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
  roomId?: string;
}

export interface SignalingOfferPayload {
  toUserId?: string;
  toSocketId?: string;
  sdp: any;
  roomId: string;
}

export interface SignalingAnswerPayload {
  toUserId?: string;
  toSocketId?: string;
  sdp: any;
  roomId: string;
}

export interface IceCandidatePayload {
  toUserId?: string;
  toSocketId?: string;
  candidate: any;
  roomId: string;
}

export interface MediaTogglePayload {
  roomId: string;
  type: 'audio' | 'video';
  enabled: boolean;
}
