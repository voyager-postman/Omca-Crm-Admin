import axios from "axios";
import { baseurl, imageUrl } from "../Basurl/Baseurl";

const getAuthHeaders = (isMultipart = false) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const headers = {
    Authorization: token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : "",
  };
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

/**
 * Fetch Physiotherapy KPI dashboard statistics
 */
export const fetchPhysiotherapyStats = async () => {
  try {
    const res = await axios.get(`${baseurl}physiotherapy/dashboard-stats`, {
      headers: getAuthHeaders(),
    });
    return res.data?.data || res.data || {};
  } catch (error) {
    console.error("Error fetching physiotherapy stats:", error);
    throw error.response?.data?.message || error.message || "Failed to load stats";
  }
};

/**
 * Fetch list of physiotherapy cases / worklist with filters and pagination
 */
export const fetchPhysiotherapyPatients = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
        query.append(key, params[key]);
      }
    });

    const res = await axios.get(
      `${baseurl}physiotherapy/patients?${query.toString()}`,
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data || { data: [], pagination: {} };
  } catch (error) {
    console.error("Error fetching physiotherapy patient list:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to load physiotherapy cases"
    );
  }
};

/**
 * Fetch detailed physiotherapy case by ID
 */
export const fetchPhysiotherapyDetails = async (caseId) => {
  try {
    const res = await axios.get(`${baseurl}physiotherapy/details/${caseId}`, {
      headers: getAuthHeaders(),
    });
    return res.data?.data || res.data;
  } catch (error) {
    console.error("Error fetching physiotherapy case details:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to load case details"
    );
  }
};

/**
 * Fetch all physiotherapy cases for a specific patient
 */
export const fetchPhysiotherapyByPatient = async (patientId) => {
  try {
    const res = await axios.get(
      `${baseurl}physiotherapy/patient/${patientId}`,
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data?.data || res.data || [];
  } catch (error) {
    console.error("Error fetching physiotherapy by patient ID:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to load patient physiotherapy history"
    );
  }
};

/**
 * Create a new physiotherapy referral / case
 */
export const createPhysiotherapyReferral = async (data) => {
  try {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const res = await axios.post(`${baseurl}physiotherapy/create`, data, {
      headers: getAuthHeaders(isFormData),
    });
    return res.data;
  } catch (error) {
    console.error("Error creating physiotherapy referral:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to create physiotherapy referral"
    );
  }
};

/**
 * Update case details (diagnosis, goals, prescribed sessions, etc.)
 */
export const updatePhysiotherapyCase = async (caseId, data) => {
  const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
  const headers = getAuthHeaders(isFormData);
  const endpoints = [
    `${baseurl}physiotherapy/update/${caseId}`,
    `${baseurl}physiotherapy/${caseId}`,
    `${baseurl}update_physiotherapy/${caseId}`,
  ];

  let lastError = null;
  for (const url of endpoints) {
    for (const method of ["put", "patch", "post"]) {
      try {
        const res = await axios({ method, url, data, headers });
        return res.data;
      } catch (error) {
        lastError = error;
        if (error.response?.status === 405) continue;
        if (error.response?.status === 404) break;
        throw error;
      }
    }
  }

  console.error("Error updating physiotherapy case:", lastError);
  throw (
    lastError?.response?.data?.message ||
    lastError?.message ||
    "Failed to update physiotherapy case"
  );
};

/**
 * Update physiotherapy case status (Referred, In Progress, Completed, On Hold, Cancelled)
 */
export const updatePhysiotherapyStatus = async (caseId, status, notes = "") => {
  try {
    const res = await axios.put(
      `${baseurl}physiotherapy/status/${caseId}`,
      { status, notes },
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  } catch (error) {
    console.error("Error updating physiotherapy status:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to update case status"
    );
  }
};

/**
 * Add a new physiotherapy session
 */
export const addPhysiotherapySession = async (caseId, sessionData) => {
  try {
    const isFormData =
      typeof FormData !== "undefined" && sessionData instanceof FormData;
    const res = await axios.post(
      `${baseurl}physiotherapy/session/${caseId}`,
      sessionData,
      {
        headers: getAuthHeaders(isFormData),
      }
    );
    return res.data;
  } catch (error) {
    console.error("Error adding physiotherapy session:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to record session"
    );
  }
};

/**
 * Update an existing session
 */
export const updatePhysiotherapySession = async (
  caseId,
  sessionId,
  sessionData
) => {
  const isFormData =
    typeof FormData !== "undefined" && sessionData instanceof FormData;
  const headers = getAuthHeaders(isFormData);
  const targetId = sessionId || caseId;
  const endpoints = [
    `${baseurl}physiotherapy/session/${targetId}`,
    `${baseurl}physiotherapy/session/${caseId}`,
    `${baseurl}physiotherapy/session/${caseId}/${sessionId}`,
    `${baseurl}physiotherapy/session/update/${caseId}/${sessionId}`,
    `${baseurl}update_physiotherapy_session/${caseId}/${sessionId}`,
    `${baseurl}update_physiotherapy_session/${caseId}`,
  ];

  let lastError = null;
  for (const url of endpoints) {
    for (const method of ["put", "patch", "post"]) {
      try {
        const res = await axios({ method, url, data: sessionData, headers });
        return res.data;
      } catch (error) {
        lastError = error;
        if (error.response?.status === 405) continue;
        if (error.response?.status === 404) break;
        throw error;
      }
    }
  }

  console.error("Error updating physiotherapy session:", lastError);
  throw (
    lastError?.response?.data?.message ||
    lastError?.message ||
    "Failed to update session"
  );
};

const tryPhysioRequest = async (attempts, fallbackMessage) => {
  let lastError = null;
  for (const attempt of attempts) {
    try {
      const res = await axios({
        method: attempt.method,
        url: attempt.url,
        data: attempt.data,
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      if (status === 404 || status === 405) continue;
      break;
    }
  }
  throw (
    lastError?.response?.data?.message ||
    lastError?.message ||
    fallbackMessage
  );
};

/**
 * All sessions for a physiotherapy case
 * GET /api/physiotherapy/:id/sessions
 */
export const getPhysiotherapySessions = async (caseId) => {
  return tryPhysioRequest(
    [
      { method: "get", url: `${baseurl}physiotherapy/${caseId}/sessions` },
      { method: "get", url: `${baseurl}get_physiotherapy_sessions/${caseId}` },
    ],
    "Failed to load sessions"
  );
};

/**
 * One session by id
 * GET /api/physiotherapy/:id/session/:sessionId
 */
export const getPhysiotherapySession = async (caseId, sessionId) => {
  return tryPhysioRequest(
    [
      {
        method: "get",
        url: `${baseurl}physiotherapy/${caseId}/session/${sessionId}`,
      },
      {
        method: "get",
        url: `${baseurl}get_physiotherapy_session/${caseId}/${sessionId}`,
      },
    ],
    "Failed to load session"
  );
};

/**
 * Exercises and section notes for one session
 * GET /api/physiotherapy/:id/session/:sessionId/exercises
 */
export const getPhysiotherapyExercises = async (caseId, sessionId) => {
  return tryPhysioRequest(
    [
      {
        method: "get",
        url: `${baseurl}physiotherapy/${caseId}/session/${sessionId}/exercises`,
      },
      {
        method: "get",
        url: `${baseurl}get_physiotherapy_exercises/${caseId}/${sessionId}`,
      },
    ],
    "Failed to load exercises"
  );
};

/**
 * Add one exercise (and optional section notes) to a session
 * POST /api/physiotherapy/:id/session/:sessionId/exercise
 */
export const addPhysiotherapyExercise = async (caseId, sessionId, data) => {
  return tryPhysioRequest(
    [
      {
        method: "post",
        url: `${baseurl}physiotherapy/${caseId}/session/${sessionId}/exercise`,
        data,
      },
      {
        method: "post",
        url: `${baseurl}add_physiotherapy_exercise/${caseId}/${sessionId}`,
        data,
      },
    ],
    "Failed to add exercise"
  );
};

/**
 * Update one exercise and optional section notes
 * PUT /api/physiotherapy/:id/session/:sessionId/exercise/:exerciseId
 */
export const updatePhysiotherapyExercise = async (
  caseId,
  sessionId,
  exerciseId,
  data
) => {
  const urls = [
    `${baseurl}physiotherapy/${caseId}/session/${sessionId}/exercise/${exerciseId}`,
    `${baseurl}update_physiotherapy_exercise/${caseId}/${sessionId}/${exerciseId}`,
  ];
  const attempts = urls.flatMap((url) =>
    ["put", "post", "patch"].map((method) => ({ method, url, data }))
  );
  return tryPhysioRequest(attempts, "Failed to update exercise");
};

/**
 * Remove one exercise from a session
 * DELETE /api/physiotherapy/:id/session/:sessionId/exercise/:exerciseId
 */
export const deletePhysiotherapyExercise = async (
  caseId,
  sessionId,
  exerciseId
) => {
  return tryPhysioRequest(
    [
      {
        method: "delete",
        url: `${baseurl}physiotherapy/${caseId}/session/${sessionId}/exercise/${exerciseId}`,
      },
      {
        method: "delete",
        url: `${baseurl}delete_physiotherapy_exercise/${caseId}/${sessionId}/${exerciseId}`,
      },
    ],
    "Failed to delete exercise"
  );
};

const exerciseIdentity = (item) =>
  [
    String(item?.exerciseName || item?.name || "")
      .trim()
      .toLowerCase(),
    Number(item?.sets) || 0,
    Number(item?.reps ?? item?.repetitions) || 0,
  ].join("|");

/**
 * Push the form's exercise list and section notes through the exercise APIs.
 * The session save still includes the same fields; this keeps the dedicated
 * exercise records in step when that session payload does not persist them.
 */
export const syncPhysiotherapyExercises = async (
  caseId,
  sessionId,
  desiredExercises = [],
  exerciseNotes = ""
) => {
  const remoteRes = await getPhysiotherapyExercises(caseId, sessionId);
  const remoteSession =
    remoteRes?.session || remoteRes?.data?.session || remoteRes || {};
  const remote = Array.isArray(remoteSession.exercises)
    ? [...remoteSession.exercises]
    : [];
  const remoteNotes = remoteSession.exerciseNotes || "";
  const unmatched = [...remote];
  const toCreate = [];
  const toUpdate = [];

  desiredExercises.forEach((item) => {
    let matchIndex = -1;
    if (item._id) {
      matchIndex = unmatched.findIndex(
        (row) => String(row._id || row.id) === String(item._id)
      );
    }
    if (matchIndex === -1) {
      const key = exerciseIdentity(item);
      matchIndex = unmatched.findIndex((row) => exerciseIdentity(row) === key);
    }

    if (matchIndex === -1) {
      toCreate.push(item);
      return;
    }

    const matched = unmatched.splice(matchIndex, 1)[0];
    const matchedId = matched._id || matched.id;
    const changed =
      String(matched.notes || "") !== String(item.notes || "") ||
      String(matched.exerciseName || matched.name || "") !==
      String(item.exerciseName || item.name || "") ||
      Number(matched.sets) !== Number(item.sets) ||
      Number(matched.reps ?? matched.repetitions) !==
      Number(item.reps ?? item.repetitions) ||
      String(matched.hold || "") !== String(item.hold || "") ||
      String(remoteNotes) !== String(exerciseNotes || "");

    if (matchedId && changed) {
      toUpdate.push({ id: matchedId, item });
    }
  });

  const toDelete = unmatched
    .map((row) => row._id || row.id)
    .filter(Boolean);

  if (
    String(remoteNotes) !== String(exerciseNotes || "") &&
    toUpdate.length === 0 &&
    toCreate.length === 0
  ) {
    const keeper = remote.find((row) => !toDelete.includes(row._id || row.id));
    const keeperId = keeper?._id || keeper?.id;
    if (keeperId) {
      const item =
        desiredExercises.find((row) => String(row._id) === String(keeperId)) ||
        desiredExercises[0] ||
        keeper;
      toUpdate.push({ id: keeperId, item });
    }
  }

  for (const exerciseId of toDelete) {
    await deletePhysiotherapyExercise(caseId, sessionId, exerciseId);
  }
  for (const item of toCreate) {
    const body = { ...item };
    delete body._id;
    await addPhysiotherapyExercise(caseId, sessionId, {
      ...body,
      exerciseNotes,
    });
  }
  for (const entry of toUpdate) {
    const body = { ...entry.item };
    delete body._id;
    await updatePhysiotherapyExercise(caseId, sessionId, entry.id, {
      ...body,
      exerciseNotes,
    });
  }
};

/**
 * Delete a session
 */
export const deletePhysiotherapySession = async (caseId, sessionId) => {
  try {
    const res = await axios.delete(
      `${baseurl}physiotherapy/session/${caseId}/${sessionId}`,
      {
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  } catch (error) {
    console.error("Error deleting physiotherapy session:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to delete session"
    );
  }
};

/**
 * Add clinical note to case
 */
export const addPhysiotherapyNote = async (caseId, noteData) => {
  try {
    const isFormData =
      typeof FormData !== "undefined" && noteData instanceof FormData;
    const res = await axios.post(
      `${baseurl}physiotherapy/notes/${caseId}`,
      noteData,
      {
        headers: getAuthHeaders(isFormData),
      }
    );
    return res.data;
  } catch (error) {
    console.error("Error adding clinical note:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to add clinical note"
    );
  }
};

/**
 * Upload rehab document(s) to case
 */
export const uploadPhysiotherapyDocuments = async (caseId, formData) => {
  try {
    const res = await axios.post(
      `${baseurl}physiotherapy/documents/${caseId}`,
      formData,
      {
        headers: getAuthHeaders(true),
      }
    );
    return res.data;
  } catch (error) {
    console.error("Error uploading physiotherapy documents:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to upload document"
    );
  }
};

// Clinical Category Options
export const PHYSIO_CATEGORIES = [
  "Orthopedic",
  "Neurological",
  "Post-Op Rehab",
  "Post-Operative Rehab",
  "Sports Injury",
  "Spine & Back Care",
  "Pediatric",
  "Geriatric",
  "Cardiopulmonary",
  "General",
  "Other",
];

// Status Options
export const PHYSIO_STATUSES = [
  "Referred",
  "Assessment Pending",
  "In Progress",
  "Completed",
  "On Hold",
  "Cancelled",
];

// Priority Options
export const PHYSIO_PRIORITIES = ["Normal", "Urgent", "High", "Low"];

// Modalities Options
export const PHYSIO_MODALITIES = [
  "Cryotherapy (Ice Pack)",
  "Heat Therapy / Moist Heat",
  "TENS (Electrical Stimulation)",
  "Ultrasound Therapy",
  "Traction (Cervical / Lumbar)",
  "Manual Joint Mobilization",
  "Myofascial Release",
  "Laser Therapy",
  "Dry Needling",
  "Kinesio Taping",
  "Resistance Band Exercises",
  "Static Cycling",
];

const LOCAL_ASSIGNMENTS_STORAGE_KEY = "physio_patient_assignments_cache";

export const getStoredPhysioAssignments = () => {
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const storePhysioAssignment = (patientKey, therapistObj) => {
  if (!patientKey) return;
  try {
    const current = getStoredPhysioAssignments();
    current[String(patientKey).trim().toLowerCase()] = {
      ...therapistObj,
      assignedAt: new Date().toISOString(),
    };
    localStorage.setItem(
      LOCAL_ASSIGNMENTS_STORAGE_KEY,
      JSON.stringify(current),
    );
  } catch (e) {
    console.warn("Could not cache physio assignment:", e);
  }
};

export const removeStoredPhysioAssignment = (patientKey) => {
  if (!patientKey) return;
  try {
    const current = getStoredPhysioAssignments();
    delete current[String(patientKey).trim().toLowerCase()];
    localStorage.setItem(
      LOCAL_ASSIGNMENTS_STORAGE_KEY,
      JSON.stringify(current),
    );
  } catch (e) {
    console.warn("Could not remove cached physio assignment:", e);
  }
};

const normalizeStaffUser = (item = {}) => {
  const userId =
    item.userId ||
    item._id ||
    item.id ||
    item.user_id ||
    item.staffId ||
    "";
  const phone =
    item.phone ||
    (item.phone_no
      ? `${item.phoneCode || item.dial_code ? (item.phoneCode || item.dial_code) + " " : ""}${item.phone_no}`
      : "");

  return {
    userId,
    _id: userId,
    name: item.name || item.fullName || "Physiotherapist",
    email: item.email || "",
    role: item.role || "Physiotherapist",
    phone,
    phoneCode: item.phoneCode || item.dial_code || "",
    profileImage: item.profileImage || item.profile_pic || "",
    country: item.country || "",
    status: item.status ?? 1,
  };
};

/**
 * Stage 1: Quick Mark Patient from Patient List
 * POST /api/physiotherapy/assign/:patientId
 * Request Body: {} (Empty body or send nothing)
 * Headers: Authorization: Bearer <token>
 * What it does: Marks patient.needsPhysiotherapy = true so the patient now appears in the create form dropdown.
 */
export const quickMarkPatientNeedPhysio = async (patientParam) => {
  if (!patientParam) {
    throw new Error("Patient identifier is missing.");
  }
  const patient = typeof patientParam === "object" ? patientParam : null;
  const candidates = [
    typeof patientParam === "string" || typeof patientParam === "number"
      ? String(patientParam).trim()
      : null,
    patient?.patientNumber,
    patient?.patientId,
    patient?._id,
    patient?.patientObjectId,
    patient?.id,
  ]
    .filter(Boolean)
    .map((k) => String(k).trim())
    .filter((k) => k && k !== "[object Object]" && k !== "undefined" && k !== "null")
    .filter((k, idx, arr) => arr.indexOf(k) === idx);

  if (candidates.length === 0) {
    throw new Error("Patient identifier is missing.");
  }

  let lastError = null;
  for (const cleanId of candidates) {
    const endpoints = [
      `${baseurl}physiotherapy/assign/${encodeURIComponent(cleanId)}`,
      `${baseurl}assign_patient_to_physiotherapist/${encodeURIComponent(cleanId)}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await axios.post(url, {}, { headers: getAuthHeaders() });
        if (res.data?.success || res.status === 200 || res.status === 201) {
          return res.data;
        }
      } catch (err) {
        lastError = err;
        if (err.response?.status === 404 || err.response?.status === 405) {
          continue;
        }
        throw (
          err.response?.data?.message ||
          err.message ||
          "Failed to mark patient for physiotherapy"
        );
      }
    }
  }

  throw (
    lastError?.response?.data?.message ||
    lastError?.message ||
    "Failed to mark patient for physiotherapy"
  );
};

export const markPatientNeedsPhysiotherapy = quickMarkPatientNeedPhysio;

/**
 * Stage 2: Get Physiotherapy Staff / Doctor Dropdown
 * GET /api/physiotherapy/staff
 * Response: { success: true, data: [ { _id, userId, name, role } ] }
 */
export const fetchPhysiotherapyStaff = async () => {
  const endpoints = [
    `${baseurl}physiotherapy/staff`,
    `${baseurl}get_physiotherapy_staffs`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      const rawList =
        res.data?.data ||
        res.data?.staff ||
        res.data?.staffs ||
        (Array.isArray(res.data) ? res.data : []);

      if (Array.isArray(rawList) && rawList.length > 0) {
        const staffList = rawList.map(normalizeStaffUser);
        return {
          success: true,
          data: staffList,
          physioStaff: staffList,
          allStaff: staffList,
        };
      }
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 405) {
        console.warn(`Error fetching from ${url}:`, err.message);
      }
    }
  }

  // Fallback: fetch from /get_all_user_staffs and filter by physiotherapy role
  try {
    const res = await axios.get(`${baseurl}get_all_user_staffs`, {
      params: { page: 1, limit: 10 },
      headers: getAuthHeaders(),
    });
    const all = res?.data?.Details || res?.data?.details || [];
    const normalizedAll = all.map(normalizeStaffUser);
    const physioOnly = normalizedAll.filter((s) => {
      const r = String(s.role || "").toLowerCase();
      return r.includes("physio") || r.includes("therap") || r.includes("rehab");
    });

    const staffList = physioOnly.length > 0 ? physioOnly : normalizedAll;
    return {
      success: true,
      data: staffList,
      physioStaff: staffList,
      allStaff: normalizedAll,
    };
  } catch (error) {
    console.error("Error fetching staff list for physiotherapy:", error);
    throw (
      error.response?.data?.message ||
      error.message ||
      "Failed to load staff list"
    );
  }
};

/**
 * 2. Assign Patient to Physiotherapist (From Patient Listing Row Icon)
 * POST /assign_patient_to_physiotherapist/:patientId
 * (alias POST /physiotherapy/assign/:patientId)
 */
export const assignPatientToPhysiotherapist = async ({
  patient,
  therapist,
  notes = "Assigned for physiotherapy rehabilitation",
  clinicalDiagnosis = "",
  category = "General",
  priority = "Normal",
  prescribedSessions = 10,
  sessionFrequency = "Daily",
}) => {
  const patientId =
    patient?.patientId ||
    patient?.patientNumber ||
    patient?._id ||
    patient?.id;

  if (!patientId) {
    throw new Error("Patient identifier is missing.");
  }

  const therapistId =
    therapist?.userId ||
    therapist?._id ||
    therapist?.id ||
    therapist?.staffId;

  if (!therapistId) {
    throw new Error("Physiotherapist selection is required.");
  }

  const therapistObj = {
    userId: therapistId,
    _id: therapistId,
    name: therapist.name || "Physiotherapist",
    email: therapist.email || "",
    role: therapist.role || "Physiotherapist",
    phone: therapist.phone || therapist.phone_no || "",
  };

  const body = {
    assignedPhysiotherapy: therapistId,
    assignedPhysiotherapist: therapistObj,
    assignedPhysio: therapistId,
    physiotherapistId: therapistId,
    category: category || "General",
    clinicalDiagnosis: clinicalDiagnosis || "Physiotherapy Rehabilitation",
    prescribedSessions: Number(prescribedSessions) || 10,
    sessionFrequency: sessionFrequency || "Daily",
    priority: priority || "Normal",
    notes: notes || "Patient assigned for post-op rehab",
  };

  const primaryEndpoints = [
    `${baseurl}physiotherapy/assign/${encodeURIComponent(patientId)}`,
    `${baseurl}assign_patient_to_physiotherapist/${encodeURIComponent(patientId)}`,
  ];

  if (patient?._id && patient._id !== patientId) {
    primaryEndpoints.push(
      `${baseurl}physiotherapy/assign/${encodeURIComponent(patient._id)}`
    );
    primaryEndpoints.push(
      `${baseurl}assign_patient_to_physiotherapist/${encodeURIComponent(patient._id)}`
    );
  }

  let assignedData = null;
  for (const url of primaryEndpoints) {
    try {
      const res = await axios.post(url, body, { headers: getAuthHeaders() });
      if (res.data?.success || res.status === 200 || res.status === 201) {
        assignedData = res.data?.data || res.data;
        break;
      }
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 405) {
        // If server replied with real error (e.g. 400 or 500)
        console.warn(`Endpoint ${url} failed with:`, err.response?.data || err.message);
      }
    }
  }

  // Fallback 2: Check existing case or create new referral case
  if (!assignedData) {
    try {
      const history = await fetchPhysiotherapyByPatient(patientId);
      const existingCase = Array.isArray(history) ? history[0] : history?.data?.[0];
      if (existingCase?._id) {
        assignedData = await updatePhysiotherapyCase(existingCase._id, {
          assignedPhysiotherapist: therapistObj,
          notes,
          status: existingCase.status === "Completed" ? "In Progress" : (existingCase.status || "Referred"),
        });
      } else {
        assignedData = await createPhysiotherapyReferral({
          patientId: String(patientId),
          patientObjectId: patient?._id || "",
          patientName: patient?.patient_name || patient?.name || "",
          clinicalDiagnosis: clinicalDiagnosis || "Physiotherapy Rehab",
          referralReason: notes || "Assigned for physiotherapy",
          category: "General",
          priority,
          prescribedSessions: Number(prescribedSessions) || 10,
          sessionFrequency,
          startDate: new Date().toISOString().split("T")[0],
          assignedPhysiotherapist: therapistObj,
          status: "Referred",
        });
      }
    } catch (fallbackErr) {
      console.warn("Fallback physiotherapy referral creation error:", fallbackErr);
    }
  }

  // Cache locally for immediate instantaneous client UI responsiveness
  storePhysioAssignment(patientId, therapistObj);
  if (patient?.patientNumber) storePhysioAssignment(patient.patientNumber, therapistObj);
  if (patient?._id) storePhysioAssignment(patient._id, therapistObj);

  return {
    success: true,
    data: assignedData,
    therapist: therapistObj,
  };
};

/**
 * 6. Complete / Update Physiotherapy
 * PUT /physiotherapy/update/:id (alias POST /physiotherapy/update/:id)
 */
export const completePhysiotherapyCase = async (
  caseId,
  notes = "Rehabilitation course completed"
) => {
  const body = {
    status: "Completed",
    notes,
  };

  const endpoints = [
    { method: "put", url: `${baseurl}physiotherapy/update/${caseId}` },
    { method: "post", url: `${baseurl}physiotherapy/update/${caseId}` },
    { method: "put", url: `${baseurl}physiotherapy/${caseId}` },
  ];

  for (const { method, url } of endpoints) {
    try {
      const res = await axios({
        method,
        url,
        data: body,
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 405) {
        throw err;
      }
    }
  }
  throw new Error("Failed to complete physiotherapy case");
};

/**
 * Unassign Physiotherapist from a patient
 * Option A (Recommended): POST /api/physiotherapy/unassign/:patientId
 *   URL: POST https://mobappssolutiondevelopment.com/omca_crm/api/physiotherapy/unassign/OMCA26091030
 *   Body: { "status": "Completed", "notes": "Physiotherapist unassigned" }
 * Option B (Update with Patient ID): PUT /api/physiotherapy/update/:patientId
 *   URL: PUT https://mobappssolutiondevelopment.com/omca_crm/api/physiotherapy/update/6ab119b45806a885ffe78c71
 *   Body: { "assignedPhysiotherapist": null, "notes": "Physiotherapist unassigned" }
 */
export const unassignPatientFromPhysiotherapist = async (params = {}) => {
  const patient =
    params.patient ||
    (typeof params === "string" || typeof params === "number" ? params : null);
  const explicitPatientId = params.patientId || params.patientNumber;
  const explicitPatientObjectId = params.patientObjectId;
  const notes = params.notes || "Physiotherapist unassigned";

  // Collect ONLY patient identifiers (patientNumber like OMCA26091030, or patient MongoDB _id like 6ab119b45806a885ffe78c71).
  // Strictly avoid physiotherapy case document _id (e.g. 6ac5dc443b543324eecee677).
  const patientCandidates = [];

  if (typeof params === "string" || typeof params === "number") {
    patientCandidates.push(String(params).trim());
  }

  if (explicitPatientId) {
    if (typeof explicitPatientId === "string" || typeof explicitPatientId === "number") {
      patientCandidates.push(String(explicitPatientId).trim());
    } else if (typeof explicitPatientId === "object") {
      if (explicitPatientId.patientNumber) patientCandidates.push(String(explicitPatientId.patientNumber).trim());
      if (explicitPatientId.patientId) patientCandidates.push(String(explicitPatientId.patientId).trim());
      if (explicitPatientId._id) patientCandidates.push(String(explicitPatientId._id).trim());
    }
  }

  if (explicitPatientObjectId) {
    patientCandidates.push(String(explicitPatientObjectId).trim());
  }

  if (patient && typeof patient === "object") {
    // 1. Patient Number (e.g. OMCA26091030) - top priority
    if (patient.patientNumber) {
      patientCandidates.push(String(patient.patientNumber).trim());
    }
    if (patient.patientId && typeof patient.patientId === "string") {
      patientCandidates.push(String(patient.patientId).trim());
    } else if (patient.patientId && typeof patient.patientId === "object") {
      if (patient.patientId.patientNumber) patientCandidates.push(String(patient.patientId.patientNumber).trim());
      if (patient.patientId._id) patientCandidates.push(String(patient.patientId._id).trim());
      if (patient.patientId.patientId) patientCandidates.push(String(patient.patientId.patientId).trim());
    }

    // 2. Patient nested object if a case object was mistakenly passed
    if (patient.patient && typeof patient.patient === "object") {
      if (patient.patient.patientNumber) patientCandidates.push(String(patient.patient.patientNumber).trim());
      if (patient.patient.patientId) patientCandidates.push(String(patient.patient.patientId).trim());
      if (patient.patient._id) patientCandidates.push(String(patient.patient._id).trim());
    }

    if (patient.patientObjectId) {
      patientCandidates.push(String(patient.patientObjectId).trim());
    }

    // 3. Patient MongoDB _id (ONLY when patient is a patient document, not a case document)
    const isLikelyCaseDoc = Boolean(
      patient.category ||
      patient.prescribedSessions ||
      patient.clinicalDiagnosis ||
      patient.sessionFrequency
    );
    if (!isLikelyCaseDoc && patient._id) {
      patientCandidates.push(String(patient._id).trim());
    }
  }

  const rawIds = patientCandidates
    .filter(Boolean)
    .map((k) => String(k).trim())
    .filter((k) => k && k !== "[object Object]" && k !== "undefined" && k !== "null")
    .filter((k, idx, arr) => arr.indexOf(k) === idx);

  if (rawIds.length === 0) {
    throw new Error("Patient identifier is missing for unassigning physiotherapy.");
  }

  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const headers = {
    Authorization: token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : "",
    "Content-Type": "application/json",
  };

  let lastError = null;

  // Option A (Recommended): POST /api/physiotherapy/unassign/:patientId
  for (const pid of rawIds) {
    const urls = [
      `${baseurl}physiotherapy/unassign/${encodeURIComponent(pid)}`,
      `${baseurl}unassign_physiotherapy/${encodeURIComponent(pid)}`,
    ];
    for (const url of urls) {
      try {
        const res = await axios.post(
          url,
          { status: "Completed", notes },
          { headers }
        );
        if (res.data?.success || res.status === 200 || res.status === 201) {
          rawIds.forEach(removeStoredPhysioAssignment);
          return res.data;
        }
      } catch (err) {
        lastError = err;
        if (err.response?.status === 404 || err.response?.status === 405) {
          continue;
        }
      }
    }
  }

  // Option B: PUT /api/physiotherapy/update/:patientId
  for (const pid of rawIds) {
    const urls = [
      `${baseurl}physiotherapy/update/${encodeURIComponent(pid)}`,
      `${baseurl}physiotherapy/${encodeURIComponent(pid)}`,
      `${baseurl}update_physiotherapy/${encodeURIComponent(pid)}`,
    ];
    for (const url of urls) {
      try {
        const res = await axios.put(
          url,
          { assignedPhysiotherapist: null, notes },
          { headers }
        );
        if (res.data?.success || res.status === 200 || res.status === 201) {
          rawIds.forEach(removeStoredPhysioAssignment);
          return res.data;
        }
      } catch (err) {
        lastError = err;
        if (err.response?.status === 404 || err.response?.status === 405) {
          continue;
        }
      }
    }
  }

  // Clear local storage cache regardless
  rawIds.forEach(removeStoredPhysioAssignment);

  if (lastError && lastError.response?.status !== 404) {
    throw (
      lastError.response?.data?.message ||
      lastError.message ||
      "Failed to unassign physiotherapist"
    );
  }

  return { success: true, message: "Physiotherapist unassigned successfully" };
};

export const unassignPhysiotherapyPatient = unassignPatientFromPhysiotherapist;

/**
 * Fetch all physiotherapy cases mapping by patient identifier
 */
export const fetchPhysioAssignmentsMap = async () => {
  try {
    const res = await fetchPhysiotherapyPatients({ limit: 5000 });
    const list = Array.isArray(res?.data) ? res.data : [];
    const map = {};

    list.forEach((item) => {
      const p = item?.patient;
      const rawPid = item?.patientId;
      const keys = [
        typeof rawPid === "string" ? rawPid : null,
        typeof rawPid === "object" ? (rawPid?.patientNumber || rawPid?._id) : null,
        item.patientNumber,
        item.patientObjectId,
        typeof p === "object" ? (p?.patientNumber || p?._id) : null,
      ]
        .filter(Boolean)
        .map((k) => String(k).trim().toLowerCase())
        .filter((k) => k && k !== "[object object]" && k !== "undefined" && k !== "null");

      keys.forEach((key) => {
        if (!map[key]) {
          map[key] = item;
        }
      });
    });

    return map;
  } catch (error) {
    console.warn("Error fetching physio cases mapping:", error);
    return {};
  }
};

/**
 * Search assigned physiotherapy patients for Create / Refer Modal
 * Endpoint: GET /physiotherapy/assigned-patients
 * Aliases: GET /physiotherapy/search-assigned-patients, GET /get_physiotherapy_assigned_patients
 * Scoping:
 * - Physiotherapist logged-in: filters only patients actively assigned to them (needsPhysiotherapy: true && assignedPhysiotherapist.userId == loggedInUserId)
 * - Admin/CRM: returns all active patients flagged for physiotherapy (needsPhysiotherapy: true)
 * - Excludes soft-deleted patients (isDeleted: true)
 */
export const fetchAssignedPhysiotherapyPatients = async ({ search = "", page = 1, limit = 10 } = {}) => {
  try {
    const params = new URLSearchParams();
    if (page) params.append("page", String(page));
    if (limit) params.append("limit", String(limit));
    const queryStr = String(search || "").trim();
    if (queryStr) {
      params.append("search", queryStr);
      params.append("q", queryStr);
    }

    const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
    const headers = {
      Authorization: token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : "",
      "Content-Type": "application/json",
    };

    const endpoints = [
      `${baseurl}physiotherapy/assigned-patients?${params.toString()}`,
      `${baseurl}physiotherapy/search-assigned-patients?${params.toString()}`,
      `${baseurl}get_physiotherapy_assigned_patients?${params.toString()}`,
    ];

    let lastError = null;
    for (const url of endpoints) {
      try {
        const res = await axios.get(url, { headers });
        const payload = res?.data;
        const rawList =
          payload?.data ||
          payload?.patients ||
          payload?.assignedPatients ||
          (Array.isArray(payload) ? payload : []);
        const data = Array.isArray(rawList) ? rawList : [];
        return {
          success: true,
          data,
          count: payload?.count ?? data.length,
          pagination: payload?.pagination || {
            totalRecords: payload?.totalRecords || data.length,
            currentPage: page,
            totalPages: payload?.pagination?.totalPages || 1,
            limit,
          },
        };
      } catch (err) {
        lastError = err;
        if (err?.response?.status === 404) {
          continue;
        }
        break;
      }
    }

    throw (
      lastError?.response?.data?.message ||
      lastError?.message ||
      "Failed to load assigned physiotherapy patients"
    );
  } catch (error) {
    console.error("Error fetching assigned physiotherapy patients:", error);
    throw (
      error?.response?.data?.message ||
      error?.message ||
      (typeof error === "string" ? error : "Failed to load assigned patients")
    );
  }
};

/**
 * Formats any disease value (string, object with disease_name, or array) into a readable string
 */
export const formatDiseaseName = (val) => {
  if (!val && val !== 0) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    return val
      .map(formatDiseaseName)
      .filter(Boolean)
      .join(", ");
  }
  if (typeof val === "object") {
    return String(
      val.disease_name ||
        val.treatment_name ||
        val.treatment ||
        val.name ||
        val.title ||
        val.label ||
        val.disease ||
        ""
    ).trim();
  }
  return "";
};

/**
 * Normalizes assigned patient records from GET /physiotherapy/assigned-patients
 */
export const normalizeAssignedPhysioPatient = (p) => {
  if (!p || typeof p !== "object") return p;
  const rawId = p.patientId || p.patientNumber || p.patient_id || p.displayId || "";
  const objectId = p.patientObjectId || p._id || p.id || "";
  const name = p.patient_name || p.name || p.patientName || "Patient";

  let phone = String(p.phone || p.mobile || p.emergency_contact_no || "").trim();
  const phoneCode = String(p.phoneCode || p.dial_code || "").trim();
  if (phoneCode && phone && !phone.startsWith(phoneCode)) {
    phone = `${phoneCode} ${phone}`;
  }

  const extractDiseaseStrings = (raw) => {
    if (!raw && raw !== 0) return [];
    if (typeof raw === "string") return [raw.trim()];
    if (Array.isArray(raw)) {
      return raw.map(formatDiseaseName).filter(Boolean);
    }
    if (typeof raw === "object") {
      const formatted = formatDiseaseName(raw);
      return formatted ? [formatted] : [];
    }
    return [];
  };

  const diseases = Array.from(
    new Set([
      ...extractDiseaseStrings(p.disease),
      ...extractDiseaseStrings(p.patient_disease),
      ...extractDiseaseStrings(p.disease_name),
    ])
  );

  return {
    ...p,
    _id: objectId || rawId,
    patientObjectId: objectId || p._id,
    patientId: rawId || objectId,
    patientNumber: p.patientNumber || rawId,
    displayId: rawId || objectId,
    name,
    patient_name: name,
    phone,
    country: p.country || p.nationality || "",
    town: p.town || p.city || "",
    email: p.email || "",
    disease: diseases,
    patient_disease: diseases,
    disease_name: diseases.join(", "),
    displayDisease: diseases[0] || "",
    needsPhysiotherapy: p.needsPhysiotherapy ?? true,
    physiotherapyStatus: p.physiotherapyStatus || "Referred",
    assignedPhysiotherapist: p.assignedPhysiotherapist || null,
    source: p.assignedPhysiotherapist?.name
      ? `Assigned: ${p.assignedPhysiotherapist.name}`
      : "Needs Physio",
  };
};

/**
 * Direct search function compatible with PatientSearchSelect
 */
export const searchAssignedPhysiotherapyPatients = async (query = "", { limit = 10 } = {}) => {
  const result = await fetchAssignedPhysiotherapyPatients({ search: query, limit });
  const rawList = Array.isArray(result?.data) ? result.data : [];
  return rawList.map(normalizeAssignedPhysioPatient);
};

const REMOVED_SESSION_ATTACHMENTS_KEY = "physio_removed_session_attachments";

export const getRemovedSessionAttachmentsMap = () => {
  try {
    const raw = localStorage.getItem(REMOVED_SESSION_ATTACHMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const normalizeAttKey = (val) => {
  if (!val) return "";
  const raw =
    typeof val === "string"
      ? val
      : (val?.fileName || val?.filename || val?.name || val?.file || val?.filePath || val?.url || "");
  let str = String(raw).trim();
  try {
    str = decodeURIComponent(str);
  } catch {}
  return str.split(/[/\\]/).pop().trim().toLowerCase();
};

export const markSessionAttachmentsRemoved = (sessionKeys, attachmentList) => {
  if (!sessionKeys || !attachmentList || attachmentList.length === 0) return;
  try {
    const store = getRemovedSessionAttachmentsMap();
    const keys = (Array.isArray(sessionKeys) ? sessionKeys : [sessionKeys])
      .filter(Boolean)
      .map((k) => String(k).trim());

    const normalizedNames = attachmentList.map(normalizeAttKey).filter(Boolean);

    keys.forEach((k) => {
      const existing = Array.isArray(store[k]) ? store[k] : [];
      normalizedNames.forEach((n) => {
        if (!existing.includes(n)) existing.push(n);
      });
      store[k] = existing;
    });

    localStorage.setItem(REMOVED_SESSION_ATTACHMENTS_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Could not persist removed session attachments:", e);
  }
};

export const filterActiveSessionAttachments = (attachments, session, caseId) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const store = getRemovedSessionAttachmentsMap();

  const keys = [
    session?._id,
    session?.sessionId,
    session?.id,
    typeof session === "string" ? session : null,
    caseId && session?.sessionNumber != null ? `${caseId}_${session.sessionNumber}` : null,
  ].filter(Boolean).map((k) => String(k).trim());

  const removedSet = new Set();
  keys.forEach((k) => {
    if (Array.isArray(store[k])) {
      store[k].forEach((n) => removedSet.add(n));
    }
  });

  if (removedSet.size === 0) return attachments;

  return attachments.filter((att) => {
    const key = normalizeAttKey(att);
    return !removedSet.has(key);
  });
};

export const isImageFile = (docOrPath) => {
  if (!docOrPath) return false;
  const raw =
    typeof docOrPath === "string"
      ? docOrPath
      : docOrPath?.fileName ||
        docOrPath?.filename ||
        docOrPath?.file ||
        docOrPath?.filePath ||
        docOrPath?.url ||
        docOrPath?.name ||
        "";
  return /\.(jpe?g|png|webp|gif|bmp|svg|jfif|avif)$/i.test(String(raw).split("?")[0]);
};

export const isPdfFile = (docOrPath) => {
  if (!docOrPath) return false;
  const raw =
    typeof docOrPath === "string"
      ? docOrPath
      : docOrPath?.fileName ||
        docOrPath?.filename ||
        docOrPath?.file ||
        docOrPath?.filePath ||
        docOrPath?.url ||
        docOrPath?.name ||
        "";
  return /\.pdf$/i.test(String(raw).split("?")[0]);
};

export const getPhysioFileUrl = (docOrPath) => {
  if (!docOrPath) return "";

  const rawPath =
    typeof docOrPath === "string"
      ? docOrPath
      : (docOrPath?.file ||
        docOrPath?.filePath ||
        docOrPath?.filepath ||
        docOrPath?.fileUrl ||
        docOrPath?.file_url ||
        docOrPath?.path ||
        docOrPath?.url ||
        docOrPath?.document ||
        docOrPath?.documentUrl ||
        docOrPath?.fileName ||
        docOrPath?.filename ||
        docOrPath?.attachment ||
        docOrPath?.location ||
        (typeof docOrPath?.name === "string" && /\.(pdf|jpg|jpeg|png|webp|gif|docx?|xlsx?)$/i.test(docOrPath.name) ? docOrPath.name : "") ||
        "");

  if (!rawPath || typeof rawPath !== "string") return "";
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined" || trimmed === "#") return "";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  const cleanPath = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
  const base = (imageUrl || "").endsWith("/") ? imageUrl : `${imageUrl || ""}/`;
  if (cleanPath.startsWith("uploads/") || cleanPath.startsWith("public/")) {
    return `${base}${cleanPath}`;
  }
  return `${base}uploads/${cleanPath}`;
};

const REMOVED_CASE_DOCUMENTS_KEY = "physio_removed_case_documents";

export const getRemovedCaseDocumentsMap = () => {
  try {
    const raw = localStorage.getItem(REMOVED_CASE_DOCUMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const markCaseDocumentsRemoved = (caseId, docList = []) => {
  if (!caseId || !Array.isArray(docList) || docList.length === 0) return;
  try {
    const store = getRemovedCaseDocumentsMap();
    const cId = String(caseId).trim();
    const existing = Array.isArray(store[cId]) ? store[cId] : [];

    docList.forEach((d) => {
      const keys = [
        d?._id,
        d?.id,
        d?.file,
        d?.fileName,
        d?.documentName,
        typeof d === "string" ? d : null,
      ]
        .filter(Boolean)
        .map((k) => normalizeAttKey(k));

      keys.forEach((k) => {
        if (k && !existing.includes(k)) existing.push(k);
      });
    });

    store[cId] = existing;
    localStorage.setItem(REMOVED_CASE_DOCUMENTS_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Could not persist removed case documents:", e);
  }
};

export const filterActiveCaseDocuments = (documents, caseId) => {
  if (!Array.isArray(documents) || documents.length === 0) return [];
  if (!caseId) return documents;
  const store = getRemovedCaseDocumentsMap();
  const cId = String(caseId).trim();
  const removedList = Array.isArray(store[cId]) ? store[cId] : [];
  if (removedList.length === 0) return documents;

  const removedSet = new Set(removedList);

  return documents.filter((doc) => {
    const keys = [
      doc?._id,
      doc?.id,
      doc?.file,
      doc?.fileName,
      doc?.documentName,
      typeof doc === "string" ? doc : null,
    ]
      .filter(Boolean)
      .map((k) => normalizeAttKey(k));

    for (const k of keys) {
      if (k && removedSet.has(k)) return false;
    }
    return true;
  });
};

/**
 * ----------------------------------------------------
 * Physiotherapy Case Payment APIs (Manual Record System)
 * ----------------------------------------------------
 */

/**
 * 1. Set or update decided fee for physiotherapy case
 * PUT /physiotherapy/:id/payment-decide (fallback /physiotherapy/:id/payment/fee)
 */
export const setPhysiotherapyDecidedAmount = async (caseId, decidedAmount) => {
  if (!caseId) throw new Error("Case ID is required");
  const cleanId = encodeURIComponent(String(caseId).trim());
  const body = { decidedAmount: Number(decidedAmount) || 0 };

  const endpoints = [
    `${baseurl}physiotherapy/${cleanId}/payment-decide`,
    `${baseurl}physiotherapy/${cleanId}/payment/fee`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const res = await axios.put(url, body, { headers: getAuthHeaders() });
      return res.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

/**
 * 2. Add payment record given to physiotherapist
 * POST /physiotherapy/:id/payment-record (fallback /physiotherapy/:id/payment/add)
 */
export const addPhysiotherapyPaymentRecord = async (caseId, paymentData) => {
  if (!caseId) throw new Error("Case ID is required");
  const cleanId = encodeURIComponent(String(caseId).trim());

  const endpoints = [
    `${baseurl}physiotherapy/${cleanId}/payment-record`,
    `${baseurl}physiotherapy/${cleanId}/payment/add`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const res = await axios.post(url, paymentData, { headers: getAuthHeaders() });
      return res.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

/**
 * 3. Fetch physiotherapy payment details and payment history
 * GET /physiotherapy/:id/payment-details (fallback /physiotherapy/:id/payment)
 */
export const getPhysiotherapyPaymentDetails = async (caseId) => {
  if (!caseId) throw new Error("Case ID is required");
  const cleanId = encodeURIComponent(String(caseId).trim());

  const endpoints = [
    `${baseurl}physiotherapy/${cleanId}/payment-details`,
    `${baseurl}physiotherapy/${cleanId}/payment`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      return res.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

/**
 * 4. Delete individual payment record
 * DELETE /physiotherapy/:id/payment-record/:recordId
 */
export const deletePhysiotherapyPaymentRecord = async (caseId, recordId) => {
  if (!caseId || !recordId) throw new Error("Case ID and Record ID are required");
  const cleanCaseId = encodeURIComponent(String(caseId).trim());
  const cleanRecordId = encodeURIComponent(String(recordId).trim());

  const res = await axios.delete(
    `${baseurl}physiotherapy/${cleanCaseId}/payment-record/${cleanRecordId}`,
    { headers: getAuthHeaders() }
  );
  return res.data;
};




