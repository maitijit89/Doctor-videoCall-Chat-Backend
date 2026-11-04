/**
 * Socket.IO Real-Time Event Names
 */
export const SOCKET_EVENTS = {
  // Connection / Room lifecycle
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  USER_JOINED: 'room:user-joined',
  USER_LEFT: 'room:user-left',
  ROOM_FULL: 'room:full',

  // WebRTC 1-to-1 Consultation Signaling
  CALL_USER: 'call:initiate',
  INCOMING_CALL: 'call:incoming',
  ANSWER_CALL: 'call:answer',
  CALL_ACCEPTED: 'call:accepted',
  REJECT_CALL: 'call:reject',
  CALL_REJECTED: 'call:rejected',
  END_CALL: 'call:end',
  CALL_ENDED: 'call:ended',
  CALL_BUSY: 'call:busy',

  // WebRTC ICE & Media state
  ICE_CANDIDATE: 'webrtc:ice-candidate',
  MEDIA_TOGGLE: 'webrtc:media-toggle', // Mute audio/video
  SCREEN_SHARE: 'webrtc:screen-share',

  // Consultation Chat
  SEND_MESSAGE: 'chat:send-message',
  RECEIVE_MESSAGE: 'chat:receive-message',
  TYPING_START: 'chat:typing-start',
  TYPING_STOP: 'chat:typing-stop',
  USER_TYPING: 'chat:user-typing',
  MESSAGE_READ: 'chat:message-read',

  // Errors & System
  ERROR: 'system:error',
} as const;

export type SocketEventType = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

