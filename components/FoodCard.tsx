
import React, { useState, useRef } from 'react';
import { FoodPosting, User, UserRole, FoodStatus } from '../types';
import { verifyDeliveryImage, verifyPickupImage } from '../services/geminiService';
import DirectionsModal from './DirectionsModal';
import LiveTrackingModal from './LiveTrackingModal';
import RatingModal from './RatingModal';

interface FoodCardProps {
  posting: FoodPosting;
  user: User;
  onUpdate: (id: string, updates: Partial<FoodPosting>) => void;
  onDelete?: (id: string) => void;
  currentLocation?: { lat: number; lng: number };
  onRateVolunteer?: (postingId: string, rating: number, feedback: string) => void;
  volunteerProfile?: User; // Pass the full volunteer object if available
}

const FoodCard: React.FC<FoodCardProps> = ({ posting, user, onUpdate, onDelete, currentLocation, onRateVolunteer, volunteerProfile }) => {
  const [showDirections, setShowDirections] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  
  const expiryTimestamp = new Date(posting.expiryDate).getTime();
  const hoursLeft = (expiryTimestamp - Date.now()) / (1000 * 60 * 60);
  const isUrgent = posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && hoursLeft < 12;

  // Visual expiry indicator logic
  const getExpiryStatus = () => {
      if (hoursLeft <= 0) return { color: 'text-slate-400', bar: 'bg-slate-300', label: 'Expired' };
      if (hoursLeft < 4) return { color: 'text-rose-600', bar: 'bg-rose-500', label: 'Critical' };
      if (hoursLeft < 12) return { color: 'text-orange-600', bar: 'bg-orange-500', label: 'Urgent' };
      if (hoursLeft < 24) return { color: 'text-amber-600', bar: 'bg-amber-500', label: 'Expiring Soon' };
      return { color: 'text-emerald-600', bar: 'bg-emerald-500', label: 'Fresh' };
  };
  
  const expiryStatus = getExpiryStatus();
  
  // Check if current user has already rated this specific posting
  const hasRated = posting.ratings?.some(r => r.raterId === user.id);
  const isSafetyUnknownOrUnsafe = posting.safetyVerdict && !posting.safetyVerdict.isSafe;

  // Progress Bar Logic
  const getProgressStep = () => {
      switch(posting.status) {
          case FoodStatus.AVAILABLE: return 1;
          case FoodStatus.REQUESTED: return 2;
          case FoodStatus.PICKUP_VERIFICATION_PENDING: return 2; // Still in pickup phase
          case FoodStatus.IN_TRANSIT: return 3;
          case FoodStatus.DELIVERED: return 4;
          default: return 0;
      }
  };
  const activeStep = getProgressStep();

  const handleRequest = () => {
    onUpdate(posting.id, {
      status: FoodStatus.REQUESTED,
      orphanageId: user.id,
      orphanageName: user.orgName || user.name,
      requesterAddress: user.address
    });
  };

  const handleExpressInterest = () => {
    const updated = [...(posting.interestedVolunteers || []), { userId: user.id, userName: user.name }];
    onUpdate(posting.id, { interestedVolunteers: updated });
  };

  const handleManualSafetyOverride = () => {
    if (confirm("Are you sure you want to mark this food as safe? This will override the AI safety warning.")) {
        onUpdate(posting.id, {
            safetyVerdict: {
                isSafe: true,
                reasoning: "Manually verified by donor as safe."
            }
        });
    }
  };

  const handleDelete = () => {
      if (onDelete) {
          onDelete(posting.id);
      }
  };

  const handleShare = async () => {
    try {
      const shareData = {
        title: `Food Rescue: ${posting.foodName}`,
        text: `Help rescue food! ${posting.quantity} of ${posting.foodName} available at ${posting.location.line1}.`,
        url: window.location.href
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
        alert('Details copied to clipboard!');
      }
    } catch (err) {
      console.log('Share cancelled or failed');
    }
  };

  const handlePickupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPickingUp(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
            const result = await verifyPickupImage(base64);
            if (result.isValid) {
                // Determine next status and update
                const nextStatus = FoodStatus.PICKUP_VERIFICATION_PENDING;
                const alertMsg = "Pickup proof uploaded! Waiting for Donor approval.";

                onUpdate(posting.id, { 
                    status: nextStatus, 
                    pickupVerificationImageUrl: base64,
                    volunteerId: user.id,
                    volunteerName: user.name,
                    volunteerLocation: currentLocation
                });
                alert(alertMsg);
            } else {
                alert(`Pickup Verification Failed: ${result.feedback}`);
            }
        } catch (error) {
            console.error(error);
            alert("Error verifying pickup image.");
        } finally {
            setIsPickingUp(false);
            if (pickupInputRef.current) pickupInputRef.current.value = '';
        }
    };
    reader.readAsDataURL(file);
  };

  const handleVerificationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVerifying(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
            const result = await verifyDeliveryImage(base64);
            if (result.isValid) {
                alert(`Verification Successful: ${result.feedback}`);
                onUpdate(posting.id, { 
                    status: FoodStatus.DELIVERED, 
                    verificationImageUrl: base64 
                });
            } else {
                alert(`Verification Failed: ${result.feedback}`);
            }
        } catch (error) {
            console.error(error);
            alert("Error verifying image.");
        } finally {
            setIsVerifying(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsDataURL(file);
  };

  const getOriginString = () => {
      if (currentLocation) return `${currentLocation.lat},${currentLocation.lng}`;
      if (user.address) return `${user.address.line1}, ${user.address.line2}, ${user.address.pincode}`;
      return '';
  };

  const getDestinationString = () => {
      if (posting.requesterAddress) {
          const addr = posting.requesterAddress;
          return `${addr.line1}, ${addr.line2}, ${addr.landmark || ''}, ${addr.pincode}`;
      }
      return '';
  };

  const getPickupString = () => {
      const addr = posting.location;
      return `${addr.line1}, ${addr.line2}, ${addr.landmark || ''}, ${addr.pincode}`;
  };

  const mapsQuery = encodeURIComponent(`${posting.location.line1}, ${posting.location.line2}, ${posting.location.landmark || ''}, ${posting.location.pincode}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const renderStatusPill = () => {
      switch (posting.status) {
          case FoodStatus.AVAILABLE:
              return <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Available</span>;
          case FoodStatus.REQUESTED:
              return <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>Requested</span>;
          case FoodStatus.PICKUP_VERIFICATION_PENDING:
              return <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Verifying</span>;
          case FoodStatus.IN_TRANSIT:
              return <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>In Transit</span>;
          case FoodStatus.DELIVERED:
              return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span>Delivered</span>;
          default:
              return null;
      }
  };

  const isAssignedToOther = posting.volunteerId && posting.volunteerId !== user.id;

  return (
    <div className={`group rounded-[2.5rem] p-5 bg-white transition-all duration-300 relative overflow-hidden flex flex-col h-full ${isUrgent ? 'ring-2 ring-rose-100 shadow-xl shadow-rose-100/50' : 'border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1'}`}>
      
      {/* Image Section */}
      <div className="h-48 rounded-[2rem] overflow-hidden mb-5 relative shrink-0 z-0">
        {posting.imageUrl ? (
            <img src={posting.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : (
            <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs font-bold uppercase">No Image</span>
            </div>
        )}
        
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80"></div>
        
        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
             {renderStatusPill()}
             {posting.etaMinutes && (
                 <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg bg-blue-500/90 text-white flex items-center gap-1 border border-white/10">
                    <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ETA: {posting.etaMinutes} mins
                 </span>
             )}
        </div>

        <div className="absolute bottom-5 left-5 text-white right-5">
            <div className="flex items-center gap-2 mb-2">
                 <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-white/20 tracking-wider shadow-sm">{posting.quantity}</span>
                 {isUrgent && <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase animate-pulse shadow-lg shadow-rose-900/20">Expires Soon</span>}
            </div>
            <h3 className="font-black text-xl leading-tight text-white line-clamp-2 drop-shadow-md" title={posting.foodName}>{posting.foodName}</h3>
            {posting.foodTags && (
                <div className="flex gap-1 mt-2">
                    {posting.foodTags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] bg-black/40 px-2 py-0.5 rounded text-white/90">{tag}</span>
                    ))}
                </div>
            )}
        </div>

        {/* Safety Warning Overlay */}
        {isSafetyUnknownOrUnsafe && (
             <div className="absolute inset-0 bg-rose-900/80 backdrop-blur-sm flex items-center justify-center p-6 text-center z-20">
                 <div>
                     <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-rose-500 shadow-2xl">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                     </div>
                     <p className="text-white font-black text-sm uppercase tracking-wider mb-4">Safety Check Failed</p>
                     {user.role === UserRole.DONOR && posting.donorId === user.id && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleManualSafetyOverride(); }}
                            className="bg-white text-rose-600 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-rose-50 transition-colors shadow-lg uppercase tracking-wide"
                        >
                            Mark Verified Safe
                        </button>
                     )}
                 </div>
             </div>
        )}
      </div>

      {/* Progress Stepper - Hide if delivered to reduce clutter in history */}
      {posting.status !== FoodStatus.DELIVERED && (
        <div className="px-2 mb-6">
            <div className="flex items-center justify-between mb-2">
                {['Posted', 'Claimed', 'Transit', 'Done'].map((step, idx) => {
                    const stepNum = idx + 1;
                    const isActive = stepNum <= activeStep;
                    const isCurrent = stepNum === activeStep;
                    
                    return (
                        <div key={step} className="flex flex-col items-center flex-1 relative">
                            <div className={`w-3 h-3 rounded-full z-10 transition-colors duration-500 ${isActive ? 'bg-emerald-500 ring-4 ring-emerald-50' : 'bg-slate-200'}`}></div>
                            {idx < 3 && (
                               <div className={`absolute top-1.5 left-[50%] w-full h-0.5 -z-0 transition-colors duration-500 ${stepNum < activeStep ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                            )}
                            <span className={`text-[8px] uppercase font-black tracking-wider mt-2 ${isCurrent ? 'text-emerald-700' : isActive ? 'text-slate-500' : 'text-slate-300'}`}>{step}</span>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* Content Section */}
      <div className={`flex-1 flex flex-col ${isSafetyUnknownOrUnsafe ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Donated By</p>
                {posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && (
                    <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                         <span className={`w-2 h-2 rounded-full ${expiryStatus.bar.replace('bg-', 'bg-')}`}></span>
                         <span className={`text-[10px] font-bold uppercase ${expiryStatus.color}`}>{hoursLeft < 24 ? `${Math.floor(hoursLeft)}h left` : `${Math.floor(hoursLeft / 24)}d left`}</span>
                    </div>
                )}
            </div>
            
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[10px] text-slate-600">
                    {posting.donorName.charAt(0)}
                </div>
                {posting.donorOrg || posting.donorName}
            </p>

            {posting.description && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                    <p className="text-xs text-slate-600 font-medium italic leading-relaxed line-clamp-2">"{posting.description}"</p>
                </div>
            )}
          </div>
          
          <div className="space-y-4 mb-4 flex-1">
              {posting.volunteerName && (
                  <div className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                     {volunteerProfile?.profilePictureUrl ? (
                       <img src={volunteerProfile.profilePictureUrl} className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0 ring-2 ring-white" alt={posting.volunteerName} />
                     ) : (
                       <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-black text-xs ring-2 ring-white">
                          {posting.volunteerName.charAt(0)}
                       </div>
                     )}
                     <div>
                         <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider mb-0.5">Volunteer</p>
                         <p className="text-xs font-bold text-slate-800 leading-snug">{posting.volunteerName}</p>
                     </div>
                  </div>
              )}

              <div className="flex items-start gap-3 p-2 -mx-2 rounded-2xl hover:bg-slate-50 transition-colors group/loc">
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 group-hover/loc:bg-white group-hover/loc:text-emerald-500 shadow-sm border border-slate-200 group-hover/loc:border-emerald-100 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </div>
                 <div className="flex-1 min-w-0 pt-0.5">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Pickup Location</p>
                     <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-1">
                        {posting.location.line1}
                     </p>
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(mapsUrl, '_blank');
                        }}
                        className="mt-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-blue-600 flex items-center gap-1.5 transition-colors group/btn"
                    >
                        Open Maps
                        <svg className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </button>
                 </div>
              </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-[1fr_auto] gap-3 pt-4 border-t border-slate-100">
            {user.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE && (
              <button onClick={handleRequest} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5">
                Request Pickup
              </button>
            )}
            
            {user.role === UserRole.REQUESTER && posting.status === FoodStatus.IN_TRANSIT && (
              <button 
                onClick={() => setShowTracking(true)} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-200 animate-pulse hover:animate-none transition-colors"
              >
                Track Live
              </button>
            )}

            {user.role === UserRole.REQUESTER && (posting.status === FoodStatus.IN_TRANSIT || posting.status === FoodStatus.DELIVERED) && (
              <>
                <button 
                  onClick={() => !posting.verificationImageUrl && fileInputRef.current?.click()} 
                  disabled={isVerifying || !!posting.verificationImageUrl}
                  className={`font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${
                    posting.verificationImageUrl 
                      ? 'bg-slate-100 text-slate-400 shadow-none cursor-default border border-slate-200' 
                      : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200 hover:-translate-y-0.5'
                  }`}
                >
                  {isVerifying ? (
                     <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Verifying...
                     </>
                  ) : posting.verificationImageUrl ? (
                     <>
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Verified
                     </>
                  ) : (
                     <>
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                       {posting.status === FoodStatus.IN_TRANSIT ? 'Verify & Receive' : 'Upload Proof'}
                     </>
                  )}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleVerificationUpload} />
              </>
            )}

            {user.role === UserRole.REQUESTER && posting.status === FoodStatus.DELIVERED && !hasRated && onRateVolunteer && posting.volunteerId && (
              <button 
                onClick={() => setShowRating(true)} 
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-yellow-200 hover:-translate-y-0.5 transition-all"
              >
                Rate Volunteer
              </button>
            )}

            {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.AVAILABLE && (
              <button onClick={handleExpressInterest} className="bg-purple-600 hover:bg-purple-700 text-white font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-purple-200 hover:shadow-purple-300 hover:-translate-y-0.5">
                Volunteer
              </button>
            )}

            {/* Hidden Input for Pickup Proof */}
            {user.role === UserRole.VOLUNTEER && (posting.status === FoodStatus.REQUESTED || posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING) && (
              <input type="file" ref={pickupInputRef} className="hidden" accept="image/*" onChange={handlePickupUpload} />
            )}

            {/* Verify Pickup Button for Volunteers */}
            {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.REQUESTED && !isAssignedToOther && (
              <button
                onClick={() => pickupInputRef.current?.click()}
                disabled={isPickingUp}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-6 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all hover:-translate-y-0.5"
              >
                {isPickingUp ? (
                   <>
                     <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     Verifying Pickup...
                   </>
                ) : (
                   <>
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                     Verify Pickup
                   </>
                )}
              </button>
            )}
            
            {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING && (
                 <div className="flex flex-col gap-2 w-full">
                     <div className="bg-amber-50 text-amber-700 font-bold px-3 py-3 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 border border-amber-100">
                         <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         Waiting for Donor Approval
                     </div>
                 </div>
            )}
            
            {user.role === UserRole.VOLUNTEER && posting.volunteerId === user.id && posting.status === FoodStatus.IN_TRANSIT && (
                <div className="flex gap-2 w-full">
                    {posting.requesterAddress && (
                        <button 
                            onClick={() => setShowDirections(true)} 
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all"
                        >
                            Directions
                        </button>
                    )}
                    <button 
                        onClick={() => onUpdate(posting.id, { status: FoodStatus.DELIVERED })}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 hover:-translate-y-0.5 transition-all"
                    >
                        Mark Delivered
                    </button>
                </div>
            )}

            {/* Donor Actions */}
            {user.role === UserRole.DONOR && posting.status === FoodStatus.AVAILABLE && (
                <div className="flex gap-2 w-full">
                    <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400 italic bg-slate-50 rounded-xl">
                        Waiting for request...
                    </div>
                    {onDelete && (
                        <button 
                            onClick={handleDelete}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl p-3 transition-colors"
                            title="Delete Donation"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                </div>
            )}

            <div className="flex items-center gap-2">
                <button onClick={handleShare} className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-colors border border-slate-100" title="Share">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </button>
            </div>
          </div>
      </div>

      {/* Modals */}
      {showDirections && (
          <DirectionsModal 
            origin={getOriginString()} 
            destination={getDestinationString()} 
            waypoint={getPickupString()}
            onClose={() => setShowDirections(false)} 
          />
      )}
      {showTracking && (
          <LiveTrackingModal
            posting={posting}
            onClose={() => setShowTracking(false)}
          />
      )}
      {showRating && posting.volunteerName && onRateVolunteer && (
          <RatingModal
             volunteerName={posting.volunteerName}
             onClose={() => setShowRating(false)}
             onSubmit={(rating, feedback) => {
                 onRateVolunteer(posting.id, rating, feedback);
                 setShowRating(false);
             }}
          />
      )}
    </div>
  );
};

export default FoodCard;
