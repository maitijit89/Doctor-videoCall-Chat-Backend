import { Router } from 'express';
import { handleZegoWebhook, handleCometChatWebhook } from '../controllers/webhook.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/zegocloud', webhookLimiter, asyncHandler(handleZegoWebhook));
router.post('/cometchat', webhookLimiter, asyncHandler(handleCometChatWebhook));

export default router;
