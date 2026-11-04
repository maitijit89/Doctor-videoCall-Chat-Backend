# 📊 System Flowcharts & Visual Architecture
### Doctor Video Call & Consultation Chat Sub-Backend

This document provides visual flowcharts covering all primary system operations, state transitions, and real-time communication pathways.

---

## 1. 🔄 Overall Post-Booking Consultation Lifecycle

```mermaid
flowchart TD
    Start(["Patient Books Appointment on Main Backend"]) --> CreateSession["Main Backend sends POST /api/v1/consultations/session"]
    
    subgraph SubBackendSession["⚡ Sub-Backend Orchestration"]
        direction TB
        InitRoom["1. Initialize Consultation Room in Memory"]
        ZegoToken["2. Generate ZEGOCLOUD Token04 for Doctor & Patient"]
        CometChatSync["3. Provision Patient & Doctor on COMETCHAT"]
        CometChatAuth["4. Generate COMETCHAT Auth Tokens"]
        SendGreeting["5. Send Automated Consultation Welcome Message"]
        InitRoom --> ZegoToken --> CometChatSync --> CometChatAuth --> SendGreeting
    end

    CreateSession --> SubBackendSession
    SubBackendSession --> BundleResponse["Return Unified Credentials Bundle to Frontend"]
    
    BundleResponse --> ClientChoice{"User Action"}
    
    ClientChoice -->|"Video Consultation"| LaunchVideo["Initialize ZEGOCLOUD UIKit with Token04"]
    ClientChoice -->|"Text / Health Reports"| LaunchChat["Initialize COMETCHAT SDK with userAuthToken"]
    
    LaunchVideo --> VideoCallActive["1:1 Encrypted HD Video Consultation"]
    LaunchChat --> MessagingActive["Real-Time Consultation Chat Active"]
    
    VideoCallActive --> CallHangup["Call Hangup / Doctor Ends Call"]
    CallHangup --> ZegoWebhook["ZEGOCLOUD sends room_close Webhook Callback"]
    ZegoWebhook --> CalcDuration["Calculate Exact Duration in Seconds"]
    CalcDuration --> NotifyMain["POST ${MAIN_BACKEND_URL}/api/consultations/call-ended"]
    NotifyMain --> FinalizeBilling["Main Backend Updates EHR & Invoicing"]
    FinalizeBilling --> End(["Session Completed"])
```

---

## 2. 📹 ZEGOCLOUD Video Call Connection & Handshake

```mermaid
sequenceDiagram
    autonumber
    actor Patient as 🧑‍💼 Patient App
    actor Doctor as 👨‍⚕️ Doctor App
    participant SubBackend as ⚡ Sub-Backend (Port 5001)
    participant ZegoCloud as ☁️ ZEGOCLOUD Media Servers
    participant MainBackend as 🌐 Main Backend (Port 5000)

    Patient->>SubBackend: GET /api/v1/consultations/:roomId/video-token?userId=pat_123
    SubBackend-->>Patient: Returns Token04 + appId + appSign
    Doctor->>SubBackend: GET /api/v1/consultations/:roomId/video-token?userId=doc_456
    SubBackend-->>Doctor: Returns Token04 + appId + appSign

    par Patient Joins Room
        Patient->>ZegoCloud: ZegoUIKitPrebuilt.create(patientToken).joinRoom(roomId)
        ZegoCloud-->>Patient: Room Joined & Camera Stream Published
    and Doctor Joins Room
        Doctor->>ZegoCloud: ZegoUIKitPrebuilt.create(doctorToken).joinRoom(roomId)
        ZegoCloud-->>Doctor: Room Joined & Camera Stream Published
    end

    ZegoCloud->>Patient: Play Doctor's Remote Audio/Video Stream
    ZegoCloud->>Doctor: Play Patient's Remote Audio/Video Stream

    Note over Patient,Doctor: Real-Time Encrypted Peer Video Consultation

    Doctor->>ZegoCloud: Leave Room / Hang Up
    ZegoCloud->>Patient: Peer Left Room Notification
    
    ZegoCloud->>SubBackend: Webhook Callback (POST /api/v1/webhooks/zegocloud)
    Note over SubBackend: Verify SHA-256 Webhook Signature
    SubBackend->>SubBackend: Calculate Call Duration: startedAt -> endedAt
    SubBackend->>MainBackend: POST /api/consultations/call-ended (durationSeconds, roomId)
    MainBackend-->>SubBackend: 200 OK (Invoice & Consultation Completed)
```

---

## 3. 💬 COMETCHAT: "Any User Can Chat With Any Doctor"

```mermaid
flowchart TD
    User(["Any Registered User / Patient"]) --> RequestChat["POST /api/v1/consultations/direct-chat<br/>{ userUid, userName, doctorUid, doctorName }"]
    
    subgraph CometChatEngine["⚡ Sub-Backend CometChat Service"]
        direction TB
        CheckUser["GET /v3/users/:userUid"]
        UserExists{"User Exists?"}
        CreateUser["POST /v3/users (Create User)"]
        
        CheckDoc["GET /v3/users/:doctorUid"]
        DocExists{"Doctor Exists?"}
        CreateDoc["POST /v3/users (Create Doctor)"]
        
        GenUserToken["POST /v3/users/:userUid/auth_tokens"]
        GenDocToken["POST /v3/users/:doctorUid/auth_tokens"]
        
        CheckUser --> UserExists
        UserExists -->|No| CreateUser
        UserExists -->|Yes| CheckDoc
        CreateUser --> CheckDoc
        
        CheckDoc --> DocExists
        DocExists -->|No| CreateDoc
        DocExists -->|Yes| GenUserToken
        CreateDoc --> GenUserToken
        
        GenUserToken --> GenDocToken
    end

    RequestChat --> CometChatEngine
    CometChatEngine --> ReturnTokens["Return Credentials Bundle:<br/>{ appId, region, userAuthToken, receiverUid: doctorUid }"]
    
    ReturnTokens --> ClientCometChat["Client App calls CometChat.login(userAuthToken)"]
    ClientCometChat --> DirectChatReady["Direct 1-to-1 Chat Window Opens Instantly"]
    DirectChatReady --> SendMsg["Send Text Messages & Health Document Attachments"]
```

---

## 4. ⚡ Native WebRTC Signaling Fallback (Socket.IO)

Used as an in-house real-time signaling fallback when custom WebRTC peer connections are utilized:

```mermaid
sequenceDiagram
    autonumber
    actor Caller as 👨‍⚕️ Doctor
    participant SocketServer as ⚡ Sub-Backend (Socket.IO)
    actor Callee as 🧑‍💼 Patient

    Caller->>SocketServer: emit('room:join', { roomId })
    SocketServer-->>Caller: emit('room:join', { participants, status })

    Callee->>SocketServer: emit('room:join', { roomId })
    SocketServer-->>Callee: emit('room:join', { participants, status })
    SocketServer->>Caller: emit('room:user-joined', { participant: Callee })

    Note over Caller,Callee: 1:1 Video Call Negotiation

    Caller->>SocketServer: emit('call:initiate', { roomId, sdp: offerSDP })
    SocketServer->>Callee: emit('call:incoming', { fromUser: Doctor, sdp: offerSDP })

    Callee->>SocketServer: emit('call:answer', { roomId, sdp: answerSDP })
    SocketServer->>Caller: emit('call:accepted', { fromUser: Patient, sdp: answerSDP })

    par Trickle ICE Candidate Exchange
        Caller->>SocketServer: emit('webrtc:ice-candidate', { candidate })
        SocketServer->>Callee: emit('webrtc:ice-candidate', { candidate })
    and
        Callee->>SocketServer: emit('webrtc:ice-candidate', { candidate })
        SocketServer->>Caller: emit('webrtc:ice-candidate', { candidate })
    end

    Note over Caller,Callee: P2P Encrypted Audio/Video Stream Established

    Caller->>SocketServer: emit('call:end', { roomId })
    SocketServer->>Callee: emit('call:ended', { durationSeconds })
```

---

## 5. 🛡️ ZEGOCLOUD Webhook & Billing Verification Flow

```mermaid
flowchart TD
    ZegoServer["☁️ ZEGOCLOUD Cloud Platform"] --> CallbackTrigger["Event Occurs (room_close / stream_delete)"]
    CallbackTrigger --> SendWebhook["POST /api/v1/webhooks/zegocloud?nonce=...&timestamp=...&signature=..."]
    
    subgraph WebhookProcessing["Sub-Backend Webhook Controller"]
        direction TB
        ExtractParams["Extract Nonce, Timestamp, Signature, Body"]
        SortArray["Sort: [secret, nonce, timestamp]"]
        ComputeHash["Calculate sha256(secret + nonce + timestamp)"]
        VerifyMatch{"Signatures Match?"}
        
        ExtractParams --> SortArray --> ComputeHash --> VerifyMatch
        
        VerifyMatch -->|No| Reject["Return HTTP 401 Unauthorized"]
        VerifyMatch -->|Yes| ParseEvent["Inspect Event Type in Payload"]
        
        ParseEvent --> IsRoomClose{"event == 'room_close'?"}
        IsRoomClose -->|Yes| EndSession["roomService.endCall(roomId)"]
        IsRoomClose -->|No| Acknowledge["Log Event & Return HTTP 200"]
        
        EndSession --> CalcTime["durationSeconds = endedAt - startedAt"]
        CalcTime --> NotifyCore["mainBackendSyncService.notifyCallEnded(room)"]
    end

    SendWebhook --> WebhookProcessing
    NotifyCore --> CoreBackend["🌐 Main Full-Stack Backend receives webhook"]
    CoreBackend --> BillingRecorded["Doctor Earnings & Patient Invoice Generated"]
```
