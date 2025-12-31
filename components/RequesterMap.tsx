
import React, { useEffect, useRef } from 'react';
import { User } from '../types';

declare const L: any;

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = currentLocation?.lat || 20.5937;
      const initialLng = currentLocation?.lng || 78.9629;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([initialLat, initialLng], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      mapInstanceRef.current = map;
    }
    return () => { if (mapInstanceRef.current) mapInstanceRef.current.remove(); mapInstanceRef.current = null; };
  }, [currentLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-2xl shadow-lg border border-slate-200 bg-slate-100" />;
};

export default RequesterMap;
