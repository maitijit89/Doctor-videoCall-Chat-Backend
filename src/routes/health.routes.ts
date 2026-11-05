import { Router } from 'express';
import { getHealth, getMetrics } from '../controllers/health.controller.js';

const router = Router();

router.get('/', getHealth);
router.get('/metrics', getMetrics);

export default router;
