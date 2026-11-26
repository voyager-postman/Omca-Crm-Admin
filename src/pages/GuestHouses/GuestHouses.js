import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import Swal from "sweetalert2";
import {
  fetchGuestHouses,
  fetchGuestHouseById,
  updateGuestHouseRooms,
} from "../../services/guestHouseApi";
import { markRecordRead } from "../../services/unreadApi";
import { UnreadDot } from "../../components/NewTag";
import "./GuestHouses.css";

const isRoomActive = (r) => {
  if (!r) return false;
  if (r.is_active !== undefined && r.is_active !== null) {
    return (
      r.is_active === 1 ||
      r.is_active === "1" ||
      r.is_active === true ||
      String(r.is_active).toLowerCase() === "active"
    );
  }
  if (r.status !== undefined && r.status !== null) {
    const s = String(r.status).trim().toLowerCase();
    if (
      s === "inactive" ||
      s === "0" ||
      s === "deactive" ||
      s === "disabled" ||
      s === "closed"
    ) {
      return false;
    }
  }
  if (r.active !== undefined && r.active !== null) {
    return (
      r.active === 1 ||
      r.active === "1" ||
      r.active === true ||
      String(r.active).toLowerCase() === "active"
    );
  }
  return true;
};

const isGuestHouseActive = (gh) => {
  if (!gh) return false;
  if (gh.is_active !== undefined && gh.is_active !== null) {
    return (
      gh.is_active === 1 ||
      gh.is_active === "1" ||
      gh.is_active === true ||
      String(gh.is_active).toLowerCase() === "active"
    );
  }
  if (gh.status !== undefined && gh.status !== null) {
    const s = String(gh.status).trim().toLowerCase();
    if (
      s === "inactive" ||
      s === "0" ||
      s === "deactive" ||
      s === "disabled" ||
      s === "closed"
    ) {
      return false;
    }
  }
  if (gh.active !== undefined && gh.active !== null) {
    return (
      gh.active === 1 ||
      gh.active === "1" ||
      gh.active === true ||
      String(gh.active).toLowerCase() === "active"
    );
  }
  return true;
};

export default function GuestHouses() {
  const navigate = useNavigate();
  const userRole = (localStorage.getItem("Role") || "").toLowerCase();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw.split(",").map((p) => p.trim());
  const canAccessGuestHouses =
    userRole === "admin" ||
    permissionsList.includes("/Guest_Houses") ||
    permissionsList.includes("Guest_Houses") ||
    permissionsList.includes("/Manage_Guest_Houses") ||
    permissionsList.includes("Manage_Guest_Houses");

  useEffect(() => {
    if (!canAccessGuestHouses) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [canAccessGuestHouses, navigate]);

  const [guestHouses, setGuestHouses] = useState([]);
  const [detailsMap, setDetailsMap] = useState({}); // { [id]: { rooms: [...], loading: false } }
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Inline editing state: { [guestHouseId]: [ { id, title, price, availability } ] }
  const [inlineEditing, setInlineEditing] = useState({});
  const [savingId, setSavingId] = useState(null);

  // Modal editing state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeGuestHouse, setActiveGuestHouse] = useState(null);
  const [modalRooms, setModalRooms] = useState([]);
  const [modalSaving, setModalSaving] = useState(false);

  // Load all guest houses and then their room details by ID
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchGuestHouses();
      const list = res?.data || [];
      setGuestHouses(list);

      // Default expand all guest houses ("default show")
      const allIds = new Set(list.map((gh) => gh.id));
      setExpandedIds(allIds);

      // Initialize loading state for all
      const initialMap = {};
      list.forEach((gh) => {
        initialMap[gh.id] = { ...gh, rooms: [], loading: true };
      });
      setDetailsMap(initialMap);

      // Fetch room details for each guest house concurrently
      const detailPromises = list.map(async (gh) => {
        try {
          const detailRes = await fetchGuestHouseById(gh.id);
          const ghData = detailRes?.data || {};
          return {
            id: gh.id,
            data: {
              ...gh,
              ...ghData,
              rooms: Array.isArray(ghData.rooms) ? ghData.rooms : [],
              loading: false,
            },
          };
        } catch (err) {
          console.error(`Error loading rooms for guest house ${gh.id}:`, err);
          return {
            id: gh.id,
            data: { ...gh, rooms: [], loading: false, error: true },
          };
        }
      });

      const results = await Promise.all(detailPromises);
      const updatedMap = {};
      results.forEach((item) => {
        updatedMap[item.id] = item.data;
      });
      setDetailsMap(updatedMap);
    } catch (err) {
      console.error("Error fetching guest houses:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to load Guest Houses",
        text: err?.message || "Please check your network connection.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle single guest house expand/collapse
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Expand all / Collapse all
  const areAllExpanded =
    guestHouses.length > 0 && expandedIds.size === guestHouses.length;
  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(guestHouses.map((gh) => gh.id)));
    }
  };

  // Stats calculation - only count active guest houses and active rooms for Total Available Units
  const stats = useMemo(() => {
    let totalRooms = 0;
    let totalAvailable = 0;
    let totalActiveHouses = 0;

    guestHouses.forEach((gh) => {
      if (isGuestHouseActive(gh)) {
        totalActiveHouses += 1;
      }
    });

    Object.values(detailsMap).forEach((gh) => {
      if (!isGuestHouseActive(gh)) return;
      (gh.rooms || []).forEach((r) => {
        if (isRoomActive(r)) {
          totalRooms += 1;
          const avail = parseInt(r.availability, 10) || 0;
          if (avail > 0) {
            totalAvailable += avail;
          }
        }
      });
    });

    return {
      houses: totalActiveHouses || guestHouses.length,
      rooms: totalRooms,
      available: totalAvailable,
    };
  }, [guestHouses, detailsMap]);

  // Filtered guest houses
  const filteredHouses = useMemo(() => {
    if (!searchFilter.trim()) return guestHouses;
    const q = searchFilter.toLowerCase();
    return guestHouses.filter((gh) => {
      const nameMatch = gh.name?.toLowerCase().includes(q);
      const addrMatch = gh.address?.toLowerCase().includes(q);
      const details = detailsMap[gh.id];
      const roomMatch = details?.rooms?.some(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          String(r.price).includes(q) ||
          String(r.id).includes(q)
      );
      return nameMatch || addrMatch || roomMatch;
    });
  }, [guestHouses, detailsMap, searchFilter]);

  // Open Edit Modal for a Guest House
  const handleOpenEditModal = (gh) => {
    if (gh?.id) markRecordRead("guestHouses", gh.id);
    const details = detailsMap[gh.id];
    const rooms = (details?.rooms || []).map((r) => ({
      id: r.id,
      title: r.title || "",
      price: r.price !== undefined ? String(r.price).replace(/\.00$/, "") : "",
      availability: r.availability !== undefined ? String(r.availability) : "0",
    }));

    setActiveGuestHouse(gh);
    setModalRooms(rooms);
    setModalOpen(true);
  };

  const handleModalRoomChange = (index, field, value) => {
    setModalRooms((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Save via Modal
  const handleSaveModal = async () => {
    if (!activeGuestHouse) return;

    // Basic validation
    for (let i = 0; i < modalRooms.length; i++) {
      const r = modalRooms[i];
      if (!r.title.trim()) {
        Swal.fire(
          "Validation Error",
          `Room #${i + 1} title cannot be empty`,
          "warning"
        );
        return;
      }
      if (isNaN(Number(r.price)) || Number(r.price) < 0) {
        Swal.fire(
          "Validation Error",
          `Please enter a valid price for "${r.title}"`,
          "warning"
        );
        return;
      }
      if (
        isNaN(Number(r.availability)) ||
        parseInt(r.availability, 10) < 0
      ) {
        Swal.fire(
          "Validation Error",
          `Please enter a valid availability for "${r.title}"`,
          "warning"
        );
        return;
      }
    }

    setModalSaving(true);
    try {
      const res = await updateGuestHouseRooms(activeGuestHouse.id, modalRooms);
      if (res?.success === "true" || res?.message) {
        Swal.fire({
          icon: "success",
          title: "Updated Successfully!",
          text: res?.message || "Guest House rooms updated successfully",
          timer: 2000,
          showConfirmButton: false,
        });

        // Update local details map
        setDetailsMap((prev) => ({
          ...prev,
          [activeGuestHouse.id]: {
            ...prev[activeGuestHouse.id],
            rooms: modalRooms.map((r) => ({
              ...r,
              price: Number(r.price).toFixed(2),
              availability: String(r.availability),
            })),
          },
        }));

        setModalOpen(false);
      } else {
        throw new Error(res?.message || "Failed to update rooms");
      }
    } catch (err) {
      console.error("Error saving rooms:", err);
      Swal.fire("Error", err?.message || "Could not update rooms", "error");
    } finally {
      setModalSaving(false);
    }
  };

  // Start Inline Edit
  const startInlineEdit = (ghId) => {
    const details = detailsMap[ghId];
    const rooms = (details?.rooms || []).map((r) => ({
      id: r.id,
      title: r.title || "",
      price: r.price !== undefined ? String(r.price).replace(/\.00$/, "") : "",
      availability: r.availability !== undefined ? String(r.availability) : "0",
    }));
    setInlineEditing((prev) => ({ ...prev, [ghId]: rooms }));
    // Ensure node is expanded when editing
    setExpandedIds((prev) => new Set([...prev, ghId]));
  };

  // Cancel Inline Edit
  const cancelInlineEdit = (ghId) => {
    setInlineEditing((prev) => {
      const next = { ...prev };
      delete next[ghId];
      return next;
    });
  };

  const handleInlineChange = (ghId, roomIndex, field, value) => {
    setInlineEditing((prev) => {
      const current = prev[ghId] ? [...prev[ghId]] : [];
      current[roomIndex] = { ...current[roomIndex], [field]: value };
      return { ...prev, [ghId]: current };
    });
  };

  // Save Inline Edit
  const saveInlineEdit = async (ghId) => {
    const rooms = inlineEditing[ghId];
    if (!rooms) return;

    // Validation
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (!r.title.trim()) {
        Swal.fire(
          "Validation Error",
          `Room #${i + 1} title cannot be empty`,
          "warning"
        );
        return;
      }
      if (isNaN(Number(r.price)) || Number(r.price) < 0) {
        Swal.fire("Validation Error", `Invalid price for "${r.title}"`, "warning");
        return;
      }
      if (
        isNaN(Number(r.availability)) ||
        parseInt(r.availability, 10) < 0
      ) {
        Swal.fire(
          "Validation Error",
          `Invalid availability for "${r.title}"`,
          "warning"
        );
        return;
      }
    }

    setSavingId(ghId);
    try {
      const res = await updateGuestHouseRooms(ghId, rooms);
      if (res?.success === "true" || res?.message) {
        Swal.fire({
          icon: "success",
          title: "Saved!",
          text: res?.message || "Rooms updated successfully",
          timer: 1800,
          showConfirmButton: false,
        });

        // Update local state
        setDetailsMap((prev) => ({
          ...prev,
          [ghId]: {
            ...prev[ghId],
            rooms: rooms.map((r) => ({
              ...r,
              price: Number(r.price).toFixed(2),
              availability: String(r.availability),
            })),
          },
        }));

        cancelInlineEdit(ghId);
      } else {
        throw new Error(res?.message || "Failed to save rooms");
      }
    } catch (err) {
      console.error("Error saving inline rooms:", err);
      Swal.fire("Error", err?.message || "Could not update rooms", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="page-wrapper guesthouses-page">
      <div className="content">
        {/* TOP HEADER */}
        <div className="row mb-3">
          <div className="col-md-12">
            <div className="country-top">
              <div>
                <h4 className="page-title mb-0">Guest Houses</h4>
                <p className="text-muted small mb-0">
                  Manage guest house properties and room rates / availability in
                  a hierarchical tree view.
                </p>
              </div>

              <div className="search-btn-main">
                <div style={{ minWidth: 260 }}>
                  <TextField
                    sx={{ width: "100%" }}
                    placeholder="Search by name, address or room..."
                    size="small"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <i className="fa fa-search text-muted" />
                        </InputAdornment>
                      ),
                      endAdornment: searchFilter ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setSearchFilter("")}
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                </div>

                <div className="gh-header-actions">
                  <button
                    type="button"
                    className="btn-gh-action btn-gh-outline"
                    onClick={toggleExpandAll}
                    title={areAllExpanded ? "Collapse All" : "Expand All"}
                  >
                    <i
                      className={`fa ${
                        areAllExpanded ? "fa-compress" : "fa-expand"
                      }`}
                    />
                    <span>{areAllExpanded ? "Collapse All" : "Expand All"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn-gh-action btn-gh-outline"
                    onClick={loadData}
                    title="Reload data"
                  >
                    <i className="fa fa-refresh" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS BAR */}
        <div className="gh-stats-bar">
          <div className="gh-stat-card">
            <div className="gh-stat-icon houses">
              <i className="fa fa-building-o" />
            </div>
            <div className="gh-stat-info">
              <h5>{stats.houses}</h5>
              <span>Guest Houses</span>
            </div>
          </div>

          <div className="gh-stat-card">
            <div className="gh-stat-icon rooms">
              <i className="fa fa-bed" />
            </div>
            <div className="gh-stat-info">
              <h5>{stats.rooms}</h5>
              <span>Configured Rooms</span>
            </div>
          </div>

          <div className="gh-stat-card">
            <div className="gh-stat-icon available">
              <i className="fa fa-check-circle-o" />
            </div>
            <div className="gh-stat-info">
              <h5>{stats.available}</h5>
              <span>Total Available Units</span>
            </div>
          </div>
        </div>

        {/* LOADING INDICATOR */}
        {loading ? (
          <div className="text-center py-5">
            <CircularProgress size={40} />
            <p className="mt-3 text-muted">Loading guest houses and rooms tree...</p>
          </div>
        ) : filteredHouses.length === 0 ? (
          <div className="card text-center py-5">
            <i className="fa fa-home text-muted" style={{ fontSize: 48 }} />
            <h5 className="mt-3 text-secondary">No Guest Houses Found</h5>
            <p className="text-muted small">
              {searchFilter
                ? `No properties match "${searchFilter}"`
                : "No guest house records available."}
            </p>
          </div>
        ) : (
          /* TREE LIST VIEW */
          <div className="gh-tree-container">
            {filteredHouses.map((gh) => {
              const isExpanded = expandedIds.has(gh.id);
              const details = detailsMap[gh.id];
              const rooms = details?.rooms || [];
              const isInline = Boolean(inlineEditing[gh.id]);
              const inlineRooms = inlineEditing[gh.id] || [];
              const isSaving = savingId === gh.id;

              return (
                <div
                  key={gh.id}
                  className={`gh-tree-node ${isExpanded ? "is-expanded" : ""}`}
                >
                  {/* TREE PARENT (Guest House Header) */}
                  <div
                    className="gh-tree-parent"
                    onClick={() => toggleExpand(gh.id)}
                  >
                    <div className="gh-parent-left">
                      {/* Expand Chevron */}
                      <div
                        className={`gh-expand-toggle ${
                          isExpanded ? "rotated" : ""
                        }`}
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        <i className="fa fa-chevron-right" />
                      </div>

                      {/* Property Image */}
                      <div className="gh-thumb-wrapper">
                        {gh.image ? (
                          <img
                            src={gh.image}
                            alt={gh.name}
                            onError={(e) => {
                              e.target.style.display = "none";
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="gh-thumb-placeholder"
                          style={{
                            display: gh.image ? "none" : "flex",
                          }}
                        >
                          <i className="fa fa-building" />
                        </div>
                      </div>

                      {/* Property Meta */}
                      <div className="gh-meta">
                        <div className="gh-title-row">
                          <h5 className="gh-name">
                            {gh.name}
                            <UnreadDot unread={gh.isUnread === true} />
                          </h5>
                          <span
                            className={`gh-badge-rooms ${
                              rooms.length > 0 ? "has-rooms" : "no-rooms"
                            }`}
                          >
                            <i className="fa fa-bed me-1" />
                            {details?.loading
                              ? "Loading..."
                              : `${rooms.length} ${
                                  rooms.length === 1 ? "Room" : "Rooms"
                                }`}
                          </span>
                        </div>
                        <div className="gh-address" title={gh.address}>
                          <i className="fa fa-map-marker text-danger" />
                          <span>{gh.address || "Address not specified"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      className="gh-parent-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn-gh-action btn-gh-primary"
                        disabled={rooms.length === 0}
                        onClick={() => handleOpenEditModal(gh)}
                        title={
                          rooms.length === 0
                            ? "No rooms configured to edit"
                            : "Open rooms editor"
                        }
                      >
                        <i className="fa fa-edit" /> Edit Rooms
                      </button>
                    </div>
                  </div>

                  {/* TREE CHILDREN (Rooms Branch) */}
                  {isExpanded && (
                    <div className="gh-tree-children">
                      {details?.loading ? (
                        <div className="p-3 text-center text-muted">
                          <CircularProgress size={24} />
                          <span className="ms-2">Loading rooms...</span>
                        </div>
                      ) : rooms.length === 0 ? (
                        <div className="gh-empty-rooms">
                          <i
                            className="fa fa-info-circle me-1 text-primary"
                            style={{ fontSize: 16 }}
                          />
                          No rooms configured for this guest house.
                        </div>
                      ) : (
                        <div className="gh-rooms-table-card">
                          <div className="table-responsive">
                            <table className="table gh-rooms-table table-hover">
                              <thead>
                                <tr>
                                  <th style={{ width: 80 }}>S.No.</th>
                                  <th>Room Title</th>
                                  <th style={{ width: 170 }}>Price (₹)</th>
                                  <th style={{ width: 170 }}>Availability</th>
                                  <th style={{ width: 130 }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rooms.map((r, rIdx) => {
                                  const active = isRoomActive(r);
                                  const availNum =
                                    parseInt(r.availability, 10) || 0;
                                  return (
                                    <tr key={r.id || rIdx}>
                                      <td>
                                        <span className="badge bg-light text-secondary border">
                                          #{rIdx + 1}
                                        </span>
                                      </td>
                                      <td>
                                        <div className="gh-room-title">
                                          <i className="fa fa-bed text-primary opacity-75" />
                                          <span>{r.title}</span>
                                          {!active && (
                                            <span
                                              className="badge bg-secondary-subtle text-secondary ms-2 border"
                                              style={{ fontSize: "10px" }}
                                            >
                                              Inactive
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td>
                                        <span className="gh-room-price">
                                          ₹{" "}
                                          {Number(r.price).toLocaleString(
                                            "en-IN",
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}
                                        </span>
                                      </td>
                                      <td>
                                        <span
                                          className={`gh-avail-badge ${
                                            active && availNum > 0
                                              ? "in-stock"
                                              : "out-of-stock"
                                          }`}
                                        >
                                          <i
                                            className={`fa ${
                                              active && availNum > 0
                                                ? "fa-check"
                                                : "fa-times"
                                            }`}
                                          />
                                          {availNum}{" "}
                                          {availNum === 1
                                            ? "Unit"
                                            : "Units"}
                                        </span>
                                      </td>
                                      <td>
                                        {!active ? (
                                          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                                            Inactive
                                          </span>
                                        ) : availNum > 0 ? (
                                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                                            Available
                                          </span>
                                        ) : (
                                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                            Sold Out
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* EDIT ROOMS MODAL */}
        <Dialog
          open={modalOpen}
          onClose={() => !modalSaving && setModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="fa fa-edit text-primary" />
                <span>Edit Rooms — {activeGuestHouse?.name}</span>
              </div>
              <IconButton
                size="small"
                disabled={modalSaving}
                onClick={() => setModalOpen(false)}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </div>
            <div className="text-muted small fw-normal mt-1">
              Update room title, price, and available units.
            </div>
          </DialogTitle>

          <DialogContent dividers>
            {modalRooms.length === 0 ? (
              <div className="text-center py-4 text-muted">
                No rooms available to edit for this guest house.
              </div>
            ) : (
              modalRooms.map((room, idx) => (
                <div key={room.id || idx} className="gh-modal-room-card">
                  <div className="gh-modal-room-header">
                    <span className="fw-semibold text-primary">
                      Room {idx + 1}
                    </span>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Room Title <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={room.title}
                        placeholder="e.g. Deluxe Room"
                        onChange={(e) =>
                          handleModalRoomChange(idx, "title", e.target.value)
                        }
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">
                        Price (₹) <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={room.price}
                          min="0"
                          step="any"
                          placeholder="333"
                          onChange={(e) =>
                            handleModalRoomChange(idx, "price", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">
                        Availability <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={room.availability}
                        min="0"
                        placeholder="10"
                        onChange={(e) =>
                          handleModalRoomChange(
                            idx,
                            "availability",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </DialogContent>

          <DialogActions className="p-3">
            <Button
              variant="outlined"
              color="inherit"
              disabled={modalSaving}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={modalSaving || modalRooms.length === 0}
              onClick={handleSaveModal}
              startIcon={
                modalSaving ? <CircularProgress size={16} color="inherit" /> : null
              }
            >
              {modalSaving ? "Updating Rooms..." : "Save Changes"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
}
