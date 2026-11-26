import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

/**
 * Standard Auth & JSON Headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

/**
 * Extract patient identifier expected by backend:
 * prefers patientNumber / patientId / _id / id
 */
export const extractPatientNotificationId = (patient) => {
  if (!patient) return "";
  if (typeof patient === "string") return patient.trim();
  return (
    patient.patientNumber ||
    patient.patientId ||
    patient._id ||
    patient.id ||
    ""
  );
};

/**
 * Check if notifications are currently enabled for a patient
 */
export const isPatientNotificationEnabled = (patient) => {
  if (!patient) return false;
  const val = patient.notificationEnabled;
  return Boolean(val === true || val === 1 || val === "true" || val === "1");
};

/**
 * Update / toggle patient notification enabled status
 * POST /update_patient_notification/:patientId (or /user/update_patient_notification/:patientId)
 *
 * @param {Object|string} patient - patient object or ID string
 * @param {boolean|null} nextState - optional explicit boolean state (or null to toggle)
 */
export const updatePatientNotification = async (patient, nextState = null) => {
  const patientId = extractPatientNotificationId(patient);
  if (!patientId) {
    throw new Error("Patient ID is required to update notification settings");
  }

  const headers = getAuthHeaders();
  const payload =
    nextState !== null && nextState !== undefined
      ? { notificationEnabled: Boolean(nextState) }
      : {};

  const encodedId = encodeURIComponent(patientId);
  const endpoints = [
    `${baseurl}user/update_patient_notification/${encodedId}`,
    `${baseurl}update_patient_notification/${encodedId}`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, payload, { headers });
      if (response?.data?.success || response?.status === 200) {
        return response.data;
      }
    } catch (err) {
      lastError = err;
      if (err?.response?.status !== 404) {
        throw err;
      }
    }
  }

  throw (
    lastError || new Error("Failed to update patient notification status")
  );
};
