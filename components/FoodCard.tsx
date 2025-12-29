
import React, { useState, useEffect } from 'react';
import { FoodPosting, FoodStatus, UserRole, User, Address } from '../types';
import { getFoodSafetyTips, getRouteInsights } from '../services/geminiService';
import TrackingMap from './TrackingMap';

interface FoodCardProps {
  posting: FoodPosting;
  user: User;
  onUpdate: (id: string, updates: Partial<FoodPosting>) => void;
}

const FoodCard: React.FC<FoodCardProps> = ({ posting, user, onUpdate }) => {
  const [showTips, setShowTips] = useState(false);
  const [tips, setTips] = useState<string>('');
  const [loadingTips, setLoadingTips] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ text: string, mapsUrl: string } | null>(null);

  // Handle ESC key and Body Scroll Lock for Modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomed(false);
        setShowTracking(false);
      }
    };

    if (isZoomed || showTracking) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isZoomed, showTracking]);

  const formatAddress = (addr: Address) => {
    return `${addr.line1}, ${addr.line2}${addr.landmark ? ` (Near ${addr.landmark})` : ''}, Pin: ${addr.pincode}`;
  };

  const fetchTips = async () => {
    if (tips) {
      setShowTips(!showTips);
      return;
    }
    setLoadingTips(true);
    const data = await getFoodSafetyTips(posting.foodName);
    setTips(data);
    setLoadingTips(false);
    setShowTips(true);
  };

  const handleGetRoute = async (address: Address, type: 'pickup' | 'dropoff') => {
    const destination = formatAddress(address);
    setLoadingRoute(type);
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const info = await getRouteInsights(destination, pos.coords.latitude, pos.coords.longitude);
          setRouteInfo(info);
          window.open(info.mapsUrl, '_blank');
          setLoadingRoute(null);
        },
        async () => {
          const info = await getRouteInsights(destination);
          setRouteInfo(info);
          window.open(info.mapsUrl, '_blank');
          setLoadingRoute(null);
        }
      );
    } catch (err) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank');
      setLoadingRoute(null);
    }
  };

  const handleAcceptDelivery = () => {
    if (window.confirm("Are you sure you want to accept this delivery? This will inform the donor and recipient that you are on the way to pick up the food.")) {
      onUpdate(posting.id, { 
        status: FoodStatus.IN_TRANSIT, 
        volunteerId: user.id, 
        volunteerName: user.name 
      });
    }
  };

  const handleMarkDelivered = () => {
    if (window.confirm("Confirm that this food has been successfully delivered to the recipient organization?")) {
      onUpdate(posting.id, { status: FoodStatus.DELIVERED });
    }
  };

  const getStatusColor = (status: FoodStatus) => {
    switch (status) {
      case FoodStatus.AVAILABLE: return 'bg-emerald-100 text-emerald-700';
      case FoodStatus.REQUESTED: return 'bg-blue-100 text-blue-700';
      case FoodStatus.IN_TRANSIT: return 'bg-amber-100 text-amber-700';
      case FoodStatus.DELIVERED: return 'bg-slate-100 text-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const canRequest = user.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE;
  const canVolunteer = user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.REQUESTED;
  const canComplete = user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.IN_TRANSIT && posting.volunteerId === user.id;

  const showTrackingTimeline = user.role === UserRole.DONOR || (user.role === UserRole.REQUESTER && posting.orphanageId === user.id);
  const canTrackLive = (user.role === UserRole.DONOR || (user.role === UserRole.REQUESTER && posting.orphanageId === user.id)) && posting.status === FoodStatus.IN_TRANSIT;

  return (
    <>
      {/* Tracking Modal */}
      {showTracking && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowTracking(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                  <h3 className="font-bold text-lg text-slate-800">Live Delivery Tracking</h3>
                  <p className="text-xs text-slate-500">Tracking {posting.volunteerName}'s vehicle</p>
               </div>
               <button 
                onClick={() => setShowTracking(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors"
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             </div>
             <div className="flex-1 relative">
                <TrackingMap 
                  pickupLocation={posting.location} 
                  donorName={posting.donorName}
                  dropoffLocation={posting.requesterAddress} 
                  orphanageName={posting.orphanageName}
                  volunteerLocation={posting.volunteerLocation} 
                  volunteerName={posting.volunteerName}
                />
             </div>
             {/* Simple Legend */}
             <div className="p-3 bg-white border-t border-slate-100 flex gap-6 justify-center text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1">📦 Pickup</span>
                <span className="flex items-center gap-1">🚚 Volunteer</span>
                <span className="flex items-center gap-1">🏁 Drop-off</span>
             </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
        {posting.imageUrl && (
          <>
            <div 
              className="group relative h-48 w-full overflow-hidden bg-slate-100 border-b border-slate-100 cursor-zoom-in"
              onClick={() => setIsZoomed(true)}
            >
              <img 
                src={posting.imageUrl} 
                alt={posting.foodName} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                  <div className="bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 backdrop-blur-sm">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m4-3H6" />
                      </svg>
                  </div>
              </div>

              {posting.safetyVerdict && (
                <div className={`absolute top-2 right-2 px-2 py-1 rounded shadow-sm text-[10px] font-bold uppercase z-10 ${posting.safetyVerdict.isSafe ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                  {posting.safetyVerdict.isSafe ? '✓ AI Verified Safe' : '⚠ AI Warning'}
                </div>
              )}
            </div>

            {/* Enhanced Zoom Modal */}
            {isZoomed && (
              <div 
                className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
                onClick={() => setIsZoomed(false)}
                role="dialog"
                aria-modal="true"
              >
                <button 
                  className="absolute top-4 right-4 z-[102] text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                  onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
                  aria-label="Close preview"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div 
                  className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <img 
                    src={posting.imageUrl} 
                    alt={posting.foodName} 
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-black" 
                  />
                  <div className="mt-4 text-center animate-in slide-in-from-bottom-2 duration-300">
                      <h4 className="text-white text-xl font-bold tracking-tight">{posting.foodName}</h4>
                      <p className="text-white/70 text-sm mt-1">Donated by <span className="text-white font-medium">{posting.donorName}</span></p>
                      {posting.safetyVerdict && (
                          <div className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${posting.safetyVerdict.isSafe ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30' : 'border-red-500 text-red-400 bg-red-950/30'}`}>
                              {posting.safetyVerdict.isSafe ? '✓ AI Verified Safe' : '⚠ AI Warning'}
                          </div>
                      )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div className="p-5 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{posting.foodName}</h3>
              <p className="text-sm text-slate-500">From: {posting.donorName}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(posting.status)}`}>
              {posting.status}
            </span>
          </div>

          {posting.safetyVerdict && !posting.safetyVerdict.isSafe && (
            <div className="mb-4 p-2 bg-red-50 border border-red-100 rounded text-[10px] text-red-700 italic">
              <strong>AI Note:</strong> {posting.safetyVerdict.reasoning}
            </div>
          )}

          <div className="space-y-3 mb-6">
            <div className="flex items-center text-sm text-slate-600">
              <svg className="w-4 h-4 mr-2 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              Quantity: {posting.quantity}
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-700 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Pickup
                  </span>
                  {user.role === UserRole.VOLUNTEER && posting.status !== FoodStatus.DELIVERED && (
                    <button onClick={() => handleGetRoute(posting.location, 'pickup')} className="text-blue-600 hover:underline font-bold text-[10px] uppercase">
                      {loadingRoute === 'pickup' ? '...' : 'Route'}
                    </button>
                  )}
                </div>
                <p className="mt-1 leading-relaxed">{formatAddress(posting.location)}</p>
              </div>

              {posting.requesterAddress && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-blue-700 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" /></svg>
                      Drop-off
                    </span>
                    {user.role === UserRole.VOLUNTEER && posting.status !== FoodStatus.DELIVERED && (
                      <button onClick={() => handleGetRoute(posting.requesterAddress!, 'dropoff')} className="text-blue-600 hover:underline font-bold text-[10px] uppercase">
                        {loadingRoute === 'dropoff' ? '...' : 'Route'}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 leading-relaxed">{formatAddress(posting.requesterAddress)}</p>
                  <p className="mt-1 text-[10px] italic font-semibold">Organisation: {posting.orphanageName}</p>
                </div>
              )}
            </div>

            <div className="flex items-center text-sm text-slate-600">
              <svg className="w-4 h-4 mr-2 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Expiry: {new Date(posting.expiryDate).toLocaleDateString()}
            </div>
          </div>

          {/* Tracking Timeline */}
          {showTrackingTimeline && (
            <div className="mt-2 mb-6 pt-4 border-t border-slate-100">
               <div className="flex items-center justify-between relative px-2">
                   <div className="absolute left-2 right-2 top-[5px] h-0.5 bg-slate-100 -z-10"></div>
                   {[
                     { label: 'Listed', active: true },
                     { label: 'Requested', active: posting.status === 'REQUESTED' || posting.status === 'IN_TRANSIT' || posting.status === 'DELIVERED' },
                     { label: 'Picked Up', active: posting.status === 'IN_TRANSIT' || posting.status === 'DELIVERED' },
                     { label: 'Delivered', active: posting.status === 'DELIVERED' }
                   ].map((step, idx) => (
                       <div key={idx} className="flex flex-col items-center bg-white px-1">
                           <div className={`w-3 h-3 rounded-full border-2 transition-colors duration-500 ${step.active ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-200'}`}></div>
                           <span className={`text-[9px] mt-1.5 font-bold uppercase tracking-wider transition-colors duration-500 ${step.active ? 'text-emerald-600' : 'text-slate-300'}`}>{step.label}</span>
                       </div>
                   ))}
               </div>
               
               {/* LIVE TRACK BUTTON */}
               {canTrackLive && (
                 <button 
                   onClick={() => setShowTracking(true)}
                   className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 transition-all font-bold text-xs uppercase tracking-wide shadow-md animate-pulse"
                 >
                   <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                   </span>
                   Track Live Location
                 </button>
               )}
            </div>
          )}

          <div className="flex flex-col space-y-2 mt-auto">
            {canRequest && (
              <button 
                onClick={() => onUpdate(posting.id, { 
                  status: FoodStatus.REQUESTED, 
                  orphanageId: user.id, 
                  orphanageName: user.orgName || user.name,
                  requesterAddress: user.address
                })}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Request Food
              </button>
            )}

            {canVolunteer && (
              <button 
                onClick={handleAcceptDelivery}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Accept Delivery
              </button>
            )}

            {canComplete && (
              <button 
                onClick={handleMarkDelivered}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Mark as Delivered
              </button>
            )}

            <button onClick={fetchTips} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center">
              {loadingTips ? '...' : showTips ? 'Hide Tips' : 'Safety Tips (AI)'}
            </button>
          </div>

          {showTips && tips && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs italic leading-relaxed">
              "{tips}"
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FoodCard;
