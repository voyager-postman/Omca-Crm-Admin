import axios from "axios";
import { AdminBaseUrl1 } from "../Basurl/Baseurl";

const locationClient = axios.create({
  headers: {
    Accept: "application/json",
  },
});

const unwrapLocationList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.countries)) return payload.countries;
  if (Array.isArray(payload?.states)) return payload.states;
  if (Array.isArray(payload?.cities)) return payload.cities;
  return [];
};

let countriesCache = null;
let countriesPromise = null;

export const getCountries = async () => {
  if (countriesCache?.length) return countriesCache;
  if (!countriesPromise) {
    countriesPromise = locationClient
      .get(`${AdminBaseUrl1}country_list`)
      .then((response) => {
        countriesCache = unwrapLocationList(response.data);
        return countriesCache;
      })
      .catch((error) => {
        countriesPromise = null;
        throw error;
      });
  }
  return countriesPromise;
};

export const getStates = async (countryId) => {
  if (!countryId) return [];
  const response = await locationClient.post(`${AdminBaseUrl1}state_list`, {
    country_id: countryId,
  });
  return unwrapLocationList(response.data);
};

export const getCities = async (stateId) => {
  if (!stateId) return [];
  const response = await locationClient.post(`${AdminBaseUrl1}get_city_list`, {
    state_id: stateId,
  });
  return unwrapLocationList(response.data);
};

export const getHomeCountries = async (filter = "") => {
  const response = await locationClient.post(
    `${AdminBaseUrl1}home_country_list`,
    filter ? { filter } : {},
  );
  return unwrapLocationList(response.data);
};
