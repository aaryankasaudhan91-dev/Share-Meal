
import React, { useEffect, useRef } from 'react';
import { FoodPosting, FoodStatus } from '../types';

declare const L: any;

interface PostingsMapProps {
  postings: FoodPosting[];
  onPostingSelect?: (postingId: string) => void;
  userLocation?: { lat: number; lng: number };
}

const PostingsMap: React.FC<PostingsMapProps> = ({ postings, onPostingSelect, userLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = userLocation?.lat || 20.5937;
      const initialLng = userLocation?.lng || 78.9629;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([initialLat, initialLng], 12);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
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

  // Update map center if user location changes significantly
  useEffect(() => {
      if (mapInstanceRef.current && userLocation) {
          // Only fly to user location if it's the first load or explicit action (optional optimization)
          mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 13);
      }
  }, [userLocation]);

  // Update markers
  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach(marker => map.removeLayer(marker));
      markersRef.current = [];

      // Add User Location Marker
      if (userLocation) {
          const userIcon = L.divIcon({
              className: 'custom-user-marker',
              html: `<div style="width: 20px; height: 20px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.2);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
          });
          const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup("You are here");
          markersRef.current.push(userMarker);
      }

      postings.forEach(post => {
          if (post.location?.lat && post.location?.lng) {
              
              const isUrgent = new Date(post.expiryDate).getTime() - Date.now() < 12 * 60 * 60 * 1000;
              const color = isUrgent ? '#f43f5e' : '#10b981'; // Rose for urgent, Emerald for normal
              const iconEmoji = post.foodCategory === 'Veg' ? '🥗' : '🍱';

              const customIcon = L.divIcon({
                  className: 'custom-map-marker',
                  html: `
                    <div style="position: relative;">
                        <div style="background-color: ${color}; width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);">
                            <div style="transform: rotate(45deg); font-size: 20px;">${iconEmoji}</div>
                        </div>
                    </div>
                  `,
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -40]
              });

              const popupContent = `
                <div class="font-sans min-w-[200px] p-1">
                    <div class="relative h-24 w-full rounded-lg overflow-hidden mb-2">
                        <img src="${post.imageUrl || ''}" class="w-full h-full object-cover" onerror="this.style.display='none'"/>
                        <div class="absolute inset-0 bg-black/20"></div>
                        <span class="absolute top-1 right-1 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-slate-800">${post.quantity}</span>
                    </div>
                    <h3 class="font-bold text-slate-800 text-sm leading-tight mb-1">${post.foodName}</h3>
                    <p class="text-xs text-slate-500 mb-2 truncate">${post.location.line1}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-bold ${isUrgent ? 'text-rose-500' : 'text-emerald-600'} uppercase tracking-wide">
                            ${isUrgent ? 'Urgent' : 'Available'}
                        </span>
                        <button onclick="document.dispatchEvent(new CustomEvent('selectPosting', { detail: '${post.id}' }))" class="bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                            View Details
                        </button>
                    </div>
                </div>
              `;

              const marker = L.marker([post.location.lat, post.location.lng], { icon: customIcon })
                .addTo(map)
                .bindPopup(popupContent);
              
              // Add simple click handler to marker to open popup
              marker.on('click', () => {
                  marker.openPopup();
              });

              markersRef.current.push(marker);
          }
      });
  }, [postings, userLocation]);

  // Listen for custom event from popup button
  useEffect(() => {
      const handleSelect = (e: any) => {
          if (onPostingSelect) onPostingSelect(e.detail);
      };
      document.addEventListener('selectPosting', handleSelect);
      return () => document.removeEventListener('selectPosting', handleSelect);
  }, [onPostingSelect]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-[2rem] shadow-inner bg-slate-100" />;
};

export default PostingsMap;
