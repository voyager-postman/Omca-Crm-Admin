import React from "react";
import AssignCoordinatorModal from "../../Patient/components/AssignCoordinatorModal";

/**
 * AssignEnquiryStaffModal - Convenient wrapper around AssignCoordinatorModal configured for Enquiries
 */
export default function AssignEnquiryStaffModal({
  open,
  onClose,
  enquiry,
  onSuccess,
}) {
  return (
    <AssignCoordinatorModal
      open={open}
      onClose={onClose}
      enquiry={enquiry}
      entityType="enquiry"
      onSuccess={onSuccess}
    />
  );
}

