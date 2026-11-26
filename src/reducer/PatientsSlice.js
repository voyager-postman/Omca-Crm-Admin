import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import axios from "axios"
import { baseurl } from "../Basurl/Baseurl"
import { isReferralUser, getReferralId, isInsuranceUser, getInsuranceId, isCoordinatorUser, getCurrentCoordinatorUser } from "../utils/authStorage"
import { getStoredInsuranceForPatient } from "../services/insuranceApi";
const emptyPatientList = (page = 1, limit = 10) => ({
  details: [],
  pagination: {
    totalRecords: 0,
    currentPage: page,
    totalPages: 0,
    perPage: limit,
  },
});

const normalizePatientListPayload = (payload, page = 1, limit = 10) => {
  if (!payload) return emptyPatientList(page, limit);

  const rawDetails =
    payload.details ||
    payload.data?.details ||
    payload.patients ||
    payload.data?.patients ||
    (Array.isArray(payload.data) ? payload.data : null) ||
    (Array.isArray(payload) ? payload : []) ||
    [];

  const details = (Array.isArray(rawDetails) ? rawDetails : []).map((patient) => {
    if (!patient || typeof patient !== "object") return patient;
    const pId = patient.patientId || patient.patientNumber || patient._id || patient.id;
    const stored = getStoredInsuranceForPatient(pId);
    if (stored) {
      return {
        ...patient,
        insurance_id: patient.insurance_id || stored.insurance_id,
        insurance_name: patient.insurance_name || stored.insurance_name,
        Insurance_Name: patient.Insurance_Name || stored.Insurance_Name || stored.insurance_name,
      };
    }
    return patient;
  });

  const pagination =
    payload.pagination ||
    payload.data?.pagination || {
      totalRecords: Array.isArray(details) ? details.length : 0,
      currentPage: page,
      totalPages: Math.max(
        1,
        Math.ceil((Array.isArray(details) ? details.length : 0) / limit) || 0,
      ),
      perPage: limit,
    };

  return { details: Array.isArray(details) ? details : [], pagination };
};

export const GetAllPatients = createAsyncThunk(
  "patient/GetAllPatients",
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();

      queryParams.append("page", params.page || 1);
      queryParams.append("search", params.search || "");
      queryParams.append("limit", params.limit || 10);

      if (params.p_status) queryParams.append("p_status", params.p_status);
      if (params.patient_type_new) queryParams.append("patient_type_new", params.patient_type_new);
      if (params.country) queryParams.append("country", params.country);
      if (params.treatingIn) queryParams.append("treatingIn", params.treatingIn);
      if (params.patient) queryParams.append("patient", params.patient);
      if (params.treatment) {
        queryParams.append("treatment", params.treatment);
        queryParams.append("treatment_course_name", params.treatment);
      }
      if (params.sortField) queryParams.append("sortField", params.sortField);
      if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);
      const dateFrom = params.startDate || params.dateFrom || params.date_from || params.fromDate;
      const dateTo = params.endDate || params.dateTo || params.date_to || params.toDate;
      if (dateFrom) {
        queryParams.append("startDate", dateFrom);
        queryParams.append("dateFrom", dateFrom);
        queryParams.append("date_from", dateFrom);
        queryParams.append("fromDate", dateFrom);
      }
      if (dateTo) {
        queryParams.append("endDate", dateTo);
        queryParams.append("dateTo", dateTo);
        queryParams.append("date_to", dateTo);
        queryParams.append("toDate", dateTo);
      }
      if (params.onlyAssigned) queryParams.append("onlyAssigned", "true");
      if (params.role || params.assignedRole) queryParams.append("role", params.role || params.assignedRole);
      if (isReferralUser()) {
        const refId = params.referral_id || getReferralId();
        if (refId) queryParams.append("referral_id", refId);
      }
      if (isInsuranceUser()) {
        const insId = params.insurance_id || getInsuranceId();
        if (insId) queryParams.append("insurance_id", insId);
      }
      if (isCoordinatorUser()) {
        const currentCoord = getCurrentCoordinatorUser();
        const coordId = params.coordinatorId || params.coordinator_id || currentCoord.id;
        if (coordId) {
          queryParams.append("coordinatorId", coordId);
          queryParams.append("coordinator_id", coordId);
        }
        if (currentCoord.name) {
          queryParams.append("coordinatorName", currentCoord.name);
        }
      }

      const response = await axios.get(
        `${baseurl}all_patients?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      return normalizePatientListPayload(response.data, params.page || 1, params.limit || 10);
    } catch (error) {
      // ✅ HANDLE 404 HERE
      if (error.response?.status === 404) {
        return emptyPatientList(params.page || 1, params.limit || 10);
      }

      return rejectWithValue(
        error.response?.data || { message: "Failed to fetch patients" }
      );
    }
  }
);

/** GET /api/get_treatment_completed_patients — CRM or Hospital (with hospital_id) */
export const GetTreatmentCompletedPatients = createAsyncThunk(
  "patient/GetTreatmentCompletedPatients",
  async (params = {}, { rejectWithValue }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    try {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page);
      queryParams.append("limit", limit);
      if (params.search) queryParams.append("search", params.search);
      if (params.patient) queryParams.append("patient", params.patient);
      if (params.country) queryParams.append("country", params.country);
      if (params.treatingIn) queryParams.append("treatingIn", params.treatingIn);
      if (params.patient_type_new) queryParams.append("patient_type_new", params.patient_type_new);
      if (params.treatment) {
        queryParams.append("treatment", params.treatment);
        queryParams.append("treatment_course_name", params.treatment);
      }
      if (params.p_status) queryParams.append("p_status", params.p_status);
      if (params.hospital_id != null && params.hospital_id !== "") {
        queryParams.append("hospital_id", params.hospital_id);
      }
      if (params.sortField) queryParams.append("sortField", params.sortField);
      if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);
      if (isReferralUser()) {
        const referralId = params.referral_id || getReferralId();
        if (referralId) queryParams.append("referral_id", referralId);
      }
      if (isInsuranceUser()) {
        const insuranceId = params.insurance_id || getInsuranceId();
        if (insuranceId) queryParams.append("insurance_id", insuranceId);
      }
      if (isCoordinatorUser()) {
        const currentCoord = getCurrentCoordinatorUser();
        const coordId = params.coordinatorId || params.coordinator_id || currentCoord.id;
        if (coordId) {
          queryParams.append("coordinatorId", coordId);
          queryParams.append("coordinator_id", coordId);
        }
        if (currentCoord.name) {
          queryParams.append("coordinatorName", currentCoord.name);
        }
      }

      const response = await axios.get(
        `${baseurl}get_treatment_completed_patients?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      return normalizePatientListPayload(response.data, page, limit);
    } catch (error) {
      if (error.response?.status === 404) {
        return emptyPatientList(page, limit);
      }
      return rejectWithValue(
        error.response?.data || {
          message: "Failed to fetch treatment completed patients",
        }
      );
    }
  }
);



// export const GetAllPatients = createAsyncThunk('patient/GetAllPatients', async () => {
//   try {
//     const response = await axios.get(`${baseurl}all_patients`, {
//       headers: {
//         "Authorization": `Bearer ${localStorage.getItem("token")}`,
//         "Content-Type": "application/json",
//       },
//     });
//     return response.data.details;
//   } catch (error) {
//     console.error("Error fetching patient:", error.response?.data || error.message);
//     throw error; // Rethrow to propagate the error in createAsyncThunk
//   }
// });
export const AddAllPatients = createAsyncThunk(
  "patient/AddAllPatients",
  async (formData, { rejectWithValue }) => {
    try {
      let response;
      try {
        response = await axios.post(
          `${baseurl}user/add_patient`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } catch (err1) {
        if (err1.response?.status === 404) {
          response = await axios.post(
            `${baseurl}register_patient/${localStorage.getItem("_id")}`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "multipart/form-data",
              },
            }
          );
        } else {
          throw err1;
        }
      }
      return response.data; // Success response
    } catch (error) {
      console.error("Error adding patient user:", error.response?.data?.message);
      return rejectWithValue(
        error.response?.data || { message: "An unknown error occurred" }
      );
    }
  }
);

export const EditPatientType = createAsyncThunk(
  "patient/EditPatient",
  async (payload, { rejectWithValue }) => {
    try {
      if (!payload) {
        throw new Error("Payload is undefined");
      }

      const { id, data } = payload;

      if (!id) {
        throw new Error("Patient ID is missing");
      }

      let response;
      try {
        response = await axios.put(
          `${baseurl}user/update_patient/${id}`,
          data,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } catch (err1) {
        if (err1.response?.status === 404) {
          response = await axios.put(
            `${baseurl}update_patient/${id}`,
            data,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "multipart/form-data",
              },
            }
          );
        } else {
          throw err1;
        }
      }

      return response.data;
    } catch (err) {
      console.error("Edit error:", err);
      return rejectWithValue(
        err.response?.data || { message: err.message }
      );
    }
  }
);

export const DeletePatient = createAsyncThunk('patient/DeletePatient',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${baseurl}deletePatient/${patientId.id}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",

        },
      });
      return patientId; // Success response
    } catch (error) {
      console.error("Error deleting hospital:", error);
      return rejectWithValue(
        error.response?.data || { message: "An unknown error occurred" }
      );
    }
  }
)

export const PainDService = createAsyncThunk(
  "patient/PainDService",
  async (servipostdata, { rejectWithValue }) => {
    console.log(servipostdata, "Service Data")
    try {
      const response = await axios.post(`${baseurl}paid_service}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
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
  })

export const StatusPatient = createAsyncThunk(
  "patient/StatusPatient",
  async (object, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Authorization token is missing");
      }

      const response = await axios.post(
        `${baseurl}update_patient_status/${object.id}`,
        { status: object.status }, // Ensure you're passing the correct payload
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data; // Success response
    } catch (err) {
      console.error("Error editing patient status:", err.response?.data?.message);
      return rejectWithValue(
        err.response?.data || { message: "An unknown error occurred" }
      );
    }
  }
);

const patientSlice = createSlice({
  name: 'patient',
  initialState: {
  patient: [],
  pagination: {
    totalRecords: 0,
    currentPage: 1,
    totalPages: 0,
    perPage: 10,
  },
  loading: false,
  error: null,
},
  reducers: {
    addPatient: (state, action) => {
      state.staffUserslice.push(action.payload);
    },
    updatePatientMainTreatment: (state, action) => {
      const payload = action.payload;
      if (!payload) return;
      const targetPatientId = payload.patientId;
      const targetTreatmentId = payload.treatment_id || payload.treatmentId;
      const nextCurrentName = payload.current_treatment_name || payload.treatment_name;
      const nextOngoing = payload.ongoing_treatments;

      if (Array.isArray(state.patient)) {
        state.patient = state.patient.map((p) => {
          const isTarget =
            Boolean(targetPatientId) &&
            (p.patientId === targetPatientId ||
              p.patientNumber === targetPatientId ||
              p._id === targetPatientId ||
              p.id === targetPatientId);

          if (!isTarget) return p;

          const updatedOngoing = nextOngoing
            ? nextOngoing
            : Array.isArray(p.ongoing_treatments)
              ? p.ongoing_treatments.map((ot) => ({
                  ...ot,
                  is_main: String(ot.treatment_id || ot.treatmentId) === String(targetTreatmentId),
                }))
              : p.ongoing_treatments;

          return {
            ...p,
            current_treatment_name: nextCurrentName || p.current_treatment_name,
            main_treatment_selected: true,
            ongoing_treatments: updatedOngoing,
          };
        });
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(GetAllPatients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
     .addCase(GetAllPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.patient = action.payload.details;
        state.pagination = action.payload.pagination;
      })
      .addCase(GetAllPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(GetTreatmentCompletedPatients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(GetTreatmentCompletedPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.patient = action.payload.details;
        state.pagination = action.payload.pagination;
      })
      .addCase(GetTreatmentCompletedPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })


      // Edit a patient user
      .addCase(EditPatientType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(EditPatientType.fulfilled, (state, action) => {
        state.loading = false;
        const updatedUser = action.payload;

        // Update the staff list with the edited user
        state.patient = state.patient.map((user) =>
          user.patientId === updatedUser.id ? updatedUser : user
        );
      })
      .addCase(EditPatientType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delet a Patient data
      .addCase(DeletePatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(DeletePatient.fulfilled, (state, action) => {
        state.loading = false;
        const deletedHospitalId = action.payload;
        // Filter out the deleted hospital
        state.patient = state.patient.filter(
          (user) => user.patientId !== deletedHospitalId
        );
      })
      .addCase(DeletePatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      //Status Patient
      .addCase(StatusPatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(StatusPatient.fulfilled, (state, action) => {
        state.loading = false;
        const updatedUser = action.payload;

        // Update the staff list with the edited user
        state.patient = state.patient.map((user) =>
          user.patientId === updatedUser.id ? updatedUser : user
        );
      })
      .addCase(StatusPatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

  }
})
export default patientSlice.reducer;
export const { addPatient, updatePatientMainTreatment } = patientSlice.actions;
