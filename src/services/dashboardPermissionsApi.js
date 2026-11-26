import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Default categories, sections, and items conforming to CRM Dashboard structure
 * Used as seed/fallback template when generating dynamic roles hierarchy.
 */
export const DEFAULT_CRM_DASHBOARD_STRUCTURE = [
  {
    category: "Enquiry",
    sections: [
      {
        sectionName: "Today's Work",
        allow: 1,
        items: [
          { itemName: "Follow-ups due today", allow: 1 },
          { itemName: "patients contacted today", allow: 1 },
          { itemName: "New enquiries today", allow: 1 },
        ],
      },
      {
        sectionName: "Today's Priority",
        allow: 1,
        items: [
          { itemName: "New Enquiries", allow: 1 },
          { itemName: "Treatment Plans Pending", allow: 1 },
          { itemName: "Follow-ups Due", allow: 1 },
          { itemName: "Doctor Reviews Pending", allow: 1 },
          { itemName: "Patients Travelling Today", allow: 1 },
          { itemName: "Overdue Cases", allow: 1 },
          { itemName: "Arriving Today", allow: 1 },
          { itemName: "Departing Today", allow: 1 },
        ],
      },
      {
        sectionName: "Immediate Attention",
        allow: 1,
        items: [
          { itemName: "High Priority Enquiries", allow: 1 },
          { itemName: "Unassigned Enquiries", allow: 1 },
          { itemName: "Pending Doctor Reviews", allow: 1 },
        ],
      },
    ],
  },
  {
    category: "Travel",
    sections: [
      {
        sectionName: "Patient Aging Monitor",
        allow: 1,
        items: [
          { itemName: "Waiting for Visa Procedure", allow: 1 },
          { itemName: "Waiting for Tickets", allow: 1 },
          { itemName: "Under Treatment", allow: 1 },
          { itemName: "In Transit", allow: 1 },
        ],
      },
      {
        sectionName: "Travel Schedule",
        allow: 1,
        items: [
          { itemName: "Patients Travelling Today", allow: 1 },
          { itemName: "Arriving Today", allow: 1 },
          { itemName: "Departing Today", allow: 1 },
          { itemName: "Preponed Today", allow: 1 },
          { itemName: "Postponed Today", allow: 1 },
        ],
      },
    ],
  },
  {
    category: "Treatment Plan",
    sections: [
      {
        sectionName: "Treatment Status",
        allow: 1,
        items: [
          { itemName: "Pending Approvals", allow: 1 },
          { itemName: "Estimates Sent", allow: 1 },
          { itemName: "Confirmed Treatments", allow: 1 },
        ],
      },
    ],
  },
  {
    category: "Air Ambulance & Emergency",
    sections: [
      {
        sectionName: "Emergency Alerts",
        allow: 1,
        items: [
          { itemName: "Active SOS Alerts", allow: 1 },
          { itemName: "Emergency Dispatches", allow: 1 },
          { itemName: "Air Medical Escort Cases", allow: 1 },
        ],
      },
    ],
  },
];

/**
 * Normalizes permissions so every section has an `allow` (1 or 0) property
 */
export const normalizeSectionPermissions = (data = []) => {
  return data.map((roleObj) => ({
    ...roleObj,
    permissions: (roleObj.permissions || []).map((cat) => ({
      ...cat,
      sections: (cat.sections || []).map((sec) => {
        let secAllow = 1;
        if (sec.allow !== undefined && sec.allow !== null) {
          secAllow = sec.allow === 1 || sec.allow === true ? 1 : 0;
        } else if (Array.isArray(sec.items) && sec.items.length > 0) {
          secAllow = sec.items.some((it) => it.allow === 1 || it.allow === true) ? 1 : 0;
        }
        return {
          ...sec,
          allow: secAllow,
        };
      }),
    })),
  }));
};

/**
 * Builds fallback dashboard permissions data for a given list of roles
 */
export const buildFallbackDashboardPermissions = (rolesList = []) => {
  const effectiveRoles =
    rolesList.length > 0
      ? rolesList
      : [
          "PHARMACY",
          "HOSPITAL",
          "FOUNDATION",
          "REFERAL",
          "LEGAL",
          "DIRECTOR",
          "OPERATIONS",
          "RECEPTIONIST",
        ];

  return normalizeSectionPermissions(
    effectiveRoles.map((role, idx) => ({
      _id: `mock-role-${idx}-${role}`,
      role: typeof role === "string" ? role : role?.role || `Role-${idx}`,
      permissions: JSON.parse(JSON.stringify(DEFAULT_CRM_DASHBOARD_STRUCTURE)),
    }))
  );
};

/**
 * Fetch all CRM dashboard permissions
 * Endpoint: GET /api/get_all_crm_dashboard_Permissions
 */
export const fetchAllCrmDashboardPermissions = async (existingRoles = []) => {
  const headers = authHeaders();
  const urlPrimary = `${baseurl}get_all_crm_dashboard_Permissions`;
  const urlFallback = `${baseurl}crm/get_all_crm_dashboard_Permissions`;

  try {
    const res = await axios.get(urlPrimary, { headers });
    if (res?.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
      return normalizeSectionPermissions(res.data.data);
    }
  } catch (err) {
    try {
      const res2 = await axios.get(urlFallback, { headers });
      if (res2?.data?.success && Array.isArray(res2.data.data) && res2.data.data.length > 0) {
        return normalizeSectionPermissions(res2.data.data);
      }
    } catch (fallbackErr) {
      console.warn("API /get_all_crm_dashboard_Permissions not reached yet, using structure fallback:", err?.message);
    }
  }

  return buildFallbackDashboardPermissions(existingRoles);
};

/**
 * Update CRM dashboard permissions (Batch)
 * Endpoint: POST /api/updateCrmDashboardPermission
 * Body: { permissions: [ { role, category, sectionName, allow } ] }
 */
export const updateCrmDashboardPermissions = async (permissionsArray) => {
  const headers = authHeaders();
  const body = { permissions: permissionsArray };
  const urlPrimary = `${baseurl}updateCrmDashboardPermission`;
  const urlFallback = `${baseurl}crm/updateCrmDashboardPermission`;

  try {
    const res = await axios.post(urlPrimary, body, { headers });
    return res.data;
  } catch (err) {
    try {
      const res2 = await axios.post(urlFallback, body, { headers });
      return res2.data;
    } catch (fallbackErr) {
      throw err?.response?.data || err;
    }
  }
};

const isAdminUser = () => {
  if (typeof localStorage === "undefined") return false;
  const role = localStorage.getItem("Role");
  return String(role || "").trim().toLowerCase() === "admin";
};

const cleanStringForMatching = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");

const normalizeItemAlias = (str) => {
  const c = cleanStringForMatching(str);
  if (
    c.includes("treatment plan") &&
    (c.includes("pending") || c.includes("waiting") || c.includes("overdue"))
  ) {
    return "waiting for treatment plan";
  }
  if (
    c.includes("doctor review") ||
    c.includes("doctors review") ||
    c.includes("doctor's review")
  ) {
    return "doctor reviews pending";
  }
  if (c.includes("waiting") && c.includes("confirmation")) {
    return "waiting for confirmation";
  }
  if (c.includes("missing doc") || c.includes("missing medical doc")) {
    return "missing documents";
  }
  if (c.includes("follow up") && (c.includes("overdue") || c.includes("due"))) {
    return "overdue follow up";
  }
  if (c === "doctors" || c === "doctor") {
    return "doctors";
  }
  if (c === "operations" || c === "operation") {
    return "operation";
  }
  return c;
};

const matchesCategoryName = (actual, target) => {
  if (!target) return true;
  const a = cleanStringForMatching(actual);
  const t = cleanStringForMatching(target);
  return a === t || a.startsWith(t) || t.startsWith(a);
};

const matchesSectionName = (actual, target) => {
  if (!target) return true;
  const a = cleanStringForMatching(actual).replace(/s\b/g, "");
  const t = cleanStringForMatching(target).replace(/s\b/g, "");
  return a === t || a.includes(t) || t.includes(a);
};

const matchesItemName = (actual, target) => {
  if (!target) return true;
  const aNorm = normalizeItemAlias(actual);
  const tNorm = normalizeItemAlias(target);
  if (aNorm === tNorm) return true;

  const a = cleanStringForMatching(actual).replace(/s\b/g, "");
  const t = cleanStringForMatching(target).replace(/s\b/g, "");
  return a === t || a.includes(t) || t.includes(a);
};

let inFlightMyCrmPermissionsPromise = null;
let cachedMyCrmPermissions = null;
let lastMyCrmPermissionsFetchTime = 0;
let resolvedMyPermissionsEndpoint = null;

export const invalidateMyCrmDashboardPermissionsCache = () => {
  cachedMyCrmPermissions = null;
  lastMyCrmPermissionsFetchTime = 0;
};

/**
 * Fetch current user's CRM dashboard permissions
 * Endpoint: GET /api/my_crm_dashboard_permissions
 * Includes in-flight deduplication and 30-second TTL caching
 */
export const fetchMyCrmDashboardPermissions = async (forceRefresh = false) => {
  if (
    !forceRefresh &&
    cachedMyCrmPermissions &&
    Date.now() - lastMyCrmPermissionsFetchTime < 30000
  ) {
    return cachedMyCrmPermissions;
  }

  if (inFlightMyCrmPermissionsPromise) {
    return inFlightMyCrmPermissionsPromise;
  }

  inFlightMyCrmPermissionsPromise = (async () => {
    const headers = authHeaders();
    const urlPrimary = `${baseurl}my_crm_dashboard_permissions`;
    const urlFallback = `${baseurl}crm/my_crm_dashboard_permissions`;
    const targetUrl = resolvedMyPermissionsEndpoint || urlPrimary;

    try {
      const res = await axios.get(targetUrl, { headers });
      if (res?.data) {
        resolvedMyPermissionsEndpoint = targetUrl;
        cachedMyCrmPermissions = res.data;
        lastMyCrmPermissionsFetchTime = Date.now();
        return res.data;
      }
    } catch (err) {
      if (!resolvedMyPermissionsEndpoint) {
        try {
          const res2 = await axios.get(urlFallback, { headers });
          if (res2?.data) {
            resolvedMyPermissionsEndpoint = urlFallback;
            cachedMyCrmPermissions = res2.data;
            lastMyCrmPermissionsFetchTime = Date.now();
            return res2.data;
          }
        } catch (fallbackErr) {
          console.warn(
            "API /my_crm_dashboard_permissions not reached:",
            err?.message || fallbackErr?.message,
          );
        }
      }
    } finally {
      inFlightMyCrmPermissionsPromise = null;
    }
    return null;
  })();

  return inFlightMyCrmPermissionsPromise;
};

/**
 * Safely extracts permissions array from various response wrapper shapes
 */
export const extractPermissionsList = (response) => {
  if (!response) return null;
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.permissions)) return response.permissions;
  if (Array.isArray(response.data?.permissions)) return response.data.permissions;
  if (Array.isArray(response.data)) return response.data;
  return null;
};

/**
 * Check if a section is allowed across all categories or within a specific category
 */
export const isCrmDashboardSectionAllowed = (
  permissionsList,
  categoryName,
  sectionName,
) => {
  if (!permissionsList) return true;
  if (isAdminUser()) return true;

  if (categoryName) {
    const category = permissionsList.find((c) =>
      matchesCategoryName(c.category || c.name || c.title, categoryName),
    );
    if (!category) return true;

    const section = (category.sections || []).find((s) =>
      matchesSectionName(s.sectionName || s.name || s.title, sectionName),
    );
    if (!section) return true;

    if (section.allow !== undefined && section.allow !== null) {
      if (
        section.allow === 0 ||
        section.allow === false ||
        section.allow === "0"
      ) {
        return false;
      }
    }

    if (Array.isArray(section.items) && section.items.length > 0) {
      const anyAllowed = section.items.some(
        (it) => it.allow === 1 || it.allow === true || it.allow === "1",
      );
      if (!anyAllowed) return false;
    }

    return true;
  }

  return isCrmDashboardAnySectionAllowed(permissionsList, sectionName);
};

/**
 * Check if ANY category has the section allowed
 */
export const isCrmDashboardAnySectionAllowed = (permissionsList, sectionName) => {
  if (!permissionsList) return true;
  if (isAdminUser()) return true;

  const matchingSections = [];
  permissionsList.forEach((cat) => {
    (cat.sections || []).forEach((sec) => {
      if (
        matchesSectionName(sec.sectionName || sec.name || sec.title, sectionName)
      ) {
        matchingSections.push(sec);
      }
    });
  });

  if (matchingSections.length === 0) return true;

  return matchingSections.some((sec) => {
    if (sec.allow === 0 || sec.allow === false || sec.allow === "0") {
      return false;
    }
    if (Array.isArray(sec.items) && sec.items.length > 0) {
      return sec.items.some(
        (it) => it.allow === 1 || it.allow === true || it.allow === "1",
      );
    }
    return true;
  });
};

/**
 * Check if an individual item is allowed for the logged in user
 */
export const isCrmDashboardItemAllowed = (
  permissionsList,
  categoryName,
  sectionName,
  itemName,
) => {
  if (!permissionsList) return true;
  if (isAdminUser()) return true;

  // 1. If categoryName is provided, check that specific category first
  if (categoryName) {
    const category = permissionsList.find((c) =>
      matchesCategoryName(c.category || c.name || c.title, categoryName),
    );
    if (category) {
      const section = (category.sections || []).find((s) =>
        matchesSectionName(s.sectionName || s.name || s.title, sectionName),
      );
      if (section) {
        if (
          section.allow === 0 ||
          section.allow === false ||
          section.allow === "0"
        ) {
          return false;
        }

        if (Array.isArray(section.items) && section.items.length > 0) {
          const item = section.items.find((it) =>
            matchesItemName(it.itemName || it.name || it.title || it.label, itemName),
          );
          if (item) {
            return item.allow === 1 || item.allow === true || item.allow === "1";
          }
        }
      }
    }
  }

  // 2. Look across all categories matching sectionName
  for (const cat of permissionsList) {
    for (const sec of cat.sections || []) {
      if (
        matchesSectionName(sec.sectionName || sec.name || sec.title, sectionName)
      ) {
        if (Array.isArray(sec.items) && sec.items.length > 0) {
          const item = sec.items.find((it) =>
            matchesItemName(it.itemName || it.name || it.title || it.label, itemName),
          );
          if (item) {
            if (
              sec.allow === 0 ||
              sec.allow === false ||
              sec.allow === "0"
            ) {
              return false;
            }
            return item.allow === 1 || item.allow === true || item.allow === "1";
          }
        }
      }
    }
  }

  return true;
};

