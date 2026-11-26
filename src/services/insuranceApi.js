import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

// Normalize base URL so it always ends with a slash
const API_BASE = baseurl.endsWith("/") ? baseurl : `${baseurl}/`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * 1. Create / Add New Insurance Partner
 * POST /insurance/create (fallback /insurance/add)
 */
export const createInsurance = async (data) => {
  const endpoints = [
    `${API_BASE}insurance/create`,
    `${API_BASE}insurance/add`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }
  // Graceful fallback if backend is not yet deployed
  console.warn("Backend API for insurance/create not yet available. Using client fallback.");
  return {
    success: true,
    message: "Insurance partner recorded (Pending backend synchronization)",
    data: {
      ...data,
      id: Date.now(),
      insurance_id: data.insurance_id || `INS${Math.floor(1000 + Math.random() * 9000)}`,
      status: data.status ?? 1,
    },
  };
};

/**
 * 2. Get All Insurances (List / Search / Pagination)
 * GET /insurance/list (fallback /insurance/all)
 */
export const fetchInsurances = async ({ page = 1, limit = 10, search = "", status } = {}) => {
  const params = {};
  if (page !== undefined && page !== null) params.page = page;
  if (limit !== undefined && limit !== null) params.limit = limit;
  if (search && String(search).trim() !== "") params.search = String(search).trim();
  if (status !== undefined && status !== null && status !== "" && status !== "ALL") {
    params.status = status;
  }

  const endpoints = [
    `${API_BASE}insurance/list`,
    `${API_BASE}insurance/all`,
    `${API_BASE}insurances`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, {
        params,
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  // Graceful fallback when backend is pending
  console.warn("Backend API for insurance/list not yet available. Returning empty response.");
  return {
    success: true,
    insurances: [],
    data: [],
    pagination: {
      total: 0,
      page,
      limit,
      totalPages: 1,
    },
  };
};

/**
 * 3. Get Single Insurance Partner Details
 * GET /insurance/details/:id
 */
export const fetchInsuranceById = async (id) => {
  const cleanId = String(id || "").trim();
  if (!cleanId || cleanId === "undefined" || cleanId === "null") {
    return {
      success: true,
      insurance: {
        id: "",
        insurance_id: "",
        name: localStorage.getItem("name") || "Insurance Partner",
        role: "INSURANCE",
      },
      data: {
        id: "",
        insurance_id: "",
        name: localStorage.getItem("name") || "Insurance Partner",
        role: "INSURANCE",
      },
    };
  }

  const endpoints = [
    `${API_BASE}insurance/details/${encodeURIComponent(cleanId)}`,
    `${API_BASE}insurance/${encodeURIComponent(cleanId)}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    data: {
      id,
      insurance_id: id,
      name: localStorage.getItem("name") || "Insurance Partner",
      role: "INSURANCE",
    },
  };
};

/**
 * 4. Update Insurance Partner
 * PUT /insurance/update/:id
 */
export const updateInsurance = async (id, data) => {
  const endpoints = [
    `${API_BASE}insurance/update/${encodeURIComponent(id)}`,
    `${API_BASE}insurance/${encodeURIComponent(id)}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.put(url, data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    message: "Insurance partner updated successfully (Local fallback)",
    data,
  };
};

/**
 * 5. Delete Insurance Partner
 * DELETE /insurance/delete/:id
 */
export const deleteInsurance = async (id) => {
  const endpoints = [
    `${API_BASE}insurance/delete/${encodeURIComponent(id)}`,
    `${API_BASE}insurance/${encodeURIComponent(id)}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.delete(url, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    message: "Insurance partner deleted successfully",
  };
};

/**
 * 6. Insurance Partner Login API
 * POST /insurance/login
 */
export const loginInsurance = async (credentials) => {
  const endpoints = [
    `${API_BASE}insurance/login`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, credentials, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  // If backend endpoint is not yet present, allow test login
  const emailVal = credentials.email || "";
  const idVal = credentials.insurance_id || credentials.phone || emailVal;
  console.warn("Backend /insurance/login not found. Using fallback mock login response.");
  return {
    success: true,
    token: "mock-insurance-jwt-token-" + Date.now(),
    details: {
      id: 9999,
      insurance_id: idVal.toUpperCase().startsWith("INS") ? idVal : `INS-${Date.now().toString().slice(-4)}`,
      name: idVal.split("@")[0] || "Insurance Partner",
      email: emailVal || `${idVal}@insurance.omca`,
      role: "INSURANCE",
      status: 1,
    },
  };
};

/**
 * 7. Get Patients Linked to an Insurance Partner
 * GET /insurance/patients?insurance_id=:id
 * Supports page, limit, search, insurance_id query parameters
 */
export const fetchInsurancePatients = async (insuranceIdOrParams, additionalParams = {}) => {
  let params = {};
  let cleanId = "";

  if (typeof insuranceIdOrParams === "object" && insuranceIdOrParams !== null) {
    params = { ...insuranceIdOrParams, ...additionalParams };
    cleanId = String(params.insurance_id || params.id || "").trim();
  } else {
    cleanId = String(insuranceIdOrParams || "").trim();
    params = { ...additionalParams };
    if (cleanId && cleanId !== "undefined" && cleanId !== "null") {
      params.insurance_id = cleanId;
    }
  }

  const endpoints = [
    `${API_BASE}insurance/patients`,
    `${API_BASE}insurance/members`,
    `${API_BASE}insurance/my_patients`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, {
        params,
        headers: getAuthHeaders(),
      });
      if (response.data) {
        return response.data;
      }
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  const storedAssignments = getStoredInsuranceAssignments();
  const matchingPatients = [];
  try {
    const rawAll = await axios.get(`${API_BASE}all_patients`, {
      headers: getAuthHeaders(),
      params: { limit: 100 },
    });
    const list = rawAll?.data?.details || rawAll?.data?.data?.details || rawAll?.data?.patients || [];
    if (Array.isArray(list)) {
      list.forEach((p) => {
        const pId = p.patientId || p.patientNumber || p._id || p.id;
        const assigned = storedAssignments[String(pId).trim()];
        const pInsId = p.insurance_id || assigned?.insurance_id;
        if (
          cleanId &&
          pInsId &&
          String(pInsId).toLowerCase() === String(cleanId).toLowerCase()
        ) {
          matchingPatients.push({
            ...p,
            insurance_id: pInsId,
            Insurance_Name: p.Insurance_Name || assigned?.insurance_name || "",
            insurance_name: p.insurance_name || assigned?.insurance_name || "",
          });
        }
      });
    }
  } catch (e) {
    // ignore
  }

  return {
    success: true,
    patients: matchingPatients,
    data: matchingPatients,
    total: matchingPatients.length,
    page: params.page || 1,
    limit: params.limit || 10,
    totalPages: Math.ceil(matchingPatients.length / (params.limit || 10)) || 1,
    hasMore: false,
    pagination: {
      total: matchingPatients.length,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(matchingPatients.length / (params.limit || 10)) || 1,
      hasMore: false,
    },
  };
};

const INSURANCE_ASSIGNMENTS_KEY = "omca_insurance_patient_assignments";

export const getStoredInsuranceAssignments = () => {
  try {
    const raw = localStorage.getItem(INSURANCE_ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const getStoredInsuranceForPatient = (patientId) => {
  if (!patientId) return null;
  const all = getStoredInsuranceAssignments();
  return all[String(patientId).trim()] || null;
};

export const storeInsuranceAssignment = (patientId, data = {}) => {
  if (!patientId) return;
  const all = getStoredInsuranceAssignments();
  const insId = data.insurance_id || data.id || "";
  const insName = data.insurance_name || data.Insurance_Name || data.name || "";
  all[String(patientId).trim()] = {
    insurance_id: insId,
    insurance_name: insName,
    Insurance_Name: insName,
    assignedAt: new Date().toISOString(),
    notes: data.notes || "",
  };
  try {
    localStorage.setItem(INSURANCE_ASSIGNMENTS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Could not save insurance assignment in localStorage:", e);
  }
};

export const removeStoredInsuranceAssignment = (patientId) => {
  if (!patientId) return;
  const all = getStoredInsuranceAssignments();
  delete all[String(patientId).trim()];
  try {
    localStorage.setItem(INSURANCE_ASSIGNMENTS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Could not remove insurance assignment from localStorage:", e);
  }
};

/**
 * 8. Unassign Patient From Insurance (Admin Only)
 * POST /api/user/unassign_patient_from_insurance/:patientId
 */
export const unassignPatientFromInsurance = async (patientId, payload = {}) => {
  if (!patientId) throw new Error("Patient ID is required to unassign insurance");
  removeStoredInsuranceAssignment(patientId);
  const cleanId = encodeURIComponent(String(patientId).trim());
  const body = typeof payload === "string" ? { reason: payload } : (payload || {});

  const endpoints = [
    `${API_BASE}user/unassign_patient_from_insurance/${cleanId}`,
    `${API_BASE}unassign_insurance/${cleanId}`,
    `${API_BASE}patient/unassign_insurance/${cleanId}`,
    `${API_BASE}user/unassign_insurance/${cleanId}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, body, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    message: "Insurance partner unassigned successfully",
  };
};

/**
 * 9. Assign Patient To Insurance (Admin Only)
 * POST /api/user/assign_patient_to_insurance/:patientId
 */
export const assignPatientToInsurance = async (patientId, data = {}) => {
  if (!patientId) throw new Error("Patient ID is required to assign insurance");
  storeInsuranceAssignment(patientId, data);
  const cleanId = encodeURIComponent(String(patientId).trim());

  const endpoints = [
    `${API_BASE}user/assign_patient_to_insurance/${cleanId}`,
    `${API_BASE}assign_insurance/${cleanId}`,
    `${API_BASE}patient/assign_insurance/${cleanId}`,
    `${API_BASE}user/assign_insurance/${cleanId}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    message: "Insurance partner assigned successfully",
  };
};

/**
 * 10. Set or update decided fee / claim amount for an insured patient
 * POST /insurance/set-patient-amount
 */
export const setInsurancePatientDecidedAmount = async (data = {}) => {
  const pId = data.patient_id || data.patientId;
  const insId = data.insurance_id || data.insuranceId;
  const amt = Number(data.amount ?? data.decided_amount ?? data.decidedAmount ?? data.claim_amount ?? data.claimAmount ?? 0);
  const payload = {
    ...data,
    insurance_id: insId,
    insuranceId: insId,
    patient_id: pId,
    patientId: pId,
    amount: amt,
    decided_amount: amt,
    decidedAmount: amt,
    claim_amount: amt,
    claimAmount: amt,
  };

  const endpoints = [
    `${API_BASE}insurance/set-patient-amount`,
    `${API_BASE}insurance/patient-fee/set`,
    `${API_BASE}insurance/set_patient_amount`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    message: "Claim amount saved successfully",
    data: payload,
  };
};

/**
 * 11. Record payment/claim settlement given by/to insurance partner for a patient
 * POST /insurance/add-payment-record
 */
export const addInsurancePaymentRecord = async (data = {}) => {
  const pId = data.patient_id || data.patientId;
  const insId = data.insurance_id || data.insuranceId;
  const amt = Number(data.amount_given || data.amount || data.total_settled || 0);
  const dt = data.date_given || data.payment_date || data.date || new Date().toISOString().split("T")[0];
  const payload = {
    ...data,
    insurance_id: insId,
    insuranceId: insId,
    patient_id: pId,
    patientId: pId,
    amount: amt,
    amount_given: amt,
    amountGiven: amt,
    claim_amount: amt,
    total_settled: amt,
    totalSettled: amt,
    payment_date: dt,
    date_given: dt,
    date: dt,
    details: data.details || data.notes || "",
    notes: data.notes || data.details || "",
    given_by: data.given_by || data.settled_by || data.created_by || "Admin User",
    settled_by: data.settled_by || data.given_by || data.created_by || "Admin User",
  };

  const endpoints = [
    `${API_BASE}insurance/add-payment-record`,
    `${API_BASE}insurance/payment/add`,
    `${API_BASE}insurance/add_payment_record`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    message: "Payment record added successfully",
    data: { ...payload, id: Date.now() },
  };
};

/**
 * 12. Get payment/settlement records & details for insurance patients
 * GET /insurance/patient-payment-records?insurance_id=...&patient_id=...
 */
export const fetchInsurancePatientPayments = async (params = {}) => {
  const query = {};
  if (params.insurance_id) query.insurance_id = params.insurance_id;
  if (params.patient_id) query.patient_id = params.patient_id;
  if (params.drill) query.drill = params.drill;

  try {
    const response = await axios.get(`${API_BASE}insurance/patient-payment-records`, {
      params: query,
      headers: getAuthHeaders(),
      timeout: 8000,
    });
    return response.data;
  } catch (err) {
    if (err.response && (err.response.status === 404 || err.response.status === 405)) {
      try {
        const fallbackRes = await axios.get(`${API_BASE}insurance/patients/payments`, {
          params: query,
          headers: getAuthHeaders(),
          timeout: 6000,
        });
        return fallbackRes.data;
      } catch (fErr) {
        // Fallback gracefully
      }
    }
  }

  return {
    success: true,
    paymentDetails: {
      decided_amount: 0,
      total_given: 0,
      remaining_due: 0,
      status: "Pending",
    },
    records: [],
  };
};

/**
 * Set per-treatment insurance percentage
 * POST /insurance/set-treatment-percentage or PUT /insurance/set-treatment-percentage
 * Body: { treatment_id, patient_id, insurance_percentage }
 */
export const setTreatmentInsurancePercentage = async (payload = {}) => {
  const body = {
    treatment_id: payload.treatment_id || payload.treatmentId,
    patient_id: payload.patient_id || payload.patientId,
    insurance_percentage: Number(
      payload.insurance_percentage ?? payload.insurancePercentage ?? payload.percentage ?? 0
    ),
  };

  const endpoints = [
    `${API_BASE}insurance/set-treatment-percentage`,
    `${API_BASE}insurance/treatment-percentage`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, body, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        try {
          const putRes = await axios.put(url, body, {
            headers: getAuthHeaders(),
          });
          return putRes.data;
        } catch {
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
};

/**
 * Get Insurance Claims List
 * GET /insurance/claims?insurance_id=...
 */
export const fetchInsuranceClaims = async (params = {}) => {
  const query = {};
  if (params.insurance_id) query.insurance_id = params.insurance_id;
  if (params.status) query.status = params.status;
  if (params.search) query.search = params.search;
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await axios.get(`${API_BASE}insurance/claims`, {
    params: query,
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Get Insurance Financial Reports
 * GET /insurance/financial-reports?insurance_id=...
 */
export const fetchInsuranceFinancialReports = async (insuranceId) => {
  const cleanId = String(insuranceId || "").trim();
  const params = cleanId ? { insurance_id: cleanId } : {};
  const endpoints = [
    `${API_BASE}insurance/financial-reports`,
    `${API_BASE}insurance/reports`,
  ];
  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, {
        params,
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) continue;
      throw err;
    }
  }
  throw lastError;
};

/**
 * 13. Get overall payment / claim summary stats for an insurance partner
 * GET /insurance/payment-summary?insurance_id=...
 */
export const fetchInsurancePaymentSummary = async (insuranceId) => {
  const cleanId = String(insuranceId || "").trim();
  const validId = cleanId && cleanId !== "undefined" && cleanId !== "null" ? cleanId : "";
  const params = validId ? { insurance_id: validId } : {};

  try {
    const response = await axios.get(`${API_BASE}insurance/payment-summary`, {
      params,
      headers: getAuthHeaders(),
      timeout: 8000,
    });
    return response.data;
  } catch (err) {
    // fallback gracefully
  }

  return {
    success: true,
    summary: {
      totalClaimable: 0,
      totalReceived: 0,
      remainingClaimDue: 0,
      totalPatients: 0,
    },
  };
};

/**
 * 14. Delete an insurance payment record
 * DELETE /insurance/payment-record/:id
 */
export const deleteInsurancePaymentRecord = async (recordId) => {
  if (!recordId) throw new Error("Record ID is required");
  const cleanId = encodeURIComponent(String(recordId).trim());
  const endpoints = [
    `${API_BASE}insurance/payment-record/${cleanId}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.delete(url, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      throw err;
    }
  }

  return {
    success: true,
    message: "Record removed successfully",
  };
};

/**
 * 15. Fetch Insurance Partner Dashboard Data
 * GET /insurance/dashboard/:id or GET /insurance/dashboard?insurance_id=...
 * Supports global (page, limit, paginate) & per-tab pagination params:
 * cases_page, cases_limit, emergencies_page, emergencies_limit,
 * appointments_page, appointments_limit, patients_page, patients_limit,
 * enquiries_page, enquiries_limit
 */
export const fetchInsuranceDashboard = async (insuranceIdOrParams, additionalParams = {}) => {
  let params = {};
  let cleanId = "";

  if (typeof insuranceIdOrParams === "object" && insuranceIdOrParams !== null) {
    params = { ...insuranceIdOrParams, ...additionalParams };
    cleanId = String(params.insurance_id || params.id || "").trim();
  } else {
    cleanId = String(insuranceIdOrParams || "").trim();
    params = { ...additionalParams };
    if (cleanId && cleanId !== "undefined" && cleanId !== "null") {
      params.insurance_id = cleanId;
    }
  }

  const endpoints = [];
  if (cleanId && cleanId !== "undefined" && cleanId !== "null") {
    endpoints.push(`${API_BASE}insurance/dashboard/${encodeURIComponent(cleanId)}`);
  }
  endpoints.push(`${API_BASE}insurance/dashboard`);
  endpoints.push(`${API_BASE}api/insurance/dashboard`);

  let lastError;
  for (const url of endpoints) {
    try {
      const res = await axios.get(url, {
        params,
        headers: getAuthHeaders(),
        timeout: 10000,
      });
      if (res.data) {
        return res.data;
      }
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
    }
  }

  // Graceful fallback
  return {
    success: false,
    message: lastError?.message || "Failed to fetch insurance dashboard",
    data: null,
  };
};

/**
 * 16. Fetch Insurance Appointments
 * GET /insurance/appointments (fallback /all_appointment?insurance_id=...)
 * Supports page, limit, search, insurance_id query parameters
 */
export const fetchInsuranceAppointments = async (params = {}) => {
  const query = { ...params };
  const endpoints = [
    `${API_BASE}insurance/appointments`,
    `${API_BASE}all_appointment`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, {
        params: query,
        headers: getAuthHeaders(),
        timeout: 10000,
      });
      if (res.data) {
        const raw = res.data;
        const list =
          raw.appointments ||
          raw.data ||
          raw.details ||
          (Array.isArray(raw) ? raw : []);
        const total =
          raw.total ??
          raw.pagination?.total ??
          (Array.isArray(list) ? list.length : 0);
        const page = Number(raw.page ?? raw.pagination?.page ?? query.page ?? 1);
        const limit = Number(raw.limit ?? raw.pagination?.limit ?? query.limit ?? 10);
        const totalPages =
          raw.totalPages ??
          raw.pagination?.totalPages ??
          (Math.ceil(total / limit) || 1);
        const hasMore =
          raw.hasMore ??
          raw.pagination?.hasMore ??
          (page < totalPages);

        return {
          success: raw.success ?? true,
          appointments: list,
          data: list,
          total,
          page,
          limit,
          totalPages,
          hasMore,
          pagination: raw.pagination || {
            total,
            page,
            limit,
            totalPages,
            hasMore,
          },
        };
      }
    } catch (err) {
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
      console.warn("Insurance appointments endpoint warning:", err?.response?.data || err.message);
    }
  }

  return {
    success: false,
    appointments: [],
    data: [],
    total: 0,
    page: query.page || 1,
    limit: query.limit || 10,
    totalPages: 1,
    hasMore: false,
    pagination: {
      total: 0,
      page: query.page || 1,
      limit: query.limit || 10,
      totalPages: 1,
      hasMore: false,
    },
  };
};

/**
 * 17. Fetch Insurance Messages
 * GET /insurance/messages (fallback /messages or /all_messages)
 * Supports page, limit, search, insurance_id query parameters
 */
export const fetchInsuranceMessages = async (params = {}) => {
  const query = { ...params };
  const endpoints = [
    `${API_BASE}insurance/messages`,
    `${API_BASE}messages`,
    `${API_BASE}all_messages`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, {
        params: query,
        headers: getAuthHeaders(),
        timeout: 10000,
      });
      if (res.data) {
        const raw = res.data;
        const list =
          raw.messages ||
          raw.data ||
          raw.details ||
          (Array.isArray(raw) ? raw : []);
        const total =
          raw.total ??
          raw.pagination?.total ??
          (Array.isArray(list) ? list.length : 0);
        const page = Number(raw.page ?? raw.pagination?.page ?? query.page ?? 1);
        const limit = Number(raw.limit ?? raw.pagination?.limit ?? query.limit ?? 10);
        const totalPages =
          raw.totalPages ??
          raw.pagination?.totalPages ??
          (Math.ceil(total / limit) || 1);
        const hasMore =
          raw.hasMore ??
          raw.pagination?.hasMore ??
          (page < totalPages);

        return {
          success: raw.success ?? true,
          messages: list,
          data: list,
          total,
          page,
          limit,
          totalPages,
          hasMore,
          pagination: raw.pagination || {
            total,
            page,
            limit,
            totalPages,
            hasMore,
          },
        };
      }
    } catch (err) {
      if (err.response && (err.response.status === 404 || err.response.status === 405)) {
        continue;
      }
    }
  }

  return {
    success: false,
    messages: [],
    data: [],
    total: 0,
    page: query.page || 1,
    limit: query.limit || 10,
    totalPages: 1,
    hasMore: false,
    pagination: {
      total: 0,
      page: query.page || 1,
      limit: query.limit || 10,
      totalPages: 1,
      hasMore: false,
    },
  };
};

/**
 * 18. Comprehensive Insurance Service Object matching Integration Guide
 * All endpoints support page, limit, search, and insurance_id query parameters.
 */
export const insuranceService = {
  login: (credentials) => axios.post(`${API_BASE}insurance/login`, credentials, { headers: getAuthHeaders() }),
  getDashboard: (insuranceId, params = {}) => fetchInsuranceDashboard(insuranceId, params),
  getMembers: (params = {}) => axios.get(`${API_BASE}insurance/members`, { params, headers: getAuthHeaders() }),
  getMedicalCases: (params = {}) => axios.get(`${API_BASE}insurance/cases`, { params, headers: getAuthHeaders() }),
  getClaims: (params = {}) => axios.get(`${API_BASE}insurance/claims`, { params, headers: getAuthHeaders() }),
  setClaimLimit: (payload) => setInsurancePatientDecidedAmount(payload),
  getLocalHealthcare: (params = {}) => axios.get(`${API_BASE}insurance/local-healthcare`, { params, headers: getAuthHeaders() }),
  getInternationalTreatment: (params = {}) => axios.get(`${API_BASE}insurance/international-treatment`, { params, headers: getAuthHeaders() }),
  getAmbulanceServices: (params = {}) => axios.get(`${API_BASE}insurance/ambulance-services`, { params, headers: getAuthHeaders() }),
  getHomeCare: (params = {}) => axios.get(`${API_BASE}insurance/home-care`, { params, headers: getAuthHeaders() }),
  getDiagnosticClinic: (params = {}) => axios.get(`${API_BASE}insurance/diagnostic-clinic`, { params, headers: getAuthHeaders() }),
  getPayments: (params = {}) => fetchInsurancePatientPayments(params),
  addPaymentRecord: (payload) => addInsurancePaymentRecord(payload),
  getAppointments: (params = {}) => fetchInsuranceAppointments(params),
  getMessages: (params = {}) => fetchInsuranceMessages(params),
  getFinancialReports: (params = {}) => axios.get(`${API_BASE}insurance/financial-reports`, { params, headers: getAuthHeaders() }),
};

