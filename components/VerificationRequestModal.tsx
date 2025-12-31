
import React from 'react';
import { FoodPosting } from '../types';

interface VerificationRequestModalProps {
  posting: FoodPosting;
  onApprove: () => void;
  onReject: () => void;
}

const VerificationRequestModal: React.FC<VerificationRequestModalProps> = ({ posting, onApprove, onReject }) => {
  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        <div className="bg-slate-900 p-6 text-white text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-black uppercase tracking-wider">Pickup Verification</h3>
            <p className="text-slate-400 text-sm font-bold mt-1">Volunteer wants to pick up "{posting.foodName}"</p>
        </div>

        <div className="p-6">
            <div className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 mb-6 relative">
                <img 
                    src={posting.pickupVerificationImageUrl} 
                    alt="Pickup Proof" 
                    className="w-full h-64 object-cover" 
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 text-center text-white text-xs font-bold uppercase tracking-widest">
                    Proof of Pickup
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-center">
                <p className="text-sm text-slate-600 font-medium">
                    <span className="font-black text-slate-800">{posting.volunteerName}</span> has uploaded this image as proof of pickup. 
                    Does this look correct?
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={onReject}
                    className="py-4 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl font-black uppercase text-xs tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    Reject
                </button>
                <button 
                    onClick={onApprove}
                    className="py-4 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl font-black uppercase text-xs tracking-wider transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    Confirm Pickup
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationRequestModal;
