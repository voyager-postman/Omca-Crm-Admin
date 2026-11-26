import axios from "axios";
import { AdminBaseUrl, baseurl } from "../Basurl/Baseurl";
import {
  isReferralUser,
  getReferralMysqlId,
  isInsuranceUser,
  getInsuranceMysqlId,
} from "../utils/authStorage";

const API_BASE = baseurl.endsWith("/") ? baseurl : `${baseurl}/`;

export const UNREAD_REFRESH_EVENT = "omca-unread-refresh";
export const OTHER_ENQUIRY_COUNTS_EVENT = "omca-other-enquiry-counts";

export const normalizeOtherEnquiryUnread = (unreadCount) => ({
  air_ambulance: Number(unreadCount?.air_ambulance) || 0,
  get_treatment_estimate: Number(unreadCount?.get_treatment_estimate) || 0,
  ambulance_requests: Number(unreadCount?.ambulance_requests) || 0,
});

export const sumOtherEnquiryUnread = (unreadCount) => {
  const counts = normalizeOtherEnquiryUnread(unreadCount);
  return (
    counts.air_ambulance +
    counts.get_treatment_estimate +
    counts.ambulance_requests
  );
};

const OTHER_ENQUIRY_CACHE_KEY = "otherEnquiryUnread";

export const getCachedOtherEnquiryUnread = () => {
  try {
    const cached = JSON.parse(
      localStorage.getItem(OTHER_ENQUIRY_CACHE_KEY) || "null",
    );
    return cached ? normalizeOtherEnquiryUnread(cached) : null;
  } catch {
    return null;
  }
};

export const publishOtherEnquiryUnread = (unreadCount) => {
  const detail = normalizeOtherEnquiryUnread(unreadCount);
  localStorage.setItem(OTHER_ENQUIRY_CACHE_KEY, JSON.stringify(detail));
  window.dispatchEvent(
    new CustomEvent(OTHER_ENQUIRY_COUNTS_EVENT, { detail }),
  );
};

export const GENERAL_ENQUIRY_COUNTS_EVENT = "omca-general-enquiry-counts";
const GENERAL_ENQUIRY_CACHE_KEY = "generalEnquiryUnread";
export const GENERAL_ENQUIRY_UNREAD_KEYS = [
  "medical_visa",
  // "stay", // Guest House/Stay tab is commented out
  "flight",
  "pickup",
  "home_care",
  "test_form",
  "contact_us",
];

export const getRawCachedGeneralEnquiryUnread = () => {
  try {
    const raw = localStorage.getItem(GENERAL_ENQUIRY_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const normalizeGeneralEnquiryUnread = (unreadCount) => {
  const cached = getRawCachedGeneralEnquiryUnread() || {};
  const base = GENERAL_ENQUIRY_UNREAD_KEYS.reduce((acc, key) => {
    acc[key] = Number(
      unreadCount?.[key] !== undefined
        ? unreadCount[key]
        : (cached[key] || 0)
    ) || 0;
    return acc;
  }, {});

  if (unreadCount?.app_pickup !== undefined) {
    base.app_pickup = Number(unreadCount.app_pickup) || 0;
  } else if (unreadCount?.pickup !== undefined && unreadCount?.portal_pickup !== undefined) {
    base.app_pickup = Math.max(
      0,
      (Number(unreadCount.pickup) || 0) - (Number(unreadCount.portal_pickup) || 0)
    );
  } else if (unreadCount?.pickup !== undefined) {
    base.app_pickup = Number(unreadCount.pickup) || 0;
  } else {
    base.app_pickup = Number(cached.app_pickup ?? cached.pickup ?? 0) || 0;
  }

  if (unreadCount?.portal_pickup !== undefined) {
    base.portal_pickup = Number(unreadCount.portal_pickup) || 0;
  } else {
    base.portal_pickup = Number(cached.portal_pickup || 0);
  }

  base.pickup = base.app_pickup + base.portal_pickup;
  return base;
};

export const sumGeneralEnquiryUnread = (unreadCount) => {
  const counts = normalizeGeneralEnquiryUnread(unreadCount);
  return GENERAL_ENQUIRY_UNREAD_KEYS.reduce((sum, key) => sum + counts[key], 0);
};

export const getCachedGeneralEnquiryUnread = () => {
  try {
    const raw = localStorage.getItem(GENERAL_ENQUIRY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed ? normalizeGeneralEnquiryUnread(parsed) : null;
  } catch {
    return null;
  }
};

export const publishGeneralEnquiryUnread = (unreadCount) => {
  const detail = normalizeGeneralEnquiryUnread(unreadCount);
  localStorage.setItem(GENERAL_ENQUIRY_CACHE_KEY, JSON.stringify(detail));
  window.dispatchEvent(
    new CustomEvent(GENERAL_ENQUIRY_COUNTS_EVENT, { detail }),
  );
};

export const fetchPickDropPortalUnread = async () => {
  const token = getToken();
  if (!token) return 0;
  try {
    const response = await axios.get(
      `${baseurl}get_pick_drop_appointments?limit=10`,
      { headers: getAuthHeaders() },
    );
    const body = response?.data || {};
    const list = Array.isArray(body.data) ? body.data : [];
    const count = Number(
      body.unreadCount ??
        body.counts?.unread ??
        list.filter(
          (item) =>
            item?.isUnread === true ||
            item?.is_seen === 0 ||
            item?.is_seen === "0" ||
            item?.is_read === 0 ||
            item?.is_read === "0" ||
            item?.isRead === false,
        ).length,
    );
    return count;
  } catch (err) {
    return 0;
  }
};

let inFlightGeneralEnquiryUnreadPromise = null;
let lastGeneralEnquiryUnreadFetchTime = 0;
let cachedGeneralEnquiryUnreadMemory = null;
let generalEnquiry429BackoffUntil = 0;

export const fetchGeneralEnquiryUnread = async (force = false) => {
  if (Date.now() < generalEnquiry429BackoffUntil) {
    return cachedGeneralEnquiryUnreadMemory || getCachedGeneralEnquiryUnread();
  }
  if (!force && cachedGeneralEnquiryUnreadMemory && Date.now() - lastGeneralEnquiryUnreadFetchTime < 15000) {
    return cachedGeneralEnquiryUnreadMemory;
  }
  if (inFlightGeneralEnquiryUnreadPromise) {
    return inFlightGeneralEnquiryUnreadPromise;
  }

  inFlightGeneralEnquiryUnreadPromise = (async () => {
    try {
      const cached = getRawCachedGeneralEnquiryUnread() || {};
      let payload = {};
      if (isReferralUser()) {
        const mysqlId = getReferralMysqlId();
        payload = {
          user_id:
            mysqlId != null
              ? !isNaN(Number(mysqlId))
                ? Number(mysqlId)
                : mysqlId
              : undefined,
          type: "referral",
        };
      } else if (isInsuranceUser()) {
        const mysqlId = getInsuranceMysqlId();
        payload = {
          user_id:
            mysqlId != null
              ? !isNaN(Number(mysqlId))
                ? Number(mysqlId)
                : mysqlId
              : undefined,
          type: "insurance",
        };
      }
      const token = localStorage.getItem("token");
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const [appRes, portalUnread] = await Promise.allSettled([
        axios.post(`${AdminBaseUrl}user_requests_via_app`, payload, { headers }),
        fetchPickDropPortalUnread(),
      ]);

      const appUnread =
        appRes.status === "fulfilled" && appRes.value.data?.unreadCount
          ? appRes.value.data.unreadCount
          : {};

      if (appRes.status === "rejected" && appRes.reason?.response?.status === 429) {
        generalEnquiry429BackoffUntil = Date.now() + 60000;
      }

      const portalCount =
        portalUnread.status === "fulfilled"
          ? Number(portalUnread.value) || 0
          : Number(cached.portal_pickup || 0);

      const appPickup = Number(
        appUnread?.app_pickup ?? appUnread?.pickup ?? cached.app_pickup ?? 0
      );
      const combinedPickup = appPickup + portalCount;

      const unreadCount = {
        ...cached,
        ...appUnread,
        app_pickup: appPickup,
        portal_pickup: portalCount,
        pickup: combinedPickup,
      };

      publishGeneralEnquiryUnread(unreadCount);
      const normalized = normalizeGeneralEnquiryUnread(unreadCount);
      cachedGeneralEnquiryUnreadMemory = normalized;
      lastGeneralEnquiryUnreadFetchTime = Date.now();
      return normalized;
    } catch (err) {
      if (err?.response?.status === 429) {
        generalEnquiry429BackoffUntil = Date.now() + 60000;
      }
      console.error("Error fetching general enquiry unread:", err);
      return cachedGeneralEnquiryUnreadMemory || getCachedGeneralEnquiryUnread();
    } finally {
      inFlightGeneralEnquiryUnreadPromise = null;
    }
  })();

  return inFlightGeneralEnquiryUnreadPromise;
};

const pendingRequestReads = new Set();

export const markRequestRead = async (model, id) => {
  if (!model || id === undefined || id === null || id === "") return false;
  const key = `${model}:${id}`;
  if (pendingRequestReads.has(key)) return false;
  pendingRequestReads.add(key);
  try {
    const response = await axios.post(
      `${AdminBaseUrl}requests/mark-read`,
      { model, id: Number(id) || id },
      { headers: { "Content-Type": "application/json" } },
    );
    const success = String(response.data?.success) === "true";
    if (success) {
      window.dispatchEvent(new CustomEvent(UNREAD_REFRESH_EVENT));
    }
    return success;
  } catch (err) {
    console.error("Error marking request as read:", err);
    return false;
  } finally {
    pendingRequestReads.delete(key);
  }
};

export const SIDEBAR_COUNT_KEY = {
  "/Admin/Inquiry": "enquiries",
  "/Admin/General_Enquiries": "generalEnquiries",
  "/Admin/patients": "patients",
  "/Admin/patient-travel": "patientTravel",
  "/Admin/physiotherapy": "physiotherapy",
  "/Admin/Appointments": "appointments",
  "/Admin/orders": "orders",
  "/Admin/messages": "messages",
  "/Admin/director-messages": "directorMessages",
  "/Admin/referrals": "referrals",
  "/Admin/insurances": "insurances",
  "/Admin/Staff": "staff",
};

const READ_MODULES = new Set([
  "enquiries",
  "generalEnquiries",
  "pickup",
  "patients",
  "patientTravel",
  "physiotherapy",
  "appointments",
  "orders",
  "services",
  "referrals",
  "insurances",
  "staff",
]);

const PATIENT_TAB_MODULES = {
  physiotherapy: "physiotherapy",
  "guest-house": "guestHouseServices",
  guest_house: "guestHouseServices",
};

const recentMarks = new Set();

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const getAuthHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
  };
};

export const pickPatientRecordId = (...candidates) => {
  const values = candidates
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return values.find((value) => /^OMCA/i.test(value)) || values[0] || "";
};

export const patientTabReadModule = (tab) => PATIENT_TAB_MODULES[tab] || "";

export const UNREAD_COUNTS_CACHE_KEY = "omca_admin_unread_counts";

export const getCachedUnreadCounts = () => {
  try {
    const raw = localStorage.getItem(UNREAD_COUNTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let inFlightUnreadCountsPromise = null;
let lastUnreadCountsFetchTime = 0;
let cachedUnreadCountsMemory = null;

export const fetchUnreadCounts = async (force = false) => {
  const token = getToken();
  if (!token) return null;

  // 10-second memory TTL cache unless forced
  if (!force && cachedUnreadCountsMemory && Date.now() - lastUnreadCountsFetchTime < 10000) {
    return cachedUnreadCountsMemory;
  }

  // Deduplicate in-flight requests (so Sidebar and Inquiry don't fire duplicate concurrent calls)
  if (inFlightUnreadCountsPromise) {
    return inFlightUnreadCountsPromise;
  }

  inFlightUnreadCountsPromise = (async () => {
    try {
      const response = await axios.get(`${API_BASE}admin/unread-counts`, {
        headers: getAuthHeaders(),
      });
      const data = response.data;
      if (data?.success && data?.counts) {
        cachedUnreadCountsMemory = data;
        lastUnreadCountsFetchTime = Date.now();
        try {
          localStorage.setItem(UNREAD_COUNTS_CACHE_KEY, JSON.stringify(data.counts));
        } catch (_) {}
      }
      return data;
    } catch (err) {
      console.warn("Error fetching unread counts:", err?.message || err);
      // Return cached counts if server is slow or fails
      const cached = getCachedUnreadCounts();
      if (cached) {
        return { success: true, counts: cached };
      }
      throw err;
    } finally {
      inFlightUnreadCountsPromise = null;
    }
  })();

  return inFlightUnreadCountsPromise;
};

let inFlightOtherEnquiryUnreadPromise = null;
let lastOtherEnquiryUnreadFetchTime = 0;
let cachedOtherEnquiryUnreadMemory = null;
let otherEnquiry429BackoffUntil = 0;

export const fetchOtherEnquiryUnread = async (force = false) => {
  const token = getToken();
  if (!token) return null;

  if (Date.now() < otherEnquiry429BackoffUntil) {
    return cachedOtherEnquiryUnreadMemory || getCachedOtherEnquiryUnread();
  }
  if (!force && cachedOtherEnquiryUnreadMemory && Date.now() - lastOtherEnquiryUnreadFetchTime < 15000) {
    return cachedOtherEnquiryUnreadMemory;
  }
  if (inFlightOtherEnquiryUnreadPromise) {
    return inFlightOtherEnquiryUnreadPromise;
  }

  inFlightOtherEnquiryUnreadPromise = (async () => {
    try {
      const idsResponse = await axios.get(`${API_BASE}get_patient_user_ids`, {
        headers: getAuthHeaders(),
      });
      if (!idsResponse.data?.success) return cachedOtherEnquiryUnreadMemory || getCachedOtherEnquiryUnread();

      const response = await axios.post(`${AdminBaseUrl}other_enquiry_requests`, {
        user_ids: idsResponse.data.user_ids,
        accessCountries: idsResponse.data.accessCountries,
        roleStatuses: idsResponse.data.roleStatuses,
        is_admin: localStorage.getItem("Role") === "Admin" ? 1 : 0,
      });

      const unreadCount = response.data?.unreadCount;
      if (!unreadCount || typeof unreadCount !== "object") {
        return cachedOtherEnquiryUnreadMemory || getCachedOtherEnquiryUnread();
      }

      publishOtherEnquiryUnread(unreadCount);
      const normalized = normalizeOtherEnquiryUnread(unreadCount);
      cachedOtherEnquiryUnreadMemory = normalized;
      lastOtherEnquiryUnreadFetchTime = Date.now();
      return normalized;
    } catch (err) {
      if (err?.response?.status === 429) {
        otherEnquiry429BackoffUntil = Date.now() + 60000;
      }
      return cachedOtherEnquiryUnreadMemory || getCachedOtherEnquiryUnread();
    } finally {
      inFlightOtherEnquiryUnreadPromise = null;
    }
  })();

  return inFlightOtherEnquiryUnreadPromise;
};

export const markRecordRead = async (moduleName, recordId) => {
  if (Array.isArray(recordId)) {
    return markMultipleRecordsRead(moduleName, recordId);
  }
  const id = String(recordId || "").trim();
  const token = getToken();
  if (!READ_MODULES.has(moduleName) || !id || !token) return;
  const key = `${moduleName}:${id}`;
  if (recentMarks.has(key)) return;
  recentMarks.add(key);
  window.setTimeout(() => recentMarks.delete(key), 4000);

  if (moduleName === "patients") {
    markPatientSeenLocally(id);
  }

  try {
    await axios.post(
      `${API_BASE}admin/mark-read`,
      { module: moduleName, recordId: id },
      { headers: getAuthHeaders() },
    );
    // Invalidate memory cache so next fetch retrieves fresh counts
    lastUnreadCountsFetchTime = 0;
    cachedUnreadCountsMemory = null;
    window.dispatchEvent(new CustomEvent(UNREAD_REFRESH_EVENT));
  } catch (err) {
    recentMarks.delete(key);
    console.error("Error marking as read:", err);
  }
};

export const markMultipleRecordsRead = async (moduleName, recordIds = []) => {
  const ids = (Array.isArray(recordIds) ? recordIds : [recordIds])
    .flat()
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  if (ids.length === 0) return;
  const token = getToken();
  if (!READ_MODULES.has(moduleName) || !token) return;

  if (moduleName === "patients") {
    markPatientSeenLocally(ids);
  }

  try {
    await Promise.allSettled(
      ids.map((id) => {
        const key = `${moduleName}:${id}`;
        if (recentMarks.has(key)) return Promise.resolve();
        recentMarks.add(key);
        window.setTimeout(() => recentMarks.delete(key), 4000);
        return axios.post(
          `${API_BASE}admin/mark-read`,
          { module: moduleName, recordId: id },
          { headers: getAuthHeaders() },
        );
      }),
    );
    lastUnreadCountsFetchTime = 0;
    cachedUnreadCountsMemory = null;
    window.dispatchEvent(new CustomEvent(UNREAD_REFRESH_EVENT));
  } catch (err) {
    console.error("Error in markMultipleRecordsRead:", err);
  }
};

export const SEEN_PATIENTS_STORAGE_KEY = "omca_seen_patients";

export const getSeenPatientMap = () => {
  try {
    const raw = localStorage.getItem(SEEN_PATIENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const map = {};
      parsed.forEach((id) => {
        if (id) map[String(id).trim()] = Date.now();
      });
      return map;
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const markPatientSeenLocally = (...ids) => {
  const validIds = ids
    .flat()
    .filter(Boolean)
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (validIds.length === 0) return;

  try {
    const map = getSeenPatientMap();
    const now = Date.now();
    validIds.forEach((id) => {
      map[id] = now;
    });
    localStorage.setItem(SEEN_PATIENTS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Could not save seen patient ID:", e);
  }
};

export const isPatientSeenLocally = (item) => {
  if (!item) return false;
  try {
    const map = getSeenPatientMap();
    if (typeof item === "string" || typeof item === "number") {
      return Boolean(map[String(item).trim()]);
    }
    const candidates = [
      item.patientId,
      item.patientNumber,
      item.id,
      item._id,
      item.enquiryId,
      item.lastTreatmentPlan?.treatmentPlanId,
      item.lastTreatmentPlan?.patientId,
    ]
      .filter(Boolean)
      .map((v) => String(v).trim());

    for (const c of candidates) {
      if (map[c]) {
        const seenAt = typeof map[c] === "number" ? map[c] : 0;
        const activityRaw =
          item.lastActivityAt ||
          item.lastTreatmentPlan?.updatedAt ||
          item.updatedAt;
        if (activityRaw && seenAt > 0) {
          const actTs = new Date(activityRaw).getTime();
          if (!isNaN(actTs) && actTs > seenAt) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
};
