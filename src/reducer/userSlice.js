import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { baseurl } from "../Basurl/Baseurl";
import { isMongoObjectId, isReferralUser, isInsuranceUser, notifyAuthChanged } from "../utils/authStorage";
import { fetchReferralById, updateReferral } from "../services/referralApi";
import { fetchInsuranceById, updateInsurance } from "../services/insuranceApi";
import {
  parsePermissionsFromAny,
  ALL_ADMIN_ENDPOINTS,
  fetchAndApplyUserDetails,
} from "../services/userDetailsService";

export const GetUserData = createAsyncThunk(
  "getuser/GetUserData",
  async (_, { rejectWithValue }) => {
    try {
      const userId = localStorage.getItem("_id");
      const isRef = isReferralUser();
      const isIns = isInsuranceUser();

      // If user is a referral partner or insurance partner or the ID is not a MongoDB ObjectId,
      // prevent calling /get_details/:id which requires a 24-character hex ObjectId
      if (isRef || isIns || (userId && !isMongoObjectId(userId))) {
        if (isIns) {
          const rawIns = localStorage.getItem("insurance_id");
          const insIdentifier =
            rawIns && rawIns !== "undefined" && rawIns !== "null"
              ? rawIns
              : userId && userId !== "undefined" && userId !== "null" && userId !== "insurance_user"
              ? userId
              : "";
          if (insIdentifier) {
            try {
              const res = await fetchInsuranceById(insIdentifier);
              const insData = res?.insurance || res?.data || res;
              if (insData && typeof insData === "object" && (insData.id || insData.insurance_id || insData.name)) {
                const phoneVal = insData.phone || insData.phone_no || "";
                return {
                  ...insData,
                  _id: insData._id || insData.id || userId,
                  id: insData.id || userId,
                  insurance_id: insData.insurance_id || insIdentifier || "",
                  name:
                    insData.name ||
                    localStorage.getItem("name") ||
                    "Insurance Partner",
                  email:
                    insData.email ||
                    localStorage.getItem("email") ||
                    "",
                  phone: phoneVal,
                  phone_no: phoneVal,
                  phone_code: insData.phone_code || "+91",
                  gender: insData.gender || "",
                  linkedPatientsCount:
                    res?.linkedPatientsCount ?? insData.linkedPatientsCount ?? 0,
                  role: "INSURANCE",
                  isInsurance: true,
                };
              }
            } catch (insErr) {
              console.warn(
                "Failed to fetch insurance details, using cached profile:",
                insErr
              );
            }
          }
          const cachedPhone =
            localStorage.getItem("phone") ||
            localStorage.getItem("phone_no") ||
            "";
          return {
            _id: userId,
            id: userId,
            insurance_id: insIdentifier || "",
            name: localStorage.getItem("name") || "Insurance Partner",
            email: localStorage.getItem("email") || "",
            phone: cachedPhone,
            phone_no: cachedPhone,
            gender: "",
            role: "INSURANCE",
            isInsurance: true,
          };
        }

        if (isRef) {
          const rawRef = localStorage.getItem("referral_id");
          const refIdentifier =
            rawRef && rawRef !== "undefined" && rawRef !== "null"
              ? rawRef
              : userId && userId !== "undefined" && userId !== "null" && userId !== "referral_user"
              ? userId
              : "";
          if (refIdentifier) {
            try {
              const res = await fetchReferralById(refIdentifier);
              const referralData = res?.referral || res?.data || res;
              if (referralData && typeof referralData === "object" && (referralData.id || referralData.referral_id || referralData.name)) {
                const phoneVal = referralData.phone || referralData.phone_no || "";
                return {
                  ...referralData,
                  _id: referralData._id || referralData.id || userId,
                  id: referralData.id || userId,
                  referral_id: referralData.referral_id || refIdentifier || "",
                  name:
                    referralData.name ||
                    localStorage.getItem("name") ||
                    "Referral Partner",
                  email:
                    referralData.email ||
                    localStorage.getItem("email") ||
                    "",
                  phone: phoneVal,
                  phone_no: phoneVal,
                  phone_code: referralData.phone_code || "+91",
                  gender: referralData.gender || "",
                  linkedPatientsCount:
                    res?.linkedPatientsCount ?? referralData.linkedPatientsCount ?? 0,
                  role: "REFERRAL",
                  isReferral: true,
                };
              }
            } catch (refErr) {
              console.warn(
                "Failed to fetch referral details, using cached profile:",
                refErr
              );
            }
          }
          const cachedPhone =
            localStorage.getItem("phone") ||
            localStorage.getItem("phone_no") ||
            "";
          return {
            _id: userId,
            id: userId,
            referral_id: localStorage.getItem("referral_id") || userId || "",
            name: localStorage.getItem("name") || "Referral Partner",
            email: localStorage.getItem("email") || "",
            phone: cachedPhone,
            phone_no: cachedPhone,
            gender: "",
            role: "REFERRAL",
            isReferral: true,
          };
        }

        return rejectWithValue({
          message: "Invalid user ObjectId",
        });
      }

      if (!userId || !isMongoObjectId(userId)) {
        return rejectWithValue({ message: "No valid user ID available" });
      }

      const userResult = await fetchAndApplyUserDetails(
        userId,
        localStorage.getItem("token")
      );
      const details = userResult?.details || {};
      return details;
    } catch (err) {
      console.error(
        "Error fetching user data:",
        err.response?.data?.message || err.message
      );
      return rejectWithValue(
        err.response?.data || { message: "An unknown error occurred" }
      );
    }
  }
);
export const EdituserData = createAsyncThunk(
  "getuser/EdituserData",
  async (formData, { rejectWithValue }) => {
    try {
      const isIns =
        isInsuranceUser() ||
        formData?.isInsurance ||
        formData?.role === "INSURANCE";

      if (isIns) {
        const primaryInsId =
          formData?.insurance_id ||
          localStorage.getItem("insurance_id") ||
          formData?.id ||
          formData?._id ||
          localStorage.getItem("_id");

        const updatePayload = {
          name: (formData.name || "").trim(),
          phone: formData.phone || formData.phone_no || "",
          phone_code: formData.phone_code || "+91",
          email: (formData.email || "").trim(),
        };
        if (formData.password) {
          updatePayload.password = formData.password;
        }
        if (formData.status !== undefined) {
          updatePayload.status = Number(formData.status);
        }

        try {
          const res = await updateInsurance(primaryInsId, updatePayload);
          if (res && res.success === false) {
            return rejectWithValue(res);
          }
          return res;
        } catch (firstErr) {
          console.error("Updating insurance error:", firstErr);
          throw firstErr;
        }
      }

      const isRef =
        isReferralUser() ||
        formData?.isReferral ||
        formData?.role === "REFERRAL" ||
        (formData?.id && !isMongoObjectId(formData?.id));

      if (isRef) {
        const primaryRefId =
          formData?.referral_id ||
          localStorage.getItem("referral_id") ||
          formData?.id ||
          formData?._id ||
          localStorage.getItem("_id");

        const updatePayload = {
          name: (formData.name || "").trim(),
          phone: formData.phone || formData.phone_no || "",
          phone_code: formData.phone_code || "+91",
          email: (formData.email || "").trim(),
        };
        if (formData.password) {
          updatePayload.password = formData.password;
        }
        if (formData.status !== undefined) {
          updatePayload.status = Number(formData.status);
        }

        try {
          const res = await updateReferral(primaryRefId, updatePayload);
          if (res && res.success === false) {
            return rejectWithValue(res);
          }
          return res;
        } catch (firstErr) {
          const altId =
            formData?.id && String(formData.id) !== String(primaryRefId)
              ? formData.id
              : formData?.referral_id && String(formData.referral_id) !== String(primaryRefId)
              ? formData.referral_id
              : null;

          if (altId) {
            try {
              const retryRes = await updateReferral(altId, updatePayload);
              if (retryRes && retryRes.success === false) {
                return rejectWithValue(retryRes);
              }
              return retryRes;
            } catch (secondErr) {
              console.error("Retry updating referral failed:", secondErr);
            }
          }
          throw firstErr;
        }
      }

      const response = await axios.put(
        `${baseurl}update_details/${formData.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data; // Success response
    } catch (err) {
      console.error("Error updating user:", err.response?.data?.message || err.message);
      return rejectWithValue(
        err.response?.data || { message: err.message || "An unknown error occurred" }
      );
    }
  }
);

const userSlice = createSlice({
  name: "getuser",
  initialState: {
    getuser: {},
    loading: false,
    error: null,
  },
  reducers: {
    clearUser: (state) => {
      state.getuser = {};
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      //  get the user data
      .addCase(GetUserData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(GetUserData.fulfilled, (state, action) => {
        state.loading = false;
        state.getuser = action.payload;
      })
      .addCase(GetUserData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Edit a tretment user
      .addCase(EdituserData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(EdituserData.fulfilled, (state, action) => {
        state.loading = false;
        const updatedUser = action.payload;

        // // Update the staff list with the edited user
        // state.getuser = state.getuser.map((user) =>
        //     user._id === updatedUser.id ? updatedUser : user
        // );
      })
      .addCase(EdituserData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});
export default userSlice.reducer;
export const { clearUser } = userSlice.actions;
