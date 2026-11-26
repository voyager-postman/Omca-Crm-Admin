import React, { useEffect, useState } from "react";
import { fetchCallHistory, markMissedCallsRead } from "../../../services/callApi";
import { resolveCrmImageUrl } from "../../../Basurl/Baseurl";
import "./CallModal.css";

const formatCallTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
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
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const CallHistoryTab = ({ onStartCall, onMissedCountChange }) => {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all' | 'missed' | 'video' | 'audio'
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Load history with fail-fast safety
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchCallHistory({
      page,
      limit: 25,
      filter,
    })
      .then((res) => {
        if (!isMounted) return;
        const items = Array.isArray(res?.data) ? res.data : [];
        setHistory(items);
      })
      .catch(() => {
        if (isMounted) setHistory([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filter, page]);

  // Mark missed calls read on tab mount
  useEffect(() => {
    markMissedCallsRead()
      .then(() => {
        if (onMissedCountChange) onMissedCountChange(0);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  return (
    <div className="crm-call-history-wrapper">
      {/* Filter Tabs */}
      <div className="d-flex align-items-center gap-2 mb-3">
        {["all", "missed", "video", "audio"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`crm-chat-filter-pill text-capitalize ${filter === tab ? "active" : ""}`}
            onClick={() => handleFilterChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* History List */}
      {loading ? (
        <div className="text-center py-4 text-muted">
          <div className="spinner-border spinner-border-sm text-primary mb-2" />
          <div>Loading call history…</div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="fa fa-phone-slash fa-2x mb-2 text-secondary" />
          <p className="mb-0">No call history found.</p>
        </div>
      ) : (
        <div className="crm-call-history-list">
          {history.map((item, idx) => {
            const isMissed =
              item.status === "missed" || item.direction === "missed";
            const isOutgoing = item.direction === "outgoing";
            const otherUser = item.otherParticipant || item.receiver || item.caller || {};
            const participantName = otherUser.name || (item.isGroup ? "Group Call" : "Unknown");
            const avatarUrl = resolveCrmImageUrl(otherUser.profileImage || otherUser.image);
            const callType = item.callType || "audio";
            const isVideo = callType === "video";

            return (
              <div key={item.callId || idx} className="crm-call-history-item">
                <div className="crm-call-history-info">
                  {/* Direction Icon */}
                  <div
                    className={`crm-call-direction-icon ${
                      isMissed ? "missed" : isOutgoing ? "outgoing" : "incoming"
                    }`}
                  >
                    <i
                      className={`fa ${
                        isMissed
                          ? "fa-phone-slash"
                          : isOutgoing
                          ? "fa-arrow-up"
                          : "fa-arrow-down"
                      }`}
                    />
                  </div>

                  <div>
                    <h6 className="mb-0 fw-semibold text-dark">
                      {participantName}
                    </h6>
                    <small className="text-muted d-flex align-items-center gap-1">
                      <i className={`fa ${isVideo ? "fa-video" : "fa-phone"} me-1`} />
                      {formatCallTime(item.startedAt || item.connectedAt || item.endedAt)}
                      {item.durationSeconds > 0 && (
                        <span>• {formatDuration(item.durationSeconds)}</span>
                      )}
                      {isMissed && <span className="text-danger fw-bold">• Missed</span>}
                    </small>
                  </div>
                </div>

                {/* Redial Action */}
                {onStartCall && (otherUser.id || otherUser._id || otherUser.userId) && (
                  <button
                    type="button"
                    className="crm-call-redial-btn"
                    title={`Call back ${participantName}`}
                    onClick={() =>
                      onStartCall({
                        receiverId: otherUser.id || otherUser._id || otherUser.userId,
                        name: participantName,
                        role: otherUser.role,
                        image: avatarUrl,
                        callType,
                      })
                    }
                  >
                    <i className={`fa ${isVideo ? "fa-video" : "fa-phone"}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallHistoryTab;
