import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../types/socket.types.js';
import { RoomParticipant } from '../types/room.types.js';
import { SOCKET_EVENTS } from '../constants/events.js';
import { socketAuthMiddleware } from './socketAuth.middleware.js';
import { registerSignalingHandlers } from './signaling.handler.js';
import { registerChatHandlers } from './chat.handler.js';
import { roomService } from '../services/room.service.js';
import { mainBackendSyncService } from '../services/mainBackendSync.service.js';
import { doctorPresenceService } from '../services/doctorPresence.service.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const initializeSocketIO = (httpServer: HttpServer): SocketIOServer => {
  const allowedOrigins =
    env.CORS_ORIGIN === '*'
      ? '*'
      : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Apply Socket Authentication Middleware
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const user = socket.user;
    logger.info(`🔌 Client connected: ${socket.id} (${user?.name} - ${user?.role})`);

    // If connected user is a doctor, update presence to online
    if (user?.role === 'doctor') {
      await doctorPresenceService.setStatus(user.id, 'online', user.name, socket.id);
    }

    /**
     * DOCTOR PRESENCE / HEARTBEAT
     */
    socket.on('doctor:heartbeat', async () => {
      if (user?.role === 'doctor') {
        await doctorPresenceService.heartbeat(user.id);
      }
    });

    socket.on('doctor:set-status', async ({ status }: { status: 'online' | 'busy' | 'offline' }) => {
      if (user?.role === 'doctor') {
        await doctorPresenceService.setStatus(user.id, status, user.name, socket.id);
        io.emit('doctor:status-changed', { doctorId: user.id, status });
      }
    });

    /**
     * JOIN CONSULTATION ROOM
     */
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async ({ roomId }: { roomId: string }) => {
      if (!roomId || !user) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid room join payload' });
        return;
      }

      // Check if room exists; if not, create it dynamically in MongoDB
      let room = await roomService.getRoom(roomId);
      if (!room) {
        room = await roomService.createRoom({
          roomId,
          doctorId: user.role === 'doctor' ? user.id : 'pending_doctor',
          patientId: user.role === 'patient' ? user.id : 'pending_patient',
        });
      }

      // Check room capacity
      if (room.participants.size >= 4) {
        socket.emit(SOCKET_EVENTS.ROOM_FULL, { message: 'Consultation room is currently full' });
        return;
      }

      socket.roomId = roomId;
      socket.join(roomId);

      const participant: RoomParticipant = {
        odId: socket.id,
        userId: user.id,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        joinedAt: new Date(),
        isAudioMuted: false,
        isVideoStopped: false,
        isScreenSharing: false,
      };

      const updatedRoom = await roomService.addParticipant(roomId, participant);

      // If doctor entered active room, update presence to busy
      if (user.role === 'doctor') {
        await doctorPresenceService.setStatus(user.id, 'busy', user.name, socket.id, roomId);
      }

      logger.info(`User ${user.name} joined room ${roomId}. Total participants: ${updatedRoom.participants.size}`);

      // Notify the joining user with current room state and existing participants
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
        roomId,
        participants: Array.from(updatedRoom.participants.values()),
        status: updatedRoom.status,
      });

      // Broadcast to other participants that a new peer joined
      socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, {
        participant,
        roomId,
      });
    });

    /**
     * LEAVE CONSULTATION ROOM
     */
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, async ({ roomId }: { roomId: string }) => {
      if (!roomId) return;

      const removedParticipant = await roomService.removeParticipant(roomId, socket.id);
      socket.leave(roomId);
      socket.roomId = undefined;

      if (user?.role === 'doctor') {
        await doctorPresenceService.setStatus(user.id, 'online', user.name, socket.id);
      }

      if (removedParticipant) {
        logger.info(`User ${removedParticipant.name} left room ${roomId}`);
        socket.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, {
          userId: removedParticipant.userId,
          socketId: socket.id,
          roomId,
        });
      }
    });

    // Register WebRTC Signaling Handlers
    registerSignalingHandlers(io, socket);

    // Register Consultation Chat Handlers
    registerChatHandlers(io, socket);

    /**
     * DISCONNECT CLEANUP
     */
    socket.on('disconnect', async (reason) => {
      logger.info(`Client disconnected: ${socket.id} (${reason})`);

      if (user?.role === 'doctor') {
        await doctorPresenceService.setStatus(user.id, 'offline', user.name);
        io.emit('doctor:status-changed', { doctorId: user.id, status: 'offline' });
      }

      if (socket.roomId) {
        const removed = await roomService.removeParticipant(socket.roomId, socket.id);
        if (removed) {
          socket.to(socket.roomId).emit(SOCKET_EVENTS.USER_LEFT, {
            userId: removed.userId,
            socketId: socket.id,
            roomId: socket.roomId,
          });

          // If room ended upon participant departure, sync with main backend
          const currentRoom = await roomService.getRoom(socket.roomId);
          if (currentRoom && currentRoom.status === 'ended') {
            await mainBackendSyncService.notifyCallEnded(currentRoom);
          }
        }
      }
    });
  });

  return io;
};
