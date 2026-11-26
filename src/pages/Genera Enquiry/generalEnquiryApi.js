import axios from "axios";
import { AdminBaseUrl, AdminBaseUrl1 } from "../../Basurl/Baseurl";
import { saveCrmRequest } from "../../services/crmRequestSaveApi";

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.tests)) return payload.data.tests;
  if (Array.isArray(payload?.data?.test_list)) return payload.data.test_list;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.tests)) return payload.tests;
  if (Array.isArray(payload?.test_list)) return payload.test_list;
  return [];
};

export const fetchGeneralEnquiry = async (id, model) => {
  const response = await axios.post(`${AdminBaseUrl}other_enquiry_details`, {
    id,
    type: model,
  });
  return response.data;
};

export const fetchHomeCareTypes = async () => {
  const response = await axios.get(`${AdminBaseUrl}home-care-types`, {
    headers: { Accept: "application/json" },
  });
  return unwrapList(response.data);
};

export const fetchHomeCareServices = async (homeCareTypeId) => {
  const response = await axios.get(`${AdminBaseUrl}home-care-services`, {
    params: { home_care_type_id: homeCareTypeId },
    headers: { Accept: "application/json" },
  });
  return unwrapList(response.data);
};

export const fetchTestList = async () => {
  const response = await axios.post(
    `${AdminBaseUrl1}test_list`,
    {},
    { headers: { Accept: "application/json" } },
  );
  return unwrapList(response.data);
};

const toInt = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const optionalText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

export const buildHomeCareSavePayload = (values = {}, recordId) => {
  const payload = {
    user_id: toInt(values.user_id),
    home_care_type_id: toInt(values.home_care_type_id),
    country_id: toInt(values.country_id),
    state_id: toInt(values.state_id),
    city_id: toInt(values.city_id),
    address: optionalText(values.address),
    start_date: optionalText(values.start_date),
    end_date: optionalText(values.end_date),
    term_condition: values.term_condition ? "1" : "0",
  };

  if (recordId) payload.id = toInt(recordId);

  [
    "name",
    "email",
    "country_code",
    "phone",
    "passport_number",
    "pin_code",
    "location_pin",
    "contact_number",
    "emergency_contact_number",
  ].forEach((key) => {
    const text = optionalText(values[key]);
    if (text) payload[key] = text;
  });

  return payload;
};

export const fetchAirports = async () => {
  const response = await axios.get(`${AdminBaseUrl}airports`, {
    headers: { Accept: "application/json" },
  });
  const data = response.data?.data;
  if (Array.isArray(data)) {
    return data.map((item) => ({
      id: String(item?.code ?? item?.id ?? "").trim(),
      name: item?.name || item?.title || "",
    }));
  }
  if (data && typeof data === "object") {
    return Object.entries(data).map(([code, name]) => ({
      id: code,
      name: `${name} - ${code}`,
      address: name,
    }));
  }
  return [];
};

export const geocodeAddress = async (address) => {
  const query = optionalText(address);
  if (!query) return null;
  const response = await axios.get(
    "https://nominatim.openstreetmap.org/search",
    { params: { q: query, format: "json", limit: 1 } },
  );
  const hit = Array.isArray(response.data) ? response.data[0] : null;
  if (!hit) return null;
  return {
    latitude: Number(Number(hit.lat).toFixed(7)),
    longitude: Number(Number(hit.lon).toFixed(7)),
  };
};

const toCoordinate = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const toHourMinute = (value) => {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return optionalText(value);
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const PICKUP_ID_TYPES = ["Airport", "Hospital", "Guest House"];

const applyPickupLocation = (payload, values, prefix) => {
  const type = optionalText(values[`${prefix}_location_type`]);
  payload[`${prefix}_location_type`] = type;
  payload[`${prefix}_location`] = optionalText(values[`${prefix}_location`]);
  if (PICKUP_ID_TYPES.includes(type)) {
    const id = optionalText(values[`${prefix}_location_id`]);
    payload[`${prefix}_location_id`] = /^\d+$/.test(id) ? Number(id) : id;
    return;
  }
  payload[`${prefix}_latitude`] = toCoordinate(values[`${prefix}_latitude`]);
  payload[`${prefix}_longitude`] = toCoordinate(values[`${prefix}_longitude`]);
};

export const buildPickupSavePayload = (values = {}, recordId) => {
  const payload = { user_id: toInt(values.user_id) };
  if (recordId) payload.id = toInt(recordId);

  applyPickupLocation(payload, values, "pickup");
  applyPickupLocation(payload, values, "destination");
  payload.pickup_date = optionalText(values.pickup_date);
  payload.pickup_time = toHourMinute(values.pickup_time);
  payload.terms_condtion = 1;

  ["name", "email", "phone", "passport_number"].forEach((key) => {
    const text = optionalText(values[key]);
    if (text) payload[key] = text;
  });
  const phoneCode = optionalText(values.country_code);
  if (phoneCode) payload.phone_code = phoneCode;

  return payload;
};

export const saveGeneralEnquiry = async (body, savePath) => {
  return saveCrmRequest(savePath, body);
};
