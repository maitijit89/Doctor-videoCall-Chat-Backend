import http from 'http';
import { createHash } from 'crypto';

const BASE_URL = 'http://localhost:5001';
const SERVICE_KEY = 'telemedicine_subservice_internal_secure_key_12345';
const ZEGO_CALLBACK_SECRET = '65a9d29ab9d889699b95763a8e3da5fa';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function request(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const reqHeaders: Record<string, string> = {
      ...headers,
    };
    if (bodyStr) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode || 500, data: parsed });
        });
      }
    );

    req.on('error', (err) => reject(err));

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

function record(name: string, passed: boolean, details?: string, error?: string) {
  results.push({ name, passed, details, error });
  const symbol = passed ? '✅' : '❌';
  console.log(`${symbol} [${passed ? 'PASS' : 'FAIL'}] ${name}`);
  if (details) console.log(`   └─ Details: ${details}`);
  if (error) console.log(`   └─ Error: ${error}`);
}

async function runAllChecks() {
  console.log('\n🚀 Starting Full Backend Verification Suite on http://localhost:5001 ...\n');

  let testRoomId = '';
  const testDoctorId = 'doc_e2e_' + Date.now();
  const testPatientId = 'patient_e2e_' + Date.now();

  // Test 0: Fast Alive Ping Endpoints (/ping & /alive)
  try {
    const pingRes = await request('GET', '/ping');
    const aliveRes = await request('GET', '/alive');
    const isAlive = pingRes.status === 200 && pingRes.data?.status === 'alive' && aliveRes.status === 200;
    record('Alive Ping & Liveness Probe (/ping & /alive)', isAlive, `Status: ${pingRes.data?.status}, Message: ${pingRes.data?.message}, Uptime: ${pingRes.data?.uptimeSeconds}s`);
  } catch (err: any) {
    record('Alive Ping & Liveness Probe (/ping & /alive)', false, undefined, err.message);
  }

  // Test 1: Health Check Endpoint
  try {
    const res = await request('GET', '/api/v1/health');
    if (res.status === 200 && res.data?.data?.status === 'healthy') {
      record('Health Check Endpoint (REST)', true, `Database: ${res.data?.data?.database}, Uptime: ${res.data?.data?.uptimeSeconds}s`);
    } else {
      record('Health Check Endpoint (REST)', false, undefined, `Unexpected status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    record('Health Check Endpoint (REST)', false, undefined, err.message);
  }

  // Test 2: Service Auth Enforcement on Session Creation
  try {
    const unauthorizedRes = await request('POST', '/api/v1/consultations/session', {}, {
      bookingId: 'test_unauth',
      doctorId: testDoctorId,
      patientId: testPatientId,
    });
    if (unauthorizedRes.status === 401 || unauthorizedRes.status === 403) {
      record('Service Auth Protection on /session', true, `Correctly rejected unauthenticated request with status ${unauthorizedRes.status}`);
    } else {
      record('Service Auth Protection on /session', false, undefined, `Expected 401/403, got ${unauthorizedRes.status}`);
    }
  } catch (err: any) {
    record('Service Auth Protection on /session', false, undefined, err.message);
  }

  // Test 3: Post-Booking Consultation Session Creation (ZEGOCLOUD + COMETCHAT)
  try {
    const sessionRes = await request(
      'POST',
      '/api/v1/consultations/session',
      { 'x-service-api-key': SERVICE_KEY },
      {
        bookingId: `BK_${Date.now()}`,
        doctorId: testDoctorId,
        doctorName: 'Dr. Sarah Connor',
        patientId: testPatientId,
        patientName: 'John Connor',
        scheduledAt: new Date().toISOString(),
      }
    );

    if (sessionRes.status === 201 && sessionRes.data?.data?.consultationId) {
      const data = sessionRes.data.data;
      testRoomId = data.consultationId;
      const hasZego = Boolean(data.videoCall?.doctorToken && data.videoCall?.doctorToken.startsWith('04'));
      const hasComet = Boolean(data.chat?.patientUid && data.chat?.doctorUid);
      
      record(
        'Post-Booking Consultation Creation (ZEGOCLOUD + COMETCHAT + MongoDB)',
        hasZego && hasComet,
        `Room: ${testRoomId}, ZegoTokenPrefix: 04, CometChat: active (AppID: ${data.chat.appId})`
      );
    } else {
      record('Post-Booking Consultation Creation (ZEGOCLOUD + COMETCHAT + MongoDB)', false, undefined, `Status: ${sessionRes.status}, Body: ${JSON.stringify(sessionRes.data)}`);
    }
  } catch (err: any) {
    record('Post-Booking Consultation Creation (ZEGOCLOUD + COMETCHAT + MongoDB)', false, undefined, err.message);
  }

  // Test 4: ZEGOCLOUD Video Call Token Generation & BOLA Check
  if (testRoomId) {
    try {
      // 4a. Authorized Doctor request
      const validTokenRes = await request('GET', `/api/v1/consultations/${testRoomId}/video-token?userId=${testDoctorId}&userName=Dr.%20Sarah`);
      const hasToken = validTokenRes.status === 200 && validTokenRes.data?.data?.token?.startsWith('04');
      record('Authorized Video Call Token Fetch', hasToken, `Token generated: ${validTokenRes.data?.data?.token?.slice(0, 20)}...`);

      // 4b. Unauthorized (BOLA / IDOR) stranger request
      const unauthorizedTokenRes = await request('GET', `/api/v1/consultations/${testRoomId}/video-token?userId=unauthorized_stranger`);
      const isRejected = unauthorizedTokenRes.status === 403;
      record('BOLA / IDOR Prevention on Video Token', isRejected, 'Correctly blocked unauthorized user from acquiring room token');
    } catch (err: any) {
      record('ZEGOCLOUD Video Call Token Generation', false, undefined, err.message);
    }
  }

  // Test 5: Room Status & Details Retrieval
  if (testRoomId) {
    try {
      const roomRes = await request('GET', `/api/v1/rooms/${testRoomId}`);
      const isFound = roomRes.status === 200 && roomRes.data?.data?.roomId === testRoomId;
      record('Consultation Room State & Details Retrieval', isFound, `Status: ${roomRes.data?.data?.status}`);
    } catch (err: any) {
      record('Consultation Room State & Details Retrieval', false, undefined, err.message);
    }
  }

  // Test 6: Direct 1-on-1 User-Doctor Chat Initiation (CometChat)
  try {
    const directChatRes = await request(
      'POST',
      '/api/v1/consultations/direct-chat',
      {},
      {
        userUid: `patient_direct_${Date.now()}`,
        userName: 'Direct Patient',
        doctorUid: `doc_direct_${Date.now()}`,
        doctorName: 'Dr. House',
      }
    );

    const appId = directChatRes.data?.data?.userCredentials?.appId || directChatRes.data?.data?.appId;
    const region = directChatRes.data?.data?.userCredentials?.region || directChatRes.data?.data?.region;
    const isChatCreated = directChatRes.status === 200 && Boolean(appId);

    if (isChatCreated) {
      record('Direct 1-on-1 CometChat Initiation (Any User with Any Doctor)', true, `AppID: ${appId}, Region: ${region}`);
    } else {
      record('Direct 1-on-1 CometChat Initiation (Any User with Any Doctor)', false, undefined, `Status: ${directChatRes.status}, Body: ${JSON.stringify(directChatRes.data)}`);
    }
  } catch (err: any) {
    record('Direct 1-on-1 CometChat Initiation (Any User with Any Doctor)', false, undefined, err.message);
  }

  // Test 7: Doctor Presence Heartbeat & Online Status
  try {
    const heartbeatRes = await request('POST', `/api/v1/doctors/${testDoctorId}/heartbeat`);
    const isHeartbeatSaved = heartbeatRes.status === 200;

    const onlineRes = await request('GET', '/api/v1/doctors/online');
    const isListRetrieved = onlineRes.status === 200 && Array.isArray(onlineRes.data?.data);

    record('Doctor Presence Tracking & Online Listing', isHeartbeatSaved && isListRetrieved, `Heartbeat OK, Online count: ${onlineRes.data?.data?.length}`);
  } catch (err: any) {
    record('Doctor Presence Tracking & Online Listing', false, undefined, err.message);
  }

  // Test 8: Webhook Signature Verification & Anti-Replay
  try {
    const nonce = '987654';
    const nowTimestamp = Math.floor(Date.now() / 1000).toString();
    const sorted = [ZEGO_CALLBACK_SECRET, nonce, nowTimestamp].sort().join('');
    const signature = createHash('sha256').update(sorted).digest('hex');

    // 8a. Valid webhook callback
    const validWebhookRes = await request(
      'POST',
      `/api/v1/webhooks/zegocloud?nonce=${nonce}&timestamp=${nowTimestamp}&signature=${signature}`,
      {},
      { event: 'room_close', room_id: testRoomId }
    );
    const isValidWebhookPassed = validWebhookRes.status === 200;
    if (isValidWebhookPassed) {
      record('ZEGOCLOUD Webhook Valid Signature Verification', true, 'Webhook signature successfully verified and processed');
    } else {
      record('ZEGOCLOUD Webhook Valid Signature Verification', false, undefined, `Status: ${validWebhookRes.status}, Body: ${JSON.stringify(validWebhookRes.data)}`);
    }

    // 8b. Expired timestamp replay test (400s old)
    const expiredTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const expiredSorted = [ZEGO_CALLBACK_SECRET, nonce, expiredTimestamp].sort().join('');
    const expiredSig = createHash('sha256').update(expiredSorted).digest('hex');

    const replayRes = await request(
      'POST',
      `/api/v1/webhooks/zegocloud?nonce=${nonce}&timestamp=${expiredTimestamp}&signature=${expiredSig}`,
      {},
      { event: 'room_close', room_id: testRoomId }
    );
    const isReplayBlocked = replayRes.status === 401;
    if (isReplayBlocked) {
      record('Webhook Replay Attack Protection (300s window)', true, 'Correctly rejected timestamp older than 300 seconds');
    } else {
      record('Webhook Replay Attack Protection (300s window)', false, undefined, `Expected 401, got ${replayRes.status}: ${JSON.stringify(replayRes.data)}`);
    }
  } catch (err: any) {
    record('Webhook Signature Verification', false, undefined, err.message);
  }

  // Test 9: Consultation Audit Logs & Cancellation
  if (testRoomId) {
    try {
      const cancelRes = await request(
        'POST',
        `/api/v1/consultations/${testRoomId}/cancel`,
        {},
        { userId: testDoctorId, reason: 'Test finished' }
      );
      const isCancelled = cancelRes.status === 200 && cancelRes.data?.data?.status === 'ended';

      const logsRes = await request('GET', `/api/v1/consultations/${testRoomId}/logs?userId=${testDoctorId}`);
      const hasLogs = logsRes.status === 200 && Array.isArray(logsRes.data?.data) && logsRes.data?.data?.length > 0;

      record('Consultation Cancellation & Audit Logging', isCancelled && hasLogs, `Cancelled: ${isCancelled}, Log Entries: ${logsRes.data?.data?.length}`);
    } catch (err: any) {
      record('Consultation Cancellation & Audit Logging', false, undefined, err.message);
    }
  }

  // Test 10: WebRTC ICE Servers Configuration
  try {
    const iceRes = await request('GET', '/api/v1/webrtc/ice-servers');
    const hasIceServers = iceRes.status === 200 && Array.isArray(iceRes.data?.data?.iceServers);
    record('WebRTC ICE Servers Endpoint', hasIceServers, `Servers count: ${iceRes.data?.data?.iceServers?.length}`);
  } catch (err: any) {
    record('WebRTC ICE Servers Endpoint', false, undefined, err.message);
  }

  // Summary Report
  console.log('\n======================================================');
  console.log('                 VERIFICATION SUMMARY                 ');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Checks Run: ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Overall Health:   ${failed === 0 ? '🟢 100% HEALTHY & FUNCTIONAL' : '🔴 ISSUES DETECTED'}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllChecks().catch((err) => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
