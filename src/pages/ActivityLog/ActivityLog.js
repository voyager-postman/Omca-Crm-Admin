import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import {
  Pagination,
  Stack,
  FormControl,
  Select,
  MenuItem,
  OutlinedInput,
  TextField,
  Autocomplete,
  Tooltip,
  IconButton,
} from "@mui/material";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { baseurl } from "../../Basurl/Baseurl";
import Loader from "../../components/Loader";
import { GetAllStaffUser } from "../../reducer/StaffSlice";
import { fetchStaffByRole, fetchCoordinators } from "../../services/coordinatorApi";
import PatientSearchSelect from "../../components/PatientSearchSelect";
import {
  buildActivityLogsExcelHtml,
  downloadActivityLogsFile,
  extractActivityLogPagination,
  extractActivityLogs,
  formatActivityLogDate,
  getActivityLogAction,
  getActivityLogDate,
  getActivityLogDescription,
  getActivityLogEmail,
  getActivityLogEntityId,
  getActivityLogEntityName,
  getActivityLogId,
  getActivityLogIp,
  getActivityLogLocation,
  getActivityLogMapUrl,
  getActivityLogModule,
  getActivityLogRole,
  getActivityLogStatus,
  getActivityLogUser,
} from "./activityLogHelpers";
import "./ActivityLog.css";

const truncateText = (text, maxLength = 45) => {
  if (!text) return "-";
  const value = String(text);
  return value.length > maxLength
    ? `${value.substring(0, maxLength)}...`
    : value;
};

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
  { value: "STATUS_CHANGE", label: "STATUS_CHANGE" },
  { value: "ASSIGN", label: "ASSIGN" },
  { value: "LOGIN", label: "LOGIN" },
  { value: "UPLOAD", label: "UPLOAD" },
];

const MODULE_OPTIONS = [
  { value: "", label: "All Modules" },
  { value: "Activity", label: "Activity Log" },
  { value: "Ambulance", label: "Ambulance Service" },
  { value: "Appointment", label: "Appointment" },
  { value: "Billing", label: "Billing & Payment" },
  { value: "Campaign", label: "Campaign Contacts" },
  { value: "Chatbot", label: "Chatbot Leads" },
  { value: "Contact", label: "Contact Us" },
  { value: "Director", label: "Director Messages" },
  { value: "Doctor Review", label: "Doctor Review" },
  { value: "Enquiry", label: "Enquiry" },
  { value: "Flight", label: "Flight Services" },
  { value: "Forex", label: "Forex Service" },
  { value: "General Enquiry", label: "General Enquiry" },
  { value: "Guest House Services", label: "Guest House Services" },
  { value: "Guest House", label: "Guest House" },
  { value: "History", label: "History" },
  { value: "Home Care", label: "Home Care / Nursing Care" },
  { value: "Test", label: "Lab Tests / Medical Tests" },
  { value: "Login", label: "Login" },
  { value: "Logout", label: "Logout" },
  { value: "Countries", label: "Manage Countries" },
  { value: "Hospitals", label: "Manage Hospitals" },
  { value: "Permission", label: "Manage Permission" },
  { value: "Roles", label: "Manage Roles" },
  { value: "Services", label: "Manage Services" },
  { value: "Treatments", label: "Manage Treatments" },
  { value: "Medical Escort", label: "Medical Escort" },
  { value: "Medical Visa", label: "Medical Visa" },
  { value: "Messages", label: "Messages" },
  { value: "Orders", label: "Orders" },
  { value: "Patient Travel", label: "Patient Travel" },
  { value: "Patient", label: "Patient" },
  { value: "Payment Data", label: "Payment Data" },
  { value: "Physiotherapy", label: "Physiotherapy" },
  { value: "Pick", label: "Pick & Drop" },
  { value: "Referral", label: "Referral" },
  { value: "Reports", label: "Reports" },
  { value: "SOS", label: "SOS & Emergency" },
  { value: "Staff", label: "Staff / User" },
  { value: "Treatment Estimate", label: "Treatment Estimate" },
  { value: "VIL", label: "VIL" },
];

const BASE_ROLE_OPTIONS = [
  "Admin",
  "Coordinator",
  "Doctor",
  "Driver",
  "Lead Generator",
  "Manager",
  "Nurse",
  "Physiotherapist",
  "Receptionist",
  "Staff",
  "Super Admin",
  "Supervisor",
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;
const EXPORT_LIMIT = 1000;

const autocompleteSx = {
  "& .MuiInputBase-root": { height: 40, backgroundColor: "#fff" },
  "& .MuiInputBase-input": { padding: "6px 12px", fontSize: "13px" },
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const getStaffId = (staff) =>
  staff?._id ?? staff?.id ?? staff?.userId ?? staff?.user_id ?? "";
const getStaffName = (staff) =>
  staff?.name ?? staff?.userName ?? staff?.fullName ?? staff?.email ?? "";
const getStaffRole = (staff) =>
  staff?.role ??
  staff?.user_role ??
  staff?.userRole ??
  staff?.designation ??
  "";

const getActionBadgeClass = (action) => {
  const act = String(action || "").toUpperCase().trim();
  switch (act) {
    case "CREATE":
      return "badge-action badge-action-create";
    case "UPDATE":
      return "badge-action badge-action-update";
    case "DELETE":
      return "badge-action badge-action-delete";
    case "STATUS_CHANGE":
      return "badge-action badge-action-status_change";
    case "ASSIGN":
      return "badge-action badge-action-assign";
    case "LOGIN":
      return "badge-action badge-action-login";
    case "UPLOAD":
      return "badge-action badge-action-upload";
    default:
      return "badge-action badge-action-default";
  }
};

export default function ActivityLog() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { staff } = useSelector((state) => state.staff);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [role, setRole] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [action, setAction] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isToday, setIsToday] = useState(false);

  // Debounce keyword search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const [allStaffList, setAllStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [dynamicRoles, setDynamicRoles] = useState([]);

  // Load comprehensive staff list & roles across all roles
  useEffect(() => {
    let isMounted = true;

    // Trigger Redux staff fetch safely in background
    try {
      dispatch(GetAllStaffUser({ page: 1, limit: 100 }));
    } catch (e) {}

    const loadAllStaffMembers = async () => {
      setLoadingStaff(true);
      try {
        const headers = authHeaders();

        // Concurrently query:
        // 1. All registered staff users with high limit
        // 2. All care staff across all roles via coordinator service
        // 3. Coordinators specifically
        // 4. Dynamic roles from CRM
        const results = await Promise.allSettled([
          axios.get(`${baseurl}get_all_user_staffs?page=1&limit=1000`, { headers }),
          fetchStaffByRole(""),
          fetchCoordinators(),
          axios.get(`${baseurl}getAllRoles`, { headers }),
        ]);

        const combined = [];
        const seenIds = new Set();
        const seenEmails = new Set();

        const addStaffItem = (item) => {
          if (!item || typeof item !== "object") return;
          const id = String(getStaffId(item) || "").trim();
          const email = String(item.email || "").trim().toLowerCase();
          const name = String(getStaffName(item) || "").trim();
          if (!name && !email && !id) return;

          const idKey = id ? `id:${id}` : "";
          const emailKey = email ? `email:${email}` : "";
          if (idKey && seenIds.has(idKey)) return;
          if (emailKey && seenEmails.has(emailKey)) return;

          if (idKey) seenIds.add(idKey);
          if (emailKey) seenEmails.add(emailKey);

          const r = getStaffRole(item);
          combined.push({
            ...item,
            _id: id || item._id,
            id: id || item.id,
            userId: id || item.userId || item.user_id,
            name: name,
            userName: name,
            fullName: name,
            role: r,
            email: email,
            phone: item.phone || item.phone_no || item.contactNumber || "",
          });
        };

        // Source 1: get_all_user_staffs
        if (results[0].status === "fulfilled") {
          const resData = results[0].value?.data;
          const list =
            resData?.details ||
            resData?.data ||
            resData?.staff ||
            (Array.isArray(resData) ? resData : []);
          if (Array.isArray(list)) {
            list.forEach(addStaffItem);
          }
        }

        // Source 2: fetchStaffByRole("")
        if (results[1].status === "fulfilled") {
          const list = results[1].value;
          if (Array.isArray(list)) {
            list.forEach(addStaffItem);
          }
        }

        // Source 3: fetchCoordinators()
        if (results[2].status === "fulfilled") {
          const list = results[2].value;
          if (Array.isArray(list)) {
            list.forEach(addStaffItem);
          }
        }

        // Fallback: Redux staff
        if (Array.isArray(staff) && staff.length > 0) {
          staff.forEach(addStaffItem);
        }

        // Source 4: Dynamic roles
        if (results[3].status === "fulfilled") {
          const rolesData =
            results[3].value?.data?.data || results[3].value?.data;
          if (Array.isArray(rolesData)) {
            const roleNames = rolesData
              .map((r) => (typeof r === "string" ? r : r?.role || r?.name))
              .filter(Boolean);
            if (isMounted) setDynamicRoles(roleNames);
          }
        }

        // Sort alphabetically by staff name
        combined.sort((a, b) => {
          const nameA = String(getStaffName(a) || "").toLowerCase();
          const nameB = String(getStaffName(b) || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });

        if (isMounted && combined.length > 0) {
          setAllStaffList(combined);
        }
      } catch (err) {
        console.error("Failed to load all staff for activity log:", err);
      } finally {
        if (isMounted) setLoadingStaff(false);
      }
    };

    loadAllStaffMembers();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const rawStaffList = useMemo(() => {
    if (allStaffList.length > 0) return allStaffList;
    if (Array.isArray(staff) && staff.length > 0) return staff;
    return [];
  }, [allStaffList, staff]);

  const staffOptions = useMemo(() => {
    let list = rawStaffList;
    if (role) {
      const targetRole = role.trim().toLowerCase();
      list = rawStaffList.filter((s) => {
        const r = String(getStaffRole(s) || "").trim().toLowerCase();
        return r === targetRole;
      });
      // Ensure currently selected staff remains in options so Autocomplete value is preserved
      if (
        selectedStaff &&
        !list.some(
          (item) =>
            String(getStaffId(item)) === String(getStaffId(selectedStaff)),
        )
      ) {
        list = [selectedStaff, ...list];
      }
    }
    return list;
  }, [rawStaffList, role, selectedStaff]);

  const roleOptions = useMemo(() => {
    const set = new Set([...BASE_ROLE_OPTIONS, ...dynamicRoles]);
    rawStaffList.forEach((s) => {
      const r = getStaffRole(s);
      if (r && typeof r === "string" && r.trim()) {
        set.add(r.trim());
      }
    });
    if (Array.isArray(rows)) {
      rows.forEach((log) => {
        const r = getActivityLogRole(log);
        if (r && typeof r === "string" && r.trim() && r !== "-") {
          set.add(r.trim());
        }
      });
    }
    return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [dynamicRoles, rawStaffList, rows]);

  const filterUserId = getStaffId(selectedStaff);
  const patientId =
    selectedPatient?.patientId || selectedPatient?.patientNumber || "";

  /**
   * Build query parameters matching the Activity Logs API Reference:
   * GET /get_activity_logs
   * - userId (or filterUserId, staffId): filter logs by staff member
   * - fromDate: filter from start of day (YYYY-MM-DD)
   * - toDate: filter up to end of day (YYYY-MM-DD)
   * - today: today=true shortcut
   * - search (or q): keyword search
   * - module: module name
   * - action: CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSIGN, LOGIN, UPLOAD
   * - patientId: filter logs by patient
   * - role: filter logs by role
   * - page, limit: pagination
   */
  const buildParams = useCallback(
    ({ page: pageNum, limit: limitNum }) => {
      const params = {
        page: pageNum,
        limit: limitNum || pageSize,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (filterUserId) {
        params.userId = filterUserId;
        params.filterUserId = filterUserId;
        params.staffId = filterUserId;
      }

      if (role) {
        params.role = role;
      }

      if (moduleName) {
        params.module = moduleName;
      }

      if (action) {
        params.action = action;
      }

      if (patientId) {
        params.patientId = patientId;
      }

      if (isToday) {
        params.today = true;
      } else {
        if (fromDate) {
          params.fromDate = fromDate;
        }
        if (toDate) {
          params.toDate = toDate;
        }
      }

      return params;
    },
    [
      debouncedSearch,
      filterUserId,
      role,
      moduleName,
      action,
      patientId,
      isToday,
      fromDate,
      toDate,
      pageSize,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${baseurl}get_activity_logs`, {
          headers: authHeaders(),
          signal: controller.signal,
          params: buildParams({ page, limit: pageSize }),
        });

        const logs = extractActivityLogs(response.data);
        const pagination = extractActivityLogPagination(
          response.data,
          pageSize,
        );
        const pages = Math.max(1, pagination.totalPages || 1);

        setRows(logs);
        setTotalPages(pages);
        setTotalRecords(pagination.totalRecords || logs.length);

        if (page > pages) {
          setPage(pages);
        }
      } catch (error) {
        if (
          error?.name === "CanceledError" ||
          error?.code === "ERR_CANCELED"
        ) {
          return;
        }
        setRows([]);
        setTotalPages(1);
        setTotalRecords(0);
        toast.error(
          error.response?.data?.message || "Failed to fetch activity logs",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [page, pageSize, buildParams]);

  // Handlers
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleStaffChange = (_, value) => {
    setSelectedStaff(value);
    setPage(1);
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
    setPage(1);
  };

  const handleModuleChange = (e) => {
    setModuleName(e.target.value);
    setPage(1);
  };

  const handleActionChange = (e) => {
    setAction(e.target.value);
    setPage(1);
  };

  const handlePatientChange = (value) => {
    setSelectedPatient(value);
    setPage(1);
  };

  const handleFromDateChange = (e) => {
    setFromDate(e.target.value);
    setIsToday(false);
    setPage(1);
  };

  const handleToDateChange = (e) => {
    setToDate(e.target.value);
    setIsToday(false);
    setPage(1);
  };

  const handleTodayToggle = () => {
    if (!isToday) {
      setIsToday(true);
      setFromDate("");
      setToDate("");
    } else {
      setIsToday(false);
    }
    setPage(1);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedStaff(null);
    setRole("");
    setModuleName("");
    setAction("");
    setSelectedPatient(null);
    setFromDate("");
    setToDate("");
    setIsToday(false);
    setPage(1);
  };

  const handlePageChange = (_, value) => {
    setPage(value);
  };

  const handleViewDetail = (log) => {
    const id = getActivityLogId(log);
    if (id) {
      navigate("/Admin/activity-log-detail", { state: { activityId: id } });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${baseurl}get_activity_logs`, {
        headers: authHeaders(),
        params: buildParams({ page: 1, limit: EXPORT_LIMIT }),
      });
      const logs = extractActivityLogs(response.data);

      if (!logs.length) {
        toast.info("No activity logs available to export");
        return;
      }

      const excelHtml = `\uFEFF${buildActivityLogsExcelHtml(logs)}`;
      const stamp = new Date().toISOString().slice(0, 10);
      downloadActivityLogsFile(
        excelHtml,
        `activity-logs-${stamp}.xls`,
        "application/vnd.ms-excel;charset=utf-8;",
      );
      toast.success("Activity logs exported to Excel");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to export activity logs",
      );
    } finally {
      setExporting(false);
    }
  };

  const activeFilters = useMemo(() => {
    const list = [];
    if (debouncedSearch.trim()) {
      list.push({
        key: "search",
        label: `Search: "${debouncedSearch.trim()}"`,
        onRemove: () => {
          setSearch("");
          setDebouncedSearch("");
          setPage(1);
        },
      });
    }
    if (selectedStaff) {
      list.push({
        key: "staff",
        label: `Staff: ${getStaffName(selectedStaff)}`,
        onRemove: () => {
          setSelectedStaff(null);
          setPage(1);
        },
      });
    }
    if (role) {
      list.push({
        key: "role",
        label: `Role: ${role}`,
        onRemove: () => {
          setRole("");
          setPage(1);
        },
      });
    }
    if (moduleName) {
      const matched = MODULE_OPTIONS.find((opt) => opt.value === moduleName);
      list.push({
        key: "module",
        label: `Module: ${matched?.label || moduleName}`,
        onRemove: () => {
          setModuleName("");
          setPage(1);
        },
      });
    }
    if (action) {
      list.push({
        key: "action",
        label: `Action: ${action}`,
        onRemove: () => {
          setAction("");
          setPage(1);
        },
      });
    }
    if (patientId) {
      list.push({
        key: "patient",
        label: `Patient: ${patientId}`,
        onRemove: () => {
          setSelectedPatient(null);
          setPage(1);
        },
      });
    }
    if (isToday) {
      list.push({
        key: "today",
        label: "Date: Today",
        onRemove: () => {
          setIsToday(false);
          setPage(1);
        },
      });
    } else {
      if (fromDate && toDate) {
        list.push({
          key: "date",
          label: `Date: ${fromDate} to ${toDate}`,
          onRemove: () => {
            setFromDate("");
            setToDate("");
            setPage(1);
          },
        });
      } else if (fromDate) {
        list.push({
          key: "fromDate",
          label: `From: ${fromDate}`,
          onRemove: () => {
            setFromDate("");
            setPage(1);
          },
        });
      } else if (toDate) {
        list.push({
          key: "toDate",
          label: `To: ${toDate}`,
          onRemove: () => {
            setToDate("");
            setPage(1);
          },
        });
      }
    }
    return list;
  }, [
    debouncedSearch,
    selectedStaff,
    role,
    moduleName,
    action,
    patientId,
    isToday,
    fromDate,
    toDate,
  ]);

  const hasActiveFilters = activeFilters.length > 0;
  const rangeStart = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalRecords);

  return (
    <div className="page-wrapper activity-log-page">
      <div className="content">
        <div className="row gx-3">
          {/* Header */}
          <div className="col-md-12">
            <div className="country-top">
              <div className="topmainhd mb-0">
                <h6 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <i className="fa fa-list-alt text-primary" />
                  Activity Log
                </h6>
              </div>
              <div className="search-btn-main">
                <button
                  type="button"
                  className="add-button"
                  disabled={exporting || loading}
                  onClick={handleExport}
                >
                  <i className="fa fa-file-excel-o me-2" />
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>
              </div>
            </div>
          </div>

          {/* Filter Card */}
          <div className="col-md-12">
            <div className="filter-card mb-3">
              <div className="filter-title">
                <i className="fa fa-filter text-primary" />
                <span>Filter Activity Logs</span>
                {hasActiveFilters && (
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#0ba6df",
                      backgroundColor: "rgba(11, 166, 223, 0.1)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    {activeFilters.length} active filter
                    {activeFilters.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Row 1: Search, Staff, Role, Module */}
              <div className="row gx-3 gy-3 align-items-end">
                {/* Search Keyword */}
                <div className="col-lg-3 col-md-6">
                  <span className="field-label">Search Keyword</span>
                  <div className="filter-input-wrap">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Keyword (description, user, patient ID)..."
                      value={search}
                      onChange={handleSearchChange}
                    />
                    {search ? (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={handleClearSearch}
                        title="Clear search"
                      >
                        <i className="fa fa-times" />
                      </button>
                    ) : (
                      <span
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#9ca3af",
                          pointerEvents: "none",
                        }}
                      >
                        <i className="fa fa-search" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Staff Member */}
                <div className="col-lg-3 col-md-6">
                  <span className="field-label">Staff Member</span>
                  <Autocomplete
                    options={staffOptions}
                    value={selectedStaff}
                    getOptionLabel={(option) => {
                      if (!option) return "";
                      const name = getStaffName(option);
                      const r = getStaffRole(option);
                      return name ? (r ? `${name} (${r})` : name) : "";
                    }}
                    filterOptions={(options, { inputValue }) => {
                      const query = (inputValue || "").trim().toLowerCase();
                      if (!query) return options;
                      return options.filter((option) => {
                        const name = String(getStaffName(option) || "").toLowerCase();
                        const r = String(getStaffRole(option) || "").toLowerCase();
                        const email = String(option?.email || "").toLowerCase();
                        const phone = String(
                          option?.phone || option?.phone_no || "",
                        ).toLowerCase();
                        return (
                          name.includes(query) ||
                          r.includes(query) ||
                          email.includes(query) ||
                          phone.includes(query)
                        );
                      });
                    }}
                    isOptionEqualToValue={(option, value) => {
                      if (!option || !value) return false;
                      const optId = String(getStaffId(option) || "");
                      const valId = String(getStaffId(value) || "");
                      if (optId && valId && optId === valId) return true;
                      const optEmail = String(option?.email || "").toLowerCase();
                      const valEmail = String(value?.email || "").toLowerCase();
                      if (optEmail && valEmail && optEmail === valEmail) return true;
                      return false;
                    }}
                    onChange={handleStaffChange}
                    loading={loadingStaff}
                    noOptionsText={loadingStaff ? "Loading staff members..." : "No staff found"}
                    ListboxProps={{ style: { maxHeight: 300 } }}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      const name = getStaffName(option) || "Unnamed Staff";
                      const staffRole = getStaffRole(option);
                      const email = option?.email || "";
                      const optKey = key || getStaffId(option) || `${name}-${email}`;
                      return (
                        <li key={optKey} {...otherProps}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              width: "100%",
                              padding: "2px 0",
                            }}
                          >
                            <div style={{ minWidth: 0, marginRight: "8px" }}>
                              <div
                                style={{
                                  fontWeight: 500,
                                  fontSize: "13px",
                                  color: "#1f2937",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {name}
                              </div>
                              {email && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#6b7280",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {email}
                                </div>
                              )}
                            </div>
                            {staffRole && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  backgroundColor: "#f3f4f6",
                                  color: "#374151",
                                  fontWeight: 500,
                                  flexShrink: 0,
                                }}
                              >
                                {staffRole}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder="All Staff Members"
                        sx={autocompleteSx}
                      />
                    )}
                  />
                </div>

                {/* Role */}
                <div className="col-lg-3 col-md-6">
                  <span className="field-label">Role</span>
                  <FormControl fullWidth size="small">
                    <Select
                      value={role}
                      onChange={handleRoleChange}
                      displayEmpty
                      input={<OutlinedInput />}
                      sx={{ height: 40, backgroundColor: "#fff", fontSize: "13px" }}
                    >
                      <MenuItem value="">All Roles</MenuItem>
                      {roleOptions
                        .filter(Boolean)
                        .map((r) => (
                          <MenuItem key={r} value={r}>
                            {r}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </div>

                {/* Module */}
                <div className="col-lg-3 col-md-6">
                  <span className="field-label">Module</span>
                  <FormControl fullWidth size="small">
                    <Select
                      value={moduleName}
                      onChange={handleModuleChange}
                      displayEmpty
                      input={<OutlinedInput />}
                      sx={{ height: 40, backgroundColor: "#fff", fontSize: "13px" }}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 360,
                          },
                        },
                      }}
                    >
                      {MODULE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value || "all"} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>

                {/* Row 2: Action, Patient, Date Range / Today, Controls */}
                {/* Action */}
                <div className="col-lg-2 col-md-6">
                  <span className="field-label">Action</span>
                  <FormControl fullWidth size="small">
                    <Select
                      value={action}
                      onChange={handleActionChange}
                      displayEmpty
                      input={<OutlinedInput />}
                      sx={{ height: 40, backgroundColor: "#fff", fontSize: "13px" }}
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value || "all"} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>

                {/* Patient Search */}
                <div className="col-lg-3 col-md-6">
                  <span className="field-label">Patient</span>
                  <PatientSearchSelect
                    value={selectedPatient}
                    onChange={handlePatientChange}
                    placeholder="Search patient by name or ID"
                  />
                </div>

                {/* From Date */}
                <div className="col-lg-2 col-md-4 col-sm-6">
                  <span className="field-label">From Date</span>
                  <input
                    type="date"
                    className="date-input"
                    value={fromDate}
                    onChange={handleFromDateChange}
                    disabled={isToday}
                  />
                </div>

                {/* To Date */}
                <div className="col-lg-2 col-md-4 col-sm-6">
                  <span className="field-label">To Date</span>
                  <input
                    type="date"
                    className="date-input"
                    value={toDate}
                    onChange={handleToDateChange}
                    disabled={isToday}
                  />
                </div>

                {/* Quick Today & Clear Filter Buttons */}
                <div className="col-lg-3 col-md-4 col-sm-12 d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className={`today-pill-btn flex-grow-1 ${isToday ? "active" : ""}`}
                    onClick={handleTodayToggle}
                    title="Quick filter for today's activity logs"
                  >
                    <i className="fa fa-calendar-check-o" />
                    Today Only
                  </button>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="add-button"
                      style={{
                        height: 40,
                        backgroundColor: "#f43f5e",
                        borderColor: "#f43f5e",
                        padding: "0 14px",
                        whiteSpace: "nowrap",
                      }}
                      onClick={handleClearFilters}
                      title="Clear all filters"
                    >
                      <i className="fa fa-eraser me-1" />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <div className="applied-chips-wrap">
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                    Active Filters:
                  </span>
                  {activeFilters.map((filter) => (
                    <span key={filter.key} className="filter-chip">
                      {filter.label}
                      <button
                        type="button"
                        className="filter-chip-remove"
                        onClick={filter.onRemove}
                        title={`Remove ${filter.label}`}
                      >
                        <i className="fa fa-times" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#dc2626",
                      fontSize: "12px",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: "2px 6px",
                      fontWeight: 600,
                    }}
                  >
                    Reset All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="col-md-12">
            <div className="main_content">
              {/* Table meta info bar */}
              <div className="d-flex justify-content-between align-items-center mb-2 px-1 flex-wrap gap-2">
                <small className="text-muted" style={{ fontWeight: 500 }}>
                  {loading
                    ? "Loading activity logs..."
                    : totalRecords > 0
                      ? `Showing ${rangeStart}-${rangeEnd} of ${totalRecords} activity logs`
                      : "No activity logs found"}
                </small>

                <div className="d-flex align-items-center gap-2">
                  <small className="text-muted">Rows per page:</small>
                  <FormControl size="small">
                    <Select
                      value={pageSize}
                      onChange={handlePageSizeChange}
                      sx={{ height: 32, fontSize: "12px", backgroundColor: "#fff" }}
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <MenuItem key={size} value={size}>
                          {size}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
              </div>

              <div className="table-responsive">
                <TableContainer component={Paper}>
                  <Table stickyHeader className="table-no-card activity-log-table">
                    <TableHead>
                      <TableRow>
                        <TableCell style={{ width: "60px" }}>Sr.No.</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Module</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell style={{ minWidth: "150px" }}>Date/Time</TableCell>
                        <TableCell>IP Address</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell align="center" style={{ width: "80px" }}>
                          View
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    {loading ? (
                      <Loader />
                    ) : (
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} align="center" style={{ padding: "40px 16px" }}>
                              <div style={{ color: "#64748b" }}>
                                <i
                                  className="fa fa-folder-open-o"
                                  style={{ fontSize: "32px", marginBottom: "8px", display: "block" }}
                                />
                                <div style={{ fontWeight: 600, fontSize: "14px" }}>
                                  No activity logs found
                                </div>
                                <small>
                                  {hasActiveFilters
                                    ? "Try adjusting or clearing your filters to see more results."
                                    : "There are no activity logs recorded yet."}
                                </small>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          rows.map((log, index) => {
                            const user = getActivityLogUser(log);
                            const roleName = getActivityLogRole(log);
                            const email = getActivityLogEmail(log);
                            const actionName = getActivityLogAction(log);
                            const moduleVal = getActivityLogModule(log);
                            const description = getActivityLogDescription(log);
                            const entityIdVal = getActivityLogEntityId(log);
                            const entityNameVal = getActivityLogEntityName(log);
                            const statusVal = getActivityLogStatus(log);
                            const locText = getActivityLogLocation(log);
                            const mapUrl = getActivityLogMapUrl(log);
                            const logId = getActivityLogId(log);

                            return (
                              <TableRow
                                key={logId || index}
                                hover
                                style={{ cursor: logId ? "pointer" : "default" }}
                                onClick={() => logId && handleViewDetail(log)}
                              >
                                {/* Sr.No. */}
                                <TableCell>
                                  {(page - 1) * pageSize + index + 1}
                                </TableCell>

                                {/* User & Role */}
                                <TableCell>
                                  <div className="activity-user-cell" title={email !== "-" ? email : user}>
                                    <span className="activity-user-name">
                                      {truncateText(user, 26)}
                                    </span>
                                    {roleName && roleName !== "-" && (
                                      <span className="badge-role">
                                        {roleName}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>

                                {/* Action */}
                                <TableCell>
                                  <span className={getActionBadgeClass(actionName)}>
                                    {actionName}
                                  </span>
                                </TableCell>

                                {/* Module */}
                                <TableCell>
                                  <span className="badge-module">
                                    {truncateText(moduleVal, 22)}
                                  </span>
                                </TableCell>

                                {/* Description */}
                                <TableCell title={description}>
                                  <div>
                                    {truncateText(description, 60)}
                                    {(entityIdVal || entityNameVal) && (
                                      <div>
                                        <span className="badge-entity" title={entityNameVal || entityIdVal}>
                                          <i className="fa fa-tag me-1" />
                                          {entityIdVal}
                                          {entityNameVal ? ` (${truncateText(entityNameVal, 16)})` : ""}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                  {statusVal && statusVal !== "-" ? (
                                    <span
                                      className={
                                        String(statusVal).toLowerCase() === "success"
                                          ? "badge-status-success"
                                          : "badge-role"
                                      }
                                    >
                                      {statusVal}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>

                                {/* Date/Time */}
                                <TableCell style={{ whiteSpace: "nowrap" }}>
                                  <span style={{ fontSize: "12px", color: "#334155" }}>
                                    <i className="fa fa-clock-o me-1 text-muted" />
                                    {log?.formattedDate || formatActivityLogDate(getActivityLogDate(log))}
                                  </span>
                                </TableCell>

                                {/* IP Address */}
                                <TableCell title={getActivityLogIp(log)}>
                                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#475569" }}>
                                    {truncateText(getActivityLogIp(log), 18)}
                                  </span>
                                </TableCell>

                                {/* Location */}
                                <TableCell
                                  onClick={(e) => {
                                    if (mapUrl) e.stopPropagation();
                                  }}
                                >
                                  {(() => {
                                    if (!locText || locText === "-" || locText === "—") {
                                      return "-";
                                    }

                                    if (mapUrl) {
                                      return (
                                        <a
                                          href={mapUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "5px",
                                            color: "#1e40af",
                                            fontWeight: 600,
                                            fontSize: "12px",
                                            textDecoration: "none",
                                            padding: "3px 8px",
                                            borderRadius: "4px",
                                            backgroundColor: "rgba(30, 64, 175, 0.08)",
                                            transition: "all 0.2s ease",
                                          }}
                                          title={`Click to open ${locText} in Google Maps`}
                                        >
                                          <i
                                            className="fa fa-map-marker"
                                            style={{
                                              color: "#ef4444",
                                              fontSize: "13px",
                                            }}
                                          />
                                          <span>{truncateText(locText, 20)}</span>
                                          <i
                                            className="fa fa-external-link"
                                            style={{
                                              fontSize: "10px",
                                              opacity: 0.6,
                                            }}
                                          />
                                        </a>
                                      );
                                    }

                                    return truncateText(locText, 22);
                                  })()}
                                </TableCell>

                                {/* View Detail Icon */}
                                <TableCell
                                  align="center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetail(log);
                                  }}
                                >
                                  <Tooltip title="View full activity details">
                                    <IconButton
                                      size="small"
                                      style={{
                                        color: "#0ba6df",
                                        backgroundColor: "rgba(11, 166, 223, 0.08)",
                                      }}
                                    >
                                      <i className="fa fa-eye" style={{ fontSize: "13px" }} />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    )}
                  </Table>

                  {!loading && totalPages > 1 ? (
                    <Stack spacing={2} className="p-3">
                      <Pagination
                        className="page-nation"
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                      />
                    </Stack>
                  ) : null}
                </TableContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
