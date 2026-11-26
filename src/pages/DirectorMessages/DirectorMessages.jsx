import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { baseurl } from "../../Basurl/Baseurl";
import {
  canManageDirectorMessages,
  createDirectorMessage,
  deleteDirectorMessage,
  dismissDirectorMessage,
  fetchDirectorMessageById,
  fetchDirectorMessages,
  fetchDirectorMessageStats,
  formatFileSize,
  formatMessageDate,
  getPriorityBadgeProps,
  updateDirectorMessage,
} from "../../services/directorMessagesApi";
import { markRecordRead } from "../../services/unreadApi";
import { UnreadDot } from "../../components/NewTag";
import { onDirectorMessage } from "../../services/sosSocket";
import DirectorMessageModal from "../../components/DirectorMessages/DirectorMessageModal";
import "../../components/DirectorMessages/DirectorMessages.css";
import {
  DIRECTOR_MESSAGES_PERMISSIONS,
  hasAnyDashboardPermission,
} from "../../utils/sosPermissions";

const DEFAULT_ROLES = [
  "Coordinator",
  "Supervisor",
  "Operations Manager",
  "Director",
  "Admin",
  "Super Admin",
  "Receptionist",
  "Doctor",
  "Nurse",
  "Accountant",
  "Pharmacy",
  "Hospital",
  "Foundation",
  "Referral",
  "Legal",
  "Driver",
  "Guest House",
];

export default function DirectorMessages() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem("Role") || "";
  const permissions = localStorage.getItem("permissionArray") || "";
  const canAccess =
    String(userRole).toLowerCase() === "admin" ||
    hasAnyDashboardPermission(permissions, DIRECTOR_MESSAGES_PERMISSIONS, userRole);

  useEffect(() => {
    if (!canAccess) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [canAccess, navigate]);

  // Strictly "Admin" only (not Super Admin). All other staff have view-only access
  const isAdmin = useMemo(() => canManageDirectorMessages(userRole), [userRole]);

  // Listing state
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals state
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Broadcast Modal State
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);

  const [formTitle, setFormTitle] = useState("Message from Director");
  const [formMessage, setFormMessage] = useState("");
  const [formPriority, setFormPriority] = useState("SOS");
  const [formTargetType, setFormTargetType] = useState("ALL");
  const [formTargetRoles, setFormTargetRoles] = useState([]);
  const [formTargetUsers, setFormTargetUsers] = useState([]);
  const [formIsPopup, setFormIsPopup] = useState(true);
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formAttachments, setFormAttachments] = useState([]);

  // Roles & Staff users state for dynamic targeting
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [staffUsers, setStaffUsers] = useState([]);

  // Stats Modal State
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsSearch, setStatsSearch] = useState("");

  // Load dynamic roles and staff users from APIs
  const loadRolesAndStaff = useCallback(async () => {
    setRolesLoading(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch from getAllRoles (Manage Roles)
      let apiRoles = [];
      try {
        const res = await axios.get(`${baseurl}getAllRoles`, { headers });
        const list = res?.data?.data || res?.data?.roles || res?.data || [];
        if (Array.isArray(list)) {
          apiRoles = list
            .map((item) =>
              typeof item === "string" ? item : item?.role || item?.name || ""
            )
            .filter(Boolean);
        }
      } catch (err) {
        console.warn("Could not fetch getAllRoles:", err?.message);
      }

      // 2. Fetch from get_all_user_staffs (All staff members)
      let staffRoles = [];
      try {
        const resStaff = await axios.get(`${baseurl}get_all_user_staffs`, { params: { page: 1, limit: 10 }, headers });
        const users = resStaff?.data?.Details || resStaff?.data?.details || [];
        if (Array.isArray(users)) {
          setStaffUsers(users);
          staffRoles = users.map((u) => u?.role).filter(Boolean);
        }
      } catch (err) {
        console.warn("Could not fetch staff users:", err?.message);
      }

      // 3. Fetch from get_all_endPoints (Permissions endpoints)
      let permRoles = [];
      try {
        const resPerm = await axios.get(`${baseurl}get_all_endPoints`, { headers });
        const eps = resPerm?.data?.endPoints || [];
        if (Array.isArray(eps)) {
          permRoles = eps.map((ep) => ep?.role).filter(Boolean);
        }
      } catch (err) {
        // optional endpoint
      }

      // 4. Combine all sources and deduplicate case-insensitively
      const allFound = [
        ...apiRoles,
        ...staffRoles,
        ...permRoles,
        ...DEFAULT_ROLES,
      ];

      const roleMap = new Map();
      allFound.forEach((r) => {
        const trimmed = String(r || "").trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!roleMap.has(key)) {
          roleMap.set(key, trimmed);
        }
      });

      const uniqueRoles = Array.from(roleMap.values()).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );

      setAvailableRoles(uniqueRoles);
    } catch (err) {
      console.error("Failed to load roles for Director Messages:", err);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadRolesAndStaff();
    }
  }, [isAdmin, loadRolesAndStaff]);

  // Fetch messages from API 4
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDirectorMessages({
        page,
        limit,
        search,
        priority: priorityFilter,
        status: statusFilter,
      });

      const data = res?.data || [];
      setMessages(Array.isArray(data) ? data : []);
      if (res?.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } catch (err) {
      console.error("Failed to load director messages:", err);
      Swal.fire("Error", "Could not fetch director messages.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, priorityFilter, statusFilter]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time Socket.IO: Prepend new message if emitted
  useEffect(() => {
    const unsubscribe = onDirectorMessage((newMsg) => {
      if (!newMsg) return;
      console.log("Realtime director message received on page:", newMsg);
      setMessages((prev) => {
        // Prevent duplicate
        const exists = prev.some((m) => String(m._id) === String(newMsg._id));
        if (exists) return prev;
        return [newMsg, ...prev];
      });
      setTotalCount((c) => c + 1);
    });

    const handleDismissedEvent = (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id)
            ? { ...m, isDismissed: true, isRead: true }
            : m
        )
      );
    };

    window.addEventListener("omca:director-message-dismissed", handleDismissedEvent);

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      window.removeEventListener("omca:director-message-dismissed", handleDismissedEvent);
    };
  }, []);

  // Open Message Details
  const handleOpenDetails = async (msg) => {
    setSelectedMessage(msg);
    setIsDetailModalOpen(true);
    if (msg?._id) markRecordRead("directorMessages", msg._id);
    // Fetch single message details via API 5 to mark read on backend
    if (msg?._id) {
      try {
        const fullMsg = await fetchDirectorMessageById(msg._id);
        if (fullMsg) {
          setSelectedMessage(fullMsg);
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id) === String(msg._id) ? { ...m, isRead: true } : m
            )
          );
        }
      } catch (err) {
        console.warn("Failed to fetch message details:", err);
      }
    }
  };

  // Dismiss message via API 3
  const handleDismissMessage = async (id) => {
    try {
      await dismissDirectorMessage(id);
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id)
            ? { ...m, isDismissed: true, isRead: true }
            : m
        )
      );
      Swal.fire({
        icon: "success",
        title: "Dismissed",
        text: "Message marked as read and dismissed.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed to dismiss message:", err);
      Swal.fire("Error", "Could not dismiss message.", "error");
    }
  };

  // Delete message via API 8 (Admin Only)
  const handleDeleteMessage = async (id) => {
    const result = await Swal.fire({
      title: "Delete Announcement?",
      text: "This message will be removed from all staff dashboards.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it",
    });

    if (result.isConfirmed) {
      try {
        await deleteDirectorMessage(id);
        setMessages((prev) => prev.filter((m) => String(m._id) !== String(id)));
        setTotalCount((c) => Math.max(0, c - 1));
        Swal.fire("Deleted!", "The announcement has been deleted.", "success");
      } catch (err) {
        console.error("Failed to delete message:", err);
        Swal.fire("Error", "Could not delete message.", "error");
      }
    }
  };

  // Open Engagement Stats Modal (Admin Only)
  const handleOpenStats = async (id) => {
    setIsStatsModalOpen(true);
    setStatsLoading(true);
    try {
      const stats = await fetchDirectorMessageStats(id);
      setStatsData(stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      Swal.fire("Error", "Could not load engagement stats.", "error");
      setIsStatsModalOpen(false);
    } finally {
      setStatsLoading(false);
    }
  };

  // Open Broadcast / Create Modal
  const handleOpenBroadcastModal = (msgToEdit = null) => {
    setRoleSearchQuery("");
    setUserSearchQuery("");
    setUserRoleFilter("ALL");
    if (isAdmin) {
      loadRolesAndStaff();
    }
    if (msgToEdit) {
      setEditingMessageId(msgToEdit._id);
      setFormTitle(msgToEdit.title || "Message from Director");
      setFormMessage(msgToEdit.message || "");
      setFormPriority(msgToEdit.priority || "SOS");
      setFormTargetType(msgToEdit.targetType || "ALL");
      setFormTargetRoles(
        Array.isArray(msgToEdit.targetRoles) ? msgToEdit.targetRoles : []
      );
      setFormTargetUsers(
        Array.isArray(msgToEdit.targetUsers) ? msgToEdit.targetUsers : []
      );
      setFormIsPopup(msgToEdit.isPopup ?? true);
      setFormExpiresAt(
        msgToEdit.expiresAt ? msgToEdit.expiresAt.substring(0, 16) : ""
      );
      setFormAttachments([]);
    } else {
      setEditingMessageId(null);
      setFormTitle("Message from Director");
      setFormMessage("");
      setFormPriority("SOS");
      setFormTargetType("ALL");
      setFormTargetRoles([]);
      setFormTargetUsers([]);
      setFormIsPopup(true);
      setFormExpiresAt("");
      setFormAttachments([]);
    }
    setIsBroadcastModalOpen(true);
  };

  // Handle Attachment Selection (up to 10 files)
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (formAttachments.length + selected.length > 10) {
      Swal.fire(
        "Limit Exceeded",
        "You can attach up to 10 files per announcement.",
        "warning"
      );
      return;
    }
    setFormAttachments((prev) => [...prev, ...selected]);
  };

  const handleRemoveAttachment = (index) => {
    setFormAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Broadcast / Update Form
  const handleSubmitBroadcast = async (e) => {
    e.preventDefault();
    if (!formMessage.trim()) {
      Swal.fire("Missing Content", "Please enter the announcement message.", "warning");
      return;
    }

    setBroadcastLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", formTitle.trim());
      formData.append("message", formMessage.trim());
      formData.append("priority", formPriority);
      formData.append("targetType", formTargetType);
      formData.append("isPopup", formIsPopup ? "true" : "false");
      if (formExpiresAt) formData.append("expiresAt", new Date(formExpiresAt).toISOString());

      if (formTargetType === "ROLES") {
        if (formTargetRoles.length === 0) {
          Swal.fire(
            "Select Roles",
            "Please select at least one target role.",
            "warning"
          );
          setBroadcastLoading(false);
          return;
        }
        formData.append("targetRoles", JSON.stringify(formTargetRoles));
      }
      if (formTargetType === "USERS") {
        if (formTargetUsers.length === 0) {
          Swal.fire(
            "Select Staff",
            "Please select at least one staff member.",
            "warning"
          );
          setBroadcastLoading(false);
          return;
        }
        formData.append("targetUsers", JSON.stringify(formTargetUsers));
      }

      formAttachments.forEach((file) => {
        formData.append("attachments", file);
      });

      if (editingMessageId) {
        await updateDirectorMessage(editingMessageId, formData);
        Swal.fire("Updated!", "Director announcement updated successfully.", "success");
      } else {
        await createDirectorMessage(formData);
        Swal.fire(
          "Broadcasted!",
          "Director message created and broadcasted to staff in real-time.",
          "success"
        );
      }

      setIsBroadcastModalOpen(false);
      loadMessages();
    } catch (err) {
      console.error("Failed to broadcast director message:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to broadcast message.",
        "error"
      );
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Merge available roles with any roles already assigned to the message being edited
  const allDisplayRoles = useMemo(() => {
    const roleMap = new Map();
    availableRoles.forEach((r) => {
      const trimmed = String(r || "").trim();
      if (trimmed) roleMap.set(trimmed.toLowerCase(), trimmed);
    });
    formTargetRoles.forEach((r) => {
      const trimmed = String(r || "").trim();
      if (trimmed && !roleMap.has(trimmed.toLowerCase())) {
        roleMap.set(trimmed.toLowerCase(), trimmed);
      }
    });
    return Array.from(roleMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [availableRoles, formTargetRoles]);

  // Filtered roles by search query
  const filteredRoles = useMemo(() => {
    if (!roleSearchQuery.trim()) return allDisplayRoles;
    const q = roleSearchQuery.trim().toLowerCase();
    return allDisplayRoles.filter((r) => r.toLowerCase().includes(q));
  }, [allDisplayRoles, roleSearchQuery]);

  // Toggle Role Selection (case-insensitive safe)
  const handleRoleToggle = (role) => {
    const roleClean = String(role || "").trim();
    if (!roleClean) return;
    setFormTargetRoles((prev) => {
      const exists = prev.some(
        (r) => r.toLowerCase() === roleClean.toLowerCase()
      );
      if (exists) {
        return prev.filter((r) => r.toLowerCase() !== roleClean.toLowerCase());
      }
      return [...prev, roleClean];
    });
  };

  // Select all visible roles
  const handleSelectAllRoles = () => {
    const targets = filteredRoles;
    setFormTargetRoles((prev) => {
      const set = new Set(prev.map((r) => r.toLowerCase()));
      const next = [...prev];
      targets.forEach((r) => {
        if (!set.has(r.toLowerCase())) {
          next.push(r);
          set.add(r.toLowerCase());
        }
      });
      return next;
    });
  };

  // Clear role selection
  const handleClearAllRoles = () => {
    if (roleSearchQuery.trim()) {
      const filterSet = new Set(filteredRoles.map((r) => r.toLowerCase()));
      setFormTargetRoles((prev) =>
        prev.filter((r) => !filterSet.has(r.toLowerCase()))
      );
    } else {
      setFormTargetRoles([]);
    }
  };

  // Distinct roles among staff users for quick category filter chips
  const staffDistinctRoles = useMemo(() => {
    const set = new Set();
    staffUsers.forEach((u) => {
      const r = String(u?.role || "").trim();
      if (r) set.add(r);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [staffUsers]);

  // Filtered staff users by search query and role filter
  const filteredStaffUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return staffUsers.filter((u) => {
      const matchesSearch =
        !q ||
        String(u.name || "").toLowerCase().includes(q) ||
        String(u.role || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.phone_no || "").includes(q);

      const matchesRole =
        userRoleFilter === "ALL" ||
        String(u.role || "").toLowerCase() === userRoleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [staffUsers, userSearchQuery, userRoleFilter]);

  // Toggle User Selection
  const handleUserToggle = (userId) => {
    setFormTargetUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    const idsToAdd = filteredStaffUsers.map((u) => u._id || u.id).filter(Boolean);
    setFormTargetUsers((prev) => {
      const set = new Set(prev);
      idsToAdd.forEach((id) => set.add(id));
      return Array.from(set);
    });
  };

  const handleClearAllUsers = () => {
    if (userSearchQuery.trim() || userRoleFilter !== "ALL") {
      const idsToRemove = new Set(filteredStaffUsers.map((u) => u._id || u.id));
      setFormTargetUsers((prev) => prev.filter((id) => !idsToRemove.has(id)));
    } else {
      setFormTargetUsers([]);
    }
  };

  // Metrics calculation
  const sosCount = messages.filter((m) => m.priority === "SOS").length;
  const readMessagesCount = messages.filter((m) => m.isRead).length;
  const readRate = messages.length
    ? Math.round((readMessagesCount / messages.length) * 100)
    : 0;
  const totalAttachmentsShared = messages.reduce(
    (acc, m) => acc + (Array.isArray(m.attachments) ? m.attachments.length : 0),
    0
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
          <div>
            <h4 className="page-title mb-1" style={{ fontWeight: 800, color: "#0f172a" }}>
              <i className="fa fa-bullhorn text-danger me-2"></i> Director Messages & Announcements
            </h4>
            <p className="text-muted mb-0" style={{ fontSize: "13.5px" }}>
              Direct urgent directives, SOS emergency instructions, and operational notices from the Director.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-danger d-inline-flex align-items-center gap-2 px-3 py-2"
              style={{ fontWeight: 600, borderRadius: 8, boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)" }}
              onClick={() => handleOpenBroadcastModal()}
            >
              <i className="fa fa-plus-circle"></i> Broadcast New Message
            </button>
          )}
        </div>

        {/* Metric Cards */}
        <div className="dm-stats-grid">
          <div className="dm-stat-card">
            <div className="dm-stat-icon dm-stat-icon-red">
              <i className="fa fa-exclamation-triangle"></i>
            </div>
            <div className="dm-stat-info">
              <h3>{sosCount}</h3>
              <span>Active SOS Alerts</span>
            </div>
          </div>
          <div className="dm-stat-card">
            <div className="dm-stat-icon dm-stat-icon-blue">
              <i className="fa fa-envelope-open-o"></i>
            </div>
            <div className="dm-stat-info">
              <h3>{totalCount}</h3>
              <span>Total Announcements</span>
            </div>
          </div>
          <div className="dm-stat-card">
            <div className="dm-stat-icon dm-stat-icon-green">
              <i className="fa fa-check-circle-o"></i>
            </div>
            <div className="dm-stat-info">
              <h3>{readRate}%</h3>
              <span>Read Engagement Rate</span>
            </div>
          </div>
          <div className="dm-stat-card">
            <div className="dm-stat-icon dm-stat-icon-amber">
              <i className="fa fa-paperclip"></i>
            </div>
            <div className="dm-stat-info">
              <h3>{totalAttachmentsShared}</h3>
              <span>Documents Shared</span>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="dm-filter-card">
          <div className="dm-filter-left">
            <div className="dm-search-input-box">
              <i className="fa fa-search"></i>
              <input
                type="text"
                placeholder="Search by title, message, or sender name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="dm-select"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Priorities</option>
              <option value="SOS">SOS Emergency</option>
              <option value="HIGH">High Priority</option>
              <option value="NORMAL">Normal</option>
            </select>

            <select
              className="dm-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="1">Active</option>
              <option value="0">Archived / Inactive</option>
            </select>
          </div>

          <div>
            <button
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              onClick={loadMessages}
              disabled={loading}
            >
              <i className={`fa fa-refresh ${loading ? "fa-spin" : ""}`}></i> Refresh
            </button>
          </div>
        </div>

        {/* Listing Table / Card List */}
        <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
                <thead className="table-light" style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <tr>
                    <th style={{ width: "130px" }}>Priority</th>
                    <th>Announcement</th>
                    <th>Sender</th>
                    <th>Attached Files</th>
                    <th>Status</th>
                    {isAdmin && <th>Staff Engagement</th>}
                    <th>Date</th>
                    <th className="text-end" style={{ width: "160px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-center py-5 text-muted">
                        <i className="fa fa-spinner fa-spin fa-2x mb-2 text-danger"></i>
                        <div>Loading Director messages...</div>
                      </td>
                    </tr>
                  ) : messages.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-center py-5 text-muted">
                        <i className="fa fa-bullhorn fa-3x mb-3 text-secondary opacity-50"></i>
                        <h6>No Director Announcements Found</h6>
                        <p className="small mb-0">No active messages matching the current filters.</p>
                      </td>
                    </tr>
                  ) : (
                    messages.map((msg) => {
                      const priorityProps = getPriorityBadgeProps(msg.priority);
                      const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

                      return (
                        <tr
                          key={msg._id}
                          className={[
                            !msg.isRead ? "table-light" : "",
                            msg.isUnread === true ? "unread-row" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {/* Priority */}
                          <td>
                            <span className={priorityProps.className}>
                              <i className={`fa ${priorityProps.icon}`}></i> {msg.priority || "NORMAL"}
                            </span>
                          </td>

                          {/* Announcement */}
                          <td>
                            <div style={{ maxWidth: "340px" }}>
                              <div
                                className="fw-bold text-dark text-truncate"
                                title={msg.title}
                                style={{ fontSize: "13.5px", cursor: "pointer" }}
                                onClick={() => handleOpenDetails(msg)}
                              >
                                {msg.title || "Director Announcement"}
                                <UnreadDot unread={msg.isUnread === true} />
                              </div>
                              <div
                                className="text-muted text-truncate small"
                                title={msg.message}
                              >
                                {msg.message}
                              </div>
                              {/* Audience Tag */}
                              <div className="mt-1">
                                {msg.targetType === "ROLES" && Array.isArray(msg.targetRoles) && msg.targetRoles.length > 0 ? (
                                  <span
                                    className="badge bg-light text-secondary border"
                                    style={{ fontSize: "10.5px" }}
                                    title={`Target Roles: ${msg.targetRoles.join(", ")}`}
                                  >
                                    <i className="fa fa-users me-1 text-danger"></i>
                                    {msg.targetRoles.slice(0, 2).join(", ")}
                                    {msg.targetRoles.length > 2 ? ` +${msg.targetRoles.length - 2}` : ""}
                                  </span>
                                ) : msg.targetType === "USERS" ? (
                                  <span className="badge bg-light text-secondary border" style={{ fontSize: "10.5px" }}>
                                    <i className="fa fa-user me-1 text-primary"></i>
                                    {Array.isArray(msg.targetUsers) ? msg.targetUsers.length : 0} Staff
                                  </span>
                                ) : (
                                  <span className="badge bg-light text-secondary border" style={{ fontSize: "10.5px" }}>
                                    <i className="fa fa-globe me-1 text-success"></i> All Staff
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Sender */}
                          <td>
                            <span className="fw-semibold text-dark">
                              {msg.sender?.name || "Super Admin"}
                            </span>
                            <div className="text-muted small">
                              {msg.sender?.role || "Director"}
                            </div>
                          </td>

                          {/* Attached Files */}
                          <td>
                            {attachments.length === 0 ? (
                              <span className="text-muted small">—</span>
                            ) : (
                              <div className="d-flex flex-wrap gap-1">
                                {attachments.map((att, i) => (
                                  <a
                                    key={att._id || i}
                                    href={att.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={att.originalName}
                                    className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 text-decoration-none"
                                    title={`${att.originalName} (${formatFileSize(att.fileSize)})`}
                                  >
                                    <i className="fa fa-paperclip text-danger"></i>
                                    <span style={{ maxWidth: "90px" }} className="text-truncate">
                                      {att.originalName || "File"}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Read / Dismiss Status */}
                          <td>
                            {msg.isRead ? (
                              <span className="dm-status-pill dm-status-read">
                                <i className="fa fa-check"></i> Read
                              </span>
                            ) : (
                              <span className="dm-status-pill dm-status-unread">
                                <i className="fa fa-clock-o"></i> Unread
                              </span>
                            )}
                            {msg.isDismissed && (
                              <div className="text-muted" style={{ fontSize: "10.5px" }}>
                                Banner dismissed
                              </div>
                            )}
                          </td>

                          {/* Engagement Stats (Admin) */}
                          {isAdmin && (
                            <td>
                              <div className="small">
                                <span className="text-success fw-semibold">
                                  {msg.readCount ?? 0} read
                                </span>{" "}
                                /{" "}
                                <span className="text-secondary">
                                  {msg.dismissedCount ?? 0} dismissed
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Date */}
                          <td className="text-muted small">
                            {formatMessageDate(msg.createdAt)}
                          </td>

                          {/* Actions */}
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              {/* View Details */}
                              <button
                                type="button"
                                className="btn btn-outline-primary"
                                title="View full announcement"
                                onClick={() => handleOpenDetails(msg)}
                              >
                                <i className="fa fa-eye"></i>
                              </button>

                              {/* Dismiss / Mark Read */}
                              {!msg.isDismissed && (
                                <button
                                  type="button"
                                  className="btn btn-outline-success"
                                  title="Mark as Read & Dismiss"
                                  onClick={() => handleDismissMessage(msg._id)}
                                >
                                  <i className="fa fa-check"></i>
                                </button>
                              )}

                              {/* Engagement Stats Modal Button */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-outline-info"
                                  title="View Staff Engagement Stats"
                                  onClick={() => handleOpenStats(msg._id)}
                                >
                                  <i className="fa fa-bar-chart"></i>
                                </button>
                              )}

                              {/* Edit Announcement */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  title="Edit Announcement"
                                  onClick={() => handleOpenBroadcastModal(msg)}
                                >
                                  <i className="fa fa-pencil"></i>
                                </button>
                              )}

                              {/* Delete Announcement */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-outline-danger"
                                  title="Delete Announcement"
                                  onClick={() => handleDeleteMessage(msg._id)}
                                >
                                  <i className="fa fa-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="d-flex align-items-center justify-content-between p-3 border-top">
                <span className="text-muted small">
                  Showing page {page} of {totalPages} ({totalCount} total announcements)
                </span>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Message Details Modal */}
      <DirectorMessageModal
        isOpen={isDetailModalOpen}
        message={selectedMessage}
        onClose={() => setIsDetailModalOpen(false)}
        onDismiss={handleDismissMessage}
      />

      {/* Broadcast / Edit Message Modal (Admin Only) */}
      {isBroadcastModalOpen && (
        <div
          className="dm-modal-backdrop"
          onClick={() => !broadcastLoading && setIsBroadcastModalOpen(false)}
        >
          <div
            className="dm-modal-card"
            style={{ maxWidth: "640px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dm-modal-header">
              <h5 className="m-0 text-white fw-bold">
                <i className="fa fa-bullhorn me-2"></i>
                {editingMessageId ? "Edit Director Announcement" : "Broadcast Director Announcement"}
              </h5>
              <button
                type="button"
                className="dm-modal-close-btn"
                onClick={() => setIsBroadcastModalOpen(false)}
                disabled={broadcastLoading}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <form
              onSubmit={handleSubmitBroadcast}
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                flex: 1,
                overflow: "hidden",
              }}
            >
              <div className="dm-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {/* Title */}
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Heading / Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Emergency System Downtime"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                {/* Priority & Target Type */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Priority Level</label>
                    <select
                      className="form-select"
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                    >
                      <option value="SOS">SOS (Urgent Siren & Red Banner)</option>
                      <option value="HIGH">HIGH Priority (Amber Banner)</option>
                      <option value="NORMAL">NORMAL Priority (Blue Banner)</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Target Audience</label>
                    <select
                      className="form-select"
                      value={formTargetType}
                      onChange={(e) => setFormTargetType(e.target.value)}
                    >
                      <option value="ALL">All Staff Members</option>
                      <option value="ROLES">Specific Roles</option>
                      <option value="USERS">Specific Staff Users</option>
                    </select>
                  </div>
                </div>

                {/* Role selection if TargetType is ROLES */}
                {formTargetType === "ROLES" && (
                  <div className="mb-3 p-3 bg-light border rounded">
                    <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                      <label className="form-label fw-semibold small mb-0">
                        Select Target Roles:{" "}
                        <span className="badge bg-danger ms-1">
                          {formTargetRoles.length} selected
                        </span>
                      </label>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm py-0 px-2"
                          style={{ fontSize: "11.5px" }}
                          onClick={handleSelectAllRoles}
                        >
                          <i className="fa fa-check-square-o me-1"></i> Select All
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-2"
                          style={{ fontSize: "11.5px" }}
                          onClick={handleClearAllRoles}
                          disabled={formTargetRoles.length === 0}
                        >
                          <i className="fa fa-times me-1"></i> Clear
                        </button>
                      </div>
                    </div>

                    {/* Search filter for roles */}
                    <div className="mb-2 position-relative">
                      <input
                        type="text"
                        className="form-control form-control-sm ps-4"
                        placeholder="Filter roles by name..."
                        value={roleSearchQuery}
                        onChange={(e) => setRoleSearchQuery(e.target.value)}
                      />
                      <i
                        className="fa fa-search text-muted position-absolute"
                        style={{
                          left: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: "12px",
                        }}
                      ></i>
                      {roleSearchQuery && (
                        <button
                          type="button"
                          className="btn btn-sm position-absolute text-muted border-0 p-0"
                          style={{
                            right: "8px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                          }}
                          onClick={() => setRoleSearchQuery("")}
                        >
                          <i className="fa fa-times-circle"></i>
                        </button>
                      )}
                    </div>

                    {rolesLoading ? (
                      <div className="text-center py-3 text-muted small">
                        <i className="fa fa-spinner fa-spin me-1 text-danger"></i> Loading all roles...
                      </div>
                    ) : filteredRoles.length === 0 ? (
                      <div className="text-center py-3 text-muted small">
                        No roles match "{roleSearchQuery}".
                      </div>
                    ) : (
                      <div
                        className="d-flex flex-wrap gap-2"
                        style={{
                          maxHeight: "220px",
                          overflowY: "auto",
                          padding: "2px",
                        }}
                      >
                        {filteredRoles.map((r) => {
                          const selected = formTargetRoles.some(
                            (sel) => sel.toLowerCase() === r.toLowerCase()
                          );
                          return (
                            <button
                              key={r}
                              type="button"
                              className={`btn btn-sm ${
                                selected
                                  ? "btn-danger text-white shadow-sm"
                                  : "btn-outline-secondary bg-white text-dark"
                              }`}
                              style={{
                                borderRadius: "20px",
                                fontSize: "12.5px",
                                padding: "4px 12px",
                                transition: "all 0.15s ease-in-out",
                              }}
                              onClick={() => handleRoleToggle(r)}
                            >
                              {selected ? (
                                <i className="fa fa-check-circle me-1"></i>
                              ) : (
                                <i className="fa fa-circle-thin me-1 text-muted"></i>
                              )}
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* User selection if TargetType is USERS */}
                {formTargetType === "USERS" && (
                  <div className="mb-3 p-3 bg-light border rounded">
                    <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                      <label className="form-label fw-semibold small mb-0">
                        Select Specific Staff:{" "}
                        <span className="badge bg-danger ms-1">
                          {formTargetUsers.length} selected
                        </span>
                      </label>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm py-0 px-2"
                          style={{ fontSize: "11.5px" }}
                          onClick={handleSelectAllUsers}
                        >
                          <i className="fa fa-check-square-o me-1"></i> Select All Filtered
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-2"
                          style={{ fontSize: "11.5px" }}
                          onClick={handleClearAllUsers}
                          disabled={formTargetUsers.length === 0}
                        >
                          <i className="fa fa-times me-1"></i> Clear
                        </button>
                      </div>
                    </div>

                    {/* Search input for staff */}
                    <div className="mb-2 position-relative">
                      <input
                        type="text"
                        className="form-control form-control-sm ps-4"
                        placeholder="Search staff by name, role (e.g. Doctor, Finance), email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                      <i
                        className="fa fa-search text-muted position-absolute"
                        style={{
                          left: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: "12px",
                        }}
                      ></i>
                      {userSearchQuery && (
                        <button
                          type="button"
                          className="btn btn-sm position-absolute text-muted border-0 p-0"
                          style={{
                            right: "8px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                          }}
                          onClick={() => setUserSearchQuery("")}
                        >
                          <i className="fa fa-times-circle"></i>
                        </button>
                      )}
                    </div>

                    {/* Quick Role Filter Chips for Staff */}
                    {staffDistinctRoles.length > 1 && (
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        <button
                          type="button"
                          className={`btn btn-sm py-0 px-2 ${
                            userRoleFilter === "ALL"
                              ? "btn-dark text-white"
                              : "btn-outline-secondary bg-white text-muted"
                          }`}
                          style={{ fontSize: "11px", borderRadius: "12px" }}
                          onClick={() => setUserRoleFilter("ALL")}
                        >
                          All ({staffUsers.length})
                        </button>
                        {staffDistinctRoles.map((r) => {
                          const count = staffUsers.filter(
                            (u) => String(u.role || "").toLowerCase() === r.toLowerCase()
                          ).length;
                          return (
                            <button
                              key={r}
                              type="button"
                              className={`btn btn-sm py-0 px-2 ${
                                userRoleFilter.toLowerCase() === r.toLowerCase()
                                  ? "btn-danger text-white"
                                  : "btn-outline-secondary bg-white text-dark"
                              }`}
                              style={{ fontSize: "11px", borderRadius: "12px" }}
                              onClick={() =>
                                setUserRoleFilter((prev) =>
                                  prev.toLowerCase() === r.toLowerCase() ? "ALL" : r
                                )
                              }
                            >
                              {r} ({count})
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Staff List Box */}
                    <div
                      style={{
                        maxHeight: "190px",
                        overflowY: "auto",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        padding: "6px",
                      }}
                    >
                      {filteredStaffUsers.length === 0 ? (
                        <div className="text-center py-3 text-muted small">
                          No staff found matching "{userSearchQuery}".
                        </div>
                      ) : (
                        filteredStaffUsers.map((u) => {
                          const uid = u._id || u.id;
                          const selected = formTargetUsers.includes(uid);
                          return (
                            <div
                              key={uid}
                              className={`d-flex align-items-center justify-content-between p-2 rounded mb-1 border ${
                                selected
                                  ? "bg-light border-danger shadow-sm"
                                  : "bg-white border-light"
                              }`}
                              style={{
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                position: "relative",
                              }}
                              onClick={() => handleUserToggle(uid)}
                            >
                              <div className="d-flex align-items-center gap-2 min-w-0">
                                <input
                                  className="dm-staff-checkbox"
                                  type="checkbox"
                                  id={`user-${uid}`}
                                  checked={selected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleUserToggle(uid);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: "static",
                                    margin: 0,
                                    cursor: "pointer",
                                    width: "16px",
                                    height: "16px",
                                    accentColor: "#dc2626",
                                    flexShrink: 0,
                                  }}
                                />
                                <div className="text-truncate">
                                  <span className="fw-semibold text-dark small me-1">
                                    {u.name}
                                  </span>
                                  {u.email && (
                                    <span
                                      className="text-muted"
                                      style={{ fontSize: "11px" }}
                                    >
                                      &lt;{u.email}&gt;
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`badge ms-2 ${
                                  selected
                                    ? "bg-danger text-white"
                                    : "bg-light text-secondary border"
                                }`}
                                style={{ fontSize: "11px", fontWeight: 500 }}
                              >
                                {u.role || "Staff"}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Selected Staff Tags Summary */}
                    {formTargetUsers.length > 0 && (
                      <div className="mt-2 pt-2 border-top">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span
                            className="text-muted"
                            style={{ fontSize: "11.5px" }}
                          >
                            Selected Staff ({formTargetUsers.length}):
                          </span>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                            style={{ fontSize: "11.5px" }}
                            onClick={() => setFormTargetUsers([])}
                          >
                            Clear Selection
                          </button>
                        </div>
                        <div
                          className="d-flex flex-wrap gap-1"
                          style={{ maxHeight: "65px", overflowY: "auto" }}
                        >
                          {formTargetUsers.map((uid) => {
                            const u = staffUsers.find(
                              (s) => (s._id || s.id) === uid
                            );
                            const name = u?.name || "Staff";
                            return (
                              <span
                                key={uid}
                                className="badge bg-white text-dark border d-inline-flex align-items-center gap-1"
                                style={{
                                  fontSize: "11px",
                                  padding: "3px 8px",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                }}
                              >
                                <span>{name}</span>
                                <i
                                  className="fa fa-times text-danger"
                                  style={{
                                    cursor: "pointer",
                                    fontSize: "10px",
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUserToggle(uid);
                                  }}
                                ></i>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Message Content */}
                <div className="mb-3">
                  <label className="form-label fw-semibold small">
                    Announcement Message <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Enter message details. For example: Emergency maintenance scheduled at 5 PM today. Save all files."
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    required
                  />
                </div>

                {/* Popup & Expiry Options */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="form-check mt-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="isPopupCheck"
                        checked={formIsPopup}
                        onChange={(e) => setFormIsPopup(e.target.checked)}
                      />
                      <label className="form-check-label small" htmlFor="isPopupCheck">
                        <strong>Show Instant Popup Alert</strong> on screen
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Expires At (Optional)</label>
                    <input
                      type="datetime-local"
                      className="form-control form-control-sm"
                      value={formExpiresAt}
                      onChange={(e) => setFormExpiresAt(e.target.value)}
                    />
                  </div>
                </div>

                {/* File Attachments (Up to 10 files) */}
                <div className="mb-2">
                  <label className="form-label fw-semibold small">
                    Attachments (PDFs, Images, Word Docs — Max 10)
                  </label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    multiple
                    onChange={handleFileChange}
                    disabled={formAttachments.length >= 10}
                  />

                  {formAttachments.length > 0 && (
                    <div className="mt-2 d-flex flex-wrap gap-2">
                      {formAttachments.map((file, idx) => (
                        <span
                          key={idx}
                          className="badge bg-light text-dark border d-inline-flex align-items-center gap-2 p-2"
                        >
                          <i className="fa fa-file-text-o text-danger"></i>
                          <span style={{ maxWidth: "160px" }} className="text-truncate">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            className="btn-close btn-close-white btn-sm"
                            style={{ fontSize: "9px" }}
                            onClick={() => handleRemoveAttachment(idx)}
                          ></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="dm-modal-footer">
                <button
                  type="button"
                  className="dm-btn-ghost-close"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  disabled={broadcastLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dm-btn-primary-close"
                  disabled={broadcastLoading}
                >
                  {broadcastLoading ? (
                    <>
                      <i className="fa fa-spinner fa-spin"></i> Broadcasting...
                    </>
                  ) : (
                    <>
                      <i className="fa fa-paper-plane"></i>{" "}
                      {editingMessageId ? "Save Changes" : "Broadcast to Staff"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Engagement Stats Modal (Admin Only) */}
      {isStatsModalOpen && (
        <div className="dm-modal-backdrop" onClick={() => setIsStatsModalOpen(false)}>
          <div
            className="dm-modal-card"
            style={{ maxWidth: "780px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dm-modal-header">
              <h5 className="m-0 text-white fw-bold">
                <i className="fa fa-bar-chart me-2"></i> Staff Engagement Breakdown
              </h5>
              <button
                type="button"
                className="dm-modal-close-btn"
                onClick={() => setIsStatsModalOpen(false)}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="dm-modal-body">
              {statsLoading ? (
                <div className="text-center py-5 text-muted">
                  <i className="fa fa-spinner fa-spin fa-2x text-danger mb-2"></i>
                  <div>Fetching staff engagement metrics...</div>
                </div>
              ) : statsData ? (
                <>
                  <div className="border rounded p-3 bg-light mb-3">
                    <h6 className="fw-bold mb-1 text-dark">{statsData.title || "Announcement"}</h6>
                    <div className="small text-muted mb-2">
                      Priority: <span className="badge bg-danger">{statsData.priority || "SOS"}</span> ·
                      Broadcasted: {formatMessageDate(statsData.createdAt)}
                    </div>

                    <div className="row text-center mt-3 g-2">
                      <div className="col-3">
                        <div className="p-2 border rounded bg-white">
                          <h4 className="mb-0 fw-bold">{statsData.totalStaff ?? 0}</h4>
                          <span className="small text-muted">Total Staff</span>
                        </div>
                      </div>
                      <div className="col-3">
                        <div className="p-2 border rounded bg-white">
                          <h4 className="mb-0 fw-bold text-success">{statsData.readCount ?? 0}</h4>
                          <span className="small text-muted">Read</span>
                        </div>
                      </div>
                      <div className="col-3">
                        <div className="p-2 border rounded bg-white">
                          <h4 className="mb-0 fw-bold text-danger">{statsData.unreadCount ?? 0}</h4>
                          <span className="small text-muted">Unread</span>
                        </div>
                      </div>
                      <div className="col-3">
                        <div className="p-2 border rounded bg-white">
                          <h4 className="mb-0 fw-bold text-primary">{statsData.dismissedCount ?? 0}</h4>
                          <span className="small text-muted">Dismissed</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Staff List Search */}
                  <div className="mb-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Search staff by name, email, or role..."
                      value={statsSearch}
                      onChange={(e) => setStatsSearch(e.target.value)}
                    />
                  </div>

                  {/* Staff Listing Table */}
                  <div className="dm-stats-table-wrapper">
                    <table className="dm-stats-table">
                      <thead>
                        <tr>
                          <th>Staff Member</th>
                          <th>Role</th>
                          <th>Read Status</th>
                          <th>Banner Dismissed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(statsData.staff) &&
                          statsData.staff
                            .filter(
                              (s) =>
                                !statsSearch ||
                                String(s.name || "").toLowerCase().includes(statsSearch.toLowerCase()) ||
                                String(s.email || "").toLowerCase().includes(statsSearch.toLowerCase()) ||
                                String(s.role || "").toLowerCase().includes(statsSearch.toLowerCase())
                            )
                            .map((s, idx) => (
                              <tr key={s.userId || idx}>
                                <td>
                                  <div className="fw-semibold">{s.name}</div>
                                  <div className="text-muted" style={{ fontSize: "11px" }}>
                                    {s.email}
                                  </div>
                                </td>
                                <td>
                                  <span className="badge bg-light text-dark border">
                                    {s.role || "Staff"}
                                  </span>
                                </td>
                                <td>
                                  {s.isRead ? (
                                    <div>
                                      <span className="badge bg-success">
                                        <i className="fa fa-check"></i> Read
                                      </span>
                                      <div className="text-muted mt-1" style={{ fontSize: "10.5px" }}>
                                        {formatMessageDate(s.readAt)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="badge bg-secondary">Unread</span>
                                  )}
                                </td>
                                <td>
                                  {s.isDismissed ? (
                                    <div>
                                      <span className="badge bg-primary">Dismissed</span>
                                      <div className="text-muted mt-1" style={{ fontSize: "10.5px" }}>
                                        {formatMessageDate(s.dismissedAt)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted small">Not Dismissed</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-muted">No engagement data available.</div>
              )}
            </div>

            <div className="dm-modal-footer">
              <button
                type="button"
                className="dm-btn-ghost-close"
                onClick={() => setIsStatsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
