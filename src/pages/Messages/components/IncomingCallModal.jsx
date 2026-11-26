import React, { useEffect, useState } from "react";
import { playRingtone, stopAudio } from "../../../utils/callAudio";
import { resolveCrmImageUrl } from "../../../Basurl/Baseurl";
import "./CallModal.css";

const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const IncomingCallModal = ({ incomingCall, onAccept, onDecline }) => {
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    // Play ringtone as soon as incoming call modal mounts
    playRingtone();
    return () => {
      stopAudio();
    };
  }, []);

  if (!incomingCall) return null;

  const { caller, callType, isGroup, groupName } = incomingCall;
  const callerName = caller?.name || "Unknown Caller";
  const callerRole = caller?.role || "Member";
  const callerImage = resolveCrmImageUrl(caller?.profileImage);
  const isVideo = callType === "video";

  const handleAccept = () => {
    if (isAccepting) return;
    setIsAccepting(true);
    stopAudio();
    onAccept(incomingCall.callId);
  };

  const handleDecline = () => {
    stopAudio();
    onDecline(incomingCall.callId);
  };

  return (
    <div className="omca-call-overlay-backdrop">
      <div className="omca-incoming-call-card">
        {/* Pulsing ring around avatar */}
        <div className="omca-call-avatar-wrapper">
          <div className="omca-call-pulse-ring" />
          <div className="omca-call-pulse-ring-2" />
          {callerImage ? (
            <img
              src={callerImage}
              alt={callerName}
              className="omca-call-avatar"
            />
          ) : (
            <div className="omca-call-avatar">
              {getInitials(callerName)}
            </div>
          )}
        </div>

        <h4 className="omca-call-title">
          {isGroup ? groupName || "Group Call" : callerName}
        </h4>

        <div className="omca-call-subtitle">
          {isGroup ? (
            <span>Caller: {callerName} ({callerRole})</span>
          ) : (
            <span>{callerRole}</span>
          )}
        </div>

        <div className="omca-call-type-badge">
          <i className={`fa ${isVideo ? "fa-video" : "fa-phone"}`} />
          <span>Incoming {isVideo ? "Video" : "Audio"} Call...</span>
        </div>

        {/* Accept and Decline Action Buttons */}
        <div className="omca-incoming-actions">
          <div>
            <button
              type="button"
              className="omca-call-btn-circle omca-call-btn-decline"
              onClick={handleDecline}
              title="Decline Call"
              disabled={isAccepting}
            >
              <i className="fa fa-phone" style={{ transform: "rotate(135deg)" }} />
            </button>
            <div className="omca-call-btn-label">Decline</div>
          </div>

          <div>
            <button
              type="button"
              className="omca-call-btn-circle omca-call-btn-accept"
              onClick={handleAccept}
              title="Accept Call"
              disabled={isAccepting}
            >
              {isAccepting ? (
                <div className="spinner-border spinner-border-sm text-white" role="status" />
              ) : (
                <i className="fa fa-phone" />
              )}
            </button>
            <div className="omca-call-btn-label">{isAccepting ? "Connecting..." : "Accept"}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;

