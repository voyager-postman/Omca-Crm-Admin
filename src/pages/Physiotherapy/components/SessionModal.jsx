import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import {
  addPhysiotherapySession,
  updatePhysiotherapySession,
  getPhysiotherapyExercises,
  syncPhysiotherapyExercises,
  filterActiveSessionAttachments,
  markSessionAttachmentsRemoved,
} from "../../../services/physiotherapyApi";
import CameraFileUpload from "../../../components/Common/CameraFileUpload";
import { imageUrl } from "../../../Basurl/Baseurl";

const PRESET_EXERCISES = [
  {
    category: "Neck and Cervical Spine",
    shortName: "Neck & Cervical",
    exercises: [
      "Chin Tucks",
      "Cervical Flexion and Extension",
      "Neck Rotation",
      "Side Bending Stretch",
      "Isometric Neck Flexion",
      "Isometric Neck Extension",
      "Scapular Retraction",
    ],
  },
  {
    category: "Shoulder",
    shortName: "Shoulder",
    exercises: [
      "Shoulder Pendulum",
      "Wall Slides",
      "Shoulder Flexion With Wand",
      "External Rotation With Resistance Band",
      "Internal Rotation With Resistance Band",
      "Shoulder Isometric Exercises",
      "Rotator Cuff Strengthening",
      "Scapular Stabilization",
    ],
  },
  {
    category: "Elbow, Wrist and Hand",
    shortName: "Elbow, Wrist & Hand",
    exercises: [
      "Elbow Flexion and Extension",
      "Forearm Pronation and Supination",
      "Wrist Flexion and Extension",
      "Wrist Radial and Ulnar Deviation",
      "Finger Tendon Gliding",
      "Finger Opposition",
      "Grip Strengthening",
      "Thumb Mobility Exercises",
    ],
  },
  {
    category: "Back and Lumbar Spine",
    shortName: "Back & Lumbar",
    exercises: [
      "Pelvic Tilts",
      "Cat-Cow",
      "Knee-to-Chest Stretch",
      "Lumbar Rotation",
      "Abdominal Bracing",
      "Bird Dog",
      "McKenzie Extension Exercises",
      "Lumbar Stabilization",
      "Back Extension Strengthening",
    ],
  },
  {
    category: "Hip and Pelvis",
    shortName: "Hip & Pelvis",
    exercises: [
      "Glute Bridge",
      "Clamshell Exercise",
      "Side-Lying Hip Abduction",
      "Standing Hip Extension",
      "Hip Flexion Exercise",
      "Hip External Rotation",
      "Hip Flexor Stretch",
      "Adductor Stretch",
      "Sit-to-Stand",
    ],
  },
  {
    category: "Knee",
    shortName: "Knee",
    exercises: [
      "Quadriceps Sets",
      "Straight Leg Raises",
      "Heel Slides",
      "Short Arc Quads",
      "Terminal Knee Extensions",
      "Mini Squats",
      "Step-Ups",
      "Hamstring Curls",
      "Knee Extension Stretch",
    ],
  },
  {
    category: "Ankle and Foot",
    shortName: "Ankle & Foot",
    exercises: [
      "Ankle Pumps",
      "Ankle Alphabet",
      "Ankle Dorsiflexion With Band",
      "Ankle Plantar Flexion",
      "Inversion and Eversion",
      "Calf Raises",
      "Toe Raises",
      "Towel Scrunches",
      "Calf Stretch",
    ],
  },
];

const parseHoldSeconds = (value) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const match = String(value ?? "").match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : 0;
};

const normalizeExercise = (entry) => {
  if (typeof entry === "string") {
    return {
      exerciseName: entry,
      sets: 3,
      repetitions: 10,
      holdTimeSeconds: 5,
      hold: "5s",
      repeat: "2x daily",
      notes: "",
    };
  }
  const holdTimeSeconds =
    entry.holdTimeSeconds != null && entry.holdTimeSeconds !== ""
      ? Number(entry.holdTimeSeconds)
      : parseHoldSeconds(entry.hold);
  const repetitions = Number(entry.repetitions ?? entry.reps) || 0;
  return {
    ...(entry._id || entry.id ? { _id: entry._id || entry.id } : {}),
    exerciseName: entry.exerciseName || entry.name || "",
    category: entry.category || "",
    sets: entry.sets === 0 || entry.sets ? Number(entry.sets) : 3,
    repetitions: repetitions || 10,
    holdTimeSeconds,
    hold: entry.hold || (holdTimeSeconds ? `${holdTimeSeconds}s` : ""),
    repeat: entry.repeat || entry.frequency || "2x daily",
    notes: entry.notes || "",
  };
};

const toApiExercise = (entry) => {
  const holdTimeSeconds = Number(entry.holdTimeSeconds) || parseHoldSeconds(entry.hold) || 0;
  const reps = Number(entry.repetitions ?? entry.reps) || 0;
  const name = String(entry.exerciseName || entry.name || "").trim();
  return {
    ...(entry._id ? { _id: entry._id } : {}),
    exerciseName: name,
    name,
    category: entry.category || "",
    sets: Number(entry.sets) || 0,
    reps,
    repetitions: reps,
    hold: holdTimeSeconds ? `${holdTimeSeconds}s` : entry.hold || "",
    holdTimeSeconds,
    repeat: entry.repeat || "",
    frequency: entry.repeat || "",
    notes: entry.notes || "",
  };
};

const extractSessionId = (response, fallbackId) => {
  if (fallbackId) return fallbackId;
  const layers = [
    response,
    response?.data,
    response?.data?.data,
    response?.session,
    response?.data?.session,
  ].filter(Boolean);

  for (const layer of layers) {
    if (layer.session && (layer.session._id || layer.session.sessionId)) {
      return layer.session._id || layer.session.sessionId;
    }
    const looksLikeSession =
      layer.sessionNumber != null ||
      layer.sessionDate ||
      layer.painLevelBefore != null ||
      Array.isArray(layer.exercises);
    const id = layer.sessionId || layer._id || layer.id;
    if (id && looksLikeSession && !Array.isArray(layer.sessions)) return id;
    if (Array.isArray(layer.sessions) && layer.sessions.length) {
      const last = layer.sessions[layer.sessions.length - 1];
      if (last?._id || last?.sessionId) return last._id || last.sessionId;
    }
  }
  return null;
};

export default function SessionModal({
  open,
  onClose,
  onSuccess,
  physioCase,
  editingSession = null,
}) {
  const [formData, setFormData] = useState({
    sessionDate: new Date().toISOString().split("T")[0],
    conductedBy: "",
    status: "Completed",
    painLevelBefore: 5,
    painLevelAfter: 3,
    patientResponse: "Good Tolerance",
    mobilityAssessment: "Improved gait",
    progressRemarks: "",
    nextSessionDate: "",
    exerciseNotes: "",
  });

  const [exercisesList, setExercisesList] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [exerciseSearch, setExerciseSearch] = useState("");

  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [removedAttachments, setRemovedAttachments] = useState([]);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [saving, setSaving] = useState(false);
  const contentRef = React.useRef(null);

  const isImageFile = (docOrPath) => {
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

  const isPdfFile = (docOrPath) => {
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

  const getFileUrl = (docOrPath) => {
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

  useEffect(() => {
    let cancelled = false;
    if (open) {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      if (editingSession) {
        const conductedStr =
          typeof editingSession.conductedBy === "object"
            ? editingSession.conductedBy?.name || ""
            : editingSession.conductedBy || "";

        setFormData({
          sessionDate: editingSession.sessionDate
            ? String(editingSession.sessionDate).slice(0, 10)
            : new Date().toISOString().split("T")[0],
          conductedBy: conductedStr || physioCase?.assignedPhysiotherapist?.name || "",
          status: editingSession.status || "Completed",
          painLevelBefore: editingSession.painLevelBefore ?? 5,
          painLevelAfter: editingSession.painLevelAfter ?? 3,
          patientResponse: editingSession.patientResponse || "Good Tolerance",
          mobilityAssessment: editingSession.mobilityAssessment || editingSession.mobilityStatus || "",
          progressRemarks: editingSession.progressRemarks || "",
          nextSessionDate: editingSession.nextSessionDate
            ? String(editingSession.nextSessionDate).slice(0, 10)
            : "",
          exerciseNotes: editingSession.exerciseNotes || "",
        });

        const rawEx = editingSession.exercises || editingSession.exercisesPerformed || [];
        setExercisesList(rawEx.map(normalizeExercise));
        const rawAtts = editingSession.attachments || [];
        const activeAtts = filterActiveSessionAttachments(rawAtts, editingSession, physioCase?._id);
        setExistingAttachments(Array.isArray(activeAtts) ? activeAtts : []);
        setRemovedAttachments([]);
        setAttachments([]);

        const sessionId =
          editingSession._id || editingSession.sessionId || editingSession.id;
        if (physioCase?._id && sessionId) {
          getPhysiotherapyExercises(physioCase._id, sessionId)
            .then((data) => {
              if (cancelled) return;
              const session = data?.session || data?.data?.session || data;
              if (!session || typeof session !== "object") return;
              if (session.exerciseNotes != null) {
                setFormData((prev) => ({
                  ...prev,
                  exerciseNotes: session.exerciseNotes || "",
                }));
              }
              if (
                Array.isArray(session.exercises) &&
                (session.exercises.length > 0 || rawEx.length === 0)
              ) {
                setExercisesList(session.exercises.map(normalizeExercise));
              }
            })
            .catch(() => { });
        }
      } else {
        setFormData({
          sessionDate: new Date().toISOString().split("T")[0],
          conductedBy: physioCase?.assignedPhysiotherapist?.name || "",
          status: "Completed",
          painLevelBefore: physioCase?.initialAssessment?.baselinePainScore ?? 5,
          painLevelAfter: Math.max(0, (physioCase?.initialAssessment?.baselinePainScore ?? 5) - 2),
          patientResponse: "Good Tolerance",
          mobilityAssessment: "",
          progressRemarks: "",
          nextSessionDate: "",
          exerciseNotes: "",
        });
        setExercisesList([]);
        setExistingAttachments([]);
        setRemovedAttachments([]);
        setAttachments([]);
      }
      setExerciseSearch("");
    }
    return () => {
      cancelled = true;
    };
  }, [open, physioCase, editingSession]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const togglePresetExercise = (name) => {
    const isAlreadyAdded = exercisesList.some(
      (e) => (e.exerciseName || e.name || "").toLowerCase() === name.toLowerCase()
    );

    if (isAlreadyAdded) {
      setExercisesList((prev) =>
        prev.filter((e) => (e.exerciseName || e.name || "").toLowerCase() !== name.toLowerCase())
      );
    } else {
      let foundCat = "";
      for (const group of PRESET_EXERCISES) {
        if (group.exercises.includes(name)) {
          foundCat = group.category;
          break;
        }
      }
      const newItem = {
        exerciseName: name,
        name,
        category: foundCat,
        sets: 1,
        repetitions: 10,
        reps: 10,
        holdTimeSeconds: 0,
        hold: "",
        repeat: "2x daily",
        notes: "",
      };
      setExercisesList((prev) => [...prev, newItem]);
    }
  };

  const handleClearExercises = () => {
    setExercisesList([]);
  };

  const handleExerciseFieldChange = (idx, field, value) => {
    setExercisesList((prev) =>
      prev.map((exercise, i) => (i === idx ? { ...exercise, [field]: value } : exercise))
    );
  };

  const handleRemoveExercise = (idx) => {
    setExercisesList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!physioCase?._id) {
      return Swal.fire("Error", "Missing Physiotherapy Case reference", "error");
    }

    setSaving(true);
    try {
      const sessNumber = editingSession?.sessionNumber || currentSessionNumber;
      const sessId = editingSession?._id || editingSession?.sessionId || editingSession?.id;
      const exerciseNotes = formData.exerciseNotes.trim();
      const apiExercises = exercisesList.map(toApiExercise);
      let sessionResponse;

      if (attachments.length > 0) {
        const data = new FormData();
        data.append("sessionDate", formData.sessionDate);
        data.append("conductedBy", formData.conductedBy.trim());
        data.append("conductedByName", formData.conductedBy.trim());
        data.append("status", formData.status);
        data.append("painLevelBefore", Number(formData.painLevelBefore) || 0);
        data.append("painLevelAfter", Number(formData.painLevelAfter) || 0);
        data.append("patientResponse", formData.patientResponse);
        data.append("mobilityAssessment", formData.mobilityAssessment);
        data.append("progressRemarks", formData.progressRemarks);
        data.append("clinicalProgressRemarks", formData.progressRemarks);
        data.append("exerciseNotes", exerciseNotes);
        data.append("exerciseSectionNotes", exerciseNotes);
        if (formData.nextSessionDate) {
          data.append("nextSessionDate", formData.nextSessionDate);
        }

        data.append("exercises", JSON.stringify(apiExercises));

        attachments.forEach((file) => {
          data.append("attachments", file);
        });

        if (editingSession) {
          if (sessId) data.append("sessionId", sessId);
          data.append("sessionNumber", sessNumber);
          if (existingAttachments && existingAttachments.length > 0) {
            data.append("existingAttachments", JSON.stringify(existingAttachments));
          }
          sessionResponse = await updatePhysiotherapySession(
            physioCase._id,
            sessId || sessNumber,
            data
          );
        } else {
          sessionResponse = await addPhysiotherapySession(physioCase._id, data);
        }
      } else {
        const payload = {
          ...(sessId ? { sessionId: sessId } : {}),
          sessionNumber: sessNumber,
          sessionDate: formData.sessionDate,
          conductedBy: formData.conductedBy.trim(),
          conductedByName: formData.conductedBy.trim(),
          status: formData.status,
          painLevelBefore: Number(formData.painLevelBefore) || 0,
          painLevelAfter: Number(formData.painLevelAfter) || 0,
          patientResponse: formData.patientResponse,
          mobilityAssessment: formData.mobilityAssessment,
          progressRemarks: formData.progressRemarks,
          clinicalProgressRemarks: formData.progressRemarks,
          exerciseNotes,
          exerciseSectionNotes: exerciseNotes,
          ...(formData.nextSessionDate ? { nextSessionDate: formData.nextSessionDate } : {}),
          exercises: apiExercises,
          ...(existingAttachments.length > 0
            ? { existingAttachments, attachments: existingAttachments }
            : {}),
        };

        if (editingSession) {
          sessionResponse = await updatePhysiotherapySession(
            physioCase._id,
            sessId || sessNumber,
            payload
          );
        } else {
          sessionResponse = await addPhysiotherapySession(physioCase._id, payload);
        }
      }

      if (editingSession && removedAttachments.length > 0) {
        markSessionAttachmentsRemoved(
          [sessId, `${physioCase?._id}_${sessNumber}`],
          removedAttachments
        );
      }

      const savedSessionId = extractSessionId(sessionResponse, sessId);
      if (savedSessionId) {
        try {
          await syncPhysiotherapyExercises(
            physioCase._id,
            savedSessionId,
            apiExercises,
            exerciseNotes
          );
        } catch (syncError) {
          console.error("Exercise notes sync failed:", syncError);
        }
      }

      Swal.fire({
        title: editingSession ? "Session Updated!" : "Session Recorded!",
        text: editingSession
          ? `Physiotherapy session #${sessNumber} has been updated successfully.`
          : "The physiotherapy session and patient evaluations have been logged.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      const msg =
        typeof error === "string"
          ? error
          : error?.message ||
          (editingSession ? "Failed to update session" : "Failed to record session");
      Swal.fire("Error", msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const currentSessionNumber = (physioCase?.completedSessions || 0) + 1;
  const totalSessions = physioCase?.prescribedSessions || 10;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      className="physio-session-dialog"
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
      {/* Sticky Emerald Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
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
            <i className="fa-solid fa-calendar-check" />
          </div>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "17px", letterSpacing: "-0.01em" }}>
              {editingSession
                ? `Edit Physiotherapy Session #${editingSession.sessionNumber || ""}`
                : `Log Physiotherapy Session #${currentSessionNumber}`}
            </h5>
            {physioCase && (
              <small style={{ color: "rgba(255,255,255,0.85)", fontSize: "12.5px" }}>
                Patient: <strong>{physioCase.patientName || physioCase.patientObjectId?.patient_name}</strong> ({physioCase.patientId}) | Plan: {physioCase.completedSessions || 0} of {totalSessions} completed
              </small>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
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
        <form id="session-form" onSubmit={handleSubmit}>
          {/* Section 1: Session Details */}
          <div
            className="card mb-3 border-0 shadow-sm"
            style={{ borderRadius: "12px", background: "#ffffff" }}
          >
            <div className="card-body p-3">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span
                  style={{
                    backgroundColor: "#d1fae5",
                    color: "#059669",
                    fontWeight: "700",
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  INFO
                </span>
                <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                  Session Schedule & Therapist
                </span>
              </div>

              <div className="row g-3">
                <div className="col-md-4">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Session Date
                  </label>
                  <input
                    type="date"
                    name="sessionDate"
                    className="form-control"
                    value={formData.sessionDate}
                    onChange={handleChange}
                    required
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-md-4">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Conducted By (Therapist)
                  </label>
                  <input
                    type="text"
                    name="conductedBy"
                    className="form-control"
                    placeholder="Physiotherapist Name"
                    value={formData.conductedBy}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-md-4">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Session Status
                  </label>
                  <select
                    name="status"
                    className="form-select"
                    value={formData.status}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  >
                    <option value="Completed">Completed</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Missed">Missed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Exercises */}
          <div
            className="card mb-3 border-0 shadow-sm"
            style={{ borderRadius: "12px", background: "#ffffff" }}
          >
            <div className="card-body p-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span
                  style={{
                    backgroundColor: "#fef3c7",
                    color: "#b45309",
                    fontWeight: "700",
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  EXERCISES
                </span>
                <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                  Prescribed & Performed Exercises
                </span>
              </div>

              {exercisesList.length > 0 ? (
                <div className="table-responsive mb-3 border rounded shadow-sm">
                  <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "35px" }} className="text-center">#</th>
                        <th>Exercise Name</th>
                        <th style={{ width: "150px" }}>Repeat</th>
                        <th style={{ width: "85px" }}>Sets</th>
                        <th style={{ width: "85px" }}>Reps</th>
                        <th>Notes</th>
                        <th style={{ width: "40px" }} className="text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercisesList.map((ex, idx) => (
                        <tr key={ex._id || idx}>
                          <td className="text-center text-muted small">{idx + 1}</td>
                          <td>
                            <span className="fw-semibold text-dark">{ex.exerciseName || ex.name}</span>
                            {ex.category && (
                              <span
                                className="badge bg-light text-secondary border ms-2"
                                style={{ fontSize: "10.5px" }}
                              >
                                {ex.category}
                              </span>
                            )}
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="e.g. 2x daily"
                              value={ex.repeat || ""}
                              onChange={(e) =>
                                handleExerciseFieldChange(idx, "repeat", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="form-control form-control-sm"
                              value={ex.sets ?? 1}
                              onChange={(e) =>
                                handleExerciseFieldChange(idx, "sets", Number(e.target.value) || 1)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="form-control form-control-sm"
                              value={ex.repetitions ?? ex.reps ?? 10}
                              onChange={(e) =>
                                handleExerciseFieldChange(idx, "repetitions", Number(e.target.value) || 1)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Notes"
                              value={ex.notes || ""}
                              onChange={(e) =>
                                handleExerciseFieldChange(idx, "notes", e.target.value)
                              }
                            />
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-sm text-danger p-0"
                              onClick={() => handleRemoveExercise(idx)}
                              title="Remove exercise"
                            >
                              <i className="fa fa-trash-can" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  className="text-center py-3 px-2 rounded border border-dashed text-muted mb-3"
                  style={{
                    backgroundColor: "#f8fafc",
                    borderColor: "#cbd5e1",
                    fontSize: "12.5px",
                  }}
                >
                  <i className="fa-solid fa-dumbbell text-secondary me-1.5" />
                  No exercises added yet. Click any exercise below to add it instantly to this session.
                </div>
              )}

              {/* Categorized Multi-Select Exercise Selector */}
              <div
                className="p-3 rounded border mb-3"
                style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
              >
                {/* Header & Filter Controls */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold text-dark" style={{ fontSize: "13.5px" }}>
                      <i className="fa-solid fa-list-check text-success me-1" />
                      Select Prescribed Exercises:
                    </span>
                    {exercisesList.length > 0 && (
                      <span className="badge bg-success-subtle text-success border border-success-subtle fw-bold">
                        {exercisesList.length} Selected
                      </span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Search exercises..."
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                      style={{ maxWidth: "210px", fontSize: "12.5px" }}
                    />
                    {exercisesList.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger py-0 px-2"
                        style={{ fontSize: "11.5px" }}
                        onClick={handleClearExercises}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-muted small mb-2" style={{ fontSize: "11.5px" }}>
                  <i className="fa-solid fa-circle-info text-primary me-1" />
                  Click any exercise below to add or remove it from the prescribed list above.
                </div>

                {/* Category Filter Tabs */}
                <div className="d-flex flex-wrap gap-1 mb-2 pb-2 border-bottom">
                  <button
                    type="button"
                    className={`btn btn-sm py-0 px-2 fw-medium ${
                      activeCategory === "All"
                        ? "btn-success text-white"
                        : "btn-light text-secondary border"
                    }`}
                    style={{ fontSize: "11.5px", borderRadius: "14px" }}
                    onClick={() => setActiveCategory("All")}
                  >
                    All ({PRESET_EXERCISES.reduce((acc, g) => acc + g.exercises.length, 0)})
                  </button>
                  {PRESET_EXERCISES.map((group) => {
                    const count = group.exercises.length;
                    const isSelected = activeCategory === group.category;
                    return (
                      <button
                        key={group.category}
                        type="button"
                        className={`btn btn-sm py-0 px-2 fw-medium ${
                          isSelected
                            ? "btn-success text-white"
                            : "btn-light text-secondary border"
                        }`}
                        style={{ fontSize: "11.5px", borderRadius: "14px" }}
                        onClick={() => setActiveCategory(group.category)}
                      >
                        {group.shortName || group.category} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Exercises Checkbox Grid */}
                <div
                  className="p-2 rounded bg-white border"
                  style={{ maxHeight: "200px", overflowY: "auto" }}
                >
                  {(activeCategory === "All"
                    ? PRESET_EXERCISES
                    : PRESET_EXERCISES.filter((c) => c.category === activeCategory)
                  ).map((group) => {
                    const filteredExercises = group.exercises.filter((ex) =>
                      !exerciseSearch.trim() ||
                      ex.toLowerCase().includes(exerciseSearch.trim().toLowerCase())
                    );
                    if (filteredExercises.length === 0) return null;

                    return (
                      <div key={group.category} className="mb-2">
                        {activeCategory === "All" && (
                          <div
                            className="text-muted fw-bold text-uppercase px-1 mb-1"
                            style={{ fontSize: "11px", letterSpacing: "0.5px" }}
                          >
                            {group.category}
                          </div>
                        )}
                        <div className="d-flex flex-wrap gap-1">
                          {filteredExercises.map((exName) => {
                            const isChecked = exercisesList.some(
                              (e) => (e.exerciseName || e.name || "").toLowerCase() === exName.toLowerCase()
                            );
                            return (
                              <button
                                key={exName}
                                type="button"
                                className={`btn btn-sm text-start d-flex align-items-center gap-1 ${
                                  isChecked
                                    ? "btn-success text-white fw-bold shadow-sm"
                                    : "btn-light text-dark border"
                                }`}
                                style={{
                                  fontSize: "12px",
                                  padding: "3px 9px",
                                  borderRadius: "6px",
                                  transition: "all 0.15s ease",
                                }}
                                onClick={() => togglePresetExercise(exName)}
                              >
                                <i
                                  className={`fa-solid ${
                                    isChecked ? "fa-circle-check" : "fa-plus"
                                  }`}
                                  style={{ fontSize: "11px" }}
                                />
                                {exName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3">
                <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                  Exercise Section Notes
                </label>
                <textarea
                  name="exerciseNotes"
                  rows="2"
                  className="form-control"
                  placeholder="Notes or instructions for the prescribed and performed exercises..."
                  value={formData.exerciseNotes}
                  onChange={handleChange}
                  style={{ fontSize: "13.5px" }}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Progress & Remarks */}
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "12px", background: "#ffffff" }}
          >
            <div className="card-body p-3">
              <div className="row g-3">
                <div className="col-12">
                  <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                    Clinical Progress Remarks
                  </label>
                  <textarea
                    name="progressRemarks"
                    rows="2"
                    className="form-control"
                    placeholder="Patient tolerated therapy well; ROM active flexion improved to 95 degrees..."
                    value={formData.progressRemarks}
                    onChange={handleChange}
                    style={{ fontSize: "13.5px" }}
                  />
                </div>

                <div className="col-12">
                  {existingAttachments && existingAttachments.length > 0 && (
                    <div
                      className="mb-3 rounded border shadow-sm overflow-hidden"
                      style={{
                        backgroundColor: "#f8fafc",
                        borderColor: "#e2e8f0",
                        borderRadius: "12px",
                      }}
                    >
                      {/* Section Header */}
                      <div
                        className="px-3 py-2.5 d-flex align-items-center justify-content-between border-bottom"
                        style={{
                          backgroundColor: "#f1f5f9",
                          borderColor: "#e2e8f0",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center"
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "7px",
                              backgroundColor: "#e0f2fe",
                              color: "#0284c7",
                              fontSize: "12px",
                            }}
                          >
                            <i className="fa-solid fa-paperclip" />
                          </span>
                          <span className="fw-bold text-dark" style={{ fontSize: "13px" }}>
                            Saved Session Attachments
                          </span>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: "#0284c7",
                              color: "#ffffff",
                              fontSize: "11px",
                              fontWeight: "700",
                              borderRadius: "10px",
                              padding: "2px 8px",
                            }}
                          >
                            {existingAttachments.length}
                          </span>
                        </div>
                        <span
                          className="text-muted d-inline-flex align-items-center gap-1"
                          style={{ fontSize: "11.5px", fontWeight: "500" }}
                        >
                          <i className="fa-solid fa-circle-check text-success" />
                          Saved in session record
                        </span>
                      </div>

                      {/* Cards Grid */}
                      <div className="p-3">
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          {existingAttachments.map((att, aIdx) => {
                            const fileUrl = getFileUrl(att);
                            const fileName = att.documentName || att.fileName || att.name || `Attachment ${aIdx + 1}`;
                            const isImg = isImageFile(att) || isImageFile(fileUrl);
                            const isPdf = isPdfFile(att) || isPdfFile(fileUrl);
                            const clean = (typeof att === "string" ? att : (att.fileName || att.file || att.filePath || "")).replace(/^\/+/, "");
                            const fallbackUrl = (imageUrl || "").endsWith("/") ? `${imageUrl}${clean}` : `${imageUrl}/${clean}`;

                            return (
                              <div
                                key={aIdx}
                                className="bg-white border rounded d-flex align-items-center gap-2.5 p-2 shadow-sm"
                                style={{
                                  borderRadius: "10px",
                                  borderColor: "#e2e8f0",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {/* Thumbnail / File Icon */}
                                {isImg && fileUrl ? (
                                  <div
                                    style={{
                                      width: "48px",
                                      height: "48px",
                                      borderRadius: "8px",
                                      overflow: "hidden",
                                      flexShrink: 0,
                                      cursor: "pointer",
                                      border: "1px solid #e2e8f0",
                                      backgroundColor: "#f8fafc",
                                    }}
                                    onClick={() => setLightboxImg({ url: fileUrl, title: fileName, fallbackUrl })}
                                    title="Click to view photo in full size"
                                  >
                                    <img
                                      src={fileUrl}
                                      alt={fileName}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                      }}
                                      onError={(e) => {
                                        if (!e.target.dataset.tried) {
                                          e.target.dataset.tried = "true";
                                          e.target.src = fallbackUrl;
                                        }
                                      }}
                                    />
                                  </div>
                                ) : isPdf ? (
                                  <div
                                    style={{
                                      width: "48px",
                                      height: "48px",
                                      borderRadius: "8px",
                                      backgroundColor: "#fee2e2",
                                      color: "#dc2626",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                      border: "1px solid #fecaca",
                                    }}
                                  >
                                    <i className="fa-solid fa-file-pdf" style={{ fontSize: "18px" }} />
                                    <span style={{ fontSize: "8.5px", fontWeight: "800", marginTop: "1px", letterSpacing: "0.5px" }}>PDF</span>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      width: "48px",
                                      height: "48px",
                                      borderRadius: "8px",
                                      backgroundColor: "#e0f2fe",
                                      color: "#0284c7",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                      border: "1px solid #bae6fd",
                                    }}
                                  >
                                    <i className="fa-solid fa-file-lines" style={{ fontSize: "18px" }} />
                                    <span style={{ fontSize: "8.5px", fontWeight: "800", marginTop: "1px", letterSpacing: "0.5px" }}>DOC</span>
                                  </div>
                                )}

                                {/* Content & Actions */}
                                <div style={{ minWidth: "0", flex: 1, paddingRight: "2px" }}>
                                  <span
                                    className="d-block text-truncate fw-semibold text-dark mb-1"
                                    style={{ fontSize: "12px", lineHeight: "1.3" }}
                                    title={fileName}
                                  >
                                    {fileName}
                                  </span>

                                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                    {isImg && fileUrl ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm py-0 px-2 d-inline-flex align-items-center gap-1 fw-semibold"
                                        style={{
                                          fontSize: "11px",
                                          borderRadius: "6px",
                                          backgroundColor: "#f0fdf4",
                                          color: "#15803d",
                                          border: "1px solid #bbf7d0",
                                          height: "24px",
                                        }}
                                        onClick={() => setLightboxImg({ url: fileUrl, title: fileName, fallbackUrl })}
                                      >
                                        <i className="fa-solid fa-expand" style={{ fontSize: "10px" }} /> View
                                      </button>
                                    ) : (
                                      <a
                                        href={fileUrl || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm py-0 px-2 d-inline-flex align-items-center gap-1 text-decoration-none fw-semibold"
                                        style={{
                                          fontSize: "11px",
                                          borderRadius: "6px",
                                          backgroundColor: "#eff6ff",
                                          color: "#1d4ed8",
                                          border: "1px solid #bfdbfe",
                                          height: "24px",
                                        }}
                                      >
                                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: "10px" }} /> Open
                                      </a>
                                    )}

                                    <button
                                      type="button"
                                      className="btn btn-sm py-0 px-2 d-inline-flex align-items-center gap-1 fw-semibold ms-auto"
                                      style={{
                                        fontSize: "11px",
                                        borderRadius: "6px",
                                        backgroundColor: "#fef2f2",
                                        color: "#b91c1c",
                                        border: "1px solid #fecaca",
                                        height: "24px",
                                      }}
                                      onClick={() => {
                                        const toRemove = existingAttachments[aIdx];
                                        if (toRemove) {
                                          setRemovedAttachments((prev) => [...prev, toRemove]);
                                        }
                                        setExistingAttachments((prev) => prev.filter((_, i) => i !== aIdx));
                                      }}
                                      title="Remove this attachment"
                                    >
                                      <i className="fa-solid fa-trash-can" style={{ fontSize: "10px" }} /> Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <CameraFileUpload
                    label="Session Attachments (Exercise Chart, Photos)"
                    files={attachments}
                    setFiles={setAttachments}
                    multiple={true}
                    accept="image/*,.pdf,application/pdf"
                    helperText="Take photos of exercise chart/notes or upload files"
                  />
                </div>
              </div>
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
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          form="session-form"
          className="btn btn-success px-4 fw-bold d-flex align-items-center gap-2 shadow-sm"
          style={{
            borderRadius: "8px",
            backgroundColor: "#059669",
            borderColor: "#059669",
            fontSize: "13.5px",
          }}
          disabled={saving}
        >
          {saving ? (
            <>
              <i className="fa fa-spinner fa-spin" /> {editingSession ? "Updating Session..." : "Saving Session..."}
            </>
          ) : (
            <>
              <i className="fa fa-check-circle" /> {editingSession ? "Update Session" : "Record Session"}
            </>
          )}
        </button>
      </div>

      {/* Photo Lightbox Modal */}
      {lightboxImg && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setLightboxImg(null)}
        >
          <div
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImg(null)}
              style={{
                position: "absolute",
                top: "-16px",
                right: "-16px",
                background: "#ef4444",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                zIndex: 1,
              }}
              title="Close image"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <img
              src={lightboxImg.url}
              alt={lightboxImg.title || "Full Preview"}
              style={{
                maxWidth: "100%",
                maxHeight: "82vh",
                borderRadius: "10px",
                display: "block",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                margin: "0 auto",
                backgroundColor: "#000",
              }}
              onError={(e) => {
                if (!e.target.dataset.tried && lightboxImg.fallbackUrl) {
                  e.target.dataset.tried = "true";
                  e.target.src = lightboxImg.fallbackUrl;
                }
              }}
            />
            {lightboxImg.title && (
              <div className="text-white text-center mt-2 fw-semibold" style={{ fontSize: "14px" }}>
                {lightboxImg.title}
              </div>
            )}
            <div className="mt-2 d-flex justify-content-center gap-2">
              <a
                href={lightboxImg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-light px-3"
                style={{ borderRadius: "20px", fontSize: "12px" }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square me-1" /> Open in New Tab
              </a>
              <a
                href={lightboxImg.url}
                download
                className="btn btn-sm btn-primary px-3"
                style={{ borderRadius: "20px", fontSize: "12px" }}
              >
                <i className="fa-solid fa-download me-1" /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
