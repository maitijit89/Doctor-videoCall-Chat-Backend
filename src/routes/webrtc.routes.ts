import { Router } from 'express';
import { getIceServers } from '../controllers/webrtc.controller.js';

const router = Router();

router.get('/ice-servers', getIceServers);

export default router;
