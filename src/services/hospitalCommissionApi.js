import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import { getToken } from "../utils/authStorage";

const API_BASE = baseurl.endsWith("/") ? baseurl : `${baseurl}/`;

const getAuthHeaders = () => {
  const token = getToken() || localStorage.getItem("token") || "";
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const cleanParams = (params = {}) => {
  const cleaned = {};
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && String(val).trim() !== "" && val !== "ALL") {
      cleaned[key] = typeof val === "string" ? val.trim() : val;
    }
  });
  return cleaned;
};

const triggerBlobDownload = (blobData, filename) => {
  const blob = new Blob([blobData], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ============================================================
// SECTION 1: Hospital Commission % Master
// ============================================================

export const fetchHospitalCommissionMaster = async (params = {}) => {
  const response = await axios.get(`${API_BASE}hospital-commission/master`, {
    params: cleanParams(params),
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateHospitalCommission = async (hospitalId, payload) => {
  const response = await axios.put(
    `${API_BASE}hospital-commission/master/${encodeURIComponent(hospitalId)}`,
    payload,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const bulkUpdateHospitalCommission = async (payload) => {
  const response = await axios.put(
    `${API_BASE}hospital-commission/master-bulk`,
    payload,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const resetHospitalCommission = async (hospitalId) => {
  const response = await axios.post(
    `${API_BASE}hospital-commission/master/${encodeURIComponent(hospitalId)}/reset`,
    {},
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// ============================================================
// SECTION 2: OMCA Commission Report & Tracking
// ============================================================

export const fetchHospitalCommissionReport = async (params = {}) => {
  const response = await axios.get(`${API_BASE}hospital-commission/report`, {
    params: cleanParams(params),
    headers: getAuthHeaders(),
  });
  return response.data;
};

// ============================================================
// SECTION 3: Payments Received (Audit & Recording)
// ============================================================

export const addHospitalCommissionPayment = async (payload) => {
  const response = await axios.post(
    `${API_BASE}hospital-commission/add-payment`,
    payload,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const fetchHospitalCommissionPaymentRecords = async (params = {}) => {
  const response = await axios.get(`${API_BASE}hospital-commission/payment-records`, {
    params: cleanParams(params),
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteHospitalCommissionPaymentRecord = async (recordId) => {
  const response = await axios.delete(
    `${API_BASE}hospital-commission/payment-record/${encodeURIComponent(recordId)}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// ============================================================
// SECTION 4: Excel Exports
// ============================================================

export const exportHospitalCommissionReport = async (params = {}) => {
  const response = await axios.get(`${API_BASE}hospital-commission/report-export`, {
    params: cleanParams(params),
    headers: getAuthHeaders(),
    responseType: "blob",
  });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  triggerBlobDownload(response.data, `omca_hospital_commission_report_${ts}.xlsx`);
};

export const exportHospitalCommissionMaster = async (params = {}) => {
  const response = await axios.get(`${API_BASE}hospital-commission/master-export`, {
    params: cleanParams(params),
    headers: getAuthHeaders(),
    responseType: "blob",
  });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  triggerBlobDownload(response.data, `hospital_commission_master_${ts}.xlsx`);
};
