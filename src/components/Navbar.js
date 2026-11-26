import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../img/logo-web-large2.png";
import logodark from "../img/logo-dark.png";
import { useDispatch } from "react-redux";
import { logout } from "../reducer/LoginSlice";
import user from "../img/user.jpg";
import { baseurl } from "../Basurl/Baseurl";
import axios from "axios";
import { useSelector } from "react-redux";
import { GetUserData, clearUser } from "../reducer/userSlice";
import { clearAuth, clearKnownUserId, isSocialMediaRole } from "../utils/authStorage";
import { image } from "../Basurl/Baseurl";
import EmergencyAlertModal from "../pages/EmergencyAlertModal";
import { fetchSosDashboardAlerts } from "../services/sosApi";
import {
  connectSosSocket,
  disconnectSosSocket,
  getSosAlertId,
  isSosAlertDismissed,
  isSosEscalation,
  isSosNewAlert,
  onCrmNotification,
  onCrmPopupAlert,
  onSosAlertDismissed,
  onSosWebAlert,
  requestSosNotificationPermission,
  showSosBrowserNotification,
} from "../services/sosSocket";
import { connectChatSocket } from "../services/chatSocket";
import {
  clearSosAlarm,
  isSosAlarmRinging,
  isSosAlarmSilenced,
  bindSosAlarmGestureResume,
  silenceSosAlarm,
  startSosAlarm,
  stopAllSosAlarms,
  unlockSosAudio,
  unsilenceSosAlarm,
} from "../services/sosAlarm";
import {
  fetchNotifications,
  fetchPopupAlerts,
  getNotificationId,
  getPopupAlertId,
  isPopupDismissed,
  markAllNotificationsSeen,
  markNotificationSeen,
  navigateToRecord,
} from "../services/dashboardApi";
import TreatmentPlanPopupModal from "./Dashboard/TreatmentPlanPopupModal";
import {
  getAlertStinkerCount,
  isStinkerAlert,
  showStinkerBrowserNotification,
  unwrapCrmRealtimePayload,
} from "../utils/stinker";
import DirectorTopAlert from "./DirectorMessages/DirectorTopAlert";
import { OPEN_SOS_ALERT_EVENT } from "../utils/sosPermissions";

const SOS_POLL_MS = 25000;

export default function Navbar({ onDashboardRefresh } = {}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { getuser, loading, error } = useSelector((state) => state.getuser);
  useEffect(() => {
    dispatch(GetUserData());
  }, [dispatch]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ---- Emergency SOS Alert (Socket.IO + dashboard APIs) -------------------
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [activeSosId, setActiveSosId] = useState(null);
  const [activeAlertPayload, setActiveAlertPayload] = useState(null);
  const [pendingSosAlerts, setPendingSosAlerts] = useState([]);
  const [escalation, setEscalation] = useState(null);
  const knownSosIdsRef = useRef(new Set());
  const acceptedByMeRef = useRef(new Set());
  const activeSosIdRef = useRef(null);
  const modalOpenRef = useRef(false);
  const handlersRef = useRef({});

  const hasUnreadSOS = pendingSosAlerts.length > 0;

  const isAcceptedStatus = useCallback((alertOrStatus) => {
    const status = String(
      typeof alertOrStatus === "string"
        ? alertOrStatus
        : alertOrStatus?.status || "",
    )
      .toLowerCase()
      .trim();
    if (!status) return false;
    // Do NOT use includes("accept") — it matches "unaccepted" / "not accepted"
    if (
      status === "accepted" ||
      status === "case accepted" ||
      status.startsWith("accepted ") ||
      status.includes("case accepted")
    ) {
      return true;
    }
    if (
      status === "closed" ||
      status === "cancelled" ||
      status === "canceled" ||
      status.startsWith("closed")
    ) {
      return true;
    }
    if (alertOrStatus && typeof alertOrStatus === "object") {
      if (alertOrStatus.acceptedAt || alertOrStatus.flags?.caseAccepted) {
        return true;
      }
    }
    return false;
  }, []);

  const userRole = (localStorage.getItem("Role") || "").toUpperCase();
  const isReferralUser = userRole === "REFERRAL" || userRole === "INSURANCE";

  // Unlock audio early + resume siren on next gesture if a silent/blocked alert is waiting
  useEffect(() => {
    if (isReferralUser) return undefined;
    unlockSosAudio();
    const unbind = bindSosAlarmGestureResume();
    return () => {
      unbind();
    };
  }, [isReferralUser]);

  const handleLogout = async () => {
    const token = localStorage.getItem("token");
    stopAllSosAlarms();
    disconnectSosSocket();
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      await axios.post(
        `${baseurl}logout`,
        { token: token || "" },
        { headers }
      );
    } catch (error) {
      console.log("Logout API error:", error?.response?.data || error?.message);
    } finally {
      console.log("Logout clicked");
      dispatch(logout());
      dispatch(clearUser());
      clearAuth();
      clearKnownUserId();
      navigate("/");
    }
  };

  // connectChatSocket reuses the SOS socket and binds chat + CRM presence listeners

  const openSosModal = useCallback((sosId, alert = null) => {
    if (!sosId) return;
    knownSosIdsRef.current.add(String(sosId));
    activeSosIdRef.current = sosId;
    setActiveSosId(sosId);
    setActiveAlertPayload(alert);
    setIsEmergencyModalOpen(true);
    modalOpenRef.current = true;
  }, []);

  useEffect(() => {
    modalOpenRef.current = isEmergencyModalOpen;
  }, [isEmergencyModalOpen]);

  useEffect(() => {
    activeSosIdRef.current = activeSosId;
  }, [activeSosId]);

  const handleIncomingSos = useCallback(
    (alert, { playSound = true, forceOpen = true } = {}) => {
      if (!alert) return;
      const id = getSosAlertId(alert);

      // Always ring for on-screen SOS — ignore backend playSound:false / silent flags
      const shouldRing =
        playSound !== false && id && !isAcceptedStatus(alert) && !isSosAlarmSilenced(id);

      if (isSosEscalation(alert) && !isSosNewAlert(alert)) {
        if (shouldRing) {
          startSosAlarm(id);
        }
        setEscalation({
          title: alert.title || "SOS Escalation",
          body: alert.body || "",
          level: alert.level || alert.escalationRole || "Supervisor",
          seconds: alert.seconds,
          sosId: id,
        });
        return;
      }

      if (!id) return;

      knownSosIdsRef.current.add(String(id));

      setPendingSosAlerts((prev) => {
        const exists = prev.some(
          (a) =>
            String(getSosAlertId(a)) === String(id) ||
            a.sosId === id ||
            a.emergencyCaseId === id,
        );
        if (exists) return prev;
        return [alert, ...prev];
      });

      if (shouldRing) {
        unlockSosAudio();
        startSosAlarm(id);
      } else if (isAcceptedStatus(alert)) {
        clearSosAlarm(id);
      }
      showSosBrowserNotification(alert);

      if (forceOpen || !modalOpenRef.current) {
        openSosModal(id, {
          type: "SOS_NEW_ALERT",
          title: alert.title || alert.alertTitle || "NEW SOS ALERT",
          body:
            alert.body ||
            `${alert.patientName || alert.patient?.name || "Patient"} — Emergency request received`,
          sosId: id,
          emergencyCaseId: alert.emergencyCaseId,
          patientName: alert.patientName || alert.patient?.name,
          status: alert.status,
          ...alert,
        });
      }
    },
    [openSosModal, isAcceptedStatus],
  );

  const handleOpenEmergencyModal = () => {
    const first = pendingSosAlerts[0];
    if (first) {
      openSosModal(getSosAlertId(first) || first.sosId, first);
      return;
    }
    if (activeSosId) {
      setIsEmergencyModalOpen(true);
      modalOpenRef.current = true;
    }
  };

  const handleCloseEmergencyModal = () => {
    setIsEmergencyModalOpen(false);
    modalOpenRef.current = false;
  };

  // Reopen SOS alert window from Emergency SOS listing (or elsewhere)
  useEffect(() => {
    const onOpenFromListing = (event) => {
      const { sosId, alert } = event?.detail || {};
      if (!sosId) return;
      openSosModal(sosId, alert || null);
    };
    window.addEventListener(OPEN_SOS_ALERT_EVENT, onOpenFromListing);
    return () => {
      window.removeEventListener(OPEN_SOS_ALERT_EVENT, onOpenFromListing);
    };
  }, [openSosModal]);

  const removePendingSos = useCallback((sosId) => {
    setPendingSosAlerts((prev) =>
      prev.filter(
        (a) =>
          String(getSosAlertId(a)) !== String(sosId) &&
          a.sosId !== sosId &&
          a.emergencyCaseId !== sosId,
      ),
    );
  }, []);

  /**
   * After another operator accepts (or server dismisses), remove the SOS card.
   * The operator who accepted keeps their modal open.
   */
  const dismissSosFromScreen = useCallback(
    (sosId, { forceCloseModal = false } = {}) => {
      if (!sosId) return;
      const id = String(sosId);
      removePendingSos(sosId);
      silenceSosAlarm(sosId);
      knownSosIdsRef.current.delete(id);
      setEscalation((prev) =>
        prev && String(prev.sosId) === id ? null : prev,
      );

      const acceptedByMe = acceptedByMeRef.current.has(id);
      const isActive = String(activeSosIdRef.current || "") === id;
      if (isActive && (forceCloseModal || !acceptedByMe)) {
        setIsEmergencyModalOpen(false);
        modalOpenRef.current = false;
        activeSosIdRef.current = null;
        setActiveSosId(null);
        setActiveAlertPayload(null);
      }
    },
    [removePendingSos],
  );

  const handleCaseAccepted = (sosId) => {
    const id = sosId || activeSosId;
    if (id) acceptedByMeRef.current.add(String(id));
    removePendingSos(id);
    silenceSosAlarm(id);
  };

  const handleCaseAcceptFailed = (sosId) => {
    const id = sosId || activeSosId;
    if (id) acceptedByMeRef.current.delete(String(id));
    unsilenceSosAlarm(id);
  };

  const handleCaseClosed = (sosId) => {
    const id = sosId || activeSosId;
    if (id) acceptedByMeRef.current.delete(String(id));
    removePendingSos(id);
    silenceSosAlarm(id);
    setIsEmergencyModalOpen(false);
    modalOpenRef.current = false;
    activeSosIdRef.current = null;
    setActiveSosId(null);
    setActiveAlertPayload(null);
  };

  const handleAccessDenied = useCallback(
    (sosId) => {
      const id = sosId || activeSosIdRef.current;
      if (!id) return;
      // Drop from pending / alarms but leave modal open so the 403 message is visible
      removePendingSos(id);
      silenceSosAlarm(id);
      knownSosIdsRef.current.delete(String(id));
      setEscalation((prev) =>
        prev && String(prev.sosId) === String(id) ? null : prev,
      );
    },
    [removePendingSos],
  );

  handlersRef.current = {
    handleIncomingSos,
    openSosModal,
    startSosAlarm,
    clearSosAlarm,
    isAcceptedStatus,
    dismissSosFromScreen,
    playSosSound: (sosId) => startSosAlarm(sosId),
  };

  // Live Socket.IO + polling fallback
  useEffect(() => {
    if (isReferralUser) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    requestSosNotificationPermission();
    connectSosSocket(token);
    connectChatSocket(token);

    let initialLoadDone = false;

    const firstLoad = async () => {
      try {
        // API returns unaccepted only, already filtered by JWT role
        const alerts = await fetchSosDashboardAlerts();
        if (Array.isArray(alerts) && alerts.length) {
          const pending = alerts.filter(
            (a) => !handlersRef.current.isAcceptedStatus?.(a),
          );
          setPendingSosAlerts(pending);
          pending.forEach((a) => {
            const id = getSosAlertId(a);
            if (id) knownSosIdsRef.current.add(String(id));
          });
          if (pending[0]) {
            handlersRef.current.handleIncomingSos(pending[0], {
              playSound: true,
              forceOpen: true,
            });
          }
        }
      } catch (err) {
        console.warn("Failed to load SOS dashboard alerts:", err);
      } finally {
        initialLoadDone = true;
      }
    };
    firstLoad();

    const unsubscribe = onSosWebAlert((alert) => {
      if (!alert) return;

      // Also handled via onSosAlertDismissed; keep as safety net
      if (isSosAlertDismissed(alert) || alert.type === "SOS_ALERT_DISMISSED") {
        const id = getSosAlertId(alert);
        if (alert.removeFromScreen !== false) {
          handlersRef.current.dismissSosFromScreen?.(id);
        }
        return;
      }

      if (isSosEscalation(alert)) {
        const id = getSosAlertId(alert);
        // Always ring for escalation alerts too (even if playSound:false / silent)
        if (id && !isSosAlarmSilenced(id)) startSosAlarm(id);
        showSosBrowserNotification(alert);
        setEscalation({
          title: alert.title || "SOS Escalation",
          body: alert.body || "",
          level: alert.level || alert.escalationRole || "Supervisor",
          seconds: alert.seconds,
          sosId: id,
        });
        if (id) {
          handlersRef.current.handleIncomingSos(
            { ...alert, type: "SOS_NEW_ALERT", playSound: true },
            { playSound: true, forceOpen: !modalOpenRef.current },
          );
        }
        return;
      }

      // Always play CRM siren when alert appears — ignore silent / playSound:false
      handlersRef.current.handleIncomingSos(
        { ...alert, playSound: true },
        {
          playSound: true,
          forceOpen: true,
        },
      );
    });

    const unsubscribeDismiss = onSosAlertDismissed((payload) => {
      if (!payload) return;
      const id = getSosAlertId(payload) || payload.sosId;
      // remove SOS card when payload.removeFromScreen === true (default true)
      if (payload.removeFromScreen === false) return;
      handlersRef.current.dismissSosFromScreen?.(id);
    });

    let rateLimitBackoffUntil = 0;

    // Connect persistent real-time sockets once on mount
    const liveToken = localStorage.getItem("token");
    if (liveToken) {
      connectSosSocket(liveToken);
      connectChatSocket(liveToken);
    }

    const pollId = setInterval(async () => {
      if (!initialLoadDone) return;
      if (Date.now() < rateLimitBackoffUntil) return;
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const alerts = await fetchSosDashboardAlerts();
        if (!Array.isArray(alerts)) return;

        // Dashboard alerts = unaccepted only, role-filtered
        const pending = alerts.filter(
          (a) => !handlersRef.current.isAcceptedStatus?.(a),
        );
        setPendingSosAlerts(pending);

        const pendingIds = new Set(
          pending.map((a) => String(getSosAlertId(a) || "")).filter(Boolean),
        );

        // If an open unaccepted case disappeared (accepted elsewhere), remove it
        const openId = activeSosIdRef.current;
        if (
          openId &&
          !acceptedByMeRef.current.has(String(openId)) &&
          !pendingIds.has(String(openId))
        ) {
          handlersRef.current.dismissSosFromScreen?.(openId);
        }

        for (const alert of pending) {
          const id = getSosAlertId(alert);
          if (!id) continue;
          if (
            acceptedByMeRef.current.has(String(id)) ||
            isSosAlarmSilenced(id)
          ) {
            continue;
          }

          if (!knownSosIdsRef.current.has(String(id))) {
            handlersRef.current.handleIncomingSos(alert, {
              playSound: true,
              forceOpen: true,
            });
          } else if (!isSosAlarmRinging(id)) {
            startSosAlarm(id);
          }
        }
      } catch (err) {
        if (err?.response?.status === 429) {
          rateLimitBackoffUntil = Date.now() + 60000;
          console.warn("SOS poll rate-limited (429), pausing for 60 seconds.");
        } else {
          console.warn("SOS poll failed:", err);
        }
      }
    }, SOS_POLL_MS);

    return () => {
      unsubscribe();
      unsubscribeDismiss();
      clearInterval(pollId);
    };
  }, []);

  // ---- Popup alerts (GET /crm/alerts/popup) ----------------------------
  const [popupAlerts, setPopupAlerts] = useState([]);
  const [activePopup, setActivePopup] = useState(null);

  const loadPopupAlerts = useCallback(async () => {
    try {
      const alerts = await fetchPopupAlerts();
      const list = (Array.isArray(alerts) ? alerts : []).filter(
        (item) =>
          item != null && getPopupAlertId(item) && !isPopupDismissed(item),
      );
      setPopupAlerts(list);
      setActivePopup((current) => {
        if (!list.length) return null;
        const currentId = getPopupAlertId(current);
        if (currentId && list.some((item) => getPopupAlertId(item) === currentId)) {
          return current;
        }
        return list[0];
      });
    } catch (err) {
      console.warn("Failed to load popup alerts:", err);
    }
  }, []);

  const handlePopupDismiss = useCallback((id) => {
    setPopupAlerts((prev) => {
      const remaining = prev.filter((popup) => getPopupAlertId(popup) !== id);
      setActivePopup(remaining[0] || null);
      return remaining;
    });
  }, []);

  const handlePopupDismissAll = useCallback((alerts = []) => {
    const dismissedIds = new Set(
      alerts.map(getPopupAlertId).filter(Boolean),
    );
    setPopupAlerts((prev) => {
      const remaining = prev.filter(
        (popup) => !dismissedIds.has(getPopupAlertId(popup)),
      );
      setActivePopup(remaining[0] || null);
      return remaining;
    });
  }, []);

  // ---- Notification Center (GET /crm/notifications) ---------------------
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const realtimeNotifIdsRef = useRef(new Set());
  const notificationsRef = useRef([]);
  notificationsRef.current = notifications;

  const loadNotifications = useCallback(async () => {
    try {
      const result = await fetchNotifications({ page: 1, limit: 10, unseenOnly: false });
      setNotifications(result.notifications || []);
      setUnreadNotifCount(result.unseenCount ?? 0);
    } catch (err) {
      console.warn("Failed to load notifications:", err);
    }
  }, []);

  useEffect(() => {
    if (!isReferralUser) {
      Promise.allSettled([loadPopupAlerts(), loadNotifications()]);
    }
  }, [loadPopupAlerts, loadNotifications, isReferralUser]);

  useEffect(() => {
    if (isReferralUser) return undefined;

    const unsubscribeNotification = onCrmNotification((payload) => {
      const notification = unwrapCrmRealtimePayload(payload);
      if (!notification) return;
      const id = getNotificationId(notification);
      if (id && realtimeNotifIdsRef.current.has(id)) return;
      const alreadyListed =
        id &&
        notificationsRef.current.some((item) => getNotificationId(item) === id);
      if (id) realtimeNotifIdsRef.current.add(id);
      if (alreadyListed) return;
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.seen) {
        setUnreadNotifCount((count) => count + 1);
      }
      if (isStinkerAlert(notification)) {
        showStinkerBrowserNotification(notification);
      }
    });

    const unsubscribePopup = onCrmPopupAlert((payload) => {
      const alert = unwrapCrmRealtimePayload(payload);
      const id = getPopupAlertId(alert);
      if (!alert || !id || isPopupDismissed(alert)) return;
      setPopupAlerts((prev) => {
        if (prev.some((item) => getPopupAlertId(item) === id)) return prev;
        return [alert, ...prev];
      });
      setActivePopup(alert);
    });

    return () => {
      unsubscribeNotification();
      unsubscribePopup();
    };
  }, [isReferralUser]);

  const markNotificationRead = async (id) => {
    if (!id) return false;
    try {
      await markNotificationSeen(id);
      setNotifications((prev) =>
        prev.map((n) =>
          getNotificationId(n) === String(id) ? { ...n, seen: true } : n,
        ),
      );
      setUnreadNotifCount((c) => Math.max(0, c - 1));
      return true;
    } catch (err) {
      console.warn("Failed to mark notification seen:", err);
      return false;
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await markAllNotificationsSeen();
      setNotifications((prev) => prev.map((n) => ({ ...n, seen: true })));
      setUnreadNotifCount(0);
    } catch (err) {
      console.warn("Failed to mark all notifications seen:", err);
    }
  };

  const handleNotificationClick = async (n) => {
    const id = getNotificationId(n);
    if (!n.seen && id) await markNotificationRead(id);
    navigateToRecord(navigate, {
      patientRecordUrl: n.patientRecordUrl || n.metadata?.patientRecordUrl,
      patientId: n.patientId,
    });
    setNotifOpen(false);
  };

  const formatNotifTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return date.toLocaleDateString();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (!isReferralUser) {
        const alerts = await fetchSosDashboardAlerts();
        if (Array.isArray(alerts)) {
          setPendingSosAlerts(
            alerts.filter((a) => !isAcceptedStatus(a)),
          );
        }
      }
      if (typeof onDashboardRefresh === "function") {
        await onDashboardRefresh();
      }
      if (!isReferralUser) {
        await loadNotifications();
        await loadPopupAlerts();
      }
    } catch (err) {
      console.warn("Failed to refresh:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleNavToggle = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    const isMobile = window.innerWidth < 992;
    const target = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const wrapper = document.querySelector('.main-wrapper') || document.body;

    if (isMobile) {
      const isOpened = target && (target.classList.contains('opened') || (wrapper && wrapper.classList.contains('slide-nav')));
      if (isOpened) {
        if (target) target.classList.remove('opened');
        if (overlay) overlay.classList.remove('opened');
        document.documentElement.classList.remove('menu-opened');
        if (wrapper) wrapper.classList.remove('slide-nav');
      } else {
        if (target) target.classList.add('opened');
        if (overlay) overlay.classList.add('opened');
        document.documentElement.classList.add('menu-opened');
        if (wrapper) wrapper.classList.add('slide-nav');
      }
    } else {
      document.body.classList.toggle('mini-sidebar');
      if (wrapper) wrapper.classList.toggle('mini-sidebar');
    }
  };

  return (
    <div className="header msd-scope">
      <div className="header-left">
        <Link to="/Dashboard" className="logo">
          <img src={logo} height="40" alt="" />
        </Link>
        <Link to="/Dashboard" className="logo-small">
          <img src={logodark} height="35" width="35" alt="" />
        </Link>
      </div>
      <a
        id="toggle_btn"
        href="#toggle"
        role="button"
        onClick={(e) => {
          e.preventDefault();
          handleNavToggle();
        }}
      >
        <i className="fa fa-bars"></i>
      </a>
      <a id="mobile_btn" className="mobile_btn float-left" href="#sidebar" onClick={handleNavToggle}>
        <i className="fa fa-bars"></i>
      </a>
      <div className="d-flex justify-content-end">
        <div className="d-flex align-items-center gap-3">
          {!isReferralUser && (
            <button
              type="button"
              className={`alert-modal-icon ${hasUnreadSOS ? "ems-icon-unread" : ""}`}
              onClick={handleOpenEmergencyModal}
              aria-label="Open emergency SOS alert"
              disabled={!hasUnreadSOS && !activeSosId}
              title={
                hasUnreadSOS
                  ? `${pendingSosAlerts.length} pending SOS alert(s)`
                  : "No pending SOS alerts"
              }
            >
              <i className="fa-solid fa-bolt"></i>
              {hasUnreadSOS && (
                <span className="emergency-notification-badge">
                  {pendingSosAlerts.length}
                </span>
              )}
            </button>
          )}

          <button
            className="msd-refresh-btn"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
          >
            <i
              className={`fa fa-refresh ${isRefreshing ? "msd-spin" : ""}`}
            ></i>
          </button>

          {!isReferralUser && (
            <div className="msd-notif-wrapper">
              <button
                className="msd-notif-bell"
                onClick={() => setNotifOpen((prev) => !prev)}
                title="Notifications"
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={notifOpen}
              >
                <i className="fa fa-bell"></i>
                {unreadNotifCount > 0 && (
                  <span className="msd-notif-badge">{unreadNotifCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="msd-notif-panel" role="menu">
                  <div className="msd-notif-panel-head">
                    <h6>Notifications</h6>
                    <button
                      className="msd-link-btn"
                      onClick={markAllNotificationsRead}
                    >
                      Mark all as read
                    </button>
                  </div>
                <div className="msd-notif-list">
                  {notifications.map((n) => {
                    const id = getNotificationId(n);
                    const unread = !n.seen;
                    const stinker = isStinkerAlert(n);
                    const stinkerCount = stinker ? getAlertStinkerCount(n) : 0;
                    return (
                    <div
                      key={id}
                      className={`msd-notif-item ${unread ? "msd-notif-unread" : ""} ${stinker ? "msd-notif-stinker" : ""}`}
                    >
                      <div className={`msd-notif-icon ${stinker ? "msd-notif-icon-stinker" : ""}`}>
                        <i className="fa fa-bell"></i>
                      </div>
                      <div className="msd-notif-body">
                        <p className="msd-notif-title">
                          {stinkerCount > 0 && (
                            <span className="msd-stinker-count">#{stinkerCount}</span>
                          )}
                          {n.heading || n.title}
                        </p>
                        <p className="msd-notif-meta">
                          {n.message} · {formatNotifTime(n.createdAt)}
                        </p>
                        <button
                          type="button"
                          className="msd-link-btn"
                          onClick={() => handleNotificationClick(n)}
                        >
                          View Case
                        </button>
                      </div>
                      {unread && (
                        <button
                          type="button"
                          className="msd-notif-ack"
                          onClick={() => markNotificationRead(id)}
                          title="Mark as read"
                          aria-label={`Mark as read: ${n.heading || n.title}`}
                        >
                          <i className="fa fa-check"></i>
                        </button>
                      )}
                    </div>
                  );
                  })}
                  {!notifications.length && (
                    <div className="msd-aging-empty p-3">No notifications.</div>
                  )}
                </div>
                <div className="msd-notif-panel-foot">
                  <button
                    className="msd-link-btn"
                    onClick={() => {
                      setNotifOpen(false);
                      // TODO: navigate to a full notifications page once it exists
                    }}
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
        <ul className="nav user-menu float-right">
          <li className="nav-item dropdown has-arrow">
            <a
              href="#"
              className="dropdown-toggle nav-link user-link"
              data-toggle="dropdown"
            >
              <span className="user-img">
                <img
                  className="rounded-circle"
                  src={
                    getuser?.profileImage
                      ? `${image}${getuser.profileImage}`
                      : user
                  }
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = user;
                  }}
                  width="32"
                  height="32"
                  alt=""
                  style={{
                    width: "32px",
                    height: "32px",
                    minWidth: "32px",
                    minHeight: "32px",
                    maxWidth: "32px",
                    maxHeight: "32px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    aspectRatio: "1 / 1",
                    display: "inline-block",
                  }}
                />
                <span className="status online"></span>
              </span>
              <span
                className="user-name-text"
                title={getuser?.name || localStorage.getItem("name") || "Admin"}
                style={{
                  maxWidth: "140px",
                  display: "inline-block",
                  verticalAlign: "middle",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getuser?.name || localStorage.getItem("name") || "Admin"}
              </span>
            </a>
            <div className="dropdown-menu">
              <Link className="dropdown-item" to="/Admin/profile">
                My Profile
              </Link>
              <Link className="dropdown-item" to="/Admin/chnage-password">
                Change Password
              </Link>
              {localStorage.getItem("Role") === "Admin" ? (
                <Link className="dropdown-item" to="/Admin/Activity-tracker">
                  Activity Tracker
                </Link>
              ) : (
                ""
              )}
              {/* <Link className="dropdown-item" to="/Admin/settings">Settings</Link> */}
              <button className="dropdown-item" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </li>
        </ul>
      </div>
      <div className="dropdown mobile-user-menu float-right">
        <a
          href="#"
          className="dropdown-toggle"
          data-toggle="dropdown"
          aria-expanded="false"
        >
          <i className="fa fa-ellipsis-v"></i>
        </a>
        <div className="dropdown-menu dropdown-menu-right">
          <Link className="dropdown-item" to="/Admin/profile">
            My Profile
          </Link>
          <Link className="dropdown-item" to="/Admin/chnage-password">
            change password
          </Link>
          {/* <Link className="dropdown-item" to="/Settings">Settings</Link> */}
          <button className="dropdown-item" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {!isReferralUser && escalation && (
        <div className="ems-escalation-banner" role="alert">
          <div className="ems-escalation-banner-inner">
            <div className="ems-escalation-banner-text">
              <strong>
                {escalation.level}: {escalation.title}
              </strong>
              <span>{escalation.body}</span>
              {escalation.seconds != null && (
                <span className="ems-escalation-meta">
                  Unaccepted for {escalation.seconds}s
                </span>
              )}
            </div>
            <div className="ems-escalation-banner-actions">
              {escalation.sosId && (
                <button
                  type="button"
                  className="ems-btn ems-btn-secondary"
                  onClick={() => {
                    openSosModal(escalation.sosId, {
                      type: "SOS_NEW_ALERT",
                      sosId: escalation.sosId,
                      title: "NEW SOS ALERT",
                    });
                    setEscalation(null);
                  }}
                >
                  Open Case
                </button>
              )}
              <button
                type="button"
                className="ems-btn ems-btn-ghost"
                onClick={() => setEscalation(null)}
                aria-label="Dismiss escalation"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {!isReferralUser && (
        <EmergencyAlertModal
          key={activeSosId || "sos-closed"}
          isOpen={isEmergencyModalOpen}
          sosId={activeSosId}
          alertPayload={activeAlertPayload}
          onClose={handleCloseEmergencyModal}
          onCaseAccepted={handleCaseAccepted}
          onCaseAcceptFailed={handleCaseAcceptFailed}
          onCaseClosed={handleCaseClosed}
          onAccessDenied={handleAccessDenied}
        />
      )}

      {!isReferralUser && activePopup && (
        <TreatmentPlanPopupModal
          alert={activePopup}
          pendingAlerts={popupAlerts}
          currentIndex={
            Math.max(
              0,
              popupAlerts.findIndex(
                (popup) => getPopupAlertId(popup) === getPopupAlertId(activePopup),
              ),
            ) + 1
          }
          navigate={navigate}
          onDismiss={handlePopupDismiss}
          onDismissAll={handlePopupDismissAll}
        />
      )}

      {!isReferralUser && <DirectorTopAlert />}
    </div>
  );
}
