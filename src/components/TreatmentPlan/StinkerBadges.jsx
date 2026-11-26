import {
  formatStinkerWhen,
  getPlanStinkerSummary,
  getStinkerSummary,
} from "../../utils/stinker";

const senderLabel = (block) => {
  const who = block?.lastSentBy ? ` by ${block.lastSentBy}` : "";
  const when = formatStinkerWhen(block?.lastSentAt);
  return when ? `${when}${who}` : who.replace(/^ by /, "");
};

function Badge({ kind, count }) {
  const isVil = kind === "VIL";
  return (
    <span
      className={`status-badge m-0 ${isVil ? "stinker-vil" : "stinker-tp"}`}
      style={{ fontSize: "12px", padding: "4px 10px", fontWeight: 700 }}
    >
      <i className="fa-solid fa-bell me-1" aria-hidden="true"></i>
      {isVil ? "VIL" : "TP"} Stinker ({count})
    </span>
  );
}

function HistoryList({ history }) {
  if (!history?.length) return null;
  const rows = [...history].reverse();
  return (
    <details className="stinker-history">
      <summary>Reminder history ({rows.length})</summary>
      <ul>
        {rows.map((entry, index) => (
          <li key={`${entry.sentAt || "sent"}-${index}`}>
            <strong>
              {entry.kind || "TP"} #{rows.length - index}
            </strong>
            {formatStinkerWhen(entry.sentAt) ? ` · ${formatStinkerWhen(entry.sentAt)}` : ""}
            {person(entry.sentBy) ? ` · ${person(entry.sentBy)}` : ""}
            {entry.notes ? <span> — {entry.notes}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function person(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || value.fullName || value.staffName || "";
}

export default function StinkerBadges({
  hospital,
  plan,
  variant = "badges",
}) {
  const summary = hospital
    ? getStinkerSummary(hospital, plan)
    : getPlanStinkerSummary(plan);
  if (!summary.hasAny) return null;

  const showBadges = variant === "badges" || variant === "both";
  const showDetail = variant === "detail" || variant === "both";

  return (
    <div className={`stinker-badges stinker-badges-${variant}`}>
      {showBadges && (
        <span className="stinker-badge-row">
          {summary.showTp && <Badge kind="TP" count={summary.tpCount} />}
          {summary.showVil && <Badge kind="VIL" count={summary.vilCount} />}
        </span>
      )}
      {showDetail && (
        <div className="stinker-detail">
          {summary.showTp && (
            <p>
              <strong>TP reminder #{summary.tpCount}</strong>
              {senderLabel(summary.tp) ? ` · ${senderLabel(summary.tp)}` : ""}
              {summary.tp.notes ? ` — ${summary.tp.notes}` : ""}
            </p>
          )}
          {summary.showVil && (
            <p>
              <strong>VIL reminder #{summary.vilCount}</strong>
              {senderLabel(summary.vil) ? ` · ${senderLabel(summary.vil)}` : ""}
              {summary.vil.notes ? ` — ${summary.vil.notes}` : ""}
            </p>
          )}
          <HistoryList history={summary.history} />
        </div>
      )}
    </div>
  );
}
