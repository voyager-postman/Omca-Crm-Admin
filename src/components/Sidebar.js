import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { parsePermissions, getAuthSessionId, isSocialMediaRole, isMongoObjectId } from "../utils/authStorage";
import { fetchAndApplyUserDetails } from "../services/userDetailsService";
import {
  ACTIVITY_LOG_PERMISSION,
  hasActivityLogPermission,
  hasDirectorMessagesPermission,
  hasReferralPermission,
  hasInsurancePermission,
  DIRECTOR_MESSAGES_PERMISSIONS,
  hasAnyDashboardPermission,
} from "../utils/sosPermissions";
import {
  fetchGeneralEnquiryUnread,
  fetchOtherEnquiryUnread,
  fetchUnreadCounts,
  getCachedUnreadCounts,
  GENERAL_ENQUIRY_COUNTS_EVENT,
  getCachedGeneralEnquiryUnread,
  getCachedOtherEnquiryUnread,
  OTHER_ENQUIRY_COUNTS_EVENT,
  SIDEBAR_COUNT_KEY,
  sumGeneralEnquiryUnread,
  sumOtherEnquiryUnread,
  UNREAD_REFRESH_EVENT,
} from "../services/unreadApi";

function MenuCount({ path, counts, extra = 0 }) {
  const key = SIDEBAR_COUNT_KEY[path];
  const count = (Number(counts?.[key]) || 0) + (Number(extra) || 0);
  if (!key || count <= 0) return null;
  return <span className="sidebar-badge">{count}</span>;
}

export default function Sidebar() {
  const [sessionId, setSessionId] = useState(getAuthSessionId);
  const [unreadCounts, setUnreadCounts] = useState(() => getCachedUnreadCounts() || {});
  const [otherEnquiryUnread, setOtherEnquiryUnread] = useState(() =>
    sumOtherEnquiryUnread(getCachedOtherEnquiryUnread()),
  );

  const [generalEnquiryUnread, setGeneralEnquiryUnread] = useState(() =>
    sumGeneralEnquiryUnread(getCachedGeneralEnquiryUnread()),
  );
  const extraCounts = {
    "/Admin/Inquiry": otherEnquiryUnread,
    "/Admin/General_Enquiries": generalEnquiryUnread,
  };

  useEffect(() => {
    const loadEnquiryTabCounts = async () => {
      const results = await Promise.allSettled([
        fetchOtherEnquiryUnread(),
        fetchGeneralEnquiryUnread(),
      ]);
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Error loading enquiry tab counts:", result.reason);
        }
      });
    };
    const handleOtherCounts = (event) => {
      setOtherEnquiryUnread(sumOtherEnquiryUnread(event.detail));
    };
    const handleGeneralCounts = (event) => {
      setGeneralEnquiryUnread(sumGeneralEnquiryUnread(event.detail));
    };

    window.addEventListener(OTHER_ENQUIRY_COUNTS_EVENT, handleOtherCounts);
    window.addEventListener(GENERAL_ENQUIRY_COUNTS_EVENT, handleGeneralCounts);
    window.addEventListener(UNREAD_REFRESH_EVENT, loadEnquiryTabCounts);
    loadEnquiryTabCounts();
    const timer = window.setInterval(loadEnquiryTabCounts, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(OTHER_ENQUIRY_COUNTS_EVENT, handleOtherCounts);
      window.removeEventListener(
        GENERAL_ENQUIRY_COUNTS_EVENT,
        handleGeneralCounts,
      );
      window.removeEventListener(UNREAD_REFRESH_EVENT, loadEnquiryTabCounts);
    };
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("_id");
    const rawPerms = localStorage.getItem("permissionArray");

    // If logged in but permissionArray is missing/empty, fetch via get_details/:userId
    if (token && userId && !rawPerms && isMongoObjectId(userId)) {
      fetchAndApplyUserDetails(userId, token).then(() => {
        if (!cancelled) {
          setSessionId(getAuthSessionId());
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const refresh = () => setSessionId(getAuthSessionId());
    window.addEventListener("storage", refresh);
    window.addEventListener("auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("auth-changed", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSidebarBadges = async () => {
      try {
        const result = await fetchUnreadCounts();
        if (cancelled || !result?.success || !result.counts) return;
        setUnreadCounts(result.counts);
      } catch (err) {
        console.error("Error loading sidebar counts:", err);
      }
    };

    loadSidebarBadges();
    const timer = window.setInterval(loadSidebarBadges, 60000);
    window.addEventListener(UNREAD_REFRESH_EVENT, loadSidebarBadges);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(UNREAD_REFRESH_EVENT, loadSidebarBadges);
    };
  }, [sessionId]);

  const permissions = useMemo(() => parsePermissions(), [sessionId]);
  const role = localStorage.getItem("Role");
  const normalizedRole = (
    localStorage.getItem("Role") ||
    localStorage.getItem("role") ||
    sessionStorage.getItem("Role") ||
    ""
  )
    .trim()
    .toUpperCase();
  const isReferralRole =
    normalizedRole === "REFERRAL" ||
    normalizedRole === "REFERRER" ||
    Boolean(localStorage.getItem("referral_id"));
  const isInsuranceRole =
    normalizedRole === "INSURANCE" ||
    Boolean(localStorage.getItem("insurance_id"));

  const enquiryEndpoints = [
    "/Enquiries",
    "/Air_Medical_Escort",
    "/Ambulance_Service",
    "/Treatment_Estimate",
    "/SOS_Emergency",
    "/sos/list",
    "/Campaign_Contacts",
    "/Chatbot_Leads",
  ];
  const hasEnquiryAccess =
    isSocialMediaRole(role) ||
    enquiryEndpoints.some((ep) => permissions.includes(ep));
  const generalEnquiryEndpoints = [
    "/General_Enquiries",
    "/Medical_Visa",
    // "/Guest_House_Stay",
    "/Forex_Service",
    "/Flight_Service",
    "/Pickup_and_Drop",
    "/Home_Care",
    "/Test_Form",
    "/Contact_Us",
  ];

  const hasGeneralEnquiryAccess = generalEnquiryEndpoints.some((ep) =>
    permissions.includes(ep),
  );
  const menuItems = [
    { path: "/Dashboard", icon: "fa-dashboard", label: "Dashboard" },
    {
      path: "/App_Users",
      actualPath: "/Admin/app-users",
      icon: "fa-mobile",
      label: "App Users",
      condition:
        role === "Admin" ||
        permissions.includes("/App_Users") ||
        permissions.includes("/app_users") ||
        permissions.includes("App_Users"),
    },
    {
      path: "/Enquiries",
      actualPath: "/Admin/Inquiry",
      icon: "fa-comments-o",
      label: "Enquiries",
      condition: hasEnquiryAccess,
    },
    {
      path: "/General_Enquiries",
      actualPath: "/Admin/General_Enquiries",
      icon: "fa-comments-o",
      label: "General Enquiries",
      condition: hasGeneralEnquiryAccess,
    },
    {
      path: "/Manage_Patients",
      actualPath: "/Admin/patients",
      icon: "fa-wheelchair",
      label: "Manage Patients",
    },
    {
      path: "/Patient_Travel",
      actualPath: "/Admin/patient-travel",
      icon: "fa-plane",
      label: "Patient Travel",
      condition:
        role === "Admin" ||
        permissions.includes("/Patient_Travel"),
    },
    {
      path: "/Physiotherapy",
      actualPath: "/Admin/physiotherapy",
      icon: "fa-heartbeat",
      label: "Physiotherapy",
      condition:
        role === "Admin" ||
        permissions.includes("/Physiotherapy"),
    },
    {
      path: "/Messages",
      actualPath: "/Admin/messages",
      icon: "fa-commenting",
      label: "Messages",
      condition:
        role === "Admin" ||
        permissions.includes("/Messages") ||
        permissions.includes("/messages"),
    },
    {
      path: "/Director_Messages",
      actualPath: "/Admin/director-messages",
      icon: "fa-bullhorn",
      label: "Director Messages",
      condition:
        role === "Admin" ||
        hasAnyDashboardPermission(permissions, DIRECTOR_MESSAGES_PERMISSIONS, role),
    },
    {
      path: "/Manage_Appointments",
      actualPath: "/Admin/Appointments",
      icon: "fa-calendar",
      label: "Manage Appointments",
    },
    {
      path: "/Orders",
      actualPath: "/Admin/orders",
      icon: "fa-shopping-cart",
      label: "Orders",
      condition:
        role === "Admin" ||
        permissions.includes("/Orders") ||
        permissions.includes("/orders"),
    },
    {
      path: "/Manage_Services",
      actualPath: "/Admin/Services",
      icon: "fa-server",
      label: "Manage Services",
    },
    {
      path: "/Manage_Countries",
      actualPath: "/Admin/Countries",
      icon: "fa-globe",
      label: "Manage Countries",
    },
    {
      path: "/Guest_Houses",
      actualPath: "/Admin/guesthouses",
      icon: "fa-building",
      label: "Guest Houses",
      condition:
        role === "Admin" ||
        permissions.includes("/Guest_Houses") ||
        permissions.includes("/Manage_Guest_Houses"),
    },
    {
      path: "/Guest_House_Services",
      actualPath: "/Admin/guesthouse-services",
      icon: "fa-concierge-bell",
      label: "Guest House Services",
      condition:
        role === "Admin" ||
        permissions.includes("/Guest_House_Services"),
    },
    {
      path: "/Referral",
      actualPath: "/Admin/referrals",
      icon: "fa-percent",
      label: isReferralRole ? "Commissions" : "Referral",
      condition:
        role === "Admin" ||
        isReferralRole ||
        hasReferralPermission(permissions, role) ||
        permissions.includes("/Referral") ||
        permissions.includes("/referrals") ||
        permissions.includes("/Manage_Referrals"),
    },
    {
      path: "/Insurance",
      actualPath: "/Admin/insurances",
      icon: "fa-shield",
      label: isInsuranceRole ? "Commissions" : "Insurance",
      condition:
        role === "Admin" ||
        isInsuranceRole ||
        hasInsurancePermission(permissions, role) ||
        permissions.includes("/Insurance") ||
        permissions.includes("/insurances") ||
        permissions.includes("/Admin/insurances") ||
        permissions.includes("/Manage_Insurance"),
    },
    {
      path: "/Manage_Staffs",
      actualPath: "/Admin/Staff",
      icon: "fa-user-md",
      label: "Manage Staff",
    },
    {
      path: "/Manage_Permissions",
      actualPath: "/Admin/New-Permission",
      icon: "fa-lock",
      label: "Manage Permission",
    },
    {
      path: "/History",
      actualPath: "/Admin/History",
      icon: "fa-history",
      label: "History",
    },
    {
      path: ACTIVITY_LOG_PERMISSION,
      actualPath: "/Admin/activity-logs",
      icon: "fa-list-alt",
      label: "Activity Log",
      condition: hasActivityLogPermission(permissions, role),
    },
    // {
    //  path: "/Employee_Activity",
    //  actualPath: "/Admin/employee-activity",
    //  icon: "fa-bar-chart",
    //  label: "Employee Activity",
    //  condition: hasActivityLogPermission(permissions, role),
    //},
    {
      path: "/Reports",
      actualPath: "/Admin/Reports",
      icon: "fa-file-text-o",
      label: "Reports",
    },
    {
      path: "/Payments",
      actualPath: "/Admin/Earnings",
      icon: "fa-line-chart",
      label: "Payments",
    },
    {
      path: "/Payment_Data",
      actualPath: "/Admin/payment-data",
      icon: "fa-credit-card",
      label: "Payment Data",
      condition: role === "Admin" || permissions.includes("/Payment_Data"),
    },
    {
      path: "/Hospital_Commission",
      actualPath: "/Admin/hospital-commission",
      icon: "fa-hospital-o",
      label: "Hospital Commission",
      condition:
        role === "Admin" ||
        permissions.includes("/Hospital_Commission") ||
        permissions.includes("/Payment_Data"),
    },
    // {
    //   path: "/GOP_Payments",
    //   actualPath: "/Admin/gop-payments",
    //   icon: "fa-file-text",
    //   label: "GOP Payments",
    //   condition:
    //     role === "Admin" ||
    //     permissions.includes("/GOP_Payments") ||
    //     permissions.includes("/Payment_Data"),
    // },
    {
      path: "/Manage_Roles",
      actualPath: "/Admin/roles",
      icon: "fa-line-chart",
      label: "Manage Roles",
    },
  ];

  const handleLinkClick = () => {
    if (window.innerWidth < 1200) {
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.querySelector('.sidebar-overlay');
      const mainWrapper = document.querySelector('.main-wrapper');
      if (sidebar) sidebar.classList.remove('opened');
      if (sidebarOverlay) sidebarOverlay.classList.remove('opened');
      if (mainWrapper) mainWrapper.classList.remove('slide-nav');
      document.documentElement.classList.remove('menu-opened');
    }
  };


  if (isReferralRole || isInsuranceRole) {
    return (
      <div className="sidebar" id="sidebar">
        <div className="sidebar-inner slimscroll">
          <div id="sidebar-menu" className="sidebar-menu">
            <ul>
              <li>
                <NavLink
                  to="/Dashboard"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={handleLinkClick}
                >
                  <i className="fa fa-dashboard" />
                  <span>Dashboard</span>
                </NavLink>
              </li>
              {isReferralRole && (
                <li>
                  <NavLink
                    to="/Admin/referrals"
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={handleLinkClick}
                  >
                    <i className="fa fa-percent" />
                    <span>Commission</span>
                  </NavLink>
                </li>
              )}
              {isInsuranceRole && (
                <li>
                  <NavLink
                    to="/Admin/insurances"
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={handleLinkClick}
                  >
                    <i className="fa fa-percent" />
                    <span>Commission</span>
                  </NavLink>
                </li>
              )}
              <li>
                <NavLink
                  to="/Admin/Inquiry"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={handleLinkClick}
                >
                  <i className="fa fa-comments-o" />
                  <span>Enquiries</span>
                  <MenuCount
                    path="/Admin/Inquiry"
                    counts={unreadCounts}
                    extra={otherEnquiryUnread}
                  />
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/Admin/General_Enquiries"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={handleLinkClick}
                >
                  <i className="fa fa-comments-o" />
                  <span>General Enquiries</span>
                  <MenuCount
                    path="/Admin/General_Enquiries"
                    counts={unreadCounts}
                    extra={generalEnquiryUnread}
                  />
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/Admin/patients"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={handleLinkClick}
                >
                  <i className="fa fa-wheelchair" />
                  <span>Manage Patients</span>
                  <MenuCount path="/Admin/patients" counts={unreadCounts} />
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/Admin/messages"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={handleLinkClick}
                >
                  <i className="fa fa-commenting" />
                  <span>Messages</span>
                  <MenuCount path="/Admin/messages" counts={unreadCounts} />
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/Admin/Appointments"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={handleLinkClick}
                >
                  <i className="fa fa-calendar" />
                  <span>Manage Appointments</span>
                  <MenuCount path="/Admin/Appointments" counts={unreadCounts} />
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar" id="sidebar">
      <div className="sidebar-inner slimscroll">
        <div id="sidebar-menu" className="sidebar-menu">
          <ul>
            {menuItems.map((item) => {
              const hasPermission =
                item.condition !== undefined
                  ? item.condition
                  : (role === "Admin" || permissions.includes(item.path));

              if (hasPermission) {
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.actualPath || item.path}
                      className={({ isActive }) => (isActive ? "active" : "")}
                      onClick={handleLinkClick}
                    >
                      <i className={`fa ${item.icon}`} />
                      <span>{item.label}</span>
                      <MenuCount
                        path={item.actualPath || item.path}
                        counts={unreadCounts}
                        extra={extraCounts[item.actualPath || item.path] || 0}
                      />
                    </NavLink>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
