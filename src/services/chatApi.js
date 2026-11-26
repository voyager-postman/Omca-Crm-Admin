import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import { getToken, getUserId } from "../utils/authStorage";

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

const crmUserId = () => getUserId();

/** GET /chat/list?userId=<CRM_MONGO_ID> */
export const fetchChatList = async (userId = crmUserId()) => {
  const response = await axios.get(`${baseurl}chat/list`, {
    params: { userId },
    headers: authHeaders(),
  });
  const data = unwrap(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.chats)) return data.chats;
  if (Array.isArray(data?.list)) return data.list;
  return [];
};

/** GET /chat/messages/<chatId>?userId=&page=&limit= */
export const fetchChatMessages = async (
  chatId,
  { userId = crmUserId(), page = 1, limit = 100 } = {},
) => {
  const encodedId = encodeURIComponent(chatId);
  const response = await axios.get(`${baseurl}chat/messages/${encodedId}`, {
    params: { userId, page, limit },
    headers: authHeaders(),
  });
  const data = unwrap(response);
  const rawParticipants =
    data?.participants ||
    response?.data?.participants ||
    response?.data?.data?.participants ||
    [];
  const participants = Array.isArray(rawParticipants) ? rawParticipants : [];

  const rawPagination =
    response?.data?.pagination ||
    response?.data?.data?.pagination ||
    data?.pagination ||
    {};

  const pageNum = Number(rawPagination.page ?? page ?? 1);
  const limitNum = Number(rawPagination.limit ?? limit ?? 100);
  const rawMsgs = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
    ? data.messages
    : [];
  const total = Number(rawPagination.total ?? rawMsgs.length);
  const pages = Number(
    rawPagination.pages ?? Math.max(1, Math.ceil(total / (limitNum || 100))),
  );
  const hasMore =
    typeof rawPagination.hasMore === "boolean"
      ? rawPagination.hasMore
      : pageNum < pages;

  const pagination = {
    page: pageNum,
    limit: limitNum,
    total,
    pages,
    hasMore,
  };

  return {
    messages: rawMsgs,
    participants,
    pagination,
    page: pageNum,
    limit: limitNum,
    hasMore,
    total,
    pages,
  };
};

/** Fetch all pages of messages for a chat across pages up to maxPages */
export const fetchAllChatMessages = async (
  chatId,
  { userId = crmUserId(), startPage = 1, limit = 100, maxPages = 20 } = {},
) => {
  const first = await fetchChatMessages(chatId, { userId, page: startPage, limit });
  let allMessages = [...(first.messages || [])];
  const participants = first.participants || [];
  const totalPages = Math.min(first.pages || 1, maxPages);

  if (totalPages > startPage) {
    const pagePromises = [];
    for (let p = startPage + 1; p <= totalPages; p++) {
      pagePromises.push(
        fetchChatMessages(chatId, { userId, page: p, limit }).catch((e) => {
          console.warn(`Failed to fetch page ${p}:`, e);
          return { messages: [] };
        }),
      );
    }
    const results = await Promise.all(pagePromises);
    results.forEach((r) => {
      if (Array.isArray(r.messages)) {
        allMessages = allMessages.concat(r.messages);
      }
    });
  }

  return {
    messages: allMessages,
    participants,
    pagination: {
      page: 1,
      limit,
      total: first.total || allMessages.length,
      pages: totalPages,
      hasMore: (first.pages || 1) > totalPages,
    },
    page: 1,
    limit,
    total: first.total || allMessages.length,
    pages: totalPages,
    hasMore: (first.pages || 1) > totalPages,
  };
};

/** POST /chat/start — CRM → Patient / Staff */
export const startChat = async (contactUserId, userId = crmUserId()) => {
  const response = await axios.post(
    `${baseurl}chat/start`,
    { userId, contactUserId: String(contactUserId) },
    { headers: authHeaders() },
  );
  return unwrap(response) || response.data;
};

/** POST /chat/send — Supports text and multipart/form-data attachments */
export const sendChatMessageRest = async ({
  message,
  chatId,
  contactUserId,
  attachment,
  userId = crmUserId(),
}) => {
  if (attachment) {
    const formData = new FormData();
    if (userId) formData.append("userId", userId);
    if (chatId) formData.append("chatId", chatId);
    if (contactUserId != null) formData.append("contactUserId", String(contactUserId));
    if (message) formData.append("message", message);
    formData.append("attachment", attachment);

    const response = await axios.post(`${baseurl}chat/send`, formData, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return unwrap(response) || response.data;
  }

  const body = { userId };
  if (message) body.message = message;
  if (chatId) body.chatId = chatId;
  if (contactUserId != null) body.contactUserId = String(contactUserId);

  const response = await axios.post(`${baseurl}chat/send`, body, {
    headers: authHeaders(),
  });
  return unwrap(response) || response.data;
};

/** POST /chat/group/create */
export const createGroupChat = async ({
  name,
  memberIds,
  userId = crmUserId(),
}) => {
  const response = await axios.post(
    `${baseurl}chat/group/create`,
    {
      userId,
      name,
      memberIds: Array.isArray(memberIds) ? memberIds : [],
    },
    { headers: authHeaders() },
  );
  return unwrap(response) || response.data;
};

/** POST /chat/group/remove-member */
export const removeGroupMember = async ({
  chatId,
  memberId,
  userId = crmUserId(),
}) => {
  const response = await axios.post(
    `${baseurl}chat/group/remove-member`,
    { userId, chatId, memberId: String(memberId) },
    { headers: authHeaders() },
  );
  return unwrap(response) || response.data;
};

/** POST /chat/mark-read */
export const markChatReadRest = async (chatId, userId = crmUserId()) => {
  const response = await axios.post(
    `${baseurl}chat/mark-read`,
    { userId, chatId },
    { headers: authHeaders() },
  );
  return unwrap(response) || response.data;
};

/** POST /chat/group/add-member */
export const addGroupMembers = async ({
  chatId,
  memberIds,
  userId = crmUserId(),
}) => {
  const response = await axios.post(
    `${baseurl}chat/group/add-member`,
    {
      userId: String(userId),
      chatId: String(chatId),
      memberIds: Array.isArray(memberIds)
        ? memberIds.map(String)
        : [String(memberIds)],
    },
    { headers: authHeaders() },
  );
  return unwrap(response) || response.data;
};

/** GET /chat/users?search=&type=&page=&limit= */
export const fetchChatUsers = async ({
  search = "",
  type = "all",
  page = 1,
  limit = 50,
} = {}) => {
  try {
    const params = { page, limit };
    if (search && search.trim()) params.search = search.trim();
    if (type && type !== "all") params.type = type;
    else if (type === "all") params.type = "all";

    const response = await axios.get(`${baseurl}chat/users`, {
      params,
      headers: authHeaders(),
    });
    const data = unwrap(response);
    const rawList =
      (Array.isArray(data) ? data : null) ||
      (Array.isArray(response?.data?.data) ? response.data.data : null) ||
      data?.users ||
      data?.list ||
      data?.data ||
      data?.details ||
      data?.patients ||
      (Array.isArray(response?.data) ? response.data : null) ||
      [];

    const list = Array.isArray(rawList) ? rawList : [];
    const mapped = list
      .map((u) => {
        const uid = String(u.userId || u.user_id || u._id || u.id || "");
        const role =
          u.role ||
          (u.userType === "patient"
            ? "Patient"
            : u.userType === "staff"
              ? "Staff"
              : "User");
        const userType =
          u.userType ||
          (String(role).toLowerCase() === "patient" ? "patient" : "staff");
        const isOnline = Boolean(u.isOnline ?? (u.status === "online"));
        return {
          userId: uid,
          name:
            u.name ||
            u.patient_name ||
            u.fullname ||
            u.username ||
            u.enq_userName ||
            `User ${uid}`,
          email: u.email || "",
          phone: u.phone || u.mobile || u.contact_no || "",
          image: u.profileImage || u.profile_image || u.image || null,
          role,
          userType,
          db: u.db || null,
          patientId: u.patientId || u.user_id || null,
          isOnline,
          status: u.status || (isOnline ? "online" : "offline"),
          lastActivity: u.lastActivity || null,
        };
      })
      .filter((m) => m.userId && m.userId !== "undefined" && m.userId !== "null");

    const paginationMeta = response?.data?.pagination || {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      total: response?.data?.count ?? mapped.length,
    };
    const totalCount = Number(response?.data?.count ?? paginationMeta.total ?? mapped.length);
    const totalPages = paginationMeta.totalPages || Math.ceil(totalCount / limit);
    const hasMore = totalPages ? Number(paginationMeta.page || page) < totalPages : mapped.length >= limit;

    mapped.pagination = {
      ...paginationMeta,
      page: Number(paginationMeta.page || page),
      limit: Number(paginationMeta.limit || limit),
      total: totalCount,
      totalPages,
      hasMore,
    };
    mapped.count = totalCount;

    return mapped;
  } catch (err) {
    console.error("GET /chat/users notice:", err);
    return fetchPotentialMembers(typeof search === "string" ? search : "");
  }
};

/** Helper to fetch potential group members (patients / staff) */
export const fetchPotentialMembers = async (search = "") => {
  try {
    const res = await axios.get(`${baseurl}all_patients`, {
      params: { page: 1, limit: 50, search: search || "" },
      headers: authHeaders(),
    });
    const details =
      res.data?.Details ||
      res.data?.details ||
      res.data?.data?.details ||
      res.data?.patients ||
      res.data?.data?.patients ||
      (Array.isArray(res.data?.data) ? res.data.data : []) ||
      (Array.isArray(res.data) ? res.data : []);

    const list = Array.isArray(details) ? details : [];
    return list
      .map((p) => {
        const uid = String(p.user_id || p.userId || p._id || "");
        return {
          userId: uid,
          name: p.patient_name || p.name || `Patient ${uid}`,
          email: p.email || "",
          phone: p.mobile || p.phone || "",
          image: p.profile_image || p.image || null,
          role: "Patient",
        };
      })
      .filter((m) => m.userId && m.userId !== "undefined" && m.userId !== "null");
  } catch (err) {
    console.error("Failed to fetch potential members:", err);
    return [];
  }
};
