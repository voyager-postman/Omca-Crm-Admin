import React from "react";
import { resolveCrmImageUrl } from "../Basurl/Baseurl";
import "./TeamsNotification.css";

const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const TeamsIncomingCallToast = ({ incomingCall, onAccept, onDecline, onOpenChat }) => {
  if (!incomingCall) return null;

  const { callId, caller, callType, isGroup, groupName, chatId } = incomingCall;
  const callerName = isGroup ? groupName || "Group Call" : caller?.name || "Caller";
  const callerId = caller?.userId || caller?._id || caller?.id;
  const callerImage = resolveCrmImageUrl(caller?.profileImage || caller?.image);
  const initials = getInitials(callerName);
  const isVideo = callType === "video";

  const handleChatClick = (e) => {
    e.stopPropagation();
    if (typeof onOpenChat === "function") {
      onOpenChat({
        chatId: chatId || incomingCall.chatId,
        userId: callerId,
        name: callerName,
        role: caller?.role || "",
      });
    }
  };

  return (
    <div className="teams-notif-card" role="dialog" aria-label="Incoming Call Notification">
      {/* Teams Top Header */}
      <div className="teams-notif-header">
        <div className="teams-notif-app-badge">
          <div className="teams-notif-app-icon">
            <i className="fa fa-users" />
          </div>
          <span>OMCA CRM Calls</span>
        </div>
        <button
          type="button"
          className="teams-notif-close-btn"
          onClick={() => onDecline(callId)}
          title="Dismiss / Decline"
        >
          <i className="fa fa-times" />
        </button>
      </div>

      {/* Middle Content: Avatar + Name + Calling Status */}
      <div
        className="teams-notif-call-body"
        onClick={handleChatClick}
        title="Click to view conversation"
        style={{ cursor: "pointer" }}
      >
        <div className="teams-notif-avatar-wrapper">
          <div className="teams-notif-pulse-ring" />
          <div className="teams-notif-pulse-ring ring-2" />
          {callerImage ? (
            <img src={callerImage} alt={callerName} className="teams-notif-avatar-img" />
          ) : (
            <div className="teams-notif-avatar-initials">{initials}</div>
          )}
        </div>

        <div className="teams-notif-caller-name">{callerName}</div>
        <div className="teams-notif-caller-status">
          {isVideo ? "is video calling you" : "is calling you"}
        </div>
        <div className="teams-notif-chat-pill mt-2">
          <i className="fa fa-commenting me-1" /> Open Chat
        </div>
      </div>

      {/* Action Buttons matching Teams Layout: [Video] [Audio] [Decline] */}
      <div className="teams-notif-actions">
        <button
          type="button"
          className="teams-btn teams-btn-accept-video"
          onClick={() => onAccept(callId, "video")}
          title="Accept with Video"
        >
          <i className="fa fa-video-camera" />
        </button>

        <button
          type="button"
          className="teams-btn teams-btn-accept-audio"
          onClick={() => onAccept(callId, "audio")}
          title="Accept with Audio"
        >
          <i className="fa fa-phone" />
        </button>

        <button
          type="button"
          className="teams-btn teams-btn-decline"
          onClick={() => onDecline(callId)}
          title="Decline Call"
        >
          <i className="fa fa-phone" style={{ transform: "rotate(135deg)" }} />
        </button>
      </div>
    </div>
  );
};

export default TeamsIncomingCallToast;

