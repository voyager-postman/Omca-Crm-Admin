import React, { useState, useEffect, useCallback } from "react";
import { employeeActivityService } from "../../services/employeeActivityService";

export default function EmployeeActivityDashboard() {
  // Filters State
  const [dropdown, setDropdown] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [search, setSearch] = useState("");

  // Data State
  const [metrics, setMetrics] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ presets: [], roles: [], staff: [] });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Drilldown Modal
  const [drilldownStaff, setDrilldownStaff] = useState(null);
  const [staffLogs, setStaffLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Load Filter Options
  useEffect(() => {
    employeeActivityService
      .getFilterOptions()
      .then((res) => {
        if (res?.success && res.data) {
          setFilterOptions(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load employee activity filter options:", err);
      });
  }, []);

  // Fetch Metrics & Table
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        dropdown: startDate || endDate ? undefined : dropdown,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        role: selectedRole !== "all" ? selectedRole : undefined,
        staffId: selectedStaff !== "all" ? selectedStaff : undefined,
        search: search || undefined,
        page,
        limit: 15,
      };

      const res = await employeeActivityService.getActivityMetrics(params);
      if (res?.success) {
        setMetrics(res);
      }
    } catch (err) {
      console.error("Failed to load activity metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [dropdown, startDate, endDate, selectedRole, selectedStaff, search, page]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Open Staff Logs Drilldown
  const handleOpenDrilldown = async (staff) => {
    setDrilldownStaff(staff);
    setLogsLoading(true);
    try {
      const res = await employeeActivityService.getEmployeeLogs(staff.userId, {
        dropdown: startDate || endDate ? undefined : dropdown,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (res?.success) {
        setStaffLogs(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      alert("Failed to load staff logs");
    } finally {
      setLogsLoading(false);
    }
  };

  const summary = metrics?.summary || {};
  const chartData = metrics?.chartData || {};
  const tableData = metrics?.tableData || [];
  const pagination = metrics?.pagination || {};

  return (
    <div className="page-wrapper">
      <div className="content" style={{ padding: "24px", background: "#f8fafc", minHeight: "100vh" }}>
        <h2>Employee Activity Dashboard</h2>
        <p style={{ color: "#64748b", fontSize: "14px", marginTop: "-6px" }}>
          Total activities performed across all staff (Excludes login &amp; logout)
        </p>

        {/* 1. FILTER BAR */}
        <div
          style={{
            background: "#fff",
            padding: "16px",
            borderRadius: "8px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          {/* Preset Dropdown */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "bold", display: "block" }}>Preset:</label>
            <select
              value={dropdown}
              onChange={(e) => {
                setDropdown(e.target.value);
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          {/* Date Wise (From & To) */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "bold", display: "block" }}>From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              style={{ padding: "7px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "bold", display: "block" }}>To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              style={{ padding: "7px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>

          {/* Role Wise */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "bold", display: "block" }}>Role:</label>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            >
              <option value="all">All Roles</option>
              {(filterOptions.roles || []).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Staff Wise */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "bold", display: "block" }}>Staff:</label>
            <select
              value={selectedStaff}
              onChange={(e) => {
                setSelectedStaff(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            >
              <option value="all">All Staff</option>
              {(filterOptions.staff || []).map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div style={{ flex: 1, minWidth: "180px" }}>
            <label style={{ fontSize: "12px", fontWeight: "bold", display: "block" }}>Search:</label>
            <input
              type="text"
              placeholder="Search staff, email, role..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ width: "100%", padding: "7px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>
        </div>

        {/* 2. SUMMARY KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", borderLeft: "4px solid #3b82f6" }}>
            <div style={{ color: "#64748b", fontSize: "13px" }}>Total Activities</div>
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1e293b" }}>
              {summary.totalActivities || 0}
            </div>
          </div>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", borderLeft: "4px solid #10b981" }}>
            <div style={{ color: "#64748b", fontSize: "13px" }}>Active Staff</div>
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1e293b" }}>
              {summary.activeStaffCount || 0} / {summary.totalStaffCount || 0}
            </div>
          </div>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", borderLeft: "4px solid #f59e0b" }}>
            <div style={{ color: "#64748b", fontSize: "13px" }}>Avg Activities / Staff</div>
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1e293b" }}>
              {summary.averageActivitiesPerActiveStaff || 0}
            </div>
          </div>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", borderLeft: "4px solid #8b5cf6" }}>
            <div style={{ color: "#64748b", fontSize: "13px" }}>Top Performer</div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1e293b" }}>
              {summary.topPerformer?.name || "N/A"}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              {summary.topPerformer ? `${summary.topPerformer.count} actions` : ""}
            </div>
          </div>
        </div>

        {/* 3. CHARTS GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Timeline Chart */}
          <div style={{ background: "#fff", padding: "18px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h4 style={{ margin: "0 0 12px 0" }}>Activity Trend Over Time</h4>
            <div
              style={{
                height: "200px",
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                paddingBottom: "20px",
                overflowX: "auto",
              }}
            >
              {(chartData.timeline || []).map((t) => {
                const maxCount = Math.max(...(chartData.timeline || []).map((x) => x.count), 1);
                const heightPct = Math.max((t.count / maxCount) * 100, 4);
                return (
                  <div key={t.key} style={{ flex: 1, minWidth: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#3b82f6" }}>
                      {t.count > 0 ? t.count : ""}
                    </div>
                    <div style={{ height: `${heightPct}%`, background: "#3b82f6", borderRadius: "4px 4px 0 0" }} />
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#64748b",
                        transform: "rotate(-45deg)",
                        marginTop: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Active Staff Leaderboard */}
          <div style={{ background: "#fff", padding: "18px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h4 style={{ margin: "0 0 12px 0" }}>Top Active Employees</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(chartData.byStaff || []).slice(0, 5).map((s) => (
                <div key={s.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span>
                      <b>{s.name}</b> <small style={{ color: "#64748b" }}>({s.role})</small>
                    </span>
                    <span>
                      <b>{s.count}</b> ({s.percentage}%)
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", marginTop: "4px" }}>
                    <div
                      style={{
                        width: `${s.percentage}%`,
                        height: "100%",
                        background: "#10b981",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. ALL EMPLOYEES ACTIVITY TABLE */}
        <div style={{ background: "#fff", padding: "18px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h4 style={{ margin: "0 0 12px 0" }}>All Employees Activity Breakdown</h4>
          {loading ? (
            <p>Loading employee data...</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: "10px" }}>Staff Name</th>
                  <th style={{ padding: "10px" }}>Role</th>
                  <th style={{ padding: "10px" }}>Total Activities</th>
                  <th style={{ padding: "10px" }}>Action Breakdown</th>
                  <th style={{ padding: "10px" }}>Last Active</th>
                  <th style={{ padding: "10px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan="6" align="center" style={{ padding: "20px" }}>
                      No employee records found.
                    </td>
                  </tr>
                ) : (
                  tableData.map((row) => (
                    <tr key={row.userId || row.name} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px" }}>
                        <b>{row.name}</b>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{row.email}</div>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            background: "#e0f2fe",
                            color: "#0369a1",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: "bold",
                            color: row.totalActivities > 0 ? "#0f172a" : "#94a3b8",
                          }}
                        >
                          {row.totalActivities}
                        </span>
                      </td>
                      <td style={{ padding: "10px" }}>
                        {Object.keys(row.actionBreakdown || {}).length > 0 ? (
                          Object.entries(row.actionBreakdown).map(([act, cnt]) => (
                            <span
                              key={act}
                              style={{
                                marginRight: "6px",
                                fontSize: "11px",
                                background: "#f3f4f6",
                                padding: "2px 6px",
                                borderRadius: "3px",
                              }}
                            >
                              {act}: <b>{cnt}</b>
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8" }}>No actions</span>
                        )}
                      </td>
                      <td style={{ padding: "10px", color: "#64748b" }}>
                        {row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : "Never"}
                      </td>
                      <td style={{ padding: "10px" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDrilldown(row)}
                          style={{
                            padding: "4px 8px",
                            background: "#3b82f6",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Showing page {pagination.currentPage || 1} of {pagination.totalPages || 1} (
              {pagination.totalRecords || 0} staff)
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: "6px 12px" }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "6px 12px" }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* 5. DRILLDOWN MODAL */}
        {drilldownStaff && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "24px",
                borderRadius: "8px",
                width: "700px",
                maxWidth: "95vw",
                maxHeight: "80vh",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3>Activity Timeline: {drilldownStaff.name}</h3>
                <button
                  type="button"
                  onClick={() => setDrilldownStaff(null)}
                  style={{ border: "none", background: "none", fontSize: "18px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {logsLoading ? (
                <p>Loading activity logs...</p>
              ) : staffLogs.length === 0 ? (
                <p>No activity logs found for this period.</p>
              ) : (
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: "8px" }}>Time</th>
                      <th style={{ padding: "8px" }}>Module</th>
                      <th style={{ padding: "8px" }}>Action</th>
                      <th style={{ padding: "8px" }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffLogs.map((log) => (
                      <tr key={log._id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "8px" }}>{new Date(log.performedAt).toLocaleString()}</td>
                        <td style={{ padding: "8px" }}>
                          <b>{log.module}</b>
                        </td>
                        <td style={{ padding: "8px" }}>{log.action}</td>
                        <td style={{ padding: "8px" }}>{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
