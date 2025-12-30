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
  isPickedUp?: boolean;
}

const TrackingMap: React.FC<TrackingMapProps> = ({ 
  pickupLocation, 
  donorName,
  dropoffLocation, 
  orphanageName,
  volunteerLocation,
  volunteerName,
  isPickedUp
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const routeLineRef = useRef<any>(null);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    // Recenter based on active points
    const points: [number, number][] = [];
    if (pickupLocation.lat && pickupLocation.lng) points.push([pickupLocation.lat, pickupLocation.lng]);
    if (dropoffLocation?.lat && dropoffLocation?.lng) points.push([dropoffLocation.lat, dropoffLocation.lng]);
    if (volunteerLocation) points.push([volunteerLocation.lat, volunteerLocation.lng]);

    if (points.length > 0) {
        map.flyToBounds(L.latLngBounds(points), { padding: [50, 50], duration: 1 });
    }
  };

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Initialize map
      const initialLat = pickupLocation.lat || 20.5937;
      const initialLng = pickupLocation.lng || 78.9629;
      
      const map = L.map(mapContainerRef.current, {
         zoomControl: false
      }).setView([initialLat, initialLng], 13);
      
      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
    }
  }, [pickupLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Helper to create emoji icons
    const createEmojiIcon = (emoji: string, bgClass: string, isLive: boolean = false) => L.divIcon({
      className: `flex items-center justify-center text-xl rounded-full border-2 border-white shadow-xl ${bgClass} ${isLive ? 'z-[100]' : 'z-[50]'} transition-all duration-500`,
      html: `
        <div class="relative flex items-center justify-center w-full h-full">
          <span class="transform transition-transform ${isLive ? 'scale-110' : ''}">${emoji}</span>
          ${isLive ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-sm"></div>' : ''}
          ${isLive ? '<div class="absolute w-full h-full rounded-full border-2 border-white/50 animate-ping opacity-50"></div>' : ''}
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22]
    });

    const getPopupContent = (title: string, subtitle: string, colorClass: string) => `
      <div class="p-2 min-w-[120px] text-center">
        <strong class="${colorClass} font-black uppercase text-[10px] tracking-wider mb-1 block">${title}</strong>
        <span class="text-xs font-bold text-slate-700 block">${subtitle}</span>
      </div>
    `;

    // Update Pickup Marker
    if (pickupLocation.lat && pickupLocation.lng) {
      if (!markersRef.current.pickup) {
        markersRef.current.pickup = L.marker([pickupLocation.lat, pickupLocation.lng], {
          icon: createEmojiIcon('📦', 'bg-emerald-500 text-white', !isPickedUp && !volunteerLocation)
        }).addTo(map).bindPopup(getPopupContent('Pickup Point', donorName, 'text-emerald-600'));
      } else {
        markersRef.current.pickup.setLatLng([pickupLocation.lat, pickupLocation.lng]);
        // Dim pickup marker if already picked up
        if (isPickedUp) {
            markersRef.current.pickup.setOpacity(0.4);
        }
      }
    }

    // Update Dropoff Marker
    if (dropoffLocation?.lat && dropoffLocation?.lng) {
      if (!markersRef.current.dropoff) {
        markersRef.current.dropoff = L.marker([dropoffLocation.lat, dropoffLocation.lng], {
          icon: createEmojiIcon('🏁', 'bg-blue-600 text-white')
        }).addTo(map).bindPopup(getPopupContent('Drop-off Point', orphanageName || 'Recipient', 'text-blue-600'));
      } else {
        markersRef.current.dropoff.setLatLng([dropoffLocation.lat, dropoffLocation.lng]);
      }
    }

    // Update Volunteer Marker and Route Line
    if (volunteerLocation) {
      if (!markersRef.current.volunteer) {
        markersRef.current.volunteer = L.marker([volunteerLocation.lat, volunteerLocation.lng], {
          icon: createEmojiIcon('🚚', 'bg-amber-500 text-white', true) 
        }).addTo(map).bindPopup(getPopupContent('Live Delivery', volunteerName || 'Volunteer', 'text-amber-600'));
      } else {
        markersRef.current.volunteer.setLatLng([volunteerLocation.lat, volunteerLocation.lng]);
        markersRef.current.volunteer.setPopupContent(getPopupContent('Live Delivery', volunteerName || 'Volunteer', 'text-amber-600'));
      }

      // Draw Route Line
      const routePoints: [number, number][] = [];
      routePoints.push([volunteerLocation.lat, volunteerLocation.lng]); // Start at volunteer

      if (!isPickedUp && pickupLocation.lat && pickupLocation.lng) {
        // Volunteer -> Pickup
        routePoints.push([pickupLocation.lat, pickupLocation.lng]);
      } else if (isPickedUp && dropoffLocation?.lat && dropoffLocation?.lng) {
        // Volunteer -> Dropoff
        routePoints.push([dropoffLocation.lat, dropoffLocation.lng]);
      }

      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(routePoints);
      } else {
        routeLineRef.current = L.polyline(routePoints, {
            color: isPickedUp ? '#3b82f6' : '#10b981', // Blue for dropoff, Green for pickup
            weight: 5,
            opacity: 0.8,
            dashArray: '12, 12', // Dashed line
            lineCap: 'round',
            className: 'animate-dash' // Assuming we can add simple css for dash offset
        }).addTo(map);
      }
      
      // Smoothly pan map to follow volunteer
      const bounds = L.latLngBounds(routePoints);
      map.flyToBounds(bounds, { 
          padding: [80, 80], 
          maxZoom: 16, 
          animate: true,
          duration: 1.5
      });

    } else {
      // If no volunteer, just fit markers
      const activeMarkers = [
        markersRef.current.pickup,
        markersRef.current.dropoff
      ].filter(Boolean);

      if (activeMarkers.length > 0) {
        const group = L.featureGroup(activeMarkers);
        map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
      }
    }

  }, [pickupLocation, donorName, dropoffLocation, orphanageName, volunteerLocation, volunteerName, isPickedUp]);

  return (
      <div className="h-full w-full relative group">
          <div ref={mapContainerRef} className="h-full w-full rounded-xl z-0" />
          <button 
                onClick={handleRecenter}
                className="absolute bottom-4 right-4 z-[400] bg-white p-2.5 rounded-xl shadow-lg border border-slate-100 text-slate-600 hover:text-amber-600 hover:scale-105 transition-all"
                title="Fit all markers"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
            </button>
      </div>
  );
};

export default TrackingMap;