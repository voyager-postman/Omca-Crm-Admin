import axios from "axios";
import { baseu11, baseurl } from "../Basurl/Baseurl";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

/** Build query params, omitting empty values */
export const buildReportParams = ({
  startDate = "",
  endDate = "",
  treatment_course_name = "",
  country = "",
  treatingIn = "",
  patientId = "",
  hospital_id = "",
} = {}) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (treatment_course_name) params.treatment_course_name = treatment_course_name;
  if (country) params.country = country;
  if (treatingIn) params.treatingIn = treatingIn;
  if (patientId) params.patientId = patientId;
  if (hospital_id !== "" && hospital_id != null) params.hospital_id = hospital_id;
  return params;
};

/** GET /api/exportfilteredpatient */
export const fetchFilteredPatients = async (filters = {}) => {
  const params = buildReportParams(filters);
  const response = await axios.get(`${baseurl}exportfilteredpatient/`, {
    params,
    headers: authHeaders(),
  });
  const body = response.data;
  if (body?.success === false) {
    throw new Error(body?.message || "Failed to load report");
  }
  return {
    data: Array.isArray(body?.data) ? body.data : [],
    download_link: body?.download_link || null,
    params,
  };
};

export const resolveDownloadUrl = (downloadLink) => {
  if (!downloadLink) return null;
  if (String(downloadLink).startsWith("http")) return downloadLink;
  return `${baseu11}${downloadLink}`;
};
