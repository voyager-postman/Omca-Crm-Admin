import axios from "axios";
import { AdminBaseUrl } from "../Basurl/Baseurl";
import { saveCrmRequest } from "./crmRequestSaveApi";

export const fetchTreatmentEstimate = async (id) => {
  const response = await axios.post(`${AdminBaseUrl}other_enquiry_details`, {
    id,
    type: "PatientQuery",
  });
  return response.data;
};

export const saveTreatmentEstimate = async (formData) => {
  return saveCrmRequest("treatment-estimate/save", formData);
};
