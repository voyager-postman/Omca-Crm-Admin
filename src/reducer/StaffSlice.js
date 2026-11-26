import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import axios from "axios"
import { baseurl } from "../Basurl/Baseurl"
import { actionsArrayToObject } from "../utils/staffActions"





export const GetAllStaffUser = createAsyncThunk('staff/GetAllStaffUser', async (params = {}) => {
  try {
    const payload = typeof params === "object" ? params : {};
    const page = payload.page || 1;
    const limit = payload.limit || 10;
    const response = await axios.get(`${baseurl}get_all_user_staffs`, {
      params: {
        page,
        limit,
        ...payload,
      },
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching staff users:", error.response?.data || error.message);
    throw error; // Rethrow to propagate the error in createAsyncThunk
  }
});


export const AddAllStaffuser = createAsyncThunk(
  "staff/AddAllStaffuser",
  async (values, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("name", values.name || "");
      formData.append("email", values.email || "");
      formData.append("password", values.password || "");
      formData.append("role", values.role || "");
      formData.append("gender", values.gender || "");
      formData.append("phone_no", values.phone_no || "");
      formData.append("dial_code", values.dial_code || "");
      formData.append("country", values.country || "");
      formData.append(
        "roleStatuses",
        JSON.stringify((values.roleStatuses || []).filter(Boolean)),
      );
      formData.append(
        "accessCountries",
        JSON.stringify(values.accessCountries || []),
      );
      const actionObj = actionsArrayToObject(values.actions);
      formData.append("action", JSON.stringify(actionObj));
      formData.append("canEdit", String(actionObj.edit));
      formData.append("canDelete", String(actionObj.delete));
      formData.append("canExport", String(actionObj.export));
      if (values.profileImage) {
        formData.append("profileImage", values.profileImage);
      }
      const response = await axios.post(`${baseurl}add_staff_user`, formData, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data; // Success response
    } catch (error) {
      console.error("Error adding staff user:", error.response?.data?.message);
      return rejectWithValue(
        error.response?.data || { message: "An unknown error occurred" }
      );
    }
  }
);


export const EditStaffUser = createAsyncThunk(
  "staff/EditStaffUser",
  async (formData, { rejectWithValue }) => {
    console.log(formData)
    try {
      const response = await axios.put(`${baseurl}update_details/${formData.id}`, formData, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",

        },
      });
      return response.data; // Success response
    } catch (err) {
      console.error("Error editing staff user:", err.response?.data?.message);
      return rejectWithValue(
        err.response?.data || { message: "An unknown error occurred" }
      );
    }
  }
);
export const ActiveStaffUser = createAsyncThunk(
  "staff/ActiveStaffUser",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseurl}active_inactive_staff_user/${formData.id}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",

        },
      });
      return response.data; // Success response
    } catch (err) {
      console.error("Error editing staff user:", err.response?.data?.message);
      return rejectWithValue(
        err.response?.data || { message: "An unknown error occurred" }
      );
    }
  }
);

export const DeleteStaff = createAsyncThunk('staff/DeleteStaff',
  async (staffID, { rejectWithValue }) => {
      try {
          const response = await axios.delete(`${baseurl}delete_user_staff/${staffID.id}`,   {
              headers: {
                  "Authorization": `Bearer ${localStorage.getItem("token")}`,
                  "Content-Type": "application/json",
                   
              },
          });
          return staffID; // Success response
      } catch (error) {
          console.error("Error deleting hospital:", error);
    return rejectWithValue(
      error.response?.data || { message: "An unknown error occurred" }
    );
      }
  }
)

const staffUserslice = createSlice({
  name: 'staff',
  initialState: {
    staff: [],
    loading: false,
    error: null
  },
  reducers: {
    addstaff: (state, action) => {
      state.staffUserslice.push(action.payload)
    },
    editstaff: (state, action) => {

    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(GetAllStaffUser.pending, (state) => {
        state.loading = true;
        state.error = null
      })
      .addCase(GetAllStaffUser.fulfilled, (state, action) => {
        state.loading = false;
        const res = action.payload;
        state.staff = res?.Details || res?.details || (Array.isArray(res) ? res : []);
        state.total = res?.total || res?.totalRecords || res?.pagination?.total || state.staff.length;
        state.totalRecords = state.total;
        state.totalPages = res?.totalPages || res?.pagination?.totalPages || Math.ceil(state.total / 10);
        state.currentPage = res?.currentPage || res?.page || 1;
        state.unreadCount = res?.unreadCount || 0;
        state.newCount = res?.newCount || 0;
      })
      .addCase(GetAllStaffUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Edit a staff user
      .addCase(EditStaffUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(EditStaffUser.fulfilled, (state, action) => {
        state.loading = false;
        const updatedUser = action.payload;

        // Update the staff list with the edited user
        state.staff = state.staff.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        );
      })
      .addCase(EditStaffUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      //Active inActive staff
      .addCase(ActiveStaffUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(ActiveStaffUser.fulfilled, (state, action) => {
        state.loading = false;
        const updatedUser = action.payload;

        // Update the staff list with the edited user
        state.staff = state.staff.map((user) =>
          user.state === updatedUser.id ? updatedUser : user
        );
      })
      .addCase(ActiveStaffUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delet a Hospital data
      .addCase(DeleteStaff.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(DeleteStaff.fulfilled, (state, action) => {
        state.loading = false;
        const deletedHospitalId = action.payload;
        // Filter out the deleted hospital
        state.hospital = state.staff.filter(
          (user) => user._id !== deletedHospitalId
        );
      })
      .addCase(DeleteStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
  }
})
export default staffUserslice.reducer
export const { addstaff } = staffUserslice.actions