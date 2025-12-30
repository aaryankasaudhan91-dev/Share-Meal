import React, { useEffect, useRef, useState } from 'react';
import { User, UserRole } from '../types';

// Declare Leaflet global
declare const L: any;

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
  user?: User;
  onToggleFavorite?: (requesterId: string) => void;
  onContact?: (requesterId: string) => void;
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation, user, onToggleFavorite, onContact }) => {
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
          
          // Always bind a tooltip for quick identification
          marker.bindTooltip(`
            <div class="text-center">
                <div class="font-bold text-sm">${r.orgName || r.name}</div>
                <div class="text-xs opacity-75">${r.orgCategory || 'Organization'}</div>
            </div>
          `, { direction: 'top', offset: [0, -35] });

          // Direct interaction for Donors vs Popup for others
          if (user?.role === UserRole.DONOR && onContact) {
             marker.on('click', () => {
                onContact(r.id);
             });
          } else {
             // Fallback to popup for non-donors (e.g. other Requesters/Volunteers browsing map)
             const popupContent = document.createElement('div');
             popupContent.className = 'p-1 min-w-[150px]';
             popupContent.innerHTML = `
               <h3 class="font-bold text-sm text-slate-800">${r.orgName || r.name}</h3>
               <p class="text-xs text-slate-500 mb-2">${r.orgCategory}</p>
               <p class="text-[10px] text-slate-400 mb-2">${r.address?.line1}, ${r.address?.pincode}</p>
             `;
             
             if (user?.role === UserRole.DONOR && onToggleFavorite) {
                 const btn = document.createElement('button');
                 btn.className = `w-full text-xs font-bold py-1 px-2 rounded border ${isFav ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`;
                 btn.innerText = isFav ? '★ Favorited' : '☆ Add to Favorites';
                 btn.onclick = (e) => {
                     e.stopPropagation();
                     onToggleFavorite(r.id);
                 };
                 popupContent.appendChild(btn);
             }

             marker.bindPopup(popupContent);
          }
        }
      });
    }
  }, [requesters, user, selectedCategory, onToggleFavorite, onContact]);

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-inner bg-slate-100">
        <div ref={mapContainerRef} className="h-full w-full z-0" />
        
        {/* Filter Overlay */}
        <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-white/50 max-w-[200px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Filter Map</p>
            <div className="flex flex-wrap gap-1">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                            selectedCategory === cat 
                            ? 'bg-slate-800 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 z-[400] bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white/50 text-[10px] font-bold text-slate-500 space-y-1">
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-sm"></span>
                <span>You</span>
            </div>
            <div className="flex items-center gap-2">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" className="h-4 w-3" alt="" />
                <span>Requester</span>
            </div>
            <div className="flex items-center gap-2">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png" className="h-4 w-3" alt="" />
                <span>Favorite</span>
            </div>
        </div>
    </div>
  );
};

export default RequesterMap;