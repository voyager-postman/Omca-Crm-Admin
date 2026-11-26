import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import { isMongoObjectId, notifyAuthChanged } from "../utils/authStorage";

export const ALL_ADMIN_ENDPOINTS = [
  "/Dashboard",
  "/App_Users",
  "/Enquiries",
  "/General_Enquiries",
  "/Manage_Patients",
  "/Patient_Travel",
  "/Physiotherapy",
  "/Messages",
  "/Director_Messages",
  "/Manage_Appointments",
  "/Orders",
  "/Manage_Services",
  "/Manage_Countries",
  "/Guest_Houses",
  "/Guest_House_Services",
  "/Referral",
  "/Insurance",
  "/Manage_Staffs",
  "/Manage_Permissions",
  "/History",
  "/Activity_Log",
  "/Reports",
  "/Payments",
  "/Payment_Data",
  "/Manage_Roles",
  "/Air_Medical_Escort",
  "/Ambulance_Service",
  "/Treatment_Estimate",
  "/SOS_Emergency",
  "/Campaign_Contacts",
  "/Chatbot_Leads",
  "/Medical_Visa",
  "/Guest_House_Stay",
  "/Forex_Service",
  "/Flight_Service",
  "/Pickup_and_Drop",
  "/Home_Care",
  "/Test_Form",
  "/Contact_Us",
];

export const parsePermissionsFromAny = (perms) => {
  if (!perms) return [];
  if (Array.isArray(perms)) {
    return perms
      .map((p) => String(p || "").trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("/") ? p : `/${p}`));
  }
  if (typeof perms === "object") {
    return Object.entries(perms)
      .filter(([_, val]) => val === 1 || val === true || val === "1")
      .map(([key]) => (key.startsWith("/") ? key : `/${key}`));
  }
  if (typeof perms === "string") {
    try {
      const parsed = JSON.parse(perms);
      return parsePermissionsFromAny(parsed);
    } catch {
      return perms
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (p.startsWith("/") ? p : `/${p}`));
    }
  }
  return [];
};

let inFlightUserDetailsPromise = null;
let lastUserDetailsFetchTime = 0;
let cachedUserDetails = null;

/**
 * Fetches user details from GET /api/get_details/:userId
 * and synchronizes profile & sidebar menu permissions in localStorage.
 * Includes in-flight deduplication and TTL caching to prevent duplicate network calls.
 */
export const fetchAndApplyUserDetails = async (userId, token, initialRole) => {
  const resolvedUserId = userId || localStorage.getItem("_id");
  const resolvedToken = token || localStorage.getItem("token");

  if (!resolvedUserId || !resolvedToken) {
    return { details: null, permissions: [] };
  }

  // Prevent calling get_details for non-ObjectId (e.g. referral user)
  if (!isMongoObjectId(resolvedUserId)) {
    const cachedPerms = (localStorage.getItem("permissionArray") || "")
      .split(",")
      .filter(Boolean);
    return { details: null, permissions: cachedPerms };
  }

  // If already fetched in last 20 seconds for the same user, return cached details
  if (
    cachedUserDetails &&
    cachedUserDetails.userId === resolvedUserId &&
    Date.now() - lastUserDetailsFetchTime < 20000
  ) {
    return cachedUserDetails.result;
  }

  // If an in-flight request is already running, reuse the promise to avoid duplicate network calls
  if (inFlightUserDetailsPromise) {
    return inFlightUserDetailsPromise;
  }

  inFlightUserDetailsPromise = (async () => {
    try {
      const res = await axios.get(`${baseurl}get_details/${resolvedUserId}`, {
        headers: {
          Authorization: `Bearer ${resolvedToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = res?.data || {};
      const details = data?.Details || data?.details || {};

      // 1. Sync user profile info to localStorage only if changed
      let hasChanges = false;

      if (details.name && localStorage.getItem("name") !== details.name) {
        localStorage.setItem("name", details.name);
        hasChanges = true;
      }
      if (details.email && localStorage.getItem("email") !== details.email) {
        localStorage.setItem("email", details.email);
        hasChanges = true;
      }
      const resolvedRole = details.role || initialRole || localStorage.getItem("Role") || "";
      if (resolvedRole && localStorage.getItem("Role") !== resolvedRole) {
        localStorage.setItem("Role", resolvedRole);
        hasChanges = true;
      }

      const hospitalId =
        details.hospital_id ??
        details.hospitalId ??
        details.hospital?.hospital_id ??
        details.hospital?.id;
      if (hospitalId !== undefined && hospitalId !== null && hospitalId !== "") {
        if (localStorage.getItem("hospital_id") !== String(hospitalId)) {
          localStorage.setItem("hospital_id", String(hospitalId));
          hasChanges = true;
        }
      }

      // 2. Extract permissions from get_details response
      let perms = parsePermissionsFromAny(
        data?.permissions ??
        details?.permissions ??
        details?.permissionArray ??
        details?.allowedEndpoints ??
        data?.allowedEndpoints
      );

      // 3. Fallback resolution if permissions not directly in get_details:
      if (!perms || perms.length === 0) {
        const isRoleAdmin =
          resolvedRole.trim().toLowerCase() === "admin" ||
          resolvedRole.trim().toUpperCase() === "ADMIN";

        if (isRoleAdmin) {
          perms = ALL_ADMIN_ENDPOINTS;
        } else {
          // Fetch role permissions from get_all_dashboard_endPoints
          try {
            const rolesRes = await axios.get(`${baseurl}get_all_dashboard_endPoints`, { params: { page: 1, limit: 10 } });
            const endPointsList = rolesRes?.data?.endPoints || rolesRes?.data?.data || [];
            if (Array.isArray(endPointsList)) {
              const roleMatch = endPointsList.find(
                (r) =>
                  String(r.role || "").trim().toLowerCase() ===
                  resolvedRole.trim().toLowerCase()
              );
              if (roleMatch?.permissions) {
                perms = parsePermissionsFromAny(roleMatch.permissions);
              }
            }
          } catch (rolesErr) {
            console.warn("Could not fetch get_all_dashboard_endPoints fallback:", rolesErr);
          }
        }
      }

      // 4. Save permissionArray to localStorage only if changed
      if (perms && perms.length > 0) {
        const currentPerms = localStorage.getItem("permissionArray") || "";
        const nextPerms = perms.join(",");
        if (currentPerms !== nextPerms) {
          localStorage.setItem("permissionArray", nextPerms);
          hasChanges = true;
        }
      }

      // Ensure authSessionId exists without generating a new timestamp on every background fetch
      if (!localStorage.getItem("authSessionId")) {
        localStorage.setItem("authSessionId", `${resolvedUserId}-${Date.now()}`);
        hasChanges = true;
      }

      if (hasChanges) {
        notifyAuthChanged();
      }

      const result = {
        details,
        permissions: perms,
        rawData: data,
        accessCountries: data.accessCountries || details.accessCountries || [],
        roleStatuses: data.roleStatuses || details.roleStatuses || [],
      };
      cachedUserDetails = { userId: resolvedUserId, result };
      lastUserDetailsFetchTime = Date.now();
      return result;
    } catch (err) {
      console.error("fetchAndApplyUserDetails error:", err);
      const cachedPerms = (localStorage.getItem("permissionArray") || "")
        .split(",")
        .filter(Boolean);
      return { details: null, permissions: cachedPerms };
    } finally {
      inFlightUserDetailsPromise = null;
    }
  })();

  return inFlightUserDetailsPromise;
};
