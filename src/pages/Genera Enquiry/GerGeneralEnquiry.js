import React, { useState, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  normalizeGeneralEnquiryUnread,
  publishGeneralEnquiryUnread,
  fetchGeneralEnquiryUnread,
  getCachedGeneralEnquiryUnread,
  UNREAD_REFRESH_EVENT,
  GENERAL_ENQUIRY_COUNTS_EVENT,
} from "../../services/unreadApi";
import { testForms } from "../../reducer/FormsEnquiry";

import MedicalVisa from "./MedicalVisa";
import Story from "./Story";
import ForexService from "./ForexService";
import FlightSrvices from "./FlightSrvices";
import PickDropTabs from "./PickDropTabs";
import NursinfCare from "./NursinfCare";
import Vil from "./Vil";
import TestForm from "./TestForm";
import CancelledGeneralEnquiries from "./CancelledGeneralEnquiries";

export default function GerGeneralEnquiry() {
  const [activeTab, setActiveTab] = useState(0);
  const [startDate, setStartDate] = useState(() => {
    return sessionStorage.getItem("generalEnquiryStartDate") || "";
  });
  const [endDate, setEndDate] = useState(() => {
    return sessionStorage.getItem("generalEnquiryEndDate") || "";
  });

  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (val) sessionStorage.setItem("generalEnquiryStartDate", val);
    else sessionStorage.removeItem("generalEnquiryStartDate");
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    if (val) sessionStorage.setItem("generalEnquiryEndDate", val);
    else sessionStorage.removeItem("generalEnquiryEndDate");
  };

  const handleClearDateRange = () => {
    setStartDate("");
    setEndDate("");
    sessionStorage.removeItem("generalEnquiryStartDate");
    sessionStorage.removeItem("generalEnquiryEndDate");
  };

  const dispatch = useDispatch();
  const apiUnreadCount = useSelector(
    (state) => state.testForms?.testForms?.unreadCount,
  );
  const [cachedCounts, setCachedCounts] = useState(() =>
    getCachedGeneralEnquiryUnread(),
  );

  const unreadCounts = useMemo(() => {
    const cached = cachedCounts || getCachedGeneralEnquiryUnread() || {};
    const merged = {
      ...cached,
      ...(apiUnreadCount || {}),
      app_pickup: Number(
        apiUnreadCount?.app_pickup ??
        apiUnreadCount?.pickup ??
        cached.app_pickup ??
        cached.pickup ??
        0
      ),
      portal_pickup: Number(
        apiUnreadCount?.portal_pickup !== undefined
          ? apiUnreadCount.portal_pickup
          : (cached.portal_pickup || 0)
      ),
    };
    merged.pickup = merged.app_pickup + merged.portal_pickup;
    return normalizeGeneralEnquiryUnread(merged);
  }, [apiUnreadCount, cachedCounts]);

    useEffect(() => {
    dispatch(testForms());
  }, [dispatch]);

  useEffect(() => {
    if (apiUnreadCount && typeof apiUnreadCount === "object") {
      const cached = getCachedGeneralEnquiryUnread() || {};
      const portalPickup = Number(
        apiUnreadCount.portal_pickup !== undefined
          ? apiUnreadCount.portal_pickup
          : (cached.portal_pickup || 0)
      );
      const appPickup = Number(
        apiUnreadCount.app_pickup !== undefined
          ? apiUnreadCount.app_pickup
          : (apiUnreadCount.pickup || 0)
      );
      publishGeneralEnquiryUnread({
        ...apiUnreadCount,
        app_pickup: appPickup,
        portal_pickup: portalPickup,
        pickup: appPickup + portalPickup,
      });
    }
  }, [apiUnreadCount]);

  useEffect(() => {
    const handleRefresh = (e) => {
      if (e?.detail) {
        setCachedCounts(normalizeGeneralEnquiryUnread(e.detail));
      } else {
        fetchGeneralEnquiryUnread();
      }
    };
    window.addEventListener(UNREAD_REFRESH_EVENT, handleRefresh);
    window.addEventListener(GENERAL_ENQUIRY_COUNTS_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(UNREAD_REFRESH_EVENT, handleRefresh);
      window.removeEventListener(GENERAL_ENQUIRY_COUNTS_EVENT, handleRefresh);
    };
  }, [dispatch]);

  // ---------------- GET PERMISSIONS ----------------
  let permissionsRaw = localStorage.getItem("permissionArray") || "";

  let permissions = permissionsRaw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith("/") ? p : `/${p}`));

  console.log("Permissions =>", permissions);

  // ---------------- ADMIN CHECK ----------------
  const isAdmin = permissions.includes("/General_Enquiries");

  console.log("Is Admin =>", isAdmin);

  // ---------------- ALL TABS ----------------
  const allTabs = [
    {
      key: "medical-visa",
      countKey: "medical_visa",
      label: "Medical Visa",
      permission: "/Medical_Visa",
      component: <MedicalVisa />,
    },

    // {
    //   key: "story",
    //   countKey: "stay",
    //   label: "Guest House/Stay",
    //   permission: "/Guest_House_Stay",
    //   component: <Story />,
    // },

    // {
    //   label: "Forex Service",
    //   permission: "/Forex_Service",
    //   component: <ForexService />,
    // },

    {
      key: "flight",
      countKey: "flight",
      label: "Flight Service",
      permission: "/Flight_Service",
      component: <FlightSrvices />,
    },

    {
      key: "pickup",
      countKey: "pickup",
      label: "Pickup and Drop",
      permission: "/Pickup_and_Drop",
      component: <PickDropTabs />,
    },

    {
      key: "home-care",
      countKey: "home_care",
      label: "Home Care",
      permission: "/Home_Care",
      component: <Vil />,
    },

    {
      key: "test-form",
      countKey: "test_form",
      label: "Medical Tests and Scans",
      permission: "/Test_Form",
      component: <TestForm />,
    },

    {
      key: "contact",
      countKey: "contact_us",
      label: "Contact Us",
      permission: "/Contact_Us",
      component: <NursinfCare />,
    },

    {
      key: "cancelled",
      countKey: "cancelled",
      label: "Cancelled",
      permission: "/General_Enquiries",
      component: <CancelledGeneralEnquiries />,
    },
  ];

  // ---------------- FILTER TABS ----------------
  const visibleTabs = useMemo(() => {
    // ADMIN => ALL TABS
    if (isAdmin) {
      return allTabs;
    }

    // STAFF => FILTERED TABS
    return allTabs.filter((tab) => permissions.includes(tab.permission));
  }, [permissions, isAdmin]);

  // ---------------- RESET ACTIVE TAB ----------------
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTab = urlParams.get("tab");
    const saved = queryTab || localStorage.getItem("generalEnquiryTab");
    const idx = visibleTabs.findIndex((tab) => tab.key === saved);
    if (idx >= 0) {
      setActiveTab(idx);
    } else if (visibleTabs.length > 0) {
      setActiveTab((current) =>
        current >= visibleTabs.length ? 0 : current,
      );
    }
  }, [visibleTabs.length]);

  // ---------------- RETURN ----------------
  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row gx-3">
          <div className="col-md-12">
            <div
              className="topmainhd"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <h6 style={{ margin: 0 }}>Manage General Enquiries</h6>

              {/* Date Range Filter */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  background: "#fff",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", margin: 0 }}>
                    From Date:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="form-control form-control-sm"
                    style={{ fontSize: "12px", height: "30px", width: "135px" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", margin: 0 }}>
                    To Date:
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="form-control form-control-sm"
                    style={{ fontSize: "12px", height: "30px", width: "135px" }}
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={handleClearDateRange}
                    className="btn btn-outline-secondary btn-sm"
                    style={{ fontSize: "12px", height: "30px", padding: "0 10px", lineHeight: "28px" }}
                  >
                    Clear Date
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-12">
            <div
              className="tabs-container"
              style={{
                marginBottom: 20,
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              {visibleTabs.map((tab, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveTab(index);
                    if (tab.key) {
                      localStorage.setItem("generalEnquiryTab", tab.key);
                    }
                  }}
                  className={`tab-btn ${
                    activeTab === index ? "active-tab" : ""
                  }`}
                  style={{
                    padding: "8px 18px",
                    border: "1px solid #ccc",
                    background: activeTab === index ? "#22c7b8" : "#fafafa",
                    color: activeTab === index ? "#fff" : "#666",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "12px",
                    lineHeight: "22px",
                    fontWeight: "500",
                  }}
                >
                  {tab.label}
                  {unreadCounts[tab.countKey] > 0 && (
                    <span className="sidebar-badge">
                      {unreadCounts[tab.countKey]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="col-md-12">
            <div className="main_content">
              {visibleTabs.length > 0 ? (
                React.isValidElement(visibleTabs[activeTab]?.component) ? (
                  React.cloneElement(visibleTabs[activeTab]?.component, {
                    dateRange: { startDate, endDate },
                  })
                ) : (
                  visibleTabs[activeTab]?.component
                )
              ) : (
                <h4>No Permission Found</h4>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
