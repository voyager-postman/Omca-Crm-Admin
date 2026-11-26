import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Video from "twilio-video";
import { toast } from "react-toastify";
import {
  endCall,
  toggleCallMedia,
  onCallMediaToggled,
  onCallParticipantJoined,
  onCallParticipantLeft,
} from "../../../services/callSocket";
import { fetchCallToken } from "../../../services/callApi";
import { fetchChatUsers, fetchChatList, fetchChatMessages } from "../../../services/chatApi";
import { resolveCrmImageUrl } from "../../../Basurl/Baseurl";
import { getUserId } from "../../../utils/authStorage";
import "./CallModal.css";

const getCanonicalUserId = (identity) => {
  if (!identity) return "";
  let id = String(identity).trim();
  // Strip twilio/socket prefixes like mongo_ or mysql_
  id = id.replace(/^(mysql_|mongo_)/i, "");
  // Strip socket/tab/session suffix after #, @, or :
  id = id.split("#")[0].split("@")[0].split(":")[0].trim();
  return id;
};

const getInitials = (name = "") => {
  if (!name) return "M";
  const clean = String(name)
    .replace(/^(mysql_|mongo_)/i, "")
    .split("#")[0]
    .split("@")[0]
    .split(":")[0]
    .trim();
  // Guard against raw hex ObjectId or strings starting with mongo_ or User mongo_
  if (
    /^[0-9a-fA-F]{24}$/.test(clean) ||
    clean.startsWith("User mongo_") ||
    clean.startsWith("mongo_")
  ) {
    return "M";
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  if (parts.length === 1) {
    if (parts[0].length > 10) return "M";
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

/**
 * Robust video track creation with responsive fallback for mobile portrait/landscape & desktop
 */
const createSafeVideoTrack = async () => {
  try {
    return await Video.createLocalVideoTrack({
      facingMode: "user",
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
    });
  } catch (err1) {
    try {
      return await Video.createLocalVideoTrack({
        facingMode: "user",
      });
    } catch (err2) {
      return await Video.createLocalVideoTrack();
    }
  }
};

/**
 * Robust audio track creation with fallback
 */
const createSafeAudioTrack = async () => {
  return await Video.createLocalAudioTrack();
};

/**
 * Single Participant Video/Audio Tile
 */
const ParticipantTile = ({
  participant,
  name,
  role,
  image,
  isLocal = false,
  peerMedia = { audio: true, video: true },
}) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [videoTrack, setVideoTrack] = useState(null);
  const [audioTrack, setAudioTrack] = useState(null);
  const [trackVideoEnabled, setTrackVideoEnabled] = useState(true);
  const [trackAudioEnabled, setTrackAudioEnabled] = useState(true);

  const hasVideo =
    !!videoTrack &&
    peerMedia.video !== false &&
    trackVideoEnabled;
  const isMuted = peerMedia.audio === false || !trackAudioEnabled;
  const avatarUrl = resolveCrmImageUrl(image);

  useEffect(() => {
    if (!participant) return;

    let cleanupVideo = null;
    let cleanupAudio = null;

    const setupTrack = (track) => {
      if (!track) return;
      if (track.kind === "video") {
        setVideoTrack(track);
        setTrackVideoEnabled(track.isEnabled !== false);
        const onDis = () => setTrackVideoEnabled(false);
        const onEn = () => setTrackVideoEnabled(true);
        track.on("disabled", onDis);
        track.on("enabled", onEn);
        cleanupVideo = () => {
          track.off("disabled", onDis);
          track.off("enabled", onEn);
        };
      } else if (track.kind === "audio") {
        setAudioTrack(track);
        setTrackAudioEnabled(track.isEnabled !== false);
        const onDis = () => setTrackAudioEnabled(false);
        const onEn = () => setTrackAudioEnabled(true);
        track.on("disabled", onDis);
        track.on("enabled", onEn);
        cleanupAudio = () => {
          track.off("disabled", onDis);
          track.off("enabled", onEn);
        };
      }
    };

    // Re-check existing tracks on mount and on media state changes
    const checkTracks = () => {
      const vPubs = participant.videoTracks ? Array.from(participant.videoTracks.values()) : [];
      const aPubs = participant.audioTracks ? Array.from(participant.audioTracks.values()) : [];
      const allPubs = participant.tracks ? Array.from(participant.tracks.values()) : [...vPubs, ...aPubs];

      allPubs.forEach((pub) => {
        if (pub?.track) setupTrack(pub.track);
      });
    };

    checkTracks();

    const trackSubscribed = (track) => setupTrack(track);
    const trackUnsubscribed = (track) => {
      if (track.kind === "video") {
        setVideoTrack(null);
        if (cleanupVideo) cleanupVideo();
      }
      if (track.kind === "audio") {
        setAudioTrack(null);
        if (cleanupAudio) cleanupAudio();
      }
    };
    const trackPublished = (pub) => {
      if (pub?.track) setupTrack(pub.track);
      if (pub?.on) pub.on("subscribed", setupTrack);
    };
    const trackUnpublished = (pub) => {
      if (pub?.kind === "video" || pub?.track?.kind === "video") {
        setVideoTrack(null);
        if (cleanupVideo) cleanupVideo();
      }
      if (pub?.kind === "audio" || pub?.track?.kind === "audio") {
        setAudioTrack(null);
        if (cleanupAudio) cleanupAudio();
      }
    };

    if (participant.on) {
      participant.on("trackSubscribed", trackSubscribed);
      participant.on("trackUnsubscribed", trackUnsubscribed);
      participant.on("trackPublished", trackPublished);
      participant.on("trackUnpublished", trackUnpublished);
    }

    return () => {
      if (cleanupVideo) cleanupVideo();
      if (cleanupAudio) cleanupAudio();
      if (participant.off) {
        participant.off("trackSubscribed", trackSubscribed);
        participant.off("trackUnsubscribed", trackUnsubscribed);
        participant.off("trackPublished", trackPublished);
        participant.off("trackUnpublished", trackUnpublished);
      }
    };
  }, [participant, peerMedia.video, peerMedia.audio]);

  // Attach video track to DOM element and play
  useEffect(() => {
    const el = videoRef.current;
    if (videoTrack && el && hasVideo) {
      try {
        videoTrack.attach(el);
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } catch (err) {
        console.warn("Video attach error:", err);
      }
      return () => {
        try {
          videoTrack.detach(el);
        } catch (_) {}
      };
    }
  }, [videoTrack, hasVideo]);

  // Attach audio track (only for remote participants)
  useEffect(() => {
    const el = audioRef.current;
    if (audioTrack && el && !isLocal) {
      try {
        audioTrack.attach(el);
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("Audio play prevented:", err);
          });
        }
      } catch (err) {
        console.warn("Could not attach audio track (no audio driver/output):", err);
      }
      return () => {
        try {
          audioTrack.detach(el);
        } catch (_) {}
      };
    }
  }, [audioTrack, isLocal]);

  return (
    <div className={`omca-video-tile ${isLocal ? "omca-local-tile" : ""}`}>
      {/* Remote Audio element */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted={true}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: hasVideo ? "block" : "none",
        }}
      />

      {/* Fallback Avatar view when camera is off */}
      {!hasVideo && (
        <div className="omca-tile-avatar-view">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="omca-tile-avatar" />
          ) : (
            <div className="omca-tile-avatar">{getInitials(name)}</div>
          )}
          <span className="text-white fw-bold">{name}</span>
        </div>
      )}

      {/* Status icons: muted microphone indicator */}
      <div className="omca-tile-status-icons">
        {isMuted && (
          <div className="omca-status-pill is-muted" title="Microphone Muted">
            <i className="fa fa-microphone-slash" />
          </div>
        )}
      </div>

      {/* Name & Role badge */}
      <div className="omca-tile-info-badge">
        <span>{isLocal ? `${name} (You)` : name}</span>
        {role && <small className="opacity-75">• {role}</small>}
      </div>
    </div>
  );
};

/**
 * Main Active Call Modal
 */
const ActiveCallModal = ({
  callData, // { callId, roomName, token, callType, isGroup, groupName, otherUser, isHost }
  currentUserName = "Me",
  currentUserRole = "Staff",
  currentUserImage = null,
  onClose,
}) => {
  const [room, setRoom] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [connecting, setConnecting] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callData?.callType === "audio");
  const [isMinimized, setIsMinimized] = useState(false);
  const [peerMediaMap, setPeerMediaMap] = useState({});
  const [participantInfoMap, setParticipantInfoMap] = useState({});
  const [callDuration, setCallDuration] = useState(0);
  const [showEndDropdown, setShowEndDropdown] = useState(false);

  const roomRef = useRef(null);
  const isMountedRef = useRef(true);
  const connectingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const timerRef = useRef(null);
  const togglingAudioRef = useRef(false);
  const togglingVideoRef = useRef(false);

  const { callId, roomName, token, callType, isGroup, groupName, otherUser, isHost } =
    callData || {};
  const isVideoCall = callType === "video";

  // 1. Establish Twilio Room Connection with StrictMode & Disconnect Safety
  useEffect(() => {
    isMountedRef.current = true;

    if (!token && !roomName) {
      toast.error("Call connection details are missing.");
      onCloseRef.current();
      return;
    }

    // Prevent duplicate execution (Section 9 of Integration Guide)
    if (roomRef.current || connectingRef.current) {
      console.warn("Already connected or connecting to room, skipping duplicate connect");
      return;
    }

    connectingRef.current = true;
    setConnecting(true);

    const connectToRoom = async () => {
      let activeToken = token;

      // Fallback: If token is missing, fetch from POST /api/call/token
      if (!activeToken && roomName) {
        try {
          const fresh = await fetchCallToken({ userId: getUserId(), roomName });
          activeToken = fresh?.token;
        } catch (_) {}
      }

      if (!activeToken) {
        toast.error("Unable to obtain Twilio call token.");
        connectingRef.current = false;
        if (isMountedRef.current) onCloseRef.current();
        return;
      }

      try {
        // 1. Acquire local tracks safely BEFORE connecting to Twilio.
        // This ensures Twilio does not abort the signaling room due to missing audio/video hardware (preventing Error 53118 Room Completed).
        const localTracks = [];
        let hasCamera = false;
        let hasMic = false;

        if (isVideoCall) {
          try {
            const vTrack = await createSafeVideoTrack();
            localTracks.push(vTrack);
            hasCamera = true;
          } catch (camErr) {
            console.warn("Camera not available or access denied:", camErr?.message || camErr);
            setIsVideoDisabled(true);
          }
        }

        try {
          const aTrack = await createSafeAudioTrack();
          localTracks.push(aTrack);
          hasMic = true;
        } catch (micErr) {
          console.warn("Microphone not available or access denied:", micErr?.message || micErr);
          setIsAudioMuted(true);
        }

        if (isVideoCall && !hasCamera) {
          const toastId = "call-no-camera";
          if (!toast.isActive(toastId)) {
            toast.warn("Camera not detected or permission denied. Joined with video off.", { toastId, autoClose: 3500 });
          }
        }
        if (!hasMic) {
          const toastId = "call-no-mic";
          if (!toast.isActive(toastId)) {
            toast.warn("Microphone not detected or permission denied. Joined with audio muted.", { toastId, autoClose: 3500 });
          }
        }

        // 2. Connect to the Twilio room with whatever tracks were successfully acquired (or empty array if no hardware)
        const joinedRoom = await Video.connect(activeToken, {
          name: roomName,
          tracks: localTracks,
        });

        if (!isMountedRef.current) {
          joinedRoom.disconnect();
          return;
        }

        roomRef.current = joinedRoom;
        setRoom(joinedRoom);
        setConnecting(false);

        // Existing participants (deduplicated by canonical user ID)
        const initialParticipants = Array.from(joinedRoom.participants.values());
        const myCanonicalId = getCanonicalUserId(
          getUserId() || localStorage.getItem("id") || localStorage.getItem("userId")
        );
        const dedupedInitial = [];
        const seenIdentities = new Set();
        for (let i = initialParticipants.length - 1; i >= 0; i--) {
          const item = initialParticipants[i];
          const cleanId = getCanonicalUserId(item.identity || item.sid);
          if (cleanId && myCanonicalId && cleanId === myCanonicalId) continue;
          if (cleanId) {
            if (!seenIdentities.has(cleanId)) {
              seenIdentities.add(cleanId);
              dedupedInitial.unshift(item);
            }
          } else {
            dedupedInitial.unshift(item);
          }
        }
        setRemoteParticipants(dedupedInitial);

        joinedRoom.on("participantConnected", (p) => {
          const pId = p.identity || "";
          const cleanId = getCanonicalUserId(pId);
          const myId = getCanonicalUserId(
            getUserId() || localStorage.getItem("id") || localStorage.getItem("userId")
          );
          if (cleanId && myId && cleanId === myId) {
            return; // Skip if local user connected from another tab
          }
          setRemoteParticipants((prev) => {
            return [
              ...prev.filter((item) => {
                if (item.sid === p.sid) return false;
                if (cleanId) {
                  const itemCleanId = getCanonicalUserId(item.identity || item.sid);
                  if (itemCleanId === cleanId) return false;
                }
                return true;
              }),
              p,
            ];
          });
          const knownName =
            participantInfoMap[cleanId]?.name ||
            (typeof window !== "undefined" && window.__omca_user_map && window.__omca_user_map[cleanId]?.name);
          const displayName =
            knownName && !knownName.startsWith("mongo_") && !knownName.startsWith("mysql_")
              ? knownName
              : (!isGroup && otherUser?.name)
              ? otherUser.name
              : "A participant";
          const toastId = `call-joined-${cleanId || p.sid}`;
          if (!toast.isActive(toastId)) {
            toast.info(`${displayName} joined`, { toastId, autoClose: 3000 });
          }
        });

        joinedRoom.on("participantDisconnected", (p) => {
          setRemoteParticipants((prev) => prev.filter((item) => item.sid !== p.sid));
          const cleanId = getCanonicalUserId(p.identity || p.sid);
          const knownName =
            participantInfoMap[cleanId]?.name ||
            (typeof window !== "undefined" && window.__omca_user_map && window.__omca_user_map[cleanId]?.name);
          const displayName =
            knownName && !knownName.startsWith("mongo_") && !knownName.startsWith("mysql_")
              ? knownName
              : (!isGroup && otherUser?.name)
              ? otherUser.name
              : "A participant";
          const toastId = `call-left-${cleanId || p.sid}`;
          if (!toast.isActive(toastId)) {
            toast.info(`${displayName} left`, { toastId, autoClose: 3000 });
          }
        });

        joinedRoom.on("disconnected", (r, error) => {
          console.log("Twilio room disconnected:", r?.name, error);
          roomRef.current = null;
          setRoom(null);
          connectingRef.current = false;
          if (isMountedRef.current) {
            onCloseRef.current();
          }
        });
      } catch (err) {
        console.error("Twilio room connection error:", err);
        if (err?.code === 53118) {
          const toastId = "call-room-ended";
          if (!toast.isActive(toastId)) {
            toast.info("This call room has already ended.", { toastId, autoClose: 3500 });
          }
        } else {
          const toastId = "call-connect-failed";
          if (!toast.isActive(toastId)) {
            toast.error(`Call connection failed: ${err.message || "Unknown error"}`, { toastId, autoClose: 3500 });
          }
        }
        if (isMountedRef.current) {
          onCloseRef.current();
        }
      } finally {
        connectingRef.current = false;
      }
    };

    connectToRoom();

    return () => {
      isMountedRef.current = false;
      const currentRoom = roomRef.current;
      // Delay disconnection by 1000ms so React 18 StrictMode dev mock-unmount doesn't tear down the room
      setTimeout(() => {
        if (!isMountedRef.current && currentRoom) {
          try {
            currentRoom.disconnect();
          } catch (_) {}
          if (roomRef.current === currentRoom) {
            roomRef.current = null;
          }
        }
      }, 1000);
    };
  }, [callId, token, roomName, isVideoCall]);

  // 2. Socket Listeners for Media Toggles and Group Notifications
  useEffect(() => {
    const unsubMedia = onCallMediaToggled((payload) => {
      if (!payload?.userId) return;
      const uid = String(payload.userId);
      setPeerMediaMap((prev) => ({
        ...prev,
        [uid]: {
          ...(prev[uid] || {}),
          [payload.mediaType]: payload.enabled,
        },
      }));
    });

    const unsubJoined = onCallParticipantJoined((payload) => {
      const p = payload?.participant || payload?.user || payload;
      if (p) {
        const uid = getCanonicalUserId(p.userId || p._id || p.id || p.identity || payload?.userId);
        const pName = p.name || p.fullname || p.username;
        if (
          uid &&
          pName &&
          !pName.startsWith("mongo_") &&
          !pName.startsWith("mysql_") &&
          !pName.startsWith("User mongo_")
        ) {
          setParticipantInfoMap((prev) => ({
            ...prev,
            [uid]: {
              name: pName,
              role: p.role || "Member",
              image: p.profileImage || p.image,
            },
          }));
        }
        if (
          pName &&
          !pName.startsWith("mongo_") &&
          !pName.startsWith("mysql_") &&
          !pName.startsWith("User mongo_")
        ) {
          toast.info(`${pName} joined`);
        }
      }
    });

    const unsubLeft = onCallParticipantLeft((payload) => {
      const p = payload?.participant || payload?.user || payload;
      const pName = p?.name || p?.fullname;
      if (
        pName &&
        !pName.startsWith("mongo_") &&
        !pName.startsWith("mysql_") &&
        !pName.startsWith("User mongo_")
      ) {
        toast.info(`${pName} left`);
      }
    });

    return () => {
      unsubMedia();
      unsubJoined();
      unsubLeft();
    };
  }, []);

  // Preload user directory on mount so group call participants display real names instead of raw IDs
  useEffect(() => {
    let isCancelled = false;
    const loadDirectory = async () => {
      try {
        const dir = {};

        const addEntry = (idVal, nameVal, roleVal, imgVal) => {
          const cid = getCanonicalUserId(idVal);
          if (cid && nameVal && typeof nameVal === "string") {
            const cleanName = nameVal.trim();
            if (
              cleanName &&
              !cleanName.startsWith("mongo_") &&
              !cleanName.startsWith("mysql_") &&
              !cleanName.startsWith("User mongo_") &&
              !cleanName.startsWith("User 6")
            ) {
              dir[cid] = {
                name: cleanName,
                role: roleVal || "Member",
                image: imgVal || null,
              };
            }
          }
        };

        // 1. Preload from global window cache if already present
        if (typeof window !== "undefined" && window.__omca_user_map) {
          Object.values(window.__omca_user_map).forEach((u) => {
            const possibleIds = [u.userId, u._id, u.id, u.user_id, u.patientId];
            possibleIds.forEach((idVal) => {
              addEntry(
                idVal,
                u.name || u.fullname || u.username,
                u.role,
                u.image || u.profileImage
              );
            });
          });
        }

        // 2. Preload from callData members/participants if passed
        const passedMembers =
          callData?.members ||
          callData?.participants ||
          callData?.groupMembers ||
          [];
        if (Array.isArray(passedMembers)) {
          passedMembers.forEach((m) => {
            if (m && typeof m === "object") {
              const possibleIds = [m.userId, m._id, m.id, m.user_id, m.patientId];
              possibleIds.forEach((idVal) => {
                addEntry(
                  idVal,
                  m.name || m.fullname || m.username,
                  m.role,
                  m.profileImage || m.image
                );
              });
            }
          });
        }

        // 3. Preload from specific chat messages participants if chatId is known
        if (callData?.chatId) {
          try {
            const chatRes = await fetchChatMessages(callData.chatId, { limit: 20 });
            if (!isCancelled && Array.isArray(chatRes?.participants)) {
              chatRes.participants.forEach((m) => {
                if (m && typeof m === "object") {
                  const possibleIds = [m.userId, m._id, m.id, m.user_id, m.patientId];
                  possibleIds.forEach((idVal) => {
                    addEntry(
                      idVal,
                      m.name || m.fullname || m.username,
                      m.role,
                      m.profileImage || m.image
                    );
                  });
                }
              });
            }
          } catch (_) {}
        }

        // 4. Fetch all active users from /chat/users API
        try {
          const users = await fetchChatUsers({ limit: 200 });
          if (!isCancelled && Array.isArray(users)) {
            users.forEach((u) => {
              const possibleIds = [u.userId, u._id, u.id, u.user_id, u.patientId];
              possibleIds.forEach((idVal) => {
                addEntry(
                  idVal,
                  u.name || u.fullname || u.patient_name || u.username,
                  u.role,
                  u.image || u.profileImage
                );
              });
            });
          }
        } catch (_) {}

        // 5. Fetch chat list to extract group/chat member names
        try {
          const chatList = await fetchChatList();
          if (!isCancelled && Array.isArray(chatList)) {
            chatList.forEach((c) => {
              if (c.otherUser) {
                const ou = c.otherUser;
                const possibleIds = [ou.userId, ou._id, ou.id, ou.user_id];
                possibleIds.forEach((idVal) => {
                  addEntry(
                    idVal,
                    ou.name || ou.fullname,
                    ou.role,
                    ou.profileImage || ou.image
                  );
                });
              }
              const groupMembers =
                c.members || c.participants || c.groupMembers || c.users || [];
              if (Array.isArray(groupMembers)) {
                groupMembers.forEach((m) => {
                  if (m && typeof m === "object") {
                    const possibleIds = [m.userId, m._id, m.id, m.user_id];
                    possibleIds.forEach((idVal) => {
                      addEntry(
                        idVal,
                        m.name || m.fullname,
                        m.role,
                        m.image || m.profileImage
                      );
                    });
                  }
                });
              }
            });
          }
        } catch (_) {}

        if (!isCancelled && Object.keys(dir).length > 0) {
          setParticipantInfoMap((prev) => ({ ...dir, ...prev }));
        }
      } catch (err) {
        console.warn("Could not preload user directory for call:", err);
      }
    };

    loadDirectory();
    return () => {
      isCancelled = true;
    };
  }, [callData]);

  // 3. Call Duration Timer & Unload Safety
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callId) {
        endCall(callId);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callId]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [callDuration]);

  // 4. Rock-Solid Toggle Audio (Mute / Unmute) with mobile hardware resuscitation
  const handleToggleAudio = async () => {
    if (togglingAudioRef.current) return;
    togglingAudioRef.current = true;

    const activeRoom = roomRef.current || room;
    if (!activeRoom) {
      togglingAudioRef.current = false;
      return;
    }
    const newMutedState = !isAudioMuted;

    try {
      const audioPubs = activeRoom.localParticipant?.audioTracks
        ? Array.from(activeRoom.localParticipant.audioTracks.values())
        : [];

      if (newMutedState) {
        // Mute: disable audio tracks
        audioPubs.forEach((pub) => {
          if (pub?.track) {
            try {
              pub.track.disable();
            } catch (_) {}
          }
        });
      } else {
        // Unmute: check if we have an alive track, or clean up dead track & create a fresh one on mobile
        let hasLiveTrack = false;
        for (const pub of audioPubs) {
          const track = pub?.track;
          const msTrack = track?.mediaStreamTrack;
          const isDead = !track || track.isStopped || (msTrack && msTrack.readyState === "ended");

          if (!isDead && track) {
            try {
              track.enable();
              hasLiveTrack = true;
            } catch (_) {}
          } else if (pub?.track) {
            // Track was killed or ended on mobile -> unpublish & stop
            try {
              activeRoom.localParticipant.unpublishTrack(pub.track);
              pub.track.stop();
            } catch (_) {}
          }
        }

        if (!hasLiveTrack) {
          const freshTrack = await createSafeAudioTrack();
          if (freshTrack) {
            await activeRoom.localParticipant.publishTrack(freshTrack);
          }
        }
      }

      setIsAudioMuted(newMutedState);

      // Notify other participant to toggle muted badge on their screen
      if (callId) {
        toggleCallMedia(callId, "audio", !newMutedState);
      }
    } catch (err) {
      console.error("Audio toggle error:", err);
      toast.error("Microphone error: " + (err.message || "Permission denied"));
    } finally {
      togglingAudioRef.current = false;
    }
  };

  // 5. Rock-Solid Toggle Video (Camera On / Off) with mobile orientation & constraint fallbacks
  const handleToggleVideo = async () => {
    if (togglingVideoRef.current) return;
    togglingVideoRef.current = true;

    const activeRoom = roomRef.current || room;
    if (!activeRoom) {
      togglingVideoRef.current = false;
      return;
    }
    const newDisabledState = !isVideoDisabled;

    try {
      const videoPubs = activeRoom.localParticipant?.videoTracks
        ? Array.from(activeRoom.localParticipant.videoTracks.values())
        : [];

      if (newDisabledState) {
        // Disabling Camera: blank/disable video tracks
        videoPubs.forEach((pub) => {
          if (pub?.track) {
            try {
              pub.track.disable();
            } catch (_) {}
          }
        });
      } else {
        // Enabling Camera: check if an alive track exists, or create a fresh mobile-compatible one
        let hasLiveTrack = false;
        for (const pub of videoPubs) {
          const track = pub?.track;
          const msTrack = track?.mediaStreamTrack;
          const isDead = !track || track.isStopped || (msTrack && msTrack.readyState === "ended");

          if (!isDead && track) {
            try {
              track.enable();
              hasLiveTrack = true;
            } catch (_) {}
          } else if (pub?.track) {
            // Dead track on mobile -> clean it up
            try {
              activeRoom.localParticipant.unpublishTrack(pub.track);
              pub.track.stop();
            } catch (_) {}
          }
        }

        if (!hasLiveTrack) {
          const freshTrack = await createSafeVideoTrack();
          if (freshTrack) {
            await activeRoom.localParticipant.publishTrack(freshTrack);
          }
        }
      }

      setIsVideoDisabled(newDisabledState);

      // Notify other participant
      if (callId) {
        toggleCallMedia(callId, "video", !newDisabledState);
      }
    } catch (err) {
      console.error("Video toggle error:", err);
      const isHttp = typeof window !== "undefined" && window.location.protocol === "http:";
      const isLocalNetwork =
        typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (isHttp && isLocalNetwork) {
        toast.error(
          "Camera blocked by Chrome HTTP security. On mobile/remote device, enable 'unsafely-treat-insecure-origin-as-secure' in chrome://flags for this URL."
        );
      } else {
        toast.error("Camera error: " + (err.message || "Check camera permissions or Chrome flags"));
      }
    } finally {
      togglingVideoRef.current = false;
    }
  };

  // 6. Explicit User End Call Action
  const handleEndCall = (endForAll = false) => {
    isMountedRef.current = false;
    endCall(callId, endForAll);
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (_) {}
      roomRef.current = null;
    }
    onCloseRef.current();
  };

  // Deduplicate remote participants so multiple tabs/reconnects don't show duplicate tiles
  const uniqueRemoteParticipants = useMemo(() => {
    if (!remoteParticipants || remoteParticipants.length === 0) return [];
    if (!isGroup) {
      // In a 1-on-1 direct call, there can only ever be 1 remote participant
      return [remoteParticipants[remoteParticipants.length - 1]];
    }
    const myCanonicalId = getCanonicalUserId(
      getUserId() || localStorage.getItem("id") || localStorage.getItem("userId")
    );
    const map = new Map();
    remoteParticipants.forEach((p) => {
      const pIdentity = p.identity || p.sid;
      const cleanId = getCanonicalUserId(pIdentity);
      // Skip if it matches local user
      if (cleanId && myCanonicalId && cleanId === myCanonicalId) return;

      const key = cleanId || p.sid;
      const existing = map.get(key);
      if (existing) {
        // Keep the one that has active tracks or newer connection
        const vTracks = p.videoTracks ? Array.from(p.videoTracks.values()) : [];
        const aTracks = p.audioTracks ? Array.from(p.audioTracks.values()) : [];
        const hasTracks = [...vTracks, ...aTracks].some((pub) => pub?.track);
        if (hasTracks) {
          map.set(key, p);
        }
      } else {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [remoteParticipants, isGroup]);

  // Resolve clean name, role, and image for participants in group/direct calls
  const resolveParticipantDetails = useCallback(
    (p, index = 0) => {
      const cleanId = getCanonicalUserId(p.identity || p.sid);

      // 1. Direct 1-on-1 call
      if (!isGroup && otherUser?.name) {
        return {
          name: otherUser.name,
          role: otherUser.role || "Member",
          image: otherUser.profileImage || otherUser.image,
        };
      }

      // 2. Info from participantInfoMap (preloaded via fetchChatUsers/fetchChatList/socket/history)
      if (cleanId && participantInfoMap[cleanId]?.name) {
        const candidate = participantInfoMap[cleanId];
        if (
          !candidate.name.startsWith("mongo_") &&
          !candidate.name.startsWith("mysql_") &&
          !candidate.name.startsWith("User mongo_")
        ) {
          return candidate;
        }
      }

      // 3. Info from callData members/participants
      const memberList =
        callData?.members ||
        callData?.participants ||
        callData?.groupMembers ||
        [];
      if (Array.isArray(memberList) && cleanId) {
        const found = memberList.find((m) => {
          const mId = getCanonicalUserId(m.userId || m._id || m.id || m.user_id);
          return mId === cleanId;
        });
        if (found) {
          const foundName = found.name || found.fullname || found.username;
          if (
            foundName &&
            !foundName.startsWith("mongo_") &&
            !foundName.startsWith("mysql_") &&
            !foundName.startsWith("User mongo_")
          ) {
            return {
              name: foundName,
              role: found.role || "Member",
              image: found.profileImage || found.image,
            };
          }
        }
      }

      // 4. Info from global user cache
      if (typeof window !== "undefined" && window.__omca_user_map && cleanId) {
        const u =
          window.__omca_user_map[cleanId] ||
          Object.values(window.__omca_user_map).find((item) => {
            const mId = getCanonicalUserId(item.userId || item._id || item.id || item.user_id);
            return mId === cleanId;
          });
        if (u) {
          const uName = u.name || u.fullname || u.username;
          if (
            uName &&
            !uName.startsWith("mongo_") &&
            !uName.startsWith("mysql_") &&
            !uName.startsWith("User mongo_")
          ) {
            return {
              name: uName,
              role: u.role || "Member",
              image: u.image || u.profileImage,
            };
          }
        }
      }

      // 5. If otherUser matches this cleanId
      const otherCleanId = getCanonicalUserId(
        otherUser?.id || otherUser?._id || otherUser?.userId
      );
      if (cleanId && otherCleanId === cleanId && otherUser?.name) {
        return {
          name: otherUser.name,
          role: otherUser.role || "Member",
          image: otherUser.profileImage || otherUser.image,
        };
      }

      // 6. Graceful clean fallback: NEVER show raw ID string (e.g. mongo_6735c05... or 6735c05...)
      return {
        name: `Member ${index + 1}`,
        role: "Member",
        image: null,
      };
    },
    [isGroup, otherUser, participantInfoMap, callData]
  );

  // Grid class based on count
  const totalCount = uniqueRemoteParticipants.length + 1; // remote + local
  const gridClass =
    totalCount === 1
      ? "grid-1"
      : totalCount === 2
      ? "grid-2"
      : totalCount <= 4
      ? "grid-4"
      : "grid-6";

  const callTitle = isGroup
    ? groupName || "Group Call"
    : otherUser?.name || "Direct Call";

  return (
    <div className={`omca-call-overlay-backdrop ${isMinimized ? "p-0" : ""}`}>
      <div
        className={`omca-active-call-modal ${isMinimized ? "is-minimized" : ""}`}
      >
        {/* Top Header */}
        <div className="omca-active-call-header">
          <div className="omca-active-call-header-info">
            <span className="omca-active-call-title">{callTitle}</span>
            <div className="omca-active-call-timer">{formattedTimer}</div>
            {isGroup && (
              <span className="badge bg-secondary ms-2">
                {uniqueRemoteParticipants.length + 1} In Call
              </span>
            )}
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-light py-1 px-2"
              onClick={() => setIsMinimized((prev) => !prev)}
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              <i className={`fa ${isMinimized ? "fa-expand" : "fa-compress"}`} />
            </button>
          </div>
        </div>

        {/* Video Stage Grid */}
        <div className="omca-active-call-stage">
          {connecting ? (
            <div className="text-center text-white">
              <div className="spinner-border text-info mb-2" role="status" />
              <div>Connecting to Twilio secure room…</div>
            </div>
          ) : (
            <div className={`omca-video-grid ${gridClass}`}>
              {/* Local Participant Tile */}
              {(roomRef.current || room) && (
                <ParticipantTile
                  participant={(roomRef.current || room).localParticipant}
                  name={currentUserName}
                  role={currentUserRole}
                  image={currentUserImage}
                  isLocal={true}
                  peerMedia={{
                    audio: !isAudioMuted,
                    video: !isVideoDisabled,
                  }}
                />
              )}

              {/* Remote Participants */}
              {uniqueRemoteParticipants.map((p, pIndex) => {
                const pIdentity = p.identity || "";
                const cleanId = getCanonicalUserId(pIdentity);
                const peerId = getCanonicalUserId(
                  otherUser?.id ||
                  otherUser?._id ||
                  otherUser?.userId ||
                  otherUser?.participantId ||
                  ""
                );
                const mediaStatus =
                  peerMediaMap[cleanId] ||
                  peerMediaMap[pIdentity] ||
                  (peerId && peerMediaMap[peerId]) ||
                  peerMediaMap[p.sid] || {
                    audio: true,
                    video: true,
                  };
                const { name, role, image } = resolveParticipantDetails(p, pIndex);

                return (
                  <ParticipantTile
                    key={cleanId || p.sid}
                    participant={p}
                    name={name}
                    role={role}
                    image={image}
                    isLocal={false}
                    peerMedia={mediaStatus}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="omca-active-call-controls">
          {/* Mic Toggle */}
          <button
            type="button"
            className={`omca-control-btn ${isAudioMuted ? "is-off" : ""}`}
            onClick={handleToggleAudio}
            title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
            aria-label={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            <i className={`fa ${isAudioMuted ? "fa-microphone-slash" : "fa-microphone"}`} />
          </button>

          {/* Video Toggle */}
          <button
            type="button"
            className={`omca-control-btn ${isVideoDisabled ? "is-off" : ""}`}
            onClick={handleToggleVideo}
            title={isVideoDisabled ? "Turn Camera On" : "Turn Camera Off"}
            aria-label={isVideoDisabled ? "Turn Camera On" : "Turn Camera Off"}
          >
            <i className={`fa ${isVideoDisabled ? "fa-video-slash" : "fa-video"}`} />
          </button>

          {/* End Call Button with Group Host Dropdown */}
          {isGroup && isHost ? (
            <div className="position-relative">
              <button
                type="button"
                className="omca-control-btn btn-hangup"
                onClick={() => setShowEndDropdown((prev) => !prev)}
                title="End Call Options"
              >
                <i className="fa fa-phone" style={{ transform: "rotate(135deg)" }} />
              </button>
              {showEndDropdown && (
                <div
                  className="dropdown-menu show position-absolute"
                  style={{ bottom: "60px", left: "50%", transform: "translateX(-50%)" }}
                >
                  <button
                    type="button"
                    className="dropdown-item text-danger fw-bold"
                    onClick={() => handleEndCall(true)}
                  >
                    <i className="fa fa-times-circle me-2" /> End Call for All
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleEndCall(false)}
                  >
                    <i className="fa fa-sign-out me-2" /> Leave Call Only
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="omca-control-btn btn-hangup"
              onClick={() => handleEndCall(false)}
              title="Hang Up"
            >
              <i className="fa fa-phone" style={{ transform: "rotate(135deg)" }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveCallModal;
