import { Router } from 'express';
import { getDoctorPresence, getOnlineDoctors, postHeartbeat } from '../controllers/doctor.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuthenticateJwt } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/online', asyncHandler(getOnlineDoctors));
router.get('/:doctorId/presence', asyncHandler(getDoctorPresence));
router.post('/:doctorId/heartbeat', optionalAuthenticateJwt, asyncHandler(postHeartbeat));

export default router;

