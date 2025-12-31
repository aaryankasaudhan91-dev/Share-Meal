
import React, { useState } from 'react';
import { FoodPosting, User, UserRole, FoodStatus } from '../types';
import ChatModal from './ChatModal';
import DirectionsModal from './DirectionsModal';

interface FoodCardProps {
  posting: FoodPosting;
  user: User;
  onUpdate: (id: string, updates: Partial<FoodPosting>) => void;
  currentLocation?: { lat: number; lng: number };
}

const FoodCard: React.FC<FoodCardProps> = ({ posting, user, onUpdate, currentLocation }) => {
  const [showChat, setShowChat] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  
  const expiryTimestamp = new Date(posting.expiryDate).getTime();
  const hoursLeft = (expiryTimestamp - Date.now()) / (1000 * 60 * 60);
  const isUrgent = posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && hoursLeft < 12;

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
    <div className={`rounded-[2.5rem] p-6 border transition-all duration-500 relative overflow-hidden bg-white ${isUrgent ? 'border-rose-200 shadow-rose-100 bg-rose-50/20' : 'border-slate-100 shadow-lg'}`}>
      {isUrgent && <div className="absolute top-0 inset-x-0 bg-rose-600 text-white text-[9px] font-black uppercase py-1 text-center animate-pulse">Expiring in under {Math.ceil(hoursLeft)} hours</div>}
      <div className="h-48 rounded-3xl overflow-hidden mb-4 relative">
        {posting.imageUrl ? <img src={posting.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">No Image</div>}
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase">{posting.quantity}</div>
      </div>
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-black text-xl leading-tight">{posting.foodName}</h3>
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${posting.status === FoodStatus.AVAILABLE ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>{posting.status}</span>
      </div>
      <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
             <span className="font-bold text-slate-800">Ready:</span> {posting.etaMinutes || 30}m
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
             <span className="font-bold text-slate-800">Pickup:</span> {posting.location.line1}
          </div>
          {posting.requesterAddress && posting.status !== FoodStatus.AVAILABLE && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-slate-800">Dropoff:</span> {posting.requesterAddress.line1}
              </div>
          )}
      </div>
      <div className="flex gap-2">
        {user.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE && (
          <button onClick={handleRequest} className="flex-1 bg-emerald-600 text-white font-black py-3 rounded-2xl uppercase text-[10px]">Request</button>
        )}
        {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.AVAILABLE && (
          <button onClick={handleExpressInterest} className="flex-1 bg-purple-600 text-white font-black py-3 rounded-2xl uppercase text-[10px]">Interested</button>
        )}
        {user.role === UserRole.VOLUNTEER && posting.volunteerId === user.id && posting.status === FoodStatus.IN_TRANSIT && posting.requesterAddress && (
             <button 
                onClick={() => setShowDirections(true)} 
                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl uppercase text-[10px] flex items-center justify-center gap-1"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Directions
             </button>
        )}
        <button onClick={() => setShowChat(true)} className="p-3 bg-slate-100 rounded-2xl"><svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg></button>
      </div>
      {showChat && <ChatModal posting={posting} user={user} onClose={() => setShowChat(false)} />}
      {showDirections && (
          <DirectionsModal 
            origin={getOriginString()} 
            destination={getDestinationString()} 
            onClose={() => setShowDirections(false)} 
          />
      )}
    </div>
  );
};

export default FoodCard;
