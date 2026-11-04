import { z } from 'zod';

export const createRoomSchema = z.object({
  body: z.object({
    roomId: z.string().optional(),
    appointmentId: z.string().optional(),
    doctorId: z.string().min(1, 'Doctor ID is required'),
    patientId: z.string().min(1, 'Patient ID is required'),
    doctorName: z.string().optional(),
    patientName: z.string().optional(),
  }),
});

export const getRoomParamsSchema = z.object({
  params: z.object({
    roomId: z.string().min(1, 'Room ID is required'),
  }),
});

export const validateAccessSchema = z.object({
  params: z.object({
    roomId: z.string().min(1, 'Room ID is required'),
  }),
  query: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
});

