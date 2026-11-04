import { Server } from 'socket.io';
import {
  AuthenticatedSocket,
  SignalingOfferPayload,
  SignalingAnswerPayload,
  IceCandidatePayload,
  MediaTogglePayload,
} from '../types/socket.types.js';
import { SOCKET_EVENTS } from '../constants/events.js';
import { roomService } from '../services/room.service.js';
import { mainBackendSyncService } from '../services/mainBackendSync.service.js';
import { logger } from '../config/logger.js';

export const registerSignalingHandlers = (io: Server, socket: AuthenticatedSocket): void => {
  /**
   * INITIATE CALL (Offer)
   */
  socket.on(SOCKET_EVENTS.CALL_USER, (payload: SignalingOfferPayload) => {
    const { roomId, sdp } = payload;
    const user = socket.user;

    if (!user) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized socket user' });
      return;
    }

    const room = roomService.getRoom(roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Room ${roomId} not found` });
      return;
    }

    roomService.updateStatus(roomId, 'calling');

    logger.info(`Call initiated by ${user.name} (${user.role}) in room ${roomId}`);

    // Broadcast offer to everyone else in the room
    socket.to(roomId).emit(SOCKET_EVENTS.INCOMING_CALL, {
      roomId,
      fromSocketId: socket.id,
      fromUser: user,
      sdp,
    });
  });

  /**
   * ANSWER CALL (Answer SDP)
   */
  socket.on(SOCKET_EVENTS.ANSWER_CALL, (payload: SignalingAnswerPayload) => {
    const { roomId, sdp } = payload;
    const user = socket.user;

    if (!user) return;

    roomService.updateStatus(roomId, 'ongoing');
    logger.info(`Call accepted by ${user.name} in room ${roomId}`);

    // Send answer back to the other peer in the room
    socket.to(roomId).emit(SOCKET_EVENTS.CALL_ACCEPTED, {
      roomId,
      fromSocketId: socket.id,
      fromUser: user,
      sdp,
    });
  });

  /**
   * REJECT CALL
   */
  socket.on(SOCKET_EVENTS.REJECT_CALL, ({ roomId, reason }: { roomId: string; reason?: string }) => {
    const user = socket.user;
    if (!user) return;

    logger.info(`Call rejected by ${user.name} in room ${roomId}. Reason: ${reason || 'Busy'}`);
    roomService.updateStatus(roomId, 'idle');

    socket.to(roomId).emit(SOCKET_EVENTS.CALL_REJECTED, {
      roomId,
      byUser: user,
      reason: reason || 'Call declined',
    });
  });

  /**
   * END CALL
   */
  socket.on(SOCKET_EVENTS.END_CALL, async ({ roomId }: { roomId: string }) => {
    const user = socket.user;
    if (!user) return;

    logger.info(`Call ended by ${user.name} in room ${roomId}`);
    const endedRoom = roomService.endCall(roomId);

    io.to(roomId).emit(SOCKET_EVENTS.CALL_ENDED, {
      roomId,
      byUser: user,
      durationSeconds: endedRoom?.durationSeconds || 0,
    });

    if (endedRoom) {
      await mainBackendSyncService.notifyCallEnded(endedRoom);
    }
  });

  /**
   * RELAY ICE CANDIDATE
   */
  socket.on(SOCKET_EVENTS.ICE_CANDIDATE, (payload: IceCandidatePayload) => {
    const { roomId, candidate } = payload;

    if (!candidate || !roomId) return;

    // Relay ICE candidate directly to the peer in the room
    socket.to(roomId).emit(SOCKET_EVENTS.ICE_CANDIDATE, {
      roomId,
      fromSocketId: socket.id,
      candidate,
    });
  });

  /**
   * TOGGLE MEDIA (Mute Audio / Stop Video)
   */
  socket.on(SOCKET_EVENTS.MEDIA_TOGGLE, (payload: MediaTogglePayload) => {
    const { roomId, type, enabled } = payload;
    const user = socket.user;

    if (!user || !roomId) return;

    roomService.updateParticipantMedia(roomId, socket.id, {
      ...(type === 'audio' && { isAudioMuted: !enabled }),
      ...(type === 'video' && { isVideoStopped: !enabled }),
    });

    socket.to(roomId).emit(SOCKET_EVENTS.MEDIA_TOGGLE, {
      roomId,
      userId: user.id,
      type,
      enabled,
    });
  });

  /**
   * SCREEN SHARE STATE TOGGLE
   */
  socket.on(SOCKET_EVENTS.SCREEN_SHARE, ({ roomId, isSharing }: { roomId: string; isSharing: boolean }) => {
    const user = socket.user;
    if (!user || !roomId) return;

    roomService.updateParticipantMedia(roomId, socket.id, { isScreenSharing: isSharing });

    socket.to(roomId).emit(SOCKET_EVENTS.SCREEN_SHARE, {
      roomId,
      userId: user.id,
      isSharing,
    });
  });
};
