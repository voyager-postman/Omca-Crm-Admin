import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import { getToken } from "../utils/authStorage";

const API_BASE = baseurl.endsWith("/") ? baseurl : `${baseurl}/`;

const getAuthHeaders = () => {
  const token = getToken() || localStorage.getItem("token") || "";
  return token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : {};
};

const cleanParams = (params = {}) => {
  const cleaned = {};
  Object.entries(params).forEach(([key, val]) => {
    if (
      val !== undefined &&
      val !== null &&
      String(val).trim() !== "" &&
      !(key === "status" && val === "all")
    ) {
      cleaned[key] = typeof val === "string" ? val.trim() : val;
    }
  });
  return cleaned;
};

export const gopService = {
  // 1. Fetch GOP list with filters
  getAllGopPayments: async (params = {}) => {
    const response = await axios.get(`${API_BASE}gop-payments`, {
      params: cleanParams(params),
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // 2. Fetch single GOP details
  getGopPaymentDetails: async (treatmentId, paymentId) => {
    const response = await axios.get(
      `${API_BASE}gop-payments/${encodeURIComponent(treatmentId)}/${encodeURIComponent(paymentId)}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  // 3. Step 1: Approve (Indicator Only - does not deduct dues)
  approveGopPayment: async (treatmentId, paymentId, { approvalNotes, files = [] } = {}) => {
    const formData = new FormData();
    if (approvalNotes) formData.append("approvalNotes", approvalNotes);
    Array.from(files || []).forEach((file) => formData.append("files", file));

    const response = await axios.post(
      `${API_BASE}approve_gop_payment/${encodeURIComponent(treatmentId)}/${encodeURIComponent(paymentId)}`,
      formData,
      {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  // 4. Step 2: Settle (Officially deducts amount from total dues)
  settleGopPayment: async (treatmentId, paymentId, { deductionNotes, files = [] } = {}) => {
    const formData = new FormData();
    if (deductionNotes) formData.append("deductionNotes", deductionNotes);
    Array.from(files || []).forEach((file) => formData.append("files", file));

    const response = await axios.post(
      `${API_BASE}settle_gop_payment/${encodeURIComponent(treatmentId)}/${encodeURIComponent(paymentId)}`,
      formData,
      {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  // 5. Reject GOP Payment
  rejectGopPayment: async (treatmentId, paymentId, rejectionNotes) => {
    const response = await axios.post(
      `${API_BASE}reject_gop_payment/${encodeURIComponent(treatmentId)}/${encodeURIComponent(paymentId)}`,
      { rejectionNotes },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  // 6. Add New GOP Payment
  addGopPayment: async (treatmentId, formData) => {
    const response = await axios.post(
      `${API_BASE}add_gop_payment/${encodeURIComponent(treatmentId)}`,
      formData,
      {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },
};
