import { useEffect } from "react";
import {
  AUTH_KEYS,
  SESSION_KEYS,
  getAppPrefix,
  getKnownUserIdKey,
  getLoginPath,
} from "../utils/authStorage";

let reloadTimer = null;

const scheduleSync = (action) => {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(action, 150);
};

const isCurrentAppKey = (storageKey) => {
  if (storageKey === null) {
    // null key indicates localStorage.clear()
    return true;
  }

  const prefix = getAppPrefix();
  if (!storageKey.startsWith(prefix)) {
    return false;
  }

  const baseKey = storageKey.slice(prefix.length);
  return AUTH_KEYS.includes(baseKey) || SESSION_KEYS.includes(baseKey);
};

export default function SessionSync() {
  useEffect(() => {
    // Save the current logged-in user ID into this tab's sessionStorage
    const currentUserId = localStorage.getItem("_id") || "";
    sessionStorage.setItem(getKnownUserIdKey(), currentUserId);

    const handleStorage = (event) => {
      if (!isCurrentAppKey(event.key)) {
        return;
      }

      scheduleSync(() => {
        const newUserId = localStorage.getItem("_id");
        const knownUserId = sessionStorage.getItem(getKnownUserIdKey());

        // 1. User logged out in another tab: redirect this tab to login
        if (!newUserId) {
          sessionStorage.removeItem(getKnownUserIdKey());
          window.location.href = getLoginPath();
          return;
        }

        // 2. Tab was unauthenticated (e.g. on login page) and user logged in in another tab
        if (!knownUserId && newUserId) {
          sessionStorage.setItem(getKnownUserIdKey(), newUserId);
          const currentPath = window.location.pathname.toLowerCase();
          const loginPath = getLoginPath().toLowerCase();
          if (
            currentPath === loginPath ||
            currentPath === "/" ||
            currentPath === "/referral-login" ||
            currentPath === "/insurance-login" ||
            currentPath === "/hospital/"
          ) {
            window.location.href = "/Dashboard";
          }
          return;
        }

        // 3. A DIFFERENT user logged in in another tab:
        // reload so this tab switches to the new user's session
        if (knownUserId && newUserId !== knownUserId) {
          sessionStorage.setItem(getKnownUserIdKey(), newUserId);
          window.location.reload();
          return;
        }

        // 4. Same user across tabs: do nothing!
        // Opening new tabs or navigating will NEVER reload other tabs.
      });
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, []);

  return null;
}
