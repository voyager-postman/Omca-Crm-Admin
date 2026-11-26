const GEO_CACHE_KEY = "omca_geo_location";
const IP_CACHE_KEY = "omca_ip_address";
const GEO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const toNumberOrNull = (value) => {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const readCachedGeoLocation = () => {
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const latitude = toNumberOrNull(parsed?.latitude);
    const longitude = toNumberOrNull(parsed?.longitude);
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (
      latitude == null ||
      longitude == null ||
      !cachedAt ||
      Date.now() - cachedAt > GEO_CACHE_TTL_MS
    ) {
      return null;
    }
    return { latitude, longitude };
  } catch {
    return null;
  }
};

export const cacheGeoLocation = (location) => {
  const latitude = toNumberOrNull(location?.latitude ?? location?.lat);
  const longitude = toNumberOrNull(
    location?.longitude ?? location?.lng ?? location?.lon,
  );
  if (latitude == null || longitude == null) return null;

  const payload = { latitude, longitude, cachedAt: Date.now() };
  try {
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
  return { latitude, longitude };
};

/** Cache IP address in sessionStorage. */
export const cacheIPAddress = (ip) => {
  if (!ip) return null;
  try {
    sessionStorage.setItem(
      IP_CACHE_KEY,
      JSON.stringify({ ip, cachedAt: Date.now() }),
    );
  } catch {
    // ignore storage errors
  }
  return ip;
};

/** Read cached IP address from sessionStorage. */
export const readCachedIPAddress = () => {
  try {
    const raw = sessionStorage.getItem(IP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed?.ip ||
      !parsed?.cachedAt ||
      Date.now() - parsed.cachedAt > GEO_CACHE_TTL_MS
    ) {
      return null;
    }
    return parsed.ip;
  } catch {
    return null;
  }
};

/** Preferred request headers for activity logging. */
export const buildGeoHeaders = (location) => {
  const headers = {};
  const latitude = toNumberOrNull(location?.latitude ?? location?.lat);
  const longitude = toNumberOrNull(
    location?.longitude ?? location?.lng ?? location?.lon,
  );
  if (latitude != null && longitude != null) {
    headers["x-latitude"] = String(latitude);
    headers["x-longitude"] = String(longitude);
  }
  const cachedIP = readCachedIPAddress();
  if (cachedIP) {
    headers["ipAddress"] = cachedIP;
  }
  return headers;
};

/** Resolve browser geolocation once (for activity logging). */
export const getBrowserGeoLocation = (timeoutMs = 5000) =>
  new Promise((resolve) => {
    const cached = readCachedGeoLocation();
    if (cached) {
      resolve(cached);
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation ||
      typeof navigator.geolocation.getCurrentPosition !== "function"
    ) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords || {};
        resolve(
          cacheGeoLocation({
            latitude,
            longitude,
          }),
        );
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 },
    );
  });

/** Warm cache in background (non-blocking). */
export const warmBrowserGeoLocation = () => {
  getBrowserGeoLocation().catch(() => null);
  // Also warm IP cache
  getPublicIP().then((ip) => cacheIPAddress(ip)).catch(() => null);
};

/** Fetch the user's public IP address. */
export const getPublicIP = (timeoutMs = 5000) =>
  new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", "https://api.ipify.org?format=json", true);
      xhr.timeout = timeoutMs;
      xhr.onload = () => {
        try {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            resolve(data?.ip || null);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.ontimeout = () => resolve(null);
      xhr.send();
    } catch {
      resolve(null);
    }
  });
