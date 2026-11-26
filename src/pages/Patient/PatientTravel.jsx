import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  FormControl,
  MenuItem,
  Pagination,
  Select,
  TextField,
} from "@mui/material";
import Swal from "sweetalert2";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import TravelStatusModal from "../../components/Common/TravelStatusModal";
import { markRecordRead } from "../../services/unreadApi";
import { UnreadDot } from "../../components/NewTag";
import { baseurl, image, AdminBaseUrl } from "../../Basurl/Baseurl";
import {
  PATIENT_TRAVEL_STATUS_OPTIONS,
  getPatientStatusLabel,
  isTravelStatus,
  normalizePatientStatus,
} from "../../utils/patientStatus";
import { toast } from "react-toastify";
import FlightTravelCalendar from "./components/FlightTravelCalendar";
import {
  isReferralUser,
  isInsuranceUser,
  isCoordinatorUser,
  getCurrentCoordinatorUser,
} from "../../utils/authStorage";
import { isPatientAssignedToCoordinatorUser } from "../../services/coordinatorApi";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

/** Same airports API used by Travel create/edit (TravelStatusModal) */
const AIRPORTS_API = `${AdminBaseUrl}airports`;

const fetchAirportOptions = async () => {
  try {
    const res = await axios.get(AIRPORTS_API, { headers: authHeaders() });
    const body = res.data;
    const raw = body?.data ?? body?.airports ?? body ?? {};

    if (typeof raw === "object" && !Array.isArray(raw)) {
      return Object.entries(raw)
        .map(([code, name]) => `${code} - ${name}`)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }

    if (Array.isArray(raw)) {
      return raw
        .map((a) => {
          const code = a.code ?? a.iata ?? "";
          const name = a.name ?? a.airportName ?? a.airport_name ?? "";
          return code && name ? `${code} - ${name}` : name || code;
        })
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }

    return [];
  } catch {
    return [];
  }
};

const TRAVEL_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "Arriving", label: "Arriving" },
  { value: "Departing", label: "Departing" },
  { value: "Preponed", label: "Preponed" },
  { value: "Postponed", label: "Postponed" },
  { value: "Travelled", label: "Travelled" },
  { value: "Traveling Today", label: "Travelling Today" },
];

const EMPTY_TRAVEL_FILTERS = {
  travelDate: "",
  travelType: "",
  countryFrom: "",
  countryTo: "",
};

const TABS = [
  {
    key: "arriving",
    label: "Arriving Today",
    icon: "fa fa-plane",
    params: { p_status: "Arriving", today: "true" },
  },
  {
    key: "all",
    label: "All Travel Patients",
    icon: "fa fa-users",
    params: {},
  },
  {
    key: "departing",
    label: "Departing",
    icon: "fa fa-plane",
    params: { p_status: "Departing" },
  },
  {
    key: "history",
    label: "History",
    icon: "fa fa-history",
    params: { p_status: "Travelled" },
  },
];

const TAB_COLORS = {
  arriving: {
    bg: "#ecfdf5",
    border: "#a7f3d0",
    num: "#059669",
    badge: "#d1fae5",
  },
  all: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    num: "#2563eb",
    badge: "#dbeafe",
  },
  departing: {
    bg: "#fffbeb",
    border: "#fde68a",
    num: "#d97706",
    badge: "#fef3c7",
  },
  history: {
    bg: "#f5f3ff",
    border: "#ddd6fe",
    num: "#7c3aed",
    badge: "#ede9fe",
  },
};

const tabColors = (key) => TAB_COLORS[key] || TAB_COLORS.all;

const buildTravelParams = (tabKey, filters = EMPTY_TRAVEL_FILTERS) => {
  const tab = TABS.find((t) => t.key === tabKey);
  const params = { ...(tab?.params || {}) };
  const travelDate = String(filters.travelDate || "").trim();
  const travelType = String(filters.travelType || "").trim();
  const countryFrom = String(filters.countryFrom || "").trim();
  const countryTo = String(filters.countryTo || "").trim();

  // Date filter overrides tab "today" shortcut
  if (travelDate) {
    params.travelDate = travelDate;
    delete params.today;
  }

  // History is the completed queue: always request p_status Travelled.
  // Arrival/Departure on that tab is applied locally so it cannot replace Travelled.
  if (tabKey === "history") {
    params.p_status = "Travelled";
  } else if (travelType) {
    // Travel type / action dropdown overrides tab status when set
    params.p_status = travelType;
    // If user picks Arrival/Departure with a date, don't force today
    if (travelDate) delete params.today;
  }

  // Active tabs must not request the travelled history list
  if (tabKey !== "history" && params.p_status === "Travelled") {
    delete params.p_status;
  }

  // Airport values (same format as create: "DEL - Indira Gandhi…")
  if (countryFrom) {
    params.countryFrom = countryFrom;
    params.from = countryFrom;
  }
  if (countryTo) {
    params.countryTo = countryTo;
    params.to = countryTo;
  }

  return params;
};

const rowStatus = (row) =>
  normalizePatientStatus(row?.p_status || row?.status) || "";

const travelRecord = (row) =>
  row?.travelDetails &&
  typeof row.travelDetails === "object" &&
  !Array.isArray(row.travelDetails)
    ? row.travelDetails
    : row || {};

const rowTravelAction = (row) => {
  const td = travelRecord(row);
  return (
    normalizePatientStatus(
      td?.action || td?.travelType || td?.travel_type || row?.action || "",
    ) || ""
  );
};

const HISTORY_KEYS = [
  "history",
  "travelHistory",
  "travel_history",
  "statusHistory",
  "travels",
];

const rowHistory = (row) => {
  if (Array.isArray(row?.travelDetails)) return row.travelDetails;
  const sources = [row, row?.travelDetails];
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    for (const key of HISTORY_KEYS) {
      if (Array.isArray(source[key])) return source[key];
    }
  }
  return [];
};

const historyEntryView = (entry, index) => {
  if (entry == null) return null;
  if (typeof entry !== "object") {
    return { key: `h-${index}`, title: String(entry), meta: "" };
  }
  const td = travelRecord(entry);
  const action =
    normalizePatientStatus(td.action || td.travelType || entry.p_status || entry.status) ||
    "";
  const from = td.from || td.countryFrom || "—";
  const to = td.to || td.countryTo || "—";
  const when = formatDate(td.travelDate || td.travel_date || entry.updatedAt || entry.createdAt);
  const time = td.arrivalTime || td.arrival_time || "";
  return {
    key: entry._id || entry.id || `h-${index}`,
    title: action || "Travel record",
    meta: [when, time, `${from} → ${to}`].filter(Boolean).join(" · "),
    services: td.services || td.service || "",
  };
};

const rowsForTab = (list, tabKey, filters = EMPTY_TRAVEL_FILTERS) => {
  let items = Array.isArray(list) ? list : [];
  const travelType = String(filters.travelType || "").trim();

  // History comes only from get_travel_patients?p_status=Travelled
  if (tabKey === "history") {
    if (travelType) {
      items = items.filter((row) => rowTravelAction(row) === travelType);
    }
    return items;
  }

  // Default travel queue excludes patients already marked Travelled
  items = items.filter((row) => rowStatus(row) !== "Travelled");

  // When API filters are active, trust server results (no client re-filter by tab)
  const hasApiFilters = Boolean(
    filters.travelDate ||
      travelType ||
      filters.countryFrom ||
      filters.countryTo,
  );
  if (hasApiFilters) return items;
  if (tabKey === "departing") {
    return items.filter((row) => rowStatus(row) === "Departing");
  }
  if (tabKey === "arriving") {
    return items.filter((row) => rowStatus(row) === "Arriving");
  }
  return items;
};

const pinUnreadFirst = (list) => {
  const unread = [];
  const rest = [];
  (Array.isArray(list) ? list : []).forEach((row) => {
    if (row?.isUnread === true) unread.push(row);
    else rest.push(row);
  });
  return [...unread, ...rest];
};

const patchTabRows = (prev, patientId, savedStatus, extra = {}) => {
  const next = { ...prev };
  Object.keys(next).forEach((key) => {
    const rows = next[key] || [];
    if (savedStatus === "Travelled" && key !== "history") {
      next[key] = rows.filter((row) => row.patientId !== patientId);
      return;
    }
    next[key] = rows.map((row) => {
      if (row.patientId !== patientId) return row;
      const updates = Object.fromEntries(
        Object.entries(extra).filter(([, value]) => value !== undefined),
      );
      return { ...row, ...updates, p_status: savedStatus, status: savedStatus };
    });
  });
  return next;
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const filterFieldSx = {
  "& .MuiInputBase-root": { height: 38, background: "#fff" },
  "& .MuiInputBase-input": { padding: "6px 12px", fontSize: 13 },
};

export default function PatientTravel() {
  const navigate = useNavigate();
  const isReferral = isReferralUser() || isInsuranceUser();
  const userRole = (localStorage.getItem("Role") || "").toLowerCase();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw.split(",").map((p) => p.trim());
  const canAccessTravel =
    userRole === "admin" ||
    permissionsList.includes("/Patient_Travel") ||
    permissionsList.includes("Patient_Travel");

  useEffect(() => {
    if (!canAccessTravel) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [canAccessTravel, navigate]);

  const [activeTab, setActiveTab] = useState("arriving");
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'calendar'
  const [data, setData] = useState({});
  const [loading, setLoading] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState(EMPTY_TRAVEL_FILTERS);
  const [draftFilters, setDraftFilters] = useState(EMPTY_TRAVEL_FILTERS);
  const [airportOptions, setAirportOptions] = useState([]);
  const [airportsLoading, setAirportsLoading] = useState(false);
  const [travelStatusModal, setTravelStatusModal] = useState({
    open: false,
    patientId: "",
    patientName: "",
    status: "",
  });
  const [travelStatusSubmitting, setTravelStatusSubmitting] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState("");

  const fetchTab = useCallback(async (tabKey, filterOverrides = null) => {
    const tab = TABS.find((t) => t.key === tabKey);
    if (!tab) return;
    const activeFilters = filterOverrides || filters;
    setLoading((prev) => ({ ...prev, [tabKey]: true }));
    try {
      const params = buildTravelParams(tabKey, activeFilters);
      const res = await axios.get(`${baseurl}get_travel_patients`, {
        headers: authHeaders(),
        params,
      });
      const body = res.data;
      const list = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
        ? body.data
        : body?.data
        ? [body.data]
        : [];
      setData((prev) => ({ ...prev, [tabKey]: list }));
    } catch (err) {
      toast.error(err?.response?.data?.message || `Failed to load ${tab.label}`);
      setData((prev) => ({ ...prev, [tabKey]: [] }));
    } finally {
      setLoading((prev) => ({ ...prev, [tabKey]: false }));
    }
  }, [filters]);

  const refreshAllTabs = useCallback(
    (filterOverrides = null) => {
      TABS.forEach((t) => fetchTab(t.key, filterOverrides));
    },
    [fetchTab],
  );

  useEffect(() => {
    refreshAllTabs();
    // Initial load only — later refreshes go through Apply / tab / refresh button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAirportsLoading(true);
    fetchAirportOptions()
      .then((list) => {
        if (!cancelled) setAirportOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setAirportOptions([]);
      })
      .finally(() => {
        if (!cancelled) setAirportsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.travelDate ||
          filters.travelType ||
          filters.countryFrom ||
          filters.countryTo,
      ),
    [filters],
  );

  const handleApplyFilters = () => {
    setFilters(draftFilters);
    refreshAllTabs(draftFilters);
  };

  const handleClearFilters = () => {
    setDraftFilters(EMPTY_TRAVEL_FILTERS);
    setFilters(EMPTY_TRAVEL_FILTERS);
    refreshAllTabs(EMPTY_TRAVEL_FILTERS);
  };

  const updateDraftFilter = (field, value) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  };

  const postPatientStatus = async (patientId, payload) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authorization token is missing");
    }

    const formData = new FormData();
    const statusVal = payload.p_status || payload.status;
    if (statusVal) {
      formData.append("p_status", statusVal);
    }
    if (payload.travelDetails) {
      const detailsStr = typeof payload.travelDetails === "object"
        ? JSON.stringify(payload.travelDetails)
        : payload.travelDetails;
      formData.append("travelDetails", detailsStr);
    }
    if (payload.travelDocuments) {
      const docs = Array.isArray(payload.travelDocuments)
        ? payload.travelDocuments
        : [payload.travelDocuments];
      docs.forEach((file) => {
        if (file) {
          formData.append("travelDocuments", file);
        }
      });
    }
    if (payload.travelDocumentLabels) {
      if (Array.isArray(payload.travelDocumentLabels)) {
        if (payload.travelDocumentLabels.length === 1) {
          formData.append("travelDocumentLabels", payload.travelDocumentLabels[0]);
        } else {
          formData.append("travelDocumentLabels", JSON.stringify(payload.travelDocumentLabels));
        }
      } else {
        formData.append("travelDocumentLabels", payload.travelDocumentLabels);
      }
    }

    const response = await axios.post(
      `${baseurl}changePatientStatus/${patientId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );
    if (response.status !== 200 && response.status !== 201) {
      throw new Error("Failed to update status. Please try again!");
    }
    return normalizePatientStatus(
      response.data?.data?.p_status ??
        response.data?.p_status ??
        response.data?.details?.p_status ??
        statusVal,
    );
  };

  const markTravelRow = (rowOrId) => {
    const row =
      rowOrId && typeof rowOrId === "object"
        ? rowOrId
        : Object.values(data)
            .flat()
            .find(
              (item) =>
                String(item?.patientId || "") === String(rowOrId || "") ||
                String(item?.patientNumber || "") === String(rowOrId || ""),
            );
    const recordId =
      row?.patientNumber ||
      row?.patientId ||
      (typeof rowOrId === "string" ? rowOrId : "");
    if (!recordId) return;
    markRecordRead("patientTravel", recordId);
    setData((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = (next[key] || []).map((item) =>
          String(item.patientId || "") === String(recordId) ||
          String(item.patientNumber || "") === String(recordId) ||
          String(item.patientId || item.patientNumber || "") === String(recordId)
            ? { ...item, isUnread: false }
            : item,
        );
      });
      return next;
    });
  };

  const handleStatusChange = async (e, patientId, patientName = "") => {
    if (isReferral) return;
    markTravelRow(patientId);
    const newStatus = normalizePatientStatus(e.target.value);
    if (isTravelStatus(newStatus)) {
      setTravelStatusModal({
        open: true,
        patientId,
        patientName: patientName || "",
        status: newStatus,
      });
      return;
    }
    try {
      const savedStatus = await postPatientStatus(patientId, {
        p_status: newStatus,
      });
      setData((prev) => patchTabRows(prev, patientId, savedStatus));
      Swal.fire("Success!", "Patient status updated successfully!", "success");
      refreshAllTabs();
    } catch (err) {
      console.error("Status update error:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Something went wrong. Please try again!";
      toast.error(msg);
    }
  };

  const handleCloseTravelStatusModal = () => {
    if (travelStatusSubmitting) return;
    setTravelStatusModal({
      open: false,
      patientId: "",
      patientName: "",
      status: "",
    });
  };

  const handleSubmitTravelStatus = async (payload) => {
    if (isReferral) return;
    const patientId = travelStatusModal.patientId;
    if (!patientId) return;
    setTravelStatusSubmitting(true);
    try {
      const savedStatus = await postPatientStatus(patientId, payload);
      setData((prev) =>
        patchTabRows(prev, patientId, savedStatus, {
          travelDetails: payload.travelDetails,
        }),
      );
      setTravelStatusModal({
        open: false,
        patientId: "",
        patientName: "",
        status: "",
      });
      Swal.fire("Success!", "Patient status updated successfully!", "success");
      refreshAllTabs();
    } catch (err) {
      console.error("Travel status error:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to update travel status";
      toast.error(msg);
    } finally {
      setTravelStatusSubmitting(false);
    }
  };

  const currentTab = TABS.find((t) => t.key === activeTab);
  const isCoordinator = isCoordinatorUser();
  const currentCoord = getCurrentCoordinatorUser();

  const coordinatorRows = useMemo(() => {
    const rawRows = pinUnreadFirst(rowsForTab(data[activeTab], activeTab, filters));
    if (!isCoordinator) return rawRows;
    return rawRows.filter((r) => isPatientAssignedToCoordinatorUser(r, currentCoord));
  }, [data, activeTab, filters, isCoordinator, currentCoord]);

  const rows = coordinatorRows;
  const isLoading = loading[activeTab];

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(r.patient_name || r.patientName || r.name || "")
        .toLowerCase()
        .includes(q) ||
      String(r.patientId || "").toLowerCase().includes(q) ||
      String(r.p_status || r.status || "").toLowerCase().includes(q) ||
      String(r.countryFrom || r.country_from || r.fromCountry || "")
        .toLowerCase()
        .includes(q) ||
      String(r.countryTo || r.country_to || r.toCountry || "")
        .toLowerCase()
        .includes(q)
    );
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * rowsPerPage;
  const pageRows = filtered.slice(pageStart, pageStart + rowsPerPage);

  useEffect(() => {
    setPage(1);
    setExpandedHistoryId("");
  }, [activeTab, search, filters, rowsPerPage]);

  const allTravelPatients = useMemo(() => {
    const combined = [
      ...(Array.isArray(data.all) ? data.all : []),
      ...(Array.isArray(data.arriving) ? data.arriving : []),
      ...(Array.isArray(data.departing) ? data.departing : []),
      ...(Array.isArray(data.history) ? data.history : []),
    ];
    const seen = new Set();
    return combined.filter((item) => {
      if (!item) return false;
      if (isCoordinator && !isPatientAssignedToCoordinatorUser(item, currentCoord)) {
        return false;
      }
      const td =
        item.travelDetails &&
        typeof item.travelDetails === "object" &&
        !Array.isArray(item.travelDetails)
          ? item.travelDetails
          : item;
      const patientId =
        item.patientId ||
        item.patientNumber ||
        item._id ||
        item.id ||
        item.patient_name ||
        "";
      const travelDate =
        td.travelDate || td.travel_date || item.travelDate || item.date || "";
      const from = td.from || item.countryFrom || item.from || "";
      const to = td.to || item.countryTo || item.to || "";
      const time = td.arrivalTime || td.arrival_time || "";
      const key = `${patientId}-${travelDate}-${from}-${to}-${time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data, isCoordinator, currentCoord]);

  return (
    <>
      <Navbar />
      <Sidebar />
      <div className="page-wrapper">
        <div className="content" style={{ padding: "20px 24px" }}>
          {/* Page Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 22,
            }}
          >
            <div>
              <h4
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#1a2233",
                  margin: "0 0 4px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <i className="fa fa-plane" style={{ color: "#22c7b8" }} />
                Patient Travel
              </h4>
              <p style={{ fontSize: 13, color: "#7a8499", margin: 0 }}>
                Active travel hides patients marked Travelled. History lists everyone who has travelled.
              </p>
            </div>
            {/* Summary pills */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {TABS.map((t) => {
                const colors = { ...tabColors(t.key), lbl: "#6b7280" };
                return (
                  <div
                    key={t.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "8px 18px",
                      borderRadius: 10,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      minWidth: 90,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        lineHeight: 1,
                        color: colors.num,
                      }}
                    >
                      {loading[t.key] ? "…" : rowsForTab(data[t.key], t.key, filters).length}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: colors.lbl,
                        marginTop: 2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs & View Switcher */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "2px solid #eef0f5",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {TABS.map((t) => {
                const isActive = activeTab === t.key;
                const colors = tabColors(t.key);
                const badgeBg = isActive ? colors.badge : "#e5e7eb";
                const badgeColor = isActive ? colors.num : "#374151";
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 18px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                      color: isActive ? "#22c7b8" : "#7a8499",
                      background: isActive ? "#f0fdf9" : "transparent",
                      borderBottom: isActive
                        ? "2px solid #22c7b8"
                        : "2px solid transparent",
                      marginBottom: -2,
                      borderRadius: "6px 6px 0 0",
                      transition: "all .15s",
                    }}
                  >
                    <i className={t.icon} />
                    {t.label}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 22,
                        height: 20,
                        padding: "0 6px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {loading[t.key] ? "…" : rowsForTab(data[t.key], t.key, filters).length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Switcher: Table View vs Flight Calendar View */}
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <button
                type="button"
                className={`travel-view-switch-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
              >
                <i className="fa fa-table" />
                Table View
              </button>
              <button
                type="button"
                className={`travel-view-switch-btn ${viewMode === "calendar" ? "active" : ""}`}
                onClick={() => setViewMode("calendar")}
              >
                <i className="fa fa-calendar" />
                Flight Calendar
              </button>
            </div>
          </div>

          {viewMode === "calendar" ? (
            <FlightTravelCalendar
              travelPatients={allTravelPatients}
              onOpenTravelStatus={
                isReferral
                  ? undefined
                  : (patientId, patientName, status) => {
                      setTravelStatusModal({
                        open: true,
                        patientId,
                        patientName: patientName || "",
                        status: status || "Arriving",
                      });
                    }
              }
              onRefresh={() => refreshAllTabs()}
            />
          ) : (
            <>

          {/* Filter criteria — Date, Arrival/Departure, Country From/To */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #eef0f5",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                <i className="fa fa-filter me-2" style={{ color: "#22c7b8" }} />
                Travel Filters
                {hasActiveFilters && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#0f766e",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid #dce1e8",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 8,
                    border: "1px solid #0d9488",
                    background: "#0d9488",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <i className="fa fa-search me-1" /> Apply Filters
                </button>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-12 col-sm-6 col-lg-3">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 4,
                  }}
                >
                  Travel Date
                </label>
                <TextField
                  type="date"
                  size="small"
                  fullWidth
                  value={draftFilters.travelDate}
                  onChange={(e) => updateDraftFilter("travelDate", e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={filterFieldSx}
                />
              </div>

              <div className="col-12 col-sm-6 col-lg-3">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 4,
                  }}
                >
                  Arrival / Departure
                </label>
                <FormControl fullWidth size="small">
                  <Select
                    value={draftFilters.travelType}
                    displayEmpty
                    onChange={(e) => updateDraftFilter("travelType", e.target.value)}
                    sx={{
                      height: 38,
                      background: "#fff",
                      fontSize: 13,
                    }}
                  >
                    {TRAVEL_TYPE_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value || "all"} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div className="col-12 col-sm-6 col-lg-3">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 4,
                  }}
                >
                  Country From
                </label>
                <Autocomplete
                  options={airportOptions}
                  loading={airportsLoading}
                  value={draftFilters.countryFrom || null}
                  onChange={(_, newValue) =>
                    updateDraftFilter("countryFrom", newValue || "")
                  }
                  ListboxProps={{ style: { maxHeight: 250 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder={
                        airportsLoading
                          ? "Loading airports…"
                          : "e.g. MRU - Sir Seewoosagur…"
                      }
                      sx={filterFieldSx}
                    />
                  )}
                />
              </div>

              <div className="col-12 col-sm-6 col-lg-3">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 4,
                  }}
                >
                  Country To
                </label>
                <Autocomplete
                  options={airportOptions}
                  loading={airportsLoading}
                  value={draftFilters.countryTo || null}
                  onChange={(_, newValue) =>
                    updateDraftFilter("countryTo", newValue || "")
                  }
                  ListboxProps={{ style: { maxHeight: 250 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder={
                        airportsLoading
                          ? "Loading airports…"
                          : "e.g. DEL - Indira Gandhi…"
                      }
                      sx={filterFieldSx}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                position: "relative",
                flex: 1,
                maxWidth: 380,
                minWidth: 200,
              }}
            >
              <i
                className="fa fa-search"
                style={{
                  position: "absolute",
                  left: 11,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#aab2c0",
                  fontSize: 13,
                }}
              />
              <input
                type="text"
                placeholder="Search by name, patient ID or status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: 38,
                  padding: "0 32px 0 34px",
                  border: "1px solid #dce1e8",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "#fff",
                  outline: "none",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    fontSize: 16,
                    color: "#aab2c0",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => refreshAllTabs()}
              title="Refresh"
              style={{
                height: 38,
                width: 38,
                border: "1px solid #dce1e8",
                borderRadius: 8,
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                color: "#7a8499",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="fa fa-refresh" />
            </button>
          </div>

          {/* Table Card */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #eef0f5",
              boxShadow: "0 2px 8px rgba(0,0,0,.04)",
              overflow: "hidden",
            }}
          >
            {isLoading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "60px 20px",
                  gap: 12,
                  color: "#aab2c0",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: "3px solid #e0f7f5",
                    borderTopColor: "#22c7b8",
                    borderRadius: "50%",
                    animation: "pt-spin .7s linear infinite",
                  }}
                />
                <span>Loading {currentTab?.label}…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "60px 20px",
                  gap: 10,
                  color: "#aab2c0",
                }}
              >
                <i
                  className="fa fa-plane"
                  style={{ fontSize: 40, color: "#d1d5db" }}
                />
                <p style={{ margin: 0, fontSize: 14 }}>No patients found</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  key={activeTab}
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        borderBottom: "2px solid #eef0f5",
                      }}
                    >
                      {[
                        "#",
                        "Patient",
                        "Patient ID",
                        "Status",
                        "Travel Date",
                        "From",
                        "To",
                        "Arrival Time",
                        "Travellers",
                        "Services",
                        "Documents",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "12px 14px",
                            textAlign: "left",
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: ".5px",
                            color: "#7a8499",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, idx) => {
                      const td = travelRecord(row);
                      const patientName =
                        row.patient_name || row.patientName || row.name || "—";
                      const currentStatus =
                        normalizePatientStatus(row.p_status || row.status) || "";
                      const rowKey = [
                        activeTab,
                        row._id || row.id || "",
                        row.patientId || "",
                        td?.travelDate || td?.travel_date || "",
                        idx,
                      ].join("-");
                      const historyEntries =
                        activeTab === "history" ? rowHistory(row).map(historyEntryView).filter(Boolean) : [];
                      const historyOpen = expandedHistoryId === rowKey;

                      return (
                        <React.Fragment key={rowKey}>
                        <tr
                          className={row.isUnread ? "unread-row" : undefined}
                          style={{ borderBottom: "1px solid #f3f4f6" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f8fafc")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <td style={{ padding: "11px 14px", color: "#aab2c0" }}>
                            {pageStart + idx + 1}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              fontWeight: 600,
                              color: "#1a2233",
                            }}
                          >
                            {patientName}
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                background: "#f0f9ff",
                                color: "#0369a1",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                fontFamily: "monospace",
                              }}
                            >
                              {row.patientId || "—"}
                            </span>
                            <UnreadDot unread={row.isUnread === true} />
                          </td>
                          {/* Status Select dropdown */}
                          <td style={{ padding: "6px 14px", minWidth: 150 }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                disabled={isReferral}
                                value={currentStatus}
                                onChange={(e) =>
                                  handleStatusChange(
                                    e,
                                    row.patientId,
                                    patientName,
                                  )
                                }
                                displayEmpty
                                renderValue={(selected) => {
                                  const travelOpt = PATIENT_TRAVEL_STATUS_OPTIONS.find(
                                    (opt) =>
                                      opt.value === selected ||
                                      opt.value === normalizePatientStatus(selected),
                                  );
                                  if (travelOpt) return travelOpt.label;
                                  return (
                                    getPatientStatusLabel(selected) ||
                                    selected ||
                                    "Select Status"
                                  );
                                }}
                                inputProps={{
                                  "aria-label": "Patient Status",
                                }}
                                style={{
                                  fontSize: 13,
                                  height: 34,
                                  background: "#fff",
                                  borderRadius: 6,
                                  cursor: isReferral ? "not-allowed" : "pointer",
                                  opacity: isReferral ? 0.85 : 1,
                                }}
                              >
                                {currentStatus &&
                                  !PATIENT_TRAVEL_STATUS_OPTIONS.some(
                                    (opt) =>
                                      opt.value === currentStatus ||
                                      opt.value === normalizePatientStatus(currentStatus),
                                  ) && (
                                    <MenuItem
                                      key={currentStatus}
                                      value={currentStatus}
                                      style={{ display: "none" }}
                                    >
                                      {getPatientStatusLabel(currentStatus) || currentStatus}
                                    </MenuItem>
                                  )}
                                {PATIENT_TRAVEL_STATUS_OPTIONS.map((option) => (
                                  <MenuItem
                                    key={option.value}
                                    value={option.value}
                                    style={{ fontSize: 13 }}
                                  >
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            {formatDate(td?.travelDate || td?.travel_date)}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              maxWidth: 180,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={td?.from || ""}
                          >
                            {td?.from || "—"}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              maxWidth: 180,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={td?.to || ""}
                          >
                            {td?.to || "—"}
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            {td?.arrivalTime || td?.arrival_time || "—"}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "center",
                            }}
                          >
                            {td?.numberOfTravellers ||
                              td?.number_of_travellers ||
                              "—"}
                          </td>
                           <td style={{ padding: "11px 14px" }}>
                            {td?.services || td?.service || "—"}
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            {td?.documents && td.documents.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {td.documents.map((doc, dIdx) => {
                                  const url = doc.url || doc.path || (doc.fileUrl ? `${image}uploads/${doc.fileUrl}` : doc.filePath ? `${image}${doc.filePath}` : "");
                                  const name = doc.label || doc.fileName || doc.name || `Doc ${dIdx + 1}`;
                                  return url ? (
                                    <a
                                      key={doc._id || dIdx}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        background: "#f0faf9",
                                        border: "1px solid #c5f0eb",
                                        borderRadius: "4px",
                                        padding: "2px 6px",
                                        fontSize: "11px",
                                        color: "#1aa89b",
                                        textDecoration: "none",
                                        fontWeight: "500",
                                      }}
                                      title={name}
                                    >
                                      <i className="fa fa-file me-1" style={{ fontSize: "10px" }} />
                                      {name.length > 12 ? `${name.substring(0, 10)}...` : name}
                                    </a>
                                  ) : (
                                    <span
                                      key={doc._id || dIdx}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        background: "#f3f4f6",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "4px",
                                        padding: "2px 6px",
                                        fontSize: "11px",
                                        color: "#4b5563",
                                      }}
                                    >
                                      {name}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {activeTab === "history" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    markTravelRow(row);
                                    setExpandedHistoryId((current) =>
                                      current === rowKey ? "" : rowKey,
                                    );
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    background: historyOpen ? "#ede9fe" : "#fff",
                                    color: "#6d28d9",
                                    border: "1px solid #ddd6fe",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <i className="fa fa-history" />
                                  {historyOpen ? "Hide" : "History"}
                                  {historyEntries.length > 0 ? ` (${historyEntries.length})` : ""}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  markTravelRow(row);
                                  navigate("/Admin/Patient-Detail", {
                                    state: {
                                      patientId: row.patientId,
                                      patientNumber: row.patientNumber,
                                      createdAt: row.createdAt || row.created_at,
                                    },
                                  });
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  background:
                                    "linear-gradient(135deg,#22c7b8 0%,#1aa89b 100%)",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "6px 14px",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <i className="fa fa-eye" /> View
                              </button>
                            </div>
                          </td>
                        </tr>
                        {historyOpen && (
                          <tr style={{ background: "#faf8ff" }}>
                            <td colSpan={12} style={{ padding: "10px 16px 14px" }}>
                              {historyEntries.length === 0 ? (
                                <span style={{ fontSize: 12, color: "#7a8499" }}>
                                  Travel details are listed in this row. No earlier history entries were returned.
                                </span>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {historyEntries.map((entry) => (
                                    <div
                                      key={entry.key}
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        alignItems: "baseline",
                                        fontSize: 12,
                                        color: "#334155",
                                      }}
                                    >
                                      <span style={{ fontWeight: 700, color: "#6d28d9" }}>
                                        {entry.title}
                                      </span>
                                      <span style={{ color: "#64748b" }}>{entry.meta}</span>
                                      {entry.services ? (
                                        <span style={{ color: "#0f766e" }}>{entry.services}</span>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!isLoading && filtered.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "12px 16px",
                  borderTop: "1px solid #eef0f5",
                }}
              >
                <span style={{ fontSize: 12, color: "#7a8499" }}>
                  Showing {pageStart + 1}–{Math.min(pageStart + rowsPerPage, filtered.length)} of{" "}
                  {filtered.length}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <FormControl size="small">
                    <Select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      sx={{ height: 32, fontSize: 12, background: "#fff" }}
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <MenuItem key={size} value={size} style={{ fontSize: 13 }}>
                          {size} / page
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Pagination
                    count={pageCount}
                    page={safePage}
                    onChange={(_, value) => {
                      setPage(value);
                      setExpandedHistoryId("");
                    }}
                    shape="rounded"
                    color="primary"
                    size="small"
                  />
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      <TravelStatusModal
        open={travelStatusModal.open}
        status={travelStatusModal.status}
        patientId={travelStatusModal.patientId}
        patientName={travelStatusModal.patientName}
        onClose={handleCloseTravelStatusModal}
        onSubmit={handleSubmitTravelStatus}
        submitting={travelStatusSubmitting}
      />

      <style>{`@keyframes pt-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
