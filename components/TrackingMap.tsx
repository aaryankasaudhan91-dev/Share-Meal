
import React, { useEffect, useRef } from 'react';
import { Address } from '../types';

// Declare Leaflet global
declare const L: any;

interface TrackingMapProps {
  pickupLocation: Address;
  dropoffLocation?: Address;
  volunteerLocation?: { lat: number; lng: number };
}

const TrackingMap: React.FC<TrackingMapProps> = ({ pickupLocation, dropoffLocation, volunteerLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Initialize map
      const initialLat = pickupLocation.lat || 20.5937;
      const initialLng = pickupLocation.lng || 78.9629;
      
      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }
  }, [pickupLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Helper to create emoji icons
    const createEmojiIcon = (emoji: string, bgClass: string) => L.divIcon({
      className: `flex items-center justify-center text-xl rounded-full border-2 border-white shadow-lg ${bgClass}`,
      html: emoji,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20]
    });

    // Update Pickup Marker
    if (pickupLocation.lat && pickupLocation.lng) {
      if (!markersRef.current.pickup) {
        markersRef.current.pickup = L.marker([pickupLocation.lat, pickupLocation.lng], {
          icon: createEmojiIcon('📦', 'bg-emerald-500 text-white')
        }).addTo(map).bindPopup("<b>Pickup:</b> " + pickupLocation.line1);
      } else {
        markersRef.current.pickup.setLatLng([pickupLocation.lat, pickupLocation.lng]);
      }
    }

    // Update Dropoff Marker
    if (dropoffLocation?.lat && dropoffLocation?.lng) {
      if (!markersRef.current.dropoff) {
        markersRef.current.dropoff = L.marker([dropoffLocation.lat, dropoffLocation.lng], {
          icon: createEmojiIcon('🏁', 'bg-blue-600 text-white')
        }).addTo(map).bindPopup("<b>Drop-off:</b> " + dropoffLocation.line1);
      } else {
        markersRef.current.dropoff.setLatLng([dropoffLocation.lat, dropoffLocation.lng]);
      }
    }

    // Update Volunteer Marker
    if (volunteerLocation) {
      if (!markersRef.current.volunteer) {
        markersRef.current.volunteer = L.marker([volunteerLocation.lat, volunteerLocation.lng], {
          icon: createEmojiIcon('🚚', 'bg-amber-500 text-white animate-bounce') 
        }).addTo(map).bindPopup("<b>Volunteer</b><br>On the move!");
      } else {
        markersRef.current.volunteer.setLatLng([volunteerLocation.lat, volunteerLocation.lng]);
      }
    }

    // Fit Bounds to show all markers
    const group = L.featureGroup([
      markersRef.current.pickup,
      markersRef.current.dropoff,
      markersRef.current.volunteer
    ].filter(Boolean));

    if (group.getLayers().length > 0) {
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }

  }, [pickupLocation, dropoffLocation, volunteerLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-xl z-0" />;
};

export default TrackingMap;
