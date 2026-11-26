export function UnreadDot({ unread }) {
  if (unread !== true) return null;
  return <span className="unread-dot" />;
}

export function NewTag({ unread }) {
  if (unread !== true) return null;
  return <span className="new-tag">NEW</span>;
}

export function unreadRowClass(record, extra = "") {
  return [extra, record?.isUnread === true ? "unread-row" : ""]
    .filter(Boolean)
    .join(" ");
}

export function clearUnreadById(list, recordId, idKeys) {
  const target = String(recordId || "").trim();
  if (!target || !Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((item) => {
    const match = idKeys.some((key) => String(item?.[key] || "") === target);
    if (!match) return item;
    const isUnreadOrUnseen =
      item?.isUnread === true ||
      item?.isUnseen === true ||
      item?.isBold === true ||
      item?.isSeen === false;
    if (!isUnreadOrUnseen) return item;
    changed = true;
    return {
      ...item,
      isUnread: false,
      isUnseen: false,
      isSeen: true,
      isBold: false,
      is_unread: 0,
      is_unseen: 0,
      is_seen: 1,
      is_bold: false,
      lastTreatmentPlan: item.lastTreatmentPlan
        ? {
            ...item.lastTreatmentPlan,
            isUnseen: false,
            isSeen: true,
            isBold: false,
            hospitals: Array.isArray(item.lastTreatmentPlan.hospitals)
              ? item.lastTreatmentPlan.hospitals.map((h) => ({
                  ...h,
                  isUnseen: false,
                  isSeen: true,
                  isBold: false,
                }))
              : item.lastTreatmentPlan.hospitals,
          }
        : item.lastTreatmentPlan,
    };
  });
  return changed ? next : list;
}
