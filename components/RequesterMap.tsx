import React, { useEffect, useRef, useState } from 'react';
import { User, UserRole } from '../types';

// Declare Leaflet global
declare const L: any;

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
  user?: User;
  onToggleFavorite?: (requesterId: string) => void;
  onContact?: (requesterId: string, message?: string) => void;
  onViewDetails?: (requesterId: string) => void;
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation, user, onToggleFavorite, onContact, onViewDetails }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRequester, setSelectedRequester] = useState<User | null>(null);
  
  // Contact Modal State
  const [contactRequester, setContactRequester] = useState<User | null>(null);
  const [messageText, setMessageText] = useState('');

  // Get unique categories from requesters
  const categories = ['All', 'Favorites', ...Array.from(new Set(requesters.map(r => r.orgCategory || 'Other').filter(Boolean)))];

  const handleRecenter = () => {
    if (mapInstanceRef.current && currentLocation) {
      mapInstanceRef.current.flyTo([currentLocation.lat, currentLocation.lng], 14, {
        duration: 1.5
      });
    }
  };

  const openContactModal = (requester: User) => {
      setContactRequester(requester);
      const greeting = requester.orgName ? `Hi ${requester.orgName},` : `Hi ${requester.name},`;
      setMessageText(`${greeting}\n\nI noticed your request and would like to help...`);
  };

  const handleSendMessage = () => {
      if (contactRequester && onContact) {
          onContact(contactRequester.id, messageText);
          setContactRequester(null);
          setMessageText('');
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

      // Initialize Marker Cluster Group with custom styling
      const markersLayer = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        animate: true,
        maxClusterRadius: 50, // Cluster markers within 50 pixels
        iconCreateFunction: function(cluster: any) {
            const count = cluster.getChildCount();
            
            // Dynamic sizing based on count
            let sizePx = 40;
            let sizeClass = 'w-10 h-10';
            // Use Brand Emerald colors instead of slate/black
            let bgClass = 'bg-emerald-600';
            
            if (count > 10) {
                sizePx = 48;
                sizeClass = 'w-12 h-12 text-lg';
                bgClass = 'bg-emerald-700';
            }
            if (count > 50) {
                sizePx = 56;
                sizeClass = 'w-14 h-14 text-xl';
                bgClass = 'bg-emerald-900';
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

    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
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
        html: `<div class="relative transition-transform hover:-translate-y-1 cursor-pointer">
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
          
          // Tooltip for quick ID
          marker.bindTooltip(`
            <div class="text-center px-1">
                <div class="font-bold text-slate-800 text-sm">${r.orgName || r.name}</div>
            </div>
          `, { direction: 'top', offset: [0, -45], className: 'custom-tooltip shadow-sm border-0 rounded-lg px-2 py-1' });

          // Click handler to open internal modal
          marker.on('click', () => {
              setSelectedRequester(r);
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
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-800 border border-white shadow-sm flex items-center justify-center text-white text-[8px]">
                    <span>10+</span>
                </div>
                <span>Clusters</span>
            </div>
        </div>

        {/* Selected Requester Modal */}
        {selectedRequester && (
             <div className="absolute inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedRequester(null)}>
                 <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-xs border border-white/50 relative overflow-hidden group" onClick={e => e.stopPropagation()}>
                     
                     {/* Close Button */}
                     <button onClick={() => setSelectedRequester(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>

                     {/* Content */}
                     <div className="flex flex-col items-center text-center mb-6 mt-2">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-black mb-3 border-4 border-white shadow-lg ring-1 ring-slate-100">
                            {selectedRequester.orgName?.charAt(0) || selectedRequester.name.charAt(0)}
                        </div>
                        <h3 className="font-black text-slate-800 text-xl leading-tight mb-1">{selectedRequester.orgName || selectedRequester.name}</h3>
                        <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                            {selectedRequester.orgCategory || 'Organization'}
                        </span>
                        
                        {selectedRequester.address && (
                            <p className="text-xs text-slate-400 mt-3 max-w-[80%] leading-relaxed">
                                {selectedRequester.address.line1}, {selectedRequester.address.pincode}
                            </p>
                        )}
                     </div>
                     
                     <div className="flex gap-2">
                         <button 
                            onClick={() => {
                                openContactModal(selectedRequester);
                                setSelectedRequester(null);
                            }}
                            className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                         >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Contact
                         </button>
                         {/* View Details Button */}
                         {onViewDetails && (
                             <button
                                onClick={() => {
                                    onViewDetails(selectedRequester.id);
                                    setSelectedRequester(null);
                                }}
                                className="px-4 bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors text-xs uppercase tracking-widest"
                                title="View Full Profile"
                             >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             </button>
                         )}
                     </div>
                 </div>
             </div>
         )}

         {/* Internal Contact Modal */}
         {contactRequester && (
             <div className="absolute inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setContactRequester(null)}>
                 <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-200" onClick={e => e.stopPropagation()}>
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight truncate">
                             Contact {contactRequester.orgName || contactRequester.name}
                         </h3>
                         <button onClick={() => setContactRequester(null)} className="text-slate-400 hover:text-slate-600">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                     </div>
                     
                     <div className="space-y-4">
                        <textarea 
                            rows={5}
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type your message here..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all resize-none text-sm font-medium text-slate-700 custom-scrollbar"
                            autoFocus
                        />
                        
                        <div className="flex gap-3">
                             <button 
                                onClick={() => setContactRequester(null)}
                                className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                             >
                                Cancel
                             </button>
                             <button 
                                onClick={handleSendMessage}
                                disabled={!messageText.trim()}
                                className="flex-1 bg-emerald-600 text-white font-black py-3 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                             >
                                Send
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                             </button>
                        </div>
                     </div>
                 </div>
             </div>
         )}
    </div>
  );
};

export default RequesterMap;