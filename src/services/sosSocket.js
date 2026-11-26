import { io } from "socket.io-client";
import { socketUrl, socketPath } from "../Basurl/Baseurl";

let socket = null;
let heartbeatTimer = null;
const alertListeners = new Set();
const dismissListeners = new Set();
const statusListeners = new Set();
const directorListeners = new Set();
const crmNotificationListeners = new Set();
const crmPopupListeners = new Set();

const clearHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const startHeartbeat = (sock) => {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (sock?.connected) {
      sock.emit("heartbeat");
    }
  }, 30000);
};

/** Exact JWT role names used for sos-role:{role} rooms */
export const SOS_ROLE_NAMES = [
  "Coordinator",
  "Supervisor",
  "Operations Manager",
  "Director",
];

const notifyStatus = (payload) => {
  statusListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error("SOS socket status listener error:", err);
    }
  });
};

const notifyAlert = (alert) => {
  if (!alert) return;
  alertListeners.forEach((fn) => {
    try {
      fn(alert);
    } catch (err) {
      console.error("SOS socket alert listener error:", err);
    }
  });
};

const notifyDismiss = (payload) => {
  if (!payload) return;
  dismissListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error("SOS socket dismiss listener error:", err);
    }
  });
};

const notifyCrmListeners = (listeners, payload) => {
  if (!payload) return;
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error("CRM socket listener error:", err);
    }
  });
};

const notifyDirectorMessage = (payload) => {
  if (!payload) return;
  directorListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error("SOS socket director message listener error:", err);
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("omca:director-message", { detail: payload })
    );
  }
};

export const requestSosNotificationPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
};

export const showSosBrowserNotification = (alert = {}) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (alert.showNotification === false) return;

  try {
    new Notification(alert.title || "SOS Alert", {
      body: alert.body || "",
      tag: alert.sosId || alert.emergencyCaseId || "sos-alert",
      // Never mark CRM SOS as silent — operators must hear/see it
      silent: false,
      requireInteraction: true,
    });
  } catch (err) {
    console.warn("Browser notification failed:", err);
  }
};

/** Normalize any alert-like payload into a usable SOS id + type */
export const getSosAlertId = (alert) =>
  alert?.sosId ||
  alert?.emergencyCaseId ||
  alert?.caseId ||
  alert?.id ||
  null;

export const isSosAlertDismissed = (alert) => {
  if (!alert) return false;
  const type = String(alert?.type || "").toUpperCase();
  return (
    type === "SOS_ALERT_DISMISSED" ||
    type === "ALERT_DISMISSED" ||
    type.includes("DISMISS")
  );
};

export const isSosEscalation = (alert) => {
  if (isSosAlertDismissed(alert)) return false;
  const type = String(alert?.type || "").toUpperCase();
  return (
    type === "SOS_ESCALATION" ||
    type.includes("ESCALATION") ||
    !!alert?.escalationRole
  );
};

export const isSosNewAlert = (alert) => {
  if (!alert) return false;
  if (isSosAlertDismissed(alert)) return false;
  const type = String(alert?.type || "").toUpperCase();
  if (type === "SOS_ESCALATION" || type.includes("ESCALATION")) return false;
  if (!type) return !!getSosAlertId(alert);
  return (
    type === "SOS_NEW_ALERT" ||
    type === "NEW_SOS" ||
    type.includes("NEW") ||
    type.includes("ALERT") ||
    !!getSosAlertId(alert)
  );
};

const bindCoreListeners = (sock) => {
  sock.off("connect");
  sock.off("sos:subscribed");
  sock.off("sos:web-alert");
  sock.off("sos:alert");
  sock.off("sos:alert-dismissed");
  sock.off("disconnect");
  sock.off("connect_error");

  sock.on("connect", () => {
    console.log("SOS socket connected:", sock.id);
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("_id");
    // Chat presence: JWT auth + CRM rooms so mobile /chat/crm-online shows this agent
    if (token) {
      sock.emit("authenticate", { token, ...(userId ? { userId } : {}) });
    } else if (userId) {
      sock.emit("authenticate", { userId });
    }
    sock.emit("sos:subscribe");
    sock.emit("crm:subscribe");
    startHeartbeat(sock);
    notifyStatus({ connected: true, socketId: sock.id });
  });

  sock.off("authenticated");
  sock.off("unauthenticated");
  sock.off("crm:subscribed");

  sock.on("authenticated", (data) => {
    console.log("CRM online for chat", data);
    sock.emit("crm:subscribe");
  });

  sock.on("unauthenticated", (err) => {
    console.error("Chat socket unauthenticated:", err);
  });

  sock.on("crm:subscribed", (data) => {
    console.log("CRM chat rooms joined:", data);
  });

  sock.on("sos:subscribed", (data) => {
    console.log("SOS rooms joined:", data?.rooms || data);
    notifyStatus({ connected: true, subscribed: true, rooms: data?.rooms });
  });

  // Role-scoped alerts (sos-role:{role}) + dismiss when another operator accepts
  const forwardAlert = (alert) => {
    if (isSosAlertDismissed(alert)) {
      notifyDismiss(alert);
      return;
    }
    notifyAlert(alert);
  };
  sock.on("sos:web-alert", forwardAlert);
  sock.on("sos:alert", forwardAlert);
  sock.on("sos:alert-dismissed", (payload) => notifyDismiss(payload));

  sock.off("crm:notification");
  sock.off("crm:popup-alert");
  sock.on("crm:notification", (payload) =>
    notifyCrmListeners(crmNotificationListeners, payload),
  );
  sock.on("crm:popup-alert", (payload) =>
    notifyCrmListeners(crmPopupListeners, payload),
  );

  sock.off("director:message");
  sock.off("sos:director_message");
  const forwardDirectorMessage = (payload) => {
    notifyDirectorMessage(payload);
  };
  sock.on("director:message", forwardDirectorMessage);
  sock.on("sos:director_message", forwardDirectorMessage);

  sock.on("disconnect", (reason) => {
    console.log("SOS socket disconnected:", reason);
    clearHeartbeat();
    notifyStatus({ connected: false, reason });
  });

  sock.on("connect_error", (err) => {
    console.warn("SOS socket connect_error:", err?.message || err);
    notifyStatus({ connected: false, error: err?.message || "connect_error" });
  });
};

/**
 * Connect Socket.IO after CRM login (JWT auth).
 * Server joins sos-role:{Role} from JWT (exact: Coordinator, Supervisor,
 * Operations Manager, Director). Admin has ops override. After accept,
 * further updates go only to user:{mongoUserId}.
 */
export const connectSosSocket = (token = localStorage.getItem("token")) => {
  if (!token) return null;
  const userId = localStorage.getItem("_id") || localStorage.getItem("userId") || "";

  if (socket) {
    socket.auth = { token, ...(userId ? { userId } : {}) };
    bindCoreListeners(socket);
    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit("authenticate", { token, ...(userId ? { userId } : {}) });
      socket.emit("sos:subscribe");
      socket.emit("crm:subscribe");
      startHeartbeat(socket);
      notifyStatus({ connected: true, socketId: socket.id });
    }
    return socket;
  }

  socket = io(socketUrl, {
    path: socketPath,
    auth: { token, ...(userId ? { userId } : {}) },
    query: { ...(userId ? { userId } : {}) },
    extraHeaders: {
      Authorization: `Bearer ${token}`,
    },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 20000,
    forceNew: false,
  });

  bindCoreListeners(socket);
  return socket;
};

export const disconnectSosSocket = () => {
  clearHeartbeat();
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  notifyStatus({ connected: false, reason: "manual_disconnect" });
};

export const getSosSocket = () => socket;

export const onSosWebAlert = (listener) => {
  alertListeners.add(listener);
  return () => alertListeners.delete(listener);
};

/** Fired when a case is accepted elsewhere — remove card if removeFromScreen */
export const onSosAlertDismissed = (listener) => {
  dismissListeners.add(listener);
  return () => dismissListeners.delete(listener);
};

export const onSosSocketStatus = (listener) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

export const onDirectorMessage = (listener) => {
  directorListeners.add(listener);
  return () => directorListeners.delete(listener);
};

/** Persistent CRM notification (bell). Includes TP/VIL stinker reminders. */
export const onCrmNotification = (listener) => {
  crmNotificationListeners.add(listener);
  return () => crmNotificationListeners.delete(listener);
};

/** Instant CRM popup alert. Includes TP/VIL stinker reminders. */
export const onCrmPopupAlert = (listener) => {
  crmPopupListeners.add(listener);
  return () => crmPopupListeners.delete(listener);
};
