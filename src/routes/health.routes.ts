import { Router } from 'express';
import { getHealth, getMetrics, getPing, getLiveness } from '../controllers/health.controller.js';

const router = Router();

router.get('/', getHealth);
router.get('/ping', getPing);
router.get('/alive', getPing);
router.get('/liveness', getLiveness);
router.get('/metrics', getMetrics);

export default router;
