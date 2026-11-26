import axios from "axios";
import { AdminBaseUrl, AdminBaseUrl1 } from "../Basurl/Baseurl";

/**
 * Base URL resolution:
 * Uses AdminBaseUrl (https://omcacrm.com/omca/api/crm/) which has the routes:
 * /api/crm/guesthouse-services/ or /api/guesthouse-services/
 */
const getCleanBase = () => {
  const root = AdminBaseUrl?.endsWith("/")
    ? AdminBaseUrl
    : AdminBaseUrl
    ? `${AdminBaseUrl}/`
    : AdminBaseUrl1?.endsWith("/")
    ? AdminBaseUrl1
    : `${AdminBaseUrl1}/`;

  return `${root}guesthouse-services/`;
};

const getAuthHeaders = (isMultipart = false) => {
  const token = localStorage.getItem("token") || "";
  const headers = {
    Authorization: token ? `Bearer ${token}` : "",
  };
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

// Fallback in-memory / sessionStorage store for offline development
const STORAGE_KEY = "omca_gh_services_cache";

const getCachedRecords = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Error reading GH cache:", e);
  }
  return [];
};

/**
 * 1. GET /api/guesthouse-services/dashboard-stats
 */
export const fetchGHDashboardStats = async () => {
  try {
    const res = await axios.get(`${getCleanBase()}dashboard-stats`, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      const d = res.data.data || {};
      return {
        ...d,
        // Add aliases for backwards compatibility
        totalRecords: d.totalBookings ?? 0,
        activeRecords: d.inProcessBookings ?? 0,
        completedRecords: d.completedBookings ?? 0,
        totalBilling: Number(d.totalBilling) || 0,
        totalPaid: Number(d.totalPaid) || 0,
        totalDue: Number(d.totalDue) || 0,
        totalServicesCount: Number(d.totalServicesCount) || 0,
      };
    }
  } catch (err) {
    console.warn("GHDashboardStats API call failed, using fallback:", err.message);
  }

  // Fallback calculation from cache
  const records = getCachedRecords();
  const totalBookings = records.length;
  const inProcessBookings = records.filter(
    (r) => String(r.status).toLowerCase() === "in-process" || String(r.status).toLowerCase() === "active"
  ).length;
  const completedBookings = records.filter((r) => String(r.status).toLowerCase() === "completed").length;
  const bookingsWithServices = records.filter((r) => (r.services?.length || 0) > 0).length;
  const totalBilling = records.reduce((sum, r) => sum + (Number(r.services_final_amount || r.final_amount || r.totalAmount) || 0), 0);
  const totalPaid = records.reduce((sum, r) => sum + (Number(r.services_paid_amount || r.paidAmount) || 0), 0);
  const totalDue = records.reduce((sum, r) => sum + (Number(r.services_due_amount || r.dueAmount) || 0), 0);
  const totalServicesCount = records.reduce((sum, r) => sum + (r.services?.length || r.services_count || 0), 0);

  return {
    totalBookings,
    totalRecords: totalBookings,
    bookingsWithServices,
    inProcessBookings,
    activeRecords: inProcessBookings,
    completedBookings,
    completedRecords: completedBookings,
    totalBilling,
    totalPaid,
    totalDue,
    totalServicesCount,
  };
};

/**
 * 2. GET /api/guesthouse-services/catalog
 * Master Service Catalog templates
 */
export const fetchGHServiceCatalog = async () => {
  try {
    const res = await axios.get(`${getCleanBase()}catalog`, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      return Array.isArray(res.data.data) ? res.data.data : [];
    }
  } catch (err) {
    console.warn("fetchGHServiceCatalog API failed:", err.message);
  }

  // Fallback default catalog templates if offline
  return [
    {
      id: 1,
      service_code: "SVC-BRK",
      service_name: "Breakfast (Daily)",
      description: "Morning healthy breakfast",
      default_price: "250.00",
      duration: "Day",
      is_active: true,
    },
    {
      id: 2,
      service_code: "SVC-LUN",
      service_name: "Lunch (Dietary)",
      description: "Nutritious lunch meal",
      default_price: "350.00",
      duration: "Day",
      is_active: true,
    },
    {
      id: 3,
      service_code: "SVC-DIN",
      service_name: "Dinner",
      description: "Light patient/attendant dinner",
      default_price: "350.00",
      duration: "Day",
      is_active: true,
    },
    {
      id: 4,
      service_code: "SVC-LAU",
      service_name: "Laundry Service",
      description: "Washing and ironing of clothes",
      default_price: "200.00",
      duration: "One-Time",
      is_active: true,
    },
    {
      id: 5,
      service_code: "SVC-AIR",
      service_name: "Airport Transfer (Pickup/Drop)",
      description: "Dedicated cab transfer",
      default_price: "1500.00",
      duration: "One-Time",
      is_active: true,
    },
    {
      id: 6,
      service_code: "SVC-NUR",
      service_name: "Attendant / Caregiver",
      description: "In-room assistance caregiver",
      default_price: "1200.00",
      duration: "Day",
      is_active: true,
    },
    {
      id: 7,
      service_code: "SVC-WHL",
      service_name: "Wheelchair Assistance",
      description: "Wheelchair rental and support",
      default_price: "300.00",
      duration: "Day",
      is_active: true,
    },
    {
      id: 8,
      service_code: "SVC-DOC",
      service_name: "Doctor Room Visit",
      description: "Doctor consultation at guest house",
      default_price: "1000.00",
      duration: "One-Time",
      is_active: true,
    },
  ];
};

/**
 * 3. GET /api/guesthouse-services/list
 * Supports: search, user_id, guestHouse_id, status, date_from, date_to, only_with_services, page, limit
 */
export const fetchGHServicesList = async (params = {}) => {
  try {
    const query = new URLSearchParams();

    // Map query parameters cleanly for Laravel backend
    if (params.search) query.append("search", params.search);
    if (params.user_id || params.patientId) {
      let uId = params.user_id || params.patientId;
      if (uId && String(uId).toUpperCase().startsWith("OMCA")) {
        const storedUid = sessionStorage.getItem("patient_detail_userId");
        if (storedUid && !String(storedUid).toUpperCase().startsWith("OMCA")) {
          uId = storedUid;
        }
      }
      query.append("user_id", uId);
    }
    if (params.guestHouse_id || params.guestHouseId) {
      query.append("guestHouse_id", params.guestHouse_id || params.guestHouseId);
    }
    if (params.status && params.status !== "ALL" && params.status !== "All") {
      query.append("status", params.status);
    }
    if (params.date_from || params.dateFrom) {
      query.append("date_from", params.date_from || params.dateFrom);
    }
    if (params.date_to || params.dateTo) {
      query.append("date_to", params.date_to || params.dateTo);
    }
    if (params.only_with_services) {
      query.append("only_with_services", params.only_with_services);
    }
    query.append("page", params.page || 1);
    query.append("limit", params.limit || 10);

    const res = await axios.get(`${getCleanBase()}list?${query.toString()}`, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    console.warn("GHServicesList API call failed, using fallback:", err.message);
  }

  // Fallback filtering from cache
  let records = getCachedRecords();
  return {
    success: true,
    message: "Guest house service records fetched (cached fallback)",
    totalCount: records.length,
    currentPage: Number(params.page) || 1,
    totalPages: 1,
    summary: {
      totalBilling: records.reduce((acc, r) => acc + (Number(r.services_final_amount || r.totalAmount) || 0), 0),
      totalPaid: records.reduce((acc, r) => acc + (Number(r.services_paid_amount || r.paidAmount) || 0), 0),
      totalDue: records.reduce((acc, r) => acc + (Number(r.services_due_amount || r.dueAmount) || 0), 0),
    },
    data: records,
  };
};

/**
 * 4. GET /api/guesthouse-services/details/:identifier
 * Identifier accepts either the numeric primary key (`1`) or the booking code string (`GH-2026-000001`)
 */
export const fetchGHServiceDetails = async (identifier) => {
  try {
    const res = await axios.get(`${getCleanBase()}details/${identifier}`, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      return res.data.data;
    }
  } catch (err) {
    console.warn("GHServiceDetails API call failed, using fallback:", err.message);
  }

  const records = getCachedRecords();
  const matched = records.find(
    (r) =>
      String(r.id) === String(identifier) ||
      String(r.booking_id) === String(identifier) ||
      String(r._id) === String(identifier) ||
      String(r.guestHouseServiceId) === String(identifier)
  );
  return matched || records[0] || null;
};

/**
 * 5. GET /api/guesthouse-services/patient/:patientId
 * Get Services by Patient ID (`user_id`)
 */
export const fetchGHPatientServices = async (patientId) => {
  try {
    let resolvedId = patientId;
    if (resolvedId && String(resolvedId).toUpperCase().startsWith("OMCA")) {
      const storedUid = sessionStorage.getItem("patient_detail_userId");
      if (storedUid && !String(storedUid).toUpperCase().startsWith("OMCA")) {
        resolvedId = storedUid;
      }
    }
    const res = await axios.get(`${getCleanBase()}patient/${resolvedId}`, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    console.warn("GHPatientServices API call failed, using fallback:", err.message);
  }

  const records = getCachedRecords();
  const cleanId = String(patientId || "").toLowerCase();
  const filtered = records.filter(
    (r) =>
      String(r.user_id || r.patientId || "").toLowerCase() === cleanId ||
      String(r.name || r.patient_name || "").toLowerCase().includes(cleanId)
  );
  return {
    success: true,
    patient_id: patientId,
    count: filtered.length,
    summary: {
      totalServicesBilling: filtered.reduce((s, r) => s + (Number(r.services_final_amount) || 0), 0),
      totalServicesPaid: filtered.reduce((s, r) => s + (Number(r.services_paid_amount) || 0), 0),
      totalServicesDue: filtered.reduce((s, r) => s + (Number(r.services_due_amount) || 0), 0),
    },
    data: filtered,
  };
};

/**
 * 6. POST /api/guesthouse-services/create
 * Create Services & Initial Payment for Booking
 * Payload:
 * {
 *   booking_id: "GH-2026-000001",
 *   discount_percentage: 10,
 *   services: [ { serviceName, serviceCode, price, quantity, duration, startDate, endDate, notes } ],
 *   initialPayment: { paid_amount, paymentMethod, notes }
 * }
 */
export const createGHServiceRecord = async (payload) => {
  const isMultipart = payload instanceof FormData;
  try {
    const res = await axios.post(`${getCleanBase()}create`, payload, {
      headers: getAuthHeaders(isMultipart),
      timeout: 12000,
    });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("createGHServiceRecord API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * 7. POST /api/guesthouse-services/add-service/:identifier
 * Add Service(s) to Existing Booking
 */
export const addGHMoreServices = async (identifier, payload) => {
  try {
    const res = await axios.post(`${getCleanBase()}add-service/${identifier}`, payload, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("addGHMoreServices API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * 8. PUT /api/guesthouse-services/update-service/:identifier/:serviceId
 * Update a Specific Service Item
 * Payload: { quantity, discount_percentage, status, notes, unit_price }
 */
export const updateGHSingleService = async (identifier, serviceId, data) => {
  try {
    const res = await axios.put(
      `${getCleanBase()}update-service/${identifier}/${serviceId}`,
      data,
      {
        headers: getAuthHeaders(),
        timeout: 10000,
      }
    );
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("updateGHSingleService API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * 9. DELETE /api/guesthouse-services/delete-service/:identifier/:serviceId
 * Delete a Service Item
 */
export const deleteGHSingleService = async (identifier, serviceId) => {
  try {
    const res = await axios.delete(
      `${getCleanBase()}delete-service/${identifier}/${serviceId}`,
      {
        headers: getAuthHeaders(),
        timeout: 10000,
      }
    );
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("deleteGHSingleService API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * 10. POST /api/guesthouse-services/add-payment/:identifier (Multipart)
 * Record Service Payment (With File Upload)
 * FormData fields: paid_amount, payment_method, payment_date, notes, invoiceFiles[]
 */
export const addGHPayment = async (identifier, formData) => {
  const isMultipart = formData instanceof FormData;
  try {
    const res = await axios.post(`${getCleanBase()}add-payment/${identifier}`, formData, {
      headers: getAuthHeaders(isMultipart),
      timeout: 15000,
    });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("addGHPayment API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * 11. PUT /api/guesthouse-services/update-payment/:identifier/:paymentId
 * Update Payment (Approve / Reject)
 * Payload: { status: 'Approved' | 'Rejected', rejection_notes, paid_amount, payment_method, notes }
 */
export const updateGHPayment = async (identifier, paymentId, data) => {
  try {
    const res = await axios.put(
      `${getCleanBase()}update-payment/${identifier}/${paymentId}`,
      data,
      {
        headers: getAuthHeaders(),
        timeout: 10000,
      }
    );
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("updateGHPayment API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * 12. DELETE /api/guesthouse-services/delete-payment/:identifier/:paymentId
 * Delete Payment Entry
 */
export const deleteGHPayment = async (identifier, paymentId) => {
  try {
    const res = await axios.delete(
      `${getCleanBase()}delete-payment/${identifier}/${paymentId}`,
      {
        headers: getAuthHeaders(),
        timeout: 10000,
      }
    );
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("deleteGHPayment API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * 13. DELETE /api/guesthouse-services/delete/:identifier
 * Delete All Services for Booking
 */
export const deleteGHRecord = async (identifier) => {
  try {
    const res = await axios.delete(`${getCleanBase()}delete/${identifier}`, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err.message;
    console.error("deleteGHRecord API call failed:", errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * Backwards compatibility for updating stay status or room notes
 */
export const updateGHStayInfo = async (identifier, data) => {
  try {
    const res = await axios.put(`${getCleanBase()}update/${identifier}`, data, {
      headers: getAuthHeaders(),
      timeout: 10000,
    });
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch (err) {
    console.warn("updateGHStayInfo API call:", err.message);
  }
  return { success: true, message: "Updated" };
};

/**
 * Create Guest House Stay in CRM (POST /api/crm/stay/save)
 * Supports full unified JSON payload with stay details, optional services array, and initial payment.
 */
export const createGuestHouseStayBooking = async (stayData) => {
  const root = AdminBaseUrl?.endsWith("/") ? AdminBaseUrl : `${AdminBaseUrl}/`;
  const url = `${root}stay/save`;

  // Parse IDs as numbers / integers
  const userId = Number(stayData.user_id || stayData.patientId) || stayData.user_id;
  const guestHouseId = Number(stayData.guestHouse_id) || stayData.guestHouse_id;
  const guestHouseRoomId = Number(stayData.guestHouseRoom_id) || stayData.guestHouseRoom_id;

  const payload = {
    user_id: userId,
    guestHouse_id: guestHouseId,
    guestHouseRoom_id: guestHouseRoomId,
    checkin: stayData.checkin,
    terms_condtion: 1,
  };

  if (stayData.checkout) payload.checkout = stayData.checkout;
  if (stayData.rooms != null && stayData.rooms !== "") payload.rooms = Number(stayData.rooms);
  if (stayData.adults != null && stayData.adults !== "") payload.adults = Number(stayData.adults);
  if (stayData.children != null && stayData.children !== "") payload.children = Number(stayData.children);
  if (stayData.payment_mode) payload.payment_mode = stayData.payment_mode;

  // room_amount (spec key: room_amount)
  if (stayData.room_amount != null && stayData.room_amount !== "") {
    payload.room_amount = Number(stayData.room_amount);
  } else if (stayData.room_payment_amount != null && stayData.room_payment_amount !== "") {
    payload.room_amount = Number(stayData.room_payment_amount);
  } else if (stayData.payment_amount != null && stayData.payment_amount !== "") {
    payload.room_amount = Number(stayData.payment_amount);
  }

  if (stayData.payment_status) payload.payment_status = stayData.payment_status;
  if (stayData.name) payload.name = stayData.name;
  if (stayData.email) payload.email = stayData.email;
  if (stayData.phone) payload.phone = stayData.phone;
  if (stayData.passport_number) payload.passport_number = stayData.passport_number;
  if (stayData.remarks) payload.remarks = stayData.remarks;

  // Optional services array
  if (Array.isArray(stayData.services) && stayData.services.length > 0) {
    payload.services = stayData.services.map((s) => ({
      service_name: s.service_name || s.serviceName,
      service_code: s.service_code || s.serviceCode || undefined,
      category: s.category || (s.serviceCode?.startsWith("SVC-FOOD") || s.service_code?.startsWith("SVC-FOOD") ? "food" : "amenity"),
      unit_price: Number(s.unit_price != null ? s.unit_price : s.price),
      quantity: Number(s.quantity != null ? s.quantity : 1),
      duration: s.duration || "One-Time",
      discount_percentage: Number(s.discount_percentage || 0),
      dietary_requirements: s.dietary_requirements || undefined,
      notes: s.notes || undefined,
    }));
  }

  // Optional initial_payment object
  if (stayData.initial_payment && Number(stayData.initial_payment.paid_amount) > 0) {
    payload.initial_payment = {
      paid_amount: Number(stayData.initial_payment.paid_amount),
      payment_method: stayData.initial_payment.payment_method || stayData.initial_payment.paymentMethod || "Cash",
      apply_towards: stayData.initial_payment.apply_towards || "combined",
      transaction_reference: stayData.initial_payment.transaction_reference || undefined,
      notes: stayData.initial_payment.notes || undefined,
    };
  }

  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await axios.post(url, payload, {
    headers,
    timeout: 15000,
  });
  return res.data;
};

export const GH_STATUSES = ["ALL", "Pending", "In-Process", "Completed", "Closed"];
export const GH_PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Credit/Debit Card",
  "Net Banking",
  "Via Net Banking",
  "Bank Transfer",
  "Other",
];
export const GH_SERVICE_DURATIONS = ["One-Time", "Day", "Week", "Month"];
