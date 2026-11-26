import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { GetAllNewPermission } from "../../reducer/NewpermissonsSlice";
import { NewUpdatePermission } from "../../reducer/NewpermissonsSlice";
import Swal from "sweetalert2";
import "./Permission.css";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
} from "@mui/material";
import { baseurl } from "../../Basurl/Baseurl";
import axios from "axios";
import {
  ensureEnquirySubTabPermissions,
  formatPermissionEndpointLabel,
  getPermissionTableEndpoints,
} from "../../utils/sosPermissions";
import {
  fetchAllCrmDashboardPermissions,
  updateCrmDashboardPermissions,
} from "../../services/dashboardPermissionsApi";

export default function PermissionPage() {
  const dispatch = useDispatch();
  const [popupopenattande, setPopupopenattande] = useState(false);
  const { NewPermissions, loading, error } = useSelector(
    (state) => state.NewPermissions,
  );
  const [permissionsData, setPermissionsData] = useState([]);
  const [fullWidth] = React.useState(true);
  const [note1s, setNote1s] = React.useState("");
  const [maxWidth] = React.useState("sm");

  // View state: "endpoints" (Menu Permissions) or "dashboard" (CRM Dashboard Permissions)
  const [activeTab, setActiveTab] = useState("endpoints");

  // CRM Dashboard Permissions state (Section-level permissions)
  const [dashboardRoles, setDashboardRoles] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardSaving, setDashboardSaving] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [expandedSubItems, setExpandedSubItems] = useState({});
  const [roleSearch, setRoleSearch] = useState("");

  useEffect(() => {
    dispatch(GetAllNewPermission({ limit: 500 }));
  }, [dispatch]);

  useEffect(() => {
    console.log("Fetched NewPermissions:", NewPermissions);
    if (Array.isArray(NewPermissions)) {
      setPermissionsData(ensureEnquirySubTabPermissions(NewPermissions));
    } else {
      console.warn("NewPermissions is not an array:", NewPermissions);
      setPermissionsData([]);
    }
  }, [NewPermissions]);

  const filteredPermissionsData = useMemo(() => {
    if (!roleSearch.trim()) return permissionsData;
    const q = roleSearch.toLowerCase().trim();
    return permissionsData.filter((r) =>
      String(r.role || "").toLowerCase().includes(q)
    );
  }, [permissionsData, roleSearch]);

  // Load CRM Dashboard permissions
  const loadDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const existingRolesList = permissionsData.map((r) => r.role);
      const data = await fetchAllCrmDashboardPermissions(existingRolesList);
      if (Array.isArray(data)) {
        setDashboardRoles(data);
      }
    } catch (err) {
      console.error("Error loading dashboard permissions:", err);
    } finally {
      setDashboardLoading(false);
    }
  }, [permissionsData]);

  useEffect(() => {
    if (activeTab === "dashboard" && dashboardRoles.length === 0) {
      loadDashboardData();
    }
  }, [activeTab, dashboardRoles.length, loadDashboardData]);

  // Checkbox toggle for Menu/Endpoints
  const handleCheckboxChange = (roleId, endpoint, isChecked) => {
    const updatedPermissions = permissionsData.map((role) => {
      if (role.Id === roleId) {
        return {
          ...role,
          permissions: {
            ...role.permissions,
            [endpoint]: isChecked ? 1 : 0,
          },
        };
      }
      return role;
    });
    setPermissionsData(updatedPermissions);
  };

  // Submit Menu/Endpoints permissions
  const handleSubmit = async () => {
    const formattedPermissions = permissionsData.flatMap((role) =>
      Object.entries(role.permissions).map(([endpoint, allow]) => ({
        role: role.role,
        endpoint,
        allow,
      })),
    );
    let timerInterval;
    Swal.fire({
      title: "Processing...",
      html: "This may take a few seconds. Time elapsed: <b></b> ms.",
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading();
        const timer = Swal.getPopup().querySelector("b");
        let startTime = Date.now();
        timerInterval = setInterval(() => {
          timer.textContent = `${Date.now() - startTime}`;
        }, 100);
      },
      willClose: () => {
        clearInterval(timerInterval);
      },
    });
    try {
      await dispatch(
        NewUpdatePermission({ permissions: formattedPermissions }),
      ).unwrap();
      clearInterval(timerInterval);
      Swal.fire("Success!", "Permissions updated successfully!", "success");
      dispatch(GetAllNewPermission({ limit: 500 }));
    } catch (err) {
      clearInterval(timerInterval);
      Swal.fire("Error!", err?.message || "An error occurred", "error");
    }
  };

  // Checkbox toggle for a Section (1 checkbox per cell)
  const handleSectionCheckboxChange = (
    targetRole,
    categoryName,
    sectionName,
    isChecked,
  ) => {
    setDashboardRoles((prevRoles) =>
      prevRoles.map((roleObj) => {
        if (roleObj.role !== targetRole) return roleObj;
        return {
          ...roleObj,
          permissions: (roleObj.permissions || []).map((cat) => {
            if (cat.category !== categoryName) return cat;
            return {
              ...cat,
              sections: (cat.sections || []).map((sec) => {
                if (sec.sectionName !== sectionName) return sec;
                return {
                  ...sec,
                  allow: isChecked ? 1 : 0,
                  items: (sec.items || []).map((it) => ({
                    ...it,
                    allow: isChecked ? 1 : 0,
                  })),
                };
              }),
            };
          }),
        };
      }),
    );
  };

  // Toggle select all sections for a role column
  const handleSelectAllForRole = (targetRole, shouldSelectAll) => {
    setDashboardRoles((prevRoles) =>
      prevRoles.map((roleObj) => {
        if (roleObj.role !== targetRole) return roleObj;
        return {
          ...roleObj,
          permissions: (roleObj.permissions || []).map((cat) => ({
            ...cat,
            sections: (cat.sections || []).map((sec) => ({
              ...sec,
              allow: shouldSelectAll ? 1 : 0,
              items: (sec.items || []).map((it) => ({
                ...it,
                allow: shouldSelectAll ? 1 : 0,
              })),
            })),
          })),
        };
      }),
    );
  };

  // Toggle select all sections in a category for a role
  const handleSelectCategoryForRole = (
    targetRole,
    categoryName,
    shouldSelectAll,
  ) => {
    setDashboardRoles((prevRoles) =>
      prevRoles.map((roleObj) => {
        if (roleObj.role !== targetRole) return roleObj;
        return {
          ...roleObj,
          permissions: (roleObj.permissions || []).map((cat) => {
            if (cat.category !== categoryName) return cat;
            return {
              ...cat,
              sections: (cat.sections || []).map((sec) => ({
                ...sec,
                allow: shouldSelectAll ? 1 : 0,
                items: (sec.items || []).map((it) => ({
                  ...it,
                  allow: shouldSelectAll ? 1 : 0,
                })),
              })),
            };
          }),
        };
      }),
    );
  };

  // Save CRM Dashboard permissions (Batch send sections only, NO itemName)
  const handleSaveDashboardPermissions = async () => {
    const payloadPermissions = [];
    dashboardRoles.forEach((roleObj) => {
      (roleObj.permissions || []).forEach((categoryRow) => {
        (categoryRow.sections || []).forEach((sectionColumn) => {
          // Exactly 1 object per section cell, NO itemName!
          payloadPermissions.push({
            role: roleObj.role,
            category: categoryRow.category,
            sectionName: sectionColumn.sectionName,
            allow:
              sectionColumn.allow === 1 || sectionColumn.allow === true
                ? 1
                : 0,
          });
        });
      });
    });

    if (payloadPermissions.length === 0) {
      return Swal.fire("Notice", "No dashboard sections to save", "info");
    }

    setDashboardSaving(true);
    let timerInterval;
    Swal.fire({
      title: "Saving Dashboard Permissions...",
      html: `Batch updating ${payloadPermissions.length} section permissions. Time elapsed: <b></b> ms.`,
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading();
        const timer = Swal.getPopup().querySelector("b");
        let startTime = Date.now();
        timerInterval = setInterval(() => {
          timer.textContent = `${Date.now() - startTime}`;
        }, 100);
      },
      willClose: () => {
        clearInterval(timerInterval);
      },
    });

    try {
      const response = await updateCrmDashboardPermissions(payloadPermissions);
      clearInterval(timerInterval);
      Swal.fire({
        icon: "success",
        title: "Success!",
        text:
          response?.message ||
          "Successfully batch updated dashboard section permissions!",
      });
    } catch (err) {
      clearInterval(timerInterval);
      console.error("Dashboard permissions save error:", err);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text:
          err?.message ||
          err?.response?.data?.message ||
          "An error occurred while updating permissions",
      });
    } finally {
      setDashboardSaving(false);
    }
  };

  const toggleCategoryCollapse = (cat) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const toggleSubItems = (key) => {
    setExpandedSubItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Extract unique categories for filter pills
  const availableCategories = useMemo(() => {
    const set = new Set();
    dashboardRoles.forEach((roleObj) => {
      (roleObj.permissions || []).forEach((cat) => {
        if (cat.category) set.add(cat.category);
      });
    });
    return Array.from(set);
  }, [dashboardRoles]);

  // Unified categories -> sections structure for rendering table rows
  const unifiedStructure = useMemo(() => {
    const categoriesMap = new Map();

    dashboardRoles.forEach((roleObj) => {
      (roleObj.permissions || []).forEach((cat) => {
        if (!categoriesMap.has(cat.category)) {
          categoriesMap.set(cat.category, new Map());
        }
        const sectionsMap = categoriesMap.get(cat.category);

        (cat.sections || []).forEach((sec) => {
          if (!sectionsMap.has(sec.sectionName)) {
            sectionsMap.set(sec.sectionName, sec.items || []);
          }
        });
      });
    });

    const result = [];
    categoriesMap.forEach((sectionsMap, category) => {
      if (selectedCategory !== "ALL" && category !== selectedCategory) return;

      const sections = [];
      sectionsMap.forEach((items, sectionName) => {
        if (dashboardSearch.trim()) {
          const q = dashboardSearch.toLowerCase();
          const matches =
            sectionName.toLowerCase().includes(q) ||
            category.toLowerCase().includes(q) ||
            items.some((it) =>
              (typeof it === "string" ? it : it.itemName || "")
                .toLowerCase()
                .includes(q),
            );
          if (!matches) return;
        }
        sections.push({ sectionName, items });
      });

      if (sections.length > 0) {
        result.push({ category, sections });
      }
    });

    return result;
  }, [dashboardRoles, selectedCategory, dashboardSearch]);

  const handlecliclosepup = () => {
    setPopupopenattande(false);
  };

  const handleassignAtendent = async () => {
    if (!note1s) {
      return Swal.fire({
        icon: "warning",
        title: "Validation Error",
        text: "Role is required",
      });
    }
    try {
      const payload = { role: note1s };
      const response = await axios.post(`${baseurl}createRole`, payload);
      if (response?.data?.success) {
        dispatch(GetAllNewPermission({ limit: 500 }));
        loadDashboardData();
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Role created successfully!",
          timer: 2000,
          showConfirmButton: false,
        });
        setNote1s("");
        setPopupopenattande(false);
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed",
          text: response?.data?.message || "Something went wrong",
        });
      }
    } catch (error) {
      console.log(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error?.response?.data?.message ||
          "Server error, please try again later",
      });
    }
  };

  if (loading && activeTab === "endpoints") return <p>Loading...</p>;
  if (error && activeTab === "endpoints") return <p>Error: {error}</p>;

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          {/* Top Bar Header */}
          <div className="col-md-12">
            <div className="country-top">
              <div className="topmainhd mb-0 d-flex align-items-center flex-wrap gap-2">
                <h6 className="mb-0">
                  {activeTab === "dashboard"
                    ? "Manage Dashboard Permissions"
                    : "Manage Permissions"}
                </h6>

                {/* Tab Switcher Pills */}
                <div className="perm-tab-group">
                  <button
                    type="button"
                    className={`perm-tab-btn ${
                      activeTab === "endpoints" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("endpoints")}
                  >
                    <i className="fa fa-list"></i> Menu Permissions
                  </button>
                  <button
                    type="button"
                    className={`perm-tab-btn ${
                      activeTab === "dashboard" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("dashboard")}
                  >
                    <i className="fa fa-dashboard"></i> Dashboard Permissions
                  </button>
                </div>
              </div>

              {/* Action Buttons (Marked in Screenshot) */}
              <div className="perm-top-actions">
                {activeTab === "endpoints" ? (
                  <>
                    {/* New button placed in the exact spot marked in screenshot */}
                    <button
                      type="button"
                      className="add-button"
                      onClick={() => setActiveTab("dashboard")}
                      title="Configure CRM Dashboard Permissions"
                    >
                      <i className="fa fa-dashboard me-1"></i> Dashboard
                      Permissions
                    </button>
                    <button
                      type="button"
                      className="add-button"
                      onClick={handleSubmit}
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="add-button"
                      onClick={() => setActiveTab("endpoints")}
                      title="Back to Menu Permissions"
                    >
                      <i className="fa fa-arrow-left me-1"></i> Menu Permissions
                    </button>
                    <button
                      type="button"
                      className="add-button"
                      onClick={handleSaveDashboardPermissions}
                      disabled={dashboardSaving}
                    >
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tab 1: Menu / Endpoints Permissions Table */}
          {activeTab === "endpoints" && (
            <div className="col-md-12">
              <div className="main_content">
                <div className="perm-filter-bar mb-3">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <div className="perm-search-box">
                      <i className="fa fa-search"></i>
                      <input
                        type="text"
                        placeholder="Search roles (e.g. Coordinator, Doctor, Supervisor)..."
                        value={roleSearch}
                        onChange={(e) => setRoleSearch(e.target.value)}
                      />
                    </div>
                    {roleSearch && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setRoleSearch("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="text-muted small d-flex align-items-center gap-2">
                    <span
                      className="badge bg-primary px-2 py-1"
                      style={{ fontSize: "12px", borderRadius: "12px" }}
                    >
                      {permissionsData.length} Roles Loaded
                    </span>
                    {roleSearch && (
                      <span>
                        (Showing <strong>{filteredPermissionsData.length}</strong> matching "{roleSearch}")
                      </span>
                    )}
                  </div>
                </div>

                <div className="permission-table-wrapper">
                  <div className="table-responsive permission-scroll">
                    <table className="table table-border table-no-card permission-table">
                      <thead>
                        <tr>
                          <th className="sticky-column endpoint-column">
                            ENDPOINTS
                          </th>
                          {Array.isArray(filteredPermissionsData) &&
                            filteredPermissionsData.map((role) => (
                              <th
                                key={role.Id || role._id || role.role}
                                className="text-uppercase role-column"
                              >
                                {role.role}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {permissionsData?.length > 0 &&
                          getPermissionTableEndpoints(permissionsData).map(
                            (endpoint) => (
                              <tr key={endpoint}>
                                <td className="sticky-column endpoint-name">
                                  {formatPermissionEndpointLabel(endpoint)}
                                </td>

                                {filteredPermissionsData?.map((role) => (
                                  <td key={role.Id || role._id || role.role}>
                                    <input
                                      className="form-check-input checkbox-align"
                                      type="checkbox"
                                      checked={role.permissions[endpoint] === 1}
                                      onChange={(e) =>
                                        handleCheckboxChange(
                                          role.Id,
                                          endpoint,
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  </td>
                                ))}
                              </tr>
                            ),
                          )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: CRM Dashboard Permissions Setup Matrix (Section-Level Grid) */}
          {activeTab === "dashboard" && (
            <div className="col-md-12">
              <div className="main_content">
                {/* Search & Category Filter Bar */}
                <div className="perm-filter-bar">
                  <div className="perm-search-box">
                    <i className="fa fa-search"></i>
                    <input
                      type="text"
                      placeholder="Search section or item..."
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                    />
                  </div>

                  <div className="category-pills">
                    <button
                      type="button"
                      className={`category-pill ${
                        selectedCategory === "ALL" ? "active" : ""
                      }`}
                      onClick={() => setSelectedCategory("ALL")}
                    >
                      All Categories
                    </button>
                    {availableCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`category-pill ${
                          selectedCategory === cat ? "active" : ""
                        }`}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {dashboardLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">
                      Loading Dashboard Permissions...
                    </p>
                  </div>
                ) : (
                  <div className="permission-table-wrapper">
                    <div className="table-responsive permission-scroll">
                      <table className="table table-border table-no-card permission-table">
                        <thead>
                          <tr>
                            <th className="sticky-column endpoint-column">
                              DASHBOARD SECTIONS
                            </th>
                            {dashboardRoles.map((roleObj) => (
                              <th
                                key={roleObj.role}
                                className="text-uppercase role-column text-center"
                              >
                                <div>{roleObj.role}</div>
                                <div className="d-flex gap-1 justify-content-center">
                                  <button
                                    type="button"
                                    className="col-select-all-btn"
                                    onClick={() =>
                                      handleSelectAllForRole(roleObj.role, true)
                                    }
                                    title="Select all sections for this role"
                                  >
                                    All
                                  </button>
                                  <button
                                    type="button"
                                    className="col-select-all-btn"
                                    onClick={() =>
                                      handleSelectAllForRole(
                                        roleObj.role,
                                        false,
                                      )
                                    }
                                    title="Deselect all sections for this role"
                                  >
                                    None
                                  </button>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {unifiedStructure.length === 0 ? (
                            <tr>
                              <td
                                colSpan={dashboardRoles.length + 1}
                                className="text-center py-4 text-muted"
                              >
                                No dashboard sections found matching the filter.
                              </td>
                            </tr>
                          ) : (
                            unifiedStructure.map(({ category, sections }) => {
                              const isCatCollapsed =
                                !!collapsedCategories[category];

                              return (
                                <React.Fragment key={`cat-grp-${category}`}>
                                  {/* Category Header Banner */}
                                  <tr className="category-header-row">
                                    <td
                                      colSpan={dashboardRoles.length + 1}
                                      className="category-header-cell sticky-column"
                                      style={{ cursor: "pointer" }}
                                      onClick={() =>
                                        toggleCategoryCollapse(category)
                                      }
                                    >
                                      <i
                                        className={`fa fa-chevron-${
                                          isCatCollapsed ? "right" : "down"
                                        } me-2 text-primary`}
                                      ></i>
                                      <strong>CATEGORY: {category}</strong>
                                      <span className="badge-counter">
                                        {sections.length} sections
                                      </span>
                                    </td>
                                  </tr>

                                  {/* Section Rows (1 checkbox per cell) */}
                                  {!isCatCollapsed &&
                                    sections.map(({ sectionName, items }) => {
                                      const subKey = `${category}-${sectionName}`;
                                      const isExpanded =
                                        !!expandedSubItems[subKey];

                                      return (
                                        <React.Fragment
                                          key={`sec-row-${category}-${sectionName}`}
                                        >
                                          <tr>
                                            {/* Section Name Cell */}
                                            <td className="sticky-column endpoint-name">
                                              <div className="d-flex align-items-center justify-content-between">
                                                <span className="fw-semibold text-dark">
                                                  {sectionName}
                                                </span>
                                                {items?.length > 0 && (
                                                  <button
                                                    type="button"
                                                    className="badge bg-light text-secondary border-0 ms-2"
                                                    style={{
                                                      cursor: "pointer",
                                                      fontSize: "10.5px",
                                                    }}
                                                    onClick={() =>
                                                      toggleSubItems(subKey)
                                                    }
                                                    title="View sub-items in this section"
                                                  >
                                                    {items.length} sub-items{" "}
                                                    <i
                                                      className={`fa fa-caret-${
                                                        isExpanded
                                                          ? "up"
                                                          : "down"
                                                      } ms-1`}
                                                    ></i>
                                                  </button>
                                                )}
                                              </div>
                                            </td>

                                            {/* Checkbox for each role (1 per cell) */}
                                            {dashboardRoles.map((roleObj) => {
                                              const catObj = (
                                                roleObj.permissions || []
                                              ).find(
                                                (c) => c.category === category,
                                              );
                                              const secObj = (
                                                catObj?.sections || []
                                              ).find(
                                                (s) =>
                                                  s.sectionName === sectionName,
                                              );
                                              const isChecked =
                                                secObj?.allow === 1 ||
                                                secObj?.allow === true;

                                              return (
                                                <td
                                                  key={`cell-${roleObj.role}-${category}-${sectionName}`}
                                                  className="text-center"
                                                >
                                                  <input
                                                    className="form-check-input checkbox-align"
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) =>
                                                      handleSectionCheckboxChange(
                                                        roleObj.role,
                                                        category,
                                                        sectionName,
                                                        e.target.checked,
                                                      )
                                                    }
                                                  />
                                                </td>
                                              );
                                            })}
                                          </tr>

                                          {/* Sub-items preview tags when expanded */}
                                          {isExpanded && items?.length > 0 && (
                                            <tr className="sub-items-preview-row">
                                              <td
                                                colSpan={
                                                  dashboardRoles.length + 1
                                                }
                                                className="py-2 px-4 bg-light border-bottom"
                                              >
                                                <div className="text-muted small mb-1">
                                                  <i className="fa fa-info-circle me-1 text-primary"></i>
                                                  <strong>
                                                    Sub-items covered by{" "}
                                                    {sectionName}:
                                                  </strong>
                                                </div>
                                                <div className="d-flex flex-wrap gap-2">
                                                  {items.map((it, idx) => (
                                                    <span
                                                      key={idx}
                                                      className="badge bg-white text-dark border px-2 py-1"
                                                    >
                                                      {typeof it === "string"
                                                        ? it
                                                        : it.itemName}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Role Dialog Modal */}
      <React.Fragment>
        <Dialog
          fullWidth={fullWidth}
          maxWidth={maxWidth}
          open={popupopenattande}
          onClose={handlecliclosepup}
        >
          <div className="main-card-header">
            <div className="note-hd">
              <h6>Add Role</h6>
            </div>

            <div className="cross-icon" onClick={handlecliclosepup}>
              <i className="fa-solid fa-xmark"></i>
            </div>
          </div>

          <DialogContent className="main-box">
            <Box
              noValidate
              component="form"
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
              }}
              className="contact-form"
            >
              <Box>
                <form id="contact-form" className="contact-form">
                  <div className="field-set">
                    <label>
                      Notes
                      <span className="text-danger">*</span>
                    </label>

                    <div className="upload-input">
                      <input
                        type="text"
                        value={note1s}
                        onChange={(e) => setNote1s(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogActions className="submit-main">
                    <Button onClick={handleassignAtendent} variant="contained">
                      Submit
                    </Button>
                  </DialogActions>
                </form>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </React.Fragment>
    </div>
  );
}
