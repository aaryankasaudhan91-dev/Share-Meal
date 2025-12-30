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
    const createEmojiIcon = (emoji: string, bgClass: string, isLive: boolean = false) => L.divIcon({
      className: `flex items-center justify-center text-xl rounded-full border-2 border-white shadow-lg ${bgClass} ${isLive ? 'animate-bounce-slow' : ''}`,
      html: `
        <div class="relative">
          ${emoji}
          ${isLive ? '<div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border border-white animate-pulse"></div>' : ''}
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });

    const getPickupPopup = () => `
      <div class="p-1">
        <strong class="text-emerald-600 font-black uppercase text-[10px]">Pickup Point</strong><br/>
        <span class="text-xs"><b>Donor:</b> ${donorName}</span>
      </div>
    `;

    const getDropoffPopup = () => `
      <div class="p-1">
        <strong class="text-blue-600 font-black uppercase text-[10px]">Drop-off Point</strong><br/>
        <span class="text-xs"><b>Org:</b> ${orphanageName || 'Recipient'}</span>
      </div>
    `;

    const getVolunteerPopup = () => `
      <div class="p-1 text-center">
        <strong class="text-amber-600 font-black uppercase text-[10px]">Live Delivery</strong><br/>
        <span class="text-xs font-bold">${volunteerName || 'Volunteer'}</span><br/>
        <div class="mt-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[8px] font-black uppercase tracking-widest">In Transit</div>
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
          icon: createEmojiIcon('🚚', 'bg-amber-500 text-white', true) 
        }).addTo(map).bindPopup(getVolunteerPopup());
      } else {
        markersRef.current.volunteer.setLatLng([volunteerLocation.lat, volunteerLocation.lng]);
        markersRef.current.volunteer.setPopupContent(getVolunteerPopup());
      }
    }

    // Fit Bounds periodically or when locations change
    const activeMarkers = [
      markersRef.current.pickup,
      markersRef.current.dropoff,
      markersRef.current.volunteer
    ].filter(Boolean);

    if (activeMarkers.length > 0) {
      const group = L.featureGroup(activeMarkers);
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 });
    }

  }, [pickupLocation, donorName, dropoffLocation, orphanageName, volunteerLocation, volunteerName]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-xl z-0" />;
};

export default TrackingMap;