import React, { useEffect } from "react";
import { resolveCrmImageUrl } from "../Basurl/Baseurl";
import "./TeamsNotification.css";

const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const TeamsMessageToast = ({ notification, onOpenChat, onClose }) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 6500);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const { id, senderName, senderImage, senderId, senderRole, messageText, chatId } = notification;
  const avatarUrl = resolveCrmImageUrl(senderImage);
  const initials = getInitials(senderName);

  return (
    <div
      className="teams-msg-card"
      role="alert"
      onClick={() => onOpenChat({ chatId, userId: senderId, name: senderName, role: senderRole })}
      title="Click to open conversation"
    >
      <div className="teams-notif-header">
        <div className="teams-notif-app-badge">
          <div className="teams-notif-app-icon is-chat">
            <i className="fa fa-commenting" />
          </div>
          <span>OMCA Messages</span>
        </div>
        <button
          type="button"
          className="teams-notif-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose(id);
          }}
          title="Dismiss"
        >
          <i className="fa fa-times" />
        </button>
      </div>

      <div className="teams-msg-body">
        {avatarUrl ? (
          <img src={avatarUrl} alt={senderName} className="teams-msg-avatar-img" />
        ) : (
          <div className="teams-msg-avatar-initials">{initials}</div>
        )}

        <div className="teams-msg-content">
          <div className="teams-msg-sender">{senderName || "New Message"}</div>
          <div className="teams-msg-text">{messageText || "Sent a message"}</div>
          <div className="teams-msg-action-hint">
            <i className="fa fa-external-link" /> Click to open chat
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamsMessageToast;

