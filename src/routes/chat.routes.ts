import { Router } from 'express';
import {
  getChatHistory,
  searchChatHistory,
  deleteChatMessage,
  createAttachmentUploadConfig,
} from '../controllers/chat.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getMessagesQuerySchema } from '../validations/chat.validation.js';
import { optionalAuthenticateJwt } from '../middleware/auth.middleware.js';

const router = Router();

// Retrieve paginated message history
router.get(
  '/:roomId/messages',
  optionalAuthenticateJwt,
  validateRequest(getMessagesQuerySchema),
  asyncHandler(getChatHistory)
);

// Search messages in consultation
router.get(
  '/:roomId/search',
  optionalAuthenticateJwt,
  asyncHandler(searchChatHistory)
);

// Delete or redact message
router.delete(
  '/:roomId/messages/:messageId',
  optionalAuthenticateJwt,
  asyncHandler(deleteChatMessage)
);

// Generate attachment upload metadata
router.post(
  '/:roomId/attachments/presign',
  optionalAuthenticateJwt,
  asyncHandler(createAttachmentUploadConfig)
);

export default router;
