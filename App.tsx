
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Address, Notification } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage, reverseGeocode } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import RequesterMap from './components/RequesterMap';
import ProfileView from './components/ProfileView';

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/1000/1000399.png';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD' | 'PROFILE'>('LOGIN');
  const [showNearbyMap, setShowNearbyMap] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [donorViewMode, setDonorViewMode] = useState<'active' | 'history'>('active');
  
  // New: Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const TAG_OPTIONS = ['Veg', 'Non-Veg', 'Raw', 'Cooked', 'Dairy-Free'];

  const [loginName, setLoginName] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regOrgName, setRegOrgName] = useState('');
  const [regAddrLine1, setRegAddrLine1] = useState('');
  const [regAddrPincode, setRegAddrPincode] = useState('');
  const [regLat, setRegLat] = useState<number | undefined>(undefined);
  const [regLng, setRegLng] = useState<number | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locLine1, setLocLine1] = useState('');
  const [locPincode, setLocPincode] = useState('');
  const [locLat, setLocLat] = useState<number | undefined>(undefined);
  const [locLng, setLocLng] = useState<number | undefined>(undefined);
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [safetyVerdict, setSafetyVerdict] = useState<{ isSafe: boolean; reasoning: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPostings(storage.getPostings());
    setAllUsers(storage.getUsers());
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      setNotifications(storage.getNotifications(user.id));
      setPostings(storage.getPostings());
      setAllUsers(storage.getUsers());
    }, 4000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = storage.getUsers();
    const found = users.find(u => u.name.toLowerCase() === loginName.toLowerCase());
    if (found) { setUser(found); setView('DASHBOARD'); }
    else { alert("User not found."); }
  };

  const handleRegister = (e: React.FormEvent) => {
      e.preventDefault();
      const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name: regName, email: regEmail, role: regRole,
          impactScore: 0
      };
      if (regRole === UserRole.REQUESTER) {
          newUser.orgName = regOrgName;
          newUser.address = { line1: regAddrLine1, line2: '', pincode: regAddrPincode, lat: regLat, lng: regLng };
      }
      storage.saveUser(newUser);
      setUser(newUser);
      setView('DASHBOARD');
  };

  const handleGetLocation = async (type: 'reg' | 'posting') => {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          const address = await reverseGeocode(latitude, longitude);
          if (type === 'reg') {
              setRegLat(latitude); setRegLng(longitude);
              if (address) { setRegAddrLine1(address.line1); setRegAddrPincode(address.pincode); }
          } else {
              setLocLat(latitude); setLocLng(longitude);
              if (address) { setLocLine1(address.line1); setLocPincode(address.pincode); }
          }
          setIsGettingLocation(false);
      }, () => setIsGettingLocation(false));
  };

  const handleCreatePosting = (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      const newPosting: FoodPosting = {
          id: Math.random().toString(36).substr(2, 9),
          donorId: user.id, donorName: user.name,
          foodName, quantity, expiryDate, createdAt: Date.now(),
          location: { line1: locLine1, line2: '', pincode: locPincode, lat: locLat, lng: locLng },
          status: FoodStatus.AVAILABLE, imageUrl: foodImage || undefined,
          foodTags: selectedTags, safetyVerdict: safetyVerdict || undefined
      };
      storage.savePosting(newPosting);
      setIsAddingFood(false); setFoodName(''); setQuantity(''); setFoodImage(null); setSelectedTags([]);
  };

  const sortedHeroes = [...allUsers]
    .filter(u => u.role !== UserRole.REQUESTER)
    .sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0))
    .slice(0, 5);

  const filteredPostings = postings.filter(p => {
      if (user?.role === UserRole.DONOR) return donorViewMode === 'active' ? p.donorId === user.id && p.status !== FoodStatus.DELIVERED : p.donorId === user.id && p.status === FoodStatus.DELIVERED;
      if (user?.role === UserRole.VOLUNTEER) return p.status === FoodStatus.REQUESTED || (p.volunteerId === user.id && p.status === FoodStatus.IN_TRANSIT);
      if (user?.role === UserRole.REQUESTER) return p.status === FoodStatus.AVAILABLE || p.orphanageId === user.id;
      return true;
  });

  if (view === 'LOGIN') {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-slate-100">
                  <img src={LOGO_URL} className="w-16 h-16 mx-auto mb-6 animate-bounce-slow" />
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight">ShareMeal Connect</h1>
                  <p className="text-slate-400 mb-8 font-bold text-sm uppercase">FIGHTING HUNGER WITH TECH</p>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input type="text" placeholder="Name" value={loginName} onChange={e => setLoginName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black outline-none font-bold" required />
                      <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs">Enter Hub</button>
                  </form>
                  <button onClick={() => setView('REGISTER')} className="mt-6 text-emerald-600 font-black text-xs uppercase tracking-widest">Create New Account</button>
              </div>
          </div>
      );
  }

  if (view === 'REGISTER') {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100">
                  <h2 className="text-2xl font-black text-slate-800 mb-8 text-center uppercase tracking-widest">Join the Mission</h2>
                  <form onSubmit={handleRegister} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Name" value={regName} onChange={e => setRegName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black font-bold outline-none" required />
                        <input type="email" placeholder="Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black font-bold outline-none" required />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          {[UserRole.DONOR, UserRole.VOLUNTEER, UserRole.REQUESTER].map(r => (
                              <button key={r} type="button" onClick={() => setRegRole(r)} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${regRole === r ? 'bg-black text-white' : 'bg-white text-slate-400 border-slate-200'}`}>{r}</button>
                          ))}
                      </div>
                      {regRole === UserRole.REQUESTER && (
                          <div className="bg-slate-50 p-4 rounded-2xl border border-black space-y-4 animate-in fade-in">
                              <input type="text" placeholder="Org Name" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-black text-sm" required />
                              <button type="button" onClick={() => handleGetLocation('reg')} className="w-full bg-slate-800 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Auto-fill Location</button>
                          </div>
                      )}
                      <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs">Start Rescuing</button>
                  </form>
              </div>
          </div>
      );
  }

  return (
    <Layout user={user} onLogout={() => { setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} notifications={notifications} onMarkNotificationRead={storage.markNotificationRead}>
        {view === 'PROFILE' && user ? (
          <ProfileView user={user} onUpdate={(u) => { const up = storage.updateUser(user.id, u); if(up) setUser(up); setView('DASHBOARD'); }} onBack={() => setView('DASHBOARD')} />
        ) : (
          <>
            {/* Impact Heroes Section */}
            <div className="mb-12">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        Impact Heroes
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Leaderboard</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {sortedHeroes.map((hero, idx) => (
                        <div key={hero.id} className="min-w-[140px] bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 text-sm font-black ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-200 text-slate-600' : 'bg-orange-100 text-orange-600'}`}>
                                {idx + 1}
                            </div>
                            <p className="text-xs font-black text-slate-800 line-clamp-1">{hero.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{hero.role}</p>
                            <div className="mt-3 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full border border-emerald-100">
                                {hero.impactScore || 0} IMPACT
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-800">Operational Hub</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Status: Online</p>
                </div>
                <div className="flex gap-2">
                    {user?.role === UserRole.DONOR && (
                        <button onClick={() => setIsAddingFood(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">Post Food</button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPostings.map(post => <FoodCard key={post.id} posting={post} user={user!} onUpdate={(id, u) => { const up = storage.updatePosting(id, u); if(up) setPostings(p => p.map(x => x.id === id ? up : x)); }} />)}
            </div>

            {isAddingFood && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">New Donation</h3>
                            <button onClick={() => setIsAddingFood(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">✕</button>
                        </div>
                        <form onSubmit={handleCreatePosting} className="space-y-6">
                            <input type="text" placeholder="Meal Name" value={foodName} onChange={e => setFoodName(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-black font-black outline-none" required />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Qty" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-black font-bold outline-none" required />
                                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-black font-bold outline-none" required />
                            </div>
                            
                            {/* Tags Selection */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dietary Tags</label>
                                <div className="flex flex-wrap gap-2">
                                    {TAG_OPTIONS.map(tag => (
                                        <button key={tag} type="button" onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${selectedTags.includes(tag) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200'}`}>{tag}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <input type="text" placeholder="Address" value={locLine1} onChange={e => setLocLine1(e.target.value)} className="flex-1 px-4 py-3 rounded-2xl border border-black font-medium outline-none" required />
                                <button type="button" onClick={() => handleGetLocation('posting')} className="px-4 bg-slate-100 rounded-2xl hover:bg-slate-200">📍</button>
                            </div>

                            <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Verify & Post</button>
                        </form>
                    </div>
                </div>
            )}
          </>
        )}
    </Layout>
  );
};

export default App;
