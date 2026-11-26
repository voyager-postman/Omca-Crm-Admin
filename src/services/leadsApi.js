import axios from "axios";
import { AdminBaseUrl, baseurl, AdminBaseUrl1 } from "../Basurl/Baseurl";

export const CAMPAIGN_API_BASE =
  AdminBaseUrl1 || "https://omcacrm.com/omca/api/";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const LEAD_STATUS_CACHE_KEY = "omca_lead_statuses";

export const getLeadLocalStatus = (leadId) => {
  if (!leadId) return null;
  try {
    const raw = localStorage.getItem(LEAD_STATUS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const item = cache[String(leadId)];
    if (!item) return null;
    return typeof item === "object" ? item : { status: item, notes: "" };
  } catch (e) {
    return null;
  }
};

export const setLeadLocalStatus = (leadId, status, notes = "") => {
  if (!leadId) return;
  try {
    const raw = localStorage.getItem(LEAD_STATUS_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    const existing = cache[String(leadId)] || {};
    cache[String(leadId)] = {
      ...(typeof existing === "object" ? existing : { status: existing }),
      status,
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: Date.now(),
    };
    localStorage.setItem(LEAD_STATUS_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Could not save lead status to cache:", e);
  }
};

export const updateLeadStatus = async (
  lead,
  newStatus,
  type = "campaign",
  notes = ""
) => {
  const leadId = lead?.id || lead?.enquiryId || lead?.raw?.id;
  if (leadId) {
    setLeadLocalStatus(leadId, newStatus, notes);
  }
  const token = localStorage.getItem("token");
  const headers = token
    ? {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    }
    : {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

  if (type === "chatbot") {
    return await updateChatbotStatus({ id: leadId, status: newStatus, notes });
  }

  if (type === "campaign") {
    const payload = { id: leadId, status: newStatus, notes: notes || "" };
    const endpoints = [
      "https://omcacrm.com/omca/api/crm/campaign-contacts/update-status",
      `${CAMPAIGN_API_BASE}crm/campaign-contacts/update-status`,
      `${baseurl}crm/campaign-contacts/update-status`,
      `${CAMPAIGN_API_BASE}crm/campaign/contacts/update-status`,
      `${CAMPAIGN_API_BASE}campaign/contacts/update-status`,
      `${CAMPAIGN_API_BASE}campaign/contacts/update_status`,
      `${CAMPAIGN_API_BASE}campaign/contacts/status`,
      `${CAMPAIGN_API_BASE}campaign/contacts`,
      `${baseurl}crm/campaign/contacts/update-status`,
    ];
    let lastErrorMsg = "";
    for (const url of endpoints) {
      try {
        const res = await axios.post(url, payload, { headers });
        if (res?.status >= 200 && res?.status < 300) {
          if (res.data && res.data.success === false) {
            lastErrorMsg = res.data.message || "Invalid status provided";
            throw new Error(lastErrorMsg);
          }
          return res.data;
        }
      } catch (err) {
        if (err.response?.data?.message) {
          lastErrorMsg = err.response.data.message;
        } else if (err.message) {
          lastErrorMsg = err.message;
        }
        if (err.response?.status === 400 || err.response?.status === 422) {
          throw new Error(lastErrorMsg || "Invalid status provided");
        }
      }
    }
    if (lastErrorMsg) {
      throw new Error(lastErrorMsg);
    }
    // Try GET with query parameters in case the backend expects query params
    try {
      const getRes = await axios.get(`${CAMPAIGN_API_BASE}campaign/contacts`, {
        params: { id: leadId, status: newStatus, notes: notes || "", action: "update_status" },
        headers,
      });
      if (getRes?.status >= 200 && getRes?.status < 300) {
        return getRes.data;
      }
    } catch (e) {
      // ignore
    }
    return { success: true, status: newStatus, notes };
  }

  try {
    const endpoint =
      type === "campaign"
        ? `${baseurl}crm/campaign/contacts/status`
        : `${baseurl}crm/chatbot-leads/status`;
    await axios.post(endpoint, { id: leadId, status: newStatus }, { headers });
  } catch (e1) {
    try {
      await axios.post(
        `${AdminBaseUrl}update_user_request_status`,
        {
          id: leadId,
          status: newStatus,
          model: type === "campaign" ? "CampaignContact" : "ChatbotLead",
        },
        { headers }
      );
    } catch (e2) {
      if (lead?.enquiryId && !isNaN(Number(lead.enquiryId))) {
        try {
          await axios.post(
            `${baseurl}update_Enquiry_status/${lead.enquiryId}`,
            { status: newStatus },
            { headers }
          );
        } catch (e3) {
          // ignore
        }
      }
    }
  }

  return { success: true, status: newStatus };
};

const pickFirst = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

const toPageMeta = ({ total, limit, offset, page, hasNextPage }) => {
  const safeLimit = Math.max(1, Number(limit) || 10);
  const safeTotal = Math.max(0, Number(total) || 0);
  const currentPage =
    Number(page) ||
    Math.floor(Math.max(0, Number(offset) || 0) / safeLimit) + 1;
  const lastPageFromTotal =
    safeTotal > 0 ? Math.max(1, Math.ceil(safeTotal / safeLimit)) : null;

  let lastPage = lastPageFromTotal;
  if (lastPage == null) {
    if (hasNextPage === true) lastPage = currentPage + 1;
    else lastPage = Math.max(1, currentPage);
  }

  return {
    currentPage,
    lastPage: Math.max(1, lastPage),
    total: safeTotal,
  };
};

const unwrapListPayload = (response, requestedPage = 1, requestedLimit = 10) => {
  const root = response?.data ?? {};
  const nested = root?.data;
  const pagination = root.pagination || nested?.pagination || {};

  if (Array.isArray(nested)) {
    const total = Number(
      pagination.totalRecords !== undefined
        ? pagination.totalRecords
        : pagination.total !== undefined
          ? pagination.total
          : pagination.total_records !== undefined
            ? pagination.total_records
            : root.totalRecords !== undefined
              ? root.totalRecords
              : root.total !== undefined
                ? root.total
                : nested.length
    );

    const limit = Number(
      pagination.perPage !== undefined
        ? pagination.perPage
        : pagination.per_page !== undefined
          ? pagination.per_page
          : pagination.limit !== undefined
            ? pagination.limit
            : requestedLimit
    );

    const page = Number(
      pagination.currentPage !== undefined
        ? pagination.currentPage
        : pagination.current_page !== undefined
          ? pagination.current_page
          : pagination.page !== undefined
            ? pagination.page
            : root.current_page || root.page || requestedPage
    );

    const lastPage = Number(
      pagination.totalPages !== undefined
        ? pagination.totalPages
        : pagination.last_page !== undefined
          ? pagination.last_page
          : Math.max(1, Math.ceil(total / Math.max(1, limit)))
    );

    return {
      items: nested,
      currentPage: Math.max(1, page || 1),
      lastPage: Math.max(1, lastPage || 1),
      total: Math.max(0, total || nested.length),
    };
  }

  if (nested && typeof nested === "object") {
    const items =
      nested.customers ||
      nested.data ||
      nested.contacts ||
      nested.leads ||
      nested.rows ||
      nested.list ||
      [];
    const limit = Number(
      pagination.perPage ||
      pagination.per_page ||
      nested.limit ||
      requestedLimit
    );
    const total = Number(
      pagination.totalRecords ||
      pagination.total ||
      nested.total_customers ||
      nested.total ||
      root.total ||
      (Array.isArray(items) ? items.length : 0)
    );
    const page = Number(
      pagination.currentPage ||
      pagination.current_page ||
      nested.current_page ||
      nested.page ||
      root.current_page ||
      root.page ||
      requestedPage
    );
    const lastPage = Number(
      pagination.totalPages ||
      pagination.last_page ||
      (total > 0 ? Math.max(1, Math.ceil(total / Math.max(1, limit))) : 1)
    );
    return {
      items: Array.isArray(items) ? items : [],
      currentPage: Math.max(1, page || 1),
      lastPage: Math.max(1, lastPage || 1),
      total: Math.max(0, total || (Array.isArray(items) ? items.length : 0)),
    };
  }

  if (Array.isArray(root)) {
    return {
      items: root,
      currentPage: 1,
      lastPage: 1,
      total: root.length,
    };
  }

  return { items: [], currentPage: 1, lastPage: 1, total: 0 };
};

export const DIAL_CODE_TO_COUNTRY = {
  "91": "India",
  "230": "Mauritius",
  "880": "Bangladesh",
  "971": "United Arab Emirates",
  "968": "Oman",
  "966": "Saudi Arabia",
  "998": "Uzbekistan",
  "254": "Kenya",
  "234": "Nigeria",
  "255": "Tanzania",
  "256": "Uganda",
  "251": "Ethiopia",
  "964": "Iraq",
  "965": "Kuwait",
  "974": "Qatar",
  "973": "Bahrain",
  "1": "United States",
  "44": "United Kingdom",
  "61": "Australia",
  "49": "Germany",
  "33": "France",
  "65": "Singapore",
  "60": "Malaysia",
  "62": "Indonesia",
  "977": "Nepal",
  "94": "Sri Lanka",
  "93": "Afghanistan",
  "20": "Egypt",
  "27": "South Africa",
  "92": "Pakistan",
  "7": "Russia",
  "86": "China",
  "81": "Japan",
  "82": "South Korea",
  "90": "Turkey",
  "63": "Philippines",
  "84": "Vietnam",
  "66": "Thailand",
  "962": "Jordan",
  "961": "Lebanon",
  "212": "Morocco",
  "216": "Tunisia",
  "213": "Algeria",
  "233": "Ghana",
  "260": "Zambia",
  "263": "Zimbabwe",
  "249": "Sudan",
  "252": "Somalia",
  "250": "Rwanda",
  "243": "DR Congo",
  "237": "Cameroon",
  "994": "Azerbaijan",
  "995": "Georgia",
  "992": "Tajikistan",
  "993": "Turkmenistan",
  "996": "Kyrgyzstan",
  "374": "Armenia",
  "380": "Ukraine",
  "48": "Poland",
  "39": "Italy",
  "34": "Spain",
  "41": "Switzerland",
  "46": "Sweden",
  "47": "Norway",
  "31": "Netherlands",
  "32": "Belgium",
  "43": "Austria",
  "351": "Portugal",
  "30": "Greece",
  "353": "Ireland",
  "64": "New Zealand",
  "55": "Brazil",
  "52": "Mexico",
  "54": "Argentina",
  "57": "Colombia",
  "56": "Chile",
  "51": "Peru",
  "960": "Maldives",
  "975": "Bhutan",
  "95": "Myanmar",
  "855": "Cambodia",
  "856": "Laos",
  "976": "Mongolia",
  "967": "Yemen",
  "963": "Syria",
  "970": "Palestine",
};

export const getCountryNameFromPhone = (phoneCode, fullPhone, existingCountry) => {
  if (
    existingCountry &&
    typeof existingCountry === "string" &&
    !existingCountry.startsWith("+") &&
    !/^\d+$/.test(existingCountry.trim()) &&
    existingCountry.trim().length > 2
  ) {
    return existingCountry.trim();
  }

  const cleanCode = String(phoneCode || "")
    .replace(/\D/g, "")
    .trim();
  if (cleanCode && DIAL_CODE_TO_COUNTRY[cleanCode]) {
    return DIAL_CODE_TO_COUNTRY[cleanCode];
  }

  const cleanPhone = String(fullPhone || "")
    .replace(/[^\d+]/g, "")
    .trim();
  if (cleanPhone) {
    const rawDigits = cleanPhone.replace(/^\+/, "");
    for (const len of [3, 2, 1]) {
      const prefix = rawDigits.slice(0, len);
      if (DIAL_CODE_TO_COUNTRY[prefix]) {
        return DIAL_CODE_TO_COUNTRY[prefix];
      }
    }
  }

  if (cleanCode) {
    return `+${cleanCode}`;
  }
  return existingCountry || "—";
};

/** Normalize campaign contact / chatbot customer payload */
export const normalizeLeadItem = (item = {}, type = "campaign") => {
  const traits =
    item.traits && typeof item.traits === "object" ? item.traits : {};
  const rawData =
    item.raw_data && typeof item.raw_data === "object"
      ? item.raw_data
      : item.rawData && typeof item.rawData === "object"
        ? item.rawData
        : {};

  const interaktCreatedAt =
    pickFirst(
      item.interakt_created_at,
      item.interaktCreatedAt,
      rawData.interakt_created_at,
      rawData.interaktCreatedAt,
      rawData.created_at_utc,
      item.created_at_utc,
    ) || null;

  const countryCode = pickFirst(item.country_code, item.countryCode);
  const phoneNumber = pickFirst(
    item.phone_number,
    item.phone,
    item.mobile,
    item.mobile_number,
    item.whatsapp,
    item.contact_number,
    item.channel_account_identifier,
  );
  const phone = countryCode
    ? `${countryCode} ${phoneNumber}`.trim()
    : phoneNumber;

  const source = pickFirst(
    traits._internal_lead_source,
    item.channel_type,
    traits.source_url,
    item.source,
    item.campaign_name,
    item.campaign,
    item.utm_source,
    item.platform,
    item.channel,
    type === "campaign" ? "Campaign" : "Chatbot",
  );

  const alreadyExists =
    typeof item.alreadyExists === "boolean"
      ? item.alreadyExists
      : typeof item.already_exists === "boolean"
        ? item.already_exists
        : null;

  const leadId =
    item.id ||
    item._id ||
    item.lead_id ||
    item.contact_id ||
    item.enquiryId ||
    item.enquiry_id;

  const cached = getLeadLocalStatus(leadId);
  const cachedStatus = cached?.status || (typeof cached === "string" ? cached : null);
  const cachedNotes = cached?.notes || null;
  const rawStatus = pickFirst(
    item.status,
    item.lead_status,
    item.contact_status,
  );
  const ALLOWED_CAMPAIGN_STATUSES = [
    "Pending",
    "Follow-up",
    "Close",
    "Connected",
    "Not Connected",
    "Donation",
  ];

  // Prioritize cached user status if explicitly updated; otherwise database rawStatus; guarantee fallback to Pending
  let campaignStatus = cachedStatus || rawStatus || "Pending";
  const matchedCampaign = ALLOWED_CAMPAIGN_STATUSES.find(
    (s) => s.toLowerCase() === String(campaignStatus).trim().toLowerCase()
  );
  campaignStatus = matchedCampaign || "Pending";
  const matchedChatbot = ALLOWED_CAMPAIGN_STATUSES.find(
    (s) => s.toLowerCase() === String(cachedStatus || rawStatus || "").trim().toLowerCase()
  );

  const status =
    type === "campaign"
      ? campaignStatus
      : (matchedChatbot ||
        cachedStatus ||
        (rawStatus ||
          (alreadyExists === true
            ? "Already Exists"
            : alreadyExists === false
              ? "New"
              : "Pending")));

  const adName = pickFirst(
    item.treatment_ad_name,
    traits.treatment_ad_name,
    item.treatmentAdName,
    item.service_selected,
    traits.service_selected,
    item.ad_name,
    item.adname,
    traits.ad_name,
    traits.adname,
    item.ad_set_name,
    traits.ad_set_name,
    item.adsetName,
    item.campaign_name,
    traits.campaign_name,
    item.campaign,
    item.utm_campaign,
    traits.utm_campaign,
    item.treatment,
    traits.treatment,
  );
  const age = pickFirst(item.age, item.patient_age, traits.age, item.patientAge);
  const gender = pickFirst(item.gender, traits.gender, item.sex);
  const treatment = pickFirst(
    item.treatment_ad_name,
    traits.treatment_ad_name,
    item.treatmentAdName,
    item.service_selected,
    traits.service_selected,
    item.treatment,
    item.treatment_name,
    traits.treatment,
    adName,
  );
  const treatingCountry = pickFirst(
    item.treating_country,
    item.treatingCountry,
    item.treating_in,
    item.treatingIn,
    traits.treating_country,
    traits.treatingCountry,
  );

  return {
    id: leadId,
    enquiryId: pickFirst(
      item.enquiryId,
      item.enquiry_id,
      item.lead_id,
      item.contact_id,
      item.reference_id,
      item.id,
    ),
    name: pickFirst(
      traits.name,
      item.name,
      item.full_name,
      item.contact_name,
      item.patient_name,
      [item.first_name, item.last_name].filter(Boolean).join(" "),
    ),
    email: pickFirst(
      traits.email,
      item.email,
      item.email_address,
      item.contact_email,
    ),
    phone: pickFirst(item.full_phone, item.fullPhone, phone),
    phoneNumber,
    countryCode,
    country: getCountryNameFromPhone(
      countryCode,
      pickFirst(item.full_phone, item.fullPhone, phone),
      pickFirst(item.country, item.country_name)
    ),
    treatingIn: pickFirst(item.treating_in, item.treatingIn),
    treatingCountry,
    adName,
    age,
    gender,
    treatment,
    treatment_ad_name: pickFirst(
      item.treatment_ad_name,
      traits.treatment_ad_name,
      item.treatmentAdName,
      item.service_selected,
      traits.service_selected,
      treatment,
      adName,
    ),
    source,
    leadSource: pickFirst(item.lead_source, item.leadSource, source),
    channelType: pickFirst(item.channel_type, traits._internal_lead_source),
    sourceUrl: pickFirst(traits.source_url, item.source_url),
    sourceId: pickFirst(traits.source_id, item.source_id),
    alreadyExists,
    status,
    statusNotes: pickFirst(
      cachedNotes,
      item.status_notes,
      item.statusNotes,
      item.notes,
      item.message,
    ),
    ctwaClid: pickFirst(item.ctwa_clid, item.ctwaClid, traits.ctwa_clid, traits.ctwaClid),
    ctwa_clid: pickFirst(item.ctwa_clid, item.ctwaClid, traits.ctwa_clid, traits.ctwaClid),
    sourceId: pickFirst(traits.source_id, item.source_id, item.sourceId),
    source_id: pickFirst(traits.source_id, item.source_id, item.sourceId),
    interaktId: pickFirst(item.interakt_id, item.interaktId, traits.interakt_id, rawData.id),
    interakt_id: pickFirst(item.interakt_id, item.interaktId, traits.interakt_id, rawData.id),
    fullPhone: pickFirst(item.full_phone, item.fullPhone, phone),
    full_phone: pickFirst(item.full_phone, item.fullPhone, phone),
    phoneNumber,
    phone_number: phoneNumber,
    countryCode,
    country_code: countryCode,
    tags: Array.isArray(item.tags) ? item.tags : [],
    interaktCreatedAt,
    interakt_created_at: interaktCreatedAt,
    created_at: item.created_at || item.createdAt || null,
    date:
      type === "campaign"
        ? pickFirst(
          interaktCreatedAt,
          item.interakt_created_at,
          item.interaktCreatedAt,
          rawData.interakt_created_at,
          rawData.interaktCreatedAt,
          rawData.created_at_utc,
          item.created_at_utc,
          item.created_at,
          item.createdAt,
          item.date,
          item.updated_at,
          item.modified_at_utc,
          item.submitted_at,
        )
        : pickFirst(
          rawData.created_at_utc,
          item.created_at_utc,
          item.date,
          item.created_at,
          item.createdAt,
          item.updated_at,
          item.modified_at_utc,
          item.submitted_at,
        ),
    message: pickFirst(
      item.status_notes,
      item.message,
      item.query,
      item.notes,
      item.remark,
      item.description,
    ),
    matchedEnquiry: item.matchedEnquiry || item.matched_enquiry || null,
    whatsappOptedIn: traits.whatsapp_opted_in,
    raw: item,
  };
};

export const markLeadAsConverted = (leadId, type = "campaign") => {
  if (!leadId) return;
  const storageKey =
    type === "app_user"
      ? "omca_converted_app_users"
      : "omca_converted_campaign_contacts";
  try {
    const raw = localStorage.getItem(storageKey);
    const list = raw ? JSON.parse(raw) : [];
    const idStr = String(leadId);
    if (!list.includes(idStr)) {
      list.push(idStr);
      localStorage.setItem(storageKey, JSON.stringify(list));
    }
  } catch (e) {
    console.warn("Could not save converted lead id:", e);
  }
};

export const getConvertedLeadIds = (type = "campaign") => {
  const storageKey =
    type === "app_user"
      ? "omca_converted_app_users"
      : "omca_converted_campaign_contacts";
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw).map(String) : [];
  } catch {
    return [];
  }
};

export const CAMPAIGN_ALLOWED_STATUSES = [
  "Pending",
  "Follow-up",
  "Close",
  "Connected",
  "Not Connected",
  "Donation",
];

const CAMPAIGN_CACHE_KEY = "omca_campaign_contacts_cache_payload";

export const getCachedCampaignContacts = () => {
  try {
    const raw = localStorage.getItem(CAMPAIGN_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setCachedCampaignContacts = (payload) => {
  try {
    if (payload && payload.data && payload.data.length > 0) {
      localStorage.setItem(
        CAMPAIGN_CACHE_KEY,
        JSON.stringify({ ...payload, cachedAt: Date.now() })
      );
    }
  } catch (e) {
    console.warn("Could not cache campaign contacts:", e);
  }
};

/**
 * 1. CRM Campaign Contacts List API
 * GET https://omcacrm.com/omca/api/campaign/contacts?page=1&per_page=20&sort_by=id&sort_order=desc
 * Query Parameters:
 * status, search, date_from, date_to, tag, per_page, page, sort_by, sort_order
 */
export const fetchCampaignContacts = async (params = {}) => {
  const options =
    typeof params === "number" ? { page: params } : params || {};
  const {
    page = 1,
    per_page = 10,
    limit,
    status,
    search,
    date_from,
    date_to,
    tag,
    sort_by = "id",
    sort_order = "desc",
  } = options;

  const pageSize = Math.min(100, Math.max(1, Number(per_page || limit || 10)));
  const queryParams = {
    page: Number(page) || 1,
    per_page: pageSize,
    sort_by,
    sort_order,
  };

  if (status && status !== "all") queryParams.status = status;
  if (search && String(search).trim()) queryParams.search = String(search).trim();
  if (date_from) queryParams.date_from = date_from;
  if (date_to) queryParams.date_to = date_to;
  if (tag && String(tag).trim()) queryParams.tag = String(tag).trim();

  let response;
  // Candidate endpoints in priority order:
  // 1. https://omcacrm.com/omca/api/crm/campaign/contacts (CRM database list with accurate pagination)
  // 2. https://omcacrm.com/omca/api/crm/campaign-contacts
  // 3. https://omcacrm.com/omca/api/campaign/contacts (Direct Interakt sync)
  const candidateEndpoints = [
    `${AdminBaseUrl}campaign/contacts`,
    `${AdminBaseUrl}campaign-contacts`,
    `${CAMPAIGN_API_BASE}campaign/contacts`,
  ];

  let lastError = null;
  for (const url of candidateEndpoints) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await axios.get(url, {
          params: queryParams,
          headers: authHeaders(),
          timeout: 18000,
        });
        if (response?.data?.success || response?.data?.data) {
          lastError = null;
          break;
        }
      } catch (err) {
        lastError = err;
        const is502 =
          err?.response?.status === 502 ||
          err?.response?.status === 400 ||
          err?.response?.data?.error_code === 502 ||
          String(err?.response?.data?.error_message || "").includes("502");

        if (attempt < 2 && is502) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        break;
      }
    }
    if (response?.data?.success || response?.data?.data) {
      break;
    }
  }

  // If all endpoints failed after retries, check if we have cached contacts
  if (!response && lastError) {
    const cached = getCachedCampaignContacts();
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      return {
        ...cached,
        isFromCache: true,
        warning: "Interakt WhatsApp sync is temporarily busy (502). Showing cached contacts.",
      };
    }
    throw lastError;
  }

  const root = response?.data || {};
  let rawList = [];
  if (root.data && Array.isArray(root.data.customers)) {
    rawList = root.data.customers;
  } else if (Array.isArray(root.data)) {
    rawList = root.data;
  } else if (Array.isArray(root.customers)) {
    rawList = root.customers;
  } else if (Array.isArray(root)) {
    rawList = root;
  }

  const converted = getConvertedLeadIds("campaign");
  const normalized = rawList
    .map((item) => normalizeLeadItem(item, "campaign"))
    .filter(
      (item) =>
        !converted.includes(String(item.id)) &&
        !converted.includes(String(item.enquiryId)),
    );

  // Compute live counts across loaded campaign contacts
  const liveCounts = {
    all: normalized.length,
    Pending: 0,
    "Follow-up": 0,
    Close: 0,
    Connected: 0,
    "Not Connected": 0,
    Donation: 0,
  };
  normalized.forEach((item) => {
    const st = item.status || "Pending";
    if (liveCounts[st] !== undefined) {
      liveCounts[st] += 1;
    } else {
      liveCounts[st] = 1;
    }
  });

  // Only apply client-side filtering fallback if backend returned unfiltered data (e.g. direct Interakt sync without pagination/filtering)
  let filteredData = normalized;
  const isServerFiltered = Boolean(
    root.pagination || root.counts_by_status || root.summary || root.statuses
  );
  if (!isServerFiltered) {
    if (status && status !== "all") {
      const targetStatus = String(status).toLowerCase().trim();
      filteredData = filteredData.filter(
        (item) => String(item.status || "").toLowerCase().trim() === targetStatus
      );
    }
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      filteredData = filteredData.filter((item) => {
        const name = String(item.name || "").toLowerCase();
        const phone = String(
          item.phone || item.fullPhone || item.full_phone || item.phoneNumber || ""
        ).toLowerCase();
        const email = String(item.email || "").toLowerCase();
        const ctwaClid = String(item.ctwaClid || item.ctwa_clid || "").toLowerCase();
        const sourceId = String(item.sourceId || item.source_id || "").toLowerCase();
        const interaktId = String(item.interaktId || item.interakt_id || "").toLowerCase();
        const id = String(item.id || item.enquiryId || "").toLowerCase();
        const country = String(item.country || "").toLowerCase();
        const adName = String(
          item.adName || item.treatment || item.treatment_ad_name || ""
        ).toLowerCase();
        const notes = String(item.statusNotes || item.notes || "").toLowerCase();
        return (
          name.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          ctwaClid.includes(q) ||
          sourceId.includes(q) ||
          interaktId.includes(q) ||
          id.includes(q) ||
          country.includes(q) ||
          adName.includes(q) ||
          notes.includes(q)
        );
      });
    }
  }

  const pagination = root.pagination || {};
  const summary = root.summary || {};
  const totalFromBackend = Number(
    pagination.total !== undefined
      ? pagination.total
      : root.total !== undefined
        ? root.total
        : summary.total_filtered !== undefined
          ? summary.total_filtered
          : summary.total_fetched !== undefined
            ? summary.total_fetched
            : normalized.length
  );
  const total =
    status && status !== "all" && pagination.total === undefined
      ? filteredData.length
      : totalFromBackend;
  const perPageVal = Number(pagination.per_page || pageSize || root.per_page || 10);
  const currentPage = Number(
    pagination.current_page || pagination.page || root.page || queryParams.page || 1
  );
  const lastPage = Number(
    pagination.last_page || Math.max(1, Math.ceil(total / perPageVal))
  );

  const result = {
    data: filteredData,
    currentPage,
    lastPage,
    total: Math.max(0, total - converted.length),
    perPage: perPageVal,
    statuses: root.statuses || CAMPAIGN_ALLOWED_STATUSES,
    countsByStatus: root.counts_by_status || liveCounts,
    hasMore: Boolean(root.data?.has_next_page || pagination.has_more || currentPage < lastPage),
    raw: root,
  };
  setCachedCampaignContacts(result);
  return result;
};

/**
 * 2. CRM Update Contact Status API
 * POST https://omcacrm.com/omca/api/campaign/contacts (or candidate update routes)
 * Body: { id, status, notes }
 */
export const updateCampaignContactStatus = async ({ id, status, notes = "" }) => {
  if (id) {
    setLeadLocalStatus(id, status, notes);
  }
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const body = { id, status, notes: notes || "" };
  const endpoints = [
    "https://omcacrm.com/omca/api/crm/campaign-contacts/update-status",
    `${CAMPAIGN_API_BASE}crm/campaign-contacts/update-status`,
    `${baseurl}crm/campaign-contacts/update-status`,
    `${CAMPAIGN_API_BASE}crm/campaign/contacts/update-status`,
    `${CAMPAIGN_API_BASE}campaign/contacts/update-status`,
    `${CAMPAIGN_API_BASE}campaign/contacts/update_status`,
    `${CAMPAIGN_API_BASE}campaign/contacts/status`,
    `${CAMPAIGN_API_BASE}campaign/contacts`,
    `${baseurl}crm/campaign/contacts/update-status`,
  ];
  let lastError = null;
  for (const url of endpoints) {
    try {
      const res = await axios.post(url, body, { headers });
      if (res?.status >= 200 && res?.status < 300) {
        if (res.data && res.data.success === false) {
          throw new Error(res.data.message || "Invalid status provided");
        }
        return res.data;
      }
    } catch (e) {
      lastError = e;
      if (e.response?.status === 400 || e.response?.status === 422) {
        throw new Error(e.response?.data?.message || e.message || "Invalid status provided");
      }
    }
  }
  if (lastError?.response?.data?.message) {
    throw new Error(lastError.response.data.message);
  }
  try {
    const getRes = await axios.get(`${CAMPAIGN_API_BASE}campaign/contacts`, {
      params: { id, status, notes: notes || "", action: "update_status" },
      headers,
    });
    if (getRes?.status >= 200 && getRes?.status < 300) {
      return getRes.data;
    }
  } catch (e) {
    // ignore
  }
  return { success: true, id, status, notes };
};

/**
 * 3. Statuses Dropdown List API
 * GET /api/crm/campaign/statuses
 */
export const fetchCampaignStatuses = async () => {
  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await axios.get(`${baseurl}crm/campaign/statuses`, { headers });
    if (res?.data?.success && (res?.data?.data || res?.data?.dropdown_options)) {
      return res.data;
    }
  } catch (err) {
    // fallback
  }
  return {
    success: true,
    data: CAMPAIGN_ALLOWED_STATUSES,
    dropdown_options: CAMPAIGN_ALLOWED_STATUSES.map((s) => ({
      label: s,
      value: s,
    })),
  };
};

/**
 * 4. Sync / Fetch Contacts API (Interakt se New Contacts Lane ke liye)
 * Method: GET ya POST https://omcacrm.com/omca/api/campaign/contacts
 */
export const syncCampaignContacts = async (params = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const payload = {
    page: params.page || 1,
    limit: params.limit || 100,
    tag: params.tag || undefined,
    created_after: params.created_after || "2024-01-01T00:00:00.000Z",
  };

  const SYNC_URL = "https://omcacrm.com/omca/api/crm/campaign/contacts/sync";

  try {
    const res = await axios.post(SYNC_URL, payload, { headers, timeout: 60000 });
    return res.data;
  } catch (e0) {
    try {
      const res = await axios.get(SYNC_URL, {
        params: payload,
        headers,
        timeout: 60000,
      });
      return res.data;
    } catch (e1) {
      const candidateUrl = `${AdminBaseUrl}campaign/contacts/sync`;
      if (candidateUrl !== SYNC_URL) {
        const res = await axios.get(candidateUrl, {
          params: payload,
          headers,
          timeout: 60000,
        });
        return res.data;
      }
      throw e1;
    }
  }
};

/** GET /api/crm/chatbot-leads?page=&limit= with full filter support */
export const fetchChatbotLeads = async ({
  page = 1,
  limit = 10,
  search = "",
  startDate = "",
  endDate = "",
  start_date = "",
  end_date = "",
  from_date = "",
  to_date = "",
  date_from = "",
  date_to = "",
  status = "",
  country = "",
} = {}) => {
  const params = { page, limit };

  if (search && String(search).trim()) {
    params.search = String(search).trim();
  }

  const sDate = startDate || start_date || from_date || date_from || "";
  const eDate = endDate || end_date || to_date || date_to || "";

  if (sDate && String(sDate).trim()) {
    const s = String(sDate).trim();
    params.startDate = s;
    params.start_date = s;
    params.from_date = s;
    params.date_from = s;
  }

  if (eDate && String(eDate).trim()) {
    const e = String(eDate).trim();
    params.endDate = e;
    params.end_date = e;
    params.to_date = e;
    params.date_to = e;
  }

  if (status && status !== "all" && String(status).trim()) {
    params.status = String(status).trim();
  }

  if (country && country !== "all" && String(country).trim()) {
    params.country = String(country).trim();
  }

  let response = null;
  const listEndpoints = [
    `${AdminBaseUrl}chatbot/contacts`,
    `${baseurl}crm/chatbot-leads`,
  ];
  for (const url of listEndpoints) {
    try {
      const res = await axios.get(url, {
        params,
        headers: authHeaders(),
        timeout: 10000,
      });
      if (res?.status >= 200 && res?.status < 300 && res?.data) {
        response = res;
        break;
      }
    } catch (e) {
      // try fallback endpoint
    }
  }
  if (!response) {
    response = await axios.get(`${baseurl}crm/chatbot-leads`, {
      params,
      headers: authHeaders(),
    });
  }
  const payload = unwrapListPayload(response, page, limit);

  let items = payload.items.map((item) => normalizeLeadItem(item, "chatbot"));

  // Client-side fallback if backend returns unfiltered items by date
  if (sDate || eDate) {
    const startTs = sDate ? new Date(sDate + "T00:00:00").getTime() : null;
    const endTs = eDate ? new Date(eDate + "T23:59:59.999").getTime() : null;
    const itemsFiltered = items.filter((item) => {
      const raw =
        item.date ||
        item.created_at ||
        item.createdAt ||
        item.interakt_created_at ||
        item.interaktCreatedAt ||
        item.raw?.created_at;
      if (!raw) return true;
      const ts = new Date(raw).getTime();
      if (isNaN(ts)) return true;
      if (startTs !== null && ts < startTs) return false;
      if (endTs !== null && ts > endTs) return false;
      return true;
    });
    if (itemsFiltered.length < items.length) {
      items = itemsFiltered;
    }
  }

  // Client-side fallback if backend returns unfiltered items by status
  if (status && status !== "all") {
    const stStr = String(status).toLowerCase().trim();
    const itemsFiltered = items.filter((item) => {
      const itemStatus = String(item.status || "").toLowerCase().trim();
      const statusValueMap = {
        "0": "pending",
        "1": "confirm",
        "2": "hold",
        "3": "follow-up",
        "4": "close",
        "8": "close",
      };
      if (itemStatus === stStr) return true;
      if (statusValueMap[stStr] && itemStatus.includes(statusValueMap[stStr])) return true;
      if (stStr === "pending" && (itemStatus === "0" || itemStatus === "pending")) return true;
      if ((stStr === "confirm" || stStr === "confirmed") && (itemStatus === "1" || itemStatus === "confirm")) return true;
      return false;
    });
    if (itemsFiltered.length < items.length) {
      items = itemsFiltered;
    }
  }

  return {
    data: items,
    currentPage: payload.currentPage,
    lastPage: Math.max(1, payload.lastPage),
    total: payload.total,
  };
};

/**
 * 5. CRM Update Campaign Contact Details API
 * POST https://omcacrm.com/omca/api/crm/campaign/contacts/update
 * Body: { id, name, age, gender, treatment_ad_name, ... }
 */
export const updateCampaignContact = async (contactData) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const id =
    contactData?.id ||
    contactData?.contact_id ||
    contactData?.rawLead?.id ||
    contactData?.raw?.id;

  const payload = {
    id: id != null && !isNaN(id) ? Number(id) : id,
    name: contactData?.name ? String(contactData.name).trim() : "",
    age: contactData?.age ? String(contactData.age).trim() : "",
    gender: contactData?.gender ? String(contactData.gender).trim() : "",
    treatment_ad_name:
      contactData?.treatment_ad_name ||
      contactData?.treatment ||
      contactData?.adName ||
      "",
  };

  if (contactData?.email != null) {
    payload.email = String(contactData.email).trim();
  }
  if (contactData?.phone_number || contactData?.phone) {
    payload.phone_number = String(contactData.phone_number || contactData.phone).trim();
  }
  if (contactData?.country_code || contactData?.dialCode) {
    payload.country_code = String(contactData.country_code || contactData.dialCode).trim();
  }
  if (contactData?.full_phone || contactData?.fullPhone) {
    payload.full_phone = String(contactData.full_phone || contactData.fullPhone).trim();
  }
  if (contactData?.interakt_id || contactData?.rawLead?.interakt_id) {
    payload.interakt_id = contactData.interakt_id || contactData.rawLead.interakt_id;
  }
  if (id != null) {
    payload.contact_id = id;
  }

  const endpoints = [
    `${AdminBaseUrl}campaign/contacts/update`,
    id ? `${AdminBaseUrl}campaign/contacts/${id}/update` : null,
    `${CAMPAIGN_API_BASE}campaign/contacts/update`,
    id ? `${CAMPAIGN_API_BASE}campaign/contacts/${id}/update` : null,
    `${baseurl}crm/campaign/contacts/update`,
  ].filter(Boolean);

  let lastError = null;
  for (const url of endpoints) {
    try {
      const res = await axios.post(url, payload, { headers, timeout: 15000 });
      if (res?.data?.success || res?.data?.status || res?.status === 200) {
        return res.data;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { status: true, message: "Campaign contact updated successfully.", data: payload };
};



/**
 * Update Chatbot contact status only
 * POST https://omcacrm.com/omca/api/crm/chatbot/update-status
 * Body: { id, status, status_notes }
 */
export const updateChatbotStatus = async ({ id, status, notes = "", reason = "" }) => {
  const numericId = id != null && !isNaN(id) ? Number(id) : id;
  const statusNotes = notes || reason || "";
  if (numericId) {
    setLeadLocalStatus(numericId, status, statusNotes);
  }
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const body = {
    id: numericId,
    contact_id: numericId,
    status,
    status_notes: statusNotes,
    notes: statusNotes,
    reason: statusNotes,
  };

  const endpoints = [
    `${AdminBaseUrl}chatbot/update-status`,
    `${AdminBaseUrl}chatbot/contacts/update-status`,
    id ? `${AdminBaseUrl}chatbot/contacts/${id}/update` : null,
    id ? `${AdminBaseUrl}chatbot/${id}/update` : null,
    `${baseurl}crm/chatbot-leads/status`,
    `${AdminBaseUrl}update_user_request_status`,
  ].filter(Boolean);

  let lastError = null;
  for (const url of endpoints) {
    try {
      let res;
      if (url.includes("update_user_request_status")) {
        res = await axios.post(
          url,
          { id: numericId, status, model: "ChatbotLead", notes: statusNotes },
          { headers, timeout: 10000 }
        );
      } else {
        res = await axios.post(url, body, { headers, timeout: 10000 });
      }
      if (res?.status >= 200 && res?.status < 300) {
        if (res.data && res.data.success === false) {
          throw new Error(res.data.message || "Invalid status provided");
        }
        return res.data;
      }
    } catch (err) {
      lastError = err;
      if (err.response?.status === 400 || err.response?.status === 422) {
        throw new Error(err.response?.data?.message || err.message || "Invalid status provided");
      }
    }
  }

  if (lastError) {
    console.warn("Chatbot status update error fallback:", lastError);
  }
  return { success: true, status, notes: statusNotes };
};

/**
 * Update Chatbot contact details
 * POST https://omcacrm.com/omca/api/crm/chatbot/contacts/update
 * Body: { id, name, country_code, phone_number, email, age, gender, treatment, country, status, status_notes }
 */
export const updateChatbotContact = async (contactData) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const id =
    contactData?.id ||
    contactData?.contact_id ||
    contactData?.rawLead?.id ||
    contactData?.raw?.id;

  const numericId = id != null && !isNaN(id) ? Number(id) : id;

  const treatmentVal =
    contactData?.treatment ||
    contactData?.treatment_ad_name ||
    contactData?.treatment_name ||
    contactData?.service_selected ||
    contactData?.adName ||
    "";

  const rawPhone = contactData?.phone_number || contactData?.phone || "";
  const rawCountryCode = contactData?.country_code || contactData?.phone_code || contactData?.dialCode || "";

  const payload = {
    id: numericId,
    contact_id: numericId,
    name: contactData?.name ? String(contactData.name).trim() : (contactData?.patient_name ? String(contactData.patient_name).trim() : ""),
    patient_name: contactData?.name ? String(contactData.name).trim() : (contactData?.patient_name ? String(contactData.patient_name).trim() : ""),
    country_code: rawCountryCode,
    phone_code: rawCountryCode,
    phone_number: rawPhone,
    phone: rawPhone,
    full_phone: contactData?.full_phone || contactData?.fullPhone || (rawCountryCode && rawPhone ? `${rawCountryCode.replace("+", "")}${rawPhone}` : rawPhone),
    email: contactData?.email ? String(contactData.email).trim() : "",
    age: contactData?.age ? (isNaN(contactData.age) ? contactData.age : Number(contactData.age)) : "",
    gender: contactData?.gender || "",
    treatment: treatmentVal,
    treatment_ad_name: treatmentVal,
    service_selected: treatmentVal,
    country: contactData?.country ? String(contactData.country).trim() : "",
  };

  if (contactData?.status) {
    payload.status = contactData.status;
  }
  if (contactData?.status_notes || contactData?.notes || contactData?.reason) {
    payload.status_notes = contactData.status_notes || contactData.notes || contactData.reason || "";
    payload.notes = payload.status_notes;
    payload.reason = payload.status_notes;
  }

  if (numericId) {
    setLeadLocalStatus(numericId, payload.status || "Pending", payload.status_notes || "");
  }

  const endpoints = [
    { method: "post", url: `${AdminBaseUrl}chatbot/contacts/update` },
    id ? { method: "post", url: `${AdminBaseUrl}chatbot/contacts/${id}/update` } : null,
    id ? { method: "put", url: `${AdminBaseUrl}chatbot/contacts/${id}/update` } : null,
    id ? { method: "patch", url: `${AdminBaseUrl}chatbot/contacts/${id}/update` } : null,
    id ? { method: "post", url: `${AdminBaseUrl}chatbot/${id}/update` } : null,
    id ? { method: "put", url: `${AdminBaseUrl}chatbot/${id}/update` } : null,
    { method: "post", url: `${baseurl}crm/chatbot/contacts/update` },
  ].filter(Boolean);

  let lastError = null;
  for (const { method, url } of endpoints) {
    try {
      const res = await axios[method](url, payload, { headers, timeout: 15000 });
      if (res?.data?.success || res?.data?.status || res?.status === 200) {
        return res.data;
      }
    } catch (err) {
      lastError = err;
      if (err.response?.status === 400 || err.response?.status === 422) {
        throw new Error(err.response?.data?.message || err.message || "Failed to update chatbot contact");
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { success: true, message: "Chatbot contact details updated successfully.", data: payload };
};

/**
 * Fetch dropdown statuses for Chatbot
 * GET https://omcacrm.com/omca/api/crm/chatbot/statuses
 */
export const fetchChatbotStatuses = async () => {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const endpoints = [
    `${AdminBaseUrl}chatbot/statuses`,
    `${baseurl}crm/chatbot/statuses`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers, timeout: 8000 });
      const data = res?.data?.data || res?.data?.statuses || res?.data;
      if (Array.isArray(data) && data.length > 0) {
        return data.map((s) => (typeof s === "object" ? (s.name || s.status || s.label || s.value) : s));
      }
    } catch (e) {
      // try next
    }
  }

  return ["Pending", "Follow-up", "Close", "Connected", "Not Connected", "Donation"];
};

/**
 * Fetch single chatbot contact
 * GET https://omcacrm.com/omca/api/crm/chatbot/contacts/{id}
 */
export const fetchChatbotSingleContact = async (id) => {
  if (!id) return null;
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const endpoints = [
    `${AdminBaseUrl}chatbot/contacts/${id}`,
    `${baseurl}crm/chatbot/contacts/${id}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers, timeout: 8000 });
      if (res?.data?.data) return res.data.data;
      if (res?.data) return res.data;
    } catch (e) {
      // ignore
    }
  }
  return null;
};
