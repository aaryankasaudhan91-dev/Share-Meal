
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting } from '../types';
import { storage } from '../services/storageService';

declare const L: any;

interface LiveTrackingModalProps {
  posting: FoodPosting;
  onClose: () => void;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
};

const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({ posting, onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{[key: string]: any}>({});
  const polylineRef = useRef<any>(null);
  const [livePosting, setLivePosting] = useState<FoodPosting>(posting);
  const [trackingStats, setTrackingStats] = useState<{dist: string, time: string} | null>(null);

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

  // Update Markers and Path based on live data
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { location: pickup, requesterAddress: dropoff, volunteerLocation } = livePosting;

    // Helper to create/update marker with custom HTML icons
    const updateMarker = (id: string, lat: number, lng: number, iconEmoji: string, color: string, isLive: boolean = false) => {
        const pulseHtml = isLive ? `
            <div style="position: absolute; inset: -12px; background-color: ${color}; border-radius: 50%; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; inset: -6px; background-color: ${color}; border-radius: 50%; opacity: 0.5;"></div>
        ` : '';

        const badgeHtml = isLive ? `
            <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background-color: #ef4444; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 99px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: nowrap; z-index: 20;">
                LIVE
            </div>
        ` : '';

        const markerHtml = `
            <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                ${pulseHtml}
                <div style="position: relative; z-index: 10; background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); font-size: 20px;">
                    ${iconEmoji}
                </div>
                ${badgeHtml}
            </div>
        `;

        const icon = L.divIcon({
            className: 'custom-marker-icon', 
            html: markerHtml,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        if (markersRef.current[id]) {
            markersRef.current[id].setLatLng([lat, lng]);
            markersRef.current[id].setIcon(icon); 
            // Ensure z-index is high for live marker
            if (isLive) markersRef.current[id].setZIndexOffset(1000);
        } else {
            const marker = L.marker([lat, lng], { icon, zIndexOffset: isLive ? 1000 : 0 }).addTo(map);
            
            // Add Popup Content
            let popupContent = '';
            if (id === 'donor') {
                popupContent = `
                    <div class="font-sans min-w-[120px]">
                        <p class="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Pickup</p>
                        <p class="font-bold text-sm text-slate-800">${livePosting.donorOrg || livePosting.donorName}</p>
                    </div>
                `;
            } else if (id === 'requester') {
                popupContent = `
                    <div class="font-sans min-w-[120px]">
                        <p class="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-1">Dropoff</p>
                        <p class="font-bold text-sm text-slate-800">${livePosting.orphanageName || 'Requester'}</p>
                    </div>
                `;
            } else if (id === 'volunteer') {
                popupContent = `
                    <div class="font-sans min-w-[120px]">
                        <p class="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Volunteer</p>
                        <p class="font-bold text-sm text-slate-800">${livePosting.volunteerName}</p>
                    </div>
                `;
            }
            
            if (popupContent) {
                marker.bindPopup(popupContent, { closeButton: false });
            }

            markersRef.current[id] = marker;
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

    // Volunteer Marker (Blue) - Live
    if (volunteerLocation?.lat && volunteerLocation?.lng) {
        updateMarker('volunteer', volunteerLocation.lat, volunteerLocation.lng, '🚴', '#3b82f6', true);
        
        // Calculate Distance and Time to Dropoff
        if (dropoff?.lat && dropoff?.lng) {
            const dist = calculateDistance(volunteerLocation.lat, volunteerLocation.lng, dropoff.lat, dropoff.lng);
            const timeMin = Math.ceil((dist / 30) * 60); // Approx 30km/h avg speed
            setTrackingStats({
                dist: dist.toFixed(1),
                time: timeMin.toString()
            });

            // Update Polyline
            const latlngs = [
                [volunteerLocation.lat, volunteerLocation.lng],
                [dropoff.lat, dropoff.lng]
            ];
            
            if (polylineRef.current) {
                polylineRef.current.setLatLngs(latlngs);
            } else {
                polylineRef.current = L.polyline(latlngs, {
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.6,
                    dashArray: '10, 10', 
                    lineCap: 'round'
                }).addTo(map);
            }
        }

        // Ensure map follows volunteer smoothly
        map.panTo([volunteerLocation.lat, volunteerLocation.lng], { 
            animate: true, 
            duration: 1.5,
            easeLinearity: 0.2 
        });
    } else {
        // Fallback center if no volunteer location
         if (pickup?.lat && pickup?.lng && !markersRef.current['volunteer']) {
             map.setView([pickup.lat, pickup.lng], 13);
         }
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
            
            {trackingStats ? (
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Distance</p>
                        <p className="text-xl font-black text-slate-800">{trackingStats.dist} km</p>
                    </div>
                    <div className="flex-1 bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Est. Time</p>
                        <p className="text-xl font-black text-blue-700">{trackingStats.time} min</p>
                    </div>
                </div>
            ) : null}

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
                            <span className="relative flex h-3 w-3 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span className="truncate">Volunteer is {trackingStats ? `approx ${trackingStats.dist}km away` : 'moving'}.</span>
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
