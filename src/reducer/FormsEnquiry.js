import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { AdminBaseUrl } from "../Basurl/Baseurl";
import {
  markRequestRead,
  markRecordRead,
  publishGeneralEnquiryUnread,
  getCachedGeneralEnquiryUnread,
  UNREAD_REFRESH_EVENT,
} from "../services/unreadApi";
import {
  isReferralUser,
  getReferralMysqlId,
  isInsuranceUser,
  getInsuranceMysqlId,
} from "../utils/authStorage";

// ==================== IN-FLIGHT DEDUPLICATION & TTL ====================
let inFlightTestFormsPromise = null;
let lastTestFormsFetchTime = 0;
let cachedTestFormsResponse = null;
let testForms429BackoffUntil = 0;

// ==================== THUNK ====================
export const testForms = createAsyncThunk(
  "testForms/fetchData",
  async (customParams, { rejectWithValue }) => {
    try {
      const isForce = customParams && customParams.force === true;

      if (Date.now() < testForms429BackoffUntil) {
        if (cachedTestFormsResponse) return cachedTestFormsResponse;
      }

      if (!isForce && cachedTestFormsResponse && Date.now() - lastTestFormsFetchTime < 6000) {
        return cachedTestFormsResponse;
      }

      if (inFlightTestFormsPromise) {
        return await inFlightTestFormsPromise;
      }

      inFlightTestFormsPromise = (async () => {
        let payload =
          customParams && typeof customParams === "object"
            ? { ...customParams }
            : {};
        delete payload.force;

        if (isReferralUser()) {
          const mysqlId = getReferralMysqlId();
          payload = {
            ...payload,
            user_id:
              mysqlId != null
                ? !isNaN(Number(mysqlId))
                  ? Number(mysqlId)
                  : mysqlId
                : undefined,
            type: "referral",
          };
        } else if (isInsuranceUser()) {
          const mysqlId = getInsuranceMysqlId();
          payload = {
            ...payload,
            user_id:
              mysqlId != null
                ? !isNaN(Number(mysqlId))
                  ? Number(mysqlId)
                  : mysqlId
                : undefined,
            type: "insurance",
          };
        }

        const token = localStorage.getItem("token");
        const headers = {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const response = await axios.post(
          `${AdminBaseUrl}user_requests_via_app`,
          payload,
          { headers }
        );

        if (response.data?.unreadCount) {
          const cached = getCachedGeneralEnquiryUnread() || {};
          const portalPickup = Number(cached.portal_pickup || 0);
          const appPickup = Number(response.data.unreadCount.pickup || 0);
          publishGeneralEnquiryUnread({
            ...response.data.unreadCount,
            app_pickup: appPickup,
            portal_pickup: portalPickup,
            pickup: appPickup + portalPickup,
          });
        }

        cachedTestFormsResponse = response.data;
        lastTestFormsFetchTime = Date.now();
        return response.data;
      })();

      const result = await inFlightTestFormsPromise;
      return result;
    } catch (error) {
      if (error?.response?.status === 429) {
        testForms429BackoffUntil = Date.now() + 60000;
      }
      if (cachedTestFormsResponse) {
        return cachedTestFormsResponse;
      }
      return rejectWithValue(
        error.response?.data || error.message || "Something went wrong"
      );
    } finally {
      inFlightTestFormsPromise = null;
    }
  }
);

// ==================== SLICE ====================
const FormsEnquiry = createSlice({
  name: "testForms",
  initialState: {
    testForms: [],
    loading: false,
    error: null,
  },
  reducers: {
    markTestFormRead: (state, action) => {
      const { model, id } = action.payload || {};
      const list = state.testForms?.data?.[model];
      if (Array.isArray(list)) {
        const item = list.find((row) => String(row.id) === String(id));
        if (item) {
          item.isUnread = false;
          item.is_seen = 1;
          item.is_read = 1;
        }
      }
      const counts = state.testForms?.unreadCount;
      if (counts && typeof counts === "object") {
        counts[model] = Math.max(0, (Number(counts[model]) || 0) - 1);
        const cached = getCachedGeneralEnquiryUnread() || {};
        const portalPickup = Number(cached.portal_pickup || 0);
        const appPickup = Number(counts.pickup || 0);
        publishGeneralEnquiryUnread({
          ...counts,
          app_pickup: appPickup,
          portal_pickup: portalPickup,
          pickup: appPickup + portalPickup,
        });
      }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(testForms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(testForms.fulfilled, (state, action) => {
        state.loading = false;
        state.testForms = action.payload;
      })
      .addCase(testForms.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        state.error =
          typeof payload === "string"
            ? payload
            : payload?.message ||
              payload?.error ||
              action.error?.message ||
              "Something went wrong";
      });
  },
});

export const { markTestFormRead } = FormsEnquiry.actions;

export const markTestFormRequestRead = (model, item) => async (dispatch) => {
  const recordId = String(
    (item && typeof item === "object"
      ? item.id || item.enquiryId || item.appointmentId
      : item) || ""
  ).trim();
  if (!recordId) return;

  // 1. Call same API used by http://localhost:3000/Admin/Inquiry Enquiry tab:
  markRecordRead("enquiries", recordId);
  if (model) {
    markRecordRead(model, recordId);
    markRecordRead("generalEnquiries", recordId);
    markRequestRead(model, recordId);
  }

  // 2. Clear unread in Redux store & publish unread count
  dispatch(markTestFormRead({ model: model || "pickup", id: recordId }));

  // 3. Dispatch unread refresh
  window.dispatchEvent(new CustomEvent(UNREAD_REFRESH_EVENT));
};

export default FormsEnquiry.reducer;
