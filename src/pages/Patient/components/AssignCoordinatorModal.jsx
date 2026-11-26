import React, { useState, useEffect, useMemo, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Swal from "sweetalert2";
import axios from "axios";
import { baseurl } from "../../../Basurl/Baseurl";
import {
  fetchStaffByRole,
  fetchCoordinators,
  assignPatientStaff,
  unassignPatientStaff,
  getAssignedStaffList,
  assignEnquiryStaff,
  unassignEnquiryStaff,
  extractEnquiryId,
  extractPatientId,
} from "../../../services/coordinatorApi";
import { isReferralUser, isInsuranceUser } from "../../../utils/authStorage";

const isPartner = () => isReferralUser() || isInsuranceUser();

// Prominent roles for Tab 2 (Other Staff) - Coordinator is strictly excluded since it has its own dedicated Tab 1!
const PROMINENT_OTHER_ROLES = [
  "Doctor",
  "Nurse",
  "Physiotherapist",
  "Supervisor",
  "Manager",
];

const DEFAULT_OTHER_ROLES = [
  "Doctor",
  "Nurse",
  "Physiotherapist",
  "Supervisor",
  "Manager",
];

const getRoleBadgeStyle = (role = "") => {
  const r = String(role).toLowerCase();
  if (r.includes("coordinator")) {
    return { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe", activeBg: "#0ba6df", activeText: "#ffffff" };
  }
  if (r.includes("doctor") || r.includes("surgeon") || r.includes("physician")) {
    return { bg: "#fef3c7", text: "#92400e", border: "#fde68a", activeBg: "#d97706", activeText: "#ffffff" };
  }
  if (r.includes("nurse")) {
    return { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", activeBg: "#059669", activeText: "#ffffff" };
  }
  if (r.includes("physio")) {
    return { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe", activeBg: "#7c3aed", activeText: "#ffffff" };
  }
  if (r.includes("supervisor") || r.includes("manager")) {
    return { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa", activeBg: "#ea580c", activeText: "#ffffff" };
  }
  return { bg: "#f1f5f9", text: "#334155", border: "#e2e8f0", activeBg: "#475569", activeText: "#ffffff" };
};

export default function AssignCoordinatorModal({
  open,
  onClose,
  patient,
  enquiry,
  entityType = patient ? "patient" : "enquiry",
  onSuccess,
}) {
  // Check if we are operating on an Enquiry or Patient
  const isEnquiry = Boolean(enquiry) || entityType === "enquiry";

  const targetEntity = enquiry || patient;

  // TWO DEDICATED TABS: "coordinator" (Multi-Select) | "other_staff" (Multi-Select)
  const [activeTab, setActiveTab] = useState("coordinator");

  // TAB 1: COORDINATOR (MULTI SELECT) STATE
  const [loadingCoordinators, setLoadingCoordinators] = useState(false);
  const [coordinatorList, setCoordinatorList] = useState([]);
  const [selectedCoordinatorMap, setSelectedCoordinatorMap] = useState({});
  const [coordinatorSearch, setCoordinatorSearch] = useState("");

  // TAB 2: OTHER STAFF (MULTI-SELECT) STATE
  const [loadingOtherStaff, setLoadingOtherStaff] = useState(false);
  const [otherStaffList, setOtherStaffList] = useState([]);
  const [otherSelectedRoles, setOtherSelectedRoles] = useState(["ALL"]);
  const [availableOtherRoles, setAvailableOtherRoles] = useState(DEFAULT_OTHER_ROLES);
  const [otherRolesDropdownOpen, setOtherRolesDropdownOpen] = useState(false);
  const [selectedOtherStaffMap, setSelectedOtherStaffMap] = useState({});
  const [otherStaffSearch, setOtherStaffSearch] = useState("");
  const dropdownRef = useRef(null);

  // SHARED STATE
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unassigningId, setUnassigningId] = useState(null);
  const [assignedTeam, setAssignedTeam] = useState([]);

  const targetId = isEnquiry
    ? extractEnquiryId(targetEntity)
    : extractPatientId(targetEntity);

  const patientId = targetId; // keep patientId alias for existing references

  const patientName =
    targetEntity?.patient_name ||
    targetEntity?.name ||
    targetEntity?.first_name ||
    targetEntity?.raw?.name ||
    (isEnquiry ? "Enquiry" : "Patient");

  const patientCountry =
    targetEntity?.country ||
    targetEntity?.treatingIn ||
    targetEntity?.raw?.country ||
    "";

  const targetStatus =
    targetEntity?.patient_status ||
    targetEntity?.Enquiry_status ||
    targetEntity?.enq_status ||
    targetEntity?.raw?.Enquiry_status ||
    "";

  // Sync assignedTeam with incoming patient/enquiry prop whenever modal opens
  useEffect(() => {
    if (open && targetEntity) {
      setAssignedTeam(getAssignedStaffList(targetEntity));
    }
  }, [open, targetEntity]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOtherRolesDropdownOpen(false);
      }
    };
    if (otherRolesDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [otherRolesDropdownOpen]);

  // Fetch dynamic roles from backend (excluding Admin, Super Admin, and Coordinator)
  useEffect(() => {
    let isMounted = true;
    const loadDynamicRoles = async () => {
      try {
        const res = await axios.get(`${baseurl}getAllRoles`);
        const rolesData = res?.data?.data || res?.data;
        if (Array.isArray(rolesData) && rolesData.length > 0) {
          const fetchedNames = rolesData
            .map((r) => (typeof r === "string" ? r : r.role || r.name))
            .filter(Boolean);
          const merged = Array.from(
            new Set([...PROMINENT_OTHER_ROLES, ...DEFAULT_OTHER_ROLES, ...fetchedNames])
          ).filter(
            (r) =>
              r.toLowerCase() !== "admin" &&
              r.toLowerCase() !== "super admin" &&
              r.toLowerCase() !== "coordinator"
          );
          if (isMounted && merged.length > 0) {
            setAvailableOtherRoles(merged);
          }
        }
      } catch (err) {
        // Fallback to DEFAULT_OTHER_ROLES
      }
    };
    loadDynamicRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  // When modal opens, reset states and load lists
  useEffect(() => {
    if (open) {
      if (isPartner()) {
        onClose();
        return;
      }
      setActiveTab("coordinator");
      setSelectedCoordinatorMap({});
      setSelectedOtherStaffMap({});
      setCoordinatorSearch("");
      setOtherStaffSearch("");
      setAssignmentNotes("");
      setOtherRolesDropdownOpen(false);
      setOtherSelectedRoles(["ALL"]);

      // Load coordinators
      loadCoordinators();
      // Load other staff
      loadOtherStaff(["ALL"]);
    }
  }, [open, onClose]);

  // Load coordinators strictly
  const loadCoordinators = async () => {
    setLoadingCoordinators(true);
    try {
      let list = [];
      try {
        list = await fetchCoordinators();
      } catch (e) {
        list = await fetchStaffByRole("Coordinator");
      }
      setCoordinatorList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load coordinators:", err);
      setCoordinatorList([]);
    } finally {
      setLoadingCoordinators(false);
    }
  };

  // Load other staff (excluding coordinators)
  const loadOtherStaff = async (roles) => {
    setLoadingOtherStaff(true);
    try {
      let list = [];
      const isAll = roles.includes("ALL") || roles.length === 0;
      const rolesParam = isAll
        ? ""
        : roles.filter((r) => r.toLowerCase() !== "coordinator").join(",");

      list = await fetchStaffByRole(rolesParam);
      if (Array.isArray(list)) {
        // Strictly filter out coordinators from other staff tab
        list = list.filter(
          (s) => String(s?.role || "").toLowerCase() !== "coordinator"
        );
      }
      setOtherStaffList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load other staff:", err);
      setOtherStaffList([]);
    } finally {
      setLoadingOtherStaff(false);
    }
  };

  // Handle role changes in Tab 2 (Other Staff)
  const handleToggleOtherRole = (roleName) => {
    let nextRoles;
    if (roleName === "ALL") {
      nextRoles = otherSelectedRoles.includes("ALL") ? ["Doctor"] : ["ALL"];
    } else {
      if (otherSelectedRoles.includes("ALL")) {
        nextRoles = [roleName];
      } else if (otherSelectedRoles.includes(roleName)) {
        const filtered = otherSelectedRoles.filter((r) => r !== roleName);
        nextRoles = filtered.length === 0 ? ["ALL"] : filtered;
      } else {
        nextRoles = [...otherSelectedRoles, roleName];
      }
    }
    setOtherSelectedRoles(nextRoles);
    loadOtherStaff(nextRoles);
  };

  // Select all other roles
  const selectAllOtherRoles = () => {
    setOtherSelectedRoles(["ALL"]);
    setOtherRolesDropdownOpen(false);
    loadOtherStaff(["ALL"]);
  };

  // Reset to prominent doctor role
  const resetOtherRoles = () => {
    setOtherSelectedRoles(["Doctor"]);
    setOtherRolesDropdownOpen(false);
    loadOtherStaff(["Doctor"]);
  };

  // -------------------------------------------------------------------------
  // REACTIVE AVAILABLE LISTS (Excluded assigned members; reappears on unassign)
  // -------------------------------------------------------------------------

  // 1. Available Coordinators (Filtered by search & excludes already assigned)
  const filteredCoordinators = useMemo(() => {
    let list = Array.isArray(coordinatorList) ? coordinatorList : [];

    // Exclude coordinators already assigned to this patient
    const assignedIds = new Set();
    const assignedEmails = new Set();
    (assignedTeam || []).forEach((s) => {
      const id = String(s?.userId || s?._id || s?.id || s?.staffId || "").trim();
      if (id) assignedIds.add(id);
      const em = String(s?.email || "").toLowerCase().trim();
      if (em) assignedEmails.add(em);
    });

    list = list.filter((s) => {
      const sId = String(
        s?._id || s?.id || s?.userId || s?.staffId || s?.user_id || ""
      ).trim();
      const sEmail = String(s?.email || "").toLowerCase().trim();
      return !(assignedIds.has(sId) || (sEmail && assignedEmails.has(sEmail)));
    });

    // Search filter
    if (coordinatorSearch.trim()) {
      const q = coordinatorSearch.toLowerCase().trim();
      list = list.filter((s) => {
        const name = String(s.name || "").toLowerCase();
        const email = String(s.email || "").toLowerCase();
        const phone = String(s.phone_no || s.phone || "").toLowerCase();
        const countries = Array.isArray(s.accessCountries)
          ? s.accessCountries.join(" ").toLowerCase()
          : "";
        return (
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          countries.includes(q)
        );
      });
    }

    return list;
  }, [coordinatorList, assignedTeam, coordinatorSearch]);

  // 2. Available Other Staff (Filtered by role, search, & excludes already assigned)
  const filteredOtherStaff = useMemo(() => {
    let list = Array.isArray(otherStaffList) ? otherStaffList : [];

    // Filter out coordinators
    list = list.filter(
      (s) => String(s?.role || "").toLowerCase() !== "coordinator"
    );

    // Exclude staff members already assigned to this patient
    const assignedIds = new Set();
    const assignedEmails = new Set();
    (assignedTeam || []).forEach((s) => {
      const id = String(s?.userId || s?._id || s?.id || s?.staffId || "").trim();
      if (id) assignedIds.add(id);
      const em = String(s?.email || "").toLowerCase().trim();
      if (em) assignedEmails.add(em);
    });

    list = list.filter((s) => {
      const sId = String(
        s?._id || s?.id || s?.userId || s?.staffId || s?.user_id || ""
      ).trim();
      const sEmail = String(s?.email || "").toLowerCase().trim();
      return !(assignedIds.has(sId) || (sEmail && assignedEmails.has(sEmail)));
    });

    // Filter by selected roles if not ALL
    if (!otherSelectedRoles.includes("ALL") && otherSelectedRoles.length > 0) {
      const activeRolesLower = otherSelectedRoles.map((r) => r.toLowerCase());
      list = list.filter((s) =>
        activeRolesLower.includes(String(s.role || "").toLowerCase())
      );
    }

    // Search filter
    if (otherStaffSearch.trim()) {
      const q = otherStaffSearch.toLowerCase().trim();
      list = list.filter((s) => {
        const name = String(s.name || "").toLowerCase();
        const email = String(s.email || "").toLowerCase();
        const role = String(s.role || "").toLowerCase();
        const phone = String(s.phone_no || s.phone || "").toLowerCase();
        const countries = Array.isArray(s.accessCountries)
          ? s.accessCountries.join(" ").toLowerCase()
          : "";
        return (
          name.includes(q) ||
          email.includes(q) ||
          role.includes(q) ||
          phone.includes(q) ||
          countries.includes(q)
        );
      });
    }

    return list;
  }, [otherStaffList, assignedTeam, otherSelectedRoles, otherStaffSearch]);

  // -------------------------------------------------------------------------
  // SELECTION HANDLERS
  // -------------------------------------------------------------------------

  // Tab 1: Multi-select coordinators (checkbox behavior)
  const handleSelectCoordinator = (coord) => {
    if (!coord) return;
    const cId = String(
      coord._id || coord.id || coord.userId || coord.staffId || coord.user_id || ""
    ).trim();
    if (!cId) return;

    setSelectedCoordinatorMap((prev) => {
      const next = { ...prev };
      if (next[cId]) {
        delete next[cId];
      } else {
        next[cId] = {
          id: cId,
          name: coord.name || "Coordinator",
          role: "Coordinator",
          email: coord.email || "",
          phone: coord.phone_no || coord.phone || "",
          dialCode: coord.phoneCode || coord.dial_code || "",
          accessCountries: coord.accessCountries || [],
        };
      }
      return next;
    });
  };

  const selectedCoordinatorList = useMemo(
    () => Object.values(selectedCoordinatorMap),
    [selectedCoordinatorMap]
  );

  // Tab 2: Multi-select other staff (checkbox behavior)
  const toggleSelectOtherStaff = (staff) => {
    if (!staff) return;
    const sId = String(
      staff._id || staff.id || staff.userId || staff.staffId || staff.user_id || ""
    ).trim();
    if (!sId) return;

    setSelectedOtherStaffMap((prev) => {
      const copy = { ...prev };
      if (copy[sId]) {
        delete copy[sId];
      } else {
        copy[sId] = {
          id: sId,
          name: staff.name || "Staff Member",
          role:
            staff.role ||
            (otherSelectedRoles.length === 1 && otherSelectedRoles[0] !== "ALL"
              ? otherSelectedRoles[0]
              : "Staff"),
          email: staff.email || "",
          phone: staff.phone_no || staff.phone || "",
          dialCode: staff.phoneCode || staff.dial_code || "",
        };
      }
      return copy;
    });
  };

  // Remove single selected staff from Tab 2 summary chip
  const removeSelectedOtherStaff = (sId) => {
    setSelectedOtherStaffMap((prev) => {
      const copy = { ...prev };
      delete copy[sId];
      return copy;
    });
  };

  // Select all or deselect all currently filtered staff in Tab 2
  const handleSelectAllFilteredOtherStaff = () => {
    const allFilteredIds = filteredOtherStaff
      .map((s) =>
        String(s._id || s.id || s.userId || s.staffId || s.user_id || "").trim()
      )
      .filter(Boolean);

    const allAreSelected =
      allFilteredIds.length > 0 &&
      allFilteredIds.every((id) => Boolean(selectedOtherStaffMap[id]));

    if (allAreSelected) {
      setSelectedOtherStaffMap((prev) => {
        const copy = { ...prev };
        allFilteredIds.forEach((id) => delete copy[id]);
        return copy;
      });
    } else {
      setSelectedOtherStaffMap((prev) => {
        const copy = { ...prev };
        filteredOtherStaff.forEach((s) => {
          const sId = String(
            s._id || s.id || s.userId || s.staffId || s.user_id || ""
          ).trim();
          if (sId) {
            copy[sId] = {
              id: sId,
              name: s.name || "Staff Member",
              role: s.role || "Staff",
              email: s.email || "",
              phone: s.phone_no || s.phone || "",
              dialCode: s.phoneCode || s.dial_code || "",
            };
          }
        });
        return copy;
      });
    }
  };

  // Selected other staff list array
  const selectedOtherStaffList = useMemo(() => {
    return Object.values(selectedOtherStaffMap);
  }, [selectedOtherStaffMap]);

  // Count assigned coordinators vs assigned other staff
  const assignedCoordinators = useMemo(() => {
    return (assignedTeam || []).filter(
      (s) => String(s.role || "").toLowerCase() === "coordinator"
    );
  }, [assignedTeam]);

  const assignedOtherStaff = useMemo(() => {
    return (assignedTeam || []).filter(
      (s) => String(s.role || "").toLowerCase() !== "coordinator"
    );
  }, [assignedTeam]);

  // Group currently assigned staff by role for clean pill badges
  const roleCounts = useMemo(() => {
    const counts = {};
    assignedTeam.forEach((s) => {
      const r = s.role || "Staff";
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [assignedTeam]);

  // Distinct roles for "Other Roles..." dropdown (excluding prominent chips)
  const otherRolesDropdownList = useMemo(() => {
    return availableOtherRoles.filter(
      (r) => !PROMINENT_OTHER_ROLES.includes(r) && r !== "ALL"
    );
  }, [availableOtherRoles]);

  // -------------------------------------------------------------------------
  // ASSIGN ACTIONS
  // -------------------------------------------------------------------------

  const persistStaffAssignment = async (payload) => {
    if (isEnquiry) {
      return assignEnquiryStaff(targetEntity, payload);
    }
    return assignPatientStaff(targetEntity, payload);
  };

  // 1. Assign Coordinator(s) — multi-select; additive, does not replace existing coordinators
  const handleAssignCoordinator = async (switchToOtherTab = false) => {
    if (isPartner()) return;
    if (selectedCoordinatorList.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Select Coordinator",
        text: "Please select at least one coordinator to assign.",
      });
      return;
    }

    const names = selectedCoordinatorList.map((c) => c.name).join(", ");
    const confirm = await Swal.fire({
      title:
        selectedCoordinatorList.length === 1
          ? "Assign Coordinator?"
          : `Assign ${selectedCoordinatorList.length} Coordinators?`,
      text: `Assign ${names} as Coordinator(s) for ${patientName}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0ba6df",
      confirmButtonText: "Yes, Assign",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    const ids = selectedCoordinatorList.map((c) => c.id);
    const notes = assignmentNotes.trim();
    const newlyAssigned = [];
    const errors = [];

    try {
      const bulkPayload = {
        coordinatorId: ids[0],
        staffId: ids[0],
        userId: ids[0],
        coordinatorIds: ids,
        staffIds: ids,
        role: "Coordinator",
        notes,
      };

      try {
        await persistStaffAssignment(bulkPayload);
        selectedCoordinatorList.forEach((coord) => {
          newlyAssigned.push({
            userId: coord.id,
            name: coord.name,
            role: "Coordinator",
            email: coord.email || "",
            phone: coord.phone || "",
            phoneCode: coord.dialCode || "",
            notes,
            assignedAt: new Date().toISOString(),
          });
        });
      } catch (bulkErr) {
        console.warn(
          "Bulk coordinator assign not accepted, assigning one-by-one:",
          bulkErr?.response?.status || bulkErr?.message
        );
        for (const coord of selectedCoordinatorList) {
          try {
            await persistStaffAssignment({
              coordinatorId: coord.id,
              staffId: coord.id,
              userId: coord.id,
              role: "Coordinator",
              notes,
            });
            newlyAssigned.push({
              userId: coord.id,
              name: coord.name,
              role: "Coordinator",
              email: coord.email || "",
              phone: coord.phone || "",
              phoneCode: coord.dialCode || "",
              notes,
              assignedAt: new Date().toISOString(),
            });
          } catch (err) {
            errors.push(
              `${coord.name}: ${err?.response?.data?.message || err?.message || "Failed"
              }`
            );
          }
        }
      }

      if (newlyAssigned.length === 0) {
        throw new Error(errors[0] || "Failed to assign coordinator");
      }

      setAssignedTeam((prev) => {
        const existingIds = new Set(
          newlyAssigned.map((c) => String(c.userId))
        );
        const kept = prev.filter(
          (s) => !existingIds.has(String(s.userId || s._id || s.id || ""))
        );
        return [...newlyAssigned, ...kept];
      });

      if (onSuccess) {
        onSuccess(newlyAssigned[0], patientId, newlyAssigned);
      }

      setSelectedCoordinatorMap({});
      setAssignmentNotes("");

      const assignedNames = newlyAssigned.map((c) => c.name).join(", ");
      if (switchToOtherTab) {
        setActiveTab("other_staff");
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: `${newlyAssigned.length} coordinator(s) assigned. You can now assign care team staff.`,
          showConfirmButton: false,
          timer: 3000,
        });
      } else {
        Swal.fire({
          icon: "success",
          title:
            newlyAssigned.length === 1
              ? "Coordinator Assigned"
              : "Coordinators Assigned",
          text: `Successfully assigned ${assignedNames}.`,
          timer: 1800,
          showConfirmButton: false,
        });
        onClose();
      }
    } catch (err) {
      console.error("Assign coordinator error:", err);
      Swal.fire({
        icon: "error",
        title: "Assignment Failed",
        text:
          err?.response?.data?.message ||
          err?.message ||
          errors.join("; ") ||
          "Failed to assign coordinator",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Assign Other Staff (Multi-Select)
  const handleAssignOtherStaff = async (keepOpen = false) => {
    if (isPartner()) return;
    if (selectedOtherStaffList.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Select Staff Member(s)",
        text: "Please select at least one staff member to assign.",
      });
      return;
    }

    const names = selectedOtherStaffList
      .map((s) => `${s.name} (${s.role})`)
      .join(", ");

    const confirm = await Swal.fire({
      title: `Assign ${selectedOtherStaffList.length} Staff Member(s)?`,
      text: `Assign ${names} to patient ${patientName}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0ba6df",
      confirmButtonText: "Yes, Assign",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    let successCount = 0;
    const errors = [];
    const newlyAssigned = [];

    for (const staff of selectedOtherStaffList) {
      try {
        const payload = {
          staffId: staff.id,
          userId: staff.id,
          role: staff.role || "Staff",
          notes: assignmentNotes.trim(),
        };

        await persistStaffAssignment(payload);
        successCount++;
        newlyAssigned.push({
          userId: staff.id,
          name: staff.name,
          role: staff.role || "Staff",
          email: staff.email || "",
          phone: staff.phone || "",
          phoneCode: staff.dialCode || "",
          notes: assignmentNotes.trim(),
          assignedAt: new Date().toISOString(),
        });
      } catch (err) {
        errors.push(
          err?.response?.data?.message ||
          err?.message ||
          `Failed to assign ${staff.name}`
        );
      }
    }

    if (newlyAssigned.length > 0) {
      setAssignedTeam((prev) => {
        const newIds = new Set(newlyAssigned.map((n) => String(n.userId)));
        const filtered = prev.filter(
          (s) => !newIds.has(String(s.userId || s._id || s.id))
        );
        return [...newlyAssigned, ...filtered];
      });

      if (onSuccess) {
        onSuccess(null, patientId, newlyAssigned);
      }
    }

    setSubmitting(false);

    if (errors.length > 0 && successCount === 0) {
      Swal.fire({
        icon: "error",
        title: "Assignment Failed",
        text: errors.join("\n"),
      });
      return;
    }

    setSelectedOtherStaffMap({});
    setAssignmentNotes("");

    if (keepOpen) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `Assigned ${successCount} staff member(s)! You can continue adding more.`,
        showConfirmButton: false,
        timer: 3500,
      });
    } else {
      Swal.fire({
        icon: "success",
        title: "Staff Assigned",
        text: `Successfully assigned ${successCount} staff member(s) to ${patientName}.`,
        timer: 1800,
        showConfirmButton: false,
      });
      onClose();
    }
  };

  // -------------------------------------------------------------------------
  // UNASSIGN HANDLER (Shared by both tabs)
  // -------------------------------------------------------------------------
  const handleUnassignStaff = async (staffMember) => {
    if (isPartner()) return;
    const sId = staffMember.userId || staffMember._id || staffMember.id;
    const sName = staffMember.name || "Staff Member";
    const sRole = staffMember.role || "Staff";

    const { value: reason, isConfirmed } = await Swal.fire({
      title: `Unassign ${sName}?`,
      text: `Are you sure you want to remove ${sName} (${sRole}) from patient ${patientName}?`,
      input: "text",
      inputPlaceholder: "Reason for unassignment (optional, e.g. Shift completed)",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Unassign",
      cancelButtonText: "Cancel",
    });

    if (!isConfirmed) return;

    setUnassigningId(sId || "active");
    try {
      const payload = {
        staffId: sId,
        role: sRole,
        reason: (reason || "").trim() || "Shift rotation completed",
      };

      if (isEnquiry) {
        await unassignEnquiryStaff(targetEntity, payload);
      } else {
        await unassignPatientStaff(targetEntity, payload);
      }

      // Reactively remove from assignedTeam state (will auto-reappear in available list!)
      setAssignedTeam((prev) =>
        prev.filter((s) => String(s.userId || s._id || s.id) !== String(sId))
      );

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `${sName} unassigned and saved to database!`,
        showConfirmButton: false,
        timer: 2500,
      });

      if (onSuccess) {
        onSuccess(null, patientId);
      }
    } catch (err) {
      console.error("Unassign error:", err);
      Swal.fire({
        icon: "error",
        title: "Unassign Failed",
        text:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to unassign staff",
      });
    } finally {
      setUnassigningId(null);
    }
  };

  // -------------------------------------------------------------------------
  // SAVE & CLOSE HANDLER (When no new staff is selected, saves notes & confirms)
  // -------------------------------------------------------------------------
  const handleSaveAndClose = async () => {
    if (isPartner()) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      // If assignment notes was entered/changed, save it for the assigned team
      if (assignmentNotes.trim() && assignedTeam.length > 0) {
        const primary = assignedTeam[0];
        const sId = primary.userId || primary._id || primary.id;
        if (sId) {
          const notesPayload = {
            staffId: sId,
            coordinatorId: sId,
            userId: sId,
            role: primary.role || "Staff",
            notes: assignmentNotes.trim(),
          };
          await persistStaffAssignment(notesPayload);
        }
      }

      Swal.fire({
        icon: "success",
        title: "Saved Successfully",
        text: `Assignments for ${patientName} are confirmed and saved in the database.`,
        timer: 1600,
        showConfirmButton: false,
      });

      if (onSuccess) {
        onSuccess(null, patientId, assignedTeam);
      }

      onClose();
    } catch (err) {
      console.error("Save & close error:", err);
      // Close modal cleanly even if notes saving encountered an issue
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => !submitting && !unassigningId && onClose()}
      fullWidth
      maxWidth="md"
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 48px)",
          height: { xs: "94vh", sm: "88vh", md: "84vh" },
          overflow: "hidden",
          margin: { xs: "8px", sm: "16px" },
        },
      }}
    >
      {/* MODAL HEADER */}
      <DialogTitle
        sx={{
          background: "linear-gradient(135deg, #0ba6df 0%, #0284c7 100%)",
          color: "#ffffff",
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fa-solid fa-user-gear" style={{ fontSize: "17px" }}></i>
          </div>
          <div>
            <h5
              style={{
                margin: 0,
                fontWeight: "600",
                fontSize: "16px",
                color: "#fff",
              }}
            >
              Staff & Coordinator Assignment
            </h5>
            <small
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: "11.5px",
              }}
            >
              {isEnquiry
                ? "Assign Staff & Coordinator to Enquiry. Transferred to patient on confirmation."
                : "Assign Primary Coordinator (Single Select) or Care Team (Doctors, Nurses, Physiotherapists - Multi-Select)"}
            </small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting || Boolean(unassigningId)}
          style={{
            background: "transparent",
            border: "none",
            color: "#ffffff",
            fontSize: "22px",
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px",
          }}
        >
          &times;
        </button>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          padding: "14px 20px",
          backgroundColor: "#f8fafc",
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "#f1f5f9",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#cbd5e1",
            borderRadius: "6px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "#94a3b8",
          },
        }}
      >
        {/* PATIENT SUMMARY CARD */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "10px 16px",
            marginBottom: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  style={{
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.5px",
                  }}
                >
                  {patientId || "N/A"}
                </span>
                <h6
                  style={{
                    margin: 0,
                    fontWeight: "700",
                    color: "#0f172a",
                    fontSize: "15px",
                  }}
                >
                  {patientName}
                </h6>
              </div>
              <div
                className="d-flex align-items-center gap-3 text-muted"
                style={{ fontSize: "12.5px" }}
              >
                {patientCountry && (
                  <span>
                    <i className="fa-solid fa-globe me-1 text-primary"></i>
                    <strong>Country:</strong> {patientCountry}
                  </span>
                )}
                {targetStatus && (
                  <span>
                    <i className="fa-solid fa-signal me-1 text-info"></i>
                    <strong>Status:</strong> {targetStatus}
                  </span>
                )}
                {isEnquiry && (
                  <span className="badge bg-light text-primary border" style={{ fontSize: "11px" }}>
                    Enquiry Record
                  </span>
                )}
              </div>
            </div>

            {/* ASSIGNED TEAM SUMMARY PILL */}
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: "600",
                  backgroundColor:
                    assignedTeam.length > 0 ? "#ecfdf5" : "#fef3c7",
                  color: assignedTeam.length > 0 ? "#047857" : "#b45309",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  border: `1px solid ${assignedTeam.length > 0 ? "#a7f3d0" : "#fde68a"
                    }`,
                }}
              >
                <i
                  className={`fa-solid ${assignedTeam.length > 0
                      ? "fa-users"
                      : "fa-triangle-exclamation"
                    } me-1`}
                ></i>
                {assignedTeam.length > 0
                  ? `${assignedTeam.length} Assigned (${assignedCoordinators.length} Coord, ${assignedOtherStaff.length} Staff)`
                  : "No Staff Assigned"}
              </span>
            </div>
          </div>
        </div>

        {/* CURRENTLY ASSIGNED TEAM SECTION (IF ANY) */}
        {assignedTeam.length > 0 && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "10px",
              border: "1px solid #bbf7d0",
              padding: "10px 14px",
              marginBottom: "12px",
              background: "linear-gradient(to right, #f0fdf4, #ffffff)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#166534",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <i className="fa-solid fa-users text-success"></i>
                <span>CURRENTLY ASSIGNED CARE TEAM ({assignedTeam.length}):</span>
              </div>

              {/* Grouped role badges */}
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                {Object.entries(roleCounts).map(([r, count]) => {
                  const style = getRoleBadgeStyle(r);
                  return (
                    <span
                      key={r}
                      style={{
                        backgroundColor: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                        fontSize: "10.5px",
                        fontWeight: "700",
                        padding: "1px 6px",
                        borderRadius: "10px",
                      }}
                    >
                      {count} {r}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Real-time DB sync badge */}
            <div
              style={{
                fontSize: "11px",
                color: "#166534",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "rgba(220, 252, 231, 0.7)",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #bbf7d0",
              }}
            >
              <i className="fa-solid fa-circle-check text-success"></i>
              <span>
                These {assignedTeam.length} member(s) are actively saved in the database. Clicking <strong>Unassign</strong> immediately removes them from DB.
              </span>
            </div>

            <div
              className="d-flex flex-column gap-2"
              style={{ maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}
            >
              {assignedTeam.map((staff, idx) => {
                const sId = staff.userId || staff._id || staff.id || idx;
                const isThisUnassigning = unassigningId === sId;
                const style = getRoleBadgeStyle(staff.role);

                return (
                  <div
                    key={sId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                          fontSize: "10.5px",
                          fontWeight: "700",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          textTransform: "capitalize",
                        }}
                      >
                        {staff.role || "Staff"}
                      </span>
                      <div>
                        <strong
                          style={{ fontSize: "13px", color: "#0f172a" }}
                        >
                          {staff.name || "Assigned Staff"}
                        </strong>
                        <div
                          style={{ fontSize: "11px", color: "#64748b" }}
                        >
                          {staff.phone && (
                            <span className="me-2">📞 {staff.phone}</span>
                          )}
                          {staff.email && <span>✉️ {staff.email}</span>}
                          {staff.notes && (
                            <span className="ms-2 text-info">
                              📝 <em>{staff.notes}</em>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleUnassignStaff(staff)}
                      disabled={Boolean(unassigningId) || submitting}
                      style={{
                        textTransform: "none",
                        fontSize: "11px",
                        fontWeight: "600",
                        padding: "2px 8px",
                        borderRadius: "5px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isThisUnassigning ? (
                        <>
                          <CircularProgress
                            size={12}
                            style={{ marginRight: "5px" }}
                          />
                          Removing...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-user-minus me-1"></i>
                          Unassign
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DEDICATED TWO-TAB NAVIGATION BAR */}
        {/* ========================================================================= */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            backgroundColor: "#e2e8f0",
            padding: "4px",
            borderRadius: "10px",
            marginBottom: "12px",
          }}
        >
          {/* TAB 1: COORDINATOR */}
          <button
            type="button"
            onClick={() => setActiveTab("coordinator")}
            style={{
              flex: 1,
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: activeTab === "coordinator" ? "700" : "600",
              color: activeTab === "coordinator" ? "#0284c7" : "#475569",
              backgroundColor:
                activeTab === "coordinator" ? "#ffffff" : "transparent",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              boxShadow:
                activeTab === "coordinator"
                  ? "0 2px 5px rgba(0,0,0,0.08)"
                  : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <i className="fa-solid fa-user-tie" style={{ fontSize: "14px" }}></i>
            <span>Coordinator</span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                backgroundColor:
                  activeTab === "coordinator" ? "#e0f2fe" : "rgba(255,255,255,0.6)",
                color: activeTab === "coordinator" ? "#0369a1" : "#64748b",
                padding: "2px 7px",
                borderRadius: "10px",
              }}
            >
              Multi-Select
            </span>
            {assignedCoordinators.length > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  backgroundColor: "#dcfce7",
                  color: "#15803d",
                  padding: "2px 7px",
                  borderRadius: "10px",
                }}
              >
                ✓ Assigned
              </span>
            )}
          </button>

          {/* TAB 2: OTHER STAFF */}
          <button
            type="button"
            onClick={() => setActiveTab("other_staff")}
            style={{
              flex: 1,
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: activeTab === "other_staff" ? "700" : "600",
              color: activeTab === "other_staff" ? "#0284c7" : "#475569",
              backgroundColor:
                activeTab === "other_staff" ? "#ffffff" : "transparent",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              boxShadow:
                activeTab === "other_staff"
                  ? "0 2px 5px rgba(0,0,0,0.08)"
                  : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <i className="fa-solid fa-user-doctor" style={{ fontSize: "14px" }}></i>
            <span>Other Staff</span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                backgroundColor:
                  activeTab === "other_staff" ? "#e0f2fe" : "rgba(255,255,255,0.6)",
                color: activeTab === "other_staff" ? "#0369a1" : "#64748b",
                padding: "2px 7px",
                borderRadius: "10px",
              }}
            >
              Multi-Select
            </span>
            {assignedOtherStaff.length > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  backgroundColor: "#dcfce7",
                  color: "#15803d",
                  padding: "2px 7px",
                  borderRadius: "10px",
                }}
              >
                {assignedOtherStaff.length} Assigned
              </span>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1 CONTENT: ASSIGN COORDINATOR (MULTI SELECT) */}
        {/* ========================================================================= */}
        {activeTab === "coordinator" && (
          <div>
            {/* Helper Notice */}
            <div
              style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "8px",
                padding: "8px 12px",
                marginBottom: "10px",
                fontSize: "12px",
                color: "#0369a1",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-circle-info text-info"></i>
                <span>
                  Select <strong>one or more Coordinators</strong> for this patient.
                  {assignedCoordinators.length > 0 && (
                    <span className="ms-1 text-success fw-bold">
                      (Already assigned: {assignedCoordinators.map((c) => c.name).join(", ")})
                    </span>
                  )}
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Checkbox (Multi-Select)
              </span>
            </div>

            {/* Coordinator Search Input */}
            <div className="mb-2">
              <TextField
                fullWidth
                size="small"
                placeholder="Search coordinators by name, email, phone, or country..."
                value={coordinatorSearch}
                onChange={(e) => setCoordinatorSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <i
                        className="fa-solid fa-magnifying-glass text-muted"
                        style={{ fontSize: "13px" }}
                      ></i>
                    </InputAdornment>
                  ),
                  style: {
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                  },
                }}
              />
            </div>

            {/* Selected Coordinator Chip / Banner */}
            {selectedCoordinatorList.length > 0 && (
              <div
                style={{
                  backgroundColor: "#eff6ff",
                  border: "1px solid #93c5fd",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#1d4ed8" }}>
                    <i className="fa-solid fa-check-circle me-1"></i>
                    Selected Coordinator{selectedCoordinatorList.length > 1 ? "s" : ""}:
                  </span>
                  {selectedCoordinatorList.map((c) => (
                    <strong key={c.id} style={{ fontSize: "12.5px", color: "#1e3a8a" }}>
                      {c.name}
                    </strong>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCoordinatorMap({})}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "11.5px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear Selection
                </button>
              </div>
            )}

            {/* Coordinator List Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "2px 4px 6px",
                fontSize: "11.5px",
                color: "#64748b",
              }}
            >
              <span>
                Available Coordinators: <strong>{filteredCoordinators.length}</strong>
              </span>
              <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: "600" }}>
                Click row to select (multiple allowed)
              </span>
            </div>

            {/* Coordinator Selection List */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                maxHeight: "220px",
                overflowY: "auto",
                padding: "6px",
                marginBottom: "10px",
              }}
            >
              {loadingCoordinators ? (
                <div className="text-center py-4">
                  <CircularProgress size={26} style={{ color: "#0ba6df" }} />
                  <p className="mt-2 text-muted" style={{ fontSize: "12px" }}>
                    Loading coordinators...
                  </p>
                </div>
              ) : filteredCoordinators.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa-solid fa-user-check fa-2x mb-2 text-success"></i>
                  <p style={{ margin: 0, fontSize: "12.5px", fontWeight: "500" }}>
                    {coordinatorSearch
                      ? "No coordinators match your search."
                      : assignedCoordinators.length > 0
                        ? "All active coordinators are already assigned to this patient."
                        : "No active coordinators found."}
                  </p>
                  {assignedCoordinators.length > 0 && !coordinatorSearch && (
                    <small className="text-muted" style={{ fontSize: "11px" }}>
                      Unassign a coordinator from the care team above to reassign them.
                    </small>
                  )}
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {filteredCoordinators.map((coord) => {
                    const cId = String(
                      coord._id || coord.id || coord.userId || coord.staffId || coord.user_id || ""
                    ).trim();
                    const isSelected = Boolean(selectedCoordinatorMap[cId]);
                    const hasCountryMatch =
                      patientCountry &&
                      Array.isArray(coord.accessCountries) &&
                      coord.accessCountries.some(
                        (cnt) => String(cnt).toLowerCase() === patientCountry.toLowerCase()
                      );

                    return (
                      <div
                        key={cId}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => handleSelectCoordinator(coord)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleSelectCoordinator(coord);
                          }
                        }}
                        style={{
                          border: isSelected ? "2px solid #0ba6df" : "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          cursor: "pointer",
                          backgroundColor: isSelected ? "#f0f9ff" : "#ffffff",
                          boxShadow: isSelected
                            ? "0 2px 6px rgba(11, 166, 223, 0.18)"
                            : "none",
                          transition: "all 0.15s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          userSelect: "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <input
                            type="checkbox"
                            name="coordinator_selection_checkbox"
                            checked={isSelected}
                            readOnly
                            tabIndex={-1}
                            style={{
                              accentColor: "#0ba6df",
                              width: "18px",
                              height: "18px",
                              cursor: "pointer",
                              pointerEvents: "none",
                            }}
                          />
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: isSelected ? "#0ba6df" : "#dbeafe",
                              color: isSelected ? "#ffffff" : "#1e40af",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "12px",
                              flexShrink: 0,
                            }}
                          >
                            {coord.name ? coord.name.charAt(0).toUpperCase() : "C"}
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                                {coord.name}
                              </strong>
                              <span
                                style={{
                                  backgroundColor: "#dbeafe",
                                  color: "#1e40af",
                                  border: "1px solid #bfdbfe",
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                Coordinator
                              </span>
                              {hasCountryMatch && (
                                <span
                                  style={{
                                    backgroundColor: "#fef9c3",
                                    color: "#854d0e",
                                    border: "1px solid #fde047",
                                    fontSize: "9.5px",
                                    fontWeight: "600",
                                    padding: "1px 5px",
                                    borderRadius: "4px",
                                  }}
                                  title={`Handles ${patientCountry}`}
                                >
                                  <i className="fa-solid fa-flag me-1"></i>
                                  Country Match
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                              <span className="me-3">
                                <i className="fa-regular fa-envelope me-1"></i>
                                {coord.email || "No email"}
                              </span>
                              {(coord.phone_no || coord.phone) && (
                                <span>
                                  <i className="fa-solid fa-phone me-1"></i>
                                  {coord.phoneCode || ""} {coord.phone_no || coord.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2 CONTENT: ASSIGN OTHER STAFF (MULTI-SELECT) */}
        {/* ========================================================================= */}
        {activeTab === "other_staff" && (
          <div>
            {/* ROLE FILTER BAR (Coordinator strictly excluded) */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                padding: "10px 14px",
                marginBottom: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <i
                    className="fa-solid fa-filter text-primary"
                    style={{ fontSize: "12px" }}
                  ></i>
                  <span>FILTER CARE TEAM ROLES:</span>
                  <span
                    style={{
                      fontSize: "10.5px",
                      fontWeight: "600",
                      color: "#0369a1",
                      backgroundColor: "#e0f2fe",
                      padding: "1px 7px",
                      borderRadius: "10px",
                    }}
                  >
                    {otherSelectedRoles.includes("ALL")
                      ? "All Roles Active"
                      : `${otherSelectedRoles.length} Role${otherSelectedRoles.length > 1 ? "s" : ""
                      } Filtered`}
                  </span>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllOtherRoles}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#0284c7",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      padding: "0 4px",
                      textDecoration: "underline",
                    }}
                  >
                    Select All Roles
                  </button>
                  <span style={{ color: "#cbd5e1" }}>|</span>
                  <button
                    type="button"
                    onClick={resetOtherRoles}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      fontSize: "11px",
                      fontWeight: "500",
                      cursor: "pointer",
                      padding: "0 4px",
                      textDecoration: "underline",
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* INTERACTIVE ROLE FILTER CHIPS */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {/* "All Roles" chip */}
                <button
                  type="button"
                  onClick={() => handleToggleOtherRole("ALL")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "11.5px",
                    fontWeight: "600",
                    borderRadius: "16px",
                    border: otherSelectedRoles.includes("ALL")
                      ? "1.5px solid #0284c7"
                      : "1px solid #cbd5e1",
                    backgroundColor: otherSelectedRoles.includes("ALL")
                      ? "#0284c7"
                      : "#ffffff",
                    color: otherSelectedRoles.includes("ALL")
                      ? "#ffffff"
                      : "#475569",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <i
                    className="fa-solid fa-layer-group"
                    style={{ fontSize: "11px" }}
                  ></i>
                  All Roles
                  {otherSelectedRoles.includes("ALL") && <span>✓</span>}
                </button>

                {/* Prominent Multi-Role Chips (Doctor, Nurse, etc.) */}
                {PROMINENT_OTHER_ROLES.map((roleName) => {
                  const isSelected =
                    otherSelectedRoles.includes("ALL") ||
                    otherSelectedRoles.includes(roleName);
                  const badgeStyle = getRoleBadgeStyle(roleName);

                  return (
                    <button
                      key={roleName}
                      type="button"
                      onClick={() => handleToggleOtherRole(roleName)}
                      style={{
                        padding: "5px 13px",
                        fontSize: "11.5px",
                        fontWeight: isSelected ? "700" : "500",
                        borderRadius: "16px",
                        border: isSelected
                          ? `1.5px solid ${badgeStyle.border || "#0ba6df"}`
                          : "1px solid #cbd5e1",
                        backgroundColor: isSelected ? badgeStyle.bg : "#ffffff",
                        color: isSelected ? badgeStyle.text : "#475569",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: isSelected
                          ? "0 2px 4px rgba(0,0,0,0.06)"
                          : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: isSelected
                            ? badgeStyle.text
                            : "#94a3b8",
                          display: "inline-block",
                        }}
                      />
                      {roleName}
                      {isSelected && (
                        <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* "Other Roles... ▾" Multi-Select Dropdown */}
                {otherRolesDropdownList.length > 0 && (
                  <div
                    ref={dropdownRef}
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOtherRolesDropdownOpen((prev) => !prev)
                      }
                      style={{
                        padding: "5px 14px",
                        fontSize: "11.5px",
                        fontWeight: "600",
                        borderRadius: "16px",
                        border: otherRolesDropdownList.some((r) =>
                          otherSelectedRoles.includes(r)
                        )
                          ? "1.5px solid #0ba6df"
                          : "1px solid #cbd5e1",
                        backgroundColor: otherRolesDropdownList.some((r) =>
                          otherSelectedRoles.includes(r)
                        )
                          ? "#f0f9ff"
                          : "#ffffff",
                        color: otherRolesDropdownList.some((r) =>
                          otherSelectedRoles.includes(r)
                        )
                          ? "#0284c7"
                          : "#475569",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>
                        {otherRolesDropdownList.filter((r) =>
                          otherSelectedRoles.includes(r)
                        ).length > 0
                          ? `Other Roles (${otherRolesDropdownList.filter((r) =>
                            otherSelectedRoles.includes(r)
                          ).length
                          })`
                          : "Other Roles..."}
                      </span>
                      <i
                        className={`fa-solid fa-chevron-${otherRolesDropdownOpen ? "up" : "down"
                          }`}
                        style={{ fontSize: "10px" }}
                      />
                    </button>

                    {otherRolesDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          zIndex: 1300,
                          backgroundColor: "#ffffff",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                          minWidth: "220px",
                          padding: "8px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            color: "#64748b",
                            padding: "4px 8px 6px",
                            borderBottom: "1px solid #f1f5f9",
                            marginBottom: "6px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>CARE TEAM ROLES</span>
                          <span style={{ fontSize: "10px", color: "#0ba6df" }}>
                            Multi-select
                          </span>
                        </div>

                        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                          {otherRolesDropdownList.map((roleName) => {
                            const isChecked =
                              otherSelectedRoles.includes("ALL") ||
                              otherSelectedRoles.includes(roleName);
                            return (
                              <div
                                key={roleName}
                                onClick={() => handleToggleOtherRole(roleName)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  backgroundColor: isChecked
                                    ? "#f0f9ff"
                                    : "transparent",
                                  fontSize: "12px",
                                  color: isChecked ? "#0369a1" : "#334155",
                                  fontWeight: isChecked ? "600" : "400",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                  tabIndex={-1}
                                  style={{
                                    accentColor: "#0ba6df",
                                    width: "15px",
                                    height: "15px",
                                    cursor: "pointer",
                                    pointerEvents: "none",
                                  }}
                                />
                                <span>{roleName}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SEARCH BAR & SELECT ALL TOGGLE */}
            <div className="mb-2 d-flex gap-2 align-items-center">
              <TextField
                fullWidth
                size="small"
                placeholder="Search staff by name, email, phone, role, or country..."
                value={otherStaffSearch}
                onChange={(e) => setOtherStaffSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <i
                        className="fa-solid fa-magnifying-glass text-muted"
                        style={{ fontSize: "13px" }}
                      ></i>
                    </InputAdornment>
                  ),
                  style: {
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                  },
                }}
              />

              {filteredOtherStaff.length > 1 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSelectAllFilteredOtherStaff}
                  style={{
                    textTransform: "none",
                    fontSize: "11.5px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                    height: "37px",
                    borderRadius: "8px",
                    borderColor: "#cbd5e1",
                    color: "#334155",
                  }}
                >
                  {filteredOtherStaff.length > 0 &&
                    filteredOtherStaff.every((s) => {
                      const sId = String(
                        s._id || s.id || s.userId || s.staffId || ""
                      ).trim();
                      return Boolean(selectedOtherStaffMap[sId]);
                    })
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              )}
            </div>

            {/* MULTI-USER SELECTION SUMMARY CHIPS */}
            {selectedOtherStaffList.length > 0 && (
              <div
                style={{
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11.5px",
                      fontWeight: "700",
                      color: "#0369a1",
                    }}
                  >
                    <i className="fa-solid fa-user-check me-1"></i>
                    SELECTED STAFF ({selectedOtherStaffList.length}):
                  </span>
                  {selectedOtherStaffList.map((staff) => {
                    const style = getRoleBadgeStyle(staff.role);
                    return (
                      <span
                        key={staff.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          backgroundColor: "#ffffff",
                          border: `1px solid ${style.border || "#cbd5e1"}`,
                          borderRadius: "12px",
                          padding: "2px 8px 2px 10px",
                          fontSize: "11px",
                          fontWeight: "600",
                          color: "#0f172a",
                        }}
                      >
                        <span>{staff.name}</span>
                        <span
                          style={{
                            backgroundColor: style.bg,
                            color: style.text,
                            fontSize: "9.5px",
                            padding: "1px 5px",
                            borderRadius: "8px",
                          }}
                        >
                          {staff.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelectedOtherStaff(staff.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            fontSize: "13px",
                            cursor: "pointer",
                            padding: "0 2px",
                            lineHeight: 1,
                          }}
                          title="Remove from selection"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOtherStaffMap({})}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    fontSize: "11px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Other Staff List Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "2px 4px 6px",
                fontSize: "11.5px",
                color: "#64748b",
              }}
            >
              <span>
                Available Staff: <strong>{filteredOtherStaff.length}</strong>
              </span>
              <span
                style={{ fontSize: "11px", color: "#0284c7", fontWeight: "600" }}
              >
                Multi-Select supported (Check any staff members)
              </span>
            </div>

            {/* Other Staff Selection List */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                maxHeight: "220px",
                overflowY: "auto",
                padding: "6px",
                marginBottom: "10px",
              }}
            >
              {loadingOtherStaff ? (
                <div className="text-center py-4">
                  <CircularProgress size={26} style={{ color: "#0ba6df" }} />
                  <p className="mt-2 text-muted" style={{ fontSize: "12px" }}>
                    Loading staff members...
                  </p>
                </div>
              ) : filteredOtherStaff.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa-solid fa-user-check fa-2x mb-2 text-success"></i>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12.5px",
                      fontWeight: "500",
                    }}
                  >
                    {otherStaffSearch
                      ? "No staff members match your search."
                      : assignedOtherStaff.length > 0
                        ? "All active staff for this role are already assigned to this patient."
                        : "No active staff found for the selected roles."}
                  </p>
                  {assignedOtherStaff.length > 0 && !otherStaffSearch && (
                    <small className="text-muted" style={{ fontSize: "11px" }}>
                      To reassign, click &quot;Unassign&quot; in the care team above first.
                    </small>
                  )}
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {filteredOtherStaff.map((staff) => {
                    const sId = String(
                      staff._id || staff.id || staff.userId || staff.staffId || staff.user_id || ""
                    ).trim();
                    const isSelected = Boolean(selectedOtherStaffMap[sId]);
                    const inferredRole = staff.role || "Staff";
                    const style = getRoleBadgeStyle(inferredRole);

                    return (
                      <div
                        key={sId}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => toggleSelectOtherStaff(staff)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            toggleSelectOtherStaff(staff);
                          }
                        }}
                        style={{
                          border: isSelected
                            ? "2px solid #0ba6df"
                            : "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          cursor: "pointer",
                          backgroundColor: isSelected ? "#f0f9ff" : "#ffffff",
                          boxShadow: isSelected
                            ? "0 2px 6px rgba(11, 166, 223, 0.18)"
                            : "none",
                          transition: "all 0.15s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            tabIndex={-1}
                            style={{
                              accentColor: "#0ba6df",
                              width: "18px",
                              height: "18px",
                              cursor: "pointer",
                              pointerEvents: "none",
                            }}
                          />
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: isSelected ? "#0ba6df" : "#e2e8f0",
                              color: isSelected ? "#ffffff" : "#475569",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "12px",
                              flexShrink: 0,
                            }}
                          >
                            {staff.name
                              ? staff.name.charAt(0).toUpperCase()
                              : "S"}
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <strong
                                style={{ fontSize: "13px", color: "#0f172a" }}
                              >
                                {staff.name}
                              </strong>
                              <span
                                style={{
                                  backgroundColor: style.bg,
                                  color: style.text,
                                  border: `1px solid ${style.border}`,
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                {inferredRole}
                              </span>
                            </div>
                            <div
                              style={{ fontSize: "11.5px", color: "#64748b" }}
                            >
                              <span className="me-3">
                                <i className="fa-regular fa-envelope me-1"></i>
                                {staff.email || "No email"}
                              </span>
                              {(staff.phone_no || staff.phone) && (
                                <span>
                                  <i className="fa-solid fa-phone me-1"></i>
                                  {staff.phoneCode || ""}{" "}
                                  {staff.phone_no || staff.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SHARED ASSIGNMENT NOTES INPUT */}
        <div style={{ marginTop: "6px" }}>
          <TextField
            fullWidth
            size="small"
            label="Assignment Notes (Optional)"
            placeholder="e.g. Primary coordinator, Day shift nurse, Consulting oncologist..."
            value={assignmentNotes}
            onChange={(e) => setAssignmentNotes(e.target.value)}
            InputProps={{
              style: {
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                fontSize: "12.5px",
              },
            }}
          />
        </div>
      </DialogContent>

      {/* FOOTER ACTIONS - TAILORED PER TAB */}
      <DialogActions
        sx={{
          padding: "12px 20px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <Button
          onClick={onClose}
          disabled={submitting || Boolean(unassigningId)}
          style={{
            borderRadius: "6px",
            padding: "5px 16px",
            fontSize: "12.5px",
            fontWeight: "600",
            color: "#64748b",
            border: "1px solid #cbd5e1",
            textTransform: "none",
          }}
        >
          {assignedTeam.length > 0 ? "Done" : "Cancel"}
        </Button>

        {/* TAB 1 FOOTER: ASSIGN COORDINATOR BUTTONS */}
        {activeTab === "coordinator" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {selectedCoordinatorList.length > 0 ? (
              <>
                <Button
                  onClick={() => handleAssignCoordinator(true)}
                  disabled={
                    submitting ||
                    Boolean(unassigningId) ||
                    loadingCoordinators
                  }
                  variant="outlined"
                  style={{
                    borderColor: "#0ba6df",
                    color: "#0ba6df",
                    borderRadius: "6px",
                    padding: "5px 14px",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    textTransform: "none",
                  }}
                  title="Assign coordinator and switch to Other Staff tab"
                >
                  {submitting ? (
                    "Assigning..."
                  ) : (
                    <>
                      <i className="fa-solid fa-user-plus me-1"></i>
                      Assign & Go to Other Staff
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleAssignCoordinator(false)}
                  disabled={
                    submitting ||
                    Boolean(unassigningId) ||
                    loadingCoordinators
                  }
                  variant="contained"
                  style={{
                    backgroundColor: "#0ba6df",
                    color: "#ffffff",
                    borderRadius: "6px",
                    padding: "5px 18px",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    textTransform: "none",
                    boxShadow: "0 2px 4px rgba(11, 166, 223, 0.2)",
                  }}
                >
                  {submitting ? (
                    <>
                      <CircularProgress
                        size={14}
                        style={{ color: "#fff", marginRight: "6px" }}
                      />
                      Assigning...
                    </>
                  ) : (
                    selectedCoordinatorList.length > 1
                      ? `Assign ${selectedCoordinatorList.length} Coordinators & Close`
                      : "Assign Coordinator & Close"
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSaveAndClose}
                disabled={submitting || Boolean(unassigningId)}
                variant="contained"
                style={{
                  backgroundColor: "#0ba6df",
                  color: "#ffffff",
                  borderRadius: "6px",
                  padding: "5px 20px",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  textTransform: "none",
                  boxShadow: "0 2px 4px rgba(11, 166, 223, 0.2)",
                }}
              >
                {submitting ? (
                  <>
                    <CircularProgress
                      size={14}
                      style={{ color: "#fff", marginRight: "6px" }}
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check me-1"></i>
                    Save & Close
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* TAB 2 FOOTER: ASSIGN OTHER STAFF BUTTONS */}
        {activeTab === "other_staff" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {selectedOtherStaffList.length > 0 ? (
              <>
                <Button
                  onClick={() => handleAssignOtherStaff(true)}
                  disabled={
                    submitting ||
                    Boolean(unassigningId) ||
                    loadingOtherStaff
                  }
                  variant="outlined"
                  style={{
                    borderColor: "#0ba6df",
                    color: "#0ba6df",
                    borderRadius: "6px",
                    padding: "5px 14px",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    textTransform: "none",
                  }}
                  title="Assign selected staff and remain here to select more roles"
                >
                  {submitting ? (
                    "Assigning..."
                  ) : (
                    <>
                      <i className="fa-solid fa-user-plus me-1"></i>
                      Assign ({selectedOtherStaffList.length}) & Add More
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleAssignOtherStaff(false)}
                  disabled={
                    submitting ||
                    Boolean(unassigningId) ||
                    loadingOtherStaff
                  }
                  variant="contained"
                  style={{
                    backgroundColor: "#0ba6df",
                    color: "#ffffff",
                    borderRadius: "6px",
                    padding: "5px 18px",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    textTransform: "none",
                    boxShadow: "0 2px 4px rgba(11, 166, 223, 0.2)",
                  }}
                >
                  {submitting ? (
                    <>
                      <CircularProgress
                        size={14}
                        style={{ color: "#fff", marginRight: "6px" }}
                      />
                      Assigning...
                    </>
                  ) : (
                    `Assign Staff (${selectedOtherStaffList.length}) & Close`
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSaveAndClose}
                disabled={submitting || Boolean(unassigningId)}
                variant="contained"
                style={{
                  backgroundColor: "#0ba6df",
                  color: "#ffffff",
                  borderRadius: "6px",
                  padding: "5px 20px",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  textTransform: "none",
                  boxShadow: "0 2px 4px rgba(11, 166, 223, 0.2)",
                }}
              >
                {submitting ? (
                  <>
                    <CircularProgress
                      size={14}
                      style={{ color: "#fff", marginRight: "6px" }}
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check me-1"></i>
                    Save & Close
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogActions>
    </Dialog>
  );
}
