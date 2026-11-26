import axios from "axios";
import { AdminBaseUrl } from "../Basurl/Baseurl";
import { saveCrmRequest } from "./crmRequestSaveApi";

export const fetchAirAmbulanceRequest = async (id) => {
  const response = await axios.post(`${AdminBaseUrl}other_enquiry_details`, {
    id,
    type: "AirAmbulance",
  });
  return response.data;
};

export const saveAirAmbulanceRequest = async (formData) => {
  return saveCrmRequest("air-ambulance/save", formData);
};
