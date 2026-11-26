import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import PatientSearchSelect from "../../../components/PatientSearchSelect";
import {
  createPhysiotherapyReferral,
  updatePhysiotherapyCase,
  uploadPhysiotherapyDocuments,
  fetchPhysiotherapyDetails,
  fetchAssignedPhysiotherapyPatients,
  fetchPhysiotherapyStaff,
  searchAssignedPhysiotherapyPatients,
  formatDiseaseName,
  PHYSIO_STATUSES,
  PHYSIO_MODALITIES,
  isImageFile,
  isPdfFile,
  getPhysioFileUrl,
  filterActiveCaseDocuments,
  markCaseDocumentsRemoved,
} from "../../../services/physiotherapyApi";

const EMPTY_FORM = {
  referralReason: "",
  clinicalDiagnosis: "",
  category: "General",
  affectedBodyPart: "",
  priority: "Normal",
  prescribedSessions: 10,
  sessionFrequency: "Daily",
  treatmentGoals: "",
  specialInstructions: "",
  therapistName: "",
  therapistPhone: "",
  therapistRole: "Physiotherapist",
  mobilityScore: "Independent",
  baselinePainScore: 5,
  rangeOfMotionNotes: "",
  postureEvaluation: "",
  assessmentNotes: "",
  startDate: new Date().toISOString().split("T")[0],
  expectedEndDate: "",
  notes: "",
  status: "Referred",
};

const parseInitialAssessment = (caseObj = {}) => {
  let ia = caseObj.initialAssessment ?? caseObj.initial_assessment ?? {};
  if (typeof ia === "string") {
    try {
      ia = JSON.parse(ia);
    } catch {
      ia = {};
    }
  }
  if (!ia || typeof ia !== "object") ia = {};

  return {
    mobilityScore:
      ia.mobilityScore || caseObj.mobilityScore || "Independent",
    baselinePainScore:
      ia.baselinePainScore ?? caseObj.baselinePainScore ?? 5,
    rangeOfMotionNotes:
      ia.rangeOfMotionNotes ||
      ia.romNotes ||
      caseObj.rangeOfMotionNotes ||
      "",
    postureEvaluation:
      ia.postureEvaluation || caseObj.postureEvaluation || "",
    assessmentNotes:
      ia.notes ||
      ia.assessmentNotes ||
      caseObj.assessmentNotes ||
      "",
  };
};

const parseTherapist = (caseObj = {}) => {
  const raw = caseObj.assignedPhysiotherapist ?? caseObj.therapist ?? {};
  if (typeof raw === "string") {
    return { userId: "", name: raw, phone: "", role: "Physiotherapist" };
  }
  let phone = String(raw?.phone || raw?.mobile || "").trim();
  // Form input stores local number; dial code is prepended on submit
  phone = phone.replace(/^\+91\s*/i, "").trim();
  return {
    userId: raw?.userId || raw?._id || raw?.id || raw?.staffId || "",
    name: raw?.name || raw?.therapistName || "",
    phone,
    role: raw?.role || "Physiotherapist",
  };
};

const normalizeModalityLabel = (value) => {
  const label = String(value || "").trim();
  if (!label) return "";

  const lower = label.toLowerCase();
  const exact = PHYSIO_MODALITIES.find((opt) => opt.toLowerCase() === lower);
  if (exact) return exact;

  // API often stores short names: "TENS", "Cryotherapy", "Ultrasound"
  const fuzzy = PHYSIO_MODALITIES.find((opt) => {
    const optLower = opt.toLowerCase();
    const optCore = optLower.split("(")[0].split("/")[0].trim();
    const labelCore = lower.split("(")[0].split("/")[0].trim();
    return (
      optLower.includes(labelCore) ||
      labelCore.includes(optCore) ||
      optCore.startsWith(labelCore) ||
      labelCore.startsWith(optCore)
    );
  });
  return fuzzy || label;
};

const coerceModalitiesList = (raw) => {
  if (!raw && raw !== 0) return [];

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        return [
          item.name ||
            item.label ||
            item.modality ||
            item.modalityName ||
            item.title ||
            item.value ||
            "",
        ];
      }
      return [];
    });
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) || typeof parsed === "object") {
        return coerceModalitiesList(parsed);
      }
    } catch {
      // comma / pipe separated plain string
    }
    return trimmed.split(/[,|;]+/).map((s) => s.trim()).filter(Boolean);
  }

  if (typeof raw === "object") {
    // { "TENS": true, "Cryotherapy": true } or similar map
    return Object.keys(raw).filter((key) => {
      const val = raw[key];
      return val === true || val === 1 || val === "1" || val === "true" || val === "yes";
    });
  }

  return [];
};

const collectRawModalities = (caseObj = {}) => {
  const ia =
    (caseObj.initialAssessment && typeof caseObj.initialAssessment === "object"
      ? caseObj.initialAssessment
      : null) ||
    (caseObj.initial_assessment && typeof caseObj.initial_assessment === "object"
      ? caseObj.initial_assessment
      : null) ||
    {};

  const candidates = [
    caseObj.modalitiesUsed,
    caseObj.modalities,
    caseObj.therapyModalities,
    caseObj.prescribedModalities,
    caseObj.electrotherapy,
    caseObj.electrotherapyModalities,
    caseObj.selectedModalities,
    ia.modalitiesUsed,
    ia.modalities,
    ia.therapyModalities,
  ];

  // Also collect from logged sessions (older cases may only store modalities there)
  const sessions = Array.isArray(caseObj.sessions)
    ? caseObj.sessions
    : Array.isArray(caseObj.sessionHistory)
    ? caseObj.sessionHistory
    : Array.isArray(caseObj.physiotherapySessions)
    ? caseObj.physiotherapySessions
    : [];

  sessions.forEach((sess) => {
    if (!sess || typeof sess !== "object") return;
    candidates.push(sess.modalitiesUsed, sess.modalities, sess.therapyModalities);
  });

  // Union all non-empty sources (don't stop at first key — it may be an empty array)
  const combined = [];
  candidates.forEach((candidate) => {
    coerceModalitiesList(candidate).forEach((item) => {
      if (item) combined.push(item);
    });
  });

  // Last resort: scan nested strings/arrays for known modality labels (exact / full-label contains)
  if (combined.length === 0) {
    const found = new Set();
    const tryAdd = (text) => {
      const value = String(text || "").trim();
      if (!value) return;
      const lower = value.toLowerCase();
      PHYSIO_MODALITIES.forEach((mod) => {
        const modLower = mod.toLowerCase();
        if (lower === modLower || lower.includes(modLower) || modLower.includes(lower)) {
          // Avoid tiny fragments (e.g. "Heat") falsely matching
          if (lower.length >= 8 || lower === modLower) {
            found.add(mod);
          }
        }
      });
    };
    const visit = (node, depth = 0) => {
      if (!node || depth > 4) return;
      if (typeof node === "string") {
        tryAdd(node);
        coerceModalitiesList(node).forEach(tryAdd);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item) => visit(item, depth + 1));
        return;
      }
      if (typeof node === "object") {
        Object.values(node).forEach((val) => visit(val, depth + 1));
      }
    };
    visit(caseObj);
    return Array.from(found);
  }

  return combined;
};

const MODALITY_CACHE_KEY = "omca_physio_case_modalities_v1";

const cacheCaseModalities = (caseId, modalities) => {
  if (!caseId) return;
  try {
    const all = JSON.parse(localStorage.getItem(MODALITY_CACHE_KEY) || "{}");
    all[String(caseId)] = Array.isArray(modalities) ? modalities : [];
    localStorage.setItem(MODALITY_CACHE_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / private mode
  }
};

const readCachedCaseModalities = (caseId) => {
  if (!caseId) return [];
  try {
    const all = JSON.parse(localStorage.getItem(MODALITY_CACHE_KEY) || "{}");
    const raw = all[String(caseId)];
    return Array.isArray(raw) ? raw.map(normalizeModalityLabel).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const parseModalities = (caseObj = {}) => {
  const seen = new Set();
  const result = [];
  collectRawModalities(caseObj).forEach((item) => {
    const normalized = normalizeModalityLabel(item);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  // Fallback: browser cache if API omitted modalitiesUsed on GET
  if (result.length === 0) {
    const cached = readCachedCaseModalities(caseObj._id || caseObj.id);
    cached.forEach((normalized) => {
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(normalized);
    });
  }

  return result;
};

const isModalitySelected = (mod, selectedList = []) => {
  const target = normalizeModalityLabel(mod).toLowerCase();
  return selectedList.some(
    (s) => normalizeModalityLabel(s).toLowerCase() === target
  );
};

/** Details API sometimes wraps the case one or more levels deeper */
const unwrapCasePayload = (payload, depth = 0) => {
  if (!payload || typeof payload !== "object" || depth > 3) return null;

  const looksLikeCase =
    payload.clinicalDiagnosis != null ||
    payload.modalitiesUsed != null ||
    payload.modalities != null ||
    payload.initialAssessment != null ||
    payload.initial_assessment != null ||
    payload.referralReason != null ||
    payload.patientId != null ||
    payload.prescribedSessions != null ||
    payload.assignedPhysiotherapist != null ||
    Array.isArray(payload.sessions);

  if (looksLikeCase) return payload;

  const nested =
    payload.data ||
    payload.details ||
    payload.case ||
    payload.physiotherapy ||
    payload.physioCase ||
    payload.result ||
    null;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return unwrapCasePayload(nested, depth + 1);
  }

  // Array of one case
  if (Array.isArray(nested) && nested[0] && typeof nested[0] === "object") {
    return unwrapCasePayload(nested[0], depth + 1);
  }

  return payload;
};

const mapCaseToForm = (caseObj = {}) => {
  const assessment = parseInitialAssessment(caseObj);
  const therapist = parseTherapist(caseObj);
  const patientObj =
    caseObj.patientObjectId && typeof caseObj.patientObjectId === "object"
      ? caseObj.patientObjectId
      : {};

  return {
    patient: {
      _id: patientObj._id || caseObj.patientObjectId || caseObj.patient_id,
      patientId:
        caseObj.patientId ||
        patientObj.patientId ||
        patientObj.patientNumber ||
        caseObj.patient_id,
      patientObjectId: patientObj._id || caseObj.patientObjectId || caseObj.patient_id,
      name:
        patientObj.patient_name ||
        caseObj.patientName ||
        caseObj.patient_name ||
        "Patient",
      phone: patientObj.phone || patientObj.mobile || "",
      country: patientObj.country || "",
      assignedPhysiotherapist: caseObj.assignedPhysiotherapist || null,
    },
    therapistId: therapist.userId || "",
    formData: {
      referralReason: caseObj.referralReason || "",
      clinicalDiagnosis: caseObj.clinicalDiagnosis || "",
      category: caseObj.category || "General",
      affectedBodyPart: caseObj.affectedBodyPart || "",
      priority: caseObj.priority || "Normal",
      prescribedSessions: caseObj.prescribedSessions || 10,
      sessionFrequency: caseObj.sessionFrequency || "Daily",
      treatmentGoals: caseObj.treatmentGoals || "",
      specialInstructions: caseObj.specialInstructions || "",
      therapistName: therapist.name,
      therapistPhone: therapist.phone,
      therapistRole: therapist.role || "Physiotherapist",
      mobilityScore: assessment.mobilityScore,
      baselinePainScore: assessment.baselinePainScore,
      rangeOfMotionNotes: assessment.rangeOfMotionNotes,
      postureEvaluation: assessment.postureEvaluation,
      assessmentNotes: assessment.assessmentNotes,
      startDate: caseObj.startDate
        ? String(caseObj.startDate).split("T")[0]
        : new Date().toISOString().split("T")[0],
      expectedEndDate: caseObj.expectedEndDate
        ? String(caseObj.expectedEndDate).split("T")[0]
        : "",
      notes: caseObj.notes || "",
      status: caseObj.status || "In Progress",
    },
    modalities: parseModalities(caseObj),
  };
};

export default function ReferralModal({
  open,
  onClose,
  onSuccess,
  prefilledPatient = null,
  editCase = null,
}) {
  const [selectedPatient, setSelectedPatient] = useState(prefilledPatient);
  const [assignedPatientsList, setAssignedPatientsList] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState("");

  const [documents, setDocuments] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [removedDocuments, setRemovedDocuments] = useState([]);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [selectedModalities, setSelectedModalities] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEditCase, setLoadingEditCase] = useState(false);
  const contentRef = React.useRef(null);
  const [therapistDialCode] = useState("+91");

  useEffect(() => {
    if (open) {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      loadDropdowns();
    }
  }, [open]);

  const loadDropdowns = async () => {
    setLoadingPatients(true);
    setLoadingStaff(true);
    try {
      const [patientsRes, staffRes] = await Promise.allSettled([
        fetchAssignedPhysiotherapyPatients({ limit: 10 }),
        fetchPhysiotherapyStaff(),
      ]);

      if (patientsRes.status === "fulfilled") {
        const pData = patientsRes.value?.data || [];
        setAssignedPatientsList(Array.isArray(pData) ? pData : []);
      }
      if (staffRes.status === "fulfilled") {
        const sData =
          staffRes.value?.data ||
          staffRes.value?.physioStaff ||
          staffRes.value?.allStaff ||
          [];
        setStaffList(Array.isArray(sData) ? sData : []);
      }
    } catch (err) {
      console.warn("Error loading physio dropdowns:", err);
    } finally {
      setLoadingPatients(false);
      setLoadingStaff(false);
    }
  };

  // Prefill / reset form when modal opens. List rows are sparse — fetch full details for edit.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const applyCase = (caseObj, { mergeModalities = false } = {}) => {
      if (cancelled || !caseObj) return;
      const unwrapped = unwrapCasePayload(caseObj) || caseObj;
      const mapped = mapCaseToForm(unwrapped);
      setSelectedPatient(mapped.patient);
      setFormData(mapped.formData);
      if (mapped.therapistId) {
        setSelectedTherapistId(String(mapped.therapistId));
      }
      setSelectedModalities((prev) => {
        if (!mergeModalities) return mapped.modalities;
        // Keep previously parsed modalities if the newest payload omitted them
        if (mapped.modalities.length > 0) return mapped.modalities;
        return prev;
      });

      const rawDocs = unwrapped?.documents || caseObj?.documents || [];
      const cId = unwrapped?._id || unwrapped?.id || caseObj?._id || caseObj?.id;
      const activeDocs = filterActiveCaseDocuments(rawDocs, cId);
      setExistingDocuments(Array.isArray(activeDocs) ? activeDocs : []);
      setRemovedDocuments([]);
    };

    if (editCase) {
      // Instant fill from whatever the parent passed (list/detail)
      applyCase(editCase);

      const caseId = editCase._id || editCase.id;
      if (!caseId) return undefined;

      setLoadingEditCase(true);
      fetchPhysiotherapyDetails(caseId)
        .then((data) => {
          if (cancelled) return;
          const detail = unwrapCasePayload(data?.data || data);
          if (detail && typeof detail === "object") {
            applyCase(detail, { mergeModalities: true });
          }
        })
        .catch((err) => {
          console.error("Failed to load physiotherapy case for edit:", err);
        })
        .finally(() => {
          if (!cancelled) setLoadingEditCase(false);
        });
    } else {
      setFormData({
        ...EMPTY_FORM,
        startDate: new Date().toISOString().split("T")[0],
      });
      setSelectedModalities([]);
      setSelectedPatient(prefilledPatient || null);
      setSelectedTherapistId("");
      setDocuments([]);
      setExistingDocuments([]);
      setRemovedDocuments([]);
      setLoadingEditCase(false);

      // Pre-select therapist if current logged in user is a Physiotherapist
      const currentUserId = (localStorage.getItem("_id") || "").toLowerCase();
      if (currentUserId && staffList.length > 0) {
        const matched = staffList.find(
          (s) => String(s.userId || s._id).toLowerCase() === currentUserId
        );
        if (matched) {
          setSelectedTherapistId(String(matched.userId || matched._id));
        }
      }
    }

    return () => {
      cancelled = true;
    };
  }, [open, editCase, prefilledPatient]);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    if (!patient) return;

    // Auto-fill diagnosis from patient's registered disease if currently empty
    const primaryDisease = formatDiseaseName(
      patient.displayDisease ||
        (Array.isArray(patient.disease) ? patient.disease[0] : patient.disease) ||
        (Array.isArray(patient.patient_disease) ? patient.patient_disease[0] : patient.patient_disease) ||
        patient.clinicalDiagnosis ||
        ""
    );

    // Auto-fill assigned therapist from patient record if currently empty
    const assignedTherapist = patient.assignedPhysiotherapist;
    if (assignedTherapist) {
      const tId = assignedTherapist.userId || assignedTherapist._id || assignedTherapist.id;
      if (tId) {
        setSelectedTherapistId(String(tId));
      }
    }

    setFormData((prev) => ({
      ...prev,
      clinicalDiagnosis: prev.clinicalDiagnosis || primaryDisease,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleModality = (mod) => {
    const canonical = normalizeModalityLabel(mod);
    setSelectedModalities((prev) => {
      const exists = isModalitySelected(canonical, prev);
      if (exists) {
        return prev.filter(
          (m) =>
            normalizeModalityLabel(m).toLowerCase() !==
            normalizeModalityLabel(canonical).toLowerCase()
        );
      }
      return [...prev, canonical];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const patientId =
      selectedPatient?.patientId ||
      selectedPatient?.patientNumber ||
      selectedPatient?.patient_id ||
      selectedPatient?._id;

    if (!patientId) {
      return Swal.fire("Validation Error", "Please select a patient from the dropdown (Stage 1)", "warning");
    }

    const clinicalDiagnosisVal =
      (formData.clinicalDiagnosis || "").trim() ||
      (selectedPatient
        ? formatDiseaseName(
            selectedPatient.displayDisease ||
              (Array.isArray(selectedPatient.disease) ? selectedPatient.disease[0] : selectedPatient.disease) ||
              (Array.isArray(selectedPatient.patient_disease) ? selectedPatient.patient_disease[0] : selectedPatient.patient_disease) ||
              selectedPatient.clinicalDiagnosis ||
              ""
          )
        : "") ||
      "Physiotherapy Rehabilitation";

    setSubmitting(true);
    try {
      const chosenStaff = staffList.find(
        (s) => String(s.userId || s._id) === String(selectedTherapistId)
      );

      const assignedPhysiotherapistObj = chosenStaff
        ? {
            userId: chosenStaff.userId || chosenStaff._id,
            name: chosenStaff.name,
          }
        : selectedTherapistId
        ? {
            userId: selectedTherapistId,
            name: formData.therapistName || "Physiotherapist",
          }
        : null;

      const normalizedModalities = selectedModalities
        .map((m) => normalizeModalityLabel(m))
        .filter(Boolean);

      const initialAssessmentObj = {
        mobilityScore: formData.mobilityScore,
        baselinePainScore: Number(formData.baselinePainScore) || 0,
        rangeOfMotionNotes: formData.rangeOfMotionNotes || "",
        postureEvaluation: formData.postureEvaluation || "",
        notes: formData.assessmentNotes || "",
        modalitiesUsed: normalizedModalities,
      };

      const physioId = selectedTherapistId || assignedPhysiotherapistObj?.userId || "";
      const jsonPayload = {
        patientId,
        ...(selectedPatient?.patientObjectId || selectedPatient?._id
          ? {
              patientObjectId:
                selectedPatient.patientObjectId || selectedPatient._id,
            }
          : {}),
        ...(physioId ? { assignedPhysiotherapy: physioId } : {}),
        ...(assignedPhysiotherapistObj
          ? { assignedPhysiotherapist: assignedPhysiotherapistObj }
          : {}),
        category: formData.category || "General",
        clinicalDiagnosis: clinicalDiagnosisVal,
        affectedBodyPart: (formData.affectedBodyPart || "").trim(),
        priority: formData.priority || "Normal",
        prescribedSessions: Number(formData.prescribedSessions) || 10,
        sessionFrequency: formData.sessionFrequency || "Daily",
        treatmentGoals: (formData.treatmentGoals || "").trim(),
        specialInstructions: (formData.specialInstructions || "").trim(),
        startDate: formData.startDate,
        ...(formData.expectedEndDate
          ? { expectedEndDate: formData.expectedEndDate }
          : {}),
        notes: (formData.notes || "").trim(),
        status: formData.status || (editCase ? "In Progress" : "Referred"),
        modalitiesUsed: normalizedModalities,
        modalities: normalizedModalities,
        modalitiesApplied: normalizedModalities,
        initialAssessment: initialAssessmentObj,
      };
      const caseId = editCase ? (editCase._id || editCase.id || editCase.caseId) : null;
      const hasFiles = documents && documents.length > 0;

      if (editCase && caseId) {
        await updatePhysiotherapyCase(caseId, jsonPayload);
        cacheCaseModalities(caseId, normalizedModalities);

        // Track any removed existing documents
        if (removedDocuments.length > 0) {
          markCaseDocumentsRemoved(caseId, removedDocuments);
        }

        // Upload attached documents via dedicated documents endpoint
        if (hasFiles) {
          try {
            for (const file of documents) {
              const docFd = new FormData();
              docFd.append("documentName", file.name || "Assessment Document");
              docFd.append("documents", file);
              await uploadPhysiotherapyDocuments(caseId, docFd);
            }
          } catch (docErr) {
            console.warn("Case updated, but document upload warning:", docErr);
          }
        }

        Swal.fire({
          title: "Case Updated!",
          text: "Physiotherapy case details have been updated successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        const res = await createPhysiotherapyReferral(jsonPayload);
        const createdId =
          res?.data?._id ||
          res?.data?.id ||
          res?._id ||
          res?.id ||
          null;
        if (createdId) cacheCaseModalities(createdId, normalizedModalities);

        // Upload attached documents if any
        if (createdId && hasFiles) {
          try {
            for (const file of documents) {
              const docFd = new FormData();
              docFd.append("documentName", file.name || "Assessment Document");
              docFd.append("documents", file);
              await uploadPhysiotherapyDocuments(createdId, docFd);
            }
          } catch (docErr) {
            console.warn("Referral created, but document upload warning:", docErr);
          }
        }

        Swal.fire({
          title: "Referral Created!",
          text: res?.message || "Patient successfully referred to Physiotherapy",
          icon: "success",
          timer: 2500,
          showConfirmButton: false,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      const msg =
        typeof error === "string"
          ? error
          : error?.message ||
            (editCase ? "Failed to update case" : "Failed to create referral");
      Swal.fire("Error", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      className="physio-dialog"
      scroll="paper"
      disableAutoFocus
      disableRestoreFocus
      PaperProps={{
        style: {
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxHeight: "92vh",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        },
      }}
    >
      {/* Sticky Branded Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          color: "#ffffff",
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "20px",
            }}
          >
            <i className="fa-solid fa-heart-pulse" />
          </div>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "17px", letterSpacing: "-0.01em" }}>
              {editCase ? "Edit Physiotherapy Case" : "Create Physiotherapy Case"}
            </h5>
            <small style={{ color: "rgba(255,255,255,0.85)", fontSize: "12.5px" }}>
              {loadingEditCase
                ? "Loading saved case details..."
                : editCase
                ? "Update clinical rehabilitation parameters, prescription & diagnosis"
                : "Create new clinical rehabilitation case & set baseline goals"}
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: "34px",
            height: "34px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          title="Close"
        >
          <i className="fa-solid fa-xmark fs-6" />
        </button>
      </div>

      {/* Scrollable Form Body */}
      <DialogContent
        ref={contentRef}
        style={{
          overflowY: "auto",
          padding: "20px 24px",
          backgroundColor: "#f8fafc",
        }}
      >
        <form id="referral-form" onSubmit={handleSubmit}>
          {/* Card 1: Patient Selection */}
          <div
            className="card mb-3 border-0 shadow-sm"
            style={{ borderRadius: "12px", background: "#ffffff" }}
          >
            <div className="card-body p-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span
                  style={{
                    backgroundColor: "#e0f2fe",
                    color: "#0284c7",
                    fontWeight: "700",
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  STEP 1
                </span>
                <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                  Patient Information <span className="text-danger">*</span>
                </span>
              </div>

              {prefilledPatient ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      minWidth: "48px",
                      borderRadius: "12px",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "18px",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                      marginRight: "16px",
                    }}
                  >
                    {(prefilledPatient.name || prefilledPatient.patient_name || "P")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: "15px" }}>
                        {prefilledPatient.name || prefilledPatient.patient_name}
                      </h6>
                      <span
                        style={{
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #bae6fd",
                          borderRadius: "6px",
                          padding: "2px 8px",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        {prefilledPatient.patientId || prefilledPatient.patient_id}
                      </span>
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                      <i className="fa-solid fa-location-dot text-danger me-1" />
                      Country: {prefilledPatient.country || "N/A"}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {!editCase && (
                    <div className="mb-2">
                      <label className="fw-semibold text-muted small mb-1 d-flex align-items-center justify-content-between">
                        <span>
                          <i className="fa-solid fa-user-check me-1 text-primary" />
                          Dropdown A: Select Patient Marked for Physio (Stage 1)
                        </span>
                        {loadingPatients && (
                          <span className="spinner-border spinner-border-sm text-primary" />
                        )}
                      </label>
                      <select
                        className="form-select"
                        style={{ fontSize: "13.5px", borderRadius: "8px", fontWeight: 500 }}
                        value={selectedPatient?.patientId || selectedPatient?._id || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setSelectedPatient(null);
                            return;
                          }
                          const found = assignedPatientsList.find(
                            (p) =>
                              String(p.patientId || p.patientObjectId || p._id) === String(val)
                          );
                          if (found) handleSelectPatient(found);
                        }}
                      >
                        <option value="">
                          {loadingPatients
                            ? "Loading marked patients..."
                            : assignedPatientsList.length > 0
                            ? `-- Select Patient (${assignedPatientsList.length} marked) --`
                            : "-- No marked patients found (Quick mark in Patient List) --"}
                        </option>
                        {assignedPatientsList.map((p) => {
                          const pId =
                            p.patientId || p.patientNumber || p.patientObjectId || p._id;
                          return (
                            <option key={pId} value={pId}>
                              {p.name || p.patient_name} ({pId}){" "}
                              {p.phone ? `• ${p.phone}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {!editCase && (
                    <>
                      <div className="text-muted small mb-1 fw-semibold">
                        <i className="fa-solid fa-magnifying-glass me-1" />
                        Or Search Patient by Name, ID, Phone:
                      </div>
                      <PatientSearchSelect
                        value={selectedPatient}
                        onChange={handleSelectPatient}
                        searchFn={searchAssignedPhysiotherapyPatients}
                        placeholder="Search assigned patient by Name, Patient ID, Phone, Email, Location..."
                        disabled={Boolean(editCase)}
                        showSelectedId={true}
                        loadInitialOnFocus={true}
                      />
                    </>
                  )}

                  {/* Selected Patient Information Card */}
                  {selectedPatient && (
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "10px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        marginTop: editCase ? "0px" : "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flex: 1,
                            minWidth: "260px",
                          }}
                        >
                          {/* Avatar */}
                          <div
                            style={{
                              width: "48px",
                              height: "48px",
                              minWidth: "48px",
                              borderRadius: "12px",
                              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "18px",
                              flexShrink: 0,
                              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                              marginRight: "16px",
                            }}
                          >
                            {(selectedPatient.name || selectedPatient.patient_name || "P")[0].toUpperCase()}
                          </div>

                          {/* Details */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexWrap: "wrap",
                                marginBottom: "4px",
                              }}
                            >
                              <h6
                                className="mb-0 fw-bold text-dark"
                                style={{ fontSize: "15px", letterSpacing: "-0.2px" }}
                              >
                                {selectedPatient.name || selectedPatient.patient_name}
                              </h6>
                              <span
                                style={{
                                  backgroundColor: "#e0f2fe",
                                  color: "#0369a1",
                                  border: "1px solid #bae6fd",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  letterSpacing: "0.2px",
                                }}
                              >
                                {selectedPatient.patientId || selectedPatient.patientNumber || selectedPatient.displayId || selectedPatient._id}
                              </span>
                              {selectedPatient.needsPhysiotherapy && (
                                <span
                                  style={{
                                    backgroundColor: "#dcfce7",
                                    color: "#15803d",
                                    border: "1px solid #86efac",
                                    fontSize: "10.5px",
                                    fontWeight: "600",
                                    padding: "2px 7px",
                                    borderRadius: "6px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <i className="fa-solid fa-check" style={{ fontSize: "10px" }} /> Needs Physio
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "14px",
                                flexWrap: "wrap",
                                fontSize: "12px",
                                color: "#64748b",
                              }}
                            >
                              {(selectedPatient.town || selectedPatient.country) && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <i className="fa-solid fa-location-dot text-danger" style={{ fontSize: "12px" }} />
                                  <span>{[selectedPatient.town, selectedPatient.country].filter(Boolean).join(", ")}</span>
                                </span>
                              )}
                              {(selectedPatient.phone || selectedPatient.emergency_contact_no) && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <i className="fa-solid fa-phone text-primary" style={{ fontSize: "11px" }} />
                                  <span>{selectedPatient.phone || selectedPatient.emergency_contact_no}</span>
                                </span>
                              )}
                              {selectedPatient.age && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <i className="fa-solid fa-user text-secondary" style={{ fontSize: "11px" }} />
                                  <span>{selectedPatient.age} yrs {selectedPatient.gender ? `(${selectedPatient.gender})` : ""}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!editCase && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => setSelectedPatient(null)}
                            style={{ fontSize: "11.5px", borderRadius: "6px", padding: "4px 10px" }}
                            title="Clear and select different patient"
                          >
                            <i className="fa-solid fa-xmark me-1" /> Clear
                          </button>
                        )}
                      </div>

                      {/* Clinical & Therapist Meta Row */}
                      {(selectedPatient.assignedPhysiotherapist?.name || formData.therapistName || formData.clinicalDiagnosis) && (
                        <div
                          style={{
                            marginTop: "12px",
                            paddingTop: "12px",
                            borderTop: "1px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              padding: "6px 12px",
                              fontSize: "12.5px",
                            }}
                          >
                            <div
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                backgroundColor: "#dcfce7",
                                color: "#16a34a",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                flexShrink: 0,
                              }}
                            >
                              <i className="fa-solid fa-user-doctor" />
                            </div>
                            <span style={{ color: "#64748b", fontWeight: "500" }}>Assigned Physiotherapist:</span>
                            <span style={{ color: "#0f172a", fontWeight: "600" }}>
                              {formData.therapistName || selectedPatient.assignedPhysiotherapist?.name || "Dr. Assigned"}
                            </span>
                            {(selectedPatient.assignedPhysiotherapist?.phone || formData.therapistPhone) && (
                              <span style={{ color: "#94a3b8", fontSize: "11.5px" }}>
                                ({selectedPatient.assignedPhysiotherapist?.phone || formData.therapistPhone})
                              </span>
                            )}
                          </div>

                          {(formData.clinicalDiagnosis || formatDiseaseName(selectedPatient.displayDisease || selectedPatient.disease || selectedPatient.patient_disease)) && (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                backgroundColor: "#ffffff",
                                border: "1px solid #bae6fd",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontSize: "12.5px",
                              }}
                            >
                              <div
                                style={{
                                  width: "24px",
                                  height: "24px",
                                  borderRadius: "50%",
                                  backgroundColor: "#e0f2fe",
                                  color: "#0284c7",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "11px",
                                  flexShrink: 0,
                                }}
                              >
                                <i className="fa-solid fa-stethoscope" />
                              </div>
                              <span style={{ color: "#0369a1", fontWeight: "600" }}>
                                {formData.clinicalDiagnosis || formatDiseaseName(selectedPatient.displayDisease || selectedPatient.disease || selectedPatient.patient_disease)}
                              </span>
                              {formData.category && (
                                <span
                                  style={{
                                    backgroundColor: "#f1f5f9",
                                    color: "#475569",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "4px",
                                    padding: "1px 6px",
                                    fontSize: "11px",
                                    fontWeight: "500",
                                  }}
                                >
                                  {formData.category}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Card 2: Prescription & Goals */}
          <div
            className="card mb-3 border-0 shadow-sm"
            style={{ borderRadius: "12px", background: "#ffffff" }}
          >
            <div className="card-body p-3">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span
                  style={{
                    backgroundColor: "#ecfdf5",
                    color: "#059669",
                    fontWeight: "700",
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  STEP 2
                </span>
                <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                  Prescription & Treatment Goals
                </span>
              </div>

              <div className="row g-3">
                <div className="col-md-3">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Prescribed Sessions
                  </label>
                  <input
                    type="number"
                    name="prescribedSessions"
                    className="form-control"
                    min="1"
                    max="100"
                    value={formData.prescribedSessions}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-md-3">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Session Frequency
                  </label>
                  <input
                    type="text"
                    name="sessionFrequency"
                    className="form-control"
                    placeholder="e.g. Daily, 3 Times a Week, Weekly"
                    value={formData.sessionFrequency}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-md-3">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Target Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    className="form-control"
                    value={formData.startDate}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-md-3">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Expected End Date
                  </label>
                  <input
                    type="date"
                    name="expectedEndDate"
                    className="form-control"
                    value={formData.expectedEndDate}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                {editCase && (
                  <div className="col-md-4">
                    <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                      Case Status
                    </label>
                    <select
                      name="status"
                      className="form-select"
                      value={formData.status}
                      onChange={handleChange}
                      style={{ fontSize: "13.5px", fontWeight: 600 }}
                    >
                      {PHYSIO_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={editCase ? "col-md-8" : "col-md-6"}>
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Treatment Goals
                  </label>
                  <input
                    type="text"
                    name="treatmentGoals"
                    className="form-control"
                    placeholder="e.g. Restore full knee extension, Improve mobility and reduce pain"
                    value={formData.treatmentGoals}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className={editCase ? "col-md-12" : "col-md-6"}>
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Special Precautions / Instructions
                  </label>
                  <input
                    type="text"
                    name="specialInstructions"
                    className="form-control"
                    placeholder="e.g. No heavy weight-bearing"
                    value={formData.specialInstructions}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-12">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Initial Clinical Notes
                  </label>
                  <textarea
                    name="notes"
                    className="form-control"
                    rows="2"
                    placeholder="Initial clinical notes..."
                    value={formData.notes}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-12">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Documents / Assessment Reports / X-rays
                  </label>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <input
                      type="file"
                      id="referral-doc-upload"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.dcm"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          setDocuments((prev) => [...prev, ...files]);
                        }
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor="referral-doc-upload"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1.5 mb-0"
                      style={{ cursor: "pointer", borderRadius: "8px" }}
                    >
                      <i className="fa-solid fa-cloud-arrow-up" /> Upload Assessment Reports or X-rays
                    </label>
                    <small className="text-muted">
                      Attach documents or imaging (Multiple files supported)
                    </small>
                  </div>
                  {/* 1. Saved / Existing Documents (Default Show) */}
                  {existingDocuments && existingDocuments.length > 0 && (
                    <div
                      className="mt-3 p-3 rounded-3"
                      style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <i className="fa-solid fa-folder-open text-primary" style={{ fontSize: "14px" }} />
                          <span className="fw-bold text-dark" style={{ fontSize: "12.5px" }}>
                            Saved Case Documents ({existingDocuments.length})
                          </span>
                        </div>
                        <span className="text-muted" style={{ fontSize: "11px" }}>
                          Already attached to this case record
                        </span>
                      </div>
                      <div className="row g-2">
                        {existingDocuments.map((doc, idx) => {
                          const fileUrl = getPhysioFileUrl(doc);
                          const fileName =
                            doc?.documentName ||
                            doc?.fileName ||
                            (typeof doc?.file === "string"
                              ? doc.file.split("/").pop()?.replace(/^\d+-/, "")
                              : "") ||
                            `Document ${idx + 1}`;
                          const isImg = isImageFile(doc) || isImageFile(fileUrl);
                          const isPdf = isPdfFile(doc) || isPdfFile(fileUrl);

                          return (
                            <div key={doc._id || idx} className="col-md-6 col-12">
                              <div
                                className="p-2.5 rounded-3 bg-white border d-flex align-items-center justify-content-between gap-2 shadow-sm"
                                style={{ transition: "all 0.15s ease" }}
                              >
                                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                                  {isImg ? (
                                    <div
                                      style={{
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "6px",
                                        backgroundColor: "#f0fdf4",
                                        color: "#16a34a",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        border: "1px solid #bbf7d0",
                                      }}
                                    >
                                      <i className="fa-solid fa-image" style={{ fontSize: "16px" }} />
                                    </div>
                                  ) : isPdf ? (
                                    <div
                                      style={{
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "6px",
                                        backgroundColor: "#fef2f2",
                                        color: "#dc2626",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        border: "1px solid #fecaca",
                                      }}
                                    >
                                      <i className="fa-solid fa-file-pdf" style={{ fontSize: "16px" }} />
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "6px",
                                        backgroundColor: "#eff6ff",
                                        color: "#2563eb",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        border: "1px solid #bfdbfe",
                                      }}
                                    >
                                      <i className="fa-solid fa-file-lines" style={{ fontSize: "16px" }} />
                                    </div>
                                  )}

                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <span
                                      className="d-block text-truncate fw-semibold text-dark"
                                      style={{ fontSize: "12px", lineHeight: "1.3" }}
                                      title={fileName}
                                    >
                                      {fileName}
                                    </span>
                                    <span className="text-muted" style={{ fontSize: "11px" }}>
                                      {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "Uploaded"}
                                    </span>
                                  </div>
                                </div>

                                <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                                  {fileUrl && (
                                    <a
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center gap-1 text-decoration-none"
                                      style={{ fontSize: "11px", height: "26px", borderRadius: "6px" }}
                                      title="View or download document"
                                    >
                                      <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: "10px" }} /> Open
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                    style={{ fontSize: "11px", height: "26px", width: "26px", borderRadius: "6px" }}
                                    title="Remove saved document"
                                    onClick={() => {
                                      const toRemove = existingDocuments[idx];
                                      setRemovedDocuments((prev) => [...prev, toRemove]);
                                      setExistingDocuments((prev) => prev.filter((_, i) => i !== idx));
                                    }}
                                  >
                                    <i className="fa-solid fa-xmark" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. New Files Selected For Upload */}
                  {documents && documents.length > 0 && (
                    <div
                      className="mt-2.5 p-3 rounded-3"
                      style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <i className="fa-solid fa-cloud-arrow-up text-success" style={{ fontSize: "14px" }} />
                          <span className="fw-bold text-dark" style={{ fontSize: "12.5px" }}>
                            New Files Selected For Upload ({documents.length})
                          </span>
                        </div>
                        <span
                          className="badge bg-success-subtle text-success border border-success-subtle"
                          style={{ fontSize: "10.5px" }}
                        >
                          Will upload on save
                        </span>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {documents.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            className="badge bg-white text-dark border p-2 d-flex align-items-center gap-2 shadow-sm"
                            style={{
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "normal",
                            }}
                          >
                            <i className="fa-solid fa-file-circle-plus text-success" />
                            <span className="text-truncate" style={{ maxWidth: "220px" }}>
                              {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                            <i
                              className="fa-solid fa-xmark text-danger ms-1"
                              style={{ cursor: "pointer" }}
                              title="Cancel this file"
                              onClick={() => {
                                setDocuments((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                );
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Therapy modalities (moved from session log) */}
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "12px", background: "#ffffff" }}
          >
            <div className="card-body p-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span
                  style={{
                    backgroundColor: "#e0e7ff",
                    color: "#4f46e5",
                    fontWeight: "700",
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  STEP 3
                </span>
                <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                  Electrotherapy & Modalities
                </span>
              </div>
              <p className="text-muted small mb-2">
                Click to select the therapy modalities prescribed for this referral:
              </p>

              <div className="d-flex flex-wrap gap-2">
                {PHYSIO_MODALITIES.map((mod) => {
                  const isSelected = isModalitySelected(mod, selectedModalities);
                  return (
                    <button
                      type="button"
                      key={mod}
                      onClick={() => handleToggleModality(mod)}
                      className={`btn btn-sm ${
                        isSelected
                          ? "btn-primary shadow-sm"
                          : "btn-outline-secondary bg-white text-dark"
                      }`}
                      style={{
                        borderRadius: "20px",
                        fontSize: "12.5px",
                        padding: "5px 14px",
                      }}
                    >
                      {isSelected ? (
                        <i className="fa fa-check me-1" />
                      ) : (
                        <i className="fa fa-plus me-1 text-muted" />
                      )}
                      {mod}
                    </button>
                  );
                })}
                {/* Show any saved modalities that are not in the predefined list */}
                {selectedModalities
                  .filter(
                    (m) =>
                      !PHYSIO_MODALITIES.some(
                        (opt) =>
                          normalizeModalityLabel(opt).toLowerCase() ===
                          normalizeModalityLabel(m).toLowerCase()
                      )
                  )
                  .map((mod) => (
                    <button
                      type="button"
                      key={`extra-${mod}`}
                      onClick={() => handleToggleModality(mod)}
                      className="btn btn-sm btn-primary shadow-sm"
                      style={{
                        borderRadius: "20px",
                        fontSize: "12.5px",
                        padding: "5px 14px",
                      }}
                    >
                      <i className="fa fa-check me-1" />
                      {mod}
                    </button>
                  ))}
              </div>
              {selectedModalities.length > 0 && (
                <div className="mt-2 small text-muted">
                  Selected: {selectedModalities.join(", ")}
                </div>
              )}
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Sticky Action Footer */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "14px 24px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="btn btn-light px-4 border fw-semibold"
          style={{ borderRadius: "8px", fontSize: "13.5px" }}
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          form="referral-form"
          className="btn btn-primary px-4 fw-bold d-flex align-items-center gap-2 shadow-sm"
          style={{
            borderRadius: "8px",
            backgroundColor: "#0284c7",
            borderColor: "#0284c7",
            fontSize: "13.5px",
          }}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <i className="fa fa-spinner fa-spin" /> {editCase ? "Updating Case..." : "Creating Case..."}
            </>
          ) : (
            <>
              <i className="fa fa-check-circle" /> {editCase ? "Update Case" : "Create Case"}
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
