import { Router } from 'express';
import { handleZegoWebhook, handleCometChatWebhook } from '../controllers/webhook.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/zegocloud', asyncHandler(handleZegoWebhook));
router.post('/cometchat', asyncHandler(handleCometChatWebhook));

export default router;

