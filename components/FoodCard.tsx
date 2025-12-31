
import React, { useState, useRef } from 'react';
import { FoodPosting, User, UserRole, FoodStatus } from '../types';
import { verifyDeliveryImage } from '../services/geminiService';
import ChatModal from './ChatModal';
import DirectionsModal from './DirectionsModal';
import LiveTrackingModal from './LiveTrackingModal';
import RatingModal from './RatingModal';

interface FoodCardProps {
  posting: FoodPosting;
  user: User;
  onUpdate: (id: string, updates: Partial<FoodPosting>) => void;
  currentLocation?: { lat: number; lng: number };
  onRateVolunteer?: (postingId: string, rating: number, feedback: string) => void;
  volunteerProfile?: User; // Pass the full volunteer object if available
}

const FoodCard: React.FC<FoodCardProps> = ({ posting, user, onUpdate, currentLocation, onRateVolunteer, volunteerProfile }) => {
  const [showChat, setShowChat] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const expiryTimestamp = new Date(posting.expiryDate).getTime();
  const hoursLeft = (expiryTimestamp - Date.now()) / (1000 * 60 * 60);
  const isUrgent = posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && hoursLeft < 12;

  // Check if current user has already rated this specific posting
  const hasRated = posting.ratings?.some(r => r.raterId === user.id);

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

  return (
    <div className={`group rounded-[2.5rem] p-5 bg-white transition-all duration-300 relative overflow-hidden flex flex-col h-full ${isUrgent ? 'ring-2 ring-rose-100 shadow-xl shadow-rose-50' : 'border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-1'}`}>
      
      {/* Image Section */}
      <div className="h-56 rounded-[2rem] overflow-hidden mb-5 relative shrink-0">
        {posting.imageUrl ? (
            <img src={posting.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : (
            <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs font-bold uppercase">No Image</span>
            </div>
        )}
        
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
        
        <div className="absolute top-3 right-3">
             <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg ${posting.status === FoodStatus.AVAILABLE ? 'bg-emerald-500/90 text-white' : 'bg-white/90 text-slate-800'}`}>
                {posting.status.replace('_', ' ')}
             </span>
        </div>

        <div className="absolute bottom-4 left-4 text-white">
            <div className="flex items-center gap-2 mb-1">
                 <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold uppercase border border-white/20">{posting.quantity}</span>
                 {isUrgent && <span className="bg-rose-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold uppercase animate-pulse">Expires Soon</span>}
            </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 flex flex-col">
          <div className="mb-4">
            <h3 className="font-black text-xl leading-tight text-slate-800 mb-1 line-clamp-1" title={posting.foodName}>{posting.foodName}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                By {posting.donorOrg || posting.donorName}
            </p>
          </div>

          <div className="space-y-3 mb-6 flex-1">
              {posting.volunteerName && (
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                     {volunteerProfile?.profilePictureUrl ? (
                       <img src={volunteerProfile.profilePictureUrl} className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0" alt={posting.volunteerName} />
                     ) : (
                       <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-black text-xs">
                          {posting.volunteerName.charAt(0)}
                       </div>
                     )}
                     <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Volunteer</p>
                         <div className="flex items-center gap-1.5">
                             <p className="text-xs font-bold text-slate-700 leading-snug">{posting.volunteerName}</p>
                             {volunteerProfile && volunteerProfile.averageRating ? (
                                 <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                     <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                     {volunteerProfile.averageRating.toFixed(1)}
                                 </span>
                             ) : null}
                         </div>
                     </div>
                  </div>
              )}

              <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </div>
                 <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Pickup Location</p>
                     <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-2">{posting.location.line1}</p>
                 </div>
              </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-[1fr_auto] gap-3 pt-4 border-t border-slate-50">
            {user.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE && (
              <button onClick={handleRequest} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-wider transition-colors shadow-lg shadow-emerald-200">
                Request Pickup
              </button>
            )}
            
            {user.role === UserRole.REQUESTER && posting.status === FoodStatus.IN_TRANSIT && (
              <button 
                onClick={() => setShowTracking(true)} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-200 animate-pulse"
              >
                Track Live
              </button>
            )}

            {user.role === UserRole.REQUESTER && (posting.status === FoodStatus.IN_TRANSIT || posting.status === FoodStatus.DELIVERED) && (
              <>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isVerifying}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-teal-200 disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : (posting.verificationImageUrl ? 'Verified' : 'Verify Delivery')}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleVerificationUpload} />
              </>
            )}

            {user.role === UserRole.REQUESTER && posting.status === FoodStatus.DELIVERED && !hasRated && onRateVolunteer && posting.volunteerId && (
              <button 
                onClick={() => setShowRating(true)} 
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-yellow-200"
              >
                Rate Volunteer
              </button>
            )}

            {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.AVAILABLE && (
              <button onClick={handleExpressInterest} className="bg-purple-600 hover:bg-purple-700 text-white font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-wider transition-colors shadow-lg shadow-purple-200">
                Volunteer
              </button>
            )}
            
            {user.role === UserRole.VOLUNTEER && posting.volunteerId === user.id && posting.status === FoodStatus.IN_TRANSIT && posting.requesterAddress && (
                 <button 
                    onClick={() => setShowDirections(true)} 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-xl uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                 >
                    Get Directions
                 </button>
            )}

            {/* Fallback for Donor View or inactive states */}
            {user.role === UserRole.DONOR && posting.status === FoodStatus.AVAILABLE && (
                <div className="flex items-center text-xs font-bold text-slate-400 italic">
                    Waiting for request...
                </div>
            )}

            <button onClick={() => setShowChat(true)} className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-emerald-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </button>
          </div>
      </div>

      {/* Modals */}
      {showChat && <ChatModal posting={posting} user={user} onClose={() => setShowChat(false)} />}
      {showDirections && (
          <DirectionsModal 
            origin={getOriginString()} 
            destination={getDestinationString()} 
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
