
import React, { useState, useEffect } from 'react';
import { FoodPosting, User, UserRole, FoodStatus } from '../types';
import { verifyDeliveryImage, getOptimizedRoute, RouteOptimizationResult } from '../services/geminiService';
import { storage } from '../services/storageService';
import ChatModal from './ChatModal';
import TrackingMap from './TrackingMap';

interface FoodCardProps {
  posting: FoodPosting;
  user: User;
  onUpdate: (id: string, updates: Partial<FoodPosting>) => void;
}

const FoodCard: React.FC<FoodCardProps> = ({ posting, user, onUpdate }) => {
  const [showChat, setShowChat] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVolunteerSelection, setShowVolunteerSelection] = useState(false);
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<{id: string, name: string} | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  
  // ETA Editing State
  const [isEditingEta, setIsEditingEta] = useState(false);
  const [etaInput, setEtaInput] = useState('');
  
  // Route Optimization State
  const [routeData, setRouteData] = useState<RouteOptimizationResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showRoute, setShowRoute] = useState(false);

  // Location Sharing State
  const [isSharingLocation, setIsSharingLocation] = useState(false);

  useEffect(() => {
    const checkMessages = () => {
        const msgs = storage.getMessages(posting.id);
        setMessageCount(msgs.length);
    };
    
    checkMessages();
    // Poll for new messages to update badge
    const interval = setInterval(checkMessages, 3000);
    return () => clearInterval(interval);
  }, [posting.id]);

  const interestedVolunteers = posting.interestedVolunteers || [];
  const hasExpressedInterest = user.role === UserRole.VOLUNTEER && interestedVolunteers.some(v => v.userId === user.id);

  const handleRequest = () => {
    if (user.role !== UserRole.REQUESTER) return;
    const updates: Partial<FoodPosting> = {
      status: FoodStatus.REQUESTED,
      orphanageId: user.id,
      orphanageName: user.orgName || user.name,
      requesterAddress: user.address
    };
    onUpdate(posting.id, updates);
  };

  const handleVolunteer = () => {
    if (user.role !== UserRole.VOLUNTEER) return;
    const updates: Partial<FoodPosting> = {
      status: FoodStatus.IN_TRANSIT,
      volunteerId: user.id,
      volunteerName: user.name,
      volunteerLocation: user.address ? { lat: user.address.lat || 0, lng: user.address.lng || 0 } : undefined,
      etaMinutes: 30 // Initial estimate
    };
    onUpdate(posting.id, updates);
  };

  const handleExpressInterest = () => {
    if (hasExpressedInterest) return;
    const updatedInterests = [...interestedVolunteers, { userId: user.id, userName: user.name }];
    onUpdate(posting.id, { interestedVolunteers: updatedInterests });
  };

  const initiateAssignment = (volId: string, volName: string) => {
    setSelectedVolunteer({ id: volId, name: volName });
    setShowAssignConfirm(true);
  };

  const confirmAssignment = () => {
    if (!selectedVolunteer) return;
    onUpdate(posting.id, {
        status: FoodStatus.IN_TRANSIT,
        volunteerId: selectedVolunteer.id,
        volunteerName: selectedVolunteer.name,
        volunteerLocation: (posting.location.lat && posting.location.lng) ? { lat: posting.location.lat, lng: posting.location.lng } : undefined,
        interestedVolunteers: [] // Clear list on assignment
    });
    setShowAssignConfirm(false);
    setShowVolunteerSelection(false);
    setSelectedVolunteer(null);
  };

  const handleDeliveryVerification = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsVerifying(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
            const verification = await verifyDeliveryImage(base64);
            if (verification.isValid) {
                onUpdate(posting.id, {
                    status: FoodStatus.DELIVERED,
                    verificationImageUrl: base64
                });
                alert(`Delivery Verified! ${verification.feedback}`);
            } else {
                alert(`Verification Failed: ${verification.feedback}`);
            }
        } catch (error) {
            console.error("Verification Error", error);
            alert("Verification failed due to an error.");
        }
        setIsVerifying(false);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const saveEta = () => {
    const mins = parseInt(etaInput);
    if (!isNaN(mins) && mins >= 0) {
        onUpdate(posting.id, { etaMinutes: mins });
        setIsEditingEta(false);
    } else {
        alert("Please enter a valid number of minutes.");
    }
  };

  const handleOptimizeRoute = async () => {
    if (!posting.location || !posting.requesterAddress) return;
    
    setLoadingRoute(true);
    const origin = `${posting.location.line1}, ${posting.location.line2}, ${posting.location.landmark || ''}, ${posting.location.pincode}`;
    const destination = `${posting.requesterAddress.line1}, ${posting.requesterAddress.line2}, ${posting.requesterAddress.landmark || ''}, ${posting.requesterAddress.pincode}`;
    
    try {
        const result = await getOptimizedRoute(origin, destination);
        if (result) {
            setRouteData(result);
        } else {
            alert("Could not calculate route at this time.");
        }
    } catch (e) {
        console.error(e);
        alert("Error connecting to route service.");
    } finally {
        setLoadingRoute(false);
    }
  };

  const handleShareLocation = () => {
    setIsSharingLocation(true);
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        setIsSharingLocation(false);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            onUpdate(posting.id, {
                volunteerLocation: { lat: latitude, lng: longitude }
            });
            setIsSharingLocation(false);
        },
        (error) => {
            console.error("Error getting location", error);
            alert("Unable to retrieve your location.");
            setIsSharingLocation(false);
        }
    );
  };

  const isInvolved = 
    posting.donorId === user.id || 
    posting.orphanageId === user.id || 
    posting.volunteerId === user.id;

  const getStatusBadge = () => {
    if (posting.status === FoodStatus.AVAILABLE) {
        const expiry = new Date(posting.expiryDate).getTime();
        const now = Date.now();
        const hoursLeft = (expiry - now) / (1000 * 60 * 60);

        if (hoursLeft > 0 && hoursLeft < 12) {
             return (
                <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-600 border border-rose-200 flex items-center gap-1 shadow-sm animate-pulse">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Urgent
                </span>
             );
        }
        return <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Available</span>;
    }

    switch(posting.status) {
      case FoodStatus.REQUESTED: return <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700">Requested</span>;
      case FoodStatus.IN_TRANSIT: return <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 animate-pulse">In Transit</span>;
      case FoodStatus.DELIVERED: return <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">Delivered</span>;
      default: return null;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
      {/* Image Section */}
      <div className="relative mb-4">
        {posting.imageUrl ? (
          <img src={posting.imageUrl} alt={posting.foodName} className="w-full h-48 object-cover rounded-2xl" />
        ) : (
          <div className="w-full h-48 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
        {posting.safetyVerdict?.isSafe && (
            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Safe
            </div>
        )}
      </div>

      <div className="flex justify-between items-start mb-2">
        <div>
            <h3 className="font-black text-lg text-slate-800 leading-tight">{posting.foodName}</h3>
            {(() => {
                const expiry = new Date(posting.expiryDate);
                const now = Date.now();
                const hoursLeft = (expiry.getTime() - now) / (1000 * 60 * 60);
                const isUrgent = posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && hoursLeft < 12;
                
                return (
                    <p className={`text-sm font-medium ${isUrgent ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                        {posting.quantity} • {isUrgent ? `Expiring in < ${Math.ceil(hoursLeft)} hrs` : `Expires ${expiry.toLocaleDateString()}`}
                    </p>
                )
            })()}
            {posting.status === FoodStatus.AVAILABLE && (
                 <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 font-medium">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span>Posted by: <span className="text-slate-700 font-bold">{posting.donorName}</span> {posting.donorOrg && <span className="text-slate-400">({posting.donorOrg})</span>}</span>
                 </div>
            )}
        </div>
        <div className="text-right">
             {getStatusBadge()}
        </div>
      </div>

      {/* Location Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2 text-xs text-slate-600">
            <span className="mt-0.5">📍</span>
            <div>
                <span className="font-bold text-slate-800">Pickup:</span> {posting.location.line1}, {posting.location.line2}
            </div>
        </div>
        {posting.orphanageName && (
            <div className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5">🏁</span>
                <div>
                    <span className="font-bold text-slate-800">Drop-off:</span> {posting.orphanageName}
                    {posting.requesterAddress && <span className="text-slate-400 block">{posting.requesterAddress.line1}</span>}
                </div>
            </div>
        )}
      </div>

      {/* Volunteer Display */}
      {posting.volunteerName && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${posting.status === FoodStatus.DELIVERED ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivery Hero</p>
                <p className="text-xs font-bold text-slate-700 truncate">
                    {posting.volunteerName}
                </p>
            </div>
            
            {posting.status === FoodStatus.IN_TRANSIT && (
                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[9px] px-2 py-1 rounded-lg font-black tracking-wider border border-amber-200 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    ON WAY
                    </span>
            )}
            
            {posting.status === FoodStatus.DELIVERED && (
                    <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[9px] px-2 py-1 rounded-lg font-black tracking-wider border border-emerald-200 animate-in fade-in zoom-in duration-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    DONE
                    </span>
            )}
        </div>
      )}

      {/* ETA Display and Edit */}
      {posting.status === FoodStatus.IN_TRANSIT && (
        <div className="mb-4 bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="bg-blue-200 text-blue-700 p-1.5 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Est. Arrival</p>
                    <p className="text-sm font-black text-blue-900">
                        {posting.etaMinutes ? `${posting.etaMinutes} mins` : 'Calculating...'}
                    </p>
                </div>
            </div>
            
            {user.role === UserRole.VOLUNTEER && posting.volunteerId === user.id && (
                <div className="flex items-center gap-2">
                    {isEditingEta ? (
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-blue-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                            <input 
                                type="number" 
                                className="w-12 text-xs font-bold p-1 outline-none text-slate-700"
                                placeholder="Min"
                                value={etaInput}
                                onChange={(e) => setEtaInput(e.target.value)}
                                autoFocus
                            />
                            <button onClick={saveEta} className="bg-emerald-500 text-white p-1 rounded hover:bg-emerald-600 transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </button>
                            <button onClick={() => setIsEditingEta(false)} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => { setEtaInput(posting.etaMinutes?.toString() || ''); setIsEditingEta(true); }}
                            className="text-[10px] font-bold bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors shadow-sm"
                        >
                            Update
                        </button>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Interested Volunteers (Visible to Donor) */}
      {user.role === UserRole.DONOR && posting.status === FoodStatus.AVAILABLE && interestedVolunteers.length > 0 && (
        <div className="mb-4">
             <div onClick={() => setShowVolunteerSelection(true)} className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors">
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                    </span>
                    <span className="text-xs font-bold text-purple-700">{interestedVolunteers.length} Volunteer{interestedVolunteers.length > 1 ? 's' : ''} Interested</span>
                </div>
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
             </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        {user.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE && (
            <button 
                onClick={handleRequest}
                className="flex-1 bg-emerald-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
            >
                Request Food
            </button>
        )}

        {/* Mark as Received for Requester */}
        {user.role === UserRole.REQUESTER && posting.status === FoodStatus.IN_TRANSIT && posting.orphanageId === user.id && (
            <button 
                onClick={() => onUpdate(posting.id, { status: FoodStatus.DELIVERED })}
                className="flex-1 bg-emerald-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                Mark as Received
            </button>
        )}

        {/* Volunteer Actions */}
        {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.AVAILABLE && (
            <button
                onClick={handleExpressInterest}
                disabled={hasExpressedInterest}
                className={`flex-1 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] transition-colors shadow-lg ${
                    hasExpressedInterest 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200'
                }`}
            >
                {hasExpressedInterest ? 'Interest Sent' : 'Express Interest'}
            </button>
        )}

        {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.REQUESTED && (
            <button 
                onClick={handleVolunteer}
                className="flex-1 bg-amber-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200"
            >
                Accept Delivery
            </button>
        )}

        {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.IN_TRANSIT && posting.volunteerId === user.id && (
            <>
                <button 
                    onClick={() => setShowMap(true)}
                    className="flex-1 bg-slate-800 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-colors shadow-lg flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    Track
                </button>
                
                <button 
                    onClick={handleShareLocation}
                    disabled={isSharingLocation}
                    className="flex-1 bg-indigo-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                    {isSharingLocation ? (
                         <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    )}
                    {isSharingLocation ? 'Sharing...' : 'Share Live'}
                </button>

                <div className="relative flex-1">
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleDeliveryVerification}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={isVerifying}
                    />
                    <button 
                        disabled={isVerifying}
                        className="w-full h-full bg-emerald-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                        {isVerifying ? 'Verifying...' : 'Verify'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </div>
            </>
        )}
        
        {/* View Route Button - For Volunteer and others when In Transit */}
        {posting.status === FoodStatus.IN_TRANSIT && posting.volunteerId && (
            <button 
                onClick={() => {
                    if (!showRoute && !routeData) {
                        handleOptimizeRoute();
                    }
                    setShowRoute(!showRoute);
                }}
                className="flex-1 bg-amber-50 text-amber-700 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-amber-100 transition-colors shadow-sm border border-amber-100 flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                {showRoute ? 'Hide Route' : 'View Route'}
            </button>
        )}
        
        {/* View Proof Button for Delivered Items */}
        {posting.status === FoodStatus.DELIVERED && posting.verificationImageUrl && (
             <button 
                onClick={() => setShowProofModal(true)}
                title="View delivery verification photo"
                className="flex-1 bg-emerald-50 text-emerald-700 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-emerald-100 transition-colors shadow-sm border border-emerald-100 flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                View Proof
            </button>
        )}

        {isInvolved && (
            <button 
                onClick={() => setShowChat(true)}
                className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-slate-200 transition-colors relative"
                title="Chat"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                {messageCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                        {messageCount}
                    </span>
                )}
            </button>
        )}

        {/* Hide default track button if we are the volunteer in transit (since we have the big button) */}
        {isInvolved && (posting.status === FoodStatus.IN_TRANSIT || posting.status === FoodStatus.DELIVERED) && !(user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.IN_TRANSIT && posting.volunteerId === user.id) && (
             <button 
                onClick={() => setShowMap(true)}
                className="bg-blue-50 text-blue-600 p-3 rounded-xl hover:bg-blue-100 transition-colors"
                title="Track"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            </button>
        )}
      </div>

      {/* Route Optimization Section - Controlled by showRoute */}
      {showRoute && (
        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    Delivery Route
                </h4>
                <button 
                    onClick={handleOptimizeRoute}
                    disabled={loadingRoute}
                    className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors"
                >
                   {loadingRoute ? 'Loading...' : 'Refresh'}
                </button>
            </div>
            
            {loadingRoute ? (
                 <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
                     <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     <span className="text-xs font-medium">Calculating optimal path...</span>
                 </div>
            ) : routeData ? (
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Est. Time</p>
                            <p className="text-lg font-black text-slate-800">{routeData.estimatedDuration}</p>
                        </div>
                        <div className="flex-[2] bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Summary</p>
                            <p className="text-sm font-bold text-slate-700">{routeData.summary}</p>
                        </div>
                    </div>
                    
                    {routeData.trafficTips && (
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-2">
                             <span className="text-amber-500 mt-0.5">⚠️</span>
                             <div>
                                <p className="text-[9px] text-amber-700 font-bold uppercase tracking-widest">Traffic Insight</p>
                                <p className="text-xs text-amber-900 font-medium leading-relaxed">{routeData.trafficTips}</p>
                             </div>
                        </div>
                    )}
                    
                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                         <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Turn-by-Turn</p>
                         </div>
                         <ul className="divide-y divide-slate-50">
                            {routeData.steps.map((step, idx) => (
                                <li key={idx} className="p-3 text-xs font-medium text-slate-600 flex gap-3">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[10px]">{idx + 1}</span>
                                    {step}
                                </li>
                            ))}
                         </ul>
                    </div>
                </div>
            ) : (
                 <div className="text-center py-4 text-xs text-slate-500">
                    Unable to load route data.
                 </div>
            )}
        </div>
      )}

      {showChat && <ChatModal posting={posting} user={user} onClose={() => setShowChat(false)} />}
      
      {showMap && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl h-[500px] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowMap(false)} className="absolute top-4 right-4 z-10 bg-white p-2 rounded-full shadow-md hover:bg-slate-50">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
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
      )}

      {/* Volunteer Selection Modal */}
      {showVolunteerSelection && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowVolunteerSelection(false)}>
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Select Volunteer</h3>
                    <button onClick={() => setShowVolunteerSelection(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <p className="text-sm text-slate-500 mb-4 font-medium">Who will collect this food?</p>
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                    {interestedVolunteers.map((vol) => (
                        <button
                            key={vol.userId}
                            onClick={() => initiateAssignment(vol.userId, vol.userName)}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs group-hover:bg-emerald-200 transition-colors">
                                    {vol.userName.charAt(0)}
                                </div>
                                <span className="font-bold text-slate-700 text-sm">{vol.userName}</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Assign</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showAssignConfirm && selectedVolunteer && (
        <div className="fixed inset-0 z-[170] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowAssignConfirm(false)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200 border border-slate-200" onClick={(e) => e.stopPropagation()}>
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Confirm Pickup</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">
                    Assign <b>{selectedVolunteer.name}</b> to pick up this donation?
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={confirmAssignment}
                        className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest text-xs"
                    >
                        Yes, Assign Volunteer
                    </button>
                    <button 
                        onClick={() => { setShowAssignConfirm(false); setSelectedVolunteer(null); }}
                        className="w-full bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {/* Proof of Delivery Modal */}
      {showProofModal && posting.verificationImageUrl && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowProofModal(false)}>
            <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowProofModal(false)} className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors backdrop-blur-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10" onClick={(e) => e.stopPropagation()}>
                    <img 
                        src={posting.verificationImageUrl} 
                        alt="Proof of Delivery" 
                        className="max-w-full max-h-[80vh] object-contain"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="bg-emerald-500 p-1.5 rounded-full">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h4 className="font-black uppercase tracking-widest text-sm">Delivery Verified</h4>
                        </div>
                        <p className="text-xs text-slate-300 font-medium ml-8">
                            Delivered by {posting.volunteerName}
                        </p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default FoodCard;
