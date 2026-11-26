import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CaseListModal from "./CaseListModal";
import { fetchDashboard, severityToDot } from "../../services/dashboardApi";

export const cleanActionRequiredLabel = (label) => {
  if (!label || typeof label !== "string") return label;
  return label
    .replace(/\s*[-–—]\s*More than 24 hours/gi, "")
    .replace(/\s*More than 24 hours/gi, "")
    .trim();
};

export const ACTION_REQUIRED_ITEMS = [
  {
    key: "treatmentPlanOverdue",
    apiId: "treatment_plan_pending",
    dot: "critical",
    label: "Treatment Plan Pending",
    defaultEndpoint: "dashboard/treatment-plan-pending",
  },
  {
    key: "overdueFollowUps",
    apiId: "followup_overdue",
    dot: "critical",
    label: "Follow-up Overdue",
    defaultEndpoint: "dashboard/followups-due-today",
  },
  {
    key: "doctorReviewPending",
    apiId: "doctor_review_pending",
    dot: "high",
    label: "Awaiting Doctor Review",
    defaultEndpoint: "dashboard/doctor-review-pending",
  },
  {
    key: "missingDocuments",
    apiId: "missing_documents",
    dot: "high",
    label: "Missing Medical Documents",
    defaultEndpoint: "dashboard/missing-documents",
  },
  {
    key: "appointmentPending",
    apiId: "appointment_pending",
    dot: "warning",
    label: "Appointment Pending",
    defaultEndpoint: "dashboard/today-appointments",
  },
  {
    key: "patientWaitingConfirmation",
    apiId: "patient_waiting_confirmation",
    dot: "warning",
    label: "Patient Waiting for Confirmation",
    defaultEndpoint: "dashboard/patients-waiting-confirmation",
  },
];

export const mergeActionRequiredItems = (apiItems = [], liveCounts = {}) => {
  const list = Array.isArray(apiItems) ? apiItems : [];
  const byId = Object.fromEntries(
    list.map((item) => [item.id || item.apiId || item.key, item]),
  );

  return ACTION_REQUIRED_ITEMS.map((item) => {
    const api = byId[item.apiId] || byId[item.key] || {};
    const count =
      api?.count != null && api.count > 0
        ? api.count
        : (liveCounts[item.key] ??
          liveCounts[item.apiId] ??
          (item.key === "treatmentPlanOverdue"
            ? liveCounts.treatmentPlansPending
            : null) ??
          (item.key === "overdueFollowUps"
            ? liveCounts.followUpsDue || liveCounts.overdueCases
            : null) ??
          (item.key === "doctorReviewPending"
            ? liveCounts.doctorReviewsPending
            : null) ??
          (item.key === "missingDocuments"
            ? liveCounts.missingDocuments
            : null) ??
          api?.count ??
          0);

    const rawLabel = api.title || item.label;
    const endpoint = api.viewCasesEndpoint || item.defaultEndpoint;
    return {
      key: item.key,
      apiId: item.apiId,
      label: cleanActionRequiredLabel(rawLabel),
      count: Number(count) || 0,
      oldest: api.oldest || (Number(count) > 0 ? "1d" : "—"),
      viewCasesEndpoint: endpoint,
      openPatientList: api.openPatientList !== false,
      dot: api.severity ? severityToDot(api.severity, api.dotColor) : item.dot,
    };
  });
};

/**
 * Shared Action Required panel for Dashboard + all patient-ID pages.
 * Fetches dashboard.actionRequired and opens CaseListModal on row click.
 */
export default function ActionRequiredSection({
  items: itemsProp,
  showTitle = true,
  className = "",
  refreshKey = 0,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!itemsProp);
  const [actionRequired, setActionRequired] = useState([]);
  const [caseModal, setCaseModal] = useState({
    open: false,
    title: "",
    endpoint: "",
  });

  const loadActionRequired = useCallback(async () => {
    if (itemsProp) return;
    setLoading(true);
    try {
      const data = await fetchDashboard();
      setActionRequired(data?.actionRequired || []);
    } catch (err) {
      console.error("Action Required load failed:", err);
      setActionRequired([]);
    } finally {
      setLoading(false);
    }
  }, [itemsProp]);

  useEffect(() => {
    loadActionRequired();
  }, [loadActionRequired, refreshKey]);

  const actionRequiredItems = useMemo(() => {
    if (itemsProp) return itemsProp;
    return mergeActionRequiredItems(actionRequired);
  }, [itemsProp, actionRequired]);

  const handleActionClick = (item) => {
    if (!item?.viewCasesEndpoint) return;
    if (item.openPatientList === false) return;
    setCaseModal({
      open: true,
      title: cleanActionRequiredLabel(item.label || "Cases"),
      endpoint: item.viewCasesEndpoint,
    });
  };

  return (
    <>
      <div className={`msd-action-required-section ${className}`.trim()}>
        {showTitle ? (
          <div className="treat-hd">
            <h6>Action Required</h6>
            <span className="line"></span>
          </div>
        ) : null}
        <div className="msd-action-panel">
          {loading ? (
            <div className="msd-aging-empty p-3">Loading…</div>
          ) : (
            actionRequiredItems.map((item) => (
              <div
                key={item.apiId || item.key}
                className={`msd-action-row${
                  item.viewCasesEndpoint ? "" : " msd-action-row-disabled"
                }`}
                onClick={() => handleActionClick(item)}
                role="button"
                tabIndex={item.viewCasesEndpoint ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleActionClick(item);
                  }
                }}
              >
                <span className={`msd-dot msd-dot-${item.dot}`}></span>
                <span className="msd-action-label">{item.label}</span>
                <span className="msd-action-count">{item.count}</span>
                <span className="msd-action-oldest">
                  Oldest: {item.oldest}
                </span>
                <i className="fa fa-angle-right msd-action-arrow"></i>
              </div>
            ))
          )}
        </div>
      </div>

      <CaseListModal
        isOpen={caseModal.open}
        title={caseModal.title}
        endpoint={caseModal.endpoint}
        onClose={() => setCaseModal({ open: false, title: "", endpoint: "" })}
        navigate={navigate}
      />
    </>
  );
}
