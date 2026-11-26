import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

/** GET /api/sos/dashboard/alerts — unaccepted only, filtered by JWT role */
export const fetchSosDashboardAlerts = async () => {
  const response = await axios.get(`${baseurl}sos/dashboard/alerts`, {
    headers: authHeaders(),
  });
  const data = unwrap(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.alerts)) return data.alerts;
  return [];
};

/** GET /api/sos/dashboard/:sosId — single case dashboard view */
export const fetchSosDashboard = async (sosId) => {
  const response = await axios.get(`${baseurl}sos/dashboard/${sosId}`, {
    headers: authHeaders(),
  });
  return unwrap(response);
};

/** PUT /api/sos/:sosId/accept — Accept Case → Case Accepted */
export const acceptSosCase = async (sosId) => {
  const response = await axios.put(
    `${baseurl}sos/${sosId}/accept`,
    {},
    { headers: authHeaders() },
  );
  return response.data;
};

/**
 * POST /api/sos/:sosId/action
 * Types: Call | WhatsApp | DispatchAmbulance | AirAmbulance | OpenMaps
 */
export const postSosAction = async (sosId, type, notes = "") => {
  const body = notes ? { type, notes } : { type };
  const response = await axios.post(`${baseurl}sos/${sosId}/action`, body, {
    headers: authHeaders(),
  });
  return response.data;
};

/** PUT /api/sos/:sosId/close — Close SOS */
export const closeSosCase = async (sosId, notes = "") => {
  const response = await axios.put(
    `${baseurl}sos/${sosId}/close`,
    notes ? { notes } : {},
    { headers: authHeaders() },
  );
  return response.data;
};

/** GET /api/sos/:sosId/tracking — user + ambulance location, ETA, notes */
export const fetchSosTracking = async (sosId) => {
  const response = await axios.get(`${baseurl}sos/${sosId}/tracking`, {
    headers: authHeaders(),
  });
  return unwrap(response);
};

/** PUT /api/sos/:sosId/ambulance-location */
export const updateAmbulanceLocation = async (sosId, payload) => {
  const response = await axios.put(
    `${baseurl}sos/${sosId}/ambulance-location`,
    payload,
    { headers: authHeaders() },
  );
  return response.data;
};

/** POST /api/sos/:sosId/notes — operator notes (`note` required by API) */
export const postSosNote = async (sosId, notes) => {
  const text = String(notes || "").trim();
  if (!sosId) {
    const err = new Error("Missing SOS id");
    err.response = { data: { message: "Missing SOS id" } };
    throw err;
  }
  if (!text) {
    const err = new Error("Note is required");
    err.response = { data: { message: "note is required" } };
    throw err;
  }

  const response = await axios.post(
    `${baseurl}sos/${sosId}/notes`,
    { note: text },
    { headers: authHeaders() },
  );
  return response.data;
};

const toInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SOS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const asList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.name || item?.condition || item?.label || "";
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,|;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const firstContact = (contacts) => {
  if (!contacts) return null;
  const list = Array.isArray(contacts) ? contacts : [contacts];
  const c = list[0];
  if (!c) return null;
  if (typeof c === "string") {
    return { name: c, relation: "", phone: "" };
  }
  const phone =
    c.phone ||
    c.mobile ||
    [c.phone_code, c.phone_number || c.number].filter(Boolean).join(" ") ||
    "";
  return {
    name: c.name || c.contactName || "Emergency Contact",
    relation: c.relation || c.relationship || "",
    phone: String(phone).trim(),
  };
};

/**
 * Normalize dashboard / alert API payload into EmergencyAlertModal shape.
 */
export const normalizeSosDashboardData = (raw = {}, fallbackAlert = {}) => {
  const patient = raw.patient || {};
  const location = raw.location || {};
  const ambulance = raw.ambulance || {};
  const sosId =
    raw.sosId ||
    raw.caseId ||
    raw.emergencyCaseId ||
    fallbackAlert.sosId ||
    fallbackAlert.emergencyCaseId ||
    "";

  const lat =
    location.latitude ??
    location.lat ??
    raw.latitude ??
    raw.lat ??
    null;
  const lng =
    location.longitude ??
    location.lng ??
    raw.longitude ??
    raw.lng ??
    null;
  const mapsUrl =
    location.mapsUrl ||
    location.maps_url ||
    location.url ||
    raw.mapsUrl ||
    (lat != null && lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : "");

  const patientName =
    patient.name ||
    raw.patientName ||
    fallbackAlert.patientName ||
    "Unknown Patient";

  const medicalHistory = asList(
    raw.medicalHistory || raw.medical_history || patient.medicalHistory,
  );
  const allergies = asList(raw.allergies || patient.allergies);
  const medication = asList(
    raw.medication || raw.medications || patient.medication,
  );

  const contact =
    firstContact(raw.emergencyContacts || raw.emergency_contacts) ||
    firstContact(raw.emergencyContact) || {
      name: "—",
      relation: "",
      phone: "",
    };

  const completed = new Set(
    (raw.completedActions || raw.actionsCompleted || [])
      .map((a) => (typeof a === "string" ? a : a?.type || a?.label || ""))
      .filter(Boolean),
  );

  const status = raw.status || fallbackAlert.status || "Alert Received";
  const statusLower = String(status).toLowerCase();

  return {
    sosId,
    caseId: sosId || raw.emergencyCaseId || fallbackAlert.emergencyCaseId || "—",
    emergencyCaseId: raw.emergencyCaseId || fallbackAlert.emergencyCaseId || "",
    alertTitle: raw.alertTitle || fallbackAlert.title || "NEW SOS ALERT",
    receivedAt: raw.receivedAt
      ? new Date(raw.receivedAt).getTime()
      : raw.createdAt
        ? new Date(raw.createdAt).getTime()
        : Date.now(),
    status,
    patient: {
      name: patientName,
      mobile: patient.mobile || patient.phone || raw.mobile || "",
      age: patient.age ?? raw.age ?? "—",
      gender: patient.gender || raw.gender || "—",
      status:
        patient.status ||
        patient.condition ||
        raw.patientStatus ||
        "Emergency request received",
      initials: toInitials(patientName),
    },
    location: {
      label:
        location.label ||
        location.address ||
        location.name ||
        (lat != null && lng != null ? `Live GPS (${lat}, ${lng})` : "Live GPS"),
      lat,
      lng,
      mapsUrl,
      distanceKm:
        raw.nearestAmbulanceDistanceKm ??
        location.nearestAmbulanceDistanceKm ??
        location.distanceKm ??
        "—",
      etaMinutes:
        ambulance.etaMinutes ??
        location.etaMinutes ??
        raw.etaMinutes ??
        "—",
    },
    medicalHistory,
    allergies,
    medication,
    emergencyContact: contact,
    emergencyContacts: Array.isArray(raw.emergencyContacts)
      ? raw.emergencyContacts
      : contact
        ? [contact]
        : [],
    ambulance: {
      id: ambulance.id || ambulance.ambulanceId || ambulance.code || "—",
      driver: ambulance.driver || ambulance.driverName || "—",
      etaMinutes: ambulance.etaMinutes ?? location.etaMinutes ?? "—",
    },
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    operator:
      raw.operator ||
      raw.assignedOperator ||
      localStorage.getItem("name") ||
      "Operator",
    flags: {
      caseAccepted:
        completed.has("Accept") ||
        completed.has("Accept Case") ||
        statusLower === "accepted" ||
        statusLower === "case accepted" ||
        statusLower.startsWith("accepted ") ||
        statusLower.includes("case accepted") ||
        !!raw.acceptedAt,
      patientCalled:
        completed.has("Call") ||
        completed.has("Call Patient") ||
        completed.has("Patient Called"),
      ambulanceDispatched:
        completed.has("DispatchAmbulance") ||
        completed.has("Dispatch Ambulance") ||
        completed.has("Ambulance Dispatched") ||
        statusLower === "dispatched" ||
        statusLower.includes("dispatched"),
      airAmbulanceArranged:
        completed.has("AirAmbulance") ||
        completed.has("Arrange Air Ambulance") ||
        completed.has("Air Ambulance Arranged"),
      closed:
        statusLower === "closed" ||
        statusLower.startsWith("closed") ||
        !!raw.closedAt,
    },
    raw,
  };
};

export const mergeTrackingIntoDashboard = (dashboard, tracking) => {
  if (!tracking || !dashboard) return dashboard;
  const userLoc = tracking.user || tracking.patient || tracking.location || {};
  const amb = tracking.ambulance || {};
  const lat =
    userLoc.latitude ?? userLoc.lat ?? dashboard.location.lat;
  const lng =
    userLoc.longitude ?? userLoc.lng ?? dashboard.location.lng;

  return {
    ...dashboard,
    location: {
      ...dashboard.location,
      lat,
      lng,
      mapsUrl:
        userLoc.mapsUrl ||
        dashboard.location.mapsUrl ||
        (lat != null && lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : dashboard.location.mapsUrl),
      etaMinutes:
        amb.etaMinutes ?? tracking.etaMinutes ?? dashboard.location.etaMinutes,
      label:
        userLoc.address ||
        userLoc.label ||
        dashboard.location.label,
    },
    ambulance: {
      ...dashboard.ambulance,
      id: amb.id || amb.ambulanceId || dashboard.ambulance.id,
      driver: amb.driver || amb.driverName || dashboard.ambulance.driver,
      etaMinutes:
        amb.etaMinutes ?? tracking.etaMinutes ?? dashboard.ambulance.etaMinutes,
    },
    trackingNotes: tracking.notes || tracking.operatorNotes || [],
  };
};
