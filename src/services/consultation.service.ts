import { roomService } from './room.service.js';
import { zegoService } from './zego.service.js';
import { cometChatService } from './cometchat.service.js';
import { ConsultationModel, IConsultation } from '../models/consultation.model.js';
import { CallLogModel } from '../models/callLog.model.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

export interface CreateConsultationSessionDTO {
  bookingId: string;
  doctorId: string;
  doctorName: string;
  doctorAvatar?: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  scheduledAt?: string;
}

export interface ConsultationSessionResponse {
  consultationId: string;
  bookingId: string;
  status: string;
  videoCall: {
    provider: 'zegocloud';
    appId: number;
    appSign: string;
    roomId: string;
    patientToken: string;
    doctorToken: string;
    expiresInSeconds: number;
  };
  chat: {
    provider: 'cometchat';
    appId: string;
    authKey: string;
    region: string;
    patientAuthToken: string;
    doctorAuthToken: string;
    patientUid: string;
    doctorUid: string;
  };
  createdAt: Date;
}

class ConsultationService {
  /**
   * Initializes full Video Call (ZEGOCLOUD) & Chat (COMETCHAT) session and persists to MongoDB
   */
  public async createConsultationSession(
    dto: CreateConsultationSessionDTO
  ): Promise<ConsultationSessionResponse> {
    const roomId = `room_${dto.bookingId}`;
    logger.info(`🍃 MongoDB: Creating post-booking consultation session for booking ${dto.bookingId}`);

    // 1. Initialize room in MongoDB & Cache
    await roomService.createRoom({
      roomId,
      appointmentId: dto.bookingId,
      doctorId: dto.doctorId,
      patientId: dto.patientId,
      doctorName: dto.doctorName,
      patientName: dto.patientName,
    });

    // 2. Generate ZEGOCLOUD Video Call Tokens for both Doctor & Patient
    const patientZegoToken = zegoService.generateRoomToken(dto.patientId, roomId);
    const doctorZegoToken = zegoService.generateRoomToken(dto.doctorId, roomId);
    const zegoCreds = zegoService.getCallCredentials(dto.patientId, dto.patientName, roomId);

    // 3. Provision & Authorize both Doctor and Patient in COMETCHAT
    const cometChatData = await cometChatService.initiateDoctorChat(
      dto.patientId,
      dto.patientName,
      dto.doctorId,
      dto.doctorName
    );

    // 4. Update MongoDB record with Zego & CometChat metadata
    await ConsultationModel.updateOne(
      { roomId },
      {
        doctorAvatar: dto.doctorAvatar,
        patientAvatar: dto.patientAvatar,
        zegoRoomId: roomId,
        cometChatConversationId: `${dto.patientId}_${dto.doctorId}`,
        metadata: {
          scheduledAt: dto.scheduledAt,
          zegoAppId: zegoCreds.appId,
          cometChatRegion: cometChatData.userCredentials.region,
        },
      }
    );

    // 5. Create initial audit log in MongoDB
    await CallLogModel.create({
      roomId,
      bookingId: dto.bookingId,
      doctorId: dto.doctorId,
      patientId: dto.patientId,
      eventType: 'initiated',
      details: {
        scheduledAt: dto.scheduledAt,
      },
    });

    // 6. Send welcoming initial consultation message via CometChat
    const initialGreeting = `Hello ${dto.patientName}! Your consultation chat with Dr. ${dto.doctorName} is active for Appointment #${dto.bookingId}. You can communicate and share health records here.`;
    await cometChatService.sendTextMessage(dto.doctorId, dto.patientId, initialGreeting);

    return {
      consultationId: roomId,
      bookingId: dto.bookingId,
      status: 'scheduled',
      videoCall: {
        provider: 'zegocloud',
        appId: zegoCreds.appId,
        appSign: zegoCreds.appSign,
        roomId,
        patientToken: patientZegoToken,
        doctorToken: doctorZegoToken,
        expiresInSeconds: zegoCreds.expiresInSeconds,
      },
      chat: {
        provider: 'cometchat',
        appId: cometChatData.userCredentials.appId,
        authKey: cometChatData.userCredentials.authKey,
        region: cometChatData.userCredentials.region,
        patientAuthToken: cometChatData.userCredentials.userAuthToken,
        doctorAuthToken: cometChatData.doctorCredentials.userAuthToken,
        patientUid: dto.patientId,
        doctorUid: dto.doctorId,
      },
      createdAt: new Date(),
    };
  }

  /**
   * Fetch all consultations for a given user (doctor or patient)
   */
  public async getUserConsultations(userId: string, role?: 'doctor' | 'patient'): Promise<IConsultation[]> {
    const query: Record<string, any> = {};

    if (role === 'doctor') {
      query.doctorId = userId;
    } else if (role === 'patient') {
      query.patientId = userId;
    } else {
      query.$or = [{ doctorId: userId }, { patientId: userId }];
    }

    return await ConsultationModel.find(query).sort({ createdAt: -1 }).lean();
  }

  /**
   * Cancel an appointment consultation before or during call
   */
  public async cancelConsultation(roomId: string, userId: string, reason?: string): Promise<IConsultation> {
    const consultation = await ConsultationModel.findOne({ roomId });
    if (!consultation) {
      throw ApiError.notFound(`Consultation room ${roomId} not found`);
    }

    const isAuthorized = consultation.doctorId === userId || consultation.patientId === userId;
    if (!isAuthorized) {
      throw ApiError.forbidden('You are not authorized to cancel this consultation');
    }

    consultation.status = 'ended';
    consultation.endedAt = new Date();
    consultation.metadata = {
      ...(consultation.metadata || {}),
      cancelledBy: userId,
      cancellationReason: reason || 'Cancelled by user',
    };
    await consultation.save();

    await CallLogModel.create({
      roomId,
      bookingId: consultation.bookingId,
      doctorId: consultation.doctorId,
      patientId: consultation.patientId,
      eventType: 'ended',
      byUserId: userId,
      details: { reason: reason || 'Cancelled' },
      timestamp: new Date(),
    });

    return consultation;
  }

  /**
   * Refreshes / re-issues ZEGOCLOUD and COMETCHAT tokens for an ongoing session
   */
  public async refreshTokens(roomId: string, userId: string): Promise<any> {
    const consultation = await ConsultationModel.findOne({ roomId });
    if (!consultation) {
      throw ApiError.notFound(`Consultation room ${roomId} not found`);
    }

    const isAuthorized = consultation.doctorId === userId || consultation.patientId === userId;
    if (!isAuthorized) {
      throw ApiError.forbidden('You are not authorized for this consultation room');
    }

    const zegoToken = zegoService.generateRoomToken(userId, roomId);
    const cometAuthToken = await cometChatService.createAuthToken(userId);

    return {
      roomId,
      userId,
      zegoToken,
      cometAuthToken,
      expiresInSeconds: 7200,
    };
  }

  /**
   * Retrieve audit logs for a consultation room
   */
  public async getConsultationLogs(roomId: string): Promise<any[]> {
    return await CallLogModel.find({ roomId }).sort({ timestamp: 1 }).lean();
  }

  /**
   * Allows any user to open / initiate a direct chat with any doctor via CometChat
   */
  public async initiateAnyUserDoctorChat(
    userUid: string,
    userName: string,
    doctorUid: string,
    doctorName: string
  ) {
    logger.info(`Initiating direct chat: User ${userUid} -> Doctor ${doctorUid}`);
    return await cometChatService.initiateDoctorChat(
      userUid,
      userName,
      doctorUid,
      doctorName
    );
  }
}

export const consultationService = new ConsultationService();
