"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

export default function SessionLocationMap({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      const mapElement = mapElementRef.current;
      if (!mapElement) return;

      const L = await import("leaflet");
      if (cancelled || !mapElementRef.current) return;

      const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";
      const center: [number, number] = hasCoordinates ? [latitude, longitude] : [20, 0];
      const zoomLevel = hasCoordinates ? 4 : 1;

      const map = L.map(mapElement, {
        zoomControl: true,
        scrollWheelZoom: false,
      });

      map.setView(center, zoomLevel);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      if (hasCoordinates) {
        L.circleMarker([latitude, longitude], {
          radius: 12,
          color: "#f97316",
          fillColor: "#f97316",
          fillOpacity: 0.92,
          weight: 2,
        }).addTo(map);
      }

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 0);
    }

    mountMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude]);

  return <div ref={mapElementRef} className="h-[420px] w-full overflow-hidden rounded-[10px]" />;
}
