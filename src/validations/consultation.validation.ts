import { z } from 'zod';

export const createConsultationSessionSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1, 'Booking ID is required'),
    doctorId: z.string().min(1, 'Doctor ID is required'),
    doctorName: z.string().min(1, 'Doctor Name is required'),
    doctorAvatar: z.string().url().optional(),
    patientId: z.string().min(1, 'Patient ID is required'),
    patientName: z.string().min(1, 'Patient Name is required'),
    patientAvatar: z.string().url().optional(),
    scheduledAt: z.string().optional(),
  }),
});

export const initiateDirectChatSchema = z.object({
  body: z.object({
    userUid: z.string().min(1, 'User UID is required'),
    userName: z.string().min(1, 'User Name is required'),
    doctorUid: z.string().min(1, 'Doctor UID is required'),
    doctorName: z.string().min(1, 'Doctor Name is required'),
  }),
});

export const getZegoTokenSchema = z.object({
  params: z.object({
    roomId: z.string().min(1, 'Room ID is required'),
  }),
  query: z.object({
    userId: z.string().min(1, 'User ID is required'),
    userName: z.string().optional(),
  }),
});
