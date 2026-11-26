import React, { useEffect } from "react";
import { playRingback, stopAudio } from "../../../utils/callAudio";
import { resolveCrmImageUrl } from "../../../Basurl/Baseurl";
import "./CallModal.css";

const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const OutgoingCallModal = ({ outgoingCall, onCancel }) => {
  useEffect(() => {
    playRingback();
    return () => {
      stopAudio();
    };
  }, []);

  if (!outgoingCall) return null;

  const { targetName, targetRole, targetImage, isGroup, groupName, callType, statusText } = outgoingCall;
  const isVideo = callType === "video";
  const displayImage = resolveCrmImageUrl(targetImage);
  const displayName = isGroup ? groupName || "Group Call" : targetName || "Calling...";

  const handleCancel = () => {
    stopAudio();
    onCancel(outgoingCall.callId);
  };

  return (
    <div className="omca-call-overlay-backdrop">
      <div className="omca-outgoing-call-card">
        <div className="omca-call-avatar-wrapper">
          <div className="omca-call-pulse-ring" />
          <div className="omca-call-pulse-ring-2" />
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayName}
              className="omca-call-avatar"
            />
          ) : (
            <div className="omca-call-avatar">
              {getInitials(displayName)}
            </div>
          )}
        </div>

        <h4 className="omca-call-title">{displayName}</h4>

        <div className="omca-call-subtitle">
          {isGroup ? "Starting group session..." : targetRole || "Direct Call"}
        </div>

        <div className="omca-outgoing-status">
          <i className={`fa ${isVideo ? "fa-video" : "fa-phone"}`} />
          <span>{statusText || "Ringing..."}</span>
        </div>

        <div className="omca-incoming-actions">
          <div>
            <button
              type="button"
              className="omca-call-btn-circle omca-call-btn-decline"
              onClick={handleCancel}
              title="Cancel Call"
            >
              <i className="fa fa-phone" style={{ transform: "rotate(135deg)" }} />
            </button>
            <div className="omca-call-btn-label">Cancel</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutgoingCallModal;

