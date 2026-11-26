import React, { useEffect, useRef, useState, useCallback } from "react";
import "../EmergencyAlertModal.css";
import {
  acceptSosCase,
  closeSosCase,
  fetchSosDashboard,
  fetchSosTracking,
  mergeTrackingIntoDashboard,
  normalizeSosDashboardData,
  postSosAction,
  postSosNote,
} from "../services/sosApi";
import { startSosAlarm, silenceSosAlarm, unsilenceSosAlarm, unlockSosAudio } from "../services/sosAlarm";

/* -------------------------------------------------------------------------
 * Small shared helpers
 * ---------------------------------------------------------------------- */
function formatClock(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function useElapsedLabel(sinceTimestamp) {
  const [label, setLabel] = useState("just now");

  useEffect(() => {
    if (!sinceTimestamp) return undefined;
    const update = () => {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - sinceTimestamp) / 1000),
      );
      if (seconds < 60) {
        setLabel(`${seconds} second${seconds === 1 ? "" : "s"} ago`);
      } else {
        const mins = Math.floor(seconds / 60);
        setLabel(`${mins} minute${mins === 1 ? "" : "s"} ago`);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [sinceTimestamp]);

  return label;
}

function ToastStack({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="ems-toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`ems-toast ems-toast-${t.type || "success"}`}
        >
          <i
            className={`fa-solid ${t.type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}`}
          ></i>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function EmergencyModalHeader({ title, caseId, receivedAt, onClose }) {
  const elapsed = useElapsedLabel(receivedAt);
  return (
    <header className="ems-header">
      <div className="ems-header-left">
        <div className="ems-siren-icon" aria-hidden="true">
          <span className="ems-siren-ring"></span>
          <span className="ems-siren-ring ems-siren-ring-2"></span>
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div className="ems-header-text">
          <div className="ems-header-title-row">
            <h2 className="ems-header-title" id="ems-header-title">
              {title || "NEW SOS ALERT"}
            </h2>
          </div>
          <p className="ems-header-meta">
            Received {elapsed} <span className="ems-dot-sep">•</span> Case ID:{" "}
            {caseId}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="ems-close-btn"
        onClick={onClose}
        aria-label="Close emergency alert"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </header>
  );
}

function PatientInformation({ patient }) {
  return (
    <div className="card main_content">
      <div className="card-header">
        <h6>
          <i className="fa-solid fa-user-injured me-2"></i> Patient Details
        </h6>
      </div>
      <div className="card-body ems-patient-body">
        <div className="ems-avatar" aria-hidden="true">
          {patient.initials}
        </div>
        <div className="ems-patient-details">
          <p className="ems-patient-name">{patient.name}</p>
          <div className="ems-patient-meta-row">
            <span>
              <strong>Mobile</strong> {patient.mobile || "—"}
            </span>
            <span>
              <strong>Age</strong> {patient.age}
            </span>
            <span>
              <strong>Gender</strong> {patient.gender}
            </span>
          </div>
          <p className="ems-patient-status">
            <i className="fa-solid fa-heart-pulse"></i> {patient.status}
          </p>
        </div>
      </div>
    </div>
  );
}

function LiveLocationCard({ location, onOpenMaps, addToast }) {
  const handleCopyCoords = async () => {
    if (location.lat == null || location.lng == null) {
      addToast("Coordinates not available", "error");
      return;
    }
    const coords = `${location.lat}, ${location.lng}`;
    try {
      await navigator.clipboard.writeText(coords);
      addToast("Coordinates copied to clipboard");
    } catch {
      addToast("Could not copy coordinates", "error");
    }
  };

  return (
    <div className="card main_content">
      <div className="card-header">
        <h6>
          <i className="fa-solid fa-location-dot me-2"></i> Live GPS Location
        </h6>
      </div>
      <div className="card-body">
        <p className="ems-location-label">{location.label}</p>
        <div className="ems-location-stats">
          <div className="ems-stat">
            <span className="ems-stat-label">
              Distance from nearest ambulance
            </span>
            <span className="ems-stat-value">
              {location.distanceKm === "—" || location.distanceKm == null
                ? "—"
                : `${location.distanceKm} km`}
            </span>
          </div>
          <div className="ems-stat">
            <span className="ems-stat-label">Estimated ambulance arrival</span>
            <span className="ems-stat-value">
              {location.etaMinutes === "—" || location.etaMinutes == null
                ? "—"
                : `${location.etaMinutes} minutes`}
            </span>
          </div>
        </div>
        <div className="ems-card-actions">
          <button
            type="button"
            className="ems-btn ems-btn-secondary ems-btn-sm"
            onClick={onOpenMaps}
          >
            <i className="fa-solid fa-map-location-dot"></i> Maps
          </button>
          <button
            type="button"
            className="ems-btn ems-btn-ghost ems-btn-sm"
            onClick={handleCopyCoords}
          >
            <i className="fa-regular fa-copy"></i> Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function MedicalHistoryCard({ medicalHistory, allergies, medication }) {
  return (
    <div className="card main_content">
      <div className="card-header">
        <h6>
          <i className="fa-solid fa-notes-medical me-2"></i> Medical History
        </h6>
      </div>
      <div className="card-body">
        <ul className="ems-tag-list">
          {(medicalHistory.length ? medicalHistory : ["None recorded"]).map(
            (item) => (
              <li key={item} className="ems-tag ems-tag-warning">
                <i className="fa-solid fa-triangle-exclamation"></i> {item}
              </li>
            ),
          )}
        </ul>
        <div className="ems-medical-subsection">
          <span className="ems-medical-label">
            <i className="fa-solid fa-allergies"></i> Known Allergies
          </span>
          <p className="ems-medical-value ems-medical-value-alert">
            {(allergies || []).join(", ") || "None recorded"}
          </p>
        </div>
        <div className="ems-medical-subsection">
          <span className="ems-medical-label">
            <i className="fa-solid fa-pills"></i> Current Medication
          </span>
          <p className="ems-medical-value">
            {(medication || []).join(", ") || "None recorded"}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmergencyContactCard({ contact, patientName, addToast, addActivity }) {
  const handleCall = () => {
    if (!contact.phone) {
      addToast("Contact phone not available", "error");
      return;
    }
    window.location.href = `tel:${contact.phone.replace(/\s+/g, "")}`;
    addActivity(`Called emergency contact ${contact.name}`);
  };

  const handleWhatsApp = () => {
    if (!contact.phone) {
      addToast("Contact phone not available", "error");
      return;
    }
    const message = encodeURIComponent(
      `This is an emergency notification regarding ${patientName}. Please stay reachable, our team is coordinating an emergency response.`,
    );
    const phone = contact.phone.replace(/[^\d]/g, "");
    window.open(
      `https://wa.me/${phone}?text=${message}`,
      "_blank",
      "noopener,noreferrer",
    );
    addToast(`WhatsApp opened for ${contact.name}`);
    addActivity(`WhatsApp opened for emergency contact ${contact.name}`);
  };

  const handleCopyPhone = async () => {
    if (!contact.phone) {
      addToast("Contact phone not available", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(contact.phone);
      addToast("Phone number copied");
    } catch {
      addToast("Could not copy phone number", "error");
    }
  };

  return (
    <div className="card main_content">
      <div className="card-header">
        <h6>
          <i className="fa-solid fa-address-book me-2"></i> Emergency Contact
        </h6>
      </div>
      <div className="card-body">
        <div className="ems-contact-details">
          <p className="ems-contact-name">{contact.name}</p>
          <p className="ems-contact-meta">
            {contact.relation || "Contact"}{" "}
            <span className="ems-dot-sep">•</span> {contact.phone || "—"}
          </p>
        </div>
        <div className="ems-card-actions">
          <button
            type="button"
            className="ems-btn ems-btn-secondary ems-btn-sm"
            onClick={handleCall}
          >
            <i className="fa-solid fa-phone"></i> Call
          </button>
          <button
            type="button"
            className="ems-btn ems-btn-whatsapp ems-btn-sm"
            onClick={handleWhatsApp}
          >
            <i className="fa-brands fa-whatsapp"></i> WhatsApp
          </button>
          <button
            type="button"
            className="ems-btn ems-btn-ghost ems-btn-sm"
            onClick={handleCopyPhone}
          >
            <i className="fa-regular fa-copy"></i> Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function OperatorNotes({ onSave, busy, savedNotes = [] }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const text = note.trim();
    if (!text || busy || saving) return;
    setSaving(true);
    try {
      const ok = await onSave(text);
      if (ok !== false) {
        setNote("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card main_content">
      <div className="card-header">
        <h6>
          <i className="fa-solid fa-clipboard-list me-2"></i> Operator Notes
        </h6>
      </div>
      <div className="card-body">
        {savedNotes.length > 0 && (
          <ul className="ems-saved-notes">
            {savedNotes.map((item, idx) => (
              <li key={item.id || `${item.text}-${idx}`}>
                <span className="ems-saved-note-time">{item.time || ""}</span>
                <span className="ems-saved-note-text">{item.text}</span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          className="form-control ems-note-input"
          rows={2}
          placeholder="Add an operator note…"
          value={note}
          disabled={busy || saving}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSave();
            }
          }}
        />
        <div className="ems-card-actions mt-2">
          <button
            type="button"
            className="ems-btn ems-btn-secondary ems-btn-sm"
            disabled={busy || saving || !note.trim()}
            onClick={handleSave}
          >
            <i className="fa-solid fa-floppy-disk"></i>{" "}
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activities }) {
  return (
    <div className="card main_content">
      <div className="card-header">
        <h6>
          <i className="fa-solid fa-list-check me-2"></i> Activity
        </h6>
      </div>
      <div className="card-body">
        <ul className="ems-activity-list">
          {activities.length === 0 ? (
            <li className="ems-activity-empty">No activity yet</li>
          ) : (
            activities
              .slice()
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  <span className="ems-activity-time">{a.time}</span>
                  <span>{a.text}</span>
                </li>
              ))
          )}
        </ul>
      </div>
    </div>
  );
}

function EmergencyActionPanel({
  caseAccepted,
  patientCalled,
  ambulanceDispatched,
  airAmbulanceArranged,
  closed,
  actionBusy,
  ambulance,
  location,
  onAcceptCase,
  onCallPatient,
  onWhatsApp,
  onDispatchAmbulance,
  onArrangeAirAmbulance,
  onOpenMaps,
  onCloseSos,
}) {
  return (
    <div className="ems-actions-bar">
      <div className="ems-actions-row">
        <button
          type="button"
          data-sos-accept="true"
          className={`ems-action-btn ${caseAccepted ? "ems-action-btn-done" : "ems-action-btn-critical"}`}
          onClick={onAcceptCase}
          disabled={caseAccepted || closed || actionBusy}
        >
          <i
            className={`fa-solid ${caseAccepted ? "fa-circle-check" : "fa-check"}`}
          ></i>
          {caseAccepted ? "Case Accepted" : "Accept Case"}
        </button>
        <button
          type="button"
          className={`ems-action-btn ${patientCalled ? "ems-action-btn-done" : "ems-action-btn-critical"}`}
          onClick={onCallPatient}
          disabled={patientCalled || closed || actionBusy}
        >
          <i className="fa-solid fa-phone-volume"></i>
          {patientCalled ? "Patient Called" : "Call Patient"}
        </button>
        <button
          type="button"
          className={`ems-action-btn ${ambulanceDispatched ? "ems-action-btn-done" : "ems-action-btn-critical"}`}
          onClick={onDispatchAmbulance}
          disabled={ambulanceDispatched || closed || actionBusy}
        >
          <i className="fa-solid fa-truck-medical"></i>
          {ambulanceDispatched ? "Dispatched" : "Dispatch"}
        </button>
        <button
          type="button"
          className="ems-action-btn ems-action-btn-outline"
          onClick={onWhatsApp}
          disabled={closed || actionBusy}
        >
          <i className="fa-brands fa-whatsapp"></i>
          WhatsApp
        </button>
        <button
          type="button"
          className={`ems-action-btn ${airAmbulanceArranged ? "ems-action-btn-done" : "ems-action-btn-outline"}`}
          onClick={onArrangeAirAmbulance}
          disabled={airAmbulanceArranged || closed || actionBusy}
        >
          <i className="fa-solid fa-plane-departure"></i>
          {airAmbulanceArranged ? "Air Arranged" : "Air Ambulance"}
        </button>
        <button
          type="button"
          className="ems-action-btn ems-action-btn-outline"
          onClick={onOpenMaps}
          disabled={actionBusy}
        >
          <i className="fa-solid fa-map-location-dot"></i>
          Maps
        </button>
        <button
          type="button"
          data-sos-close="true"
          className={`ems-action-btn ${closed ? "ems-action-btn-done" : "ems-action-btn-outline"}`}
          onClick={onCloseSos}
          disabled={closed || actionBusy}
        >
          <i className="fa-solid fa-lock"></i>
          {closed ? "Closed" : "Close SOS"}
        </button>
      </div>
      {ambulanceDispatched && (
        <div className="ems-dispatch-summary" role="status">
          <p className="ems-dispatch-title">
            <i className="fa-solid fa-truck-medical"></i> Ambulance{" "}
            {ambulance.id} en route · ETA{" "}
            {location.etaMinutes === "—"
              ? "—"
              : `${location.etaMinutes} min`}
          </p>
        </div>
      )}
    </div>
  );
}

function EmergencyModalFooter({ operator, lastUpdated, live }) {
  return (
    <footer className="ems-footer">
      <div className="ems-footer-item">
        <span className="ems-footer-label">Assigned Operator</span>
        <span className="ems-footer-value">{operator}</span>
      </div>
      <div className="ems-footer-item">
        <span className="ems-footer-label">Priority</span>
        <span className="ems-footer-value ems-footer-value-critical">
          Critical
        </span>
      </div>
      <div className="ems-footer-item">
        <span className="ems-footer-label">Last Updated</span>
        <span className="ems-footer-value">{lastUpdated}</span>
      </div>
      <div className="ems-footer-item">
        <span className="ems-footer-label">Connection</span>
        <span className="ems-footer-value">
          <span className="ems-live-badge-dot ems-inline-dot"></span>{" "}
          {live ? "Live" : "Offline"}
        </span>
      </div>
      <div className="ems-footer-item">
        <span className="ems-footer-label">GPS Tracking</span>
        <span className="ems-footer-value">{live ? "Active" : "—"}</span>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------
 * Main modal
 * ---------------------------------------------------------------------- */
export default function EmergencyAlertModal({
  isOpen,
  onClose,
  onCaseAccepted,
  onCaseAcceptFailed,
  onCaseClosed,
  onAccessDenied,
  sosId,
  alertPayload = null,
}) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [caseAccepted, setCaseAccepted] = useState(false);
  const [patientCalled, setPatientCalled] = useState(false);
  const [ambulanceDispatched, setAmbulanceDispatched] = useState(false);
  const [airAmbulanceArranged, setAirAmbulanceArranged] = useState(false);
  const [closed, setClosed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [trackingLive, setTrackingLive] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [savedNotes, setSavedNotes] = useState([]);

  const dialogRef = useRef(null);
  const toastTimers = useRef({});

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    toastTimers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const addActivity = useCallback((text) => {
    setActivities((prev) => [
      ...prev,
      { id: prev.length + 1, time: formatClock(new Date()), text },
    ]);
    setLastUpdated(formatClock(new Date()));
  }, []);

  const normalizeNotesList = useCallback((rawNotes) => {
    if (!rawNotes) return [];
    const list = Array.isArray(rawNotes) ? rawNotes : [rawNotes];
    return list
      .map((item, idx) => {
        if (typeof item === "string") {
          return { id: `n-${idx}`, text: item, time: "" };
        }
        const text =
          item.notes ||
          item.note ||
          item.text ||
          item.message ||
          item.content ||
          "";
        if (!text) return null;
        const timeRaw = item.createdAt || item.time || item.at || null;
        return {
          id: item._id || item.id || `n-${idx}`,
          text: String(text),
          time: timeRaw ? formatClock(new Date(timeRaw)) : "",
        };
      })
      .filter(Boolean);
  }, []);

  const applyDashboard = useCallback(
    (raw, alert) => {
      const normalized = normalizeSosDashboardData(raw || {}, alert || {});
      setDashboard(normalized);
      // Never downgrade a locally completed action (avoids load race wiping green)
      setCaseAccepted((prev) => prev || !!normalized.flags.caseAccepted);
      setPatientCalled((prev) => prev || !!normalized.flags.patientCalled);
      setAmbulanceDispatched(
        (prev) => prev || !!normalized.flags.ambulanceDispatched,
      );
      setAirAmbulanceArranged(
        (prev) => prev || !!normalized.flags.airAmbulanceArranged,
      );
      setClosed((prev) => prev || !!normalized.flags.closed);
      const fromDash = normalizeNotesList(
        raw?.notes ||
          raw?.operatorNotes ||
          raw?.operator_notes ||
          normalized.trackingNotes,
      );
      if (fromDash.length) {
        setSavedNotes((prev) => (prev.length ? prev : fromDash));
      }
      setLastUpdated(formatClock(new Date()));
      return normalized;
    },
    [normalizeNotesList],
  );

  // Alarm while unaccepted case is on screen — stop on accept/close (no sound on accept)
  useEffect(() => {
    if (!isOpen || !sosId) return undefined;
    if (caseAccepted || closed) {
      silenceSosAlarm(sosId);
      return undefined;
    }
    unlockSosAudio();
    startSosAlarm(sosId);
    return undefined;
  }, [isOpen, sosId, caseAccepted, closed]);

  // Reset action flags when modal closes (remount via key handles case switches)
  useEffect(() => {
    if (isOpen) return;
    setCaseAccepted(false);
    setPatientCalled(false);
    setAmbulanceDispatched(false);
    setAirAmbulanceArranged(false);
    setClosed(false);
    setSavedNotes([]);
  }, [isOpen]);

  // Load dashboard when opened
  useEffect(() => {
    if (!isOpen || !sosId) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      // Seed from socket alert immediately so UI isn't blank
      if (alertPayload) {
        applyDashboard(
          {
            sosId: alertPayload.sosId,
            emergencyCaseId: alertPayload.emergencyCaseId,
            patientName: alertPayload.patientName,
            status: alertPayload.status,
            alertTitle: alertPayload.title,
          },
          alertPayload,
        );
        setActivities([
          {
            id: 1,
            time: formatClock(new Date()),
            text: alertPayload.body || "SOS alert received",
          },
        ]);
      }

      try {
        const raw = await fetchSosDashboard(sosId);
        if (cancelled) return;
        const normalized = applyDashboard(raw, alertPayload);
        setActivities((prev) =>
          prev.length
            ? prev
            : [
                {
                  id: 1,
                  time: formatClock(new Date(normalized.receivedAt)),
                  text: "SOS alert received",
                },
              ],
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const status = err?.response?.status;
          const message =
            err?.response?.data?.message ||
            (status === 403
              ? "This SOS case is assigned to another operator."
              : "Could not load SOS dashboard. Showing alert details.");
          setLoadError(message);
          if (status === 403) {
            setDashboard(null);
            addToast(message, "error");
            onAccessDenied?.(sosId);
          } else if (!alertPayload) {
            addToast("Failed to load SOS dashboard", "error");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sosId, alertPayload, applyDashboard, addToast, onAccessDenied]);

  // Live tracking poll
  useEffect(() => {
    if (!isOpen || !sosId || closed) return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const tracking = await fetchSosTracking(sosId);
        if (cancelled || !tracking) return;
        setTrackingLive(true);
        setDashboard((prev) =>
          prev ? mergeTrackingIntoDashboard(prev, tracking) : prev,
        );
        const fromTrack = normalizeNotesList(
          tracking.notes || tracking.operatorNotes || tracking.operator_notes,
        );
        if (fromTrack.length) {
          setSavedNotes((prev) => {
            const seen = new Set(prev.map((n) => n.text));
            const merged = [...prev];
            fromTrack.forEach((n) => {
              if (!seen.has(n.text)) merged.push(n);
            });
            return merged;
          });
        }
        setLastUpdated(formatClock(new Date()));
      } catch (err) {
        if (!cancelled) {
          setTrackingLive(false);
          // Accepted by another operator — stop polling and dismiss
          if (err?.response?.status === 403) {
            onAccessDenied?.(sosId);
          }
        }
      }
    };

    poll();
    const id = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOpen, sosId, closed, onAccessDenied, normalizeNotesList]);

  useEffect(() => {
    return () => {
      Object.values(toastTimers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Reset when closed
  useEffect(() => {
    if (isOpen) return;
    setDashboard(null);
    setLoadError("");
    setToasts([]);
    setActivities([]);
    setTrackingLive(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const data =
    dashboard ||
    normalizeSosDashboardData({}, alertPayload || { sosId: sosId || "" });

  const openMapsUrl = () => {
    const url =
      data.location.mapsUrl ||
      (data.location.lat != null && data.location.lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${data.location.lat},${data.location.lng}`
        : "");
    if (!url) {
      addToast("Map location not available", "error");
      return false;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  };

  const runAction = async (type, { successMessage, activityText, onOk, onFail }) => {
    if (!sosId) {
      addToast("Missing SOS id", "error");
      return;
    }
    setActionBusy(true);
    // Optimistic UI — turn green immediately
    onOk?.();
    try {
      await postSosAction(sosId, type);
      addToast(successMessage);
      addActivity(activityText);
    } catch (err) {
      console.error(err);
      onFail?.();
      addToast(
        err?.response?.data?.message || `Failed: ${type}`,
        "error",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleAcceptCase = async () => {
    if (!sosId || caseAccepted || closed) return;
    setActionBusy(true);
    // Optimistic: green + stop sound immediately (no sound on accept)
    setCaseAccepted(true);
    silenceSosAlarm(sosId);
    onCaseAccepted?.(sosId);
    try {
      await acceptSosCase(sosId);
      addToast("Case accepted");
      addActivity(
        `Case accepted by Operator ${String(data.operator).split(" ")[0]}`,
      );
    } catch (err) {
      console.error(err);
      setCaseAccepted(false);
      onCaseAcceptFailed?.(sosId);
      unsilenceSosAlarm(sosId);
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || "Failed to accept case";
      addToast(message, "error");
      if (status === 403) {
        setLoadError(message);
        onAccessDenied?.(sosId);
      } else {
        startSosAlarm(sosId);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleCallPatient = async () => {
    const phone = data.patient.mobile;
    if (phone) {
      window.location.href = `tel:${String(phone).replace(/\s+/g, "")}`;
    }
    await runAction("Call", {
      successMessage: "Patient called",
      activityText: "Patient called",
      onOk: () => setPatientCalled(true),
      onFail: () => setPatientCalled(false),
    });
  };

  const handleWhatsApp = async () => {
    const phone = String(
      data.patient.mobile || data.emergencyContact.phone || "",
    ).replace(/[^\d]/g, "");
    if (phone) {
      const message = encodeURIComponent(
        `Emergency response update for case ${data.caseId}: our team is coordinating help for ${data.patient.name}.`,
      );
      window.open(
        `https://wa.me/${phone}?text=${message}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    await runAction("WhatsApp", {
      successMessage: "WhatsApp opened",
      activityText: "WhatsApp action logged",
    });
  };

  const handleDispatchAmbulance = async () => {
    await runAction("DispatchAmbulance", {
      successMessage: "Ambulance dispatched",
      activityText: "Ambulance dispatched",
      onOk: () => setAmbulanceDispatched(true),
      onFail: () => setAmbulanceDispatched(false),
    });
  };

  const handleArrangeAirAmbulance = async () => {
    await runAction("AirAmbulance", {
      successMessage: "Air ambulance arranged",
      activityText: "Air ambulance arranged",
      onOk: () => setAirAmbulanceArranged(true),
      onFail: () => setAirAmbulanceArranged(false),
    });
  };

  const handleOpenMaps = async () => {
    openMapsUrl();
    await runAction("OpenMaps", {
      successMessage: "Maps opened",
      activityText: "Opened Google Maps for live location",
    });
  };

  const handleCloseSos = async () => {
    if (!sosId || closed) return;
    setActionBusy(true);
    setClosed(true);
    silenceSosAlarm(sosId);
    try {
      await closeSosCase(sosId);
      addToast("SOS closed");
      addActivity("SOS closed");
      onCaseClosed?.(sosId);
    } catch (err) {
      console.error(err);
      setClosed(false);
      addToast(err?.response?.data?.message || "Failed to close SOS", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveNote = async (note) => {
    if (!sosId) {
      addToast("Missing SOS id", "error");
      return false;
    }
    const text = String(note || "").trim();
    if (!text) {
      addToast("Please enter a note", "error");
      return false;
    }
    setActionBusy(true);
    try {
      await postSosNote(sosId, text);
      const entry = {
        id: `local-${Date.now()}`,
        text,
        time: formatClock(new Date()),
      };
      setSavedNotes((prev) => [...prev, entry]);
      addToast("Note saved");
      addActivity(`Note: ${text}`);
      return true;
    } catch (err) {
      console.error(err);
      addToast(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save note",
        "error",
      );
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const stopPropagation = (e) => e.stopPropagation();

  return (
    <div
      className="ems-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        // Unlock autoplay only — never start siren on accept / modal clicks
        unlockSosAudio();
        stopPropagation(e);
      }}
    >
      <div
        className="ems-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ems-header-title"
        ref={dialogRef}
        onMouseDown={stopPropagation}
      >
        <ToastStack toasts={toasts} />

        <EmergencyModalHeader
          title={data.alertTitle}
          caseId={data.caseId}
          receivedAt={data.receivedAt}
          onClose={onClose}
        />

        <div className="ems-body">
          {loading && (
            <div className="ems-loading-banner" role="status">
              Loading SOS dashboard…
            </div>
          )}
          {loadError && (
            <div className="ems-error-banner" role="alert">
              {loadError}
            </div>
          )}

          <div className="row g-2 ems-cards-row">
            <div className="col-md-4">
              <PatientInformation patient={data.patient} />
            </div>
            <div className="col-md-4">
              <EmergencyContactCard
                contact={data.emergencyContact}
                patientName={data.patient.name}
                addToast={addToast}
                addActivity={addActivity}
              />
            </div>
            <div className="col-md-4">
              <LiveLocationCard
                location={data.location}
                onOpenMaps={handleOpenMaps}
                addToast={addToast}
              />
            </div>
            <div className="col-md-4">
              <MedicalHistoryCard
                medicalHistory={data.medicalHistory}
                allergies={data.allergies}
                medication={data.medication}
              />
            </div>
            <div className="col-md-4">
              <OperatorNotes
                onSave={handleSaveNote}
                busy={actionBusy}
                savedNotes={savedNotes}
              />
            </div>
            <div className="col-md-4">
              <ActivityCard activities={activities} />
            </div>
          </div>

          <div className="ems-actions-wrap">
            <EmergencyActionPanel
              caseAccepted={caseAccepted}
              patientCalled={patientCalled}
              ambulanceDispatched={ambulanceDispatched}
              airAmbulanceArranged={airAmbulanceArranged}
              closed={closed}
              actionBusy={actionBusy}
              ambulance={data.ambulance}
              location={data.location}
              onAcceptCase={handleAcceptCase}
              onCallPatient={handleCallPatient}
              onWhatsApp={handleWhatsApp}
              onDispatchAmbulance={handleDispatchAmbulance}
              onArrangeAirAmbulance={handleArrangeAirAmbulance}
              onOpenMaps={handleOpenMaps}
              onCloseSos={handleCloseSos}
            />
          </div>
        </div>

        <EmergencyModalFooter
          operator={data.operator}
          lastUpdated={lastUpdated}
          live={trackingLive}
        />
      </div>
    </div>
  );
}
