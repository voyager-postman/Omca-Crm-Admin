import { getSosSocket } from "./sosSocket";

const incomingListeners = new Set();
const ringingListeners = new Set();
const acceptedListeners = new Set();
const rejectedListeners = new Set();
const cancelledListeners = new Set();
const endedListeners = new Set();
const participantJoinedListeners = new Set();
const participantLeftListeners = new Set();
const participantDeclinedListeners = new Set();
const mediaToggledListeners = new Set();
const busyListeners = new Set();
const missedListeners = new Set();
const errorListeners = new Set();

const notify = (set, payload) => {
  set.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error("Call socket listener error:", err);
    }
  });
};

const handleIncoming = (payload) => notify(incomingListeners, payload);
const handleRinging = (payload) => notify(ringingListeners, payload);
const handleAccepted = (payload) => notify(acceptedListeners, payload);
const handleRejected = (payload) => notify(rejectedListeners, payload);
const handleCancelled = (payload) => notify(cancelledListeners, payload);
const handleEnded = (payload) => notify(endedListeners, payload);
const handleParticipantJoined = (payload) => notify(participantJoinedListeners, payload);
const handleParticipantLeft = (payload) => notify(participantLeftListeners, payload);
const handleParticipantDeclined = (payload) => notify(participantDeclinedListeners, payload);
const handleMediaToggled = (payload) => notify(mediaToggledListeners, payload);
const handleBusy = (payload) => notify(busyListeners, payload);
const handleMissed = (payload) => notify(missedListeners, payload);
const handleError = (payload) => notify(errorListeners, payload);

/**
 * Bind call signaling event listeners to the Socket.IO instance
 */
export const bindCallEventListeners = (sock = getSosSocket()) => {
  if (!sock) return;

  // Prevent duplicate handlers
  sock.off("call:incoming", handleIncoming);
  sock.off("call:ringing", handleRinging);
  sock.off("call:accepted", handleAccepted);
  sock.off("call:rejected", handleRejected);
  sock.off("call:cancelled", handleCancelled);
  sock.off("call:ended", handleEnded);
  sock.off("call:participant_joined", handleParticipantJoined);
  sock.off("call:participant_left", handleParticipantLeft);
  sock.off("call:participant_declined", handleParticipantDeclined);
  sock.off("call:media_toggled", handleMediaToggled);
  sock.off("call:busy", handleBusy);
  sock.off("call:missed", handleMissed);
  sock.off("call:error", handleError);

  sock.on("call:incoming", handleIncoming);
  sock.on("call:ringing", handleRinging);
  sock.on("call:accepted", handleAccepted);
  sock.on("call:rejected", handleRejected);
  sock.on("call:cancelled", handleCancelled);
  sock.on("call:ended", handleEnded);
  sock.on("call:participant_joined", handleParticipantJoined);
  sock.on("call:participant_left", handleParticipantLeft);
  sock.on("call:participant_declined", handleParticipantDeclined);
  sock.on("call:media_toggled", handleMediaToggled);
  sock.on("call:busy", handleBusy);
  sock.on("call:missed", handleMissed);
  sock.on("call:error", handleError);
};

// ==================== Actions (Client -> Server) ====================

/**
 * Step 1: Initiate a call (1-on-1 or Group)
 */
export const initiateCall = ({
  receiverId,
  receiverIds,
  chatId,
  groupName,
  callType = "video",
} = {}) => {
  const sock = getSosSocket();
  if (!sock?.connected) {
    console.warn("Call initiation failed: socket not connected");
    return false;
  }

  const payload = { callType };
  if (receiverId) payload.receiverId = String(receiverId);
  if (chatId) payload.chatId = chatId;
  if (Array.isArray(receiverIds) && receiverIds.length > 0) {
    payload.receiverIds = receiverIds.map(String);
  }
  if (groupName) payload.groupName = groupName;

  sock.emit("call:initiate", payload, (response) => {
    // If the server acknowledges via callback
    if (response) {
      if (response.success && (response.token || response.callId)) {
        handleRinging(response);
      } else if (response.error || response.message) {
        handleError(response);
      }
    }
  });
  return true;
};

/**
 * Step 3: Accept incoming call
 */
export const acceptCall = (callId) => {
  const sock = getSosSocket();
  if (!sock?.connected || !callId) return false;
  sock.emit("call:accept", { callId });
  return true;
};

/**
 * Step 5: Reject incoming call
 */
export const rejectCall = (callId, reason = "declined") => {
  const sock = getSosSocket();
  if (!sock?.connected || !callId) return false;
  sock.emit("call:reject", { callId, reason });
  return true;
};

/**
 * Step 6: Cancel outgoing call before answer
 */
export const cancelCall = (callId) => {
  const sock = getSosSocket();
  if (!sock?.connected || !callId) return false;
  sock.emit("call:cancel", { callId });
  return true;
};

/**
 * Step 7: End or leave call
 */
export const endCall = (callId, endForAll = false) => {
  const sock = getSosSocket();
  if (!sock?.connected || !callId) return false;
  const payload = { callId };
  if (endForAll) payload.endForAll = true;
  sock.emit("call:end", payload);
  return true;
};

/**
 * Step 8: Toggle media (Mic / Camera)
 */
export const toggleCallMedia = (callId, mediaType, enabled) => {
  const sock = getSosSocket();
  if (!sock?.connected || !callId) return false;
  sock.emit("call:toggle_media", { callId, mediaType, enabled: !!enabled });
  return true;
};

// ==================== Listener Subscriptions ====================

export const onCallIncoming = (fn) => {
  incomingListeners.add(fn);
  return () => incomingListeners.delete(fn);
};

export const onCallRinging = (fn) => {
  ringingListeners.add(fn);
  return () => ringingListeners.delete(fn);
};

export const onCallAccepted = (fn) => {
  acceptedListeners.add(fn);
  return () => acceptedListeners.delete(fn);
};

export const onCallRejected = (fn) => {
  rejectedListeners.add(fn);
  return () => rejectedListeners.delete(fn);
};

export const onCallCancelled = (fn) => {
  cancelledListeners.add(fn);
  return () => cancelledListeners.delete(fn);
};

export const onCallEnded = (fn) => {
  endedListeners.add(fn);
  return () => endedListeners.delete(fn);
};

export const onCallParticipantJoined = (fn) => {
  participantJoinedListeners.add(fn);
  return () => participantJoinedListeners.delete(fn);
};

export const onCallParticipantLeft = (fn) => {
  participantLeftListeners.add(fn);
  return () => participantLeftListeners.delete(fn);
};

export const onCallParticipantDeclined = (fn) => {
  participantDeclinedListeners.add(fn);
  return () => participantDeclinedListeners.delete(fn);
};

export const onCallMediaToggled = (fn) => {
  mediaToggledListeners.add(fn);
  return () => mediaToggledListeners.delete(fn);
};

export const onCallBusy = (fn) => {
  busyListeners.add(fn);
  return () => busyListeners.delete(fn);
};

export const onCallMissed = (fn) => {
  missedListeners.add(fn);
  return () => missedListeners.delete(fn);
};

export const onCallError = (fn) => {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
};

