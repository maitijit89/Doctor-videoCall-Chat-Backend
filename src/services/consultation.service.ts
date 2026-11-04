import { roomService } from './room.service.js';
import { zegoService } from './zego.service.js';
import { cometChatService } from './cometchat.service.js';
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
   * Initializes full Video Call (ZEGOCLOUD) & Chat (COMETCHAT) session after a doctor is booked
   */
  public async createConsultationSession(
    dto: CreateConsultationSessionDTO
  ): Promise<ConsultationSessionResponse> {
    const roomId = `room_${dto.bookingId}`;
    logger.info(`Creating post-booking consultation session for booking ${dto.bookingId}`);

    // 1. Initialize room in RoomService
    roomService.createRoom({
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

    // 4. Send welcoming initial consultation message via CometChat
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
