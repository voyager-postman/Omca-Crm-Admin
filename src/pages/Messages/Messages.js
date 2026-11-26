import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  addGroupMembers,
  createGroupChat,
  fetchChatList,
  fetchChatMessages,
  fetchAllChatMessages,
  fetchChatUsers,
  fetchPotentialMembers,
  markChatReadRest,
  removeGroupMember,
  sendChatMessageRest,
  startChat,
} from "../../services/chatApi";
import { markRecordRead } from "../../services/unreadApi";
import { UnreadDot } from "../../components/NewTag";
import {
  connectChatSocket,
  joinChatRoom,
  markChatReadSocket,
  onChatMessage,
  onChatRead,
  onChatMemberRemoved,
  onPresenceUpdate,
  requestPresence,
  sendChatMessageSocket,
  isChatSocketConnected,
} from "../../services/chatSocket";
import { onSosSocketStatus } from "../../services/sosSocket";
import { getToken, getUserId } from "../../utils/authStorage";
import { image } from "../../Basurl/Baseurl";
import EmojiPicker from "emoji-picker-react";
import "./Messages.css";
import {
  initiateCall,
  acceptCall,
  rejectCall,
  cancelCall,
  endCall,
  bindCallEventListeners,
  onCallIncoming,
  onCallRinging,
  onCallAccepted,
  onCallRejected,
  onCallCancelled,
  onCallEnded,
  onCallBusy,
  onCallMissed,
  onCallError,
} from "../../services/callSocket";
import { fetchMissedCallsCount } from "../../services/callApi";
import {
  setViewingChatId,
  setGlobalOutgoingCall,
  setGlobalActiveCall,
  registerOpenChatHandler,
} from "../../services/callState";
import IncomingCallModal from "./components/IncomingCallModal";
import OutgoingCallModal from "./components/OutgoingCallModal";
import ActiveCallModal from "./components/ActiveCallModal";
import CallHistoryTab from "./components/CallHistoryTab";
import CallCardMessage, { cleanCallMessageText } from "./components/CallCardMessage";
import { MdCall, MdVideocam, MdCallMissed } from "react-icons/md";
import "./components/CallModal.css";

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getMessageDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString();
};

const formatDateDividerLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

const NAME_PREFIXES = new Set([
  "pt",
  "pt.",
  "mr",
  "mr.",
  "mrs",
  "mrs.",
  "ms",
  "ms.",
  "miss",
  "dr",
  "dr.",
  "sir",
  "madam",
]);

const getInitials = (name = "") => {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !NAME_PREFIXES.has(part.toLowerCase().replace(/,$/, "")));
  if (!parts.length) {
    const fallback = String(name).trim();
    return fallback ? fallback.slice(0, 2).toUpperCase() : "?";
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const resolveAttachmentUrl = (url) => {
  if (!url) return "";
  let strUrl = "";
  if (typeof url === "string") {
    strUrl = url;
  } else if (typeof url === "object") {
    strUrl =
      url.url ||
      url.path ||
      url.file ||
      url.filePath ||
      url.location ||
      url.src ||
      url.uri ||
      "";
  }
  if (!strUrl || typeof strUrl !== "string") return "";

  if (
    strUrl.startsWith("http://") ||
    strUrl.startsWith("https://") ||
    strUrl.startsWith("blob:") ||
    strUrl.startsWith("data:")
  ) {
    return strUrl;
  }

  let cleanPath = strUrl.replace(/^\/+/, "");
  if (cleanPath.startsWith("omca_crm/")) {
    cleanPath = cleanPath.replace(/^omca_crm\//, "");
  }

  return `${image}${cleanPath}`;
};

const isImageAttachment = (url = "", type = "", name = "") => {
  if (type && String(type).startsWith("image/")) return true;
  let str = "";
  if (typeof url === "string") str = url;
  else if (url && typeof url === "object") {
    str = url.url || url.path || url.file || url.name || "";
  }
  const target = `${str} ${name || ""}`.toLowerCase();
  return (
    /\.(jpeg|jpg|gif|png|webp|svg|bmp|jfif|ico|avif)($|\?)/i.test(target) ||
    str.startsWith("data:image/")
  );
};

const getFileIcon = (url = "", type = "", name = "") => {
  let str = "";
  if (typeof url === "string") str = url;
  else if (url && typeof url === "object") {
    str = url.url || url.path || url.file || url.name || "";
  }
  const target = `${str} ${type || ""} ${name || ""}`.toLowerCase();
  if (target.includes("pdf")) return "fa fa-file-pdf text-danger";
  if (
    target.includes("doc") ||
    target.includes("docx") ||
    target.includes("word")
  )
    return "fa fa-file-word text-primary";
  if (
    target.includes("xls") ||
    target.includes("xlsx") ||
    target.includes("sheet") ||
    target.includes("csv")
  )
    return "fa fa-file-excel text-success";
  if (
    target.includes("ppt") ||
    target.includes("pptx") ||
    target.includes("presentation")
  )
    return "fa fa-file-powerpoint text-warning";
  if (
    target.includes("zip") ||
    target.includes("rar") ||
    target.includes("tar") ||
    target.includes("7z") ||
    target.includes("gz")
  )
    return "fa fa-file-archive text-warning";
  if (
    target.includes("audio") ||
    target.includes("mp3") ||
    target.includes("wav") ||
    target.includes("m4a") ||
    target.includes("ogg")
  )
    return "fa fa-file-audio text-info";
  if (
    target.includes("video") ||
    target.includes("mp4") ||
    target.includes("mov") ||
    target.includes("mkv") ||
    target.includes("webm")
  )
    return "fa fa-file-video text-secondary";
  return "fa fa-file-alt text-secondary";
};

const formatFileSize = (bytes) => {
  if (!bytes || Number.isNaN(Number(bytes))) return "";
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const ChatAvatar = ({ name, src, size = "", isGroup = false }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!src && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  if (isGroup) {
    return (
      <div className={`crm-chat-avatar is-group ${size}`}>
        <i className="fa fa-users" />
      </div>
    );
  }

  return (
    <div className={`crm-chat-avatar ${size} ${showImage ? "has-image" : ""}`}>
      {showImage ? (
        <img
          src={resolveAttachmentUrl(src)}
          alt={name || "User"}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

export const getRoleBadgeClass = (role = "") => {
  const r = String(role || "").toLowerCase().trim();
  if (
    r.includes("doctor") ||
    r.includes("dr.") ||
    r.includes("surgeon") ||
    r.includes("physician")
  ) {
    return "crm-role-doctor";
  }
  if (r.includes("nurse")) {
    return "crm-role-nurse";
  }
  if (r.includes("admin") || r.includes("director")) {
    return "crm-role-admin";
  }
  if (r.includes("patient")) {
    return "crm-role-patient";
  }
  if (
    r.includes("reception") ||
    r.includes("coord") ||
    r.includes("manager") ||
    r.includes("staff")
  ) {
    return "crm-role-staff";
  }
  return "crm-role-default";
};

export const RoleBadge = ({ role, size = "" }) => {
  if (!role) return null;
  const roleStr = String(role).trim();
  const cls = getRoleBadgeClass(roleStr);
  return (
    <span
      className={`crm-role-badge ${cls} ${size}`}
      title={`Role: ${roleStr}`}
    >
      {roleStr}
    </span>
  );
};

export const UserTypeBadge = ({ type, db, size = "" }) => {
  if (!type && !db) return null;
  const t = String(type || "").toLowerCase();
  const isPatient = t === "patient";
  return (
    <span
      className={`crm-user-type-tag ${isPatient ? "patient" : "staff"} ${size}`}
      title={db ? `Source: ${db}` : isPatient ? "Patient" : "CRM Staff"}
    >
      <i
        className={`fa ${isPatient ? "fa-user-injured" : "fa-user-tie"} me-1`}
      />
      {isPatient ? "Patient" : "Staff"}
    </span>
  );
};

const normalizeChat = (item = {}) => {
  const isGroup = !!(
    item.isGroup ||
    item.status === "group" ||
    String(item.chatId || "").startsWith("group_")
  );
  const other = item.otherUser || {};
  const isOnline = isGroup
    ? false
    : !!(
      item.isOnline ??
      other.isOnline ??
      (item.status === "online" || other.status === "online")
    );
  let chatName = "";
  if (isGroup) {
    chatName = item.chatName || item.name || "Group Conversation";
  } else {
    // For 1-to-1 direct chats, show ONLY the other user's name
    if (other.name && typeof other.name === "string" && !other.name.includes(" & ")) {
      chatName = other.name;
    } else {
      const raw = String(other.name || item.chatName || item.name || "").trim();
      if (raw.includes(" & ")) {
        const parts = raw.split(" & ").map((p) => p.trim());
        const otherPart = parts.find(
          (p) => !/admin/i.test(p) && !/crm/i.test(p) && p.toLowerCase() !== "you",
        );
        chatName = otherPart || parts[1] || parts[0];
      } else {
        chatName = raw || `User ${other.userId || item.contactUserId || ""}`;
      }
    }
  }

  const profileImage =
    other.profileImage ||
    other.profile_image ||
    other.image ||
    item.profileImage ||
    null;

  const role =
    other.role ||
    item.role ||
    (isGroup ? "Group" : "User");

  const userType =
    other.userType ||
    item.userType ||
    (String(role).toLowerCase() === "patient" ? "patient" : "staff");

  const members = (() => {
    const raw =
      item.participants ||
      item.members ||
      item.users ||
      item.groupMembers ||
      [];
    return Array.isArray(raw)
      ? raw
        .map((m) => {
          if (typeof m !== "object" || !m) return m;
          const uid = String(m.userId || m.user_id || m._id || m.id || "");
          const mRole = m.role || "Member";
          const mUserType =
            m.userType ||
            (String(mRole).toLowerCase() === "patient" ? "patient" : "staff");
          return {
            userId: uid,
            name:
              m.name ||
              m.patient_name ||
              m.fullname ||
              m.username ||
              m.enq_userName ||
              `User ${uid}`,
            email: m.email || "",
            phone: m.phone || m.mobile || m.contact_no || "",
            image: m.profileImage || m.profile_image || m.image || null,
            role: mRole,
            userType: mUserType,
            db: m.db || null,
          };
        })
        .filter((m) => m && (typeof m !== "object" || m.userId))
      : [];
  })();

  const memberIds = (() => {
    const raw =
      item.memberIds ||
      item.member_ids ||
      item.members ||
      item.users ||
      item.participants ||
      item.groupMembers ||
      item.user_ids ||
      [];
    return Array.isArray(raw)
      ? raw
        .map((m) =>
          String(
            typeof m === "object" ? m.userId || m.user_id || m._id || m.id : m,
          ),
        )
        .filter(Boolean)
      : [];
  })();

  return {
    chatId: item.chatId,
    chatName,
    isGroup,
    role,
    userType,
    admin: String(item.admin || item.createdBy || item.adminId || ""),
    members,
    memberIds,
    lastMessage: item.lastMessage || (item.attachment ? "📎 Attachment" : ""),
    lastMessageAt: item.lastMessageAt || item.updatedAt || null,
    unreadCount: Number(item.unreadCount || 0),
    isOnline,
    status: isGroup
      ? "group"
      : isOnline
        ? "online"
        : item.status || other.status || "offline",
    otherUser: isGroup
      ? null
      : {
        userId: String(other.userId ?? item.contactUserId ?? ""),
        name: chatName,
        profileImage: profileImage || null,
        role,
        userType,
        isOnline,
        status: isOnline ? "online" : other.status || "offline",
        lastActivity: other.lastActivity || null,
      },
  };
};

/** Socket/REST payloads sometimes nest the message object. */
const unwrapRawMessage = (raw) => {
  if (!raw || typeof raw !== "object") return raw || {};
  if (
    raw.message &&
    typeof raw.message === "object" &&
    !Array.isArray(raw.message)
  ) {
    return {
      ...raw.message,
      chatId: raw.chatId || raw.message.chatId,
    };
  }
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return unwrapRawMessage(raw.data);
  }
  if (
    raw.payload &&
    typeof raw.payload === "object" &&
    !Array.isArray(raw.payload)
  ) {
    return unwrapRawMessage(raw.payload);
  }
  return raw;
};

const extractAttachmentInfo = (msg = {}) => {
  let rawAttachment =
    msg.attachment ??
    msg.attachmentUrl ??
    msg.file ??
    msg.mediaUrl ??
    msg.media ??
    msg.image ??
    msg.document ??
    msg.doc ??
    msg.filePath ??
    msg.url ??
    null;

  if (Array.isArray(rawAttachment)) {
    rawAttachment = rawAttachment[0];
  } else if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    rawAttachment = msg.attachments[0];
  } else if (Array.isArray(msg.files) && msg.files.length > 0) {
    rawAttachment = msg.files[0];
  }

  let attachmentUrl = "";
  let attachmentName =
    msg.attachmentName ||
    msg.fileName ||
    msg.filename ||
    msg.name ||
    msg.originalName ||
    msg.originalname ||
    "";
  let attachmentType =
    msg.attachmentType ||
    msg.fileType ||
    msg.mimeType ||
    msg.mimetype ||
    msg.type ||
    "";
  let attachmentSize =
    msg.attachmentSize ||
    msg.fileSize ||
    msg.size ||
    null;

  if (typeof rawAttachment === "string") {
    attachmentUrl = rawAttachment;
  } else if (rawAttachment && typeof rawAttachment === "object") {
    attachmentUrl =
      rawAttachment.url ||
      rawAttachment.path ||
      rawAttachment.file ||
      rawAttachment.filePath ||
      rawAttachment.filename ||
      rawAttachment.fileName ||
      rawAttachment.location ||
      rawAttachment.src ||
      rawAttachment.uri ||
      "";
    attachmentName =
      attachmentName ||
      rawAttachment.name ||
      rawAttachment.fileName ||
      rawAttachment.filename ||
      rawAttachment.originalName ||
      rawAttachment.originalname ||
      "";
    attachmentType =
      attachmentType ||
      rawAttachment.type ||
      rawAttachment.mimeType ||
      rawAttachment.mimetype ||
      rawAttachment.fileType ||
      "";
    attachmentSize =
      attachmentSize ||
      rawAttachment.size ||
      rawAttachment.fileSize ||
      null;
  }

  if (!attachmentName && attachmentUrl && typeof attachmentUrl === "string") {
    attachmentName = attachmentUrl.split("/").pop() || "Attachment";
  }

  return {
    attachment: attachmentUrl || null,
    attachmentName,
    attachmentType,
    attachmentSize,
  };
};

const normalizeMessage = (raw = {}, crmUserId) => {
  const msg = unwrapRawMessage(raw);
  const senderId = String(
    msg.senderUserId ??
    msg.senderId ??
    msg.fromUserId ??
    msg.sender?._id ??
    msg.sender?.id ??
    "",
  );
  const text = String(msg.message ?? msg.text ?? "").trim();
  const createdAt =
    msg.createdAt || msg.timestamp || msg.date || new Date().toISOString();
  const mine =
    senderId === String(crmUserId) ||
    msg.isMine === true ||
    msg.senderRole === "crm" ||
    msg.senderType === "crm" ||
    msg.sender === "crm";
  const status = String(msg.status || msg.readStatus || "").toLowerCase();
  const isRead = !!(
    msg.isRead === true ||
    msg.read === true ||
    msg.seen === true ||
    msg.isSeen === true ||
    status === "read" ||
    status === "seen"
  );

  const { attachment, attachmentName, attachmentType, attachmentSize } =
    extractAttachmentInfo(msg);

  const isGroup = !!(
    msg.isGroup ||
    String(msg.chatId || "").startsWith("group_")
  );

  const senderName =
    msg.senderName ||
    msg.sender?.name ||
    msg.sender?.patient_name ||
    (mine ? "You" : "");

  const senderRole =
    msg.senderRole ||
    msg.sender?.role ||
    msg.role ||
    "";

  const receiverRole =
    msg.receiverRole ||
    msg.receiver?.role ||
    "";

  const msgId = String(
    msg._id ||
    msg.id ||
    msg.messageId ||
    msg.msgId ||
    msg.uuid ||
    `msg-${senderId}-${createdAt}-${attachmentName || ""}-${text.slice(0, 20)}-${Math.random().toString(36).slice(2, 7)}`,
  );

  let callInfo = null;
  const rawCallInfo = msg.callInfo || raw?.callInfo || msg.data?.callInfo || null;
  const VALID_CALL_STATUSES = new Set([
    "missed",
    "cancelled",
    "canceled",
    "declined",
    "rejected",
    "busy",
    "ended",
  ]);

  if (rawCallInfo && typeof rawCallInfo === "object") {
    const rawStatus = String(rawCallInfo.status || "").toLowerCase().trim();
    const callId = String(rawCallInfo.callId || rawCallInfo.id || rawCallInfo._id || "").trim();
    if (callId && VALID_CALL_STATUSES.has(rawStatus)) {
      callInfo = {
        callId,
        callType: String(rawCallInfo.callType || "audio").toLowerCase().includes("video") ? "video" : "audio",
        status: rawStatus === "canceled" ? "cancelled" : rawStatus === "declined" ? "rejected" : rawStatus,
        durationSeconds: Number(rawCallInfo.durationSeconds) || 0,
      };
    }
  }

  // Backward-compatible fallback: Parse callInfo ONLY from genuine legacy call log strings
  if (!callInfo) {
    const hasCallEmoji = text.startsWith("📞") || text.startsWith("📹");
    const isStrictCallPattern =
      /^(📞|📹)?\s*(missed|cancelled|canceled|declined|rejected)?\s*(audio|video)\s*call\b/i.test(text) &&
      /(ended|declined|missed|cancelled|canceled|busy|\(\s*busy\s*\))/i.test(text);

    if (hasCallEmoji || isStrictCallPattern) {
      const lower = text.toLowerCase();
      const isVideo = lower.includes("video") || text.includes("📹");
      let status = null;
      if (lower.includes("missed")) status = "missed";
      else if (lower.includes("cancelled") || lower.includes("canceled")) status = "cancelled";
      else if (lower.includes("declined") || lower.includes("rejected")) status = "rejected";
      else if (lower.includes("busy")) status = "busy";
      else if (lower.includes("ended")) status = "ended";

      if (status) {
        callInfo = {
          callId: msgId || `call_legacy_${senderId}_${createdAt}`,
          callType: isVideo ? "video" : "audio",
          status,
          durationSeconds: 0,
          synthesized: true,
        };
      }
    }
  }

  return {
    _id: msgId,
    chatId: msg.chatId,
    message: text,
    callInfo,
    attachment,
    attachmentName,
    attachmentType,
    attachmentSize,
    senderUserId: senderId,
    senderName,
    senderRole,
    receiverUserId: String(msg.receiverUserId ?? msg.receiverId ?? ""),
    receiverRole,
    isRead,
    isGroup,
    createdAt,
    mine,
  };
};

const dedupeMessageList = (list = []) => {
  const seenIds = new Set();
  const out = [];
  for (const m of list) {
    if (!m) continue;
    if (m._id && seenIds.has(m._id)) continue;
    if (m._id) seenIds.add(m._id);
    out.push(m);
  }
  return out;
};

/** Merge a realtime message into local state without doubling echoes. */
const mergeIncomingMessage = (prev = [], msg) => {
  if (!msg) return prev;
  if (!msg.message && !msg.attachment && (!msg.callInfo || !msg.callInfo.callId)) return prev;

  // 1. If exact ID exists, update it in-place
  if (msg._id && prev.some((m) => m._id === msg._id)) {
    return prev.map((m) =>
      m._id === msg._id
        ? {
          ...m,
          ...msg,
          isRead: !!(m.isRead || msg.isRead),
          createdAt: msg.createdAt || m.createdAt,
        }
        : m,
    );
  }

  // 2. Check if this resolves a specific pending optimistic message
  const msgTs = new Date(msg.createdAt).getTime();
  let replacedOptimistic = false;

  const updated = prev.map((m) => {
    if (
      !replacedOptimistic &&
      String(m._id).startsWith("local-") &&
      m.mine &&
      String(m.chatId) === String(msg.chatId)
    ) {
      const mTs = new Date(m.createdAt).getTime();
      const timeDiff = Math.abs(mTs - msgTs);
      const isTimeClose = Number.isNaN(timeDiff) || timeDiff < 60000;

      const bothAttachments = !!(m.attachment && msg.attachment);
      const matchingText = !!(
        m.message &&
        msg.message &&
        m.message === msg.message
      );

      if ((bothAttachments || matchingText) && isTimeClose) {
        replacedOptimistic = true;
        return {
          ...m,
          ...msg,
          _id: msg._id || m._id,
          isRead: !!(m.isRead || msg.isRead),
          createdAt: msg.createdAt || m.createdAt,
        };
      }
    }
    return m;
  });

  if (replacedOptimistic) {
    // If multiple duplicate instances of msg._id exist, keep only the first
    const seen = new Set();
    return updated.filter((m) => {
      if (!m._id) return true;
      if (seen.has(m._id)) return false;
      seen.add(m._id);
      return true;
    });
  }

  // 3. Prevent duplicate: if msg._id is already present, don't append again
  if (msg._id && prev.some((m) => m._id === msg._id)) {
    return prev;
  }

  // 4. Otherwise append as a new distinct message
  return [...prev, msg];
};

/** WhatsApp-style ticks — only for CRM (mine) messages with authentic SVG paths. */
const MessageTicks = ({ msg }) => {
  if (!msg?.mine) return null;
  const pending = String(msg._id || "").startsWith("local-");
  const seen = !!msg.isRead;
  return (
    <span
      className={`crm-chat-ticks ${pending ? "is-pending" : seen ? "is-seen" : "is-unseen"}`}
      title={pending ? "Sending…" : seen ? "Seen" : "Delivered"}
      aria-label={pending ? "Sending" : seen ? "Seen" : "Delivered"}
    >
      {pending ? (
        <svg viewBox="0 0 16 15" width="15" height="14" fill="currentColor">
          <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor">
          <path d="m15.01 3.316-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
        </svg>
      )}
    </span>
  );
};

export default function Messages() {
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = (localStorage.getItem("Role") || "").toLowerCase();
  const permissionsRaw = localStorage.getItem("permissionArray") || "";
  const permissionsList = permissionsRaw.split(",").map((p) => p.trim());
  const canAccessMessages =
    userRole === "admin" ||
    permissionsList.includes("/Messages") ||
    permissionsList.includes("Messages") ||
    permissionsList.includes("/messages") ||
    permissionsList.includes("messages");

  useEffect(() => {
    if (!canAccessMessages) {
      navigate("/Admin/no-permission", { replace: true });
    }
  }, [canAccessMessages, navigate]);

  const crmUserId = getUserId();
  const messagesEndRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const sendingRef = useRef(false);
  const seenMessageIdsRef = useRef(new Set());
  const fileInputRef = useRef(null);

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  // Sync active chat id with global notification manager so toasts aren't shown for current conversation
  useEffect(() => {
    setViewingChatId(activeChat?.chatId || null);
    return () => setViewingChatId(null);
  }, [activeChat?.chatId]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [search, setSearch] = useState("");
  const [chatFilterTab, setChatFilterTab] = useState("all"); // 'all' | 'direct' | 'groups'
  const [listLoading, setListLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [socketOnline, setSocketOnline] = useState(false);
  const [userRemovedFromActiveChat, setUserRemovedFromActiveChat] =
    useState(false);

  // Message pagination & infinite scroll states
  const [chatPagination, setChatPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    pages: 1,
    hasMore: false,
  });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingAllHistory, setLoadingAllHistory] = useState(false);
  const threadBodyRef = useRef(null);
  const skipAutoScrollBottomRef = useRef(false);
  const loadingChatIdRef = useRef(null);
  const backgroundHistoryLoadedRef = useRef(new Set());
  const handledNavKeyRef = useRef(null);
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  // Call states
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [missedCallsCount, setMissedCallsCount] = useState(0);

  // Modals state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [newChatType, setNewChatType] = useState("all"); // 'all' | 'staff' | 'patient'
  const [newChatUsers, setNewChatUsers] = useState([]);
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [newChatPage, setNewChatPage] = useState(1);
  const [newChatHasMore, setNewChatHasMore] = useState(false);
  const [newChatLoadingMore, setNewChatLoadingMore] = useState(false);

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [candidateType, setCandidateType] = useState("all"); // 'all' | 'staff' | 'patient'
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Create Group Form state
  const [newGroupName, setNewGroupName] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateMembers, setCandidateMembers] = useState([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateHasMore, setCandidateHasMore] = useState(false);
  const [candidateLoadingMore, setCandidateLoadingMore] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Add Members state
  const [isAddMemberSectionOpen, setIsAddMemberSectionOpen] = useState(false);
  const [addMemberSelectedIds, setAddMemberSelectedIds] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberType, setAddMemberType] = useState("all"); // 'all' | 'staff' | 'patient'

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !e.target.closest(".crm-chat-emoji-btn")
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleEmojiClick = (emojiData) => {
    setDraft((prev) => prev + (emojiData.emoji || ""));
  };

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const loadChatList = useCallback(async () => {
    if (!crmUserId) return;
    setListLoading(true);
    try {
      const list = await fetchChatList(crmUserId);
      setChats((list || []).map(normalizeChat));
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load chats");
    } finally {
      setListLoading(false);
    }
  }, [crmUserId]);

  const loadRemainingHistoryInBackground = useCallback(
    async (targetChatId, fromPage, toPage, limit = 100) => {
      if (!targetChatId || fromPage > toPage) return;
      if (backgroundHistoryLoadedRef.current.has(targetChatId)) return;
      backgroundHistoryLoadedRef.current.add(targetChatId);
      try {
        setLoadingAllHistory(true);
        const pagePromises = [];
        for (let p = fromPage; p <= toPage; p++) {
          pagePromises.push(
            fetchChatMessages(targetChatId, {
              userId: crmUserId,
              page: p,
              limit,
            }).catch(() => ({ messages: [] }))
          );
        }
        const results = await Promise.all(pagePromises);
        if (activeChatIdRef.current !== targetChatId) return;

        let olderMessages = [];
        results.forEach((r) => {
          if (Array.isArray(r.messages)) {
            olderMessages = olderMessages.concat(r.messages);
          }
        });

        if (olderMessages.length > 0) {
          const container = threadBodyRef.current;
          const prevScrollHeight = container ? container.scrollHeight : 0;
          const prevScrollTop = container ? container.scrollTop : 0;

          skipAutoScrollBottomRef.current = true;
          setMessages((prev) => {
            const normalizedOlder = olderMessages.map((m) =>
              normalizeMessage(m, crmUserId)
            );
            const combined = dedupeMessageList(
              [...normalizedOlder, ...prev].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              )
            );
            seenMessageIdsRef.current = new Set(
              combined.map((m) => m._id).filter(Boolean)
            );
            return combined;
          });

          setChatPagination((prev) => ({
            ...prev,
            hasMore: false,
            page: toPage,
          }));

          requestAnimationFrame(() => {
            if (container) {
              const heightDiff = container.scrollHeight - prevScrollHeight;
              container.scrollTop = prevScrollTop + heightDiff;
            }
          });
        } else {
          setChatPagination((prev) => ({ ...prev, hasMore: false }));
        }
      } catch (err) {
        console.warn("Background history load warning:", err);
      } finally {
        setLoadingAllHistory(false);
      }
    },
    [crmUserId]
  );

  const loadOlderMessages = useCallback(async () => {
    if (
      !activeChat?.chatId ||
      loadingOlder ||
      loadingAllHistory ||
      !chatPagination.hasMore
    ) {
      return;
    }
    const nextPage = (chatPagination.page || 1) + 1;
    const targetChatId = activeChat.chatId;
    setLoadingOlder(true);

    try {
      const result = await fetchChatMessages(targetChatId, {
        userId: crmUserId,
        page: nextPage,
        limit: chatPagination.limit || 100,
      });

      if (activeChatIdRef.current !== targetChatId) return;

      const newMsgs = (result.messages || []).map((m) =>
        normalizeMessage(m, crmUserId)
      );

      if (newMsgs.length > 0) {
        const container = threadBodyRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;
        const prevScrollTop = container ? container.scrollTop : 0;

        skipAutoScrollBottomRef.current = true;
        setMessages((prev) => {
          const combined = dedupeMessageList(
            [...newMsgs, ...prev].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            )
          );
          seenMessageIdsRef.current = new Set(
            combined.map((m) => m._id).filter(Boolean)
          );
          return combined;
        });

        setChatPagination((prev) => ({
          ...prev,
          page: nextPage,
          hasMore: Boolean(result.hasMore),
          total: result.total || prev.total,
          pages: result.pages || prev.pages,
        }));

        requestAnimationFrame(() => {
          if (container) {
            const heightDiff = container.scrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + heightDiff;
          }
        });
      } else {
        setChatPagination((prev) => ({ ...prev, hasMore: false }));
      }
    } catch (err) {
      console.error("Failed to load older messages:", err);
      toast.error("Failed to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }, [
    activeChat?.chatId,
    crmUserId,
    chatPagination,
    loadingOlder,
    loadingAllHistory,
  ]);

  const loadAllHistory = useCallback(async () => {
    if (!activeChat?.chatId || loadingAllHistory || !chatPagination.hasMore) return;
    const fromPage = (chatPagination.page || 1) + 1;
    const toPage =
      chatPagination.pages ||
      Math.ceil((chatPagination.total || 0) / (chatPagination.limit || 100));
    loadRemainingHistoryInBackground(
      activeChat.chatId,
      fromPage,
      toPage,
      chatPagination.limit || 100
    );
  }, [
    activeChat?.chatId,
    chatPagination,
    loadingAllHistory,
    loadRemainingHistoryInBackground,
  ]);

  const handleThreadScroll = useCallback(() => {
    const el = threadBodyRef.current;
    if (!el) return;
    // Only trigger if content actually overflows and user scrolled up to the very top (0)
    if (
      el.scrollTop === 0 &&
      el.scrollHeight > el.clientHeight + 120 &&
      chatPagination.hasMore &&
      !loadingOlder &&
      !loadingAllHistory
    ) {
      loadOlderMessages();
    }
  }, [chatPagination.hasMore, loadingOlder, loadingAllHistory, loadOlderMessages]);

  const openConversation = useCallback(
    async (chat, options = {}) => {
      if (!chat?.chatId || !crmUserId) return;
      const normalized = normalizeChat(chat);
      // Guard against concurrent double-load or re-opening already active loaded chat
      if (loadingChatIdRef.current === normalized.chatId) return;
      if (
        activeChatIdRef.current === normalized.chatId &&
        messages.length > 0 &&
        !options?.force
      ) {
        return;
      }
      loadingChatIdRef.current = normalized.chatId;
      activeChatIdRef.current = normalized.chatId;
      setActiveChat(normalized);
      markRecordRead("messages", normalized.chatId);
      setUserRemovedFromActiveChat(false);
      setMessagesLoading(true);
      setMessages([]);
      setChatPagination({ page: 1, limit: 100, total: 0, pages: 1, hasMore: false });
      setLoadingOlder(false);
      setLoadingAllHistory(false);
      skipAutoScrollBottomRef.current = false;
      try {
        joinChatRoom(normalized.chatId);
        const result = await fetchChatMessages(normalized.chatId, {
          userId: crmUserId,
          page: 1,
          limit: 100,
        });

        // Update activeChat with any enriched participants info returned from messages API
        if (Array.isArray(result.participants) && result.participants.length > 0) {
          const freshParticipants = result.participants.map((p) => {
            const uid = String(p.userId || p.user_id || p._id || p.id || "");
            const pRole = p.role || "Member";
            const pType =
              p.userType ||
              (String(pRole).toLowerCase() === "patient" ? "patient" : "staff");
            return {
              userId: uid,
              name: p.name || p.patient_name || p.fullname || p.username || `User ${uid}`,
              email: p.email || "",
              phone: p.phone || p.mobile || "",
              image: p.profileImage || p.profile_image || p.image || null,
              role: pRole,
              userType: pType,
              db: p.db || null,
            };
          });

          if (!normalized.isGroup) {
            const otherPart = freshParticipants.find(
              (p) => String(p.userId) !== String(crmUserId),
            );
            if (otherPart) {
              normalized.otherUser = {
                ...normalized.otherUser,
                ...otherPart,
                role: otherPart.role || normalized.otherUser?.role || "User",
                userType: otherPart.userType || normalized.otherUser?.userType || "",
              };
              if (otherPart.role) normalized.role = otherPart.role;
              if (otherPart.userType) normalized.userType = otherPart.userType;
            }
          } else {
            normalized.members = freshParticipants;
            normalized.memberIds = freshParticipants.map((p) => String(p.userId));
          }
          setActiveChat({ ...normalized });
        }

        const sorted = dedupeMessageList(
          (result.messages || [])
            .map((m) => normalizeMessage(m, crmUserId))
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            ),
        );
        seenMessageIdsRef.current = new Set(
          sorted.map((m) => m._id).filter(Boolean),
        );
        setMessages(sorted);
        setChatPagination({
          page: result.page || 1,
          limit: result.limit || 100,
          total: result.total || sorted.length,
          pages: result.pages || 1,
          hasMore: Boolean(result.hasMore),
        });
        markChatReadSocket(normalized.chatId);
        markChatReadRest(normalized.chatId, crmUserId).catch(() => { });
        setChats((prev) =>
          prev.map((c) =>
            c.chatId === normalized.chatId ? { ...c, unreadCount: 0 } : c,
          ),
        );
        scrollToBottom();

        // If there are more pages and total is reasonable (<= 500 messages), auto-load remaining history in background
        if (result.hasMore && (result.pages || 1) > 1 && (result.total || 0) <= 500) {
          loadRemainingHistoryInBackground(
            normalized.chatId,
            2,
            result.pages,
            result.limit || 100
          );
        }
      } catch (err) {
        console.error(err);
        toast.error(err?.response?.data?.message || "Failed to load messages");
      } finally {
        loadingChatIdRef.current = null;
        setMessagesLoading(false);
      }
    },
    [crmUserId, scrollToBottom, loadRemainingHistoryInBackground, messages.length],
  );

  const startChatWithUser = useCallback(
    async (contactUserId, userMeta = {}) => {
      if (!contactUserId || !crmUserId) {
        toast.error("User id is missing");
        return;
      }
      if (String(contactUserId) === String(crmUserId)) {
        toast.error("You cannot start a chat with yourself");
        return;
      }
      try {
        const data = await startChat(contactUserId, crmUserId);
        const chatPayload = data?.chatId ? data : data?.data || data;
        const otherRole =
          chatPayload?.otherUser?.role ||
          chatPayload?.role ||
          userMeta.role ||
          "User";
        const otherUserType =
          chatPayload?.otherUser?.userType ||
          chatPayload?.userType ||
          userMeta.userType ||
          (String(otherRole).toLowerCase() === "patient" ? "patient" : "staff");

        const chat = normalizeChat({
          ...chatPayload,
          role: otherRole,
          userType: otherUserType,
          chatName:
            chatPayload?.chatName ||
            userMeta.name ||
            chatPayload?.otherUser?.name,
          otherUser: {
            ...(chatPayload?.otherUser || {}),
            userId: String(
              chatPayload?.otherUser?.userId || contactUserId,
            ),
            name:
              chatPayload?.otherUser?.name ||
              userMeta.name ||
              `User ${contactUserId}`,
            role: otherRole,
            userType: otherUserType,
            profileImage:
              chatPayload?.otherUser?.profileImage ||
              userMeta.profileImage ||
              null,
          },
        });
        setChats((prev) => {
          const exists = prev.some((c) => c.chatId === chat.chatId);
          if (exists) {
            return prev.map((c) =>
              c.chatId === chat.chatId ? { ...c, ...chat } : c,
            );
          }
          return [chat, ...prev];
        });
        await openConversation(chat);
      } catch (err) {
        console.error("startChatWithUser error:", err);
        toast.error(
          err?.response?.data?.message ||
          "Unable to start chat. Check user id.",
        );
      }
    },
    [crmUserId, openConversation],
  );

  const startChatWithPatient = startChatWithUser;

  // File Attachment selection handler
  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 25MB check
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File size must be under 25MB");
      return;
    }

    setAttachmentFile(file);
    if (file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      setAttachmentPreview(previewUrl);
    } else {
      setAttachmentPreview(null);
    }
  };

  const handleClearAttachment = () => {
    if (attachmentPreview && attachmentPreview.startsWith("blob:")) {
      URL.revokeObjectURL(attachmentPreview);
    }
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Socket + list bootstrap
  useEffect(() => {
    const token = getToken();
    if (!token || !crmUserId) return undefined;

    const sock = connectChatSocket(token);
    setSocketOnline(isChatSocketConnected());
    bindCallEventListeners(sock);

    const unsubRinging = onCallRinging((payload) => {
      if (payload.isGroup && payload.token) {
        setActiveCall({
          callId: payload.callId,
          roomName: payload.roomName,
          token: payload.token,
          callType: payload.callType || "video",
          isGroup: true,
          groupName: payload.groupName,
          isHost: true,
        });
        setOutgoingCall(null);
      } else {
        setOutgoingCall((prev) =>
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

    const unsubAccepted = onCallAccepted((payload) => {
      setIncomingCall(null);
      setOutgoingCall(null);
      setActiveCall({
        callId: payload.callId,
        roomName: payload.roomName,
        token: payload.token,
        callType: payload.callType || "video",
        isGroup: !!payload.isGroup,
        groupName: payload.groupName,
        otherUser: payload.otherUser || (activeChat?.isGroup ? null : activeChat?.otherUser),
        isHost: false,
      });
    });

    const unsubRejected = onCallRejected((payload) => {
      setOutgoingCall(null);
      const msg = payload?.message || "Call was declined.";
      const toastId = `call-rejected-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.info(msg, { toastId, autoClose: 3500 });
      }
    });

    const unsubCancelled = onCallCancelled((payload) => {
      setIncomingCall(null);
      const toastId = `call-cancelled-${payload?.callId || "cancelled"}`;
      if (!toast.isActive(toastId)) {
        toast.info(payload?.message || "Call was cancelled.", { toastId, autoClose: 3500 });
      }
    });

    const unsubEnded = onCallEnded((payload) => {
      setActiveCall(null);
      setIncomingCall(null);
      setOutgoingCall(null);
      const msg = payload?.message || "Call ended";
      const toastId = `call-ended-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.info(msg, { toastId, autoClose: 3500 });
      }
    });

    const unsubBusy = onCallBusy((payload) => {
      setOutgoingCall(null);
      const msg = payload?.message || "User is currently in another call.";
      const toastId = `call-busy-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.warn(msg, { toastId, autoClose: 3500 });
      }
    });

    const unsubMissed = onCallMissed((payload) => {
      setIncomingCall(null);
      setOutgoingCall(null);
      const msg = payload?.message || "Missed call.";
      const toastId = `call-missed-${payload?.callId || msg}`;
      if (!toast.isActive(toastId)) {
        toast.info(msg, { toastId, autoClose: 3500 });
      }
      if (crmUserId) {
        fetchMissedCallsCount(crmUserId).then((cnt) => setMissedCallsCount(cnt)).catch(() => {});
      }
    });

    const unsubError = onCallError((payload) => {
      setOutgoingCall(null);
      const msg = String(payload?.message || "");
      if (msg.toLowerCase().includes("already in an active call")) {
        if (payload?.callId) {
          endCall(payload.callId);
        }
        toast.info("Cleared previous active call session. Please retry calling now.");
        return;
      }
      toast.error(payload?.message || "Call signaling error.");
    });

    const unsubStatus = onSosSocketStatus((status) => {
      setSocketOnline(!!status?.connected);
      if (status?.connected) requestPresence();
    });

    loadChatList();

    const unsubMsg = onChatMessage((raw) => {
      const msg = normalizeMessage(raw, crmUserId);
      const chatId = msg.chatId;
      if (!chatId || (!msg.message && !msg.attachment && (!msg.callInfo || !msg.callInfo.callId))) return;

      // Drop exact re-broadcasts (same DB id delivered via user room + chat room)
      if (msg._id && seenMessageIdsRef.current.has(msg._id)) {
        if (activeChatIdRef.current === chatId) {
          setMessages((prev) => {
            const hasPendingLocal = prev.some(
              (m) => String(m._id).startsWith("local-") && m.mine,
            );
            if (hasPendingLocal) {
              return prev
                .filter(
                  (m) =>
                    !String(m._id).startsWith("local-") || !m.mine,
                )
                .map((m) =>
                  m._id === msg._id
                    ? { ...m, ...msg, isRead: msg.isRead || m.isRead }
                    : m,
                );
            }
            return prev.map((m) =>
              m._id === msg._id
                ? { ...m, ...msg, isRead: msg.isRead || m.isRead }
                : m,
            );
          });
        }
        return;
      }
      if (msg._id) seenMessageIdsRef.current.add(msg._id);

      setChats((prev) => {
        const idx = prev.findIndex((c) => c.chatId === chatId);
        if (idx === -1) {
          loadChatList();
          return prev;
        }
        const next = [...prev];
        const item = { ...next[idx] };
        const displayPreview =
          msg.message || (msg.attachment ? "📎 Attachment" : "");
        item.lastMessage = displayPreview;
        item.lastMessageAt = msg.createdAt;
        if (activeChatIdRef.current !== chatId && !msg.mine) {
          item.unreadCount = Number(item.unreadCount || 0) + 1;
        }
        next.splice(idx, 1);
        return [item, ...next];
      });

      if (activeChatIdRef.current === chatId) {
        setMessages((prev) => mergeIncomingMessage(prev, msg));
        markChatReadSocket(chatId);
        scrollToBottom();
      }
    });

    const unsubRead = onChatRead((payload) => {
      if (!payload?.chatId) return;
      if (activeChatIdRef.current !== payload.chatId) return;

      const readerId = String(
        payload.readByUserId ??
        payload.userId ??
        payload.readerUserId ??
        "",
      );
      if (!readerId || readerId === String(crmUserId)) return;

      setMessages((prev) =>
        prev.map((m) => (m.mine ? { ...m, isRead: true } : m)),
      );
    });

    const unsubPresence = onPresenceUpdate((p) => {
      if (!p?.userId) return;
      const uid = String(p.userId);
      const online = !!(p.isOnline || p.status === "online");
      setChats((prev) =>
        prev.map((c) => {
          if (c.isGroup) return c;
          if (String(c.otherUser?.userId) !== uid) return c;
          return {
            ...c,
            isOnline: online,
            status: online ? "online" : "offline",
            otherUser: {
              ...c.otherUser,
              isOnline: online,
              status: online ? "online" : "offline",
              lastActivity: p.lastActivity || c.otherUser?.lastActivity,
            },
          };
        }),
      );
      setActiveChat((curr) => {
        if (
          !curr ||
          curr.isGroup ||
          String(curr.otherUser?.userId) !== uid
        )
          return curr;
        return {
          ...curr,
          isOnline: online,
          status: online ? "online" : "offline",
          otherUser: {
            ...curr.otherUser,
            isOnline: online,
            status: online ? "online" : "offline",
          },
        };
      });
    });

    const unsubMemberRemoved = onChatMemberRemoved((payload) => {
      const { chatId, memberId } = payload || {};
      if (!chatId || !memberId) return;

      const currentId = String(crmUserId);
      const targetId = String(memberId);

      if (targetId === currentId) {
        toast.info("You have been removed from the group conversation.");
        if (activeChatIdRef.current === chatId) {
          setUserRemovedFromActiveChat(true);
        }
        setChats((prev) => prev.filter((c) => c.chatId !== chatId));
      } else {
        if (activeChatIdRef.current === chatId) {
          toast.info("A member was removed from this group.");
          setActiveChat((curr) => {
            if (!curr || curr.chatId !== chatId) return curr;
            const nextMembers = (curr.members || []).filter(
              (m) =>
                String(
                  typeof m === "object" ? m.userId || m._id || m.id : m,
                ) !== targetId,
            );
            const nextIds = (curr.memberIds || []).filter(
              (id) => String(id) !== targetId,
            );
            return { ...curr, members: nextMembers, memberIds: nextIds };
          });
        }
        setChats((prev) =>
          prev.map((c) => {
            if (c.chatId !== chatId) return c;
            const nextMembers = (c.members || []).filter(
              (m) =>
                String(
                  typeof m === "object" ? m.userId || m._id || m.id : m,
                ) !== targetId,
            );
            const nextIds = (c.memberIds || []).filter(
              (id) => String(id) !== targetId,
            );
            return { ...c, members: nextMembers, memberIds: nextIds };
          }),
        );
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
      unsubRead();
      unsubPresence();
      unsubMemberRemoved();
      unsubRinging();
      unsubAccepted();
      unsubRejected();
      unsubCancelled();
      unsubEnded();
      unsubBusy();
      unsubMissed();
      unsubError();
    };
  }, [crmUserId, loadChatList, scrollToBottom]);


  // Initial fetch of missed calls count
  useEffect(() => {
    if (crmUserId) {
      fetchMissedCallsCount(crmUserId)
        .then((cnt) => setMissedCallsCount(cnt))
        .catch(() => {});
    }
  }, [crmUserId]);

  const handleStartCall = useCallback(
    (callType = "video", targetChat = activeChat) => {
      if (!targetChat) return;

      if (targetChat.isGroup) {
        initiateCall({
          chatId: targetChat.chatId,
          groupName: targetChat.chatName || "Group Call",
          callType,
        });
        const outData = {
          callId: null,
          callType,
          isGroup: true,
          groupName: targetChat.chatName || "Group Call",
          statusText: "Starting group session...",
          members: targetChat.members,
          chatId: targetChat.chatId,
        };
        setGlobalOutgoingCall(outData);
      } else {
        const receiverId =
          targetChat.otherUser?.userId ||
          targetChat.otherUser?._id ||
          targetChat.otherUser?.id ||
          targetChat.contactUserId;
        if (!receiverId) {
          toast.error("Cannot determine recipient ID for calling.");
          return;
        }
        initiateCall({
          receiverId,
          callType,
          chatId: targetChat.chatId,
        });
        const outData = {
          callId: null,
          callType,
          isGroup: false,
          targetName: targetChat.otherUser?.name || "User",
          targetRole: targetChat.otherUser?.role || targetChat.role || "Direct Call",
          targetImage: targetChat.otherUser?.profileImage || targetChat.otherUser?.image,
          statusText: "Calling...",
        };
        setGlobalOutgoingCall(outData);
      }
    },
    [activeChat]
  );

  const handleActiveCallClose = useCallback(() => {
    setActiveCall(null);
  }, []);

  const handleCallBack = useCallback(
    (targetUserId, callType = "audio") => {
      if (activeChat?.isGroup) {
        handleStartCall(callType, activeChat);
      } else {
        handleStartCall(callType);
      }
    },
    [activeChat, handleStartCall]
  );

  const handleStartCallFromHistory = useCallback(
    ({ receiverId, name, role, image, callType = "video" }) => {
      if (!receiverId) return;
      initiateCall({
        receiverId,
        callType,
      });
      setOutgoingCall({
        callId: null,
        callType,
        isGroup: false,
        targetName: name,
        targetRole: role,
        targetImage: image,
        statusText: "Calling...",
      });
    },
    []
  );
  const openConversationRef = useRef(openConversation);
  openConversationRef.current = openConversation;
  const startChatWithUserRef = useRef(startChatWithUser);
  startChatWithUserRef.current = startChatWithUser;

  // Register direct chat opener for instant switching from notification toasts
  useEffect(() => {
    const unsub = registerOpenChatHandler(async ({ chatId, userId, name, role }) => {
      if (chatId) {
        const existing = chatsRef.current.find((c) => c.chatId === chatId);
        await openConversationRef.current(
          existing || {
            chatId,
            chatName: name || "User",
            otherUser: {
              userId,
              name: name || "User",
              role: role || "",
            },
          }
        );
      } else if (userId) {
        await startChatWithUserRef.current(userId, { name: name || "User", role: role || "" });
      }
    });
    return unsub;
  }, []);

  // Open chat from navigation state (when navigating from other pages or notifications)
  useEffect(() => {
    const state = location.state;
    if (
      !state?.chatId &&
      !state?.openChatId &&
      !state?.patientUserId &&
      !state?.userId &&
      !state?.contactUserId &&
      !state?.staffUserId
    )
      return undefined;

    const targetChatId = state.chatId || state.openChatId;
    const targetUserId =
      state.userId ||
      state.contactUserId ||
      state.patientUserId ||
      state.staffUserId;
    const targetName =
      state.name || state.patientName || state.staffName || "User";
    const targetRole = state.role || state.staffRole || state.patientRole || "";

    const navKey = `${targetChatId || targetUserId}_${location.key || ""}`;
    if (handledNavKeyRef.current === navKey) {
      return undefined;
    }
    handledNavKeyRef.current = navKey;

    // Clear navigation state immediately so subsequent re-renders never re-trigger
    navigate(location.pathname, { replace: true, state: null });

    const run = async () => {
      if (targetChatId) {
        const existing = chatsRef.current.find((c) => c.chatId === targetChatId);
        await openConversationRef.current(
          existing || {
            chatId: targetChatId,
            chatName: targetName,
            otherUser: {
              userId: targetUserId,
              name: targetName,
              role: targetRole,
            },
          }
        );
      } else if (targetUserId) {
        await startChatWithUserRef.current(targetUserId, {
          name: targetName,
          role: targetRole,
        });
      }
    };

    run();
  }, [location.state, location.pathname, location.key, navigate]);

  useEffect(() => {
    if (skipAutoScrollBottomRef.current) {
      skipAutoScrollBottomRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat candidates for Create Group whenever candidateSearch or candidateType changes
  useEffect(() => {
    let active = true;
    setCandidateLoading(true);
    setCandidatePage(1);
    const handler = setTimeout(() => {
      fetchChatUsers({
        search: candidateSearch,
        type: candidateType,
        page: 1,
        limit: 50,
      })
        .then((list) => {
          if (active) {
            setCandidateMembers(list || []);
            setCandidateHasMore(Boolean(list?.pagination?.hasMore ?? ((list?.length || 0) >= 50)));
          }
        })
        .catch((err) => console.error("Error fetching chat users:", err))
        .finally(() => {
          if (active) setCandidateLoading(false);
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [candidateSearch, candidateType]);

  // Load chat users for Start New Chat modal whenever open, search, or type filter changes
  useEffect(() => {
    if (!isNewChatOpen) return;
    let active = true;
    setNewChatLoading(true);
    setNewChatPage(1);
    const handler = setTimeout(() => {
      fetchChatUsers({
        search: newChatSearch,
        type: newChatType,
        page: 1,
        limit: 50,
      })
        .then((list) => {
          if (active) {
            setNewChatUsers(list || []);
            setNewChatHasMore(Boolean(list?.pagination?.hasMore ?? ((list?.length || 0) >= 50)));
          }
        })
        .catch((err) => {
          console.error("fetchChatUsers for new chat error:", err);
          if (active) {
            setNewChatUsers([]);
            setNewChatHasMore(false);
          }
        })
        .finally(() => {
          if (active) setNewChatLoading(false);
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [isNewChatOpen, newChatSearch, newChatType]);

  const handleLoadMoreNewChat = useCallback(async () => {
    if (newChatLoading || newChatLoadingMore || !newChatHasMore) return;
    setNewChatLoadingMore(true);
    const nextPage = newChatPage + 1;
    try {
      const list = await fetchChatUsers({
        search: newChatSearch,
        type: newChatType,
        page: nextPage,
        limit: 50,
      });
      setNewChatUsers((prev) => {
        const existingIds = new Set(prev.map((u) => String(u.userId)));
        const newItems = (list || []).filter((u) => !existingIds.has(String(u.userId)));
        return [...prev, ...newItems];
      });
      setNewChatPage(nextPage);
      setNewChatHasMore(Boolean(list?.pagination?.hasMore ?? ((list?.length || 0) >= 50)));
    } catch (err) {
      console.error("fetchChatUsers load more error:", err);
    } finally {
      setNewChatLoadingMore(false);
    }
  }, [newChatLoading, newChatLoadingMore, newChatHasMore, newChatPage, newChatSearch, newChatType]);

  const handleLoadMoreCandidates = useCallback(async () => {
    if (candidateLoading || candidateLoadingMore || !candidateHasMore) return;
    setCandidateLoadingMore(true);
    const nextPage = candidatePage + 1;
    try {
      const list = await fetchChatUsers({
        search: candidateSearch,
        type: candidateType,
        page: nextPage,
        limit: 50,
      });
      setCandidateMembers((prev) => {
        const existingIds = new Set(prev.map((u) => String(u.userId)));
        const newItems = (list || []).filter((u) => !existingIds.has(String(u.userId)));
        return [...prev, ...newItems];
      });
      setCandidatePage(nextPage);
      setCandidateHasMore(Boolean(list?.pagination?.hasMore ?? ((list?.length || 0) >= 50)));
    } catch (err) {
      console.error("fetchChatUsers candidate load more error:", err);
    } finally {
      setCandidateLoadingMore(false);
    }
  }, [candidateLoading, candidateLoadingMore, candidateHasMore, candidatePage, candidateSearch, candidateType]);

  const handleNewChatUsersScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      handleLoadMoreNewChat();
    }
  };

  const handleCandidatesScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      handleLoadMoreCandidates();
    }
  };

  const handleSelectUserForChat = async (user) => {
    if (!user?.userId) return;
    if (String(user.userId) === String(crmUserId)) {
      toast.error("You cannot start a chat with yourself");
      return;
    }
    setIsNewChatOpen(false);

    // Check if conversation already exists in local chats list
    const existingChat = chats.find(
      (c) =>
        !c.isGroup &&
        (String(c.otherUser?.userId) === String(user.userId) ||
          (Array.isArray(c.memberIds) && c.memberIds.includes(String(user.userId)))),
    );

    if (existingChat) {
      await openConversation(existingChat);
      return;
    }

    // Otherwise initiate chat with the user
    await startChatWithUser(user.userId, {
      name: user.name,
      role: user.role,
      userType: user.userType,
      profileImage: user.image,
    });
  };

  const userMap = useMemo(() => {
    const map = {};
    (candidateMembers || []).forEach((m) => {
      if (m.userId) {
        map[String(m.userId)] = {
          ...m,
          role: m.role || "Member",
          userType: m.userType || "",
        };
      }
    });
    (newChatUsers || []).forEach((u) => {
      if (u.userId) {
        map[String(u.userId)] = {
          ...u,
          role: u.role || "User",
          userType: u.userType || "",
        };
      }
    });
    (chats || []).forEach((c) => {
      if (c.otherUser?.userId) {
        map[String(c.otherUser.userId)] = {
          userId: String(c.otherUser.userId),
          name: c.otherUser.name,
          image: c.otherUser.profileImage,
          role: c.otherUser.role,
          userType: c.otherUser.userType,
          phone: c.otherUser.status,
        };
      }
      if (Array.isArray(c.members)) {
        c.members.forEach((m) => {
          if (m && typeof m === "object" && m.userId) {
            map[String(m.userId)] = {
              userId: String(m.userId),
              name: m.name,
              image: m.image,
              role: m.role,
              userType: m.userType,
              phone: m.phone,
            };
          }
        });
      }
    });
    if (typeof window !== "undefined") {
      window.__omca_user_map = map;
    }
    return map;
  }, [candidateMembers, chats, newChatUsers]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chats.filter((c) => {
      if (chatFilterTab === "direct" && c.isGroup) return false;
      if (chatFilterTab === "groups" && !c.isGroup) return false;
      if (!q) return true;
      const name = (c.chatName || c.otherUser?.name || "").toLowerCase();
      const last = (c.lastMessage || "").toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [chats, search, chatFilterTab]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    const file = attachmentFile;

    if (
      (!text && !file) ||
      !activeChat?.chatId ||
      sending ||
      sendingRef.current ||
      userRemovedFromActiveChat
    ) {
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setDraft("");
    setShowEmojiPicker(false);
    handleClearAttachment();

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const optimistic = normalizeMessage(
      {
        _id: localId,
        chatId: activeChat.chatId,
        message: text,
        attachment: attachmentPreview || (file ? URL.createObjectURL(file) : null),
        attachmentName: file?.name,
        attachmentType: file?.type,
        attachmentSize: file?.size,
        senderUserId: crmUserId,
        senderName: "You",
        createdAt: new Date().toISOString(),
        isMine: true,
        isRead: false,
        isGroup: activeChat.isGroup,
      },
      crmUserId,
    );

    setMessages((prev) => [...prev, optimistic]);
    setChats((prev) => {
      const next = prev.filter((c) => c.chatId !== activeChat.chatId);
      return [
        {
          ...activeChat,
          lastMessage: text || (file ? "📎 Attachment" : ""),
          lastMessageAt: optimistic.createdAt,
          unreadCount: 0,
        },
        ...next,
      ];
    });
    scrollToBottom();

    try {
      // If uploading an attachment, send via multipart/form-data REST API
      if (file) {
        const restResult = await sendChatMessageRest({
          message: text,
          chatId: activeChat.chatId,
          contactUserId: activeChat.otherUser?.userId,
          attachment: file,
          userId: crmUserId,
        });
        const confirmedRaw =
          restResult?.message && typeof restResult.message === "object"
            ? restResult.message
            : restResult?.data && typeof restResult.data === "object"
              ? restResult.data
              : typeof restResult === "object"
                ? restResult
                : {};
        const confirmed = normalizeMessage(
          {
            ...confirmedRaw,
            attachmentName: confirmedRaw.attachmentName || file?.name,
            attachmentType: confirmedRaw.attachmentType || file?.type,
            attachmentSize: confirmedRaw.attachmentSize || file?.size,
            message: confirmedRaw.message || text,
            chatId: activeChat.chatId,
            senderUserId: crmUserId,
            isMine: true,
          },
          crmUserId,
        );
        if (confirmed._id) seenMessageIdsRef.current.add(confirmed._id);
        setMessages((prev) => {
          const hasLocal = prev.some((m) => m._id === localId);
          if (hasLocal) {
            return prev.map((m) => (m._id === localId ? confirmed : m));
          }
          return mergeIncomingMessage(prev, confirmed);
        });
      } else {
        // Plain text message: prefer Socket (or fallback to REST)
        let sent = false;
        if (!activeChat.isGroup) {
          sent = sendChatMessageSocket({
            message: text,
            chatId: activeChat.chatId,
            contactUserId: activeChat.otherUser?.userId,
          });
        }
        if (!sent) {
          const restResult = await sendChatMessageRest({
            message: text,
            chatId: activeChat.chatId,
            contactUserId: activeChat.otherUser?.userId,
            userId: crmUserId,
          });
          const confirmedRaw =
            restResult?.message && typeof restResult.message === "object"
              ? restResult.message
              : restResult?.data && typeof restResult.data === "object"
                ? restResult.data
                : typeof restResult === "object"
                  ? restResult
                  : {};
          const confirmed = normalizeMessage(
            {
              ...confirmedRaw,
              message: confirmedRaw.message || text,
              chatId: activeChat.chatId,
              senderUserId: crmUserId,
              isMine: true,
            },
            crmUserId,
          );
          if (confirmed._id) seenMessageIdsRef.current.add(confirmed._id);
          setMessages((prev) => {
            const hasLocal = prev.some((m) => m._id === localId);
            if (hasLocal) {
              return prev.map((m) => (m._id === localId ? confirmed : m));
            }
            return mergeIncomingMessage(prev, confirmed);
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m._id !== localId));
      setDraft(text);
      if (file) setAttachmentFile(file);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // Create Group submission
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (selectedMemberIds.length === 0) {
      toast.error("Please select at least one member to add");
      return;
    }

    setCreatingGroup(true);
    try {
      const response = await createGroupChat({
        name: newGroupName.trim(),
        memberIds: selectedMemberIds,
        userId: crmUserId,
      });
      const data = response?.data || response;
      const createdChatId = data?.chatId || data?.chat?.chatId || data?.id;

      // Call POST /chat/group/add-member endpoint
      if (createdChatId && selectedMemberIds.length > 0) {
        try {
          await addGroupMembers({
            userId: crmUserId,
            chatId: createdChatId,
            memberIds: selectedMemberIds,
          });
        } catch (addErr) {
          console.log("Notice calling add-member endpoint:", addErr);
        }
      }

      const addedParticipants = data?.participants || [];
      const addedIds = new Set(
        addedParticipants.map((p) => String(p.userId || p.user_id || p._id || p.id))
      );
      const skippedMembers = selectedMemberIds
        .filter((id) => !addedIds.has(String(id)))
        .map((id) => {
          const m = candidateMembers.find((c) => String(c.userId) === String(id));
          return m?.name || `User ${id}`;
        });

      if (skippedMembers.length > 0) {
        toast.warning(
          `Group ban gaya, lekin ${skippedMembers.join(", ")} database me deleted/inactive hone ki wajah se server ne add nahi kiya.`,
          { autoClose: 6000 }
        );
      } else {
        toast.success("Group created successfully!");
      }

      setIsCreateGroupOpen(false);
      setNewGroupName("");
      setSelectedMemberIds([]);

      const newGroup = normalizeChat({
        ...data,
        chatName: newGroupName.trim(),
        isGroup: true,
        status: "group",
        admin: crmUserId,
        memberIds:
          Array.isArray(data?.participants) && data.participants.length > 0
            ? data.participants.map((p) => String(p.userId || p.user_id || p._id || p.id))
            : [String(crmUserId), ...selectedMemberIds.map(String)],
      });

      setChats((prev) => [newGroup, ...prev]);
      await openConversation(newGroup);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddMembersToActiveGroup = async () => {
    if (!activeChat?.chatId || addMemberSelectedIds.length === 0) return;
    setAddingMembers(true);
    try {
      await addGroupMembers({
        userId: crmUserId,
        chatId: activeChat.chatId,
        memberIds: addMemberSelectedIds,
      });
      toast.success("Members added to group successfully!");
      const updatedMemberIds = Array.from(
        new Set([...(activeChat.memberIds || []), ...addMemberSelectedIds]),
      );
      setActiveChat((prev) => ({
        ...prev,
        memberIds: updatedMemberIds,
      }));
      setChats((prev) =>
        prev.map((c) =>
          c.chatId === activeChat.chatId
            ? { ...c, memberIds: updatedMemberIds }
            : c,
        ),
      );
      setAddMemberSelectedIds([]);
      setAddMemberSearch("");
      setIsAddMemberSectionOpen(false);
    } catch (err) {
      console.error("Error adding members to group:", err);
      toast.error(err?.response?.data?.message || "Failed to add members");
    } finally {
      setAddingMembers(false);
    }
  };

  // Remove member from group
  const handleRemoveMember = async (memberId, memberName) => {
    if (!activeChat?.chatId || !memberId) return;

    const result = await Swal.fire({
      title: `Remove ${memberName || "member"}?`,
      text: "This user will be removed from the group conversation.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove",
    });

    if (!result.isConfirmed) return;

    try {
      await removeGroupMember({
        chatId: activeChat.chatId,
        memberId,
        userId: crmUserId,
      });
      toast.success("Member removed from group");
      setActiveChat((curr) => {
        if (!curr) return curr;
        const nextMembers = (curr.members || []).filter(
          (m) =>
            String(
              typeof m === "object" ? m.userId || m._id || m.id : m,
            ) !== String(memberId),
        );
        const nextIds = (curr.memberIds || []).filter(
          (id) => String(id) !== String(memberId),
        );
        return { ...curr, members: nextMembers, memberIds: nextIds };
      });
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to remove member");
    }
  };

  // Leave group
  const handleLeaveGroup = async () => {
    if (!activeChat?.chatId) return;

    const result = await Swal.fire({
      title: "Leave group?",
      text: "You will no longer receive messages from this group.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, leave group",
    });

    if (!result.isConfirmed) return;

    try {
      await removeGroupMember({
        chatId: activeChat.chatId,
        memberId: crmUserId,
        userId: crmUserId,
      });
      toast.success("You left the group");
      setIsGroupInfoOpen(false);
      setChats((prev) => prev.filter((c) => c.chatId !== activeChat.chatId));
      setActiveChat(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to leave group");
    }
  };

  const toggleSelectMember = (userId) => {
    const id = String(userId);
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="page-wrapper crm-messages-layout">
      <div className="content">
        <div className="crm-chat-page">
          {/* Top Header */}
          <div className="crm-chat-header-bar">
            <div>
              <h4 className="page-title mb-0">Messages</h4>
              <p className="crm-chat-subtitle">
                Direct and group messaging in real time
              </p>
            </div>
            <div
              className={`crm-chat-presence ${socketOnline ? "is-online" : "is-offline"
                }`}
              title={
                socketOnline
                  ? "Connected to real-time chat server"
                  : "Connecting…"
              }
            >
              <span className="crm-chat-presence-dot" />
              {socketOnline ? "Online" : "Connecting"}
            </div>
          </div>

          {/* Main Shell */}
          <div
            className={`crm-chat-shell ${activeChat ? "has-active-chat" : "no-active-chat"
              }`}
          >
            {/* Sidebar */}
            <aside className="crm-chat-sidebar">
              <div className="crm-chat-sidebar-header">
                <div className="crm-chat-sidebar-top-row">
                  <div className="crm-chat-filter-pills-row">
                    <div className="crm-chat-filter-pills">
                      <button
                        type="button"
                        className={`crm-chat-filter-pill ${chatFilterTab === "all" ? "active" : ""
                          }`}
                        onClick={() => setChatFilterTab("all")}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`crm-chat-filter-pill ${chatFilterTab === "direct" ? "active" : ""
                          }`}
                        onClick={() => setChatFilterTab("direct")}
                      >
                        Direct
                      </button>
                      <button
                        type="button"
                        className={`crm-chat-filter-pill ${chatFilterTab === "groups" ? "active" : ""
                          }`}
                        onClick={() => setChatFilterTab("groups")}
                      >
                        Groups
                      </button>
                      <button
                        type="button"
                        className={`crm-chat-filter-pill ${chatFilterTab === "calls" ? "active" : ""
                          }`}
                        onClick={() => setChatFilterTab("calls")}
                      >
                        <i className="fa fa-phone me-1" style={{ fontSize: 11 }} />
                        Calls
                        {missedCallsCount > 0 && (
                          <span className="crm-calls-badge ms-1">{missedCallsCount}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="crm-chat-top-actions">
                    <button
                      type="button"
                      className="crm-chat-new-chat-btn"
                      onClick={() => {
                        setIsNewChatOpen(true);
                        setNewChatSearch("");
                        setNewChatType("all");
                      }}
                      title="Start a new chat with staff or patient"
                    >
                      <i className="fa fa-comment-medical" /> New Chat
                    </button>
                    <button
                      type="button"
                      className="crm-chat-new-group-btn"
                      onClick={() => setIsCreateGroupOpen(true)}
                      title="Create a new group"
                    >
                      <i className="fa fa-users" /> New Group
                    </button>
                  </div>
                </div>

                <div className="crm-chat-search">
                  <i className="fa fa-search" />
                  <input
                    type="search"
                    placeholder="Search conversations…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Chat list */}
              <div className="crm-chat-list">
                {chatFilterTab === "calls" ? (
                  <CallHistoryTab
                    onStartCall={handleStartCallFromHistory}
                    onMissedCountChange={setMissedCallsCount}
                  />
                ) : listLoading ? (
                  <div className="crm-chat-empty">Loading chats…</div>
                ) : filteredChats.length === 0 ? (
                  <div className="crm-chat-empty">
                    <div className="crm-chat-empty-icon">
                      <i className="fa fa-comments" />
                    </div>
                    <div className="crm-chat-empty-title">No conversations found</div>
                    <span className="text-muted">
                      Start a chat with a patient or staff member, or create a group.
                    </span>
                    <div className="crm-chat-empty-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setIsNewChatOpen(true);
                          setNewChatSearch("");
                          setNewChatType("all");
                        }}
                      >
                        <i className="fa fa-comment-medical me-1" /> New Chat
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setIsCreateGroupOpen(true)}
                      >
                        <i className="fa fa-users me-1" /> New Group
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredChats.map((chat, idx) => {
                    const active = activeChat?.chatId === chat.chatId;
                    return (
                      <button
                        type="button"
                        key={chat.chatId ? `${chat.chatId}-${idx}` : `chat-${idx}`}
                        className={`crm-chat-list-item ${active ? "active" : ""
                          }`}
                        onClick={() => openConversation(chat)}
                      >
                        <div className="crm-chat-avatar-wrap">
                          <ChatAvatar
                            name={chat.chatName || chat.otherUser?.name}
                            src={chat.otherUser?.profileImage}
                            isGroup={chat.isGroup}
                          />
                          {chat.isGroup ? (
                            <span className="crm-chat-status-dot group">
                              <i className="fa fa-users" />
                            </span>
                          ) : (
                            <span
                              className={`crm-chat-status-dot ${chat.isOnline ? "online" : "offline"
                                }`}
                            />
                          )}
                        </div>
                        <div className="crm-chat-list-meta">
                          <div className="crm-chat-list-top">
                            <strong className="d-flex align-items-center gap-1">
                              <span className="crm-chat-list-name">
                                {chat.chatName || chat.otherUser?.name}
                              </span>
                              <UnreadDot unread={chat.isUnread === true} />
                              {chat.isGroup ? (
                                <span className="crm-chat-group-badge">
                                  Group
                                </span>
                              ) : (
                                (chat.otherUser?.role || chat.role) && (
                                  <RoleBadge
                                    role={chat.otherUser?.role || chat.role}
                                    size="sm"
                                  />
                                )
                              )}
                            </strong>
                            <small>{formatTime(chat.lastMessageAt)}</small>
                          </div>
                          <div className="crm-chat-list-bottom">
                            <span className="crm-chat-preview">
                              {(() => {
                                const raw = chat.lastMessage;
                                if (!raw) return "No messages yet";
                                const lower = raw.toLowerCase();
                                const isCall =
                                  raw.startsWith("📞") ||
                                  raw.startsWith("📹") ||
                                  /^(missed|cancelled|canceled|declined|rejected)\s+(audio|video)\s+call/i.test(raw) ||
                                  /^(audio|video)\s+call\s+(ended|declined|missed|cancelled|canceled|busy|\(busy\))/i.test(raw);
                                if (isCall) {
                                  const isVideo =
                                    lower.includes("video") || raw.includes("📹");
                                  const isMissed =
                                    lower.includes("missed") ||
                                    lower.includes("cancelled") ||
                                    lower.includes("busy");
                                  const color = isMissed ? "#e11d48" : "#16a34a";
                                  const clean = cleanCallMessageText(raw);
                                  return (
                                    <span className="d-inline-flex align-items-center gap-1">
                                      {isVideo ? (
                                        <MdVideocam size={14} color={color} />
                                      ) : isMissed ? (
                                        <MdCallMissed size={14} color={color} />
                                      ) : (
                                        <MdCall size={14} color={color} />
                                      )}
                                      <span style={{ color }}>{clean}</span>
                                    </span>
                                  );
                                }
                                return raw;
                              })()}
                            </span>
                            {chat.unreadCount > 0 ? (
                              <em className="crm-chat-unread">
                                {chat.unreadCount > 99
                                  ? "99+"
                                  : chat.unreadCount}
                              </em>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Conversation View */}
            <section className="crm-chat-main">
              {!activeChat ? (
                <div className="crm-chat-placeholder">
                  <div className="crm-chat-placeholder-icon">
                    <i className="fa fa-comments" />
                  </div>
                  <h5>Select a conversation</h5>
                  <p>
                    Choose a chat from the left, search users to start a new chat,
                    or create a group conversation.
                  </p>
                </div>
              ) : (
                <>
                  {/* Thread Header */}
                  <div className="crm-chat-thread-header">
                    <button
                      type="button"
                      className="crm-chat-back-btn"
                      onClick={() => setActiveChat(null)}
                      title="Back to conversations"
                      aria-label="Back to conversations"
                    >
                      <i className="fa fa-arrow-left" />
                    </button>
                    <div className="crm-chat-avatar-wrap">
                      <ChatAvatar
                        name={activeChat.chatName || activeChat.otherUser?.name}
                        src={activeChat.otherUser?.profileImage}
                        size="lg"
                        isGroup={activeChat.isGroup}
                      />
                    </div>
                    <div className="crm-chat-thread-user">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h5 className="mb-0">
                          {activeChat.chatName || activeChat.otherUser?.name}
                        </h5>
                        {activeChat.isGroup ? (
                          <span className="crm-chat-group-badge">Group</span>
                        ) : (
                          (() => {
                            const role = activeChat.otherUser?.role || activeChat.role;
                            const userType = activeChat.otherUser?.userType || activeChat.userType;
                            const isSame =
                              String(role || "").trim().toLowerCase() ===
                              String(userType || "").trim().toLowerCase();
                            return (
                              <>
                                {role && <RoleBadge role={role} />}
                                {userType && !isSame && <UserTypeBadge type={userType} />}
                              </>
                            );
                          })()
                        )}
                      </div>
                      <small
                        className={
                          activeChat.isGroup
                            ? "text-muted"
                            : activeChat.isOnline
                              ? "text-online"
                              : "text-offline"
                        }
                      >
                        {activeChat.isGroup
                          ? `${activeChat.memberIds?.length || activeChat.members?.length || 0} participants`
                          : activeChat.isOnline
                            ? "Online"
                            : "Offline"}
                      </small>
                    </div>

                    <div className="crm-chat-thread-actions">
                      <button
                        type="button"
                        className="crm-chat-header-call-btn btn-audio"
                        onClick={() => handleStartCall("audio")}
                        title="Start Audio Call"
                      >
                        <i className="fa fa-phone" />
                        <span className="crm-call-btn-text">Call</span>
                      </button>
                      <button
                        type="button"
                        className="crm-chat-header-call-btn btn-video"
                        onClick={() => handleStartCall("video")}
                        title="Start Video Call"
                      >
                        <i className="fa fa-video" />
                        <span className="crm-call-btn-text">Video</span>
                      </button>
                      {activeChat.isGroup && (
                        <button
                          type="button"
                          className="crm-chat-header-btn"
                          onClick={() => {
                            setIsGroupInfoOpen(true);
                            if (!activeChat.memberIds || activeChat.memberIds.length === 0) {
                              setIsAddMemberSectionOpen(true);
                            }
                          }}
                          title="View Group Details & Members"
                        >
                          <i className="fa fa-info-circle" /> Group Info
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Removed from group banner if applicable */}
                  {userRemovedFromActiveChat && (
                    <div className="crm-chat-removed-banner">
                      <i className="fa fa-exclamation-triangle" />
                      <span>
                        You have been removed from this group and cannot send
                        messages.
                      </span>
                    </div>
                  )}

                  {/* Messages Feed */}
                  <div
                    className="crm-chat-thread-body"
                    ref={threadBodyRef}
                    onScroll={handleThreadScroll}
                  >
                    {/* History pagination banner */}
                    {loadingAllHistory && (
                      <div className="crm-chat-history-banner loading">
                        <i className="fa fa-spinner fa-spin" />
                        <span>
                          Loading conversation history ({messages.length} / {chatPagination.total || "..."})...
                        </span>
                      </div>
                    )}

                    {!loadingAllHistory && chatPagination.hasMore && (
                      <div className="crm-chat-history-banner">
                        <span className="crm-chat-history-info">
                          Showing latest {messages.length} of {chatPagination.total} messages
                        </span>
                        <div className="crm-chat-history-actions">
                          <button
                            type="button"
                            className="btn-history-load"
                            onClick={loadOlderMessages}
                            disabled={loadingOlder}
                          >
                            {loadingOlder ? (
                              <>
                                <i className="fa fa-spinner fa-spin" /> Loading...
                              </>
                            ) : (
                              <>
                                <i className="fa fa-arrow-up" /> Load Older
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn-history-load-all"
                            onClick={loadAllHistory}
                          >
                            <i className="fa fa-history" /> Load All ({chatPagination.total})
                          </button>
                        </div>
                      </div>
                    )}

                    {!loadingAllHistory && !chatPagination.hasMore && messages.length > 0 && (
                      <div className="crm-chat-beginning-pill">
                        <i className="fa fa-lock" />
                        <span>Beginning of conversation history · {messages.length} messages</span>
                      </div>
                    )}

                    {messagesLoading ? (
                      <div className="crm-chat-empty">Loading messages…</div>
                    ) : messages.length === 0 ? (
                      <div className="crm-chat-empty">
                        No messages yet. Say hello.
                      </div>
                    ) : (
                      messages.map((msg, idx) => {
                        const prevMsg = idx > 0 ? messages[idx - 1] : null;
                        const currentMsgDate = getMessageDateKey(msg.createdAt || msg.timestamp);
                        const prevMsgDate = prevMsg ? getMessageDateKey(prevMsg.createdAt || prevMsg.timestamp) : null;
                        const showDateDivider = Boolean(currentMsgDate && currentMsgDate !== prevMsgDate);

                        const isCallEvent = Boolean(msg.callInfo && msg.callInfo.callId);

                        const isImage = !isCallEvent && isImageAttachment(
                          msg.attachment,
                          msg.attachmentType,
                          msg.attachmentName,
                        );
                        const fileUrl = !isCallEvent ? resolveAttachmentUrl(msg.attachment) : "";

                        return (
                          <React.Fragment key={msg._id ? `${msg._id}-${idx}` : `chat-item-${idx}`}>
                            {showDateDivider && (
                              <div className="crm-chat-date-separator">
                                <span>{formatDateDividerLabel(msg.createdAt || msg.timestamp)}</span>
                              </div>
                            )}

                            {isCallEvent ? (
                              <CallCardMessage
                                msg={msg}
                                currentUserId={crmUserId}
                                onCallBack={handleCallBack}
                              />
                            ) : (
                              <div
                                className={`crm-chat-bubble-row ${msg.mine ? "mine" : "theirs"}`}
                              >
                                <div className="crm-chat-bubble">
                                  {/* Sender name & role for group chats */}
                                  {!msg.mine && activeChat.isGroup && (
                                    <div className="crm-chat-sender-line">
                                      <span className="crm-chat-sender-name">
                                        {msg.senderName ||
                                          userMap[msg.senderUserId]?.name ||
                                          `Member ${msg.senderUserId?.slice(-4) || ""}`}
                                      </span>
                                      {(msg.senderRole || userMap[msg.senderUserId]?.role) && (
                                        <RoleBadge
                                          role={msg.senderRole || userMap[msg.senderUserId]?.role}
                                          size="xs"
                                        />
                                      )}
                                    </div>
                                  )}

                                  {/* Attachment Card / Image */}
                                  {msg.attachment && (
                                    <div className="crm-chat-attachment-box">
                                      {isImage ? (
                                        <div
                                          className="crm-chat-attachment-image-wrap"
                                          onClick={() => setLightboxImage(fileUrl)}
                                          title="Click to enlarge"
                                        >
                                          <img
                                            src={fileUrl}
                                            alt={msg.attachmentName || "Attachment"}
                                            className="crm-chat-attachment-image"
                                          />
                                          <div className="crm-chat-attachment-overlay">
                                            <i className="fa fa-search-plus" />
                                          </div>
                                        </div>
                                      ) : (
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download
                                          className="crm-chat-file-card"
                                        >
                                          <i
                                            className={`crm-chat-file-icon ${getFileIcon(
                                              msg.attachment,
                                              msg.attachmentType,
                                              msg.attachmentName,
                                            )}`}
                                          />
                                          <div className="crm-chat-file-info">
                                            <span className="crm-chat-file-name">
                                              {msg.attachmentName ||
                                                "Attached Document"}
                                            </span>
                                            <span className="crm-chat-file-action">
                                              <i className="fa fa-download" />{" "}
                                              Download
                                              {msg.attachmentSize
                                                ? ` (${formatFileSize(
                                                  msg.attachmentSize,
                                                )})`
                                                : ""}
                                            </span>
                                          </div>
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {/* Text message */}
                                  {msg.message && <p>{msg.message}</p>}

                                  <div className="crm-chat-meta">
                                    <time>{formatTime(msg.createdAt)}</time>
                                    <MessageTicks msg={msg} />
                                  </div>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Composer with Attachment & Emoji support */}
                  {!userRemovedFromActiveChat && (
                    <div className="crm-chat-composer-wrap">
                      {/* Emoji Picker Popover */}
                      {showEmojiPicker && (
                        <div
                          className="crm-chat-emoji-picker-container"
                          ref={emojiPickerRef}
                        >
                          <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            autoFocusSearch={false}
                            width={320}
                            height={380}
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      )}

                      {/* Attachment Preview */}
                      {attachmentFile && (
                        <div className="crm-chat-attachment-preview">
                          {attachmentPreview ? (
                            <img
                              src={attachmentPreview}
                              alt="Preview"
                              className="crm-chat-attachment-preview-thumb"
                            />
                          ) : (
                            <div className="crm-chat-attachment-preview-icon">
                              <i
                                className={getFileIcon(
                                  attachmentFile.name,
                                  attachmentFile.type,
                                )}
                              />
                            </div>
                          )}
                          <div className="crm-chat-attachment-preview-meta">
                            <div className="crm-chat-attachment-preview-name">
                              {attachmentFile.name}
                            </div>
                            <div className="crm-chat-attachment-preview-size">
                              {formatFileSize(attachmentFile.size)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="crm-chat-attachment-remove-btn"
                            onClick={handleClearAttachment}
                            title="Remove attachment"
                          >
                            <i className="fa fa-times" />
                          </button>
                        </div>
                      )}

                      <form className="crm-chat-composer" onSubmit={handleSend}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: "none" }}
                          onChange={handleAttachmentChange}
                        />

                        <button
                          type="button"
                          className="crm-chat-attach-btn"
                          onClick={() => fileInputRef.current?.click()}
                          title="Attach file or image"
                          disabled={sending}
                        >
                          <i className="fa fa-paperclip" />
                        </button>

                        <button
                          type="button"
                          className={`crm-chat-emoji-btn ${showEmojiPicker ? "active" : ""
                            }`}
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          title="Insert emoji"
                          disabled={sending}
                        >
                          <i className="fa fa-smile" />
                        </button>

                        <input
                          type="text"
                          placeholder={
                            attachmentFile
                              ? "Add a caption (optional)…"
                              : "Type a message…"
                          }
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          disabled={sending}
                          autoComplete="off"
                        />

                        <button
                          type="submit"
                          className="crm-chat-send-btn"
                          disabled={(!draft.trim() && !attachmentFile) || sending}
                          title="Send"
                        >
                          {sending ? (
                            <i className="fa fa-spinner fa-spin" />
                          ) : (
                            <i className="fa fa-paper-plane" />
                          )}
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* CREATE GROUP MODAL */}
      {isCreateGroupOpen && (
        <div className="crm-chat-modal-backdrop">
          <div className="crm-chat-modal">
            <div className="crm-chat-modal-header">
              <h4>Create New Group</h4>
              <button
                type="button"
                className="crm-chat-modal-close-btn"
                onClick={() => setIsCreateGroupOpen(false)}
              >
                <i className="fa fa-times" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit}>
              <div className="crm-chat-modal-body">
                <div className="crm-chat-form-group">
                  <label>Group Name</label>
                  <input
                    type="text"
                    className="crm-chat-input-text"
                    placeholder="e.g. Cardiology Support Team"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>

                <div className="crm-chat-form-group">
                  <label>
                    Select Members ({selectedMemberIds.length} selected)
                  </label>

                  {/* Selected member chips */}
                  {selectedMemberIds.length > 0 && (
                    <div className="crm-chat-selected-tags">
                      {selectedMemberIds.map((id) => {
                        const m = candidateMembers.find(
                          (c) => String(c.userId) === String(id),
                        );
                        return (
                          <span key={id} className="crm-chat-selected-tag">
                            {m?.name || `User ${id}`}
                            <button
                              type="button"
                              onClick={() => toggleSelectMember(id)}
                            >
                              <i className="fa fa-times" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Filter tabs: All | Staff | Patients */}
                  <div className="crm-user-filter-tabs mb-2">
                    <button
                      type="button"
                      className={`crm-user-filter-tab ${candidateType === "all" ? "active" : ""
                        }`}
                      onClick={() => setCandidateType("all")}
                    >
                      <i className="fa fa-th-large me-1" /> All
                    </button>
                    <button
                      type="button"
                      className={`crm-user-filter-tab ${candidateType === "staff" ? "active" : ""
                        }`}
                      onClick={() => setCandidateType("staff")}
                    >
                      <i className="fa fa-user-tie me-1" /> Staff
                    </button>
                    <button
                      type="button"
                      className={`crm-user-filter-tab ${candidateType === "patient" ? "active" : ""
                        }`}
                      onClick={() => setCandidateType("patient")}
                    >
                      <i className="fa fa-user-injured me-1" /> Patients
                    </button>
                  </div>

                  {/* Member search bar */}
                  <div className="crm-chat-member-search">
                    <i className="fa fa-search" />
                    <input
                      type="search"
                      placeholder={
                        candidateType === "staff"
                          ? "Search staff by name, role, email..."
                          : candidateType === "patient"
                            ? "Search patients by name, phone, ID..."
                            : "Search patient / staff name, role…"
                      }
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                    />
                    {candidateSearch && (
                      <button
                        type="button"
                        className="crm-search-clear-btn"
                        onClick={() => setCandidateSearch("")}
                      >
                        <i className="fa fa-times" />
                      </button>
                    )}
                  </div>

                  {/* Candidates List */}
                  <div
                    className="crm-chat-candidates-list"
                    onScroll={handleCandidatesScroll}
                  >
                    {candidateLoading ? (
                      <div className="crm-chat-empty py-3">
                        <i className="fa fa-spinner fa-spin me-2 text-primary" />
                        <span>Loading candidates…</span>
                      </div>
                    ) : candidateMembers.length === 0 ? (
                      <div className="crm-chat-empty">No members found.</div>
                    ) : (
                      <>
                        {candidateMembers.map((cand) => {
                          const isSelected = selectedMemberIds.includes(
                            String(cand.userId),
                          );
                          return (
                            <div
                              key={cand.userId}
                              className={`crm-chat-candidate-row ${isSelected ? "selected" : ""
                                }`}
                              onClick={() => toggleSelectMember(cand.userId)}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }}
                                style={{ pointerEvents: "none" }}
                              />
                              <div className="crm-chat-avatar-wrap">
                                <ChatAvatar name={cand.name} src={cand.image} />
                                <span
                                  className={`crm-chat-status-dot ${cand.isOnline ? "online" : "offline"
                                    }`}
                                />
                              </div>
                              <div className="crm-chat-candidate-info">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span className="crm-chat-candidate-name">
                                    {cand.name}
                                  </span>
                                  {cand.isOnline && (
                                    <span
                                      className="badge bg-success"
                                      style={{ fontSize: "9px", padding: "1px 5px" }}
                                    >
                                      Online
                                    </span>
                                  )}
                                  {cand.role && (
                                    <RoleBadge role={cand.role} size="sm" />
                                  )}
                                  {cand.userType && (
                                    <UserTypeBadge
                                      type={cand.userType}
                                      db={cand.db}
                                      size="sm"
                                    />
                                  )}
                                </div>
                                <span className="crm-chat-candidate-sub">
                                  {cand.phone || cand.email || `ID: ${cand.userId}`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {candidateLoadingMore && (
                          <div className="crm-chat-empty py-2 text-center">
                            <i className="fa fa-spinner fa-spin me-2 text-primary" />
                            <small>Loading more candidates…</small>
                          </div>
                        )}
                        {!candidateLoading && !candidateLoadingMore && candidateHasMore && (
                          <div className="text-center py-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={handleLoadMoreCandidates}
                            >
                              <i className="fa fa-chevron-down me-1" /> Load more candidates
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="crm-chat-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateGroupOpen(false)}
                  disabled={creatingGroup}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingGroup || !newGroupName.trim() || selectedMemberIds.length === 0}
                >
                  {creatingGroup ? "Creating…" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GROUP INFO MODAL */}
      {isGroupInfoOpen && activeChat?.isGroup && (
        <div className="crm-chat-modal-backdrop">
          <div className="crm-chat-modal">
            <div className="crm-chat-modal-header">
              <h4>Group Details</h4>
              <button
                type="button"
                className="crm-chat-modal-close-btn"
                onClick={() => setIsGroupInfoOpen(false)}
              >
                <i className="fa fa-times" />
              </button>
            </div>

            <div className="crm-chat-modal-body">
              <div className="crm-chat-group-info-hero">
                <ChatAvatar
                  name={activeChat.chatName}
                  size="lg"
                  isGroup={true}
                />
                <h5 className="mb-0">{activeChat.chatName}</h5>
                <small className="text-muted">
                  Group ID: {activeChat.chatId}
                </small>
              </div>

              <div className="crm-chat-form-group">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="mb-0 fw-bold">
                    Group Members ({activeChat.memberIds?.length || 0})
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary py-0 px-2"
                    style={{ fontSize: "12px", borderRadius: "4px" }}
                    onClick={() => {
                      setIsAddMemberSectionOpen((prev) => !prev);
                      setAddMemberSearch("");
                    }}
                  >
                    <i className={`fa ${isAddMemberSectionOpen ? "fa-minus" : "fa-plus"} me-1`} />
                    {isAddMemberSectionOpen ? "Hide" : "Add Members"}
                  </button>
                </div>

                {/* Add Member inline selector */}
                {isAddMemberSectionOpen && (
                  <div className="p-2 border rounded bg-light mb-3">
                    <small className="fw-semibold text-primary d-block mb-1">
                      Select Users to Add to Group:
                    </small>
                    <div className="crm-user-filter-tabs mb-2">
                      <button
                        type="button"
                        className={`crm-user-filter-tab ${addMemberType === "all" ? "active" : ""
                          }`}
                        onClick={() => setAddMemberType("all")}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`crm-user-filter-tab ${addMemberType === "staff" ? "active" : ""
                          }`}
                        onClick={() => setAddMemberType("staff")}
                      >
                        Staff
                      </button>
                      <button
                        type="button"
                        className={`crm-user-filter-tab ${addMemberType === "patient" ? "active" : ""
                          }`}
                        onClick={() => setAddMemberType("patient")}
                      >
                        Patients
                      </button>
                    </div>
                    <div className="mb-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search users to add..."
                        value={addMemberSearch}
                        onChange={(e) => setAddMemberSearch(e.target.value)}
                        style={{ fontSize: "12px" }}
                      />
                    </div>
                    <div style={{ maxHeight: "160px", overflowY: "auto" }}>
                      {candidateMembers
                        .filter((cand) => {
                          const isAlreadyMember = activeChat.memberIds?.includes(String(cand.userId));
                          if (isAlreadyMember) return false;
                          if (addMemberType !== "all" && cand.userType && cand.userType !== addMemberType) {
                            return false;
                          }
                          const q = addMemberSearch.trim().toLowerCase();
                          if (!q) return true;
                          const name = String(cand.name || "").toLowerCase();
                          const email = String(cand.email || "").toLowerCase();
                          const phone = String(cand.phone || "").toLowerCase();
                          const uId = String(cand.userId || "").toLowerCase();
                          const role = String(cand.role || "").toLowerCase();
                          return (
                            name.includes(q) ||
                            email.includes(q) ||
                            phone.includes(q) ||
                            uId.includes(q) ||
                            role.includes(q)
                          );
                        })
                        .map((cand) => {
                          const isSelected = addMemberSelectedIds.includes(
                            String(cand.userId),
                          );
                          return (
                            <div
                              key={cand.userId}
                              className="d-flex align-items-center gap-2 p-1 border-bottom"
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setAddMemberSelectedIds((prev) =>
                                  prev.includes(String(cand.userId))
                                    ? prev.filter((id) => id !== String(cand.userId))
                                    : [...prev, String(cand.userId)],
                                );
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                              />
                              <ChatAvatar name={cand.name} src={cand.image} />
                              <div className="flex-grow-1 min-w-0">
                                <div className="d-flex align-items-center gap-1 flex-wrap">
                                  <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                                    {cand.name}
                                  </span>
                                  {cand.role && (
                                    <RoleBadge role={cand.role} size="sm" />
                                  )}
                                  {cand.userType && (
                                    <UserTypeBadge type={cand.userType} size="sm" />
                                  )}
                                </div>
                                <div style={{ fontSize: "10px", color: "#666" }}>
                                  {cand.email || cand.phone || `ID: ${cand.userId}`}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {candidateMembers.filter((cand) => {
                        const isAlreadyMember = activeChat.memberIds?.includes(String(cand.userId));
                        if (isAlreadyMember) return false;
                        if (addMemberType !== "all" && cand.userType && cand.userType !== addMemberType) {
                          return false;
                        }
                        const q = addMemberSearch.trim().toLowerCase();
                        if (!q) return true;
                        const name = String(cand.name || "").toLowerCase();
                        const email = String(cand.email || "").toLowerCase();
                        const phone = String(cand.phone || "").toLowerCase();
                        const uId = String(cand.userId || "").toLowerCase();
                        const role = String(cand.role || "").toLowerCase();
                        return (
                          name.includes(q) ||
                          email.includes(q) ||
                          phone.includes(q) ||
                          uId.includes(q) ||
                          role.includes(q)
                        );
                      }).length === 0 && (
                          <div className="text-muted text-center py-2" style={{ fontSize: "12px" }}>
                            {addMemberSearch ? "No matching users found" : "No users available to add"}
                          </div>
                        )}
                    </div>
                    {addMemberSelectedIds.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary w-100 mt-2"
                        disabled={addingMembers}
                        onClick={handleAddMembersToActiveGroup}
                      >
                        {addingMembers
                          ? "Adding..."
                          : `Add Selected (${addMemberSelectedIds.length})`}
                      </button>
                    )}
                  </div>
                )}

                <div className="crm-chat-candidates-list" style={{ maxHeight: "250px", overflowY: "auto" }}>
                  {(!activeChat.memberIds || activeChat.memberIds.length === 0) &&
                    (!activeChat.members || activeChat.members.length === 0) ? (
                    <div className="crm-chat-empty">
                      No member list available.
                    </div>
                  ) : (
                    (activeChat.memberIds && activeChat.memberIds.length > 0
                      ? activeChat.memberIds
                      : activeChat.members.map((m) =>
                        typeof m === "object" ? m.userId || m._id || m.id : m,
                      )
                    ).map((mId) => {
                      const idStr = String(mId);
                      const memberObj =
                        userMap[idStr] ||
                        (typeof mId === "object" ? mId : null) ||
                        (activeChat.members || []).find(
                          (x) =>
                            String(
                              typeof x === "object"
                                ? x.userId || x._id || x.id
                                : x,
                            ) === idStr,
                        );

                      const memberName =
                        memberObj?.name ||
                        memberObj?.patient_name ||
                        (idStr === String(crmUserId) ? "You" : `User ${idStr}`);
                      const memberSub =
                        memberObj?.email ||
                        memberObj?.phone ||
                        `ID: ${idStr}`;
                      const isCurrent = idStr === String(crmUserId);
                      const isAdmin = idStr === String(activeChat.admin);
                      const isCreator =
                        String(activeChat.admin) === String(crmUserId);

                      return (
                        <div
                          key={idStr}
                          className="crm-chat-member-list-item d-flex align-items-center justify-content-between p-2 border-bottom"
                        >
                          <div className="d-flex align-items-center gap-2">
                            <ChatAvatar
                              name={memberName}
                              src={memberObj?.image || memberObj?.profileImage}
                            />
                            <div>
                              <div className="d-flex align-items-center gap-1 flex-wrap">
                                <strong style={{ fontSize: "13px" }}>
                                  {memberName} {isCurrent && "(You)"}
                                </strong>
                                {isAdmin && (
                                  <span
                                    className="badge bg-primary"
                                    style={{ fontSize: "10px" }}
                                  >
                                    Creator
                                  </span>
                                )}
                                {(memberObj?.role || memberObj?.userRole) && (
                                  <RoleBadge
                                    role={memberObj.role || memberObj.userRole}
                                    size="sm"
                                  />
                                )}
                                {(memberObj?.userType || (memberObj?.role?.toLowerCase() === "patient" ? "patient" : "staff")) && (
                                  <UserTypeBadge
                                    type={memberObj.userType || (memberObj?.role?.toLowerCase() === "patient" ? "patient" : "staff")}
                                    size="sm"
                                  />
                                )}
                              </div>
                              <div
                                className="text-muted"
                                style={{ fontSize: "11px" }}
                              >
                                {memberSub}
                              </div>
                            </div>
                          </div>

                          {isCreator && !isCurrent && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              style={{ fontSize: "11px", padding: "2px 8px" }}
                              onClick={() =>
                                handleRemoveMember(idStr, memberName)
                              }
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="button"
                className="crm-chat-leave-group-btn"
                onClick={handleLeaveGroup}
              >
                <i className="fa fa-sign-out-alt" /> Leave Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* START NEW CHAT MODAL */}
      {isNewChatOpen && (
        <div
          className="crm-chat-modal-backdrop"
          onClick={() => setIsNewChatOpen(false)}
        >
          <div
            className="crm-chat-modal crm-chat-new-chat-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="crm-chat-modal-header">
              <div className="d-flex align-items-center gap-2">
                <div className="crm-modal-icon-badge">
                  <i className="fa fa-comment-medical" />
                </div>
                <div>
                  <h4 className="mb-0">Start New Chat</h4>
                  <span className="text-muted" style={{ fontSize: "12px" }}>
                    Search across CRM Staff &amp; Patients to start messaging
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="crm-chat-modal-close-btn"
                onClick={() => setIsNewChatOpen(false)}
              >
                <i className="fa fa-times" />
              </button>
            </div>

            <div className="crm-chat-modal-body">
              {/* Filter tabs: All | Staff | Patients */}
              <div className="crm-user-filter-tabs">
                <button
                  type="button"
                  className={`crm-user-filter-tab ${
                    newChatType === "all" ? "active" : ""
                  }`}
                  onClick={() => setNewChatType("all")}
                >
                  <i className="fa fa-th-large me-1" /> All Users
                </button>
                <button
                  type="button"
                  className={`crm-user-filter-tab ${
                    newChatType === "staff" ? "active" : ""
                  }`}
                  onClick={() => setNewChatType("staff")}
                >
                  <i className="fa fa-user-tie me-1" /> Staff
                </button>
                <button
                  type="button"
                  className={`crm-user-filter-tab ${
                    newChatType === "patient" ? "active" : ""
                  }`}
                  onClick={() => setNewChatType("patient")}
                >
                  <i className="fa fa-user-injured me-1" /> Patients
                </button>
              </div>

              {/* Search bar */}
              <div className="crm-chat-member-search">
                <i className="fa fa-search" />
                <input
                  type="search"
                  placeholder={
                    newChatType === "staff"
                      ? "Search staff by name, role, email, phone..."
                      : newChatType === "patient"
                        ? "Search patients by name, patient ID, phone, email..."
                        : "Search staff or patients by name, role, phone..."
                  }
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  autoFocus
                />
                {newChatSearch && (
                  <button
                    type="button"
                    className="crm-search-clear-btn"
                    onClick={() => setNewChatSearch("")}
                  >
                    <i className="fa fa-times" />
                  </button>
                )}
              </div>

              {/* Users List */}
              <div
                className="crm-chat-users-list"
                onScroll={handleNewChatUsersScroll}
              >
                {newChatLoading ? (
                  <div className="crm-chat-empty py-4">
                    <i className="fa fa-spinner fa-spin fa-2x mb-2 text-primary" />
                    <div>Searching users…</div>
                  </div>
                ) : newChatUsers.length === 0 ? (
                  <div className="crm-chat-empty py-4">
                    <i className="fa fa-user-slash fa-2x mb-2 text-muted" />
                    <div>
                      {newChatSearch
                        ? `No users found matching "${newChatSearch}"`
                        : "No users found in this category."}
                    </div>
                    <small className="text-muted">
                      Try adjusting your search query or selecting a different tab.
                    </small>
                  </div>
                ) : (
                  <>
                    {newChatUsers.map((user) => {
                      const isSelf = String(user.userId) === String(crmUserId);
                      return (
                        <div
                          key={user.userId}
                          className={`crm-chat-user-item ${
                            isSelf ? "is-self" : ""
                          }`}
                          onClick={() => {
                            if (!isSelf) handleSelectUserForChat(user);
                          }}
                        >
                          <div className="crm-chat-avatar-wrap">
                            <ChatAvatar name={user.name} src={user.image} />
                            <span
                              className={`crm-chat-status-dot ${
                                user.isOnline ? "online" : "offline"
                              }`}
                            />
                          </div>
                          <div className="crm-chat-user-info">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span className="crm-chat-user-name">
                                {user.name}
                              </span>
                              {user.isOnline && (
                                <span
                                  className="badge bg-success"
                                  style={{ fontSize: "9px", padding: "1px 5px" }}
                                >
                                  Online
                                </span>
                              )}
                              {isSelf && (
                                <span
                                  className="badge bg-secondary"
                                  style={{ fontSize: "10px" }}
                                >
                                  You
                                </span>
                              )}
                              <RoleBadge role={user.role} />
                              <UserTypeBadge type={user.userType} db={user.db} />
                            </div>
                            <div className="crm-chat-user-meta">
                              {user.phone && (
                                <span>
                                  <i className="fa fa-phone me-1" />
                                  {user.phone}
                                </span>
                              )}
                              {user.email && (
                                <span>
                                  <i className="fa fa-envelope me-1" />
                                  {user.email}
                                </span>
                              )}
                              {user.patientId && (
                                <span>
                                  <i className="fa fa-id-card me-1" />
                                  Patient ID: {user.patientId}
                                </span>
                              )}
                              {!user.phone && !user.email && !user.patientId && (
                                <span>
                                  <i className="fa fa-id-badge me-1" />
                                  ID: {user.userId}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isSelf && (
                            <button
                              type="button"
                              className="crm-chat-start-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectUserForChat(user);
                              }}
                              title={`Chat with ${user.name}`}
                            >
                              <i className="fa fa-comment-dots me-1" /> Chat
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {newChatLoadingMore && (
                      <div className="crm-chat-empty py-2 text-center">
                        <i className="fa fa-spinner fa-spin me-2 text-primary" />
                        <small>Loading more users…</small>
                      </div>
                    )}
                    {!newChatLoading && !newChatLoadingMore && newChatHasMore && (
                      <div className="text-center py-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={handleLoadMoreNewChat}
                        >
                          <i className="fa fa-chevron-down me-1" /> Load more users
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="crm-chat-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsNewChatOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calling modals and toasts are managed globally by GlobalCallNotificationManager */}

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          className="crm-chat-lightbox-backdrop"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            className="crm-chat-lightbox-close"
            onClick={() => setLightboxImage(null)}
            title="Close"
          >
            <i className="fa fa-times" />
          </button>

          <img
            src={lightboxImage}
            alt="Enlarged view"
            className="crm-chat-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />

          <div
            className="crm-chat-lightbox-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={lightboxImage}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="crm-chat-lightbox-btn"
            >
              <i className="fa fa-download" /> Open Original
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
