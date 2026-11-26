import {
  connectSosSocket,
  disconnectSosSocket,
  getSosSocket,
} from "./sosSocket";
import { getToken } from "../utils/authStorage";

const messageListeners = new Set();
const readListeners = new Set();
const presenceListeners = new Set();
const onlineListListeners = new Set();
const authListeners = new Set();
const memberRemovedListeners = new Set();

const notify = (set, payload) => {
  set.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error("Chat socket listener error:", err);
    }
  });
};

const onMessage = (msg) => notify(messageListeners, msg);
const onRead = (payload) => notify(readListeners, payload);
const onPresence = (payload) => notify(presenceListeners, payload);
const onOnlineList = (list) => notify(onlineListListeners, list);
const onAuthOk = (data) => notify(authListeners, { ok: true, data });
const onAuthFail = (err) => notify(authListeners, { ok: false, error: err });
const onMemberRemoved = (payload) => notify(memberRemovedListeners, payload);

/** Bind (or re-bind) chat events on the shared CRM socket. */
const bindChatEventListeners = (sock) => {
  if (!sock) return;

  // Always off() then on() so Navbar poll / reconnect never stacks handlers
  sock.off("chat:message", onMessage);
  sock.off("chat:read", onRead);
  sock.off("presence:update", onPresence);
  sock.off("presence:online-users", onOnlineList);
  sock.off("authenticated", onAuthOk);
  sock.off("unauthenticated", onAuthFail);
  sock.off("chat:member_removed", onMemberRemoved);

  sock.on("chat:message", onMessage);
  sock.on("chat:read", onRead);
  sock.on("presence:update", onPresence);
  sock.on("presence:online-users", onOnlineList);
  sock.on("authenticated", onAuthOk);
  sock.on("unauthenticated", onAuthFail);
  sock.on("chat:member_removed", onMemberRemoved);
};

/**
 * Ensure shared CRM socket is up (JWT) and chat listeners are bound.
 * Presence / heartbeat / crm:subscribe live in sosSocket.
 */
export const connectChatSocket = (token = getToken()) => {
  const sock = connectSosSocket(token);
  if (!sock) return null;
  bindChatEventListeners(sock);
  if (sock.connected) {
    sock.emit("presence:get");
  }
  return sock;
};

export const disconnectChatSocket = () => {
  disconnectSosSocket();
};

export const getChatSocket = () => getSosSocket();

export const isChatSocketConnected = () => !!getSosSocket()?.connected;

export const joinChatRoom = (chatId) => {
  const sock = getSosSocket();
  if (!sock?.connected || !chatId) return;
  sock.emit("joinChat", { chatId });
};

export const leaveChatRoom = (chatId) => {
  const sock = getSosSocket();
  if (!sock?.connected || !chatId) return;
  sock.emit("leaveChat", { chatId });
};

export const sendChatMessageSocket = ({ message, chatId, contactUserId }) => {
  const sock = getSosSocket();
  if (!sock?.connected) return false;
  const payload = { message };
  if (chatId) payload.chatId = chatId;
  if (contactUserId != null) payload.contactUserId = String(contactUserId);
  sock.emit("chat:send", payload);
  return true;
};

export const markChatReadSocket = (chatId) => {
  const sock = getSosSocket();
  if (!sock?.connected || !chatId) return;
  sock.emit("chat:read", { chatId });
};

export const requestPresence = () => {
  const sock = getSosSocket();
  if (!sock?.connected) return;
  sock.emit("presence:get");
};

export const onChatMessage = (listener) => {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
};

export const onChatRead = (listener) => {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
};

export const onPresenceUpdate = (listener) => {
  presenceListeners.add(listener);
  return () => presenceListeners.delete(listener);
};

export const onPresenceOnlineUsers = (listener) => {
  onlineListListeners.add(listener);
  return () => onlineListListeners.delete(listener);
};

export const onChatAuth = (listener) => {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
};

export const onChatMemberRemoved = (listener) => {
  memberRemovedListeners.add(listener);
  return () => memberRemovedListeners.delete(listener);
};
