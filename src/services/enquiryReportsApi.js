import axios from "axios";
import { AdminBaseUrl, baseurl } from "../Basurl/Baseurl";

const authHeaders = (multipart = false) => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    ...(multipart ? {} : { "Content-Type": "application/json" }),
  };
};

export const pickEnquiryDocuments = (data) => {
  if (!data || typeof data !== "object") return [];
  const candidates = [
    data.documents,
    data.medical_reports,
    data.medicalReports,
    data.medical_documents,
    data.reports,
  ];
  for (const value of candidates) {
    if (Array.isArray(value) && value.length > 0) {
      return value.filter(Boolean);
    }
  }
  return [];
};

export const getDocumentPath = (file) => {
  if (!file) return "";
  if (typeof file === "string") return file;
  return file.path || file.url || file.filename || file.name || "";
};

const getBasename = (path) => {
  const raw = String(path || "").split("?")[0];
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return decoded.split("/").filter(Boolean).pop() || "";
};

const cleanUploadedFileName = (name) => {
  if (!name) return "";
  return String(name).replace(/_\d{8,}(?=\.[^.]+$)/, "").trim();
};

/** Human-readable uploaded file name (not "View 1"). */
export const getDocumentDisplayName = (file, fallbackIndex) => {
  const fallback =
    fallbackIndex === undefined || fallbackIndex === null
      ? "Document"
      : `Report ${fallbackIndex + 1}`;
  if (!file) return fallback;
  if (file instanceof File && file.name) {
    return file.name;
  }
  if (typeof file === "object") {
    const named =
      file.originalname ||
      file.originalName ||
      file.original_name ||
      file.documentName ||
      file.document_name ||
      file.fileName ||
      file.filename ||
      file.name ||
      "";
    if (named) {
      const base = getBasename(named) || named;
      return cleanUploadedFileName(base) || fallback;
    }
  }
  const fromPath = cleanUploadedFileName(getBasename(getDocumentPath(file)));
  return fromPath || fallback;
};

export const fetchEnquiryReports = async (enquiryId) => {
  if (!enquiryId) return [];
  const response = await axios.get(
    `${baseurl}get_Enq/${encodeURIComponent(enquiryId)}`,
    { headers: authHeaders() },
  );
  const detail = response.data?.detail || response.data?.data || response.data;
  return pickEnquiryDocuments(detail);
};

const appendFiles = (formData, files) => {
  files.forEach((file) => {
    if (file instanceof File) {
      formData.append("documents", file);
    }
  });
};

/**
 * Upload medical reports for an enquiry.
 * Tries dedicated upload APIs first, then update_enq fallback.
 */
export const uploadEnquiryReports = async ({
  enquiryId,
  recordId,
  model = "enquiry",
  files = [],
  existingDocuments = [],
}) => {
  if (!files.length) {
    throw new Error("Please select at least one report");
  }
  const id = enquiryId || recordId;
  if (!id) {
    throw new Error("Enquiry ID is required");
  }

  const tokenHeaders = authHeaders(true);

  const dedicated = new FormData();
  appendFiles(dedicated, files);
  dedicated.append("enquiryId", id);
  dedicated.append("model", model);
  if (recordId) dedicated.append("id", recordId);

  const attempts = [
    () =>
      axios.post(
        `${baseurl}upload_enquiry_documents/${encodeURIComponent(id)}`,
        dedicated,
        { headers: tokenHeaders },
      ),
    () =>
      axios.post(`${AdminBaseUrl}requests/upload-documents`, dedicated, {
        headers: tokenHeaders,
      }),
  ];

  for (const run of attempts) {
    try {
      const response = await run();
      if (response.data?.success === false) continue;
      return response.data;
    } catch (err) {
      const status = err?.response?.status;
      if (status && status !== 404 && status !== 405) throw err;
    }
  }

  const fallback = new FormData();
  fallback.append(
    "existing_documents",
    JSON.stringify((existingDocuments || []).map(getDocumentPath).filter(Boolean)),
  );
  appendFiles(fallback, files);
  const response = await axios.put(
    `${baseurl}update_enq/${encodeURIComponent(id)}`,
    fallback,
    { headers: tokenHeaders },
  );
  if (response.data?.success === false) {
    throw new Error(response.data?.message || "Failed to upload reports");
  }
  return response.data;
};
