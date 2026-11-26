import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import {
  Pagination,
  Stack,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
} from "@mui/material";
import Swal from "sweetalert2";
import { imageUrl } from "../../Basurl/Baseurl";
import {
  fetchPaymentTreeFilters,
  fetchPaymentData,
  fetchHospitalPatients,
  fetchPatientTreatments,
  downloadPaymentDataExcel,
  buildFullPaymentExportData,
  exportSingleTreatmentExcel,
  exportSinglePatientExcel,
  omitEmpty,
  normalizeCountryOption,
  normalizeCityOption,
  normalizeHospitalOption,
  normalizePatientOption,
  normalizeTreatmentOption,
  uniqueOptions,
} from "../../services/paymentDataApi";
import PaymentDataCharts from "./PaymentDataCharts";

const autocompleteSx = {
  "& .MuiInputBase-root": {
    height: 40,
    backgroundColor: "#ffffff",
    borderRadius: "6px",
  },
  "& .MuiInputBase-input": {
    padding: "6px 12px !important",
    fontSize: "13px",
  },
};

const formatCurrency = (val) => {
  if (val == null || val === "") return "—";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
  if (isNaN(num)) return String(val);
  return `$${Number(num).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
};

const formatCell = (val) => {
  if (val == null || val === "") return "—";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
};

const formatPaymentDate = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
};

const getInvoiceUrl = (file) => {
  if (!file) return "";
  if (typeof file === "string") {
    if (file.startsWith("http://") || file.startsWith("https://")) return file;
    const clean = file.startsWith("/") ? file.slice(1) : file;
    return `${imageUrl}${clean}`;
  }
  if (file?.url) return file.url;
  if (file?.file) return getInvoiceUrl(file.file);
  return "";
};

const renderPaymentMethodBadge = (method) => {
  if (!method) return <span className="text-muted">—</span>;
  const m = String(method).toLowerCase();
  let bg = "#f1f5f9";
  let color = "#334155";
  let icon = "fa-credit-card";

  if (m.includes("gop") || m.includes("guarantee")) {
    bg = "#fef3c7";
    color = "#b45309";
    icon = "fa-file-text-o";
  } else if (m.includes("upi") || m.includes("gpay") || m.includes("phonepe") || m.includes("paytm")) {
    bg = "#e0f2fe";
    color = "#0369a1";
    icon = "fa-mobile";
  } else if (m.includes("bank") || m.includes("net") || m.includes("transfer") || m.includes("neft") || m.includes("rtgs") || m.includes("wire")) {
    bg = "#ede9fe";
    color = "#6d28d9";
    icon = "fa-university";
  } else if (m.includes("cash")) {
    bg = "#dcfce7";
    color = "#15803d";
    icon = "fa-money";
  } else if (m.includes("card") || m.includes("credit") || m.includes("debit") || m.includes("pos")) {
    bg = "#fef3c7";
    color = "#b45309";
    icon = "fa-credit-card";
  } else if (m.includes("cheque") || m.includes("check")) {
    bg = "#fae8ff";
    color = "#a21caf";
    icon = "fa-pencil-square-o";
  }

  return (
    <span
      className="badge d-inline-flex align-items-center gap-1"
      style={{
        backgroundColor: bg,
        color: color,
        fontWeight: 600,
        fontSize: "11px",
        padding: "4px 8px",
        borderRadius: "4px",
      }}
    >
      <i className={`fa ${icon}`} style={{ fontSize: "10px" }} />
      {method}
    </span>
  );
};

const getPaymentStatus = (pay) => {
  if (pay?.status) {
    const s = String(pay.status).toLowerCase();
    if (s === "approved") return "Approved";
    if (s === "pending") return "Pending";
    if (s === "rejected") return "Rejected";
  }
  const m = (pay?.paymentMethod || pay?.method || pay?.payment_method || pay?.mode || "").toLowerCase().trim();
  if (m === "gop" || m.includes("guarantee of payment")) {
    return "Pending";
  }
  return "Approved";
};

const renderPaymentStatusBadge = (pay) => {
  const status = getPaymentStatus(pay);
  if (status === "Approved") {
    return (
      <span
        className="badge bg-success text-white"
        style={{ fontSize: "10.5px", padding: "3px 7px", fontWeight: 500 }}
      >
        <i className="fa fa-check-circle me-1" style={{ fontSize: "9.5px" }} />
        Approved
      </span>
    );
  }
  if (status === "Pending") {
    return (
      <span
        className="badge bg-warning text-dark"
        style={{ fontSize: "10.5px", padding: "3px 7px", fontWeight: 500 }}
        title="Pending Admin approval. GOP payment can only be approved by the Admin."
      >
        <i className="fa fa-clock-o me-1" style={{ fontSize: "9.5px" }} />
        Pending
      </span>
    );
  }
  return (
    <span
      className="badge bg-danger text-white"
      style={{ fontSize: "10.5px", padding: "3px 7px", fontWeight: 500 }}
      title={pay?.notes || "Payment rejected"}
    >
      <i className="fa fa-times-circle me-1" style={{ fontSize: "9.5px" }} />
      Rejected
    </span>
  );
};

const renderAttachmentLinks = (attachFile) => {
  if (!attachFile) return <span className="text-muted">—</span>;
  const files = Array.isArray(attachFile)
    ? attachFile
    : typeof attachFile === "string"
    ? [attachFile]
    : [];

  const validFiles = files.filter(Boolean);
  if (!validFiles.length) return <span className="text-muted">—</span>;

  return (
    <div className="d-flex flex-wrap gap-1">
      {validFiles.map((f, fIdx) => {
        const url = getInvoiceUrl(f);
        const fileName = typeof f === "string" ? f : f?.name || f?.fileName || `Invoice ${fIdx + 1}`;
        const shortName = fileName.length > 22 ? fileName.substring(0, 20) + "..." : fileName;
        const isPdf = String(fileName).toLowerCase().endsWith(".pdf");

        return (
          <a
            key={fIdx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 text-primary"
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              textDecoration: "none",
              backgroundColor: "#f8fafc",
            }}
            title={`View / Download ${fileName}`}
          >
            <i className={`fa ${isPdf ? "fa-file-pdf-o text-danger" : "fa-file-image-o text-info"}`} />
            <span>{shortName}</span>
            <i className="fa fa-external-link" style={{ fontSize: "9px", opacity: 0.7 }} />
          </a>
        );
      })}
    </div>
  );
};

const renderPaymentsTable = (payments = [], emptyMsg = "No payment records recorded") => {
  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-3 text-muted" style={{ backgroundColor: "#f8fafc", borderRadius: "6px" }}>
        <i className="fa fa-credit-card mb-1" style={{ fontSize: "18px", opacity: 0.5 }} />
        <p className="mb-0 fw-medium" style={{ fontSize: "12px" }}>
          {emptyMsg}
        </p>
      </div>
    );
  }

  let approvedPaid = 0;
  let pendingPaid = 0;
  payments.forEach((p) => {
    const amt = parseNumeric(p.paid_amount ?? p.amount ?? p.payment ?? 0);
    const st = getPaymentStatus(p);
    if (st === "Approved") {
      approvedPaid += amt;
    } else if (st === "Pending") {
      pendingPaid += amt;
    }
  });

  return (
    <div className="table-responsive">
      <Table size="small" aria-label="Payments Table">
        <TableHead sx={{ backgroundColor: "#f8fafc" }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Payment Date</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: "#0284c7", py: 0.8, fontSize: "11px" }}>Paid Amount</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Payment Method</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Paid To</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Paid For</TableCell>
            {/* <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Added By</TableCell> */}
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Invoices / Receipts</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Notes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((pay, pIdx) => {
            const paidAmt = pay.paid_amount ?? pay.amount ?? pay.payment ?? 0;
            const payDate = pay.payment_Date || pay.paymentDate || pay.date || pay.createdAt;
            const payMethod = pay.paymentMethod || pay.method || pay.payment_method || pay.mode || "—";
            const paidToName = typeof pay.paid_to === "object" ? pay.paid_to?.name : pay.paid_to || "—";
            const paidForName = typeof pay.paid_for === "object" ? pay.paid_for?.name : pay.paid_for || "—";
            // const addedByName = typeof pay.added_by === "object" ? pay.added_by?.name : pay.added_by || "";
            // const addedByRole = typeof pay.added_by === "object" ? pay.added_by?.role : "";
            const attachFiles = pay.attachFile || pay.attachment || pay.files || pay.invoice || [];
            const notes = pay.notes || pay.note || pay.remarks || pay.description || "";

            return (
              <TableRow key={pay.id || pay._id || pIdx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafafa" } }}>
                <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>{pIdx + 1}</TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px", whiteSpace: "nowrap" }}>
                  <i className="fa fa-calendar-o text-muted me-1" style={{ fontSize: "10px" }} />
                  {formatPaymentDate(payDate)}
                </TableCell>
                <TableCell align="right" sx={{ py: 0.8, fontSize: "11px", fontWeight: 700, color: "#0284c7" }}>
                  {formatCurrency(paidAmt)}
                </TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                  {renderPaymentMethodBadge(payMethod)}
                </TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                  {renderPaymentStatusBadge(pay)}
                </TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                  <span className="badge bg-light text-dark border">{paidToName || "—"}</span>
                </TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                  <span className="badge bg-secondary">{paidForName || "—"}</span>
                </TableCell>
                {/* <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                  {addedByName ? (
                    <div>
                      <span className="fw-semibold text-dark">{addedByName}</span>
                      {addedByRole && (
                        <small className="text-muted d-block" style={{ fontSize: "10px" }}>
                          ({addedByRole})
                        </small>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell> */}
                <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                  {renderAttachmentLinks(attachFiles)}
                </TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px", maxWidth: 220, color: "#475569" }}>
                  {notes || "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {payments.length > 0 && (
        <div className="d-flex flex-wrap justify-content-end align-items-center p-2 bg-light border-top gap-3" style={{ fontSize: "12px" }}>
          <span className="text-muted">Approved Paid ({payments.filter((p) => getPaymentStatus(p) === "Approved").length} of {payments.length} transactions):</span>
          <strong className="text-primary" style={{ fontSize: "13px" }}>{formatCurrency(approvedPaid)}</strong>
          {pendingPaid > 0 && (
            <span className="badge bg-warning text-dark ms-2" style={{ fontSize: "11px", padding: "4px 8px" }}>
              <i className="fa fa-clock-o me-1" />
              Pending GOP: {formatCurrency(pendingPaid)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const renderHospitalChargesTable = (charges = []) => {
  if (!charges || charges.length === 0) {
    return (
      <div className="text-center py-2 text-muted" style={{ backgroundColor: "#f8fafc", borderRadius: "6px" }}>
        <small className="fw-medium">No additional investigation or service charges</small>
      </div>
    );
  }

  let totalCharges = 0;
  charges.forEach((c) => {
    totalCharges += parseNumeric(c.final_price ?? c.price ?? 0);
  });

  return (
    <div className="table-responsive">
      <Table size="small" aria-label="Hospital Charges Table">
        <TableHead sx={{ backgroundColor: "#f8fafc" }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Service / Test Name</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Date</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: "#64748b", py: 0.8, fontSize: "11px" }}>Original Price</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, color: "#64748b", py: 0.8, fontSize: "11px" }}>Discount</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: "#1e3a8a", py: 0.8, fontSize: "11px" }}>Final Price</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {charges.map((c, cIdx) => {
            const origPrice = c.price ?? 0;
            const disc = c.discount_percentage ?? 0;
            const finalPrice = c.final_price ?? origPrice;
            const dateStr = c.date || c.createdAt;

            return (
              <TableRow key={c._id || c.id || cIdx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafafa" } }}>
                <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>{cIdx + 1}</TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px", fontWeight: 600, color: "#1e293b" }}>
                  <i className="fa fa-flask text-info me-1" style={{ fontSize: "10px" }} />
                  {c.service_name || "Service / Test"}
                </TableCell>
                <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                  {dateStr ? formatPaymentDate(dateStr) : "—"}
                </TableCell>
                <TableCell align="right" sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                  {formatCurrency(origPrice)}
                </TableCell>
                <TableCell align="center" sx={{ py: 0.8, fontSize: "11px" }}>
                  {disc > 0 ? (
                    <span className="badge bg-success" style={{ fontSize: "10px" }}>
                      {disc}% OFF
                    </span>
                  ) : (
                    <span className="text-muted">0%</span>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ py: 0.8, fontSize: "11px", fontWeight: 700, color: "#1e3a8a" }}>
                  {formatCurrency(finalPrice)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {charges.length > 1 && (
        <div className="d-flex justify-content-end align-items-center p-2 bg-light border-top gap-3" style={{ fontSize: "12px" }}>
          <span className="text-muted">Total Additional Charges ({charges.length} items):</span>
          <strong className="text-dark" style={{ fontSize: "13px" }}>{formatCurrency(totalCharges)}</strong>
        </div>
      )}
    </div>
  );
};

const renderOmcaServicesTable = (freeServices = [], extraServices = []) => {
  const hasFree = freeServices && freeServices.length > 0;
  const hasExtra = extraServices && extraServices.length > 0;

  if (!hasFree && !hasExtra) {
    return (
      <div className="text-center py-2 text-muted" style={{ backgroundColor: "#f8fafc", borderRadius: "6px" }}>
        <small className="fw-medium">No OMCA services recorded for this treatment</small>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      {hasFree && (
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-success" style={{ fontSize: "10px" }}>Free Services ({freeServices.length})</span>
          </div>
          <div className="table-responsive">
            <Table size="small" aria-label="OMCA Free Services Table">
              <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Service ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Service Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Duration</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "#15803d", py: 0.8, fontSize: "11px" }}>Price</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {freeServices.map((fs, idx) => (
                  <TableRow key={fs._id || fs.serviceId || idx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafafa" } }}>
                    <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>{idx + 1}</TableCell>
                    <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                      <span className="badge bg-light text-dark border">{fs.serviceId || "—"}</span>
                    </TableCell>
                    <TableCell sx={{ py: 0.8, fontSize: "11px", fontWeight: 600, color: "#1e293b" }}>
                      {fs.serviceName || "Service"}
                    </TableCell>
                    <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                      {fs.duration || "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.8, fontSize: "11px", fontWeight: 600, color: "#15803d" }}>
                      $0.00 (Free)
                    </TableCell>
                    <TableCell align="center" sx={{ py: 0.8, fontSize: "11px" }}>
                      <span className="badge bg-success text-white" style={{ fontSize: "10px" }}>Free</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {hasExtra && (
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary" style={{ fontSize: "10px" }}>Extra / Paid Services ({extraServices.length})</span>
          </div>
          <div className="table-responsive">
            <Table size="small" aria-label="OMCA Paid Services Table">
              <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Service ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Service Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Duration / Validity</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "#64748b", py: 0.8, fontSize: "11px" }}>Price</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: "#64748b", py: 0.8, fontSize: "11px" }}>Discount</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "#1e3a8a", py: 0.8, fontSize: "11px" }}>Final Price</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {extraServices.map((es, idx) => {
                  const origPrice = es.price ?? 0;
                  const disc = es.discount_percentage ?? 0;
                  const finalPrice = es.final_price ?? origPrice;
                  const datesText = es.startTime && es.endTime
                    ? `${formatPaymentDate(es.startTime)} — ${formatPaymentDate(es.endTime)}`
                    : es.duration || "—";

                  return (
                    <TableRow key={es._id || es.serviceId || idx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafafa" } }}>
                      <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>{idx + 1}</TableCell>
                      <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                        <span className="badge bg-light text-dark border">{es.serviceId || "—"}</span>
                      </TableCell>
                      <TableCell sx={{ py: 0.8, fontSize: "11px", fontWeight: 600, color: "#1e293b" }}>
                        {es.serviceName || "Extra Service"}
                      </TableCell>
                      <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                        {datesText}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                        {formatCurrency(origPrice)}
                      </TableCell>
                      <TableCell align="center" sx={{ py: 0.8, fontSize: "11px" }}>
                        {disc > 0 ? (
                          <span className="badge bg-success" style={{ fontSize: "10px" }}>
                            {disc}% OFF
                          </span>
                        ) : (
                          <span className="text-muted">0%</span>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.8, fontSize: "11px", fontWeight: 700, color: "#1e3a8a" }}>
                        {formatCurrency(finalPrice)}
                      </TableCell>
                      <TableCell align="center" sx={{ py: 0.8, fontSize: "11px" }}>
                        <span className="badge bg-primary text-white" style={{ fontSize: "10px" }}>Paid</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

const renderPharmacyChargesTable = (pharmacyCharges = []) => {
  if (!pharmacyCharges || pharmacyCharges.length === 0) {
    return (
      <div className="text-center py-2 text-muted" style={{ backgroundColor: "#f8fafc", borderRadius: "6px" }}>
        <small className="fw-medium">No pharmacy charges recorded</small>
      </div>
    );
  }

  let totalPharm = 0;
  pharmacyCharges.forEach((pc) => {
    totalPharm += parseNumeric(pc.final_price ?? pc.price ?? 0);
  });

  return (
    <div className="table-responsive">
      <Table size="small" aria-label="Pharmacy Charges Table">
        <TableHead sx={{ backgroundColor: "#f8fafc" }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Medicine / Item Name</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "#475569", py: 0.8, fontSize: "11px" }}>Date</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: "#64748b", py: 0.8, fontSize: "11px" }}>Price</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, color: "#64748b", py: 0.8, fontSize: "11px" }}>Discount</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: "#1e3a8a", py: 0.8, fontSize: "11px" }}>Final Price</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pharmacyCharges.map((pc, idx) => (
            <TableRow key={pc._id || pc.id || idx} hover sx={{ "&:nth-of-type(even)": { backgroundColor: "#fafafa" } }}>
              <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>{idx + 1}</TableCell>
              <TableCell sx={{ py: 0.8, fontSize: "11px", fontWeight: 600, color: "#1e293b" }}>
                {pc.medicine_name || pc.name || pc.item_name || pc.service_name || "Pharmacy Item"}
              </TableCell>
              <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                {pc.date ? formatPaymentDate(pc.date) : "—"}
              </TableCell>
              <TableCell align="right" sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                {formatCurrency(pc.price ?? 0)}
              </TableCell>
              <TableCell align="center" sx={{ py: 0.8, fontSize: "11px" }}>
                {pc.discount_percentage ? `${pc.discount_percentage}%` : "0%"}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: "#1e3a8a", py: 0.8, fontSize: "11px" }}>
                {formatCurrency(pc.final_price ?? pc.price ?? 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pharmacyCharges.length > 1 && (
        <div className="d-flex justify-content-end align-items-center p-2 bg-light border-top gap-3" style={{ fontSize: "12px" }}>
          <span className="text-muted">Total Pharmacy Charges ({pharmacyCharges.length} items):</span>
          <strong className="text-dark" style={{ fontSize: "13px" }}>{formatCurrency(totalPharm)}</strong>
        </div>
      )}
    </div>
  );
};

/**
 * Reusable renderer for Treatment Charges & Payments Breakdown (Hospital, OMCA, Pharmacy, All Sections)
 */
const renderTreatmentBreakdownContent = ({
  tr = {},
  treatmentKey = "",
  activeSec = "hospital",
  onSectionChange = () => {},
  onNavigatePatient = () => {},
  onExportTreatment = null,
  fallbackHospitalName = "",
  fallbackPatientName = "",
  fallbackPatientId = "",
}) => {
  const trHosp = tr.hospital || {};
  const trOmca = tr.omca || {};
  const trPharm = tr.pharmacy || {};

  const hospFee = trHosp.treatment_fee ?? trHosp.final_amount ?? tr.treatment_fee ?? 0;
  const hospDiscount = trHosp.discount_percentage ?? 0;
  const hospFinalAmount = trHosp.final_amount ?? (hospFee - (hospFee * hospDiscount) / 100);

  const calculateApprovedPaid = (paymentsList, fallbackPaid) => {
    if (Array.isArray(paymentsList) && paymentsList.length > 0) {
      return paymentsList.reduce((acc, p) => {
        return getPaymentStatus(p) === "Approved"
          ? acc + parseNumeric(p.paid_amount ?? p.amount ?? p.payment ?? 0)
          : acc;
      }, 0);
    }
    return parseNumeric(fallbackPaid ?? 0);
  };

  const hospCharges = Array.isArray(trHosp.charges) ? trHosp.charges : [];
  const hospPayments = Array.isArray(trHosp.payments) ? trHosp.payments : [];
  const hospTotal =
    trHosp.totalAmount ??
    (parseNumeric(hospFinalAmount) +
      hospCharges.reduce((acc, c) => acc + parseNumeric(c.final_price ?? c.price ?? 0), 0));
  const hospPaid = calculateApprovedPaid(hospPayments, trHosp.paidAmount);
  const hospDue = trHosp.dueAmount ?? Math.max(0, hospTotal - hospPaid);

  const omcaFree = Array.isArray(trOmca.freeServices) ? trOmca.freeServices : [];
  const omcaExtra = Array.isArray(trOmca.extraServices) ? trOmca.extraServices : [];
  const omcaPayments = Array.isArray(trOmca.payments) ? trOmca.payments : [];
  const omcaTotal =
    trOmca.totalAmount ??
    omcaExtra.reduce((acc, s) => acc + parseNumeric(s.final_price ?? s.price ?? 0), 0);
  const omcaPaid = calculateApprovedPaid(omcaPayments, trOmca.paidAmount);
  const omcaDue = trOmca.dueAmount ?? Math.max(0, omcaTotal - omcaPaid);

  const pharmCharges = Array.isArray(trPharm.pharmacyCharges) ? trPharm.pharmacyCharges : [];
  const pharmPayments = Array.isArray(trPharm.payments) ? trPharm.payments : [];
  const pharmTotal =
    trPharm.totalAmount ??
    pharmCharges.reduce((acc, c) => acc + parseNumeric(c.final_price ?? c.price ?? 0), 0);
  const pharmPaid = calculateApprovedPaid(pharmPayments, trPharm.paidAmount);
  const pharmDue = trPharm.dueAmount ?? Math.max(0, pharmTotal - pharmPaid);

  const allPayments = Array.isArray(tr.payment_details)
    ? tr.payment_details
    : Array.isArray(tr.payment_history)
    ? tr.payment_history
    : [...hospPayments, ...omcaPayments, ...pharmPayments];

  const hospPaymentsList = hospPayments.length
    ? hospPayments
    : allPayments.filter((p) => {
        const to = typeof p.paid_to === "object" ? p.paid_to?.name : String(p.paid_to || "");
        return !to || to.toLowerCase().includes("hospital");
      });

  const omcaPaymentsList = omcaPayments.length
    ? omcaPayments
    : allPayments.filter((p) => {
        const to = typeof p.paid_to === "object" ? p.paid_to?.name : String(p.paid_to || "");
        return to && to.toLowerCase().includes("omca");
      });

  const pharmPaymentsList = pharmPayments.length
    ? pharmPayments
    : allPayments.filter((p) => {
        const to = typeof p.paid_to === "object" ? p.paid_to?.name : String(p.paid_to || "");
        return to && to.toLowerCase().includes("pharmacy");
      });

  const trName = tr.treatment_name || tr.treatment || tr.course_name || tr.name || "";
  const trId = tr.treatment_id || tr.treatmentId || tr.id || tr._id || "";
  const ptName = tr.patient_name || tr.patient || fallbackPatientName || "";
  const ptId = tr.patientId || tr.patient_id || fallbackPatientId || "";
  const hospName =
    tr.hospital_name ||
    (typeof tr.hospital === "string" ? tr.hospital : tr.hospital?.details?.hospital_Name || tr.hospital?.hospital_name) ||
    fallbackHospitalName ||
    "";

  return (
    <div
      style={{
        margin: "10px 14px 16px 18px",
        padding: "16px",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #e0e7ff",
        boxShadow: "0 2px 10px rgba(99, 102, 241, 0.08)",
      }}
    >
      {/* Top Treatment Summary Banner */}
      <div className="d-flex flex-wrap align-items-center justify-content-between pb-2 mb-3 border-bottom gap-2">
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: "#eef2ff",
              color: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "15px",
            }}
          >
            <i className="fa fa-stethoscope" />
          </div>
          <div>
            <h6 className="mb-0 fw-bold" style={{ fontSize: "14px", color: "#1e1b4b" }}>
              {trName || trId || "Treatment"}
            </h6>
            <small className="text-muted" style={{ fontSize: "11px" }}>
              Treatment ID: <strong>{trId || "—"}</strong>
              {ptName || ptId ? (
                <>
                  {" "}| Patient: <strong>{ptName || ptId}</strong> {ptId && ptId !== ptName ? `(${ptId})` : ""}
                </>
              ) : null}
              {hospName ? (
                <>
                  {" "}| Hospital: <strong>{hospName}</strong>
                </>
              ) : null}
            </small>
          </div>
        </div>

        {/* Treatment Overall Financial Pills */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span
            className="badge"
            style={{
              backgroundColor: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              fontSize: "11px",
              padding: "5px 10px",
              fontWeight: 600,
            }}
          >
            Total Billing: {formatCurrency(tr.total_billing ?? hospTotal + omcaTotal + pharmTotal)}
          </span>
          <span
            className="badge"
            style={{
              backgroundColor: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              fontSize: "11px",
              padding: "5px 10px",
              fontWeight: 600,
            }}
          >
            Received: {formatCurrency(tr.payments_received ?? hospPaid + omcaPaid + pharmPaid)}
          </span>
          {parseNumeric(tr.dues_pending ?? hospDue + omcaDue + pharmDue) > 0 ? (
            <span
              className="badge"
              style={{
                backgroundColor: "#fff1f2",
                color: "#9f1239",
                border: "1px solid #fecdd3",
                fontSize: "11px",
                padding: "5px 10px",
                fontWeight: 600,
              }}
            >
              Due: {formatCurrency(tr.dues_pending ?? hospDue + omcaDue + pharmDue)}
            </span>
          ) : (
            <span
              className="badge"
              style={{
                backgroundColor: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                fontSize: "11px",
                padding: "5px 10px",
                fontWeight: 600,
              }}
            >
              Fully Settled
            </span>
          )}

          {typeof onExportTreatment === "function" && (
            <button
              type="button"
              className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 ms-1"
              onClick={(e) => {
                e.stopPropagation();
                onExportTreatment(
                  tr,
                  {
                    hospitalName: hospName,
                    patientName: ptName,
                    patientId: ptId,
                  },
                  e
                );
              }}
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "5px",
                fontWeight: 600,
              }}
              title="Export this treatment and its charges/payments breakdown to Excel"
            >
              <i className="fa fa-file-excel-o" />
              Export Treatment
            </button>
          )}
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div
        className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-1 mb-3"
        style={{ backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}
      >
        <div className="d-flex flex-wrap gap-1">
          {/* Hospital Tab */}
          <button
            type="button"
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onSectionChange(treatmentKey, "hospital");
            }}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: "6px",
              backgroundColor: activeSec === "hospital" ? "#1e3a8a" : "transparent",
              color: activeSec === "hospital" ? "#ffffff" : "#334155",
              border: "none",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <i className="fa fa-hospital-o" />
            <span>Hospital</span>
            <span
              className="badge ms-1"
              style={{
                fontSize: "10px",
                backgroundColor: activeSec === "hospital" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                color: activeSec === "hospital" ? "#ffffff" : "#1e293b",
              }}
            >
              {formatCurrency(hospTotal)}
            </span>
          </button>

          {/* OMCA Tab */}
          <button
            type="button"
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onSectionChange(treatmentKey, "omca");
            }}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: "6px",
              backgroundColor: activeSec === "omca" ? "#4f46e5" : "transparent",
              color: activeSec === "omca" ? "#ffffff" : "#334155",
              border: "none",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <i className="fa fa-building-o" />
            <span>OMCA</span>
            <span
              className="badge ms-1"
              style={{
                fontSize: "10px",
                backgroundColor: activeSec === "omca" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                color: activeSec === "omca" ? "#ffffff" : "#1e293b",
              }}
            >
              {formatCurrency(omcaTotal)}
            </span>
          </button>

          {/* Pharmacy Tab */}
          <button
            type="button"
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onSectionChange(treatmentKey, "pharmacy");
            }}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: "6px",
              backgroundColor: activeSec === "pharmacy" ? "#0f766e" : "transparent",
              color: activeSec === "pharmacy" ? "#ffffff" : "#334155",
              border: "none",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <i className="fa fa-medkit" />
            <span>Pharmacy</span>
            <span
              className="badge ms-1"
              style={{
                fontSize: "10px",
                backgroundColor: activeSec === "pharmacy" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                color: activeSec === "pharmacy" ? "#ffffff" : "#1e293b",
              }}
            >
              {formatCurrency(pharmTotal)}
            </span>
          </button>

          {/* All Sections Tab */}
          <button
            type="button"
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onSectionChange(treatmentKey, "all");
            }}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: "6px",
              backgroundColor: activeSec === "all" ? "#334155" : "transparent",
              color: activeSec === "all" ? "#ffffff" : "#334155",
              border: "none",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <i className="fa fa-th-large" />
            <span>All Sections Overview</span>
          </button>
        </div>
      </div>

      {/* Tab Content 1: Hospital Section */}
      {(activeSec === "hospital" || activeSec === "all") && (
        <div
          className="mb-3 p-3"
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          {/* Hospital Section Header */}
          <div className="d-flex flex-wrap align-items-center justify-content-between pb-2 mb-2 border-bottom gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="fa fa-hospital-o text-primary" style={{ fontSize: "16px" }} />
              <h6 className="mb-0 fw-bold" style={{ fontSize: "13px", color: "#1e3a8a" }}>
                Hospital Charges & Payments
              </h6>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="badge bg-primary text-white" style={{ fontSize: "11px", padding: "4px 8px" }}>
                Total: {formatCurrency(hospTotal)}
              </span>
              <span className="badge bg-success text-white" style={{ fontSize: "11px", padding: "4px 8px" }}>
                Paid: {formatCurrency(hospPaid)}
              </span>
              {parseNumeric(hospDue) > 0 && (
                <span className="badge bg-danger text-white" style={{ fontSize: "11px", padding: "4px 8px" }}>
                  Due: {formatCurrency(hospDue)}
                </span>
              )}
            </div>
          </div>

          {/* Hospital Treatment Fee & Details Card */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-4">
              <div className="p-2 bg-white rounded border">
                <small className="text-muted d-block" style={{ fontSize: "10px" }}>
                  Treatment Base Fee
                </small>
                <span className="fw-bold text-dark" style={{ fontSize: "13px" }}>
                  {formatCurrency(hospFee)}
                </span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="p-2 bg-white rounded border">
                <small className="text-muted d-block" style={{ fontSize: "10px" }}>
                  Hospital Discount
                </small>
                <span className="fw-bold text-success" style={{ fontSize: "13px" }}>
                  {hospDiscount}% OFF
                </span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="p-2 bg-white rounded border">
                <small className="text-muted d-block" style={{ fontSize: "10px" }}>
                  Final Base Fee
                </small>
                <span className="fw-bold text-primary" style={{ fontSize: "13px" }}>
                  {formatCurrency(hospFinalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Hospital Charges (Test / Scan / Services) */}
          <div className="mb-3">
            <div className="d-flex align-items-center gap-1 mb-1">
              <span className="fw-semibold text-secondary" style={{ fontSize: "11px" }}>
                Additional Investigation / Scan Charges ({hospCharges.length})
              </span>
            </div>
            {renderHospitalChargesTable(hospCharges)}
          </div>

          {/* Hospital Payments */}
          <div>
            <div className="d-flex align-items-center gap-1 mb-1">
              <span className="fw-semibold text-secondary" style={{ fontSize: "11px" }}>
                Hospital Payment Transactions ({hospPaymentsList.length})
              </span>
            </div>
            {renderPaymentsTable(hospPaymentsList, "No hospital payment transactions recorded for this treatment.")}
          </div>
        </div>
      )}

      {/* Tab Content 2: OMCA Section */}
      {(activeSec === "omca" || activeSec === "all") && (
        <div
          className="mb-3 p-3"
          style={{
            backgroundColor: "#f5f3ff",
            borderRadius: "8px",
            border: "1px solid #ddd6fe",
          }}
        >
          {/* OMCA Section Header */}
          <div className="d-flex flex-wrap align-items-center justify-content-between pb-2 mb-2 border-bottom gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="fa fa-building-o" style={{ fontSize: "16px", color: "#4f46e5" }} />
              <h6 className="mb-0 fw-bold" style={{ fontSize: "13px", color: "#4338ca" }}>
                OMCA Services & Payments
              </h6>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="badge" style={{ backgroundColor: "#4f46e5", color: "#fff", fontSize: "11px", padding: "4px 8px" }}>
                Total: {formatCurrency(omcaTotal)}
              </span>
              <span className="badge bg-success text-white" style={{ fontSize: "11px", padding: "4px 8px" }}>
                Paid: {formatCurrency(omcaPaid)}
              </span>
              {parseNumeric(omcaDue) > 0 && (
                <span className="badge bg-danger text-white" style={{ fontSize: "11px", padding: "4px 8px" }}>
                  Due: {formatCurrency(omcaDue)}
                </span>
              )}
            </div>
          </div>

          {/* OMCA Services (Free & Paid Extra Services) */}
          <div className="mb-3">
            {renderOmcaServicesTable(omcaFree, omcaExtra)}
          </div>

          {/* OMCA Payments */}
          <div>
            <div className="d-flex align-items-center gap-1 mb-1">
              <span className="fw-semibold text-secondary" style={{ fontSize: "11px" }}>
                OMCA Payment Transactions ({omcaPaymentsList.length})
              </span>
            </div>
            {renderPaymentsTable(omcaPaymentsList, "No OMCA payment transactions recorded.")}
          </div>
        </div>
      )}

      {/* Tab Content 3: Pharmacy Section */}
      {(activeSec === "pharmacy" || activeSec === "all") && (
        <div
          className="mb-2 p-3"
          style={{
            backgroundColor: "#f0fdfa",
            borderRadius: "8px",
            border: "1px solid #99f6e4",
          }}
        >
          {/* Pharmacy Section Header */}
          <div className="d-flex flex-wrap align-items-center justify-content-between pb-2 mb-2 border-bottom gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="fa fa-medkit" style={{ fontSize: "16px", color: "#0d9488" }} />
              <h6 className="mb-0 fw-bold" style={{ fontSize: "13px", color: "#0f766e" }}>
                Pharmacy Charges & Payments
              </h6>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="badge" style={{ backgroundColor: "#0d9488", color: "#fff", fontSize: "11px", padding: "4px 8px" }}>
                Total: {formatCurrency(pharmTotal)}
              </span>
              <span className="badge bg-success text-white" style={{ fontSize: "11px", padding: "4px 8px" }}>
                Paid: {formatCurrency(pharmPaid)}
              </span>
              {parseNumeric(pharmDue) > 0 && (
                <span className="badge bg-danger text-white" style={{ fontSize: "11px", padding: "4px 8px" }}>
                  Due: {formatCurrency(pharmDue)}
                </span>
              )}
            </div>
          </div>

          {/* Pharmacy Charges */}
          <div className="mb-3">
            <div className="d-flex align-items-center gap-1 mb-1">
              <span className="fw-semibold text-secondary" style={{ fontSize: "11px" }}>
                Pharmacy Charges & Medicines ({pharmCharges.length})
              </span>
            </div>
            {renderPharmacyChargesTable(pharmCharges)}
          </div>

          {/* Pharmacy Payments */}
          <div>
            <div className="d-flex align-items-center gap-1 mb-1">
              <span className="fw-semibold text-secondary" style={{ fontSize: "11px" }}>
                Pharmacy Payment Transactions ({pharmPaymentsList.length})
              </span>
            </div>
            {renderPaymentsTable(pharmPaymentsList, "No pharmacy payment transactions recorded.")}
          </div>
        </div>
      )}
    </div>
  );
};

const parseNumeric = (val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const clean = val.replace(/[^0-9.-]+/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const optionMatches = (optA, optB) => {
  if (!optA || !optB) return false;
  const valA =
    typeof optA === "string"
      ? optA
      : optA.value ?? optA.treatment_id ?? optA.patientId ?? optA.label ?? "";
  const valB =
    typeof optB === "string"
      ? optB
      : optB.value ?? optB.treatment_id ?? optB.patientId ?? optB.label ?? "";
  return String(valA).trim().toLowerCase() === String(valB).trim().toLowerCase();
};

const isOptionInList = (selected, list = []) => {
  if (!selected) return true;
  if (!Array.isArray(list) || !list.length) return false;
  return list.some((item) => optionMatches(selected, item));
};

const INITIAL_FILTERS = {
  country: null,
  city: null,
  hospital: null,
  patient: null,
  treatment: null,
};

export default function PaymentData() {
  const navigate = useNavigate();

  // Dropdown options
  const [dropdownOptions, setDropdownOptions] = useState({
    countries: [],
    cities: [],
    hospitals: [],
    patients: [],
    treatments: [],
    heads: [],
  });

  // Current filter selections
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  // Filters applied to the current table view
  const [appliedFilters, setAppliedFilters] = useState({});

  // Table & Summary states
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_billing: 0,
    payments_received: 0,
    dues_pending: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);

  // Current data view level ('country' | 'city' | 'hospital' | 'treatment')
  const [currentLevel, setCurrentLevel] = useState("country");

  // Accordion Level 1 state: only one hospital row open at a time ("if click second first close and second will open")
  const [expandedRowKey, setExpandedRowKey] = useState(null);
  // Cache of fetched patient drill data keyed by hospital name
  const [patientCache, setPatientCache] = useState({});

  // Accordion Level 2 state: only one patient row open at a time under a hospital
  const [expandedPatientKey, setExpandedPatientKey] = useState(null);
  // Cache of fetched treatment drill data keyed by `${hospitalName}___${patientId}`
  const [treatmentCache, setTreatmentCache] = useState({});

  // Accordion Level 3 state: only one treatment row open at a time under a patient to show Payment History
  const [expandedTreatmentKey, setExpandedTreatmentKey] = useState(null);
  // Active section tab per expanded treatment ('hospital' | 'omca' | 'pharmacy' | 'all')
  const [treatmentActiveSection, setTreatmentActiveSection] = useState({});

  // Pagination states (page is 1-indexed for backend API)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Display mode: 'both' (Graphs + Table), 'chart' (Graphs only), 'table' (Table only)
  const [displayMode, setDisplayMode] = useState("both");

  // Loading states
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPatientKey, setExportingPatientKey] = useState(null);
  const [exportingTreatmentKey, setExportingTreatmentKey] = useState(null);

  // Request tracking to prevent race conditions
  const filterReqId = useRef(0);
  const tableReqId = useRef(0);

  // Extract clean query parameter object from filter selections
  const getQueryParams = useCallback((sels = filters) => {
    if (!sels) return {};
    const params = {};

    if (sels.patientId) params.patientId = sels.patientId;
    if (sels.patient_id) params.patientId = sels.patient_id;
    if (sels.treatment_id) params.treatment_id = sels.treatment_id;
    if (sels.treatmentId) params.treatment_id = sels.treatmentId;

    if (sels.country) {
      params.country =
        typeof sels.country === "string"
          ? sels.country
          : sels.country.country || sels.country.value || sels.country.label || "";
    }

    if (sels.hospital) {
      params.hospital =
        typeof sels.hospital === "string"
          ? sels.hospital
          : sels.hospital.hospital_name ||
            sels.hospital.name ||
            sels.hospital.value ||
            sels.hospital.label ||
            "";
    }

    if (sels.city) {
      params.city =
        typeof sels.city === "string"
          ? sels.city
          : sels.city.city || sels.city.name || sels.city.value || sels.city.label || "";
    }

    if (sels.patient) {
      params.patientId =
        typeof sels.patient === "string"
          ? sels.patient
          : sels.patient.patientId ||
            sels.patient.patient_id ||
            sels.patient.value ||
            sels.patient.patient_name ||
            sels.patient.name ||
            "";
    }

    if (sels.treatment) {
      params.treatment_id =
        typeof sels.treatment === "string"
          ? sels.treatment
          : sels.treatment.treatment_id ||
            sels.treatment.treatmentId ||
            sels.treatment.value ||
            sels.treatment.treatment_name ||
            sels.treatment.name ||
            "";
    }

    if (sels.overall) {
      params.overall = sels.overall;
    } else if (params.treatment_id || params.patientId) {
      params.overall = "treatments";
    }

    return omitEmpty(params);
  }, [filters]);

  /**
   * Load dropdown options from /api/payment-data/tree-filters
   */
  const loadDropdownOptions = useCallback(
    async (filterSelections = filters) => {
      const reqId = ++filterReqId.current;
      try {
        setLoadingFilters(true);
        const queryParams = getQueryParams(filterSelections);
        const result = await fetchPaymentTreeFilters(queryParams);
        if (reqId !== filterReqId.current) return;

        setDropdownOptions({
          countries: result.countries || [],
          hospitals: result.hospitals || [],
          cities: result.cities || [],
          patients: result.patients || [],
          treatments: result.treatments || [],
          heads: result.heads || [],
        });
      } catch (error) {
        if (reqId === filterReqId.current) {
          console.error("Failed to load tree filters:", error);
        }
      } finally {
        if (reqId === filterReqId.current) {
          setLoadingFilters(false);
        }
      }
    },
    [filters, getQueryParams],
  );

  /**
   * Load table and summary data from /api/payment-data
   */
  const loadTableData = useCallback(
    async (filterParams = {}, pageNum = 1, pageSize = limit) => {
      const reqId = ++tableReqId.current;
      try {
        setLoadingTable(true);
        const params = {
          ...filterParams,
          page: pageNum,
          limit: pageSize,
        };

        const result = await fetchPaymentData(params);
        if (reqId !== tableReqId.current) return;

        const returnedRows = result.rows || [];
        setRows(returnedRows);
        setTotalRecords(result.totalRecords || 0);
        setSummary(
          result.summary || {
            total_billing: 0,
            payments_received: 0,
            dues_pending: 0,
          },
        );

        // Detect current level based on API overall, API level property, query params, or row shape
        const apiOverall = String(result.raw?.overall || result.raw?.data?.overall || "").toLowerCase();
        const apiLevel = String(result.level || result.raw?.level || result.raw?.data?.level || "").toLowerCase();
        let detectedLevel = "country";

        if (
          apiOverall.includes("treatment") ||
          params.patientId ||
          params.patient_id ||
          params.treatment_id ||
          params.treatmentId
        ) {
          detectedLevel = "treatment";
        } else if (
          apiLevel &&
          ["country", "city", "hospital", "patient", "treatment"].includes(apiLevel) &&
          !params.patientId &&
          !params.patient_id &&
          !params.treatment_id &&
          !params.treatmentId &&
          !apiOverall.includes("treatment")
        ) {
          detectedLevel = apiLevel;
        } else if (params.hospital) {
          detectedLevel = "hospital";
        } else if (params.city) {
          detectedLevel = "hospital";
        } else if (params.country) {
          detectedLevel = "city";
        } else if (returnedRows.length > 0) {
          const first = returnedRows[0];
          if (
            first.treatment_id ||
            first.treatment ||
            first.treatment_name ||
            (first.patientId && (first.hospital_id || typeof first.hospital === "object"))
          ) {
            detectedLevel = "treatment";
          } else if (first.hospital_name || (typeof first.hospital === "string" && first.hospital)) {
            detectedLevel = "hospital";
          } else if (first.city && !first.hospital && !first.hospital_name) {
            detectedLevel = "city";
          } else if (first.country && !first.city && !first.hospital) {
            detectedLevel = "country";
          }
        }
        setCurrentLevel(detectedLevel);

        // If returnedRows has treatments/patient data, ensure dropdown options and filters reflect them
        if (returnedRows.length > 0) {
          const first = returnedRows[0];
          const fromRows = returnedRows
            .map((r) => {
              const trName = r.treatment_name || r.treatment || r.course_name || r.name;
              const trId = r.treatment_id || r.treatmentId || r.id;
              if (!trName && !trId) return null;
              return normalizeTreatmentOption({
                treatment_name: trName,
                treatment_id: trId,
                value: trId || trName,
                label: trName ? (trId ? `${trName} (${trId})` : trName) : trId,
              });
            })
            .filter(Boolean);

          setDropdownOptions((prev) => {
            const updated = { ...prev };
            if (fromRows.length > 0) {
              updated.treatments = uniqueOptions([...(prev.treatments || []), ...fromRows]);
            }
            if (first.country && !(prev.countries || []).some((c) => (c.value || c.country) === first.country)) {
              const cOpt = normalizeCountryOption(first.country);
              if (cOpt) updated.countries = [...(prev.countries || []), cOpt];
            }
            if ((first.city || first.town) && !(prev.cities || []).some((c) => (c.value || c.city) === (first.city || first.town))) {
              const cOpt = normalizeCityOption(first.city || first.town);
              if (cOpt) updated.cities = [...(prev.cities || []), cOpt];
            }
            if (first.hospital_name && !(prev.hospitals || []).some((h) => (h.value || h.hospital_name) === first.hospital_name)) {
              const hOpt = normalizeHospitalOption({
                hospital_name: first.hospital_name,
                hospital_id: first.hospital_id,
              });
              if (hOpt) updated.hospitals = [...(prev.hospitals || []), hOpt];
            }
            if (first.patientId && !(prev.patients || []).some((p) => (p.value || p.patientId) === first.patientId)) {
              const pOpt = normalizePatientOption({
                patientId: first.patientId,
                patient_name: first.patient_name || first.patient,
              });
              if (pOpt) updated.patients = [...(prev.patients || []), pOpt];
            }
            return updated;
          });

          // If query was for patient or treatment, auto-fill filters so dropdowns show the patient's data
          if (params.patientId || params.patient_id || params.treatment_id || params.treatmentId) {
            setFilters((prev) => {
              const next = { ...prev };
              let changed = false;
              if (!next.country && first.country) {
                next.country = normalizeCountryOption(first.country);
                changed = true;
              }
              if (!next.city && (first.city || first.town)) {
                next.city = normalizeCityOption(first.city || first.town);
                changed = true;
              }
              if (!next.hospital && (first.hospital_name || first.hospital)) {
                next.hospital = normalizeHospitalOption({
                  hospital_name: first.hospital_name || first.hospital,
                  hospital_id: first.hospital_id,
                });
                changed = true;
              }
              if (!next.patient && (first.patientId || first.patient_name || first.patient)) {
                next.patient = normalizePatientOption({
                  patientId: first.patientId,
                  patient_name: first.patient_name || first.patient,
                });
                changed = true;
              }
              if (!next.treatment && fromRows.length === 1) {
                next.treatment = fromRows[0];
                changed = true;
              }
              return changed ? next : prev;
            });
          }
        }
      } catch (error) {
        if (reqId === tableReqId.current) {
          console.error("Failed to load payment table data:", error);
          setRows([]);
          setTotalRecords(0);
          Swal.fire(
            "Error",
            error?.response?.data?.message ||
              error?.message ||
              "Failed to load payment data",
            "error",
          );
        }
      } finally {
        if (reqId === tableReqId.current) {
          setLoadingTable(false);
        }
      }
    },
    [limit],
  );

  /**
   * Initial page load:
   * 1. Call tree-filters to fill dropdowns
   * 2. Call payment-data to fill initial table & summary
   */
  useEffect(() => {
    loadDropdownOptions(INITIAL_FILTERS);
    loadTableData({}, 1, limit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle dropdown selection change
   * Interdependent cascading logic:
   * 1. Resets direct child dependencies
   * 2. Calls tree-filters to recalculate available options
   * 3. Validates remaining selections against the newly returned options, automatically clearing any that are no longer valid
   */
  const handleFilterChange = async (key, selectedOption) => {
    const reqId = ++filterReqId.current;
    let nextFilters = {
      ...filters,
      [key]: selectedOption,
    };

    // 1. Direct explicit cascades
    if (key === "country") {
      nextFilters.city = null;
      nextFilters.hospital = null;
      nextFilters.patient = null;
      nextFilters.treatment = null;
    } else if (key === "city") {
      nextFilters.hospital = null;
      nextFilters.patient = null;
      nextFilters.treatment = null;
    } else if (key === "hospital") {
      nextFilters.patient = null;
      nextFilters.treatment = null;
    } else if (key === "patient") {
      nextFilters.treatment = null;
    }

    setFilters(nextFilters);

    // 2. Fetch updated tree-filters for the new state
    try {
      setLoadingFilters(true);
      const queryParams = getQueryParams(nextFilters);
      const result = await fetchPaymentTreeFilters(queryParams);
      if (reqId !== filterReqId.current) return;

      const newCountries = result.countries || [];
      const newCities = result.cities || [];
      const newHospitals = result.hospitals || [];
      const newPatients = result.patients || [];
      let newTreatments = result.treatments || [];
      const newHeads = result.heads || [];

      // If patient was selected, fetch patient data to get treatments & patient location/hospital!
      if (key === "patient" && selectedOption) {
        const ptId =
          typeof selectedOption === "string"
            ? selectedOption
            : selectedOption.patientId || selectedOption.value || "";
        if (ptId) {
          try {
            const ptDataRes = await fetchPaymentData({ patientId: ptId, limit: 50 });
            const ptRows = ptDataRes.rows || [];
            if (ptRows.length > 0) {
              const firstPtRow = ptRows[0];

              // Extract treatments for this patient
              const extracted = ptRows
                .map((r) => {
                  const trName = r.treatment_name || r.treatment || r.course_name || r.name;
                  const trId = r.treatment_id || r.treatmentId || r.id;
                  if (!trName && !trId) return null;
                  return normalizeTreatmentOption({
                    treatment_name: trName,
                    treatment_id: trId,
                    value: trId || trName,
                    label: trName ? (trId ? `${trName} (${trId})` : trName) : trId,
                  });
                })
                .filter(Boolean);

              if (extracted.length > 0) {
                newTreatments = uniqueOptions([...newTreatments, ...extracted]);
              }

              // Auto-fill patient's country if not selected
              if (!nextFilters.country && firstPtRow.country) {
                const cOpt = normalizeCountryOption(firstPtRow.country);
                if (cOpt) {
                  nextFilters.country = cOpt;
                  if (!newCountries.some((c) => c.value === cOpt.value)) {
                    newCountries.push(cOpt);
                  }
                }
              }

              // Auto-fill patient's city if not selected
              if (!nextFilters.city && (firstPtRow.city || firstPtRow.town)) {
                const cityVal = firstPtRow.city || firstPtRow.town;
                const ctyOpt = normalizeCityOption(cityVal);
                if (ctyOpt) {
                  nextFilters.city = ctyOpt;
                  if (!newCities.some((c) => c.value === ctyOpt.value)) {
                    newCities.push(ctyOpt);
                  }
                }
              }

              // Auto-fill patient's hospital if not selected
              if (!nextFilters.hospital && (firstPtRow.hospital_name || firstPtRow.hospital)) {
                const hospVal = firstPtRow.hospital_name || firstPtRow.hospital;
                const hOpt = normalizeHospitalOption({
                  hospital_name: hospVal,
                  hospital_id: firstPtRow.hospital_id,
                  city: firstPtRow.hospital_city || firstPtRow.city,
                  address: firstPtRow.hospital_address || firstPtRow.address,
                });
                if (hOpt) {
                  nextFilters.hospital = hOpt;
                  if (!newHospitals.some((h) => h.value === hOpt.value)) {
                    newHospitals.push(hOpt);
                  }
                }
              }

              // If patient has only 1 treatment, auto-fill it into nextFilters.treatment
              if (extracted.length === 1 && !nextFilters.treatment) {
                nextFilters.treatment = extracted[0];
              }
            }
          } catch (e) {
            console.warn("Could not fetch patient treatments for dropdown:", e);
          }
        }
      }

      // 3. Re-validate active selections: only reset downstream child filters if they are no longer in the list
      if (key === "country") {
        if (nextFilters.city && !isOptionInList(nextFilters.city, newCities)) nextFilters.city = null;
        if (nextFilters.hospital && !isOptionInList(nextFilters.hospital, newHospitals)) nextFilters.hospital = null;
        if (nextFilters.patient && !isOptionInList(nextFilters.patient, newPatients)) nextFilters.patient = null;
        if (nextFilters.treatment && !isOptionInList(nextFilters.treatment, newTreatments)) nextFilters.treatment = null;
      } else if (key === "city") {
        if (nextFilters.hospital && !isOptionInList(nextFilters.hospital, newHospitals)) nextFilters.hospital = null;
        if (nextFilters.patient && !isOptionInList(nextFilters.patient, newPatients)) nextFilters.patient = null;
        if (nextFilters.treatment && !isOptionInList(nextFilters.treatment, newTreatments)) nextFilters.treatment = null;
      } else if (key === "hospital") {
        if (nextFilters.patient && !isOptionInList(nextFilters.patient, newPatients)) nextFilters.patient = null;
        if (nextFilters.treatment && !isOptionInList(nextFilters.treatment, newTreatments)) nextFilters.treatment = null;
      } else if (key === "patient") {
        if (nextFilters.treatment && !isOptionInList(nextFilters.treatment, newTreatments)) nextFilters.treatment = null;
      }

      setDropdownOptions((prev) => {
        const mergedCountries = newCountries.length > 0 ? newCountries : prev.countries;
        const mergedCities = newCities.length > 0 ? newCities : prev.cities;
        const mergedHospitals = newHospitals.length > 0 ? newHospitals : prev.hospitals;
        const mergedPatients = newPatients.length > 0 ? newPatients : prev.patients;
        const mergedTreatments = newTreatments.length > 0 ? newTreatments : prev.treatments;
        const mergedHeads = newHeads.length > 0 ? newHeads : prev.heads;

        // Ensure currently selected filter options are always present in the dropdown list
        const ensureInList = (list, item, normalizer) => {
          if (!item) return list;
          if (list.some((x) => optionMatches(x, item))) return list;
          const norm = normalizer ? normalizer(item) : item;
          return norm ? [...list, norm] : list;
        };

        return {
          countries: ensureInList(mergedCountries, nextFilters.country, normalizeCountryOption),
          cities: ensureInList(mergedCities, nextFilters.city, normalizeCityOption),
          hospitals: ensureInList(mergedHospitals, nextFilters.hospital, normalizeHospitalOption),
          patients: ensureInList(mergedPatients, nextFilters.patient, normalizePatientOption),
          treatments: ensureInList(mergedTreatments, nextFilters.treatment, normalizeTreatmentOption),
          heads: mergedHeads,
        };
      });

      setFilters({ ...nextFilters });
    } catch (error) {
      if (reqId === filterReqId.current) {
        console.error("Failed to load tree filters:", error);
      }
    } finally {
      if (reqId === filterReqId.current) {
        setLoadingFilters(false);
      }
    }
  };

  /**
   * Handle row toggle for Accordion drilldown
   * Accordion behavior: "if click second first close and second will open"
   * Appends &drill=patients to the API call for that hospital
   */
  const handleToggleRow = async (row, rowIndex) => {
    const rowKey = row._id || row.id || `${page}-${rowIndex}`;
    const isDirectTreatment = Boolean(
      appliedFilters.patientId ||
      appliedFilters.patient ||
      appliedFilters.treatment_id ||
      appliedFilters.treatment ||
      row.treatment_id ||
      row.treatmentId ||
      (typeof row.hospital === "object" && (row.hospital?.charges || row.hospital?.payments || row.hospital?.treatment_fee)) ||
      (row.patientId && (row.treatment_name || row.treatment || row.course_name))
    );

    // If clicking the currently open row, close it
    if (expandedRowKey === rowKey) {
      setExpandedRowKey(null);
      setExpandedPatientKey(null);
      setExpandedTreatmentKey(null);
      return;
    }

    // Open this row (which closes any previously opened row)
    setExpandedRowKey(rowKey);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);

    if (isDirectTreatment) {
      if (!treatmentActiveSection[rowKey]) {
        setTreatmentActiveSection((prev) => ({
          ...prev,
          [rowKey]: "hospital",
        }));
      }
      return;
    }

    const hospitalName =
      row.hospital_name ||
      row.hospital ||
      row.hosp_name ||
      row.name ||
      "";

    if (!hospitalName) return;

    // If already cached and valid, no need to re-fetch
    if (patientCache[hospitalName]?.data && !patientCache[hospitalName]?.error) {
      return;
    }

    setPatientCache((prev) => ({
      ...prev,
      [hospitalName]: {
        loading: true,
        data: prev[hospitalName]?.data || [],
        error: null,
      },
    }));

    try {
      const result = await fetchHospitalPatients(hospitalName, appliedFilters);
      setPatientCache((prev) => ({
        ...prev,
        [hospitalName]: {
          loading: false,
          data: result.rows || [],
          summary: result.summary,
          totalRecords: result.totalRecords,
          error: null,
        },
      }));
    } catch (err) {
      console.error(`Failed to load patient drill data for ${hospitalName}:`, err);
      setPatientCache((prev) => ({
        ...prev,
        [hospitalName]: {
          loading: false,
          data: [],
          error:
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load patient records for this hospital",
        },
      }));
    }
  };

  /**
   * Retry loading patient records for a specific hospital
   */
  const handleRetryFetchPatients = async (hospitalName) => {
    if (!hospitalName) return;
    setPatientCache((prev) => ({
      ...prev,
      [hospitalName]: {
        loading: true,
        data: [],
        error: null,
      },
    }));

    try {
      const result = await fetchHospitalPatients(hospitalName, appliedFilters);
      setPatientCache((prev) => ({
        ...prev,
        [hospitalName]: {
          loading: false,
          data: result.rows || [],
          summary: result.summary,
          totalRecords: result.totalRecords,
          error: null,
        },
      }));
    } catch (err) {
      setPatientCache((prev) => ({
        ...prev,
        [hospitalName]: {
          loading: false,
          data: [],
          error:
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load patient records for this hospital",
        },
      }));
    }
  };

  /**
   * Handle Level 2 accordion toggle: Patient row
   * Accordion behavior: "if click second first close and second will open"
   * Appends &patientId={patientId} with hospital to drill down to treatments level
   */
  const handleTogglePatientRow = async (hospitalName, pt, ptIdx) => {
    const ptId =
      pt.patientId ||
      pt.patient_id ||
      pt.patient_uuid ||
      pt._id ||
      pt.id ||
      pt.name ||
      "";

    if (!ptId || !hospitalName) return;

    const patientKey = `${hospitalName}___${ptId}___${ptIdx}`;

    // If clicking the currently open patient row, close it
    if (expandedPatientKey === patientKey) {
      setExpandedPatientKey(null);
      setExpandedTreatmentKey(null);
      return;
    }

    // Open this patient row (closes any other open patient row)
    setExpandedPatientKey(patientKey);
    setExpandedTreatmentKey(null);

    // If already cached and valid, don't re-fetch
    if (treatmentCache[patientKey]?.data && !treatmentCache[patientKey]?.error) {
      return;
    }

    setTreatmentCache((prev) => ({
      ...prev,
      [patientKey]: {
        loading: true,
        data: prev[patientKey]?.data || [],
        error: null,
      },
    }));

    try {
      const result = await fetchPatientTreatments(hospitalName, ptId, appliedFilters);
      setTreatmentCache((prev) => ({
        ...prev,
        [patientKey]: {
          loading: false,
          data: result.rows || [],
          summary: result.summary,
          totalRecords: result.totalRecords,
          error: null,
        },
      }));
    } catch (err) {
      console.error(`Failed to load treatments for patient ${ptId} at ${hospitalName}:`, err);
      setTreatmentCache((prev) => ({
        ...prev,
        [patientKey]: {
          loading: false,
          data: [],
          error:
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load treatment records for this patient",
        },
      }));
    }
  };

  /**
   * Retry loading treatment records for a specific patient
   */
  const handleRetryFetchTreatments = async (hospitalName, pt, ptIdx) => {
    const ptId =
      pt.patientId ||
      pt.patient_id ||
      pt.patient_uuid ||
      pt._id ||
      pt.id ||
      pt.name ||
      "";

    if (!ptId || !hospitalName) return;
    const patientKey = `${hospitalName}___${ptId}___${ptIdx}`;

    setTreatmentCache((prev) => ({
      ...prev,
      [patientKey]: {
        loading: true,
        data: [],
        error: null,
      },
    }));

    try {
      const result = await fetchPatientTreatments(hospitalName, ptId, appliedFilters);
      setTreatmentCache((prev) => ({
        ...prev,
        [patientKey]: {
          loading: false,
          data: result.rows || [],
          summary: result.summary,
          totalRecords: result.totalRecords,
          error: null,
        },
      }));
    } catch (err) {
      setTreatmentCache((prev) => ({
        ...prev,
        [patientKey]: {
          loading: false,
          data: [],
          error:
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load treatment records for this patient",
        },
      }));
    }
  };

  /**
   * Handle Level 3 accordion toggle: Treatment row to show Payment History & Charges breakdown
   */
  const handleToggleTreatmentRow = (parentKey, tr, trIdx) => {
    const trId = tr.treatment_id || tr.treatmentId || tr.id || tr._id || trIdx;
    const treatmentKey = `${parentKey}___${trId}___${trIdx}`;

    if (expandedTreatmentKey === treatmentKey) {
      setExpandedTreatmentKey(null);
    } else {
      setExpandedTreatmentKey(treatmentKey);
      if (!treatmentActiveSection[treatmentKey]) {
        setTreatmentActiveSection((prev) => ({
          ...prev,
          [treatmentKey]: "hospital",
        }));
      }
    }
  };

  /**
   * Switch active section tab inside expanded treatment (Hospital, OMCA, Pharmacy, All)
   */
  const handleSectionChange = (treatmentKey, section) => {
    setTreatmentActiveSection((prev) => ({
      ...prev,
      [treatmentKey]: section,
    }));
  };

  /**
   * Search button click:
   * Fetches payment-data with current selected filters and resets page to 1
   */
  const handleSearch = () => {
    const queryParams = getQueryParams(filters);
    setAppliedFilters(queryParams);
    setPage(1);
    setExpandedRowKey(null);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);
    loadTableData(queryParams, 1, limit);
  };

  /**
   * Handle Click on Country row or item:
   * 1. Call: GET /api/payment-data?country=<CountryName>
   * 2. (Optional) Update/sync the 1st Dropdown (Country) to the clicked country.
   * 3. Sync tree filters for this country to load cities.
   */
  const handleCountryClick = async (countryName) => {
    if (!countryName) return;
    const countryOpt =
      dropdownOptions.countries.find(
        (c) =>
          String(c.value || c.label || c.country).toLowerCase() ===
          String(countryName).toLowerCase(),
      ) || { label: countryName, value: countryName, country: countryName };

    const nextFilters = {
      ...filters,
      country: countryOpt,
      city: null,
      hospital: null,
      patient: null,
      treatment: null,
    };

    setFilters(nextFilters);
    const newApplied = { country: countryName };
    setAppliedFilters(newApplied);
    setPage(1);
    setExpandedRowKey(null);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);

    loadDropdownOptions(nextFilters);
    await loadTableData(newApplied, 1, limit);
  };

  /**
   * Handle Click on City row or item:
   * 1. Call: GET /api/payment-data?country=<CountryName>&city=<CityName>
   * 2. (Optional) Update/sync the 2nd Dropdown (City) to the clicked city.
   * 3. Sync tree filters for this city to load hospitals.
   */
  const handleCityClick = async (cityName, countryName) => {
    if (!cityName) return;
    const resolvedCountry =
      countryName ||
      (typeof filters.country === "object"
        ? filters.country?.value || filters.country?.country || filters.country?.label
        : filters.country) ||
      appliedFilters.country ||
      "";

    const cityOpt =
      dropdownOptions.cities.find(
        (c) =>
          String(c.value || c.label || c.city).toLowerCase() ===
          String(cityName).toLowerCase(),
      ) || { label: cityName, value: cityName, city: cityName };

    const nextFilters = {
      ...filters,
      ...(resolvedCountry && !filters.country
        ? {
            country: {
              label: resolvedCountry,
              value: resolvedCountry,
              country: resolvedCountry,
            },
          }
        : {}),
      city: cityOpt,
      hospital: null,
      patient: null,
      treatment: null,
    };

    setFilters(nextFilters);
    const newApplied = omitEmpty({
      country: resolvedCountry,
      city: cityName,
    });
    setAppliedFilters(newApplied);
    setPage(1);
    setExpandedRowKey(null);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);

    loadDropdownOptions(nextFilters);
    await loadTableData(newApplied, 1, limit);
  };

  /**
   * Reset view to top-level All Countries
   */
  const handleResetToCountry = async () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters({});
    setPage(1);
    setExpandedRowKey(null);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);
    setPatientCache({});
    setTreatmentCache({});
    setCurrentLevel("country");
    await loadDropdownOptions(INITIAL_FILTERS);
    await loadTableData({}, 1, limit);
  };

  /**
   * Clear button click:
   * Resets all dropdowns, restores default tree-filters options, and reloads default table
   */
  const handleClear = async () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters({});
    setPage(1);
    setExpandedRowKey(null);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);
    setPatientCache({});
    setTreatmentCache({});
    setCurrentLevel("country");
    await loadDropdownOptions(INITIAL_FILTERS);
    await loadTableData({}, 1, limit);
  };

  /**
   * Pagination page change
   */
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    setExpandedRowKey(null);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);
    loadTableData(appliedFilters, newPage, limit);
  };

  /**
   * Rows per page (limit) change
   */
  const handleLimitChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setLimit(newLimit);
    setPage(1);
    setExpandedRowKey(null);
    setExpandedPatientKey(null);
    setExpandedTreatmentKey(null);
    loadTableData(appliedFilters, 1, newLimit);
  };

  /**
   * Export payment data (Excel) with all table data, nested patients, treatments, and calculated totals
   */
  const handleExport = async () => {
    try {
      setExporting(true);
      const queryParams = {
        ...getQueryParams(filters),
        ...getQueryParams(appliedFilters),
        ...appliedFilters,
      };

      let rootData = rows;
      let summaryToExport = summary;

      // 1. Attempt to fetch all matching records for the current filter criteria (up to 10000)
      try {
        const result = await fetchPaymentData({
          ...queryParams,
          page: 1,
          limit: 10000,
        });
        if (result && Array.isArray(result.rows) && result.rows.length > 0) {
          rootData = result.rows;
          if (result.summary) {
            summaryToExport = result.summary;
          }
        }
      } catch (err) {
        console.warn("Using table rows for export fallback:", err);
      }

      if (!rootData || rootData.length === 0) {
        Swal.fire("Info", "No payment data available to export", "info");
        return;
      }

      // 2. Expand all hospital patients and treatments recursively so all levels are exported
      const fullExportRows = await buildFullPaymentExportData(
        rootData,
        queryParams,
        patientCache,
        treatmentCache
      );

      // 3. Download complete Excel spreadsheet
      downloadPaymentDataExcel(fullExportRows, summaryToExport, queryParams);

      Swal.fire({
        icon: "success",
        title: "Export Successful",
        text: `Exported ${fullExportRows.length} payment records and treatment breakdowns to Excel successfully!`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Export error:", error);
      Swal.fire(
        "Export Failed",
        error?.message || "Failed to export payment data",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  /**
   * Export all treatments and payment records for a single patient to Excel
   */
  const handleExportPatient = async (hospitalName, pt, ptIdx, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const ptId =
      pt.patientId ||
      pt.patient_id ||
      pt.patient_uuid ||
      pt._id ||
      pt.id ||
      pt.name ||
      "";
    const patientKey = `${hospitalName}___${ptId}___${ptIdx}`;
    const ptName = pt.patient_name || pt.patientName || pt.name || ptId || "Patient";

    setExportingPatientKey(patientKey);
    try {
      let treatments = treatmentCache[patientKey]?.data;
      if (!Array.isArray(treatments) || treatments.length === 0) {
        // Fetch treatments if not yet loaded in cache
        const result = await fetchPatientTreatments(hospitalName, ptId, appliedFilters);
        treatments = result.rows || [];
        setTreatmentCache((prev) => ({
          ...prev,
          [patientKey]: {
            loading: false,
            data: treatments,
            summary: result.summary,
            totalRecords: result.totalRecords,
            error: null,
          },
        }));
      }

      const baseInfo = {
        hospitalName,
        country: pt.country || "",
        city: pt.city || pt.location || "",
        patientName: ptName,
        patientId: ptId,
      };

      const exportedCount = exportSinglePatientExcel(pt, treatments, baseInfo);
      Swal.fire({
        icon: "success",
        title: "Export Successful",
        text: `Exported ${treatments.length} treatment(s) (${exportedCount} records) for patient ${ptName} to Excel!`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Patient export error:", err);
      Swal.fire("Export Failed", err?.message || "Failed to export patient payment data", "error");
    } finally {
      setExportingPatientKey(null);
    }
  };

  /**
   * Export a single treatment and all itemized breakdown (Hospital, OMCA, Pharmacy, Payments) to Excel
   */
  const handleExportTreatment = (tr, baseInfo = {}, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const trId = tr.treatment_id || tr.treatmentId || tr.id || tr._id || "";
    const trName = tr.treatment_name || tr.treatment || tr.course_name || "Treatment";
    const treatmentKey = trId || trName;

    setExportingTreatmentKey(treatmentKey);
    try {
      const exportedCount = exportSingleTreatmentExcel(tr, baseInfo);
      Swal.fire({
        icon: "success",
        title: "Export Successful",
        text: `Exported treatment ${trName} (${exportedCount} records) to Excel successfully!`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Treatment export error:", err);
      Swal.fire("Export Failed", err?.message || "Failed to export treatment payment data", "error");
    } finally {
      setExportingTreatmentKey(null);
    }
  };

  /**
   * Navigate to Patient Detail page
   */
  const handleNavigatePatient = (row) => {
    const pId =
      row.patientId ||
      row.patient_id ||
      row.patient_uuid ||
      row._id ||
      row.id;

    if (pId) {
      navigate("/Admin/Patient-Detail", {
        state: {
          patientId: pId,
          enqId: row.enquiryId || row.enquiry_id || row.enqId,
          testid: row.testid || row.test_id || row.id,
          user_id: row.user_id || row.userId,
          createdAt: row.createdAt || row.created_at,
        },
      });
    }
  };

  /**
   * Navigate to Treatment tab on Patient Detail page
   */
  const handleNavigateTreatment = (row) => {
    const pId =
      row.patientId ||
      row.patient_id ||
      row.patient_uuid ||
      row._id ||
      row.id;
    const tId = row.treatment_id || row.treatmentId;

    if (pId) {
      localStorage.setItem("patientMainTab", "treatment");
      navigate("/Admin/Patient-Detail", {
        state: {
          patientId: pId,
          treatmentId: tId,
          tab: "treatment",
          mainTab: "treatment",
          enqId: row.enquiryId || row.enquiry_id || row.enqId,
          testid: row.testid || row.test_id || row.id,
          user_id: row.user_id || row.userId,
          createdAt: row.createdAt || row.created_at,
        },
      });
    } else if (tId) {
      navigate("/Admin/treatments");
    }
  };

  // Determine if rows have specific column keys
  const hasColumn = (key) =>
    rows.some((r) => r && (r[key] != null || r[key.toLowerCase()] != null));

  const getTableColSpan = () => {
    if (currentLevel === "country") return 9;
    if (currentLevel === "city") return 9;
    if (currentLevel === "hospital") return 10;
    return hasColumn("head") ? 11 : 10;
  };

  const selectedCountryName =
    appliedFilters.country ||
    (typeof filters.country === "object"
      ? filters.country?.country || filters.country?.value || filters.country?.label
      : filters.country) ||
    "";

  const selectedCityName =
    appliedFilters.city ||
    (typeof filters.city === "object"
      ? filters.city?.city || filters.city?.value || filters.city?.label
      : filters.city) ||
    "";

  const selectedHospitalName =
    appliedFilters.hospital ||
    (typeof filters.hospital === "object"
      ? filters.hospital?.hospital_name || filters.hospital?.name || filters.hospital?.value || filters.hospital?.label
      : filters.hospital) ||
    "";

  const selectedPatientName =
    (typeof filters.patient === "object"
      ? filters.patient?.patient_name || filters.patient?.patient || filters.patient?.name || filters.patient?.label
      : filters.patient) ||
    appliedFilters.patientName ||
    appliedFilters.patientId ||
    appliedFilters.patient_id ||
    "";

  const selectedTreatmentName =
    (typeof filters.treatment === "object"
      ? filters.treatment?.treatment_name || filters.treatment?.treatment || filters.treatment?.name || filters.treatment?.label
      : filters.treatment) ||
    appliedFilters.treatmentName ||
    appliedFilters.treatment_id ||
    appliedFilters.treatmentId ||
    "";

  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  const startEntry = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endEntry = Math.min(page * limit, totalRecords);

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header Bar */}
        <div className="row gx-3">
          <div className="col-md-12">
            <div className="country-top mb-3">
              <div className="topmainhd mb-0">
                <h6 style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b" }}>
                  Payment Data
                </h6>
                <p className="text-muted mb-0" style={{ fontSize: "13px" }}>
                  View, filter, and analyze payment records and billing summaries
                </p>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {/* View Mode Switcher */}
                <div
                  className="btn-group btn-group-sm p-1"
                  role="group"
                  style={{
                    backgroundColor: "#f1f5f9",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <button
                    type="button"
                    className={`btn btn-sm ${displayMode === "both" ? "btn-primary shadow-sm" : "btn-light text-secondary border-0"}`}
                    onClick={() => setDisplayMode("both")}
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "6px",
                      padding: "6px 14px",
                    }}
                    title="View both Visual Charts and Data Table"
                  >
                    <i className="fa fa-th-large me-1" /> Combined View
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${displayMode === "chart" ? "btn-primary shadow-sm" : "btn-light text-secondary border-0"}`}
                    onClick={() => setDisplayMode("chart")}
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "6px",
                      padding: "6px 14px",
                    }}
                    title="View Visual Analytics & Charts only"
                  >
                    <i className="fa fa-bar-chart me-1" /> Graphs Only
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${displayMode === "table" ? "btn-primary shadow-sm" : "btn-light text-secondary border-0"}`}
                    onClick={() => setDisplayMode("table")}
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "6px",
                      padding: "6px 14px",
                    }}
                    title="View Data Table only"
                  >
                    <i className="fa fa-table me-1" /> Table Only
                  </button>
                </div>

                <button
                  type="button"
                  className="add-button d-flex align-items-center gap-2"
                  disabled={exporting || loadingTable}
                  onClick={handleExport}
                  style={{
                    backgroundColor: "#1565c0",
                    color: "#ffffff",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    fontWeight: 600,
                  }}
                >
                  {exporting ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <i className="fa fa-file-excel-o" />
                  )}
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Blue Summary Metric Cards */}
          <div className="col-md-12 mb-4">
            <div className="row g-3">
              {/* Total Billing */}
              <div className="col-xl-3 col-lg-6 col-md-6 col-12">
                <div
                  style={{
                    background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                    borderRadius: "12px",
                    padding: "20px",
                    color: "#ffffff",
                    boxShadow: "0 4px 14px rgba(30, 58, 138, 0.25)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          opacity: 0.9,
                        }}
                      >
                        Total Billing
                      </span>
                      <h3
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          marginTop: "8px",
                          marginBottom: "0",
                          color: "#ffffff",
                        }}
                      >
                        {formatCurrency(summary?.total_billing ?? 0)}
                      </h3>
                    </div>
                    <div
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        borderRadius: "10px",
                        width: "48px",
                        height: "48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "22px",
                      }}
                    >
                      <i className="fa fa-calculator" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments Received */}
              <div className="col-xl-3 col-lg-6 col-md-6 col-12">
                <div
                  style={{
                    background: "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)",
                    borderRadius: "12px",
                    padding: "20px",
                    color: "#ffffff",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          opacity: 0.9,
                        }}
                      >
                        Payments Received
                      </span>
                      <h3
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          marginTop: "8px",
                          marginBottom: "0",
                          color: "#ffffff",
                        }}
                      >
                        {formatCurrency(summary?.payments_received ?? 0)}
                      </h3>
                    </div>
                    <div
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        borderRadius: "10px",
                        width: "48px",
                        height: "48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "22px",
                      }}
                    >
                      <i className="fa fa-check-circle" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dues Pending */}
              <div className="col-xl-3 col-lg-6 col-md-6 col-12">
                <div
                  style={{
                    background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                    borderRadius: "12px",
                    padding: "20px",
                    color: "#ffffff",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          opacity: 0.9,
                        }}
                      >
                        Dues Pending
                      </span>
                      <h3
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          marginTop: "8px",
                          marginBottom: "0",
                          color: "#ffffff",
                        }}
                      >
                        {formatCurrency(summary?.dues_pending ?? 0)}
                      </h3>
                    </div>
                    <div
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        borderRadius: "10px",
                        width: "48px",
                        height: "48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "22px",
                      }}
                    >
                      <i className="fa fa-clock-o" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Records */}
              <div className="col-xl-3 col-lg-6 col-md-6 col-12">
                <div
                  style={{
                    background: "linear-gradient(135deg, #1d4ed8 0%, #818cf8 100%)",
                    borderRadius: "12px",
                    padding: "20px",
                    color: "#ffffff",
                    boxShadow: "0 4px 14px rgba(29, 78, 216, 0.25)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          opacity: 0.9,
                        }}
                      >
                        Total Records
                      </span>
                      <h3
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          marginTop: "8px",
                          marginBottom: "0",
                          color: "#ffffff",
                        }}
                      >
                        {totalRecords.toLocaleString()}
                      </h3>
                    </div>
                    <div
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        borderRadius: "10px",
                        width: "48px",
                        height: "48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "22px",
                      }}
                    >
                      <i className="fa fa-list-alt" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar & Dropdowns Card */}
          <div className="col-md-12">
            <div
              className="main_content p-3 mb-4"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <div className="row g-3 align-items-end">
                {/* 1. Country Dropdown */}
                <div className="col-lg-2 col-md-4 col-sm-6 col-12">
                  <div className="field-set">
                    <label
                      style={{
                        color: "#1e3a8a",
                        fontWeight: 600,
                        fontSize: "13px",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      Country
                    </label>
                    <Autocomplete
                      options={dropdownOptions.countries}
                      value={filters.country}
                      loading={loadingFilters}
                      getOptionLabel={(option) => {
                        if (!option) return "";
                        if (typeof option === "string") return option;
                        return option.label || option.country || option.name || option.value || "";
                      }}
                      isOptionEqualToValue={(option, value) => {
                        if (!option || !value) return false;
                        const optVal = typeof option === "string" ? option : (option.value ?? option.country ?? option.label ?? "");
                        const valVal = typeof value === "string" ? value : (value.value ?? value.country ?? value.label ?? "");
                        return String(optVal).trim().toLowerCase() === String(valVal).trim().toLowerCase();
                      }}
                      onChange={(_, val) => handleFilterChange("country", val)}
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Select Country"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* 2. City Dropdown */}
                <div className="col-lg-2 col-md-4 col-sm-6 col-12">
                  <div className="field-set">
                    <label
                      style={{
                        color: "#1e3a8a",
                        fontWeight: 600,
                        fontSize: "13px",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      City
                    </label>
                    <Autocomplete
                      options={dropdownOptions.cities}
                      value={filters.city}
                      loading={loadingFilters}
                      getOptionLabel={(option) => {
                        if (!option) return "";
                        if (typeof option === "string") return option;
                        return option.label || option.city || option.name || option.value || "";
                      }}
                      isOptionEqualToValue={(option, value) => {
                        if (!option || !value) return false;
                        const optVal = typeof option === "string" ? option : (option.value ?? option.city ?? option.label ?? "");
                        const valVal = typeof value === "string" ? value : (value.value ?? value.city ?? value.label ?? "");
                        return String(optVal).trim().toLowerCase() === String(valVal).trim().toLowerCase();
                      }}
                      onChange={(_, val) => handleFilterChange("city", val)}
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Select City"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* 3. Hospital Dropdown */}
                <div className="col-lg-3 col-md-4 col-sm-6 col-12">
                  <div className="field-set">
                    <label
                      style={{
                        color: "#1e3a8a",
                        fontWeight: 600,
                        fontSize: "13px",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      Hospital
                    </label>
                    <Autocomplete
                      options={dropdownOptions.hospitals}
                      value={filters.hospital}
                      loading={loadingFilters}
                      getOptionLabel={(option) => {
                        if (!option) return "";
                        if (typeof option === "string") return option;
                        return (
                          option.label ||
                          option.hospital_name ||
                          option.name ||
                          option.value ||
                          ""
                        );
                      }}
                      isOptionEqualToValue={(option, value) => {
                        if (!option || !value) return false;
                        const optVal = typeof option === "string" ? option : (option.value ?? option.hospital_name ?? option.name ?? option.label ?? "");
                        const valVal = typeof value === "string" ? value : (value.value ?? value.hospital_name ?? value.name ?? value.label ?? "");
                        return String(optVal).trim().toLowerCase() === String(valVal).trim().toLowerCase();
                      }}
                      onChange={(_, val) => handleFilterChange("hospital", val)}
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Select Hospital"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* 4. Patient Dropdown */}
                <div className="col-lg-2 col-md-4 col-sm-6 col-12">
                  <div className="field-set">
                    <label
                      style={{
                        color: "#1e3a8a",
                        fontWeight: 600,
                        fontSize: "13px",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      Patient
                    </label>
                    <Autocomplete
                      options={dropdownOptions.patients}
                      value={filters.patient}
                      loading={loadingFilters}
                      getOptionLabel={(option) => {
                        if (!option) return "";
                        if (typeof option === "string") return option;
                        return (
                          option.label ||
                          option.patient_name ||
                          option.name ||
                          option.value ||
                          ""
                        );
                      }}
                      isOptionEqualToValue={(option, value) => {
                        if (!option || !value) return false;
                        const optVal = typeof option === "string" ? option : (option.value ?? option.patientId ?? option.patient_name ?? option.label ?? "");
                        const valVal = typeof value === "string" ? value : (value.value ?? value.patientId ?? value.patient_name ?? value.label ?? "");
                        return String(optVal).trim().toLowerCase() === String(valVal).trim().toLowerCase();
                      }}
                      onChange={(_, val) => handleFilterChange("patient", val)}
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Select Patient"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* 5. Treatment Dropdown */}
                <div className="col-lg-3 col-md-4 col-sm-6 col-12">
                  <div className="field-set">
                    <label
                      style={{
                        color: "#1e3a8a",
                        fontWeight: 600,
                        fontSize: "13px",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      Treatment
                    </label>
                    <Autocomplete
                      options={dropdownOptions.treatments}
                      value={filters.treatment}
                      loading={loadingFilters}
                      getOptionLabel={(option) => {
                        if (!option) return "";
                        if (typeof option === "string") return option;
                        return (
                          option.label ||
                          option.treatment_name ||
                          option.name ||
                          option.value ||
                          ""
                        );
                      }}
                      isOptionEqualToValue={(option, value) => {
                        if (!option || !value) return false;
                        const optVal = typeof option === "string" ? option : (option.value ?? option.treatment_id ?? option.treatment_name ?? option.label ?? "");
                        const valVal = typeof value === "string" ? value : (value.value ?? value.treatment_id ?? value.treatment_name ?? value.label ?? "");
                        return String(optVal).trim().toLowerCase() === String(valVal).trim().toLowerCase();
                      }}
                      onChange={(_, val) => handleFilterChange("treatment", val)}
                      ListboxProps={{ style: { maxHeight: 250 } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Select Treatment"
                          sx={autocompleteSx}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* Search & Clear Buttons */}
                <div className="col-12 d-flex justify-content-end gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-primary d-flex align-items-center gap-2"
                    disabled={loadingTable}
                    onClick={handleSearch}
                    style={{
                      backgroundColor: "#1e3a8a",
                      borderColor: "#1e3a8a",
                      padding: "8px 20px",
                      fontWeight: 600,
                      borderRadius: "6px",
                    }}
                  >
                    {loadingTable ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <i className="fa fa-search" />
                    )}
                    Search
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary d-flex align-items-center gap-2"
                    disabled={loadingTable || loadingFilters}
                    onClick={handleClear}
                    style={{
                      padding: "8px 18px",
                      fontWeight: 600,
                      borderRadius: "6px",
                    }}
                  >
                    <i className="fa fa-refresh" />
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Data Table Card (Placed on Top) */}
          {(displayMode === "both" || displayMode === "table") && (
            <div className="col-md-12">
              <div
                className="main_content p-3"
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "10px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                {/* Table Toolbar / Rows per page */}
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                      Show
                    </span>
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={limit}
                        onChange={handleLimitChange}
                        sx={{ height: 34, fontSize: "13px" }}
                      >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={20}>20</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                      </Select>
                    </FormControl>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                      entries per page
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                      style={{ fontSize: "12px", borderRadius: "6px", padding: "4px 10px" }}
                      onClick={() => setDisplayMode(displayMode === "table" ? "both" : "table")}
                      title={displayMode === "table" ? "Show Visual Analytics & Graphs Below" : "Hide Graphs"}
                    >
                      <i className={`fa ${displayMode === "table" ? "fa-bar-chart" : "fa-eye-slash"}`} />
                      <span>{displayMode === "table" ? "Show Graphs" : "Hide Graphs"}</span>
                    </button>
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                      Showing {startEntry} to {endEntry} of {totalRecords} records
                    </span>
                  </div>
                </div>

              {/* Level Breadcrumb Bar */}
              <div className="d-flex align-items-center justify-content-between mb-2 px-1 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: "13px" }}>
                  <span className="text-muted fw-semibold">Navigation:</span>
                  <button
                    type="button"
                    className={`btn btn-sm ${currentLevel === "country" ? "btn-primary" : "btn-light border"}`}
                    onClick={handleResetToCountry}
                    style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "16px" }}
                    title="View all countries"
                  >
                    <i className="fa fa-globe me-1" /> All Countries
                  </button>
                  {selectedCountryName && (
                    <>
                      <i className="fa fa-angle-right text-muted" />
                      <button
                        type="button"
                        className={`btn btn-sm ${currentLevel === "city" ? "btn-primary" : "btn-light border"}`}
                        onClick={() => handleCountryClick(selectedCountryName)}
                        style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "16px" }}
                        title="Back to Cities for this Country"
                      >
                        <i className="fa fa-map-marker text-danger me-1" />
                        {selectedCountryName}
                      </button>
                    </>
                  )}
                  {selectedCityName && (
                    <>
                      <i className="fa fa-angle-right text-muted" />
                      <button
                        type="button"
                        className={`btn btn-sm ${currentLevel === "hospital" ? "btn-primary" : "btn-light border"}`}
                        onClick={() => handleCityClick(selectedCityName, selectedCountryName)}
                        style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "16px" }}
                        title="Hospitals in this City"
                      >
                        <i className="fa fa-building-o text-info me-1" />
                        {selectedCityName}
                      </button>
                    </>
                  )}
                  {selectedHospitalName && (
                    <>
                      <i className="fa fa-angle-right text-muted" />
                      <span
                        className={`badge ${currentLevel === "hospital" ? "bg-primary text-white" : "bg-light text-dark border"}`}
                        style={{ fontSize: "12px", padding: "5px 10px", borderRadius: "16px" }}
                      >
                        <i className="fa fa-hospital-o me-1" />
                        {selectedHospitalName}
                      </span>
                    </>
                  )}
                  {selectedPatientName && (
                    <>
                      <i className="fa fa-angle-right text-muted" />
                      <span
                        className={`badge ${currentLevel === "treatment" && !selectedTreatmentName ? "bg-primary text-white" : "bg-light text-dark border"}`}
                        style={{ fontSize: "12px", padding: "5px 10px", borderRadius: "16px" }}
                      >
                        <i className="fa fa-user me-1" />
                        Patient: {selectedPatientName}
                      </span>
                    </>
                  )}
                  {selectedTreatmentName && (
                    <>
                      <i className="fa fa-angle-right text-muted" />
                      <span
                        className="badge bg-primary text-white"
                        style={{ fontSize: "12px", padding: "5px 10px", borderRadius: "16px" }}
                      >
                        <i className="fa fa-stethoscope me-1" />
                        Treatment: {selectedTreatmentName}
                      </span>
                    </>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-light text-secondary border" style={{ fontSize: "11px" }}>
                    Level: <strong className="text-dark text-capitalize">{currentLevel}</strong>
                  </span>
                </div>
              </div>

              {/* Data Table */}
              <div className="table-responsive">
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <Table size="small" aria-label="Payment Data Table">
                    <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                      {currentLevel === "country" ? (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5, width: 60 }}>
                            #
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Country
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#1e3a8a", py: 1.5 }}>
                            Total Billing
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#0284c7", py: 1.5 }}>
                            Payments Received
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#e11d48", py: 1.5 }}>
                            Dues Pending
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Cities
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Hospitals
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Treatments
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Action
                          </TableCell>
                        </TableRow>
                      ) : currentLevel === "city" ? (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5, width: 60 }}>
                            #
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            City
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Country
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#1e3a8a", py: 1.5 }}>
                            Total Billing
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#0284c7", py: 1.5 }}>
                            Payments Received
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#e11d48", py: 1.5 }}>
                            Dues Pending
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Hospitals
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Treatments
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Action
                          </TableCell>
                        </TableRow>
                      ) : currentLevel === "hospital" ? (
                        <TableRow>
                          <TableCell
                            sx={{
                              width: 44,
                              fontWeight: 700,
                              color: "#334155",
                              py: 1.5,
                              textAlign: "center",
                            }}
                            aria-label="Expand"
                          >
                            <i className="fa fa-chevron-down text-muted" style={{ fontSize: "11px", opacity: 0.5 }} />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5, width: 60 }}>
                            #
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Hospital
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            City
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Address
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#1e3a8a", py: 1.5 }}>
                            Total Billing
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#0284c7", py: 1.5 }}>
                            Payments Received
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#e11d48", py: 1.5 }}>
                            Dues Pending
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Treatments
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Action
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow>
                          <TableCell
                            sx={{
                              width: 44,
                              fontWeight: 700,
                              color: "#334155",
                              py: 1.5,
                              textAlign: "center",
                            }}
                            aria-label="Expand"
                          >
                            <i className="fa fa-chevron-down text-muted" style={{ fontSize: "11px", opacity: 0.5 }} />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            #
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Country
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            City
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Hospital
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Patient
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                            Treatment
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, color: "#1e3a8a", py: 1.5 }}
                          >
                            Total Billing
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, color: "#0284c7", py: 1.5 }}
                          >
                            Payments Received
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, color: "#e11d48", py: 1.5 }}
                          >
                            Dues Pending
                          </TableCell>
                          {hasColumn("head") && (
                            <TableCell sx={{ fontWeight: 700, color: "#334155", py: 1.5 }}>
                              Head
                            </TableCell>
                          )}
                        </TableRow>
                      )}
                    </TableHead>

                    <TableBody>
                      {loadingTable ? (
                        <TableRow>
                          <TableCell colSpan={getTableColSpan()} align="center" sx={{ py: 6 }}>
                            <CircularProgress size={32} sx={{ color: "#1e3a8a" }} />
                            <p className="mt-2 text-muted mb-0" style={{ fontSize: "13px" }}>
                              Loading payment data...
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={getTableColSpan()} align="center" sx={{ py: 6 }}>
                            <div className="py-3">
                              <i
                                className="fa fa-folder-open-o text-muted mb-2"
                                style={{ fontSize: "36px" }}
                              />
                              <p
                                className="fw-semibold text-secondary mb-1"
                                style={{ fontSize: "15px" }}
                              >
                                No payment data found
                              </p>
                              <small className="text-muted">
                                Try changing or clearing your filter criteria
                              </small>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row, index) => {
                          const rowKey = row._id || row.id || `${page}-${index}`;
                          const isExpanded = expandedRowKey === rowKey;

                          const countryName =
                            row.country ||
                            row.country_name ||
                            (!row.patient_name && !row.patient && !row.patientId && !row.treatment_name && !row.treatment_id && !row.hospital_name ? row.name : "") ||
                            "";

                          const cityName = row.city || row.town || row.city_name || "";
                          const hospitalName =
                            row.hospital_name ||
                            row.hospital ||
                            row.hosp_name ||
                            "";

                          const patientId = row.patientId || row.patient_id || "";
                          let patientName =
                            row.patient_name ||
                            row.patient ||
                            row.Patient ||
                            "";

                          if (!patientName && row.name && patientId) {
                            patientName = row.name;
                          }

                          const treatmentId = row.treatment_id || row.treatmentId || "";
                          let treatmentName =
                            row.treatment_name ||
                            row.treatment ||
                            row.Treatment ||
                            row.course_name ||
                            "";

                          if (!treatmentName && row.name && treatmentId) {
                            treatmentName = row.name;
                          }

                          const totalBilling =
                            row.total_billing ??
                            row.totalBilling ??
                            row.billing ??
                            row.amount;
                          const paymentsReceived =
                            row.payments_received ??
                            row.paymentsReceived ??
                            row.amount_paid ??
                            row.paid;
                          const duesPending =
                            row.dues_pending ??
                            row.duesPending ??
                            row.remaining_balance ??
                            row.dues;

                          const head = row.head || row.paidTo || "";

                          const isDirectTreatment = Boolean(
                            appliedFilters.patientId ||
                            appliedFilters.patient ||
                            appliedFilters.treatment_id ||
                            appliedFilters.treatment ||
                            row.treatment_id ||
                            row.treatmentId ||
                            (typeof row.hospital === "object" && (row.hospital?.charges || row.hospital?.payments || row.hospital?.treatment_fee)) ||
                            (row.patientId && (row.treatment_name || row.treatment || row.course_name))
                          );

                          const hasPatientNav = Boolean(patientId || row.patient_name || row.patient);
                          const hasTreatmentNav = Boolean(treatmentId || row.treatment_name || row.treatment || patientId);

                          const cachedPatientInfo = patientCache[hospitalName] || {
                            loading: false,
                            data: [],
                            error: null,
                          };

                          const cityCount = row.city_count ?? row.cities_count ?? row.cities ?? "—";
                          const hospitalCount = row.hospital_count ?? row.hospitals_count ?? row.hospitals ?? "—";
                          const treatmentCount = row.treatment_count ?? row.treatments_count ?? row.treatments ?? "—";
                          const address = row.address || row.hosp_address || "—";

                          if (currentLevel === "country") {
                            return (
                              <React.Fragment key={rowKey}>
                                <TableRow
                                  hover
                                  onClick={() => handleCountryClick(countryName)}
                                  sx={{
                                    cursor: "pointer",
                                    backgroundColor: index % 2 === 1 ? "#fcfdfe" : "#ffffff",
                                    transition: "background-color 0.15s ease",
                                    "&:hover": {
                                      backgroundColor: "#eff6ff !important",
                                    },
                                  }}
                                  title={`Click to view cities in ${countryName}`}
                                >
                                  <TableCell sx={{ py: 1.4, color: "#64748b", fontSize: "13px" }}>
                                    {(page - 1) * limit + index + 1}
                                  </TableCell>
                                  <TableCell sx={{ py: 1.4, fontSize: "14px", fontWeight: 600, color: "#1e3a8a" }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <i className="fa fa-globe text-primary" style={{ fontSize: "15px" }} />
                                      <span style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>
                                        {formatCell(countryName)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      py: 1.4,
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: "#1e3a8a",
                                    }}
                                  >
                                    {formatCurrency(totalBilling)}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      py: 1.4,
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: "#0284c7",
                                    }}
                                  >
                                    {formatCurrency(paymentsReceived)}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      py: 1.4,
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: parseNumeric(duesPending) > 0 ? "#e11d48" : "#64748b",
                                    }}
                                  >
                                    {formatCurrency(duesPending)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.4, fontSize: "13px" }}>
                                    {cityCount !== "—" ? (
                                      <span className="badge bg-light text-dark border">{cityCount}</span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.4, fontSize: "13px" }}>
                                    {hospitalCount !== "—" ? (
                                      <span className="badge bg-light text-primary border">{hospitalCount}</span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.4, fontSize: "13px" }}>
                                    {treatmentCount !== "—" ? (
                                      <span className="badge bg-light text-secondary border">{treatmentCount}</span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.4, fontSize: "13px" }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                      style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "4px", fontWeight: 600 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCountryClick(countryName);
                                      }}
                                    >
                                      <span>View Cities</span>
                                      <i className="fa fa-arrow-right" style={{ fontSize: "10px" }} />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          }

                          if (currentLevel === "city") {
                            return (
                              <React.Fragment key={rowKey}>
                                <TableRow
                                  hover
                                  onClick={() => handleCityClick(cityName, countryName)}
                                  sx={{
                                    cursor: "pointer",
                                    backgroundColor: index % 2 === 1 ? "#fcfdfe" : "#ffffff",
                                    transition: "background-color 0.15s ease",
                                    "&:hover": {
                                      backgroundColor: "#eff6ff !important",
                                    },
                                  }}
                                  title={`Click to view hospitals in ${cityName}`}
                                >
                                  <TableCell sx={{ py: 1.4, color: "#64748b", fontSize: "13px" }}>
                                    {(page - 1) * limit + index + 1}
                                  </TableCell>
                                  <TableCell sx={{ py: 1.4, fontSize: "14px", fontWeight: 600, color: "#1e3a8a" }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <i className="fa fa-building-o text-info" style={{ fontSize: "14px" }} />
                                      <span style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>
                                        {formatCell(cityName)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell sx={{ py: 1.4, fontSize: "13px" }}>
                                    <span className="badge bg-light text-dark border">
                                      {formatCell(countryName || appliedFilters.country || "—")}
                                    </span>
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      py: 1.4,
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: "#1e3a8a",
                                    }}
                                  >
                                    {formatCurrency(totalBilling)}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      py: 1.4,
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: "#0284c7",
                                    }}
                                  >
                                    {formatCurrency(paymentsReceived)}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      py: 1.4,
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: parseNumeric(duesPending) > 0 ? "#e11d48" : "#64748b",
                                    }}
                                  >
                                    {formatCurrency(duesPending)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.4, fontSize: "13px" }}>
                                    {hospitalCount !== "—" ? (
                                      <span className="badge bg-light text-primary border">{hospitalCount}</span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.4, fontSize: "13px" }}>
                                    {treatmentCount !== "—" ? (
                                      <span className="badge bg-light text-secondary border">{treatmentCount}</span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.4, fontSize: "13px" }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                      style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "4px", fontWeight: 600 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCityClick(cityName, countryName);
                                      }}
                                    >
                                      <span>View Hospitals</span>
                                      <i className="fa fa-arrow-right" style={{ fontSize: "10px" }} />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={rowKey}>
                              <TableRow
                                hover
                                onClick={() => handleToggleRow(row, index)}
                                sx={{
                                  cursor: "pointer",
                                  backgroundColor: isExpanded
                                    ? "#eff6ff !important"
                                    : index % 2 === 1
                                    ? "#fcfdfe"
                                    : "#ffffff",
                                  transition: "background-color 0.2s ease",
                                  "&:hover": {
                                    backgroundColor: isExpanded
                                      ? "#e0e7ff !important"
                                      : "#f1f5f9 !important",
                                  },
                                  ...(isExpanded && {
                                    borderLeft: isDirectTreatment ? "3px solid #818cf8" : "3px solid #2563eb",
                                  }),
                                }}
                              >
                                {currentLevel === "hospital" ? (
                                  <>
                                    {/* Expand Button */}
                                    <TableCell
                                      sx={{
                                        py: 1.2,
                                        width: 44,
                                        textAlign: "center",
                                        paddingLeft: "12px",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleRow(row, index);
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-light p-0"
                                        style={{
                                          width: "24px",
                                          height: "24px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          borderRadius: "4px",
                                          backgroundColor: isExpanded ? "#2563eb" : "#f1f5f9",
                                          borderColor: isExpanded ? "#2563eb" : "#cbd5e1",
                                          color: isExpanded ? "#ffffff" : "#475569",
                                          transition: "all 0.2s ease",
                                        }}
                                        title={
                                          isExpanded
                                            ? "Collapse patient list"
                                            : "Expand to view patients for this hospital"
                                        }
                                      >
                                        <i
                                          className="fa fa-chevron-right"
                                          style={{
                                            fontSize: "10px",
                                            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                            transition: "transform 0.2s ease",
                                          }}
                                        />
                                      </button>
                                    </TableCell>
                                    <TableCell sx={{ py: 1.2, color: "#64748b", fontSize: "13px" }}>
                                      {(page - 1) * limit + index + 1}
                                    </TableCell>
                                    <TableCell
                                      sx={{
                                        py: 1.2,
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: "#1e293b",
                                      }}
                                    >
                                      <div className="d-flex align-items-center gap-1">
                                        <i className="fa fa-hospital-o text-primary opacity-75" style={{ fontSize: "13px" }} />
                                        <span>{formatCell(hospitalName)}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell sx={{ py: 1.2, fontSize: "13px" }}>
                                      {cityName ? formatCell(cityName) : "—"}
                                    </TableCell>
                                    <TableCell sx={{ py: 1.2, fontSize: "13px", color: "#64748b" }}>
                                      {address}
                                    </TableCell>
                                    <TableCell
                                      align="right"
                                      sx={{
                                        py: 1.2,
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: "#1e3a8a",
                                      }}
                                    >
                                      {formatCurrency(totalBilling)}
                                    </TableCell>
                                    <TableCell
                                      align="right"
                                      sx={{
                                        py: 1.2,
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: "#0284c7",
                                      }}
                                    >
                                      {formatCurrency(paymentsReceived)}
                                    </TableCell>
                                    <TableCell
                                      align="right"
                                      sx={{
                                        py: 1.2,
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color:
                                          parseNumeric(duesPending) > 0
                                            ? "#e11d48"
                                            : "#64748b",
                                      }}
                                    >
                                      {formatCurrency(duesPending)}
                                    </TableCell>
                                    <TableCell align="center" sx={{ py: 1.2, fontSize: "13px" }}>
                                      {treatmentCount !== "—" ? (
                                        <span className="badge bg-light text-secondary border">{treatmentCount}</span>
                                      ) : (
                                        "—"
                                      )}
                                    </TableCell>
                                    <TableCell align="center" sx={{ py: 1.2, fontSize: "13px" }}>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1"
                                        style={{ fontSize: "11px", padding: "3px 8px" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleRow(row, index);
                                        }}
                                      >
                                        <span>{isExpanded ? "Close" : "Patients"}</span>
                                        <i className={`fa fa-chevron-${isExpanded ? "up" : "down"}`} style={{ fontSize: "10px" }} />
                                      </button>
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                {/* Expand / Accordion Toggle Button */}
                                <TableCell
                                  sx={{
                                    py: 1.2,
                                    width: 44,
                                    textAlign: "center",
                                    paddingLeft: "12px",
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleRow(row, index);
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light p-0"
                                    style={{
                                      width: "24px",
                                      height: "24px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius: "4px",
                                      backgroundColor: isExpanded ? (isDirectTreatment ? "#4f46e5" : "#2563eb") : "#f1f5f9",
                                      borderColor: isExpanded ? (isDirectTreatment ? "#4f46e5" : "#2563eb") : "#cbd5e1",
                                      color: isExpanded ? "#ffffff" : "#475569",
                                      transition: "all 0.2s ease",
                                    }}
                                    title={
                                      isExpanded
                                        ? isDirectTreatment
                                          ? "Collapse treatment breakdown"
                                          : "Collapse patient list"
                                        : isDirectTreatment
                                        ? "Expand treatment charges & payments breakdown"
                                        : "Expand to view patients for this hospital"
                                    }
                                  >
                                    <i
                                      className={`fa fa-chevron-right`}
                                      style={{
                                        fontSize: "10px",
                                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                        transition: "transform 0.2s ease",
                                      }}
                                    />
                                  </button>
                                </TableCell>

                                <TableCell sx={{ py: 1.2, color: "#64748b", fontSize: "13px" }}>
                                  {(page - 1) * limit + index + 1}
                                </TableCell>
                                <TableCell sx={{ py: 1.2, fontSize: "13px" }}>
                                  {countryName ? (
                                    <span className="badge bg-light text-dark border">
                                      {formatCell(countryName)}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell sx={{ py: 1.2, fontSize: "13px" }}>
                                  {cityName ? formatCell(cityName) : "—"}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    py: 1.2,
                                    fontSize: "13px",
                                    fontWeight: hospitalName ? 600 : 400,
                                    color: hospitalName ? "#1e293b" : "inherit",
                                  }}
                                >
                                  {hospitalName ? (
                                    <div className="d-flex align-items-center gap-1">
                                      <i className="fa fa-hospital-o text-primary opacity-75" style={{ fontSize: "12px" }} />
                                      <span>{formatCell(hospitalName)}</span>
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell sx={{ py: 1.2, fontSize: "13px" }}>
                                  {patientName || patientId ? (
                                    hasPatientNav ? (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleNavigatePatient(row);
                                        }}
                                        style={{
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          flexDirection: "column",
                                        }}
                                        title="Click to view Patient Details"
                                      >
                                        <span
                                          style={{
                                            color: "#2563eb",
                                            fontWeight: 600,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                          }}
                                        >
                                          {patientName || "—"}
                                          <i
                                            className="fa fa-external-link"
                                            style={{ fontSize: "11px", opacity: 0.6 }}
                                          />
                                        </span>
                                        {patientId && patientId !== patientName ? (
                                          <small className="text-muted" style={{ fontSize: "11px" }}>
                                            ID: {patientId}
                                          </small>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="fw-semibold text-dark">
                                          {patientName || "—"}
                                        </div>
                                        {patientId && patientId !== patientName ? (
                                          <small className="text-muted">
                                            ID: {patientId}
                                          </small>
                                        ) : null}
                                      </>
                                    )
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell sx={{ py: 1.2, fontSize: "13px" }}>
                                  {treatmentName || treatmentId ? (
                                    hasTreatmentNav ? (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleNavigateTreatment(row);
                                        }}
                                        style={{
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          flexDirection: "column",
                                        }}
                                        title="Click to view Treatment Details"
                                      >
                                        <span
                                          style={{
                                            color: "#0f766e",
                                            fontWeight: 600,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                          }}
                                        >
                                          {treatmentName || "—"}
                                          <i
                                            className="fa fa-external-link"
                                            style={{ fontSize: "11px", opacity: 0.6 }}
                                          />
                                        </span>
                                        {treatmentId && treatmentId !== treatmentName ? (
                                          <small className="text-muted" style={{ fontSize: "11px" }}>
                                            ID: {treatmentId}
                                          </small>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="fw-semibold text-dark">
                                          {treatmentName || "—"}
                                        </div>
                                        {treatmentId && treatmentId !== treatmentName ? (
                                          <small className="text-muted">
                                            ID: {treatmentId}
                                          </small>
                                        ) : null}
                                      </>
                                    )
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    py: 1.2,
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "#1e3a8a",
                                  }}
                                >
                                  {formatCurrency(totalBilling)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    py: 1.2,
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "#0284c7",
                                  }}
                                >
                                  {formatCurrency(paymentsReceived)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    py: 1.2,
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color:
                                      parseNumeric(duesPending) > 0
                                        ? "#e11d48"
                                        : "#64748b",
                                  }}
                                >
                                  {formatCurrency(duesPending)}
                                </TableCell>
                                {hasColumn("head") && (
                                  <TableCell sx={{ py: 1.2, fontSize: "13px" }}>
                                    <span className="badge bg-secondary">
                                      {formatCell(head)}
                                    </span>
                                  </TableCell>
                                )}
                              </>
                            )}
                          </TableRow>

                              {/* Nested Accordion Row: Direct Treatment breakdown vs Hospital Patients Drilldown */}
                              {isExpanded && (
                                <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                                  <TableCell
                                    colSpan={getTableColSpan()}
                                    sx={{
                                      p: 0,
                                      borderBottom: isDirectTreatment ? "2px solid #818cf8" : "2px solid #cbd5e1",
                                      borderTop: "none",
                                    }}
                                  >
                                    {isDirectTreatment ? (
                                      renderTreatmentBreakdownContent({
                                        tr: row,
                                        treatmentKey: rowKey,
                                        activeSec: treatmentActiveSection[rowKey] || "hospital",
                                        onSectionChange: handleSectionChange,
                                        onNavigatePatient: handleNavigatePatient,
                                        onExportTreatment: handleExportTreatment,
                                        fallbackHospitalName: hospitalName,
                                        fallbackPatientName: patientName,
                                        fallbackPatientId: patientId,
                                      })
                                    ) : (
                                      <div
                                        style={{
                                          margin: "12px 16px 20px 24px",
                                          padding: "16px",
                                          backgroundColor: "#ffffff",
                                          borderRadius: "10px",
                                          border: "1px solid #e2e8f0",
                                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                                        }}
                                      >
                                        {/* Drilldown Header Banner */}
                                        <div className="d-flex flex-wrap align-items-center justify-content-between pb-3 mb-3 border-bottom gap-2">
                                          <div className="d-flex align-items-center gap-2">
                                            <div
                                              style={{
                                                width: "32px",
                                                height: "32px",
                                                borderRadius: "8px",
                                                backgroundColor: "#eff6ff",
                                                color: "#2563eb",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "16px",
                                              }}
                                            >
                                              <i className="fa fa-users" />
                                            </div>
                                            <div>
                                              <h6
                                                className="mb-0 fw-bold"
                                                style={{ fontSize: "15px", color: "#1e293b" }}
                                              >
                                                Patients under {hospitalName || "Hospital"}
                                              </h6>
                                              <small className="text-muted" style={{ fontSize: "12px" }}>
                                                Drilldown Breakdown (&drill=patients)
                                              </small>
                                            </div>
                                          </div>

                                        <div className="d-flex align-items-center gap-2">
                                          {!cachedPatientInfo.loading && !cachedPatientInfo.error && (
                                            <span
                                              className="badge"
                                              style={{
                                                backgroundColor: "#eff6ff",
                                                color: "#1e40af",
                                                border: "1px solid #bfdbfe",
                                                fontSize: "12px",
                                                padding: "6px 10px",
                                                fontWeight: 600,
                                              }}
                                            >
                                              {cachedPatientInfo.data?.length || 0} Patient
                                              {cachedPatientInfo.data?.length === 1 ? "" : "s"}
                                            </span>
                                          )}

                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                                            disabled={cachedPatientInfo.loading}
                                            onClick={() => handleRetryFetchPatients(hospitalName)}
                                            style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "5px" }}
                                            title="Refresh patients list"
                                          >
                                            <i
                                              className={`fa fa-refresh ${cachedPatientInfo.loading ? "fa-spin" : ""}`}
                                            />
                                            Refresh
                                          </button>
                                        </div>
                                      </div>

                                      {/* Drilldown Content State */}
                                      {cachedPatientInfo.loading ? (
                                        <div className="text-center py-4">
                                          <CircularProgress size={26} sx={{ color: "#2563eb" }} />
                                          <p className="mt-2 text-muted mb-0" style={{ fontSize: "13px" }}>
                                            Fetching patient records for <strong>{hospitalName}</strong>...
                                          </p>
                                        </div>
                                      ) : cachedPatientInfo.error ? (
                                        <div className="alert alert-danger d-flex align-items-center justify-content-between my-2 p-2 px-3">
                                          <div className="d-flex align-items-center gap-2" style={{ fontSize: "13px" }}>
                                            <i className="fa fa-exclamation-triangle" />
                                            <span>{cachedPatientInfo.error}</span>
                                          </div>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleRetryFetchPatients(hospitalName)}
                                            style={{ fontSize: "12px" }}
                                          >
                                            Retry
                                          </button>
                                        </div>
                                      ) : !cachedPatientInfo.data || cachedPatientInfo.data.length === 0 ? (
                                        <div className="text-center py-4 text-muted">
                                          <i
                                            className="fa fa-user-times mb-2"
                                            style={{ fontSize: "28px", opacity: 0.5 }}
                                          />
                                          <p className="mb-0 fw-medium" style={{ fontSize: "13px" }}>
                                            No patient records found under {hospitalName || "this hospital"}.
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="table-responsive">
                                          <Table size="small" aria-label="Hospital Patients Table">
                                            <TableHead sx={{ backgroundColor: "#f1f5f9" }}>
                                              <TableRow>
                                                <TableCell
                                                  sx={{
                                                    width: 36,
                                                    fontWeight: 600,
                                                    color: "#475569",
                                                    py: 1,
                                                    textAlign: "center",
                                                  }}
                                                  aria-label="Expand Treatments"
                                                >
                                                  <i className="fa fa-stethoscope text-muted" style={{ fontSize: "10px", opacity: 0.6 }} />
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: "#475569", py: 1, fontSize: "12px" }}>
                                                  #
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: "#475569", py: 1, fontSize: "12px" }}>
                                                  Patient Name / ID
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: "#475569", py: 1, fontSize: "12px" }}>
                                                  Treatment
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: "#475569", py: 1, fontSize: "12px" }}>
                                                  Location
                                                </TableCell>
                                                <TableCell
                                                  align="right"
                                                  sx={{ fontWeight: 600, color: "#1e3a8a", py: 1, fontSize: "12px" }}
                                                >
                                                  Total Billing
                                                </TableCell>
                                                <TableCell
                                                  align="right"
                                                  sx={{ fontWeight: 600, color: "#0284c7", py: 1, fontSize: "12px" }}
                                                >
                                                  Payments Received
                                                </TableCell>
                                                <TableCell
                                                  align="right"
                                                  sx={{ fontWeight: 600, color: "#e11d48", py: 1, fontSize: "12px" }}
                                                >
                                                  Dues Pending
                                                </TableCell>
                                                <TableCell
                                                  align="center"
                                                  sx={{ fontWeight: 600, color: "#475569", py: 1, fontSize: "12px" }}
                                                >
                                                  Action
                                                </TableCell>
                                              </TableRow>
                                            </TableHead>
                                            <TableBody>
                                              {cachedPatientInfo.data.map((pt, ptIdx) => {
                                                const ptId =
                                                  pt.patientId ||
                                                  pt.patient_id ||
                                                  pt.patient_uuid ||
                                                  pt._id ||
                                                  pt.id ||
                                                  "";
                                                const ptName =
                                                  pt.patient_name ||
                                                  pt.patient ||
                                                  pt.Patient ||
                                                  pt.name ||
                                                  pt.full_name ||
                                                  "";

                                                const patientKey = `${hospitalName}___${ptId || ptIdx}___${ptIdx}`;
                                                const isPatientExpanded = expandedPatientKey === patientKey;

                                                const cachedTreatmentInfo = treatmentCache[patientKey] || {
                                                  loading: false,
                                                  data: [],
                                                  error: null,
                                                };

                                                const ptTreatment =
                                                  pt.treatment_name ||
                                                  pt.treatment ||
                                                  pt.Treatment ||
                                                  pt.course_name ||
                                                  "";
                                                const ptTreatmentId =
                                                  pt.treatment_id ||
                                                  pt.treatmentId ||
                                                  "";
                                                const ptCountry =
                                                  pt.country ||
                                                  pt.country_name ||
                                                  "";
                                                const ptCity =
                                                  pt.city ||
                                                  pt.town ||
                                                  pt.city_name ||
                                                  "";

                                                const ptBilling =
                                                  pt.total_billing ??
                                                  pt.totalBilling ??
                                                  pt.billing ??
                                                  pt.amount ??
                                                  pt.bill_amount;
                                                const ptReceived =
                                                  pt.payments_received ??
                                                  pt.paymentsReceived ??
                                                  pt.amount_paid ??
                                                  pt.paid ??
                                                  pt.payment;
                                                const ptDues =
                                                  pt.dues_pending ??
                                                  pt.duesPending ??
                                                  pt.remaining_balance ??
                                                  pt.dues ??
                                                  pt.balance;

                                                const ptHasNav = Boolean(ptId || ptName);
                                                const ptHasTreatNav = Boolean(ptTreatmentId || ptTreatment || ptId);

                                                return (
                                                  <React.Fragment key={patientKey}>
                                                    <TableRow
                                                      hover
                                                      onClick={() => handleTogglePatientRow(hospitalName, pt, ptIdx)}
                                                      sx={{
                                                        cursor: "pointer",
                                                        backgroundColor: isPatientExpanded
                                                          ? "#f0fdf4 !important"
                                                          : ptIdx % 2 === 1
                                                          ? "#fcfdfe"
                                                          : "#ffffff",
                                                        transition: "background-color 0.2s ease",
                                                        ...(isPatientExpanded && {
                                                          borderLeft: "3px solid #0d9488",
                                                        }),
                                                      }}
                                                    >
                                                      {/* Level 2 Accordion Toggle Button for Treatments */}
                                                      <TableCell
                                                        sx={{
                                                          py: 1,
                                                          width: 36,
                                                          textAlign: "center",
                                                        }}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleTogglePatientRow(hospitalName, pt, ptIdx);
                                                        }}
                                                      >
                                                        <button
                                                          type="button"
                                                          className="btn btn-sm btn-light p-0"
                                                          style={{
                                                            width: "20px",
                                                            height: "20px",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            borderRadius: "3px",
                                                            backgroundColor: isPatientExpanded ? "#0d9488" : "#f1f5f9",
                                                            borderColor: isPatientExpanded ? "#0d9488" : "#cbd5e1",
                                                            color: isPatientExpanded ? "#ffffff" : "#475569",
                                                            transition: "all 0.2s ease",
                                                          }}
                                                          title={isPatientExpanded ? "Collapse treatment details" : "Expand to view treatments for this patient"}
                                                        >
                                                          <i
                                                            className="fa fa-chevron-right"
                                                            style={{
                                                              fontSize: "9px",
                                                              transform: isPatientExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                                              transition: "transform 0.2s ease",
                                                            }}
                                                          />
                                                        </button>
                                                      </TableCell>

                                                      <TableCell sx={{ py: 1, fontSize: "12px", color: "#64748b" }}>
                                                        {ptIdx + 1}
                                                      </TableCell>
                                                      <TableCell sx={{ py: 1, fontSize: "12px" }}>
                                                        {ptHasNav ? (
                                                          <div
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleNavigatePatient(pt);
                                                            }}
                                                            style={{
                                                              cursor: "pointer",
                                                              display: "inline-flex",
                                                              flexDirection: "column",
                                                            }}
                                                            title="Click to view Patient Details"
                                                          >
                                                            <span
                                                              style={{
                                                                color: "#1e40af",
                                                                fontWeight: 600,
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "4px",
                                                              }}
                                                              className="text-primary-hover"
                                                            >
                                                              {ptName || ptId || "—"}
                                                              <i
                                                                className="fa fa-external-link"
                                                                style={{ fontSize: "10px", opacity: 0.6 }}
                                                              />
                                                            </span>
                                                            {ptId && ptId !== ptName && (
                                                              <small className="text-muted" style={{ fontSize: "11px" }}>
                                                                ID: {ptId}
                                                              </small>
                                                            )}
                                                          </div>
                                                        ) : (
                                                          <span className="fw-semibold text-dark">
                                                            {ptName || ptId || "—"}
                                                          </span>
                                                        )}
                                                      </TableCell>
                                                      <TableCell sx={{ py: 1, fontSize: "12px" }}>
                                                        {ptTreatment || ptTreatmentId ? (
                                                          ptHasTreatNav ? (
                                                            <div
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNavigateTreatment(pt);
                                                              }}
                                                              style={{
                                                                cursor: "pointer",
                                                                display: "inline-flex",
                                                                flexDirection: "column",
                                                              }}
                                                              title="Click to view Treatment Details"
                                                            >
                                                              <span
                                                                style={{
                                                                  color: "#0f766e",
                                                                  fontWeight: 600,
                                                                  display: "inline-flex",
                                                                  alignItems: "center",
                                                                  gap: "4px",
                                                                }}
                                                              >
                                                                {ptTreatment || "—"}
                                                                <i
                                                                  className="fa fa-external-link"
                                                                  style={{ fontSize: "10px", opacity: 0.6 }}
                                                                />
                                                              </span>
                                                              {ptTreatmentId && ptTreatmentId !== ptTreatment && (
                                                                <small className="text-muted" style={{ fontSize: "11px" }}>
                                                                  ID: {ptTreatmentId}
                                                                </small>
                                                              )}
                                                            </div>
                                                          ) : (
                                                            <span>{ptTreatment || "—"}</span>
                                                          )
                                                        ) : (
                                                          "—"
                                                        )}
                                                      </TableCell>
                                                      <TableCell sx={{ py: 1, fontSize: "12px", color: "#475569" }}>
                                                        {ptCountry || ptCity ? (
                                                          <span>
                                                            {ptCity}
                                                            {ptCity && ptCountry ? ", " : ""}
                                                            {ptCountry}
                                                          </span>
                                                        ) : (
                                                          "—"
                                                        )}
                                                      </TableCell>
                                                      <TableCell
                                                        align="right"
                                                        sx={{
                                                          py: 1,
                                                          fontSize: "12px",
                                                          fontWeight: 600,
                                                          color: "#1e3a8a",
                                                        }}
                                                      >
                                                        {formatCurrency(ptBilling)}
                                                      </TableCell>
                                                      <TableCell
                                                        align="right"
                                                        sx={{
                                                          py: 1,
                                                          fontSize: "12px",
                                                          fontWeight: 600,
                                                          color: "#0284c7",
                                                        }}
                                                      >
                                                        {formatCurrency(ptReceived)}
                                                      </TableCell>
                                                      <TableCell
                                                        align="right"
                                                        sx={{
                                                          py: 1,
                                                          fontSize: "12px",
                                                          fontWeight: 600,
                                                          color:
                                                            parseNumeric(ptDues) > 0
                                                              ? "#e11d48"
                                                              : "#64748b",
                                                        }}
                                                      >
                                                        {formatCurrency(ptDues)}
                                                      </TableCell>
                                                      <TableCell align="center" sx={{ py: 1 }}>
                                                        <div className="d-inline-flex align-items-center gap-1">
                                                          <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleNavigatePatient(pt);
                                                            }}
                                                            style={{
                                                              fontSize: "11px",
                                                              padding: "2px 8px",
                                                              borderRadius: "4px",
                                                            }}
                                                            title="View Patient Details"
                                                          >
                                                            <i className="fa fa-eye me-1" />
                                                            View
                                                          </button>
                                                          <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-success"
                                                            disabled={exportingPatientKey === patientKey}
                                                            onClick={(e) => handleExportPatient(hospitalName, pt, ptIdx, e)}
                                                            style={{
                                                              fontSize: "11px",
                                                              padding: "2px 8px",
                                                              borderRadius: "4px",
                                                            }}
                                                            title="Export all treatments and payments of this patient to Excel"
                                                          >
                                                            <i className={`fa ${exportingPatientKey === patientKey ? "fa-spinner fa-spin" : "fa-file-excel-o"} me-1`} />
                                                            Export
                                                          </button>
                                                        </div>
                                                      </TableCell>
                                                    </TableRow>

                                                    {/* Level 3 Accordion Row: Individual Treatments Breakdown */}
                                                    {isPatientExpanded && (
                                                      <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                                                        <TableCell
                                                          colSpan={9}
                                                          sx={{
                                                            p: 0,
                                                            borderBottom: "2px solid #5eead4",
                                                            borderTop: "none",
                                                          }}
                                                        >
                                                          <div
                                                            style={{
                                                              margin: "8px 12px 14px 24px",
                                                              padding: "14px",
                                                              backgroundColor: "#ffffff",
                                                              borderRadius: "8px",
                                                              border: "1px solid #ccfbf1",
                                                              boxShadow: "0 2px 8px rgba(13, 148, 136, 0.08)",
                                                            }}
                                                          >
                                                            {/* Treatments Header Banner */}
                                                            <div className="d-flex flex-wrap align-items-center justify-content-between pb-2 mb-2 border-bottom gap-2">
                                                              <div className="d-flex align-items-center gap-2">
                                                                <div
                                                                  style={{
                                                                    width: "28px",
                                                                    height: "28px",
                                                                    borderRadius: "6px",
                                                                    backgroundColor: "#f0fdfa",
                                                                    color: "#0d9488",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    fontSize: "14px",
                                                                  }}
                                                                >
                                                                  <i className="fa fa-stethoscope" />
                                                                </div>
                                                                <div>
                                                                  <h6
                                                                    className="mb-0 fw-bold"
                                                                    style={{ fontSize: "13px", color: "#0f766e" }}
                                                                  >
                                                                    Treatments for {ptName || ptId}
                                                                  </h6>
                                                                  <small className="text-muted" style={{ fontSize: "11px" }}>
                                                                    Hospital: {hospitalName} | Patient ID: {ptId}
                                                                  </small>
                                                                </div>
                                                              </div>

                                                              <div className="d-flex align-items-center gap-2">
                                                                {!cachedTreatmentInfo.loading && !cachedTreatmentInfo.error && (
                                                                  <span
                                                                    className="badge"
                                                                    style={{
                                                                      backgroundColor: "#f0fdfa",
                                                                      color: "#0f766e",
                                                                      border: "1px solid #99f6e4",
                                                                      fontSize: "11px",
                                                                      padding: "4px 8px",
                                                                      fontWeight: 600,
                                                                    }}
                                                                  >
                                                                    {cachedTreatmentInfo.data?.length || 0} Treatment
                                                                    {cachedTreatmentInfo.data?.length === 1 ? "" : "s"}
                                                                  </span>
                                                                )}

                                                                <button
                                                                  type="button"
                                                                  className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                                                                  disabled={cachedTreatmentInfo.loading || exportingPatientKey === patientKey}
                                                                  onClick={(e) => handleExportPatient(hospitalName, pt, ptIdx, e)}
                                                                  style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px" }}
                                                                  title="Export all treatments for this patient to Excel"
                                                                >
                                                                  <i className={`fa ${exportingPatientKey === patientKey ? "fa-spinner fa-spin" : "fa-file-excel-o"}`} />
                                                                  Export Patient
                                                                </button>

                                                                <button
                                                                  type="button"
                                                                  className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                                                  disabled={cachedTreatmentInfo.loading}
                                                                  onClick={() => handleRetryFetchTreatments(hospitalName, pt, ptIdx)}
                                                                  style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px" }}
                                                                  title="Refresh treatments"
                                                                >
                                                                  <i
                                                                    className={`fa fa-refresh ${cachedTreatmentInfo.loading ? "fa-spin" : ""}`}
                                                                  />
                                                                  Refresh
                                                                </button>
                                                              </div>
                                                            </div>

                                                            {/* Treatments Body State */}
                                                            {cachedTreatmentInfo.loading ? (
                                                              <div className="text-center py-3">
                                                                <CircularProgress size={22} sx={{ color: "#0d9488" }} />
                                                                <p className="mt-1 text-muted mb-0" style={{ fontSize: "12px" }}>
                                                                  Fetching treatments for <strong>{ptName || ptId}</strong>...
                                                                </p>
                                                              </div>
                                                            ) : cachedTreatmentInfo.error ? (
                                                              <div className="alert alert-danger d-flex align-items-center justify-content-between my-2 p-2 px-3">
                                                                <div className="d-flex align-items-center gap-2" style={{ fontSize: "12px" }}>
                                                                  <i className="fa fa-exclamation-triangle" />
                                                                  <span>{cachedTreatmentInfo.error}</span>
                                                                </div>
                                                                <button
                                                                  type="button"
                                                                  className="btn btn-sm btn-outline-danger"
                                                                  onClick={() => handleRetryFetchTreatments(hospitalName, pt, ptIdx)}
                                                                  style={{ fontSize: "11px" }}
                                                                >
                                                                  Retry
                                                                </button>
                                                              </div>
                                                            ) : !cachedTreatmentInfo.data || cachedTreatmentInfo.data.length === 0 ? (
                                                              <div className="text-center py-3 text-muted">
                                                                <i
                                                                  className="fa fa-info-circle mb-1"
                                                                  style={{ fontSize: "20px", opacity: 0.5 }}
                                                                />
                                                                <p className="mb-0 fw-medium" style={{ fontSize: "12px" }}>
                                                                  No treatment records found for this patient at {hospitalName}.
                                                                </p>
                                                              </div>
                                                            ) : (
                                                              <div className="table-responsive">
                                                                <Table size="small" aria-label="Patient Treatments Table">
                                                                  <TableHead sx={{ backgroundColor: "#f0fdfa" }}>
                                                                    <TableRow>
                                                                      <TableCell
                                                                        sx={{
                                                                          width: 32,
                                                                          fontWeight: 600,
                                                                          color: "#0f766e",
                                                                          py: 0.8,
                                                                          fontSize: "11px",
                                                                          textAlign: "center",
                                                                        }}
                                                                        aria-label="Expand Payment History"
                                                                      >
                                                                        <i className="fa fa-credit-card text-muted" style={{ fontSize: "10px", opacity: 0.6 }} />
                                                                      </TableCell>
                                                                      <TableCell sx={{ fontWeight: 600, color: "#0f766e", py: 0.8, fontSize: "11px" }}>
                                                                        #
                                                                      </TableCell>
                                                                      <TableCell sx={{ fontWeight: 600, color: "#0f766e", py: 0.8, fontSize: "11px" }}>
                                                                        Treatment Name / Course
                                                                      </TableCell>
                                                                      <TableCell sx={{ fontWeight: 600, color: "#0f766e", py: 0.8, fontSize: "11px" }}>
                                                                        Treatment ID
                                                                      </TableCell>
                                                                      <TableCell
                                                                        align="right"
                                                                        sx={{ fontWeight: 600, color: "#1e3a8a", py: 0.8, fontSize: "11px" }}
                                                                      >
                                                                        Total Charge
                                                                      </TableCell>
                                                                      <TableCell
                                                                        align="right"
                                                                        sx={{ fontWeight: 600, color: "#0284c7", py: 0.8, fontSize: "11px" }}
                                                                      >
                                                                        Payments Received
                                                                      </TableCell>
                                                                      <TableCell
                                                                        align="right"
                                                                        sx={{ fontWeight: 600, color: "#e11d48", py: 0.8, fontSize: "11px" }}
                                                                      >
                                                                        Due Payment
                                                                      </TableCell>
                                                                      <TableCell
                                                                        align="center"
                                                                        sx={{ fontWeight: 600, color: "#0f766e", py: 0.8, fontSize: "11px" }}
                                                                      >
                                                                        Payments
                                                                      </TableCell>
                                                                      <TableCell
                                                                        align="center"
                                                                        sx={{ fontWeight: 600, color: "#0f766e", py: 0.8, fontSize: "11px" }}
                                                                      >
                                                                        Action
                                                                      </TableCell>
                                                                    </TableRow>
                                                                  </TableHead>
                                                                  <TableBody>
                                                                    {cachedTreatmentInfo.data.map((tr, trIdx) => {
                                                                      const trName =
                                                                        tr.treatment_name ||
                                                                        tr.treatment ||
                                                                        tr.Treatment ||
                                                                        tr.treatmentName ||
                                                                        tr.course_name ||
                                                                        tr.name ||
                                                                        "";
                                                                      const trId =
                                                                        tr.treatment_id ||
                                                                        tr.treatmentId ||
                                                                        tr.id ||
                                                                        tr._id ||
                                                                        "";
                                                                      const trBilling =
                                                                        tr.totalCharge ??
                                                                        tr.total_charge ??
                                                                        tr.total_billing ??
                                                                        tr.totalBilling ??
                                                                        tr.billing ??
                                                                        tr.amount ??
                                                                        tr.bill_amount;
                                                                      const trReceived =
                                                                        tr.paymentsReceived ??
                                                                        tr.payments_received ??
                                                                        tr.amount_paid ??
                                                                        tr.paid ??
                                                                        tr.payment;
                                                                      const trDues =
                                                                        tr.duePayment ??
                                                                        tr.dues_pending ??
                                                                        tr.duesPending ??
                                                                        tr.due_payment ??
                                                                        tr.remaining_balance ??
                                                                        tr.dues ??
                                                                        tr.balance;

                                                                      const paymentList = Array.isArray(tr.payment_history) ? tr.payment_history : [];
                                                                      const paymentCount = tr.payment_count ?? paymentList.length;

                                                                      const treatmentKey = `${patientKey}___${trId || trIdx}___${trIdx}`;
                                                                      const isTreatmentExpanded = expandedTreatmentKey === treatmentKey;

                                                                      return (
                                                                        <React.Fragment key={treatmentKey}>
                                                                          <TableRow
                                                                            hover
                                                                            onClick={() => handleToggleTreatmentRow(patientKey, tr, trIdx)}
                                                                            sx={{
                                                                              cursor: "pointer",
                                                                              backgroundColor: isTreatmentExpanded
                                                                                ? "#eef2ff !important"
                                                                                : trIdx % 2 === 1
                                                                                ? "#fcfdfe"
                                                                                : "#ffffff",
                                                                              transition: "background-color 0.2s ease",
                                                                              ...(isTreatmentExpanded && {
                                                                                borderLeft: "3px solid #4f46e5",
                                                                              }),
                                                                            }}
                                                                          >
                                                                            {/* Level 3 Accordion Toggle Button for Payment History */}
                                                                            <TableCell
                                                                              sx={{
                                                                                py: 0.8,
                                                                                width: 32,
                                                                                textAlign: "center",
                                                                              }}
                                                                              onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleToggleTreatmentRow(patientKey, tr, trIdx);
                                                                              }}
                                                                            >
                                                                              <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-light p-0"
                                                                                style={{
                                                                                  width: "18px",
                                                                                  height: "18px",
                                                                                  display: "inline-flex",
                                                                                  alignItems: "center",
                                                                                  justifyContent: "center",
                                                                                  borderRadius: "3px",
                                                                                  backgroundColor: isTreatmentExpanded ? "#4f46e5" : "#f1f5f9",
                                                                                  borderColor: isTreatmentExpanded ? "#4f46e5" : "#cbd5e1",
                                                                                  color: isTreatmentExpanded ? "#ffffff" : "#475569",
                                                                                  transition: "all 0.2s ease",
                                                                                }}
                                                                                title={isTreatmentExpanded ? "Collapse payment history" : "Expand to view payment history"}
                                                                              >
                                                                                <i
                                                                                  className="fa fa-chevron-right"
                                                                                  style={{
                                                                                    fontSize: "8px",
                                                                                    transform: isTreatmentExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                                                                    transition: "transform 0.2s ease",
                                                                                  }}
                                                                                />
                                                                              </button>
                                                                            </TableCell>

                                                                            <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                                                                              {trIdx + 1}
                                                                            </TableCell>
                                                                            <TableCell sx={{ py: 0.8, fontSize: "11px" }}>
                                                                              <div
                                                                                onClick={(e) => {
                                                                                  e.stopPropagation();
                                                                                  handleNavigateTreatment({
                                                                                    ...pt,
                                                                                    treatment_id: trId || ptTreatmentId,
                                                                                    treatment_name: trName,
                                                                                  });
                                                                                }}
                                                                                style={{
                                                                                  cursor: "pointer",
                                                                                  display: "inline-flex",
                                                                                  alignItems: "center",
                                                                                  gap: "4px",
                                                                                  color: "#0f766e",
                                                                                  fontWeight: 600,
                                                                                }}
                                                                                title="Click to view Treatment Details"
                                                                              >
                                                                                <span>{trName || "Treatment"}</span>
                                                                                <i
                                                                                  className="fa fa-external-link"
                                                                                  style={{ fontSize: "9px", opacity: 0.6 }}
                                                                                />
                                                                              </div>
                                                                            </TableCell>
                                                                            <TableCell sx={{ py: 0.8, fontSize: "11px", color: "#64748b" }}>
                                                                              {trId ? (
                                                                                <span className="badge bg-light text-dark border">
                                                                                  {trId}
                                                                                </span>
                                                                              ) : (
                                                                                "—"
                                                                              )}
                                                                            </TableCell>
                                                                            <TableCell
                                                                              align="right"
                                                                              sx={{
                                                                                py: 0.8,
                                                                                fontSize: "11px",
                                                                                fontWeight: 600,
                                                                                color: "#1e3a8a",
                                                                              }}
                                                                            >
                                                                              {formatCurrency(trBilling)}
                                                                            </TableCell>
                                                                            <TableCell
                                                                              align="right"
                                                                              sx={{
                                                                                py: 0.8,
                                                                                fontSize: "11px",
                                                                                fontWeight: 600,
                                                                                color: "#0284c7",
                                                                              }}
                                                                            >
                                                                              {formatCurrency(trReceived)}
                                                                            </TableCell>
                                                                            <TableCell
                                                                              align="right"
                                                                              sx={{
                                                                                py: 0.8,
                                                                                fontSize: "11px",
                                                                                fontWeight: 600,
                                                                                color:
                                                                                  parseNumeric(trDues) > 0
                                                                                    ? "#e11d48"
                                                                                    : "#64748b",
                                                                              }}
                                                                            >
                                                                              {formatCurrency(trDues)}
                                                                            </TableCell>
                                                                            <TableCell align="center" sx={{ py: 0.8, fontSize: "11px" }}>
                                                                              <span
                                                                                className="badge d-inline-flex align-items-center gap-1"
                                                                                style={{
                                                                                  backgroundColor: paymentCount > 0 ? "#eef2ff" : "#f1f5f9",
                                                                                  color: paymentCount > 0 ? "#4338ca" : "#64748b",
                                                                                  border: `1px solid ${paymentCount > 0 ? "#c7d2fe" : "#e2e8f0"}`,
                                                                                  fontSize: "10px",
                                                                                  padding: "3px 6px",
                                                                                  fontWeight: 600,
                                                                                }}
                                                                              >
                                                                                <i className="fa fa-history" style={{ fontSize: "9px" }} />
                                                                                {paymentCount} {paymentCount === 1 ? "Payment" : "Payments"}
                                                                              </span>
                                                                            </TableCell>
                                                                            <TableCell align="center" sx={{ py: 0.8 }}>
                                                                              <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-teal"
                                                                                onClick={(e) => {
                                                                                  e.stopPropagation();
                                                                                  handleNavigateTreatment({
                                                                                    ...pt,
                                                                                    treatment_id: trId || ptTreatmentId,
                                                                                    treatment_name: trName,
                                                                                  });
                                                                                }}
                                                                                style={{
                                                                                  fontSize: "10px",
                                                                                  padding: "1px 6px",
                                                                                  borderRadius: "3px",
                                                                                  color: "#0f766e",
                                                                                  borderColor: "#0f766e",
                                                                                }}
                                                                                title="View Treatment on Patient Detail"
                                                                              >
                                                                                <i className="fa fa-stethoscope me-1" />
                                                                                Details
                                                                              </button>
                                                                              <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-success ms-1"
                                                                                disabled={exportingTreatmentKey === (trId || trName)}
                                                                                onClick={(e) =>
                                                                                  handleExportTreatment(
                                                                                    tr,
                                                                                    {
                                                                                      hospitalName,
                                                                                      patientName: ptName,
                                                                                      patientId: ptId,
                                                                                      country: pt.country || "",
                                                                                      city: pt.city || pt.location || "",
                                                                                    },
                                                                                    e
                                                                                  )
                                                                                }
                                                                                style={{
                                                                                  fontSize: "10px",
                                                                                  padding: "1px 6px",
                                                                                  borderRadius: "3px",
                                                                                }}
                                                                                title="Export this treatment to Excel"
                                                                              >
                                                                                <i
                                                                                  className={`fa ${
                                                                                    exportingTreatmentKey === (trId || trName)
                                                                                      ? "fa-spinner fa-spin"
                                                                                      : "fa-file-excel-o"
                                                                                  } me-1`}
                                                                                />
                                                                                Export
                                                                              </button>
                                                                            </TableCell>
                                                                          </TableRow>
                                                                          {/* Level 4 Accordion Row: Treatment Breakdown by Section (Hospital, OMCA, Pharmacy) */}
                                                                          {isTreatmentExpanded && (
                                                                            <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                                                                              <TableCell
                                                                                colSpan={9}
                                                                                sx={{
                                                                                  p: 0,
                                                                                  borderBottom: "2px solid #818cf8",
                                                                                  borderTop: "none",
                                                                                }}
                                                                              >
                                                                                {renderTreatmentBreakdownContent({
                                                                                  tr,
                                                                                  treatmentKey,
                                                                                  activeSec: treatmentActiveSection[treatmentKey] || "hospital",
                                                                                  onSectionChange: handleSectionChange,
                                                                                  onNavigatePatient: handleNavigatePatient,
                                                                                  onExportTreatment: handleExportTreatment,
                                                                                  fallbackHospitalName: hospitalName,
                                                                                  fallbackPatientName: ptName,
                                                                                  fallbackPatientId: ptId,
                                                                                })}
                                                                              </TableCell>
                                                                            </TableRow>
                                                                          )}
                                                                        </React.Fragment>
                                                                      );
                                                                    })}
                                                                  </TableBody>
                                                                </Table>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </TableCell>
                                                      </TableRow>
                                                    )}
                                                  </React.Fragment>
                                                );
                                              })}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>

              {/* Pagination Controls */}
              {totalRecords > 0 && (
                <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2 border-top">
                  <div className="text-muted" style={{ fontSize: "13px" }}>
                    Showing page {page} of {totalPages}
                  </div>
                  <Stack spacing={2}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={handlePageChange}
                      color="primary"
                      showFirstButton
                      showLastButton
                      shape="rounded"
                    />
                  </Stack>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Visual Analytics & Graphs Section (Now placed below the table listing) */}
          {(displayMode === "both" || displayMode === "chart") && (
            <div className="col-md-12 mt-4">
              <PaymentDataCharts
                rows={rows}
                summary={summary}
                currentLevel={currentLevel}
                loading={loadingTable}
                onCountryClick={handleCountryClick}
                onCityClick={handleCityClick}
                selectedCountryName={selectedCountryName}
                selectedCityName={selectedCityName}
              />
            </div>
          )}

          {/* Helper button when viewing Graphs Only */}
          {displayMode === "chart" && (
            <div className="col-md-12 mb-4 text-center">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm px-4 py-2 shadow-sm"
                onClick={() => setDisplayMode("both")}
                style={{ borderRadius: "8px", fontWeight: 600 }}
              >
                <i className="fa fa-table me-2" />
                Also Show Data Table Above (Combined View)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
