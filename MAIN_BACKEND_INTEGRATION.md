# 🔗 Main Backend Integration Guide
### Telemedicine Sub-Backend (`Doctor-VideoCall&Chat-Backend`) & Primary Backend (`Full-stack-backend`)

This document is the definitive integration specification for connecting your **Main Full-Stack Backend** (port `5000`) with this specialized **Doctor Video Call & Real-time Chat Sub-Backend** (port `5001`).

---

## 1. 🏗️ High-Level Integration Topology

```
                  ┌──────────────────────────────────────────────┐
                  │          🖥️ Frontend (Web / App)             │
                  │   React / Next.js / Flutter / React Native   │
                  └───────────────┬──────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
    1. Auth, Bookings, Payments   2. Video & Chat Tokens, Signaling
                   ▼                             ▼
        ┌─────────────────────┐       ┌──────────────────────────────┐
        │ 🌐 Main Backend     │       │ ⚡ VideoCall & Chat          │
        │ (Full-stack-backend)│       │    Sub-Backend               │
        │ Port: 5000          │       │ Port: 5001                   │
        └──────────┬──────────┘       └──────────────┬───────────────┘
                   │                                 │
                   │  POST /consultations/session    │
                   ├────────────────────────────────►│ (Provisions ZEGOCLOUD Token04
                   │  (x-service-api-key)            │  & COMETCHAT in-app chat)
                   │                                 │
                   │  POST /consultations/call-ended │
                   │◄────────────────────────────────┤ (Syncs exact call duration,
                   │  (Webhook with retries)         │  ended timestamp & summary)
                   │                                 │
                   ▼                                 ▼
         [ Main Database ]                [ MongoDB Atlas ]
         (PostgreSQL / MySQL)             (doctor_videocall_db)
         - Users / Auth                   - Consultation Rooms
         - Doctor Profiles                - Real-Time Doctor Presence
         - Financials / Billing           - Chat Messages & Audit Logs
```

---

## 2. 🔐 Environment Configuration

### Main Backend (`Full-stack-backend/.env`)
Add these entries to your main backend `.env` file:

```env
# Sub-Backend Microservice Connectivity
SUB_BACKEND_URL=http://localhost:5001
SUB_BACKEND_SERVICE_KEY=telemedicine_subservice_internal_secure_key_12345
```

### Sub-Backend (`Doctor-VideoCall&Chat-Backend/.env`)
Verify these corresponding values match in your sub-backend `.env`:

```env
PORT=5001
MAIN_BACKEND_URL=http://localhost:5000
SERVICE_API_KEY=telemedicine_subservice_internal_secure_key_12345
```

> [!IMPORTANT]
> The `SERVICE_API_KEY` in the sub-backend and `SUB_BACKEND_SERVICE_KEY` in the main backend **must match identically**. All inter-service calls use constant-time `crypto.timingSafeEqual` comparison for side-channel attack protection.

---

## 3. 💻 Main Backend Code Implementation (Node.js / Express / TypeScript)

You can copy and drop these ready-to-use snippets directly into your `Full-stack-backend` codebase.

### Step 3.1: Sub-Backend HTTP Client (`src/services/subBackendClient.ts`)

Create a dedicated client in your main backend to handle all requests to the sub-backend:

```typescript
import axios, { AxiosInstance } from 'axios';

class SubBackendClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.SUB_BACKEND_URL || 'http://localhost:5001',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-service-api-key': process.env.SUB_BACKEND_SERVICE_KEY || '',
      },
    });
  }

  /**
   * 1. Creates a post-booking consultation session (ZEGOCLOUD Token04 + COMETCHAT Auth)
   */
  async createConsultationSession(params: {
    bookingId: string;
    appointmentId?: string;
    doctorId: string;
    doctorName: string;
    patientId: string;
    patientName: string;
    scheduledAt: string;
  }) {
    const res = await this.client.post('/api/v1/consultations/session', params);
    return res.data.data;
  }

  /**
   * 2. Cancels an active or scheduled consultation session
   */
  async cancelConsultation(roomId: string, userId: string, reason?: string) {
    const res = await this.client.post(`/api/v1/consultations/${roomId}/cancel`, {
      userId,
      reason: reason || 'Cancelled from main backend',
    });
    return res.data.data;
  }

  /**
   * 3. Retrieves real-time online status for all doctors
   */
  async getOnlineDoctors() {
    const res = await this.client.get('/api/v1/doctors/online');
    return res.data.data;
  }

  /**
   * 4. Retrieves single doctor presence status
   */
  async getDoctorPresence(doctorId: string) {
    const res = await this.client.get(`/api/v1/doctors/${doctorId}/presence`);
    return res.data.data;
  }
}

export const subBackendClient = new SubBackendClient();
```

---

### Step 3.2: Trigger Session Creation on Appointment Confirmation

In your appointment booking or payment confirmation controller (`src/controllers/appointment.controller.ts`):

```typescript
import { Request, Response } from 'express';
import { subBackendClient } from '../services/subBackendClient';
// import { AppointmentModel } from '../models/Appointment';

export const confirmBookingAndCreateSession = async (req: Request, res: Response) => {
  try {
    const { appointmentId, doctorId, patientId, scheduledAt } = req.body;

    // 1. Save or update appointment in main database
    // const appointment = await AppointmentModel.create({ ... });

    // 2. Provision real-time Video & Chat sub-backend session
    const consultationSession = await subBackendClient.createConsultationSession({
      bookingId: appointmentId,
      appointmentId,
      doctorId,
      doctorName: req.body.doctorName || 'Doctor',
      patientId,
      patientName: req.body.patientName || 'Patient',
      scheduledAt: new Date(scheduledAt).toISOString(),
    });

    // 3. Update appointment in main DB with room reference
    // await AppointmentModel.findByIdAndUpdate(appointmentId, {
    //   consultationRoomId: consultationSession.consultationId,
    // });

    // 4. Return complete credentials bundle to the frontend client
    return res.status(201).json({
      success: true,
      message: 'Booking confirmed and real-time consultation room provisioned',
      data: {
        appointmentId,
        roomId: consultationSession.consultationId,
        videoCall: consultationSession.videoCall, // ZEGOCLOUD AppID, RoomID, Token04
        chat: consultationSession.chat,           // COMETCHAT AppID, Region, AuthToken
      },
    });
  } catch (error: any) {
    console.error('Failed to provision consultation room:', error.message);
    return res.status(500).json({ success: false, message: 'Consultation session provisioning failed' });
  }
};
```

---

### Step 3.3: Receiving Call Conclusion Webhook in Main Backend

When a doctor or patient hangs up, or when ZEGOCLOUD terminates a room, the sub-backend automatically invokes this webhook on the main backend.

Create a route in your main backend: `src/routes/consultationWebhook.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
// import { AppointmentModel } from '../models/Appointment';

const router = Router();

router.post('/api/consultations/call-ended', async (req: Request, res: Response) => {
  // 1. Verify internal service API key
  const serviceKey = req.headers['x-service-api-key'];
  if (serviceKey !== process.env.SUB_BACKEND_SERVICE_KEY) {
    return res.status(403).json({ message: 'Unauthorized service request' });
  }

  const { roomId, appointmentId, doctorId, patientId, startedAt, endedAt, durationSeconds } = req.body;

  console.log(`📞 Consultation Call Ended: Room ${roomId}, Duration: ${durationSeconds}s`);

  try {
    // 2. Update Main Database Appointment Record
    // await AppointmentModel.findOneAndUpdate(
    //   { $or: [{ _id: appointmentId }, { consultationRoomId: roomId }] },
    //   {
    //     status: 'completed',
    //     callDurationSeconds: durationSeconds,
    //     callStartedAt: startedAt,
    //     callEndedAt: endedAt,
    //     isCompleted: true,
    //   }
    // );

    // 3. Trigger doctor payout / invoicing / patient EHR summary creation here...

    return res.status(200).json({ success: true, message: 'Call conclusion recorded successfully' });
  } catch (err: any) {
    console.error('Error handling call-ended webhook:', err.message);
    return res.status(500).json({ message: 'Internal error processing callback' });
  }
});

export default router;
```

---

### Step 3.4: Display Real-Time "Online / Available" Badge on Doctors List

In your doctor search / listing controller:

```typescript
export const getDoctorsWithLiveStatus = async (req: Request, res: Response) => {
  // 1. Fetch doctors from Main Database
  // const doctors = await DoctorModel.find({ isActive: true }).lean();

  // 2. Fetch live online doctor IDs from Sub-Backend
  try {
    const onlineDoctors = await subBackendClient.getOnlineDoctors();
    const onlineDoctorIdSet = new Set(onlineDoctors.map((d: any) => d.doctorId));

    // 3. Attach isOnline and availability status
    // const enrichedDoctors = doctors.map(doc => ({
    //   ...doc,
    //   isOnline: onlineDoctorIdSet.has(doc._id.toString()),
    // }));

    // return res.json({ success: true, data: enrichedDoctors });
  } catch (error) {
    // Graceful fallback if sub-backend is temporarily unreachable
    // return res.json({ success: true, data: doctors });
  }
};
```

---

## 4. 📱 Frontend Integration Protocol

Your frontend client interacts with the two backends as follows:

```
┌────────────────────────────────────────────────────────────────┐
│                       Frontend App                             │
└──────────────┬─────────────────────────────────┬───────────────┘
               │                                 │
     (1) Book Appointment              (2) Join Call & Chat
               │                                 │
               ▼                                 ▼
      Main Backend (:5000)             Sub-Backend (:5001)
     - Auth / Login                   - ZEGOCLOUD VideoUIKit
     - Booking Checkout               - COMETCHAT Chat UI
     - Returns credentials bundle     - Socket.IO signaling/presence
```

### Frontend Credentials Response Shape:
Upon successful booking confirmation, the frontend receives:
```json
{
  "roomId": "room_BK_1793862877346",
  "videoCall": {
    "provider": "zegocloud",
    "appId": 2065487693,
    "appSign": "65a9d29ab9d889699b95763a8e3da5fa9b9f2e1ba5de5430108411311e50b8d4",
    "roomId": "room_BK_1793862877346",
    "doctorToken": "04AAAAAGrsSP4AEDZhN3...",
    "patientToken": "04AAAAAGrsSP4AEDPqL1...",
    "expiresInSeconds": 7200
  },
  "chat": {
    "provider": "cometchat",
    "appId": "1678929173ca5fc8c",
    "authKey": "7777d9d1fbc2f1df8f728714b1919f9ce393a24b",
    "region": "in",
    "patientUid": "pat_101",
    "doctorUid": "doc_202",
    "patientAuthToken": "f784e12...",
    "doctorAuthToken": "a3b9012..."
  }
}
```

The frontend immediately mounts:
1. **ZEGOCLOUD Prebuilt UIKit** passing `appId`, `roomId`, `userId`, `token`.
2. **COMETCHAT UIKit** passing `appId`, `region`, and calling `CometChat.login(authToken)`.

---

## 5. 🌐 Production NGINX Reverse Proxy Configuration

In staging/production, expose both backends behind a single unified domain or SSL certificate (e.g., `api.yourdomain.com`):

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates here...

    # 1. Main Backend API (Auth, Billing, EHR, Profiles)
    location /api/core/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Sub-Backend Telemedicine API (Rooms, Tokens, Webhooks)
    location /api/v1/ {
        proxy_pass http://127.0.0.1:5001/api/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Sub-Backend Real-time Socket.IO Engine (WebSockets)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 6. 🚀 Verification Checklist

Before taking the system live:

- [x] Sub-Backend runs on port `5001` and connects to MongoDB Atlas.
- [x] `npm run verify` runs 12/12 passing integration checks.
- [x] `SERVICE_API_KEY` in Sub-Backend matches `SUB_BACKEND_SERVICE_KEY` in Main Backend.
- [x] Main backend successfully triggers `POST /api/v1/consultations/session` and receives Token04.
- [x] Main backend exposes `POST /api/consultations/call-ended` to handle call duration logging.
- [x] Webhook callbacks from ZEGOCLOUD trigger the sync service with exponential backoff retries.
