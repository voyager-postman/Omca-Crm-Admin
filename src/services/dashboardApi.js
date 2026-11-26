import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

/** CRM API root: https://mobappssolutiondevelopment.com/omca_crm/api/crm/ */
const crmBase = `${baseurl}crm/`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

/** Resolve `/api/crm/...` or `dashboard/...` to full CRM base URL */
export const resolveCrmEndpoint = (endpoint) => {
  if (!endpoint) return "";
  if (endpoint.startsWith("http")) return endpoint;
  if (
    endpoint.startsWith("user/") ||
    endpoint.startsWith("/user/") ||
    endpoint.startsWith("api/user/") ||
    endpoint.startsWith("/api/user/") ||
    endpoint.startsWith("get_travel_patients") ||
    endpoint.startsWith("/get_travel_patients") ||
    endpoint.startsWith("api/get_travel_patients") ||
    endpoint.startsWith("/api/get_travel_patients")
  ) {
    const path = endpoint
      .replace(/^\/api\/user\//, "")
      .replace(/^\/user\//, "")
      .replace(/^user\//, "")
      .replace(/^\/api\/get_travel_patients/, "get_travel_patients")
      .replace(/^\/get_travel_patients/, "get_travel_patients")
      .replace(/^api\/get_travel_patients/, "get_travel_patients")
      .replace(/^\//, "");
    if (path.startsWith("get_travel_patients")) {
      return `${baseurl}${path}`;
    }
    return `${baseurl}user/${path}`;
  }
  const path = endpoint
    .replace(/^\/api\/crm\//, "")
    .replace(/^\/crm\//, "")
    .replace(/^crm\//, "")
    .replace(/^\//, "");
  return `${crmBase}${path}`;
};

/** GET /crm/dashboard — full dashboard payload (includes popupAlerts and paginated patientAging) */
export const fetchDashboard = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page != null) query.append("page", params.page);
  if (params.limit != null) query.append("limit", params.limit);
  if (params.stage) query.append("stage", params.stage);
  if (params.agingLimit) query.append("agingLimit", params.agingLimit);
  const qs = query.toString() ? `?${query.toString()}` : "";

  const response = await axios.get(`${crmBase}dashboard${qs}`, {
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load dashboard");
  }
  const data = unwrap(response) ?? body;
  const popupAlerts = Array.isArray(data?.popupAlerts)
    ? data.popupAlerts.filter((alert) => !isPopupDismissed(alert))
    : [];
  return { ...data, popupAlerts };
};

/** GET /crm/dashboard/summary — morning priorities, daily summary & popup alerts */
export const fetchDashboardSummary = async () => {
  const response = await axios.get(`${crmBase}dashboard/summary`, {
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load dashboard summary");
  }
  const data = unwrap(response) ?? body;
  const popupAlerts = Array.isArray(data?.popupAlerts)
    ? data.popupAlerts.filter((alert) => !isPopupDismissed(alert))
    : [];
  return { ...data, popupAlerts };
};

/** GET /crm/dashboard/today-work — today's work and targets */
export const fetchTodayWork = async () => {
  const response = await axios.get(`${crmBase}dashboard/today-work`, {
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load today work");
  }
  return unwrap(response) ?? body;
};

// Cache whether the dedicated /crm/dashboard/patient-aging endpoint exists to avoid repetitive 404s
let isPatientAgingDedicatedSupported = null;

/**
 * GET /crm/dashboard/patient-aging — paginated patient aging monitor
 * Query params: { page = 1, limit = 10, stage, status, priority, search, sortBy, agingLimit }
 */
export const fetchPatientAging = async ({
  page = 1,
  limit = 10,
  stage,
  status,
  priority,
  search,
  sortBy,
  agingLimit,
} = {}) => {
  const query = new URLSearchParams();
  if (agingLimit) {
    query.append("agingLimit", agingLimit);
  } else {
    if (page != null) query.append("page", page);
    if (limit != null) query.append("limit", limit);
  }
  if (stage && stage !== "All Stages") {
    query.append("stage", stage);
  }
  if (status && status !== "All Statuses") {
    query.append("status", status);
  }
  if (priority && priority !== "All Priorities") {
    query.append("priority", priority);
  }
  if (search && String(search).trim()) {
    query.append("search", String(search).trim());
  }
  if (sortBy) {
    query.append("sortBy", sortBy);
  }
  const qs = query.toString() ? `?${query.toString()}` : "";

  // If already known that dedicated endpoint returns 404, query dashboard endpoint directly
  if (isPatientAgingDedicatedSupported === false) {
    const fallbackRes = await axios.get(`${crmBase}dashboard${qs}`, {
      headers: authHeaders(),
    });
    const data = unwrap(fallbackRes) ?? fallbackRes.data;
    return data?.patientAging ?? data;
  }

  try {
    const response = await axios.get(`${crmBase}dashboard/patient-aging${qs}`, {
      headers: authHeaders(),
    });
    const body = response.data;
    if (body?.success === false) {
      throw new Error(body?.message || "Failed to load patient aging data");
    }
    isPatientAgingDedicatedSupported = true;
    if (body && typeof body === "object") {
      if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
        return { ...body, ...body.data };
      }
      return body;
    }
    return unwrap(response) ?? body;
  } catch (err) {
    if (err.response?.status === 404) {
      isPatientAgingDedicatedSupported = false;
      const fallbackRes = await axios.get(`${crmBase}dashboard${qs}`, {
        headers: authHeaders(),
      });
      const data = unwrap(fallbackRes) ?? fallbackRes.data;
      return data?.patientAging ?? data;
    }
    throw err;
  }
};

/** GET /crm/dashboard/daily-summary — morning priority counts */
export const fetchDailySummary = async () => {
  const response = await axios.get(`${crmBase}dashboard/daily-summary`, {
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load daily summary");
  }
  const payload = unwrap(response) ?? body;
  const items = payload?.items ?? {};
  return {
    title: payload?.title ?? "Today's Priorities",
    generatedAt: payload?.generatedAt,
    showFrom: payload?.showFrom ?? "09:00",
    newEnquiries: items.newEnquiriesToday ?? items.newEnquiries ?? 0,
    treatmentPlansPending: items.treatmentPlansPending ?? 0,
    followupsDue:
      items.followupsDueToday ??
      items.followUpsDueToday ??
      items.followupsDue ??
      items.followUpsDue ??
      0,
    doctorReviewsPending: items.doctorReviewsPending ?? 0,
    patientsTravellingToday: items.patientsTravellingToday ?? 0,
    overdueCases: items.overdueCases ?? 0,
    arrivingToday: items.arrivingToday ?? payload?.arrivingToday ?? items.arriving ?? payload?.arriving ?? 0,
    departingToday: items.departingToday ?? payload?.departingToday ?? items.departing ?? payload?.departing ?? 0,
    preponedToday: items.preponedToday ?? payload?.preponedToday ?? items.preponed ?? payload?.preponed ?? 0,
    postponedToday: items.postponedToday ?? payload?.postponedToday ?? items.postponed ?? payload?.postponed ?? 0,
  };
};

/** GET any case-list / drill-down endpoint with pagination support */
export const fetchCaseList = async (endpoint, params = {}) => {
  const url = resolveCrmEndpoint(endpoint);

  const [baseUrl, existingQs] = url.split("?");
  const query = new URLSearchParams(existingQs || "");

  if (params.page != null) query.set("page", params.page);
  const resolvedLimit =
    params.limit != null ? params.limit : (params.page != null ? 10 : null);
  if (resolvedLimit != null) query.set("limit", resolvedLimit);
  if (params.today != null) query.set("today", params.today);
  if (params.stage != null) query.set("stage", params.stage);

  const qs = query.toString();
  const fullUrl = qs ? `${baseUrl}?${qs}` : baseUrl;

  const response = await axios.get(fullUrl, { headers: authHeaders() });
  const body = response.data;
  if (Array.isArray(body)) {
    return {
      count: body.length,
      total: body.length,
      page: 1,
      totalPages: 1,
      limit: body.length,
      hasPrevPage: false,
      hasNextPage: false,
      data: body,
    };
  }

  const inner = unwrap(response) ?? body;
  const list = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(inner?.data)
    ? inner.data
    : Array.isArray(inner)
    ? inner
    : [];

  const pagination = body?.pagination || inner?.pagination || {};
  const total =
    pagination.total ??
    body?.total ??
    inner?.total ??
    body?.count ??
    list.length;
  const page = Number(pagination.page ?? body?.page ?? inner?.page ?? params.page ?? 1);
  const limit = Number(pagination.limit ?? body?.limit ?? inner?.limit ?? params.limit ?? 20);
  const totalPages = Number(
    pagination.totalPages ??
    body?.totalPages ??
    inner?.totalPages ??
    Math.max(1, Math.ceil(total / (limit || 20)))
  );
  const hasPrevPage = Boolean(
    pagination.hasPrevPage ??
    body?.hasPrevPage ??
    inner?.hasPrevPage ??
    page > 1
  );
  const hasNextPage = Boolean(
    pagination.hasNextPage ??
    body?.hasNextPage ??
    inner?.hasNextPage ??
    page < totalPages
  );

  return {
    count: list.length,
    total,
    page,
    limit,
    totalPages,
    hasPrevPage,
    hasNextPage,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasPrevPage,
      hasNextPage,
    },
    data: list,
  };
};

const DISMISSED_POPUPS_KEY = "crm_dismissed_popup_alerts";

/** Encode MongoDB id for CRM URL path segments */
export const encodeCrmPathId = (id) => encodeURIComponent(String(id));

/** MongoDB document id — use for all notification/popup API paths (not alertKey) */
const resolveMongoId = (item) => {
  if (item == null || typeof item !== "object") return null;
  const key = item.id ?? item._id ?? item.notificationId ?? item.alertId ?? null;
  return key != null ? String(key) : null;
};

export const getPopupAlertId = (alert) => resolveMongoId(alert);

export const getDismissedPopupIds = () => {
  try {
    const raw = sessionStorage.getItem(DISMISSED_POPUPS_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const rememberDismissedPopup = (id) => {
  if (id == null || id === "") return;
  const key = String(id);
  const existing = getDismissedPopupIds();
  if (!existing.includes(key)) {
    sessionStorage.setItem(
      DISMISSED_POPUPS_KEY,
      JSON.stringify([...existing, key]),
    );
  }
};

export const rememberDismissedPopups = (ids = []) => {
  const existing = getDismissedPopupIds();
  const merged = [...existing];
  ids.forEach((id) => {
    const key = String(id);
    if (id != null && id !== "" && !merged.includes(key)) {
      merged.push(key);
    }
  });
  sessionStorage.setItem(DISMISSED_POPUPS_KEY, JSON.stringify(merged));
};

export const isPopupDismissed = (alert) => {
  if (alert?.popupDismissed === true || alert?.popup_dismissed === true) {
    return true;
  }
  const id = getPopupAlertId(alert);
  return id ? getDismissedPopupIds().includes(id) : false;
};

/** GET /crm/alerts/popup */
export const fetchPopupAlerts = async () => {
  const response = await axios.get(`${crmBase}alerts/popup`, {
    headers: authHeaders(),
  });
  const body = response.data;
  const raw = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(unwrap(response))
      ? unwrap(response)
      : [];
  return raw.filter((alert) => !isPopupDismissed(alert));
};

/** PUT /crm/alerts/popup/:id/acknowledge */
export const acknowledgePopupAlert = async (id) => {
  const safeId = encodeCrmPathId(id);
  const response = await axios.put(
    `${crmBase}alerts/popup/${safeId}/acknowledge`,
    {},
    { headers: authHeaders() },
  );
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to dismiss popup");
  }
  return unwrap(response) ?? body?.data;
};

/** Acknowledge every popup alert (best-effort per item) */
export const acknowledgeAllPopupAlerts = async (alerts = []) => {
  if (!alerts.length) return { succeeded: [], failed: [] };

  const results = await Promise.allSettled(
    alerts.map((alert) => dismissPopupAlert(alert)),
  );

  const succeeded = [];
  const failed = [];
  results.forEach((result, index) => {
    const id = getPopupAlertId(alerts[index]);
    if (result.status === "fulfilled" && id) succeeded.push(id);
    else if (id) failed.push(id);
  });

  return { succeeded, failed };
};

/** GET /crm/notifications */
export const fetchNotifications = async ({
  page = 1,
  limit = 10,
  unseenOnly = false,
} = {}) => {
  const response = await axios.get(`${crmBase}notifications`, {
    headers: authHeaders(),
    params: { page, limit, unseenOnly: unseenOnly ? "true" : "false" },
  });
  const body = response.data;
  const payload = body?.data ?? unwrap(response) ?? body;
  return {
    page: payload?.page ?? page,
    limit: payload?.limit ?? limit,
    total: payload?.total ?? 0,
    unseenCount: payload?.unseenCount ?? 0,
    notifications: payload?.notifications ?? [],
  };
};

export const getNotificationId = (notification) => resolveMongoId(notification);

/** POST /crm/notifications/:id/seen — marks seen: true; notification stays in the list */
export const markNotificationSeen = async (id) => {
  const safeId = encodeCrmPathId(id);
  const response = await axios({
    method: "put",
    url: `${crmBase}notifications/${safeId}/seen`,
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to mark notification as read");
  }
  return unwrap(response) ?? body?.data;
};

/** PUT /crm/notifications/:id/dismiss — hides popup (popupDismissed: true); stays in notification list */
export const dismissNotification = async (id) => {
  const safeId = encodeCrmPathId(id);
  await axios.put(
    `${crmBase}notifications/${safeId}/dismiss`,
    {},
    { headers: authHeaders() },
  );
};

/** Close popup only — PUT /crm/alerts/popup/:id/acknowledge (does not mark as read) */
export const dismissPopupAlert = async (item = {}) => {
  const id = getPopupAlertId(item);
  if (!id) throw new Error("Missing popup alert id");

  await acknowledgePopupAlert(id);
  rememberDismissedPopup(id);
  return { kind: "popup", id, method: "acknowledge" };
};

/** POST /crm/notifications/seen-all */
export const markAllNotificationsSeen = async () => {
  const response = await axios({
    method: "post",
    url: `${crmBase}notifications/seen-all`,
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to mark all notifications as read");
  }
  return unwrap(response) ?? { modifiedCount: 0 };
};

/** Today's Work card → drill-down path (section 5) */
export const TODAY_WORK_ENDPOINTS = {
  newEnquiriesToday: "dashboard/new-enquiries-today",
  patientsContactedToday: "dashboard/patients-contacted-today",
  treatmentPlansIssuedToday: "dashboard/treatment-plans-issued-today",
  appointmentsScheduledToday: "dashboard/today-appointments",
  patientsTravellingToday: "dashboard/patients-travelling-today",
  followupsDueToday: "dashboard/followups-due-today",
};

export const PRIORITY_ENDPOINTS = {
  newEnquiries: "dashboard/new-enquiries",
  treatmentPlansPending: "dashboard/treatment-plan-pending?today=true",
  followupsDue: "dashboard/followups-due-today",
  followUpsDue: "dashboard/followups-due-today",
  doctorReviewsPending: "dashboard/doctor-review-pending?today=true",
  patientsTravellingToday: "dashboard/patients-travelling-today",
  overdueCases: "dashboard/overdue-cases",
  arrivingToday: "dashboard/patients-arriving-today",
  departingToday: "dashboard/patients-departing-today",
  preponedToday: "dashboard/patients-preponed-today",
  postponedToday: "dashboard/patients-postponed-today",
};

/**
 * GET /api/get_travel_patients?patientId=:patientId
 * Fetch full travel detail for a single patient.
 */
export const fetchTravelPatientDetail = async (patientId) => {
  if (!patientId) throw new Error("Patient ID is required");
  const response = await axios.get(
    `${baseurl}get_travel_patients`,
    {
      headers: authHeaders(),
      params: { patientId },
    },
  );
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load travel patient detail");
  }
  return unwrap(response) ?? body;
};

export const resolveRecordPath = (url) => {
  if (!url) return null;
  const patientMatch = url.match(/patient-details\/([^/?#]+)/i);
  if (patientMatch) return { type: "patient", id: patientMatch[1] };
  const enquiryMatch = url.match(/enquiry-details\/([^/?#]+)/i);
  if (enquiryMatch) return { type: "enquiry", id: enquiryMatch[1] };
  return null;
};

export const navigateToRecord = (navigate, row = {}) => {
  if (row.patientRecordUrl) {
    const resolved = resolveRecordPath(row.patientRecordUrl);
    if (resolved?.type === "patient") {
      navigate("/Admin/Patient-Detail", { state: { patientId: resolved.id } });
      return;
    }
    if (resolved?.type === "enquiry") {
      navigate("/Admin/Enquiry-Detail", {
        state: { enquiryId: resolved.id, id: resolved.id },
      });
      return;
    }
  }
  if (row.enquiryRecordUrl) {
    const resolved = resolveRecordPath(row.enquiryRecordUrl);
    if (resolved?.type === "enquiry") {
      navigate("/Admin/Enquiry-Detail", {
        state: { enquiryId: resolved.id, id: resolved.id },
      });
      return;
    }
  }
  if (row.enquiryId) {
    navigate("/Admin/Enquiry-Detail", {
      state: { enquiryId: row.enquiryId, id: row.enquiryId },
    });
    return;
  }
  if (row.patientId) {
    navigate("/Admin/Patient-Detail", { state: { patientId: row.patientId } });
  }
};

/** Convert hours to "X Hours" (<24) or "X Days" (>=24) */
export const formatHoursToHuman = (hours) => {
  const h = Number(hours);
  if (!Number.isFinite(h) || h < 0) return "—";
  if (h === 0) return "0 Hours";
  if (h < 24) return h === 1 ? "1 Hour" : `${Math.round(h)} Hours`;
  const days = Math.floor(h / 24);
  return days === 1 ? "1 Day" : `${days} Days`;
};

/** Parse hours from labels like "26 Hours", "5 Days", "10175 hrs" */
export const parseWaitingHoursFromString = (label = "") => {
  const str = String(label).trim();
  const dayMatch = str.match(/(\d+)\s*days?/i);
  if (dayMatch) return Number(dayMatch[1]) * 24;
  const hrMatch = str.match(/(\d+)\s*hrs?/i) || str.match(/(\d+)\s*hours?/i);
  if (hrMatch) return Number(hrMatch[1]);
  if (/^\d+$/.test(str)) return Number(str);
  return 0;
};

/**
 * Format waiting text/ranges for display.
 * e.g. "0 – 10175 hrs" → "0 Hours – 424 Days"
 */
export const formatWaitingDuration = (value) => {
  if (value == null || value === "" || value === "—") return "—";

  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    return formatHoursToHuman(Number(value));
  }

  const str = String(value).trim();

  // Range: "0 – 10175 hrs", "26 – 48 hrs"
  const rangeMatch = str.match(
    /^(\d+)\s*[–-]\s*(\d+)\s*(hrs?|hours?|days?)?$/i,
  );
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const unit = (rangeMatch[3] || "hrs").toLowerCase();
    if (unit.startsWith("day")) {
      return `${start} – ${end} ${end === 1 ? "Day" : "Days"}`;
    }
    return `${formatHoursToHuman(start)} – ${formatHoursToHuman(end)}`;
  }

  // "26 hours ago", "9838 hours ago"
  const agoMatch = str.match(/(\d+)\s*hours?\s*ago/i);
  if (agoMatch) {
    return str.replace(
      /(\d+)\s*hours?\s*ago/i,
      `${formatHoursToHuman(Number(agoMatch[1]))} ago`,
    );
  }

  // "Registered: 26 hours ago" embedded in multiline
  if (/\d+\s*hours?/i.test(str)) {
    return str.replace(/(\d+)\s*hours?/gi, (_, n) =>
      formatHoursToHuman(Number(n)),
    );
  }

  const daysOnly = str.match(/^(\d+)\s*days?$/i);
  if (daysOnly) {
    const d = Number(daysOnly[1]);
    return d === 1 ? "1 Day" : `${d} Days`;
  }

  const hrsOnly = str.match(/^(\d+)\s*hrs?$/i);
  if (hrsOnly) return formatHoursToHuman(Number(hrsOnly[1]));

  return str;
};

export const getWaitingHours = (row = {}) => {
  if (row.waitingHours != null && Number.isFinite(Number(row.waitingHours))) {
    return Number(row.waitingHours);
  }
  if (row.registeredHoursAgo != null) {
    return Number(row.registeredHoursAgo);
  }
  if (row.metadata?.registeredHoursAgo != null) {
    return Number(row.metadata.registeredHoursAgo);
  }
  return parseWaitingHoursFromString(row.waitingLabel);
};

export const priorityToUrgency = (priority = "") => {
  const p = String(priority).toLowerCase();
  if (p.includes("critical")) return "critical";
  if (p.includes("high")) return "high";
  if (p.includes("warning")) return "warning";
  return "normal";
};

export const severityToDot = (severity = "", dotColor = "") => {
  const color = String(dotColor).toLowerCase();
  if (color === "red") return "critical";
  if (color === "orange") return "high";
  if (color === "yellow") return "warning";
  if (color === "green") return "normal";
  const s = String(severity).toLowerCase();
  if (s === "critical") return "critical";
  if (s === "warning") return "high";
  if (s === "normal") return "warning";
  return "warning";
};

export const deptAccent = (id = "") => {
  const map = {
    call_center: "msd-dept-blue",
    medical_team: "msd-dept-teal",
    doctors: "msd-dept-purple",
    operations: "msd-dept-green",
  };
  return map[id] || "msd-dept-blue";
};

export const deptIcon = (icon = "") => {
  const map = {
    phone: "fa fa-phone",
    "medical-kit": "fa fa-medkit",
    stethoscope: "fa fa-stethoscope",
    plane: "fa fa-plane",
  };
  return map[icon] || `fa fa-${icon}` || "fa fa-building";
};

export const activityIcon = (icon = "") => {
  const map = {
    activity: "fa fa-history",
    "user-plus": "fa fa-user-plus",
    "medical-kit": "fa fa-medkit",
    medkit: "fa fa-medkit",
    phone: "fa fa-phone",
    plane: "fa fa-plane",
    calendar: "fa fa-calendar-check-o",
    check: "fa fa-check",
    "file-text-o": "fa fa-file-text-o",
    stethoscope: "fa fa-stethoscope",
    bell: "fa fa-bell",
    stinker: "fa fa-bell",
  };
  const key = String(icon).toLowerCase().trim();
  if (map[key]) return map[key];
  if (key.startsWith("fa ")) return key;
  return key ? `fa fa-${key}` : "fa fa-circle";
};

/** Format recent-activity time from API `time` or `performedAt` */
export const formatActivityTime = (item = {}) => {
  if (item?.time) return item.time;
  if (!item?.performedAt) return "";
  const date = new Date(item.performedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const agingToPriority = (row = {}) => {
  const color = row.agingColor || row.agingLevel;
  const map = {
    green: "normal",
    normal: "normal",
    yellow: "warning",
    warning: "warning",
    orange: "high",
    high_priority: "high",
    red: "critical",
    critical: "critical",
  };
  return map[color] || priorityToUrgency(row.priority);
};

/**
 * POST /crm/dashboard/update-patient-stage/:patientId
 * Body: { currentStage: "Waiting for Report" }
 */
export const updatePatientAgingStage = async (patientId, currentStage) => {
  if (!patientId) {
    throw new Error("Patient ID is required to update stage");
  }
  const response = await axios.post(
    `${crmBase}dashboard/update-patient-stage/${encodeURIComponent(patientId)}`,
    { currentStage },
    { headers: authHeaders() },
  );
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to update stage");
  }
  return body?.data ?? body;
};

/**
 * POST /api/add_patient_notes/:patientId
 * Body: { note: "Follow up call done", date: "2026-08-04" }
 */
export const addPatientNotes = async (patientId, { note, date }) => {
  if (!patientId) {
    throw new Error("Patient ID is required to add notes");
  }
  if (!note?.trim()) {
    throw new Error("Note is required");
  }
  if (!date) {
    throw new Error("Date is required");
  }
  const response = await axios.post(
    `${baseurl}add_patient_notes/${encodeURIComponent(patientId)}`,
    { note: note.trim(), date },
    { headers: authHeaders() },
  );
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to add notes");
  }
  return body?.data ?? body;
};

export const getPatientNoteId = (note) =>
  note?.id || note?._id || note?.noteId || note?.note_id || "";

/**
 * POST /api/update_notes/:patientId
 * Body: { id, note, date }
 */
export const updatePatientNotes = async (patientId, { id, note, date, index }) => {
  if (!patientId) {
    throw new Error("Patient ID is required to update notes");
  }
  if (!note?.trim()) {
    throw new Error("Note is required");
  }
  if (!date) {
    throw new Error("Date is required");
  }
  const payload = {
    id: id || "",
    note: note.trim(),
    date,
  };
  if (index !== undefined && index !== null) payload.index = index;
  const response = await axios.post(
    `${baseurl}update_notes/${encodeURIComponent(patientId)}`,
    payload,
    { headers: authHeaders() },
  );
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to update note");
  }
  return body?.data ?? body;
};

const isNotesApiSuccess = (body) => {
  if (!body || typeof body !== "object") return false;
  if (body.success === false || body.success === "false") return false;
  if (body.success === true || body.success === "true") return true;
  return Boolean(body.message || body.data || body.detail);
};

const replacePatientDiscussionNotes = async (patientId, remainingNotes) => {
  const notesJson = JSON.stringify(Array.isArray(remainingNotes) ? remainingNotes : []);
  const token = localStorage.getItem("token");
  const multipartHeaders = { Authorization: `Bearer ${token}` };
  const formData = new FormData();
  formData.append("discussionNotes", notesJson);
  formData.append("discussion_notes", notesJson);

  const putUrls = [
    `${baseurl}user/update_patient/${encodeURIComponent(patientId)}`,
    `${baseurl}update_patient/${encodeURIComponent(patientId)}`,
  ];
  for (const url of putUrls) {
    try {
      const response = await axios.put(url, formData, { headers: multipartHeaders });
      if (isNotesApiSuccess(response.data) || response.status < 300) {
        return response.data;
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status && status !== 404 && status !== 405) {
        /* try next */
      }
    }
  }

  const jsonPayload = {
    discussionNotes: remainingNotes,
    discussion_notes: remainingNotes,
    notes: remainingNotes,
  };
  const jsonUrls = [
    `${baseurl}update_notes/${encodeURIComponent(patientId)}`,
    `${baseurl}add_patient_notes/${encodeURIComponent(patientId)}`,
  ];
  for (const url of jsonUrls) {
    try {
      const response = await axios.post(url, jsonPayload, { headers: authHeaders() });
      if (isNotesApiSuccess(response.data) || response.status < 300) {
        return response.data;
      }
    } catch (err) {
      /* try next */
    }
  }
  throw new Error("Failed to delete note");
};

/**
 * Delete a patient discussion note, then persist remaining notes.
 */
export const deletePatientNotes = async (
  patientId,
  note,
  index,
  remainingNotes = [],
) => {
  if (!patientId) {
    throw new Error("Patient ID is required to delete notes");
  }
  const noteId = typeof note === "object" ? getPatientNoteId(note) : note;
  const headers = authHeaders();
  const encodedId = encodeURIComponent(patientId);
  const encodedNoteId = noteId ? encodeURIComponent(noteId) : "";

  const attempts = [];
  if (noteId) {
    attempts.push(() =>
      axios.delete(`${baseurl}delete_notes/${encodedId}/${encodedNoteId}`, { headers }),
    );
    attempts.push(() =>
      axios.delete(
        `${baseurl}delete_patient_notes/${encodedId}/${encodedNoteId}`,
        { headers },
      ),
    );
    attempts.push(() =>
      axios.delete(`${baseurl}add_patient_notes/${encodedId}/${encodedNoteId}`, {
        headers,
      }),
    );
    attempts.push(() =>
      axios.post(
        `${baseurl}delete_notes/${encodedId}`,
        { id: noteId, index },
        { headers },
      ),
    );
    attempts.push(() =>
      axios.post(
        `${baseurl}delete_patient_notes/${encodedId}`,
        { id: noteId, index },
        { headers },
      ),
    );
    attempts.push(() =>
      axios.post(
        `${baseurl}update_notes/${encodedId}`,
        { id: noteId, index, delete: true, isDelete: true },
        { headers },
      ),
    );
  }
  attempts.push(() =>
    axios.post(
      `${baseurl}delete_notes/${encodedId}`,
      { id: noteId || index, index },
      { headers },
    ),
  );

  for (const run of attempts) {
    try {
      const response = await run();
      if (isNotesApiSuccess(response.data)) {
        return response.data?.data ?? response.data;
      }
    } catch (err) {
      /* try remaining notes fallback */
    }
  }

  return replacePatientDiscussionNotes(patientId, remainingNotes);
};

export const pickEnquiryId = (record) => {
  if (!record || typeof record !== "object") return "";
  return (
    record.enquiryId ||
    record.enquiry_id ||
    record.EnquiryId ||
    (Array.isArray(record.enquiries) &&
      (record.enquiries[0]?.enquiryId || record.enquiries[0]?.id)) ||
    ""
  );
};

export const fetchEnquiryDetail = async (enquiryId) => {
  if (!enquiryId) return null;
  const response = await axios.get(
    `${baseurl}get_Enq/${encodeURIComponent(enquiryId)}`,
    { headers: authHeaders() },
  );
  return response.data?.detail || response.data?.data || null;
};

/**
 * Same API Enquiry Detail uses for notes add/edit/delete:
 * PUT /api/update_enq/:enquiryId with discussionNotes JSON.
 */
export const saveEnquiryDiscussionNotes = async (enquiryRow, updatedNotes) => {
  const targetId = pickEnquiryId(enquiryRow) || enquiryRow?.id;
  if (!targetId) throw new Error("Enquiry ID is missing");

  const row = enquiryRow || {};
  const formData = new FormData();
  const safeKeys = [
    "name",
    "email",
    "gender",
    "age",
    "country",
    "town",
    "address",
    "passport_num",
    "disease_name",
    "enq_status",
    "Referral_Name",
    "referral_id",
    "patient_relation",
    "patient_relation_name",
    "patient_relation_no",
    "patient_relation_address",
  ];
  safeKeys.forEach((key) => {
    if (row[key] !== undefined && row[key] !== null) {
      formData.append(key, row[key]);
    }
  });

  const phone =
    row.emergency_contact_no || row.phone || row.emergency_contact || "";
  if (phone) {
    formData.append("emergency_contact_no", phone);
    formData.append("phone", phone);
  }
  const phoneCode = row.phoneCode || row.dial_code || "";
  if (phoneCode) {
    formData.append("phoneCode", phoneCode);
    formData.append("dial_code", phoneCode);
  }
  const emergPhone =
    row.patient_emergency_contact_no || row.emergency_contact || "";
  if (emergPhone) {
    formData.append("patient_emergency_contact_no", emergPhone);
    formData.append("emergency_contact", emergPhone);
  }
  const emergDial =
    row.patient_emergency_dial_code ||
    row.emergency_dial_code ||
    phoneCode ||
    "";
  if (emergDial) {
    formData.append("patient_emergency_dial_code", emergDial);
    formData.append("emergency_dial_code", emergDial);
  }

  const treatingIn = Array.isArray(row.treatingIn)
    ? row.treatingIn
    : row.treatingIn
      ? [row.treatingIn]
      : row.treating_in_country
        ? [row.treating_in_country]
        : [];
  formData.append("treatingIn", JSON.stringify(treatingIn));

  const notesJson = JSON.stringify(updatedNotes || []);
  formData.append("discussionNotes", notesJson);
  formData.append("discussion_notes", notesJson);

  const response = await axios.put(
    `${baseurl}update_enq/${encodeURIComponent(targetId)}`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "multipart/form-data",
      },
    },
  );
  if (response.data?.success === false) {
    throw new Error(response.data?.message || "Failed to save discussion notes");
  }
  return response.data;
};

export const deleteEnquiryDiscussionNote = async (
  enquiryId,
  index,
  remainingNotes,
) => {
  if (!enquiryId) throw new Error("Enquiry ID is missing");
  const detail = (await fetchEnquiryDetail(enquiryId)) || {};
  const current = Array.isArray(detail.discussionNotes)
    ? detail.discussionNotes
    : Array.isArray(detail.discussion_notes)
      ? detail.discussion_notes
      : [];
  const updated = Array.isArray(remainingNotes)
    ? remainingNotes
    : current.filter((_, i) => i !== index);
  return saveEnquiryDiscussionNotes(
    { ...detail, enquiryId: detail.enquiryId || enquiryId },
    updated,
  );
};

/**
 * POST /api/changePatientStatus/:patientId
 * Body: { p_status: "Confirmed" }
 * Travel statuses may also include travelDetails.
 * Same API as Manage Patients status dropdown.
 */
export const changePatientStatus = async (patientId, p_status, travelDetails) => {
  if (!patientId) {
    throw new Error("Patient ID is required to update status");
  }
  let input = {};
  if (typeof p_status === "object" && p_status !== null) {
    input = { ...p_status };
  } else {
    if (!p_status) {
      throw new Error("Status is required");
    }
    input = { p_status };
    if (travelDetails && typeof travelDetails === "object") {
      input.travelDetails = travelDetails;
    }
  }

  const formData = new FormData();
  const statusVal = input.p_status || input.status;
  if (statusVal) {
    formData.append("p_status", statusVal);
  }
  if (input.travelDetails) {
    const detailsStr = typeof input.travelDetails === "object"
      ? JSON.stringify(input.travelDetails)
      : input.travelDetails;
    formData.append("travelDetails", detailsStr);
  }
  if (input.travelDocuments) {
    const docs = Array.isArray(input.travelDocuments)
      ? input.travelDocuments
      : [input.travelDocuments];
    docs.forEach((file) => {
      if (file) {
        formData.append("travelDocuments", file);
      }
    });
  }
  if (input.travelDocumentLabels) {
    if (Array.isArray(input.travelDocumentLabels)) {
      if (input.travelDocumentLabels.length === 1) {
        formData.append("travelDocumentLabels", input.travelDocumentLabels[0]);
      } else {
        formData.append("travelDocumentLabels", JSON.stringify(input.travelDocumentLabels));
      }
    } else {
      formData.append("travelDocumentLabels", input.travelDocumentLabels);
    }
  }

  const response = await axios.post(
    `${baseurl}changePatientStatus/${encodeURIComponent(patientId)}`,
    formData,
    {
      headers: {
        ...authHeaders(),
        "Content-Type": "multipart/form-data",
      },
    },
  );
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to update status");
  }
  const saved =
    body?.data?.p_status ??
    body?.p_status ??
    body?.details?.p_status ??
    statusVal;
  return typeof saved === "string" ? saved : statusVal;
};

/** Enquiry status options (same as Manage Enquiries) */
export const ENQUIRY_STATUS_OPTIONS = [
  { value: 0, label: "Pending", key: "pending" },
  { value: 1, label: "Confirm", key: "confirmed" },
  { value: 2, label: "Hold", key: "hold" },
  { value: 3, label: "Follow-up", key: "follow-up" },
  { value: 5, label: "Visit 1", key: "visit-1" },
  { value: 6, label: "Visit 2", key: "visit-2" },
  { value: 7, label: "Visa", key: "visa" },
  { value: 8, label: "Close", key: "close" },
  { value: 9, label: "Connected", key: "connected" },
  { value: 10, label: "Not Connected", key: "not-connected" },
];

const ENQUIRY_STATUS_ALIASES = {
  pending: 0,
  confirmed: 1,
  confirm: 1,
  hold: 2,
  "follow-up": 3,
  "follow up": 3,
  followup: 3,
  dead: 8,
  close: 8,
  closed: 8,
  "4": 8,
  "1 visit": 5,
  "visit 1": 5,
  visit1: 5,
  "2 visit": 6,
  "visit 2": 6,
  visit2: 6,
  visa: 7,
  connected: 9,
  "9": 9,
  "not connected": 10,
  "not-connected": 10,
  notconnected: 10,
  "10": 10,
};

export const getEnquiryStatusValue = (status) => {
  if (status == null || status === "" || status === "—") return "";
  if (typeof status === "number" && Number.isFinite(status)) return status;
  const raw = String(status).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const key = raw.toLowerCase().replace(/_/g, " ");
  if (ENQUIRY_STATUS_ALIASES[key] != null) return ENQUIRY_STATUS_ALIASES[key];
  return "";
};

export const getEnquiryStatusLabel = (status) => {
  const value = getEnquiryStatusValue(status);
  if (value === "") return status || "—";
  const option = ENQUIRY_STATUS_OPTIONS.find((item) => item.value === value);
  return option?.label ?? String(status);
};

export const getEnquiryStatusBadgeKey = (status) => {
  const value = getEnquiryStatusValue(status);
  const option = ENQUIRY_STATUS_OPTIONS.find((item) => item.value === value);
  return option?.key || "default";
};

/**
 * POST /api/update_Enquiry_status/:enquiryId
 * Body: { status: 0, enquiry_type: "OMCA Enquiry" }
 */
export const changeEnquiryStatus = async (
  enquiryId,
  status,
  enquiry_type = "OMCA Enquiry",
  optionsOrForceCreate = {},
) => {
  if (!enquiryId) {
    throw new Error("Enquiry ID is required to update status");
  }
  if (status === "" || status == null) {
    throw new Error("Status is required");
  }
  const options =
    typeof optionsOrForceCreate === "boolean"
      ? { forceCreate: optionsOrForceCreate }
      : optionsOrForceCreate || {};

  const payload = { status: Number(status), enquiry_type };
  if (options.user_id) payload.user_id = options.user_id;
  if (options.forceCreate !== undefined) payload.forceCreate = options.forceCreate;
  if (options.createNewPatient !== undefined) {
    payload.createNewPatient = options.createNewPatient;
  } else if (Number(status) === 1) {
    const hasUserId = Boolean(options.user_id && String(options.user_id).trim() !== "");
    const hasPatientId = Boolean(options.patientId && String(options.patientId).trim() !== "");
    payload.createNewPatient = !hasUserId && !hasPatientId;
  }
  if (options.patientId !== undefined) payload.patientId = options.patientId;
  const passportVal =
    options.passport_num ?? options.passport_number ?? options.passportNumber;
  if (passportVal !== undefined && passportVal !== null) {
    payload.passport_num = String(passportVal).trim();
  }

  const response = await axios.post(
    `${baseurl}update_Enquiry_status/${encodeURIComponent(enquiryId)}`,
    payload,
    { headers: authHeaders() },
  );
  const body = response.data;
  if (body?.isDuplicatePhone) {
    return body;
  }
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to update enquiry status");
  }
  return body?.data ?? body;
};

/**
 * POST /api/add_notes/:enquiryId
 * Body: { note, date } — same as Manage Enquiries notes
 */
export const addEnquiryNotes = async (enquiryId, { note, date }) => {
  if (!enquiryId) {
    throw new Error("Enquiry ID is required to add notes");
  }
  if (!note?.trim()) {
    throw new Error("Note is required");
  }
  if (!date) {
    throw new Error("Date is required");
  }
  const response = await axios.post(
    `${baseurl}add_notes/${encodeURIComponent(enquiryId)}`,
    { note: note.trim(), date },
    { headers: authHeaders() },
  );
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to add notes");
  }
  return body?.data ?? body;
};
