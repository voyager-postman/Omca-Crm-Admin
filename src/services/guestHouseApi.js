import axios from "axios";
import { AdminBaseUrl } from "../Basurl/Baseurl";

const API_BASE = AdminBaseUrl.endsWith("/")
  ? AdminBaseUrl
  : `${AdminBaseUrl}/`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Fetch all guest houses list
 * GET https://omcacrm.com/omca/api/crm/guesthouses
 */
export const fetchGuestHouses = async () => {
  const response = await axios.get(`${API_BASE}guesthouses`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Fetch a single guest house by ID (including room list)
 * POST https://omcacrm.com/omca/api/crm/guesthouseById
 * Body: guest_house_id
 */
export const fetchGuestHouseById = async (guestHouseId) => {
  const params = new URLSearchParams();
  params.append("guest_house_id", String(guestHouseId));

  const response = await axios.post(`${API_BASE}guesthouseById`, params, {
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return response.data;
};

/**
 * Update rooms for a guest house
 * POST https://omcacrm.com/omca/api/crm/update_guesthouse_rooms
 * Payload:
 *   guest_house_id: 8
 *   rooms[0][id]: 1
 *   rooms[0][title]: Deluxe Room
 *   rooms[0][price]: 333
 *   rooms[0][availability]: 10
 */
export const updateGuestHouseRooms = async (guestHouseId, rooms = []) => {
  const params = new URLSearchParams();
  params.append("guest_house_id", String(guestHouseId));

  rooms.forEach((room, index) => {
    if (room.id !== undefined && room.id !== null) {
      params.append(`rooms[${index}][id]`, String(room.id));
    }
    params.append(`rooms[${index}][title]`, String(room.title ?? ""));
    params.append(`rooms[${index}][price]`, String(room.price ?? "0"));
    params.append(
      `rooms[${index}][availability]`,
      String(room.availability ?? "0")
    );
  });

  const response = await axios.post(
    `${API_BASE}update_guesthouse_rooms`,
    params,
    {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return response.data;
};
