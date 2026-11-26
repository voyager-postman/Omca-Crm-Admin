import { useState, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import PickUpanddrops from "./PickUpanddrops";
import PickDropApp from "./PickDropApp";
import {
  normalizeGeneralEnquiryUnread,
  getCachedGeneralEnquiryUnread,
  fetchGeneralEnquiryUnread,
  UNREAD_REFRESH_EVENT,
  GENERAL_ENQUIRY_COUNTS_EVENT,
} from "../../services/unreadApi";
import { testForms } from "../../reducer/FormsEnquiry";

const TABS = [
  { key: "portal", label: "Portal" },
  { key: "app", label: "App" },
];

const STORAGE_KEY = "pickDropTabActive";

export default function PickDropTabs({ dateRange }) {
  const dispatch = useDispatch();
  const [source, setSource] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "portal" || saved === "app" ? saved : "portal";
  });

  const apiUnreadCount = useSelector(
    (state) => state.testForms?.testForms?.unreadCount,
  );
  const [cachedCounts, setCachedCounts] = useState(() =>
    getCachedGeneralEnquiryUnread(),
  );

  const unreadCounts = useMemo(() => {
    const cached = cachedCounts || getCachedGeneralEnquiryUnread() || {};
    const merged = {
      ...cached,
      ...(apiUnreadCount || {}),
      app_pickup: Number(
        apiUnreadCount?.app_pickup ??
        apiUnreadCount?.pickup ??
        cached.app_pickup ??
        cached.pickup ??
        0
      ),
      portal_pickup: Number(
        apiUnreadCount?.portal_pickup !== undefined
          ? apiUnreadCount.portal_pickup
          : (cached.portal_pickup || 0)
      ),
    };
    merged.pickup = merged.app_pickup + merged.portal_pickup;
    return normalizeGeneralEnquiryUnread(merged);
  }, [apiUnreadCount, cachedCounts]);

  const appUnread = unreadCounts.app_pickup || 0;
  const portalUnread = unreadCounts.portal_pickup || 0;

  useEffect(() => {
    const handleRefresh = (e) => {
      if (e?.detail) {
        setCachedCounts(normalizeGeneralEnquiryUnread(e.detail));
      } else {
        fetchGeneralEnquiryUnread();
      }
    };
    window.addEventListener(UNREAD_REFRESH_EVENT, handleRefresh);
    window.addEventListener(GENERAL_ENQUIRY_COUNTS_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(UNREAD_REFRESH_EVENT, handleRefresh);
      window.removeEventListener(GENERAL_ENQUIRY_COUNTS_EVENT, handleRefresh);
    };
  }, []);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 16,
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        {TABS.map((tab) => {
          const active = source === tab.key;
          const count = tab.key === "portal" ? portalUnread : appUnread;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setSource(tab.key);
                localStorage.setItem(STORAGE_KEY, tab.key);
              }}
              style={{
                padding: "8px 22px",
                border: "none",
                borderBottom: active ? "2px solid #22c7b8" : "2px solid transparent",
                marginBottom: -2,
                background: "transparent",
                color: active ? "#0f766e" : "#64748b",
                fontWeight: active ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {tab.label}
              {count > 0 && (
                <span className="sidebar-badge" style={{ marginLeft: 6 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {source === "portal" ? (
        <PickDropApp dateRange={dateRange} />
      ) : (
        <PickUpanddrops dateRange={dateRange} />
      )}
    </>
  );
}
