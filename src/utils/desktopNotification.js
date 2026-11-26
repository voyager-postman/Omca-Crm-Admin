/**
 * Native Windows / OS Desktop Notification Service for OMCA CRM.
 * Uses ServiceWorkerRegistration.showNotification (required by Chrome on Windows
 * for notifications when minimized or running in another tab) with fallback to window.Notification.
 */

let swRegistration = null;
let isInitStarted = false;

/**
 * Register Service Worker for system-level notifications
 */
export const initDesktopNotifications = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }
  if (isInitStarted && swRegistration) {
    return swRegistration;
  }
  isInitStarted = true;

  if ("serviceWorker" in navigator) {
    try {
      // Register sw.js from root
      swRegistration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      return swRegistration;
    } catch (err) {
      console.warn("ServiceWorker registration for notifications failed:", err);
    }
  }

  return null;
};

/**
 * Check current notification permission state
 */
export const getNotificationPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
};

/**
 * Request notification permission from user
 */
export const requestDesktopNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const res = await Notification.requestPermission();
    if (res === "granted") {
      await initDesktopNotifications();
    }
    return res;
  } catch (err) {
    console.error("requestPermission failed:", err);
    return "denied";
  }
};

/**
 * Show a native Windows desktop notification.
 * Works even when Chrome is completely minimized or user is on another desktop application.
 */
export const showDesktopNotification = async ({
  title,
  body,
  icon = "/assets/img/omca_stamp.png",
  tag,
  data = {},
  requireInteraction = false,
  onClick,
}) => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const options = {
    body: body || "",
    icon: icon || "/assets/img/omca_stamp.png",
    badge: "/assets/img/omca_stamp.png",
    tag: tag || `notif-${Date.now()}`,
    data: data || {},
    requireInteraction: !!requireInteraction,
    renotify: true,
    silent: false,
  };

  // 1. Primary path: Service Worker showNotification (Windows Shell Integration)
  try {
    if ("serviceWorker" in navigator) {
      const reg = swRegistration || (await navigator.serviceWorker.ready);
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch (swErr) {
    console.warn("SW showNotification failed, trying fallback:", swErr);
  }

  // 2. Fallback path: standard window.Notification constructor
  try {
    const notif = new Notification(title, options);
    if (onClick) {
      notif.onclick = (e) => {
        try {
          window.focus();
        } catch (_) {}
        onClick(e);
        notif.close();
      };
    }
    return true;
  } catch (winErr) {
    console.error("Native window.Notification failed:", winErr);
    return false;
  }
};

/**
 * Test function to verify desktop notifications on user's system
 */
export const testDesktopNotification = async () => {
  return showDesktopNotification({
    title: "🔔 OMCA CRM Test Notification",
    body: "Desktop notifications are working! You will receive calls & messages even when minimized.",
    icon: "/assets/img/omca_stamp.png",
    tag: "test-notification",
    requireInteraction: false,
  });
};

