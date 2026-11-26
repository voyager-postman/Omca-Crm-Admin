import axios from "axios";
import { AdminBaseUrl1, AdminBaseUrl, baseurl } from "../Basurl/Baseurl";

// CRM Orders API endpoints
const ORDERS_API_URL = `${AdminBaseUrl}orders_history`;
const ORDER_DETAILS_API_URL = `${AdminBaseUrl1}orders_Details`;
const UPDATE_STATUS_API_URL = `${AdminBaseUrl}update_place_order_status`;
const GET_MEDICINE_LIST_URL = `${AdminBaseUrl1}get_medicine_list`;
const UPLOAD_PRESCRIPTION_URL = `${AdminBaseUrl1}upload_prescription`;
const CART_LIST_URL = `${AdminBaseUrl1}cart_list`;
const MEDICINE_CART_LIST_URL = `${AdminBaseUrl1}cartlist`;
const CART_DELETE_URL = `${AdminBaseUrl1}cart_delete`;
const CART_ITEM_DELETE_URL = `${AdminBaseUrl1}cart_item_delete`;
const CART_VALUE_URL = `${AdminBaseUrl1}cartValue`;
const CHANGE_QUANTITY_URL = `${AdminBaseUrl1}change_quantity`;
const GET_ADDRESS_URL = `${AdminBaseUrl1}get_address`;
const SAVE_ADDRESS_URL = `${AdminBaseUrl1}save_address`;
const PLACE_ORDER_URL = `${AdminBaseUrl1}place_order`;
const SAVE_WRITTEN_MEDICINE_URL = `${AdminBaseUrl1}save_written_medicine`;
const WRITE_MEDICINE_ALIAS_URL = `${AdminBaseUrl1}write_medicine`;
const CART_COUNT_URL = `${AdminBaseUrl1}cart_count`;
const CREATE_MEDICINE_ORDER_URL = `${AdminBaseUrl}medicine-order/create`;
const CREATE_MEDICINE_ORDER_ALT_URL = `${AdminBaseUrl}medicine-order/save`;

// Status Mapping: 1 -> Pending, 2 -> Cancelled, 3 -> In Process, 4 -> On The Way, 5 -> Delivered, 6 -> Purchased
export const ORDER_STATUS_CODE_TO_LABEL = {
  1: "Pending",
  2: "Cancelled",
  3: "In Process",
  4: "On The Way",
  5: "Delivered",
  6: "Purchased",
};

export const ORDER_STATUS_LABEL_TO_CODE = {
  Pending: 1,
  pending: 1,
  Cancelled: 2,
  cancelled: 2,
  Canceled: 2,
  canceled: 2,
  "In Process": 3,
  "in process": 3,
  "In-Process": 3,
  "On The Way": 4,
  "on the way": 4,
  "On-The-Way": 4,
  Delivered: 5,
  delivered: 5,
  Purchased: 6,
  purchased: 6,
};

export const KNOWN_PATIENT_NAMES = {};

export const getMedicineDefaultImage = (name = "") => {
  const n = String(name || "").toLowerCase();
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

// High-fidelity initial orders data directly based on the CRM orders screenshot
export const INITIAL_ORDERS_DATA = [
  {
    id: "1",
    sNo: 1,
    orderId: "596704750369",
    patientName: "Tawfick Mohammad Dilloo",
    userId: "675",
    patientPhone: "+230 5789 1234",
    patientEmail: "tawfick.dilloo@example.com",
    deliveryAddress: "Route Royale, Curepipe, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 0,
    currency: "MUR",
    orderDate: "2026-09-03 10:31:41",
    status: "Pending",
    notes: "Patient requested urgent delivery before noon.",
    items: [
      {
        id: "it-101",
        name: "Paracetamol 500mg Tablets",
        category: "Pain Relief",
        dosage: "500 mg",
        quantity: 2,
        unitPrice: 0,
        total: 0,
      },
    ],
  },
  {
    id: "2",
    sNo: 2,
    orderId: "733357928876",
    patientName: "Tawfick Mohammad Dilloo",
    userId: "675",
    patientPhone: "+230 5789 1234",
    patientEmail: "tawfick.dilloo@example.com",
    deliveryAddress: "Route Royale, Curepipe, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 742.11,
    currency: "MUR",
    orderDate: "2026-09-03 07:33:31",
    status: "Pending",
    notes: "Verify prescription copy upon delivery.",
    items: [
      {
        id: "it-102",
        name: "Amoxicillin & Clavulanate 625mg",
        category: "Antibiotics",
        dosage: "625 mg",
        quantity: 3,
        unitPrice: 180.5,
        total: 541.5,
      },
      {
        id: "it-103",
        name: "Vitamin C 1000mg Effervescent",
        category: "Supplements",
        dosage: "1000 mg",
        quantity: 1,
        unitPrice: 200.61,
        total: 200.61,
      },
    ],
  },
  {
    id: "3",
    sNo: 3,
    orderId: "659448612566",
    patientName: "Tawfick Mohammad Dilloo",
    userId: "675",
    patientPhone: "+230 5789 1234",
    patientEmail: "tawfick.dilloo@example.com",
    deliveryAddress: "Route Royale, Curepipe, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 40.44,
    currency: "MUR",
    orderDate: "2026-09-03 05:52:43",
    status: "Pending",
    notes: "Leave package at reception if unavailable.",
    items: [
      {
        id: "it-104",
        name: "Cetirizine 10mg Tablets",
        category: "Antihistamine",
        dosage: "10 mg",
        quantity: 1,
        unitPrice: 40.44,
        total: 40.44,
      },
    ],
  },
  {
    id: "4",
    sNo: 4,
    orderId: "847900684023",
    patientName: "Tawfick Mohammad Dilloo",
    userId: "675",
    patientPhone: "+230 5789 1234",
    patientEmail: "tawfick.dilloo@example.com",
    deliveryAddress: "Route Royale, Curepipe, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 0,
    currency: "MUR",
    orderDate: "2026-09-03 05:37:35",
    status: "Cancelled",
    notes: "Cancelled by user via mobile application.",
    items: [
      {
        id: "it-105",
        name: "Ibuprofen 400mg Softgels",
        category: "Pain Relief",
        dosage: "400 mg",
        quantity: 2,
        unitPrice: 0,
        total: 0,
      },
    ],
  },
  {
    id: "5",
    sNo: 5,
    orderId: "379234267814",
    patientName: "PT. Test Rahul",
    userId: "1047",
    patientPhone: "+230 5987 6543",
    patientEmail: "rahul.test@example.com",
    deliveryAddress: "Avenue des Tulipes, Quatre Bornes, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 90.99,
    currency: "MUR",
    orderDate: "2026-07-31 12:37:45",
    status: "Pending",
    notes: "Contact patient 30 minutes before arrival.",
    items: [
      {
        id: "it-106",
        name: "Omeprazole 20mg Capsules",
        category: "Gastrointestinal",
        dosage: "20 mg",
        quantity: 1,
        unitPrice: 90.99,
        total: 90.99,
      },
    ],
  },
  {
    id: "6",
    sNo: 6,
    orderId: "149907141634",
    patientName: "Deena Nath Soni",
    userId: "1720",
    patientPhone: "+230 5123 4567",
    patientEmail: "deena.soni@example.com",
    deliveryAddress: "St Jean Road, Beau Bassin-Rose Hill, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 485.3,
    currency: "MUR",
    orderDate: "2026-07-30 12:01:52",
    status: "Cancelled",
    notes: "Item out of stock from local warehouse.",
    items: [
      {
        id: "it-107",
        name: "Metformin 500mg SR Tablets",
        category: "Diabetes Care",
        dosage: "500 mg",
        quantity: 3,
        unitPrice: 161.76,
        total: 485.3,
      },
    ],
  },
  {
    id: "7",
    sNo: 7,
    orderId: "918237465012",
    patientName: "Marie Sophie Martin",
    userId: "1863",
    patientPhone: "+230 5432 1098",
    patientEmail: "marie.martin@example.mu",
    deliveryAddress: "Coastal Road, Grand Baie, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 620.0,
    currency: "MUR",
    orderDate: "2026-09-02 14:15:20",
    status: "In Process",
    notes: "Prescription verified by Pharmacist Dr. Ah-Kee.",
    items: [
      {
        id: "it-108",
        name: "Atorvastatin 20mg Tablets",
        category: "Cardiovascular",
        dosage: "20 mg",
        quantity: 2,
        unitPrice: 310.0,
        total: 620.0,
      },
    ],
  },
  {
    id: "8",
    sNo: 8,
    orderId: "482019384756",
    patientName: "Jean-Pierre Duval",
    userId: "1799",
    patientPhone: "+230 5234 5678",
    patientEmail: "jp.duval@example.mu",
    deliveryAddress: "La Chaussée Street, Port Louis, Mauritius",
    paymentMode: "Online Payment",
    paidAmount: 1150.5,
    currency: "MUR",
    orderDate: "2026-09-01 16:40:10",
    status: "On The Way",
    notes: "Out for delivery with Courier Service Express.",
    items: [
      {
        id: "it-109",
        name: "Salbutamol Inhaler 100mcg",
        category: "Respiratory",
        dosage: "100 mcg",
        quantity: 2,
        unitPrice: 425.25,
        total: 850.5,
      },
      {
        id: "it-110",
        name: "Multivitamin Active Complex",
        category: "Wellness",
        dosage: "Daily Caps",
        quantity: 1,
        unitPrice: 300.0,
        total: 300.0,
      },
    ],
  },
  {
    id: "9",
    sNo: 9,
    orderId: "293847102938",
    patientName: "Kavita Ramgoolam",
    userId: "1002",
    patientPhone: "+230 5876 5432",
    patientEmail: "kavita.r@example.mu",
    deliveryAddress: "Royal Road, Flic en Flac, Mauritius",
    paymentMode: "Cash On Delivery",
    paidAmount: 340.0,
    currency: "MUR",
    orderDate: "2026-08-28 09:20:00",
    status: "Delivered",
    notes: "Successfully delivered and signed by customer.",
    items: [
      {
        id: "it-111",
        name: "Eye Drops Lubricant 10ml",
        category: "Ophthalmic",
        dosage: "10 ml",
        quantity: 2,
        unitPrice: 170.0,
        total: 340.0,
      },
    ],
  },
];

const LOCAL_STORAGE_ORDERS_KEY = "omca_crm_orders_cache";

/**
 * Get stored orders or initialize default
 */
export const getStoredOrders = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (raw !== null && raw !== undefined) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load stored orders from localStorage:", e);
  }
  return [];
};

/**
 * Persist orders in localStorage
 */
export const saveStoredOrders = (orders) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn("Failed to save orders to localStorage:", e);
  }
};

const LOCAL_STORAGE_BILLS_KEY = "omca_crm_order_bills";

/**
 * Get all stored bills mapping: { [orderId]: Array<BillObject> }
 */
export const getAllStoredBills = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BILLS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.warn("Failed to load bills from localStorage:", e);
  }
  return {};
};

/**
 * Get bills for a specific order
 */
export const getOrderBills = (orderId) => {
  if (!orderId) return [];
  const all = getAllStoredBills();
  const cleanId = String(orderId).trim();
  const list = all[cleanId] || [];
  return Array.isArray(list) ? list : [];
};

const LOCAL_STORAGE_BILL_NOTES_KEY = "omca_crm_order_bill_notes";
const LOCAL_STORAGE_BILL_PRICE_KEY = "omca_crm_order_bill_prices";

/**
 * Get stored bill prices mapping: { [orderId]: number|string }
 */
const getAllStoredBillPrices = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BILL_PRICE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.warn("Failed to load bill prices from localStorage:", e);
    return {};
  }
};

/**
 * Get the consolidated bill/invoice price for an order
 */
export const getOrderBillPrice = (orderId) => {
  if (!orderId && orderId !== 0) return "";
  const cleanId = String(orderId).trim();
  const all = getAllStoredBillPrices();
  if (Object.prototype.hasOwnProperty.call(all, cleanId)) {
    return all[cleanId] === null || all[cleanId] === undefined ? "" : all[cleanId];
  }
  return "";
};

/**
 * Save the consolidated bill/invoice price for an order
 */
export const saveOrderBillPrice = (orderId, price) => {
  if (!orderId && orderId !== 0) return;
  const cleanId = String(orderId).trim();
  const all = getAllStoredBillPrices();
  const numeric =
    price === "" || price === null || price === undefined
      ? ""
      : Number(String(price).replace(/[^0-9.-]+/g, ""));
  all[cleanId] = Number.isFinite(numeric) ? numeric : "";
  try {
    localStorage.setItem(LOCAL_STORAGE_BILL_PRICE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Failed to save bill price to localStorage:", e);
  }
};

/**
 * Get the consolidated purchase/bill note for an order
 */
export const getOrderBillNote = (orderId) => {
  if (!orderId) return "";
  const cleanId = String(orderId).trim();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BILL_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, cleanId)) {
        return parsed[cleanId] || "";
      }
    }
  } catch (e) {
    console.warn("Failed to load bill note from localStorage:", e);
  }
  return "";
};

/**
 * Save the consolidated purchase/bill note for an order
 */
export const saveOrderBillNote = (orderId, note) => {
  if (!orderId) return;
  const cleanId = String(orderId).trim();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BILL_NOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[cleanId] = String(note || "").trim();
    localStorage.setItem(LOCAL_STORAGE_BILL_NOTES_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn("Failed to save bill note to localStorage:", e);
  }
};

/**
 * Save/Add multiple bills for an order with one shared note
 */
export const addMultipleOrderBills = (orderId, billsArray = [], note = "") => {
  if (!orderId) return [];
  const cleanId = String(orderId).trim();
  const all = getAllStoredBills();
  const currentList = Array.isArray(all[cleanId]) ? all[cleanId] : [];

  if (note !== undefined && note !== null) {
    saveOrderBillNote(cleanId, note);
  }

  const cleanNote = String(note || "").trim();

  const sharedPrice =
    billsArray.find((b) => b.price !== undefined && b.price !== null && b.price !== "")?.price ??
    getOrderBillPrice(cleanId) ??
    "";

  if (sharedPrice !== "" && sharedPrice !== null && sharedPrice !== undefined) {
    saveOrderBillPrice(cleanId, sharedPrice);
  }

  const newBills = (billsArray || []).map((billData, idx) => ({
    id: billData.id || `bill-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    orderId: cleanId,
    fileName: billData.fileName || `Invoice_Bill_${idx + 1}.jpg`,
    fileUrl: billData.fileUrl || "",
    fileType: billData.fileType || "image/jpeg",
    fileSize: billData.fileSize || 0,
    notes: cleanNote,
    price:
      billData.price !== undefined && billData.price !== null && billData.price !== ""
        ? Number(billData.price) || billData.price
        : sharedPrice,
    uploadedAt: billData.uploadedAt || new Date().toLocaleString(),
    uploadedBy: billData.uploadedBy || "Admin User",
  }));

  const updatedList = [...newBills, ...currentList];
  all[cleanId] = updatedList;

  try {
    localStorage.setItem(LOCAL_STORAGE_BILLS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Failed to save bills to localStorage:", e);
  }

  return updatedList;
};

/**
 * Save/Add a single bill for an order
 */
export const addOrderBill = (orderId, billData) => {
  if (!orderId || !billData) return null;
  const cleanId = String(orderId).trim();
  const all = getAllStoredBills();
  const currentList = Array.isArray(all[cleanId]) ? all[cleanId] : [];

  const note = String(billData.notes || "").trim();
  if (note) {
    saveOrderBillNote(cleanId, note);
  }

  if (billData.price !== undefined && billData.price !== null && billData.price !== "") {
    saveOrderBillPrice(cleanId, billData.price);
  }

  const newBill = {
    id: billData.id || `bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    orderId: cleanId,
    fileName: billData.fileName || "Invoice_Bill.jpg",
    fileUrl: billData.fileUrl || "",
    fileType: billData.fileType || "image/jpeg",
    fileSize: billData.fileSize || 0,
    notes: note,
    price:
      billData.price !== undefined && billData.price !== null && billData.price !== ""
        ? Number(billData.price) || billData.price
        : getOrderBillPrice(cleanId) || "",
    uploadedAt: billData.uploadedAt || new Date().toLocaleString(),
    uploadedBy: billData.uploadedBy || "Admin User",
  };

  const updatedList = [newBill, ...currentList];
  all[cleanId] = updatedList;

  try {
    localStorage.setItem(LOCAL_STORAGE_BILLS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Failed to save bill to localStorage:", e);
  }

  return newBill;
};

/**
 * Delete a bill for an order
 */
export const deleteOrderBill = (orderId, billId) => {
  if (!orderId || !billId) return false;
  const cleanId = String(orderId).trim();
  const all = getAllStoredBills();
  const currentList = Array.isArray(all[cleanId]) ? all[cleanId] : [];
  all[cleanId] = currentList.filter((b) => String(b.id) !== String(billId));

  try {
    localStorage.setItem(LOCAL_STORAGE_BILLS_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    console.warn("Failed to delete bill from localStorage:", e);
    return false;
  }
};

/**
 * Save / synchronize bills array for an order in local storage
 */
export const saveStoredBillsForOrder = (orderId, billsList = []) => {
  if (!orderId) return;
  const cleanId = String(orderId).trim();
  const all = getAllStoredBills();
  all[cleanId] = Array.isArray(billsList) ? billsList : [];
  try {
    localStorage.setItem(LOCAL_STORAGE_BILLS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Failed to save bills to localStorage:", e);
  }
};

/**
 * Resolve invoice/document file URL from API relative or absolute paths
 */
const resolveOrderDocumentUrl = (rawUrl = "") => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  let origin = "https://omcacrm.com";
  try {
    origin = new URL(AdminBaseUrl).origin;
  } catch (_) {
    // keep default
  }

  const cleanPath = value.replace(/^\/+/, "");
  if (cleanPath.startsWith("omca/")) {
    return `${origin}/${cleanPath}`;
  }
  if (cleanPath.startsWith("public/") || cleanPath.startsWith("uploads/")) {
    return `${origin}/${cleanPath}`;
  }
  return `${origin}/public/${cleanPath}`;
};

/**
 * Format API datetime for display
 */
const formatDocumentDate = (value) => {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString();
    }
  } catch (_) {
    // ignore
  }
  return String(value);
};

/**
 * Extract notes value from API payload (string or array of note objects)
 * Example:
 * notes: [{ id: 4, notes: "test", created_at: "..." }]
 */
const extractDocumentNotes = (payload) => {
  if (!payload || typeof payload !== "object") return "";
  const candidates = [
    payload.notes,
    payload.note,
    payload?.data?.notes,
    payload?.data?.note,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    if (Array.isArray(candidate)) {
      if (candidate.length === 0) return "";
      const texts = candidate
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            return String(item.notes || item.note || item.text || item.message || "").trim();
          }
          return String(item || "").trim();
        })
        .filter(Boolean);
      // Prefer latest note entry
      return texts.length ? texts[texts.length - 1] : "";
    }
    if (typeof candidate === "string") return candidate;
    if (typeof candidate === "object") {
      return String(candidate.notes || candidate.note || candidate.text || "").trim();
    }
  }
  return "";
};

/**
 * Extract price value from API payload
 * Live GET shape: data.price = "5500.00"
 */
const extractDocumentPrices = (payload) => {
  if (!payload || typeof payload !== "object") return "";
  const candidates = [
    payload.price,
    payload.prices,
    payload.amount,
    payload.bill_price,
    payload.billPrice,
    payload.paid_amount,
    payload.paidAmount,
    payload?.data?.price,
    payload?.data?.prices,
    payload?.data?.amount,
    payload?.data?.bill_price,
    payload?.data?.billPrice,
  ];

  const readOne = (value) => {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === "object" && !Array.isArray(value)) {
      return value.price ?? value.prices ?? value.amount ?? value.value ?? "";
    }
    return value;
  };

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    if (Array.isArray(candidate)) {
      if (candidate.length === 0) return "";
      for (let i = candidate.length - 1; i >= 0; i -= 1) {
        const v = readOne(candidate[i]);
        if (v !== undefined && v !== null && v !== "") return v;
      }
      continue;
    }
    const v = readOne(candidate);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

/**
 * Normalize raw invoice/document list from GET/POST documents API
 * Live shape example:
 * { id, type, original_name, mime_type, file_size, url, created_at }
 */
const normalizeOrderDocumentsList = (rawDocs = [], orderId = "", sharedNote = "", sharedPrice = "") => {
  const list = Array.isArray(rawDocs) ? rawDocs : [];
  return list
    .map((doc, idx) => {
      if (typeof doc === "string") {
        const fileUrl = resolveOrderDocumentUrl(doc);
        return {
          id: `doc-${orderId}-${idx}`,
          orderId: String(orderId),
          fileName: decodeURIComponent(fileUrl.split("/").pop() || `Invoice_Bill_${idx + 1}.jpg`),
          fileUrl,
          fileType: String(fileUrl).toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg",
          fileSize: 0,
          notes: sharedNote || "",
          price:
            sharedPrice !== "" && sharedPrice !== null && sharedPrice !== undefined
              ? Number(sharedPrice) || sharedPrice
              : "",
          uploadedAt: new Date().toLocaleString(),
        };
      }
      if (!doc || typeof doc !== "object") return null;

      const fileUrl = resolveOrderDocumentUrl(
        doc.url ||
          doc.fileUrl ||
          doc.file ||
          doc.path ||
          doc.document ||
          doc.invoice ||
          doc.invoice_url ||
          doc.image ||
          ""
      );
      const fileName =
        doc.original_name ||
        doc.fileName ||
        doc.filename ||
        doc.name ||
        doc.title ||
        (fileUrl ? decodeURIComponent(fileUrl.split("?")[0].split("/").pop()) : "") ||
        `Invoice_Bill_${idx + 1}.jpg`;
      const mime = String(doc.mime_type || doc.fileType || doc.mimeType || "").toLowerCase();
      const isPdf =
        mime === "application/pdf" ||
        String(fileUrl).toLowerCase().endsWith(".pdf") ||
        doc.type === "pdf";
      const isImage =
        mime.startsWith("image/") ||
        /\.(jpe?g|png|gif|webp|jfif|bmp)(\?|$)/i.test(String(fileUrl));
      const docPrice =
        doc.prices ??
        doc.price ??
        doc.amount ??
        doc.bill_price ??
        doc.billPrice ??
        sharedPrice ??
        "";

      return {
        id: doc.id || doc._id || `doc-${orderId}-${idx}`,
        orderId: String(orderId),
        fileName,
        fileUrl,
        fileType: isPdf
          ? "application/pdf"
          : mime || (isImage ? "image/jpeg" : "application/octet-stream"),
        fileSize: Number(doc.file_size || doc.fileSize || doc.size || 0) || 0,
        notes:
          typeof doc.notes === "string"
            ? doc.notes
            : typeof doc.note === "string"
              ? doc.note
              : sharedNote || "",
        price:
          docPrice !== "" && docPrice !== null && docPrice !== undefined
            ? Number(docPrice) || docPrice
            : "",
        uploadedAt:
          formatDocumentDate(doc.created_at || doc.uploadedAt || doc.createdAt || doc.date || "") ||
          new Date().toLocaleString(),
        type: doc.type || "",
      };
    })
    .filter(Boolean);
};

/**
 * GET /api/crm/orders/{order_id}/documents
 * Header: Accept: application/json
 * Response data: { id, order_id, price, notes, invoices: [...] }
 */
export const fetchOrderDocuments = async (orderId) => {
  if (!orderId && orderId !== 0) {
    return {
      success: false,
      documents: [],
      notes: "",
      price: "",
      documentId: null,
      hasExisting: false,
      message: "Order ID is required",
    };
  }
  const cleanId = String(orderId).trim();
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const endpointUrl = `${AdminBaseUrl}orders/${cleanId}/documents`;

  try {
    const response = await axios.get(endpointUrl, {
      headers,
      timeout: 15000,
    });

    const data = response?.data;
    const payload =
      data?.data && typeof data.data === "object" && !Array.isArray(data.data)
        ? data.data
        : data;

    let rawDocs = [];
    if (Array.isArray(payload?.invoices)) {
      rawDocs = payload.invoices;
    } else if (Array.isArray(data?.invoices)) {
      rawDocs = data.invoices;
    } else if (Array.isArray(payload?.documents)) {
      rawDocs = payload.documents;
    } else if (Array.isArray(payload?.bills)) {
      rawDocs = payload.bills;
    } else if (Array.isArray(data?.data)) {
      rawDocs = data.data;
    }

    const fetchedNote = extractDocumentNotes(data);
    const fetchedPriceRaw = extractDocumentPrices(data);
    const documentId = payload?.id ?? data?.id ?? null;
    const normalizedDocs = normalizeOrderDocumentsList(
      rawDocs,
      cleanId,
      fetchedNote,
      fetchedPriceRaw
    );

    saveStoredBillsForOrder(cleanId, normalizedDocs);
    saveOrderBillNote(cleanId, fetchedNote || "");
    saveOrderBillPrice(
      cleanId,
      fetchedPriceRaw !== "" && fetchedPriceRaw !== null && fetchedPriceRaw !== undefined
        ? fetchedPriceRaw
        : ""
    );

    const currentPrice =
      fetchedPriceRaw !== "" && fetchedPriceRaw !== null && fetchedPriceRaw !== undefined
        ? Number(fetchedPriceRaw) || fetchedPriceRaw
        : "";

    const hasExisting = Boolean(
      documentId ||
        normalizedDocs.length > 0 ||
        fetchedNote ||
        (currentPrice !== "" && currentPrice !== null && currentPrice !== undefined)
    );

    return {
      success: true,
      documents: normalizedDocs,
      notes: fetchedNote || "",
      price: currentPrice,
      documentId,
      hasExisting,
      data,
      fromLiveApi: true,
    };
  } catch (err) {
    console.warn("fetchOrderDocuments notice:", err?.response?.data || err.message);
    const cachedBills = getOrderBills(cleanId);
    const cachedNote = getOrderBillNote(cleanId);
    const cachedPrice = getOrderBillPrice(cleanId);
    return {
      success: false,
      documents: cachedBills,
      notes: cachedNote,
      price: cachedPrice,
      documentId: null,
      hasExisting: cachedBills.length > 0 || Boolean(cachedNote) || cachedPrice !== "",
      fromCache: true,
      message: err.message,
    };
  }
};

const parseDocumentsApiFailure = (data, fallback = "Failed to save documents") => {
  if (!data) return fallback;
  if (data.errors && typeof data.errors === "object") {
    const joined = Object.values(data.errors).flat().filter(Boolean).join(" ");
    if (joined) return joined;
  }
  return data.message || fallback;
};

const assertDocumentsApiSuccess = (data, response) => {
  const apiSaysFailed =
    data?.success === false ||
    data?.success === "false" ||
    data?.status === false ||
    data?.status === "false";
  if (!apiSaysFailed) return;
  const err = new Error(parseDocumentsApiFailure(data));
  err.response = { data, status: response?.status };
  throw err;
};

const buildDocumentsFormData = ({ notes = "", price = "", files = [] } = {}) => {
  const cleanNote = String(notes || "").trim();
  const cleanPrice =
    price === "" || price === null || price === undefined
      ? ""
      : Number(String(price).replace(/[^0-9.-]+/g, ""));

  const fileArray = (Array.isArray(files) ? files : [files].filter(Boolean))
    .map((item) => (item instanceof File ? item : item?.file))
    .filter((f) => f instanceof File);

  const formData = new FormData();
  formData.append("notes", cleanNote);
  if (cleanPrice !== "" && Number.isFinite(cleanPrice)) {
    // API contract field: price
    formData.append("price", String(cleanPrice));
  }
  // API contract field: invoices[] (array)
  fileArray.forEach((rawFile) => {
    formData.append("invoices[]", rawFile, rawFile.name);
  });

  return { formData, cleanNote, cleanPrice, fileArray };
};

const finalizeDocumentsSave = async (cleanId, data, cleanNote, cleanPrice) => {
  if (cleanNote) saveOrderBillNote(cleanId, cleanNote);
  if (cleanPrice !== "" && Number.isFinite(cleanPrice)) {
    saveOrderBillPrice(cleanId, cleanPrice);
  }

  const refreshed = await fetchOrderDocuments(cleanId);
  if (refreshed?.fromLiveApi) {
    return {
      success: true,
      data,
      documents: refreshed.documents,
      notes: refreshed.notes || cleanNote,
      price:
        refreshed.price !== "" && refreshed.price !== null && refreshed.price !== undefined
          ? refreshed.price
          : Number.isFinite(cleanPrice)
            ? cleanPrice
            : "",
      documentId: refreshed.documentId,
      hasExisting: refreshed.hasExisting,
      fromLiveApi: true,
    };
  }

  const serverDocs =
    data?.data?.invoices ||
    data?.invoices ||
    data?.data?.documents ||
    data?.documents ||
    [];
  const serverPrice = extractDocumentPrices(data);
  const resolvedPrice =
    serverPrice !== "" && serverPrice !== null && serverPrice !== undefined
      ? serverPrice
      : Number.isFinite(cleanPrice)
        ? cleanPrice
        : "";
  const serverNote = extractDocumentNotes(data) || cleanNote;
  if (Array.isArray(serverDocs) && serverDocs.length > 0) {
    saveStoredBillsForOrder(
      cleanId,
      normalizeOrderDocumentsList(serverDocs, cleanId, serverNote, resolvedPrice)
    );
  }
  if (serverNote) saveOrderBillNote(cleanId, serverNote);
  if (resolvedPrice !== "" && resolvedPrice !== null && resolvedPrice !== undefined) {
    saveOrderBillPrice(cleanId, resolvedPrice);
  }

  return {
    success: true,
    data,
    documents: getOrderBills(cleanId),
    notes: getOrderBillNote(cleanId) || serverNote,
    price:
      getOrderBillPrice(cleanId) ||
      (Number.isFinite(Number(resolvedPrice)) ? Number(resolvedPrice) : resolvedPrice),
    documentId: data?.data?.id || data?.id || null,
    hasExisting: true,
    fromLiveApi: true,
  };
};

/**
 * ADD — POST /api/crm/orders/{order_id}/documents
 * multipart/form-data: invoices[], price, notes
 */
export const uploadOrderDocuments = async (
  orderId,
  { files = [], notes = "", price = "", prices = "" } = {}
) => {
  if (!orderId && orderId !== 0) {
    throw new Error("Order ID is required to upload documents");
  }
  const cleanId = String(orderId).trim();
  const priceInput =
    price !== "" && price !== null && price !== undefined ? price : prices;
  const { formData, cleanNote, cleanPrice, fileArray } = buildDocumentsFormData({
    notes,
    price: priceInput,
    files,
  });

  if (fileArray.length === 0 && !cleanNote && !(cleanPrice !== "" && Number.isFinite(cleanPrice))) {
    throw new Error("Please select at least one invoice file, provide a note, or enter a price.");
  }

  const token = localStorage.getItem("token");
  const response = await axios.post(`${AdminBaseUrl}orders/${cleanId}/documents`, formData, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 30000,
  });

  assertDocumentsApiSuccess(response?.data, response);
  return finalizeDocumentsSave(cleanId, response?.data, cleanNote, cleanPrice);
};

/**
 * UPDATE — POST /api/crm/orders/{order_id}/documents/update
 * multipart/form-data: price, notes, invoices[] (optional additional files)
 */
export const updateOrderDocuments = async (
  orderId,
  { files = [], notes = "", price = "", prices = "" } = {}
) => {
  if (!orderId && orderId !== 0) {
    throw new Error("Order ID is required to update documents");
  }
  const cleanId = String(orderId).trim();
  const priceInput =
    price !== "" && price !== null && price !== undefined ? price : prices;
  const { formData, cleanNote, cleanPrice } = buildDocumentsFormData({
    notes,
    price: priceInput,
    files,
  });

  const token = localStorage.getItem("token");
  const response = await axios.post(
    `${AdminBaseUrl}orders/${cleanId}/documents/update`,
    formData,
    {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 30000,
    }
  );

  assertDocumentsApiSuccess(response?.data, response);
  return finalizeDocumentsSave(cleanId, response?.data, cleanNote, cleanPrice);
};

/**
 * Save documents — uses ADD when none exist, UPDATE when record already exists
 */
export const saveOrderDocuments = async (orderId, options = {}) => {
  const { hasExisting = false, forceUpdate = false, forceAdd = false } = options;
  if (forceAdd) return uploadOrderDocuments(orderId, options);
  if (forceUpdate || hasExisting) return updateOrderDocuments(orderId, options);
  return uploadOrderDocuments(orderId, options);
};

/**
 * Normalize raw backend order object into standard UI shape
 * Status Mapping: 1 -> Pending, 2 -> Cancelled, 3 -> In Process, 4 -> On The Way, 5 -> Delivered
 */
export const normalizeOrder = (raw, index = 0) => {
  if (!raw || typeof raw !== "object") return null;

  const rawId = raw.id;
  const orderId =
    raw.order ||
    raw.order_id ||
    raw.orderId ||
    raw.order_no ||
    raw.orderNo ||
    rawId ||
    `ORD-${index + 1}`;

  const userId = String(raw.user_id || raw.userId || "");

  const patientName =
    (
      raw.user_name ||
      raw.userName ||
      raw.patient_name ||
      raw.patientName ||
      raw.customer_name ||
      raw.customerName ||
      raw.name ||
      ""
    ).trim() || "-";

  let paymentMode = "Cash On Delivery";
  const rawMode = (
    raw.payment_mode ||
    raw.paymentMode ||
    raw.payment_method ||
    raw.paymentMethod ||
    raw.pay_method ||
    raw.pay_mode ||
    raw.method_name ||
    ""
  ).toString().trim();

  if (rawMode) {
    const lowerMode = rawMode.toLowerCase();
    if (
      lowerMode.includes("online") ||
      lowerMode.includes("card") ||
      lowerMode.includes("upi") ||
      lowerMode.includes("netbanking") ||
      lowerMode.includes("gateway")
    ) {
      paymentMode = "Online Payment";
    } else if (lowerMode.includes("cod") || lowerMode.includes("cash")) {
      paymentMode = "Cash On Delivery";
    } else {
      paymentMode = rawMode;
    }
  } else if (String(raw.method) === "1" || raw.method === 1) {
    paymentMode = "Online Payment";
  } else if (String(raw.method) === "0" || raw.method === 0 || raw.method === null) {
    paymentMode = "Cash On Delivery";
  }

  // Transaction ID / Reference extraction
  const transactionId = (
    raw.transaction_id ||
    raw.transactionId ||
    raw.txn_id ||
    raw.txnId ||
    raw.payment_id ||
    raw.paymentId ||
    raw.razorpay_payment_id ||
    raw.stripe_payment_id ||
    raw.pay_id ||
    raw.ref_no ||
    raw.reference_id ||
    raw.utr_number ||
    raw.utr ||
    ""
  ).toString().trim();

  // Payment Date extraction
  const paymentDate = (
    raw.payment_date ||
    raw.paymentDate ||
    raw.paid_date ||
    raw.paidDate ||
    raw.paid_at ||
    raw.paidAt ||
    raw.payment_time ||
    ""
  ).toString().trim();

  // Payment status normalization
  const rawPayStatus = (
    raw.payment_status ??
    raw.paymentStatus ??
    raw.pay_status ??
    raw.paid_status ??
    raw.is_paid ??
    ""
  ).toString().trim().toLowerCase();

  let paymentStatus = "Pending";
  if (
    rawPayStatus === "1" ||
    rawPayStatus === "paid" ||
    rawPayStatus === "success" ||
    rawPayStatus === "completed" ||
    rawPayStatus === "complete" ||
    rawPayStatus === "true" ||
    raw.is_paid === true ||
    raw.is_paid === 1
  ) {
    paymentStatus = "Paid";
  } else if (
    rawPayStatus === "failed" ||
    rawPayStatus === "failure" ||
    rawPayStatus === "declined" ||
    rawPayStatus === "rejected" ||
    rawPayStatus === "2"
  ) {
    paymentStatus = "Failed";
  } else if (rawPayStatus === "refunded") {
    paymentStatus = "Refunded";
  } else if (rawPayStatus === "0" || rawPayStatus === "unpaid" || rawPayStatus === "pending") {
    if (paymentMode === "Cash On Delivery") {
      paymentStatus = "COD Pending";
    } else {
      paymentStatus = "Pending";
    }
  } else {
    // Intelligent fallback based on delivery & payment method
    const sLower = String(raw.order_status || raw.orderStatus || raw.status || "").toLowerCase();
    const isDelivered = sLower.includes("deliver") || String(raw.type) === "5";
    if (isDelivered) {
      paymentStatus = "Paid & Completed";
    } else if (paymentMode === "Online Payment" && transactionId) {
      paymentStatus = "Paid";
    } else if (paymentMode === "Cash On Delivery") {
      paymentStatus = "COD Pending";
    } else {
      paymentStatus = "Pending";
    }
  }

  const rawAmount =
    raw.price ??
    raw.paid_amount ??
    raw.paidAmount ??
    raw.amount ??
    raw.total_amount ??
    raw.totalAmount ??
    raw.total ??
    raw.net_amount ??
    raw.grand_total ??
    raw.final_amount ??
    raw.order_total ??
    raw.total_price ??
    0;

  let paidAmount =
    typeof rawAmount === "number"
      ? rawAmount
      : parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, "")) || 0;

  // If order amount is 0, check if bills were uploaded with price
  const billPrice = getOrderBillPrice(orderId);
  if (paidAmount === 0 && billPrice > 0) {
    paidAmount = billPrice;
  }

  let rawDateStr =
    raw.date && raw.time
      ? `${raw.date} ${raw.time}`
      : raw.order_on ||
        raw.orderOn ||
        raw.order_date ||
        raw.orderDate ||
        raw.date ||
        raw.created_at ||
        "—";

  let orderDate = rawDateStr;
  if (rawDateStr && rawDateStr !== "—") {
    try {
      const parsedDate = new Date(rawDateStr);
      if (!isNaN(parsedDate.getTime())) {
        const pad = (n) => String(n).padStart(2, "0");
        const y = parsedDate.getFullYear();
        const m = pad(parsedDate.getMonth() + 1);
        const d = pad(parsedDate.getDate());
        const h = pad(parsedDate.getHours());
        const min = pad(parsedDate.getMinutes());
        const s = pad(parsedDate.getSeconds());
        orderDate = `${y}-${m}-${d} ${h}:${min}:${s}`;
      }
    } catch (e) {
      orderDate = rawDateStr;
    }
  }

  // Status mapping: 1 -> Pending, 2 -> Cancelled, 3 -> In Process, 4 -> On The Way, 5 -> Delivered
  let status = "Pending";
  let statusCode = 1;

  if (raw.type !== undefined && raw.type !== null && raw.type !== "") {
    statusCode = Number(raw.type);
    status = ORDER_STATUS_CODE_TO_LABEL[statusCode] || "Pending";
  } else if (raw.order_status || raw.orderStatus || raw.status) {
    const s = String(raw.order_status || raw.orderStatus || raw.status).trim();
    const lowerS = s.toLowerCase();
    if (lowerS === "pending" || lowerS === "1") {
      status = "Pending";
      statusCode = 1;
    } else if (lowerS.includes("cancel") || lowerS === "2") {
      status = "Cancelled";
      statusCode = 2;
    } else if (lowerS.includes("process") || lowerS === "3") {
      status = "In Process";
      statusCode = 3;
    } else if (lowerS.includes("way") || lowerS.includes("transit") || lowerS === "4") {
      status = "On The Way";
      statusCode = 4;
    } else if (lowerS.includes("deliver") || lowerS === "5") {
      status = "Delivered";
      statusCode = 5;
    } else if (lowerS.includes("purchase") || lowerS === "6") {
      status = "Purchased";
      statusCode = 6;
    } else {
      status = s;
      statusCode = ORDER_STATUS_LABEL_TO_CODE[s] || 1;
    }
  }

  const currency = raw.currency_code || raw.currency || "MUR";
  const currencySymbol =
    raw.currency_symbol ||
    (currency === "INR" ? "₹" : currency === "AFN" ? "AFN" : "Rs");

  const getMedicineDefaultImage = (name = "") => {
    const n = String(name).toLowerCase();
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

  let items = [];
  if (Array.isArray(raw.items || raw.order_items || raw.products) && (raw.items || raw.order_items || raw.products).length > 0) {
    items = (raw.items || raw.order_items || raw.products).map((item, idx) => {
      const itemImage =
        item.image ||
        item.product_image ||
        item.medicine_image ||
        item.front_image ||
        item.back_image ||
        getMedicineDefaultImage(item.name || item.product_name);

      return {
        id: item.id || `it-${idx + 1}`,
        name: item.name || item.product_name || item.title || "Prescription Medicine",
        category: item.category || "Pharmaceuticals",
        dosage: item.dosage || item.strength || "Standard",
        quantity: Number(item.quantity || item.qty || 1),
        unitPrice: Number(item.price || item.unit_price || 0),
        total: Number(item.total || (item.price || 0) * (item.quantity || 1)),
        image: itemImage,
        front_image: item.front_image || (item.category === "Prescription" ? itemImage : ""),
        back_image: item.back_image || "",
        type: item.type,
      };
    });
  } else if (raw.medicineName && typeof raw.medicineName === "string" && raw.medicineName.trim()) {
    const medNames = raw.medicineName.split(",").map((m) => m.trim()).filter(Boolean);
    const count = medNames.length || 1;
    const estQty = Math.max(1, Math.round(Number(raw.total_item || 1) / count));
    const unitPrice = paidAmount > 0 ? Number((paidAmount / (count * estQty)).toFixed(2)) : 0;

    items = medNames.map((name, idx) => ({
      id: `it-${rawId || index}-${idx + 1}`,
      name,
      category: "Pharmaceuticals",
      dosage: "Standard",
      quantity: estQty,
      unitPrice,
      total: Number((unitPrice * estQty).toFixed(2)),
      image: getMedicineDefaultImage(name),
      front_image: "",
      back_image: "",
    }));
  }

  if (items.length === 0) {
    items = [
      {
        id: `it-${rawId || orderId}`,
        name: raw.product_name || raw.item_name || raw.medicineName || "Prescription Pharmaceuticals",
        category: "Pharmacy",
        dosage: "Standard",
        quantity: Number(raw.total_item || 1),
        unitPrice: paidAmount,
        total: paidAmount,
        image: getMedicineDefaultImage(raw.product_name || raw.item_name || raw.medicineName),
        front_image: "",
        back_image: "",
      },
    ];
  }

  // Prescriptions array
  const prescriptions =
    Array.isArray(raw.prescriptions) && raw.prescriptions.length > 0
      ? raw.prescriptions
      : items
          .filter((it) => it.front_image || it.back_image || it.category === "Prescription")
          .map((it, idx) => ({
            id: it.id || idx + 1,
            name: it.name,
            type: it.type !== undefined ? it.type : 0,
            quantity: it.quantity,
            front_image: it.front_image || it.image,
            back_image: it.back_image || "",
          }));

  // Manual / Written Medicines array from backend (CRM Medicine Order API)
  const rawWritten = Array.isArray(raw.written_medicines)
    ? raw.written_medicines
    : Array.isArray(raw.place_order_written_medicines)
    ? raw.place_order_written_medicines
    : Array.isArray(raw.writtenMedicines)
    ? raw.writtenMedicines
    : Array.isArray(raw.placeOrderWrittenMedicines)
    ? raw.placeOrderWrittenMedicines
    : [];

  const written_medicines = rawWritten.map((w, idx) => ({
    id: w.id || idx + 1,
    name: w.name || w.medicine_name || "",
    quantity: w.quantity || "",
    days: w.days !== undefined && w.days !== null ? String(w.days) : "",
  }));

  // If items didn't already have written medicine items, merge them so they're visible
  const hasWrittenInItems = items.some(
    (it) => it.category === "Written Medicine" || it.isWritten
  );
  if (!hasWrittenInItems && written_medicines.length > 0) {
    const writtenItemObjs = written_medicines.map((w, idx) => ({
      id: `wm-${rawId || index}-${w.id || idx + 1}`,
      name: w.name,
      category: "Written Medicine",
      dosage: w.days ? `${w.days} Days` : "Manual",
      quantity: parseInt(w.quantity) || 1,
      unitPrice: 0,
      total: 0,
      image: getMedicineDefaultImage(w.name),
      isWritten: true,
      days: w.days,
    }));
    if (
      items.length === 1 &&
      (items[0].name === "Prescription Pharmaceuticals" ||
        items[0].name === (raw.product_name || raw.item_name || raw.medicineName)) &&
      !raw.items
    ) {
      items = writtenItemObjs;
    } else {
      items = [...items, ...writtenItemObjs];
    }
  }

  const deliveryType = raw.delivery_type || raw.deliveryType || "";
  const roomNumber = raw.room_number || raw.roomNumber || "";
  let computedDeliveryAddress = raw.address || raw.delivery_address || raw.shipping_address || "";
  if (!computedDeliveryAddress) {
    if (deliveryType) {
      computedDeliveryAddress = roomNumber ? `${deliveryType}, Room ${roomNumber}` : deliveryType;
    } else {
      computedDeliveryAddress = "Mauritius";
    }
  }

  return {
    id: String(rawId || orderId),
    dbId: rawId,
    sNo: index + 1,
    orderId: String(orderId),
    patientName: String(patientName),
    userId,
    patientPhone: raw.phone || raw.patient_phone || raw.mobile || "",
    patientEmail: raw.email || raw.patient_email || "",
    delivery_type: deliveryType,
    deliveryType,
    room_number: roomNumber ? String(roomNumber) : "",
    roomNumber: roomNumber ? String(roomNumber) : "",
    delivery_address: raw.delivery_address || raw.address || "",
    deliveryAddress: computedDeliveryAddress,
    paymentMode: String(paymentMode),
    paidAmount,
    currency,
    currencySymbol,
    orderDate: String(orderDate),
    status,
    statusCode,
    type: statusCode,
    totalItems: Number(raw.total_item || items.length || 1),
    prescriptionItem: Number(raw.prescriptionItem || 0),
    cartItem: Number(raw.cart_item || 0),
    medicineName: raw.medicineName || items.map((i) => i.name).join(", "),
    paymentStatus,
    rawPaymentStatus: raw.payment_status || "",
    transactionId,
    paymentDate,
    cancelReason: raw.cancel_reason || "",
    cancelAt: raw.cancel_at || "",
    notes: raw.notes || raw.order_notes || "",
    items,
    prescriptions,
    written_medicines,
    bills: getOrderBills(orderId),
    billNotes: getOrderBillNote(orderId),
    billPrice: getOrderBillPrice(orderId),
    raw,
  };
};

/**
 * Fetch all orders from backend API (https://omcacrm.com/omca/api/crm/orders_history)
 * POST with { user_id: "" } to get all CRM orders, or specific user_id to filter
 */
export const fetchOrdersHistory = async (payload = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const requestBody = {
    user_id:
      payload.user_id !== undefined && payload.user_id !== null
        ? String(payload.user_id).trim()
        : "",
  };

  try {
    const response = await axios.post(ORDERS_API_URL, requestBody, {
      headers,
      timeout: 12000,
    });

    const data = response.data;

    let list = null;
    if (Array.isArray(data)) {
      list = data;
    } else if (Array.isArray(data?.data)) {
      list = data.data;
    } else if (Array.isArray(data?.orders)) {
      list = data.orders;
    } else if (Array.isArray(data?.history)) {
      list = data.history;
    } else if (
      data?.success === "true" ||
      data?.success === true ||
      data?.message === "No Data Found" ||
      data?.msg === "No Data Found"
    ) {
      list = [];
    }

    // If live API responded with a list (even if 0 items when no orders found):
    if (Array.isArray(list)) {
      const normalized = list.map((item, idx) => normalizeOrder(item, idx));
      if (!requestBody.user_id) {
        saveStoredOrders(normalized);
      }
      return {
        success: true,
        data: normalized,
        fromLiveApi: true,
        count: normalized.length,
      };
    }
  } catch (err) {
    console.warn("orders_history API notice:", err?.response?.data || err.message);
  }

  // Fallback to stored cache if network error, or empty list
  const fallback = getStoredOrders();
  const filteredFallback = requestBody.user_id
    ? fallback.filter((o) => String(o.userId || o.user_id) === String(requestBody.user_id))
    : fallback;
  return {
    success: true,
    data: filteredFallback,
    fromLiveApi: false,
    message: "Loaded orders record successfully",
  };
};

/**
 * Fetch detailed single order via the backend API:
 * POST https://omcacrm.com/omca/api/orders_Details
 * Body: { id: <order database ID> }
 */
export const fetchOrderDetails = async (id) => {
  if (!id && id !== 0) return null;
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const cleanId = String(id).trim();
    const numericId = Number(cleanId);
    const payload = !isNaN(numericId) && cleanId !== "" ? { id: numericId } : { id: cleanId };
    const response = await axios.post(
      ORDER_DETAILS_API_URL,
      payload,
      { headers, timeout: 12000 }
    );

    const data = response?.data;
    if (
      data &&
      (data.success === "true" || data.success === true || data.status === true || data.status === "true") &&
      data.data &&
      typeof data.data === "object" &&
      Object.keys(data.data).length > 0
    ) {
      return {
        success: true,
        data: data.data,
        message: data.message || "Order Details fetched successfully",
      };
    }
    return {
      success: false,
      data: null,
      message: data?.message || "Order details not found",
    };
  } catch (err) {
    console.error("fetchOrderDetails API error:", err);
    return {
      success: false,
      data: null,
      error: err,
      message: err.message,
    };
  }
};

/**
 * Normalize the raw response of https://omcacrm.com/omca/api/orders_Details
 * into standard Order shape for OrderDetail component.
 */
export const normalizeOrderDetails = (data, dbId = "", extraMeta = {}) => {
  if (!data || typeof data !== "object") return null;

  const rawOrderId = data.order || extraMeta.orderId || extraMeta.order || String(dbId || "");
  const cleanDbId = dbId || extraMeta.dbId || extraMeta.id || "";
  const resolvedUserId = String(extraMeta.userId || extraMeta.user_id || data.user_id || "");

  // Delivery & Address parsing
  const deliveryType = data.delivery_type || extraMeta.delivery_type || extraMeta.deliveryType || "";
  const roomNumber = data.room_number || extraMeta.room_number || extraMeta.roomNumber || "";
  const customDeliveryAddress = data.delivery_address || data.address || extraMeta.delivery_address || extraMeta.deliveryAddress || "";

  const addrParts = [
    data.house,
    data.street,
    data.landmark ? `Near ${data.landmark}` : "",
    data.city,
    data.state,
    data.pincode ? String(data.pincode) : "",
    data.counrty || data.country,
  ].filter((p) => p && String(p).trim() !== "");

  let deliveryAddress = "";
  const countryName = data.counrty || data.country || "";
  if (deliveryType) {
    if (roomNumber) {
      deliveryAddress = `${deliveryType}, Room ${roomNumber}${data.city ? `, ${data.city}` : ""}${data.state ? `, ${data.state}` : ""}${countryName ? `, ${countryName}` : ""}`;
    } else if (customDeliveryAddress) {
      deliveryAddress = `${customDeliveryAddress}${data.city && !customDeliveryAddress.includes(data.city) ? `, ${data.city}` : ""}${data.state && !customDeliveryAddress.includes(data.state) ? `, ${data.state}` : ""}${countryName && !customDeliveryAddress.includes(countryName) ? `, ${countryName}` : ""}`;
    } else {
      deliveryAddress = `${deliveryType}${data.city ? `, ${data.city}` : ""}${data.state ? `, ${data.state}` : ""}${countryName ? `, ${countryName}` : ""}`;
    }
  } else if (customDeliveryAddress) {
    deliveryAddress = `${customDeliveryAddress}${data.city && !customDeliveryAddress.includes(data.city) ? `, ${data.city}` : ""}${data.state && !customDeliveryAddress.includes(data.state) ? `, ${data.state}` : ""}${countryName && !customDeliveryAddress.includes(countryName) ? `, ${countryName}` : ""}`;
  } else if (addrParts.length > 0) {
    deliveryAddress = addrParts.join(", ");
  } else {
    deliveryAddress = extraMeta.deliveryAddress || "Mauritius";
  }

  // Phone number
  let patientPhone = extraMeta.patientPhone || "";
  if (data.mobile) {
    patientPhone = data.mobile_code
      ? `+${data.mobile_code} ${data.mobile}`
      : String(data.mobile);
  }

  // Payment mode: 0 -> Cash On Delivery, 1 -> Online Payment
  let paymentMode = "Cash On Delivery";
  const rawDetailsMode = (
    data.payment_mode ||
    data.paymentMode ||
    data.payment_method ||
    data.paymentMethod ||
    extraMeta.paymentMode ||
    extraMeta.payment_mode ||
    ""
  ).toString().trim();

  if (rawDetailsMode) {
    const lowerDMode = rawDetailsMode.toLowerCase();
    if (
      lowerDMode.includes("online") ||
      lowerDMode.includes("card") ||
      lowerDMode.includes("upi") ||
      lowerDMode.includes("gateway")
    ) {
      paymentMode = "Online Payment";
    } else if (lowerDMode.includes("cod") || lowerDMode.includes("cash")) {
      paymentMode = "Cash On Delivery";
    } else {
      paymentMode = rawDetailsMode;
    }
  } else if (String(data.method) === "1" || data.method === 1) {
    paymentMode = "Online Payment";
  } else if (String(data.method) === "0" || data.method === 0) {
    paymentMode = "Cash On Delivery";
  }

  // Transaction ID
  const transactionId = (
    data.transaction_id ||
    data.transactionId ||
    data.txn_id ||
    data.txnId ||
    data.payment_id ||
    data.paymentId ||
    data.razorpay_payment_id ||
    data.stripe_payment_id ||
    data.ref_no ||
    data.reference_id ||
    extraMeta.transactionId ||
    extraMeta.txnId ||
    ""
  ).toString().trim();

  // Payment Date
  const paymentDate = (
    data.payment_date ||
    data.paymentDate ||
    data.paid_date ||
    data.paidDate ||
    data.paid_at ||
    extraMeta.paymentDate ||
    ""
  ).toString().trim();

  // Payment status normalization
  const rawDetailsPayStatus = (
    data.payment_status ??
    data.paymentStatus ??
    data.pay_status ??
    extraMeta.paymentStatus ??
    ""
  ).toString().trim().toLowerCase();

  let detailsPaymentStatus = "Pending";
  if (
    rawDetailsPayStatus === "1" ||
    rawDetailsPayStatus === "paid" ||
    rawDetailsPayStatus === "success" ||
    rawDetailsPayStatus === "completed" ||
    rawDetailsPayStatus === "complete" ||
    rawDetailsPayStatus === "true" ||
    data.is_paid === true ||
    data.is_paid === 1
  ) {
    detailsPaymentStatus = "Paid";
  } else if (
    rawDetailsPayStatus === "failed" ||
    rawDetailsPayStatus === "failure" ||
    rawDetailsPayStatus === "declined" ||
    rawDetailsPayStatus === "2"
  ) {
    detailsPaymentStatus = "Failed";
  } else if (rawDetailsPayStatus === "refunded") {
    detailsPaymentStatus = "Refunded";
  } else if (rawDetailsPayStatus === "0" || rawDetailsPayStatus === "unpaid" || rawDetailsPayStatus === "pending") {
    detailsPaymentStatus = paymentMode === "Cash On Delivery" ? "COD Pending" : "Pending";
  } else {
    const sLower = String(data.status ?? extraMeta.status ?? "").toLowerCase();
    if (sLower.includes("deliver") || String(data.status) === "5") {
      detailsPaymentStatus = "Paid & Completed";
    } else if (paymentMode === "Online Payment" && transactionId) {
      detailsPaymentStatus = "Paid";
    } else if (paymentMode === "Cash On Delivery") {
      detailsPaymentStatus = "COD Pending";
    } else {
      detailsPaymentStatus = "Pending";
    }
  }

  // Amount
  const rawPrice =
    data.price ??
    data.paid_amount ??
    data.total_amount ??
    data.amount ??
    extraMeta.paidAmount ??
    0;
  let paidAmount =
    typeof rawPrice === "number"
      ? rawPrice
      : parseFloat(String(rawPrice).replace(/[^0-9.-]+/g, "")) || 0;

  const billPrice = getOrderBillPrice(rawOrderId);
  if (paidAmount === 0 && billPrice > 0) {
    paidAmount = billPrice;
  }

  // Currency
  const currency = data.currency_code || extraMeta.currency || "INR";
  let currencySymbol = data.currency_symbol;
  if (!currencySymbol || currencySymbol === "?") {
    if (currency === "INR") currencySymbol = "₹";
    else if (currency === "AFN") currencySymbol = "AFN";
    else currencySymbol = "MUR";
  }

  // Date
  let orderDate = "—";
  if (data.date && data.time) {
    orderDate = `${data.date} ${data.time}`;
  } else if (data.date) {
    orderDate = data.date;
  } else if (extraMeta.orderDate) {
    orderDate = extraMeta.orderDate;
  }

  // Status mapping
  const statusCode = Number(data.status ?? extraMeta.statusCode ?? 1);
  const status = ORDER_STATUS_CODE_TO_LABEL[statusCode] || "Pending";

  // Patient Name
  const patientName =
    (
      (extraMeta.patientName && extraMeta.patientName !== "-" && extraMeta.patientName !== "Unknown Patient")
        ? extraMeta.patientName
        : data.user_name ||
          data.userName ||
          data.patient_name ||
          data.patientName ||
          data.customer_name ||
          data.name ||
          (data.mobile ? `Customer (+${data.mobile_code || "91"} ${data.mobile})` : "-")
    ).trim() || "-";

  // Items (from data.Medicine)
  let items = [];
  if (Array.isArray(data.Medicine) && data.Medicine.length > 0) {
    items = data.Medicine.map((med, idx) => {
      const qty = Number(med.medquantiy || 1);
      const unitPrice = parseFloat(med.medicine_price || 0) || 0;
      const total = Number((qty * unitPrice).toFixed(2));
      const medName = med.medicineName || "Prescription Medicine";
      return {
        id: `med-${idx + 1}`,
        name: medName,
        category: "Pharmaceuticals",
        dosage: "Standard",
        quantity: qty,
        unitPrice,
        total: total > 0 ? total : unitPrice,
        image: med.medimage || getMedicineDefaultImage(medName),
        front_image: "",
        back_image: "",
      };
    });
  } else if (extraMeta.items && extraMeta.items.length > 0) {
    items = extraMeta.items;
  }

  // Prescriptions (from data.prescriptions)
  let prescriptions = [];
  if (Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
    prescriptions = data.prescriptions.map((p, idx) => {
      const typeNum = Number(p.type ?? 0);
      const front = p.frontImage || p.front_image || "";
      const back = p.backImage || p.back_image || "";
      return {
        id: `pres-${idx + 1}`,
        name: typeNum === 1 ? `Medicine Photo #${idx + 1}` : `Prescription #${idx + 1}`,
        type: typeNum,
        front_image: front,
        back_image: back,
        frontImage: front,
        backImage: back,
        front_quantity: p.front_quantity || "0",
        back_quantity: p.back_quantity || "0",
        quantity:
          p.front_quantity && p.front_quantity !== "0"
            ? `${p.front_quantity} Qty`
            : p.back_quantity && p.back_quantity !== "0"
            ? `${p.back_quantity} Qty`
            : "",
      };
    });
  } else if (extraMeta.prescriptions && extraMeta.prescriptions.length > 0) {
    prescriptions = extraMeta.prescriptions;
  }

  // Manual / Written Medicines (CRM)
  const rawWrittenDetails =
    Array.isArray(data.written_medicines) && data.written_medicines.length > 0
      ? data.written_medicines
      : Array.isArray(data.place_order_written_medicines) && data.place_order_written_medicines.length > 0
      ? data.place_order_written_medicines
      : Array.isArray(data.writtenMedicines) && data.writtenMedicines.length > 0
      ? data.writtenMedicines
      : Array.isArray(data.placeOrderWrittenMedicines) && data.placeOrderWrittenMedicines.length > 0
      ? data.placeOrderWrittenMedicines
      : Array.isArray(extraMeta.written_medicines) && extraMeta.written_medicines.length > 0
      ? extraMeta.written_medicines
      : Array.isArray(extraMeta.place_order_written_medicines) && extraMeta.place_order_written_medicines.length > 0
      ? extraMeta.place_order_written_medicines
      : Array.isArray(extraMeta.writtenMedicines) && extraMeta.writtenMedicines.length > 0
      ? extraMeta.writtenMedicines
      : Array.isArray(extraMeta.raw?.written_medicines) && extraMeta.raw.written_medicines.length > 0
      ? extraMeta.raw.written_medicines
      : Array.isArray(extraMeta.raw?.place_order_written_medicines) && extraMeta.raw.place_order_written_medicines.length > 0
      ? extraMeta.raw.place_order_written_medicines
      : [];

  const written_medicines = rawWrittenDetails.map((w, idx) => ({
    id: w.id || idx + 1,
    name: w.name || w.medicine_name || w.medicineName || "",
    quantity: String(w.quantity || ""),
    days: w.days !== undefined && w.days !== null ? String(w.days) : "",
    type: Number(w.type ?? 2),
    status: w.status !== undefined ? Number(w.status) : 2,
  }));

  // If data.Medicine is empty but written_medicines has records, populate items with written medicines
  if (items.length === 0 && written_medicines.length > 0) {
    items = written_medicines.map((w, idx) => ({
      id: w.id || `wm-${idx + 1}`,
      name: w.name,
      category: "Written Medicine",
      dosage: w.days ? `${w.days} Days` : "Standard",
      quantity: parseInt(w.quantity) || 1,
      unitPrice: 0,
      total: 0,
      image: getMedicineDefaultImage(w.name),
      isWritten: true,
      days: w.days,
      type: Number(w.type ?? 2),
    }));
  }

  const allMedicineNames = [
    ...items.map((i) => i.name),
    ...written_medicines.map((w) => w.name),
  ].filter(Boolean);

  return {
    id: String(cleanDbId || rawOrderId),
    dbId: cleanDbId || extraMeta.dbId,
    orderId: String(rawOrderId),
    order: String(rawOrderId),
    patientName: String(patientName),
    userId: resolvedUserId,
    patientPhone,
    patientEmail: extraMeta.patientEmail || "—",
    delivery_type: deliveryType,
    deliveryType,
    room_number: roomNumber ? String(roomNumber) : "",
    roomNumber: roomNumber ? String(roomNumber) : "",
    delivery_address: customDeliveryAddress,
    address: customDeliveryAddress || data.address || "",
    deliveryAddress,
    house: data.house || "",
    street: data.street || "",
    landmark: data.landmark || "",
    city: data.city || "",
    state: data.state || "",
    pincode: data.pincode ? String(data.pincode) : "",
    country: data.counrty || data.country || "India",
    timezone: data.timezone || "Asia/Kolkata",
    mobile: data.mobile ? String(data.mobile) : "",
    mobileCode: data.mobile_code ? String(data.mobile_code) : "91",
    paymentMode,
    paymentStatus: detailsPaymentStatus,
    payment_status: detailsPaymentStatus,
    transactionId,
    paymentDate,
    paidAmount,
    price: data.price !== undefined ? String(data.price) : "0.00",
    currency,
    currencySymbol: data.currency_symbol || (currency === "INR" ? "₹" : "MUR"),
    date: data.date || "",
    time: data.time || "",
    orderDate,
    status,
    statusCode,
    type: statusCode,
    totalItems: Number(data.item || items.length || written_medicines.length || 1),
    prescriptionItem: Number(extraMeta.prescriptionItem || (prescriptions.length > 0 ? 1 : 0)),
    cartItem: Number(extraMeta.cartItem || (items.length > 0 ? 1 : 0)),
    medicineName:
      allMedicineNames.length > 0
        ? Array.from(new Set(allMedicineNames)).join(", ")
        : data.medicineName || data.medicine_name || "",
    payment_status_raw: data.payment_status || "pending",
    cancelReason: extraMeta.cancelReason || "",
    cancelAt: extraMeta.cancelAt || "",
    notes: data.landmark ? `Landmark: ${data.landmark}` : (extraMeta.notes || "None"),
    items,
    prescriptions,
    written_medicines,
    Medicine: data.Medicine || [],
    bills: getOrderBills(rawOrderId) || extraMeta.bills || [],
    billNotes: getOrderBillNote(rawOrderId) || extraMeta.billNotes || "",
    billPrice: getOrderBillPrice(rawOrderId) || extraMeta.billPrice || "",
    isLiveApi: true,
    raw: { ...extraMeta.raw, ...data },
  };
};

/**
 * Fetch single order by Order ID, DB id, or User ID.
 * Priority:
 * 1. Specific DB id via POST https://omcacrm.com/omca/api/orders_Details { id }
 * 2. Order ID via POST https://omcacrm.com/omca/api/orders_Details { id }
 * 3. Resolve DB id from orders_history and fetch via orders_Details
 * 4. Fallback to cached order data
 */
export const fetchOrderById = async (orderId, userId = "", specificId = "") => {
  if (!orderId && !specificId) return null;

  const cleanOrderId = orderId ? String(orderId).trim() : "";
  const cleanUserId = userId ? String(userId).trim() : "";
  const cleanSpecificId = specificId ? String(specificId).trim() : "";

  // 1. If explicit DB id is available, query orders_Details directly
  if (cleanSpecificId) {
    try {
      const res = await fetchOrderDetails(cleanSpecificId);
      if (res?.success && res.data) {
        const cached = getStoredOrders().find(
          (o) =>
            String(o.id) === cleanSpecificId ||
            String(o.dbId) === cleanSpecificId ||
            String(o.orderId) === cleanOrderId
        );
        return normalizeOrderDetails(res.data, cleanSpecificId, {
          ...(cached || {}),
          userId: cleanUserId || cached?.userId,
          orderId: cleanOrderId || res.data.order,
        });
      }
    } catch (e) {
      console.warn("Direct fetchOrderDetails with specificId error:", e);
    }
  }

  // 2. Try calling fetchOrderDetails with cleanOrderId directly (if cleanOrderId is the DB primary key)
  if (cleanOrderId) {
    try {
      const directRes = await fetchOrderDetails(cleanOrderId);
      if (directRes?.success && directRes.data) {
        const cached = getStoredOrders().find(
          (o) =>
            String(o.id) === cleanOrderId ||
            String(o.dbId) === cleanOrderId ||
            String(o.orderId) === cleanOrderId
        );
        return normalizeOrderDetails(directRes.data, cleanOrderId, {
          ...(cached || {}),
          userId: cleanUserId || cached?.userId,
          orderId: directRes.data.order || cleanOrderId,
        });
      }
    } catch (e) {
      // Continue to history lookup
    }
  }

  // 3. cleanOrderId is the public Order ID (e.g. 701375113071).
  // Look up corresponding DB record in orders_history to get its primary key id
  try {
    let matchedHistoryOrder = null;

    if (cleanUserId) {
      const userHistory = await fetchOrdersHistory({ user_id: cleanUserId });
      matchedHistoryOrder = (userHistory?.data || []).find(
        (o) =>
          String(o.orderId) === cleanOrderId ||
          String(o.id) === cleanOrderId ||
          String(o.dbId) === cleanOrderId
      );
    }

    if (!matchedHistoryOrder) {
      const allHistory = await fetchOrdersHistory({ user_id: "" });
      matchedHistoryOrder = (allHistory?.data || []).find(
        (o) =>
          String(o.orderId) === cleanOrderId ||
          String(o.id) === cleanOrderId ||
          String(o.dbId) === cleanOrderId
      );
    }

    if (matchedHistoryOrder) {
      const resolvedDbId = matchedHistoryOrder.dbId || matchedHistoryOrder.id;
      if (resolvedDbId && String(resolvedDbId) !== cleanOrderId) {
        const detailsRes = await fetchOrderDetails(resolvedDbId);
        if (detailsRes?.success && detailsRes.data) {
          return normalizeOrderDetails(detailsRes.data, resolvedDbId, {
            ...matchedHistoryOrder,
            userId: cleanUserId || matchedHistoryOrder.userId,
            orderId: cleanOrderId,
          });
        }
      }
      return matchedHistoryOrder;
    }
  } catch (err) {
    console.error("fetchOrderById live API resolution error:", err);
  }

  // 4. Fallback to cached orders if network failure
  const cachedOrders = getStoredOrders();
  return (
    cachedOrders.find(
      (o) =>
        String(o.orderId) === cleanOrderId ||
        String(o.id) === cleanOrderId ||
        String(o.dbId) === cleanOrderId
    ) || null
  );
};

/**
 * Update order status via backend API:
 * API: https://omcacrm.com/omca/api/crm/update_place_order_status
 * POST: id, status
 * Status Mapping: 1 -> Pending, 2 -> Cancelled, 3 -> In Process, 4 -> On The Way, 5 -> Delivered
 */
export const updateOrderStatus = async (target, newStatus, cancelReason = "") => {
  const orders = getStoredOrders();
  const targetKey =
    typeof target === "object" && target !== null
      ? String(target.dbId || target.id || target.orderId)
      : String(target);

  const orderIndex = orders.findIndex(
    (o) =>
      String(o.id) === targetKey ||
      String(o.dbId) === targetKey ||
      String(o.orderId) === targetKey
  );

  const orderObj =
    orderIndex !== -1 ? orders[orderIndex] : typeof target === "object" ? target : null;

  // Map to status code (1, 2, 3, 4, 5) and label
  let statusCode = 1;
  let statusLabel = "Pending";

  if (typeof newStatus === "number" || (!isNaN(Number(newStatus)) && String(newStatus).trim() !== "")) {
    statusCode = Number(newStatus);
    statusLabel = ORDER_STATUS_CODE_TO_LABEL[statusCode] || "Pending";
  } else {
    statusLabel = String(newStatus).trim();
    statusCode = ORDER_STATUS_LABEL_TO_CODE[statusLabel] || 1;
  }

  const dbId = orderObj?.raw?.id || orderObj?.dbId || orderObj?.id || targetKey;

  let apiSuccess = false;
  let apiMessage = "";

  // Call API: https://omcacrm.com/omca/api/crm/update_place_order_status
  // POST: id, status, cancel_reason (mandatory when status is 2 / Cancelled)
  try {
    const token = localStorage.getItem("token");
    const postPayload = {
      id: Number(dbId) || dbId,
      status: statusCode,
    };

    if (statusCode === 2 || cancelReason) {
      postPayload.cancel_reason = String(cancelReason || "").trim();
    }

    const response = await axios.post(
      UPDATE_STATUS_API_URL,
      postPayload,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 10000,
      }
    );

    const data = response.data;
    if (data?.success === "true" || data?.success === true) {
      apiSuccess = true;
      apiMessage = data?.message || "Order status updated successfully";
    } else {
      const errText = data?.message || "Backend rejected status update";
      throw new Error(errText);
    }
  } catch (e) {
    const apiMessage =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      "Failed to update order status";
    console.error("update_place_order_status error:", apiMessage);
    throw new Error(apiMessage);
  }

  const updatedOrder = {
    ...(orderObj || {}),
    status: statusLabel,
    statusCode,
    type: statusCode,
    cancelReason: cancelReason || orderObj?.cancelReason || "",
  };

  if (orderIndex !== -1) {
    orders[orderIndex] = updatedOrder;
    saveStoredOrders(orders);
  }

  return {
    success: true,
    apiSuccess,
    apiMessage,
    data: updatedOrder,
  };
};



/**
 * Export orders list to Excel-compatible CSV file
 */
export const exportOrdersToCSV = (orders = []) => {
  if (!orders || orders.length === 0) return;

  const headers = [
    "S.No.",
    "Order ID",
    "Patient Name",
    "Payment Mode",
    "Order On",
    "Order Status",
  ];

  const rows = orders.map((o, idx) => [
    idx + 1,
    `"${o.orderId || ""}"`,
    `"${(o.patientName || "").replace(/"/g, '""')}"`,
    `"${(o.paymentMode || "").replace(/"/g, '""')}"`,
    `"${o.orderDate || ""}"`,
    `"${o.status || ""}"`,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `OMCA_Orders_Report_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Fetch medicines catalog from backend API (get_medicine_list)
 */
export const fetchMedicineList = async (userId = "675") => {
  try {
    const response = await axios.post(
      GET_MEDICINE_LIST_URL,
      { user_id: String(userId) },
      { timeout: 8000 }
    );
    const data = response.data;
    if (data && (data.success === "true" || data.success === true)) {
      return { success: true, data: data.data || [] };
    }
    return { success: false, data: [], message: data?.message || "Failed to load medicines" };
  } catch (err) {
    console.warn("fetchMedicineList error:", err.message);
    return { success: false, data: [], message: err.message };
  }
};

/**
 * Upload prescriptions or medicines with front/back photos (upload_prescription)
 * Expects FormData with prescriptions[i][front_image], prescriptions[i][back_image],
 * prescriptions[i][quantity], prescriptions[i][type], user_id
 */
export const uploadPrescriptionApi = async (formData) => {
  try {
    const response = await axios.post(UPLOAD_PRESCRIPTION_URL, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 15000,
    });
    const data = response.data;
    if (data && (data.success === "true" || data.success === true)) {
      return { success: true, message: data.message || "Prescriptions uploaded successfully!" };
    }
    return {
      success: false,
      message: data?.message || "Failed to upload prescription",
    };
  } catch (err) {
    console.error("uploadPrescriptionApi error:", err?.response?.data || err.message);
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err.message ||
      "Prescription upload failed.";
    return { success: false, message: msg };
  }
};

/**
 * Fetch items currently in the user's cart (cart_list)
 */
export const fetchCartList = async (userId = "675") => {
  const finalUserId = String(userId || "").trim();
  if (!finalUserId) {
    return { success: true, data: [] };
  }
  try {
    const response = await axios.post(
      CART_LIST_URL,
      { user_id: finalUserId },
      { timeout: 8000 }
    );
    const data = response.data;
    if (data && (data.success === "true" || data.success === true)) {
      return { success: true, data: Array.isArray(data.data) ? data.data : [] };
    }
    return { success: true, data: [], message: data?.message || "No items in cart" };
  } catch (err) {
    // If backend returns 400 with "user id is not in our record", treat as empty cart gracefully
    if (err?.response?.data?.message && String(err.response.data.message).toLowerCase().includes("user id")) {
      return { success: true, data: [], message: "No items in cart" };
    }
    console.warn("fetchCartList notice:", err.message);
    return { success: true, data: [], message: err.message };
  }
};

/**
 * Fetch keyed-in medicine items currently in the user's cart (cartlist API)
 * Endpoint: https://omcacrm.com/omca/api/cartlist
 */
export const fetchMedicineCartList = async (userId = "675") => {
  const finalUserId = String(userId || "").trim();
  if (!finalUserId) {
    return { success: true, data: [], totalAmount: 0 };
  }
  try {
    const response = await axios.post(
      MEDICINE_CART_LIST_URL,
      { user_id: finalUserId },
      { timeout: 8000 }
    );
    const data = response.data;
    if (data && (data.success === "true" || data.success === true)) {
      const list = Array.isArray(data.cartList) ? data.cartList : [];
      return {
        success: true,
        data: list,
        amount: data.amount || "0",
        convertedAmount: data.converted_amount || data.amount || "0",
        totalAmount: parseFloat(data.converted_amount || data.amount || 0),
        message: data.message || "",
      };
    }
    return { success: true, data: [], message: data?.message || "Cart is empty" };
  } catch (err) {
    if (
      err?.response?.data?.message &&
      (String(err.response.data.message).toLowerCase().includes("user id") ||
        String(err.response.data.message).toLowerCase().includes("record") ||
        String(err.response.data.message).toLowerCase().includes("empty"))
    ) {
      return { success: true, data: [], totalAmount: 0, message: "Cart is empty" };
    }
    console.warn("fetchMedicineCartList notice:", err.message);
    return { success: true, data: [], totalAmount: 0, message: err.message };
  }
};

/**
 * Delete a prescription item from cart (cart_delete)
 */
export const deleteCartPrescription = async (userId, cartId) => {
  try {
    const response = await axios.post(
      CART_DELETE_URL,
      { user_id: String(userId), cart_id: cartId, id: cartId },
      { timeout: 6000 }
    );
    return {
      success: response.data?.success === "true" || response.data?.success === true,
      message: response.data?.message || "Removed from cart",
    };
  } catch (err) {
    console.warn("deleteCartPrescription error:", err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Delete a keyed-in medicine item or empty entire cart (cart_item_delete)
 * If medicineId is not passed, empties the entire cart for the user
 */
export const deleteCartItem = async (userId, medicineId) => {
  try {
    const payload = { user_id: String(userId) };
    if (medicineId !== undefined && medicineId !== null && medicineId !== "") {
      payload.medicine_id = medicineId;
    }
    const response = await axios.post(
      CART_ITEM_DELETE_URL,
      payload,
      { timeout: 8000 }
    );
    return {
      success: response.data?.success === "true" || response.data?.success === true,
      message: response.data?.message || "Cart updated",
    };
  } catch (err) {
    console.warn("deleteCartItem error:", err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Option A: Dedicated Endpoint (Recommended for "Save & Add to Order" button)
 * Primary Route: POST /api/save_written_medicine in routes/api.php
 * Alias Route: POST /api/write_medicine in routes/api.php
 * Option B Fallback: POST /api/upload_prescription with { type: 2 } without requiring images
 *
 * Payload:
 * {
 *   "user_id": 675,
 *   "medicines": [
 *     { "name": "Paracetamol 500mg", "quantity": "10 tab", "days": "5" },
 *     { "name": "Augmentin 625mg", "quantity": "6 tab", "days": "3" }
 *   ]
 * }
 */
export const saveWrittenMedicineApi = async (payload) => {
  const userId = payload.user_id !== undefined ? payload.user_id : payload.user;
  const medicinesList = Array.isArray(payload.medicines)
    ? payload.medicines
    : Array.isArray(payload.written_medicines)
    ? payload.written_medicines
    : payload.name
    ? [{ name: payload.name, quantity: payload.quantity || "1", days: payload.days || "" }]
    : [];

  const postBody = {
    user_id: Number(userId) || userId,
    medicines: medicinesList.map((m) => ({
      name: String(m.name || "").trim(),
      quantity: String(m.quantity || "1").trim(),
      days: m.days !== undefined && m.days !== null ? String(m.days).trim() : "",
    })),
    written_medicines: medicinesList.map((m) => ({
      name: String(m.name || "").trim(),
      quantity: String(m.quantity || "1").trim(),
      days: m.days !== undefined && m.days !== null ? String(m.days).trim() : "",
    })),
  };

  // Support single medicine root-level fields if only 1 item provided
  if (medicinesList.length === 1) {
    postBody.name = String(medicinesList[0].name || "").trim();
    postBody.quantity = String(medicinesList[0].quantity || "1").trim();
    postBody.days = medicinesList[0].days !== undefined ? String(medicinesList[0].days).trim() : "";
  }

  // 1. Try Primary Option A: POST /api/save_written_medicine
  try {
    const response = await axios.post(SAVE_WRITTEN_MEDICINE_URL, postBody, { timeout: 10000 });
    const data = response.data;
    if (data && (data.success === "true" || data.success === true || response.status === 200)) {
      return {
        success: true,
        message: data.message || "Medicines added to order successfully!",
        count: data.count || (Array.isArray(data.data) ? data.data.length : medicinesList.length),
        data: data.data || [],
      };
    }
  } catch (err1) {
    console.warn("save_written_medicine notice:", err1?.response?.data || err1.message);

    // 2. Try Alias Option A: POST /api/write_medicine
    try {
      const response = await axios.post(WRITE_MEDICINE_ALIAS_URL, postBody, { timeout: 10000 });
      const data = response.data;
      if (data && (data.success === "true" || data.success === true || response.status === 200)) {
        return {
          success: true,
          message: data.message || "Medicines added to order successfully!",
          count: data.count || (Array.isArray(data.data) ? data.data.length : medicinesList.length),
          data: data.data || [],
        };
      }
    } catch (err2) {
      console.warn("write_medicine alias notice:", err2?.response?.data || err2.message);

      // 3. Option B Fallback: POST /api/upload_prescription with type = 2 without requiring image uploads
      try {
        const optionBPayload = {
          user_id: Number(userId) || userId,
          prescriptions: medicinesList.map((m) => ({
            type: 2,
            name: String(m.name || "").trim(),
            quantity: String(m.quantity || "1").trim(),
            days: m.days !== undefined && m.days !== null ? String(m.days).trim() : "",
          })),
        };
        const response = await axios.post(UPLOAD_PRESCRIPTION_URL, optionBPayload, {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        });
        const data = response.data;
        if (data && (data.success === "true" || data.success === true || response.status === 200)) {
          return {
            success: true,
            message: data.message || "Medicines added to order successfully!",
            count: data.count || (Array.isArray(data.data) ? data.data.length : medicinesList.length),
            data: data.data || [],
          };
        }
      } catch (err3) {
        console.error("Option B upload_prescription fallback error:", err3?.response?.data || err3.message);
        const errMsg =
          err3?.response?.data?.message ||
          err2?.response?.data?.message ||
          err1?.response?.data?.message ||
          "Failed to save written medicines.";
        return { success: false, message: errMsg };
      }
    }
  }

  return { success: false, message: "Failed to save written medicines." };
};

/**
 * Option B: Via Existing upload_prescription Endpoint
 * Route: POST /api/upload_prescription in Api.php
 * Supports type: 2 without requiring image uploads
 */
export const uploadPrescriptionOptionBApi = async (userId, medicinesList = []) => {
  try {
    const payload = {
      user_id: Number(userId) || userId,
      prescriptions: medicinesList.map((m) => ({
        type: 2,
        name: String(m.name || "").trim(),
        quantity: String(m.quantity || "1").trim(),
        days: m.days !== undefined && m.days !== null ? String(m.days).trim() : "",
      })),
    };
    const response = await axios.post(UPLOAD_PRESCRIPTION_URL, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
    const data = response.data;
    if (data && (data.success === "true" || data.success === true)) {
      return {
        success: true,
        message: data.message || "Prescriptions uploaded successfully!",
        data: data.data || [],
      };
    }
    return { success: false, message: data?.message || "Failed to upload prescription" };
  } catch (err) {
    console.error("uploadPrescriptionOptionBApi error:", err?.response?.data || err.message);
    return { success: false, message: err?.response?.data?.message || err.message };
  }
};

/**
 * Fetch total cart count (POST /api/cart_count)
 * Written medicines saved with status = 1 are automatically included in cartCount
 */
export const fetchCartCount = async (userId) => {
  const finalUserId = String(userId || "").trim();
  if (!finalUserId) return { success: true, cartCount: 0 };
  try {
    const response = await axios.post(
      CART_COUNT_URL,
      { user_id: finalUserId },
      { timeout: 8000 }
    );
    const data = response.data;
    const count =
      data?.cartCount ??
      data?.count ??
      data?.data?.cartCount ??
      data?.data?.count ??
      0;
    return {
      success: true,
      cartCount: Number(count),
      data,
    };
  } catch (err) {
    console.warn("fetchCartCount notice:", err?.response?.data || err.message);
    return { success: false, cartCount: 0, error: err.message };
  }
};

/**
 * Remove a written medicine item from cart (POST /api/cart_delete)
 * Alias to deleteCartPrescription since both live in user_prescriptions cart
 */
export const deleteCartWrittenMedicine = async (userId, cartId) => {
  return deleteCartPrescription(userId, cartId);
};

/**
 * Toggle add / remove medicine item from cart (cartValue)
 * Parameters: user_id, medicine_id
 */
export const toggleCartValueApi = async (userId, medicineId) => {
  try {
    const response = await axios.post(
      CART_VALUE_URL,
      {
        user_id: String(userId),
        medicine_id: Number(medicineId) || medicineId,
      },
      { timeout: 8000 }
    );
    const data = response.data;
    return {
      success: data?.success === "true" || data?.success === true,
      message: data?.message || "Cart updated",
      cartCount: data?.cartCount,
      data,
    };
  } catch (err) {
    console.warn("toggleCartValueApi error:", err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Change medicine quantity in cart (change_quantity)
 */
export const changeMedicineQuantity = async (userId, medicineId, quantity) => {
  try {
    const response = await axios.post(
      CHANGE_QUANTITY_URL,
      { user_id: String(userId), medicine_id: medicineId, quantity: Number(quantity) },
      { timeout: 6000 }
    );
    return {
      success: response.data?.success === "true" || response.data?.success === true,
      data: response.data?.Data,
      message: response.data?.message,
    };
  } catch (err) {
    console.warn("changeMedicineQuantity error:", err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Fetch addresses saved by the user (get_address)
 */
export const fetchUserAddresses = async (userId = "675") => {
  const finalUserId = String(userId || "").trim();
  if (!finalUserId) {
    return { success: true, data: [] };
  }
  try {
    const response = await axios.post(
      GET_ADDRESS_URL,
      { user_id: finalUserId },
      { timeout: 8000 }
    );
    const data = response.data;
    if (data && (data.success === "true" || data.success === true)) {
      return { success: true, data: Array.isArray(data.data) ? data.data : [] };
    }
    return { success: true, data: [] };
  } catch (err) {
    console.warn("fetchUserAddresses notice:", err.message);
    return { success: true, data: [] };
  }
};

/**
 * Save new delivery address for user (save_address)
 */
export const saveUserAddress = async (payload) => {
  try {
    const response = await axios.post(
      SAVE_ADDRESS_URL,
      {
        user_id: String(payload.user_id),
        country: payload.country || "Mauritius",
        state: payload.state || "Plaines Wilhems",
        city: payload.city || "Curepipe",
        pincode: payload.pincode || "74204",
        house_name: payload.house_name || payload.house || "House 1",
        street: payload.street || "Main Road",
        landmark: payload.landmark || "",
        mobile: payload.mobile || "57891234",
        mobile_code: payload.mobile_code || "230",
      },
      { timeout: 8000 }
    );
    const data = response.data;
    if (data && (data.success === "true" || data.success === true)) {
      return { success: true, data: data.data, message: data.message };
    }
    return { success: false, message: data?.message || "Could not save address" };
  } catch (err) {
    console.warn("saveUserAddress error:", err.message);
    return {
      success: false,
      message: err?.response?.data?.message || err.message,
    };
  }
};

/**
 * Submit final order to backend (place_order)
 * param: { user, cart, quantity, price, prescription, address, method }
 */
export const placeOrderApi = async (payload) => {
  try {
    const postData = {
      user_id: payload.user_id !== undefined ? payload.user_id : (payload.user ?? 0),
      user: payload.user !== undefined ? payload.user : (payload.user_id ?? 0),
      cart: payload.cart !== undefined ? String(payload.cart) : "",
      quantity: payload.quantity !== undefined ? payload.quantity : 0,
      price: payload.price !== undefined ? payload.price : 0,
      method: payload.method !== undefined ? String(payload.method) : "0",
      ...(payload.delivery_type !== undefined ? { delivery_type: payload.delivery_type } : {}),
      ...(payload.room_number !== undefined && payload.room_number !== null && String(payload.room_number).trim() !== ""
        ? { room_number: String(payload.room_number).trim() }
        : {}),
      ...(payload.delivery_address !== undefined && payload.delivery_address !== null
        ? { delivery_address: payload.delivery_address }
        : {}),
      ...(payload.address !== undefined && payload.address !== null
        ? { address: payload.address }
        : {}),
      ...(payload.prescription ? { prescription: String(payload.prescription) } : {}),
      ...(Array.isArray(payload.written_medicines) && payload.written_medicines.length > 0
        ? {
            written_medicines: payload.written_medicines.map((m) => ({
              ...(m.id && !String(m.id).startsWith("wm-") ? { id: m.id } : {}),
              name: m.name,
              quantity: String(m.quantity || ""),
              days: String(m.days || ""),
            })),
          }
        : {}),
      ...(Array.isArray(payload.medicines) && payload.medicines.length > 0
        ? { medicines: payload.medicines }
        : {}),
    };

    const response = await axios.post(PLACE_ORDER_URL, postData, { timeout: 10000 });
    const data = response.data;
    if (
      data &&
      (data.success === "true" ||
        data.success === true ||
        data.success === 1 ||
        data.status === 200 ||
        data.status === "200" ||
        data.status === true ||
        (response.status === 200 &&
          (data.data || data.order || data.order_id || data.id || data.message)))
    ) {
      return { success: true, message: data.message || "Order Placed Successfully", data: data.data || data };
    }
    return { success: false, message: data?.message || "Order placement failed", data };
  } catch (err) {
    console.error("placeOrderApi error:", err?.response?.data || err.message);
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err.message ||
      "Failed to place order.";
    return { success: false, message: msg };
  }
};

/**
 * Create a new Medicine Order via CRM Medicine Order API:
 * Primary: POST https://omcacrm.com/omca/api/crm/medicine-order/create
 * Aliases: POST https://omcacrm.com/omca/api/crm/medicine-order/save
 *          POST https://omcacrm.com/omca/api/crm/orders/create
 *
 * Payload Parameters:
 * - user_id (integer/string, Required)
 * - written_medicines (array, Optional*): [ { name, quantity, days } ]
 * - medicines (array, Optional*): [ { medicine_id, quantity } ]
 *   (* Note: Kam se kam ek type ki medicine honi chahiye)
 * - address_id (integer, Optional)
 * - price (numeric/string, Optional)
 * - notes (string, Optional)
 * - cash_method (string, Optional, Default: "Cash On Delivery")
 * - payment_status (string, Optional, Default: "pending")
 * - invoices[] (file/files, Optional)
 */
export const createCrmMedicineOrderApi = async (payload = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const hasInvoices = Array.isArray(payload.invoices) && payload.invoices.length > 0;
  let body;

  if (hasInvoices) {
    body = new FormData();
    body.append("user_id", payload.user_id !== undefined ? String(payload.user_id) : "");
    body.append("user", payload.user !== undefined ? String(payload.user) : (payload.user_id !== undefined ? String(payload.user_id) : ""));
    body.append("cart", payload.cart !== undefined ? String(payload.cart) : "");
    body.append("quantity", String(payload.quantity !== undefined ? payload.quantity : 1));
    body.append("method", payload.method !== undefined ? String(payload.method) : "0");
    if (payload.delivery_type) body.append("delivery_type", String(payload.delivery_type));
    if (payload.room_number) body.append("room_number", String(payload.room_number));
    if (payload.delivery_address) body.append("delivery_address", String(payload.delivery_address));
    if (payload.address) body.append("address", String(payload.address));
    if (payload.address_id) body.append("address_id", String(payload.address_id));
    if (payload.price !== undefined && payload.price !== null && payload.price !== "") {
      body.append("price", String(payload.price));
    }
    if (payload.notes) body.append("notes", String(payload.notes));
    body.append("cash_method", payload.cash_method || "Cash On Delivery");
    body.append("payment_status", payload.payment_status || "pending");

    if (Array.isArray(payload.written_medicines)) {
      payload.written_medicines.forEach((m, idx) => {
        if (m && m.name) {
          if (m.id && !String(m.id).startsWith("wm-")) {
            body.append(`written_medicines[${idx}][id]`, String(m.id));
          }
          body.append(`written_medicines[${idx}][name]`, String(m.name).trim());
          body.append(`written_medicines[${idx}][quantity]`, String(m.quantity || "").trim());
          body.append(`written_medicines[${idx}][days]`, String(m.days || "").trim());
        }
      });
    }

    if (Array.isArray(payload.medicines)) {
      payload.medicines.forEach((m, idx) => {
        if (m) {
          body.append(`medicines[${idx}][medicine_id]`, String(m.medicine_id || m.id || ""));
          body.append(`medicines[${idx}][quantity]`, String(m.quantity || 1));
        }
      });
    }

    payload.invoices.forEach((file) => {
      body.append("invoices[]", file);
    });
    headers["Content-Type"] = "multipart/form-data";
  } else {
    headers["Content-Type"] = "application/json";
    body = {
      user_id: payload.user_id !== undefined && !isNaN(Number(payload.user_id))
        ? Number(payload.user_id)
        : payload.user_id,
      user: payload.user !== undefined && !isNaN(Number(payload.user))
        ? Number(payload.user)
        : (payload.user_id !== undefined && !isNaN(Number(payload.user_id)) ? Number(payload.user_id) : payload.user_id),
      cart: payload.cart !== undefined ? String(payload.cart) : "",
      quantity: payload.quantity !== undefined ? payload.quantity : 1,
      method: payload.method !== undefined ? String(payload.method) : "0",
      cash_method: payload.cash_method || "Cash On Delivery",
      payment_status: payload.payment_status || "pending",
      price: payload.price !== undefined ? payload.price : 0,
      ...(payload.delivery_type ? { delivery_type: payload.delivery_type } : {}),
      ...(payload.room_number ? { room_number: String(payload.room_number) } : {}),
      ...(payload.delivery_address ? { delivery_address: payload.delivery_address } : {}),
      ...(payload.address ? { address: payload.address } : {}),
    };

    if (payload.address_id) {
      body.address_id = !isNaN(Number(payload.address_id))
        ? Number(payload.address_id)
        : payload.address_id;
    }
    if (payload.price !== undefined && payload.price !== null && payload.price !== "") {
      body.price = String(payload.price);
    }
    if (payload.notes) {
      body.notes = String(payload.notes);
    }
    if (Array.isArray(payload.written_medicines) && payload.written_medicines.length > 0) {
      body.written_medicines = payload.written_medicines
        .filter((m) => m && String(m.name || "").trim())
        .map((m) => ({
          ...(m.id && !String(m.id).startsWith("wm-") ? { id: m.id } : {}),
          name: String(m.name || "").trim(),
          quantity: String(m.quantity || "").trim(),
          days: String(m.days || "").trim(),
        }));
    }
    if (Array.isArray(payload.medicines) && payload.medicines.length > 0) {
      body.medicines = payload.medicines
        .filter((m) => m && (m.medicine_id || m.id))
        .map((m) => ({
          medicine_id: Number(m.medicine_id || m.id),
          quantity: Number(m.quantity || 1),
        }));
    }
  }

  // Attempt Primary URL, fallback to Alias if 404
  const endpoints = [
    CREATE_MEDICINE_ORDER_URL,
    CREATE_MEDICINE_ORDER_ALT_URL,
    `${AdminBaseUrl}orders/create`,
  ];

  let lastError = null;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, body, { headers, timeout: 15000 });
      const data = response?.data;
      if (
        data &&
        (data.success === "true" ||
          data.success === true ||
          data.status === 201 ||
          data.status === 200 ||
          response.status === 201)
      ) {
        return {
          success: true,
          status: data.status || response.status || 201,
          message: data.message || "Medicine order created successfully.",
          data: data.data || data,
        };
      }
      return {
        success: false,
        status: data?.status || response.status,
        message: data?.message || "Failed to create medicine order.",
        data,
      };
    } catch (err) {
      lastError = err;
      if (err?.response?.status === 404) {
        // Try next alias URL
        continue;
      }
      console.error(`createCrmMedicineOrderApi error on ${url}:`, err?.response?.data || err.message);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to create medicine order.";
      return {
        success: false,
        status: err?.response?.status || 500,
        message: errMsg,
        errors: err?.response?.data?.errors,
      };
    }
  }

  return {
    success: false,
    status: lastError?.response?.status || 500,
    message: lastError?.response?.data?.message || lastError?.message || "Failed to create medicine order.",
  };
};

/**
 * Prepend a freshly created order to local stored orders cache
 */
export const addNewOrder = (newOrder) => {
  const currentOrders = getStoredOrders();
  const updatedOrders = [newOrder, ...currentOrders];
  saveStoredOrders(updatedOrders);
  return updatedOrders;
};

export const DEFAULT_PATIENTS_LIST = [
  {
    id: "1720",
    userId: "1720",
    patientId: "OMCA26070666",
    patientNumber: "OMCA26070666",
    name: "PT. Test Rahul",
    phone: "7905481884",
    email: "Nigamayu11sept@gmail.com",
    defaultAddress: "Noida Sector 59",
  },
  {
    id: "675",
    userId: "675",
    name: "Tawfick Mohammad Dilloo",
    phone: "+230 5789 1234",
    email: "tawfick.dilloo@example.com",
    defaultAddress: "Route Royale, Curepipe, Mauritius",
  },
  {
    id: "1047",
    userId: "1047",
    name: "PT. Test Rahul",
    phone: "+230 5987 6543",
    email: "rahul.test@example.com",
    defaultAddress: "Avenue des Tulipes, Quatre Bornes, Mauritius",
  },
  {
    id: "1863",
    userId: "1863",
    name: "Marie Sophie Martin",
    phone: "+230 5432 1098",
    email: "marie.martin@example.mu",
    defaultAddress: "Coastal Road, Grand Baie, Mauritius",
  },
  {
    id: "1799",
    userId: "1799",
    name: "Jean-Pierre Duval",
    phone: "+230 5234 5678",
    email: "jp.duval@example.mu",
    defaultAddress: "La Chaussée Street, Port Louis, Mauritius",
  },
  {
    id: "1002",
    userId: "1002",
    name: "Kavita Ramgoolam",
    phone: "+230 5876 5432",
    email: "kavita.r@example.mu",
    defaultAddress: "Royal Road, Flic en Flac, Mauritius",
  },
  {
    id: "64",
    userId: "64",
    name: "John Patient",
    phone: "+230 5712 9845",
    email: "john.patient@example.com",
    defaultAddress: "Curepipe, Mauritius",
  },
  {
    id: "1066",
    userId: "1066",
    name: "Ahmed Al-Mansoor",
    phone: "+230 5899 4321",
    email: "ahmed.m@example.com",
    defaultAddress: "Port Louis, Mauritius",
  },
  {
    id: "883",
    userId: "883",
    name: "Vikram Malhotra",
    phone: "+230 5900 1122",
    email: "vikram.m@example.mu",
    defaultAddress: "Grand Baie, Mauritius",
  },
  {
    id: "41",
    userId: "41",
    name: "Dr. Sarah Johnson",
    phone: "+230 5711 2233",
    email: "sarah.j@example.com",
    defaultAddress: "Ebene Cybercity, Mauritius",
  },
  {
    id: "12",
    userId: "12",
    name: "Michael Brown",
    phone: "+230 5811 3344",
    email: "michael.b@example.com",
    defaultAddress: "Tamarin, Mauritius",
  },
  {
    id: "25",
    userId: "25",
    name: "Priya Sharma",
    phone: "+230 5911 4455",
    email: "priya.s@example.mu",
    defaultAddress: "Flic en Flac, Mauritius",
  },
];

/**
 * Fetch all dynamic patients across CRM database and Pharmacy app orders
 */
const getOrderPatientFullPhone = (info) => {
  if (!info) return "";
  const code = String(info.phoneCode || info.dial_code || "").trim();
  const phone = String(
    info.emergency_contact_no ||
      info.emergency_contact ||
      info.patient_emergency_contact_no ||
      info.phone ||
      info.mobile ||
      info.mobileNumber ||
      ""
  ).trim();
  if (code && phone) {
    if (phone.startsWith(code)) return phone;
    return `${code} ${phone}`;
  }
  return phone;
};

const extractPatientRows = (data) =>
  data?.details ||
  data?.data?.details ||
  data?.patients ||
  data?.data?.patients ||
  (Array.isArray(data?.data) ? data.data : null) ||
  (Array.isArray(data) ? data : null) ||
  [];

const mapCrmPatientForOrder = (p) => {
  const uniqueKey = String(p._id || p.id || p.patientNumber || p.patientId || p.user_id || "").trim();
  if (!uniqueKey) return null;
  const userId = String(p.user_id || p.id || p._id || "").trim();
  const patientNumber = String(p.patientNumber || p.patientId || "").trim();
  const name = String(p.patient_name || p.name || "").trim();
  return {
    id: uniqueKey,
    userId: userId || uniqueKey,
    patientId: patientNumber || uniqueKey,
    patientNumber: patientNumber || uniqueKey,
    name: name || `Patient #${patientNumber || uniqueKey}`,
    phone: getOrderPatientFullPhone(p),
    email: p.email || p.patient_email || "",
    country: p.country || "Mauritius",
    treatingIn: p.treatingIn || "",
    defaultAddress: p.address || p.town || p.treatingIn || p.country || "Mauritius",
    source: "CRM Patient",
    raw: p,
  };
};

let pharmacyCustomersCache = null;

const loadPharmacyCustomers = async () => {
  if (pharmacyCustomersCache) return pharmacyCustomersCache;
  try {
    const ordersRes = await axios.post(ORDERS_API_URL, { user_id: "" }, { timeout: 8000 });
    const rawOrders = ordersRes.data?.data || [];
    const byUser = new Map();
    rawOrders.forEach((o) => {
      const uid = String(o.user_id || "").trim();
      if (!uid || byUser.has(uid)) return;
      byUser.set(uid, {
        id: uid,
        userId: uid,
        patientId: `OMCA-${uid}`,
        patientNumber: `OMCA-${uid}`,
        name: o.patient_name || o.user_name || `Customer #${uid}`,
        phone: o.phone || o.mobile || "",
        email: o.email || "",
        country: "Mauritius",
        treatingIn: "",
        defaultAddress: o.address || "Mauritius",
        source: "Pharmacy Customer",
        raw: o,
      });
    });
    pharmacyCustomersCache = Array.from(byUser.values());
  } catch (err) {
    console.warn("loadPharmacyCustomers orders_history notice:", err?.message);
    pharmacyCustomersCache = [];
  }
  return pharmacyCustomersCache;
};

export const searchOrderPatients = async (query, { limit = 10 } = {}) => {
  const q = String(query || "").trim();
  if (!q) return [];
  const token = localStorage.getItem("token");
  const results = new Map();

  try {
    if (token) {
      const res = await axios.get(`${baseurl}all_patients`, {
        params: { page: 1, limit, search: q },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      extractPatientRows(res.data).forEach((p) => {
        const item = mapCrmPatientForOrder(p);
        if (item) results.set(String(item.userId), item);
      });
    }
  } catch (err) {
    console.warn("searchOrderPatients all_patients notice:", err?.message);
  }

  const term = q.toLowerCase();
  const digits = term.replace(/[^0-9]/g, "");
  const customers = await loadPharmacyCustomers();
  customers.forEach((c) => {
    const existing = results.get(String(c.userId));
    if (existing) {
      existing.source = "CRM & Pharmacy";
      return;
    }
    const matches =
      String(c.name).toLowerCase().includes(term) ||
      String(c.userId).toLowerCase().includes(term) ||
      String(c.patientNumber).toLowerCase().includes(term) ||
      (digits && String(c.phone).replace(/[^0-9]/g, "").includes(digits));
    if (matches && results.size < limit * 2) results.set(String(c.userId), c);
  });

  return Array.from(results.values());
};

export const fetchDynamicPatientsList = async () => {
  const patientMap = new Map();

  const getPatientFullPhone = (info) => {
    if (!info) return "";
    const code = String(info.phoneCode || info.dial_code || "").trim();
    const phone = String(
      info.emergency_contact_no ||
        info.emergency_contact ||
        info.patient_emergency_contact_no ||
        info.phone ||
        info.mobile ||
        info.mobileNumber ||
        ""
    ).trim();
    if (code && phone) {
      if (phone.startsWith(code)) return phone;
      return `${code} ${phone}`;
    }
    return phone;
  };

  // 1. Fetch CRM Patients from all_patients API with multi-page handling to load all 1500+ patients
  try {
    const token = localStorage.getItem("token");
    if (token) {
      const headers = { Authorization: `Bearer ${token}` };

      // Request page 1 with high limit (up to 3000)
      const firstRes = await axios.get(
        `${baseurl}all_patients?page=1&limit=3000&search=`,
        {
          headers,
          timeout: 20000,
        }
      );
      const firstData = firstRes.data;
      const allPatientsList = [
        ...(firstData?.details ||
          firstData?.data?.details ||
          firstData?.patients ||
          firstData?.data?.patients ||
          (Array.isArray(firstData?.data) ? firstData.data : []) ||
          (Array.isArray(firstData) ? firstData : []) ||
          []),
      ];

      const totalPages = Number(firstData?.pagination?.totalPages || 1);
      const totalRecords = Number(firstData?.pagination?.totalRecords || 0);

      // If backend capped limit (e.g. at 500 or 25) and there are more pages:
      if (totalPages > 1 && (totalRecords === 0 || allPatientsList.length < totalRecords)) {
        const pagePromises = [];
        for (let p = 2; p <= totalPages; p++) {
          pagePromises.push(
            axios
              .get(`${baseurl}all_patients?page=${p}&limit=500&search=`, {
                headers,
                timeout: 15000,
              })
              .then((res) => {
                const pData = res.data;
                return (
                  pData?.details ||
                  pData?.data?.details ||
                  pData?.patients ||
                  pData?.data?.patients ||
                  (Array.isArray(pData?.data) ? pData.data : []) ||
                  []
                );
              })
              .catch((err) => {
                console.warn(`all_patients page ${p} fetch notice:`, err.message);
                return [];
              })
          );
        }
        const remainingPages = await Promise.all(pagePromises);
        remainingPages.forEach((pList) => allPatientsList.push(...pList));
      }

      allPatientsList.forEach((p) => {
        // Unique key for map: MongoDB _id, id, patientNumber, or patientId
        const uniqueKey = String(p._id || p.id || p.patientNumber || p.patientId || p.user_id || "").trim();
        const userId = String(p.user_id || p.id || p._id || "").trim();
        const patientNumber = String(p.patientNumber || p.patientId || "").trim();
        const name = String(p.patient_name || p.name || "").trim();

        if (uniqueKey) {
          patientMap.set(uniqueKey, {
            id: uniqueKey,
            userId: userId || uniqueKey,
            patientId: patientNumber || uniqueKey,
            patientNumber: patientNumber || uniqueKey,
            name: name || `Patient #${patientNumber || uniqueKey}`,
            phone: getPatientFullPhone(p),
            email: p.email || p.patient_email || "",
            country: p.country || "Mauritius",
            treatingIn: p.treatingIn || "",
            defaultAddress: p.address || p.town || p.treatingIn || p.country || "Mauritius",
            source: "CRM Patient",
            raw: p,
          });
        }
      });
    }
  } catch (err) {
    console.warn("fetchDynamicPatientsList all_patients notice:", err?.message);
  }

  // 2. Fetch customers from orders_history (pharmacy app orders)
  try {
    const ordersRes = await axios.post(
      ORDERS_API_URL,
      { user_id: "" },
      { timeout: 8000 }
    );
    const rawOrders = ordersRes.data?.data || [];
    const knownNames = {
      "675": "Tawfick Mohammad Dilloo",
      "1047": "PT. Test Rahul",
      "1720": "PT. Test Rahul",
      "1863": "Marie Sophie Martin",
      "1799": "Jean-Pierre Duval",
      "1002": "Kavita Ramgoolam",
      "64": "John Patient",
      "1066": "Ahmed Al-Mansoor",
      "883": "Vikram Malhotra",
      "41": "Dr. Sarah Johnson",
      "12": "Michael Brown",
      "25": "Priya Sharma",
      "1067": "Pharmacy Customer 1067",
    };

    rawOrders.forEach((o) => {
      const uid = String(o.user_id || "").trim();
      if (uid) {
        let existingKey = null;
        for (const [k, v] of patientMap.entries()) {
          if (String(v.userId) === uid || String(v.id) === uid) {
            existingKey = k;
            break;
          }
        }

        const existing = existingKey ? patientMap.get(existingKey) : null;
        const name =
          existing?.name ||
          o.patient_name ||
          o.user_name ||
          `Customer #${uid}`;

        const item = {
          id: existing?.id || uid,
          userId: uid,
          patientId: existing?.patientId || `OMCA-${uid}`,
          patientNumber: existing?.patientNumber || `OMCA-${uid}`,
          name,
          phone: existing?.phone || o.phone || o.mobile || "+230 5789 1234",
          email: existing?.email || o.email || `user${uid}@omcacrm.com`,
          country: existing?.country || "Mauritius",
          treatingIn: existing?.treatingIn || "",
          defaultAddress: existing?.defaultAddress || o.address || "Mauritius",
          source: existing ? "CRM & Pharmacy" : "Pharmacy Customer",
          raw: existing?.raw || o,
        };

        if (existingKey) {
          patientMap.set(existingKey, item);
        } else {
          patientMap.set(uid, item);
        }
      }
    });
  } catch (err) {
    console.warn("fetchDynamicPatientsList orders_history notice:", err?.message);
  }

  return Array.from(patientMap.values());
};
