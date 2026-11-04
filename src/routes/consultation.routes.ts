import { Router } from 'express';
import {
  createConsultationSession,
  initiateDirectChat,
  getVideoCallToken,
} from '../controllers/consultation.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createConsultationSessionSchema,
  initiateDirectChatSchema,
  getZegoTokenSchema,
} from '../validations/consultation.validation.js';

const router = Router();

// Post-Booking Session Creation (ZEGOCLOUD + COMETCHAT)
router.post(
  '/session',
  validateRequest(createConsultationSessionSchema),
  asyncHandler(createConsultationSession)
);

// Initiate direct 1-to-1 chat: Any User with Any Doctor (COMETCHAT)
router.post(
  '/direct-chat',
  validateRequest(initiateDirectChatSchema),
  asyncHandler(initiateDirectChat)
);

// Fetch / Refresh ZEGOCLOUD Video Call Token for a specific room & user
router.get(
  '/:roomId/video-token',
  validateRequest(getZegoTokenSchema),
  asyncHandler(getVideoCallToken)
);

export default router;
