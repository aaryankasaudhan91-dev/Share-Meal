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
  onViewDetails?: (requesterId: string) => void;
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation, user, onToggleFavorite, onContact, onViewDetails }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Get unique categories from requesters
  const categories = ['All', 'Favorites', ...Array.from(new Set(requesters.map(r => r.orgCategory || 'Other').filter(Boolean)))];

  const handleRecenter = () => {
    if (mapInstanceRef.current && currentLocation) {
      mapInstanceRef.current.flyTo([currentLocation.lat, currentLocation.lng], 14, {
        duration: 1.5
      });
    }
  };

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = currentLocation?.lat || 20.5937;
      const initialLng = currentLocation?.lng || 78.9629;
      const initialZoom = currentLocation ? 12 : 5;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false // Custom placement
      }).setView([initialLat, initialLng], initialZoom);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Use CartoDB Voyager tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Initialize Marker Cluster Group
      // Using maxClusterRadius to control density and custom iconCreateFunction for dynamic sizing
      const markersLayer = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        animate: true,
        maxClusterRadius: 50,
        iconCreateFunction: function(cluster: any) {
            const count = cluster.getChildCount();
            
            // Dynamic sizing based on count
            let sizePx = 40;
            let sizeClass = 'w-10 h-10';
            let bgClass = 'bg-slate-800';
            
            if (count > 10) {
                sizePx = 48;
                sizeClass = 'w-12 h-12 text-lg';
                bgClass = 'bg-slate-900';
            }
            if (count > 50) {
                sizePx = 56;
                sizeClass = 'w-14 h-14 text-xl';
                bgClass = 'bg-black';
            }

            return L.divIcon({
                html: `<div class="${sizeClass} ${bgClass} text-white rounded-full flex items-center justify-center font-black border-[3px] border-white shadow-xl transition-transform hover:scale-110">
                         <span class="drop-shadow-md">${count}</span>
                       </div>`,
                className: 'bg-transparent',
                iconSize: L.point(sizePx, sizePx),
                iconAnchor: [sizePx / 2, sizePx / 2] // Center the icon
            });
        }
      }).addTo(map);
      
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }
  }, []); // Run once on mount

  // Update User Location Marker
  useEffect(() => {
    if (mapInstanceRef.current && currentLocation) {
        // Remove existing user marker if any
        if (userMarkerRef.current) {
            mapInstanceRef.current.removeLayer(userMarkerRef.current);
        }

        const pulseIcon = L.divIcon({
            className: 'bg-transparent',
            html: `<div class="relative flex items-center justify-center">
                     <div class="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10"></div>
                     <div class="absolute w-12 h-12 bg-blue-500/30 rounded-full animate-ping"></div>
                     <div class="absolute w-24 h-24 bg-blue-500/10 rounded-full animate-pulse"></div>
                   </div>`,
            iconSize: [0, 0]
        });

        const marker = L.marker([currentLocation.lat, currentLocation.lng], { icon: pulseIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup("<b>You are here</b>");
            
        userMarkerRef.current = marker;
    }
  }, [currentLocation]);

  // Update Markers (Clustered)
  useEffect(() => {
    if (mapInstanceRef.current && markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
      
      const createCustomMarker = (colorClass: string, isFav: boolean) => L.divIcon({
        className: 'bg-transparent group',
        html: `<div class="relative transition-transform hover:-translate-y-1">
                 <div class="w-8 h-8 ${colorClass} rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold relative z-10">
                    ${isFav ? '★' : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>'}
                 </div>
                 <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white"></div>
                 <div class="w-6 h-2 bg-black/20 rounded-[100%] blur-[2px] absolute top-full left-1/2 -translate-x-1/2 mt-0"></div>
               </div>`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42]
      });

      let filteredRequesters = requesters;
      if (selectedCategory === 'Favorites') {
        filteredRequesters = requesters.filter(r => user?.favoriteRequesterIds?.includes(r.id));
      } else if (selectedCategory !== 'All') {
        filteredRequesters = requesters.filter(r => (r.orgCategory || 'Other') === selectedCategory);
      }

      const markersToAdd: any[] = [];

      filteredRequesters.forEach(r => {
        if (r.address?.lat && r.address?.lng) {
          const isFav = user?.favoriteRequesterIds?.includes(r.id);
          const markerIcon = createCustomMarker(isFav ? 'bg-amber-500' : 'bg-emerald-600', !!isFav);
          
          const marker = L.marker([r.address.lat, r.address.lng], { icon: markerIcon });
          
          marker.bindTooltip(`
            <div class="text-center px-1">
                <div class="font-bold text-slate-800 text-sm">${r.orgName || r.name}</div>
            </div>
          `, { direction: 'top', offset: [0, -45], className: 'custom-tooltip shadow-sm border-0 rounded-lg px-2 py-1' });

          const popupContent = document.createElement('div');
          popupContent.className = 'p-1 min-w-[180px] text-center flex flex-col gap-2';
          
          // Header
          const header = document.createElement('div');
          header.innerHTML = `
            <div class="flex flex-col items-center">
                <h3 class="font-black text-sm text-slate-800 leading-tight mb-1">${r.orgName || r.name}</h3>
                <span class="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">${r.orgCategory || 'Organization'}</span>
            </div>
          `;
          popupContent.appendChild(header);

          // Address
          if (r.address) {
              const addr = document.createElement('p');
              addr.className = 'text-xs text-slate-500 leading-tight border-b border-slate-100 pb-2 mb-1';
              addr.innerText = `${r.address.line1}, ${r.address.pincode}`;
              popupContent.appendChild(addr);
          }

          // Buttons Container
          const btnGroup = document.createElement('div');
          btnGroup.className = 'grid grid-cols-2 gap-2';

          // View Details Button
          const viewBtn = document.createElement('button');
          viewBtn.className = 'px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-colors uppercase tracking-wide';
          viewBtn.innerText = 'Details';
          viewBtn.onclick = (e) => {
              e.stopPropagation();
              if (onViewDetails) onViewDetails(r.id);
          };

          // Contact Button
          const contactBtn = document.createElement('button');
          contactBtn.className = 'px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-colors uppercase tracking-wide';
          contactBtn.innerText = 'Contact';
          contactBtn.onclick = (e) => {
              e.stopPropagation();
              if (onContact) onContact(r.id);
          };

          btnGroup.appendChild(viewBtn);
          btnGroup.appendChild(contactBtn);
          popupContent.appendChild(btnGroup);

          // Add Fav Button at bottom if user is logged in
          if (user && onToggleFavorite) {
              const favBtn = document.createElement('button');
              favBtn.className = `w-full mt-1 text-[10px] font-bold py-1 px-2 rounded-lg border transition-all flex items-center justify-center gap-1 ${isFav ? 'text-amber-500 border-amber-200 bg-amber-50' : 'text-slate-400 border-slate-100 hover:text-amber-400 hover:border-amber-200'}`;
              favBtn.innerHTML = isFav ? '★ Favorited' : '☆ Add to Favorites';
              favBtn.onclick = (e) => {
                  e.stopPropagation();
                  onToggleFavorite(r.id);
              };
              popupContent.appendChild(favBtn);
          }

          marker.bindPopup(popupContent, { 
              closeButton: false, 
              className: 'rounded-xl overflow-hidden shadow-xl border-0 p-0',
              maxWidth: 220
          });
          
          markersToAdd.push(marker);
        }
      });
      
      markersLayerRef.current.addLayers(markersToAdd);
    }
  }, [requesters, user, selectedCategory, onToggleFavorite, onContact, onViewDetails]);

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-slate-100 group">
        <div ref={mapContainerRef} className="h-full w-full z-0" />
        
        {/* Recenter Button */}
        {currentLocation && (
            <button 
                onClick={handleRecenter}
                className="absolute bottom-6 right-14 z-[400] bg-white p-2.5 rounded-xl shadow-lg border border-slate-100 text-slate-600 hover:text-blue-600 hover:scale-110 transition-all"
                title="Recenter on me"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </button>
        )}

        {/* Filter Overlay */}
        <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/50 max-w-[200px] animate-in slide-in-from-left-2 duration-500">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Filter Map</p>
            <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                            selectedCategory === cat 
                            ? 'bg-slate-800 text-white shadow-md scale-105' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-white/50 text-[10px] font-bold text-slate-500 space-y-2">
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 border border-white shadow-sm flex items-center justify-center animate-pulse">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                <span>Your Location</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-600 border border-white shadow-sm flex items-center justify-center text-white">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
                <span>Recipient</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500 border border-white shadow-sm flex items-center justify-center text-white">
                    <span className="text-[10px] leading-none mb-0.5">★</span>
                </div>
                <span>Favorites</span>
            </div>
        </div>
    </div>
  );
};

export default RequesterMap;