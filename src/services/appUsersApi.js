import axios from "axios";
import { AdminBaseUrl, baseurl } from "../Basurl/Baseurl";

export const APP_USER_ALLOWED_STATUSES = [
  "Pending",
  "Follow-up",
  "Close",
  "Connected",
  "Not Connected",
  "Just A User",
];

/**
 * 2. Get User Statuses Dropdown Options API
 * GET {{BASE_URL}}/api/crm/user/statuses
 * Fallback: {{BASE_URL}}/api/crm/user_statuses
 */
export const fetchUserStatuses = async () => {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await axios.get(`${AdminBaseUrl}user/statuses`, { headers });
    if (
      (res?.data?.success === "true" || res?.data?.success === true) &&
      Array.isArray(res?.data?.data) &&
      res.data.data.length > 0
    ) {
      return res.data.data;
    }
  } catch (err1) {
    try {
      const res2 = await axios.get(`${AdminBaseUrl}user_statuses`, { headers });
      if (
        (res2?.data?.success === "true" || res2?.data?.success === true) &&
        Array.isArray(res2?.data?.data) &&
        res2.data.data.length > 0
      ) {
        return res2.data.data;
      }
    } catch (err2) {
      // fallback to static list
    }
  }

  return APP_USER_ALLOWED_STATUSES;
};

/**
 * 3. CRM Patients List Filter Example (patients_without_omca_id)
 * Endpoint: /api/crm/patients_without_omca_id?status=Pending...
 * Fallback: /api/crm/patients-without-omca-id
 */
export const fetchPatientsWithoutOmcaId = async ({
  page = 1,
  perPage = 10,
  search = "",
  country = "",
  patient_status = "",
  status = "",
  p_status = "",
  mode = "patient_id",
  source = "users", // "users" for Mobile App / MySQL Users without OMCA ID
  sort_by = "createdAt",
  sort_order = "desc",
} = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const statusVal = status !== "" && status != null ? status : patient_status;

  const params = {
    page,
    per_page: perPage,
    ...(search ? { search: search.trim() } : {}),
    ...(country ? { country } : {}),
    ...(statusVal && statusVal !== "all" && statusVal !== "All"
      ? { status: statusVal, patient_status: statusVal }
      : {}),
    ...(p_status ? { p_status } : {}),
    mode,
    source,
    sort_by,
    sort_order,
  };

  // Primary URL is AdminBaseUrl (https://omcacrm.com/omca/api/crm/)
  const primaryUrl = `${AdminBaseUrl}patients_without_omca_id`;
  const alternateUrl = `${AdminBaseUrl}patients-without-omca-id`;
  const fallbackBaseUrl = `${baseurl}crm/patients_without_omca_id`;

  let response = null;
  let lastError = null;

  try {
    response = await axios.get(primaryUrl, { params, headers, timeout: 15000 });
  } catch (err1) {
    lastError = err1;
    // Try alternate endpoint
    try {
      response = await axios.get(alternateUrl, { params, headers, timeout: 15000 });
    } catch (err2) {
      lastError = err2;
      // Try fallback URL
      try {
        response = await axios.get(fallbackBaseUrl, { params, headers, timeout: 15000 });
      } catch (err3) {
        lastError = err3;
      }
    }
  }

  if (
    response?.data &&
    (response.data.success === "true" ||
      response.data.success === true ||
      response.status === 200)
  ) {
    const rawData = response.data;
    const items = Array.isArray(rawData.data) ? rawData.data : [];
    const pagination = rawData.pagination || {
      current_page: Number(page) || 1,
      per_page: Number(perPage) || 10,
      total: Number(rawData.total_count) || items.length,
      last_page: Math.max(
        1,
        Math.ceil((Number(rawData.total_count) || items.length) / (Number(perPage) || 10))
      ),
      has_more: false,
    };

    return {
      success: true,
      data: items,
      totalCount: Number(rawData.total_count) || pagination.total || items.length,
      pagination,
      message: rawData.message || "Data fetched successfully",
    };
  }

  // If error occurred or success is false
  const errMsg =
    response?.data?.message ||
    lastError?.response?.data?.message ||
    lastError?.message ||
    "Failed to fetch App Users";

  throw new Error(errMsg);
};

/**
 * 1. Update User Status API
 * Method: POST / PUT / PATCH
 * Endpoints:
 *   {{BASE_URL}}/api/crm/update_user_status
 *   {{BASE_URL}}/api/crm/user/status/update
 *
 * Parameters:
 *   user_id / id / patient_id: Integer (Yes)
 *   status: String (Yes) - In 6 me se koi ek: Pending, Follow-up, Close, Connected, Not Connected, Just A User
 *   reason: String (Optional) - Status change ka note ya remark (Max 500 characters)
 */
export const updateUserStatus = async ({ userId, status, reason = "" } = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const idNum = Number(userId) || userId;
  const statusStr = String(status || "").trim();
  const reasonStr = reason ? String(reason).trim().slice(0, 500) : "";

  const payload = {
    user_id: idNum,
    id: idNum,
    patient_id: idNum,
    status: statusStr,
    reason: reasonStr,
  };

  const endpoints = [
    `${AdminBaseUrl}user/update`,
    `${AdminBaseUrl}users/update`,
    `${AdminBaseUrl}app-user/update`,
    `${AdminBaseUrl}update_user_status`,
    `${AdminBaseUrl}user/status/update`,
    idNum ? `${AdminBaseUrl}user/${idNum}/update` : null,
    `${baseurl}crm/update_user_status`,
  ].filter(Boolean);
  let response = null;
  let lastError = null;

  for (const url of endpoints) {
    try {
      response = await axios.post(url, payload, { headers, timeout: 15000 });
      if (
        response?.data &&
        (response.data.success === "true" ||
          response.data.success === true ||
          response.status === 200)
      ) {
        return {
          success: true,
          message:
            response.data.message || `User status updated to ${statusStr} successfully.`,
          data: response.data.data,
        };
      }
    } catch (err) {
      lastError = err;
      // Also try PUT if POST gave 405
      if (err?.response?.status === 405) {
        try {
          response = await axios.put(url, payload, { headers, timeout: 15000 });
          if (
            response?.data &&
            (response.data.success === "true" ||
              response.data.success === true ||
              response.status === 200)
          ) {
            return {
              success: true,
              message:
                response.data.message || `User status updated to ${statusStr} successfully.`,
              data: response.data.data,
            };
          }
        } catch (putErr) {
          lastError = putErr;
        }
      }
    }
  }

  const errMsg =
    response?.data?.message ||
    lastError?.response?.data?.message ||
    lastError?.message ||
    "Failed to update user status";

  throw new Error(errMsg);
};

/**
 * 4. Update App User Details API (CRM)
 * Endpoints:
 *   POST|PUT|PATCH /api/crm/user/update
 *   POST|PUT|PATCH /api/crm/users/update
 *   POST|PUT|PATCH /api/crm/user/{id}/update
 *   POST|PUT|PATCH /api/crm/app-user/update
 *   POST|PUT|PATCH /api/crm/app-users/update
 *   POST|PUT|PATCH /api/crm/app-users/{id}/update
 *   POST|PUT|PATCH /api/crm/patient/update
 *   POST|PUT|PATCH /api/crm/patients/{id}/update
 */
export const updateAppUser = async (userData) => {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const id = userData?.id || userData?.user_id || userData?.patient_id;
  const numId = id != null && !isNaN(id) ? Number(id) : id;

  const rawPhoneCode = userData?.phone_code || userData?.country_code || userData?.dialCode || "";
  const rawPhone = userData?.phone || userData?.phone_number || "";

  const payload = {
    id: numId,
    user_id: numId,
    patient_id: numId,
    name: userData?.name ? String(userData.name).trim() : (userData?.patient_name ? String(userData.patient_name).trim() : ""),
    patient_name: userData?.name ? String(userData.name).trim() : (userData?.patient_name ? String(userData.patient_name).trim() : ""),
    email: userData?.email ? String(userData.email).trim() : "",
    phone_code: rawPhoneCode,
    country_code: rawPhoneCode,
    phone: rawPhone,
    phone_number: rawPhone,
    age: userData?.age ? (isNaN(userData.age) ? userData.age : Number(userData.age)) : "",
    gender: userData?.gender || "",
    treatment: userData?.treatment || userData?.treatment_ad_name || "",
    treatment_ad_name: userData?.treatment || userData?.treatment_ad_name || "",
    passport_number: userData?.passport_number || userData?.passport || "",
    omca_patient_id: userData?.omca_patient_id || userData?.patient_id_code || "",
    houseNo: userData?.houseNo || userData?.house_no || "",
    street: userData?.street || "",
    address: userData?.address || "",
    pinCode: userData?.pinCode || userData?.pincode || "",
    pincode: userData?.pinCode || userData?.pincode || "",
    status: userData?.status || userData?.crm_status || "Connected",
    crm_status: userData?.status || userData?.crm_status || "Connected",
    reason: userData?.reason || userData?.status_notes || userData?.notes || "",
    status_notes: userData?.reason || userData?.status_notes || userData?.notes || "",
    notes: userData?.reason || userData?.status_notes || userData?.notes || "",
  };

  if (userData?.city_id) payload.city_id = Number(userData.city_id);
  if (userData?.state_id) payload.state_id = Number(userData.state_id);

  const endpoints = [
    { method: "post", url: `${AdminBaseUrl}user/update` },
    { method: "post", url: `${AdminBaseUrl}users/update` },
    numId ? { method: "post", url: `${AdminBaseUrl}user/${numId}/update` } : null,
    { method: "post", url: `${AdminBaseUrl}app-user/update` },
    { method: "post", url: `${AdminBaseUrl}app-users/update` },
    numId ? { method: "post", url: `${AdminBaseUrl}app-users/${numId}/update` } : null,
    { method: "post", url: `${AdminBaseUrl}patient/update` },
    numId ? { method: "post", url: `${AdminBaseUrl}patients/${numId}/update` } : null,
    // Try PUT
    { method: "put", url: `${AdminBaseUrl}user/update` },
    numId ? { method: "put", url: `${AdminBaseUrl}user/${numId}/update` } : null,
    // Try PATCH
    { method: "patch", url: `${AdminBaseUrl}user/update` },
    numId ? { method: "patch", url: `${AdminBaseUrl}user/${numId}/update` } : null,
    // Alternate endpoints
    { method: "post", url: `${baseurl}crm/user/update` },
    { method: "post", url: `${baseurl}crm/update_user_status` },
  ].filter(Boolean);

  let lastError = null;
  for (const { method, url } of endpoints) {
    try {
      const res = await axios[method](url, payload, { headers, timeout: 15000 });
      if (
        res?.data &&
        (res.data.success === "true" ||
          res.data.success === true ||
          res.data.status === true ||
          res.status === 200)
      ) {
        return res.data;
      }
    } catch (err) {
      lastError = err;
      if (err.response?.status === 400 || err.response?.status === 422) {
        throw new Error(err.response?.data?.message || err.message || "Validation error updating app user");
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { success: true, message: "App user details updated successfully.", data: payload };
};

/**
 * 5. User Detail View: GET /api/crm/user/{id} ya GET /api/crm/app-user/{id}
 */
export const fetchAppUserDetail = async (userId) => {
  if (!userId) return null;
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const endpoints = [
    `${AdminBaseUrl}user/${userId}`,
    `${AdminBaseUrl}app-user/${userId}`,
    `${AdminBaseUrl}users/${userId}`,
    `${AdminBaseUrl}app-users/${userId}`,
    `${baseurl}crm/user/${userId}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers, timeout: 10000 });
      if (res?.data?.data) return res.data.data;
      if (res?.data?.user) return res.data.user;
      if (res?.data && typeof res.data === "object" && !res.data.error) return res.data;
    } catch (e) {
      // try next
    }
  }
  return null;
};
