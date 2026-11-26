export const getActivityLogId = (log) =>
  log?._id ?? log?.id ?? log?.activityId ?? "";

export const getActivityLogUser = (log) =>
  log?.performedBy ??
  log?.userName ??
  log?.user_name ??
  log?.user?.name ??
  log?.name ??
  log?.createdBy ??
  "-";

export const getActivityLogAction = (log) =>
  log?.action ?? log?.activity ?? log?.activityType ?? log?.type ?? "-";

export const getActivityLogModule = (log) =>
  log?.module ?? log?.section ?? log?.entity ?? log?.entityType ?? "-";

export const getActivityLogDescription = (log) =>
  log?.description ?? log?.details ?? log?.message ?? log?.remark ?? "-";

export const getActivityLogDate = (log) =>
  log?.performedAt ??
  log?.performed_at ??
  log?.createdAt ??
  log?.created_at ??
  log?.dateTime ??
  log?.date_time ??
  log?.timestamp ??
  log?.updatedAt ??
  log?.updated_at ??
  log?.date ??
  null;

export const getActivityLogIp = (log) =>
  log?.ipAddress ?? log?.ip_address ?? log?.ip ?? "-";

export const getActivityLogLatitude = (log) =>
  log?.latitude ?? log?.lat ?? log?.location?.latitude ?? log?.location?.lat ?? null;

export const getActivityLogLongitude = (log) =>
  log?.longitude ??
  log?.lng ??
  log?.lon ??
  log?.location?.longitude ??
  log?.location?.lng ??
  log?.location?.lon ??
  null;

export const getActivityLogLocation = (log) => {
  if (log?.location && typeof log.location === "string" && log.location.trim()) {
    return log.location.trim();
  }
  const lat = getActivityLogLatitude(log);
  const lng = getActivityLogLongitude(log);
  if (lat != null && lng != null && lat !== "" && lng !== "") {
    return `${lat}, ${lng}`;
  }
  return "-";
};

export const getActivityLogMapUrl = (log) => {
  if (!log) return null;

  const lat = getActivityLogLatitude(log);
  const lng = getActivityLogLongitude(log);

  if (lat != null && lng != null && lat !== "" && lng !== "") {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isNaN(latNum) && !Number.isNaN(lngNum) && (latNum !== 0 || lngNum !== 0)) {
      return `https://www.google.com/maps?q=${latNum},${lngNum}`;
    }
  }

  const rawLoc =
    (typeof log?.location === "string" ? log.location : null) ||
    (typeof log?.location_name === "string" ? log.location_name : null) ||
    (typeof log?.address === "string" ? log.address : null) ||
    (typeof log?.city === "string" ? log.city : null);

  if (rawLoc && typeof rawLoc === "string" && rawLoc.trim()) {
    const trimmed = rawLoc.trim();
    if (
      trimmed !== "-" &&
      trimmed !== "—" &&
      trimmed.toLowerCase() !== "null" &&
      trimmed.toLowerCase() !== "undefined"
    ) {
      const match = trimmed.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (match) {
        return `https://www.google.com/maps?q=${match[1]},${match[2]}`;
      }
      return `https://www.google.com/maps?q=${encodeURIComponent(trimmed)}`;
    }
  }

  return null;
};

/** Hide CRM / alerts noise from the Activity Log list and exports. */
export const isCrmAlertActivityLog = (log) => {
  const module = String(getActivityLogModule(log) || "").toLowerCase();
  const description = String(getActivityLogDescription(log) || "").toLowerCase();
  const action = String(getActivityLogAction(log) || "").toLowerCase();

  return (
    module.includes("crm alert") ||
    module.includes("crm_alert") ||
    module === "alerts" ||
    description.includes("crm alerts") ||
    description.includes("crm alert") ||
    action.includes("crm alert")
  );
};

export const filterOutCrmAlertLogs = (logs = []) =>
  (Array.isArray(logs) ? logs : []).filter((log) => !isCrmAlertActivityLog(log));

export const filterActivityLogsByUserName = (logs = [], userName = "") => {
  const query = String(userName || "").trim().toLowerCase();
  if (!query) return Array.isArray(logs) ? logs : [];
  return (Array.isArray(logs) ? logs : []).filter((log) =>
    String(getActivityLogUser(log) || "")
      .toLowerCase()
      .includes(query),
  );
};

export const getActivityLogRole = (log) =>
  log?.userRole ?? log?.role ?? log?.user_role ?? "-";

export const getActivityLogEmail = (log) =>
  log?.userEmail ?? log?.email ?? log?.user_email ?? "-";

export const getActivityLogStatus = (log) =>
  log?.status ?? "-";

export const getActivityLogEntityId = (log) =>
  log?.entityId ?? log?.entity_id ?? log?.patientId ?? "";

export const getActivityLogEntityName = (log) =>
  log?.entityName ?? log?.entity_name ?? "";

export const formatActivityLogDate = (value) => {
  if (!value) return "-";
  if (typeof value === "object" && value?.formattedDate) {
    return value.formattedDate;
  }
  const str = String(value).trim();
  // Check if already in human-readable format like "06 Oct 2026, 04:15 PM"
  if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4},\s+\d{1,2}:\d{2}\s+(?:AM|PM)$/i.test(str)) {
    return str;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return str;
  return `${date.toLocaleDateString("en-GB")} ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
};

const escapeCsvCell = (value) => {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const escapeHtmlCell = (value) => {
  const text = value == null ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const getActivityLogExportRow = (log, index) => [
  index + 1,
  getActivityLogUser(log),
  getActivityLogRole(log),
  getActivityLogEmail(log),
  getActivityLogAction(log),
  getActivityLogModule(log),
  getActivityLogDescription(log),
  getActivityLogStatus(log),
  log?.formattedDate || formatActivityLogDate(getActivityLogDate(log)),
  getActivityLogIp(log),
  getActivityLogLocation(log),
];

export const buildActivityLogsCsv = (logs = [], delimiter = ",") => {
  const headers = [
    "Sr.No.",
    "User",
    "Role",
    "Email",
    "Action",
    "Module",
    "Description",
    "Status",
    "Date/Time",
    "IP Address",
    "Location (Lat/Long)",
  ];
  const lines = [headers.map(escapeCsvCell).join(delimiter)];

  logs.forEach((log, index) => {
    lines.push(
      getActivityLogExportRow(log, index)
        .map(escapeCsvCell)
        .join(delimiter),
    );
  });

  return lines.join("\r\n");
};

export const buildActivityLogsExcelHtml = (logs = []) => {
  const headers = [
    "Sr.No.",
    "User",
    "Role",
    "Email",
    "Action",
    "Module",
    "Description",
    "Status",
    "Date/Time",
    "IP Address",
    "Location (Lat/Long)",
  ];
  const headerRow = headers
    .map((header) => `<th>${escapeHtmlCell(header)}</th>`)
    .join("");

  const bodyRows = logs
    .map((log, index) => {
      const cells = getActivityLogExportRow(log, index)
        .map((value) => `<td>${escapeHtmlCell(value)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Activity Logs</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table border="1">
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
};

export const buildPatientActivityLogsExcelHtml = (logs = [], patientId = "") => {
  const headers = [
    "Sr.No.",
    "User",
    "Role",
    "Module",
    "Description",
    "Date/Time",
  ];
  const headerRow = headers
    .map(
      (header) =>
        `<th style="background-color:#0ba6df;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #ddd;">${escapeHtmlCell(
          header,
        )}</th>`,
    )
    .join("");

  const bodyRows = logs
    .map((log, index) => {
      const user = log?.performedBy || getActivityLogUser(log) || "-";
      const role = log?.userRole || "-";
      const module = log?.module || getActivityLogModule(log) || "-";
      const description =
        log?.description || getActivityLogDescription(log) || "-";
      const dateTime =
        log?.dateTime || formatActivityLogDate(getActivityLogDate(log)) || "-";

      const cells = [index + 1, user, role, module, description, dateTime]
        .map(
          (value) =>
            `<td style="padding:6px;border:1px solid #ddd;">${escapeHtmlCell(
              value,
            )}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const infoTitle = patientId
    ? `Activity Logs for Patient: ${escapeHtmlCell(patientId)}`
    : "Patient Activity Logs";

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Patient Activity Logs</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<h3 style="color:#0ba6df;font-family:sans-serif;">${infoTitle}</h3>
<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
};

export const buildEnquiryActivityLogsExcelHtml = (
  logs = [],
  enquiryId = "",
  enquiryName = "",
) => {
  const headers = [
    "Sr.No.",
    "User",
    "Role",
    "Email",
    "Action",
    "Module",
    "Description",
    "Status",
    "Date/Time",
    "IP Address",
  ];
  const headerRow = headers
    .map(
      (header) =>
        `<th style="background-color:#0ba6df;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #ddd;">${escapeHtmlCell(
          header,
        )}</th>`,
    )
    .join("");

  const bodyRows = logs
    .map((log, index) => {
      const user =
        log?.userName ||
        log?.performedBy ||
        getActivityLogUser(log) ||
        "-";
      const role =
        log?.userRole ||
        getActivityLogRole(log) ||
        "-";
      const email =
        log?.userEmail ||
        getActivityLogEmail(log) ||
        "-";
      const action =
        log?.action ||
        getActivityLogAction(log) ||
        "-";
      const module =
        log?.module ||
        getActivityLogModule(log) ||
        "-";
      const description =
        log?.description ||
        getActivityLogDescription(log) ||
        "-";
      const status =
        log?.status ||
        getActivityLogStatus(log) ||
        "-";
      const dateTime =
        log?.dateTime ||
        log?.formattedDate ||
        formatActivityLogDate(log?.performedAt || getActivityLogDate(log)) ||
        "-";
      const ip =
        log?.ipAddress ||
        log?.ip_address ||
        getActivityLogIp(log) ||
        "-";

      const cells = [
        index + 1,
        user,
        role,
        email,
        action,
        module,
        description,
        status,
        dateTime,
        ip,
      ]
        .map(
          (value) =>
            `<td style="padding:6px;border:1px solid #ddd;">${escapeHtmlCell(
              value,
            )}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const titleText = enquiryId
    ? `Activity Logs for Enquiry: ${escapeHtmlCell(enquiryId)}${
        enquiryName ? ` (${escapeHtmlCell(enquiryName)})` : ""
      }`
    : "Enquiry Activity Logs";

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Enquiry Activity Logs</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<h3 style="color:#0ba6df;font-family:sans-serif;">${titleText}</h3>
<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
};

export const downloadActivityLogsFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const extractActivityLogs = (responseData) => {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.details)) return responseData.details;
  if (Array.isArray(responseData?.logs)) return responseData.logs;
  if (Array.isArray(responseData?.data?.logs)) return responseData.data.logs;
  if (Array.isArray(responseData?.data?.details)) return responseData.data.details;
  return [];
};

export const extractActivityLogPagination = (responseData, limit = 10) => {
  const pagination =
    responseData?.pagination ??
    responseData?.data?.pagination ??
    responseData?.meta ??
    responseData?.data?.meta ??
    {};

  const totalRecords =
    pagination.totalRecords ??
    pagination.total ??
    pagination.totalCount ??
    responseData?.totalRecords ??
    responseData?.total ??
    0;

  const currentPage =
    pagination.currentPage ?? pagination.page ?? responseData?.page ?? 1;

  const totalPages =
    pagination.totalPages ??
    (totalRecords > 0 ? Math.ceil(totalRecords / limit) : 0);

  return {
    totalRecords,
    currentPage,
    totalPages: Math.max(totalPages, totalRecords > 0 ? 1 : 0),
    perPage: pagination.perPage ?? pagination.limit ?? limit,
  };
};

export const extractActivityLogDetail = (responseData) => {
  if (!responseData || typeof responseData !== "object") return null;
  if (responseData.data && typeof responseData.data === "object") {
    return responseData.data;
  }
  if (responseData.detail && typeof responseData.detail === "object") {
    return responseData.detail;
  }
  return responseData;
};
