"use client";

import { useEffect } from "react";

const NEXT_ALLOWED_STORAGE_KEY = "expp_session_precise_geo_next_allowed_at";
const SUCCESS_COOLDOWN_MS = 3 * 60 * 60 * 1000;
const DENIED_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const ERROR_COOLDOWN_MS = 15 * 60 * 1000;

function getNextAllowedAt(): number {
  const raw = window.localStorage.getItem(NEXT_ALLOWED_STORAGE_KEY);
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setNextAllowedAt(delayMs: number): void {
  window.localStorage.setItem(NEXT_ALLOWED_STORAGE_KEY, String(Date.now() + delayMs));
}

export default function PlatformPreciseLocationCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) return;
    if (Date.now() < getNextAllowedAt()) return;

    const sendCoordinates = async (latitude: number, longitude: number) => {
      try {
        const response = await fetch("/api/auth/session/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ latitude, longitude }),
          credentials: "same-origin",
        });

        if (!response.ok) {
          setNextAllowedAt(ERROR_COOLDOWN_MS);
          return;
        }

        setNextAllowedAt(SUCCESS_COOLDOWN_MS);
      } catch {
        setNextAllowedAt(ERROR_COOLDOWN_MS);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void sendCoordinates(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        if (error.code === 1) {
          setNextAllowedAt(DENIED_COOLDOWN_MS);
          return;
        }
        setNextAllowedAt(ERROR_COOLDOWN_MS);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      }
    );

  }, []);

  return null;
}
