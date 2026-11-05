import { Router } from 'express';
import {
  createRoom,
  getRoom,
  getActiveRooms,
  validateAccess,
  endRoom,
} from '../controllers/room.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createRoomSchema,
  getRoomParamsSchema,
  validateAccessSchema,
} from '../validations/room.validation.js';
import { optionalAuthenticateJwt } from '../middleware/auth.middleware.js';
import { requireServiceOrUserAuth } from '../middleware/serviceAuth.middleware.js';

const router = Router();

// Create room - requires internal service API key or authenticated user
router.post(
  '/',
  requireServiceOrUserAuth,
  validateRequest(createRoomSchema),
  asyncHandler(createRoom)
);

// List active rooms
router.get('/', optionalAuthenticateJwt, asyncHandler(getActiveRooms));

// Validate access for a user to enter room
router.get(
  '/:roomId/validate',
  optionalAuthenticateJwt,
  validateRequest(validateAccessSchema),
  asyncHandler(validateAccess)
);

// Get specific room status & details
router.get(
  '/:roomId',
  optionalAuthenticateJwt,
  validateRequest(getRoomParamsSchema),
  asyncHandler(getRoom)
);

// End consultation call
router.post(
  '/:roomId/end',
  optionalAuthenticateJwt,
  validateRequest(getRoomParamsSchema),
  asyncHandler(endRoom)
);

export default router;

