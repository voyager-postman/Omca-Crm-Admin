import axios from "axios";
import { getToken } from "./authStorage";
import {
  buildGeoHeaders,
  readCachedGeoLocation,
  warmBrowserGeoLocation,
} from "./geoLocation";

const getBearerToken = () => {
  const token = getToken();
  return token ? `Bearer ${token}` : "";
};

const hasAuthorizationHeader = (headers) => {
  if (!headers) return false;
  if (typeof headers.has === "function") {
    return headers.has("Authorization") || headers.has("authorization");
  }
  return Boolean(headers.Authorization || headers.authorization);
};

const hasHeader = (headers, name) => {
  if (!headers) return false;
  if (typeof headers.has === "function") {
    return headers.has(name);
  }
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
};

const setHeader = (headers, name, value) => {
  if (typeof headers.set === "function") {
    headers.set(name, value);
    return headers;
  }
  return {
    ...headers,
    [name]: value,
  };
};

const setAuthorizationHeader = (headers, bearerToken) =>
  setHeader(headers, "Authorization", bearerToken);

const applyGeoHeaders = (headers = {}) => {
  const geo = buildGeoHeaders(readCachedGeoLocation());
  let next = headers;

  Object.entries(geo).forEach(([name, value]) => {
    if (!hasHeader(next, name)) {
      next = setHeader(next, name, value);
    }
  });

  return next;
};

export const setupApiAuth = () => {
  warmBrowserGeoLocation();

  axios.interceptors.request.use((config) => {
    const bearerToken = getBearerToken();
    let headers = config.headers || {};

    if (bearerToken && !hasAuthorizationHeader(headers)) {
      headers = setAuthorizationHeader(headers, bearerToken);
    }

    headers = applyGeoHeaders(headers);
    config.headers = headers;
    return config;
  });

  if (typeof window === "undefined" || window.__apiAuthFetchReady) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const bearerToken = getBearerToken();
    const requestHeaders =
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined;
    const headers = new Headers(init.headers || requestHeaders);

    if (bearerToken && !headers.has("Authorization")) {
      headers.set("Authorization", bearerToken);
    }

    const geo = buildGeoHeaders(readCachedGeoLocation());
    Object.entries(geo).forEach(([name, value]) => {
      if (!headers.has(name)) {
        headers.set(name, value);
      }
    });

    return originalFetch(input, {
      ...init,
      headers,
    });
  };

  window.__apiAuthFetchReady = true;
};
