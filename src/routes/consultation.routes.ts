import { Router } from "express";
import {
  createConsultationSession,
  initiateDirectChat,
  getVideoCallToken,
  getUserConsultations,
  cancelConsultation,
  refreshTokens,
  getConsultationLogs,
} from "../controllers/consultation.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import {
  createConsultationSessionSchema,
  initiateDirectChatSchema,
  getZegoTokenSchema,
} from "../validations/consultation.validation.js";
import { optionalAuthenticateJwt } from "../middleware/auth.middleware.js";
import { requireServiceOrUserAuth } from "../middleware/serviceAuth.middleware.js";

const router = Router();

// Post-Booking Session Creation (ZEGOCLOUD + COMETCHAT) - Rate Limited, Service or User Auth Required
router.post(
  "/session",
  strictLimiter,
  requireServiceOrUserAuth,
  validateRequest(createConsultationSessionSchema),
  asyncHandler(createConsultationSession),
);

// Initiate direct 1-to-1 chat: Any User with Any Doctor (COMETCHAT) - Rate Limited
router.post(
  "/direct-chat",
  strictLimiter,
  optionalAuthenticateJwt,
  validateRequest(initiateDirectChatSchema),
  asyncHandler(initiateDirectChat),
);

// Fetch / Refresh ZEGOCLOUD Video Call Token for a specific room & user
router.get(
  "/:roomId/video-token",
  strictLimiter,
  optionalAuthenticateJwt,
  validateRequest(getZegoTokenSchema),
  asyncHandler(getVideoCallToken),
);

// Fetch all consultations for a user
router.get("/user/:userId", optionalAuthenticateJwt, asyncHandler(getUserConsultations));

// Cancel a consultation
router.post("/:roomId/cancel", optionalAuthenticateJwt, asyncHandler(cancelConsultation));

// Refresh expired tokens for extended call
router.post(
  "/:roomId/refresh-tokens",
  strictLimiter,
  optionalAuthenticateJwt,
  asyncHandler(refreshTokens),
);

// Get audit logs for a consultation room
router.get("/:roomId/logs", optionalAuthenticateJwt, asyncHandler(getConsultationLogs));

export default router;
