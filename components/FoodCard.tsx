
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
  const [showDetails, setShowDetails] = useState(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expiration logic
  const expiryTime = new Date(posting.expiryDate).getTime();
  const now = Date.now();
  const isExpiringSoon = (expiryTime - now) < 86400000 && (expiryTime - now) > 0 && posting.status === FoodStatus.AVAILABLE;
  const isExpired = (expiryTime - now) <= 0 && posting.status === FoodStatus.AVAILABLE;

  // Volunteer Interest Logic
  const interestedVolunteers = posting.interestedVolunteers || [];
  const hasExpressedInterest = user.role === UserRole.VOLUNTEER && interestedVolunteers.some(v => v.userId === user.id);
  const interestCount = interestedVolunteers.length;

  useEffect(() => {
    if (isZoomed || showTracking || showChat || showAcceptConfirm || showDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isZoomed, showTracking, showChat, showAcceptConfirm, showDetails]);

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

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}?post=${posting.id}`;
    navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
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

  // Logic for Volunteer expressing interest
  const handleExpressInterest = () => {
    if (hasExpressedInterest) return;
    const updatedInterests = [...interestedVolunteers, { userId: user.id, userName: user.name }];
    onUpdate(posting.id, { interestedVolunteers: updatedInterests });
  };

  // Logic for Donor Approving a Volunteer
  const handleApproveVolunteer = (volId: string, volName: string) => {
      onUpdate(posting.id, { 
        status: FoodStatus.IN_TRANSIT, 
        volunteerId: volId, 
        volunteerName: volName,
        volunteerLocation: (posting.location.lat !== undefined && posting.location.lng !== undefined) 
          ? { lat: posting.location.lat, lng: posting.location.lng } 
          : undefined,
        interestedVolunteers: [] // Clear interest list on assignment
      });
      setShowDetails(false); // Close modal
  };

  // Legacy direct accept (still useful if no specific interest flow needed or for quick testing)
  const handleAcceptPickup = () => {
    onUpdate(posting.id, { 
      status: FoodStatus.IN_TRANSIT, 
      volunteerId: user.id, 
      volunteerName: user.name,
      volunteerLocation: (posting.location.lat !== undefined && posting.location.lng !== undefined) 
        ? { lat: posting.location.lat, lng: posting.location.lng } 
        : undefined
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
  
  // Volunteer can only see "Accept Pickup" (Direct) if status is REQUESTED (by Orphanage)
  const canDirectVolunteer = user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.REQUESTED;
  
  // Volunteer can Express Interest if status is AVAILABLE
  const canExpressInterest = user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.AVAILABLE && !isExpired;
  
  const canComplete = user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.IN_TRANSIT && posting.volunteerId === user.id;

  const isVolunteerForThis = user.role === UserRole.VOLUNTEER && posting.volunteerId === user.id;
  const isDonorForThis = user.role === UserRole.DONOR && posting.donorId === user.id;

  const isParticipant = 
    isDonorForThis || 
    (user.role === UserRole.REQUESTER && posting.orphanageId === user.id) || 
    isVolunteerForThis;
  
  const showChatButton = isParticipant && posting.status !== FoodStatus.AVAILABLE;
  const showTrackDeliveryButton = isVolunteerForThis && posting.status === FoodStatus.IN_TRANSIT;

  return (
    <>
      {/* Full Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-[140] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowDetails(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200 shadow-2xl custom-scrollbar" onClick={(e) => e.stopPropagation()}>
             
             {/* Close Button */}
             <button 
               onClick={() => setShowDetails(false)}
               className="absolute top-4 right-4 z-20 p-2 bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 rounded-full backdrop-blur-sm transition-all shadow-sm"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             {/* Header Image */}
             {posting.imageUrl && (
               <div className="h-64 w-full relative group">
                  <img src={posting.imageUrl} className="w-full h-full object-cover" alt={posting.foodName} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10"></div>
               </div>
             )}

             <div className={`p-6 sm:p-8 ${!posting.imageUrl ? 'pt-12' : ''}`}>
                {/* Title Section */}
                <div className="mb-6">
                    <div className="flex flex-wrap gap-2 mb-3">
                         <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusColor(posting.status)}`}>
                            {posting.status}
                         </span>
                         {posting.expiryDate && (
                             <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                                Expires: {new Date(posting.expiryDate).toLocaleDateString()}
                             </span>
                         )}
                         {isExpiringSoon && (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                                Expiring Soon
                            </span>
                         )}
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">{posting.foodName}</h2>
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 text-xs font-bold uppercase tracking-wider">Donor</span>
                        {posting.donorName}
                    </p>
                </div>

                {/* Donor Review Section for Volunteers */}
                {isDonorForThis && posting.status === FoodStatus.AVAILABLE && interestedVolunteers.length > 0 && (
                    <div className="mb-8 border-2 border-emerald-100 rounded-2xl overflow-hidden">
                        <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center justify-between">
                            <h3 className="font-black text-emerald-800 uppercase tracking-widest text-xs flex items-center gap-2">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Volunteer Requests ({interestedVolunteers.length})
                            </h3>
                        </div>
                        <div className="divide-y divide-emerald-50">
                            {interestedVolunteers.map((vol) => (
                                <div key={vol.userId} className="p-4 flex items-center justify-between hover:bg-emerald-50/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-sm">
                                            {vol.userName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{vol.userName}</p>
                                            <p className="text-[10px] text-emerald-600 font-medium">Ready to pickup</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleApproveVolunteer(vol.userId, vol.userName)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors shadow-sm"
                                    >
                                        Approve
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Quantity</h4>
                         <p className="text-lg font-bold text-slate-800">{posting.quantity}</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Posted</h4>
                         <p className="text-lg font-bold text-slate-800">{new Date(posting.createdAt).toLocaleDateString()}</p>
                     </div>
                </div>

                {/* Locations */}
                <div className="space-y-4 mb-8">
                     <div className="flex gap-4">
                         <div className="flex flex-col items-center">
                             <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                             </div>
                             {posting.requesterAddress && <div className="w-0.5 h-full bg-slate-200 my-1"></div>}
                         </div>
                         <div className="pb-4">
                             <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Pickup Location</h4>
                             <p className="text-sm font-medium text-slate-700">{formatAddress(posting.location)}</p>
                         </div>
                     </div>

                     {posting.requesterAddress && (
                         <div className="flex gap-4">
                             <div className="flex flex-col items-center">
                                 <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                                 </div>
                             </div>
                             <div>
                                 <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Drop-off: {posting.orphanageName}</h4>
                                 <p className="text-sm font-medium text-slate-700">{formatAddress(posting.requesterAddress)}</p>
                             </div>
                         </div>
                     )}
                </div>

                {/* AI Safety Analysis */}
                {posting.safetyVerdict && (
                    <div className="bg-slate-900 rounded-2xl p-5 text-white mb-6">
                        <div className="flex items-center gap-2 mb-3">
                             <div className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">AI Verified</div>
                             <span className="text-xs font-bold text-slate-400">Food Safety Analysis</span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-300 italic">"{posting.safetyVerdict.reasoning}"</p>
                    </div>
                )}
                
                {/* Volunteer Info */}
                {posting.volunteerName && (
                    <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 mb-6">
                        <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-2">Volunteer Assigned</h4>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold">
                                {posting.volunteerName.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{posting.volunteerName}</p>
                                {posting.status === FoodStatus.IN_TRANSIT && (
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider animate-pulse">● In Transit</span>
                                )}
                                {posting.status === FoodStatus.DELIVERED && (
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">● Delivered</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Verification Image */}
                {posting.verificationImageUrl && (
                    <div>
                         <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Delivery Verification</h4>
                         <div className="rounded-2xl overflow-hidden border border-slate-200">
                             <img src={posting.verificationImageUrl} alt="Delivery Proof" className="w-full h-auto" />
                         </div>
                    </div>
                )}
             </div>
             
             {/* Footer Actions in Modal */}
             <div className="p-6 border-t border-slate-100 bg-slate-50 sticky bottom-0 z-10 flex gap-3">
                 <button onClick={() => setShowDetails(false)} className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-100 transition-colors uppercase tracking-widest text-xs">Close</button>
                 <button onClick={handleShare} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                     {copied ? 'Link Copied' : 'Share Posting'}
                 </button>
             </div>
          </div>
        </div>
      )}

      {showTracking && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowTracking(false)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">Live Delivery Tracking</h3>
                    <p className="text-xs text-slate-500">Tracking {posting.volunteerName}'s progress</p>
                  </div>
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
            <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">Are you sure you want to accept this pickup?</p>
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

      <div className={`bg-white rounded-xl shadow-sm border ${isExpiringSoon ? 'border-orange-500 ring-2 ring-orange-500/50' : isExpired ? 'border-red-400 opacity-75' : 'border-slate-200'} overflow-hidden hover:shadow-md transition-all flex flex-col relative`}>
        {posting.imageUrl && (
          <div className="group relative h-48 w-full overflow-hidden bg-slate-100 border-b border-slate-100 cursor-zoom-in" onClick={() => setIsZoomed(true)}>
            <img src={posting.imageUrl} alt={posting.foodName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            
            {/* AI Verification Badge & Reasoning */}
            {posting.safetyVerdict?.isSafe && (
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1 max-w-[70%]">
                    <span className="bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        AI Verified
                    </span>
                    {posting.safetyVerdict.reasoning && (
                        <div className="bg-black/60 backdrop-blur-md text-white text-[9px] p-2 rounded-lg text-right shadow-sm border border-white/10">
                            {posting.safetyVerdict.reasoning}
                        </div>
                    )}
                </div>
            )}
            
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center z-0 pointer-events-none">
              <div className="bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m4-3H6" /></svg>
              </div>
            </div>
          </div>
        )}

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 mr-2">
              <h3 className="font-black text-lg text-slate-800 line-clamp-1">{posting.foodName}</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">By {posting.donorName}</p>
              {posting.status === FoodStatus.IN_TRANSIT && posting.volunteerName && (
                <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">
                        Vol: {posting.volunteerName}
                    </p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${isExpired ? 'bg-red-100 text-red-700' : getStatusColor(posting.status)}`}>
                {isExpired ? 'EXPIRED' : posting.status}
              </span>

              {/* Expiring Soon Tag */}
              {isExpiringSoon && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                    Expiring Soon
                </span>
              )}

              {/* Interested Volunteers Count (Visible to Donor) */}
              {isDonorForThis && posting.status === FoodStatus.AVAILABLE && interestCount > 0 && (
                 <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 bg-purple-100 text-purple-700 border border-purple-200 animate-pulse">
                    {interestCount} Volunteer{interestCount !== 1 ? 's' : ''} Interested
                 </span>
              )}

              {posting.status === FoodStatus.IN_TRANSIT && posting.etaMinutes !== undefined && (
                <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md animate-pulse shrink-0 border border-amber-100">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ETA: {posting.etaMinutes}M
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center text-sm text-slate-600 font-bold justify-between">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                Qty: {posting.quantity}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                <span className="font-black text-slate-700 uppercase text-[10px] tracking-widest block mb-1">Pickup</span>
                <p className="leading-relaxed opacity-75">{formatAddress(posting.location)}</p>
              </div>

              {posting.requesterAddress && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                  <span className="font-black text-blue-700 uppercase text-[10px] tracking-widest block mb-1">Drop-off</span>
                  <p className="leading-relaxed opacity-75">{formatAddress(posting.requesterAddress)}</p>
                </div>
              )}

              <button 
                onClick={() => setShowDetails(true)} 
                className="w-full text-center text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline py-1 transition-all"
              >
                View Full Details
              </button>
            </div>
          </div>

          <div className="flex flex-col space-y-2 mt-auto">
            {showTrackDeliveryButton && (
              <button 
                onClick={() => setShowTracking(true)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2 rounded-xl transition-all shadow-md shadow-amber-100 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                Track Delivery
              </button>
            )}

            {canRequest && (
              <button 
                onClick={() => onUpdate(posting.id, { 
                  status: FoodStatus.REQUESTED, 
                  orphanageId: user.id, 
                  orphanageName: user.orgName || user.name,
                  requesterAddress: user.address
                })}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl transition-all shadow-md uppercase tracking-widest text-xs"
              >
                Request Food
              </button>
            )}

            {/* Volunteer: Express Interest (For AVAILABLE postings) */}
            {canExpressInterest && (
                <button
                    onClick={handleExpressInterest}
                    disabled={hasExpressedInterest}
                    className={`w-full font-black py-2 rounded-xl transition-all shadow-md uppercase tracking-widest text-xs ${
                        hasExpressedInterest 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200'
                    }`}
                >
                    {hasExpressedInterest ? 'Interest Sent' : 'Express Interest in Pickup'}
                </button>
            )}

            {canDirectVolunteer && (
              <button 
                onClick={() => setShowAcceptConfirm(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-2 rounded-xl transition-all shadow-md uppercase tracking-widest text-xs"
              >
                Accept Pickup
              </button>
            )}

            {canComplete && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isVerifying}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-2 rounded-xl transition-all shadow-md uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleVerificationUpload} />
                 Verify Handover
              </button>
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
            
            <div className="flex gap-2">
              <button onClick={fetchTips} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-500 text-[10px] font-black py-2 rounded-lg border border-slate-200 transition-all uppercase tracking-widest">
                {loadingTips ? 'Thinking...' : 'Safety Tips (AI)'}
              </button>
              <button onClick={handleShare} className={`px-4 py-2 rounded-lg border transition-all flex items-center justify-center ${copied ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-slate-100'}`} title="Share Posting">
                 {copied ? (
                     <span className="text-[10px] font-black uppercase tracking-widest">Copied!</span>
                 ) : (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                 )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FoodCard;
