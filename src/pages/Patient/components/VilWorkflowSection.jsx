import React from "react";
import { imageUrl, resolveCrmImageUrl } from "../../../Basurl/Baseurl";
import StinkerBadges from "../../../components/TreatmentPlan/StinkerBadges";
import { formatVilStatusWithStinker } from "../../../utils/stinker";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

export default function VilWorkflowSection({
  treatmentPlan,
  hospitalItem,
  onSendPreIntimation,
  onViewPreIntimation,
  onUploadVil,
  onApproveVil,
  onRejectVil,
  onCreateTreatment,
  onViewTreatment,
}) {
  const isReferral = isReferralUser() || isInsuranceUser();
  const isTreatmentActive =
    hospitalItem?.isTreatmentActive === true ||
    hospitalItem?.isTreatmentActive === "true" ||
    hospitalItem?.isTreatmentActive === 1 ||
    hospitalItem?.isTreatmentActive === "1" ||
    treatmentPlan?.isTreatmentActive === true ||
    treatmentPlan?.isTreatmentActive === "true" ||
    treatmentPlan?.isTreatmentActive === 1 ||
    treatmentPlan?.isTreatmentActive === "1" ||
    hospitalItem?.is_treatment_active === true ||
    hospitalItem?.is_treatment_active === "true" ||
    treatmentPlan?.is_treatment_active === true ||
    treatmentPlan?.is_treatment_active === "true" ||
    hospitalItem?.treatmentActive === true ||
    hospitalItem?.treatmentActive === "true" ||
    treatmentPlan?.treatmentActive === true ||
    treatmentPlan?.treatmentActive === "true" ||
    hospitalItem?.treatmentCreated === true ||
    hospitalItem?.treatmentCreated === "true" ||
    treatmentPlan?.treatmentCreated === true ||
    treatmentPlan?.treatmentCreated === "true" ||
    Boolean(hospitalItem?.treatmentId) ||
    Boolean(treatmentPlan?.treatmentId);

  if (!hospitalItem || (hospitalItem.status !== "Approved" && !treatmentPlan?.isAnyHospitalApproved) || isTreatmentActive) {
    return null;
  }

  // Resolve VIL status
  const vilStatus = hospitalItem?.vilStatus || treatmentPlan?.vilStatus || "";
  const preIntimation = hospitalItem?.preIntimation || treatmentPlan?.preIntimation || null;

  // Resolve VIL documents - gather and deduplicate by documentName to show the latest active document
  const rawVilDocs = [
    ...(Array.isArray(hospitalItem?.vilDocuments) ? hospitalItem.vilDocuments : []),
    ...(hospitalItem?.vilDocument ? [hospitalItem.vilDocument] : []),
    ...(Array.isArray(treatmentPlan?.vilDocuments) ? treatmentPlan.vilDocuments : []),
    ...(treatmentPlan?.vilDocument ? [treatmentPlan.vilDocument] : []),
  ].filter(Boolean);

  const vilDocs = (() => {
    if (rawVilDocs.length === 0) return [];

    const docMap = new Map();

    rawVilDocs.forEach((doc, idx) => {
      const docObj = typeof doc === "string" ? { file: doc } : { ...doc };
      const name = docObj.documentName || docObj.name || "Visa Invitation Letter (VIL)";
      const fileUrl = docObj.file || docObj.fileName || docObj.url || "";
      const dateVal = new Date(docObj.uploadedAt || docObj.createdAt || 0).getTime();

      if (!docMap.has(name)) {
        docMap.set(name, {
          ...docObj,
          _id: docObj._id || `vil-${idx}`,
          documentName: name,
          hospitalName: docObj.hospitalName || hospitalItem?.name || "-",
          status: docObj.status || vilStatus || "Pending",
          uploadedAt: docObj.uploadedAt || docObj.createdAt || hospitalItem?.vilUploadedAt,
          notes: docObj.notes || docObj.uploadNotes || hospitalItem?.vilNotes || "-",
          file: fileUrl,
          _dateVal: dateVal,
        });
      } else {
        const existing = docMap.get(name);
        if (dateVal >= existing._dateVal || (!existing.file && fileUrl)) {
          docMap.set(name, {
            ...existing,
            ...docObj,
            documentName: name,
            hospitalName: docObj.hospitalName || hospitalItem?.name || existing.hospitalName || "-",
            status: docObj.status || vilStatus || existing.status || "Pending",
            uploadedAt: docObj.uploadedAt || docObj.createdAt || existing.uploadedAt,
            notes: docObj.notes || docObj.uploadNotes || existing.notes,
            file: fileUrl || existing.file,
            _dateVal: Math.max(dateVal, existing._dateVal),
          });
        }
      }
    });

    return Array.from(docMap.values());
  })();

  const hasVilDoc = vilDocs.length > 0;
  const isVilPending = vilStatus === "Pending";
  const isVilApproved = vilStatus === "Approved";
  const isVilRejected = vilStatus === "Rejected";

  // Check if pre-intimation was actually dispatched (not just an empty subdocument {} from Mongoose)
  const hasPreIntimationData = Boolean(
    preIntimation &&
    typeof preIntimation === "object" &&
    (preIntimation.sentAt ||
      preIntimation.sentBy ||
      (typeof preIntimation.doctorName === "string" && preIntimation.doctorName.trim() !== "") ||
      (typeof preIntimation.doctor_name === "string" && preIntimation.doctor_name.trim() !== "") ||
      preIntimation.appointmentDate ||
      preIntimation.appointment_date ||
      preIntimation.isSent === true ||
      preIntimation.sent === true ||
      preIntimation.status === "Sent")
  );

  const isPreIntimationSent =
    isVilPending ||
    isVilApproved ||
    isVilRejected ||
    hasVilDoc ||
    hasPreIntimationData;

  // Resolve Treatment Creation status
  const treatmentCreated =
    hospitalItem?.treatmentCreated === true ||
    treatmentPlan?.treatmentCreated === true ||
    !!hospitalItem?.treatmentId ||
    !!treatmentPlan?.treatmentId;
  const treatmentId = hospitalItem?.treatmentId || treatmentPlan?.treatmentId || "";

  // Resolve VIL approval images
  const vilApprovalImages = [
    ...(Array.isArray(hospitalItem?.vilApprovalImages) ? hospitalItem.vilApprovalImages : []),
    ...(Array.isArray(treatmentPlan?.vilApprovalImages) ? treatmentPlan.vilApprovalImages : []),
  ].filter(Boolean);

  const statusHistory = Array.isArray(hospitalItem?.statusHistory) ? hospitalItem.statusHistory : [];
  const historyApprovalImages = [];
  statusHistory.forEach((sh) => {
    if (Array.isArray(sh.documents)) {
      sh.documents.forEach((doc) => {
        if (doc.documentName === "VIL Approval Image" || doc.type === "vilApprovalImage") {
          historyApprovalImages.push(doc);
        }
      });
    }
  });

  const allApprovalImages = [...vilApprovalImages, ...historyApprovalImages].filter(
    (img, index, self) =>
      index ===
      self.findIndex(
        (t) =>
          (t.fileName && t.fileName === img.fileName) ||
          (t.file && t.file === img.file)
      )
  );

  const getDocUrl = (doc) => {
    if (!doc) return "";
    const filePath = typeof doc === "string" ? doc : doc?.file || doc?.fileName || doc?.url || "";
    if (!filePath) return "";
    return resolveCrmImageUrl(filePath);
  };

  return (
    <div className="vil-workflow-card">
      {/* Card Header */}
      <div className="vil-workflow-header">
        <h6 className="vil-workflow-title">
          <i className="fa-solid fa-passport text-primary"></i>
          Pre-Intimation & Visa Invitation Letter (VIL) Workflow
        </h6>
        <div>
          {treatmentCreated ? (
            <span className="status-badge treatment-created">
              <i className="fa-solid fa-circle-check me-1"></i>
              Treatment Created ({treatmentId})
            </span>
          ) : isVilApproved ? (
            <span className="status-badge vil-approved">
              <i className="fa-solid fa-circle-check me-1"></i>
              VIL Approved
            </span>
          ) : isVilRejected ? (
            <span className="status-badge vil-rejected">
              <i className="fa-solid fa-circle-xmark me-1"></i>
              VIL Rejected
            </span>
          ) : isVilPending ? (
            <span className="status-badge vil-pending">
              <i className="fa-solid fa-clock me-1"></i>
              VIL Pending Review
            </span>
          ) : isPreIntimationSent ? (
            <span className="status-badge pre-intimation">
              <i className="fa-solid fa-paper-plane me-1"></i>
              Pre-Intimation Sent
            </span>
          ) : (
            <span className="status-badge awaiting">
              <i className="fa-solid fa-hourglass-start me-1"></i>
              Pre-Intimation Pending
            </span>
          )}
        </div>
      </div>

      {/* 5-Step Workflow Stepper */}
      <div className="vil-stepper">
        {/* Step 1: Treatment Plan Approved */}
        <div className="vil-step completed">
          <div className="vil-step-icon">
            <i className="fa-solid fa-check"></i>
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "11px" }}>Step 1</div>
            <div>Plan Approved</div>
          </div>
        </div>

        <div className="vil-step-arrow d-none d-md-block">
          <i className="fa-solid fa-angle-right"></i>
        </div>

        {/* Step 2: Pre-Intimation Letter */}
        <div
          className={`vil-step ${isPreIntimationSent ? "completed" : "active"
            }`}
        >
          <div className="vil-step-icon">
            {isPreIntimationSent ? (
              <i className="fa-solid fa-check"></i>
            ) : (
              <i className="fa-solid fa-paper-plane"></i>
            )}
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "11px" }}>Step 2</div>
            <div>Pre-Intimation</div>
          </div>
        </div>

        <div className="vil-step-arrow d-none d-md-block">
          <i className="fa-solid fa-angle-right"></i>
        </div>

        {/* Step 3: Hospital Uploads VIL */}
        <div
          className={`vil-step ${hasVilDoc || isVilPending || isVilApproved || isVilRejected
            ? isVilRejected
              ? "rejected"
              : "completed"
            : isPreIntimationSent
              ? "active"
              : ""
            }`}
        >
          <div className="vil-step-icon">
            {hasVilDoc || isVilApproved ? (
              <i className="fa-solid fa-check"></i>
            ) : isVilRejected ? (
              <i className="fa-solid fa-xmark"></i>
            ) : (
              <i className="fa-solid fa-file-arrow-up"></i>
            )}
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "11px" }}>Step 3</div>
            <div>VIL Upload</div>
          </div>
        </div>

        <div className="vil-step-arrow d-none d-md-block">
          <i className="fa-solid fa-angle-right"></i>
        </div>

        {/* Step 4: CRM VIL Review */}
        <div
          className={`vil-step ${isVilApproved
            ? "completed"
            : isVilRejected
              ? "rejected"
              : isVilPending
                ? "active"
                : ""
            }`}
        >
          <div className="vil-step-icon">
            {isVilApproved ? (
              <i className="fa-solid fa-check"></i>
            ) : isVilRejected ? (
              <i className="fa-solid fa-xmark"></i>
            ) : (
              <i className="fa-solid fa-magnifying-glass"></i>
            )}
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "11px" }}>Step 4</div>
            <div>VIL Review</div>
          </div>
        </div>

        <div className="vil-step-arrow d-none d-md-block">
          <i className="fa-solid fa-angle-right"></i>
        </div>

        {/* Step 5: Treatment Creation */}
        <div
          className={`vil-step ${treatmentCreated
            ? "completed"
            : isVilApproved
              ? "active"
              : ""
            }`}
        >
          <div className="vil-step-icon">
            {treatmentCreated ? (
              <i className="fa-solid fa-check-double"></i>
            ) : (
              <i className="fa-solid fa-kit-medical"></i>
            )}
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "11px" }}>Step 5</div>
            <div>Create Treatment</div>
          </div>
        </div>
      </div>

      {/* Stage Details and Actions Box */}
      <div className="vil-details-box">
        {/* If Treatment is already created */}
        {treatmentCreated ? (
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h6 className="text-success fw-bold mb-1" style={{ fontSize: "14px" }}>
                <i className="fa-solid fa-circle-check me-2"></i>
                Treatment Record Created: <b>{treatmentId}</b>
              </h6>
              <p className="text-muted small mb-0">
                This treatment has been generated and assigned to <b>{hospitalItem?.name}</b> in Treatment Model.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary px-3 py-1 shadow-sm"
              onClick={onViewTreatment}
            >
              <i className="fa-solid fa-arrow-right me-1"></i> View in Treatment Tab
            </button>
          </div>
        ) : isVilApproved ? (
          /* Step 5 Action: VIL Approved -> Ready to Create Treatment */
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h6 className="text-success fw-bold mb-1" style={{ fontSize: "14px" }}>
                <i className="fa-solid fa-circle-check me-2"></i>
                Visa Invitation Letter (VIL) Approved!
              </h6>
              <p className="text-muted small mb-0">
                The VIL has been approved. You can now create the official treatment record for this patient.
              </p>
              {hospitalItem?.vilApprovalNotes && (
                <small className="text-success d-block mt-1">
                  Approval Notes: {hospitalItem.vilApprovalNotes}
                </small>
              )}
              {allApprovalImages.length > 0 && (
                <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#dcfce7",
                      color: "#15803d",
                      border: "1px solid #bbf7d0",
                      fontSize: "11px",
                      padding: "4px 8px",
                    }}
                  >
                    <i className="fa-solid fa-images me-1"></i>
                    {allApprovalImages.length} Approval Image{allApprovalImages.length > 1 ? "s" : ""}
                  </span>
                  {allApprovalImages.map((img, iIdx) => {
                    const imgUrl = getDocUrl(img);
                    return (
                      <a
                        key={iIdx}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="d-inline-flex align-items-center gap-1 badge bg-light text-dark border text-decoration-none"
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                        title={`View ${img.originalName || img.fileName || "Approval Image"}`}
                      >
                        <i className="fa-solid fa-image text-primary"></i>
                        <span>{img.originalName || `Image ${iIdx + 1}`}</span>
                        <i
                          className="fa-solid fa-arrow-up-right-from-square ms-1"
                          style={{ fontSize: "9px", opacity: 0.7 }}
                        ></i>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              {hasVilDoc && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => window.open(getDocUrl(vilDocs[vilDocs.length - 1]), "_blank")}
                >
                  <i className="fa-solid fa-file-pdf text-danger me-1"></i> View VIL
                </button>
              )}
              {!isReferral && (
                <button
                  type="button"
                  className="btn btn-sm btn-success px-3 py-2 fw-bold shadow-sm"
                  onClick={onCreateTreatment}
                  style={{ backgroundColor: "#16a34a", borderColor: "#16a34a", fontSize: "13px" }}
                >
                  <i className="fa-solid fa-plus-circle me-1"></i> Create Treatment (Tx-XXXXX)
                </button>
              )}
            </div>
          </div>
        ) : isVilPending || (hasVilDoc && !isVilApproved && !isVilRejected) ? (
          /* Step 4 Action: VIL Uploaded -> Awaiting CRM Review (upload disabled until rejected) */
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h6 className="text-warning fw-bold mb-1" style={{ fontSize: "14px" }}>
                <i className="fa-solid fa-clock me-2"></i>
                {formatVilStatusWithStinker(
                  "VIL Uploaded - Pending CRM Review",
                  hospitalItem,
                  treatmentPlan,
                )}
              </h6>
              <StinkerBadges
                hospital={hospitalItem}
                plan={treatmentPlan}
                variant="both"
              />
              <p className="text-muted small mb-0">
                The hospital or CRM has submitted the Visa Invitation Letter document. Please review and Approve or Reject. Upload is disabled until the VIL is rejected.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {hasVilDoc && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => window.open(getDocUrl(vilDocs[vilDocs.length - 1]), "_blank")}
                >
                  <i className="fa-solid fa-eye me-1"></i> View VIL Document
                </button>
              )}
              {!isReferral && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-success px-3"
                    onClick={onApproveVil}
                    style={{ backgroundColor: "#16a34a", borderColor: "#16a34a" }}
                  >
                    <i className="fa-solid fa-check me-1"></i> Approve VIL
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger px-3"
                    onClick={onRejectVil}
                  >
                    <i className="fa-solid fa-xmark me-1"></i> Reject VIL
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled
                    title="Upload is disabled while VIL is under review. Resubmit becomes available only after rejection."
                  >
                    <i className="fa-solid fa-ban me-1"></i> Upload Disabled
                  </button>
                </>
              )}
            </div>
          </div>
        ) : isVilRejected ? (
          /* Step 4: VIL Rejected -> Resubmit required (same pattern as Treatment Plan) */
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h6 className="text-danger fw-bold mb-1" style={{ fontSize: "14px" }}>
                <i className="fa-solid fa-circle-xmark me-2"></i>
                Visa Invitation Letter (VIL) Rejected
              </h6>
              <p className="text-muted small mb-0">
                Rejection Reason:{" "}
                <span className="text-danger fw-semibold">
                  {hospitalItem?.vilRejectionNotes || treatmentPlan?.vilRejectionNotes || "Document rejected by CRM"}
                </span>
                . Please resubmit a revised VIL document.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2">
              {hasVilDoc && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => window.open(getDocUrl(vilDocs[vilDocs.length - 1]), "_blank")}
                >
                  <i className="fa-solid fa-eye me-1"></i> View Rejected VIL
                </button>
              )}
              {!isReferral && (
                <button
                  type="button"
                  className="btn btn-sm btn-warning fw-semibold px-3 text-dark shadow-sm"
                  onClick={onUploadVil}
                >
                  <i className="fa-solid fa-upload me-1"></i> Resubmit VIL
                </button>
              )}
            </div>
          </div>
        ) : isPreIntimationSent ? (
          /* Step 3: Pre-Intimation Sent -> Awaiting VIL upload */
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h6 className="text-primary fw-bold mb-1" style={{ fontSize: "14px" }}>
                <i className="fa-solid fa-envelope-circle-check me-2"></i>
                Pre-Intimation Letter Dispatched to Hospital
              </h6>
              <p className="text-muted small mb-0">
                Awaiting Visa Invitation Letter (VIL) from <b>{hospitalItem?.name}</b>. If received directly via email, CRM can upload it here.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-sm btn-outline-info"
                onClick={onViewPreIntimation}
              >
                <i className="fa-solid fa-circle-info me-1"></i> Pre-Intimation Details
              </button>
              {!isReferral && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={onSendPreIntimation}
                  >
                    <i className="fa-solid fa-paper-plane me-1"></i> Resend Email
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary px-3 shadow-sm"
                    onClick={onUploadVil}
                    style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
                  >
                    <i className="fa-solid fa-upload me-1"></i> Upload VIL Document
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Treatment Plan Approved -> Need to Send Pre-Intimation Letter */
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h6 className="fw-bold mb-1 text-dark" style={{ fontSize: "14px" }}>
                <i className="fa-solid fa-paper-plane me-2 text-primary"></i>
                Next Step: Send Pre-Intimation Letter
              </h6>
              <p className="text-muted small mb-0">
                Send the official Pre-Intimation email with doctor name, appointment date, and passport copies to <b>{hospitalItem?.name}</b>.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {!isReferral && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary px-3 py-1 shadow-sm"
                    onClick={onSendPreIntimation}
                    style={{ backgroundColor: "#0284c7", borderColor: "#0284c7" }}
                  >
                    <i className="fa-solid fa-paper-plane me-1"></i> Send Pre-Intimation Letter
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={onUploadVil}
                  >
                    <i className="fa-solid fa-upload me-1"></i> Upload VIL Directly
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* VIL Documents List Table (if documents exist) */}
        {hasVilDoc && (
          <div className="mt-3 pt-3 border-top">
            <div className="paymntdata">
              <h6>
                <i className="fa fa-file-pdf text-danger me-2"></i>
                Visa Invitation Letter (VIL) Documents
              </h6>
              <div className="table-responsive">
                <table className="table table-no-card mb-0">
                  <thead>
                    <tr>
                      <th>Sr.No.</th>
                      <th>Hospital</th>
                      <th>Name</th>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vilDocs.map((doc, index) => {
                      const docStatus = doc?.status || vilStatus || "Pending";
                      const isApproved = docStatus === "Approved";
                      const isRejected = docStatus === "Rejected";
                      const fullUrl = getDocUrl(doc);

                      return (
                        <tr key={doc?._id || index}>
                          <td>{index + 1}</td>
                          <td>{doc?.hospitalName || hospitalItem?.name || "-"}</td>
                          <td>{doc?.documentName || "Visa Invitation Letter (VIL)"}</td>
                          <td>
                            <button
                              type="button"
                              className="viewbtn me-2"
                              onClick={() => window.open(fullUrl, "_blank")}
                            >
                              View
                            </button>
                          </td>
                          <td>
                            <span
                              className={`status-badge ${isApproved
                                ? "vil-approved"
                                : isRejected
                                  ? "vil-rejected"
                                  : "vil-pending"
                                }`}
                            >
                              <i
                                className={`fa-solid ${isApproved
                                  ? "fa-circle-check"
                                  : isRejected
                                    ? "fa-circle-xmark"
                                    : "fa-clock"
                                  } me-1`}
                              ></i>
                              {docStatus}
                            </span>
                          </td>
                          <td>{doc?.notes || "-"}</td>
                          <td>
                            {doc?.uploadedAt || doc?.createdAt
                              ? new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString("en-GB")
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* VIL Approval Images Section (if approval images exist) */}
        {allApprovalImages.length > 0 && (
          <div className="mt-3 pt-3 border-top">
            <div className="paymntdata">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="mb-0">
                  <i className="fa-solid fa-stamp text-success me-2"></i>
                  VIL Approval Images ({allApprovalImages.length})
                </h6>
                <small className="text-muted" style={{ fontSize: "11.5px" }}>
                  Attached during VIL approval
                </small>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "12px",
                  marginTop: "8px",
                }}
              >
                {allApprovalImages.map((img, aIdx) => {
                  const url = getDocUrl(img);
                  const isImageFile = !url.toLowerCase().endsWith(".pdf");
                  const uploader =
                    img.uploadedBy?.userName ||
                    img.uploadedBy?.name ||
                    img.uploadedBy?.role ||
                    (typeof img.uploadedBy === "string" ? img.uploadedBy : "") ||
                    "Admin";
                  const dateStr = img.uploadedAt
                    ? new Date(img.uploadedAt).toLocaleDateString("en-GB")
                    : "-";

                  return (
                    <div
                      key={aIdx}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "8px",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          height: "105px",
                          borderRadius: "8px",
                          backgroundColor: "#f8fafc",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          border: "1px solid #f1f5f9",
                        }}
                        onClick={() => window.open(url, "_blank")}
                        title="Click to view full image"
                      >
                        {isImageFile ? (
                          <img
                            src={url}
                            alt={img.originalName || "Approval Image"}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <i className="fa-solid fa-file-pdf fs-1 text-danger"></i>
                        )}
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#1e293b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "110px",
                          }}
                          title={img.originalName || img.fileName}
                        >
                          {img.originalName || img.fileName || `Image ${aIdx + 1}`}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success py-0 px-2"
                          style={{ fontSize: "11px", borderRadius: "4px" }}
                          onClick={() => window.open(url, "_blank")}
                        >
                          View
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#64748b",
                          borderTop: "1px dashed #e2e8f0",
                          paddingTop: "4px",
                          lineHeight: 1.3,
                        }}
                      >
                        <div>
                          <i className="fa-solid fa-user me-1 text-primary"></i> {uploader}
                        </div>
                        <div>
                          <i className="fa-solid fa-calendar me-1 text-secondary"></i> {dateStr}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
