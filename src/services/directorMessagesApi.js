import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

/**
 * Standard auth header with JWT token
 */
const authHeaders = (isMultipart = false) => {
  const token = localStorage.getItem("token");
  const headers = {
    Authorization: `Bearer ${token || ""}`,
  };
  if (isMultipart) {
    headers["Content-Type"] = "multipart/form-data";
  } else {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

const API_BASE = `${baseurl}director-messages`;

/**
 * API 1: Create & Broadcast Director Message (Super Admin / Admin / Director)
 * POST /api/director-messages
 * Content-Type: multipart/form-data
 * Payload: title, message, priority, targetType, targetRoles, targetUsers, isPopup, expiresAt, attachments
 */
export const createDirectorMessage = async (formData) => {
  const response = await axios.post(API_BASE, formData, {
    headers: authHeaders(true),
  });
  return response?.data;
};

/**
 * API 2: Get Active Un-dismissed Messages (For Top SOS Alert / Banner)
 * GET /api/director-messages/active
 * Returns only active messages not yet dismissed by current staff member
 */
export const fetchActiveDirectorMessages = async () => {
  const response = await axios.get(`${API_BASE}/active`, {
    headers: authHeaders(),
  });
  const data = response?.data?.data ?? response?.data ?? [];
  return Array.isArray(data) ? data : [];
};

/**
 * API 3: Close / Dismiss Active Message (Staff Action)
 * PUT /api/director-messages/:id/dismiss
 */
export const dismissDirectorMessage = async (id) => {
  if (!id) throw new Error("Missing message ID");
  const response = await axios.put(
    `${API_BASE}/${id}/dismiss`,
    {},
    {
      headers: authHeaders(),
    }
  );
  return response?.data;
};

/**
 * API 4: Get All Messages (For "Director Messages" Menu Listing)
 * GET /api/director-messages
 * Query params: page, limit, search, priority, status
 */
export const fetchDirectorMessages = async (params = {}) => {
  const query = new URLSearchParams();
  query.append("page", params.page || 1);
  query.append("limit", params.limit || 10);
  if (params.search && params.search.trim()) query.append("search", params.search.trim());
  if (params.priority && params.priority !== "ALL") query.append("priority", params.priority);
  if (params.status !== undefined && params.status !== "ALL" && params.status !== "") {
    query.append("status", params.status);
  }

  const url = `${API_BASE}${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await axios.get(url, {
    headers: authHeaders(),
  });
  return response?.data;
};

/**
 * API 5: Get Single Message Details
 * GET /api/director-messages/:id
 * Automatically marks the message as read on backend
 */
export const fetchDirectorMessageById = async (id) => {
  if (!id) throw new Error("Missing message ID");
  const response = await axios.get(`${API_BASE}/${id}`, {
    headers: authHeaders(),
  });
  return response?.data?.data ?? response?.data;
};

/**
 * API 6: Get Staff Engagement Stats (Super Admin Only)
 * GET /api/director-messages/:id/stats
 */
export const fetchDirectorMessageStats = async (id) => {
  if (!id) throw new Error("Missing message ID");
  const response = await axios.get(`${API_BASE}/${id}/stats`, {
    headers: authHeaders(),
  });
  return response?.data?.data ?? response?.data;
};

/**
 * API 7: Update Message (Super Admin Only)
 * PUT /api/director-messages/:id
 * Content-Type: multipart/form-data
 */
export const updateDirectorMessage = async (id, formData) => {
  if (!id) throw new Error("Missing message ID");
  const response = await axios.put(`${API_BASE}/${id}`, formData, {
    headers: authHeaders(true),
  });
  return response?.data;
};

/**
 * API 8: Delete Message (Super Admin Only)
 * DELETE /api/director-messages/:id
 */
export const deleteDirectorMessage = async (id) => {
  if (!id) throw new Error("Missing message ID");
  const response = await axios.delete(`${API_BASE}/${id}`, {
    headers: authHeaders(),
  });
  return response?.data;
};

/**
 * Helper: Format file size into human-readable string
 */
export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return "0 B";
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || "B"}`;
};

/**
 * Helper: Format ISO date string into readable local string
 */
export const formatMessageDate = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Helper: Check if current logged in user has administrative privileges for director messages.
 * Hardcoded: Strictly "Admin" only (not Super Admin). All other staff have view-only access.
 */
export const canManageDirectorMessages = (role = localStorage.getItem("Role")) => {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin";
};

export const canSendDirectorMessage = canManageDirectorMessages;

/**
 * Helper: Get badge styling and icons for message priority
 */
export const getPriorityBadgeProps = (priority = "NORMAL") => {
  const p = String(priority || "").toUpperCase();
  switch (p) {
    case "SOS":
      return {
        label: "SOS EMERGENCY",
        className: "dm-badge dm-badge-sos",
        color: "#cf081c",
        bg: "#fee2e2",
        icon: "fa fa-exclamation-triangle",
      };
    case "HIGH":
      return {
        label: "HIGH PRIORITY",
        className: "dm-badge dm-badge-high",
        color: "#d97706",
        bg: "#fef3c7",
        icon: "fa fa-exclamation-circle",
      };
    case "NORMAL":
    default:
      return {
        label: "NORMAL",
        className: "dm-badge dm-badge-normal",
        color: "#2563eb",
        bg: "#dbeafe",
        icon: "fa fa-info-circle",
      };
  }
};
