import { z } from 'zod';

export const getMessagesQuerySchema = z.object({
  params: z.object({
    roomId: z.string().min(1, 'Room ID is required'),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50)),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
  }),
});

