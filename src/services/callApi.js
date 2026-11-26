import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import { getToken, getUserId } from "../utils/authStorage";

const authHeaders = () => {
  const token = getToken();
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

const crmUserId = () => getUserId();

/**
 * 1. Generate Token (Fallback / Direct Reconnect)
 * POST /api/call/token
 * Body: { userId, roomName }
 */
export const fetchCallToken = async ({ userId = crmUserId(), roomName }) => {
  const response = await axios.post(
    `${baseurl}call/token`,
    { userId: String(userId), roomName },
    { headers: authHeaders(), timeout: 5000 }
  );
  return response?.data?.data || response?.data;
};

/**
 * 2. Get Call History (Paginated)
 * GET /api/call/history?userId=&page=1&limit=20&filter=all
 */
export const fetchCallHistory = async ({
  userId = crmUserId(),
  page = 1,
  limit = 20,
  filter = "all",
} = {}) => {
  try {
    const response = await axios.get(`${baseurl}call/history`, {
      params: {
        userId: String(userId),
        page,
        limit,
        filter,
      },
      headers: authHeaders(),
      timeout: 2000,
    });
    return response?.data || { success: true, data: [], pagination: {} };
  } catch (err) {
    // Fail fast with empty history so UI does not hang if endpoint is pending deployment
    return {
      success: false,
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 1 },
    };
  }
};

/**
 * 3. Get Unread Missed Calls Count
 * GET /api/call/missed-count?userId=
 */
export const fetchMissedCallsCount = async (userId = crmUserId()) => {
  if (!userId) return 0;
  try {
    const response = await axios.get(`${baseurl}call/missed-count`, {
      params: { userId: String(userId) },
      headers: authHeaders(),
      timeout: 2000,
    });
    return response?.data?.data?.missedCount ?? response?.data?.missedCount ?? 0;
  } catch (_) {
    // Fail fast with 0 so page never blocks
    return 0;
  }
};

/**
 * 4. Mark Missed Calls as Read
 * POST /api/call/mark-read
 * Body: { userId, callId }
 */
export const markMissedCallsRead = async ({ userId = crmUserId(), callId } = {}) => {
  try {
    const payload = { userId: String(userId) };
    if (callId) payload.callId = callId;
    const response = await axios.post(`${baseurl}call/mark-read`, payload, {
      headers: authHeaders(),
      timeout: 2000,
    });
    return response?.data || { success: true };
  } catch (_) {
    return { success: true };
  }
};

/**
 * 5. Check if User is Currently in a Call
 * GET /api/call/active-status?userId=
 */
export const fetchActiveCallStatus = async (userId = crmUserId()) => {
  if (!userId) return { isInCall: false };
  try {
    const response = await axios.get(`${baseurl}call/active-status`, {
      params: { userId: String(userId) },
      headers: authHeaders(),
      timeout: 2000,
    });
    return response?.data?.data || response?.data || { isInCall: false };
  } catch (_) {
    return { isInCall: false };
  }
};
