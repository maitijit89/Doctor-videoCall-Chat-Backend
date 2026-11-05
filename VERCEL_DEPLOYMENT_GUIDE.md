# 🚀 Deploying to Vercel Guide
### Telemedicine Video Call & Chat Sub-Backend (`Doctor-VideoCall&Chat-Backend`)

This guide outlines how to deploy this backend to **Vercel** as a high-performance Serverless microservice.

---

## 1. ⚙️ Architectural Overview: How it Runs on Vercel

Vercel executes code using **Serverless Functions** (event-driven AWS Lambda execution). The project has been configured with an entrypoint handler (`api/index.ts`) and route rewrites (`vercel.json`).

### ✅ What works seamlessly on Vercel:
1. **ZEGOCLOUD Video Calling (100% Supported)**:
   - Audio and video streams flow directly between the user's browser/mobile app and ZEGOCLOUD's global media edge servers.
   - The backend is only responsible for generating **AES-256-CBC Token04** video call tokens, which is an instantaneous, completely stateless cryptographic calculation.
2. **COMETCHAT In-App Messaging (100% Supported)**:
   - Live text chat, file sharing, and message delivery are handled directly by CometChat's in-region cloud infrastructure (`in` region).
   - The backend only provisions user profiles and creates auth tokens using CometChat's REST API.
3. **All REST APIs & Webhooks (100% Supported)**:
   - Session creation (`POST /api/v1/consultations/session`)
   - Video token issuance (`GET /api/v1/consultations/:roomId/video-token`)
   - ZEGOCLOUD Call Webhooks (`POST /api/v1/webhooks/zegocloud`)
   - Alive Ping & Health checks (`GET /ping`, `GET /alive`, `GET /api/v1/health`)
4. **MongoDB Atlas Connection**:
   - Connection caching is automatically managed in `src/config/database.ts` so warm Lambda containers reuse existing connection pools without exceeding Atlas limits.

### ⚠️ Note Regarding Custom Socket.IO Signaling:
- Vercel Serverless Functions are stateless and terminate when an HTTP request finishes; they **do not support persistent stateful duplex WebSockets (`socket.io`)**.
- **When using ZEGOCLOUD + COMETCHAT, custom Socket.IO is NOT needed** because ZEGOCLOUD handles video calling and CometChat handles real-time messaging.
- *(If your architecture specifically requires long-lived custom Socket.IO WebSockets instead of ZEGOCLOUD/CometChat, deploy to persistent container hosts like **Render**, **Railway**, **Fly.io**, or **AWS ECS**).*

---

## 2. 📋 Required Environment Variables for Vercel

When importing your project into Vercel, copy and paste these into **Project Settings > Environment Variables**:

| Variable Name | Value | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `5001` | Server port |
| `MONGODB_URI` | `mongodb+srv://edochub99_db_user:xvoEpSpV4oSMpzE9@cluster0.yywnwbr.mongodb.net/doctor_videocall_db?retryWrites=true&w=majority` | Live MongoDB Atlas cluster |
| `CORS_ORIGIN` | `*` *(or your frontend URL e.g. `https://your-frontend.vercel.app`)* | Allowed CORS origins |
| `JWT_SECRET` | `doctor_videocall_subbackend_super_secret_jwt_key_2026` | Token authentication key |
| `MAIN_BACKEND_URL` | `https://your-main-backend.com` | URL of your primary backend |
| `SERVICE_API_KEY` | `telemedicine_subservice_internal_secure_key_12345` | Inter-service shared secret |
| `ZEGO_APP_ID` | `2065487693` | ZEGOCLOUD Application ID |
| `ZEGO_APP_SIGN` | `65a9d29ab9d889699b95763a8e3da5fa9b9f2e1ba5de5430108411311e50b8d4` | ZEGOCLOUD 64-char App Sign |
| `ZEGO_CALLBACK_SECRET` | `65a9d29ab9d889699b95763a8e3da5fa` | ZEGOCLOUD Webhook signature key |
| `COMETCHAT_APP_ID` | `1678929173ca5fc8c` | COMETCHAT Application ID |
| `COMETCHAT_AUTH_KEY` | `7777d9d1fbc2f1df8f728714b1919f9ce393a24b` | COMETCHAT Auth Key |
| `COMETCHAT_REST_API_KEY` | `9a53fbf903bd310aeb2faa9bb1cf8c5d08aecee4` | COMETCHAT Admin REST Key |
| `COMETCHAT_REGION` | `in` | COMETCHAT Data Region |

---

## 3. 🚀 Deployment Instructions

### Method A: Deploy via GitHub (Recommended)

1. Push your latest code to your GitHub repository:
   ```powershell
   git push origin main
   ```
2. Open the [Vercel Dashboard](https://vercel.com/dashboard).
3. Click **"Add New..."** -> **"Project"**.
4. Select your `Doctor-VideoCall&Chat-Backend` repository and click **"Import"**.
5. In **Build and Output Settings**:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Expand **Environment Variables** and paste the variables from the table in Section 2.
7. Click **"Deploy"**.

---

### Method B: Deploy via Vercel CLI

If you prefer deploying directly from your terminal:

1. Log in to your Vercel account:
   ```powershell
   vercel login
   ```
2. Link and deploy the project:
   ```powershell
   vercel
   ```
   - *Set up and deploy?* -> `Y`
   - *Which scope?* -> Select your personal or team account
   - *Link to existing project?* -> `N`
   - *Project name?* -> `doctor-videocall-chat-backend`
   - *Directory?* -> `./`
3. Add your production environment variables (or configure them in the web dashboard):
   ```powershell
   vercel env add MONGODB_URI production
   vercel env add JWT_SECRET production
   vercel env add SERVICE_API_KEY production
   vercel env add ZEGO_APP_ID production
   vercel env add ZEGO_APP_SIGN production
   vercel env add ZEGO_CALLBACK_SECRET production
   vercel env add COMETCHAT_APP_ID production
   vercel env add COMETCHAT_AUTH_KEY production
   vercel env add COMETCHAT_REST_API_KEY production
   vercel env add COMETCHAT_REGION production
   ```
4. Deploy to production:
   ```powershell
   vercel --prod
   ```

---

## 4. 🔍 Verifying Your Deployment

Once Vercel assigns your URL (e.g. `https://doctor-videocall-chat-backend.vercel.app`), verify the endpoints:

1. **Alive Ping**:
   ```powershell
   curl https://<your-project>.vercel.app/ping
   ```
   **Expected Response**:
   ```json
   {
     "status": "alive",
     "message": "pong",
     "service": "doctor-videocall-chat-service"
   }
   ```

2. **System Health Check**:
   ```powershell
   curl https://<your-project>.vercel.app/api/v1/health
   ```
   **Expected Response**:
   ```json
   {
     "success": true,
     "statusCode": 200,
     "message": "Service health verified",
     "data": {
       "status": "healthy",
       "database": { "status": "connected" }
     }
   }
   ```

3. **Update Main Backend**:
   Update `SUB_BACKEND_URL` in your Main Backend (`Full-stack-backend/.env`):
   ```env
   SUB_BACKEND_URL=https://<your-project>.vercel.app
   ```

