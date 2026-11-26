import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
  fetchMedicineList,
  uploadPrescriptionApi,
  saveWrittenMedicineApi,
  fetchCartList,
  fetchMedicineCartList,
  deleteCartPrescription,
  deleteCartWrittenMedicine,
  deleteCartItem,
  toggleCartValueApi,
  changeMedicineQuantity,
  fetchUserAddresses,
  placeOrderApi,
  addNewOrder,
  searchOrderPatients,
  getMedicineDefaultImage,
} from "../../services/ordersApi";
import PatientSearchSelect from "../../components/PatientSearchSelect";
import "./CreateOrder.css";

const FALLBACK_MEDICINE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%23f1f5f9' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";

export const FIXED_ADDRESSES = [
  {
    key: "OMCA_GH_51",
    label: "OMCA Guest House 51",
    isGuestHouse: true,
    defaultCity: "Dwarka",
    defaultState: "Delhi",
    defaultCountry: "India",
    defaultPincode: "110075",
    defaultStreet: "OMCA Guest House 51, Dwarka",
  },
  {
    key: "OMCA_GH_52",
    label: "OMCA Guest House 52",
    isGuestHouse: true,
    defaultCity: "Dwarka",
    defaultState: "Delhi",
    defaultCountry: "India",
    defaultPincode: "110075",
    defaultStreet: "OMCA Guest House 52, Dwarka",
  },
  {
    key: "OMCA_GH_DWARKA",
    label: "OMCA Guest House Dwarka",
    isGuestHouse: true,
    defaultCity: "Dwarka",
    defaultState: "Delhi",
    defaultCountry: "India",
    defaultPincode: "110075",
    defaultStreet: "OMCA Guest House Dwarka, Sector 12",
  },
  {
    key: "OMCA_OFFICE",
    label: "OMCA Office Mauritius",
    isGuestHouse: false,
    defaultCity: "Curepipe",
    defaultState: "Plaines Wilhems",
    defaultCountry: "Mauritius",
    defaultPincode: "74204",
    defaultStreet: "OMCA Office Mauritius, Route Royale",
  },
];

export default function CreateOrder() {
  const navigate = useNavigate();

  // Active CRM Tab: 'cart' | 'catalog' | 'upload'
  const [activeTab, setActiveTab] = useState("cart");

  // Cart sub-view: 'keyed_in' | 'prescribed' | 'written'
  const [cartViewType, setCartViewType] = useState("prescribed");

  const [selectedPatientObj, setSelectedPatientObj] = useState(null);
  const selectedPatient = useMemo(
    () =>
      selectedPatientObj
        ? {
            phone: "",
            email: "",
            defaultAddress: "Mauritius",
            ...selectedPatientObj,
          }
        : null,
    [selectedPatientObj]
  );
  const selectedPatientId = selectedPatient ? String(selectedPatient.id || "") : "";

  // Always use the patient's numeric pharmacy user_id (e.g. "2109") for backend APIs, never patientId ("OMCA26070666")
  const effectiveUserId = useMemo(() => {
    return String(selectedPatient?.userId || selectedPatient?.user_id || selectedPatientId || "").trim();
  }, [selectedPatient, selectedPatientId]);

  // Address states
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressKey, setSelectedAddressKey] = useState("OMCA_GH_51");
  const [roomNumber, setRoomNumber] = useState("");
  const [otherAddressText, setOtherAddressText] = useState("");

  // Modal state for Add New Delivery Address
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [modalAddressType, setModalAddressType] = useState("OMCA_GH_51");
  const [modalRoomNumber, setModalRoomNumber] = useState("");
  const [modalOtherAddress, setModalOtherAddress] = useState("");

  // KeyedIn medicines (loaded from backend cartlist API)
  const [keyedInMedicines, setKeyedInMedicines] = useState([]);
  const [loadingMedicineCart, setLoadingMedicineCart] = useState(false);

  // Prescribed items (loaded from backend cart_list API)
  const [prescribedItems, setPrescribedItems] = useState([]);
  const [loadingCart, setLoadingCart] = useState(false);

  // Written medicines state (Option to write medicine name instead of uploading photo)
  const [writtenMedicines, setWrittenMedicines] = useState([]);
  const [isSubmittingWritten, setIsSubmittingWritten] = useState(false);
  const createInitialWrittenCard = (id = 1) => ({
    id,
    name: "",
    quantity: "",
    days: "",
  });
  const [writtenCards, setWrittenCards] = useState([createInitialWrittenCard(1)]);

  // Upload screen state (upload_prescription API)
  // uploadType: 0 = Prescription, 1 = Medicine Photo, 2 = Write Medicine Name
  const [uploadType, setUploadType] = useState(0);

  const createInitialCard = (isPrescription = true, id = 1) => ({
    id,
    frontFile: null,
    frontFileName: "",
    frontPreview: "",
    backFile: null,
    backFileName: "",
    backPreview: "",
    asPerPrescription: isPrescription,
    days: "",
  });

  const [prescriptionCards, setPrescriptionCards] = useState([
    createInitialCard(true, 1),
  ]);
  const [medicineCards, setMedicineCards] = useState([
    createInitialCard(false, 1),
  ]);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);

  // Medicine catalog state (get_medicine_list API)
  const [catalogMedicines, setCatalogMedicines] = useState([]);
  const [medicineSearchTerm, setMedicineSearchTerm] = useState("");
  const [loadingMedicines, setLoadingMedicines] = useState(false);

  // Order submission state
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Load addresses, medicine cart (cartlist), prescribed cart (cart_list), and medicines whenever selected patient changes
  useEffect(() => {
    if (effectiveUserId) {
      loadUserAddresses(effectiveUserId);
      loadMedicineCart(effectiveUserId);
      loadCart(effectiveUserId);
    } else {
      setAddresses([]);
      setSelectedAddressKey("OMCA_OFFICE");
      setRoomNumber("");
      setOtherAddressText("");
      setKeyedInMedicines([]);
      setPrescribedItems([]);
      setWrittenMedicines([]);
    }
    loadMedicines(effectiveUserId || "675");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Load user addresses
  const loadUserAddresses = async (userId) => {
    if (!userId) {
      setAddresses([]);
      setSelectedAddressKey("OMCA_GH_51");
      return;
    }
    try {
      const res = await fetchUserAddresses(userId);
      if (res?.data && res.data.length > 0) {
        setAddresses(res.data);
      } else {
        setAddresses([]);
      }
    } catch (e) {
      console.warn("Addresses fetch error:", e);
      setAddresses([]);
    }
  };

  // Load medicine cart items from `cartlist` API
  const loadMedicineCart = async (userId) => {
    if (!userId) {
      setKeyedInMedicines([]);
      return;
    }
    setLoadingMedicineCart(true);
    try {
      const res = await fetchMedicineCartList(userId);
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map((item) => {
          const medId = Number(item.medicine_id || item.id);
          const cartId = item.id;
          const unitPrice = parseFloat(item.converted_price || item.price || 40.44);
          const qty = Number(item.quantity) || 1;
          const totalPrice = parseFloat(item.converted_total || item.total || unitPrice * qty);
          return {
            id: medId,
            cart_id: cartId,
            medicine_id: medId,
            name: item.name,
            manufacture: item.manufacture || "",
            quantity: item.medicine_quantity || "15 tablets in a strip",
            cartQuantity: qty,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
            currency_symbol: item.currency_symbol || "₹",
            image:
              item.image ||
              "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg",
            raw: item,
          };
        });
        setKeyedInMedicines(mapped);
      } else {
        setKeyedInMedicines([]);
      }
    } catch (e) {
      console.warn("Medicine cart (cartlist) load error:", e);
      setKeyedInMedicines([]);
    } finally {
      setLoadingMedicineCart(false);
    }
  };

  // Load prescribed items and written medicines from `cart_list` API
  const loadCart = async (userId) => {
    if (!userId) {
      setPrescribedItems([]);
      setWrittenMedicines([]);
      return;
    }
    setLoadingCart(true);
    try {
      const res = await fetchCartList(userId);
      if (res?.data && Array.isArray(res.data)) {
        const photos = [];
        const written = [];

        res.data.forEach((item) => {
          const typeNum = Number(item.type);
          // Backend returns type: 2 for written medicines
          const isWritten =
            typeNum === 2 ||
            item.isWritten ||
            (item.name && !item.front_image && !item.back_image && !item.frontImage && !item.backImage);

          if (isWritten) {
            written.push({
              id: item.id,
              user_id: item.user_id,
              name: item.name || item.medicine_name || "Medicine",
              quantity: String(item.quantity || "1"),
              days: item.days !== undefined && item.days !== null ? String(item.days) : "",
              type: 2,
              status: item.status !== undefined ? item.status : 1,
              raw: item,
            });
          } else {
            photos.push(item);
          }
        });

        setPrescribedItems(photos);
        setWrittenMedicines(written);
      } else {
        setPrescribedItems([]);
        setWrittenMedicines([]);
      }
    } catch (e) {
      console.warn("Prescription cart (cart_list) load error:", e);
      setPrescribedItems([]);
      setWrittenMedicines([]);
    } finally {
      setLoadingCart(false);
    }
  };

  // Load medicine catalog
  const loadMedicines = async (userId) => {
    setLoadingMedicines(true);
    try {
      const res = await fetchMedicineList(userId);
      if (res?.data && res.data.length > 0) {
        setCatalogMedicines(res.data);
      } else {
        // High fidelity catalog data matching backend
        setCatalogMedicines([
          {
            id: 1,
            name: "Dolo",
            quantity: "15 tablets in a strip",
            price: "20",
            converted_amount: "40.44",
            currency_symbol: "₹",
            image: "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg",
          },
          {
            id: 2,
            name: "Paracetamal",
            quantity: "15 tablets in a strip",
            price: "15",
            converted_amount: "30.33",
            currency_symbol: "₹",
            image: "https://omcacrm.com/omca/public/images/medicineImages/download (2).jpeg",
          },
          {
            id: 4,
            name: "Crocin",
            quantity: "15 tablets in a strip",
            price: "20",
            converted_amount: "40.44",
            currency_symbol: "₹",
            image: "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg",
          },
          {
            id: 5,
            name: "Becosules",
            quantity: "20 tablets in a strip",
            price: "150",
            converted_amount: "303.32",
            currency_symbol: "₹",
            image: "https://omcacrm.com/omca/public/images/medicineImages/01717501972.jpg",
          },
          {
            id: 6,
            name: "Corex",
            quantity: "1 tablets in a strip",
            price: "120",
            converted_amount: "242.65",
            currency_symbol: "₹",
            image: "https://omcacrm.com/omca/public/images/medicineImages/01717503565.jpg",
          },
          {
            id: 15,
            name: "Aspirin",
            quantity: "10 tablets in a strip",
            price: "42",
            converted_amount: "84.93",
            currency_symbol: "₹",
            image: "https://omcacrm.com/omca/public/images/medicineImages/01779704221.jpg",
          },
        ]);
      }
    } catch (e) {
      console.warn("Medicines load error:", e);
    } finally {
      setLoadingMedicines(false);
    }
  };

  // =========================================================================
  // MEDICINES CATALOG HANDLERS
  // =========================================================================

  const handleToggleAddMedicine = async (med) => {
    if (!effectiveUserId) {
      Swal.fire({
        title: "Patient Required",
        text: "Please select a patient / customer first before adding medicines to cart.",
        icon: "warning",
        confirmButtonColor: "#0ba6df",
      });
      return;
    }

    const exists = keyedInMedicines.some(
      (item) => Number(item.id) === Number(med.id) || Number(item.medicine_id) === Number(med.id)
    );

    // Calls cartValue with user_id and medicine_id to toggle add/remove in backend cart
    const res = await toggleCartValueApi(effectiveUserId, med.id);
    // Reload medicine cart list from `cartlist` API
    await loadMedicineCart(effectiveUserId);

    if (exists) {
      Swal.fire({
        title: "Removed",
        text: res?.message || `${med.name} removed from cart.`,
        icon: "info",
        timer: 1200,
        showConfirmButton: false,
      });
    } else {
      Swal.fire({
        title: "Added to Cart!",
        text: res?.message || `${med.name} added to cart.`,
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    }
  };

  const filteredMedicines = useMemo(() => {
    if (!medicineSearchTerm.trim()) return catalogMedicines;
    const q = medicineSearchTerm.toLowerCase().trim();
    return catalogMedicines.filter(
      (m) =>
        String(m.name || "").toLowerCase().includes(q) ||
        String(m.quantity || "").toLowerCase().includes(q) ||
        String(m.category || "").toLowerCase().includes(q)
    );
  }, [catalogMedicines, medicineSearchTerm]);

  // =========================================================================
  // CART STEPPER, DELETE & EMPTY CART HANDLERS
  // =========================================================================

  const handleUpdateKeyedInQty = async (medId, delta) => {
    const item = keyedInMedicines.find(
      (m) => Number(m.id) === Number(medId) || Number(m.medicine_id) === Number(medId)
    );
    if (!item) return;
    const nextQty = Math.max(1, (item.cartQuantity || 1) + delta);
    // Optimistic UI update
    setKeyedInMedicines((prev) =>
      prev.map((it) =>
        Number(it.id) === Number(medId) || Number(it.medicine_id) === Number(medId)
          ? { ...it, cartQuantity: nextQty }
          : it
      )
    );
    if (effectiveUserId) {
      await changeMedicineQuantity(effectiveUserId, item.medicine_id || medId, nextQty);
      await loadMedicineCart(effectiveUserId);
    }
  };

  const handleDeleteKeyedInItem = async (medId) => {
    const itemToDelete = keyedInMedicines.find(
      (item) => Number(item.id) === Number(medId) || Number(item.medicine_id) === Number(medId)
    );
    if (effectiveUserId) {
      // Calls cartValue with user_id and medicine_id on item delete as requested
      const res = await toggleCartValueApi(effectiveUserId, itemToDelete?.medicine_id || medId);
      await loadMedicineCart(effectiveUserId);
      Swal.fire({
        title: "Removed",
        text: res?.message || (itemToDelete ? `${itemToDelete.name} removed from cart.` : "Item removed from cart."),
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } else {
      setKeyedInMedicines((prev) =>
        prev.filter((item) => Number(item.id) !== Number(medId) && Number(item.medicine_id) !== Number(medId))
      );
      Swal.fire({
        title: "Removed",
        text: itemToDelete ? `${itemToDelete.name} removed from cart.` : "Item removed from cart.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    }
  };

  const handleEmptyCart = async () => {
    if (
      keyedInMedicines.length === 0 &&
      prescribedItems.length === 0 &&
      writtenMedicines.length === 0
    ) {
      Swal.fire("Cart is Empty", "There are no items in the cart to remove.", "info");
      return;
    }

    const confirmed = await Swal.fire({
      title: "Empty Cart?",
      text: "Are you sure you want to empty the entire cart? All items will be removed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Empty Cart",
      cancelButtonText: "Cancel",
    });

    if (confirmed.isConfirmed) {
      if (effectiveUserId) {
        // Calls cart_item_delete API with user_id to empty cart in backend
        await deleteCartItem(effectiveUserId);
        await Promise.all([
          loadMedicineCart(effectiveUserId),
          loadCart(effectiveUserId),
        ]);
      } else {
        setKeyedInMedicines([]);
        setPrescribedItems([]);
      }
      setWrittenMedicines([]);

      Swal.fire({
        title: "Cart Emptied",
        text: "All items have been removed from the cart.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  const handleDeletePrescriptionItem = async (cartItemId) => {
    const confirmed = await Swal.fire({
      title: "Remove Item?",
      text: "Remove this prescribed item from the order?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, remove",
    });

    if (confirmed.isConfirmed) {
      if (effectiveUserId) {
        await deleteCartPrescription(effectiveUserId, cartItemId);
        await loadCart(effectiveUserId);
      } else {
        setPrescribedItems((prev) => prev.filter((item) => item.id !== cartItemId));
      }
      Swal.fire({
        title: "Removed",
        text: "Item removed from cart.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  // Cart totals calculation including written medicines
  const totals = useMemo(() => {
    const totalMedicinesQty = keyedInMedicines.reduce(
      (sum, item) => sum + (item.cartQuantity || 1),
      0
    );
    const totalWrittenQty = writtenMedicines.reduce(
      (sum, item) => sum + (parseInt(item.quantity) || 1),
      0
    );
    const totalItems = totalMedicinesQty + prescribedItems.length + writtenMedicines.length;

    return {
      keyedInMedicinesCount: keyedInMedicines.length,
      totalMedicinesQty,
      prescribedCount: prescribedItems.length,
      writtenMedicinesCount: writtenMedicines.length,
      totalWrittenQty,
      totalItems,
      totalAmount: "0.00",
    };
  }, [keyedInMedicines, prescribedItems, writtenMedicines]);

  // Delivery Destination Computed Label
  const deliveryDestinationText = useMemo(() => {
    if (["OMCA_GH_51", "OMCA_GH_52", "OMCA_GH_DWARKA"].includes(selectedAddressKey)) {
      const gh = FIXED_ADDRESSES.find((f) => f.key === selectedAddressKey);
      const room = roomNumber.trim();
      return `${gh?.label}${room ? ` (Room ${room})` : ""}, ${gh?.defaultCity}, ${gh?.defaultCountry}`;
    }
    if (selectedAddressKey === "OTHER") {
      return otherAddressText.trim() || "other (custom delivery address)";
    }
    if (selectedAddressKey === "OMCA_OFFICE") {
      return "OMCA Office Mauritius, Route Royale, Curepipe, Mauritius";
    }
    if (String(selectedAddressKey).startsWith("SAVED_")) {
      const id = selectedAddressKey.replace("SAVED_", "");
      const found = addresses.find((a) => String(a.id) === String(id));
      if (found) {
        const house = found.house || found.house_name ? `${found.house || found.house_name}, ` : "";
        return `${house}${found.street}, ${found.city}, ${found.country || found.counrty || "Mauritius"}`;
      }
    }
    return selectedPatient?.defaultAddress || "No delivery address selected";
  }, [selectedAddressKey, roomNumber, otherAddressText, addresses, selectedPatient]);

  // Delivery Address Handlers
  const handleOpenAddAddressModal = () => {
    setModalAddressType(
      ["OMCA_GH_51", "OMCA_GH_52", "OMCA_GH_DWARKA", "OMCA_OFFICE", "OTHER"].includes(selectedAddressKey)
        ? selectedAddressKey
        : "OMCA_GH_51"
    );
    setModalRoomNumber(roomNumber);
    setModalOtherAddress(otherAddressText);
    setShowAddAddressModal(true);
  };

  const handleSaveModalAddress = () => {
    if (
      ["OMCA_GH_51", "OMCA_GH_52", "OMCA_GH_DWARKA"].includes(modalAddressType) &&
      !modalRoomNumber.trim()
    ) {
      Swal.fire({
        title: "Room Number Required",
        text: "Please enter the room number for the selected Guest House.",
        icon: "warning",
      });
      return;
    }

    if (modalAddressType === "OTHER" && !modalOtherAddress.trim()) {
      Swal.fire({
        title: "Address Required",
        text: "Please enter the delivery address details.",
        icon: "warning",
      });
      return;
    }

    setSelectedAddressKey(modalAddressType);
    if (["OMCA_GH_51", "OMCA_GH_52", "OMCA_GH_DWARKA"].includes(modalAddressType)) {
      setRoomNumber(modalRoomNumber.trim());
    }
    if (modalAddressType === "OTHER") {
      setOtherAddressText(modalOtherAddress.trim());
    }

    setShowAddAddressModal(false);
    Swal.fire({
      title: "Address Selected!",
      text: "Delivery destination has been updated for this order.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // Written Medicines Handlers
  const handleWrittenCardChange = (cardId, field, value) => {
    setWrittenCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, [field]: value } : c))
    );
  };

  const handleAddAnotherWrittenCard = () => {
    setWrittenCards((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((c) => c.id)) + 1 : 1;
      return [...prev, createInitialWrittenCard(nextId)];
    });
  };

  const handleDeleteWrittenCard = (cardId) => {
    if (writtenCards.length <= 1) {
      Swal.fire("Notice", "At least one medicine entry row is required.", "info");
      return;
    }
    setWrittenCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  // Save written medicines to backend using Dedicated Endpoint (Option A) with fallback to Option B
  const handleSaveWrittenMedicines = async () => {
    if (!effectiveUserId) {
      Swal.fire({
        icon: "warning",
        title: "Patient Required",
        text: "Please select a Patient / Customer first before adding medicines.",
        confirmButtonColor: "#0ba6df",
      });
      return;
    }

    const validCards = writtenCards.filter((c) => c.name && c.name.trim());
    if (validCards.length === 0) {
      Swal.fire(
        "Medicine Name Required",
        "Please enter medicine name and quantity for at least one item.",
        "warning"
      );
      return;
    }

    setIsSubmittingWritten(true);
    try {
      const medicinesPayload = validCards.map((c) => ({
        name: c.name.trim(),
        quantity: c.quantity ? c.quantity.trim() : "1",
        days: c.days ? String(c.days).trim() : "",
      }));

      // Call Option A (POST /api/save_written_medicine, with alias & Option B fallback)
      const res = await saveWrittenMedicineApi({
        user_id: effectiveUserId,
        medicines: medicinesPayload,
      });

      if (res.success) {
        Swal.fire({
          title: "Medicines Added!",
          text: res.message || `${medicinesPayload.length} written medicine(s) added to order successfully!`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });

        // Reset the input card
        setWrittenCards([createInitialWrittenCard(1)]);

        // Reload the cart from backend so written medicines from cart_list populate with their DB IDs
        await loadCart(effectiveUserId);

        // Switch view to Cart tab and Written subview
        setCartViewType("written");
        setActiveTab("cart");
      } else {
        Swal.fire("Notice", res.message || "Failed to add written medicines.", "error");
      }
    } catch (err) {
      console.error("handleSaveWrittenMedicines error:", err);
      Swal.fire("Error", err.message || "Failed to add written medicines.", "error");
    } finally {
      setIsSubmittingWritten(false);
    }
  };

  // Remove written medicine item from cart (POST /api/cart_delete)
  const handleDeleteWrittenMedicine = async (id) => {
    const itemToDelete = writtenMedicines.find((item) => String(item.id) === String(id));
    const confirmed = await Swal.fire({
      title: "Remove Medicine?",
      text: itemToDelete ? `Remove "${itemToDelete.name}" from cart?` : "Remove this medicine from cart?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, remove",
    });

    if (confirmed.isConfirmed) {
      if (effectiveUserId) {
        // Calls cart_delete API with user_id and cart_id
        await deleteCartWrittenMedicine(effectiveUserId, id);
        await loadCart(effectiveUserId);
      } else {
        setWrittenMedicines((prev) => prev.filter((item) => String(item.id) !== String(id)));
      }
      Swal.fire({
        title: "Removed",
        text: "Medicine removed from cart.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    }
  };

  const handleUpdateWrittenQty = (id, delta) => {
    setWrittenMedicines((prev) =>
      prev.map((item) => {
        if (String(item.id) === String(id)) {
          const currentQty = parseInt(item.quantity) || 1;
          const nextQty = Math.max(1, currentQty + delta);
          return { ...item, quantity: String(nextQty) };
        }
        return item;
      })
    );
  };

  // Comma-separated IDs with space from cart_list API for place_order 'prescription' key (e.g. "2, 5, 6")
  // Includes prescription photo IDs and type: 2 written medicine IDs
  const prescriptionParam = useMemo(() => {
    const ids = [
      ...prescribedItems.map((item) => String(item.id).trim()),
      ...writtenMedicines
        .map((item) => String(item.id).trim())
        .filter((id) => id && !id.startsWith("wm-")),
    ].filter(Boolean);
    return Array.from(new Set(ids)).join(", ");
  }, [prescribedItems, writtenMedicines]);

  // Comma-separated IDs with space from cartlist API for place_order 'cart' key (e.g. "2, 3, 5")
  const cartParam = useMemo(() => {
    return keyedInMedicines
      .map((item) => String(item.cart_id || item.raw?.id || item.id).trim())
      .filter(Boolean)
      .join(", ");
  }, [keyedInMedicines]);

  // =========================================================================
  // UPLOAD SCREEN (upload_prescription API)
  // =========================================================================

  // Current active cards list and setter depending on active sub-tab
  const currentUploadCards = uploadType === 0 ? prescriptionCards : medicineCards;
  const setCurrentUploadCards = uploadType === 0 ? setPrescriptionCards : setMedicineCards;

  // Counts of valid items in each category
  const validPrescriptionCards = useMemo(
    () => prescriptionCards.filter((c) => c.frontFile || c.backFile),
    [prescriptionCards]
  );
  const validMedicineCards = useMemo(
    () => medicineCards.filter((c) => c.frontFile || c.backFile),
    [medicineCards]
  );
  const totalUploadItemsCount = validPrescriptionCards.length + validMedicineCards.length;

  const handleFileChange = (cardId, side, file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCurrentUploadCards((prev) =>
      prev.map((c) => {
        if (c.id === cardId) {
          return side === "front"
            ? { ...c, frontFile: file, frontFileName: file.name, frontPreview: previewUrl }
            : { ...c, backFile: file, backFileName: file.name, backPreview: previewUrl };
        }
        return c;
      })
    );
  };

  const handleRemoveFile = (cardId, side) => {
    setCurrentUploadCards((prev) =>
      prev.map((c) => {
        if (c.id === cardId) {
          return side === "front"
            ? { ...c, frontFile: null, frontFileName: "", frontPreview: "" }
            : { ...c, backFile: null, backFileName: "", backPreview: "" };
        }
        return c;
      })
    );
  };

  const handleCardFieldChange = (cardId, field, value) => {
    setCurrentUploadCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, [field]: value } : c))
    );
  };

  const handleAddAnotherUploadCard = () => {
    setCurrentUploadCards((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((c) => c.id)) + 1 : 1;
      return [
        ...prev,
        uploadType === 0
          ? createInitialCard(true, nextId)
          : createInitialCard(false, nextId),
      ];
    });
  };

  const handleDeleteUploadCard = (cardId) => {
    if (currentUploadCards.length <= 1) {
      Swal.fire("Notice", "At least one item is required.", "info");
      return;
    }
    setCurrentUploadCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleSaveAndProceedUpload = async () => {
    if (!selectedPatientId) {
      Swal.fire({
        icon: "warning",
        title: "Patient Required",
        text: "Please select a Patient / Customer first before uploading files.",
        confirmButtonColor: "#0ba6df",
      });
      return;
    }

    // Collect all valid cards from BOTH prescription and medicine photo sections
    const allValidItems = [
      ...validPrescriptionCards.map((c) => ({ ...c, type: 0 })),
      ...validMedicineCards.map((c) => ({ ...c, type: 1 })),
    ];

    if (allValidItems.length === 0) {
      Swal.fire(
        "Image Required",
        "Please upload at least a Front or Back image for at least one item.",
        "warning"
      );
      return;
    }

    setIsSubmittingUpload(true);
    try {
      const formData = new FormData();
      formData.append("user_id", String(effectiveUserId));

      allValidItems.forEach((card, index) => {
        const qty =
          card.type === 0
            ? (card.asPerPrescription ? "0" : (card.days || "1"))
            : (card.days || "1");

        formData.append(`prescriptions[${index}][quantity]`, String(qty));
        formData.append(`prescriptions[${index}][type]`, String(card.type));

        if (card.frontFile) {
          formData.append(`prescriptions[${index}][front_image]`, card.frontFile);
        }
        if (card.backFile) {
          formData.append(`prescriptions[${index}][back_image]`, card.backFile);
        }
      });

      const res = await uploadPrescriptionApi(formData);
      if (res.success) {
        const pCount = validPrescriptionCards.length;
        const mCount = validMedicineCards.length;
        let successMsg = "";
        if (pCount > 0 && mCount > 0) {
          successMsg = `${pCount} prescription(s) and ${mCount} medicine photo(s) uploaded and added to cart.`;
        } else if (pCount > 0) {
          successMsg = `${pCount} prescription(s) uploaded and added to cart.`;
        } else {
          successMsg = `${mCount} medicine photo(s) uploaded and added to cart.`;
        }

        Swal.fire({
          title: "Uploaded Successfully!",
          text: res.message || successMsg,
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });

        // Reset both sections to clean initial states
        setPrescriptionCards([createInitialCard(true, 1)]);
        setMedicineCards([createInitialCard(false, 1)]);

        await loadCart(effectiveUserId);

        // Switch to Cart Items tab and prescribed sub-view
        setCartViewType("prescribed");
        setActiveTab("cart");
      } else {
        Swal.fire("Upload Notice", res.message || "Could not upload items.", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Failed to upload prescriptions/medicines.", "error");
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  // =========================================================================
  // PLACE ORDER HANDLER (`place_order` API)
  // =========================================================================

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return;

    if (!effectiveUserId || !selectedPatient) {
      Swal.fire({
        title: "Patient Required",
        text: "Patient / Customer is mandatory for order. Please select a patient first.",
        icon: "warning",
        confirmButtonColor: "#0ba6df",
      });
      return;
    }

    if (totals.totalItems === 0) {
      Swal.fire(
        "Cart is Empty",
        "Please add catalog medicines, write medicines, or upload prescriptions before placing an order.",
        "warning"
      );
      return;
    }

    // Validation: Check Guest House room number or custom address
    const isGuestHouse =
      ["OMCA_GH_51", "OMCA_GH_52", "OMCA_GH_DWARKA"].includes(selectedAddressKey) ||
      Boolean(FIXED_ADDRESSES.find((f) => f.key === selectedAddressKey)?.isGuestHouse);

    const selectedGh = FIXED_ADDRESSES.find((f) => f.key === selectedAddressKey);

    if (isGuestHouse && !roomNumber.trim()) {
      Swal.fire({
        title: "Room Number Required",
        text: `Please enter the room number for ${selectedGh?.label || "the selected Guest House"}.`,
        icon: "warning",
        confirmButtonColor: "#0ba6df",
      });
      return;
    }

    if (selectedAddressKey === "OTHER" && !otherAddressText.trim()) {
      Swal.fire({
        title: "Delivery Address Required",
        text: "Please enter the custom delivery address (e.g. Flat 302, Green Valley Apartments, Dwarka).",
        icon: "warning",
        confirmButtonColor: "#0ba6df",
      });
      return;
    }

    // Determine payload fields based on Case 1 and Case 2:
    // Case 1: Guest House selected with Room Number
    // -> delivery_type: "OMCA Guest House 51", room_number: "104"
    // Case 2: "other" selected with custom address
    // -> delivery_type: "other", delivery_address: "...", address: "..."
    let deliveryType = "";
    let deliveryRoomNumber = undefined;
    let deliveryAddressVal = undefined;
    let addressVal = undefined;

    if (isGuestHouse) {
      deliveryType = selectedGh?.label || "OMCA Guest House 51";
      deliveryRoomNumber = roomNumber.trim();
    } else if (selectedAddressKey === "OTHER") {
      deliveryType = "other";
      deliveryAddressVal = otherAddressText.trim();
      addressVal = otherAddressText.trim();
    } else if (selectedAddressKey === "OMCA_OFFICE") {
      deliveryType = "OMCA Office Mauritius";
      deliveryAddressVal = "Route Royale, OMCA Office Mauritius, Curepipe, Mauritius";
      addressVal = "Route Royale, OMCA Office Mauritius, Curepipe, Mauritius";
    } else if (String(selectedAddressKey).startsWith("SAVED_")) {
      const id = selectedAddressKey.replace("SAVED_", "");
      const found = addresses.find((a) => String(a.id) === String(id));
      deliveryType = "other";
      const formattedAddr = found
        ? `${found.house || found.house_name ? `${found.house || found.house_name}, ` : ""}${found.street}, ${found.city}, ${found.country || found.counrty || "Mauritius"}`
        : "Saved Address";
      deliveryAddressVal = formattedAddr;
      addressVal = formattedAddr;
    }

    const totalItem = totals.totalItems;
    const method = "0";

    const param = {
      user_id: Number(effectiveUserId) || effectiveUserId || 0,
      user: Number(effectiveUserId) || effectiveUserId || 0,
      cart: cartParam || "",
      quantity: totalItem,
      price: totals.totalPrice || 0,
      method: method,
      delivery_type: deliveryType,
      ...(deliveryRoomNumber !== undefined ? { room_number: deliveryRoomNumber } : {}),
      ...(deliveryAddressVal !== undefined ? { delivery_address: deliveryAddressVal } : {}),
      ...(addressVal !== undefined ? { address: addressVal } : {}),
      ...(prescriptionParam ? { prescription: prescriptionParam } : {}),
      ...(writtenMedicines.length > 0
        ? {
            written_medicines: writtenMedicines.map((m) => ({
              ...(m.id && !String(m.id).startsWith("wm-") ? { id: m.id } : {}),
              name: m.name,
              quantity: String(m.quantity || ""),
              days: String(m.days || ""),
            })),
          }
        : {}),
      ...(keyedInMedicines.length > 0
        ? {
            medicines: keyedInMedicines.map((m) => ({
              medicine_id: Number(m.id || m.medicine_id || m.medicineId),
              quantity: Number(m.cartQuantity || m.quantity || 1),
            })),
          }
        : {}),
    };

    const confirm = await Swal.fire({
      title: "Confirm Order Placement?",
      text: `Place order for ${selectedPatient.name} with ${totalItem} item(s) (${keyedInMedicines.length} catalog, ${prescribedItems.length} prescription/photo(s), ${writtenMedicines.length} written medicine(s))?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0ba6df",
      confirmButtonText: "Yes, Place Order",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    setIsPlacingOrder(true);
    try {
      // Primary order placement: POST /api/place_order
      const res = await placeOrderApi(param);

      if (!res.success) {
        Swal.fire({
          title: "Order Failed",
          text: res.message || "Could not complete order placement.",
          icon: "error",
          confirmButtonColor: "#0ba6df",
        });
        return;
      }

      const resData = res.data?.data || res.data;
      const createdOrderId = String(
        resData?.order_id || resData?.order || resData?.id || ""
      );

      const newOrderId =
        createdOrderId ||
        String(Math.floor(100000000000 + Math.random() * 900000000000));

      const createdOrder = {
        id: newOrderId,
        sNo: 1,
        orderId: newOrderId,
        patientName: selectedPatient.name,
        userId: effectiveUserId,
        patientPhone: selectedPatient.phone,
        patientEmail: selectedPatient.email,
        delivery_type: deliveryType,
        deliveryType,
        room_number: deliveryRoomNumber || null,
        roomNumber: deliveryRoomNumber || null,
        delivery_address: deliveryAddressVal || null,
        address: addressVal || null,
        deliveryAddress: deliveryDestinationText,
        paymentMode: "Cash On Delivery",
        paidAmount: totals.totalPrice || 0,
        currency: "MUR",
        orderDate: new Date().toISOString().replace("T", " ").slice(0, 19),
        status: "Pending",
        notes: `Order created via CRM by Admin for ${selectedPatient.name}${
          writtenMedicines.length > 0
            ? ` | Written Medicines: ${writtenMedicines.map((m) => `${m.name} (Qty: ${m.quantity}${m.days ? `, Days: ${m.days}` : ""})`).join("; ")}`
            : ""
        }`,
        written_medicines: writtenMedicines.map((w, idx) => ({
          id: w.id || idx + 1,
          name: w.name,
          quantity: w.quantity || "",
          days: w.days || "",
        })),
        items: [
          ...keyedInMedicines.map((m) => ({
            id: `it-${m.id}`,
            name: m.name,
            category: "Medicine",
            dosage: m.quantity || "Standard",
            quantity: m.cartQuantity || 1,
            unitPrice: 0,
            total: 0,
            image:
              m.image ||
              "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg",
          })),
          ...prescribedItems.map((p, idx) => ({
            id: `pr-${p.id || idx}`,
            name:
              Number(p.type) === 1
                ? `Prescribed Medicine #${idx + 1}`
                : `Prescription #${idx + 1}`,
            category: Number(p.type) === 1 ? "Medicine Photo" : "Prescription",
            dosage: `${p.quantity || p.front_quantity || 1} Days`,
            quantity: 1,
            unitPrice: 0,
            total: 0,
            type: p.type,
            image:
              p.front_image ||
              p.back_image ||
              "https://omcacrm.com/omca/public/images/prescription/1788841526_6a9f8e3611987_front.jpg",
            front_image: p.front_image || "",
            back_image: p.back_image || "",
          })),
          ...writtenMedicines.map((w) => ({
            id: w.id,
            name: w.name,
            category: "Written Medicine",
            dosage: w.days ? `${w.days} Days` : "Standard",
            quantity: parseInt(w.quantity) || 1,
            unitPrice: 0,
            total: 0,
            image: getMedicineDefaultImage(w.name),
            isWritten: true,
            days: w.days,
          })),
        ],
        prescriptions: [
          ...prescribedItems.map((p, idx) => ({
            id: p.id || idx + 1,
            name:
              Number(p.type) === 1
                ? `Prescribed Medicine #${idx + 1}`
                : `Prescription Copy #${idx + 1}`,
            type: p.type,
            quantity: p.quantity || p.front_quantity || 1,
            front_image:
              p.front_image ||
              "https://omcacrm.com/omca/public/images/prescription/1788841526_6a9f8e3611987_front.jpg",
            back_image: p.back_image || "",
          })),
          ...writtenMedicines.map((w, idx) => ({
            id: w.id || idx + 1,
            name: `${w.name} (Qty: ${w.quantity}${w.days ? `, Days: ${w.days}` : ""})`,
            type: 2,
            quantity: w.quantity,
            days: w.days || "",
            front_image: "",
            back_image: "",
          })),
        ],
      };

      addNewOrder(createdOrder);

      // Clear local states
      setKeyedInMedicines([]);
      setPrescribedItems([]);
      setWrittenMedicines([]);

      Swal.fire({
        title: "Order Placed Successfully!",
        text: `Order #${newOrderId} has been registered and marked Pending.`,
        icon: "success",
        confirmButtonColor: "#0ba6df",
      }).then(() => {
        navigate("/Admin/orders");
      });
    } catch (err) {
      console.error("Order placement error:", err);
      Swal.fire("Error", "Could not complete order placement.", "error");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content create-order-container">
        {/* Page Header */}
        <div className="create-order-header">
          <div>
            <h3>Create New Order</h3>
            <ul className="create-order-breadcrumb">
              <li>
                <Link to="/Dashboard">Dashboard</Link>
              </li>
              <li>/</li>
              <li>
                <Link to="/Admin/orders">Orders</Link>
              </li>
              <li>/</li>
              <li>Create Order</li>
            </ul>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
              onClick={() => navigate("/Admin/orders")}
            >
              <i className="fa fa-arrow-left" /> Back to Orders
            </button>
          </div>
        </div>

        {/* Top Patient & Delivery Configuration Bar */}
        <div className="order-patient-bar">
          <div className="order-patient-grid">
            {/* Patient Select */}
            <div>
              <div className="patient-input-label">
                <span>
                  Patient / Customer <span className="text-danger fw-bold">*</span>
                </span>
              </div>

              <PatientSearchSelect
                value={selectedPatient}
                onChange={(patient) => setSelectedPatientObj(patient || null)}
                searchFn={searchOrderPatients}
                placeholder="Search by Name, Patient ID (OMCA...), Phone..."
              />

              {selectedPatient ? (
                <div className="patient-subinfo flex-wrap">
                  <span>
                    <i className="fa fa-user me-1" />
                    <strong>{selectedPatient.name}</strong>
                    {(selectedPatient.patientNumber || selectedPatient.patientId) && (
                      <span
                        className="badge bg-primary-subtle text-primary border ms-1.5"
                        style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px" }}
                      >
                        ID: {selectedPatient.patientNumber || selectedPatient.patientId}
                      </span>
                    )}
                    {selectedPatient.source && (
                      <span
                        className="badge bg-soft-info text-info ms-1"
                        style={{ fontSize: "10px", fontWeight: 600, border: "1px solid rgba(11, 166, 223, 0.3)" }}
                      >
                        {selectedPatient.source}
                      </span>
                    )}
                  </span>
                  <span>
                    <i className="fa fa-phone me-1" />
                    {selectedPatient.phone}
                  </span>
                  <span>
                    <i className="fa fa-envelope-o me-1" />
                    {selectedPatient.email}
                  </span>
                </div>
              ) : (
                <div className="text-danger small mt-2 d-flex align-items-center gap-1 fw-semibold">
                  <i className="fa fa-exclamation-circle" /> Patient / Customer is mandatory for order
                </div>
              )}
            </div>

            {/* Address Select */}
            <div>
              <div className="patient-input-label">
                <span>Delivery Address</span>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-primary p-0 text-decoration-none fw-semibold"
                  style={{ fontSize: "12.5px" }}
                  onClick={handleOpenAddAddressModal}
                  disabled={!selectedPatientId}
                  title="Add New Delivery Address"
                >
                  <i className="fa fa-plus-circle me-1" /> Add New Address
                </button>
              </div>

              <select
                className="patient-select-ctrl"
                value={selectedAddressKey}
                onChange={(e) => {
                  if (e.target.value === "__ADD_MODAL__") {
                    handleOpenAddAddressModal();
                  } else {
                    setSelectedAddressKey(e.target.value);
                  }
                }}
                disabled={!selectedPatientId}
              >
                {!selectedPatientId ? (
                  <option value="">Select a patient / customer first...</option>
                ) : (
                  <>
                    <optgroup label="Guest Houses (Room Number Delivery)">
                      <option value="OMCA_GH_51">OMCA Guest House 51</option>
                      <option value="OMCA_GH_52">OMCA Guest House 52</option>
                      <option value="OMCA_GH_DWARKA">OMCA Guest House Dwarka</option>
                    </optgroup>

                    <optgroup label="Other Delivery Locations">
                      <option value="OTHER">Other (Enter custom address)...</option>
                      <option value="OMCA_OFFICE">OMCA Office Mauritius</option>
                    </optgroup>

                    {addresses.length > 0 && (
                      <optgroup label="Saved Patient Addresses">
                        {addresses.map((a) => (
                          <option key={a.id} value={`SAVED_${a.id}`}>
                            {a.house || a.house_name ? `${a.house || a.house_name}, ` : ""}
                            {a.street}, {a.city}, {a.country || a.counrty || "Mauritius"}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <option value="__ADD_MODAL__">+ Add New Delivery Address (Form)...</option>
                  </>
                )}
              </select>

              {/* Conditional inline fields for Guest House Room Number */}
              {["OMCA_GH_51", "OMCA_GH_52", "OMCA_GH_DWARKA"].includes(selectedAddressKey) && (
                <div className="address-inline-box">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="patient-input-label m-0 text-dark">
                      <span>
                        <i className="fa fa-bed text-primary me-1" />
                        Room Number <span className="text-danger fw-bold">*</span>
                      </span>
                    </label>
                    <span className="badge bg-primary-subtle text-primary border" style={{ fontSize: "11px" }}>
                      {FIXED_ADDRESSES.find((f) => f.key === selectedAddressKey)?.label}
                    </span>
                  </div>
                  <input
                    type="text"
                    className="patient-select-ctrl"
                    style={{ height: "36px", fontSize: "13px" }}
                    placeholder="Enter room number (e.g. 104)..."
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                  />
                  <span className="text-muted small mt-1 d-block" style={{ fontSize: "11px" }}>
                    Once Guest House is selected, enter room number (e.g. 104) for accurate delivery.
                  </span>
                </div>
              )}

              {/* Conditional inline field for Other address */}
              {selectedAddressKey === "OTHER" && (
                <div className="address-inline-box">
                  <label className="patient-input-label mb-1 text-dark">
                    <span>
                      <i className="fa fa-map-marker text-danger me-1" />
                      Enter Delivery Address <span className="text-danger fw-bold">*</span>
                    </span>
                  </label>
                  <textarea
                    rows="2"
                    className="patient-select-ctrl"
                    style={{ height: "auto", fontSize: "13px", padding: "8px" }}
                    placeholder="Enter complete delivery address (e.g. Flat 302, Green Valley Apartments, Dwarka)..."
                    value={otherAddressText}
                    onChange={(e) => setOtherAddressText(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="order-workspace-layout">
          {/* Main Card: Tabbed Workflow */}
          <div className="order-content-card">
            {/* Clean Tab Header */}
            <div className="order-tabs-header">
              <button
                type="button"
                className={`order-tab-item ${activeTab === "cart" ? "active" : ""}`}
                onClick={() => setActiveTab("cart")}
              >
                <i className="fa fa-shopping-cart" />
                <span>Cart</span>
                <span className="order-tab-count">
                  {keyedInMedicines.length + prescribedItems.length + writtenMedicines.length}
                </span>
              </button>

              <button
                type="button"
                className={`order-tab-item ${activeTab === "catalog" ? "active" : ""}`}
                onClick={() => setActiveTab("catalog")}
              >
                <i className="fa fa-medkit" />
                <span>Medicines Catalog</span>
                <span className="order-tab-count">{catalogMedicines.length}</span>
              </button>

              <button
                type="button"
                className={`order-tab-item ${activeTab === "upload" ? "active" : ""}`}
                onClick={() => setActiveTab("upload")}
              >
                <i className="fa fa-pencil-square-o" />
                <span>Prescriptions & Manual Entry</span>
              </button>
            </div>

            {/* TAB 1: CART ITEMS */}
            {activeTab === "cart" && (
              <div className="order-tab-body">
                <div className="cart-filter-pills">
                  <div className="pill-group">
                    <button
                      type="button"
                      className={`pill-btn ${cartViewType === "keyed_in" ? "active" : ""}`}
                      onClick={() => setCartViewType("keyed_in")}
                    >
                      Keyed-In Medicines ({keyedInMedicines.length})
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${cartViewType === "prescribed" ? "active" : ""}`}
                      onClick={() => setCartViewType("prescribed")}
                    >
                      Prescribed Items ({prescribedItems.length})
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${cartViewType === "written" ? "active" : ""}`}
                      onClick={() => setCartViewType("written")}
                    >
                      Written Medicines ({writtenMedicines.length})
                    </button>
                  </div>

                  <div className="cart-action-links">
                    <button
                      type="button"
                      className="btn-crm-sm outline"
                      onClick={() => setActiveTab("catalog")}
                    >
                      <i className="fa fa-plus-circle" /> Add Medicines
                    </button>
                    <button
                      type="button"
                      className="btn-crm-sm outline"
                      onClick={() => {
                        setUploadType(0);
                        setActiveTab("upload");
                      }}
                    >
                      <i className="fa fa-cloud-upload" /> Upload Prescription
                    </button>
                    <button
                      type="button"
                      className="btn-crm-sm outline"
                      onClick={() => {
                        setUploadType(2);
                        setActiveTab("upload");
                      }}
                    >
                      <i className="fa fa-pencil" /> Write Medicine
                    </button>
                    {(keyedInMedicines.length > 0 ||
                      prescribedItems.length > 0 ||
                      writtenMedicines.length > 0) && (
                      <button
                        type="button"
                        className="btn-empty-cart"
                        onClick={handleEmptyCart}
                        title="Empty all items from cart"
                      >
                        <i className="fa fa-trash-o" /> Empty Cart
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-view: Keyed-In Medicines Table */}
                {cartViewType === "keyed_in" && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="small text-muted">
                        <i className="fa fa-info-circle text-primary me-1" />
                        {selectedPatient ? (
                          <>
                            Showing medicines in cart for <strong>{selectedPatient.name}</strong> ({keyedInMedicines.length} items)
                          </>
                        ) : (
                          <span>Please select a patient / customer above to view cart medicines</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        style={{ fontSize: "11.5px" }}
                        onClick={() => effectiveUserId && loadMedicineCart(effectiveUserId)}
                        disabled={!effectiveUserId}
                      >
                        <i className="fa fa-refresh me-1" /> Refresh Cart
                      </button>
                    </div>

                    {loadingMedicineCart ? (
                      <div className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2" />
                        Loading medicines in cart...
                      </div>
                    ) : keyedInMedicines.length > 0 ? (
                      <div className="table-responsive">
                        <table className="crm-table">
                          <thead>
                            <tr>
                              <th style={{ width: "65px" }}>Item</th>
                              <th>Medicine Name & Packaging</th>
                              <th style={{ width: "130px" }} className="text-center">Quantity</th>
                              <th style={{ width: "60px" }} className="text-center">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {keyedInMedicines.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <img
                                    src={
                                      item.image ||
                                      "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg"
                                    }
                                    alt={item.name}
                                    className="med-thumb"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = FALLBACK_MEDICINE_IMAGE;
                                    }}
                                  />
                                </td>
                                <td>
                                  <div className="fw-bold text-dark">{item.name}</div>
                                  <span className="small text-muted">
                                    {item.quantity || "15 tablets in a strip"}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <div className="qty-stepper mx-auto">
                                    <button
                                      type="button"
                                      className="qty-btn"
                                      onClick={() => handleUpdateKeyedInQty(item.id, -1)}
                                    >
                                      -
                                    </button>
                                    <span className="qty-val">{item.cartQuantity || 1}</span>
                                    <button
                                      type="button"
                                      className="qty-btn"
                                      onClick={() => handleUpdateKeyedInQty(item.id, 1)}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-link text-danger p-0"
                                    onClick={() => handleDeleteKeyedInItem(item.id)}
                                    title="Remove item"
                                  >
                                    <i className="fa fa-trash-o" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <i className="fa fa-shopping-basket fa-3x mb-2 text-muted" />
                        <h6 className="fw-bold">No Keyed-In Medicines in Cart</h6>
                        <p className="small mb-3">
                          Select products from the medicines catalog to add them to this order.
                        </p>
                        <button
                          type="button"
                          className="btn-crm-sm primary"
                          onClick={() => setActiveTab("catalog")}
                        >
                          <i className="fa fa-plus-circle" /> Browse Medicines Catalog
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view: Prescribed Items Grid */}
                {cartViewType === "prescribed" && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="small text-muted">
                        <i className="fa fa-info-circle text-primary me-1" />
                        {selectedPatient ? (
                          <>
                            Showing prescribed items for <strong>{selectedPatient.name}</strong> ({prescribedItems.length} items)
                          </>
                        ) : (
                          <span>Please select a patient / customer above to view prescribed items</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        style={{ fontSize: "11.5px" }}
                        onClick={() => effectiveUserId && loadCart(effectiveUserId)}
                        disabled={!effectiveUserId}
                      >
                        <i className="fa fa-refresh me-1" /> Refresh Cart
                      </button>
                    </div>

                    {loadingCart ? (
                      <div className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2" />
                        Loading prescribed items...
                      </div>
                    ) : prescribedItems.length > 0 ? (
                      <div className="prescribed-grid">
                        {prescribedItems.map((item, idx) => {
                          const isPrescription = Number(item.type) === 0;
                          const cardTitle = isPrescription
                            ? `Prescription #${idx + 1}`
                            : `Medicine Item #${idx + 1}`;
                          const displayDays =
                            item.quantity === "0" || !item.quantity
                              ? "As per prescription"
                              : `${item.quantity || item.front_quantity || 10} Days`;

                          const imageSrc =
                            item.front_image ||
                            item.back_image ||
                            "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=300";

                          return (
                            <div key={item.id || idx} className="prescribed-item-box">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: isPrescription ? "#0ba6df" : "#10b981",
                                    color: "#fff",
                                  }}
                                >
                                  {isPrescription ? "Prescription" : "Medicine Photo"}
                                </span>
                                <span className="small text-muted fw-bold">ID: #{item.id}</span>
                                <button
                                  type="button"
                                  className="btn btn-link text-danger p-0"
                                  onClick={() => handleDeletePrescriptionItem(item.id)}
                                  title="Remove item"
                                >
                                  <i className="fa fa-trash-o" />
                                </button>
                              </div>

                              <div className="fw-bold text-dark mb-1">{cardTitle}</div>

                              <div className="d-flex gap-2 mb-2">
                                {item.front_image ? (
                                  <div style={{ flex: 1 }}>
                                    <img
                                      src={item.front_image}
                                      alt="Front"
                                      className="prescribed-thumb-img"
                                      style={{ height: "90px", objectFit: "cover" }}
                                    />
                                    <div className="text-center text-muted" style={{ fontSize: "10px" }}>Front Image</div>
                                  </div>
                                ) : (
                                  <img
                                    src={imageSrc}
                                    alt="Prescription"
                                    className="prescribed-thumb-img"
                                  />
                                )}
                                {item.back_image && (
                                  <div style={{ flex: 1 }}>
                                    <img
                                      src={item.back_image}
                                      alt="Back"
                                      className="prescribed-thumb-img"
                                      style={{ height: "90px", objectFit: "cover" }}
                                    />
                                    <div className="text-center text-muted" style={{ fontSize: "10px" }}>Back Image</div>
                                  </div>
                                )}
                              </div>

                              <div className="small text-muted d-flex justify-content-between align-items-center">
                                <span>
                                  <i className="fa fa-cubes text-primary me-1" />
                                  Qty: {item.quantity || 1}
                                </span>
                                <span>
                                  <i className="fa fa-calendar text-muted me-1" />
                                  {displayDays}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <i className="fa fa-file-text-o fa-3x mb-2 text-muted" />
                        <h6 className="fw-bold">No Prescriptions Uploaded</h6>
                        <p className="small mb-3">
                          Upload front/back photos of prescriptions or medicine strips{effectiveUserId ? ` for user #${effectiveUserId}` : ""}.
                        </p>
                        <button
                          type="button"
                          className="btn-crm-sm primary"
                          onClick={() => setActiveTab("upload")}
                        >
                          <i className="fa fa-cloud-upload" /> Upload Prescription
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view: Written Medicines Table */}
                {cartViewType === "written" && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="small text-muted">
                        <i className="fa fa-pencil text-primary me-1" />
                        {selectedPatient ? (
                          <>
                            Showing manually written medicines for <strong>{selectedPatient.name}</strong> ({writtenMedicines.length} items)
                          </>
                        ) : (
                          <span>Please select a patient / customer above to view written medicines</span>
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          style={{ fontSize: "11.5px" }}
                          onClick={() => effectiveUserId && loadCart(effectiveUserId)}
                          disabled={!effectiveUserId || loadingCart}
                        >
                          <i className={`fa fa-refresh me-1 ${loadingCart ? "fa-spin" : ""}`} /> Refresh Cart
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          style={{ fontSize: "11.5px" }}
                          onClick={() => {
                            setUploadType(2);
                            setActiveTab("upload");
                          }}
                        >
                          <i className="fa fa-plus me-1" /> Write More Medicines
                        </button>
                      </div>
                    </div>

                    {loadingCart ? (
                      <div className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2" />
                        Loading written medicines...
                      </div>
                    ) : writtenMedicines.length > 0 ? (
                      <div className="table-responsive">
                        <table className="crm-table">
                          <thead>
                            <tr>
                              <th style={{ width: "65px" }}>Item</th>
                              <th>Medicine Name</th>
                              <th style={{ width: "140px" }} className="text-center">Quantity</th>
                              <th style={{ width: "120px" }} className="text-center">Days</th>
                              <th style={{ width: "60px" }} className="text-center">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {writtenMedicines.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <div className="written-med-icon-wrap">
                                    <i className="fa fa-medkit" />
                                  </div>
                                </td>
                                <td>
                                  <div className="fw-bold text-dark">{item.name}</div>
                                  <span className="written-med-badge">
                                    Written Entry
                                  </span>
                                </td>
                                <td className="text-center">
                                  <div className="qty-stepper mx-auto">
                                    <button
                                      type="button"
                                      className="qty-btn"
                                      onClick={() => handleUpdateWrittenQty(item.id, -1)}
                                    >
                                      -
                                    </button>
                                    <span className="qty-val">{item.quantity || 1}</span>
                                    <button
                                      type="button"
                                      className="qty-btn"
                                      onClick={() => handleUpdateWrittenQty(item.id, 1)}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-light text-secondary border px-2 py-1">
                                    <i className="fa fa-calendar me-1" />
                                    {item.days ? `${item.days} Days` : "Standard"}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <button
                                    type="button"
                                    className="btn btn-link text-danger p-0"
                                    onClick={() => handleDeleteWrittenMedicine(item.id)}
                                    title="Remove medicine"
                                  >
                                    <i className="fa fa-trash-o" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <i className="fa fa-pencil-square-o fa-3x mb-2 text-primary" />
                        <h6 className="fw-bold">No Written Medicines in Cart</h6>
                        <p className="small mb-3">
                          Write medicine names directly with quantity and days instead of uploading prescription photos.
                        </p>
                        <button
                          type="button"
                          className="btn-crm-sm primary"
                          onClick={() => {
                            setUploadType(2);
                            setActiveTab("upload");
                          }}
                        >
                          <i className="fa fa-pencil me-1" /> Write Medicine Name Now
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MEDICINES CATALOG */}
            {activeTab === "catalog" && (
              <div className="order-tab-body">
                {/* Search Bar */}
                <div className="catalog-search-wrap">
                  <i
                    className="fa fa-search text-muted position-absolute"
                    style={{ top: "13px", left: "14px" }}
                  />
                  <input
                    type="text"
                    className="catalog-search-input"
                    placeholder="Search medicines by name or packaging..."
                    value={medicineSearchTerm}
                    onChange={(e) => setMedicineSearchTerm(e.target.value)}
                  />
                </div>

                {/* Products Grid */}
                {loadingMedicines ? (
                  <div className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" />
                    Loading medicines catalog...
                  </div>
                ) : filteredMedicines.length > 0 ? (
                  <div className="catalog-grid">
                    {filteredMedicines.map((med) => {
                      const isAdded = keyedInMedicines.some(
                        (item) =>
                          Number(item.id) === Number(med.id) ||
                          Number(item.medicine_id) === Number(med.id)
                      );
                      return (
                        <div key={med.id} className="catalog-item-card">
                          <div className="d-flex gap-2 align-items-center">
                            <img
                              src={
                                med.image ||
                                "https://omcacrm.com/omca/public/images/medicineImages/download (3).jpeg"
                              }
                              alt={med.name}
                              style={{
                                width: "54px",
                                height: "54px",
                                objectFit: "contain",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                              }}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = FALLBACK_MEDICINE_IMAGE;
                              }}
                            />
                            <div>
                              <div className="fw-bold text-dark">{med.name}</div>
                              <div className="small text-muted">
                                {med.quantity || "15 tablets in a strip"}
                              </div>
                            </div>
                          </div>

                          <div className="text-end pt-2 border-top">
                            {isAdded ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleToggleAddMedicine(med)}
                              >
                                <i className="fa fa-check me-1" /> Added (Remove)
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ backgroundColor: "#0ba6df", borderColor: "#0ba6df" }}
                                onClick={() => handleToggleAddMedicine(med)}
                              >
                                <i className="fa fa-plus me-1" /> Add to Order
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <i className="fa fa-medkit fa-3x mb-2 text-muted" />
                    <h6 className="fw-bold">No Medicines Found</h6>
                    <p className="small">Try searching for Dolo, Paracetamol, Crocin, or Becosules</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PRESCRIPTIONS & MANUAL MEDICINE ENTRY */}
            {activeTab === "upload" && (
              <div className="order-tab-body">
                {/* Upload Mode Pill */}
                <div className="upload-pills">
                  <button
                    type="button"
                    className={`upload-pill-btn ${uploadType === 0 ? "active" : ""}`}
                    onClick={() => setUploadType(0)}
                  >
                    <i className="fa fa-file-text-o me-1" /> Upload Prescription
                    {validPrescriptionCards.length > 0 && (
                      <span className="upload-pill-badge">
                        {validPrescriptionCards.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`upload-pill-btn ${uploadType === 1 ? "active" : ""}`}
                    onClick={() => setUploadType(1)}
                  >
                    <i className="fa fa-camera me-1" /> Upload Medicine Photo
                    {validMedicineCards.length > 0 && (
                      <span className="upload-pill-badge">
                        {validMedicineCards.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`upload-pill-btn ${uploadType === 2 ? "active" : ""}`}
                    onClick={() => setUploadType(2)}
                  >
                    <i className="fa fa-pencil me-1" /> Write Medicine Name
                    {writtenMedicines.length > 0 && (
                      <span className="upload-pill-badge">
                        {writtenMedicines.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Banner for Photo Uploads */}
                {(uploadType === 0 || uploadType === 1) && (
                  <div className="upload-alert-strip">
                    <i className="fa fa-info-circle text-primary" />
                    <span>
                      {uploadType === 0
                        ? "Add prescriptions with front or back image. Choose 'As per prescription' or optionally enter number of days."
                        : "Add medicines with front or back image (at least one) and number of days for each item."}
                    </span>
                  </div>
                )}

                {/* PHOTO UPLOADS SECTION */}
                {(uploadType === 0 || uploadType === 1) && (
                  <div>
                    {currentUploadCards.map((card, index) => {
                      const cardTitle =
                        uploadType === 0
                          ? `Prescription Item #${index + 1}`
                          : `Medicine Photo #${index + 1}`;

                      return (
                        <div key={card.id} className="upload-card-wrapper">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold text-dark m-0">{cardTitle}</h6>
                            {currentUploadCards.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-link text-danger p-0"
                                onClick={() => handleDeleteUploadCard(card.id)}
                              >
                                <i className="fa fa-trash-o" /> Remove
                              </button>
                            )}
                          </div>

                          {/* Dropzones */}
                          <div className="upload-drop-grid">
                            {/* Front */}
                            <label className="dropzone-box">
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) =>
                                  handleFileChange(card.id, "front", e.target.files[0])
                                }
                              />
                              {card.frontPreview ? (
                                <>
                                  <img
                                    src={card.frontPreview}
                                    alt="Front Preview"
                                    className="dropzone-preview-img"
                                  />
                                  <button
                                    type="button"
                                    className="dropzone-remove-btn"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRemoveFile(card.id, "front");
                                    }}
                                  >
                                    <i className="fa fa-times" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <i className="fa fa-camera fa-2x text-muted mb-1" />
                                  <span className="small fw-bold text-dark">Front Side Image</span>
                                  <span className="text-muted" style={{ fontSize: "11px" }}>
                                    Click to upload Front Image
                                  </span>
                                </>
                              )}
                            </label>

                            {/* Back */}
                            <label className="dropzone-box">
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) =>
                                  handleFileChange(card.id, "back", e.target.files[0])
                                }
                              />
                              {card.backPreview ? (
                                <>
                                  <img
                                    src={card.backPreview}
                                    alt="Back Preview"
                                    className="dropzone-preview-img"
                                  />
                                  <button
                                    type="button"
                                    className="dropzone-remove-btn"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRemoveFile(card.id, "back");
                                    }}
                                  >
                                    <i className="fa fa-times" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <i className="fa fa-camera fa-2x text-muted mb-1" />
                                  <span className="small fw-bold text-dark">
                                    Back Side Image (Optional)
                                  </span>
                                  <span className="text-muted" style={{ fontSize: "11px" }}>
                                    Click to upload Back Image
                                  </span>
                                </>
                              )}
                            </label>
                          </div>

                          {/* Options */}
                          <div className="d-flex gap-3 align-items-center flex-wrap">
                            {uploadType === 0 && (
                              <label className="d-flex align-items-center gap-2 m-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={card.asPerPrescription}
                                  onChange={(e) =>
                                    handleCardFieldChange(
                                      card.id,
                                      "asPerPrescription",
                                      e.target.checked
                                    )
                                  }
                                />
                                <span className="small fw-semibold">As per prescription</span>
                              </label>
                            )}

                            <div style={{ flex: 1, minWidth: "160px" }}>
                              <input
                                type="number"
                                min="1"
                                className="patient-select-ctrl"
                                placeholder={
                                  uploadType === 0
                                    ? "Number of days (optional)"
                                    : "Number of days (optional)"
                                }
                                value={card.days || ""}
                                disabled={uploadType === 0 && card.asPerPrescription}
                                onChange={(e) =>
                                  handleCardFieldChange(card.id, "days", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Upload Actions */}
                    <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                      <button
                        type="button"
                        className="btn-crm-sm outline"
                        onClick={handleAddAnotherUploadCard}
                      >
                        <i className="fa fa-plus-circle" /> Add Another Item
                      </button>

                      <button
                        type="button"
                        className="btn-crm-sm primary"
                        disabled={isSubmittingUpload}
                        onClick={handleSaveAndProceedUpload}
                      >
                        {isSubmittingUpload ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" /> Uploading...
                          </>
                        ) : (
                          <>
                            <i className="fa fa-check-circle me-1" /> Save & Add to Order
                            {totalUploadItemsCount > 0 ? ` (${totalUploadItemsCount})` : ""}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* WRITTEN MEDICINE NAME ENTRY SECTION (Option to write medicine name instead of photos) */}
                {uploadType === 2 && (
                  <div>
                    <div className="upload-alert-strip">
                      <i className="fa fa-pencil text-primary" />
                      <span>
                        Enter medicine names, quantities, and days manually without uploading prescription or medicine photos.
                      </span>
                    </div>

                    <div>
                      {writtenCards.map((card, index) => (
                        <div key={card.id} className="upload-card-wrapper">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold text-dark m-0">
                              <i className="fa fa-medkit text-primary me-2" />
                              Medicine #{index + 1}
                            </h6>
                            {writtenCards.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-link text-danger p-0"
                                onClick={() => handleDeleteWrittenCard(card.id)}
                              >
                                <i className="fa fa-trash-o" /> Remove
                              </button>
                            )}
                          </div>

                          <div className="row g-3">
                            <div className="col-md-6 col-12">
                              <label className="patient-input-label">
                                <span>
                                  Medicine Name <span className="text-danger fw-bold">*</span>
                                </span>
                              </label>
                              <input
                                type="text"
                                className="patient-select-ctrl"
                                placeholder="Enter medicine name (e.g. Paracetamol 500mg, Augmentin 625mg...)"
                                value={card.name}
                                onChange={(e) =>
                                  handleWrittenCardChange(card.id, "name", e.target.value)
                                }
                              />
                            </div>

                            <div className="col-md-3 col-sm-6 col-12">
                              <label className="patient-input-label">
                                <span>
                                  Quantity <span className="text-danger fw-bold">*</span>
                                </span>
                              </label>
                              <input
                                type="text"
                                className="patient-select-ctrl"
                                placeholder="Quantity (e.g. 10 tablets, 2 strips)"
                                value={card.quantity}
                                onChange={(e) =>
                                  handleWrittenCardChange(card.id, "quantity", e.target.value)
                                }
                              />
                            </div>

                            <div className="col-md-3 col-sm-6 col-12">
                              <label className="patient-input-label">
                                <span>Days (optional)</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="patient-select-ctrl"
                                placeholder="Days (optional, e.g. 5, 10)"
                                value={card.days}
                                onChange={(e) =>
                                  handleWrittenCardChange(card.id, "days", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                      <button
                        type="button"
                        className="btn-crm-sm outline"
                        onClick={handleAddAnotherWrittenCard}
                      >
                        <i className="fa fa-plus-circle" /> Add Another Medicine
                      </button>

                      <button
                        type="button"
                        className="btn-crm-sm primary"
                        onClick={handleSaveWrittenMedicines}
                        disabled={isSubmittingWritten}
                      >
                        {isSubmittingWritten ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                            Saving to Order...
                          </>
                        ) : (
                          <>
                            <i className="fa fa-check-circle me-1" /> Save & Add to Order
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Summary Sidebar */}
          <div className="order-summary-box">
            <div className="summary-heading">
              <i className="fa fa-list-alt text-primary" /> Order Summary
            </div>

            <div className="summary-row">
              <span>Patient:</span>
              <strong className="text-dark">
                {selectedPatient ? (
                  <>
                    {selectedPatient.name}
                    {(selectedPatient.patientNumber || selectedPatient.patientId) && (
                      <span className="text-muted ms-1" style={{ fontSize: "11px", fontWeight: "normal" }}>
                        ({selectedPatient.patientNumber || selectedPatient.patientId})
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted fst-italic">Not selected</span>
                )}
              </strong>
            </div>

            <div className="summary-row">
              <span>Catalog Medicines:</span>
              <strong className="text-dark">{keyedInMedicines.length} items</strong>
            </div>

            <div className="summary-row">
              <span>Prescriptions / Photos:</span>
              <strong className="text-dark">{prescribedItems.length} items</strong>
            </div>

            <div className="summary-row">
              <span>Written Medicines:</span>
              <strong className="text-dark">{writtenMedicines.length} items</strong>
            </div>

            <div className="summary-row total">
              <span>Total Items:</span>
              <span className="total-val" style={{ color: "#0ba6df" }}>{totals.totalItems}</span>
            </div>

            <div className="summary-address-preview">
              <div className="text-muted fw-bold mb-1" style={{ fontSize: "11px" }}>
                DELIVERY DESTINATION:
              </div>
              <div className="fw-semibold text-dark">
                {deliveryDestinationText}
              </div>
            </div>

            <button
              type="button"
              className="btn-place-order-main"
              disabled={isPlacingOrder || totals.totalItems === 0 || !selectedPatientId}
              onClick={handlePlaceOrder}
              title={!selectedPatientId ? "Please select a patient / customer first" : "Place Order"}
            >
              {isPlacingOrder ? (
                <>
                  <span className="spinner-border spinner-border-sm" /> Placing Order...
                </>
              ) : (
                <>
                  <i className="fa fa-check" /> Place Order
                </>
              )}
            </button>
          </div>
        </div>

        {/* ADD DELIVERY ADDRESS MODAL */}
        {showAddAddressModal && (
          <div className="crm-modal-backdrop" onClick={() => setShowAddAddressModal(false)}>
            <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="crm-modal-header">
                <h5>
                  <i className="fa fa-map-marker text-primary" /> Add New Delivery Address
                </h5>
                <button
                  type="button"
                  className="crm-modal-close-btn"
                  onClick={() => setShowAddAddressModal(false)}
                >
                  <i className="fa fa-times" />
                </button>
              </div>

              <div className="crm-modal-body">
                <div className="mb-3">
                  <label className="patient-input-label">
                    <span>
                      Select Delivery Address / Location <span className="text-danger fw-bold">*</span>
                    </span>
                  </label>
                  <select
                    className="patient-select-ctrl"
                    value={modalAddressType}
                    onChange={(e) => setModalAddressType(e.target.value)}
                  >
                    <option value="OMCA_GH_51">OMCA Guest House 51</option>
                    <option value="OMCA_GH_52">OMCA Guest House 52</option>
                    <option value="OMCA_GH_DWARKA">OMCA Guest House Dwarka</option>
                    <option value="OTHER">Other (Custom Address)</option>
                    <option value="OMCA_OFFICE">OMCA Office Mauritius</option>
                  </select>
                </div>

                {/* If Guest House selected, show Room Number text field */}
                {["OMCA_GH_51", "OMCA_GH_52", "OMCA_GH_DWARKA"].includes(modalAddressType) && (
                  <div className="mb-3">
                    <label className="patient-input-label">
                      <span>
                        <i className="fa fa-bed text-primary me-1" />
                        Room Number <span className="text-danger fw-bold">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      className="patient-select-ctrl"
                      placeholder="Enter room number (e.g. 104)..."
                      value={modalRoomNumber}
                      onChange={(e) => setModalRoomNumber(e.target.value)}
                      autoFocus
                    />
                    <div className="address-info-callout">
                      <i className="fa fa-info-circle mt-0.5" />
                      <div>
                        Location: <strong>{FIXED_ADDRESSES.find((f) => f.key === modalAddressType)?.label}</strong>
                        <div className="text-muted small">
                          {FIXED_ADDRESSES.find((f) => f.key === modalAddressType)?.defaultCity},{" "}
                          {FIXED_ADDRESSES.find((f) => f.key === modalAddressType)?.defaultCountry}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* If OMCA Office Mauritius selected, show address details */}
                {modalAddressType === "OMCA_OFFICE" && (
                  <div className="address-info-callout mb-3">
                    <i className="fa fa-building-o text-success mt-0.5" />
                    <div>
                      <strong>OMCA Office Mauritius</strong>
                      <div className="text-muted small">Route Royale, Curepipe, Plaines Wilhems, Mauritius</div>
                    </div>
                  </div>
                )}

                {/* If Other selected, show option to add / enter address */}
                {modalAddressType === "OTHER" && (
                  <div className="mb-3">
                    <label className="patient-input-label">
                      <span>
                        <i className="fa fa-pencil text-primary me-1" />
                        Enter Address <span className="text-danger fw-bold">*</span>
                      </span>
                    </label>
                    <textarea
                      rows="3"
                      className="patient-select-ctrl"
                      style={{ height: "auto", padding: "10px" }}
                      placeholder="Enter full delivery address (e.g. Flat 302, Green Valley Apartments, Dwarka)..."
                      value={modalOtherAddress}
                      onChange={(e) => setModalOtherAddress(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="crm-modal-footer">
                <button
                  type="button"
                  className="btn-crm-sm outline"
                  onClick={() => setShowAddAddressModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-crm-sm primary"
                  onClick={handleSaveModalAddress}
                >
                  <i className="fa fa-check me-1" /> Use Address
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
