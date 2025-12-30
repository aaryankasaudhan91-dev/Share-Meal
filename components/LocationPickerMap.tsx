import React, { useEffect, useRef } from 'react';

declare const L: any;

interface LocationPickerMapProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lng, onLocationSelect }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const defaultLat = 20.5937; // India center
  const defaultLng = 78.9629;

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = lat || defaultLat;
      const initialLng = lng || defaultLng;
      const initialZoom = lat ? 15 : 5;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false, // We'll add it in a better position if needed
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

      // Event Listeners
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onLocationSelect(pos.lat, pos.lng);
        map.panTo(pos);
      });

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        onLocationSelect(lat, lng);
        map.panTo([lat, lng]);
      });

      mapInstanceRef.current = map;
      
      // Fix for map not rendering correctly in some containers
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, []);

  // Sync external prop changes (e.g., from Auto-Detect button)
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && lat && lng) {
      const currentPos = markerRef.current.getLatLng();
      // Only update if significantly different to avoid drag loops
      if (Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lng - lng) > 0.0001) {
          markerRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
      }
    }
  }, [lat, lng]);

  return (
    <div className="w-full h-56 rounded-2xl overflow-hidden border border-slate-200 relative z-0 shadow-inner group">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] text-slate-500 z-[400] font-bold shadow-sm pointer-events-none border border-white/50">
        Drag pin to adjust location
      </div>
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/5 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default LocationPickerMap;