import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Tooltip from "@mui/material/Tooltip";
import Swal from "sweetalert2";
import {
  fetchGHServiceDetails,
  updateGHStayInfo,
  deleteGHSingleService,
  deleteGHPayment,
  deleteGHRecord,
  GH_STATUSES,
} from "../../../services/guestHouseServicesApi";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";
import { resolveCrmImageUrl } from "../../../Basurl/Baseurl";
import AddServicesModal from "./AddServicesModal";
import EditServiceItemModal from "./EditServiceItemModal";
import AddPaymentModal from "./AddPaymentModal";
import EditPaymentModal from "./EditPaymentModal";
import EditStayInfoModal from "./EditStayInfoModal";

export default function GHDetailsModal({
  open,
  onClose,
  recordId,
  onRecordUpdated,
}) {
  const isReferral = isReferralUser() || isInsuranceUser();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("services"); // "services" | "payments" | "notes"

  // Sub-modals
  const [addServicesOpen, setAddServicesOpen] = useState(false);
  const [editItemModalOpen, setEditItemModalOpen] = useState(false);
  const [selectedServiceItem, setSelectedServiceItem] = useState(null);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [selectedPaymentItem, setSelectedPaymentItem] = useState(null);
  const [editStayOpen, setEditStayOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (open && recordId) {
      loadDetails();
    }
  }, [open, recordId]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const data = await fetchGHServiceDetails(recordId);
      setRecord(data);
    } catch (err) {
      console.error("Error loading GH service details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRecordIdentifier = () => {
    if (!record) return recordId;
    return record.booking_id || record.id || record._id || record.guestHouseServiceId || recordId;
  };

  const handleStatusChange = async (newStatus) => {
    if (isReferral) return;
    if (!record || record.status === newStatus) return;
    setUpdatingStatus(true);
    try {
      await updateGHStayInfo(getRecordIdentifier(), {
        status: newStatus,
      });
      Swal.fire({
        title: "Status Changed",
        text: `Booking status changed to ${newStatus}`,
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
      loadDetails();
      if (onRecordUpdated) onRecordUpdated();
    } catch (err) {
      Swal.fire("Error", typeof err === "string" ? err : "Failed to change status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteServiceItem = async (svc) => {
    if (isReferral) return;
    const sName = svc.service_name || svc.serviceName || "Service Item";
    const svcId = svc.id || svc._id || svc.serviceId;
    const result = await Swal.fire({
      title: "Remove Service Item?",
      text: `Are you sure you want to remove "${sName}"? Services billing totals will automatically recalculate.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Delete",
    });

    if (result.isConfirmed) {
      try {
        await deleteGHSingleService(getRecordIdentifier(), svcId);
        Swal.fire("Deleted", "Service item removed successfully.", "success");
        loadDetails();
        if (onRecordUpdated) onRecordUpdated();
      } catch (err) {
        Swal.fire("Error", typeof err === "string" ? err : "Failed to remove item", "error");
      }
    }
  };

  const handleDeletePayment = async (pay) => {
    if (isReferral) return;
    const payId = pay.id || pay._id;
    const payAmt = Number(pay.paid_amount || 0).toLocaleString();
    const result = await Swal.fire({
      title: "Delete Payment Entry?",
      text: `Are you sure you want to delete payment receipt of ₹${payAmt}? Outstanding balance will update.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Delete",
    });

    if (result.isConfirmed) {
      try {
        await deleteGHPayment(getRecordIdentifier(), payId);
        Swal.fire("Deleted", "Payment entry deleted successfully.", "success");
        loadDetails();
        if (onRecordUpdated) onRecordUpdated();
      } catch (err) {
        Swal.fire("Error", typeof err === "string" ? err : "Failed to delete payment", "error");
      }
    }
  };

  const handleDeleteRecord = async () => {
    if (isReferral) return;
    const bId = record?.booking_id || record?.guestHouseServiceId || `Booking #${record?.id}`;
    const result = await Swal.fire({
      title: "Clear All Services & Payments?",
      text: `This will reset all add-on services and payment records linked to ${bId}. Room stay record will remain intact.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Clear Services",
    });

    if (result.isConfirmed) {
      try {
        await deleteGHRecord(getRecordIdentifier());
        Swal.fire("Reset", "All services and payments for this booking have been removed.", "success");
        if (onRecordUpdated) onRecordUpdated();
        onClose();
      } catch (err) {
        Swal.fire("Error", typeof err === "string" ? err : "Failed to reset services", "error");
      }
    }
  };

  if (!open) return null;

  // Billing totals (Both Room Stay and Add-on Services)
  const roomStayCharge = Number(
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
      : Math.max(0, roomStayCharge - roomPaid)
  );

  const servicesDiscountPct = Number(record?.services_discount_pct || 0);
  const servicesFinal = Number(
    record?.services_final_amount !== undefined
      ? record.services_final_amount
      : record?.final_services_cost !== undefined
      ? record.final_services_cost
      : record?.final_amount || record?.totalAmount || 0
  );
  const servicesPaid = Number(record?.services_paid_amount || 0);
  const servicesDue = Number(
    record?.services_due_amount !== undefined
      ? record.services_due_amount
      : Math.max(0, servicesFinal - servicesPaid)
  );

  const totalCombinedBilled = Number(
    record?.total_billed_amount !== undefined
      ? record.total_billed_amount
      : roomStayCharge + servicesFinal
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

  const paymentStatus =
    record?.overall_payment_status ||
    (totalCombinedDue === 0 ? "Paid" : totalCombinedPaid > 0 ? "Partial" : "Pending");

  const stayFrom = record?.checkin || record?.stayDateRangeFrom || (record?.stayDateRange?.from ? record.stayDateRange.from.slice(0, 10) : "-");
  const stayTo = record?.checkout || record?.stayDateRangeTo || (record?.stayDateRange?.to ? record.stayDateRange.to.slice(0, 10) : "-");

  const servicesList = Array.isArray(record?.services) ? record.services : [];
  const paymentsList = Array.isArray(record?.payment_details)
    ? record.payment_details
    : Array.isArray(record?.payments)
    ? record.payments
    : [];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        className="gh-modal-dialog gh-modal-lg"
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
            height: "min(880px, calc(100vh - 48px))",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          },
        }}
      >
        {/* Sticky Header */}
        <div
          className="gh-modal-header"
          style={{
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="fa fa-building fs-5" />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h5 className="mb-0 fw-bold" style={{ fontSize: "18px" }}>
                  {record?.booking_id || record?.guestHouseServiceId || `Booking #${record?.id}`}
                </h5>
                <span className="badge bg-light text-dark fw-bold">
                  {record?.status || "Active"}
                </span>
                <span
                  className={`badge ${
                    paymentStatus.toLowerCase() === "paid"
                      ? "bg-success"
                      : paymentStatus.toLowerCase() === "partial"
                      ? "bg-warning text-dark"
                      : "bg-danger"
                  } fw-bold`}
                >
                  {paymentStatus} Payment
                </span>
              </div>
              <small style={{ color: "rgba(255,255,255,0.88)", fontSize: "13px" }}>
                Patient: <strong>{record?.name || record?.patient_name}</strong> (ID: {record?.user_id || record?.patientId})
                {record?.phone && ` • Phone: ${record.phone}`}
                {record?.email && ` • ${record.email}`}
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {!isReferral && (
              <>
                <Tooltip title="Record Services Payment" arrow placement="bottom">
                  <button
                    type="button"
                    className="btn btn-sm btn-success d-flex align-items-center gap-1 shadow-sm fw-bold"
                    onClick={() => setAddPaymentOpen(true)}
                  >
                    <i className="fa fa-credit-card" /> Add Payment
                  </button>
                </Tooltip>
                <button
                  type="button"
                  className="btn btn-sm btn-light d-flex align-items-center gap-1 shadow-sm fw-bold text-primary"
                  onClick={() => setAddServicesOpen(true)}
                >
                  <i className="fa fa-plus-circle" /> Add Services
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
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
        </div>

        <DialogContent
          style={{
            padding: "20px 24px",
            backgroundColor: "#f8fafc",
            flex: "1 1 auto",
            overflowY: "auto",
          }}
        >
          {loading && !record ? (
            <div className="text-center py-5">
              <i className="fa fa-spinner fa-spin fa-2x text-primary mb-2" />
              <p className="text-muted">Loading guest house booking details...</p>
            </div>
          ) : !record ? (
            <div className="text-center py-5 text-muted">Record not found</div>
          ) : (
            <div>
              {/* Top Overview Cards */}
              <div className="row g-3 mb-3">
                {/* Stay Info Card */}
                <div className="col-md-5">
                  <div className="card border-0 shadow-sm p-3 h-100 bg-white" style={{ borderRadius: "10px" }}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="small text-muted d-block">Property & Room Stay</span>
                        <h6 className="fw-bold text-dark mb-0 fs-6">
                          {record.guest_house_name || record.guestHouseName || "Guest House Stay"}
                        </h6>
                        <span className="badge bg-light text-primary border mt-1">
                          {record.guest_house_room_type || record.roomNumber ? `Room: ${record.guest_house_room_type || record.roomNumber}` : "Room Assigned"}
                        </span>
                      </div>
                      {!isReferral && (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-0 px-2"
                        style={{ fontSize: "11.5px" }}
                        onClick={() => setEditStayOpen(true)}
                      >
                        <i className="fa fa-pencil me-1" /> Edit Stay
                      </button>
                      )}
                    </div>

                    <div className="pt-2 border-top small text-muted">
                      <div>
                        <i className="fa fa-calendar me-1 text-primary" /> Stay Duration:{" "}
                        <strong className="text-dark">
                          {stayFrom} → {stayTo}
                        </strong>
                      </div>
                      <div className="d-flex flex-wrap gap-2 mt-1">
                        {record.rooms !== undefined && (
                          <span>Rooms: <strong>{record.rooms}</strong></span>
                        )}
                        {record.adults !== undefined && (
                          <span>Adults: <strong>{record.adults}</strong></span>
                        )}
                        {record.children !== undefined && (
                          <span>Children: <strong>{record.children}</strong></span>
                        )}
                        {record.room_payment_amount !== undefined && (
                          <span className="text-secondary">
                            Stay Rate: <strong>₹{Number(record.room_payment_amount).toLocaleString()}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className="col-md-7">
                  <div className="card border-0 shadow-sm p-3 h-100 bg-white" style={{ borderRadius: "10px" }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small fw-semibold text-dark">Stay & Services Billing Summary</span>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small text-muted">Stay Status:</span>
                        <select
                          className="form-select form-select-sm"
                          style={isReferral ? { width: "auto", fontSize: "12px", fontWeight: 600, cursor: "not-allowed", opacity: 0.85 } : { width: "auto", fontSize: "12px", fontWeight: 600 }}
                          value={record.status || "Completed"}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          disabled={updatingStatus || isReferral}
                        >
                          {GH_STATUSES.filter((s) => s !== "ALL").map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="row g-2 text-center pt-2">
                      <div className="col">
                        <div className="p-2 rounded bg-light border">
                          <small className="text-muted d-block" style={{ fontSize: "10.5px" }}>Room Stay</small>
                          <strong className="fs-6 text-dark">₹{roomStayCharge.toLocaleString()}</strong>
                          <span className="d-block text-muted" style={{ fontSize: "10px" }}>
                            Paid: ₹{roomPaid.toLocaleString()} • Due: ₹{roomDue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-2 rounded bg-light border">
                          <small className="text-muted d-block" style={{ fontSize: "10.5px" }}>
                            Services {servicesDiscountPct > 0 ? `(-${servicesDiscountPct}%)` : ""}
                          </small>
                          <strong className="fs-6 text-dark">₹{servicesFinal.toLocaleString()}</strong>
                          <span className="d-block text-muted" style={{ fontSize: "10px" }}>
                            Paid: ₹{servicesPaid.toLocaleString()} • Due: ₹{servicesDue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-2 rounded bg-light border">
                          <small className="text-muted d-block" style={{ fontSize: "10.5px" }}>Total Billed</small>
                          <strong className="fs-6 text-primary">₹{totalCombinedBilled.toLocaleString()}</strong>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-2 rounded bg-light border">
                          <small className="text-muted d-block" style={{ fontSize: "10.5px" }}>Total Paid</small>
                          <strong className="fs-6 text-success">₹{totalCombinedPaid.toLocaleString()}</strong>
                        </div>
                      </div>
                      <div className="col">
                        <div className="p-2 rounded bg-light border">
                          <small className="text-muted d-block" style={{ fontSize: "10.5px" }}>Net Due</small>
                          <strong className={`fs-6 ${totalCombinedDue > 0 ? "text-danger" : "text-success"}`}>
                            ₹{totalCombinedDue.toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <ul className="nav nav-pills mb-3 gap-2">
                <li className="nav-item">
                  <button
                    className={`btn btn-sm ${
                      activeTab === "services" ? "btn-primary shadow-sm" : "btn-white border"
                    }`}
                    style={{ borderRadius: "8px", fontWeight: 600, padding: "6px 16px" }}
                    onClick={() => setActiveTab("services")}
                  >
                    <i className="fa fa-list-check me-1" /> Add-On Services ({servicesList.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`btn btn-sm ${
                      activeTab === "payments" ? "btn-primary shadow-sm" : "btn-white border"
                    }`}
                    style={{ borderRadius: "8px", fontWeight: 600, padding: "6px 16px" }}
                    onClick={() => setActiveTab("payments")}
                  >
                    <i className="fa fa-credit-card me-1" /> Payment Receipts ({paymentsList.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`btn btn-sm ${
                      activeTab === "notes" ? "btn-primary shadow-sm" : "btn-white border"
                    }`}
                    style={{ borderRadius: "8px", fontWeight: 600, padding: "6px 16px" }}
                    onClick={() => setActiveTab("notes")}
                  >
                    <i className="fa fa-sticky-note me-1" /> Remarks & Notes
                  </button>
                </li>
              </ul>

              {/* Tab 1: Services List */}
              {activeTab === "services" && (
                <div className="card border-0 shadow-sm bg-white" style={{ borderRadius: "10px" }}>
                  <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: "14px" }}>
                      Add-on Services Line Items
                    </h6>
                    {!isReferral && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                      onClick={() => setAddServicesOpen(true)}
                    >
                      <i className="fa fa-plus" /> Add Services
                    </button>
                    )}
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ fontSize: "13px" }}>
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Service</th>
                          <th>Code</th>
                          <th>Duration</th>
                          <th>Unit Price</th>
                          <th>Qty</th>
                          <th>Disc %</th>
                          <th>Final Price</th>
                          <th>Dates</th>
                          <th>Status</th>
                          {!isReferral && <th className="text-end">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {servicesList.length === 0 ? (
                          <tr>
                            <td colSpan={isReferral ? "10" : "11"} className="text-center py-4 text-muted">
                              No add-on services recorded for this guest house booking yet.
                            </td>
                          </tr>
                        ) : (
                          servicesList.map((svc, idx) => {
                            const uPrice = Number(svc.unit_price !== undefined ? svc.unit_price : svc.price || 0);
                            const fPrice = Number(svc.final_price !== undefined ? svc.final_price : uPrice * (svc.quantity || 1));
                            return (
                              <tr key={svc.id || svc._id || idx}>
                                <td className="text-muted">{idx + 1}</td>
                                <td>
                                  <strong className="text-dark d-block">
                                    {svc.service_name || svc.serviceName || "Service"}
                                  </strong>
                                  {(svc.notes || svc.description) && (
                                    <small className="text-muted">{svc.notes || svc.description}</small>
                                  )}
                                </td>
                                <td>
                                  <span className="badge bg-light text-muted border">
                                    {svc.service_code || svc.serviceCode || "-"}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge bg-light text-dark border">
                                    {svc.duration || "One-Time"}
                                  </span>
                                </td>
                                <td>₹{uPrice.toLocaleString()}</td>
                                <td>{svc.quantity || 1}</td>
                                <td>{svc.discount_percentage ? `${svc.discount_percentage}%` : "-"}</td>
                                <td className="fw-bold text-success">
                                  ₹{fPrice.toLocaleString()}
                                </td>
                                <td className="small text-muted text-nowrap">
                                  {svc.start_date || svc.end_date
                                    ? `${svc.start_date || ""} → ${svc.end_date || ""}`
                                    : "-"}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      svc.status === "Completed"
                                        ? "bg-success"
                                        : svc.status === "Cancelled"
                                        ? "bg-danger"
                                        : "bg-info text-white"
                                    }`}
                                    style={{ fontSize: "11px" }}
                                  >
                                    {svc.status || "In Progress"}
                                  </span>
                                </td>
                                {!isReferral && (
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm text-primary p-1 me-1"
                                    onClick={() => {
                                      setSelectedServiceItem(svc);
                                      setEditItemModalOpen(true);
                                    }}
                                    title="Edit Service Item"
                                  >
                                    <i className="fa fa-pencil" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm text-danger p-1"
                                    onClick={() => handleDeleteServiceItem(svc)}
                                    title="Delete Service Item"
                                  >
                                    <i className="fa fa-trash" />
                                  </button>
                                </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Payments List */}
              {activeTab === "payments" && (
                <div className="card border-0 shadow-sm bg-white" style={{ borderRadius: "10px" }}>
                  <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: "14px" }}>
                        Service Payment Receipts & Installments ({paymentsList.length})
                      </h6>
                      <small className="text-muted">
                        Multiple partial payments & advance deposits recorded for services
                      </small>
                    </div>
                    {!isReferral && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm d-flex align-items-center gap-1 fw-bold shadow-sm"
                      onClick={() => setAddPaymentOpen(true)}
                    >
                      <i className="fa fa-credit-card" /> Record Payment / Installment
                    </button>
                    )}
                  </div>

                  {/* Installment Summary Banner */}
                  <div className="p-3 bg-light border-bottom">
                    <div className="row g-2 align-items-center">
                      <div className="col-md-4">
                        <div className="small text-muted">Total Billed:</div>
                        <strong className="text-dark fs-6">₹{totalCombinedBilled.toLocaleString()}</strong>
                        <div className="text-muted" style={{ fontSize: "11px" }}>
                          Room: ₹{roomStayCharge.toLocaleString()} • Services: ₹{servicesFinal.toLocaleString()}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Total Paid ({paymentsList.length} receipt{paymentsList.length !== 1 ? "s" : ""}):</div>
                        <strong className="text-success fs-6">₹{totalCombinedPaid.toLocaleString()}</strong>
                        <div className="text-muted" style={{ fontSize: "11px" }}>
                          Room: ₹{roomPaid.toLocaleString()} • Services: ₹{servicesPaid.toLocaleString()}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Net Outstanding Due:</div>
                        <strong className={`fs-6 ${totalCombinedDue > 0 ? "text-danger" : "text-success"}`}>
                          ₹{totalCombinedDue.toLocaleString()}
                        </strong>
                        <div className="text-muted" style={{ fontSize: "11px" }}>
                          Room: ₹{roomDue.toLocaleString()} • Services: ₹{servicesDue.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {totalCombinedBilled > 0 && (
                      <div className="progress mt-2" style={{ height: "6px" }}>
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{ width: `${Math.min(100, Math.round((totalCombinedPaid / totalCombinedBilled) * 100))}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ fontSize: "13px" }}>
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Payment Date</th>
                          <th>Amount Paid</th>
                          <th>Target</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th>Receipt Files</th>
                          <th>Notes / Rejection</th>
                          {!isReferral && <th className="text-end">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsList.length === 0 ? (
                          <tr>
                            <td colSpan={isReferral ? "8" : "9"} className="text-center py-4 text-muted">
                              No payment receipts recorded for this booking yet.
                            </td>
                          </tr>
                        ) : (
                          paymentsList.map((p, idx) => {
                            const pFiles = Array.isArray(p.attachFile)
                              ? p.attachFile
                              : Array.isArray(p.files)
                              ? p.files
                              : Array.isArray(p.receipts)
                              ? p.receipts
                              : [];

                            return (
                              <tr key={p.id || p._id || idx}>
                                <td className="text-muted">{idx + 1}</td>
                                <td>{p.payment_date || p.payment_Date || "-"}</td>
                                <td className="fw-bold text-success">
                                  ₹{(Number(p.paid_amount) || 0).toLocaleString()}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      p.apply_towards === "services"
                                        ? "bg-info text-white"
                                        : p.apply_towards === "room"
                                        ? "bg-secondary text-white"
                                        : "bg-primary text-white"
                                    }`}
                                    style={{ fontSize: "11px" }}
                                  >
                                    {p.apply_towards || "combined"}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge bg-light text-dark border">
                                    {p.payment_method || p.paymentMethod || "Cash"}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      p.status === "Approved"
                                        ? "bg-success"
                                        : p.status === "Rejected"
                                        ? "bg-danger"
                                        : "bg-warning text-dark"
                                    }`}
                                    style={{ fontSize: "11px" }}
                                  >
                                    {p.status || "Approved"}
                                  </span>
                                </td>
                                <td>
                                  {pFiles.length > 0 ? (
                                    <div className="d-flex flex-wrap gap-1">
                                      {pFiles.map((f, fi) => {
                                        const fPath = f.file_path || f.url || f.path || f;
                                        const fName = f.file_name || `Receipt #${fi + 1}`;
                                        return (
                                          <a
                                            key={fi}
                                            href={resolveCrmImageUrl(fPath)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="badge bg-light text-primary border text-decoration-none"
                                            title="View receipt file"
                                          >
                                            <i className="fa fa-paperclip me-1" />
                                            {fName}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-muted small">-</span>
                                  )}
                                </td>
                                <td className="text-muted small" style={{ maxWidth: "250px" }}>
                                  {p.notes && <div>{p.notes}</div>}
                                  {p.rejection_notes && (
                                    <div className="text-danger fw-semibold mt-1">
                                      <i className="fa fa-exclamation-circle me-1" />
                                      {p.rejection_notes}
                                    </div>
                                  )}
                                  {!p.notes && !p.rejection_notes && "-"}
                                </td>
                                {!isReferral && (
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm text-primary p-1 me-1"
                                    onClick={() => {
                                      setSelectedPaymentItem(p);
                                      setEditPaymentOpen(true);
                                    }}
                                    title="Edit / Approve / Reject Payment"
                                  >
                                    <i className="fa fa-pencil" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm text-danger p-1"
                                    onClick={() => handleDeletePayment(p)}
                                    title="Delete Payment"
                                  >
                                    <i className="fa fa-trash" />
                                  </button>
                                </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Notes & Instructions */}
              {activeTab === "notes" && (
                <div className="card border-0 shadow-sm p-3 bg-white" style={{ borderRadius: "10px" }}>
                  <h6 className="fw-bold text-dark mb-2" style={{ fontSize: "14px" }}>
                    Special Instructions & Stay Remarks
                  </h6>
                  <div className="p-3 bg-light rounded border text-muted">
                    {record.notes ? (
                      <p className="mb-0 text-dark">{record.notes}</p>
                    ) : (
                      <p className="mb-0 text-muted fst-italic">No special notes recorded for this stay.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>

        {/* Pinned Sticky Footer Actions */}
        {record && (
          <div
            className="gh-modal-footer"
            style={{
              padding: "12px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
              background: "#fff",
            }}
          >
            {!isReferral ? (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
              onClick={handleDeleteRecord}
            >
              <i className="fa fa-trash" /> Clear All Services
            </button>
            ) : <div />}

            <button
              type="button"
              className="btn btn-secondary btn-sm px-4"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </Dialog>

      {/* Sub Modals */}
      <AddServicesModal
        open={addServicesOpen}
        onClose={() => setAddServicesOpen(false)}
        record={record}
        onSuccess={() => {
          loadDetails();
          if (onRecordUpdated) onRecordUpdated();
        }}
      />

      <EditServiceItemModal
        open={editItemModalOpen}
        onClose={() => {
          setEditItemModalOpen(false);
          setSelectedServiceItem(null);
        }}
        record={record}
        serviceItem={selectedServiceItem}
        onSuccess={() => {
          loadDetails();
          if (onRecordUpdated) onRecordUpdated();
        }}
      />

      <AddPaymentModal
        open={addPaymentOpen}
        onClose={() => setAddPaymentOpen(false)}
        record={record}
        onSuccess={() => {
          loadDetails();
          if (onRecordUpdated) onRecordUpdated();
        }}
      />

      <EditPaymentModal
        open={editPaymentOpen}
        onClose={() => {
          setEditPaymentOpen(false);
          setSelectedPaymentItem(null);
        }}
        record={record}
        paymentItem={selectedPaymentItem}
        onSuccess={() => {
          loadDetails();
          if (onRecordUpdated) onRecordUpdated();
        }}
      />

      <EditStayInfoModal
        open={editStayOpen}
        onClose={() => setEditStayOpen(false)}
        record={record}
        onSuccess={() => {
          loadDetails();
          if (onRecordUpdated) onRecordUpdated();
        }}
      />
    </>
  );
}
