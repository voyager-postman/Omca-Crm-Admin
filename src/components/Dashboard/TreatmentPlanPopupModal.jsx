import { useState } from "react";
import {
  acknowledgeAllPopupAlerts,
  dismissPopupAlert,
  formatWaitingDuration,
  getPopupAlertId,
  navigateToRecord,
} from "../../services/dashboardApi";
import {
  getAlertStinkerCount,
  getAlertStinkerNotes,
  getStinkerKind,
  isStinkerAlert,
} from "../../utils/stinker";

export default function TreatmentPlanPopupModal({
  alert,
  pendingAlerts = [],
  currentIndex = 1,
  onDismiss,
  onDismissAll,
  navigate,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [dismissingAll, setDismissingAll] = useState(false);
  const [error, setError] = useState("");

  if (!alert) return null;

  const pendingCount = pendingAlerts.length || 1;
  const showDismissAll = pendingCount > 1;

  const handleDismiss = async () => {
    const id = getPopupAlertId(alert);
    if (!id) {
      setError("Missing alert id — cannot dismiss on server.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await dismissPopupAlert(alert);
      onDismiss?.(id, alert);
    } catch (err) {
      console.error("Failed to acknowledge popup:", err);
      setError(
        err?.response?.data?.message ||
          "Could not dismiss alert. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissAll = async () => {
    setDismissingAll(true);
    setError("");

    try {
      const { succeeded, failed } = await acknowledgeAllPopupAlerts(pendingAlerts);
      if (failed.length) {
        setError(
          `${failed.length} alert(s) could not be dismissed. Please try again.`,
        );
        if (succeeded.length) {
          onDismissAll?.(
            pendingAlerts.filter((item) =>
              succeeded.includes(getPopupAlertId(item)),
            ),
          );
        }
        return;
      }
      onDismissAll?.(pendingAlerts);
    } catch (err) {
      console.error("Failed to dismiss all popups:", err);
      setError("Could not dismiss all alerts. Please try again.");
    } finally {
      setDismissingAll(false);
    }
  };

  const busy = submitting || dismissingAll;
  const stinker = isStinkerAlert(alert);
  const stinkerKind = getStinkerKind(alert);
  const stinkerCount = stinker ? getAlertStinkerCount(alert) : 0;
  const stinkerNotes = getAlertStinkerNotes(alert);
  const stinkerLabel =
    stinkerKind === "VIL" ? "VIL approval" : "Treatment Plan approval";

  const popupMessage = formatWaitingDuration(
    alert.message ||
      (alert.metadata?.registeredHoursAgo != null
        ? `Registered: ${alert.metadata.registeredHoursAgo} hours ago`
        : `Patient: ${alert.metadata?.patientName || alert.patientId || "—"}`),
  );

  return (
    <div className="msd-modal-overlay" role="presentation">
      <div
        className={`msd-modal-panel msd-popup-alert-modal${stinker ? " msd-popup-stinker" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="popup-alert-heading"
      >
        <div className="msd-modal-head">
          <div>
            <h5 id="popup-alert-heading">
              {stinkerCount > 0 && (
                <span className="msd-stinker-count">#{stinkerCount}</span>
              )}
              {alert.heading ||
                (stinker
                  ? `${stinkerLabel} reminder`
                  : "Treatment Plan Pending")}
            </h5>
            {pendingCount > 1 && (
              <span className="msd-modal-count">
                Alert {currentIndex} of {pendingCount}
              </span>
            )}
          </div>
        </div>
        <div className="msd-modal-body">
          {stinker && (
            <div className="msd-popup-stinker-banner">
              <strong>
                {stinkerLabel} reminder
                {stinkerCount ? ` #${stinkerCount}` : ""}
              </strong>
              <span>Hospital is waiting for CRM approval.</span>
              {stinkerNotes &&
                !String(popupMessage || "").includes(stinkerNotes) && (
                  <p>{stinkerNotes}</p>
                )}
            </div>
          )}
          <pre className="msd-popup-message">{popupMessage}</pre>
          {error && <p className="msd-modal-error">{error}</p>}
        </div>
        <div className="msd-modal-foot">
          <button
            type="button"
            className="msd-view-btn"
            onClick={() => navigateToRecord(navigate, alert)}
            disabled={busy}
          >
            View Patient
          </button>
          {showDismissAll && (
            <button
              type="button"
              className="msd-popup-dismiss-all-btn"
              onClick={handleDismissAll}
              disabled={busy}
            >
              {dismissingAll ? "Dismissing all…" : "Dismiss All"}
            </button>
          )}
          <button
            type="button"
            className="msd-aging-view-btn"
            onClick={handleDismiss}
            disabled={busy}
          >
            {submitting ? "Dismissing…" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
