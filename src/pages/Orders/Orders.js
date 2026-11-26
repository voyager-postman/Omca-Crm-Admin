import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import {
  fetchOrdersHistory,
  updateOrderStatus,
  exportOrdersToCSV,
  ORDER_STATUS_CODE_TO_LABEL,
  ORDER_STATUS_LABEL_TO_CODE,
  getOrderBills,
  getOrderBillNote,
  getOrderBillPrice,
  fetchOrderDocuments,
  saveOrderDocuments,
} from "../../services/ordersApi";
import { markRecordRead } from "../../services/unreadApi";
import { clearUnreadById, UnreadDot } from "../../components/NewTag";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import "./Orders.css";

export default function Orders() {
  const navigate = useNavigate();
  const userRole = (localStorage.getItem("Role") || "").toLowerCase();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw.split(",").map((p) => p.trim());
  const canAccessOrders =
    userRole === "admin" ||
    permissionsList.includes("/Orders") ||
    permissionsList.includes("Orders") ||
    permissionsList.includes("/orders") ||
    permissionsList.includes("orders");

  useEffect(() => {
    if (!canAccessOrders) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [canAccessOrders, navigate]);

  const [searchParams, setSearchParams] = useSearchParams();

  const initialUserId = searchParams.get("user_id") || searchParams.get("userId") || "";
  const [userIdInput, setUserIdInput] = useState(initialUserId);
  const [activeUserIdFilter, setActiveUserIdFilter] = useState(initialUserId);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Quick view modal state
  const [quickViewOrder, setQuickViewOrder] = useState(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  // Bill Upload / Management modal state
  const [billModalOrder, setBillModalOrder] = useState(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billPendingStatus, setBillPendingStatus] = useState("");
  const [billFiles, setBillFiles] = useState([]);
  const [billNotes, setBillNotes] = useState("");
  const [billPrice, setBillPrice] = useState("");
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [previewBillImg, setPreviewBillImg] = useState(null);
  const [previewBillTitle, setPreviewBillTitle] = useState("");

  // Load orders on component mount
  useEffect(() => {
    loadOrders(activeUserIdFilter);
  }, []);

  const loadOrders = async (userIdToFilter = activeUserIdFilter) => {
    setLoading(true);
    try {
      const result = await fetchOrdersHistory({
        user_id: userIdToFilter ? String(userIdToFilter).trim() : "",
      });
      if (result?.data) {
        setOrders(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      Swal.fire("Error", "Could not load orders history.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUserIdFilter = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanId = userIdInput.trim();
    setActiveUserIdFilter(cleanId);
    setCurrentPage(1);
    if (cleanId) {
      setSearchParams({ user_id: cleanId });
    } else {
      setSearchParams({});
    }
    loadOrders(cleanId);
  };

  const handleClearUserIdFilter = () => {
    setUserIdInput("");
    setActiveUserIdFilter("");
    setSearchParams({});
    setCurrentPage(1);
    loadOrders("");
  };

  // Status counts for summary cards matching screenshot
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

  // Filtered orders based on search and status tabs
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
          String(o.status || "").toLowerCase().includes(q) ||
          String(o.orderDate || "").toLowerCase().includes(q) ||
          String(o.paidAmount || "").toLowerCase().includes(q) ||
          String(o.medicineName || "").toLowerCase().includes(q) ||
          String(o.currency || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [orders, selectedStatusFilter, searchTerm]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredOrders.slice(start, start + rowsPerPage);
  }, [filteredOrders, currentPage, rowsPerPage]);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  // Status Change Handler with SweetAlert confirmation
  // 1 -> Pending, 2 -> Cancelled, 3 -> In Process, 4 -> On The Way, 5 -> Delivered, 6 -> Purchased
  const markOrderAction = (order) => {
    const recordId = order?.orderId || order?.id;
    if (!recordId) return;
    markRecordRead("orders", recordId);
    setOrders((prev) => clearUnreadById(prev, recordId, ["orderId", "id"]));
  };

  const handleStatusChange = async (order, newStatus, e) => {
    markOrderAction(order);
    if (order.status === newStatus) return;

    const targetStatusCode =
      ORDER_STATUS_LABEL_TO_CODE[newStatus] ||
      (ORDER_STATUS_CODE_TO_LABEL[newStatus] ? Number(newStatus) : 1);
    const targetStatusLabel =
      ORDER_STATUS_CODE_TO_LABEL[targetStatusCode] || newStatus;

    let cancelReason = "";

    // If cancelling the order, cancel_reason is a mandatory requirement
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
        if (e && e.target) {
          e.target.value = order.status;
        }
        return;
      }
      cancelReason = cancelResult.value.trim();
    } else if (targetStatusCode === 6) {
      // Prompt for Purchased with option to Upload Bill or update directly
      const purchasePrompt = await Swal.fire({
        title: "Order Purchased",
        text: `Update Order #${order.orderId} status to "Purchased"? Would you like to upload the purchase bill/invoice copy with notes now?`,
        icon: "question",
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: "#0d9488",
        denyButtonColor: "#0ba6df",
        cancelButtonColor: "#94a3b8",
        confirmButtonText: "Upload Bill Now",
        denyButtonText: "Update Status Only",
        cancelButtonText: "Cancel",
      });

      if (purchasePrompt.isDismissed) {
        if (e && e.target) e.target.value = order.status;
        return;
      }

      if (purchasePrompt.isConfirmed) {
        handleOpenBillModal(order, "Purchased");
        return;
      }
      // If deny (Update Status Only), proceed to update status directly below
    } else if (targetStatusCode === 5) {
      // Delivered prompt with quick check if bills exist
      const bills = getOrderBills(order.orderId);
      const deliveredPrompt = await Swal.fire({
        title: "Mark as Delivered?",
        text: `Update Order #${order.orderId} status to "Delivered"?${bills.length === 0 ? " You can also upload/attach the bill copy." : ""}`,
        icon: "question",
        showCancelButton: true,
        showDenyButton: bills.length === 0,
        confirmButtonColor: "#10b981",
        denyButtonColor: "#0d9488",
        cancelButtonColor: "#94a3b8",
        confirmButtonText: "Yes, Mark Delivered",
        denyButtonText: "Upload Bill First",
        cancelButtonText: "Cancel",
      });

      if (deliveredPrompt.isDismissed) {
        if (e && e.target) e.target.value = order.status;
        return;
      }

      if (deliveredPrompt.isDenied) {
        handleOpenBillModal(order, "Delivered");
        return;
      }
    } else {
      const result = await Swal.fire({
        title: "Change Order Status?",
        text: `Update Order #${order.orderId} (ID: ${order.id}) status to "${targetStatusLabel}"?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#0ba6df",
        cancelButtonColor: "#94a3b8",
        confirmButtonText: "Yes, Update Status",
        cancelButtonText: "Cancel",
      });

      if (!result.isConfirmed) {
        if (e && e.target) {
          e.target.value = order.status;
        }
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
        text:
          res?.apiMessage ||
          `Order #${order.orderId} status set to "${targetStatusLabel}".`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Status update error:", err);
      if (e && e.target) {
        e.target.value = order.status;
      }
      Swal.fire({
        title: "Update Failed",
        text: err?.message || "Could not update order status.",
        icon: "error",
      });
    }
  };

  // Bill Upload & Management Handlers
  const handleOpenBillModal = (order, pendingStatus = "") => {
    markOrderAction(order);
    // Start empty — do not show stale local/default bills. Fill only from live GET API.
    setBillModalOrder({
      ...order,
      bills: [],
      billNotes: "",
      billPrice: "",
      documentId: null,
      hasBillRecord: false,
    });
    setBillPendingStatus(pendingStatus);
    setBillFiles([]);
    setBillNotes("");
    setBillPrice("");
    setIsBillModalOpen(true);

    // Fetch documents, notes & price dynamically from API:
    // GET /api/crm/orders/{order_id}/documents
    const targetOrderId = order?.orderId || order?.id || order?.order;
    if (targetOrderId) {
      fetchOrderDocuments(targetOrderId).then((res) => {
        if (!res) return;

        // Live API is source of truth (including empty invoices/notes/price)
        if (res.fromLiveApi) {
          const apiNotes = res.notes || "";
          const apiPrice =
            res.price !== "" && res.price !== null && res.price !== undefined
              ? res.price
              : "";
          const apiDocs = Array.isArray(res.documents) ? res.documents : [];

          setBillNotes(apiNotes);
          setBillPrice(
            apiPrice !== "" && apiPrice !== null && apiPrice !== undefined
              ? String(apiPrice)
              : ""
          );

          const patch = {
            bills: apiDocs,
            billNotes: apiNotes,
            billPrice: apiPrice !== "" && apiPrice !== null && apiPrice !== undefined ? apiPrice : "",
            paidAmount:
              apiPrice !== "" && apiPrice !== null && apiPrice !== undefined
                ? Number(apiPrice)
                : undefined,
            documentId: res.documentId || null,
            hasBillRecord: Boolean(res.hasExisting),
          };

          setBillModalOrder((prev) => (prev ? { ...prev, ...patch } : prev));
          setOrders((prev) =>
            prev.map((o) =>
              o.orderId === targetOrderId || o.id === targetOrderId
                ? {
                    ...o,
                    ...patch,
                    paidAmount:
                      patch.paidAmount !== undefined ? patch.paidAmount : o.paidAmount,
                  }
                : o
            )
          );
          return;
        }

        // Offline/cache fallback only when live API failed
        const apiNotes = res.notes || "";
        const apiPrice = res.price;
        const apiDocs = Array.isArray(res.documents) ? res.documents : [];
        if (apiNotes) setBillNotes(apiNotes);
        if (apiPrice !== "" && apiPrice !== null && apiPrice !== undefined) {
          setBillPrice(String(apiPrice));
        }
        if (apiDocs.length > 0 || apiNotes || (apiPrice !== "" && apiPrice != null)) {
          const patch = {
            bills: apiDocs,
            billNotes: apiNotes,
            billPrice: apiPrice !== "" && apiPrice != null ? apiPrice : "",
            documentId: res.documentId || null,
            hasBillRecord: Boolean(res.hasExisting),
          };
          setBillModalOrder((prev) => (prev ? { ...prev, ...patch } : prev));
        }
      });
    }
  };

  const handleCloseBillModal = () => {
    setIsBillModalOpen(false);
    setBillModalOrder(null);
    setBillPendingStatus("");
    setBillFiles([]);
    setBillNotes("");
    setBillPrice("");
  };

  const handleBillFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const filePromises = selectedFiles.map((file, idx) => {
      return new Promise((resolve) => {
        const item = {
          id: `bf-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: null,
        };

        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            item.preview = reader.result;
            resolve(item);
          };
          reader.onerror = () => resolve(item);
          reader.readAsDataURL(file);
        } else {
          resolve(item);
        }
      });
    });

    Promise.all(filePromises).then((newItems) => {
      setBillFiles((prev) => [...prev, ...newItems]);
    });

    e.target.value = "";
  };

  const handleRemoveBillFile = (fileId) => {
    setBillFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleSaveBill = async (alsoUpdateStatus = false) => {
    if (!billModalOrder) return;
    if (billFiles.length === 0 && !billNotes.trim() && !String(billPrice).trim()) {
      Swal.fire("Notice", "Please select at least one bill file, provide a note, or enter a price.", "warning");
      return;
    }

    setIsSavingBill(true);
    try {
      const numericPrice =
        billPrice === "" || billPrice === null || billPrice === undefined
          ? ""
          : Number(String(billPrice).replace(/[^0-9.-]+/g, ""));
      const preparedBills = await Promise.all(
        billFiles.map(async (bf, idx) => {
          let url = bf.preview || "";
          if (bf.file && !url) {
            url = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => resolve("");
              reader.readAsDataURL(bf.file);
            });
          }
          return {
            id: bf.id,
            fileName: bf.name || `Invoice_Bill_${idx + 1}.jpg`,
            fileUrl: url,
            fileType: bf.type || (url.startsWith("data:image") ? "image/jpeg" : "application/pdf"),
            fileSize: bf.size || 0,
            price: Number.isFinite(numericPrice) ? numericPrice : "",
            uploadedAt: new Date().toLocaleString(),
          };
        })
      );

      const cleanNote = billNotes.trim();
      const targetOrderId = billModalOrder.orderId || billModalOrder.id || billModalOrder.order;

      // ADD:  POST /api/crm/orders/{order_id}/documents
      // UPDATE: POST /api/crm/orders/{order_id}/documents/update
      // Parameters: invoices[], notes, price
      const hasExisting =
        Boolean(billModalOrder.hasBillRecord) ||
        Boolean(billModalOrder.documentId) ||
        (Array.isArray(billModalOrder.bills) && billModalOrder.bills.length > 0);

      const uploadRes = await saveOrderDocuments(targetOrderId, {
        files: billFiles,
        notes: cleanNote,
        price: Number.isFinite(numericPrice) ? numericPrice : "",
        hasExisting,
      });

      if (!uploadRes?.success) {
        const failMsg =
          uploadRes?.message ||
          uploadRes?.apiError?.message ||
          "Could not save bill on server.";
        throw new Error(failMsg);
      }

      const updatedBills =
        Array.isArray(uploadRes?.documents) && uploadRes.documents.length > 0
          ? uploadRes.documents
          : getOrderBills(billModalOrder.orderId);
      const savedPrice =
        uploadRes?.price !== "" && uploadRes?.price !== null && uploadRes?.price !== undefined
          ? uploadRes.price
          : getOrderBillPrice(billModalOrder.orderId);
      const savedNotes = uploadRes?.notes || cleanNote;
      const targetStatusToApply = alsoUpdateStatus ? (billPendingStatus || "Purchased") : "";

      if (targetStatusToApply) {
        const targetStatusCode = ORDER_STATUS_LABEL_TO_CODE[targetStatusToApply] || 6;
        await updateOrderStatus(billModalOrder, targetStatusCode, "");
        setOrders((prev) =>
          prev.map((o) =>
            o.orderId === billModalOrder.orderId || o.id === billModalOrder.id
              ? {
                  ...o,
                  status: targetStatusToApply,
                  statusCode: targetStatusCode,
                  type: targetStatusCode,
                  bills: updatedBills,
                  billNotes: savedNotes,
                  billPrice: savedPrice,
                  documentId: uploadRes.documentId || o.documentId,
                  hasBillRecord: true,
                  paidAmount:
                    savedPrice !== "" && savedPrice !== null && savedPrice !== undefined
                      ? Number(savedPrice)
                      : o.paidAmount,
                }
              : o
          )
        );
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.orderId === billModalOrder.orderId || o.id === billModalOrder.id
              ? {
                  ...o,
                  bills: updatedBills,
                  billNotes: savedNotes,
                  billPrice: savedPrice,
                  documentId: uploadRes.documentId || o.documentId,
                  hasBillRecord: true,
                  paidAmount:
                    savedPrice !== "" && savedPrice !== null && savedPrice !== undefined
                      ? Number(savedPrice)
                      : o.paidAmount,
                }
              : o
          )
        );
      }

      Swal.fire({
        title: "Bill Saved!",
        text: targetStatusToApply
          ? `Bill(s) saved and Order #${billModalOrder.orderId} status set to "${targetStatusToApply}".`
          : `Bill copy and note successfully saved for Order #${billModalOrder.orderId}.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      handleCloseBillModal();
    } catch (err) {
      console.error("Save bill error:", err);
      const apiData = err?.response?.data;
      const validationMsg =
        apiData?.errors &&
        typeof apiData.errors === "object"
          ? Object.values(apiData.errors).flat().filter(Boolean).join(" ")
          : "";
      const errorText =
        validationMsg ||
        apiData?.message ||
        err?.message ||
        "Could not save bill.";
      Swal.fire("Error", errorText, "error");
    } finally {
      setIsSavingBill(false);
    }
  };

  // Open Details View
  const handleOpenDetails = (order) => {
    markOrderAction(order);
    const dbId = order.dbId || order.id || "";
    navigate(`/Admin/orders/${order.orderId}?user_id=${order.userId || ""}&id=${dbId}`, {
      state: { order, orderId: order.orderId, userId: order.userId, id: dbId, dbId },
    });
  };

  // Quick View Modal
  const handleOpenQuickView = (order, e) => {
    e.stopPropagation();
    setQuickViewOrder(order);
    setIsQuickViewOpen(true);
    markOrderAction(order);
  };

  const handleCloseQuickView = () => {
    setIsQuickViewOpen(false);
    setQuickViewOrder(null);
  };

  // Export to CSV
  const handleExport = () => {
    if (filteredOrders.length === 0) {
      Swal.fire("Notice", "No orders to export.", "info");
      return;
    }
    exportOrdersToCSV(filteredOrders);
  };

  // Helper for status badge styling
  const getStatusBadgeClass = (status = "") => {
    const s = String(status).toLowerCase();
    if (s.includes("process")) return "in-process";
    if (s.includes("purchase")) return "purchased";
    if (s.includes("way") || s.includes("transit")) return "on-the-way";
    if (s.includes("deliver") || s.includes("complete")) return "delivered";
    if (s.includes("cancel")) return "cancelled";
    return "pending";
  };

  // Helper to determine whether the Bill / Invoice upload/view action is applicable
  const canShowBillAction = (order, hasBills = false) => {
    if (hasBills) return true;
    const s = String(order?.status || "").toLowerCase();
    // Bill upload is applicable only once medicines have been purchased (Purchased, On The Way, Delivered)
    return (
      s.includes("purchase") ||
      s.includes("way") ||
      s.includes("transit") ||
      s.includes("deliver") ||
      s.includes("complete")
    );
  };

  return (
    <div className="page-wrapper">
      <div className="content orders-page-container">
        {/* Page Title & Breadcrumb */}
        <div className="orders-page-header">
          <div className="orders-title-wrap">
            <h3>Orders</h3>
            <p className="orders-subtitle">
              Manage patient medicine and healthcare pharmacy orders
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-success d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: "#10b981", borderColor: "#10b981", fontWeight: "600", borderRadius: "8px" }}
              onClick={() => navigate("/Admin/orders/create")}
            >
              <i className="fa fa-plus-circle" /> Create Order
            </button>
            <button
              type="button"
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: "#0ba6df", borderColor: "#0ba6df", borderRadius: "8px" }}
              onClick={loadOrders}
            >
              <i className={`fa fa-refresh ${loading ? "fa-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>


        {/* Stats Summary Cards matching screenshot */}
        <div className="orders-stats-grid">
          <div
            className={`order-stat-card all ${selectedStatusFilter === "ALL" ? "active" : ""}`}
            onClick={() => {
              setSelectedStatusFilter("ALL");
              setCurrentPage(1);
            }}
          >
            <div className="order-stat-icon-box">
              <i className="fa fa-shopping-cart" />
            </div>
            <div className="order-stat-info">
              <div className="stat-number">{stats.all}</div>
              <div className="stat-label">
                TOTAL<br />ORDERS
              </div>
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

        {/* Action Toolbar matching screenshot */}
        <div className="orders-toolbar-card">
          <div className="orders-toolbar-left">
            <button
              type="button"
              className="btn-orders-export"
              onClick={handleExport}
              title="Export orders to CSV"
            >
              Export
            </button>
          </div>

          <div className="orders-toolbar-right">
            <div className="orders-search-box">
              <i className="fa fa-search" />
              <input
                type="text"
                className="orders-search-input"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {/* Orders Table Container matching the screenshot exactly */}
        <div className="orders-table-wrapper">
          <div className="table-responsive">
            <table className="orders-table">
              <thead>
                <tr>
                  <th style={{ width: "50px", textAlign: "center" }}>S.No.</th>
                  <th style={{ minWidth: "115px" }}>Order ID</th>
                  <th style={{ minWidth: "160px" }}>Patient Name</th>
                  <th style={{ minWidth: "120px" }}>Payment Mode</th>
                  <th style={{ minWidth: "140px" }}>Order On</th>
                  <th style={{ minWidth: "115px" }}>Order Status</th>
                  <th className="text-center" style={{ width: "95px" }}>
                    Details
                  </th>
                  <th style={{ minWidth: "145px", whiteSpace: "nowrap" }}>Change Order Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                      Loading orders data...
                    </td>
                  </tr>
                ) : paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order, index) => {
                    const rowSNo = (currentPage - 1) * rowsPerPage + index + 1;
                    const badgeClass = getStatusBadgeClass(order.status);
                    const orderBills = order.bills || getOrderBills(order.orderId);
                    const hasBills = orderBills && orderBills.length > 0;
                    const showBillAction = canShowBillAction(order, hasBills);

                    return (
                      <tr
                        key={order.orderId || order.id || index}
                        className={order.isUnread ? "unread-row" : undefined}
                      >
                        <td>{rowSNo}</td>
                        <td className="order-id-cell">
                          <span
                            style={{ cursor: "pointer" }}
                            onClick={() => handleOpenDetails(order)}
                            title="Click to view order details"
                          >
                            {order.orderId}
                            <UnreadDot unread={order.isUnread === true} />
                          </span>
                        </td>
                        <td
                          className="order-patient-name"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleOpenDetails(order)}
                          title="Click to view order details"
                        >
                          <span
                            style={{
                              color: "#0284c7",
                              fontWeight: 600,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >
                            {order.patientName || "-"}
                          </span>
                          {order.written_medicines && order.written_medicines.length > 0 && (
                            <span
                              className="badge ms-2"
                              style={{
                                backgroundColor: "#fef3c7",
                                color: "#92400e",
                                fontSize: "10px",
                                border: "1px solid #fde68a",
                                fontWeight: 500,
                                verticalAlign: "middle",
                              }}
                              title={`Manual CRM Medicines: ${order.written_medicines.map((m) => m.name).join(", ")}`}
                            >
                              <i className="fa fa-pencil me-1" />
                              {order.written_medicines.length} manual
                            </span>
                          )}
                        </td>
                        <td className="order-payment-mode">{order.paymentMode || "Cash On Delivery"}</td>
                        <td className="order-date-cell">{order.orderDate || "-"}</td>

                        {/* Colorful Order Status Badge */}
                        <td>
                          <span className={`order-status-badge ${badgeClass}`}>
                            <span className="order-status-dot" />
                            {order.status}
                          </span>
                        </td>

                        {/* Details Eye Action & Upload/View Bill Action */}
                        <td className="text-center">
                          <div className="d-inline-flex align-items-center justify-content-center">
                            <button
                              type="button"
                              className="order-details-eye-btn"
                              title="View order details"
                              onClick={() => handleOpenDetails(order)}
                            >
                              <i className="fa fa-eye" />
                            </button>
                            {showBillAction ? (
                              <button
                                type="button"
                                className={`order-details-bill-btn ${hasBills ? "has-bill" : ""}`}
                                title={hasBills ? `Manage Bill / Invoice (${orderBills.length} uploaded)` : "Upload Bill / Invoice"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBillModal(order);
                                }}
                              >
                                <i className={hasBills ? "fa fa-file-text" : "fa fa-file-text-o"} />
                                {hasBills && (
                                  <span className="order-bill-count-badge">
                                    {orderBills.length}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span style={{ width: "21px", display: "inline-block", marginLeft: "6px" }} />
                            )}
                          </div>
                        </td>

                        {/* Change Order Status Select Dropdown */}
                        <td>
                          <div className="order-status-select-wrap">
                            <label htmlFor={`order-status-select-${order.orderId}`} className="visually-hidden">
                              Change status for order {order.orderId}
                            </label>
                            <select
                              id={`order-status-select-${order.orderId}`}
                              className={`order-status-select ${badgeClass}`}
                              value={order.status}
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
                    <td colSpan="8">
                      <div className="orders-empty-state">
                        <div className="orders-empty-icon">
                          <i className="fa fa-folder-open-o" />
                        </div>


                        <h6 className="fw-bold text-dark">No Orders Found</h6>
                        <p className="small text-muted mb-0">
                          {searchTerm
                            ? `No orders matching "${searchTerm}". Try a different keyword.`
                            : "No orders available in this filter category."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && filteredOrders.length > 0 && (
            <div className="orders-pagination-bar">
              <div className="orders-pagination-info">
                Showing{" "}
                <strong>
                  {Math.min(
                    (currentPage - 1) * rowsPerPage + 1,
                    filteredOrders.length
                  )}
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
                    onChange={handlePageChange}
                    color="primary"
                    shape="rounded"
                    size="medium"
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
                <h5 className="mb-0 fw-bold">
                  Order Details &bull; #{quickViewOrder.orderId}
                </h5>
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
                      <span className="order-info-val">{quickViewOrder.patientName}</span>
                    </div>
                    <div className="order-info-row">
                      <span className="order-info-label">Phone:</span>
                      <span className="order-info-val">{quickViewOrder.patientPhone || "-"}</span>
                    </div>
                    {quickViewOrder.delivery_type && (
                      <div className="order-info-row">
                        <span className="order-info-label">Delivery Type:</span>
                        <span className="order-info-val fw-bold">{quickViewOrder.delivery_type}</span>
                      </div>
                    )}
                    {quickViewOrder.room_number && (
                      <div className="order-info-row">
                        <span className="order-info-label">Room Number:</span>
                        <span className="order-info-val">
                          <span className="badge bg-primary-subtle text-primary border px-2 py-0.5" style={{ fontSize: "11px" }}>
                            Room {quickViewOrder.room_number}
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="order-info-row">
                      <span className="order-info-label">Address:</span>
                      <span className="order-info-val">{quickViewOrder.deliveryAddress}</span>
                    </div>
                  </div>

                  <div className="order-info-panel">
                    <h5>
                      <i className="fa fa-credit-card text-success" /> Order Summary
                    </h5>
                    <div className="order-info-row">
                      <span className="order-info-label">Status:</span>
                      <span className={`order-status-badge ${getStatusBadgeClass(quickViewOrder.status)}`}>
                        <span className="order-status-dot" />
                        {quickViewOrder.status}
                      </span>
                    </div>
                    <div className="order-info-row">
                      <span className="order-info-label">Payment Mode:</span>
                      <span className="order-info-val">{quickViewOrder.paymentMode}</span>
                    </div>
                    <div className="order-info-row">
                      <span className="order-info-label">Paid Amount:</span>
                      <span className="order-info-val text-primary fw-bold">
                        {quickViewOrder.paidAmount} MUR
                      </span>
                    </div>
                  </div>
                </div>

                {quickViewOrder.written_medicines && quickViewOrder.written_medicines.length > 0 && (
                  <div className="mb-3">
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-1" style={{ fontSize: "13px" }}>
                      <i className="fa fa-pencil text-warning me-1" />
                      Manual / Written Medicines (CRM)
                      <span className="badge rounded-pill ms-2" style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", fontSize: "10px" }}>
                        {quickViewOrder.written_medicines.length} item{quickViewOrder.written_medicines.length > 1 ? "s" : ""}
                      </span>
                    </h6>
                    <div className="table-responsive border rounded bg-white">
                      <table className="table table-sm mb-0" style={{ fontSize: "12px" }}>
                        <thead style={{ backgroundColor: "#f8fafc" }}>
                          <tr>
                            <th style={{ width: "35px" }}>#</th>
                            <th>Medicine Name</th>
                            <th>Qty</th>
                            <th>Duration (Days)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quickViewOrder.written_medicines.map((m, idx) => (
                            <tr key={m.id || idx}>
                              <td className="text-muted text-center">{idx + 1}</td>
                              <td className="fw-semibold text-dark">{m.name}</td>
                              <td>{m.quantity || "—"}</td>
                              <td>{m.days ? `${m.days} Days` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {quickViewOrder.items && quickViewOrder.items.length > 0 && (
                  <div className="table-responsive border rounded">
                    <table className="table table-sm mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th className="text-center">Qty</th>
                          <th className="text-end">Unit Price (MUR)</th>
                          <th className="text-end">Total (MUR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickViewOrder.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="fw-semibold">{it.name}</td>
                            <td>{it.category}</td>
                            <td className="text-center">{it.quantity}</td>
                            <td className="text-end">{it.unitPrice}</td>
                            <td className="text-end fw-bold">{it.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DialogContent>

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  backgroundColor: "#f8fafc",
                  flexShrink: 0,
                }}
              >
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
                  Full View Page
                </button>
              </div>
            </div>
          )}
        </Dialog>

        {/* Bill / Invoice Upload & Management Modal */}
        <Dialog
          open={isBillModalOpen}
          onClose={handleCloseBillModal}
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
          {billModalOrder && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                maxHeight: "90vh",
                overflow: "hidden",
              }}
            >
              <div className="bill-modal-header" style={{ flexShrink: 0, backgroundColor: "#ffffff" }}>
                <h5>
                  <i className="fa fa-file-text text-teal" style={{ color: "#0d9488" }} />
                  <span>
                    Manage Bill / Invoice &bull; Order #{billModalOrder.orderId}
                  </span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseBillModal}
                  aria-label="Close"
                />
              </div>

              <div className="bill-modal-body" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
                {billPendingStatus && (
                  <div
                    className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center gap-2"
                    style={{ fontSize: "13px", backgroundColor: "#f0fdfa", borderColor: "#99f6e4", color: "#0f766e" }}
                  >
                    <i className="fa fa-info-circle fs-6" />
                    <div>
                      Changing status to <strong>"{billPendingStatus}"</strong>. You can upload the bill copy and notes below, or save without a file.
                    </div>
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="bill-form-label m-0">
                        <i className="fa fa-upload me-1 text-teal" style={{ color: "#0d9488" }} />
                        Upload Bills / Invoices <span className="text-muted fw-normal">(Multiple allowed)</span>
                      </label>
                      {billFiles.length > 0 && (
                        <label className="btn btn-sm btn-outline-secondary py-0 px-2" style={{ fontSize: "11px", cursor: "pointer" }}>
                          <i className="fa fa-plus me-1" /> Add More Bills
                          <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            style={{ display: "none" }}
                            onChange={handleBillFilesChange}
                          />
                        </label>
                      )}
                    </div>

                    {billFiles.length === 0 ? (
                      <label className="bill-drop-zone d-block mb-2">
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          style={{ display: "none" }}
                          onChange={handleBillFilesChange}
                        />
                        <div className="bill-drop-icon">
                          <i className="fa fa-cloud-upload" />
                        </div>
                        <div className="bill-drop-title">Click to browse or drag & drop bills</div>
                        <div className="bill-drop-sub">Select one or multiple JPG, PNG, WEBP, or PDF invoices</div>
                      </label>
                    ) : (
                      <div className="bill-files-container">
                        {billFiles.map((bf) => (
                          <div key={bf.id} className="bill-preview-selected">
                            {bf.preview ? (
                              <img
                                src={bf.preview}
                                alt={bf.name}
                                className="bill-preview-thumb"
                                onClick={() => {
                                  setPreviewBillImg(bf.preview);
                                  setPreviewBillTitle(bf.name || "Bill Preview");
                                }}
                                title="Click to view full image"
                              />
                            ) : (
                              <div className="bill-preview-doc-icon">
                                <i className="fa fa-file-pdf-o" />
                              </div>
                            )}
                            <div className="bill-preview-info">
                              <div className="bill-preview-name" title={bf.name}>{bf.name}</div>
                              <div className="bill-preview-size">
                                {bf.size ? `${(bf.size / 1024).toFixed(1)} KB` : "File attached"}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="bill-preview-remove-btn"
                              title="Remove attached file"
                              onClick={() => handleRemoveBillFile(bf.id)}
                            >
                              <i className="fa fa-times" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="bill-form-group mb-3">
                      <label className="bill-form-label">
                        <i className="fa fa-inr me-1 text-success" />
                        Bill / Invoice Price <span className="text-muted fw-normal">(Amount paid)</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="bill-form-input form-control"
                          placeholder="Enter bill / invoice price"
                          value={billPrice}
                          onChange={(e) => setBillPrice(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="bill-form-group mb-0">
                      <label className="bill-form-label">
                        <i className="fa fa-sticky-note-o me-1 text-warning" />
                        Purchase & Bill Note <span className="text-muted fw-normal">(One note for order)</span>
                      </label>
                      <textarea
                        className="bill-form-textarea"
                        rows="5"
                        placeholder="Add purchase notes e.g., Paid by John / staff, only 3 medicines got out of four, purchased from Apollo pharmacy..."
                        value={billNotes}
                        onChange={(e) => setBillNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Uploaded Bills History for this order (API data only — no local defaults) */}
                {(() => {
                  const existingBills = Array.isArray(billModalOrder.bills)
                    ? billModalOrder.bills
                    : [];
                  const orderNote = billModalOrder.billNotes || "";
                  const orderPrice =
                    billModalOrder.billPrice !== undefined &&
                    billModalOrder.billPrice !== null &&
                    billModalOrder.billPrice !== ""
                      ? billModalOrder.billPrice
                      : "";
                  if (
                    existingBills.length === 0 &&
                    !orderNote &&
                    (orderPrice === "" || orderPrice === null || orderPrice === undefined)
                  ) {
                    return null;
                  }

                  const isImageBill = (bill = {}) => {
                    const mime = String(bill.fileType || bill.mime_type || "").toLowerCase();
                    if (mime.startsWith("image/")) return true;
                    const value = String(bill.fileUrl || "");
                    return (
                      value.startsWith("data:image") ||
                      /\.(jpe?g|png|gif|webp|jfif|bmp)(\?|$)/i.test(value)
                    );
                  };

                  return (
                    <div className="existing-bills-list">
                      <div className="existing-bills-title">
                        <span>
                          <i className="fa fa-history me-1 text-teal" style={{ color: "#0d9488" }} />
                          Uploaded Bills & Invoices ({existingBills.length})
                        </span>
                        {(orderPrice !== "" && orderPrice !== null && orderPrice !== undefined) && (
                          <span className="existing-bill-price-badge">
                            <i className="fa fa-inr me-1" />
                            Price: ₹{Number(orderPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      {/* Single Consolidated Purchase Note Banner */}
                      {orderNote && (
                        <div className="order-purchase-note-banner mb-3">
                          <div className="d-flex align-items-start gap-2">
                            <i className="fa fa-sticky-note text-warning mt-1" />
                            <div>
                              <strong className="text-dark">Order Purchase Note:</strong>
                              <div className="text-secondary mt-1" style={{ whiteSpace: "pre-wrap" }}>{orderNote}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="existing-bills-grid">
                        {existingBills.map((bill) => (
                          <div key={bill.id || bill.fileUrl || bill.fileName} className="existing-bill-item">
                            {bill.fileUrl && isImageBill(bill) ? (
                              <img
                                src={bill.fileUrl}
                                alt={bill.fileName}
                                className="existing-bill-thumb"
                                onClick={() => {
                                  setPreviewBillImg(bill.fileUrl);
                                  setPreviewBillTitle(bill.fileName);
                                }}
                                title="Click to view full image"
                              />
                            ) : (
                              <div
                                className="existing-bill-doc-icon"
                                onClick={() => {
                                  if (bill.fileUrl) {
                                    window.open(bill.fileUrl, "_blank");
                                  }
                                }}
                                title="Click to view document"
                              >
                                <i className="fa fa-file-text-o" />
                              </div>
                            )}

                            <div className="existing-bill-content">
                              <div className="existing-bill-name">
                                <span>{bill.fileName}</span>
                              </div>
                              <div className="existing-bill-date">
                                <i className="fa fa-clock-o me-1" /> Uploaded on: {bill.uploadedAt || "Just now"}
                              </div>
                            </div>

                            <div className="existing-bill-actions">
                              {bill.fileUrl && (
                                <a
                                  href={bill.fileUrl}
                                  download={bill.fileName || "Invoice.jpg"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-secondary"
                                  title="Download bill file"
                                >
                                  <i className="fa fa-download" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#f8fafc",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-light border btn-sm"
                  onClick={handleCloseBillModal}
                >
                  Close
                </button>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-teal btn-sm text-white d-inline-flex align-items-center gap-1"
                    style={{ backgroundColor: "#0d9488", borderColor: "#0d9488" }}
                    disabled={isSavingBill}
                    onClick={() => handleSaveBill(false)}
                  >
                    <i className="fa fa-check" />
                    {isSavingBill
                      ? "Saving..."
                      : billModalOrder.hasBillRecord ||
                        billModalOrder.documentId ||
                        (Array.isArray(billModalOrder.bills) && billModalOrder.bills.length > 0)
                        ? "Update Bill"
                        : "Save Bill Only"}
                  </button>

                  {billPendingStatus && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm d-inline-flex align-items-center gap-1"
                      disabled={isSavingBill}
                      onClick={() => handleSaveBill(true)}
                    >
                      <i className="fa fa-check-circle" />
                      {isSavingBill ? "Updating..." : `Save Bill & Mark ${billPendingStatus}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Dialog>

        {/* Bill Image Preview Modal */}
        {previewBillImg && (
          <div className="order-image-modal-backdrop" onClick={() => setPreviewBillImg(null)}>
            <div className="order-image-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="order-image-modal-header">
                <h6 className="fw-bold m-0 text-dark">{previewBillTitle || "Bill / Invoice Preview"}</h6>
                <div className="d-flex align-items-center gap-2">
                  <a
                    href={previewBillImg}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    <i className="fa fa-external-link me-1" /> Open Original
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setPreviewBillImg(null)}
                  >
                    <i className="fa fa-times" />
                  </button>
                </div>
              </div>
              <div className="order-image-modal-body">
                <img src={previewBillImg} alt="Bill Preview" className="order-image-modal-img" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
