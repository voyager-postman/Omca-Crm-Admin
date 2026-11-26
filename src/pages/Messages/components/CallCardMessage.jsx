import React from "react";
import { MdCall, MdVideocam, MdCallMissed, MdCallEnd } from "react-icons/md";

/**
 * Strips raw call header emojis (📞, 📹, ☎️, 🎥) so only the sleek SVG icon is rendered.
 * Preserves user face emojis and standard text.
 */
export const cleanCallMessageText = (raw = "") => {
  return String(raw || "")
    .replace(/^[📞📹☎️🎥]\s*/gu, "")
    .trim();
};

/**
 * Formats date & time for call cards:
 * - Today: "Today, 09:41 am"
 * - Yesterday: "Yesterday, 09:41 am"
 * - Other: "04 Nov, 09:41 am" (or with year if not current year)
 */
export const formatCallEventDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();

  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `Today, ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${timeStr}`;
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  return `${dateStr}, ${timeStr}`;
};

export const formatCallEventFullTooltip = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

/**
 * WhatsApp / Teams style Call Event Card in Chat Thread
 * Renders call event logs (Missed, Ended, Cancelled, Declined, Busy)
 * with authentic crisp icons, status text, and clear date & time timestamp.
 */
const CallCardMessage = ({ msg, currentUserId, onCallBack }) => {
  // Only messages with valid callInfo and a valid callId are call events
  if (!msg?.callInfo || !msg.callInfo.callId) return null;

  const { callType = "audio", status = "ended" } = msg.callInfo;
  const isVideo = callType === "video";
  const isMissed = status === "missed";
  const isCancelled = status === "cancelled";
  const isBusy = status === "busy";
  const isRejected = status === "rejected";

  // Visual styling classes & colors
  let cardClass = "is-ended";
  let iconColor = "#16a34a";
  let textColor = "#15803d";

  if (isMissed || isBusy) {
    cardClass = "is-missed";
    iconColor = "#e11d48";
    textColor = "#be123c";
  } else if (isCancelled) {
    cardClass = "is-cancelled";
    iconColor = "#e11d48";
    textColor = "#be123c";
  } else if (isRejected) {
    cardClass = "is-rejected";
    iconColor = "#64748b";
    textColor = "#475569";
  }

  // Clean text without raw unicode emojis (e.g. "Video call ended · 51s")
  const cleaned = cleanCallMessageText(msg.message);
  const hasStatusDetails =
    /(ended|missed|cancelled|canceled|declined|rejected|busy|duration|\d+s|\d+m)/i.test(cleaned);
  const displayText =
    (cleaned && hasStatusDetails)
      ? cleaned
      : isMissed
      ? `Missed ${isVideo ? "video" : "audio"} call`
      : isCancelled
      ? `Cancelled ${isVideo ? "video" : "audio"} call`
      : isRejected
      ? `Declined ${isVideo ? "video" : "audio"} call`
      : isBusy
      ? `${isVideo ? "Video" : "Audio"} call (Busy)`
      : `${isVideo ? "Video" : "Audio"} call ended`;

  const timeSource =
    msg.createdAt ||
    msg.timestamp ||
    msg.time ||
    msg.callInfo?.endedAt ||
    msg.callInfo?.startedAt;
  const timeDisplay = formatCallEventDateTime(timeSource);
  const timeTooltip = formatCallEventFullTooltip(timeSource);

  return (
    <div className="crm-chat-call-event-row">
      <div className={`crm-chat-call-card ${cardClass}`}>
        {/* Sleek SVG Call Icon (WhatsApp / Material Design) */}
        <span className="crm-chat-call-icon">
          {isMissed ? (
            <MdCallMissed size={18} color={iconColor} />
          ) : isCancelled || isBusy || isRejected ? (
            <MdCallEnd size={17} color={iconColor} />
          ) : isVideo ? (
            <MdVideocam size={19} color={iconColor} />
          ) : (
            <MdCall size={18} color={iconColor} />
          )}
        </span>

        {/* Clean Message Text & Date/Time */}
        <div className="crm-chat-call-content">
          <span className="crm-chat-call-text" style={{ color: textColor }}>
            {displayText}
          </span>
          {timeDisplay && (
            <span className="crm-chat-call-time" title={timeTooltip}>
              {timeDisplay}
            </span>
          )}
        </div>

        {/* One-Click Call Back Button for Missed Calls */}
        {isMissed && onCallBack && (
          <button
            type="button"
            className="crm-chat-call-back-btn"
            onClick={() => onCallBack(msg.senderUserId, callType)}
            title={`Call back with ${callType}`}
          >
            {isVideo ? <MdVideocam size={14} /> : <MdCall size={14} />}
            <span>Call Back</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default CallCardMessage;
