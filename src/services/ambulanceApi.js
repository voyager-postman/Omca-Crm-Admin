import axios from "axios";
import { AdminBaseUrl } from "../Basurl/Baseurl";
import { saveCrmRequest } from "./crmRequestSaveApi";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchAmbulanceRequest = async (id) => {
  const response = await axios.post(
    `${AdminBaseUrl}other_enquiry_details`,
    {
      id,
      type: "AmbulanceRequest",
    },
    { headers: authHeaders() },
  );
  return response.data;
};

export const saveAmbulanceRequest = async (formData) => {
  return saveCrmRequest("ambulance-request/save", formData);
};

export const unwrapAmbulanceRow = (res) => {
  const payload = res?.data ?? res?.detail ?? res;
  if (Array.isArray(payload)) return payload[0] || {};
  if (payload?.ambulance_request) return payload.ambulance_request;
  if (payload?.AmbulanceRequest) return payload.AmbulanceRequest;
  return payload && typeof payload === "object" ? payload : {};
};

export { crmSaveErrorMessage as ambulanceApiErrorMessage } from "./crmRequestSaveApi";
