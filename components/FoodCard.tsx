
import React, { useState, useEffect, useRef } from 'react';
import { FoodPosting, FoodStatus, UserRole, User, Address } from '../types';
import { getFoodSafetyTips, getRouteInsights, verifyDeliveryImage } from '../services/geminiService';
import TrackingMap from './TrackingMap';
import ChatModal from './ChatModal';

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
  const [showChat, setShowChat] = useState(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expiration logic
  const expiryTime = new Date(posting.expiryDate).getTime();
  const now = Date.now();
  const isExpiringSoon = (expiryTime - now) < 86400000 && (expiryTime - now) > 0 && posting.status === FoodStatus.AVAILABLE;
  const isExpired = (expiryTime - now) <= 0 && posting.status === FoodStatus.AVAILABLE;

  useEffect(() => {
    if (isZoomed || showTracking || showChat || showAcceptConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isZoomed, showTracking, showChat, showAcceptConfirm]);

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
          window.open(info.mapsUrl, '_blank');
          setLoadingRoute(null);
        },
        async () => {
          const info = await getRouteInsights(destination);
          window.open(info.mapsUrl, '_blank');
          setLoadingRoute(null);
        }
      );
    } catch (err) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank');
      setLoadingRoute(null);
    }
  };

  const handleAcceptPickup = () => {
    onUpdate(posting.id, { 
      status: FoodStatus.IN_TRANSIT, 
      volunteerId: user.id, 
      volunteerName: user.name 
    });
    setShowAcceptConfirm(false);
  };

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsVerifying(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const result = await verifyDeliveryImage(base64);
        if (result.isValid) {
          alert(result.feedback);
          onUpdate(posting.id, { 
            status: FoodStatus.DELIVERED, 
            verificationImageUrl: base64 
          });
        } else {
          alert("Handover photo not clear. Please try again: " + result.feedback);
        }
        setIsVerifying(false);
      };
      reader.readAsDataURL(file);
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

  const canRequest = user.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE && !isExpired;
  const canVolunteer = user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.REQUESTED;
  const canComplete = user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.IN_TRANSIT && posting.volunteerId === user.id;

  const isVolunteerForThis = user.role === UserRole.VOLUNTEER && posting.volunteerId === user.id;
  const isParticipant = 
    (user.role === UserRole.DONOR && posting.donorId === user.id) || 
    (user.role === UserRole.REQUESTER && posting.orphanageId === user.id) || 
    isVolunteerForThis;
  
  const showChatButton = isParticipant && posting.status !== FoodStatus.AVAILABLE;

  return (
    <>
      {showTracking && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowTracking(false)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                  <h3 className="font-bold text-lg text-slate-800">Live Delivery Tracking</h3>
                  <p className="text-xs text-slate-500">Tracking {posting.volunteerName}'s vehicle</p>
               </div>
               <button onClick={() => setShowTracking(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
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
          </div>
        </div>
      )}

      {showChat && (
        <ChatModal 
          posting={posting} 
          user={user} 
          onClose={() => setShowChat(false)} 
        />
      )}

      {/* Accept Pickup Confirmation Modal */}
      {showAcceptConfirm && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Confirm Pickup</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">Are you sure you want to accept this pickup for <span className="text-slate-800 font-bold">"{posting.foodName}"</span>? You will be responsible for transporting it to the destination.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleAcceptPickup}
                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest text-xs"
              >
                Yes, Start Delivery
              </button>
              <button 
                onClick={() => setShowAcceptConfirm(false)}
                className="w-full bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-white rounded-xl shadow-sm border ${isExpiringSoon ? 'border-orange-500 ring-1 ring-orange-500/20' : isExpired ? 'border-red-400 opacity-75' : 'border-slate-200'} overflow-hidden hover:shadow-md transition-all flex flex-col relative`}>
        {posting.imageUrl && (
          <div className="group relative h-48 w-full overflow-hidden bg-slate-100 border-b border-slate-100 cursor-zoom-in" onClick={() => setIsZoomed(true)}>
            <img src={posting.imageUrl} alt={posting.foodName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div className="bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m4-3H6" /></svg>
              </div>
            </div>
            {(isExpiringSoon || isExpired) && (
              <div className={`absolute top-3 left-3 px-2 py-1 rounded shadow-lg flex items-center gap-1.5 animate-pulse z-10 ${isExpired ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <span className="text-[10px] font-black uppercase tracking-tighter">
                  {isExpired ? 'EXPIRED' : 'EXPIRING SOON'}
                </span>
              </div>
            )}
          </div>
        )}

        {isZoomed && posting.imageUrl && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsZoomed(false)}>
            <img src={posting.imageUrl} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
          </div>
        )}

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 mr-2">
              <h3 className="font-black text-lg text-slate-800 line-clamp-1">{posting.foodName}</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">By {posting.donorName}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${isExpired ? 'bg-red-100 text-red-700' : getStatusColor(posting.status)}`}>
                {isExpired ? 'EXPIRED' : posting.status}
              </span>
              {posting.status === FoodStatus.IN_TRANSIT && posting.etaMinutes !== undefined && (
                <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md animate-pulse shrink-0 border border-amber-100">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ETA: {posting.etaMinutes}M
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {posting.foodTags && posting.foodTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
               {posting.foodTags.map(tag => (
                 <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded-md border border-slate-200">
                   #{tag}
                 </span>
               ))}
            </div>
          )}

          <div className="space-y-3 mb-6">
            <div className="flex items-center text-sm text-slate-600 font-bold justify-between">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                Qty: {posting.quantity}
              </div>
              <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${isExpiringSoon ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'text-slate-400'}`}>
                Exp: {new Date(posting.expiryDate).toLocaleDateString()}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Pickup</span>
                  {user.role === UserRole.VOLUNTEER && posting.status !== FoodStatus.DELIVERED && (
                    <button onClick={() => handleGetRoute(posting.location, 'pickup')} className="text-blue-600 hover:underline font-black text-[9px] uppercase tracking-wider">Route</button>
                  )}
                </div>
                <p className="leading-relaxed opacity-75">{formatAddress(posting.location)}</p>
              </div>

              {posting.requesterAddress && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                   <div className="flex justify-between items-start mb-1">
                    <span className="font-black text-blue-700 uppercase text-[10px] tracking-widest">Drop-off</span>
                    {user.role === UserRole.VOLUNTEER && posting.status !== FoodStatus.DELIVERED && (
                      <button onClick={() => handleGetRoute(posting.requesterAddress!, 'dropoff')} className="text-blue-600 hover:underline font-black text-[9px] uppercase tracking-wider">Route</button>
                    )}
                  </div>
                  <p className="leading-relaxed opacity-75">{formatAddress(posting.requesterAddress)}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-tighter text-blue-400">Target: {posting.orphanageName}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2 mt-auto">
            {isExpired && (
              <div className="text-center py-2 bg-red-50 rounded-xl border border-red-100">
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">This posting has expired</p>
              </div>
            )}
            
            {canRequest && (
              <button 
                onClick={() => onUpdate(posting.id, { 
                  status: FoodStatus.REQUESTED, 
                  orphanageId: user.id, 
                  orphanageName: user.orgName || user.name,
                  requesterAddress: user.address
                })}
                className={`w-full text-white font-black py-2 rounded-xl transition-all shadow-md uppercase tracking-widest text-xs ${isExpiringSoon ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}
              >
                Request Food {isExpiringSoon && '(Urgent)'}
              </button>
            )}

            {canVolunteer && (
              <button 
                onClick={() => setShowAcceptConfirm(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-2 rounded-xl transition-all shadow-md uppercase tracking-widest text-xs"
              >
                Accept Pickup
              </button>
            )}

            {canComplete && (
              <div className="space-y-2">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleVerificationUpload} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isVerifying}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-2 rounded-xl transition-all shadow-md uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                   {isVerifying ? (
                     <div className="animate-spin h-3 w-3 border-b-2 border-white rounded-full"></div>
                   ) : (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                   )}
                   Verify Handover
                </button>
              </div>
            )}

            {showChatButton && (
              <button 
                onClick={() => setShowChat(true)}
                className="w-full bg-white border border-slate-200 text-slate-700 font-black py-2 rounded-xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Coordination Chat
              </button>
            )}
            
            <button onClick={fetchTips} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 text-[10px] font-black py-1.5 rounded-lg border border-slate-200 transition-all uppercase tracking-widest">
              {loadingTips ? 'Thinking...' : 'Safety Tips (AI)'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FoodCard;
