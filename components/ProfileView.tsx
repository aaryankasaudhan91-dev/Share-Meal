
import React, { useState } from 'react';
import { User, UserRole, Address } from '../types';
import { reverseGeocode } from '../services/geminiService';

interface ProfileViewProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
  onBack: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdate, onBack }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  
  // Requester specific state
  const [orgName, setOrgName] = useState(user.orgName || '');
  const [orgCategory, setOrgCategory] = useState(user.orgCategory || 'Orphanage');
  const [addrLine1, setAddrLine1] = useState(user.address?.line1 || '');
  const [addrLine2, setAddrLine2] = useState(user.address?.line2 || '');
  const [landmark, setLandmark] = useState(user.address?.landmark || '');
  const [pincode, setPincode] = useState(user.address?.pincode || '');
  const [lat, setLat] = useState(user.address?.lat);
  const [lng, setLng] = useState(user.address?.lng);
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGetLocation = () => {
    setIsGettingLocation(true);
    
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        
        // AI-powered address guess
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          setAddrLine1(address.line1);
          setAddrLine2(address.line2);
          setLandmark(address.landmark);
          setPincode(address.pincode);
        }
        
        setIsGettingLocation(false);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        alert(`Could not fetch location: ${err.message}`);
        setIsGettingLocation(false);
      },
      geoOptions
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const updates: Partial<User> = {
      name,
      email,
    };

    if (user.role === UserRole.REQUESTER) {
      updates.orgName = orgName;
      updates.orgCategory = orgCategory;
      updates.address = {
        line1: addrLine1,
        line2: addrLine2,
        landmark,
        pincode,
        lat,
        lng
      };
    }

    // Simulate saving delay
    setTimeout(() => {
      onUpdate(updates);
      setIsSaving(false);
      alert("Profile updated successfully!");
    }, 800);
  };

  return (
    <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center text-slate-500 hover:text-emerald-600 font-bold text-sm transition-colors group"
      >
        <svg className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Dashboard
      </button>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-emerald-600 p-8 text-white relative">
          <div className="relative z-10">
            <h2 className="text-3xl font-black tracking-tight">My Profile</h2>
            <p className="opacity-80 text-sm mt-1 font-medium">Manage your personal and organization details</p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-1/4 -translate-y-1/4 scale-150">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7zM16 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700"
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700"
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Account Role</label>
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-emerald-600 uppercase tracking-widest text-xs">
              {user.role}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">* Role cannot be changed once the account is created.</p>
          </div>

          {user.role === UserRole.REQUESTER && (
            <div className="pt-6 border-t border-slate-100 space-y-6">
              <h3 className="text-lg font-black text-slate-800">Organization Information</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Org Name</label>
                  <input 
                    type="text" 
                    value={orgName} 
                    onChange={e => setOrgName(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                  <select 
                    value={orgCategory} 
                    onChange={e => setOrgCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700"
                  >
                    <option>Orphanage</option>
                    <option>Old Age Home</option>
                    <option>Shelter</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Address Details</label>
                <input 
                  type="text" 
                  placeholder="Street / Building Address"
                  value={addrLine1} 
                  onChange={e => setAddrLine1(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700 text-sm"
                  required 
                />
                <input 
                  type="text" 
                  placeholder="Area / Secondary Address"
                  value={addrLine2} 
                  onChange={e => setAddrLine2(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700 text-sm"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="Landmark"
                    value={landmark} 
                    onChange={e => setLandmark(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700 text-sm"
                  />
                  <input 
                    type="text" 
                    placeholder="Pincode"
                    value={pincode} 
                    onChange={e => setPincode(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-medium text-slate-700 text-sm"
                    required 
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2">
                   <button 
                    type="button" 
                    onClick={handleGetLocation}
                    disabled={isGettingLocation}
                    className="w-full flex items-center justify-center gap-2 text-xs font-black text-white bg-slate-800 py-3 rounded-xl hover:bg-slate-900 transition-all shadow-md disabled:opacity-50"
                   >
                     {isGettingLocation ? (
                       <>
                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                         Detecting Address via GPS...
                       </>
                     ) : (
                       <>
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                         Detect Current Location
                       </>
                     )}
                   </button>
                   {lat && lng && !isGettingLocation && (
                     <div className="text-center">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-tighter">GPS: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-8">
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving Changes...
                </>
              ) : 'Update My Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileView;
