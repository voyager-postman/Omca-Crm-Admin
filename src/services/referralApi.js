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
 * 1. Create / Add New Referral
 * POST /referral/create (fallback /referral/add)
 */
export const createReferral = async (data) => {
  try {
    const response = await axios.post(`${API_BASE}referral/create`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Try fallback endpoint
      const fallbackResponse = await axios.post(`${API_BASE}referral/add`, data, {
        headers: getAuthHeaders(),
      });
      return fallbackResponse.data;
    }
    throw err;
  }
};

/**
 * 2. Get All Referrals (List / Search / Pagination)
 * GET /referral/list (fallback /referral/all)
 */
export const fetchReferrals = async ({ page = 1, limit = 10, search = "", status } = {}) => {
  const params = {};
  if (page !== undefined && page !== null) params.page = page;
  if (limit !== undefined && limit !== null) params.limit = limit;
  if (search && String(search).trim() !== "") params.search = String(search).trim();
  if (status !== undefined && status !== null && status !== "" && status !== "ALL") {
    params.status = status;
  }

  try {
    const response = await axios.get(`${API_BASE}referral/list`, {
      params,
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Try fallback endpoint
      const fallbackResponse = await axios.get(`${API_BASE}referral/all`, {
        params,
        headers: getAuthHeaders(),
      });
      return fallbackResponse.data;
    }
    throw err;
  }
};

/**
 * 3. Get Single Referral Details
 * GET /referral/details/:id (id can be numeric id or referral_id like REF1001)
 */
export const fetchReferralById = async (id) => {
  const cleanId = String(id || "").trim();
  if (!cleanId || cleanId === "undefined" || cleanId === "null") {
    return {
      success: true,
      referral: {
        id: "",
        referral_id: "",
        name: localStorage.getItem("name") || "Referral Partner",
        role: "REFERRAL",
      },
      data: {
        id: "",
        referral_id: "",
        name: localStorage.getItem("name") || "Referral Partner",
        role: "REFERRAL",
      },
    };
  }
  const response = await axios.get(`${API_BASE}referral/details/${encodeURIComponent(cleanId)}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * 4. Update Referral Partner
 * PUT /referral/update/:id
 */
export const updateReferral = async (id, data) => {
  const response = await axios.put(`${API_BASE}referral/update/${encodeURIComponent(id)}`, data, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * 5. Delete Referral Partner
 * DELETE /referral/delete/:id
 */
export const deleteReferral = async (id) => {
  const response = await axios.delete(`${API_BASE}referral/delete/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * 6. Referral Partner Login API
 * POST /referral/login
 */
export const loginReferral = async (credentials) => {
  const response = await axios.post(`${API_BASE}referral/login`, credentials, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
};

/**
 * 7. Get Patients Linked to a Referral Partner
 * GET /referral/patients?referral_id=:id (fallback /referral/my_patients)
 */
export const fetchReferralPatients = async (referralIdOrParams, additionalParams = {}) => {
  let params = {};
  if (referralIdOrParams && typeof referralIdOrParams === "object") {
    params = { ...referralIdOrParams, ...additionalParams };
  } else {
    const cleanId = String(referralIdOrParams || "").trim();
    if (cleanId && cleanId !== "undefined" && cleanId !== "null") {
      params.referral_id = cleanId;
    }
    params = { ...params, ...additionalParams };
  }
  try {
    const response = await axios.get(`${API_BASE}referral/patients`, {
      params,
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Fallback
      const fallbackResponse = await axios.get(`${API_BASE}referral/my_patients`, {
        params,
        headers: getAuthHeaders(),
      });
      return fallbackResponse.data;
    }
    throw err;
  }
};

/**
 * 8. Unassign Patient From Referral (Admin Only)
 * POST /api/user/unassign_patient_from_referral/:patientId
 * (Aliases: /unassign_referral/:patientId, /patient/unassign_referral/:patientId, /user/unassign_patient_from_referral/:patientId)
 */
export const unassignPatientFromReferral = async (patientId, payload = {}) => {
  if (!patientId) throw new Error("Patient ID is required to unassign referral");
  const cleanId = encodeURIComponent(String(patientId).trim());
  const body = typeof payload === "string" ? { reason: payload } : (payload || {});

  const endpoints = [
    `${API_BASE}user/unassign_patient_from_referral/${cleanId}`,
    `${API_BASE}unassign_referral/${cleanId}`,
    `${API_BASE}patient/unassign_referral/${cleanId}`,
    `${API_BASE}user/unassign_referral/${cleanId}`,
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
  throw lastError;
};

/**
 * 9. Assign Patient To Referral (Admin Only)
 * POST /api/user/assign_patient_to_referral/:patientId
 * (Aliases: /assign_referral/:patientId, /patient/assign_referral/:patientId)
 */
export const assignPatientToReferral = async (patientId, data = {}) => {
  if (!patientId) throw new Error("Patient ID is required to assign referral");
  const cleanId = encodeURIComponent(String(patientId).trim());

  const endpoints = [
    `${API_BASE}user/assign_patient_to_referral/${cleanId}`,
    `${API_BASE}assign_referral/${cleanId}`,
    `${API_BASE}patient/assign_referral/${cleanId}`,
    `${API_BASE}user/assign_referral/${cleanId}`,
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
  throw lastError;
};

/**
 * ----------------------------------------------------
 * Referral Patient Payment APIs (Manual Record System)
 * ----------------------------------------------------
 */

/**
 * 10. Set or update decided fee for a referred patient
 * POST /referral/set-patient-amount (fallback /referral/patient-fee/set)
 * Body: { referral_id, patient_id, decided_amount }
 */
export const setReferralPatientDecidedAmount = async (data) => {
  const endpoints = [
    `${API_BASE}referral/set-patient-amount`,
    `${API_BASE}referral/patient-fee/set`,
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
  throw lastError;
};

/**
 * 11. Record payment given to referral partner for a patient
 * POST /referral/add-payment-record (fallback /referral/payment/add)
 * Body: { referral_id, patient_id, amount_given, date_given, details, given_by }
 */
export const addReferralPaymentRecord = async (data) => {
  const endpoints = [
    `${API_BASE}referral/add-payment-record`,
    `${API_BASE}referral/payment/add`,
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
  throw lastError;
};

/**
 * 12. Get payment records & payment details for referral patients
 * GET /referral/patient-payment-records?referral_id=...&patient_id=...
 * (fallback /referral/patients/payments)
 */
export const fetchReferralPatientPayments = async (params = {}) => {
  const query = {};
  if (params.referral_id) query.referral_id = params.referral_id;
  if (params.patient_id) query.patient_id = params.patient_id;
  if (params.drill) query.drill = params.drill;

  try {
    const response = await axios.get(`${API_BASE}referral/patient-payment-records`, {
      params: query,
      headers: getAuthHeaders(),
      timeout: 8000,
    });
    return response.data;
  } catch (err) {
    if (err.response && (err.response.status === 404 || err.response.status === 405)) {
      try {
        const fallbackRes = await axios.get(`${API_BASE}referral/patients/payments`, {
          params: query,
          headers: getAuthHeaders(),
          timeout: 6000,
        });
        return fallbackRes.data;
      } catch (fErr) {
        return { success: false, records: [] };
      }
    }
    return { success: false, records: [] };
  }
};

/**
 * 13. Get overall payment summary stats for a referral partner
 * GET /referral/payment-summary?referral_id=... (fallback /referral/payments/summary)
 */
export const fetchReferralPaymentSummary = async (referralId) => {
  const cleanId = String(referralId || "").trim();
  const validId = cleanId && cleanId !== "undefined" && cleanId !== "null" ? cleanId : "";
  const params = validId ? { referral_id: validId } : {};

  try {
    const response = await axios.get(`${API_BASE}referral/payment-summary`, {
      params,
      headers: getAuthHeaders(),
      timeout: 8000,
    });
    return response.data;
  } catch (err) {
    return { success: false, summary: null };
  }
};

/**
 * 14. Delete an incorrect referral payment record
 * DELETE /referral/payment-record/:id
 */
export const deleteReferralPaymentRecord = async (recordId) => {
  if (!recordId) throw new Error("Record ID is required");
  const cleanId = encodeURIComponent(String(recordId).trim());
  const response = await axios.delete(`${API_BASE}referral/payment-record/${cleanId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * 15. Set per-treatment referral commission percentage
 * POST /referral/set-treatment-percentage or PUT /referral/set-treatment-percentage
 * Body: { treatment_id, patient_id, commission_percentage }
 */
export const setTreatmentReferralPercentage = async (payload = {}) => {
  const body = {
    treatment_id: payload.treatment_id || payload.treatmentId,
    patient_id: payload.patient_id || payload.patientId,
    commission_percentage: Number(
      payload.commission_percentage ?? payload.commissionPercentage ?? payload.percentage ?? 0
    ),
  };

  const endpoints = [
    `${API_BASE}referral/set-treatment-percentage`,
    `${API_BASE}referral/treatment-percentage`,
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

