export const formatSingleTime12Hour = (timeStr) => {
  if (!timeStr) return "";
  const trimmed = String(timeStr).trim();
  if (/AM|PM/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
  const [hours, minutes] = trimmed.split(":");
  if (hours !== undefined && minutes !== undefined) {
    const h = parseInt(hours, 10);
    if (!isNaN(h)) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      const cleanM = minutes.slice(0, 2);
      return `${h12}:${cleanM} ${ampm}`;
    }
  }
  return trimmed;
};

export const formatTime12Hour = (timeStr) => {
  if (!timeStr) return "";
  const str = String(timeStr).trim();
  if (/\s*(?:to|-)\s*/i.test(str)) {
    const isTo = /\s+to\s+/i.test(str);
    const separator = isTo ? " to " : " - ";
    const parts = str.split(/\s*(?:to|-)\s*/i);
    if (parts.length === 2) {
      return `${formatSingleTime12Hour(parts[0])}${separator}${formatSingleTime12Hour(parts[1])}`;
    }
  }
  return formatSingleTime12Hour(str);
};

export const formatTimeRange = (fromTime, toTime) => {
  if (fromTime && toTime) {
    return `${formatSingleTime12Hour(fromTime)} to ${formatSingleTime12Hour(toTime)}`;
  }
  if (fromTime) return formatSingleTime12Hour(fromTime);
  if (toTime) return formatSingleTime12Hour(toTime);
  return "";
};

export const getDateInputValue = (dateStr) => {
  if (!dateStr) return "";
  const str = String(dateStr).trim();
  if (str.includes("T")) return str.split("T")[0];
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return "";
};

export const getTimeInputValue = (dateStr, timeStr) => {
  if (timeStr) {
    const str = String(timeStr).trim();
    let firstPart = str;
    if (/\s*(?:to|-)\s*/i.test(str)) {
      firstPart = str.split(/\s*(?:to|-)\s*/i)[0].trim();
    }
    if (/^\d{2}:\d{2}$/.test(firstPart)) return firstPart;
    if (/^\d{1}:\d{2}$/.test(firstPart)) return `0${firstPart}`;
    const match = firstPart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const ampm = match[3] ? match[3].toUpperCase() : null;
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${m}`;
    }
    return firstPart.slice(0, 5);
  }
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB");
};

export const formatPaidAmount = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "-";
  return `${amount}MUR`;
};

export const formatDisplayDateTime = (dateStr, timeStr) => {
  const datePart = formatDisplayDate(dateStr);
  if (timeStr) {
    return `${datePart} at ${formatTime12Hour(timeStr)}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const timePart = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart} ${timePart}`;
  }
  return datePart;
};

export const APPOINTMENT_TIME_OPTIONS = [
  "07:00 AM", "07:30 AM",
  "08:00 AM", "08:15 AM", "08:30 AM", "08:45 AM",
  "09:00 AM", "09:15 AM", "09:30 AM", "09:45 AM",
  "10:00 AM", "10:15 AM", "10:30 AM", "10:45 AM",
  "11:00 AM", "11:15 AM", "11:30 AM", "11:45 AM",
  "12:00 PM", "12:15 PM", "12:30 PM", "12:45 PM",
  "01:00 PM", "01:15 PM", "01:30 PM", "01:45 PM",
  "02:00 PM", "02:15 PM", "02:30 PM", "02:45 PM",
  "03:00 PM", "03:15 PM", "03:30 PM", "03:45 PM",
  "04:00 PM", "04:15 PM", "04:30 PM", "04:45 PM",
  "05:00 PM", "05:15 PM", "05:30 PM", "05:45 PM",
  "06:00 PM", "06:15 PM", "06:30 PM", "06:45 PM",
  "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM", "09:00 PM"
];

export const APPOINTMENT_TIME_PRESETS = [
  { label: "09:00 - 10:00 AM", from: "09:00 AM", to: "10:00 AM" },
  { label: "10:00 - 11:00 AM", from: "10:00 AM", to: "11:00 AM" },
  { label: "11:00 - 12:00 PM", from: "11:00 AM", to: "12:00 PM" },
  { label: "12:00 - 01:00 PM", from: "12:00 PM", to: "01:00 PM" },
  { label: "02:00 - 03:00 PM", from: "02:00 PM", to: "03:00 PM" },
  { label: "03:00 - 04:00 PM", from: "03:00 PM", to: "04:00 PM" },
  { label: "04:00 - 05:00 PM", from: "04:00 PM", to: "05:00 PM" },
  { label: "05:00 - 06:00 PM", from: "05:00 PM", to: "06:00 PM" },
];

export const parseAptOn = (aptOnStr) => {
  if (!aptOnStr) return { date: "", time: "" };
  const str = String(aptOnStr).trim();
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(.*))?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    const timePart = dmyMatch[4] || "";
    return {
      date: `${year}-${month}-${day}`,
      time: timePart.trim(),
    };
  }
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(.*))?$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    const timePart = ymdMatch[4] || "";
    return {
      date: `${year}-${month}-${day}`,
      time: timePart.trim(),
    };
  }
  return { date: "", time: str };
};

export const parseAppointmentTimeRange = (timeStr) => {
  if (!timeStr) return { from: "", to: "" };
  const str = String(timeStr).trim();
  if (/\s*(?:to|-)\s*/i.test(str)) {
    const parts = str.split(/\s*(?:to|-)\s*/i);
    return {
      from: formatSingleTime12Hour(parts[0]) || "",
      to: formatSingleTime12Hour(parts[1]) || "",
    };
  }
  const single = formatSingleTime12Hour(str);
  return { from: single || "", to: "" };
};

