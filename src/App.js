import "./App.css";
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from "react-router-dom";
import React, { useState } from "react";
import { AdminLogin } from "./pages/authentication/AdminLogin";
import { Forgot } from "./pages/authentication/Forgot";
import Dashboard from "./pages/Dashboard";
import Patient from "./pages/Patient/Patient";
import Appointment from "./pages/Appointments/Appointments";
import History from "./pages/History";
import Reports from "./pages/Reports";
import Earnings from "./pages/Earning";
import PaymentData from "./pages/PaymentData/PaymentData";
import Inquiry from "./pages/Inquiry";
import Treatments from "./pages/Treatments/Treatments";
import Hospitals from "./pages/Hospitals/Hospitals";
import Countries from "./pages/Countries/Countries";
import Staff from "./pages/Staff/Staff";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import AddAppointments from "./pages/Appointments/AddAppointments";
import EditAppointments from "./pages/Appointments/EditAppointments";
import AddPatient from "./pages/Patient/AddPatient";
import EditPatient from "./pages/Patient/EditPatient";
import AddTreatments from "./pages/Treatments/AddTreatments";
import EditTreatments from "./pages/Treatments/EditTreatments";
import AddStaff from "./pages/Staff/AddStaff";
import EditStaff from "./pages/Staff/EditStaff";
import AddCountries from "./pages/Countries/AddCountries";
import EditCountries from "./pages/Countries/EditCountries";
import AddHospitals from "./pages/Hospitals/AddHospitals";
import EditHospitals from "./pages/Hospitals/EditHospitals";
import { Provider } from "react-redux";
import { store } from "./store/store";
import Main from "./components/Admin";
import Protected from "./components/Protected";
import Permission from "../src/pages/Permission/Permission";
import PatientDetail from "./pages/Patient/PatientDetail";
import AddEnquiry from "./pages/Enquiry/AddEnquiry";
import EditEnquiry from "./pages/Enquiry/EditEnquiry";
import AddPatientTreatment from "./pages/Patient/AddPatientTreatment";
import Services from "./pages/Services Section/AllServices";
import AddServices from "../src/pages/Services Section/AddServices";
import ChnagePassword from "./pages/ChnagePassword";
import { AuthOpt } from "./pages/authentication/AuthOpt";
import { ResetPassword } from "./pages/authentication/ResetPassword";
import EnquiryDetail from "./pages/Enquiry/EnquiryDetail";
import Newpermission from "./pages/Permission/Newpermission";
import EditService from "./pages/Services Section/EditService";
import Totaluser from "./pages/Hospitals/Totaluser";
import PAymentpdf from "./pages/Patient/PAymentpdf";
import Pagefilterdata from "./pages/Pagefilterdata";
import ActivityTracker from "./pages/ActivityTracker";
import ActivityUser from "./pages/ActivityUser";
import Currency from "./pages/Currency/Currency";
import Addcurrency from "./pages/Currency/Addcurrency";
import EditCurrency from "./pages/Currency/EditCurrency";
import GerGeneralEnquiry from "./pages/Genera Enquiry/GerGeneralEnquiry";
import EditPatientTreatment from "./pages/Patient/EditPatientTreatment";
import IdleLogout from "./Idlegout";
import SessionSync from "./components/SessionSync";
import Ambulanceserviceview from "./pages/Enquiry/Ambulanceserviceview";
import EnquiryDetailAmbulance from "./pages/Enquiry/EnquiryDetailAmbulance";
import AmbulanceRequestForm from "./pages/Enquiry/AmbulanceRequestForm";
import AirAmbulanceRequestForm from "./pages/Enquiry/AirAmbulanceRequestForm";
import TreatmentEstimateForm from "./pages/Enquiry/TreatmentEstimateForm";
import Airambulanceview from "./pages/Enquiry/Airambulanceview";
import Medicalescortservice from "./pages/Enquiry/Medicalescortservice";
import SosDetail from "./pages/Enquiry/SosDetail";
import GerGeneraalEnquiry from "./pages/Genera Enquiry/GerGeneralEnquiry";
import GeneralEnquiryRequestForm from "./pages/Genera Enquiry/GeneralEnquiryRequestForm";
import ActivityLog from "./pages/ActivityLog/ActivityLog";
import ActivityLogDetail from "./pages/ActivityLog/ActivityLogDetail";
import Roles from "./pages/Roles/Roles";
import Nopermission from "./pages/Nopermission";
import Messages from "./pages/Messages/Messages";
import PatientTravel from "./pages/Patient/PatientTravel";
import GuestHouses from "./pages/GuestHouses/GuestHouses";
import Orders from "./pages/Orders/Orders";
import OrderDetail from "./pages/Orders/OrderDetail";
import CreateOrder from "./pages/Orders/CreateOrder";
import DirectorMessages from "./pages/DirectorMessages/DirectorMessages";
import Referrals from "./pages/Referral/Referrals";
import Insurances from "./pages/Insurance/Insurances";
import Physiotherapy from "./pages/Physiotherapy/Physiotherapy";
import GuestHouseServices from "./pages/GuestHouseServices/GuestHouseServices";
import AppUsers from "./pages/AppUsers/AppUsers";
import GlobalCallNotificationManager from "./components/GlobalCallNotificationManager";

function App() {
  console.log("22/04/25");
  return (
    <>
      <Provider store={store}>
        <Router>
          <IdleLogout timeout={900000} />
          <SessionSync />
          <GlobalCallNotificationManager />
          <Routes>
            <Route path="/" element={<AdminLogin />} />
            <Route path="/referral-login" element={<AdminLogin initialTab="referral" />} />
            <Route path="/referral/login" element={<AdminLogin initialTab="referral" />} />
            <Route path="/insurance-login" element={<AdminLogin initialTab="insurance" />} />
            <Route path="/insurance/login" element={<AdminLogin initialTab="insurance" />} />
            <Route path="/Forgot" element={<Forgot />} />
            <Route path="/opt" element={<AuthOpt />} />
            <Route path="/Reset" element={<ResetPassword />} />
            <Route
              path="/Dashboard"
              element={<Protected Component={Dashboard} />}
            />
            <Route path="/app-users" element={<Navigate to="/Admin/app-users" replace />} />
            <Route path="/App_Users" element={<Navigate to="/Admin/app-users" replace />} />
            <Route path="/Admin" element={<Protected Component={Main} />}>
              <Route index path="/Admin/Permission" element={<Permission />} />
              <Route
                index
                path="/Admin/no-permission"
                element={<Nopermission />}
              />
              <Route
                index
                path="/Admin/New-Permission"
                element={<Newpermission />}
              />
              <Route index path="/Admin/app-users" element={<AppUsers />} />
              <Route index path="/Admin/App_Users" element={<AppUsers />} />
              <Route index path="/Admin/patients" element={<Patient />} />
              <Route index path="/Admin/patient-travel" element={<PatientTravel />} />
              <Route index path="/Admin/physiotherapy" element={<Physiotherapy />} />
              <Route index path="/Admin/messages" element={<Messages />} />
              <Route
                index
                path="/Admin/director-messages"
                element={<DirectorMessages />}
              />
              <Route
                index
                path="/Admin/Director_Messages"
                element={<DirectorMessages />}
              />
              <Route
                index
                path="/Admin/chnage-password"
                element={<ChnagePassword />}
              />
              <Route
                index
                path="/Admin/appointments"
                element={<Appointment />}
              />
              <Route index path="/Admin/history" element={<History />} />
              <Route
                index
                path="/Admin/activity-logs"
                element={<ActivityLog />}
              />
              <Route
                index
                path="/Admin/activity-log-detail"
                element={<ActivityLogDetail />}
              />
              <Route index path="/Admin/Reports" element={<Reports />} />
              <Route index path="/Admin/reports" element={<Reports />} />
              <Route index path="/Admin/earnings" element={<Earnings />} />
              <Route
                index
                path="/Admin/payment-data"
                element={<PaymentData />}
              />
              <Route in path="/Admin/inquiry" element={<Inquiry />} />
              <Route index path="/Admin/Services" element={<Services />} />
              <Route
                index
                path="/Admin/edit-service"
                element={<EditService />}
              />
              <Route
                index
                path="/Admin/add-Services"
                element={<AddServices />}
              />
              <Route index path="/Admin/treatments" element={<Treatments />} />
              <Route index path="/Admin/hospitals" element={<Hospitals />} />
              <Route index path="/Admin/countries" element={<Countries />} />
              <Route
                index
                path="/Admin/guesthouses"
                element={<GuestHouses />}
              />
              <Route
                index
                path="/Admin/guest-houses"
                element={<GuestHouses />}
              />
              <Route
                index
                path="/Admin/guesthouse-services"
                element={<GuestHouseServices />}
              />
              <Route
                index
                path="/Admin/referrals"
                element={<Referrals />}
              />
              <Route
                index
                path="/Admin/referral"
                element={<Referrals />}
              />
              <Route
                index
                path="/Admin/insurances"
                element={<Insurances />}
              />
              <Route
                index
                path="/Admin/insurance"
                element={<Insurances />}
              />
              <Route index path="/Admin/orders" element={<Orders />} />
              <Route
                index
                path="/Admin/orders/create"
                element={<CreateOrder />}
              />
              <Route
                index
                path="/Admin/orders/:orderId"
                element={<OrderDetail />}
              />
              <Route
                index
                path="/Admin/order-detail"
                element={<OrderDetail />}
              />
              <Route
                index
                path="/Admin/orderDetails"
                element={<OrderDetail />}
              />

              <Route index path="/Admin/staff" element={<Staff />} />
              <Route
                index
                path="/Admin/notifications"
                element={<Notifications />}
              />
              <Route index path="/Admin/settings" element={<Settings />} />
              <Route index path="/Admin/profile" element={<Profile />} />
              <Route
                index
                path="/Admin/Activity-user"
                element={<ActivityUser />}
              />
              <Route
                index
                path="/Admin/Activity-tracker"
                element={<ActivityTracker />}
              />
              <Route
                index
                path="/Admin/edit-profile"
                element={<EditProfile />}
              />
              <Route
                index
                path="/Admin/add-appointments"
                element={<AddAppointments />}
              />
              <Route
                path="/Admin/edit-appointments"
                index
                element={<EditAppointments />}
              />
              <Route index path="/Admin/add-patient" element={<AddPatient />} />
              <Route
                index
                path="/Admin/edit-patient"
                element={<EditPatient />}
              />
              <Route
                index
                path="/Admin/add-treatments"
                element={<AddTreatments />}
              />
              <Route
                index
                path="/Admin/edit-treatments"
                element={<EditTreatments />}
              />
              <Route index path="/Admin/add-staff" element={<AddStaff />} />
              <Route index path="/Admin/edit-staff" element={<EditStaff />} />
              <Route
                index
                path="/Admin/add-countries"
                element={<AddCountries />}
              />
              <Route index path="/Admin/currency" element={<Currency />} />
              <Route
                index
                path="/Admin/Addcurrency"
                element={<Addcurrency />}
              />
              <Route
                index
                path="/Admin/edit-Currency"
                element={<EditCurrency />}
              />
              <Route
                index
                path="/Admin/edit-countries"
                element={<EditCountries />}
              />
              <Route
                index
                path="/Admin/add-hospitals"
                element={<AddHospitals />}
              />
              <Route index path="/Admin/totalUser" element={<Totaluser />} />
              <Route
                index
                path="/Admin/edit-hospitals"
                element={<EditHospitals />}
              />
              <Route
                index
                path="/Admin/filterdtata"
                element={<Pagefilterdata />}
              />
              <Route
                index
                path="/Admin/Patient-Detail"
                element={<PatientDetail />}
              />
              <Route
                index
                path="/Admin/Patient-Pdfdetails"
                element={<PAymentpdf />}
              />
              <Route
                index
                path="/Admin/General_Enquiries"
                element={<GerGeneraalEnquiry />}
              />
              <Route
                index
                path="/Admin/add-general-enquiry/:formKey"
                element={<GeneralEnquiryRequestForm />}
              />
              <Route
                index
                path="/Admin/edit-general-enquiry/:formKey"
                element={<GeneralEnquiryRequestForm />}
              />

              <Route index path="/Admin/add-Enquiry" element={<AddEnquiry />} />
              <Route
                index
                path="/Admin/edit-Enquiry"
                element={<EditEnquiry />}
              />
              <Route
                Patient-Detail
                path="/Admin/add-patient-treatment"
                element={<AddPatientTreatment />}
              />
              <Route
                Patient-Detail
                path="/Admin/Edit-patient-treatment"
                element={<EditPatientTreatment />}
              />
              <Route
                index
                path="/Admin/Enquiry-Detail"
                element={<EnquiryDetail />}
              />
              <Route
                index
                path="/Admin/Enquiry-DetailAmbulance"
                element={<EnquiryDetailAmbulance />}
              />
              <Route
                index
                path="/Admin/add-ambulance"
                element={<AmbulanceRequestForm />}
              />
              <Route
                index
                path="/Admin/edit-ambulance"
                element={<AmbulanceRequestForm />}
              />
              <Route
                index
                path="/Admin/add-air-ambulance"
                element={<AirAmbulanceRequestForm />}
              />
              <Route
                index
                path="/Admin/edit-air-ambulance"
                element={<AirAmbulanceRequestForm />}
              />
              <Route
                index
                path="/Admin/add-treatment-estimate"
                element={<TreatmentEstimateForm />}
              />
              <Route
                index
                path="/Admin/edit-treatment-estimate"
                element={<TreatmentEstimateForm />}
              />
              <Route
                index
                path="/Admin/airambulanceview"
                element={<Airambulanceview />}
              />
              <Route index path="/Admin/roles" element={<Roles />} />
              <Route
                index
                path="/Admin/medicalescortservice"
                element={<Medicalescortservice />}
              />
              <Route
                index
                path="/Admin/Ambulance-Detail"
                element={<Ambulanceserviceview />}
              />
              <Route index path="/Admin/SOS-Detail" element={<SosDetail />} />
            </Route>
            <Route
              path="/Director_Messages"
              element={<Navigate to="/Admin/director-messages" replace />}
            />
            <Route
              path="/orderDetails"
              element={<OrderDetailsRedirect />}
            />
          </Routes>
        </Router>
      </Provider>
    </>
  );
}

function OrderDetailsRedirect() {
  const location = useLocation();
  return <Navigate to={`/Admin/orderDetails${location.search}`} replace />;
}

export default App;
