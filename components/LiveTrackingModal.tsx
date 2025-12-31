
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting } from '../types';
import { storage } from '../services/storageService';

declare const L: any;

interface LiveTrackingModalProps {
  posting: FoodPosting;
  onClose: () => void;
}

const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({ posting, onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{[key: string]: any}>({});
  const [livePosting, setLivePosting] = useState<FoodPosting>(posting);

  // Poll for updates to get the latest volunteer location
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = storage.getPostings().find(p => p.id === posting.id);
      if (updated) setLivePosting(updated);
    }, 2000);
    return () => clearInterval(interval);
  }, [posting.id]);

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Default center, will be updated by markers
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([20.5937, 78.9629], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers based on live data
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { location: pickup, requesterAddress: dropoff, volunteerLocation } = livePosting;

    // Helper to create/update marker with custom HTML icons
    const updateMarker = (id: string, lat: number, lng: number, iconEmoji: string, color: string) => {
        if (markersRef.current[id]) {
            markersRef.current[id].setLatLng([lat, lng]);
        } else {
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); font-size: 20px;">${iconEmoji}</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });
            markersRef.current[id] = L.marker([lat, lng], { icon }).addTo(map);
        }
    };

    // Donor Marker (Green)
    if (pickup?.lat && pickup?.lng) {
        updateMarker('donor', pickup.lat, pickup.lng, '🏠', '#10b981');
    }

    // Requester Marker (Orange)
    if (dropoff?.lat && dropoff?.lng) {
        updateMarker('requester', dropoff.lat, dropoff.lng, '📍', '#f97316');
    }

    // Volunteer Marker (Blue)
    if (volunteerLocation?.lat && volunteerLocation?.lng) {
        updateMarker('volunteer', volunteerLocation.lat, volunteerLocation.lng, '🚴', '#3b82f6');
        // Center map on volunteer if we have their location
        map.panTo([volunteerLocation.lat, volunteerLocation.lng], { animate: true });
    } else if (pickup?.lat && pickup?.lng && !markersRef.current['volunteer']) {
        // Fallback center if no volunteer location yet
        map.setView([pickup.lat, pickup.lng], 13);
    }

  }, [livePosting]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg h-[600px] flex flex-col overflow-hidden shadow-2xl relative border border-slate-200">
        <div className="absolute top-4 right-4 z-[400]">
             <button onClick={onClose} className="bg-white hover:bg-slate-100 text-slate-900 p-2 rounded-full shadow-lg font-bold transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
        </div>
        
        <div ref={mapContainerRef} className="flex-1 w-full h-full bg-slate-100" />
        
        <div className="bg-white p-6 border-t border-slate-100 z-[400] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            <h3 className="font-black text-lg uppercase mb-3 tracking-wide">Live Delivery Tracking</h3>
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></div> Donor
                </div>
                <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-100"></div> Volunteer
                </div>
                <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-orange-100"></div> You
                </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-slate-800 text-sm font-bold flex items-center gap-2">
                    {livePosting.volunteerLocation ? (
                        <>
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            Volunteer is moving towards destination.
                        </>
                    ) : (
                        <>
                             <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                             Waiting for volunteer signal...
                        </>
                    )}
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingModal;
