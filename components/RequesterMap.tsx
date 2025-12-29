
import React, { useEffect, useRef, useState } from 'react';
import { User, UserRole } from '../types';

// Declare Leaflet global
declare const L: any;

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Get unique categories from requesters
  const categories = ['All', ...Array.from(new Set(requesters.map(r => r.orgCategory || 'Other').filter(Boolean)))];

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Initialize map
      // Default to a central location (e.g., center of a sample city or current location)
      const initialLat = currentLocation?.lat || 20.5937; // Default India center approx
      const initialLng = currentLocation?.lng || 78.9629;
      const initialZoom = currentLocation ? 12 : 5;

      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], initialZoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Create a layer group for markers to manage them easily (clear/add)
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      // Add User location marker if available
      if (currentLocation) {
        L.marker([currentLocation.lat, currentLocation.lng], {
            icon: L.divIcon({
                className: 'bg-blue-600 rounded-full border-2 border-white shadow-lg',
                iconSize: [16, 16],
            })
        })
        .addTo(map)
        .bindPopup("<b>You are here</b>")
        .openPopup();

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
      // Clear existing markers
      markersLayerRef.current.clearLayers();
      
      const greenIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const filteredRequesters = selectedCategory === 'All'
        ? requesters
        : requesters.filter(r => (r.orgCategory || 'Other') === selectedCategory);

      filteredRequesters.forEach(r => {
        if (r.address?.lat && r.address?.lng) {
          L.marker([r.address.lat, r.address.lng], { icon: greenIcon })
            .addTo(markersLayerRef.current)
            .bindPopup(`
              <div class="p-1">
                <h3 class="font-bold text-sm">${r.orgName || r.name}</h3>
                <p class="text-xs text-slate-500 capitalize">${r.orgCategory || 'Organization'}</p>
                <p class="text-xs mt-1">${r.address.line1}</p>
              </div>
            `);
        }
      });
    }
  }, [requesters, selectedCategory]);

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
                className="text-sm border-slate-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 bg-white border px-3 py-1.5 outline-none flex-1 sm:flex-none"
            >
                {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
        </div>
      </div>
      <div ref={mapContainerRef} className="h-96 w-full z-0" />
      <div className="p-3 bg-white text-xs text-slate-500 flex gap-4 justify-center">
         <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-600"></div> You</div>
         <div className="flex items-center gap-1"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" className="h-4" /> Organizations</div>
      </div>
    </div>
  );
};

export default RequesterMap;
