import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import {
  fetchOrdersHistory,
  fetchOrderDetails,
  normalizeOrderDetails,
  updateOrderStatus,
  ORDER_STATUS_CODE_TO_LABEL,
  ORDER_STATUS_LABEL_TO_CODE,
  getOrderBills,
} from "../../../services/ordersApi";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";
import "../../Orders/Orders.css";

const isReadOnlyPartner = () => isReferralUser() || isInsuranceUser();

const getStatusBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("pending")) return "pending";
  if (s.includes("process")) return "in-process";
  if (s.includes("purchase")) return "purchased";
  if (s.includes("way") || s.includes("transit")) return "on-the-way";
  if (s.includes("deliver")) return "delivered";
  if (s.includes("cancel")) return "cancelled";
  return "pending";
};

const getPaymentBadge = (paymentStatus, paymentMode) => {
  const ps = String(paymentStatus || "").toLowerCase();
  const pm = String(paymentMode || "").toLowerCase();

  if (ps.includes("paid") || ps.includes("success") || ps.includes("complete")) {
    return {
      label: ps.includes("complete") ? "Paid & Completed" : "Paid",
      badgeClass: "paid",
      icon: "fa fa-check-circle me-1",
    };
  }
  if (ps.includes("fail") || ps.includes("reject") || ps.includes("decline")) {
    return {
      label: "Failed",
      badgeClass: "failed",
      icon: "fa fa-times-circle me-1",
    };
  }
  if (ps.includes("refund")) {
    return {
      label: "Refunded",
      badgeClass: "refunded",
      icon: "fa fa-undo me-1",
    };
  }
  if (pm.includes("cash") || pm.includes("cod") || ps.includes("cod")) {
    return {
      label: "COD Pending",
      badgeClass: "cod",
      icon: "fa fa-money me-1",
    };
  }
  return {
    label: "Pending",
    badgeClass: "pending",
    icon: "fa fa-clock-o me-1",
  };
};

const canShowBillAction = (order, hasBills = false) => {
  if (hasBills) return true;
  const s = String(order?.status || "").toLowerCase();
  return (
    s.includes("purchase") ||
    s.includes("way") ||
    s.includes("transit") ||
    s.includes("deliver") ||
    s.includes("complete")
  );
};

export default function PatientOrdersTab({ patient, userId: initialUserId }) {
  const navigate = useNavigate();

  // Resolve user id from multiple possible fields
  const resolvedPropUserId = String(
    initialUserId ||
    patient?.user_id ||
    patient?.userId ||
    patient?._id ||
    patient?.id ||
    ""
  ).trim();

  const [userIdInput, setUserIdInput] = useState(resolvedPropUserId);
  const [activeUserId, setActiveUserId] = useState(resolvedPropUserId);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Quick view modal
  const [quickViewOrder, setQuickViewOrder] = useState(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [previewModalImg, setPreviewModalImg] = useState(null);
  const [previewModalTitle, setPreviewModalTitle] = useState("");

  // Sync if prop userId changes
  useEffect(() => {
    if (resolvedPropUserId && resolvedPropUserId !== activeUserId) {
      setUserIdInput(resolvedPropUserId);
      setActiveUserId(resolvedPropUserId);
      loadOrders(resolvedPropUserId);
    }
  }, [resolvedPropUserId]);

  // Initial load
  useEffect(() => {
    loadOrders(activeUserId);
  }, [activeUserId]);

  const loadOrders = async (targetUserId) => {
    setLoading(true);
    try {
      const result = await fetchOrdersHistory({
        user_id: targetUserId ? String(targetUserId).trim() : "",
      });
      if (result?.data) {
        setOrders(result.data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error("Failed to load patient orders:", err);
      Swal.fire("Notice", "Unable to load patient order history at this time.", "warning");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUserFilter = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = userIdInput.trim();
    setActiveUserId(clean);
    setCurrentPage(1);
    loadOrders(clean);
  };

  const handleResetUserFilter = () => {
    setUserIdInput(resolvedPropUserId || "");
    setActiveUserId(resolvedPropUserId || "");
    setCurrentPage(1);
    loadOrders(resolvedPropUserId || "");
  };

  // Stat summary counters
  const stats = useMemo(() => {
    const counts = {
      all: orders.length,
      pending: 0,
      inProcess: 0,
      purchased: 0,
      onTheWay: 0,
      delivered: 0,
      cancelled: 0,
    };

    orders.forEach((o) => {
      const s = String(o.status || "").toLowerCase();
      if (s.includes("pending")) counts.pending += 1;
      else if (s.includes("process")) counts.inProcess += 1;
      else if (s.includes("purchase")) counts.purchased += 1;
      else if (s.includes("way") || s.includes("transit")) counts.onTheWay += 1;
      else if (s.includes("deliver")) counts.delivered += 1;
      else if (s.includes("cancel")) counts.cancelled += 1;
    });

    return counts;
  }, [orders]);

  // Filter orders by search and status
  const filteredOrders = useMemo(() => {
    let list = orders;

    if (selectedStatusFilter !== "ALL") {
      const filterLower = selectedStatusFilter.toLowerCase();
      list = list.filter((o) => {
        const s = String(o.status || "").toLowerCase();
        if (filterLower === "in process") return s.includes("process");
        if (filterLower === "purchased") return s.includes("purchase");
        if (filterLower === "on the way") return s.includes("way") || s.includes("transit");
        if (filterLower === "delivered") return s.includes("deliver");
        if (filterLower === "cancelled") return s.includes("cancel");
        if (filterLower === "pending") return s.includes("pending");
        return s === filterLower;
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (o) =>
          String(o.orderId || "").toLowerCase().includes(q) ||
          String(o.id || "").toLowerCase().includes(q) ||
          String(o.userId || "").toLowerCase().includes(q) ||
          String(o.patientName || "").toLowerCase().includes(q) ||
          String(o.paymentMode || "").toLowerCase().includes(q) ||
          String(o.paymentStatus || "").toLowerCase().includes(q) ||
          String(o.transactionId || "").toLowerCase().includes(q) ||
          String(o.status || "").toLowerCase().includes(q) ||
          String(o.orderDate || "").toLowerCase().includes(q) ||
          String(o.medicineName || "").toLowerCase().includes(q) ||
          String(o.paidAmount || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [orders, selectedStatusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredOrders.slice(start, start + rowsPerPage);
  }, [filteredOrders, currentPage, rowsPerPage]);

  // Handle status update
  const handleStatusChange = async (order, newStatus, e) => {
    if (isReadOnlyPartner()) return;
    if (order.status === newStatus) return;

    const targetStatusCode =
      ORDER_STATUS_LABEL_TO_CODE[newStatus] ||
      (ORDER_STATUS_CODE_TO_LABEL[newStatus] ? Number(newStatus) : 1);
    const targetStatusLabel =
      ORDER_STATUS_CODE_TO_LABEL[targetStatusCode] || newStatus;

    let cancelReason = "";

    if (targetStatusCode === 2) {
      const cancelResult = await Swal.fire({
        title: "Cancel Order",
        text: `Please enter the reason for cancelling Order #${order.orderId}:`,
        input: "textarea",
        inputPlaceholder: "Enter cancellation reason (mandatory)...",
        inputAttributes: {
          "aria-label": "Enter cancellation reason",
          rows: "3",
        },
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#94a3b8",
        confirmButtonText: "Confirm Cancellation",
        cancelButtonText: "Close",
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return "Cancellation reason is mandatory!";
          }
          return null;
        },
      });

      if (!cancelResult.isConfirmed) {
        if (e && e.target) e.target.value = order.status;
        return;
      }
      cancelReason = cancelResult.value.trim();
    } else {
      const result = await Swal.fire({
        title: "Change Order Status?",
        text: `Update Order #${order.orderId} status to "${targetStatusLabel}"?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#0ba6df",
        cancelButtonColor: "#94a3b8",
        confirmButtonText: "Yes, Update Status",
        cancelButtonText: "Cancel",
      });

      if (!result.isConfirmed) {
        if (e && e.target) e.target.value = order.status;
        return;
      }
    }

    try {
      const res = await updateOrderStatus(order, targetStatusCode, cancelReason);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id || o.orderId === order.orderId
            ? {
              ...o,
              status: targetStatusLabel,
              statusCode: targetStatusCode,
              type: targetStatusCode,
              cancelReason: cancelReason || o.cancelReason,
            }
            : o
        )
      );

      Swal.fire({
        title: targetStatusCode === 2 ? "Order Cancelled!" : "Status Updated!",
        text: res?.apiMessage || `Order #${order.orderId} status set to "${targetStatusLabel}".`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Status update error:", err);
      if (e && e.target) e.target.value = order.status;
      Swal.fire({
        title: "Update Failed",
        text: err?.message || "Could not update order status.",
        icon: "error",
      });
    }
  };

  const handleOpenDetails = (order) => {
    const dbId = order.dbId || order.id || "";
    navigate(`/Admin/orders/${order.orderId}?user_id=${order.userId || ""}&id=${dbId}`, {
      state: { order, orderId: order.orderId, userId: order.userId, id: dbId, dbId },
    });
  };

  const handleOpenQuickView = async (order) => {
    setQuickViewOrder(order);
    setIsQuickViewOpen(true);
    const targetId = order.dbId || order.id;
    if (targetId) {
      setQuickViewLoading(true);
      try {
        const res = await fetchOrderDetails(targetId);
        if (res?.success && res.data) {
          const detailed = normalizeOrderDetails(res.data, targetId, order);
          if (detailed) {
            setQuickViewOrder((prev) =>
              prev && (prev.orderId === order.orderId || prev.id === order.id)
                ? { ...prev, ...detailed }
                : detailed
            );
            // Sync enriched fields into local orders list
            setOrders((prev) =>
              prev.map((o) =>
                o.orderId === order.orderId || o.id === order.id
                  ? {
                      ...o,
                      ...detailed,
                      status: o.status || detailed.status,
                    }
                  : o
              )
            );
          }
        }
      } catch (err) {
        console.warn("Could not fetch full order details for quick view:", err);
      } finally {
        setQuickViewLoading(false);
      }
    }
  };

  const handleCloseQuickView = () => {
    setIsQuickViewOpen(false);
    setQuickViewOrder(null);
    setQuickViewLoading(false);
  };

  return (
    <div className="patient-orders-tab-wrapper p-3">
      {/* Top Header & User ID Filter Toolbar */}
      <div
        className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2"
        style={{ borderBottom: "1px solid #e2e8f0" }}
      >
        <div className="d-flex align-items-center gap-2">
          <span
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "#e0f2fe",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            <i className="fa-solid fa-cart-shopping" />
          </span>
          <div>
            <h5 className="mb-0 fw-bold" style={{ color: "#1e293b" }}>
              My Orders
            </h5>
            <small className="text-muted">
              {activeUserId
                ? `Orders for Patient User ID: ${activeUserId}`
                : "Showing all orders (no specific user ID selected)"}
            </small>
          </div>
        </div>

        {/* User ID quick search and filter */}
        <form
          onSubmit={handleApplyUserFilter}
          className="d-flex align-items-center gap-2"
          style={{ maxWidth: "420px", flexWrap: "nowrap" }}
        >
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-light text-muted border-end-0">
              <i className="fa fa-user me-1" /> User ID
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 1720"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              style={{ minWidth: "90px" }}
            />
            <button className="btn btn-primary btn-sm" type="submit" title="Filter by User ID">
              <i className="fa fa-filter me-1" /> Filter
            </button>
            {userIdInput !== resolvedPropUserId && (
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                onClick={handleResetUserFilter}
                title="Reset to Patient's User ID"
              >
                Reset
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => loadOrders(activeUserId)}
            title="Refresh orders from API"
          >
            <i className="fa fa-refresh" />
          </button>
        </form>
      </div>

      {/* Summary Stats Cards */}
      <div className="orders-stats-grid mb-3">
        <div
          className={`order-stat-card all ${selectedStatusFilter === "ALL" ? "active" : ""}`}
          onClick={() => {
            setSelectedStatusFilter("ALL");
            setCurrentPage(1);
          }}
        >
          <div className="order-stat-icon-box">
            <i className="fa fa-shopping-bag" />
          </div>
          <div className="order-stat-info">
            <div className="stat-number">{stats.all}</div>
            <div className="stat-label">TOTAL ORDERS</div>
          </div>
        </div>

        <div
          className={`order-stat-card pending ${selectedStatusFilter === "Pending" ? "active" : ""}`}
          onClick={() => {
            setSelectedStatusFilter("Pending");
            setCurrentPage(1);
          }}
        >
          <div className="order-stat-icon-box">
            <i className="fa fa-clock-o" />
          </div>
          <div className="order-stat-info">
            <div className="stat-number">{stats.pending}</div>
            <div className="stat-label">PENDING</div>
          </div>
        </div>

        <div
          className={`order-stat-card in-process ${selectedStatusFilter === "In Process" ? "active" : ""}`}
          onClick={() => {
            setSelectedStatusFilter("In Process");
            setCurrentPage(1);
          }}
        >
          <div className="order-stat-icon-box">
            <i className="fa fa-cogs" />
          </div>
          <div className="order-stat-info">
            <div className="stat-number">{stats.inProcess}</div>
            <div className="stat-label">IN PROCESS</div>
          </div>
        </div>

        <div
          className={`order-stat-card purchased ${selectedStatusFilter === "Purchased" ? "active" : ""}`}
          onClick={() => {
            setSelectedStatusFilter("Purchased");
            setCurrentPage(1);
          }}
        >
          <div className="order-stat-icon-box">
            <i className="fa fa-shopping-bag" />
          </div>
          <div className="order-stat-info">
            <div className="stat-number">{stats.purchased}</div>
            <div className="stat-label">PURCHASED</div>
          </div>
        </div>

        <div
          className={`order-stat-card on-the-way ${selectedStatusFilter === "On The Way" ? "active" : ""}`}
          onClick={() => {
            setSelectedStatusFilter("On The Way");
            setCurrentPage(1);
          }}
        >
          <div className="order-stat-icon-box">
            <i className="fa fa-truck" />
          </div>
          <div className="order-stat-info">
            <div className="stat-number">{stats.onTheWay}</div>
            <div className="stat-label">ON THE WAY</div>
          </div>
        </div>

        <div
          className={`order-stat-card delivered ${selectedStatusFilter === "Delivered" ? "active" : ""}`}
          onClick={() => {
            setSelectedStatusFilter("Delivered");
            setCurrentPage(1);
          }}
        >
          <div className="order-stat-icon-box">
            <i className="fa fa-check-circle" />
          </div>
          <div className="order-stat-info">
            <div className="stat-number">{stats.delivered}</div>
            <div className="stat-label">DELIVERED</div>
          </div>
        </div>

        <div
          className={`order-stat-card cancelled ${selectedStatusFilter === "Cancelled" ? "active" : ""}`}
          onClick={() => {
            setSelectedStatusFilter("Cancelled");
            setCurrentPage(1);
          }}
        >
          <div className="order-stat-icon-box">
            <i className="fa fa-times-circle" />
          </div>
          <div className="order-stat-info">
            <div className="stat-number">{stats.cancelled}</div>
            <div className="stat-label">CANCELLED</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="orders-toolbar-card mb-3">
        <div className="orders-toolbar-left">
          <span className="fw-semibold text-secondary small">
            Filter Status:
          </span>
          <div className="btn-group btn-group-sm" role="group">
            {["ALL", "Pending", "In Process", "Purchased", "On The Way", "Delivered", "Cancelled"].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${selectedStatusFilter === st ? "btn-primary text-white" : "btn-outline-secondary"
                  }`}
                onClick={() => {
                  setSelectedStatusFilter(st);
                  setCurrentPage(1);
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="orders-toolbar-right">
          <div className="orders-search-box">
            <i className="fa fa-search" />
            <input
              type="text"
              className="orders-search-input"
              placeholder="Search in orders..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <i
                className="fa fa-times text-muted"
                style={{ cursor: "pointer", marginLeft: "6px" }}
                onClick={() => setSearchTerm("")}
              />
            )}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="orders-table-wrapper">
        <div className="table-responsive">
          <table className="orders-table">
            <thead>
              <tr>
                <th style={{ width: "50px", textAlign: "center" }}>S.No.</th>
                <th style={{ minWidth: "120px" }}>Order ID</th>
                <th style={{ minWidth: "180px" }}>Medicines / Items</th>
                <th style={{ minWidth: "90px", textAlign: "center" }}>Items</th>
                <th style={{ minWidth: "140px" }}>Payment Mode</th>
                <th style={{ minWidth: "135px" }}>Payment Status</th>
                <th style={{ minWidth: "130px" }}>Price / Total</th>
                <th style={{ minWidth: "140px" }}>Order On</th>
                <th style={{ minWidth: "120px" }}>Status</th>
                <th className="text-center" style={{ width: "70px" }}>
                  Details
                </th>
                <th style={{ minWidth: "145px", whiteSpace: "nowrap" }}>Change Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                    Loading orders history...
                  </td>
                </tr>
              ) : paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => {
                  const rowSNo = (currentPage - 1) * rowsPerPage + index + 1;
                  const badgeClass = getStatusBadgeClass(order.status);
                  const payBadge = getPaymentBadge(order.paymentStatus, order.paymentMode);

                  return (
                    <tr key={order.orderId || order.id || index}>
                      <td className="text-center">{rowSNo}</td>
                      <td className="order-id-cell">
                        <span
                          style={{ cursor: "pointer", fontWeight: 600, color: "#0284c7" }}
                          onClick={() => handleOpenQuickView(order)}
                          title="Click to view details"
                        >
                          #{order.orderId}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            maxWidth: "220px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={order.medicineName || "Prescription Order"}
                        >
                          {order.medicineName || "Prescription Order"}
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-light text-dark border">
                          {order.totalItems || order.items?.length || 1}
                        </span>
                      </td>
                      <td className="order-payment-mode">
                        <div className="d-flex align-items-center gap-1">
                          <i
                            className={
                              String(order.paymentMode || "").toLowerCase().includes("online")
                                ? "fa fa-credit-card text-primary"
                                : "fa fa-money text-success"
                            }
                          />
                          <span>{order.paymentMode || "Cash On Delivery"}</span>
                        </div>
                        {order.transactionId && (
                          <div className="order-txn-id" title={`Transaction ID: ${order.transactionId}`}>
                            Txn: {order.transactionId}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`order-payment-badge ${payBadge.badgeClass}`}>
                          <i className={payBadge.icon} />
                          {payBadge.label}
                        </span>
                      </td>
                      <td className="order-amount-cell fw-bold text-dark">
                        {order.paidAmount && Number(order.paidAmount) > 0 ? (
                          <>
                            {order.currencySymbol || (order.currency === "INR" ? "₹" : "Rs")}{" "}
                            {typeof order.paidAmount === "number"
                              ? order.paidAmount.toFixed(2)
                              : order.paidAmount}
                          </>
                        ) : (
                          <span className="text-muted" style={{ fontWeight: 500, fontSize: "12px" }}>
                            {order.currencySymbol || (order.currency === "INR" ? "₹" : "Rs")} 0.00
                            <span
                              className="badge bg-light text-muted border ms-1"
                              style={{ fontSize: "9.5px", padding: "2px 4px" }}
                              title="Quotation / purchase bill pending"
                            >
                              Awaiting quote
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="order-date-cell">{order.orderDate || "-"}</td>
                      <td>
                        <span className={`order-status-badge ${badgeClass}`}>
                          <span className="order-status-dot" />
                          {order.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-inline-flex align-items-center justify-content-center">
                          <button
                            type="button"
                            className="order-details-eye-btn"
                            title="View order details"
                            onClick={() => handleOpenQuickView(order)}
                          >
                            <i className="fa fa-eye" />
                          </button>
                          {(() => {
                            const billsCount = order.bills?.length || getOrderBills(order.orderId).length;
                            const hasBills = billsCount > 0;
                            const showBillAction = canShowBillAction(order, hasBills);
                            if (!showBillAction) {
                              return <span style={{ width: "21px", display: "inline-block", marginLeft: "6px" }} />;
                            }
                            return (
                              <button
                                type="button"
                                className={`order-details-bill-btn ${hasBills ? "has-bill" : ""}`}
                                title={hasBills ? `Manage Bill / Invoice (${billsCount} uploaded)` : "Upload Bill / Invoice"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenQuickView(order);
                                }}
                              >
                                <i className={hasBills ? "fa fa-file-text" : "fa fa-file-text-o"} />
                                {hasBills && (
                                  <span className="order-bill-count-badge">
                                    {billsCount}
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                      <td>
                        <div className="order-status-select-wrap">
                          <label htmlFor={`order-status-${order.orderId}`} className="visually-hidden">
                            Change status for order {order.orderId}
                          </label>
                          <select
                            id={`order-status-${order.orderId}`}
                            className={`order-status-select ${badgeClass}`}
                            value={order.status}
                            disabled={isReadOnlyPartner()}
                            style={isReadOnlyPartner() ? { cursor: "not-allowed", opacity: 0.8 } : {}}
                            onChange={(e) => handleStatusChange(order, e.target.value, e)}
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Process">In Process</option>
                            <option value="Purchased">Purchased</option>
                            <option value="On The Way">On The Way</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11">
                    <div className="orders-empty-state py-5 text-center">
                      <div
                        className="orders-empty-icon mb-2"
                        style={{ fontSize: "40px", color: "#94a3b8" }}
                      >
                        <i className="fa fa-shopping-basket" />
                      </div>
                      <h6 className="fw-bold text-dark">No Orders Found</h6>
                      <p className="small text-muted mb-2">
                        {searchTerm
                          ? `No orders matching "${searchTerm}".`
                          : activeUserId
                            ? `No orders found for Patient User ID: ${activeUserId}`
                            : "No orders found for this patient."}
                      </p>
                      {activeUserId && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mt-1"
                          onClick={() => {
                            setUserIdInput("");
                            setActiveUserId("");
                            loadOrders("");
                          }}
                        >
                          View All Orders
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredOrders.length > 0 && (
          <div className="orders-pagination-bar px-3 py-2 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="small text-muted">
              Showing{" "}
              <strong>
                {Math.min((currentPage - 1) * rowsPerPage + 1, filteredOrders.length)}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(currentPage * rowsPerPage, filteredOrders.length)}
              </strong>{" "}
              of <strong>{filteredOrders.length}</strong> orders
            </div>

            {totalPages > 1 && (
              <Stack spacing={2}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(e, val) => setCurrentPage(val)}
                  color="primary"
                  shape="rounded"
                  size="small"
                />
              </Stack>
            )}
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <Dialog
        open={isQuickViewOpen}
        onClose={handleCloseQuickView}
        fullWidth
        maxWidth="md"
        scroll="paper"
        PaperProps={{
          style: {
            borderRadius: "12px",
            maxHeight: "90vh",
            height: "auto",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        }}
      >
        {quickViewOrder && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#ffffff",
                flexShrink: 0,
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <h5 className="mb-0 fw-bold">
                  Order Details &bull; #{quickViewOrder.orderId}
                </h5>
                {quickViewLoading && (
                  <span className="small text-muted d-inline-flex align-items-center gap-1 ms-2" style={{ fontSize: "12px" }}>
                    <span className="spinner-border spinner-border-sm text-primary" role="status" style={{ width: "12px", height: "12px" }} />
                    Loading items...
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={handleCloseQuickView}
                aria-label="Close"
              />
            </div>

            <DialogContent
              dividers
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                padding: "20px",
                backgroundColor: "#ffffff",
              }}
            >
              <div className="order-info-grid mb-3">
                <div className="order-info-panel">
                  <h5>
                    <i className="fa fa-user-circle text-primary" /> Patient Details
                  </h5>
                  <div className="order-info-row">
                    <span className="order-info-label">Name:</span>
                    <span className="order-info-val">
                      {quickViewOrder.patientName || patient?.fullname || patient?.name || "-"}
                    </span>
                  </div>
                  <div className="order-info-row">
                    <span className="order-info-label">User ID:</span>
                    <span className="order-info-val badge bg-light text-dark border">
                      {quickViewOrder.userId || "-"}
                    </span>
                  </div>
                  <div className="order-info-row">
                    <span className="order-info-label">Phone:</span>
                    <span className="order-info-val">
                      {quickViewOrder.patientPhone || patient?.phone || patient?.mobile || "-"}
                    </span>
                  </div>
                  {quickViewOrder.delivery_type && (
                    <div className="order-info-row">
                      <span className="order-info-label">Delivery Type:</span>
                      <span className="order-info-val fw-semibold text-dark">
                        {quickViewOrder.delivery_type}
                      </span>
                    </div>
                  )}
                  {quickViewOrder.room_number && (
                    <div className="order-info-row">
                      <span className="order-info-label">Room Number:</span>
                      <span className="order-info-val">
                        <span className="badge bg-primary-subtle text-primary border px-2 py-1" style={{ fontSize: "12px", fontWeight: 600 }}>
                          <i className="fa fa-bed me-1" />
                          Room {quickViewOrder.room_number}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="order-info-row">
                    <span className="order-info-label">Address:</span>
                    <span className="order-info-val">
                      {quickViewOrder.delivery_address || quickViewOrder.deliveryAddress || quickViewOrder.address || "Mauritius"}
                    </span>
                  </div>
                </div>

                <div className="order-info-panel">
                  <h5>
                    <i className="fa fa-credit-card text-success" /> Payment & Order Summary
                  </h5>
                  <div className="order-info-row">
                    <span className="order-info-label">Order Status:</span>
                    <span className={`order-status-badge ${getStatusBadgeClass(quickViewOrder.status)}`}>
                      <span className="order-status-dot" />
                      {quickViewOrder.status}
                    </span>
                  </div>
                  <div className="order-info-row">
                    <span className="order-info-label">Payment Status:</span>
                    {(() => {
                      const qp = getPaymentBadge(quickViewOrder.paymentStatus, quickViewOrder.paymentMode);
                      return (
                        <span className={`order-payment-badge ${qp.badgeClass}`}>
                          <i className={qp.icon} />
                          {qp.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="order-info-row">
                    <span className="order-info-label">Payment Mode:</span>
                    <span className="order-info-val">
                      <i
                        className={
                          String(quickViewOrder.paymentMode || "").toLowerCase().includes("online")
                            ? "fa fa-credit-card text-primary me-1"
                            : "fa fa-money text-success me-1"
                        }
                      />
                      {quickViewOrder.paymentMode || "Cash On Delivery"}
                    </span>
                  </div>
                  {quickViewOrder.transactionId && (
                    <div className="order-info-row">
                      <span className="order-info-label">Transaction ID:</span>
                      <span className="order-info-val font-monospace text-primary fw-semibold">
                        {quickViewOrder.transactionId}
                      </span>
                    </div>
                  )}
                  {quickViewOrder.paymentDate && (
                    <div className="order-info-row">
                      <span className="order-info-label">Payment Date:</span>
                      <span className="order-info-val">{quickViewOrder.paymentDate}</span>
                    </div>
                  )}
                  <div className="order-info-row">
                    <span className="order-info-label">Total Amount:</span>
                    <span className="order-info-val text-primary fw-bold fs-6">
                      {quickViewOrder.currencySymbol || "Rs"}{" "}
                      {typeof quickViewOrder.paidAmount === "number"
                        ? quickViewOrder.paidAmount.toFixed(2)
                        : quickViewOrder.paidAmount || "0.00"}
                      {Number(quickViewOrder.paidAmount || 0) === 0 && (
                        <span className="badge bg-light text-muted border ms-2" style={{ fontSize: "10px" }}>
                          As per purchase bill
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="order-info-row">
                    <span className="order-info-label">Order Date:</span>
                    <span className="order-info-val">{quickViewOrder.orderDate}</span>
                  </div>
                  {quickViewOrder.timezone && (
                    <div className="order-info-row">
                      <span className="order-info-label">Timezone:</span>
                      <span className="order-info-val text-muted">{quickViewOrder.timezone}</span>
                    </div>
                  )}
                  {quickViewOrder.cancelReason && (
                    <div className="order-info-row">
                      <span className="order-info-label text-danger">Cancel Reason:</span>
                      <span className="order-info-val text-danger">
                        {quickViewOrder.cancelReason}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List (Medicines & Healthcare) */}
              <div className="mb-3">
                <h6 className="fw-bold mb-2 d-flex align-items-center gap-2">
                  <i className="fa fa-medkit text-primary" />
                  <span>Ordered Medicines & Items</span>
                  <span className="badge bg-light text-dark border ms-auto" style={{ fontSize: "11px" }}>
                    {quickViewOrder.items?.length || quickViewOrder.totalItems || 1} Item(s)
                  </span>
                </h6>
                {quickViewOrder.items && quickViewOrder.items.length > 0 ? (
                  <div className="table-responsive border rounded">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: "45px" }}>Image</th>
                          <th>Medicine Name</th>
                          <th>Category</th>
                          <th className="text-center">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickViewOrder.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td>
                              {it.image ? (
                                <img
                                  src={it.image}
                                  alt={it.name}
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                    border: "1px solid #e2e8f0",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => {
                                    setPreviewModalImg(it.image);
                                    setPreviewModalTitle(it.name);
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <i className="fa fa-medkit text-secondary" />
                              )}
                            </td>
                            <td className="fw-semibold">{it.name}</td>
                            <td>{it.category || "Pharmaceuticals"}</td>
                            <td className="text-center">
                              <span className="badge bg-light text-dark border">
                                {it.quantity}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 border rounded bg-light">
                    <strong>Medicines:</strong> {quickViewOrder.medicineName || "Prescription items"}
                  </div>
                )}
              </div>

              {/* Manual / Written Medicines Section */}
              {Array.isArray(quickViewOrder.written_medicines) && quickViewOrder.written_medicines.length > 0 && (
                <div className="mb-3">
                  <h6 className="fw-bold mb-2 d-flex align-items-center gap-2">
                    <i className="fa fa-pencil-square-o text-warning" />
                    <span>Manual / Written Medicines</span>
                    <span className="badge bg-warning-subtle text-warning-emphasis border ms-auto" style={{ fontSize: "11px" }}>
                      {quickViewOrder.written_medicines.length} Item(s)
                    </span>
                  </h6>
                  <div className="table-responsive border rounded">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Medicine Name</th>
                          <th className="text-center">Prescribed Qty</th>
                          <th className="text-center">Duration</th>
                          <th>Entry Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickViewOrder.written_medicines.map((w, idx) => (
                          <tr key={w.id || idx}>
                            <td className="fw-semibold text-dark">{w.name}</td>
                            <td className="text-center">
                              <span className="badge bg-light text-dark border">
                                {w.quantity || "—"}
                              </span>
                            </td>
                            <td className="text-center">
                              {w.days ? `${w.days} Days` : "—"}
                            </td>
                            <td>
                              <span className="badge bg-info-subtle text-info-emphasis border" style={{ fontSize: "10.5px" }}>
                                Written Medicine
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Prescriptions & Uploaded Images Section */}
              {Array.isArray(quickViewOrder.prescriptions) && quickViewOrder.prescriptions.length > 0 && (
                <div className="mb-2">
                  <h6 className="fw-bold mb-2 d-flex align-items-center gap-2">
                    <i className="fa fa-file-image-o text-success" />
                    <span>Prescription & Medicine Photos</span>
                    <span className="badge bg-success-subtle text-success-emphasis border ms-auto" style={{ fontSize: "11px" }}>
                      {quickViewOrder.prescriptions.length} Prescription(s)
                    </span>
                  </h6>
                  <div className="d-flex flex-wrap gap-2">
                    {quickViewOrder.prescriptions.map((p, idx) => {
                      const front = p.frontImage || p.front_image;
                      const back = p.backImage || p.back_image;
                      return (
                        <div
                          key={p.id || idx}
                          className="border rounded p-2 text-center bg-light"
                          style={{ width: "130px", flexShrink: 0 }}
                        >
                          <div
                            style={{
                              width: "112px",
                              height: "90px",
                              backgroundColor: "#ffffff",
                              borderRadius: "4px",
                              overflow: "hidden",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1px solid #cbd5e1",
                            }}
                            onClick={() => {
                              if (front) {
                                setPreviewModalImg(front);
                                setPreviewModalTitle(p.name || `Prescription #${idx + 1}`);
                              }
                            }}
                            title="Click to view full image"
                          >
                            {front ? (
                              <img
                                src={front}
                                alt={p.name || `Prescription #${idx + 1}`}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <i className="fa fa-file-image-o fa-2x text-muted" />
                            )}
                          </div>
                          <div className="small text-truncate mt-1 fw-semibold" style={{ fontSize: "11px" }}>
                            {p.name || `Photo #${idx + 1}`}
                          </div>
                          <span
                            className="badge mt-1"
                            style={{
                              fontSize: "9.5px",
                              backgroundColor: p.type === 1 ? "#10b981" : "#0ba6df",
                              color: "#fff",
                            }}
                          >
                            {p.type === 1 ? "Medicine Photo" : "Prescription"}
                          </span>
                          {back && (
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm w-100 mt-1 py-0"
                              style={{ fontSize: "9.5px" }}
                              onClick={() => {
                                setPreviewModalImg(back);
                                setPreviewModalTitle(`${p.name || "Prescription"} (Back Side)`);
                              }}
                            >
                              Back Side
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </DialogContent>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                backgroundColor: "#f8fafc",
                flexShrink: 0,
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <label htmlFor="quickview-status-select" className="small text-muted fw-bold mb-0">
                  Status:
                </label>
                <select
                  id="quickview-status-select"
                  className={`order-status-select ${getStatusBadgeClass(quickViewOrder.status)}`}
                  value={quickViewOrder.status}
                  disabled={isReadOnlyPartner()}
                  style={{ width: "140px", height: "32px", fontSize: "12px" }}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    handleStatusChange(quickViewOrder, newStatus, e);
                    setQuickViewOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
                  }}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Process">In Process</option>
                  <option value="Purchased">Purchased</option>
                  <option value="On The Way">On The Way</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCloseQuickView}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    handleCloseQuickView();
                    handleOpenDetails(quickViewOrder);
                  }}
                >
                  <i className="fa fa-external-link me-1" />
                  Full View Page
                </button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Full-screen Image Preview Dialog */}
      <Dialog
        open={Boolean(previewModalImg)}
        onClose={() => setPreviewModalImg(null)}
        maxWidth="lg"
      >
        <div style={{ position: "relative", backgroundColor: "#0f172a", textAlign: "center", padding: "12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#ffffff",
              marginBottom: "8px",
              padding: "0 8px",
            }}
          >
            <span className="fw-semibold">{previewModalTitle || "Document Preview"}</span>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => setPreviewModalImg(null)}
              aria-label="Close"
            />
          </div>
          {previewModalImg && (
            <img
              src={previewModalImg}
              alt="Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: "4px",
              }}
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}
