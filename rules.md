# 📜 Engineering Rules, Security & Coding Standards
### Doctor Video Call & Consultation Chat Sub-Backend

This document sets the mandatory engineering standards, healthcare data security guidelines, architectural conventions, and code review rules for the **Doctor-VideoCall&Chat-Backend** microservice.

---

## 1. 🛡️ Healthcare Security & Privacy (HIPAA / Telemedicine Standards)

1. **Zero Media Data Persistence**:
   - Audio and video streams must remain strictly peer-to-peer (P2P via WebRTC or relayed through ZEGOCLOUD encrypted media servers).
   - Under no circumstances should audio/video payloads be recorded, buffered, or stored on local disk or database without explicit patient-doctor consent and HIPAA-compliant S3 storage encryption.
2. **Protection of Sensitive Health Data (PHI)**:
   - Never log patient medical records, symptoms, diagnoses, or attachments in plain text log files.
   - Winston logger must scrub or omit Authorization tokens, passwords, and medical notes in all log levels (`info`, `debug`, `error`).
3. **Restricted Room Access**:
   - Consultation video rooms are restricted strictly to authorized participants: the booked Doctor (`doctorId`) and Patient (`patientId`).
   - Every room join request must validate participant identity against the consultation booking metadata via `validateAccess()` before granting access.
4. **Token Generation Exclusivity**:
   - `ZEGO_APP_SIGN`, `ZEGO_CALLBACK_SECRET`, `COMETCHAT_REST_API_KEY`, and `JWT_SECRET` must **NEVER** be shared with, imported by, or transmitted to frontend client apps.
   - Tokens must always be generated on the backend with finite time-to-live (`expiresInSeconds = 7200` max).

---

## 2. 🏗️ Architectural & Layer Separation Rules

The codebase strictly follows a **layered clean architecture**. Cross-layer leaks are prohibited:

```
[ HTTP Requests / WebSockets ]
             │
             ▼
      [ Middleware ]         (Auth, Rate Limit, Zod Validation, CORS, Error Handling)
             │
             ▼
     [ Controllers ]        (Parse request, extract params, delegate to service, format response)
             │
             ▼
      [ Services ]          (Pure business logic, third-party SDK calls, session lifecycle)
             │
             ▼
   [ Data / Store / SDK ]   (Room store, ZEGOCLOUD Token04 engine, COMETCHAT REST API)
```

1. **Controllers Must Be Thin**:
   - Controllers must never perform direct cryptographic hashing, external HTTP calls, or business calculations.
   - Controllers only validate input, call the service layer, and return a standardized `ApiResponse`.
2. **Services Must Be Agnostic**:
   - Services must not take Express `req` or `res` objects. They take pure typed parameters (DTOs) and return typed objects or throw `ApiError`.
3. **Standard Response Formatting**:
   - All successful API endpoints must return the `ApiResponse` shape:
     ```typescript
     {
       success: boolean;
       statusCode: number;
       message: string;
       data?: T;
       timestamp: string;
     }
     ```
4. **Centralized Error Handling**:
   - Never use manual `res.status(500).json(...)` inside controllers. Throw an `ApiError` instance (`ApiError.badRequest`, `ApiError.unauthorized`, `ApiError.notFound`, etc.) or pass to Express `next(error)`.
   - All asynchronous controller handlers must be wrapped with `asyncHandler(...)`.

---

## 3. 💻 TypeScript & Code Quality Rules

1. **Strict Type Safety**:
   - `tsconfig.json` runs in strict mode (`strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `strictNullChecks: true`).
   - The use of `any` is strictly discouraged. Prefer explicit interfaces, generics, or `unknown` with runtime type guards.
2. **ES Module / NodeNext Imports**:
   - In accordance with `"moduleResolution": "NodeNext"`, all internal relative imports must end with `.js` extension (e.g., `import { env } from '../config/env.js';`).
3. **Environment Variables**:
   - Never access `process.env.VARIABLE_NAME` directly within controller or service files.
   - Always import the Zod-validated `env` object from `src/config/env.js`. If an environment variable is missing, the application fails fast at startup.
4. **Input Validation**:
   - Every POST, PUT, and PATCH endpoint must define a strict Zod schema in `src/validations/`.
   - The `validateRequest(schema)` middleware must validate `req.body`, `req.query`, and `req.params` before reaching the controller.

---

## 4. 📹 ZEGOCLOUD & COMETCHAT Integration Rules

1. **ZEGOCLOUD Token04 Cryptography**:
   - ZEGOCLOUD video call tokens must follow the official **Token04** specification:
     - Symmetric encryption: AES-256-CBC with PKCS5 padding.
     - Payload must enforce explicit room ID (`room_id`) and privileges (`loginRoom = 1`, `publishStream = 1`).
     - Initialization Vector (IV) must be cryptographically generated per-token (`crypto.randomBytes` / 16 chars).
2. **Webhook Verification**:
   - All incoming callbacks from ZEGOCLOUD at `/api/v1/webhooks/zegocloud` must be cryptographically verified using `ZEGO_CALLBACK_SECRET` before processing. Unverified webhooks must be rejected with HTTP 401.
3. **CometChat Idempotency**:
   - Before generating an auth token or initiating a chat, check if the user exists on CometChat. If missing (HTTP 404), create the user with the standard role (`default`).
   - Avoid creating duplicate users or spamming the CometChat REST API.
4. **Any-User-To-Any-Doctor Discovery**:
   - When initiating direct messaging between a user and a doctor (`/api/v1/consultations/direct-chat`), verify that both IDs are non-empty and generate short-lived credentials scoped to their conversation.

---

## 5. 🔌 Real-Time Sockets & WebRTC Signaling Rules

1. **Room State & Socket Lifecycle**:
   - Socket connections must authenticate during handshake via JWT or valid user payload.
   - Sockets joining a consultation room must immediately register their socket ID with `roomService.addParticipant()`.
   - When a socket disconnects, cleanup must remove the participant and broadcast `room:user-left` to the other peer.
2. **Signaling Relay Only**:
   - The Socket.IO server acts purely as a signaling relay for SDP offers, answers, and ICE candidates.
   - Never alter or inspect SDP media session descriptors inside socket handlers.
3. **Max Room Capacity**:
   - Telemedicine consultation rooms are strictly capped at 2 to 4 participants (1 Doctor, 1 Patient, plus optional Specialist/Guardian). Any subsequent join requests must receive `room:full`.

---

## 6. 🌐 Inter-Service Communication Rules

1. **Service API Key**:
   - Internal endpoints called exclusively by the main Full-Stack backend (e.g. administrative room cleanup, force termination) must enforce `requireServiceAuth` validating `x-service-api-key`.
2. **Call Conclusion Synchronization**:
   - When a consultation call terminates, the sub-backend must asynchronously dispatch an HTTP POST request to `${MAIN_BACKEND_URL}/api/consultations/call-ended` with `roomId`, `appointmentId`, and `durationSeconds`.
   - If the main backend is temporarily unreachable, the sub-backend logs the warning without crashing active client socket streams.

---

## 7. 🚀 Git & Deployment Rules

1. **Git Commit Conventions**:
   - Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `perf:`).
2. **Environment Files**:
   - `.env` and `.env.local` must NEVER be committed to version control. Always maintain `.env.example` with sanitized placeholder keys.
3. **Docker Execution**:
   - Containers must run as non-root user (`USER node` in Dockerfile).
   - Container builds must be multi-staged (builder -> runner) to keep production images lightweight (<150MB).

