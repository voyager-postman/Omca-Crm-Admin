import axios from "axios";
import { AdminBaseUrl } from "../Basurl/Baseurl";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const saveCrmRequest = async (path, body) => {
  const cleanPath = String(path || "").replace(/^\//, "");
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await axios.post(`${AdminBaseUrl}${cleanPath}`, body, {
    headers: {
      ...authHeaders(),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
  });
  return response.data;
};

export const isCrmSaveSuccess = (res) => {
  const success = res?.success;
  return success === true || success === "true";
};

export const crmSaveErrorMessage = (error, fallback = "Unable to save") => {
  const data = error?.response?.data || error || {};
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (data.errors && typeof data.errors === "object") {
    const messages = Object.values(data.errors).flat().filter(Boolean);
    if (messages.length) return messages.join("\n");
  }
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.filter(Boolean).join("\n");
  }
  return error?.message || fallback;
};
