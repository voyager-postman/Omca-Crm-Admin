import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || "";

export const getPickDropAuthHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
  };
};

export const PICK_DROP_STATUSES = [
  "New",
  "Pending",
  "In Process",
  "Picked Up",
  "On the Way",
  "Dropped",
  "Completed",
  "Cancelled",
  "Rescheduled",
];

export const PICK_DROP_STATUS_COLORS = {
  New: { bg: "#eef2ff", color: "#3730a3", border: "#818cf8" },
  Pending: { bg: "#fff7ed", color: "#c2410c", border: "#fb923c" },
  "In Process": { bg: "#eff6ff", color: "#1d4ed8", border: "#60a5fa" },
  "Picked Up": { bg: "#ecfeff", color: "#0e7490", border: "#22d3ee" },
  "On the Way": { bg: "#f5f3ff", color: "#6d28d9", border: "#a78bfa" },
  Dropped: { bg: "#fdf4ff", color: "#a21caf", border: "#e879f9" },
  Completed: { bg: "#ecfdf5", color: "#047857", border: "#34d399" },
  Cancelled: { bg: "#fef2f2", color: "#b91c1c", border: "#f87171" },
  Rescheduled: { bg: "#fef3c7", color: "#92400e", border: "#f59e0b" },
};

export const PICK_DROP_STATUS_FILTERS = [
  { key: "All", label: "All", countKey: "total" },
  { key: "New", label: "New", countKey: "new" },
  { key: "Pending", label: "Pending", countKey: "pending" },
  { key: "In Process", label: "In Process", countKey: "inProcess" },
  { key: "Picked Up", label: "Picked Up", countKey: "pickedUp" },
  { key: "On the Way", label: "On the Way", countKey: "onTheWay" },
  { key: "Dropped", label: "Dropped", countKey: "dropped" },
  { key: "Completed", label: "Completed", countKey: "completed" },
  { key: "Rescheduled", label: "Rescheduled", countKey: "rescheduled" },
  { key: "Cancelled", label: "Cancelled", countKey: "cancelled" },
];

/**
 * 1. Pick & Drop Dashboard Overview & Stats API
 * GET /get_pick_drop_dashboard_stats (alias GET /pick_drop_dashboard_stats)
 */
export const fetchPickDropDashboardStats = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      const val = String(params[key]).toLowerCase();
      if ((key === "pickDropStatus" || key === "status") && val === "all") return;
      if ((key === "tab" || key === "dateFilter") && val === "all") return;
      query.append(key, params[key]);
    }
  });

  const queryStr = query.toString();
  const endpoints = [
    `${baseurl}get_pick_drop_dashboard_stats${queryStr ? `?${queryStr}` : ""}`,
    `${baseurl}pick_drop_dashboard_stats${queryStr ? `?${queryStr}` : ""}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: getPickDropAuthHeaders() });
      if (res?.data && res.data.success !== false) {
        const body = res.data;
        // Normalize primary duties array
        const duties = Array.isArray(body.duties)
          ? body.duties
          : Array.isArray(body.rides)
          ? body.rides
          : Array.isArray(body.data)
          ? body.data
          : [];
        body.duties = duties;
        return body;
      }
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 405) {
        console.warn(`Error fetching from ${url}:`, err.message);
      }
    }
  }

  // Graceful fallback: synthesize stats & duties from get_pick_drop_appointments
  try {
    const aptParams = { limit: params.limit || 10 };
    if (params.page) aptParams.page = params.page;
    if (params.search) aptParams.search = params.search;
    if (params.patientId) aptParams.patientId = params.patientId;
    if (params.driver) aptParams.driver = params.driver;
    if (params.hospital_id) aptParams.hospital_id = params.hospital_id;
    if (params.startDate) aptParams.startDate = params.startDate;
    if (params.endDate) aptParams.endDate = params.endDate;
    if (params.status && String(params.status).toLowerCase() !== "all") {
      aptParams.status = params.status;
      aptParams.pickDropStatus = params.status;
    }

    const aptRes = await fetchPickDropAppointments(aptParams);
    const list = Array.isArray(aptRes?.data) ? aptRes.data : [];
    const counts = aptRes?.counts || {};
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const isUpcoming = (item) => {
      const st = String(item.pickDropStatus || item.status || "").toLowerCase();
      if (["new", "pending", "in process", "picked up", "on the way"].includes(st)) {
        return true;
      }
      if (["completed", "dropped", "cancelled"].includes(st)) {
        return false;
      }
      const d = String(item.appointment_Date || item.date || item.appointmentDate || "").slice(0, 10);
      if (!d) return true;
      return d >= todayStr;
    };

    const upcomingList = list.filter(isUpcoming);
    const historyList = list.filter((i) => !isUpcoming(i));

    const todayDuties = list.filter((item) => {
      const d = String(item.appointment_Date || item.date || item.appointmentDate || "").slice(0, 10);
      return d === todayStr;
    });

    const activeTab = (params.tab || "all").toLowerCase();
    const activeDateFilter = (params.dateFilter || params.filter || "all").toLowerCase();

    let filteredDuties =
      activeTab === "history"
        ? historyList
        : activeTab === "upcoming"
        ? upcomingList
        : list;

    if (activeDateFilter === "today") {
      filteredDuties = filteredDuties.filter((item) => {
        const d = String(item.appointment_Date || item.date || "").slice(0, 10);
        return d === todayStr;
      });
    }

    const driverMap = {};
    list.forEach((item) => {
      const name = item.driver_name || item.pickup_manager_name || "Unassigned";
      if (!driverMap[name]) {
        driverMap[name] = { name, totalRides: 0, todayRides: 0, completedRides: 0, activeRides: 0 };
      }
      driverMap[name].totalRides += 1;
      const d = String(item.appointment_Date || item.date || "").slice(0, 10);
      if (d === todayStr) driverMap[name].todayRides += 1;
      const st = String(item.pickDropStatus || item.status || "").toLowerCase();
      if (st === "completed" || st === "dropped") driverMap[name].completedRides += 1;
      if (st === "picked up" || st === "on the way" || st === "in process") driverMap[name].activeRides += 1;
    });

    return {
      success: true,
      message: "Pick & Drop dashboard stats retrieved successfully",
      activeTab: params.tab || "upcoming",
      activeFilter: params.dateFilter || "all",
      summary: {
        totalRides: Number(aptRes?.total || list.length),
        thisMonthRides: Number(counts.thisMonth || list.length),
        thisWeekRides: Number(counts.thisWeek || Math.round(list.length / 2)),
        todayTotal: todayDuties.length,
        todayCompleted: todayDuties.filter((i) => ["completed", "dropped"].includes(String(i.pickDropStatus || i.status).toLowerCase())).length,
        todayInProcess: todayDuties.filter((i) => ["in process", "picked up", "on the way"].includes(String(i.pickDropStatus || i.status).toLowerCase())).length,
        todayPending: todayDuties.filter((i) => ["pending", "new"].includes(String(i.pickDropStatus || i.status).toLowerCase())).length,
        upcomingTotal: upcomingList.length,
        historyTotal: historyList.length,
      },
      statusCounts: {
        ...counts,
        total: Number(aptRes?.total || list.length),
        upcomingTotal: upcomingList.length,
        historyTotal: historyList.length,
      },
      duties: filteredDuties,
      upcomingDuties: upcomingList,
      historyDuties: historyList,
      todayDuties: todayDuties.length > 0 ? todayDuties : upcomingList.slice(0, 6),
      todayOnlyDuties: todayDuties,
      driverStats: Object.values(driverMap),
      locationStats: {},
      total: filteredDuties.length,
      page: Number(params.page || 1),
      limit: Number(params.limit || filteredDuties.length),
      totalPages: 1,
    };
  } catch (fallbackErr) {
    console.warn("Fallback dashboard stats synthesis failed:", fallbackErr);
  }

  return {
    success: false,
    message: "Failed to load dashboard stats",
    activeTab: params.tab || "upcoming",
    activeFilter: params.dateFilter || "all",
    summary: {
      totalRides: 0,
      thisMonthRides: 0,
      thisWeekRides: 0,
      todayTotal: 0,
      todayCompleted: 0,
      todayInProcess: 0,
      todayPending: 0,
      upcomingTotal: 0,
      historyTotal: 0,
    },
    statusCounts: {},
    duties: [],
    todayDuties: [],
    upcomingDuties: [],
    historyDuties: [],
    driverStats: [],
    locationStats: {},
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };
};

/**
 * 2. Pick & Drop Calendar Schedule API
 * GET /get_driver_calendar_schedule (aliases: /get_pick_drop_calendar, /pick_drop_calendar)
 */
export const fetchDriverCalendarSchedule = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      query.append(key, params[key]);
    }
  });

  const endpoints = [
    `${baseurl}get_driver_calendar_schedule?${query.toString()}`,
    `${baseurl}get_pick_drop_calendar?${query.toString()}`,
    `${baseurl}pick_drop_calendar?${query.toString()}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: getPickDropAuthHeaders() });
      if (res?.data && res?.data?.success !== false) {
        return res.data;
      }
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 405) {
        console.warn(`Error fetching calendar from ${url}:`, err.message);
      }
    }
  }

  return {
    calendarEvents: [],
    availableDrivers: [],
    driverMetrics: {},
    groupedByDate: {},
    groupedByDriver: {},
  };
};

/**
 * 3. Pick & Drop Appointments List & Filter API
 * GET /get_pick_drop_appointments
 */
export const fetchPickDropAppointments = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      const val = String(params[key]).toLowerCase();
      if ((key === "pickDropStatus" || key === "status") && val === "all") return;
      if ((key === "tab" || key === "dateFilter") && val === "all") return;
      query.append(key, params[key]);
    }
  });

  const res = await axios.get(
    `${baseurl}get_pick_drop_appointments?${query.toString()}`,
    { headers: getPickDropAuthHeaders() }
  );
  return res.data;
};

/**
 * 4. Update Ride Status / Assign Driver / Reschedule API
 * POST /update_pick_drop_status/:appointmentId
 */
export const updatePickDropStatus = async (appointmentId, payload = {}) => {
  if (!appointmentId) {
    throw new Error("Appointment ID is required to update Pick & Drop status");
  }

  const endpoint = `${baseurl}update_pick_drop_status/${encodeURIComponent(appointmentId)}`;
  const res = await axios.post(endpoint, payload, {
    headers: getPickDropAuthHeaders(),
  });

  if (res?.data?.success === false) {
    throw new Error(res.data.message || "Failed to update pick & drop status");
  }

  return res.data;
};
