/** CRM display helpers for Treatment Plan and VIL approval reminders (stinkers). */

const STINKER_TYPE_TP = "TP_APPROVAL_STINKER";
const STINKER_TYPE_VIL = "VIL_APPROVAL_STINKER";

const toCount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const personName = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return (
    value.name ||
    value.fullName ||
    value.staffName ||
    value.hospitalName ||
    value.email ||
    ""
  );
};

const isClosedStatus = (status) => {
  const s = String(status || "").trim().toLowerCase();
  return s === "approved" || s === "rejected";
};

const isStillPending = (status) => {
  if (isClosedStatus(status)) return false;
  const s = String(status || "").trim().toLowerCase();
  if (!s || s === "pending" || s === "requested") return true;
  return /await|receiv|pending|upload|review|resubmit/.test(s);
};

const normalizeBlock = (raw) => {
  if (!raw || typeof raw !== "object") {
    return { count: 0, lastSentAt: null, lastSentBy: "", notes: "", history: [] };
  }
  const history = Array.isArray(raw.history) ? raw.history : [];
  const latest = history.length ? history[history.length - 1] : null;
  const count = toCount(raw.count ?? raw.stinkerCount) || history.length;
  return {
    count,
    lastSentAt: raw.lastSentAt || raw.last_sent_at || latest?.sentAt || null,
    lastSentBy: personName(raw.lastSentBy || raw.last_sent_by || latest?.sentBy),
    notes: String(raw.notes || latest?.notes || "").trim(),
    history,
  };
};

const readBlock = (source, camel, snake) =>
  normalizeBlock(source?.[camel] ?? source?.[snake]);

const flagValue = (source, camel, snake) => {
  if (!source) return undefined;
  if (source[camel] !== undefined) return source[camel];
  if (source[snake] !== undefined) return source[snake];
  return undefined;
};

const shouldShow = (explicitFlag, count, pending) => {
  if (explicitFlag === true) return true;
  if (explicitFlag === false) return false;
  return count > 0 && pending;
};

export const formatStinkerWhen = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Hospital-level stinker summary.
 * Pending flags from the API win. Otherwise a reminder is shown only while
 * that approval is still waiting.
 */
export function getStinkerSummary(hospital = {}, plan = {}) {
  const tp = readBlock(hospital, "tpStinker", "tp_stinker");
  const vil = readBlock(hospital, "vilStinker", "vil_stinker");
  const tpFlag = flagValue(hospital, "hasTpStinker", "has_tp_stinker");
  const vilFlag = flagValue(hospital, "hasVilStinker", "has_vil_stinker");
  const vilStatus = hospital?.vilStatus || hospital?.vil_status || "";

  const serverBadge = String(
    hospital?.stinkerBadge || hospital?.stinker_badge || "",
  ).trim();
  const tpFromBadge = serverBadge.match(/TP Stinker \((\d+)\)/i);
  const vilFromBadge = serverBadge.match(/VIL Stinker \((\d+)\)/i);

  let showTp = shouldShow(tpFlag, tp.count, isStillPending(hospital?.status));
  let showVil = shouldShow(vilFlag, vil.count, isStillPending(vilStatus));
  if (!showTp && tpFromBadge && !isClosedStatus(hospital?.status)) showTp = true;
  if (!showVil && vilFromBadge && !isClosedStatus(vilStatus)) showVil = true;

  const tpCount = showTp ? tp.count || toCount(tpFromBadge?.[1]) || 1 : 0;
  const vilCount = showVil ? vil.count || toCount(vilFromBadge?.[1]) || 1 : 0;

  const parts = [];
  if (showTp) parts.push(`TP Stinker (${tpCount})`);
  if (showVil) parts.push(`VIL Stinker (${vilCount})`);

  const history = [
    ...tp.history.map((entry) => ({ ...entry, kind: "TP" })),
    ...vil.history.map((entry) => ({ ...entry, kind: "VIL" })),
  ].sort((a, b) => new Date(a?.sentAt || 0) - new Date(b?.sentAt || 0));

  return {
    showTp,
    showVil,
    tpCount,
    vilCount,
    badge: parts.join(" & "),
    tp,
    vil,
    history,
    hasAny: showTp || showVil,
  };
}

/** Plan header: API badge when present, otherwise totals across hospitals. */
export function getPlanStinkerSummary(plan = {}) {
  const hospitals = Array.isArray(plan?.hospitals) ? plan.hospitals : [];
  if (!hospitals.length) {
    const single = getStinkerSummary(plan, plan);
    const serverBadge = plan?.stinkerBadge || plan?.stinker_badge || "";
    return { ...single, badge: serverBadge || single.badge };
  }

  const summaries = hospitals.map((hospital) => getStinkerSummary(hospital, plan));
  const tpCount = summaries.reduce((sum, item) => sum + item.tpCount, 0);
  const vilCount = summaries.reduce((sum, item) => sum + item.vilCount, 0);
  const showTp = tpCount > 0;
  const showVil = vilCount > 0;
  const pending =
    plan?.hasPendingStinker === true || plan?.has_pending_stinker === true;
  const serverBadge = String(
    plan?.stinkerBadge || plan?.stinker_badge || "",
  ).trim();
  const tpFromBadge = serverBadge.match(/TP Stinker \((\d+)\)/i);
  const vilFromBadge = serverBadge.match(/VIL Stinker \((\d+)\)/i);
  const showTpFinal = showTp || (pending && Boolean(tpFromBadge));
  const showVilFinal = showVil || (pending && Boolean(vilFromBadge));
  const tpCountFinal = showTpFinal ? tpCount || toCount(tpFromBadge?.[1]) || 1 : 0;
  const vilCountFinal = showVilFinal ? vilCount || toCount(vilFromBadge?.[1]) || 1 : 0;
  const computed = [];
  if (showTpFinal) computed.push(`TP Stinker (${tpCountFinal})`);
  if (showVilFinal) computed.push(`VIL Stinker (${vilCountFinal})`);

  return {
    showTp: showTpFinal,
    showVil: showVilFinal,
    tpCount: tpCountFinal,
    vilCount: vilCountFinal,
    badge: serverBadge || computed.join(" & "),
    history: summaries.flatMap((item) => item.history),
    hasAny: showTpFinal || showVilFinal,
    tp: summaries.find((item) => item.showTp)?.tp || normalizeBlock(null),
    vil: summaries.find((item) => item.showVil)?.vil || normalizeBlock(null),
  };
}

export function formatCrmStatusWithStinker(label, hospital, plan) {
  const summary = getStinkerSummary(hospital, plan);
  if (!summary.showTp || !label) return label || "";
  if (/stinker/i.test(label)) return label;
  return `${label} (Stinker #${summary.tpCount} sent)`;
}

export function formatVilStatusWithStinker(label, hospital, plan) {
  const summary = getStinkerSummary(hospital, plan);
  if (!summary.showVil || !label) return label || "";
  if (/stinker/i.test(label)) return label;
  return `${label} (Stinker #${summary.vilCount} sent)`;
}

export function unwrapCrmRealtimePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.notification && typeof payload.notification === "object") {
    return payload.notification;
  }
  if (payload.alert && typeof payload.alert === "object") return payload.alert;
  if (payload.popup && typeof payload.popup === "object") return payload.popup;
  const data = payload.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (data.heading || data.title || data.type || data.message || data._id || data.id) {
      return data;
    }
  }
  return payload;
}

export function getStinkerKind(item = {}) {
  const type = String(
    item.type || item.notificationType || item.alertType || item.event || "",
  ).toUpperCase();
  const meta = String(
    item.metadata?.stinkerType || item.stinkerType || "",
  ).toUpperCase();
  if (type === STINKER_TYPE_VIL || type.includes("VIL") || meta === "VIL") {
    return "VIL";
  }
  if (
    type === STINKER_TYPE_TP ||
    type.includes("TP") ||
    type.includes("TREATMENT") ||
    meta === "TP"
  ) {
    return "TP";
  }
  if (type.includes("STINKER")) return "TP";
  return null;
}

export function isStinkerAlert(item) {
  if (!item || typeof item !== "object") return false;
  const type = String(
    item.type || item.notificationType || item.alertType || "",
  ).toUpperCase();
  if (type.includes("STINKER")) return true;
  return Boolean(item.metadata?.stinkerType || item.stinkerType);
}

export function getAlertStinkerCount(item = {}) {
  const meta = item.metadata || {};
  return (
    toCount(
      meta.stinkerCount ??
        meta.count ??
        item.stinkerCount ??
        item.count,
    ) || (isStinkerAlert(item) ? 1 : 0)
  );
}

export function getAlertStinkerNotes(item = {}) {
  const meta = item.metadata || {};
  return String(meta.notes || item.notes || "").trim();
}

export function showStinkerBrowserNotification(item = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const kind = getStinkerKind(item);
  const count = getAlertStinkerCount(item);
  const title =
    item.heading ||
    item.title ||
    (kind === "VIL"
      ? "VIL approval reminder"
      : "Treatment Plan approval reminder");
  const notes = getAlertStinkerNotes(item);
  const body =
    item.message ||
    notes ||
    (count ? `Reminder #${count} — hospital is waiting for approval` : "Hospital sent a reminder");
  const tag = String(item.id || item._id || item.notificationId || "stinker");
  try {
    new Notification(title, {
      body,
      tag,
      requireInteraction: true,
    });
  } catch (err) {
    console.warn("Stinker browser notification failed:", err);
  }
}
