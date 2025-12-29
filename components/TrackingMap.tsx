
import React, { useEffect, useRef } from 'react';
import { Address } from '../types';

// Declare Leaflet global
declare const L: any;

interface TrackingMapProps {
  pickupLocation: Address;
  donorName: string;
  dropoffLocation?: Address;
  orphanageName?: string;
  volunteerLocation?: { lat: number; lng: number };
  volunteerName?: string;
}

const TrackingMap: React.FC<TrackingMapProps> = ({ 
  pickupLocation, 
  donorName,
  dropoffLocation, 
  orphanageName,
  volunteerLocation,
  volunteerName 
}) => {
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

    const getPickupPopup = () => `
      <div class="p-1">
        <strong class="text-emerald-600">Pickup Point</strong><br/>
        <span class="text-xs"><b>Donor:</b> ${donorName}</span><br/>
        <span class="text-xs"><b>Addr:</b> ${pickupLocation.line1}</span>
      </div>
    `;

    const getDropoffPopup = () => `
      <div class="p-1">
        <strong class="text-blue-600">Drop-off Point</strong><br/>
        <span class="text-xs"><b>Org:</b> ${orphanageName || 'Recipient'}</span><br/>
        <span class="text-xs"><b>Addr:</b> ${dropoffLocation?.line1}</span>
      </div>
    `;

    const getVolunteerPopup = () => `
      <div class="p-1 text-center">
        <strong class="text-amber-600">Volunteer Delivery</strong><br/>
        <span class="text-xs"><b>Driver:</b> ${volunteerName || 'On the way'}</span><br/>
        <div class="mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">LIVE TRACKING</div>
      </div>
    `;

    // Update Pickup Marker
    if (pickupLocation.lat && pickupLocation.lng) {
      if (!markersRef.current.pickup) {
        markersRef.current.pickup = L.marker([pickupLocation.lat, pickupLocation.lng], {
          icon: createEmojiIcon('📦', 'bg-emerald-500 text-white')
        }).addTo(map).bindPopup(getPickupPopup());
      } else {
        markersRef.current.pickup.setLatLng([pickupLocation.lat, pickupLocation.lng]);
        markersRef.current.pickup.setPopupContent(getPickupPopup());
      }
    }

    // Update Dropoff Marker
    if (dropoffLocation?.lat && dropoffLocation?.lng) {
      if (!markersRef.current.dropoff) {
        markersRef.current.dropoff = L.marker([dropoffLocation.lat, dropoffLocation.lng], {
          icon: createEmojiIcon('🏁', 'bg-blue-600 text-white')
        }).addTo(map).bindPopup(getDropoffPopup());
      } else {
        markersRef.current.dropoff.setLatLng([dropoffLocation.lat, dropoffLocation.lng]);
        markersRef.current.dropoff.setPopupContent(getDropoffPopup());
      }
    }

    // Update Volunteer Marker
    if (volunteerLocation) {
      if (!markersRef.current.volunteer) {
        markersRef.current.volunteer = L.marker([volunteerLocation.lat, volunteerLocation.lng], {
          icon: createEmojiIcon('🚚', 'bg-amber-500 text-white animate-bounce') 
        }).addTo(map).bindPopup(getVolunteerPopup());
      } else {
        markersRef.current.volunteer.setLatLng([volunteerLocation.lat, volunteerLocation.lng]);
        markersRef.current.volunteer.setPopupContent(getVolunteerPopup());
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

  }, [pickupLocation, donorName, dropoffLocation, orphanageName, volunteerLocation, volunteerName]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-xl z-0" />;
};

export default TrackingMap;
