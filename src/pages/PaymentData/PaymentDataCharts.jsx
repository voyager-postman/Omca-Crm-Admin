import React, { useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";

const parseNumeric = (val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const clean = val.replace(/[^0-9.-]+/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const formatCurrency = (val) => {
  if (val == null || val === "") return "$0";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
  if (isNaN(num)) return String(val);
  return `$${Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatShortCurrency = (val) => {
  if (val == null || val === "") return "$0";
  const num = typeof val === "number" ? val : parseNumeric(val);
  if (isNaN(num)) return "$0";
  if (num === 0) return "$0";
  const abs = Math.abs(num);
  if (abs >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${Number(num).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

export default function PaymentDataCharts({
  rows = [],
  summary = { total_billing: 0, payments_received: 0, dues_pending: 0 },
  currentLevel = "country",
  loading = false,
  onCountryClick,
  onCityClick,
  selectedCountryName = "",
  selectedCityName = "",
}) {
  const [chartType, setChartType] = useState("bar"); // "bar" | "stacked" | "horizontal"
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "breakdown" | "distribution" | "volume"
  const [showDataLabels, setShowDataLabels] = useState(false);

  // Process rows to extract clean entities with numeric figures
  const chartData = useMemo(() => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return {
        categories: [],
        entities: [],
        totalBillingSeries: [],
        paymentsReceivedSeries: [],
        duesPendingSeries: [],
        hospitalsSeries: [],
        treatmentsSeries: [],
        hasVolumeData: false,
      };
    }

    const categories = [];
    const entities = [];
    const totalBillingSeries = [];
    const paymentsReceivedSeries = [];
    const duesPendingSeries = [];
    const hospitalsSeries = [];
    const treatmentsSeries = [];

    rows.forEach((row, idx) => {
      let name = "";
      if (currentLevel === "country") {
        name = row.country || row.country_name || (!row.patient_name && !row.hospital_name ? row.name : "") || `Country ${idx + 1}`;
      } else if (currentLevel === "city") {
        name = row.city || row.town || row.city_name || row.name || `City ${idx + 1}`;
      } else if (currentLevel === "hospital") {
        name = row.hospital_name || row.hospital || row.hosp_name || row.name || `Hospital ${idx + 1}`;
      } else if (currentLevel === "treatment") {
        name = row.treatment_name || row.treatment || row.treatmentId || row.course_name || row.name || `Treatment ${idx + 1}`;
      } else {
        name = row.patient_name || row.patient || row.name || `Record ${idx + 1}`;
      }

      // Truncate overly long names for chart labels
      const displayName = name.length > 20 ? `${name.substring(0, 18)}...` : name;
      categories.push(displayName);

      const billing = parseNumeric(row.total_billing ?? row.totalBilling ?? row.billing ?? row.amount);
      const received = parseNumeric(row.payments_received ?? row.paymentsReceived ?? row.amount_paid ?? row.paid);
      const dues = parseNumeric(row.dues_pending ?? row.duesPending ?? row.remaining_balance ?? row.dues);

      const hospitals = parseNumeric(row.hospitals ?? row.hospitals_count ?? row.totalHospitals ?? 0);
      const treatments = parseNumeric(row.treatments ?? row.treatments_count ?? row.totalTreatments ?? 0);

      totalBillingSeries.push(billing);
      paymentsReceivedSeries.push(received);
      duesPendingSeries.push(dues);
      hospitalsSeries.push(hospitals);
      treatmentsSeries.push(treatments);

      entities.push({
        rawName: name,
        displayName,
        country: row.country || row.country_name || selectedCountryName,
        billing,
        received,
        dues,
        hospitals,
        treatments,
      });
    });

    const hasVolumeData = hospitalsSeries.some((v) => v > 0) || treatmentsSeries.some((v) => v > 0);

    return {
      categories,
      entities,
      totalBillingSeries,
      paymentsReceivedSeries,
      duesPendingSeries,
      hospitalsSeries,
      treatmentsSeries,
      hasVolumeData,
    };
  }, [rows, currentLevel, selectedCountryName]);

  // Executive summary numbers
  const summaryTotals = useMemo(() => {
    const totalBilling = parseNumeric(summary?.total_billing ?? 0);
    const paymentsReceived = parseNumeric(summary?.payments_received ?? 0);
    const duesPending = parseNumeric(summary?.dues_pending ?? 0);

    const recoveryRate = totalBilling > 0 ? (paymentsReceived / totalBilling) * 100 : 0;
    const duesRatio = totalBilling > 0 ? (duesPending / totalBilling) * 100 : 0;

    // Identify top entity by billing
    let topEntity = null;
    if (chartData.entities.length > 0) {
      topEntity = [...chartData.entities].sort((a, b) => b.billing - a.billing)[0];
    }

    const avgBilling = chartData.entities.length > 0 ? totalBilling / chartData.entities.length : 0;

    return {
      totalBilling,
      paymentsReceived,
      duesPending,
      recoveryRate: recoveryRate.toFixed(1),
      duesRatio: duesRatio.toFixed(1),
      topEntity,
      avgBilling,
    };
  }, [summary, chartData.entities]);

  const isHorizontal = chartType === "horizontal";
  const isStacked = chartType === "stacked";

  const chartHeight = useMemo(() => {
    if (isHorizontal) {
      return Math.max(380, (chartData?.categories?.length || 0) * 65);
    }
    return 360;
  }, [isHorizontal, chartData?.categories?.length]);

  if (loading) {
    return (
      <div
        className="card border-0 mb-4 shadow-sm"
        style={{ borderRadius: "12px", backgroundColor: "#ffffff" }}
      >
        <div className="card-body p-5 text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: "2.5rem", height: "2.5rem" }} />
          <p className="text-muted fw-semibold mb-0" style={{ fontSize: "14px" }}>
            Preparing payment visual charts...
          </p>
        </div>
      </div>
    );
  }

  if (chartData.categories.length === 0) {
    return (
      <div
        className="card border-0 mb-4 shadow-sm"
        style={{ borderRadius: "12px", backgroundColor: "#ffffff" }}
      >
        <div className="card-body p-4 text-center">
          <i className="fa fa-bar-chart text-muted mb-2" style={{ fontSize: "36px", opacity: 0.5 }} />
          <h6 className="fw-bold text-secondary mb-1">No Chart Data Available</h6>
          <small className="text-muted">
            There are no payment records matching your current filter selection to render graphs.
          </small>
        </div>
      </div>
    );
  }

  // 1. Comparison Bar / Column Chart Options
  const comparisonOptions = {
    chart: {
      type: "bar",
      stacked: isStacked,
      toolbar: {
        show: true,
        offsetX: 0,
        offsetY: -4,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false,
        },
      },
      fontFamily: "inherit",
      events: {
        dataPointSelection: (event, chartContext, config) => {
          const idx = config.dataPointIndex;
          if (idx >= 0 && chartData.entities[idx]) {
            const entity = chartData.entities[idx];
            if (currentLevel === "country" && onCountryClick) {
              onCountryClick(entity.rawName);
            } else if (currentLevel === "city" && onCityClick) {
              onCityClick(entity.rawName, entity.country);
            }
          }
        },
      },
    },
    plotOptions: {
      bar: {
        horizontal: isHorizontal,
        columnWidth: chartData.categories.length <= 3 ? "36%" : "55%",
        barHeight: chartData.categories.length <= 3 ? "38%" : "60%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        dataLabels: {
          position: isHorizontal ? "top" : (isStacked ? "center" : "top"),
          hideOverflowingLabels: true,
        },
      },
    },
    dataLabels: {
      enabled: showDataLabels,
      formatter: (val) => {
        if (!val || Number(val) === 0) return "";
        return formatShortCurrency(val);
      },
      dropShadow: { enabled: false },
      style: {
        fontSize: "11px",
        fontWeight: 700,
        colors: isStacked ? ["#ffffff"] : ["#334155"],
      },
      offsetY: isHorizontal ? 0 : (isStacked ? 0 : -8),
      offsetX: isHorizontal ? 6 : 0,
      background: {
        enabled: false,
      },
    },
    colors: ["#2563eb", "#10b981", "#f43f5e"],
    stroke: {
      show: true,
      width: 2,
      colors: isStacked ? ["#ffffff"] : ["transparent"],
    },
    xaxis: isHorizontal
      ? {
          // In HORIZONTAL mode: X-axis is the NUMERIC SCALE
          min: 0,
          categories: chartData.categories,
          labels: {
            formatter: (val) => formatShortCurrency(val),
            style: {
              colors: "#64748b",
              fontSize: "11px",
              fontWeight: 600,
            },
          },
          max: (max) => (max > 0 ? max * 1.18 : undefined),
        }
      : {
          // In VERTICAL mode: X-axis is the CATEGORY NAMES
          categories: chartData.categories,
          labels: {
            formatter: (val) => String(val || ""),
            style: {
              colors: "#64748b",
              fontSize: "12px",
              fontWeight: 600,
            },
            rotate: chartData.categories.length > 5 ? -35 : 0,
          },
        },
    yaxis: isHorizontal
      ? {
          // In HORIZONTAL mode: Y-axis displays the CATEGORY NAMES (Hospital / Country)
          labels: {
            formatter: (val) => {
              if (typeof val === "string") return val;
              if (typeof val === "number" && chartData.categories[val]) {
                return chartData.categories[val];
              }
              return String(val || "");
            },
            style: {
              colors: "#334155",
              fontSize: "12px",
              fontWeight: 600,
            },
            maxWidth: 180,
          },
        }
      : {
          // In VERTICAL mode: Y-axis is the NUMERIC SCALE
          min: 0,
          labels: {
            formatter: (val) => formatShortCurrency(val),
            style: {
              colors: "#64748b",
              fontSize: "11px",
            },
          },
          max: (max) => (max > 0 ? max * 1.15 : undefined),
        },
    fill: {
      opacity: 1,
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val) => formatCurrency(val),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      offsetX: 10,
      offsetY: 0,
      fontSize: "12px",
      fontWeight: 600,
      markers: {
        radius: 4,
        width: 12,
        height: 12,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 4,
      },
    },
    grid: {
      borderColor: "#f1f5f9",
      strokeDashArray: 4,
    },
  };

  const comparisonSeries = [
    {
      name: "Total Billing",
      data: chartData.totalBillingSeries,
    },
    {
      name: "Payments Received",
      data: chartData.paymentsReceivedSeries,
    },
    {
      name: "Dues Pending",
      data: chartData.duesPendingSeries,
    },
  ];

  // 2. Collection Donut Options (Total Received vs Total Due)
  const collectionDonutOptions = {
    chart: {
      type: "donut",
      fontFamily: "inherit",
    },
    labels: ["Payments Received", "Dues Pending"],
    colors: ["#10b981", "#f43f5e"],
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontWeight: 500,
      formatter: (seriesName, opts) => {
        const val = opts.w.globals.series[opts.seriesIndex];
        return `${seriesName}: ${formatCurrency(val)}`;
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val.toFixed(1)}%`,
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "13px",
              color: "#64748b",
            },
            value: {
              show: true,
              fontSize: "16px",
              fontWeight: 700,
              color: "#0f172a",
              formatter: (val) => formatCurrency(val),
            },
            total: {
              show: true,
              label: "Recovery Rate",
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748b",
              formatter: () => `${summaryTotals.recoveryRate}%`,
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (val) => formatCurrency(val),
      },
    },
  };

  const collectionDonutSeries = [summaryTotals.paymentsReceived, summaryTotals.duesPending];

  // 3. Revenue Share Distribution Donut
  const revenueShareOptions = {
    chart: {
      type: "donut",
      fontFamily: "inherit",
    },
    labels: chartData.categories,
    colors: [
      "#3b82f6",
      "#06b6d4",
      "#8b5cf6",
      "#10b981",
      "#f59e0b",
      "#ec4899",
      "#6366f1",
      "#14b8a6",
      "#f43f5e",
      "#84cc16",
    ],
    legend: {
      position: "bottom",
      fontSize: "11px",
      maxHeight: 100,
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val.toFixed(1)}%`,
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "12px",
            },
            value: {
              show: true,
              fontSize: "15px",
              fontWeight: 700,
              formatter: (val) => formatShortCurrency(val),
            },
            total: {
              show: true,
              label: "Total Billing",
              fontSize: "12px",
              formatter: () => formatShortCurrency(summaryTotals.totalBilling),
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (val) => formatCurrency(val),
      },
    },
  };

  // 4. Operational Volume Chart Options (Hospitals & Treatments)
  const volumeOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: chartData.categories.length <= 3 ? "30%" : "48%",
        borderRadius: 4,
      },
    },
    colors: ["#6366f1", "#0284c7"],
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: { fontSize: "12px", fontWeight: 600, colors: "#64748b" },
      },
    },
    yaxis: {
      min: 0,
      labels: {
        formatter: (val) => Number(val).toFixed(0),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      offsetX: 10,
      fontSize: "12px",
    },
    dataLabels: {
      enabled: showDataLabels,
      formatter: (val) => (val && val > 0 ? val : ""),
      style: {
        fontSize: "10px",
        fontWeight: 700,
        colors: ["#334155"],
      },
      offsetY: -6,
      background: {
        enabled: false,
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
    },
    grid: {
      borderColor: "#f1f5f9",
      strokeDashArray: 4,
    },
  };

  const volumeSeries = [
    {
      name: "Hospitals",
      data: chartData.hospitalsSeries,
    },
    {
      name: "Treatments",
      data: chartData.treatmentsSeries,
    },
  ];

  return (
    <div
      className="card border-0 mb-4 shadow-sm"
      style={{
        borderRadius: "14px",
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
      }}
    >
      {/* Visual Analytics Header & Navigation Controls */}
      <div
        className="card-header bg-white border-bottom py-3 px-4 d-flex flex-wrap align-items-center justify-content-between gap-3"
        style={{ borderTopLeftRadius: "14px", borderTopRightRadius: "14px" }}
      >
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            <i className="fa fa-bar-chart" />
          </div>
          <div>
            <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: "16px" }}>
              Payment & Billing Visual Analytics
            </h6>
            <small className="text-muted" style={{ fontSize: "12px" }}>
              Comparing financial metrics for{" "}
              <span className="badge bg-primary text-white text-capitalize">
                {currentLevel} Level
              </span>{" "}
              ({chartData.categories.length} {chartData.categories.length === 1 ? "record" : "records"} in view)
            </small>
          </div>
        </div>

        {/* Action Controls & Display Mode Selector */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Tab Selector */}
          <div className="btn-group btn-group-sm" role="group" aria-label="Analytics Views">
            <button
              type="button"
              className={`btn ${activeTab === "overview" ? "btn-primary" : "btn-light border"}`}
              onClick={() => setActiveTab("overview")}
              style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px" }}
            >
              <i className="fa fa-area-chart me-1" /> All Charts
            </button>
            <button
              type="button"
              className={`btn ${activeTab === "breakdown" ? "btn-primary" : "btn-light border"}`}
              onClick={() => setActiveTab("breakdown")}
              style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px" }}
            >
              <i className="fa fa-pie-chart me-1" /> Collection Split
            </button>
            <button
              type="button"
              className={`btn ${activeTab === "distribution" ? "btn-primary" : "btn-light border"}`}
              onClick={() => setActiveTab("distribution")}
              style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px" }}
            >
              <i className="fa fa-pie-chart me-1" /> Revenue Share
            </button>
            {chartData.hasVolumeData && (
              <button
                type="button"
                className={`btn ${activeTab === "volume" ? "btn-primary" : "btn-light border"}`}
                onClick={() => setActiveTab("volume")}
                style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px" }}
              >
                <i className="fa fa-hospital-o me-1" /> Operations Volume
              </button>
            )}
          </div>

          {/* Chart Style Switcher (when on Overview Tab) */}
          {activeTab === "overview" && (
            <div className="btn-group btn-group-sm" role="group" aria-label="Bar Chart Style">
              <button
                type="button"
                className={`btn ${chartType === "bar" ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setChartType("bar")}
                title="Vertical Column Chart"
                style={{ fontSize: "11px", padding: "5px 10px" }}
              >
                <i className="fa fa-bar-chart" /> Column
              </button>
              <button
                type="button"
                className={`btn ${chartType === "stacked" ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setChartType("stacked")}
                title="Stacked Bar Chart"
                style={{ fontSize: "11px", padding: "5px 10px" }}
              >
                <i className="fa fa-tasks" /> Stacked
              </button>
              <button
                type="button"
                className={`btn ${chartType === "horizontal" ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setChartType("horizontal")}
                title="Horizontal Bar Chart"
                style={{ fontSize: "11px", padding: "5px 10px" }}
              >
                <i className="fa fa-align-left" /> Bar
              </button>
              <button
                type="button"
                className={`btn ${showDataLabels ? "btn-info text-white" : "btn-outline-secondary"}`}
                onClick={() => setShowDataLabels((prev) => !prev)}
                title="Show or hide numerical counts on bars"
                style={{ fontSize: "11px", padding: "5px 10px", fontWeight: 600 }}
              >
                <i className={`fa ${showDataLabels ? "fa-check-circle" : "fa-circle-o"} me-1`} />
                Counts on Bars: {showDataLabels ? "ON" : "OFF"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body p-4">
        {/* Executive KPI Strip */}
        <div className="row g-3 mb-4">
          <div className="col-xl-3 col-md-6 col-12">
            <div
              className="p-3 border rounded-3"
              style={{
                backgroundColor: "#f8fafc",
                borderLeft: "4px solid #10b981 !important",
              }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted fw-semibold" style={{ fontSize: "12px" }}>
                  Collection Recovery Rate
                </span>
                <span className="badge bg-success" style={{ fontSize: "10px" }}>
                  {summaryTotals.recoveryRate}%
                </span>
              </div>
              <h5 className="fw-bold text-dark mt-2 mb-1" style={{ fontSize: "18px" }}>
                {formatShortCurrency(summaryTotals.paymentsReceived)}
              </h5>
              <div className="progress mt-2" style={{ height: "6px" }}>
                <div
                  className="progress-bar bg-success"
                  role="progressbar"
                  style={{ width: `${Math.min(100, Math.max(0, summaryTotals.recoveryRate))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-md-6 col-12">
            <div
              className="p-3 border rounded-3"
              style={{
                backgroundColor: "#f8fafc",
                borderLeft: "4px solid #f43f5e !important",
              }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted fw-semibold" style={{ fontSize: "12px" }}>
                  Outstanding Dues Ratio
                </span>
                <span className="badge bg-danger" style={{ fontSize: "10px" }}>
                  {summaryTotals.duesRatio}%
                </span>
              </div>
              <h5 className="fw-bold text-danger mt-2 mb-1" style={{ fontSize: "18px" }}>
                {formatShortCurrency(summaryTotals.duesPending)}
              </h5>
              <div className="progress mt-2" style={{ height: "6px" }}>
                <div
                  className="progress-bar bg-danger"
                  role="progressbar"
                  style={{ width: `${Math.min(100, Math.max(0, summaryTotals.duesRatio))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-md-6 col-12">
            <div
              className="p-3 border rounded-3"
              style={{
                backgroundColor: "#f8fafc",
                borderLeft: "4px solid #2563eb !important",
              }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted fw-semibold" style={{ fontSize: "12px" }}>
                  Top Billing Entity
                </span>
                <i className="fa fa-trophy text-warning" />
              </div>
              <h5
                className="fw-bold text-dark mt-2 mb-1 text-truncate"
                style={{ fontSize: "16px" }}
                title={summaryTotals.topEntity ? summaryTotals.topEntity.rawName : "—"}
              >
                {summaryTotals.topEntity ? summaryTotals.topEntity.rawName : "—"}
              </h5>
              <small className="text-primary fw-semibold" style={{ fontSize: "12px" }}>
                {summaryTotals.topEntity ? formatCurrency(summaryTotals.topEntity.billing) : "—"}
              </small>
            </div>
          </div>

          <div className="col-xl-3 col-md-6 col-12">
            <div
              className="p-3 border rounded-3"
              style={{
                backgroundColor: "#f8fafc",
                borderLeft: "4px solid #6366f1 !important",
              }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted fw-semibold" style={{ fontSize: "12px" }}>
                  Avg Billing per Entity
                </span>
                <i className="fa fa-calculator text-muted" />
              </div>
              <h5 className="fw-bold text-dark mt-2 mb-1" style={{ fontSize: "18px" }}>
                {formatShortCurrency(summaryTotals.avgBilling)}
              </h5>
              <small className="text-muted" style={{ fontSize: "11px" }}>
                Across {chartData.categories.length} {currentLevel}s
              </small>
            </div>
          </div>
        </div>

        {/* Tab 1: Overview Dashboard (All-in-One: Comparison Bar + Collection Donut) */}
        {activeTab === "overview" && (
          <div className="row g-4">
            {/* Left Col: Financial Comparison Bar Chart */}
            <div className="col-xl-8 col-lg-7 col-12">
              <div className="border rounded-3 p-3 bg-white h-100 shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "14px" }}>
                      Financial Comparison by {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}
                    </h6>
                    <small className="text-muted" style={{ fontSize: "11px" }}>
                      Total Billing vs Payments Received vs Dues Pending
                      {(currentLevel === "country" || currentLevel === "city") && (
                        <span className="text-primary ms-1">
                          (Click any bar to drill down)
                        </span>
                      )}
                    </small>
                  </div>
                </div>
                <ReactApexChart
                  type={chartType === "horizontal" ? "bar" : "bar"}
                  height={chartHeight}
                  options={comparisonOptions}
                  series={comparisonSeries}
                />
              </div>
            </div>

            {/* Right Col: Collection Status Donut */}
            <div className="col-xl-4 col-lg-5 col-12">
              <div className="border rounded-3 p-3 bg-white h-100 shadow-sm d-flex flex-column justify-content-between">
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "14px" }}>
                    Collection vs Pending Dues
                  </h6>
                  <small className="text-muted" style={{ fontSize: "11px" }}>
                    Total payments received versus balance due
                  </small>
                </div>
                <div className="py-2">
                  <ReactApexChart
                    type="donut"
                    height={260}
                    options={collectionDonutOptions}
                    series={collectionDonutSeries}
                  />
                </div>
                <div className="p-2 bg-light rounded-2 text-center" style={{ fontSize: "12px" }}>
                  <span className="text-muted">Total Billed: </span>
                  <strong className="text-primary">{formatCurrency(summaryTotals.totalBilling)}</strong>
                </div>
              </div>
            </div>

            {/* Row 2: Revenue Distribution & Operational Volume */}
            <div className="col-xl-6 col-lg-6 col-12">
              <div className="border rounded-3 p-3 bg-white h-100 shadow-sm">
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "14px" }}>
                  Revenue Contribution Share
                </h6>
                <small className="text-muted" style={{ fontSize: "11px" }}>
                  Percentage of total billing generated by each {currentLevel}
                </small>
                <div className="mt-2">
                  <ReactApexChart
                    type="donut"
                    height={270}
                    options={revenueShareOptions}
                    series={chartData.totalBillingSeries}
                  />
                </div>
              </div>
            </div>

            {chartData.hasVolumeData && (
              <div className="col-xl-6 col-lg-6 col-12">
                <div className="border rounded-3 p-3 bg-white h-100 shadow-sm">
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "14px" }}>
                    Operational Scale (Hospitals & Treatments)
                  </h6>
                  <small className="text-muted" style={{ fontSize: "11px" }}>
                    Associated hospitals and registered treatment courses
                  </small>
                  <div className="mt-2">
                    <ReactApexChart
                      type="bar"
                      height={270}
                      options={volumeOptions}
                      series={volumeSeries}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Dedicated Collection Split */}
        {activeTab === "breakdown" && (
          <div className="row g-4 align-items-center">
            <div className="col-lg-6 col-12">
              <div className="border rounded-3 p-4 bg-white shadow-sm">
                <h6 className="fw-bold mb-1 text-dark">Overall Collection Split</h6>
                <p className="text-muted mb-3" style={{ fontSize: "12px" }}>
                  Visual comparison between received payments and pending dues across current filter
                </p>
                <ReactApexChart
                  type="donut"
                  height={320}
                  options={collectionDonutOptions}
                  series={collectionDonutSeries}
                />
              </div>
            </div>
            <div className="col-lg-6 col-12">
              <div className="border rounded-3 p-4 bg-white shadow-sm">
                <h6 className="fw-bold mb-3 text-dark">Financial Health Summary</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-borderless mb-0" style={{ fontSize: "13px" }}>
                    <tbody>
                      <tr className="border-bottom">
                        <td className="py-2 text-muted">
                          <i className="fa fa-calculator text-primary me-2" /> Total Billing:
                        </td>
                        <td className="py-2 text-end fw-bold text-dark">
                          {formatCurrency(summaryTotals.totalBilling)}
                        </td>
                      </tr>
                      <tr className="border-bottom">
                        <td className="py-2 text-muted">
                          <i className="fa fa-check-circle text-success me-2" /> Payments Received:
                        </td>
                        <td className="py-2 text-end fw-bold text-success">
                          {formatCurrency(summaryTotals.paymentsReceived)}
                        </td>
                      </tr>
                      <tr className="border-bottom">
                        <td className="py-2 text-muted">
                          <i className="fa fa-clock-o text-danger me-2" /> Dues Pending:
                        </td>
                        <td className="py-2 text-end fw-bold text-danger">
                          {formatCurrency(summaryTotals.duesPending)}
                        </td>
                      </tr>
                      <tr className="border-bottom">
                        <td className="py-2 text-muted">
                          <i className="fa fa-percent text-info me-2" /> Recovery Rate:
                        </td>
                        <td className="py-2 text-end fw-bold text-primary">
                          {summaryTotals.recoveryRate}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-muted">
                          <i className="fa fa-exclamation-triangle text-warning me-2" /> Outstanding Dues Ratio:
                        </td>
                        <td className="py-2 text-end fw-bold text-danger">
                          {summaryTotals.duesRatio}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Dedicated Revenue Share */}
        {activeTab === "distribution" && (
          <div className="row g-4 align-items-center">
            <div className="col-lg-6 col-12">
              <div className="border rounded-3 p-4 bg-white shadow-sm">
                <h6 className="fw-bold mb-1 text-dark">Revenue Contribution Percentage</h6>
                <p className="text-muted mb-3" style={{ fontSize: "12px" }}>
                  Shows relative share of total billing per {currentLevel}
                </p>
                <ReactApexChart
                  type="donut"
                  height={320}
                  options={revenueShareOptions}
                  series={chartData.totalBillingSeries}
                />
              </div>
            </div>
            <div className="col-lg-6 col-12">
              <div className="border rounded-3 p-4 bg-white shadow-sm">
                <h6 className="fw-bold mb-3 text-dark">Top Contributors Ranking</h6>
                <div className="table-responsive">
                  <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: "12px" }}>
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>{currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}</th>
                        <th className="text-end">Billing Amount</th>
                        <th className="text-end">Share %</th>
                        {(currentLevel === "country" || currentLevel === "city") && (
                          <th className="text-center">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[...chartData.entities]
                        .sort((a, b) => b.billing - a.billing)
                        .map((ent, eIdx) => {
                          const share = summaryTotals.totalBilling > 0 ? ((ent.billing / summaryTotals.totalBilling) * 100).toFixed(1) : 0;
                          return (
                            <tr key={eIdx}>
                              <td className="fw-semibold text-muted">{eIdx + 1}</td>
                              <td className="fw-bold text-dark">{ent.rawName}</td>
                              <td className="text-end fw-semibold text-primary">{formatCurrency(ent.billing)}</td>
                              <td className="text-end fw-bold text-secondary">{share}%</td>
                              {(currentLevel === "country" || currentLevel === "city") && (
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline-primary"
                                    style={{ fontSize: "11px", padding: "2px 8px" }}
                                    onClick={() => {
                                      if (currentLevel === "country" && onCountryClick) {
                                        onCountryClick(ent.rawName);
                                      } else if (currentLevel === "city" && onCityClick) {
                                        onCityClick(ent.rawName, ent.country);
                                      }
                                    }}
                                  >
                                    Explore <i className="fa fa-arrow-right" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Operations Volume */}
        {activeTab === "volume" && chartData.hasVolumeData && (
          <div className="border rounded-3 p-4 bg-white shadow-sm">
            <h6 className="fw-bold mb-1 text-dark">Hospitals & Treatments Volume Comparison</h6>
            <p className="text-muted mb-3" style={{ fontSize: "12px" }}>
              Scale of healthcare facilities and active treatment courses per {currentLevel}
            </p>
            <ReactApexChart
              type="bar"
              height={340}
              options={volumeOptions}
              series={volumeSeries}
            />
          </div>
        )}

        {/* Quick Click-to-Drill Guidance Footer */}
        {(currentLevel === "country" || currentLevel === "city") && (
          <div
            className="mt-3 p-2 px-3 rounded-2 d-flex align-items-center justify-content-between flex-wrap gap-2"
            style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "12px" }}
          >
            <span className="text-success fw-medium">
              <i className="fa fa-info-circle me-1" />
              Tip: You can click directly on any chart bar to drill down into its {currentLevel === "country" ? "cities" : "hospitals"}!
            </span>
            <div className="d-flex align-items-center gap-1">
              {chartData.entities.slice(0, 5).map((ent, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn btn-sm btn-light border py-0 px-2 text-dark"
                  style={{ fontSize: "11px", borderRadius: "12px" }}
                  onClick={() => {
                    if (currentLevel === "country" && onCountryClick) {
                      onCountryClick(ent.rawName);
                    } else if (currentLevel === "city" && onCityClick) {
                      onCityClick(ent.rawName, ent.country);
                    }
                  }}
                >
                  View {ent.rawName} &rarr;
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
