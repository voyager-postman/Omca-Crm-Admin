import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  fetchPhysiotherapyByPatient,
  updatePhysiotherapyStatus,
  PHYSIO_STATUSES,
} from "../../../services/physiotherapyApi";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";
import SessionModal from "../../Physiotherapy/components/SessionModal";
import ReferralModal from "../../Physiotherapy/components/ReferralModal";

const formatUserPerson = (val) => {
  if (!val) return "-";
  if (typeof val === "string") return val.trim() || "-";
  if (typeof val === "object") {
    return val.name || val.userName || val.fullName || val.email || "-";
  }
  return String(val);
};

export default function PatientPhysiotherapySection({
  patient,
  patientId,
}) {
  const isReferral = isReferralUser() || isInsuranceUser();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);

  // Modals
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [editCaseModalOpen, setEditCaseModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const effectiveId =
    patientId ||
    patient?.patientId ||
    patient?.patient_id ||
    patient?._id;

  useEffect(() => {
    if (effectiveId) {
      loadPhysioHistory();
    }
  }, [effectiveId]);

  const loadPhysioHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchPhysiotherapyByPatient(effectiveId);
      const list = Array.isArray(data) ? data : data?.data || [];
      setCases(list);
    } catch (err) {
      console.error("Error loading patient physio history:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentCase = cases[activeCaseIndex] || cases[0] || null;

  const handleStatusChange = async (newStatus) => {
    if (isReferral) return;
    if (!currentCase?._id || newStatus === currentCase.status) return;
    setUpdatingStatus(true);
    try {
      await updatePhysiotherapyStatus(currentCase._id, newStatus);
      Swal.fire({
        title: "Status Updated",
        text: `Physiotherapy status changed to ${newStatus}`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      loadPhysioHistory();
    } catch (err) {
      Swal.fire("Error", typeof err === "string" ? err : "Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const completed = currentCase?.completedSessions || 0;
  const prescribed = currentCase?.prescribedSessions || 1;
  const percent = Math.min(100, Math.round((completed / prescribed) * 100));

  return (
    <div className="row gx-3 gy-3">
      {/* Top Banner & Refer Button */}
      <div className="col-12">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 bg-light rounded border">
          <div>
            <h5 className="mb-1 text-dark fw-bold" style={{ fontSize: "16px" }}>
              <i className="fa-solid fa-heartbeat text-danger me-2" />
              Patient Physiotherapy & Rehabilitation
            </h5>
            <p className="text-muted small mb-0">
              Track prescribed physiotherapy sessions, exercise compliance, modalities, and pain reduction.
            </p>
          </div>
          {!isReferral && (
          <button
            type="button"
            className="btn btn-primary btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm"
            style={{
              backgroundColor: "#0284c7",
              borderColor: "#0284c7",
              borderRadius: "6px",
              padding: "7px 16px",
              fontSize: "13px",
            }}
            onClick={() => setReferralModalOpen(true)}
          >
            <i className="fa fa-plus" /> New Referral
          </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="col-12 text-center py-5">
          <i className="fa fa-spinner fa-spin fa-2x text-primary mb-2" />
          <p className="text-muted">Loading physiotherapy records...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="col-12">
          <div className="text-center py-5 border rounded bg-white">
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#fef2f2",
                color: "#ef4444",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                marginBottom: "12px",
              }}
            >
              <i className="fa fa-heartbeat" />
            </div>
            <h6 className="fw-bold text-dark">No Physiotherapy Case for this Patient</h6>
            <p className="small text-muted mb-3" style={{ maxWidth: "450px", margin: "0 auto" }}>
              The patient does not currently have any active physiotherapy referral. Click below to create a referral with prescribed sessions and clinical goals.
            </p>
            {!isReferral && (
            <button
              type="button"
              className="btn btn-primary btn-sm px-4"
              onClick={() => setReferralModalOpen(true)}
            >
              <i className="fa fa-plus me-1" /> Refer to Physiotherapy
            </button>
            )}
          </div>
        </div>
      ) : (
        <div className="col-12">
          {/* Case Selector (if patient has multiple referrals) */}
          {cases.length > 1 && (
            <div className="d-flex gap-2 mb-3 overflow-auto pb-1">
              {cases.map((c, idx) => (
                <button
                  key={c._id || idx}
                  type="button"
                  className={`btn btn-sm ${
                    activeCaseIndex === idx ? "btn-primary fw-bold" : "btn-outline-secondary"
                  }`}
                  onClick={() => setActiveCaseIndex(idx)}
                >
                  Case #{idx + 1}: {typeof c.category === "object" ? c.category?.name || "Rehab" : c.category || "Rehab"} ({typeof c.status === "object" ? c.status?.name || "Active" : c.status})
                </button>
              ))}
            </div>
          )}

          {/* Active Case Card */}
          <div className="card border mb-3 shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2 py-3">
              <div>
                <h6 className="mb-1 fw-bold text-primary" style={{ fontSize: "15px" }}>
                  {typeof currentCase.clinicalDiagnosis === "object" ? currentCase.clinicalDiagnosis?.name || "Physiotherapy Rehabilitation" : currentCase.clinicalDiagnosis || "Physiotherapy Rehabilitation"}
                </h6>
                <div className="d-flex flex-wrap gap-2 align-items-center small text-muted">
                  <span className="badge bg-light text-dark border">
                    {typeof currentCase.category === "object" ? currentCase.category?.name || "General" : currentCase.category || "General"}
                  </span>
                  <span>• Priority: <strong>{typeof currentCase.priority === "object" ? currentCase.priority?.name || "Normal" : currentCase.priority || "Normal"}</strong></span>
                  <span>• Target Area: <strong>{typeof currentCase.affectedBodyPart === "object" ? currentCase.affectedBodyPart?.name || "General" : currentCase.affectedBodyPart || "General"}</strong></span>
                  {currentCase.assignedPhysiotherapist && (
                    <span>• Therapist: <strong>{formatUserPerson(currentCase.assignedPhysiotherapist)}</strong></span>
                  )}
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  style={isReferral ? { width: "auto", fontSize: "12px", fontWeight: 600, cursor: "not-allowed", opacity: 0.85 } : { width: "auto", fontSize: "12px", fontWeight: 600 }}
                  value={currentCase.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus || isReferral}
                >
                  {PHYSIO_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                {!isReferral && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm d-flex align-items-center gap-1 fw-bold px-3"
                      style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
                      onClick={() => setEditCaseModalOpen(true)}
                    >
                      <i className="fa fa-pencil" /> Edit Case
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-sm d-flex align-items-center gap-1 fw-bold px-3"
                      onClick={() => {
                        setEditingSession(null);
                        setSessionModalOpen(true);
                      }}
                    >
                      <i className="fa fa-plus-circle" /> Log Session
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="card-body p-3">
              {/* Progress and Objectives */}
              <div className="row g-3 mb-3">
                <div className="col-md-6 border-end">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small fw-semibold text-dark">
                      Session Completion Progress
                    </span>
                    <span className="badge bg-primary">
                      {completed} of {prescribed} Sessions ({percent}%)
                    </span>
                  </div>
                  <div className="progress mb-2" style={{ height: "9px" }}>
                    <div
                      className="progress-bar bg-success progress-bar-striped"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <small className="text-muted d-block">
                    Frequency: <strong>{typeof currentCase.sessionFrequency === "object" ? currentCase.sessionFrequency?.name || "As scheduled" : currentCase.sessionFrequency || "As scheduled"}</strong>
                  </small>
                </div>

                <div className="col-md-6 ps-md-4">
                  <div className="small">
                    <strong>Treatment Goals:</strong>
                    <p className="text-muted mb-1">
                      {typeof currentCase.treatmentGoals === "object" ? currentCase.treatmentGoals?.goals || currentCase.treatmentGoals?.name || "Functional recovery and pain-free mobility" : currentCase.treatmentGoals || "Functional recovery and pain-free mobility"}
                    </p>
                    {currentCase.specialInstructions && (
                      <p className="text-danger mb-1">
                        <i className="fa fa-info-circle me-1" />
                        <strong>Precautions:</strong> {typeof currentCase.specialInstructions === "object" ? currentCase.specialInstructions?.instructions || currentCase.specialInstructions?.name || "-" : currentCase.specialInstructions}
                      </p>
                    )}
                    <div className="mb-0">
                      <strong>Therapy / Modalities:</strong>
                      {Array.isArray(currentCase.modalitiesUsed) && currentCase.modalitiesUsed.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {currentCase.modalitiesUsed.map((m, i) => (
                            <span key={i} className="badge bg-info text-white" style={{ fontSize: "10px" }}>
                              {typeof m === "string" ? m : m?.name || String(m)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted"> None selected</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sessions Table */}
              <h6 className="fw-bold text-dark mt-4 mb-2 d-flex align-items-center gap-2">
                <i className="fa fa-calendar-check-o text-success" />
                Session History ({currentCase.sessions?.length || 0})
              </h6>

              {!currentCase.sessions || currentCase.sessions.length === 0 ? (
                <div className="text-center py-4 bg-light rounded border">
                  <p className="small text-muted mb-2">No sessions logged yet for this case.</p>
                  {!isReferral && (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm"
                    onClick={() => setSessionModalOpen(true)}
                  >
                    <i className="fa fa-plus me-1" /> Log First Session
                  </button>
                  )}
                </div>
              ) : (
                <div className="table-responsive border rounded">
                  <table className="table table-hover mb-0" style={{ fontSize: "12.5px" }}>
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Conducted By</th>
                        <th>Exercises</th>
                        <th>Modalities</th>
                        <th>Pain Level (VAS)</th>
                        <th>Mobility Status</th>
                        <th>Remarks</th>
                        {!isReferral && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentCase.sessions.map((sess, idx) => (
                        <tr key={sess._id || idx}>
                          <td className="fw-bold text-primary">#{sess.sessionNumber || idx + 1}</td>
                          <td className="text-nowrap">
                            {sess.sessionDate
                              ? new Date(sess.sessionDate).toLocaleDateString("en-GB")
                              : "-"}
                          </td>
                          <td>{formatUserPerson(sess.conductedBy)}</td>
                          <td>
                            {(() => {
                              const exList =
                                Array.isArray(sess.exercisesPerformed) && sess.exercisesPerformed.length > 0
                                  ? sess.exercisesPerformed
                                  : Array.isArray(sess.exercises) && sess.exercises.length > 0
                                  ? sess.exercises
                                  : [];
                              if (exList.length === 0 && !sess.exerciseNotes) return "-";
                              return (
                                <div>
                                  {exList.length > 0 && (
                                  <div className="d-flex flex-wrap gap-1">
                                  {exList.map((ex, i) => {
                                    const label =
                                      typeof ex === "string"
                                        ? ex
                                        : ex?.exerciseName || ex?.name
                                        ? `${ex.exerciseName || ex.name} (${ex.sets || 3}x${ex.repetitions || ex.reps || 10}${
                                            ex.hold || ex.holdTimeSeconds
                                              ? ` hold ${ex.hold || `${ex.holdTimeSeconds}s`}`
                                              : ""
                                          })${ex.notes ? ` — ${ex.notes}` : ""}`
                                        : "-";
                                    return (
                                      <span key={i} className="badge bg-light text-dark border">
                                        {label}
                                      </span>
                                    );
                                  })}
                                  </div>
                                  )}
                                  {sess.exerciseNotes ? (
                                    <div className="text-muted mt-1" style={{ fontSize: "11px" }}>
                                      Notes: {sess.exerciseNotes}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            {Array.isArray(sess.modalitiesUsed) && sess.modalitiesUsed.length > 0 ? (
                              <div className="d-flex flex-wrap gap-1">
                                {sess.modalitiesUsed.map((m, i) => (
                                  <span key={i} className="badge bg-info text-white" style={{ fontSize: "10px" }}>
                                    {typeof m === "string" ? m : m?.name || String(m)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="text-nowrap">
                            <span className="badge bg-light text-muted border me-1">
                              Before: {typeof sess.painLevelBefore === "object" ? "-" : (sess.painLevelBefore ?? "-")}
                            </span>
                            <span className="badge bg-success">
                              After: {typeof sess.painLevelAfter === "object" ? "-" : (sess.painLevelAfter ?? "-")}
                            </span>
                          </td>
                          <td>
                            {typeof sess.mobilityStatus === "object"
                              ? sess.mobilityStatus?.status || sess.mobilityStatus?.mobilityScore || "-"
                              : sess.mobilityStatus || "-"}
                          </td>
                          <td style={{ maxWidth: "200px" }}>
                            {typeof sess.progressRemarks === "object"
                              ? sess.progressRemarks?.notes || sess.progressRemarks?.remark || "-"
                              : sess.progressRemarks || "-"}
                          </td>
                          {!isReferral && (
                          <td>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm py-0 px-2 d-flex align-items-center gap-1"
                              style={{ fontSize: "11px", borderRadius: "5px" }}
                              onClick={() => {
                                setEditingSession(sess);
                                setSessionModalOpen(true);
                              }}
                              title="Edit Session"
                            >
                              <i className="fa fa-pencil" /> Edit
                            </button>
                          </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Log / Edit Session Modal */}
      <SessionModal
        open={sessionModalOpen}
        onClose={() => {
          setSessionModalOpen(false);
          setEditingSession(null);
        }}
        physioCase={currentCase}
        editingSession={editingSession}
        onSuccess={loadPhysioHistory}
      />

      {/* Create Referral Modal */}
      <ReferralModal
        open={referralModalOpen}
        onClose={() => setReferralModalOpen(false)}
        prefilledPatient={patient}
        onSuccess={loadPhysioHistory}
      />

      {/* Edit Case Modal */}
      <ReferralModal
        open={editCaseModalOpen}
        onClose={() => setEditCaseModalOpen(false)}
        editCase={currentCase}
        onSuccess={loadPhysioHistory}
      />
    </div>
  );
}
