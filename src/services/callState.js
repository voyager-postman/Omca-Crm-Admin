/**
 * Shared Call and Notification State across OMCA CRM
 * Allows calls to persist across routes and pages without disconnecting.
 */

let activeCallState = null;
let outgoingCallState = null;
let currentViewingChatId = null;

const listeners = new Set();

const notify = () => {
  const snapshot = {
    activeCall: activeCallState,
    outgoingCall: outgoingCallState,
  };
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (err) {
      console.error("Call state listener error:", err);
    }
  });
};

export const getGlobalActiveCall = () => activeCallState;

export const setGlobalActiveCall = (call) => {
  activeCallState = call;
  notify();
};

export const getGlobalOutgoingCall = () => outgoingCallState;

export const setGlobalOutgoingCall = (call) => {
  outgoingCallState = call;
  notify();
};

export const setViewingChatId = (chatId) => {
  currentViewingChatId = chatId;
};

export const getViewingChatId = () => currentViewingChatId;

export const subscribeGlobalCallState = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// Direct callback to open conversation instantly across pages or within Messages.js
let openChatHandler = null;

export const registerOpenChatHandler = (fn) => {
  openChatHandler = fn;
  return () => {
    if (openChatHandler === fn) {
      openChatHandler = null;
    }
  };
};

export const requestOpenChat = (chatParams) => {
  if (typeof openChatHandler === "function") {
    try {
      openChatHandler(chatParams);
      return true;
    } catch (err) {
      console.warn("requestOpenChat error:", err);
    }
  }
  return false;
};

