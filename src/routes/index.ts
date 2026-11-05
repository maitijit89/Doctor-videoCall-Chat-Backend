import { Router } from 'express';
import healthRoutes from './health.routes.js';
import roomRoutes from './room.routes.js';
import chatRoutes from './chat.routes.js';
import webrtcRoutes from './webrtc.routes.js';
import consultationRoutes from './consultation.routes.js';
import webhookRoutes from './webhook.routes.js';
import doctorRoutes from './doctor.routes.js';
import { getPing, getLiveness } from '../controllers/health.controller.js';

const router = Router();

// Fast alive / ping routes
router.get('/ping', getPing);
router.get('/alive', getPing);
router.get('/healthz', getLiveness);

router.use('/health', healthRoutes);
router.use('/consultations', consultationRoutes);
router.use('/rooms', roomRoutes);
router.use('/chat', chatRoutes);
router.use('/webrtc', webrtcRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/doctors', doctorRoutes);

export default router;
