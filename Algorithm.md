# 🧮 Algorithm Specifications & Cryptographic Implementations
### Doctor Video Call & Consultation Chat Sub-Backend

This document provides a deep technical analysis of the algorithms, cryptographic functions, and state machines implemented across the **Doctor-VideoCall&Chat-Backend**.

---

## 1. 🔐 ZEGOCLOUD Token04 Cryptographic Generation Algorithm

The sub-backend implements ZEGOCLOUD's official **Token v04** specification inside [`src/services/zegoServerAssistant.ts`](file:///e:/Doctor-VideoCall&Chat-Backend/src/services/zegoServerAssistant.ts) to authorize users for RTC video sessions without exposing credentials to client apps.

### A. Mathematical & Data Structure Specification
$$\text{Token04} = \text{"04"} + \text{Base64}\Big( \text{Expire}_{8\text{B}} \parallel \text{Len(IV)}_{2\text{B}} \parallel \text{IV}_{16\text{B}} \parallel \text{Len(Cipher)}_{2\text{B}} \parallel \text{Ciphertext} \Big)$$

### B. Step-by-Step Execution Sequence

1. **Parameter Validation & Normalization**:
   - Inputs: `appId: number`, `userId: string`, `secret: string` (32 bytes), `effectiveTimeInSeconds: number`, `payload?: string`.
   - If `secret` exceeds 32 characters, truncate to first 32 bytes (`secret.substring(0, 32)`).

2. **Metadata Payload Assembly**:
   Construct the unencrypted token metadata JSON:
   ```json
   {
     "app_id": 2065487693,
     "user_id": "doc_sarah_101",
     "nonce": -1482938192,
     "ctime": 1779123000,
     "expire": 1779130200,
     "payload": "{\"room_id\":\"room_bk_98765\",\"privilege\":{\"1\":1,\"2\":1}}"
   }
   ```
   - `nonce`: Generated pseudo-random 32-bit signed integer in range $[-2^{31}, 2^{31}-1]$ to protect against replay attacks:
     $$\text{nonce} = \text{randomInt}(-2147483648, 2147483647)$$
   - `ctime`: Current Unix timestamp in seconds: $\lfloor \frac{\text{Date.now()}}{1000} \rfloor$.
   - `expire`: Expiration timestamp: $\text{ctime} + \text{effectiveTimeInSeconds}$.

3. **Random IV Generation**:
   Generate a cryptographically secure 16-character pseudo-random string vector:
   $$\text{IV} \in \{0\dots9, a\dots z\}^{16}$$

4. **Symmetric Encryption (AES-256-CBC)**:
   - Cipher: `aes-256-cbc`
   - Key: 32-byte secret
   - IV: 16-character initialization vector
   - Padding: PKCS#5 / PKCS#7 (auto-padding enabled)
   $$\text{Ciphertext} = \text{AES-256-CBC}_{\text{Secret, IV}}(\text{JSONString}(\text{tokenInfo}))$$

5. **Binary Buffer Packing**:
   Serialize fields into a single binary buffer using Big-Endian (`false`) byte order:
   * **Field 1 (8 Bytes)**: Big-Endian `BigInt64` representing the `expire` timestamp.
   * **Field 2 (2 Bytes)**: Big-Endian `Uint16` representing length of the IV ($16$).
   * **Field 3 (16 Bytes)**: Raw ASCII characters of the IV.
   * **Field 4 (2 Bytes)**: Big-Endian `Uint16` representing byte length of the ciphertext.
   * **Field 5 (N Bytes)**: Encrypted ciphertext bytes.

6. **Base64 Encoding & Version Prefixing**:
   Encode the packed binary buffer into Base64 and prepend version identifier `'04'`:
   $$\text{FinalToken} = \text{"04"} + \text{Buffer.from(packedData).toString('base64')}$$

---

## 2. 🛡️ ZEGOCLOUD Webhook Signature Verification Algorithm

To ensure callbacks received at `/api/v1/webhooks/zegocloud` truly originate from ZEGOCLOUD and have not been forged or tampered with in transit.

### A. Algorithm Steps
1. Extract `nonce`, `timestamp`, and `signature` from the HTTP query parameters.
2. Form an array with the shared `callbackSecret`, `nonce`, and `timestamp`:
   $$A = [\text{callbackSecret}, \text{nonce}, \text{timestamp}]$$
3. Sort elements in lexicographical (alphabetical) order:
   $$A_{\text{sorted}} = \text{sort}(A)$$
4. Concatenate sorted elements into a single contiguous UTF-8 string:
   $$S = A_{\text{sorted}}[0] + A_{\text{sorted}}[1] + A_{\text{sorted}}[2]$$
5. Compute the SHA-256 hexadecimal hash:
   $$\text{CalculatedSig} = \text{SHA256}(S)$$
6. Compare `CalculatedSig.toLowerCase()` with `signature.toLowerCase()`:
   $$\text{IsValid} = (\text{CalculatedSig} == \text{signature})$$

---

## 3. 💬 COMETCHAT Idempotent User Sync & Auth Token Algorithm

Implemented in [`src/services/cometchat.service.ts`](file:///e:/Doctor-VideoCall&Chat-Backend/src/services/cometchat.service.ts) to guarantee zero failure when any user initiates a chat with any doctor.

```
       [ Input: UID, Name, Role ]
                   │
                   ▼
       [ GET /v3/users/:uid ]
                   │
        ┌──────────┴──────────┐
   Status = 200          Status = 404
        │                     │
        │           [ POST /v3/users ]
        │         (Provision with 'default')
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
     [ POST /v3/users/:uid/auth_tokens ]
           (with { force: true })
                   │
                   ▼
     [ Return userAuthToken to Client ]
```

### Steps:
1. **User Discovery**: Execute `GET https://${appId}.api-${region}.cometchat.io/v3/users/${uid}`.
2. **Conditional Provisioning**:
   - If HTTP 200: User is already provisioned.
   - If HTTP 404: User does not exist. Call `POST /v3/users` with `{ uid, name, role: 'default' }`.
3. **Authentication Token Minting**:
   - Invoke `POST /v3/users/${uid}/auth_tokens` with `{ force: true }`.
   - CometChat returns an active `authToken`.
4. **Client Handoff**: The client SDK calls `CometChat.login(authToken)` directly without ever handling administrative API keys.

---

## 4. ⚡ WebRTC Peer Connection State Machine (Socket.IO Signaling)

Implemented in [`src/sockets/signaling.handler.ts`](file:///e:/Doctor-VideoCall&Chat-Backend/src/sockets/signaling.handler.ts) for 1-to-1 WebRTC consultations.

### State Transitions:
$$\text{idle} \xrightarrow{\text{call:initiate}} \text{calling} \xrightarrow{\text{call:answer}} \text{ongoing} \xrightarrow{\text{call:end}} \text{ended}$$

```
                ┌──────────────────────────────────────────────┐
                │                                              │
                ▼                                              │
         ┌─────────────┐                                       │
         │    IDLE     │                                       │
         └──────┬──────┘                                       │
                │                                              │
         call:initiate (Doctor sends Offer SDP)                │
                │                                              │
                ▼                                              │
         ┌─────────────┐                                       │
         │   CALLING   │───call:reject (Patient Declines)──────┤
         └──────┬──────┘                                       │
                │                                              │
         call:answer (Patient sends Answer SDP)                │
                │                                              │
                ▼                                              │
         ┌─────────────┐                                       │
         │   ONGOING   │                                       │
         └──────┬──────┘                                       │
                │                                              │
          call:end (Hang Up / Disconnect)                      │
                │                                              │
                ▼                                              │
         ┌─────────────┐                                       │
         │    ENDED    │───────────────────────────────────────┘
         └─────────────┘
```

### Trickle ICE Protocol:
- ICE Candidates are discovered incrementally by the client's WebRTC engine.
- As each candidate is gathered, it is transmitted through `webrtc:ice-candidate` and relayed immediately to the remote peer:
  $$\text{Peer}_A \xrightarrow{\text{candidate}} \text{Sub-Backend} \xrightarrow{\text{broadcast}} \text{Peer}_B$$

---

## 5. ⏱️ Call Duration Tracking & Billing Sync Algorithm

Ensures accurate billing and EHR completion when a telemedicine call terminates.

### A. Mathematical Formula
$$\text{durationSeconds} = \begin{cases} 
\max\left(0, \left\lfloor \frac{t_{\text{ended}} - t_{\text{started}}}{1000} \right\rfloor \right) & \text{if } t_{\text{started}} \text{ is defined} \\
0 & \text{otherwise}
\end{cases}$$

### B. Synchronization Sequence
1. Upon `room_close` webhook from ZEGOCLOUD or `call:end` event from Socket.IO:
   - Set $t_{\text{ended}} = \text{new Date()}$.
   - Compute $\text{durationSeconds}$.
2. Build Payload:
   ```json
   {
     "roomId": "room_bk_98765",
     "appointmentId": "bk_98765",
     "doctorId": "doc_sarah_101",
     "patientId": "pat_john_202",
     "startedAt": "2026-11-05T01:00:00.000Z",
     "endedAt": "2026-11-05T01:25:30.000Z",
     "durationSeconds": 1530
   }
   ```
3. Issue HTTP POST to `${MAIN_BACKEND_URL}/api/consultations/call-ended` with `x-service-api-key`.
4. Wrap in `try/catch` with non-blocking logging so temporary network partitions do not throw unhandled promise rejections.

