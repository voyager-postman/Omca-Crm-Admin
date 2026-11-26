import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { baseurl } from "../Basurl/Baseurl";
import axios from "axios";
// Step 2: Create a login action using createAsyncThunk
//The string 'auth/loginUser' is the action type for the createAsyncThunk. 
export const loginUser = createAsyncThunk('auth/loginUser', async (credentials, { rejectWithValue }) => {
    try {
        const {
          latitude,
          longitude,
          lat,
          lng,
          ip_address,
          ...rest
        } = credentials || {};

        const resolvedLat = latitude ?? lat;
        const resolvedLng = longitude ?? lng;
        const headers = {};

        if (resolvedLat != null && resolvedLat !== "") {
          headers["x-latitude"] = String(resolvedLat);
        }
        if (resolvedLng != null && resolvedLng !== "") {
          headers["x-longitude"] = String(resolvedLng);
        }
        if (ip_address) {
          headers["ipAddress"] = String(ip_address);
        }

        // Only email & password go in the body, geo/ip go in headers only
        const body = { ...rest };

        const response = await axios.post(`${baseurl}login`, body, { headers });
        return response.data; // Success response
    } catch (error) {
        return rejectWithValue(
            error.response?.data || { message: "An unknown error occurred" }
        );
    }

})


// Step 3: Create a slice for login state
const authslice = createSlice({
    name: 'auth',
    initialState: {
        user: null, // Stores logged-in user data
        loading: false, // Shows a loading spinner when logging in
        error: null, // Stores any error messages

    },
    //The builder syntax in Redux Toolkit’s extraReducers is used to handle the additional actions created by createAsyncThunk.
    //builder lets you chain the .addCase() calls. This keeps the code cleaner and helps avoid potential errors when managing multiple createAsyncThunk actions within the same slice.
    // reducers property takes in functions that handle synchronous actions dispatched from the UI while the extraReducers property (we are more concerned about this property)
    reducers: {
        // Logout action to clear user data
        logout: (state) => {
            state.user = null;
            state.error = null;
            state.loading = false;
        }

    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                const payload = action.payload;
                if (Array.isArray(payload?.details) && payload.details.length) {
                    state.error = payload.details.filter(Boolean).join("\n");
                } else {
                    state.error =
                        payload?.message ||
                        payload?.error ||
                        action.error.message;
                }
            })




    }

})
// When we do export default authSlice.reducer;, we are exporting only the reducer function from authSlice, which we need to include in our Redux store.
export default authslice.reducer
export const { logout } = authslice.actions; // Export the logout action
