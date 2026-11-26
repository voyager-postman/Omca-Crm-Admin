import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
  fetchOrderById,
  updateOrderStatus,
  ORDER_STATUS_CODE_TO_LABEL,
  ORDER_STATUS_LABEL_TO_CODE,
  getOrderBills,
  getOrderBillNote,
  getOrderBillPrice,
  fetchOrderDocuments,
  saveOrderDocuments,
} from "../../services/ordersApi";
import { markRecordRead } from "../../services/unreadApi";
import Dialog from "@mui/material/Dialog";
import "./Orders.css";

const FALLBACK_DOCUMENT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 24 24' fill='%23f1f5f9' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Cpath d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'/%3E%3C/svg%3E";

const FALLBACK_MEDICINE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%23f1f5f9' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";

export default function OrderDetail() {
  const { orderId: paramOrderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const passedKey = searchParams.get("key");
  const passedId =
    passedKey ||
    searchParams.get("id") ||
    location.state?.id ||
    location.state?.dbId ||
    location.state?.order?.dbId ||
    location.state?.order?.id ||
    "";

  const activeOrderId =
    paramOrderId ||
    passedKey ||
    searchParams.get("order_id") ||
    searchParams.get("orderId") ||
    location.state?.orderId ||
    location.state?.order?.orderId;

  const passedUserId =
    searchParams.get("user_id") ||
    location.state?.userId ||
    location.state?.order?.userId ||
    location.state?.order?.user_id ||
    "";

  const [order, setOrder] = useState(location.state?.order || null);

  useEffect(() => {
    if (activeOrderId) markRecordRead("orders", activeOrderId);
  }, [activeOrderId]);
  const [loading, setLoading] = useState(!location.state?.order);
  const [previewModalImg, setPreviewModalImg] = useState(null);
  const [previewModalTitle, setPreviewModalTitle] = useState("");

  // Bill Upload modal states
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billPendingStatus, setBillPendingStatus] = useState("");
  const [billFiles, setBillFiles] = useState([]);
  const [billNotes, setBillNotes] = useState("");
  const [billPrice, setBillPrice] = useState("");
  const [isSavingBill, setIsSavingBill] = useState(false);

  const getMedicineImage = (item) => {
    if (item?.image && typeof item.image === "string" && item.image.trim()) {
      return item.image;
    }
    if (item?.front_image) return item.front_image;
    if (item?.back_image) return item.back_image;

    const n = String(item?.name || item?.product_name || "").toLowerCase();
    if (n.includes("dolo") || n.includes("crocin")) {
      return "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg";
    }
    if (n.includes("paracetamol") || n.includes("paracetamal")) {
      return "https://omcacrm.com/omca/public/images/medicineImages/download (2).jpeg";
    }
    if (n.includes("becosules") || n.includes("vitamin") || n.includes("multivitamin")) {
      return "https://omcacrm.com/omca/public/images/medicineImages/01717501972.jpg";
    }
    if (n.includes("corex") || n.includes("cough") || n.includes("syrup") || n.includes("inhaler")) {
      return "https://omcacrm.com/omca/public/images/medicineImages/01717503565.jpg";
    }
    if (
      n.includes("aspirin") ||
      n.includes("atorvastatin") ||
      n.includes("amoxicillin") ||
      n.includes("metformin") ||
      n.includes("omeprazole")
    ) {
      return "https://omcacrm.com/omca/public/images/medicineImages/01779704221.jpg";
    }
    return "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg";
  };

  useEffect(() => {
    const loadOrder = async () => {
      if (!activeOrderId && !passedId) {
        navigate("/Admin/orders");
        return;
      }

      setLoading(true);
      try {
        const found = await fetchOrderById(activeOrderId, passedUserId, passedId);
        if (found) {
          setOrder(found);
          // Fetch live documents & notes: GET https://omcacrm.com/omca/api/crm/orders/{order_id}/documents
          const targetOrderId = found.orderId || found.id || found.order || activeOrderId;
          if (targetOrderId) {
            fetchOrderDocuments(targetOrderId).then((docRes) => {
              if (!docRes || !docRes.fromLiveApi) return;
              const apiPrice =
                docRes.price !== "" && docRes.price !== null && docRes.price !== undefined
                  ? docRes.price
                  : "";
              setOrder((prev) => ({
                ...prev,
                bills: Array.isArray(docRes.documents) ? docRes.documents : [],
                billNotes: docRes.notes || "",
                billPrice: apiPrice !== "" && apiPrice != null ? apiPrice : "",
                paidAmount:
                  apiPrice !== "" && apiPrice != null
                    ? Number(apiPrice) || prev?.paidAmount
                    : prev?.paidAmount,
                documentId: docRes.documentId || null,
                hasBillRecord: Boolean(docRes.hasExisting),
              }));
            });
          }
        } else {
          Swal.fire("Not Found", "The requested order could not be found.", "error");
          navigate("/Admin/orders");
        }
      } catch (err) {
        console.error("Error loading order:", err);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [activeOrderId, passedUserId, passedId, navigate]);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    if (!order || newStatus === order.status) return;

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
        if (e && e.target) e.target.value = order.status;
        return;
      }
      cancelReason = cancelResult.value.trim();
    } else if (targetStatusCode === 6) {
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
        handleOpenBillModal("Purchased");
        return;
      }
    } else if (targetStatusCode === 5) {
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
        handleOpenBillModal("Delivered");
        return;
      }
    } else {
      const result = await Swal.fire({
        title: "Update Order Status?",
        text: `Change order status from "${order.status}" to "${targetStatusLabel}"?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#0ba6df",
        cancelButtonColor: "#94a3b8",
        confirmButtonText: "Yes, Update",
        cancelButtonText: "Cancel",
      });

      if (!result.isConfirmed) {
        if (e && e.target) e.target.value = order.status;
        return;
      }
    }

    try {
      const res = await updateOrderStatus(order, targetStatusCode, cancelReason);
      setOrder((prev) => ({
        ...prev,
        status: targetStatusLabel,
        statusCode: targetStatusCode,
        type: targetStatusCode,
        cancelReason: cancelReason || prev.cancelReason,
      }));
      Swal.fire({
        title: targetStatusCode === 2 ? "Order Cancelled!" : "Status Updated!",
        text: res?.apiMessage || `Order status changed to "${targetStatusLabel}".`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Order status update error:", err);
      if (e && e.target) e.target.value = order.status;
      Swal.fire({
        title: "Update Failed",
        text: err?.message || "Failed to update order status.",
        icon: "error",
      });
    }
  };

  // Bill Management Handlers
  const handleOpenBillModal = (pendingStatus = "") => {
    // Start empty — fill only from live GET API (no stale local defaults)
    setBillPendingStatus(pendingStatus);
    setBillFiles([]);
    setBillNotes("");
    setBillPrice("");
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            bills: [],
            billNotes: "",
            billPrice: "",
            documentId: null,
            hasBillRecord: false,
          }
        : prev
    );
    setIsBillModalOpen(true);

    // GET /api/crm/orders/{order_id}/documents
    const targetOrderId = order?.orderId || order?.id || order?.order;
    if (targetOrderId) {
      fetchOrderDocuments(targetOrderId).then((docRes) => {
        if (!docRes) return;

        if (docRes.fromLiveApi) {
          const apiNotes = docRes.notes || "";
          const apiPrice =
            docRes.price !== "" && docRes.price !== null && docRes.price !== undefined
              ? docRes.price
              : "";
          const apiDocs = Array.isArray(docRes.documents) ? docRes.documents : [];

          setBillNotes(apiNotes);
          setBillPrice(
            apiPrice !== "" && apiPrice !== null && apiPrice !== undefined
              ? String(apiPrice)
              : ""
          );
          setOrder((prev) => ({
            ...prev,
            bills: apiDocs,
            billNotes: apiNotes,
            billPrice: apiPrice !== "" && apiPrice != null ? apiPrice : "",
            paidAmount:
              apiPrice !== "" && apiPrice != null
                ? Number(apiPrice) || prev?.paidAmount
                : prev?.paidAmount,
            documentId: docRes.documentId || null,
            hasBillRecord: Boolean(docRes.hasExisting),
          }));
          return;
        }

        const apiNotes = docRes.notes || "";
        const apiPrice = docRes.price;
        if (apiNotes) setBillNotes(apiNotes);
        if (apiPrice !== "" && apiPrice !== null && apiPrice !== undefined) {
          setBillPrice(String(apiPrice));
        }
        if (docRes.documents?.length > 0 || apiNotes || (apiPrice !== "" && apiPrice != null)) {
          setOrder((prev) => ({
            ...prev,
            bills: docRes.documents || [],
            billNotes: apiNotes,
            billPrice: apiPrice !== "" && apiPrice != null ? apiPrice : "",
            paidAmount:
              apiPrice !== "" && apiPrice != null
                ? Number(apiPrice) || prev?.paidAmount
                : prev?.paidAmount,
            documentId: docRes.documentId || null,
            hasBillRecord: Boolean(docRes.hasExisting),
          }));
        }
      });
    }
  };

  const handleCloseBillModal = () => {
    setIsBillModalOpen(false);
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
    if (!order) return;
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
      const targetOrderId = order.orderId || order.id || order.order;

      // ADD:  POST /api/crm/orders/{order_id}/documents
      // UPDATE: POST /api/crm/orders/{order_id}/documents/update
      // Parameters: invoices[], notes, price
      const hasExisting =
        Boolean(order.hasBillRecord) ||
        Boolean(order.documentId) ||
        (Array.isArray(order.bills) && order.bills.length > 0);

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
          : getOrderBills(order.orderId);
      const savedPrice =
        uploadRes?.price !== "" && uploadRes?.price !== null && uploadRes?.price !== undefined
          ? uploadRes.price
          : getOrderBillPrice(order.orderId);
      const savedNotes = uploadRes?.notes || cleanNote;
      const targetStatusToApply = alsoUpdateStatus ? (billPendingStatus || "Purchased") : "";

      if (targetStatusToApply) {
        const targetStatusCode = ORDER_STATUS_LABEL_TO_CODE[targetStatusToApply] || 6;
        await updateOrderStatus(order, targetStatusCode, "");
        setOrder((prev) => ({
          ...prev,
          status: targetStatusToApply,
          statusCode: targetStatusCode,
          type: targetStatusCode,
          bills: updatedBills,
          billNotes: savedNotes,
          billPrice: savedPrice,
          documentId: uploadRes.documentId || prev?.documentId,
          hasBillRecord: true,
          paidAmount:
            savedPrice !== "" && savedPrice !== null && savedPrice !== undefined
              ? Number(savedPrice)
              : prev?.paidAmount,
        }));
      } else {
        setOrder((prev) => ({
          ...prev,
          bills: updatedBills,
          billNotes: savedNotes,
          billPrice: savedPrice,
          documentId: uploadRes.documentId || prev?.documentId,
          hasBillRecord: true,
          paidAmount:
            savedPrice !== "" && savedPrice !== null && savedPrice !== undefined
              ? Number(savedPrice)
              : prev?.paidAmount,
        }));
      }

      Swal.fire({
        title: "Bill Saved!",
        text: targetStatusToApply
          ? `Bill(s) saved and order status updated to "${targetStatusToApply}".`
          : `Bill copy and note successfully saved.`,
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

  const getStatusBadgeClass = (status = "") => {
    const s = String(status).toLowerCase();
    if (s.includes("process")) return "in-process";
    if (s.includes("purchase")) return "purchased";
    if (s.includes("way") || s.includes("transit")) return "on-the-way";
    if (s.includes("deliver") || s.includes("complete")) return "delivered";
    if (s.includes("cancel")) return "cancelled";
    return "pending";
  };

  // const handlePrint = () => {
  //   window.print();
  // };

  const prescriptionImages = useMemo(() => {
    if (!order) return [];
    const images = [];

    if (Array.isArray(order.prescriptions) && order.prescriptions.length > 0) {
      order.prescriptions.forEach((p, idx) => {
        const typeNum = p.type !== undefined ? Number(p.type) : 0;
        const front = p.frontImage || p.front_image;
        const back = p.backImage || p.back_image;
        if (front) {
          images.push({
            id: `p-front-${p.id || idx}`,
            title: p.name ? `${p.name} (Front)` : `Prescription #${idx + 1} (Front)`,
            imageUrl: front,
            side: "Front",
            type: typeNum,
            quantity: p.quantity,
          });
        }
        if (back) {
          images.push({
            id: `p-back-${p.id || idx}`,
            title: p.name ? `${p.name} (Back)` : `Prescription #${idx + 1} (Back)`,
            imageUrl: back,
            side: "Back",
            type: typeNum,
            quantity: p.quantity,
          });
        }
      });
    }

    if (Array.isArray(order.items)) {
      order.items.forEach((it, idx) => {
        if (it.front_image && !images.some((d) => d.imageUrl === it.front_image)) {
          images.push({
            id: `it-front-${it.id || idx}`,
            title: `${it.name} (Front)`,
            imageUrl: it.front_image,
            side: "Front",
            type: it.type !== undefined ? Number(it.type) : (it.category === "Medicine Photo" ? 1 : 0),
            quantity: it.dosage || it.quantity,
          });
        }
        if (it.back_image && !images.some((d) => d.imageUrl === it.back_image)) {
          images.push({
            id: `it-back-${it.id || idx}`,
            title: `${it.name} (Back)`,
            imageUrl: it.back_image,
            side: "Back",
            type: it.type !== undefined ? Number(it.type) : (it.category === "Medicine Photo" ? 1 : 0),
            quantity: it.dosage || it.quantity,
          });
        }
      });
    }

    // Fallback for demo/offline orders only
    if (images.length === 0 && !order.isLiveApi) {
      images.push(
        {
          id: "demo-pres-1",
          title: "Prescription Copy (Front)",
          imageUrl: "https://omcacrm.com/omca/public/images/prescription/1788841526_6a9f8e3611987_front.jpg",
          side: "Front",
          type: 0,
          quantity: "5 Days",
        },
        {
          id: "demo-pres-2",
          title: "Medicine Strip Photo (Front)",
          imageUrl: "https://omcacrm.com/omca/public/images/prescription/1788863072_6a9fe2605241d_front.jfif",
          side: "Front",
          type: 1,
          quantity: "10 Days",
        },
        {
          id: "demo-pres-3",
          title: "Medicine Strip Photo (Back)",
          imageUrl: "https://omcacrm.com/omca/public/images/prescription/1788863072_6a9fe26052577_back.png",
          side: "Back",
          type: 1,
          quantity: "10 Days",
        }
      );
    }

    return images;
  }, [order]);

  // Extract Manual / Written Medicines (CRM Medicine Order API)
  const writtenMedicines = useMemo(() => {
    if (!order) return [];
    if (Array.isArray(order.written_medicines) && order.written_medicines.length > 0) {
      return order.written_medicines;
    }
    if (Array.isArray(order.place_order_written_medicines) && order.place_order_written_medicines.length > 0) {
      return order.place_order_written_medicines;
    }
    if (Array.isArray(order?.raw?.written_medicines) && order.raw.written_medicines.length > 0) {
      return order.raw.written_medicines;
    }
    if (Array.isArray(order?.raw?.place_order_written_medicines) && order.raw.place_order_written_medicines.length > 0) {
      return order.raw.place_order_written_medicines;
    }
    if (Array.isArray(order?.raw?.placeOrderWrittenMedicines) && order.raw.placeOrderWrittenMedicines.length > 0) {
      return order.raw.placeOrderWrittenMedicines;
    }
    if (Array.isArray(order?.items)) {
      const fromItems = order.items.filter((it) => it.isWritten || it.category === "Written Medicine");
      if (fromItems.length > 0) {
        return fromItems.map((it, idx) => ({
          id: it.id || idx + 1,
          name: it.name,
          quantity: it.quantity,
          days: it.days || it.dosage?.replace(/[^0-9]/g, "") || "",
        }));
      }
    }
    return [];
  }, [order]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading Order Details...</span>
            </div>
            <p className="mt-3 text-muted">Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const badgeClass = getStatusBadgeClass(order.status);
  const isCancelled = badgeClass === "cancelled";

  return (
    <div className="page-wrapper">
      <div className="content orders-page-container">
        {/* Top Header */}
        <div className="orders-page-header">
          <div className="orders-title-wrap">
            <Link to="/Admin/orders" className="btn-order-back mb-2">
              <i className="fa fa-arrow-left" /> Back to Orders
            </Link>
            <h3>Order Details: #{order.orderId}</h3>
            <p className="orders-subtitle">
              Placed on {order.orderDate} &bull; Payment via {order.paymentMode}
            </p>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Print invoice button commented out - invoice is already sent via Email and WhatsApp */}
            {/*
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              onClick={handlePrint}
            >
              <i className="fa fa-print" /> Print Invoice
            </button>
            */}
            <div
              className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill"
              style={{
                backgroundColor: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontSize: "12px",
                fontWeight: "600",
              }}
              title="Invoice has already been sent to the patient via Email and WhatsApp"
            >
              <i className="fa fa-envelope" style={{ color: "#0284c7" }} />
              <i className="fa fa-whatsapp" style={{ color: "#16a34a", fontSize: "14px" }} />
              <span>Invoice already sent by Email and WhatsApp</span>
            </div>

            <div className="d-inline-flex align-items-center gap-2">
              <label htmlFor="order-detail-status-select" className="small text-muted fw-bold mb-0">
                Change Status:
              </label>
              <select
                id="order-detail-status-select"
                aria-label="Change Status"
                className={`order-status-select ${badgeClass}`}
                value={order.status}
                onChange={handleStatusChange}
                style={{ width: "160px" }}
              >
                <option value="Pending">Pending</option>
                <option value="In Process">In Process</option>
                <option value="Purchased">Purchased</option>
                <option value="On The Way">On The Way</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Order Card Container */}
        <div className="order-view-card">
          {/* Header row */}
          <div className="order-view-header">
            <div className="order-view-header-left">
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  backgroundColor: "#e0f2fe",
                  color: "#0284c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                <i className="fa fa-shopping-cart" />
              </div>
              <div>
                <h4 className="order-view-title">Order ID: #{order.orderId}</h4>
                <div className="order-view-meta">
                  <span>
                    <i className="fa fa-calendar-o me-1" /> {order.orderDate}
                  </span>
                  <span>
                    <i className="fa fa-credit-card me-1" /> {order.paymentMode}
                  </span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <div className="text-end">
                <span className="small text-muted d-block">Paid Amount</span>
                <span className="fs-5 fw-bold text-dark">
                  {(() => {
                    const amountRaw =
                      order.billPrice !== "" && order.billPrice !== null && order.billPrice !== undefined
                        ? order.billPrice
                        : order.paidAmount;
                    const amount = Number(amountRaw);
                    const formatted = Number.isFinite(amount)
                      ? amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : amountRaw || "0";
                    const sym = order.currencySymbol || (order.currency === "INR" ? "₹" : "Rs");
                    return `${sym} ${formatted}`;
                  })()}
                </span>
              </div>
              <span className={`order-status-badge ${badgeClass} fs-6 px-3 py-2`}>
                <span className="order-status-dot" />
                {order.status}
              </span>
            </div>
          </div>

          {/* Stepper Status Progression */}
          {!isCancelled ? (
            <div className="order-stepper">
              <div
                className={`order-step-item ${
                  ["Pending", "In Process", "Purchased", "On The Way", "Delivered"].includes(
                    order.status
                  )
                    ? "completed"
                    : ""
                }`}
              >
                <div className="order-step-circle">
                  <i className="fa fa-check" />
                </div>
                <div className="order-step-label">Order Placed</div>
                <div className="order-step-time">{order.orderDate}</div>
              </div>

              <div
                className={`order-step-item ${
                  ["In Process", "Purchased", "On The Way", "Delivered"].includes(order.status)
                    ? "completed"
                    : order.status === "Pending"
                    ? "active"
                    : ""
                }`}
              >
                <div className="order-step-circle">
                  {["In Process", "Purchased", "On The Way", "Delivered"].includes(order.status) ? (
                    <i className="fa fa-check" />
                  ) : (
                    "2"
                  )}
                </div>
                <div className="order-step-label">In Process</div>
                <div className="order-step-time">Pharmacy Verification</div>
              </div>

              <div
                className={`order-step-item ${
                  ["Purchased", "On The Way", "Delivered"].includes(order.status)
                    ? "completed"
                    : order.status === "In Process"
                    ? "active"
                    : ""
                }`}
              >
                <div className="order-step-circle">
                  {["Purchased", "On The Way", "Delivered"].includes(order.status) ? (
                    <i className="fa fa-check" />
                  ) : (
                    "3"
                  )}
                </div>
                <div className="order-step-label">Purchased</div>
                <div className="order-step-time">Medicines Purchased</div>
              </div>

              <div
                className={`order-step-item ${
                  ["On The Way", "Delivered"].includes(order.status)
                    ? "completed"
                    : order.status === "Purchased"
                    ? "active"
                    : ""
                }`}
              >
                <div className="order-step-circle">
                  {["On The Way", "Delivered"].includes(order.status) ? (
                    <i className="fa fa-check" />
                  ) : (
                    "4"
                  )}
                </div>
                <div className="order-step-label">On The Way</div>
                <div className="order-step-time">Dispatched</div>
              </div>

              <div
                className={`order-step-item ${
                  order.status === "Delivered" ? "completed" : order.status === "On The Way" ? "active" : ""
                }`}
              >
                <div className="order-step-circle">
                  {order.status === "Delivered" ? <i className="fa fa-check" /> : "5"}
                </div>
                <div className="order-step-label">Delivered</div>
                <div className="order-step-time">Customer Received</div>
              </div>
            </div>
          ) : (
            <div className="alert alert-danger d-flex align-items-center gap-2 mb-4">
              <i className="fa fa-times-circle fs-5" />
              <div>
                <strong>Order Cancelled.</strong> {order.cancelReason ? `Reason: ${order.cancelReason}` : "This order has been cancelled and will not be processed further."}
                {order.cancelAt && <div className="small text-danger mt-1">Cancelled on: {order.cancelAt}</div>}
              </div>
            </div>
          )}

          {/* Customer & Shipping Information Grid */}
          <div className="order-info-grid">
            {/* Patient Panel */}
            <div className="order-info-panel">
              <h5>
                <i className="fa fa-user-circle text-primary" /> Patient Information
              </h5>
              <div className="order-info-row">
                <span className="order-info-label">Full Name:</span>
                <span className="order-info-val">{order.patientName || "—"}</span>
              </div>
              <div className="order-info-row">
                <span className="order-info-label">Patient / User ID:</span>
                <span className="order-info-val">{order.userId || "—"}</span>
              </div>
              <div className="order-info-row">
                <span className="order-info-label">Phone Number:</span>
                <span className="order-info-val">{order.patientPhone || "—"}</span>
              </div>
              <div className="order-info-row">
                <span className="order-info-label">Email Address:</span>
                <span className="order-info-val">{order.patientEmail || "—"}</span>
              </div>
            </div>

            {/* Delivery Panel */}
            <div className="order-info-panel">
              <h5>
                <i className="fa fa-map-marker text-danger" /> Delivery Details
              </h5>
              {order.delivery_type && (
                <div className="order-info-row">
                  <span className="order-info-label">Delivery Type:</span>
                  <span className="order-info-val fw-bold text-dark">{order.delivery_type}</span>
                </div>
              )}
              {order.room_number && (
                <div className="order-info-row">
                  <span className="order-info-label">Room Number:</span>
                  <span className="order-info-val">
                    <span className="badge bg-primary-subtle text-primary border px-2 py-1" style={{ fontSize: "12px", fontWeight: 600 }}>
                      <i className="fa fa-bed me-1" />
                      Room {order.room_number}
                    </span>
                  </span>
                </div>
              )}
              <div className="order-info-row">
                <span className="order-info-label">Destination:</span>
                <span className="order-info-val">{order.delivery_address || order.deliveryAddress || "Mauritius"}</span>
              </div>
              {(order.city || order.state || order.country) && (
                <div className="order-info-row">
                  <span className="order-info-label">Location:</span>
                  <span className="order-info-val">
                    {[order.city, order.state, order.country].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              <div className="order-info-row">
                <span className="order-info-label">Delivery Mode:</span>
                <span className="order-info-val">Express Home Delivery</span>
              </div>
              <div className="order-info-row">
                <span className="order-info-label">Special Notes:</span>
                <span className="order-info-val">{order.notes || "None"}</span>
              </div>
            </div>

            {/* Payment Panel */}
            <div className="order-info-panel">
              <h5>
                <i className="fa fa-credit-card text-success" /> Payment Overview
              </h5>
              <div className="order-info-row">
                <span className="order-info-label">Payment Method:</span>
                <span className="order-info-val">{order.paymentMode || "Cash On Delivery"}</span>
              </div>
              <div className="order-info-row">
                <span className="order-info-label">Payment Status:</span>
                <span className="order-info-val">
                  {order.paymentStatus ||
                    (order.status === "Delivered"
                      ? "Paid & Completed"
                      : order.paymentMode === "Online Payment"
                      ? "Prepaid Online"
                      : "Collect Upon Delivery")}
                </span>
              </div>
              {order.transactionId && (
                <div className="order-info-row">
                  <span className="order-info-label">Transaction ID:</span>
                  <span className="order-info-val font-monospace text-primary fw-semibold">
                    {order.transactionId}
                  </span>
                </div>
              )}
              {order.paymentDate && (
                <div className="order-info-row">
                  <span className="order-info-label">Payment Date:</span>
                  <span className="order-info-val">{order.paymentDate}</span>
                </div>
              )}
              <div className="order-info-row">
                <span className="order-info-label">Total Amount:</span>
                <span className="order-info-val text-primary fw-bold">
                  {Boolean(order.paidAmount && Number(order.paidAmount) > 0)
                    ? typeof order.paidAmount === "number"
                      ? `${order.currencySymbol || (order.currency === "INR" ? "₹" : "Rs")} ${order.paidAmount.toFixed(2)}`
                      : `${order.currencySymbol || (order.currency === "INR" ? "₹" : "Rs")} ${order.paidAmount}`
                    : "As per purchase bill"}
                </span>
              </div>
            </div>
          </div>

          {/* Prescriptions & Uploaded Documents Section */}
          <div className="order-prescriptions-card mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-dark m-0">
                <i className="fa fa-file-image-o text-primary me-2" /> Prescriptions & Uploaded Images (Prescription & Medicine Copies)
              </h5>
              <span className="badge bg-light text-dark border">
                {prescriptionImages.length} Uploaded Image(s)
              </span>
            </div>

            {prescriptionImages.length > 0 ? (
              <div className="order-prescriptions-grid">
                {prescriptionImages.map((doc, idx) => (
                  <div key={doc.id || idx} className="prescription-image-card">
                    <div className="prescription-card-top">
                      <span
                        className="badge"
                        style={{
                          backgroundColor: doc.type === 1 ? "#10b981" : "#0ba6df",
                          color: "#ffffff",
                          fontSize: "11px",
                        }}
                      >
                        {doc.type === 1 ? "Medicine Photo (type 1)" : "Prescription (type 0)"}
                      </span>
                      <span className="small text-muted fw-bold">{doc.side} Side</span>
                    </div>
                    <div
                      className="prescription-img-frame"
                      onClick={() => {
                        setPreviewModalImg(doc.imageUrl);
                        setPreviewModalTitle(doc.title);
                      }}
                      title="Click to view full size"
                    >
                      <img
                        src={doc.imageUrl}
                        alt={doc.title}
                        className="prescription-main-img"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_DOCUMENT_IMAGE;
                        }}
                      />
                      <div className="prescription-zoom-overlay">
                        <i className="fa fa-search-plus" /> View Full Image
                      </div>
                    </div>
                    <div className="prescription-card-meta">
                      <span className="text-truncate fw-semibold" style={{ maxWidth: "135px" }} title={doc.title}>
                        {doc.title}
                      </span>
                      {doc.quantity && (
                        <span className="badge bg-light text-secondary border">
                          {doc.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted p-4 text-center border rounded bg-light small">
                <i className="fa fa-file-o me-1 text-secondary" />{" "}
                {writtenMedicines.length > 0
                  ? `No physical prescription photos uploaded. This order was placed with ${writtenMedicines.length} manual / written medicine(s) (see section below).`
                  : "No prescription or medicine images uploaded for this order."}
              </div>
            )}
          </div>

          {/* Purchase Bills & Invoices Section */}
          {(() => {
            const bills = Array.isArray(order.bills) ? order.bills : [];
            const orderNote = order.billNotes || "";
            const orderPrice =
              order.billPrice !== undefined && order.billPrice !== null && order.billPrice !== ""
                ? order.billPrice
                : "";
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
              <div className="order-bills-card mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <h5 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                    <i className="fa fa-file-text text-teal" style={{ color: "#0d9488" }} />
                    <span>Purchase Bills & Invoices</span>
                  </h5>
                  <div className="d-flex align-items-center gap-2">
                    {(orderPrice !== "" && orderPrice !== null && orderPrice !== undefined && Number(orderPrice) > 0) && (
                      <span className="existing-bill-price-badge">
                        <i className="fa fa-inr me-1" />
                        ₹{Number(orderPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className="badge bg-light text-dark border">
                      {bills.length} Bill(s) Recorded
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm text-white d-inline-flex align-items-center gap-1"
                      style={{ backgroundColor: "#0d9488", borderColor: "#0d9488" }}
                      onClick={() => handleOpenBillModal()}
                    >
                      <i className="fa fa-upload" /> Upload / Add Bills
                    </button>
                  </div>
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

                {bills.length > 0 ? (
                  <div className="order-bills-grid">
                    {bills.map((bill) => (
                      <div key={bill.id || bill.fileUrl || bill.fileName} className="order-bill-card-item">
                        <div
                          className="order-bill-card-img-wrap"
                          onClick={() => {
                            if (bill.fileUrl) {
                              if (isImageBill(bill)) {
                                setPreviewModalImg(bill.fileUrl);
                                setPreviewModalTitle(bill.fileName || "Bill Image");
                              } else {
                                window.open(bill.fileUrl, "_blank");
                              }
                            }
                          }}
                          title="Click to view full size"
                        >
                          {bill.fileUrl && isImageBill(bill) ? (
                            <img
                              src={bill.fileUrl}
                              alt={bill.fileName}
                              className="order-bill-card-img"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = FALLBACK_DOCUMENT_IMAGE;
                              }}
                            />
                          ) : (
                            <div className="d-flex flex-column align-items-center justify-content-center text-teal">
                              <i className="fa fa-file-text-o fa-3x" style={{ color: "#0d9488" }} />
                              <span className="small mt-1 text-muted">View Document</span>
                            </div>
                          )}
                        </div>

                        <div className="order-bill-card-body">
                          <div className="mb-1">
                            <span className="order-bill-badge">
                              <i className="fa fa-check me-1" /> Bill Copy
                            </span>
                          </div>

                          <div className="fw-semibold text-truncate small text-dark mb-1" title={bill.fileName}>
                            {bill.fileName}
                          </div>

                          <div className="small text-muted" style={{ fontSize: "11px" }}>
                            <i className="fa fa-clock-o me-1" /> {bill.uploadedAt || "Uploaded"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted p-4 text-center border rounded bg-light small">
                    <i className="fa fa-file-text-o me-1 text-secondary fs-5 d-block mb-1" />
                    No pharmacy bill or invoice uploaded yet for this order.
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: "#0d9488", borderColor: "#0d9488", backgroundColor: "#f0fdfa" }}
                        onClick={() => handleOpenBillModal()}
                      >
                        <i className="fa fa-upload me-1" /> Upload Bill Copy Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Manual / Written Medicines (CRM) Section */}
          {writtenMedicines && writtenMedicines.length > 0 && (
            <div className="mb-4 order-written-medicines-card">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                  <i className="fa fa-pencil-square-o text-warning" style={{ color: "#d97706" }} />
                  <span>Manual / Written Medicines (CRM)</span>
                </h5>
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  <i className="fa fa-check-circle me-1" />
                  {writtenMedicines.length} Manual Medicine{writtenMedicines.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="table-responsive border rounded bg-white shadow-sm">
                <table className="order-items-table mb-0">
                  <thead style={{ backgroundColor: "#f8fafc" }}>
                    <tr>
                      <th style={{ width: "60px" }}>#</th>
                      <th style={{ minWidth: "220px" }}>Medicine Name</th>
                      <th style={{ minWidth: "140px" }}>Prescribed Quantity</th>
                      <th style={{ minWidth: "130px" }}>Duration (Days)</th>
                      <th style={{ minWidth: "120px" }}>Entry Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {writtenMedicines.map((med, idx) => (
                      <tr key={med.id || idx}>
                        <td className="text-muted fw-bold text-center">{idx + 1}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                backgroundColor: "#fffbeb",
                                border: "1px solid #fef3c7",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#d97706",
                                flexShrink: 0,
                              }}
                            >
                              <i className="fa fa-medkit" />
                            </div>
                            <div>
                              <span className="fw-semibold text-dark d-block">
                                {med.name}
                              </span>
                              <span className="text-muted" style={{ fontSize: "11px" }}>
                                {med.id ? `ID #${med.id} • ` : ""}Type 2 Written Medicine
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: "12px" }}>
                            {med.quantity || "—"}
                          </span>
                        </td>
                        <td>
                          {med.days && String(med.days).trim() ? (
                            <span className="text-primary fw-semibold">
                              <i className="fa fa-calendar-check-o me-1" />
                              {med.days} {String(med.days).toLowerCase().includes("day") ? "" : "Days"}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: "#eff6ff",
                              color: "#1d4ed8",
                              border: "1px solid #bfdbfe",
                              fontSize: "11px",
                            }}
                          >
                            <i className="fa fa-pencil me-1" />
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

          {/* Ordered Items Table */}
          <div className="mb-4">
            <h5 className="fw-bold text-dark mb-3">
              <i className="fa fa-medkit text-primary me-2" /> Ordered Items (Medicines & Healthcare)
            </h5>
            <div className="table-responsive border rounded">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px" }}>Photo</th>
                    <th>Item Description</th>
                    <th>Category</th>
                    <th>Dosage / Form</th>
                    <th className="text-center" style={{ width: "100px" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => {
                      const itemImg = getMedicineImage(item);
                      return (
                        <tr key={item.id || idx}>
                          <td>
                            <div
                              className="order-item-thumb-wrapper"
                              onClick={() => {
                                setPreviewModalImg(itemImg);
                                setPreviewModalTitle(item.name);
                              }}
                              title="Click to view full size"
                            >
                              <img
                                src={itemImg}
                                alt={item.name}
                                className="order-item-thumb-img"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FALLBACK_MEDICINE_IMAGE;
                                }}
                              />
                              <span className="order-item-zoom-icon">
                                <i className="fa fa-search-plus" />
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="fw-semibold text-dark">{item.name}</span>
                          </td>
                          <td>
                            <span className="badge bg-light text-secondary border">
                              {item.category || "General"}
                            </span>
                          </td>
                          <td className="text-muted">{item.dosage || "Standard"}</td>
                          <td className="text-center fw-bold">{item.quantity || 1}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-3 text-muted">
                        No item breakdown available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary */}
          <div className="order-summary-box">
            <div className="order-info-row">
              <span className="order-info-label">Total Items:</span>
              <span className="order-info-val fw-bold">
                {order.totalItems || (order.items ? order.items.length : 0)} item(s)
              </span>
            </div>
            {writtenMedicines.length > 0 && (
              <div className="order-info-row">
                <span className="order-info-label">Manual / Written Medicines:</span>
                <span className="order-info-val fw-bold" style={{ color: "#d97706" }}>
                  {writtenMedicines.length} manual item(s)
                </span>
              </div>
            )}
            <div className="order-info-row">
              <span className="order-info-label">Prescriptions & Photos:</span>
              <span className="order-info-val fw-bold">{prescriptionImages.length} uploaded</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Pharmacy Purchase Bills:</span>
              <span className="order-info-val fw-bold" style={{ color: "#0d9488" }}>
                {(order.bills || getOrderBills(order.orderId)).length} bill(s) recorded
              </span>
            </div>
            {Boolean(order.paidAmount && Number(order.paidAmount) > 0) && (
              <div className="order-info-row summary-total-row">
                <span>Recorded Bill / Paid Amount:</span>
                <span>
                  {typeof order.paidAmount === "number"
                    ? `${order.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency || "MUR"}`
                    : `${order.paidAmount} ${order.currency || "MUR"}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Full Image Preview Modal */}
        {previewModalImg && (
          <div className="order-image-modal-backdrop" onClick={() => setPreviewModalImg(null)}>
            <div className="order-image-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="order-image-modal-header">
                <h6 className="fw-bold m-0 text-dark">{previewModalTitle || "Document Preview"}</h6>
                <div className="d-flex align-items-center gap-2">
                  <a
                    href={previewModalImg}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    <i className="fa fa-external-link me-1" /> Open Original
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setPreviewModalImg(null)}
                  >
                    <i className="fa fa-times" />
                  </button>
                </div>
              </div>
              <div className="order-image-modal-body">
                <img src={previewModalImg} alt="Preview" className="order-image-modal-img" />
              </div>
            </div>
          </div>
        )}

        {/* Bill / Invoice Upload Modal */}
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
          {order && (
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
                    Upload Bill / Invoice &bull; Order #{order.orderId}
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
                                  setPreviewModalImg(bf.preview);
                                  setPreviewModalTitle(bf.name || "Bill Preview");
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
                      : order.hasBillRecord ||
                        order.documentId ||
                        (Array.isArray(order.bills) && order.bills.length > 0)
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
      </div>
    </div>
  );
}
