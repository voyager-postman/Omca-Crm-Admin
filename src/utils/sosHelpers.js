export const SOS_STATUS_OPTIONS = [
  "New",
  "Accepted",
  "In Progress",
  "Dispatched",
  "Closed",
];

export const formatSosDisplayValue = (value) => {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return "—";
  }
  return String(value);
};

export const formatEmergencyContacts = (contacts) => {
  if (!contacts || contacts === "N/A") return "—";
  if (typeof contacts === "string") return contacts;
  if (Array.isArray(contacts)) {
    return contacts
      .map(
        (c) =>
          `${c.name || "Contact"}${c.relation ? ` (${c.relation})` : ""}: ${c.phone_code || ""}${c.phone || ""}`,
      )
      .join(" | ");
  }
  return "—";
};

export const normalizeSosItem = (item) => {
  const gps = item.gpsLiveLocation || item.gps_live_location || {};
  const latitude = gps.latitude ?? item.latitude ?? item.lat ?? "";
  const longitude = gps.longitude ?? item.longitude ?? item.lng ?? "";
  const mapsUrl =
    gps.mapsUrl ||
    gps.maps_url ||
    (latitude && longitude
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : "");

  return {
    id: item.sosId || item.id || item.sos_id || "",
    sosId: item.sosId || item.id || item.sos_id || "",
    emergencyCaseId:
      item.emergencyCaseId ||
      item.emergency_case_id ||
      item.emergencyCase ||
      "",
    user_id: item.user_id || "",
    patientId: item.patientId || item.patient_id || "",
    name: item.patientName || item.name || item.patient_name || "",
    phone: item.mobileNumber || item.phone || item.mobile || "",
    mobileNumber: item.mobileNumber || item.phone || "",
    sosType: item.sosType || item.sos_type || "",
    blood_group: item.bloodGroup || item.blood_group || "",
    latitude,
    longitude,
    mapsUrl,
    batteryPercentage: item.batteryPercentage ?? item.battery_percentage,
    medical_history:
      item.medicalConditions ||
      item.medical_history ||
      item.medicalHistory ||
      "",
    emergency_contacts:
      item.emergencyContacts || item.emergency_contacts || item.contacts || "",
    preferredHospital: item.preferredHospital || item.preferred_hospital || "",
    insurance: item.insurance || "",
    status: item.status || item.sos_status || "New",
    date: item.currentTime || item.created_at || item.createdAt || "",
    acceptedAt: item.acceptedAt || item.accepted_at || null,
    closedAt: item.closedAt || item.closed_at || null,
    isUnread: item.isUnread === true,
    raw: item,
  };
};

export const normalizeSosData = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(normalizeSosItem);
};

export const getSosPatientPhone = (info) => {
  return String(info.phone || info.mobileNumber || "").replace(/\s/g, "");
};

export const getSosItemKey = (item) => item?.sosId || item?.id || "";
