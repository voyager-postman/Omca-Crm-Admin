import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import { getToken } from "../utils/authStorage";

const API_BASE = baseurl.endsWith("/") ? baseurl : `${baseurl}/`;

const getAuthHeaders = () => {
  const token = getToken() || localStorage.getItem("token") || "";
  return token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : {};
};

export const employeeActivityService = {
  // 1. Fetch Chart, Summary KPIs & Employee Table
  getActivityMetrics: async (params = {}) => {
    const response = await axios.get(`${API_BASE}employee_activity_chart`, {
      params,
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // 2. Fetch dropdown filter options (Roles, Staff, Presets)
  getFilterOptions: async () => {
    const response = await axios.get(`${API_BASE}employee_activity_filter_options`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  // 3. Drilldown: Individual employee's detailed activity logs
  getEmployeeLogs: async (userId, params = {}) => {
    const response = await axios.get(
      `${API_BASE}employee_activity_logs/${encodeURIComponent(userId)}`,
      {
        params,
        headers: getAuthHeaders(),
      }
    );
    return response.data;
  },
};
