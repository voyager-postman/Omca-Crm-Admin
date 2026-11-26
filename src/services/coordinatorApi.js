import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import {
  isCoordinatorUser,
  getCurrentCoordinatorUser,
} from "../utils/authStorage";

export { isCoordinatorUser, getCurrentCoordinatorUser };

/**
 * Standard Auth & JSON Headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

/**
 * Normalize patientId to the string the backend expects (e.g. "OMCA-1024" or Mongo ObjectId)
 */
export const extractPatientId = (patient) => {
  if (!patient) return "";
  if (typeof patient === "string") return patient.trim();
  return (
    patient.patientId ||
    patient.patientNumber ||
    patient._id ||
    patient.id ||
    ""
  );
};

/**
 * Normalize enquiryId to string (e.g. "ENQ001" or Mongo ObjectId)
 */
export const extractEnquiryId = (enquiry) => {
  if (!enquiry) return "";
  if (typeof enquiry === "string") return enquiry.trim();
  return (
    enquiry.enquiryId ||
    enquiry.enquiry_id ||
    enquiry._id ||
    enquiry.id ||
    enquiry.raw?.enquiryId ||
    enquiry.raw?.enquiry_id ||
    enquiry.raw?._id ||
    enquiry.raw?.id ||
    ""
  );
};

/**
 * Helper to extract assigned coordinator object safely from a patient or enquiry
 */
const firstAssignedCoordinatorFromArrays = (patient) => {
  const arrays = [
    patient.assignedCoordinators,
    patient.assigned_coordinators,
    patient.raw?.assignedCoordinators,
    patient.raw?.assigned_coordinators,
  ];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length > 0 && arr[0]) return arr[0];
  }
  return null;
};

export const getAssignedCoordinator = (patient) => {
  if (!patient) return null;
  let assigned =
    patient.assignedCoordinator ||
    patient.assigned_coordinator ||
    patient.coordinator ||
    patient.details?.assignedCoordinator ||
    patient.details?.coordinator ||
    patient.raw?.assignedCoordinator ||
    patient.raw?.assigned_coordinator ||
    patient.raw?.coordinator;

  if (Array.isArray(assigned) && assigned.length > 0) {
    assigned = assigned[0];
  }
  if (!assigned) {
    assigned = firstAssignedCoordinatorFromArrays(patient);
  }

  // 1. If assigned is a string (ID or Name)
  if (typeof assigned === "string" && assigned.trim()) {
    const raw = assigned.trim();
    const isId = /^[a-fA-F0-9]{24}$/.test(raw) || /^\d+$/.test(raw);
    return {
      userId: isId ? raw : (patient.coordinatorId || patient.coordinator_id || null),
      name: !isId ? raw : (patient.coordinatorName || patient.coordinator_name || ""),
      email: patient.coordinatorEmail || patient.coordinator_email || "",
      role: "Coordinator",
      phone: patient.coordinatorPhone || patient.coordinator_phone || "",
      phoneCode: "",
      assignedAt: patient.coordinatorAssignedAt || null,
      assignedBy: patient.coordinatorAssignedBy || null,
    };
  }

  // 2. If assigned is an object
  if (assigned && typeof assigned === "object") {
    const userId =
      assigned.userId ||
      assigned.coordinatorId ||
      assigned.coordinator_id ||
      assigned._id ||
      assigned.id ||
      patient.coordinatorId ||
      patient.coordinator_id ||
      null;
    const name =
      assigned.name ||
      assigned.coordinatorName ||
      assigned.coordinator_name ||
      patient.coordinatorName ||
      patient.coordinator_name ||
      "";

    if (userId || name) {
      return {
        userId,
        name,
        email: assigned.email || patient.coordinatorEmail || "",
        role: assigned.role || "Coordinator",
        phone:
          assigned.phone ||
          assigned.phone_no ||
          assigned.phoneNumber ||
          patient.coordinatorPhone ||
          "",
        phoneCode: assigned.phoneCode || "",
        assignedAt: assigned.assignedAt || null,
        assignedBy: assigned.assignedBy || null,
      };
    }
  }

  // 3. Fallback: check direct properties on patient
  const directId =
    patient.coordinatorId ||
    patient.coordinator_id ||
    patient.assignedCoordinatorId ||
    patient.assigned_coordinator_id ||
    null;
  const directName =
    patient.coordinatorName ||
    patient.coordinator_name ||
    patient.assignedCoordinatorName ||
    patient.assigned_coordinator_name ||
    "";

  if (directId || directName) {
    return {
      userId: directId,
      name: directName,
      email: patient.coordinatorEmail || patient.coordinator_email || "",
      role: "Coordinator",
      phone: patient.coordinatorPhone || patient.coordinator_phone || "",
      phoneCode: "",
      assignedAt: patient.coordinatorAssignedAt || null,
      assignedBy: patient.coordinatorAssignedBy || null,
    };
  }

  return null;
};

/**
 * Helper to extract all assigned staff members from a patient object.
 * Returns array of staff assignments.
 */
export const getAssignedStaffList = (patient) => {
  if (!patient) return [];
  const list = [];

  // 1. From assignedStaff array
  const rawStaffArray =
    (Array.isArray(patient.assignedStaff) && patient.assignedStaff) ||
    (Array.isArray(patient.assigned_staff) && patient.assigned_staff) ||
    (Array.isArray(patient.raw?.assignedStaff) && patient.raw.assignedStaff) ||
    (Array.isArray(patient.raw?.assigned_staff) && patient.raw.assigned_staff) ||
    [];

  if (rawStaffArray.length > 0) {
    rawStaffArray.forEach((s) => {
      if (s) {
        list.push({
          userId: s.userId || s._id || s.id || s.staffId || null,
          name: s.name || s.staffName || "",
          role: s.role || "Staff",
          email: s.email || "",
          phone: s.phone || s.phone_no || s.phoneNumber || "",
          phoneCode: s.phoneCode || "",
          assignedAt: s.assignedAt || null,
          notes: s.notes || "",
          assignedBy: s.assignedBy || null,
        });
      }
    });
  }

  // 2. From myStaffAssignments array
  if (Array.isArray(patient.myStaffAssignments)) {
    patient.myStaffAssignments.forEach((s) => {
      const sId = s.userId || s._id || s.id;
      if (sId && !list.some((existing) => String(existing.userId) === String(sId))) {
        list.push({
          userId: sId,
          name: s.name || "",
          role: s.role || "Staff",
          email: s.email || "",
          phone: s.phone || "",
          phoneCode: "",
          assignedAt: s.assignedAt || null,
          notes: s.notes || "",
        });
      }
    });
  }

  // 3. From assignedCoordinators array (multi-coordinator)
  const rawCoordArray =
    (Array.isArray(patient.assignedCoordinators) && patient.assignedCoordinators) ||
    (Array.isArray(patient.assigned_coordinators) && patient.assigned_coordinators) ||
    (Array.isArray(patient.raw?.assignedCoordinators) && patient.raw.assignedCoordinators) ||
    (Array.isArray(patient.raw?.assigned_coordinators) && patient.raw.assigned_coordinators) ||
    [];

  rawCoordArray.forEach((s) => {
    if (!s) return;
    const sId = s.userId || s._id || s.id || s.coordinatorId || s.staffId || null;
    const sName = s.name || s.coordinatorName || "";
    if (
      list.some(
        (existing) =>
          (sId && String(existing.userId) === String(sId)) ||
          (sName && existing.name && existing.name === sName)
      )
    ) {
      return;
    }
    list.unshift({
      userId: sId,
      name: sName,
      role: s.role || "Coordinator",
      email: s.email || "",
      phone: s.phone || s.phone_no || s.phoneNumber || "",
      phoneCode: s.phoneCode || "",
      assignedAt: s.assignedAt || null,
      notes: s.notes || "",
      assignedBy: s.assignedBy || null,
    });
  });

  // 4. Fallback to assignedCoordinator if not already in list
  const coord = getAssignedCoordinator(patient);
  if (coord && (coord.userId || coord.name) && !list.some((s) =>
    (coord.userId && String(s.userId) === String(coord.userId)) ||
    (coord.name && s.name === coord.name)
  )) {
    list.unshift(coord);
  }

  return list;
};

/**
 * All coordinators assigned to a patient or enquiry (additive list).
 */
export const getAssignedCoordinators = (patient) => {
  if (!patient) return [];
  const list = [];
  const seen = new Set();
  const push = (c) => {
    if (!c) return;
    const userId = c.userId || c._id || c.id || c.coordinatorId || c.staffId || null;
    const name = c.name || c.coordinatorName || "";
    if (!userId && !name) return;
    const key = String(userId || name).trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push({
      userId,
      name,
      email: c.email || "",
      role: c.role || "Coordinator",
      phone: c.phone || c.phone_no || c.phoneNumber || "",
      phoneCode: c.phoneCode || "",
      assignedAt: c.assignedAt || null,
      assignedBy: c.assignedBy || null,
      notes: c.notes || "",
    });
  };

  [
    patient.assignedCoordinators,
    patient.assigned_coordinators,
    patient.raw?.assignedCoordinators,
    patient.raw?.assigned_coordinators,
  ].forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach(push);
  });

  getAssignedStaffList(patient).forEach((s) => {
    if (String(s.role || "").toLowerCase().includes("coord")) push(s);
  });

  push(getAssignedCoordinator(patient));
  return list;
};

/**
 * Check if a patient has an active assigned coordinator
 */
export const isPatientAssignedToCoordinator = (patient) => {
  const coords = getAssignedCoordinators(patient);
  return coords.some((coord) => coord && (coord.userId || coord.name));
};

/**
 * Check if a patient is assigned to a specific coordinator user (or currently logged in coordinator)
 */
export const isPatientAssignedToCoordinatorUser = (patient, coordUser = null) => {
  if (!patient) return false;
  const coords = getAssignedCoordinators(patient);

  const current = coordUser || getCurrentCoordinatorUser();
  const cId = String(current.id || "").trim().toLowerCase();
  const cName = String(current.name || "").trim().toLowerCase();
  const cEmail = String(current.email || "").trim().toLowerCase();

  for (const coord of coords) {
    const assignedId = String(coord.userId || "").trim().toLowerCase();
    const assignedName = String(coord.name || "").trim().toLowerCase();
    const assignedEmail = String(coord.email || "").trim().toLowerCase();

    if (cId && assignedId && cId === assignedId) return true;
    if (cName && assignedName && cName === assignedName) return true;
    if (cEmail && assignedEmail && cEmail === assignedEmail) return true;
  }

  // Check direct properties on patient
  const directId = String(
    patient.coordinatorId ||
    patient.coordinator_id ||
    patient.assignedCoordinatorId ||
    patient.assigned_coordinator_id ||
    ""
  ).trim().toLowerCase();
  if (cId && directId && cId === directId) return true;

  const directName = String(
    patient.coordinatorName ||
    patient.coordinator_name ||
    patient.assignedCoordinatorName ||
    patient.assigned_coordinator_name ||
    ""
  ).trim().toLowerCase();
  if (cName && directName && cName === directName) return true;

  const directEmail = String(
    patient.coordinatorEmail ||
    patient.coordinator_email ||
    ""
  ).trim().toLowerCase();
  if (cEmail && directEmail && cEmail === directEmail) return true;

  return false;
};

/**
 * Check if patient is assigned to the current user (Coordinator, Nurse, Doctor, etc.)
 * Uses backend's isAssignedToMe flag, myAssignedRoles, or matches assignedStaff list.
 */
export const isPatientAssignedToMe = (patient, userObj = null) => {
  if (!patient) return false;

  // 1. Backend flag from /all_patients?onlyAssigned=true or /my_assigned_patients
  if (patient.isAssignedToMe === true) return true;
  if (Array.isArray(patient.myAssignedRoles) && patient.myAssignedRoles.length > 0) {
    return true;
  }

  // 2. Identify current user
  const loggedInId = String(
    userObj?._id || userObj?.id || userObj?.userId || localStorage.getItem("_id") || localStorage.getItem("userId") || ""
  ).trim().toLowerCase();
  const loggedInEmail = String(
    userObj?.email || localStorage.getItem("email") || ""
  ).trim().toLowerCase();
  const loggedInName = String(
    userObj?.name || localStorage.getItem("userName") || localStorage.getItem("name") || ""
  ).trim().toLowerCase();

  // 3. Check assignedStaff list
  const staffList = getAssignedStaffList(patient);
  for (const s of staffList) {
    const sId = String(s.userId || s._id || s.id || s.staffId || "").trim().toLowerCase();
    const sEmail = String(s.email || "").trim().toLowerCase();
    const sName = String(s.name || "").trim().toLowerCase();

    if (loggedInId && sId && loggedInId === sId) return true;
    if (loggedInEmail && sEmail && loggedInEmail === sEmail) return true;
    if (loggedInName && sName && loggedInName === sName) return true;
  }

  // 4. Fallback coordinator check
  if (isPatientAssignedToCoordinatorUser(patient, {
    id: loggedInId,
    name: loggedInName,
    email: loggedInEmail,
  })) {
    return true;
  }

  // 5. Fallback physiotherapist check
  const physio = patient.assignedPhysiotherapist || patient.physiotherapist;
  if (physio && typeof physio === "object") {
    const pId = String(physio.userId || physio._id || physio.id || physio.staffId || "").trim().toLowerCase();
    const pEmail = String(physio.email || "").trim().toLowerCase();
    const pName = String(physio.name || "").trim().toLowerCase();
    if (loggedInId && pId && loggedInId === pId) return true;
    if (loggedInEmail && pEmail && loggedInEmail === pEmail) return true;
    if (loggedInName && pName && loggedInName === pName) return true;
  }

  return false;
};

/**
 * 4. Get Staff by Role (For Dropdown Menus in React)
 * GET /api/user/get_staff_by_role
 * Query: ?role=Nurse or ?role=Doctor (leave empty for all active staff)
 */
export const fetchStaffByRole = async (role = "") => {
  const headers = getAuthHeaders();
  let normalizedRole = "";
  if (Array.isArray(role)) {
    const valid = role.filter(Boolean).filter((r) => String(r).toUpperCase() !== "ALL");
    normalizedRole = valid.join(",");
  } else if (typeof role === "string" && role.trim() && role.toUpperCase() !== "ALL") {
    normalizedRole = role.trim();
  }

  const queryStr = normalizedRole ? `?role=${encodeURIComponent(normalizedRole)}` : "";
  const endpoints = [
    `${baseurl}user/get_staff_by_role${queryStr}`,
    `${baseurl}get_staff_by_role${queryStr}`,
    `${baseurl}user/staff_by_role${queryStr}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, { headers });
      const data = response?.data;
      const list =
        data?.data ||
        data?.staff ||
        data?.users ||
        data?.details ||
        data?.Details ||
        (Array.isArray(data) ? data : []);
      if (Array.isArray(list)) {
        return list;
      }
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Failed to fetch staff members");
};

/**
 * Fetch all active coordinators
 * GET /api/user/get_staff_by_role?role=Coordinator (fallback to get_coordinators)
 */
export const fetchCoordinators = async () => {
  // First try the new endpoint
  try {
    const list = await fetchStaffByRole("Coordinator");
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  } catch (err) {
    // Continue to legacy endpoints
  }

  const headers = getAuthHeaders();
  const endpoints = [
    `${baseurl}user/get_coordinators`,
    `${baseurl}get_coordinators`,
    `${baseurl}user/coordinators`,
    `${baseurl}coordinators`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, { headers });
      const data = response?.data;
      const list =
        data?.data ||
        data?.coordinators ||
        data?.Details ||
        data?.details ||
        (Array.isArray(data) ? data : []);
      if (Array.isArray(list)) {
        return list;
      }
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Failed to fetch coordinators");
};

const toIdList = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) =>
      typeof item === "string"
        ? item.trim()
        : String(item?._id || item?.id || item?.userId || item?.staffId || "").trim()
    )
    .filter(Boolean);

const buildStaffAssignmentPayload = (assignmentData, extraNotes = "") => {
  if (assignmentData && typeof assignmentData === "object") {
    const coordinatorIds = toIdList(assignmentData.coordinatorIds);
    const staffIds = toIdList(assignmentData.staffIds).length
      ? toIdList(assignmentData.staffIds)
      : coordinatorIds;
    const id =
      assignmentData.staffId ||
      assignmentData.coordinatorId ||
      assignmentData.userId ||
      assignmentData._id ||
      assignmentData.id ||
      coordinatorIds[0] ||
      staffIds[0];
    if (!id && coordinatorIds.length === 0 && staffIds.length === 0) {
      throw new Error("Staff or Coordinator ID is required");
    }
    return {
      ...(id ? { staffId: id, coordinatorId: id, userId: id } : {}),
      ...(coordinatorIds.length ? { coordinatorIds } : {}),
      ...(staffIds.length ? { staffIds } : {}),
      ...(assignmentData.role ? { role: assignmentData.role } : {}),
      ...(assignmentData.notes || extraNotes
        ? { notes: assignmentData.notes || extraNotes }
        : {}),
    };
  }
  if (typeof assignmentData === "string" && assignmentData.trim()) {
    const id = assignmentData.trim();
    return {
      staffId: id,
      coordinatorId: id,
      userId: id,
      ...(extraNotes ? { notes: extraNotes } : {}),
    };
  }
  throw new Error("Staff or Coordinator ID is required");
};

/**
 * 1. Assign Staff / Coordinator to Patient
 * POST /api/user/assign_patient_to_coordinator/:patientId
 * (alt: POST /api/user/assign_patient_staff/:patientId)
 *
 * Request Body (single): { "coordinatorId": "...", "notes": "..." }
 * Request Body (multi):  { "coordinatorIds": ["...","..."], "coordinatorId": "...", "role": "Coordinator", "notes": "..." }
 * Request Body (staff):  { "staffId": "...", "role": "Nurse", "notes": "..." }
 *
 * Multi-assign is additive. Existing coordinators must not be replaced unless unassigned.
 */
export const assignPatientStaff = async (patient, assignmentData, extraNotes = "") => {
  const patientId = extractPatientId(patient);
  if (!patientId) {
    throw new Error("Patient ID is required for assignment");
  }

  const payload = buildStaffAssignmentPayload(assignmentData, extraNotes);

  const headers = getAuthHeaders();
  const encodedId = encodeURIComponent(patientId);

  const isCoordinator =
    !payload.role ||
    String(payload.role).toLowerCase() === "coordinator";

  const endpoints = isCoordinator
    ? [
        `${baseurl}user/assign_patient_to_coordinator/${encodedId}`,
        `${baseurl}user/assign_patient_staff/${encodedId}`,
        `${baseurl}assign_patient_to_coordinator/${encodedId}`,
        `${baseurl}assign_patient_staff/${encodedId}`,
        `${baseurl}user/assign_coordinator/${encodedId}`,
      ]
    : [
        `${baseurl}user/assign_patient_staff/${encodedId}`,
        `${baseurl}user/assign_patient_to_coordinator/${encodedId}`,
        `${baseurl}assign_patient_staff/${encodedId}`,
        `${baseurl}assign_patient_to_coordinator/${encodedId}`,
        `${baseurl}user/assign_coordinator/${encodedId}`,
      ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, payload, { headers });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Failed to assign staff to patient");
};

/**
 * Backward-compatible wrapper for assigning coordinator
 */
export const assignPatientToCoordinator = async (patient, coordinatorId, notes = "") => {
  return assignPatientStaff(patient, { coordinatorId, staffId: coordinatorId, notes });
};

/**
 * 2. Unassign Staff / Coordinator from Patient
 * POST /api/user/unassign_patient_from_coordinator/:patientId
 * (alt: POST /api/user/unassign_patient_staff/:patientId)
 *
 * Request Body (Coordinator): { "reason": "..." }
 * Request Body (Staff): { "staffId": "...", "role": "Nurse", "reason": "..." }
 */
export const unassignPatientStaff = async (patient, options = {}) => {
  const patientId = extractPatientId(patient);
  if (!patientId) {
    throw new Error("Patient ID is required for unassigning");
  }

  let payload = {};
  if (options && typeof options === "object") {
    const staffId = options.staffId || options.userId || options.coordinatorId;
    if (staffId) {
      payload.staffId = staffId;
      payload.userId = staffId;
      payload.coordinatorId = staffId;
    }
    if (options.role) {
      payload.role = options.role;
    }
    if (options.reason) {
      payload.reason = options.reason;
    }
  } else if (typeof options === "string" && options.trim()) {
    payload.reason = options.trim();
  }

  const headers = getAuthHeaders();
  const encodedId = encodeURIComponent(patientId);

  const isStaffSpecific =
    Boolean(payload.staffId || payload.userId) &&
    Boolean(payload.role && String(payload.role).toLowerCase() !== "coordinator");

  const endpoints = isStaffSpecific
    ? [
        `${baseurl}user/unassign_patient_staff/${encodedId}`,
        `${baseurl}user/unassign_patient_from_coordinator/${encodedId}`,
        `${baseurl}unassign_patient_staff/${encodedId}`,
        `${baseurl}unassign_patient_from_coordinator/${encodedId}`,
        `${baseurl}user/unassign_coordinator/${encodedId}`,
      ]
    : [
        `${baseurl}user/unassign_patient_from_coordinator/${encodedId}`,
        `${baseurl}user/unassign_patient_staff/${encodedId}`,
        `${baseurl}unassign_patient_from_coordinator/${encodedId}`,
        `${baseurl}unassign_patient_staff/${encodedId}`,
        `${baseurl}user/unassign_coordinator/${encodedId}`,
      ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, payload, { headers });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Failed to unassign staff from patient");
};

/**
 * Backward-compatible wrapper for unassigning coordinator
 */
export const unassignPatientFromCoordinator = async (patient, reason = "") => {
  return unassignPatientStaff(patient, { reason });
};

/**
 * 3. "My Assigned Patients" List
 * GET /api/user/my_assigned_patients
 * (alt: /api/patient/assigned_to_me)
 * Query: page, limit, isAll, search, role, p_status
 */
export const fetchMyAssignedPatients = async (params = {}) => {
  const headers = getAuthHeaders();
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", params.page);
  if (params.limit) queryParams.append("limit", params.limit);
  if (params.isAll) queryParams.append("isAll", "true");
  if (params.search) queryParams.append("search", params.search);
  if (params.role) queryParams.append("role", params.role);
  if (params.p_status) queryParams.append("p_status", params.p_status);

  const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const endpoints = [
    `${baseurl}user/my_assigned_patients${queryStr}`,
    `${baseurl}my_assigned_patients${queryStr}`,
    `${baseurl}patient/assigned_to_me${queryStr}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Failed to fetch my assigned patients");
};

/**
 * Update patient coordinator via general update endpoint
 * PUT /api/user/update_patient/:patientId
 */
export const updatePatientCoordinator = async (patient, coordinatorId = null) => {
  const patientId = extractPatientId(patient);
  if (!patientId) {
    throw new Error("Patient ID is required");
  }

  const headers = getAuthHeaders();
  const payload = {
    coordinatorId: coordinatorId || null,
  };

  let response;
  try {
    response = await axios.put(
      `${baseurl}user/update_patient/${encodeURIComponent(patientId)}`,
      payload,
      { headers }
    );
  } catch (err) {
    if (err.response?.status === 404) {
      response = await axios.put(
        `${baseurl}update_patient/${encodeURIComponent(patientId)}`,
        payload,
        { headers }
      );
    } else {
      throw err;
    }
  }

  return response.data;
};

/**
 * Assign Staff / Coordinator to Enquiry
 * POST /api/assign_enquiry_staff/:enquiryId
 * (alt: POST /api/user/assign_enquiry_staff/:enquiryId)
 *
 * Payload: { "staffId": "USER_OBJECT_ID", "role": "Nurse", "notes": "optional" }
 * Send staffId, userId, or coordinatorId. Role and notes are optional.
 * If role is omitted, the user's own role is used. Role containing "coord" -> saved as coordinator.
 * Any other role -> added to assignedStaff.
 */
export const assignEnquiryStaff = async (enquiry, assignmentData, extraNotes = "") => {
  const enquiryId = extractEnquiryId(enquiry);
  if (!enquiryId) {
    throw new Error("Enquiry ID is required for assignment");
  }

  const payload = buildStaffAssignmentPayload(assignmentData, extraNotes);

  const headers = getAuthHeaders();
  const encodedId = encodeURIComponent(enquiryId);

  const endpoints = [
    `${baseurl}assign_enquiry_staff/${encodedId}`,
    `${baseurl}user/assign_enquiry_staff/${encodedId}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, payload, { headers });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Failed to assign staff to enquiry");
};

/**
 * Unassign Staff / Coordinator from Enquiry
 * POST /api/unassign_enquiry_staff/:enquiryId
 * (alt: POST /api/user/unassign_enquiry_staff/:enquiryId)
 *
 * Payload: { "staffId": "USER_OBJECT_ID", "role": "Nurse", "reason": "optional" }
 * Role is optional. With role, only that role is removed.
 * Without role, every assignment for that user is removed.
 */
export const unassignEnquiryStaff = async (enquiry, options = {}) => {
  const enquiryId = extractEnquiryId(enquiry);
  if (!enquiryId) {
    throw new Error("Enquiry ID is required for unassigning");
  }

  let payload = {};
  if (options && typeof options === "object") {
    const staffId = options.staffId || options.userId || options.coordinatorId;
    if (staffId) {
      payload.staffId = staffId;
      payload.userId = staffId;
      payload.coordinatorId = staffId;
    }
    if (options.role) {
      payload.role = options.role;
    }
    if (options.reason) {
      payload.reason = options.reason;
    }
  } else if (typeof options === "string" && options.trim()) {
    payload.reason = options.trim();
  }

  const headers = getAuthHeaders();
  const encodedId = encodeURIComponent(enquiryId);

  const endpoints = [
    `${baseurl}unassign_enquiry_staff/${encodedId}`,
    `${baseurl}user/unassign_enquiry_staff/${encodedId}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, payload, { headers });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Failed to unassign staff from enquiry");
};

