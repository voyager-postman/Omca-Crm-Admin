import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
};

export const omitEmpty = (obj = {}) => {
  const params = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params[key] = value;
  });
  return params;
};

/** Normalize Country options */
export const normalizeCountryOption = (item) => {
  if (item == null || item === "") return null;
  if (typeof item === "string" || typeof item === "number") {
    const val = String(item).trim();
    if (!val) return null;
    return { label: val, value: val, country: val };
  }
  if (typeof item !== "object") return null;

  const val =
    item.country ||
    item.Country ||
    item.country_name ||
    item.countryName ||
    item.name ||
    item.label ||
    item.value ||
    "";
  const str = String(val).trim();
  if (!str) return null;
  return {
    label: str,
    value: str,
    country: str,
    raw: item,
  };
};

/** Normalize Hospital options */
export const normalizeHospitalOption = (item) => {
  if (item == null || item === "") return null;
  if (typeof item === "string" || typeof item === "number") {
    const val = String(item).trim();
    if (!val) return null;
    return { label: val, value: val, hospital_name: val };
  }
  if (typeof item !== "object") return null;

  const hospitalName =
    item.hospital_name ||
    item.hospital ||
    item.Hospital ||
    item.hospitalName ||
    item.hosp_name ||
    item.name ||
    item.label ||
    item.title ||
    "";
  const hospitalId =
    item.hospital_id ||
    item.hospitalId ||
    item.id ||
    item._id ||
    (hospitalName ? item.value : "");
  const city = item.city || item.City || item.town || "";
  const address = item.address || item.hosp_address || "";

  const nameStr = String(hospitalName || hospitalId || item.value || "").trim();
  if (!nameStr) return null;

  let displayLabel = nameStr;
  if (city && !displayLabel.toLowerCase().includes(String(city).toLowerCase())) {
    displayLabel = `${displayLabel} — ${city}`;
  }

  return {
    label: displayLabel,
    value: nameStr,
    hospital_name: String(hospitalName || nameStr).trim(),
    hospital_id: hospitalId,
    city,
    address,
    raw: item,
  };
};

/** Normalize City options */
export const normalizeCityOption = (item) => {
  if (item == null || item === "") return null;
  if (typeof item === "string" || typeof item === "number") {
    const val = String(item).trim();
    if (!val) return null;
    return { label: val, value: val, city: val };
  }
  if (typeof item !== "object") return null;

  const val =
    item.city ||
    item.City ||
    item.city_name ||
    item.cityName ||
    item.town ||
    item.name ||
    item.label ||
    item.value ||
    "";
  const str = String(val).trim();
  if (!str) return null;
  return {
    label: str,
    value: str,
    city: str,
    raw: item,
  };
};

/** Normalize Patient options */
export const normalizePatientOption = (item) => {
  if (item == null || item === "") return null;
  if (typeof item === "string" || typeof item === "number") {
    const val = String(item).trim();
    if (!val) return null;
    return { label: val, value: val, patientId: val, patient_name: val };
  }
  if (typeof item !== "object") return null;

  const patientName =
    item.patient_name ||
    item.patient ||
    item.Patient ||
    item.patientName ||
    item.full_name ||
    item.name ||
    item.label ||
    "";
  const patientId =
    item.patientId ||
    item.patient_id ||
    item.id ||
    item._id ||
    item.code ||
    (patientName ? item.value : "");

  const nameStr = String(patientName || "").trim();
  const idStr = String(patientId || "").trim();

  if (!nameStr && !idStr) return null;

  let label = nameStr || idStr;
  if (nameStr && idStr && nameStr !== idStr) {
    label = `${nameStr} (${idStr})`;
  }

  return {
    label,
    value: idStr || nameStr,
    patientId: idStr,
    patient_name: nameStr,
    city: item.city || item.town || "",
    address: item.address || "",
    raw: item,
  };
};

/** Normalize Treatment options */
export const normalizeTreatmentOption = (item) => {
  if (item == null || item === "") return null;
  if (typeof item === "string" || typeof item === "number") {
    const val = String(item).trim();
    if (!val) return null;
    return { label: val, value: val, treatment_id: val, treatment_name: val };
  }
  if (typeof item !== "object") return null;

  const treatmentName =
    item.treatment_name ||
    item.treatment ||
    item.Treatment ||
    item.treatmentName ||
    item.course_name ||
    item.name ||
    item.label ||
    "";
  const treatmentId =
    item.treatment_id ||
    item.treatmentId ||
    item.id ||
    item._id ||
    item.code ||
    (treatmentName ? item.value : "");

  const nameStr = String(treatmentName || "").trim();
  const idStr = String(treatmentId || "").trim();

  if (!nameStr && !idStr) return null;

  let label = nameStr || idStr;
  if (nameStr && idStr && nameStr !== idStr) {
    label = `${nameStr} (${idStr})`;
  }

  return {
    label,
    value: idStr || nameStr,
    treatment_id: idStr,
    treatment_name: nameStr,
    raw: item,
  };
};

/** Normalize Head options */
export const normalizeHeadOption = (item) => {
  if (item == null || item === "") return null;
  if (typeof item === "string" || typeof item === "number") {
    const val = String(item).trim();
    if (!val) return null;
    return { label: val, value: val };
  }
  if (typeof item !== "object") return null;

  const val = item.head || item.name || item.label || item.value || "";
  const str = String(val).trim();
  if (!str) return null;
  return { label: str, value: str, raw: item };
};

const toList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.rows)) return raw.rows;
    if (Array.isArray(raw.results)) return raw.results;
    if (Array.isArray(raw.list)) return raw.list;
    if (Array.isArray(raw.options)) return raw.options;
    const vals = Object.values(raw);
    if (vals.some(Array.isArray)) {
      return vals.flatMap((v) => (Array.isArray(v) ? v : []));
    }
  }
  return [];
};

export const uniqueOptions = (list) => {
  return list.filter(
    (item, index, arr) =>
      arr.findIndex(
        (o) =>
          String(o.value).toLowerCase() === String(item.value).toLowerCase() &&
          String(o.label).toLowerCase() === String(item.label).toLowerCase(),
      ) === index,
  );
};

/**
 * GET /api/payment-data/tree-filters
 * Query Parameters (optional):
 * - country
 * - hospital
 * - city
 * - patientId
 * - treatment_id
 */
export const fetchPaymentTreeFilters = async (filters = {}) => {
  const params = omitEmpty({
    ...filters,
    patientId: filters.patientId || filters.patient_id,
    patient_id: filters.patient_id || filters.patientId,
    treatment_id: filters.treatment_id || filters.treatmentId,
  });
  const response = await axios.get(`${baseurl}payment-data/tree-filters`, {
    params,
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load dropdown filters");
  }

  const data = body?.data && typeof body.data === "object" ? body.data : body;

  const countriesRaw = data?.countries || data?.country || [];
  const hospitalsRaw =
    data?.hospitals || data?.hospital || data?.hospital_locations || data?.hosp || [];
  const citiesRaw = data?.cities || data?.city || [];
  const patientsRaw = data?.patients || data?.patient || [];
  const treatmentsRaw = data?.treatments || data?.treatment || [];
  const headsRaw = data?.heads || data?.head || data?.three_heads || [];

  return {
    countries: uniqueOptions(
      toList(countriesRaw).map(normalizeCountryOption).filter(Boolean),
    ),
    hospitals: uniqueOptions(
      toList(hospitalsRaw).map(normalizeHospitalOption).filter(Boolean),
    ),
    cities: uniqueOptions(
      toList(citiesRaw).map(normalizeCityOption).filter(Boolean),
    ),
    patients: uniqueOptions(
      toList(patientsRaw).map(normalizePatientOption).filter(Boolean),
    ),
    treatments: uniqueOptions(
      toList(treatmentsRaw).map(normalizeTreatmentOption).filter(Boolean),
    ),
    heads: uniqueOptions(
      toList(headsRaw).map(normalizeHeadOption).filter(Boolean),
    ),
    raw: body,
  };
};

const isPlainObject = (v) =>
  v != null && typeof v === "object" && !Array.isArray(v);

const parseNumeric = (val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const clean = val.replace(/[^0-9.-]+/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

/**
 * GET /api/payment-data
 * Query Parameters:
 * - country
 * - hospital
 * - city
 * - patientId
 * - treatment_id
 * - page
 * - limit
 */
export const fetchPaymentData = async (filters = {}) => {
  const params = omitEmpty(filters);
  if ((params.treatment_id || params.patientId || params.patient_id) && !params.overall) {
    params.overall = "treatments";
  }
  const response = await axios.get(`${baseurl}payment-data`, {
    params,
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load payment data");
  }

  let rows = [];
  const candidates = [
    body?.data?.rows,
    body?.data?.results,
    body?.data?.payments,
    body?.data?.list,
    body?.data?.records,
    body?.data?.patients,
    body?.data?.treatments,
    body?.rows,
    body?.results,
    body?.list,
    body?.records,
    body?.data,
  ];

  for (const cand of candidates) {
    if (Array.isArray(cand)) {
      rows = cand.filter(isPlainObject);
      if (rows.length) break;
    }
  }

  if (!rows.length && Array.isArray(body)) {
    rows = body.filter(isPlainObject);
  }

  // Summary object from API
  let summary =
    body?.summary ||
    body?.data?.summary ||
    body?.totals ||
    body?.data?.totals ||
    body?.metrics ||
    body?.data?.metrics ||
    null;

  // If summary not returned directly by backend, calculate from rows
  if (!summary && rows.length) {
    let totalBilling = 0;
    let paymentsReceived = 0;
    let duesPending = 0;

    rows.forEach((r) => {
      const billing =
        r.total_billing ?? r.totalBilling ?? r.billing ?? r.amount ?? 0;
      const received =
        r.payments_received ??
        r.paymentsReceived ??
        r.amount_paid ??
        r.paid ??
        0;
      const dues =
        r.dues_pending ??
        r.duesPending ??
        r.remaining_balance ??
        r.dues ??
        r.balance ??
        0;

      totalBilling += parseNumeric(billing);
      paymentsReceived += parseNumeric(received);
      duesPending += parseNumeric(dues);
    });

    summary = {
      total_billing: totalBilling,
      payments_received: paymentsReceived,
      dues_pending: duesPending || Math.max(0, totalBilling - paymentsReceived),
    };
  }

  // Total records
  const totalRecords =
    body?.totalRecords ??
    body?.total_records ??
    body?.total ??
    body?.totalCount ??
    body?.count ??
    body?.data?.totalRecords ??
    body?.data?.total_records ??
    body?.data?.total ??
    body?.data?.count ??
    rows.length;

  const overall = (body?.overall || body?.data?.overall || "").toString().toLowerCase();
  let level = body?.level || body?.data?.level || "";
  if (!level) {
    if (
      overall.includes("treatment") ||
      params.treatment_id ||
      params.treatmentId ||
      params.patientId ||
      params.patient_id
    ) {
      level = "treatment";
    } else if (params.hospital) {
      level = "hospital";
    } else if (params.city) {
      level = "hospital";
    } else if (params.country) {
      level = "city";
    } else if (
      rows.length > 0 &&
      (rows[0].treatment_id ||
        rows[0].treatment ||
        rows[0].treatment_name ||
        (rows[0].patientId && (rows[0].hospital_id || typeof rows[0].hospital === "object")))
    ) {
      level = "treatment";
    } else {
      level = "country";
    }
  }

  return {
    rows,
    totalRecords: typeof totalRecords === "number" ? totalRecords : rows.length,
    summary: summary || {
      total_billing: 0,
      payments_received: 0,
      dues_pending: 0,
    },
    level,
    raw: body,
  };
};

/**
 * GET /api/payment-data?hospital={hospitalName}&drill=patients
 * Fetches patient breakdown under a specific hospital
 */
export const fetchHospitalPatients = async (hospitalName, extraFilters = {}) => {
  return fetchPaymentData({
    ...extraFilters,
    hospital: hospitalName,
    drill: "patients",
  });
};

/**
 * GET /api/payment-data?hospital={hospitalName}&patientId={patientId}
 * Fetches treatment breakdown for a specific patient at a specific hospital
 */
export const fetchPatientTreatments = async (hospitalName, patientId, extraFilters = {}) => {
  return fetchPaymentData({
    ...extraFilters,
    hospital: hospitalName,
    patientId: patientId,
  });
};

const filenameFromDisposition = (header) => {
  if (!header) return "payment-data.xlsx";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!match?.[1]) return "payment-data.xlsx";
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim() || "payment-data.xlsx";
  }
};

/** GET /api/payment-data with export=xlsx (blob file, JSON link, or CSV fallback) */
export const exportPaymentData = async (filters = {}) => {
  const params = omitEmpty({ ...filters, export: "xlsx" });
  if (params.treatment_id && !params.overall) {
    params.overall = "treatments";
  }
  let response;
  try {
    response = await axios.get(`${baseurl}payment-data`, {
      params,
      headers: authHeaders(),
      responseType: "blob",
    });
  } catch (error) {
    let message = "Export failed";
    try {
      if (error?.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        const json = JSON.parse(text);
        message = json.message || message;
      } else {
        message =
          error?.response?.data?.message || error?.message || message;
      }
    } catch {
      message = error?.message || message;
    }
    throw new Error(message);
  }

  const blob = response.data;
  const contentType = String(
    response.headers?.["content-type"] || blob?.type || "",
  ).toLowerCase();
  let filename = filenameFromDisposition(
    response.headers?.["content-disposition"],
  );

  const fileBlob = new Blob([blob], {
    type:
      contentType ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (!filename || filename === "payment-data.xlsx") {
    if (contentType.includes("csv")) filename = "payment-data.csv";
  }
  const url = window.URL.createObjectURL(fileBlob);
  return { url, filename, revoke: true };
};

const escapeHtmlCell = (value) => {
  if (value == null || value === "") return "";
  const text = String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

/**
 * Helper to flatten a treatment object and all its sub-sections (Hospital, OMCA, Pharmacy, Charges, Payments)
 * into granular rows for complete Excel export.
 */
export const flattenTreatmentForExport = (tx, baseInfo) => {
  const rows = [];
  const txName = tx.treatment_name || tx.treatment || tx.course_name || tx.name || "—";
  const txId = tx.treatment_id || tx.treatmentId || tx.id || tx._id || "";
  const totalBilling = parseNumeric(tx.total_billing ?? tx.total_charge ?? tx.totalBilling ?? tx.amount ?? 0);
  const paymentsReceived = parseNumeric(tx.payments_received ?? tx.paymentsReceived ?? tx.amount_paid ?? tx.paid ?? 0);
  const duesPending = parseNumeric(tx.dues_pending ?? tx.due_payment ?? tx.duesPending ?? tx.remaining_balance ?? tx.dues ?? 0);

  const trHosp = tx.hospital || {};
  const trOmca = tx.omca || {};
  const trPharm = tx.pharmacy || {};

  const hospFee = trHosp.treatment_fee ?? trHosp.final_amount ?? tx.treatment_fee ?? 0;
  const hospDiscount = trHosp.discount_percentage ?? 0;
  const hospFinalAmount = trHosp.final_amount ?? (hospFee - (hospFee * hospDiscount) / 100);
  const hospCharges = Array.isArray(trHosp.charges) ? trHosp.charges : [];
  const hospPayments = Array.isArray(trHosp.payments) ? trHosp.payments : [];

  const omcaFree = Array.isArray(trOmca.freeServices) ? trOmca.freeServices : [];
  const omcaExtra = Array.isArray(trOmca.extraServices) ? trOmca.extraServices : [];
  const omcaPayments = Array.isArray(trOmca.payments) ? trOmca.payments : [];

  const pharmCharges = Array.isArray(trPharm.pharmacyCharges) ? trPharm.pharmacyCharges : [];
  const pharmPayments = Array.isArray(trPharm.payments) ? trPharm.payments : [];

  const allPayments = Array.isArray(tx.payment_details)
    ? tx.payment_details
    : Array.isArray(tx.payment_history)
    ? tx.payment_history
    : [];

  const hasSubSections =
    parseNumeric(hospFee) > 0 ||
    hospCharges.length > 0 ||
    hospPayments.length > 0 ||
    omcaFree.length > 0 ||
    omcaExtra.length > 0 ||
    omcaPayments.length > 0 ||
    pharmCharges.length > 0 ||
    pharmPayments.length > 0 ||
    allPayments.length > 0;

  // 1. Treatment Summary / Overview Row
  rows.push({
    ...baseInfo,
    treatmentName: txName,
    treatmentId: txId,
    section: "Treatment Summary",
    itemDescription: `${txName} (Overall Summary)`,
    type: "Summary",
    date: "",
    originalPrice: totalBilling,
    discount: "",
    finalCharge: totalBilling,
    paidAmount: paymentsReceived,
    paymentMethod: "",
    paidTo: "",
    paidFor: "",
    invoices: "",
    notes: "",
    totalBilling,
    paymentsReceived,
    duesPending,
    isSummaryRow: true,
  });

  if (!hasSubSections) {
    return rows;
  }

  // 2. Hospital Base Fee (if specified)
  if (parseNumeric(hospFee) > 0 || hospDiscount > 0) {
    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "Hospital",
      itemDescription: "Treatment Base Fee",
      type: "Base Fee",
      date: "",
      originalPrice: parseNumeric(hospFee),
      discount: hospDiscount ? `${hospDiscount}%` : "0%",
      finalCharge: parseNumeric(hospFinalAmount),
      paidAmount: "",
      paymentMethod: "",
      paidTo: "Hospital",
      paidFor: "Treatment",
      invoices: "",
      notes: "",
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  }

  // 3. Hospital Investigation & Scan Charges
  hospCharges.forEach((c) => {
    const orig = parseNumeric(c.price ?? 0);
    const disc = c.discount_percentage ?? 0;
    const finalP = parseNumeric(c.final_price ?? orig);
    const dateStr = c.date ? new Date(c.date).toLocaleDateString("en-GB") : "";

    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "Hospital",
      itemDescription: c.service_name || "Investigation / Scan Charge",
      type: "Charge",
      date: dateStr,
      originalPrice: orig,
      discount: disc ? `${disc}%` : "0%",
      finalCharge: finalP,
      paidAmount: "",
      paymentMethod: "",
      paidTo: "Hospital",
      paidFor: "Hospital Charges",
      invoices: "",
      notes: "",
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  });

  // 4. Hospital Payments
  const finalHospPayments = hospPayments.length
    ? hospPayments
    : allPayments.filter((p) => {
        const to = typeof p.paid_to === "object" ? p.paid_to?.name : String(p.paid_to || "");
        return !to || to.toLowerCase().includes("hospital");
      });

  finalHospPayments.forEach((p) => {
    const paidAmt = parseNumeric(p.paid_amount ?? p.amount ?? p.payment ?? 0);
    const payDate = p.payment_Date || p.paymentDate || p.date;
    const dateStr = payDate ? new Date(payDate).toLocaleDateString("en-GB") : "";
    const method = p.paymentMethod || p.method || p.mode || "—";
    const paidTo = typeof p.paid_to === "object" ? p.paid_to?.name : p.paid_to || "Hospital";
    const paidFor = typeof p.paid_for === "object" ? p.paid_for?.name : p.paid_for || "Treatment";
    const files = Array.isArray(p.attachFile) ? p.attachFile.join(", ") : p.attachFile || "";
    const notes = p.notes || p.note || p.remarks || "";

    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "Hospital",
      itemDescription: `Payment: ${method} (${paidFor})`,
      type: "Payment",
      date: dateStr,
      originalPrice: "",
      discount: "",
      finalCharge: "",
      paidAmount: paidAmt,
      paymentMethod: method,
      paidTo,
      paidFor,
      invoices: files,
      notes,
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  });

  // 5. OMCA Free Services
  omcaFree.forEach((fs) => {
    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "OMCA",
      itemDescription: `${fs.serviceName || "Free Service"} ${fs.duration ? `(${fs.duration})` : ""}`.trim(),
      type: "Free Service",
      date: "",
      originalPrice: 0,
      discount: "100%",
      finalCharge: 0,
      paidAmount: "",
      paymentMethod: "",
      paidTo: "OMCA",
      paidFor: "Free Service",
      invoices: "",
      notes: fs.serviceId ? `ID: ${fs.serviceId}` : "",
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  });

  // 6. OMCA Extra / Paid Services
  omcaExtra.forEach((es) => {
    const orig = parseNumeric(es.price ?? 0);
    const disc = es.discount_percentage ?? 0;
    const finalP = parseNumeric(es.final_price ?? orig);
    const dateStr = es.startTime ? new Date(es.startTime).toLocaleDateString("en-GB") : "";

    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "OMCA",
      itemDescription: `${es.serviceName || "Extra Service"} ${es.duration ? `(${es.duration})` : ""}`.trim(),
      type: "Paid Service",
      date: dateStr,
      originalPrice: orig,
      discount: disc ? `${disc}%` : "0%",
      finalCharge: finalP,
      paidAmount: "",
      paymentMethod: "",
      paidTo: "OMCA",
      paidFor: "Extra Service",
      invoices: "",
      notes: es.serviceId ? `ID: ${es.serviceId}` : "",
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  });

  // 7. OMCA Payments
  const finalOmcaPayments = omcaPayments.length
    ? omcaPayments
    : allPayments.filter((p) => {
        const to = typeof p.paid_to === "object" ? p.paid_to?.name : String(p.paid_to || "");
        return to && to.toLowerCase().includes("omca");
      });

  finalOmcaPayments.forEach((p) => {
    const paidAmt = parseNumeric(p.paid_amount ?? p.amount ?? p.payment ?? 0);
    const payDate = p.payment_Date || p.paymentDate || p.date;
    const dateStr = payDate ? new Date(payDate).toLocaleDateString("en-GB") : "";
    const method = p.paymentMethod || p.method || p.mode || "—";
    const paidTo = typeof p.paid_to === "object" ? p.paid_to?.name : p.paid_to || "OMCA";
    const paidFor = typeof p.paid_for === "object" ? p.paid_for?.name : p.paid_for || "Service";
    const files = Array.isArray(p.attachFile) ? p.attachFile.join(", ") : p.attachFile || "";
    const notes = p.notes || p.note || p.remarks || "";

    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "OMCA",
      itemDescription: `Payment: ${method} (${paidFor})`,
      type: "Payment",
      date: dateStr,
      originalPrice: "",
      discount: "",
      finalCharge: "",
      paidAmount: paidAmt,
      paymentMethod: method,
      paidTo,
      paidFor,
      invoices: files,
      notes,
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  });

  // 8. Pharmacy Charges
  pharmCharges.forEach((pc) => {
    const orig = parseNumeric(pc.price ?? 0);
    const disc = pc.discount_percentage ?? 0;
    const finalP = parseNumeric(pc.final_price ?? orig);
    const dateStr = pc.date ? new Date(pc.date).toLocaleDateString("en-GB") : "";

    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "Pharmacy",
      itemDescription: pc.medicine_name || pc.name || pc.item_name || pc.service_name || "Pharmacy Item",
      type: "Charge",
      date: dateStr,
      originalPrice: orig,
      discount: disc ? `${disc}%` : "0%",
      finalCharge: finalP,
      paidAmount: "",
      paymentMethod: "",
      paidTo: "Pharmacy",
      paidFor: "Pharmacy Item",
      invoices: "",
      notes: "",
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  });

  // 9. Pharmacy Payments
  const finalPharmPayments = pharmPayments.length
    ? pharmPayments
    : allPayments.filter((p) => {
        const to = typeof p.paid_to === "object" ? p.paid_to?.name : String(p.paid_to || "");
        return to && to.toLowerCase().includes("pharmacy");
      });

  finalPharmPayments.forEach((p) => {
    const paidAmt = parseNumeric(p.paid_amount ?? p.amount ?? p.payment ?? 0);
    const payDate = p.payment_Date || p.paymentDate || p.date;
    const dateStr = payDate ? new Date(payDate).toLocaleDateString("en-GB") : "";
    const method = p.paymentMethod || p.method || p.mode || "—";
    const paidTo = typeof p.paid_to === "object" ? p.paid_to?.name : p.paid_to || "Pharmacy";
    const paidFor = typeof p.paid_for === "object" ? p.paid_for?.name : p.paid_for || "Pharmacy";
    const files = Array.isArray(p.attachFile) ? p.attachFile.join(", ") : p.attachFile || "";
    const notes = p.notes || p.note || p.remarks || "";

    rows.push({
      ...baseInfo,
      treatmentName: txName,
      treatmentId: txId,
      section: "Pharmacy",
      itemDescription: `Payment: ${method} (${paidFor})`,
      type: "Payment",
      date: dateStr,
      originalPrice: "",
      discount: "",
      finalCharge: "",
      paidAmount: paidAmt,
      paymentMethod: method,
      paidTo,
      paidFor,
      invoices: files,
      notes,
      totalBilling: "",
      paymentsReceived: "",
      duesPending: "",
    });
  });

  return rows;
};

/**
 * Recursively assemble all granular payment records across all levels
 * (Hospital -> Patient -> Treatment breakdown -> Hospital/OMCA/Pharmacy charges & payments)
 * so export includes 100% of all data
 */
export const buildFullPaymentExportData = async (
  rootRows = [],
  queryParams = {},
  patientCache = {},
  treatmentCache = {}
) => {
  const flattenedRows = [];

  for (let i = 0; i < rootRows.length; i++) {
    const row = rootRows[i];
    const country =
      row.country ||
      row.country_name ||
      (!row.patient_name && !row.patient && !row.patientId && !row.treatment_name && !row.treatment_id && !row.hospital_name ? row.name : "") ||
      "";
    const city = row.city || row.town || row.city_name || row.location || row.hospital_city || "";
    const hospital =
      row.hospital_name ||
      (typeof row.hospital === "string"
        ? row.hospital
        : row.hospital?.details?.hospital_Name || row.hospital?.hospital_name || row.hospital?.name) ||
      row.hosp_name ||
      row.hospitalName ||
      "";
    const patientId = row.patientId || row.patient_id || row.patientNumber || "";
    let patientName =
      row.patient_name ||
      row.patient ||
      row.Patient ||
      row.patientName ||
      "";
    if (!patientName && row.name && patientId) patientName = row.name;

    const treatmentId = row.treatment_id || row.treatmentId || "";
    let treatmentName =
      row.treatment_name ||
      row.treatment ||
      row.Treatment ||
      row.course_name ||
      row.treatmentName ||
      "";
    if (!treatmentName && row.name && (treatmentId || patientId)) treatmentName = row.name;

    const baseInfo = {
      country,
      city,
      hospital: hospital || "—",
      patientName: patientName || "—",
      patientId: patientId || "—",
    };

    // 1. If row already contains patient/treatment details, flatten with all sub-sections
    if (
      treatmentName ||
      treatmentId ||
      patientId ||
      patientName ||
      queryParams.patientId ||
      queryParams.patient ||
      (typeof row.hospital === "object" &&
        (row.hospital?.charges || row.hospital?.payments || row.hospital?.treatment_fee))
    ) {
      const treatmentRows = flattenTreatmentForExport(row, baseInfo);
      flattenedRows.push(...treatmentRows);
      continue;
    }

    // 2. If row represents a hospital, fetch or use cached patients and treatments
    if (hospital) {
      let patients = patientCache[hospital]?.data || [];
      if (!patients.length) {
        try {
          const pResult = await fetchHospitalPatients(hospital, queryParams);
          patients = pResult.rows || [];
        } catch (e) {
          console.warn(`Could not fetch patients for hospital ${hospital}:`, e);
        }
      }

      if (patients.length) {
        for (let pIdx = 0; pIdx < patients.length; pIdx++) {
          const pt = patients[pIdx];
          const ptId = pt.patientId || pt.patient_id || pt.patientNumber || pt._id || pt.id || "";
          const ptName = pt.patient_name || pt.patient || pt.name || "—";
          const ptLocation = pt.location || pt.city || pt.town || city || "";

          const ptBaseInfo = {
            country,
            city: ptLocation || city,
            hospital,
            patientName: ptName,
            patientId: ptId,
          };

          // Fetch or use cached treatments for this patient
          const ptKey = `${hospital}___${ptId}___${pIdx}`;
          let treatments = treatmentCache[ptKey]?.data || [];
          if (!treatments.length && ptId) {
            try {
              const tResult = await fetchPatientTreatments(hospital, ptId, queryParams);
              treatments = tResult.rows || [];
            } catch (e) {
              console.warn(`Could not fetch treatments for patient ${ptId}:`, e);
            }
          }

          if (treatments.length) {
            for (const tx of treatments) {
              const txRows = flattenTreatmentForExport(tx, ptBaseInfo);
              flattenedRows.push(...txRows);
            }
          } else {
            // Patient record without sub-treatments
            const totalBilling = parseNumeric(pt.total_billing ?? pt.totalBilling ?? pt.billing ?? pt.amount ?? 0);
            const paymentsReceived = parseNumeric(pt.payments_received ?? pt.paymentsReceived ?? pt.amount_paid ?? pt.paid ?? 0);
            const duesPending = parseNumeric(pt.dues_pending ?? pt.duesPending ?? pt.remaining_balance ?? pt.dues ?? 0);

            flattenedRows.push({
              ...ptBaseInfo,
              treatmentName: "—",
              treatmentId: "",
              section: "Patient Summary",
              itemDescription: "Patient Record",
              type: "Summary",
              date: "",
              originalPrice: totalBilling,
              discount: "",
              finalCharge: totalBilling,
              paidAmount: paymentsReceived,
              paymentMethod: "",
              paidTo: "",
              paidFor: "",
              invoices: "",
              notes: "",
              totalBilling,
              paymentsReceived,
              duesPending,
              isSummaryRow: true,
            });
          }
        }
      } else {
        // Hospital without patient breakdown
        const totalBilling = parseNumeric(row.total_billing ?? row.totalBilling ?? row.billing ?? row.amount ?? 0);
        const paymentsReceived = parseNumeric(row.payments_received ?? row.paymentsReceived ?? row.amount_paid ?? row.paid ?? 0);
        const duesPending = parseNumeric(row.dues_pending ?? row.duesPending ?? row.remaining_balance ?? row.dues ?? 0);

        flattenedRows.push({
          country,
          city,
          hospital,
          patientName: "—",
          patientId: "",
          treatmentName: "—",
          treatmentId: "",
          section: "Hospital Summary",
          itemDescription: `Hospital: ${hospital}`,
          type: "Summary",
          date: "",
          originalPrice: totalBilling,
          discount: "",
          finalCharge: totalBilling,
          paidAmount: paymentsReceived,
          paymentMethod: "",
          paidTo: "",
          paidFor: "",
          invoices: "",
          notes: "",
          totalBilling,
          paymentsReceived,
          duesPending,
          isSummaryRow: true,
        });
      }
    } else if (patientName || patientId) {
      // Patient row without hospital parent
      const totalBilling = parseNumeric(row.total_billing ?? row.totalBilling ?? row.billing ?? row.amount ?? 0);
      const paymentsReceived = parseNumeric(row.payments_received ?? row.paymentsReceived ?? row.amount_paid ?? row.paid ?? 0);
      const duesPending = parseNumeric(row.dues_pending ?? row.duesPending ?? row.remaining_balance ?? row.dues ?? 0);

      flattenedRows.push({
        country,
        city,
        hospital: "—",
        patientName: patientName || "—",
        patientId: patientId || "—",
        treatmentName: treatmentName || "—",
        treatmentId: treatmentId || "",
        section: "Patient Record",
        itemDescription: `Patient: ${patientName}`,
        type: "Summary",
        date: "",
        originalPrice: totalBilling,
        discount: "",
        finalCharge: totalBilling,
        paidAmount: paymentsReceived,
        paymentMethod: "",
        paidTo: "",
        paidFor: "",
        invoices: "",
        notes: "",
        totalBilling,
        paymentsReceived,
        duesPending,
        isSummaryRow: true,
      });
    } else {
      // Generic row fallback
      const totalBilling = parseNumeric(row.total_billing ?? row.totalBilling ?? row.billing ?? row.amount ?? 0);
      const paymentsReceived = parseNumeric(row.payments_received ?? row.paymentsReceived ?? row.amount_paid ?? row.paid ?? 0);
      const duesPending = parseNumeric(row.dues_pending ?? row.duesPending ?? row.remaining_balance ?? row.dues ?? 0);

      flattenedRows.push({
        country,
        city,
        hospital: "—",
        patientName: "—",
        patientId: "",
        treatmentName: "—",
        treatmentId: "",
        section: "General",
        itemDescription: row.name || "Payment Record",
        type: "Summary",
        date: "",
        originalPrice: totalBilling,
        discount: "",
        finalCharge: totalBilling,
        paidAmount: paymentsReceived,
        paymentMethod: "",
        paidTo: "",
        paidFor: "",
        invoices: "",
        notes: "",
        totalBilling,
        paymentsReceived,
        duesPending,
        isSummaryRow: true,
      });
    }
  }

  return flattenedRows;
};

/**
 * Generate and download a complete Excel spreadsheet containing all rows, all drilldown treatments,
 * hospital base fee, charges, OMCA services, pharmacy charges, and payment transactions.
 */
export const downloadPaymentDataExcel = (rows = [], summary = {}, filters = {}) => {
  const headers = [
    "Sr.No.",
    "Country",
    "City / Location",
    "Hospital",
    "Patient Name",
    "Patient ID",
    "Treatment / Course",
    "Treatment ID",
    "Section",
    "Item / Service / Payment Description",
    "Type",
    "Date",
    "Original Price ($)",
    "Discount",
    "Final Charge ($)",
    "Paid Amount ($)",
    "Payment Method",
    "Paid To",
    "Paid For",
    "Invoices / Receipts",
    "Notes / Remarks",
    "Total Treatment Billing ($)",
    "Total Payments Received ($)",
    "Total Dues Pending ($)",
  ];

  const headerRow = headers
    .map(
      (h) =>
        `<th style="background-color:#0ba6df;color:#ffffff;font-weight:bold;padding:10px 8px;border:1px solid #cbd5e1;text-align:left;white-space:nowrap;font-size:11px;">${escapeHtmlCell(
          h
        )}</th>`
    )
    .join("");

  let calcBilling = 0;
  let calcReceived = 0;
  let calcDues = 0;

  const bodyRows = rows
    .map((row, idx) => {
      const country = row.country || "";
      const city = row.city || row.location || "";
      const hospital = row.hospital || "";
      const patientName = row.patientName || "";
      const patientId = row.patientId || "";
      const treatmentName = row.treatmentName || "";
      const treatmentId = row.treatmentId || "";
      const section = row.section || "";
      const itemDesc = row.itemDescription || "";
      const type = row.type || "";
      const dateStr = row.date || "";

      const origPrice = row.originalPrice !== "" && row.originalPrice != null ? parseNumeric(row.originalPrice) : "";
      const discount = row.discount || "";
      const finalCharge = row.finalCharge !== "" && row.finalCharge != null ? parseNumeric(row.finalCharge) : "";
      const paidAmount = row.paidAmount !== "" && row.paidAmount != null ? parseNumeric(row.paidAmount) : "";

      const method = row.paymentMethod || "";
      const paidTo = row.paidTo || "";
      const paidFor = row.paidFor || "";
      const invoices = row.invoices || "";
      const notes = row.notes || "";

      const totalBilling = row.totalBilling !== "" && row.totalBilling != null ? parseNumeric(row.totalBilling) : "";
      const paymentsReceived = row.paymentsReceived !== "" && row.paymentsReceived != null ? parseNumeric(row.paymentsReceived) : "";
      const duesPending = row.duesPending !== "" && row.duesPending != null ? parseNumeric(row.duesPending) : "";

      if (row.isSummaryRow) {
        if (typeof totalBilling === "number") calcBilling += totalBilling;
        if (typeof paymentsReceived === "number") calcReceived += paymentsReceived;
        if (typeof duesPending === "number") calcDues += duesPending;
      }

      // Formatting per row type
      const isSummary = row.isSummaryRow;
      const isPayment = type === "Payment";
      const isHosp = section === "Hospital";
      const isOmca = section === "OMCA";
      const isPharm = section === "Pharmacy";

      let rowBg = "#ffffff";
      if (isSummary) rowBg = "#f0fdfa";
      else if (isPayment) rowBg = "#f8fafc";
      else if (isOmca) rowBg = "#faf5ff";
      else if (isPharm) rowBg = "#f0fdfa";

      const sectionColor = isHosp
        ? "#1e3a8a"
        : isOmca
        ? "#4f46e5"
        : isPharm
        ? "#0d9488"
        : isSummary
        ? "#0f766e"
        : "#334155";

      const cells = [
        idx + 1,
        country || "—",
        city || "—",
        hospital || "—",
        patientName || "—",
        patientId || "—",
        treatmentName || "—",
        treatmentId || "—",
        section || "—",
        itemDesc || "—",
        type || "—",
        dateStr || "—",
        typeof origPrice === "number" ? `$${origPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
        discount || "—",
        typeof finalCharge === "number" ? `$${finalCharge.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
        typeof paidAmount === "number" ? `$${paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
        method || "—",
        paidTo || "—",
        paidFor || "—",
        invoices || "—",
        notes || "—",
        typeof totalBilling === "number" ? `$${totalBilling.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "",
        typeof paymentsReceived === "number" ? `$${paymentsReceived.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "",
        typeof duesPending === "number" ? `$${duesPending.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "",
      ]
        .map((val, cIdx) => {
          const isMoney = (cIdx >= 12 && cIdx <= 15) || (cIdx >= 21 && cIdx <= 23);
          const align = isMoney ? "right" : cIdx === 0 || cIdx === 10 || cIdx === 11 || cIdx === 13 ? "center" : "left";
          const fontWeight = isSummary || (cIdx === 15 && isPayment) || (cIdx >= 21 && cIdx <= 23) ? "bold" : "normal";
          const cellColor = cIdx === 8 ? sectionColor : cIdx === 15 && isPayment ? "#0284c7" : "#1e293b";

          return `<td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:${align};white-space:nowrap;font-size:11px;font-weight:${fontWeight};color:${cellColor};">${escapeHtmlCell(
            val
          )}</td>`;
        })
        .join("");

      return `<tr style="background-color:${rowBg};">${cells}</tr>`;
    })
    .join("");

  const totalBillingSum = parseNumeric(summary?.total_billing ?? calcBilling);
  const paymentsReceivedSum = parseNumeric(summary?.payments_received ?? calcReceived);
  const duesPendingSum = parseNumeric(summary?.dues_pending ?? calcDues);

  const summaryRow = `
    <tr style="background-color:#e2e8f0;font-weight:bold;font-size:12px;">
      <td colspan="21" style="padding:10px 8px;border:1px solid #cbd5e1;text-align:right;">OVERALL TOTAL SUMMARY:</td>
      <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:right;color:#1e3a8a;">$${totalBillingSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:right;color:#0284c7;">$${paymentsReceivedSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:right;color:#e11d48;">$${duesPendingSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  `;

  const reportTitle =
    filters?.reportTitle ||
    (filters?.singleTreatment
      ? "OMCA CRM - Single Treatment Payment & Charges Breakdown Report"
      : filters?.singlePatient
      ? "OMCA CRM - Patient Treatments & Payments Breakdown Report"
      : "OMCA CRM - Complete Payment & Charges Breakdown Report");

  const defaultFilename = `payment-data-complete-${new Date().toISOString().slice(0, 10)}.xls`;
  const filename = filters?.customFilename || (typeof filters === "string" ? filters : defaultFilename);

  const excelHtml = `\uFEFF<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${escapeHtmlCell(reportTitle)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body style="font-family:sans-serif;font-size:12px;">
<h2 style="color:#0ba6df;margin-bottom:4px;">${escapeHtmlCell(reportTitle)}</h2>
<p style="color:#64748b;font-size:12px;margin-top:0;">Generated on: ${new Date().toLocaleString("en-GB")} | Total Rows: ${rows.length}</p>
<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:11px;width:100%;">
<thead>
  <tr>${headerRow}</tr>
</thead>
<tbody>
  ${bodyRows}
  ${summaryRow}
</tbody>
</table>
</body>
</html>`;

  const blob = new Blob([excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Export a single treatment and all its itemized breakdown (Hospital, OMCA, Pharmacy, Payments) to Excel
 */
export const exportSingleTreatmentExcel = (treatment = {}, baseInfo = {}) => {
  const ptName = baseInfo.patientName || treatment.patient_name || treatment.patient || "Patient";
  const trName = treatment.treatment_name || treatment.treatment || treatment.course_name || "Treatment";
  const trId = treatment.treatment_id || treatment.treatmentId || treatment.id || "";

  const txBaseInfo = {
    ...baseInfo,
    patientName: ptName,
    treatmentName: trName,
    treatmentId: trId,
  };

  const flattenedRows = flattenTreatmentForExport(treatment, txBaseInfo);

  const totalBilling = parseNumeric(treatment.total_billing ?? treatment.totalCharge ?? treatment.total_charge ?? 0);
  const paymentsReceived = parseNumeric(treatment.payments_received ?? treatment.paymentsReceived ?? treatment.amount_paid ?? 0);
  const duesPending = parseNumeric(treatment.dues_pending ?? treatment.duePayment ?? treatment.duesPending ?? 0);

  const summary = {
    total_billing: totalBilling,
    payments_received: paymentsReceived,
    dues_pending: duesPending,
  };

  const cleanPt = String(ptName).replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanTr = String(trId || trName).replace(/[^a-zA-Z0-9_-]/g, "_");
  const customFilename = `payment-data-treatment-${cleanPt}-${cleanTr}-${new Date().toISOString().slice(0, 10)}.xls`;

  downloadPaymentDataExcel(flattenedRows, summary, {
    customFilename,
    singleTreatment: true,
    reportTitle: `OMCA CRM - Treatment Payment Breakdown: ${trName} (${ptName})`,
  });

  return flattenedRows.length;
};

/**
 * Export all treatments and payments for a specific patient to Excel
 */
export const exportSinglePatientExcel = (patient = {}, treatments = [], baseInfo = {}) => {
  const ptName =
    patient.patient_name ||
    patient.patientName ||
    patient.name ||
    patient.patient ||
    baseInfo.patientName ||
    "Patient";
  const ptId =
    patient.patientId ||
    patient.patient_id ||
    patient.id ||
    patient._id ||
    baseInfo.patientId ||
    "";
  const hospName = baseInfo.hospitalName || patient.hospital_name || patient.hospital || "";
  const country = baseInfo.country || patient.country || "";
  const city = baseInfo.city || patient.city || patient.location || "";

  const txList = Array.isArray(treatments) ? treatments : [];

  const ptBaseInfo = {
    country,
    city,
    hospital: hospName,
    patientName: ptName,
    patientId: ptId,
  };

  const flattenedRows = [];
  let totalBilling = 0;
  let totalReceived = 0;
  let totalDues = 0;

  if (txList.length) {
    for (const tx of txList) {
      const txRows = flattenTreatmentForExport(tx, ptBaseInfo);
      flattenedRows.push(...txRows);
      totalBilling += parseNumeric(tx.total_billing ?? tx.totalCharge ?? tx.total_charge ?? 0);
      totalReceived += parseNumeric(tx.payments_received ?? tx.paymentsReceived ?? tx.amount_paid ?? 0);
      totalDues += parseNumeric(tx.dues_pending ?? tx.duePayment ?? tx.duesPending ?? 0);
    }
  } else {
    // Single summary row for patient if no granular treatments loaded
    totalBilling = parseNumeric(patient.total_billing ?? patient.totalBilling ?? patient.billing ?? 0);
    totalReceived = parseNumeric(patient.payments_received ?? patient.paymentsReceived ?? patient.amount_paid ?? 0);
    totalDues = parseNumeric(patient.dues_pending ?? patient.duesPending ?? patient.due_payment ?? 0);
    flattenedRows.push({
      country,
      city,
      hospital: hospName,
      patientName: ptName,
      patientId: ptId,
      treatmentName: patient.treatment_name || patient.treatment || "—",
      treatmentId: patient.treatment_id || patient.treatmentId || "",
      section: "Patient Overview",
      itemDescription: `Patient Summary (${ptName})`,
      type: "Summary",
      date: patient.date || "",
      originalPrice: totalBilling,
      discount: "0%",
      finalCharge: totalBilling,
      paidAmount: totalReceived,
      paymentMethod: "—",
      paidTo: "Hospital / OMCA",
      paidFor: "Patient Treatment",
      invoices: "—",
      notes: "Direct Patient Billing Summary",
      totalBilling,
      paymentsReceived: totalReceived,
      duesPending: totalDues,
    });
  }

  const summary = {
    total_billing: totalBilling,
    payments_received: totalReceived,
    dues_pending: totalDues,
  };

  const cleanPt = String(ptName).replace(/[^a-zA-Z0-9_-]/g, "_");
  const customFilename = `payment-data-patient-${cleanPt}-${new Date().toISOString().slice(0, 10)}.xls`;

  downloadPaymentDataExcel(flattenedRows, summary, {
    customFilename,
    singlePatient: true,
    reportTitle: `OMCA CRM - Patient Treatments & Payments Report: ${ptName} (${ptId})`,
  });

  return flattenedRows.length;
};



