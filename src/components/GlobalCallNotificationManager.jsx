import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { getToken, getUserId } from "../utils/authStorage";
import { playRingtone, playMessageChime, stopAudio } from "../utils/callAudio";
import { connectChatSocket, onChatMessage } from "../services/chatSocket";
import {
  bindCallEventListeners,
  onCallIncoming,
  onCallRinging,
  onCallAccepted,
  onCallRejected,
  onCallCancelled,
  onCallEnded,
  onCallMissed,
  onCallBusy,
  onCallError,
  acceptCall,
  rejectCall,
  cancelCall,
} from "../services/callSocket";
import {
  initDesktopNotifications,
  requestDesktopNotificationPermission,
  showDesktopNotification,
  testDesktopNotification,
  getNotificationPermission,
} from "../utils/desktopNotification";
import {
  getGlobalActiveCall,
  setGlobalActiveCall,
  getGlobalOutgoingCall,
  setGlobalOutgoingCall,
  getViewingChatId,
  subscribeGlobalCallState,
  requestOpenChat,
} from "../services/callState";
import TeamsIncomingCallToast from "./TeamsIncomingCallToast";
import TeamsMessageToast from "./TeamsMessageToast";
import ActiveCallModal from "../pages/Messages/components/ActiveCallModal";
import OutgoingCallModal from "../pages/Messages/components/OutgoingCallModal";

const GlobalCallNotificationManager = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [incomingCall, setIncomingCall] = useState(null);
  const [messageToast, setMessageToast] = useState(null);
  const [activeCall, setActiveCall] = useState(getGlobalActiveCall);
  const [outgoingCall, setOutgoingCall] = useState(getGlobalOutgoingCall);
  const [notifPermission, setNotifPermission] = useState(() => {
    return typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "denied";
  });
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "OMCA CRM");
  const locationRef = useRef(location);
  locationRef.current = location;

  const incomingCallRef = useRef(incomingCall);
  incomingCallRef.current = incomingCall;

  const outgoingCallRef = useRef(outgoingCall);
  outgoingCallRef.current = outgoingCall;

  // Handlers for Opening Chat from Notifications (Message Toast or Incoming Call Toast)
  const handleOpenChat = useCallback(
    (params) => {
      const chatId = typeof params === "string" ? params : params?.chatId;
      const userId = typeof params === "object" ? params?.userId : null;
      const name = typeof params === "object" ? params?.name : null;
      const role = typeof params === "object" ? params?.role : null;

      setMessageToast(null);

      // 1. Try to switch chat instantly if Messages.js is already mounted
      const handled = requestOpenChat({ chatId, userId, name, role });

      // 2. Navigate to /Admin/messages if on another page or if unhandled
      if (!location.pathname.toLowerCase().includes("messages") || !handled) {
        navigate("/Admin/messages", {
          state: { chatId, openChatId: chatId, userId, name, role },
        });
      }
    },
    [location.pathname, navigate]
  );

  const handleOpenChatRef = useRef(handleOpenChat);
  handleOpenChatRef.current = handleOpenChat;

  // Init Service Worker & listen to notification clicks from Windows Action Center
  useEffect(() => {
    initDesktopNotifications();
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const onSwMsg = (event) => {
        if (event?.data?.type === "OMCA_NOTIFICATION_CLICK") {
          const payload = event.data.payload || {};
          handleOpenChat(payload);
        }
      };
      navigator.serviceWorker.addEventListener("message", onSwMsg);
      return () => {
        navigator.serviceWorker.removeEventListener("message", onSwMsg);
      };
    }
  }, [handleOpenChat]);

  // 1. Subscribe to shared call state (Active & Outgoing Calls)
  useEffect(() => {
    const unsub = subscribeGlobalCallState((state) => {
      setActiveCall(state.activeCall);
      setOutgoingCall(state.outgoingCall);
    });
    return unsub;
  }, []);

  // 2. Sync notification permission state
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, [location.pathname]);

  // Request notification permission via user click (satisfies Chrome gesture requirement)
  const handleRequestPermission = async () => {
    try {
      const res = await requestDesktopNotificationPermission();
      setNotifPermission(res);
      if (res === "granted") {
        toast.success("Desktop notifications enabled! Testing desktop notification now...");
        await testDesktopNotification();
      } else if (res === "denied") {
        toast.warn(
          "Notification permission was blocked in Chrome. Please click the lock icon 🔒 in the address bar to allow notifications."
        );
      }
    } catch (err) {
      console.warn("requestPermission error:", err);
    }
  };

  // 3. Flashing browser tab title during incoming call
  useEffect(() => {
    let timer = null;
    if (incomingCall) {
      let toggle = false;
      const callerName = incomingCall.isGroup
        ? incomingCall.groupName || "Group Call"
        : incomingCall.caller?.name || "Caller";
      timer = setInterval(() => {
        document.title = toggle
          ? `📞 (1) Incoming Call: ${callerName}...`
          : `🔔 OMCA CRM is Ringing...`;
        toggle = !toggle;
      }, 1000);
    } else {
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    }
    return () => {
      if (timer) clearInterval(timer);
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [incomingCall]);

  // 3. Connect Socket and Bind Call & Message Listeners across entire CRM
  useEffect(() => {
    const token = getToken();
    const crmUserId = getUserId();
    if (!token || !crmUserId) return;

    // Connect Chat / Call socket globally
    const sock = connectChatSocket(token);
    bindCallEventListeners(sock);

    // Incoming Call Listener
    const unsubIncoming = onCallIncoming((payload) => {
      setIncomingCall(payload);
      playRingtone();

      // Trigger Native Desktop Notification via Service Worker (Works even when Chrome is completely minimized)
      const callerName = payload.isGroup
        ? payload.groupName || "Group Call"
        : payload.caller?.name || "Incoming Call";
      const callType = payload.callType === "video" ? "Video" : "Audio";
      const callerUserId = payload.caller?.userId || payload.caller?._id || payload.caller?.id;

      showDesktopNotification({
        title: `📞 Incoming Call - OMCA CRM`,
        body: `${callerName} is calling you (${callType} Call)`,
        icon: payload.caller?.profileImage || "/assets/img/omca_stamp.png",
        tag: `call-${payload.callId}`,
        requireInteraction: true,
        data: {
          chatId: payload.chatId,
          userId: callerUserId,
          name: callerName,
          role: payload.caller?.role,
          url: "/Admin/messages",
        },
        onClick: () => {
          handleOpenChat({
            chatId: payload.chatId,
            userId: callerUserId,
            name: callerName,
            role: payload.caller?.role,
          });
        },
      });
    });

    // Outgoing Call Ringing Listener
    const unsubRinging = onCallRinging((payload) => {
      if (payload.isGroup && payload.token) {
        setGlobalActiveCall({
          callId: payload.callId,
          roomName: payload.roomName,
          token: payload.token,
          callType: payload.callType || "video",
          isGroup: true,
          groupName: payload.groupName,
          isHost: true,
          chatId: payload.chatId || outgoingCallRef.current?.chatId,
          members:
            payload.members ||
            payload.participants ||
            payload.groupMembers ||
            outgoingCallRef.current?.members,
        });
        setGlobalOutgoingCall(null);
      } else {
        setGlobalOutgoingCall((prev) =>
          prev
            ? {
                ...prev,
                callId: payload.callId,
                statusText: "Ringing...",
              }
            : null
        );
      }
    });

    // Call Accepted Listener
    const unsubAccepted = onCallAccepted((payload) => {
      stopAudio();
      setIncomingCall(null);
      setGlobalOutgoingCall(null);
      setGlobalActiveCall({
        callId: payload.callId,
        roomName: payload.roomName,
        token: payload.token,
        callType: payload.callType || "video",
        isGroup: !!payload.isGroup,
        groupName: payload.groupName,
        otherUser: payload.otherUser,
        isHost: false,
        chatId: payload.chatId || incomingCallRef.current?.chatId,
        members:
          payload.members ||
          payload.participants ||
          payload.groupMembers ||
          incomingCallRef.current?.members,
      });
    });

    // Call Rejected
    const unsubRejected = onCallRejected((payload) => {
      stopAudio();
      setIncomingCall(null);
      setGlobalOutgoingCall(null);
      const msg = payload?.message || "Call was declined.";
      const toastId = `call-rejected-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.info(msg, { toastId, autoClose: 3500 });
      }
    });

    // Call Cancelled
    const unsubCancelled = onCallCancelled((payload) => {
      stopAudio();
      setIncomingCall(null);
      const toastId = `call-cancelled-${payload?.callId || "cancelled"}`;
      if (!toast.isActive(toastId)) {
        toast.info(payload?.message || "Call was cancelled.", { toastId, autoClose: 3500 });
      }
    });

    // Call Ended
    const unsubEnded = onCallEnded((payload) => {
      stopAudio();
      setIncomingCall(null);
      setGlobalOutgoingCall(null);
      setGlobalActiveCall(null);
      const msg = payload?.message || "Call ended";
      const toastId = `call-ended-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.info(msg, { toastId, autoClose: 3500 });
      }
    });

    // Call Busy
    const unsubBusy = onCallBusy((payload) => {
      stopAudio();
      setIncomingCall(null);
      setGlobalOutgoingCall(null);
      const msg = payload?.message || "User is currently in another call.";
      const toastId = `call-busy-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.warn(msg, { toastId, autoClose: 3500 });
      }
    });

    // Call Missed
    const unsubMissed = onCallMissed((payload) => {
      stopAudio();
      setIncomingCall(null);
      setGlobalOutgoingCall(null);
      const msg = payload?.message || "Missed call.";
      const toastId = `call-missed-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.info(msg, { toastId, autoClose: 3500 });
      }
    });

    // Call Error
    const unsubError = onCallError((payload) => {
      stopAudio();
      setIncomingCall(null);
      setGlobalOutgoingCall(null);
    });

    // 4. Chat Message Listener for Teams-style Notification
    const unsubChatMessage = onChatMessage((raw) => {
      if (!raw) return;
      const msg = raw.message && typeof raw.message === "object" ? raw.message : raw;
      const senderId = String(
        msg.senderUserId ??
        msg.senderId ??
        msg.fromUserId ??
        msg.sender?._id ??
        msg.sender?.id ??
        ""
      );

      // Don't notify if the message was sent by the current logged-in user
      const isMine =
        senderId === String(crmUserId) ||
        msg.isMine === true ||
        msg.senderRole === "crm" ||
        msg.sender === "crm";

      if (isMine) return;

      const chatId = raw.chatId || msg.chatId;
      const text = String(msg.message ?? msg.text ?? "").trim();
      const hasAttachment = !!(msg.attachment || msg.attachmentUrl || msg.file || msg.image);
      const displayText = text || (hasAttachment ? "📎 Sent an attachment" : "Sent a message");
      const senderName = msg.senderName || msg.sender?.name || msg.sender?.patient_name || "New Message";
      const senderImage = msg.sender?.profileImage || msg.sender?.image || null;

      // Skip toast if user is currently looking at this conversation inside Messages tab
      const currentPath = locationRef.current?.pathname || "";
      const isViewingThisChat =
        getViewingChatId() === chatId &&
        currentPath.toLowerCase().includes("messages") &&
        !document.hidden;

      if (!isViewingThisChat) {
        // Play pleasant Teams chime
        playMessageChime();

        const senderRole = msg.senderRole || msg.sender?.role || "";

        // Show Teams-style toast
        setMessageToast({
          id: Date.now(),
          senderName,
          senderImage,
          senderId,
          senderRole,
          messageText: displayText,
          chatId,
        });

        // Native OS Desktop Notification (Works even when Chrome is minimized or in another tab)
        showDesktopNotification({
          title: `💬 New message from ${senderName}`,
          body: displayText,
          icon: senderImage || "/assets/img/omca_stamp.png",
          tag: `msg-${chatId}`,
          requireInteraction: false,
          data: {
            chatId,
            userId: senderId,
            name: senderName,
            role: senderRole,
            url: "/Admin/messages",
          },
          onClick: () => {
            handleOpenChat({
              chatId,
              userId: senderId,
              name: senderName,
              role: senderRole,
            });
          },
        });
      }
    });

    return () => {
      unsubIncoming();
      unsubRinging();
      unsubAccepted();
      unsubRejected();
      unsubCancelled();
      unsubEnded();
      unsubBusy();
      unsubMissed();
      unsubError();
      unsubChatMessage();
    };
  }, [navigate]);



  // Handlers for Incoming Call Toast
  const handleAcceptCall = useCallback(
    (callId, preferredType = "video") => {
      stopAudio();
      acceptCall(callId);
      if (incomingCallRef.current) {
        const inc = incomingCallRef.current;
        const callerName = inc.isGroup ? inc.groupName || "Group Call" : inc.caller?.name || "Caller";
        const callerId = inc.caller?.userId || inc.caller?._id || inc.caller?.id;
        handleOpenChat({
          chatId: inc.chatId,
          userId: callerId,
          name: callerName,
          role: inc.caller?.role || "",
        });
      }
      setIncomingCall(null);
    },
    [handleOpenChat]
  );

  const handleDeclineCall = useCallback((callId) => {
    stopAudio();
    rejectCall(callId, "declined");
    setIncomingCall(null);
  }, []);

  const handleCloseMessageToast = useCallback(() => {
    setMessageToast(null);
  }, []);

  // Handlers for Active Call Modal
  const handleCloseActiveCall = useCallback(() => {
    setGlobalActiveCall(null);
  }, []);

  // Handlers for Outgoing Call Modal
  const handleCancelOutgoing = useCallback((callId) => {
    cancelCall(callId);
    setGlobalOutgoingCall(null);
  }, []);

  return (
    <>
      {/* 0. Prompt Banner for Desktop Notifications (allows user to click "Allow" in Chrome) */}
      {notifPermission === "default" && !dismissedBanner && getToken() && (
        <div className="omca-desktop-notif-prompt-banner">
          <div className="d-flex align-items-center gap-2">
            <i className="fa fa-bell text-warning fa-lg" />
            <span>
              <strong>Desktop Notifications:</strong> Allow notifications so you receive calls and messages on your Windows desktop even when minimized or in other tabs.
            </span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary fw-bold px-3 py-1 text-white"
              onClick={handleRequestPermission}
            >
              <i className="fa fa-check me-1" /> Allow Notifications
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-light px-2 py-1"
              onClick={() => setDismissedBanner(true)}
              title="Dismiss for now"
            >
              <i className="fa fa-times" />
            </button>
          </div>
        </div>
      )}

      {/* Warning when notifications are blocked by browser settings */}
      {notifPermission === "denied" && !dismissedBanner && getToken() && (
        <div className="omca-desktop-notif-prompt-banner omca-notif-blocked">
          <div className="d-flex align-items-center gap-2">
            <i className="fa fa-exclamation-triangle text-warning fa-lg" />
            <span>
              <strong>Desktop Notifications Blocked:</strong> Click the <strong>Lock icon 🔒</strong> in your browser address bar (next to <code>localhost:3000</code>) &rarr; set <strong>Notifications</strong> to <strong>Allow</strong> &rarr; refresh the page to receive calls & messages when minimized.
            </span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-light px-2 py-1"
              onClick={() => setDismissedBanner(true)}
              title="Dismiss"
            >
              <i className="fa fa-times" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Teams-Style Incoming Call Banner (shown anywhere when logged in) */}
      {incomingCall && (
        <TeamsIncomingCallToast
          incomingCall={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          onOpenChat={handleOpenChat}
        />
      )}

      {/* 2. Teams-Style New Message Toast (auto-dismissing) */}
      {messageToast && !incomingCall && (
        <TeamsMessageToast
          notification={messageToast}
          onOpenChat={handleOpenChat}
          onClose={handleCloseMessageToast}
        />
      )}

      {/* 3. Outgoing Call Window */}
      {outgoingCall && !activeCall && (
        <OutgoingCallModal
          outgoingCall={outgoingCall}
          onCancel={handleCancelOutgoing}
        />
      )}

      {/* 4. Global Active Call Window (persists across navigation & supports minimizing) */}
      {activeCall && (
        <ActiveCallModal
          callData={activeCall}
          currentUserName={localStorage.getItem("name") || "CRM Staff"}
          currentUserRole={localStorage.getItem("Role") || "Staff"}
          currentUserImage={null}
          onClose={handleCloseActiveCall}
        />
      )}
    </>
  );
};

export default GlobalCallNotificationManager;
