import React, { useRef, useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Swal from "sweetalert2";
import { addGHPayment, GH_PAYMENT_METHODS } from "../../../services/guestHouseServicesApi";

export default function AddPaymentModal({ open, onClose, record, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  // Financial calculations from record (Both Room Stay and Add-on Services)
  const roomCharge = Number(
    record?.room_amount !== undefined
      ? record.room_amount
      : record?.room_payment_amount !== undefined
      ? record.room_payment_amount
      : record?.payment_amount || 0
  );
  const roomPaid = Number(record?.room_paid_amount || 0);
  const roomDue = Number(
    record?.room_due_amount !== undefined
      ? record.room_due_amount
      : Math.max(0, roomCharge - roomPaid)
  );

  const servicesBilled = Number(
    record?.services_final_amount !== undefined
      ? record.services_final_amount
      : record?.final_services_cost !== undefined
      ? record.final_services_cost
      : record?.services_total_amount !== undefined
      ? record.services_total_amount
      : record?.final_amount || record?.totalAmount || 0
  );

  const servicesPaid = Number(
    record?.services_paid_amount !== undefined
      ? record.services_paid_amount
      : record?.paidAmount || 0
  );

  const servicesDue = Number(
    record?.services_due_amount !== undefined
      ? record.services_due_amount
      : Math.max(0, servicesBilled - servicesPaid)
  );

  const totalCombinedBilled = Number(
    record?.total_billed_amount !== undefined
      ? record.total_billed_amount
      : roomCharge + servicesBilled
  );
  const totalCombinedPaid = Number(
    record?.total_paid_amount !== undefined
      ? record.total_paid_amount
      : roomPaid + servicesPaid
  );
  const totalCombinedDue = Number(
    record?.total_due_amount !== undefined
      ? record.total_due_amount
      : Math.max(0, totalCombinedBilled - totalCombinedPaid)
  );

  const [paymentTarget, setPaymentTarget] = useState("all"); // "all", "services", "room"

  const activeDue =
    paymentTarget === "services"
      ? servicesDue
      : paymentTarget === "room"
      ? roomDue
      : totalCombinedDue;

  const [formData, setFormData] = useState({
    paid_amount: "",
    payment_method: "Cash",
    payment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (open && record) {
      const initialTarget = servicesDue > 0 && roomDue > 0 ? "all" : servicesDue > 0 ? "services" : "all";
      setPaymentTarget(initialTarget);
      const targetDue =
        initialTarget === "services"
          ? servicesDue
          : initialTarget === "room"
          ? roomDue
          : totalCombinedDue;
      const defaultAmount = targetDue > 0 ? String(Math.round(targetDue / 2)) : "";
      setFormData({
        paid_amount: defaultAmount,
        payment_method: "Cash",
        payment_date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      setFiles([]);
    }
  }, [open, record, totalCombinedDue, servicesDue, roomDue, servicesBilled]);

  if (!open || !record) return null;

  const handleTargetChange = (target) => {
    setPaymentTarget(target);
    const due =
      target === "services"
        ? servicesDue
        : target === "room"
        ? roomDue
        : totalCombinedDue;
    setFormData((prev) => ({
      ...prev,
      paid_amount: due > 0 ? String(Math.round(due / 2)) : "",
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const currentPaying = Number(formData.paid_amount) || 0;
  const remainingDueAfter = Math.max(0, activeDue - currentPaying);

  // Quick helper buttons with quick_installments API support
  const quickInst = record?.quick_installments || record?.installments;
  const targetQuickInst =
    paymentTarget === "services"
      ? quickInst?.services
      : paymentTarget === "all"
      ? quickInst?.combined
      : null;

  const halfDue =
    targetQuickInst?.pay_50 !== undefined
      ? Number(targetQuickInst.pay_50)
      : Math.round(activeDue / 2);

  const quarterDue =
    targetQuickInst?.pay_25 !== undefined
      ? Number(targetQuickInst.pay_25)
      : Math.round(activeDue * 0.25);

  const fullDue =
    targetQuickInst?.pay_full !== undefined
      ? Number(targetQuickInst.pay_full)
      : activeDue;

  const currentPaidNum = Number(formData.paid_amount);
  const isHalfActive = currentPaidNum > 0 && Math.abs(currentPaidNum - halfDue) < 0.01;
  const isFullActive = currentPaidNum > 0 && Math.abs(currentPaidNum - fullDue) < 0.01;
  const isQuarterActive = currentPaidNum > 0 && Math.abs(currentPaidNum - quarterDue) < 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadingRef.current) return;
    const amount = Number(formData.paid_amount);
    if (!amount || amount <= 0) {
      Swal.fire("Validation Error", "Please enter a valid payment amount.", "warning");
      return;
    }

    const identifier = record.booking_id || record.id || record._id || record.guestHouseServiceId;

    loadingRef.current = true;
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append("paid_amount", String(amount));
      payload.append("payment_method", formData.payment_method);
      payload.append("paymentMethod", formData.payment_method);
      payload.append("payment_date", formData.payment_date);
      payload.append("payment_Date", formData.payment_date);
      payload.append("payment_target", paymentTarget);
      payload.append("apply_towards", paymentTarget === "all" ? "combined" : paymentTarget);

      const targetLabel =
        paymentTarget === "services"
          ? "Services & Meals"
          : paymentTarget === "room"
          ? "Room Stay Charge"
          : "Combined (Stay + Services)";

      const formattedNotes = formData.notes
        ? `[Payment for: ${targetLabel}] ${formData.notes}`
        : `[Payment for: ${targetLabel}]`;

      payload.append("notes", formattedNotes);

      // Support Laravel array file inputs
      files.forEach((file) => {
        payload.append("invoiceFiles[]", file);
        payload.append("invoiceFiles", file);
      });

      const res = await addGHPayment(identifier, payload);
      Swal.fire({
        title: "Payment Recorded!",
        text:
          res?.message ||
          `Payment installment of ₹${amount.toLocaleString()} for ${targetLabel} recorded successfully.${
            remainingDueAfter > 0 ? ` Remaining balance: ₹${remainingDueAfter.toLocaleString()}` : ""
          }`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error recording payment:", err);
      Swal.fire("Error", typeof err === "string" ? err : err?.message || "Failed to record payment", "error");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      className="gh-modal-dialog"
      scroll="paper"
      disableAutoFocus
      disableRestoreFocus
      PaperProps={{
        style: {
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxHeight: "calc(100vh - 48px)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        },
      }}
    >
      {/* Modal Header */}
      <div
        className="gh-modal-header"
        style={{
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fa fa-credit-card fs-5" />
          </div>
          <div>
            <h5 className="mb-0 fw-bold" style={{ fontSize: "16px" }}>
              Record Guest House / Service Payment
            </h5>
            <small style={{ color: "rgba(255,255,255,0.85)" }}>
              {record.booking_id || `Booking #${record.id}`} • {record.name || record.patient_name}
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          <i className="fa fa-times" />
        </button>
      </div>

      <DialogContent style={{ padding: "20px", backgroundColor: "#f8fafc" }}>
        <form id="gh-add-payment-form" onSubmit={handleSubmit}>
          {/* Outstanding Due Notice with Room & Services Breakdown */}
          <div
            className="p-3 rounded mb-3 border text-dark"
            style={{ backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <div>
                <span className="small text-muted d-block">
                  Outstanding Balance Due ({paymentTarget === "services" ? "Services Only" : paymentTarget === "room" ? "Room Only" : "Total Combined"}):
                </span>
                <strong className="fs-5 text-success">₹{activeDue.toLocaleString()}</strong>
              </div>
              <div className="text-end small text-muted">
                <div>Room Stay: <strong>₹{roomCharge.toLocaleString()}</strong></div>
                <div>Services & Food: <strong>₹{servicesBilled.toLocaleString()}</strong></div>
                <div>Total Billed: <strong className="text-dark">₹{totalCombinedBilled.toLocaleString()}</strong></div>
              </div>
            </div>

            {/* Payment Target Toggle Pill Buttons */}
            <div className="pt-2 border-top border-success-subtle mb-2">
              <span className="small fw-semibold text-muted d-block mb-1" style={{ fontSize: "11.5px" }}>
                Apply Payment Towards:
              </span>
              <div className="d-flex gap-1 flex-wrap">
                <button
                  type="button"
                  className={`btn btn-sm ${paymentTarget === "all" ? "btn-success" : "btn-outline-success"}`}
                  style={{ fontSize: "11.5px", padding: "3px 10px", fontWeight: 600 }}
                  onClick={() => handleTargetChange("all")}
                >
                  Combined / Total Balance (₹{totalCombinedDue.toLocaleString()})
                </button>
                {servicesBilled > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${paymentTarget === "services" ? "btn-success" : "btn-outline-success"}`}
                    style={{ fontSize: "11.5px", padding: "3px 10px", fontWeight: 600 }}
                    onClick={() => handleTargetChange("services")}
                  >
                    Services Only (₹{servicesDue.toLocaleString()})
                  </button>
                )}
                {roomCharge > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${paymentTarget === "room" ? "btn-success" : "btn-outline-success"}`}
                    style={{ fontSize: "11.5px", padding: "3px 10px", fontWeight: 600 }}
                    onClick={() => handleTargetChange("room")}
                  >
                    Room Stay Only (₹{roomDue.toLocaleString()})
                  </button>
                )}
              </div>
            </div>

            {/* Quick Helper Pill Buttons for Multiple / Partial Payments */}
            {activeDue > 0 && (
              <div className="pt-2 border-top border-success-subtle d-flex align-items-center gap-2 flex-wrap">
                <span className="small fw-semibold text-muted" style={{ fontSize: "11.5px" }}>
                  Quick Installment:
                </span>
                <button
                  type="button"
                  className={`gh-installment-btn gh-installment-btn-success ${isHalfActive ? "active" : ""}`}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      paid_amount: String(halfDue),
                    }))
                  }
                  title="Pay half of the remaining balance"
                >
                  {isHalfActive && <i className="fa fa-check me-1" style={{ fontSize: "10px" }} />}
                  Pay 50% (Half): ₹{halfDue.toLocaleString()}
                </button>
                <button
                  type="button"
                  className={`gh-installment-btn gh-installment-btn-success ${isFullActive ? "active" : ""}`}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      paid_amount: String(fullDue),
                    }))
                  }
                  title="Pay 100% full remaining due balance"
                >
                  {isFullActive && <i className="fa fa-check me-1" style={{ fontSize: "10px" }} />}
                  Pay Full (100%): ₹{fullDue.toLocaleString()}
                </button>
                {quarterDue > 0 && (
                  <button
                    type="button"
                    className={`gh-installment-btn gh-installment-btn-secondary ${isQuarterActive ? "active" : ""}`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        paid_amount: String(quarterDue),
                      }))
                    }
                  >
                    {isQuarterActive && <i className="fa fa-check me-1" style={{ fontSize: "10px" }} />}
                    Pay 25%: ₹{quarterDue.toLocaleString()}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Amount Paid (₹) <span className="text-danger">*</span>
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">₹</span>
                <input
                  type="number"
                  name="paid_amount"
                  className="form-control"
                  placeholder="e.g. 500"
                  min="0"
                  step="any"
                  value={formData.paid_amount}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Payment Method <span className="text-danger">*</span>
              </label>
              <select
                name="payment_method"
                className="form-select form-select-sm"
                value={formData.payment_method}
                onChange={handleChange}
                required
              >
                {GH_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Payment Date
              </label>
              <input
                type="date"
                name="payment_date"
                className="form-control form-control-sm"
                value={formData.payment_date}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Attach Receipt / Invoice Files
              </label>
              <input
                type="file"
                multiple
                className="form-control form-control-sm"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
              />
              <small className="text-muted" style={{ fontSize: "11px" }}>
                Upload receipt image or PDF (optional)
              </small>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold text-dark">
                Payment Remarks / Transaction Reference
              </label>
              <textarea
                name="notes"
                rows="2"
                className="form-control form-control-sm"
                placeholder="e.g. 50% advance installment, UPI Ref 92837492, Cash collected at desk..."
                value={formData.notes}
                onChange={handleChange}
              />
            </div>

            {/* Installment Summary Indicator */}
            {currentPaying > 0 && (
              <div className="col-12">
                <div
                  className={`p-2 rounded border small ${
                    remainingDueAfter > 0 ? "bg-light text-dark" : "bg-success text-white"
                  }`}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span>
                      {remainingDueAfter > 0 ? (
                        <>
                          <i className="fa fa-info-circle text-primary me-1" />
                          Partial installment payment of{" "}
                          <strong>₹{currentPaying.toLocaleString()}</strong>.
                        </>
                      ) : (
                        <>
                          <i className="fa fa-check-circle me-1" />
                          Full settlement! Balance will be completely cleared.
                        </>
                      )}
                    </span>
                    <span className="fw-bold">
                      {remainingDueAfter > 0 ? (
                        <>Remaining Balance Due: ₹{remainingDueAfter.toLocaleString()}</>
                      ) : (
                        <>Due: ₹0</>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </DialogContent>

      <div
        className="gh-modal-footer"
        style={{
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fff",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <button type="button" className="btn btn-outline-secondary btn-sm px-4" onClick={onClose}>
          Cancel
        </button>

        <button
          type="submit"
          form="gh-add-payment-form"
          className="btn btn-success btn-sm px-4 fw-bold shadow-sm"
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="fa fa-spinner fa-spin me-1" /> Recording...
            </>
          ) : (
            <>
              <i className="fa fa-check me-1" /> Record Payment
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
