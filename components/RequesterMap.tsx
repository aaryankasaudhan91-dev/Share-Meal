
import React, { useEffect, useRef, useState } from 'react';
import { User, UserRole } from '../types';

// Declare Leaflet global
declare const L: any;

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
  user?: User;
  onToggleFavorite?: (requesterId: string) => void;
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation, user, onToggleFavorite }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Get unique categories from requesters
  const categories = ['All', 'Favorites', ...Array.from(new Set(requesters.map(r => r.orgCategory || 'Other').filter(Boolean)))];

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Initialize map
      const initialLat = currentLocation?.lat || 20.5937;
      const initialLng = currentLocation?.lng || 78.9629;
      const initialZoom = currentLocation ? 12 : 5;

      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], initialZoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      if (currentLocation) {
        L.marker([currentLocation.lat, currentLocation.lng], {
            icon: L.divIcon({
                className: 'bg-blue-600 rounded-full border-2 border-white shadow-lg',
                iconSize: [16, 16],
            })
        })
        .addTo(map)
        .bindPopup("<b>You are here</b>");

        L.circle([currentLocation.lat, currentLocation.lng], {
            color: 'blue',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            radius: 2000
        }).addTo(map);
      }

      mapInstanceRef.current = map;
    }
  }, [currentLocation]);

  // Update markers when requesters or filter changes
  useEffect(() => {
    if (mapInstanceRef.current && markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
      
      const greenIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const goldIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      let filteredRequesters = requesters;
      if (selectedCategory === 'Favorites') {
        filteredRequesters = requesters.filter(r => user?.favoriteRequesterIds?.includes(r.id));
      } else if (selectedCategory !== 'All') {
        filteredRequesters = requesters.filter(r => (r.orgCategory || 'Other') === selectedCategory);
      }

      filteredRequesters.forEach(r => {
        if (r.address?.lat && r.address?.lng) {
          const isFav = user?.favoriteRequesterIds?.includes(r.id);
          const marker = L.marker([r.address.lat, r.address.lng], { icon: isFav ? goldIcon : greenIcon })
            .addTo(markersLayerRef.current);
          
          const popupContent = document.createElement('div');
          popupContent.className = 'p-1 min-w-[150px]';
          popupContent.innerHTML = `
            <h3 class="font-bold text-sm mb-0.5">${r.orgName || r.name}</h3>
            <p class="text-[10px] text-slate-500 capitalize mb-1">${r.orgCategory || 'Organization'}</p>
            <p class="text-[10px] text-slate-600 mb-2">${r.address.line1}</p>
          `;

          if (user?.role === UserRole.DONOR && onToggleFavorite) {
            const btn = document.createElement('button');
            btn.className = `w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              isFav ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
            }`;
            btn.innerHTML = isFav ? '★ Favorited' : '☆ Favorite';
            btn.onclick = (e) => {
              e.stopPropagation();
              onToggleFavorite(r.id);
            };
            popupContent.appendChild(btn);
          }

          marker.bindPopup(popupContent);
        }
      });
    }
  }, [requesters, selectedCategory, user?.favoriteRequesterIds, user?.role, onToggleFavorite]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h3 className="font-bold text-slate-700">Nearby Organizations</h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">
            {requesters.filter(r => r.address?.lat).length} Locations Found
            </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-semibold text-slate-600">Filter by:</label>
            <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm border-black rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 bg-white border px-3 py-1.5 outline-none flex-1 sm:flex-none"
            >
                {categories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'Favorites' ? '⭐ My Favorites' : cat}</option>
                ))}
            </select>
        </div>
      </div>
      <div ref={mapContainerRef} className="h-96 w-full z-0" />
      <div className="p-3 bg-white text-[10px] text-slate-500 flex gap-4 justify-center border-t border-slate-50">
         <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-600"></div> You</div>
         <div className="flex items-center gap-1"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" className="h-3" /> Organizations</div>
         <div className="flex items-center gap-1"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png" className="h-3" /> My Favorites</div>
      </div>
    </div>
  );
};

export default RequesterMap;
