
import React, { useEffect, useRef } from 'react';
import { Address } from '../types';

declare const L: any;

interface TrackingMapProps {
  pickupLocation: Address;
  donorName: string;
  dropoffLocation?: Address;
  volunteerLocation?: { lat: number; lng: number };
}

const TrackingMap: React.FC<TrackingMapProps> = ({ pickupLocation, volunteerLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const lat = pickupLocation.lat || 20.5937;
      const lng = pickupLocation.lng || 78.9629;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([lat, lng], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      mapInstanceRef.current = map;
    }
    return () => { if (mapInstanceRef.current) mapInstanceRef.current.remove(); mapInstanceRef.current = null; };
  }, [pickupLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-xl" />;
};

export default TrackingMap;
