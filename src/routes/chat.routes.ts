import { Router } from 'express';
import { getChatHistory } from '../controllers/chat.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getMessagesQuerySchema } from '../validations/chat.validation.js';
import { optionalAuthenticateJwt } from '../middleware/auth.middleware.js';

const router = Router();

router.get(
  '/:roomId/messages',
  optionalAuthenticateJwt,
  validateRequest(getMessagesQuerySchema),
  asyncHandler(getChatHistory)
);

export default router;

