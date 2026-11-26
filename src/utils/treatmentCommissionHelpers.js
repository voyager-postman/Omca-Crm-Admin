import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

/**
 * Utility helpers to manage treatment-level commission & insurance percentages,
 * calculate commission on patient paid bills, and persist values across OMCA CRM.
 */

const STORAGE_KEY = "omca_treatment_commissions_v1";

const getStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { byTreatmentId: {}, byPatientId: {} };
  } catch (e) {
    console.warn("Error reading treatment commissions from localStorage:", e);
    return { byTreatmentId: {}, byPatientId: {} };
  }
};

const setStore = (store) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Error saving treatment commissions to localStorage:", e);
  }
};

/**
 * Save commission & insurance percentages for a treatment / patient
 */
export const saveTreatmentCommissionData = ({
  treatmentId,
  patientId,
  commissionPercentage,
  insurancePercentage,
  totalCharge,
  finalAmount,
  treatmentName,
}) => {
  const store = getStore();

  const commVal =
    commissionPercentage !== "" && commissionPercentage !== null && commissionPercentage !== undefined
      ? Number(commissionPercentage)
      : null;

  const insVal =
    insurancePercentage !== "" && insurancePercentage !== null && insurancePercentage !== undefined
      ? Number(insurancePercentage)
      : null;

  const data = {
    ...(commVal !== null ? { commission_percentage: commVal } : {}),
    ...(insVal !== null ? { insurance_percentage: insVal } : {}),
    ...(totalCharge !== undefined && totalCharge !== null && totalCharge !== "" ? { total_charge: Number(totalCharge) } : {}),
    ...(finalAmount !== undefined && finalAmount !== null && finalAmount !== "" ? { final_amount: Number(finalAmount) } : {}),
    ...(treatmentName ? { treatment_name: treatmentName } : {}),
    updated_at: new Date().toISOString(),
  };

  const cleanTId = treatmentId ? String(treatmentId).trim() : "";
  const cleanPId = patientId ? String(patientId).trim() : "";

  if (cleanTId) {
    store.byTreatmentId = store.byTreatmentId || {};
    store.byTreatmentId[cleanTId] = {
      ...(store.byTreatmentId[cleanTId] || {}),
      ...data,
      patient_id: cleanPId || store.byTreatmentId[cleanTId]?.patient_id,
    };
  }

  if (cleanPId) {
    store.byPatientId = store.byPatientId || {};
    store.byPatientId[cleanPId] = {
      ...(store.byPatientId[cleanPId] || {}),
      ...data,
      treatment_id: cleanTId || store.byPatientId[cleanPId]?.treatment_id,
    };
  }

  setStore(store);
  clearPatientTreatmentsCache();

  // Background sync to backend API endpoints
  if (cleanTId && !cleanTId.startsWith("tx-")) {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    if (commVal !== null) {
      axios
        .post(
          `${baseurl}referral/set-treatment-percentage`,
          {
            treatment_id: cleanTId,
            patient_id: cleanPId,
            commission_percentage: commVal,
          },
          { headers }
        )
        .catch(() => {});
    }
    if (insVal !== null) {
      axios
        .post(
          `${baseurl}insurance/set-treatment-percentage`,
          {
            treatment_id: cleanTId,
            patient_id: cleanPId,
            insurance_percentage: insVal,
          },
          { headers }
        )
        .catch(() => {});
    }
  }

  return data;
};

/**
 * Get commission & insurance percentages for a given treatment / patient
 */
export const getTreatmentCommissionData = ({
  treatmentId,
  patientId,
  treatmentObj = null,
  patientObj = null,
} = {}) => {
  const cleanTId = treatmentId ? String(treatmentId).trim() : "";
  const cleanPId = patientId ? String(patientId).trim() : "";

  let comm = undefined;
  let ins = undefined;

  // 1. Check persistent storage first (user explicit edit has highest priority)
  const store = getStore();
  const candidateTIds = [
    cleanTId,
    treatmentObj?.treatment_id,
    treatmentObj?.treatmentId,
    treatmentObj?.id,
    treatmentObj?._id,
    treatmentObj?.treatment_course_id,
  ].filter(Boolean).map(String);

  for (const tid of candidateTIds) {
    if (store.byTreatmentId?.[tid]) {
      const stored = store.byTreatmentId[tid];
      if (comm === undefined && stored.commission_percentage !== undefined && stored.commission_percentage !== null && stored.commission_percentage !== "") {
        comm = stored.commission_percentage;
      }
      if (ins === undefined && stored.insurance_percentage !== undefined && stored.insurance_percentage !== null && stored.insurance_percentage !== "") {
        ins = stored.insurance_percentage;
      }
    }
  }

  // 2. Direct from treatmentObj if present
  if (comm === undefined || comm === null || comm === "") {
    comm =
      treatmentObj?.commission_percentage ??
      treatmentObj?.referral_commission_percentage ??
      treatmentObj?.commissionPercentage ??
      treatmentObj?.referralCommissionPercentage ??
      treatmentObj?.referral_commission ??
      treatmentObj?.commission ??
      treatmentObj?.commission_rate ??
      treatmentObj?.commRate;
  }

  if (ins === undefined || ins === null || ins === "") {
    ins =
      treatmentObj?.insurance_percentage ??
      treatmentObj?.insurancePercentage ??
      treatmentObj?.insurance_commission_percentage ??
      treatmentObj?.insuranceCommissionPercentage ??
      treatmentObj?.insurance_claim_percentage ??
      treatmentObj?.insurance;
  }

  // 3. Check persistent storage by patient ID
  const candidatePIds = [
    cleanPId,
    patientObj?.patientId,
    patientObj?.id,
    patientObj?.patient_id,
    patientObj?.omcaPatientId,
    patientObj?.omca_patient_id,
    treatmentObj?.patientId,
    treatmentObj?.patient_id,
  ].filter(Boolean).map(String);

  for (const pid of candidatePIds) {
    if (store.byPatientId?.[pid]) {
      const stored = store.byPatientId[pid];
      if ((comm === undefined || comm === null || comm === "") && stored.commission_percentage !== undefined && stored.commission_percentage !== null && stored.commission_percentage !== "") {
        comm = stored.commission_percentage;
      }
      if ((ins === undefined || ins === null || ins === "") && stored.insurance_percentage !== undefined && stored.insurance_percentage !== null && stored.insurance_percentage !== "") {
        ins = stored.insurance_percentage;
      }
    }
  }

  // 4. Check patientObj if not found
  if ((comm === undefined || comm === null || comm === "") && patientObj) {
    comm =
      patientObj?.commission_percentage ??
      patientObj?.referral_commission_percentage ??
      patientObj?.commissionPercentage ??
      patientObj?.referralCommissionPercentage;
  }
  if ((ins === undefined || ins === null || ins === "") && patientObj) {
    ins =
      patientObj?.insurance_percentage ??
      patientObj?.insurancePercentage ??
      patientObj?.insurance_commission_percentage ??
      patientObj?.insuranceCommissionPercentage;
  }

  // 5. Default: If not set anywhere, commission defaults to 10%, insurance defaults to 0%
  const finalComm =
    comm !== undefined && comm !== null && comm !== "" && !isNaN(Number(comm))
      ? Number(comm)
      : 10;

  const finalIns =
    ins !== undefined && ins !== null && ins !== "" && !isNaN(Number(ins))
      ? Number(ins)
      : (comm !== undefined && comm !== null && comm !== "" && !isNaN(Number(comm)) ? Number(comm) : 10);

  return {
    commission_percentage: finalComm,
    insurance_percentage: finalIns,
  };
};

/**
 * Check if a payment record is genuine treatment/hospital payment (not OMCA charges, guest house, pharmacy, etc.)
 * Strictly enforces that non-treatment services/charges are excluded.
 */
export const isTreatmentPayment = (p) => {
  if (!p) return false;

  const extractName = (val) => {
    if (!val) return "";
    if (typeof val === "string") return val.trim().toLowerCase();
    if (typeof val === "object") {
      return String(val.name || val.title || val.label || val._id || "").trim().toLowerCase();
    }
    return String(val).trim().toLowerCase();
  };

  const paidTo = extractName(p.paid_to || p.paidTo);
  const paidFor = extractName(p.paid_for || p.paidFor);
  const notes = String(p.notes || p.note || p.description || "").trim().toLowerCase();
  const category = String(p.category || p.type || p.payment_category || "").trim().toLowerCase();
  const serviceName = extractName(p.service_name || p.serviceName || p.service);
  const guesthouseName = extractName(p.guesthouse_name || p.guest_house_name || p.guest_house || p.guesthouse);

  // 1. Strict Exclusion Checks:
  // Non-treatment charges (OMCA, Guest House, Services, Pharmacy, Visa, Ambulance, Hotel, Flight, Lab, etc.)
  if (
    category === "omca" ||
    category === "guest_house" ||
    category === "guesthouse" ||
    category === "service" ||
    category === "services" ||
    category === "pharmacy" ||
    category === "extra_service"
  ) {
    return false;
  }

  if (
    paidTo === "omca" ||
    paidTo.includes("omca") ||
    paidTo.includes("pharmacy") ||
    paidTo.includes("guest") ||
    paidTo.includes("house")
  ) {
    return false;
  }

  if (
    paidFor.includes("guest") ||
    paidFor.includes("house") ||
    paidFor.includes("service") ||
    paidFor.includes("pharmacy") ||
    paidFor.includes("visa") ||
    paidFor.includes("ambulance") ||
    paidFor.includes("omca") ||
    paidFor.includes("hotel") ||
    paidFor.includes("flight") ||
    paidFor.includes("air") ||
    paidFor.includes("forex") ||
    paidFor.includes("lab")
  ) {
    return false;
  }

  if (
    notes.includes("guest") ||
    notes.includes("house") ||
    notes.includes("omca") ||
    notes.includes("pharmacy") ||
    notes.includes("visa") ||
    notes.includes("ambulance") ||
    notes.includes("hotel") ||
    notes.includes("flight")
  ) {
    return false;
  }

  if (serviceName || guesthouseName) {
    return false;
  }

  // 2. Strict Whitelist Check for Treatment:
  // Must be explicitly for Treatment / Hospital
  const isForTreatment =
    paidFor === "treatment" ||
    paidFor.includes("treatment") ||
    paidTo.includes("hospital") ||
    paidTo === "hospital" ||
    category === "hospital" ||
    category === "treatment" ||
    notes.includes("treatment");

  if (isForTreatment) {
    return true;
  }

  // If not explicitly identified as treatment/hospital, DO NOT count it
  return false;
};

/**
 * Calculate the true treatment/hospital paid amount for a treatment object.
 * As instructed: "KEVAL TREATMENT PAID AMMOUNT LENA HAI OR JO MARK KIYA OMCA OR OTHER SECTION KA NAHI".
 * Non-treatment charges (e.g. OMCA charges, guest house, services, pharmacy) are excluded so that only treatment/hospital payments are counted.
 */
export const getTreatmentApprovedPaidAmount = (t) => {
  if (!t) return 0;

  // 1. Direct hospital.paidAmount or hospitalPaidAmount
  // In PatientDetail, info.hospital.paidAmount is strictly the Hospital Treatment section paid amount ($300)
  if (
    t?.hospital?.paidAmount !== undefined &&
    t?.hospital?.paidAmount !== null &&
    !isNaN(Number(t.hospital.paidAmount)) &&
    Number(t.hospital.paidAmount) >= 0
  ) {
    return Math.round(Number(t.hospital.paidAmount) * 1000) / 1000;
  }
  if (
    t?.hospitalPaidAmount !== undefined &&
    t?.hospitalPaidAmount !== null &&
    !isNaN(Number(t.hospitalPaidAmount)) &&
    Number(t.hospitalPaidAmount) >= 0
  ) {
    return Math.round(Number(t.hospitalPaidAmount) * 1000) / 1000;
  }

  // 2. If hospital.payments is populated, this is the exact list of hospital treatment payments
  if (Array.isArray(t?.hospital?.payments) && t.hospital.payments.length > 0) {
    const validPayments = t.hospital.payments.filter(isTreatmentPayment);
    const sum = validPayments.reduce((acc, p) => {
      const st = String(p?.status || "").toLowerCase().trim();
      const isApproved = !st || st === "approved" || st === "success" || st === "completed";
      return acc + (isApproved ? Number(p?.paid_amount ?? p?.amount ?? 0) || 0 : 0);
    }, 0);
    return Math.round(sum * 1000) / 1000;
  }

  // 3. Inspect payment_details (filter out non-treatment payments like OMCA/services/pharmacy/guest house)
  if (Array.isArray(t?.payment_details) && t.payment_details.length > 0) {
    const treatmentPayments = t.payment_details.filter((p) => {
      const st = String(p?.status || "").toLowerCase().trim();
      const isApproved = !st || st === "approved" || st === "success" || st === "completed";
      if (!isApproved) return false;
      return isTreatmentPayment(p);
    });

    const sum = treatmentPayments.reduce(
      (acc, p) => acc + (Number(p?.paid_amount ?? p?.amount ?? 0) || 0),
      0
    );
    return Math.round(sum * 1000) / 1000;
  }

  return 0;
};

/**
 * Calculate total bill, patient paid bill, commission earned, total payout given, remaining due, and status
 */
export const calculateCommissionMetrics = ({
  treatments = [],
  patientPayments = [],
  records = [],
  type = "referral", // "referral" | "insurance"
  fallbackPatient = null,
} = {}) => {
  const treatList = Array.isArray(treatments) ? treatments : [];

  // Compute Total Bill across treatments
  let totalBill = 0;
  let patientPaidBill = 0;
  let commissionPercentage = 0;
  let insurancePercentage = 0;

  if (treatList.length > 0) {
    treatList.forEach((t) => {
      const charge = Number(
        t?.final_amount ??
        t?.total_charge ??
        t?.finalAmount ??
        t?.totalCharge ??
        t?.treatment_course_fee ??
        0
      );
      totalBill += charge;

      // Calculate paid bill for this treatment from treatment/hospital approved payments only
      let tPaid = 0;
      if (t?.hospital_paid !== undefined && t?.hospital_paid !== null && !isNaN(Number(t.hospital_paid))) {
        tPaid = Number(t.hospital_paid);
      } else if (t?.payments_received !== undefined && t?.payments_received !== null && !isNaN(Number(t.payments_received))) {
        tPaid = Number(t.payments_received);
      } else {
        tPaid = getTreatmentApprovedPaidAmount(t);
      }
      patientPaidBill += tPaid;

      // Extract percentages
      const tId = t?.treatment_id || t?.treatmentId || t?.id || t?._id;
      const pId = t?.patientId || t?.patient_id || fallbackPatient?.patientId;
      const rates = getTreatmentCommissionData({
        treatmentId: tId,
        patientId: pId,
        treatmentObj: t,
        patientObj: fallbackPatient,
      });

      if (!commissionPercentage && rates.commission_percentage > 0) {
        commissionPercentage = rates.commission_percentage;
      }
      if (!insurancePercentage && rates.insurance_percentage > 0) {
        insurancePercentage = rates.insurance_percentage;
      }
    });
  } else if (fallbackPatient) {
    totalBill = Number(
      fallbackPatient?.totalBill ??
      fallbackPatient?.total_bill ??
      fallbackPatient?.total_charge ??
      fallbackPatient?.final_amount ??
      fallbackPatient?.decided_amount ??
      fallbackPatient?.decidedAmount ??
      0
    );
    patientPaidBill = Number(
      fallbackPatient?.paidBill ??
      fallbackPatient?.paid_bill ??
      fallbackPatient?.paid_amount ??
      fallbackPatient?.total_paid ??
      0
    );

    const rates = getTreatmentCommissionData({
      patientId: fallbackPatient?.patientId || fallbackPatient?.id,
      patientObj: fallbackPatient,
    });
    commissionPercentage = rates.commission_percentage;
    insurancePercentage = rates.insurance_percentage;
  }

  // If patient payments array was passed separately
  if (patientPaidBill === 0 && Array.isArray(patientPayments) && patientPayments.length > 0) {
    patientPaidBill = patientPayments.reduce((sum, p) => {
      const isApproved =
        !p?.status ||
        String(p.status).toLowerCase() === "approved" ||
        String(p.status).toLowerCase() === "success" ||
        String(p.status).toLowerCase() === "completed";
      return sum + (isApproved ? Number(p?.paid_amount || p?.amount || 0) : 0);
    }, 0);
  }

  // Determine active percentage based on type
  const activePercentage = type === "insurance" ? insurancePercentage : commissionPercentage;

  // Commission/Insurance on Paid Bill:
  // User instruction: "there would be no decided fee. It should be total bill, paid bill and then % of commission ... on paid bills"
  // "% of commission on Treatment basis"
  // "jab hame add payment recods karte hai tab usako jo bhi comition or insurance percentege diya gya ho usako vo mil jaye paid ammount par"
  const commissionEarned = Math.round(((patientPaidBill * activePercentage) / 100) * 100) / 100;

  // Total given/settled to referral partner or insurance from payment transaction records
  const recList = Array.isArray(records) ? records : [];
  const totalGiven = recList.reduce((sum, r) => {
    return sum + Number(r?.amount_given ?? r?.amount ?? r?.total_settled ?? 0);
  }, 0);

  const remainingDue = Math.max(0, Math.round((commissionEarned - totalGiven) * 100) / 100);

  let status = "Pending";
  if (commissionEarned > 0 && totalGiven >= commissionEarned) {
    status = "Completed";
  } else if (totalGiven > 0) {
    status = "Partial";
  } else {
    status = "Pending";
  }

  return {
    totalBill,
    patientPaidBill,
    commissionPercentage,
    insurancePercentage,
    activePercentage,
    commissionEarned,
    totalGiven,
    remainingDue,
    status,
    treatmentsCount: treatList.length,
  };
};

/**
 * Fast helper to resolve accurate treatment paid totals and commission for a patient,
 * taking into account stored/edited percentages (e.g. for TESTRam or any patient).
 */
export const getPatientTreatmentCommissionMetrics = (patient, type = "referral") => {
  const pIdResolved = patient?.patientNumber || patient?.omcaPatientId || patient?.omca_patient_id || patient?.patientId || patient?.patient_id || patient?.id || patient?._id;

  // 1. Dynamic treatments array from backend API
  if (Array.isArray(patient?.treatments) && patient.treatments.length > 0) {
    let totalPaid = 0;
    let totalCommission = 0;
    const treatList = patient.treatments.map((t) => {
      const p = Number(t.hospital_paid ?? t.payments_received ?? 0);
      const tid = t.treatment_id || t.treatmentId || t.id || t._id;
      const rates = getTreatmentCommissionData({
        treatmentId: tid,
        patientId: pIdResolved,
        treatmentObj: t,
      }) || {};
      const rate = Number(
        type === "insurance"
          ? (t.insurance_percentage ?? rates.insurance_percentage ?? 10)
          : (t.commission_percentage ?? rates.commission_percentage ?? 10)
      );
      const c = Number(
        (type === "insurance" ? t.claim_on_paid : t.commission_on_paid) ??
        Math.round(((p * rate) / 100) * 100) / 100
      );
      totalPaid += p;
      totalCommission += c;
      return {
        ...t,
        hospital_paid: p,
        payments_received: p,
        commission_percentage: rate,
        commission_on_paid: c,
        insurance_percentage: rate,
        insurance_on_paid: c,
        total_given: Number(t.total_given ?? t.settled_amount ?? 0),
        commission_due: Number(t.commission_due ?? Math.max(0, c - Number(t.total_given ?? t.settled_amount ?? 0))),
      };
    });

    const finalPaid = Number(patient.hospital_paid ?? patient.total_paid ?? totalPaid);
    const finalCommission = Number(
      (type === "insurance"
        ? (patient.claim_on_paid ?? patient.total_claim_on_paid)
        : (patient.commission_on_paid ?? patient.calculated_commission ?? patient.total_calculated_commission)) ??
      Math.round(totalCommission * 100) / 100
    );

    return {
      totalPaid: finalPaid,
      totalCommission: finalCommission,
      treatments: treatList,
    };
  }

  // 2. Direct patient-level metrics from backend API
  if (patient && (patient.hospital_paid !== undefined || patient.total_paid !== undefined)) {
    const ptPaid = Number(patient.hospital_paid ?? patient.total_paid ?? 0);
    const ptComm = Number(
      (type === "insurance"
        ? (patient.claim_on_paid ?? patient.total_claim_on_paid)
        : (patient.commission_on_paid ?? patient.calculated_commission ?? patient.total_calculated_commission)) ??
      0
    );
    return {
      totalPaid: ptPaid,
      totalCommission: ptComm,
      treatments: [],
    };
  }

  return null;
};

/**
 * Helper to resolve hospital or location name for a given treatment across
 * all possible patient structures, ongoing treatments, and backend responses.
 */
export const resolveTreatmentHospitalName = (t, patientData = null, patientProp = null, extraTreatments = []) => {
  if (!t && !patientData && !patientProp) return "—";

  const isLikelyId = (val) => {
    if (!val || typeof val !== "string") return false;
    const trimmed = val.trim();
    if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return true; // Mongo ObjectId
    if (/^\d+$/.test(trimmed)) return true; // Numeric ID
    return false;
  };

  const cleanStr = (val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        trimmed &&
        trimmed !== "—" &&
        trimmed !== "-" &&
        trimmed !== "null" &&
        trimmed !== "undefined" &&
        !isLikelyId(trimmed)
      ) {
        return trimmed;
      }
    }
    return null;
  };

  // 1. Direct fields on treatment `t`
  const hospObj = Array.isArray(t?.hospital) ? t.hospital[0] : t?.hospital;
  const directCandidates = [
    cleanStr(t?.hospital_name),
    cleanStr(t?.hospitalName),
    cleanStr(t?.hospital_Name),
    cleanStr(t?.hosp_name),
    cleanStr(hospObj?.hospital_Name),
    cleanStr(hospObj?.hospital_name),
    cleanStr(hospObj?.hospitalName),
    cleanStr(hospObj?.name),
    cleanStr(t?.hospital?.details?.hospital_Name),
    cleanStr(t?.hospital?.details?.hospital_name),
    cleanStr(t?.hospital?.details?.name),
    cleanStr(t?.hospital?.hospital_Name),
    cleanStr(t?.hospital?.hospital_name),
    cleanStr(t?.hospital?.name),
    cleanStr(t?.hospital_details?.hospital_Name),
    cleanStr(t?.hospital_details?.hospital_name),
    cleanStr(t?.hospital_details?.name),
    cleanStr(t?.hospital_info?.hospital_Name),
    cleanStr(t?.hospital_info?.name),
    cleanStr(t?.hospital),
  ];
  for (const c of directCandidates) {
    if (c) return c;
  }

  // Treatment identification tokens
  const tIdStr = String(t?.treatment_id || t?.treatmentId || t?.id || t?._id || "").trim();
  const tCourseIdStr = String(t?.treatment_course_id || t?.course_id || "").trim();
  const tNameStr = String(t?.treatment_name || t?.treatment_course_name || t?.name || "").trim().toLowerCase();

  // 2. Check ongoing_treatments in current_treatment_or_plan
  const ongoingLists = [
    patientData?.current_treatment_or_plan?.ongoing_treatments,
    patientProp?.current_treatment_or_plan?.ongoing_treatments,
    patientData?.ongoing_treatments,
    patientProp?.ongoing_treatments,
    patientData?.treatment_or_plan?.ongoing_treatments,
    patientProp?.treatment_or_plan?.ongoing_treatments,
  ];

  for (const list of ongoingLists) {
    if (Array.isArray(list) && list.length > 0) {
      const match = list.find((item) => {
        const iId = String(item?.treatment_id || item?.treatmentId || item?.id || item?._id || "").trim();
        const iCourseId = String(item?.treatment_course_id || item?.course_id || "").trim();
        const iName = String(item?.name || item?.treatment_name || "").trim().toLowerCase();

        return (
          (tIdStr && (iId === tIdStr || iCourseId === tIdStr)) ||
          (tCourseIdStr && (iId === tCourseIdStr || iCourseId === tCourseIdStr)) ||
          (tNameStr && iName && (tNameStr === iName || tNameStr.includes(iName) || iName.includes(tNameStr)))
        );
      });

      if (match) {
        const matchHosp =
          cleanStr(match?.hospital_name) ||
          cleanStr(match?.hospitalName) ||
          cleanStr(match?.hospital_Name) ||
          cleanStr(match?.hospital?.details?.hospital_Name) ||
          cleanStr(match?.hospital?.hospital_name) ||
          cleanStr(match?.hospital?.name) ||
          cleanStr(match?.hospital) ||
          cleanStr(match?.location);
        if (matchHosp) return matchHosp;
      }
    }
  }

  // 3. Match against current_treatment_or_plan
  const plans = [
    patientData?.current_treatment_or_plan,
    patientProp?.current_treatment_or_plan,
    patientData?.treatment_or_plan,
    patientProp?.treatment_or_plan,
  ];

  for (const plan of plans) {
    if (plan && typeof plan === "object") {
      const pId = String(plan?.treatment_id || plan?.treatmentId || plan?.id || plan?._id || "").trim();
      const pCourseId = String(plan?.treatment_course_id || plan?.course_id || "").trim();
      const pName = String(plan?.name || plan?.treatment_name || "").trim().toLowerCase();

      const isMatch =
        (tIdStr && (pId === tIdStr || pCourseId === tIdStr)) ||
        (tCourseIdStr && (pId === tCourseIdStr || pCourseId === tCourseIdStr)) ||
        (tNameStr && pName && (tNameStr === pName || tNameStr.includes(pName) || pName.includes(tNameStr)));

      if (isMatch) {
        const planHosp =
          cleanStr(plan?.hospital_name) ||
          cleanStr(plan?.hospitalName) ||
          cleanStr(plan?.hospital_Name) ||
          cleanStr(plan?.hospital?.details?.hospital_Name) ||
          cleanStr(plan?.hospital?.name) ||
          cleanStr(plan?.hospital);
        if (planHosp) return planHosp;
      }
    }
  }

  // 4. Match against extraTreatments (e.g. from get_patient_treatment)
  if (Array.isArray(extraTreatments) && extraTreatments.length > 0) {
    const match = extraTreatments.find((item) => {
      const iId = String(item?.treatment_id || item?.treatmentId || item?.id || item?._id || "").trim();
      const iCourseId = String(item?.treatment_course_id || item?.course_id || "").trim();
      const iName = String(item?.treatment_name || item?.name || "").trim().toLowerCase();

      return (
        (tIdStr && (iId === tIdStr || iCourseId === tIdStr)) ||
        (tCourseIdStr && (iId === tCourseIdStr || iCourseId === tCourseIdStr)) ||
        (tNameStr && iName && (tNameStr === iName || tNameStr.includes(iName) || iName.includes(tNameStr)))
      );
    });

    if (match) {
      const extraHosp =
        cleanStr(match?.hospital_name) ||
        cleanStr(match?.hospitalName) ||
        cleanStr(match?.hospital_Name) ||
        cleanStr(match?.hospital?.details?.hospital_Name) ||
        cleanStr(match?.hospital?.name) ||
        cleanStr(match?.hospital);
      if (extraHosp) return extraHosp;
    }
  }

  // 5. Patient-level hospital name fallback
  const patientHospCandidates = [
    cleanStr(patientData?.current_treatment_or_plan?.hospital_name),
    cleanStr(patientProp?.current_treatment_or_plan?.hospital_name),
    cleanStr(patientData?.hospital_name),
    cleanStr(patientData?.hospitalName),
    cleanStr(patientData?.hospital_Name),
    cleanStr(patientData?.hospital?.details?.hospital_Name),
    cleanStr(patientData?.hospital?.name),
    cleanStr(patientData?.hospital),
    cleanStr(patientProp?.hospital_name),
    cleanStr(patientProp?.hospitalName),
    cleanStr(patientProp?.hospital_Name),
    cleanStr(patientProp?.hospital?.details?.hospital_Name),
    cleanStr(patientProp?.hospital?.name),
    cleanStr(patientProp?.hospital),
  ];
  for (const ph of patientHospCandidates) {
    if (ph) return ph;
  }

  // 6. Patient Location / treatingIn / country fallback (since column is "Location / Hospital")
  const locationCandidates = [
    cleanStr(t?.location),
    cleanStr(t?.city),
    cleanStr(t?.country),
    cleanStr(patientData?.treatingIn),
    cleanStr(patientProp?.treatingIn),
    cleanStr(patientData?.country),
    cleanStr(patientProp?.country),
    cleanStr(patientData?.town),
    cleanStr(patientProp?.town),
  ];
  for (const loc of locationCandidates) {
    if (loc) return loc;
  }

  return "—";
};

// In-memory cache for patient treatments & details to make popups & views instantaneous
const patientTreatmentsCache = new Map();
const CACHE_TTL_MS = 10 * 1000; // 10 seconds cache

export const clearPatientTreatmentsCache = (patientId = null) => {
  if (patientId) {
    patientTreatmentsCache.delete(String(patientId).trim());
  } else {
    patientTreatmentsCache.clear();
  }
};

/**
 * Robust, high-performance loader to fetch all treatments, payment records and full patient details.
 * Uses intelligent in-memory caching and avoids redundant waterfalls.
 */
export const fetchPatientTreatmentsAndDetails = async (patient, forceRefresh = false) => {
  if (!patient) return { treatments: [], payments: [], patientData: null };

  const cacheKey = String(
    patient?.patientNumber ||
    patient?.omcaPatientId ||
    patient?.omca_patient_id ||
    patient?.patientId ||
    patient?.patient_id ||
    patient?.id ||
    patient?._id ||
    ""
  ).trim();

  // 1. Instant Cache hit (0ms latency)
  if (!forceRefresh && cacheKey && patientTreatmentsCache.has(cacheKey)) {
    const cached = patientTreatmentsCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 2. Fetch treatments & payments from backend
  let payments = [];
  let patientData = null;
  let extraTreatments = [];

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const requestConfig = { headers: authHeaders, timeout: 5000 };

  // Use a map to collect and deduplicate all treatments by treatment ID
  const treatmentsMap = new Map();

  const addRawTreatment = (t) => {
    if (!t || typeof t !== "object") return;
    const tId = String(t.treatment_id || t.treatmentId || t.id || t._id || "").trim();
    if (!tId) return;
    if (treatmentsMap.has(tId)) {
      treatmentsMap.set(tId, { ...treatmentsMap.get(tId), ...t });
    } else {
      treatmentsMap.set(tId, { ...t });
    }
  };

  // 1. Seed from patient object if already provided
  if (Array.isArray(patient?.treatments)) {
    patient.treatments.forEach(addRawTreatment);
  }
  if (Array.isArray(patient?.patient_treatments)) {
    patient.patient_treatments.forEach(addRawTreatment);
  }
  if (Array.isArray(patient?.payment_details)) {
    payments = patient.payment_details;
  }
  if (Array.isArray(patient?.records)) {
    patient.records.forEach((r) => {
      const tid = r.treatment_id || r.treatmentId;
      if (tid && !treatmentsMap.has(String(tid))) {
        treatmentsMap.set(String(tid), {
          treatment_id: String(tid),
          treatment_name: r.treatment_name || r.treatmentName || `Treatment ${tid}`,
          final_amount: Number(r.decided_amount || r.total_charge || 0),
          hospital_name: r.hospital_name || r.hospital || "",
        });
      }
    });
  }

  // Collect candidate identifiers
  const rawIds = [
    patient?.patientNumber,
    patient?.omcaPatientId,
    patient?.omca_patient_id,
    patient?.patientId,
    patient?.patient_id,
    patient?.id,
    patient?._id,
  ].filter(Boolean).map(v => String(v).trim());

  // 2. Query all_patients search if needed (avoids direct get_patient / user/get_particular_patient 404/400 errors)
  if (treatmentsMap.size < 1 && token) {
    const omcaSearch = rawIds.find(id => id.toUpperCase().startsWith("OMCA")) || rawIds[0];
    if (omcaSearch) {
      try {
        const searchRes = await axios.get(
          `${baseurl}all_patients?page=1&limit=20&search=${encodeURIComponent(omcaSearch)}`,
          requestConfig
        );
        const list =
          searchRes?.data?.details ||
          searchRes?.data?.data?.details ||
          searchRes?.data?.patients ||
          searchRes?.data?.data ||
          [];
        if (Array.isArray(list)) {
          const found = list.find((p) => {
            const pNum = String(p?.patientNumber || p?.patientId || p?.patient_id || "").trim().toLowerCase();
            const pName = String(p?.patient_name || p?.patientName || p?.name || "").trim().toLowerCase();
            return (
              rawIds.some((cid) => pNum === cid.toLowerCase()) ||
              (patient?.patientName && pName === patient.patientName.trim().toLowerCase())
            );
          });
          if (found) {
            patientData = patientData || found;
            if (Array.isArray(found.treatments)) found.treatments.forEach(addRawTreatment);
            if (Array.isArray(found.patient_treatments)) found.patient_treatments.forEach(addRawTreatment);
            if (Array.isArray(found.payment_details) && payments.length === 0) payments = found.payment_details;
          }
        }
      } catch (sErr) { }
    }
  }

  // Build the unified treatments list
  let treatments = Array.from(treatmentsMap.values());

  // 4b. Query authoritative get_treatment_by_id for each treatment to pull true saved commission/hospital/fee
  if (Array.isArray(treatments) && treatments.length > 0) {
    await Promise.all(
      treatments.map(async (t) => {
        const tId = t?.treatment_id || t?.treatmentId || t?.id || t?._id;
        if (!tId) return;
        try {
          const res = await axios.get(
            `${baseurl}get_treatment_by_id/${encodeURIComponent(tId)}`,
            requestConfig
          );
          const detail = res?.data?.data || res?.data;
          if (detail && typeof detail === "object") {
            const remoteComm =
              detail.commission_percentage !== undefined &&
                detail.commission_percentage !== null &&
                detail.commission_percentage !== ""
                ? detail.commission_percentage
                : detail.referral_commission_percentage !== undefined &&
                  detail.referral_commission_percentage !== null &&
                  detail.referral_commission_percentage !== ""
                  ? detail.referral_commission_percentage
                  : undefined;

            if (remoteComm !== undefined) {
              t.commission_percentage = Number(remoteComm);
              t.referral_commission_percentage = Number(remoteComm);
            }

            if (
              detail.insurance_percentage !== undefined &&
              detail.insurance_percentage !== null &&
              detail.insurance_percentage !== ""
            ) {
              t.insurance_percentage = Number(detail.insurance_percentage);
            }

            const hospObj = Array.isArray(detail.hospital) ? detail.hospital[0] : detail.hospital;
            const hospName = detail.hospital_name || hospObj?.hospital_Name || hospObj?.hospitalName || hospObj?.name || "";
            if (hospName) {
              t.hospital_name = hospName;
            }
            if (detail.hospital_ID || hospObj?.hospital_id) {
              t.hospital_ID = detail.hospital_ID || hospObj?.hospital_id || t.hospital_ID;
            }

            if (detail.treatment_course_name && !t.treatment_name) {
              t.treatment_name = detail.treatment_course_name;
            }

            if (detail.final_amount !== undefined && detail.final_amount !== null && detail.final_amount !== "") {
              t.final_amount = Number(detail.final_amount);
            }
            if (detail.total_charge !== undefined && detail.total_charge !== null && detail.total_charge !== "") {
              t.total_charge = Number(detail.total_charge);
            } else if (detail.totalCharge !== undefined && detail.totalCharge !== null && detail.totalCharge !== "") {
              t.total_charge = Number(detail.totalCharge);
            }

            if (detail.hospital) {
              t.hospital = { ...(t.hospital || {}), ...detail.hospital };
            }
            if (Array.isArray(detail.hospital?.payments) && detail.hospital.payments.length > 0) {
              t.hospital = t.hospital || {};
              t.hospital.payments = detail.hospital.payments;
            }
            if (detail.hospital?.paidAmount !== undefined && detail.hospital?.paidAmount !== null) {
              t.hospital = t.hospital || {};
              t.hospital.paidAmount = detail.hospital.paidAmount;
            }
            if (Array.isArray(detail.payment_details) && detail.payment_details.length > 0) {
              t.payment_details = detail.payment_details;
            }

            // Sync into persistent localStorage store
            if (remoteComm !== undefined || detail.insurance_percentage !== undefined) {
              const currentStore = getStore();
              currentStore.byTreatmentId = currentStore.byTreatmentId || {};
              currentStore.byTreatmentId[String(tId)] = {
                ...(currentStore.byTreatmentId[String(tId)] || {}),
                ...(remoteComm !== undefined && remoteComm !== null && remoteComm !== "" ? { commission_percentage: Number(remoteComm) } : {}),
                ...(detail.insurance_percentage !== undefined && detail.insurance_percentage !== null && detail.insurance_percentage !== "" ? { insurance_percentage: Number(detail.insurance_percentage) } : {}),
                treatment_name: t.treatment_name || detail.treatment_course_name,
                patient_id: patient?.patientId || patient?.id,
              };
              setStore(currentStore);
            }
          }
        } catch (e) {
          // ignore single lookup failure
        }
      })
    );
  }

  // 5. Check localStorage persistent commission store & resolve hospital names
  const enhancedTreatments = treatments.map((t, idx) => {
    const tId = t?.treatment_id || t?.treatmentId || t?.id || t?._id || `tx-${idx}`;
    const pId = patient?.patientId || patient?.id;
    const rates = getTreatmentCommissionData({
      treatmentId: tId,
      patientId: pId,
      treatmentObj: t,
      patientObj: patient,
    });

    const totalCharge = Number(t?.total_charge ?? t?.treatment_course_fee ?? t?.billing ?? 0);
    const finalAmount = Number(t?.final_amount ?? totalCharge);
    const totalBilling = finalAmount || totalCharge;

    // Calculate approved treatment payments received (ONLY Treatment / Hospital payments!)
    let paymentsReceived = Number(t?.hospital_paid ?? t?.payments_received ?? 0);
    let tPayments = [];

    if (paymentsReceived === 0) {
      if (Array.isArray(t?.hospital?.payments) && t.hospital.payments.length > 0) {
        tPayments = t.hospital.payments.filter(isTreatmentPayment);
        paymentsReceived = tPayments.reduce((sum, p) => {
          const st = String(p?.status || "").toLowerCase().trim();
          const isApproved = !st || st === "approved" || st === "success" || st === "completed";
          return sum + (isApproved ? Number(p?.paid_amount ?? p?.amount ?? 0) || 0 : 0);
        }, 0);
      } else if (
        t?.hospital?.paidAmount !== undefined &&
        t?.hospital?.paidAmount !== null &&
        !isNaN(Number(t.hospital.paidAmount)) &&
        Number(t.hospital.paidAmount) >= 0
      ) {
        paymentsReceived = Number(t.hospital.paidAmount);
        if (Array.isArray(t?.hospital?.payments)) {
          tPayments = t.hospital.payments.filter(isTreatmentPayment);
        }
      } else if (
        t?.hospitalPaidAmount !== undefined &&
        t?.hospitalPaidAmount !== null &&
        !isNaN(Number(t.hospitalPaidAmount)) &&
        Number(t.hospitalPaidAmount) >= 0
      ) {
        paymentsReceived = Number(t.hospitalPaidAmount);
        if (Array.isArray(t?.hospital?.payments)) {
          tPayments = t.hospital.payments.filter(isTreatmentPayment);
        }
      } else if (Array.isArray(t?.payment_details) && t.payment_details.length > 0) {
        tPayments = t.payment_details.filter(isTreatmentPayment);
        paymentsReceived = tPayments.reduce((sum, p) => {
          const st = String(p?.status || "").toLowerCase().trim();
          const isApproved = !st || st === "approved" || st === "success" || st === "completed";
          return sum + (isApproved ? Number(p?.paid_amount ?? p?.amount ?? 0) || 0 : 0);
        }, 0);
      } else if (Array.isArray(payments) && payments.length > 0) {
        tPayments = payments.filter((p) => {
          const matchId =
            (p.treatment_id && String(p.treatment_id) === String(tId)) ||
            (p.treatmentId && String(p.treatmentId) === String(tId)) ||
            (p.id && String(p.id) === String(tId));
          return matchId && isTreatmentPayment(p);
        });
        paymentsReceived = tPayments.reduce((sum, p) => {
          const st = String(p?.status || "").toLowerCase().trim();
          const isApproved = !st || st === "approved" || st === "success" || st === "completed";
          return sum + (isApproved ? Number(p?.paid_amount ?? p?.amount ?? 0) || 0 : 0);
        }, 0);
      }
    } else if (Array.isArray(t?.payment_details)) {
      tPayments = t.payment_details.filter(isTreatmentPayment);
    }

    paymentsReceived = Math.round(paymentsReceived * 1000) / 1000;

    const commRate = rates.commission_percentage || 0;
    const insRate = rates.insurance_percentage || 0;
    const commEarned = Number(
      t?.commission_on_paid ??
      Math.round(((paymentsReceived * commRate) / 100) * 100) / 100
    );
    const insEarned = Number(
      t?.claim_on_paid ??
      t?.insurance_on_paid ??
      Math.round(((paymentsReceived * insRate) / 100) * 100) / 100
    );
    const duesPending = Math.max(0, totalBilling - paymentsReceived);

    const resolvedHospital = resolveTreatmentHospitalName(t, patientData, patient, extraTreatments);

    return {
      ...t,
      treatment_id: tId,
      treatment_name: t?.treatment_name || t?.treatment_course_name || t?.name || `Treatment ${idx + 1}`,
      hospital_name: resolvedHospital,
      total_charge: totalCharge,
      final_amount: finalAmount,
      total_billing: totalBilling,
      payment_details: tPayments,
      payments_received: paymentsReceived,
      hospital_paid: paymentsReceived,
      commission_percentage: commRate,
      insurance_percentage: insRate,
      commission_on_paid: commEarned,
      insurance_on_paid: insEarned,
      claim_on_paid: insEarned,
      total_given: Number(t?.total_given ?? t?.settled_amount ?? 0),
      settled_amount: Number(t?.settled_amount ?? t?.total_given ?? 0),
      commission_due: Number(t?.commission_due ?? Math.max(0, commEarned - Number(t?.total_given ?? 0))),
      remaining_due: Number(t?.remaining_due ?? Math.max(0, insEarned - Number(t?.total_given ?? 0))),
      dues_pending: duesPending,
    };
  });

  const result = {
    treatments: enhancedTreatments,
    payments,
    patientData,
  };

  if (cacheKey) {
    patientTreatmentsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  }

  return result;
};

/**
 * Payout record treatment mapping helper
 */
export const savePayoutRecordTreatment = (recordId, { treatmentId, treatmentName }) => {
  try {
    const key = "omca_payout_records_treatment_map";
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[String(recordId)] = {
      treatmentId: treatmentId ? String(treatmentId) : "",
      treatmentName: treatmentName || "",
    };
    localStorage.setItem(key, JSON.stringify(map));
  } catch (e) { }
};

export const getPayoutRecordTreatment = (record) => {
  if (record?.treatment_name || record?.treatmentName) {
    return {
      treatmentId: record.treatment_id || record.treatmentId || "",
      treatmentName: record.treatment_name || record.treatmentName || "",
    };
  }
  try {
    const key = "omca_payout_records_treatment_map";
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    const recId = record?.id || record?._id || record?.record_id;
    if (recId && map[String(recId)]) {
      return map[String(recId)];
    }
  } catch (e) { }
  return { treatmentId: "", treatmentName: "" };
};


