import React, { useEffect, useRef, useState } from 'react';
import { reverseGeocode, ReverseGeocodeResult } from '../services/geminiService';

declare const L: any;

interface LocationPickerMapProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressFound?: (address: ReverseGeocodeResult) => void;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lng, onLocationSelect, onAddressFound }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Store handlers in refs to access fresh versions in event listeners
  const handlersRef = useRef({ onLocationSelect, onAddressFound });
  useEffect(() => {
    handlersRef.current = { onLocationSelect, onAddressFound };
  }, [onLocationSelect, onAddressFound]);

  const defaultLat = 20.5937; // India center
  const defaultLng = 78.9629;

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = lat || defaultLat;
      const initialLng = lng || defaultLng;
      const initialZoom = lat ? 15 : 5;

      // Sync parent state with initial map position immediately
      // This ensures if the user doesn't move the pin, the default (or provided) location is still captured
      handlersRef.current.onLocationSelect(initialLat, initialLng);

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([initialLat, initialLng], initialZoom);

      L.control.attribution({ position: 'bottomright' }).addTo(map);

      // Use CartoDB Voyager tiles for a cleaner, modern look
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Custom draggable icon
      const icon = L.divIcon({
        className: 'bg-transparent',
        html: `<div class="relative group cursor-grab active:cursor-grabbing">
                 <div class="w-10 h-10 text-emerald-600 drop-shadow-xl transform -translate-x-1/2 -translate-y-full transition-transform group-hover:scale-110 group-active:scale-95">
                   <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                   <div class="absolute inset-0 flex items-center justify-center -mt-2">
                     <div class="w-2.5 h-2.5 bg-white rounded-full"></div>
                   </div>
                 </div>
                 <div class="w-4 h-1.5 bg-black/20 rounded-full blur-[1px] absolute top-0 -translate-x-1/2 left-0"></div>
               </div>`,
        iconSize: [0, 0], // CSS handles size
        iconAnchor: [0, 0]
      });

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: icon
      }).addTo(map);

      markerRef.current = marker;

      const handleDragEnd = async () => {
        const pos = marker.getLatLng();
        handlersRef.current.onLocationSelect(pos.lat, pos.lng);
        map.panTo(pos);
        
        // Reverse geocode on drag end
        if (handlersRef.current.onAddressFound) {
            try {
                const address = await reverseGeocode(pos.lat, pos.lng);
                if (address) {
                    handlersRef.current.onAddressFound(address);
                }
            } catch (e) {
                console.error("Reverse geocode failed on drag", e);
            }
        }
      };

      // Event Listeners
      marker.on('dragend', handleDragEnd);

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        handlersRef.current.onLocationSelect(lat, lng);
        map.panTo([lat, lng]);
        // Trigger dragend logic for click too to sync address
        handleDragEnd(); 
      });

      mapInstanceRef.current = map;
      
      // Fix for map not rendering correctly in some containers
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }

    // Cleanup
    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, []);

  // Sync external prop changes (e.g., from Auto-Detect button)
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && lat !== undefined && lng !== undefined) {
      const currentPos = markerRef.current.getLatLng();
      // Only update if significantly different to avoid drag loops
      if (Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lng - lng) > 0.0001) {
          markerRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
      }
    }
  }, [lat, lng]);

  const handleAutoDetect = () => {
      if (!navigator.geolocation) {
          alert("Geolocation is not supported by your browser");
          return;
      }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
          async (position) => {
              const { latitude, longitude } = position.coords;
              
              // Update marker and parent
              if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([latitude, longitude], 16);
                  if (markerRef.current) {
                      markerRef.current.setLatLng([latitude, longitude]);
                  }
              }
              onLocationSelect(latitude, longitude);

              // Auto-fill address if handler provided
              if (onAddressFound) {
                  try {
                      const address = await reverseGeocode(latitude, longitude);
                      if (address) {
                          onAddressFound(address);
                      }
                  } catch (e) {
                      console.error("Failed to reverse geocode:", e);
                  }
              }
              setIsLocating(false);
          },
          (error) => {
              console.error(error);
              alert("Unable to retrieve your location");
              setIsLocating(false);
          },
          { enableHighAccuracy: true }
      );
  };

  return (
    <div className="w-full h-56 rounded-2xl overflow-hidden border border-slate-200 relative z-0 shadow-inner group">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Auto Detect Button */}
      <button 
        onClick={handleAutoDetect}
        disabled={isLocating}
        type="button"
        className="absolute top-2 left-2 z-[400] bg-white text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed border border-slate-100"
      >
         {isLocating ? (
             <>
                <svg className="animate-spin w-3 h-3 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Detecting...
             </>
         ) : (
             <>
                <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                Use Current Location
             </>
         )}
      </button>

      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] text-slate-500 z-[400] font-bold shadow-sm pointer-events-none border border-white/50">
        Drag pin to adjust location
      </div>
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/5 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default LocationPickerMap;