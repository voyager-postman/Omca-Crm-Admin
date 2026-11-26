import React from "react";
import Dialog from "@mui/material/Dialog";
import { imageUrl } from "../../../Basurl/Baseurl";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

export default function PreIntimationViewModal({
  open,
  onClose,
  onResend,
  preIntimationData,
  hospitalItem,
  treatmentPlan,
}) {
  if (!open) return null;

  const data = preIntimationData || hospitalItem?.preIntimation || treatmentPlan?.preIntimation || {};

  const getFileUrl = (doc) => {
    if (!doc) return "";
    const filePath = typeof doc === "string" ? doc : doc?.file || doc?.fileName || doc?.url || "";
    if (!filePath) return "";
    if (filePath.startsWith("http")) return filePath;
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    return `${imageUrl}${cleanPath}`;
  };

  const attendants = Array.isArray(data?.attendants)
    ? data.attendants
    : typeof data?.attendants === "string"
    ? (() => {
        try {
          return JSON.parse(data.attendants);
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className="pre-intimation-view-dialog"
      PaperProps={{
        style: {
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* Sticky Header */}
      <div
        style={{
          backgroundColor: "#0369a1",
          color: "#ffffff",
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-envelope-open-text fs-5"></i>
          <div>
            <h5 className="mb-0 text-white fw-bold" style={{ fontSize: "16px" }}>
              Pre-Intimation Letter Details
            </h5>
            <small style={{ color: "#bae6fd", fontSize: "12px" }}>
              Hospital: <b>{hospitalItem?.name || data?.hospitalName || hospitalItem?.hospital?.name || "Hospital"}</b>
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "14px",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px",
          background: "#ffffff",
        }}
      >
        {/* Header Summary */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="p-3 bg-light rounded border">
              <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: "11px" }}>
                Doctor Name
              </small>
              <span className="fw-semibold text-dark">
                {data?.doctorName || data?.doctor_name || "N/A"}
              </span>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 bg-light rounded border">
              <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: "11px" }}>
                Appointment Date
              </small>
              <span className="fw-semibold text-dark">
                {data?.appointmentDate || data?.appointment_date
                  ? new Date(data?.appointmentDate || data?.appointment_date).toLocaleDateString("en-GB")
                  : "N/A"}
              </span>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 bg-light rounded border">
              <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: "11px" }}>
                Hospital City
              </small>
              <span className="fw-semibold text-dark">
                {data?.hospitalCity || data?.hospital_city || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {(data?.hospitalEmail || data?.hospital_email) && (
          <div className="mb-3 p-2.5 px-3 bg-light rounded border d-flex align-items-center gap-2">
            <i className="fa-solid fa-envelope text-primary"></i>
            <div>
              <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: "11px" }}>
                Recipient Hospital Email(s)
              </small>
              <span className="fw-semibold text-dark" style={{ fontSize: "12.5px" }}>
                {data?.hospitalEmail || data?.hospital_email}
              </span>
            </div>
          </div>
        )}

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="p-3 bg-light rounded border">
              <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: "11px" }}>
                Treatment Course
              </small>
              <span className="fw-semibold text-dark">
                {data?.treatmentCourse || data?.treatment_course || treatmentPlan?.treatment?.name || "N/A"}
              </span>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 bg-light rounded border">
              <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: "11px" }}>
                Patient Passport
              </small>
              <span className="fw-semibold text-dark">
                {data?.patientPassport || data?.patient_passport || "N/A"}
              </span>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 bg-light rounded border">
              <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: "11px" }}>
                Sent Date
              </small>
              <span className="fw-semibold text-dark">
                {data?.sentAt || data?.createdAt
                  ? new Date(data.sentAt || data.createdAt).toLocaleString("en-GB")
                  : "Recently Sent"}
              </span>
            </div>
          </div>
        </div>

        {/* Accompanying Attendants */}
        <div className="mb-3">
          <h6 className="fw-bold mb-2 text-dark" style={{ fontSize: "13px" }}>
            <i className="fa-solid fa-users me-2 text-primary"></i>
            Accompanying Attendants ({attendants.length})
          </h6>
          {attendants.length === 0 ? (
            <p className="text-muted small mb-0">No accompanying attendants specified.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-bordered mb-0" style={{ fontSize: "12.5px" }}>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Relationship</th>
                    <th>Passport Number</th>
                  </tr>
                </thead>
                <tbody>
                  {attendants.map((att, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td className="fw-semibold">{att.name || att.fullname || "-"}</td>
                      <td>{att.relation || "-"}</td>
                      <td>{att.passportNumber || att.passport_num || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attached Passport Documents */}
        {(data?.patientPassportFile ||
          data?.passportAttachments?.length > 0 ||
          data?.attachments?.length > 0) && (
          <div className="mb-3">
            <h6 className="fw-bold mb-2 text-dark" style={{ fontSize: "13px" }}>
              <i className="fa-solid fa-paperclip me-2 text-primary"></i>
              Attached Passport Documents
            </h6>
            <div className="d-flex flex-wrap gap-2">
              {data?.patientPassportFile && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => window.open(getFileUrl(data.patientPassportFile), "_blank")}
                >
                  <i className="fa-solid fa-file-pdf me-1 text-danger"></i> Patient Passport Copy
                </button>
              )}
              {(data?.passportAttachments || data?.attachments || []).map((file, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => window.open(getFileUrl(file), "_blank")}
                >
                  <i className="fa-solid fa-file me-1"></i> Attachment {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {data?.notes && (
          <div>
            <h6 className="fw-bold mb-1 text-dark" style={{ fontSize: "13px" }}>
              Notes / Instructions
            </h6>
            <p className="small text-muted mb-0 p-2 bg-light rounded border">{data.notes}</p>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div
        style={{
          padding: "14px 22px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <button type="button" className="btn btn-sm btn-secondary px-3 py-2 fw-semibold" onClick={onClose}>
          Close
        </button>
        {onResend && !isReferralUser() && !isInsuranceUser() && (
          <button
            type="button"
            className="btn btn-sm btn-primary px-3 py-2 fw-bold shadow-sm"
            style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
            onClick={() => {
              onClose();
              onResend();
            }}
          >
            <i className="fa-solid fa-paper-plane me-1"></i> Resend Pre-Intimation
          </button>
        )}
      </div>
    </Dialog>
  );
}
