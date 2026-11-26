import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchPhysiotherapyStats,
  fetchPhysiotherapyPatients,
  fetchPhysiotherapyDetails,
  createPhysiotherapyReferral,
  updatePhysiotherapyStatus,
} from "../services/physiotherapyApi";

export const getPhysiotherapyStats = createAsyncThunk(
  "physiotherapy/getStats",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchPhysiotherapyStats();
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const getPhysiotherapyList = createAsyncThunk(
  "physiotherapy/getList",
  async (params, { rejectWithValue }) => {
    try {
      return await fetchPhysiotherapyPatients(params);
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const getPhysiotherapyCaseDetails = createAsyncThunk(
  "physiotherapy/getDetails",
  async (caseId, { rejectWithValue }) => {
    try {
      return await fetchPhysiotherapyDetails(caseId);
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const addNewPhysiotherapyReferral = createAsyncThunk(
  "physiotherapy/addReferral",
  async (data, { rejectWithValue }) => {
    try {
      return await createPhysiotherapyReferral(data);
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const changePhysiotherapyStatus = createAsyncThunk(
  "physiotherapy/changeStatus",
  async ({ caseId, status, notes }, { rejectWithValue }) => {
    try {
      return await updatePhysiotherapyStatus(caseId, status, notes);
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

const initialState = {
  stats: null,
  cases: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 10,
  },
  activeCase: null,
  loading: false,
  error: null,
};

const PhysiotherapySlice = createSlice({
  name: "physiotherapy",
  initialState,
  reducers: {
    clearActiveCase: (state) => {
      state.activeCase = null;
    },
    clearPhysioError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Stats
    builder
      .addCase(getPhysiotherapyStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      // List
      .addCase(getPhysiotherapyList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPhysiotherapyList.fulfilled, (state, action) => {
        state.loading = false;
        state.cases = action.payload.data || [];
        state.pagination = action.payload.pagination || state.pagination;
      })
      .addCase(getPhysiotherapyList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Details
      .addCase(getPhysiotherapyCaseDetails.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPhysiotherapyCaseDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.activeCase = action.payload;
      })
      .addCase(getPhysiotherapyCaseDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearActiveCase, clearPhysioError } = PhysiotherapySlice.actions;
export default PhysiotherapySlice.reducer;
