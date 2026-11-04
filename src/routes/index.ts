import { Router } from 'express';
import healthRoutes from './health.routes.js';
import roomRoutes from './room.routes.js';
import chatRoutes from './chat.routes.js';
import webrtcRoutes from './webrtc.routes.js';
import consultationRoutes from './consultation.routes.js';
import webhookRoutes from './webhook.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/consultations', consultationRoutes);
router.use('/rooms', roomRoutes);
router.use('/chat', chatRoutes);
router.use('/webrtc', webrtcRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
