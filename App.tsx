
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
  const [dashboardMode, setDashboardMode] = useState<'FEED' | 'MAP'>('FEED');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [donorViewMode, setDonorViewMode] = useState<'active' | 'history'>('active');
  
  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const TAG_OPTIONS = ['Veg', 'Non-Veg', 'Raw', 'Cooked', 'Dairy-Free'];

  const [loginName, setLoginName] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  
  // Requester Registration State
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regOrgName, setRegOrgName] = useState('');
  const [regAddrLine1, setRegAddrLine1] = useState('');
  const [regAddrLine2, setRegAddrLine2] = useState('');
  const [regLandmark, setRegLandmark] = useState('');
  const [regAddrPincode, setRegAddrPincode] = useState('');
  const [regLat, setRegLat] = useState<number | undefined>(undefined);
  const [regLng, setRegLng] = useState<number | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  
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
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPostings(storage.getPostings());
    setAllUsers(storage.getUsers());
    
    // Attempt to get user location for the map
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log("Location access denied")
    );
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

      // Pincode validation
      if (regRole === UserRole.REQUESTER && !/^\d{6}$/.test(regAddrPincode)) {
          alert("Pincode must be a 6-digit number.");
          return;
      }

      const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name: regName, 
          email: regEmail, 
          role: regRole,
          impactScore: 0
      };

      if (regRole === UserRole.REQUESTER) {
          newUser.orgName = regOrgName;
          newUser.orgCategory = regOrgCategory;
          newUser.address = { 
              line1: regAddrLine1, 
              line2: regAddrLine2, 
              landmark: regLandmark,
              pincode: regAddrPincode, 
              lat: regLat, 
              lng: regLng 
          };
      }

      storage.saveUser(newUser);
      setUser(newUser);
      setView('DASHBOARD');
  };

  const handleToggleFavorite = (requesterId: string) => {
    if (!user) return;
    const updatedUser = storage.toggleFavorite(user.id, requesterId);
    if (updatedUser) setUser(updatedUser);
  };

  const handleGetLocation = async (type: 'reg' | 'posting') => {
      setIsGettingLocation(true);
      setLocationStatus('Acquiring GPS Signal...');
      
      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocationStatus('GPS Found. Analyzing with AI...');
          
          const address = await reverseGeocode(latitude, longitude);
          
          if (type === 'reg') {
              setRegLat(latitude); setRegLng(longitude);
              if (address) { 
                  setRegAddrLine1(address.line1); 
                  setRegAddrLine2(address.line2);
                  setRegLandmark(address.landmark);
                  setRegAddrPincode(address.pincode); 
              }
          } else {
              setLocLat(latitude); setLocLng(longitude);
              if (address) { setLocLine1(address.line1); setLocPincode(address.pincode); }
          }
          
          setLocationStatus('');
          setIsGettingLocation(false);
      }, (err) => {
          let errorMsg = "Could not get location.";
          if (err.code === 1) errorMsg = "Permission denied. Please allow location access.";
          if (err.code === 3) errorMsg = "Location request timed out. Try again.";
          alert(errorMsg);
          setLocationStatus('');
          setIsGettingLocation(false);
      }, geoOptions);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsAnalyzingImage(true);
      setSafetyVerdict(null);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setFoodImage(base64);
        
        // Use AI to analyze safety
        const result = await analyzeFoodSafetyImage(base64);
        setSafetyVerdict({ isSafe: result.isSafe, reasoning: result.reasoning });
        if (result.detectedFoodName && !foodName) {
            setFoodName(result.detectedFoodName);
        }
        setIsAnalyzingImage(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePosting = (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (safetyVerdict && !safetyVerdict.isSafe) {
          alert("Our AI safety check flagged this food as potentially unsafe. Please donate fresh, safe meals only.");
          return;
      }
      const newPosting: FoodPosting = {
          id: Math.random().toString(36).substr(2, 9),
          donorId: user.id, donorName: user.name,
          foodName, quantity, expiryDate, createdAt: Date.now(),
          location: { line1: locLine1, line2: '', pincode: locPincode, lat: locLat, lng: locLng },
          status: FoodStatus.AVAILABLE, imageUrl: foodImage || undefined,
          foodTags: selectedTags, safetyVerdict: safetyVerdict || undefined
      };
      storage.savePosting(newPosting);
      setIsAddingFood(false); setFoodName(''); setQuantity(''); setFoodImage(null); setSelectedTags([]); setSafetyVerdict(null);
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

  const requesters = allUsers.filter(u => u.role === UserRole.REQUESTER);

  if (view === 'LOGIN') {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-slate-100">
                  <img src={LOGO_URL} className="w-16 h-16 mx-auto mb-6 animate-bounce-slow" />
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight">ShareMeal Connect</h1>
                  <p className="text-slate-400 mb-8 font-bold text-sm uppercase">FIGHTING HUNGER WITH TECH</p>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input type="text" placeholder="Name" value={loginName} onChange={e => setLoginName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black outline-none font-bold bg-white" required />
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
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
                  <h2 className="text-2xl font-black text-slate-800 mb-8 text-center uppercase tracking-widest">Join the Mission</h2>
                  <form onSubmit={handleRegister} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="text" placeholder="Name" value={regName} onChange={e => setRegName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black font-bold outline-none bg-white" required />
                        <input type="email" placeholder="Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black font-bold outline-none bg-white" required />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[UserRole.DONOR, UserRole.VOLUNTEER, UserRole.REQUESTER].map(r => (
                                <button key={r} type="button" onClick={() => setRegRole(r)} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${regRole === r ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-200'}`}>{r}</button>
                            ))}
                        </div>
                      </div>

                      {regRole === UserRole.REQUESTER && (
                          <div className="bg-slate-50 p-6 rounded-2xl border border-black space-y-4 animate-in fade-in slide-in-from-top-2">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2">Organization Details</h3>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <input type="text" placeholder="Org Name" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black text-sm bg-white font-bold" required />
                                  <select 
                                      value={regOrgCategory} 
                                      onChange={e => setRegOrgCategory(e.target.value)}
                                      className="w-full px-4 py-3 rounded-xl border border-black text-sm bg-white font-bold outline-none"
                                  >
                                      <option>Orphanage</option>
                                      <option>Old care home</option>
                                      <option>NGO's</option>
                                      <option>Other</option>
                                  </select>
                              </div>

                              <div className="space-y-3 relative">
                                  {isGettingLocation && (
                                    <div className="absolute -top-6 right-0 flex items-center gap-1.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">{locationStatus}</span>
                                    </div>
                                  )}
                                  <input type="text" placeholder="Address Line 1" value={regAddrLine1} onChange={e => setRegAddrLine1(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black text-sm bg-white" required />
                                  <input type="text" placeholder="Address Line 2" value={regAddrLine2} onChange={e => setRegAddrLine2(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black text-sm bg-white" required />
                                  <div className="grid grid-cols-2 gap-3">
                                      <input type="text" placeholder="Landmark (Optional)" value={regLandmark} onChange={e => setRegLandmark(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black text-sm bg-white" />
                                      <input 
                                          type="text" 
                                          placeholder="Pincode (6 digits)" 
                                          value={regAddrPincode} 
                                          maxLength={6}
                                          pattern="\d{6}"
                                          onChange={e => setRegAddrPincode(e.target.value.replace(/\D/g, ''))} 
                                          className="w-full px-4 py-3 rounded-xl border border-black text-sm bg-white font-bold" 
                                          required 
                                      />
                                  </div>
                              </div>

                              <button type="button" onClick={() => handleGetLocation('reg')} disabled={isGettingLocation} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isGettingLocation ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-white hover:bg-black shadow-lg shadow-slate-200'}`}>
                                  {isGettingLocation ? (
                                    <>
                                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                      Detecting Location...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                      Auto-fill Location via GPS
                                    </>
                                  )}
                              </button>
                          </div>
                      )}
                      <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs">Start Rescuing</button>
                  </form>
                  <button onClick={() => setView('LOGIN')} className="w-full mt-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Already have an account? Log In</button>
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800">Operational Hub</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Status: Online • {dashboardMode === 'FEED' ? 'Card List' : 'Geographic Map'}</p>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                    {(user?.role === UserRole.DONOR || user?.role === UserRole.VOLUNTEER) && (
                      <div className="flex bg-white border border-black rounded-xl p-1 overflow-hidden shadow-sm">
                        <button 
                          onClick={() => setDashboardMode('FEED')}
                          className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${dashboardMode === 'FEED' ? 'bg-black text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          List Feed
                        </button>
                        <button 
                          onClick={() => setDashboardMode('MAP')}
                          className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${dashboardMode === 'MAP' ? 'bg-black text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Discovery Map
                        </button>
                      </div>
                    )}

                    {user?.role === UserRole.DONOR && (
                        <button onClick={() => setIsAddingFood(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">Post Food</button>
                    )}
                </div>
            </div>

            {dashboardMode === 'FEED' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPostings.map(post => <FoodCard key={post.id} posting={post} user={user!} onUpdate={(id, u) => { const up = storage.updatePosting(id, u); if(up) setPostings(p => p.map(x => x.id === id ? up : x)); }} />)}
                  {filteredPostings.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100">
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No postings to show in this view.</p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <RequesterMap 
                  requesters={requesters} 
                  currentLocation={userLocation} 
                  user={user!}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            )}

            {isAddingFood && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">New Donation</h3>
                            <button onClick={() => setIsAddingFood(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">✕</button>
                        </div>
                        <form onSubmit={handleCreatePosting} className="space-y-6">
                            {/* Food Image Upload Section */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Meal Photo (Required for AI Safety Check)</label>
                                <div className="flex flex-col gap-4">
                                    {foodImage ? (
                                        <div className="relative w-full h-48 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                                            <img src={foodImage} className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => { setFoodImage(null); setSafetyVerdict(null); }}
                                                className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full backdrop-blur-sm hover:bg-red-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                            {isAnalyzingImage && (
                                                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">AI Spoilage Check...</span>
                                                </div>
                                            )}
                                            {safetyVerdict && !isAnalyzingImage && (
                                                <div className={`absolute bottom-0 left-0 right-0 p-3 flex items-start gap-2 ${safetyVerdict.isSafe ? 'bg-emerald-600/90' : 'bg-red-600/90'} text-white animate-in slide-in-from-bottom-4`}>
                                                    <div className="mt-0.5">
                                                        {safetyVerdict.isSafe ? (
                                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-tighter">{safetyVerdict.isSafe ? 'AI VERIFIED SAFE' : 'AI SAFETY WARNING'}</p>
                                                        <p className="text-[9px] font-medium leading-tight opacity-90">{safetyVerdict.reasoning}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={handleImageUpload} />
                                            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleImageUpload} />
                                            
                                            <button 
                                                type="button" 
                                                onClick={() => galleryInputRef.current?.click()}
                                                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                                            >
                                                <svg className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <span className="text-[10px] font-black text-slate-500 group-hover:text-emerald-700 uppercase tracking-widest">Gallery</span>
                                            </button>

                                            <button 
                                                type="button" 
                                                onClick={() => cameraInputRef.current?.click()}
                                                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                                            >
                                                <svg className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="text-[10px] font-black text-slate-500 group-hover:text-emerald-700 uppercase tracking-widest">Camera</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <input type="text" placeholder="Meal Name (Auto-detecting...)" value={foodName} onChange={e => setFoodName(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-black font-black outline-none bg-white" required />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Qty" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-black font-bold outline-none bg-white" required />
                                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-black font-bold outline-none bg-white" required />
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

                            <div className="flex gap-2 relative">
                                {isGettingLocation && (
                                  <div className="absolute -top-5 right-0 flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">{locationStatus}</span>
                                  </div>
                                )}
                                <input type="text" placeholder="Address" value={locLine1} onChange={e => setLocLine1(e.target.value)} className="flex-1 px-4 py-3 rounded-2xl border border-black font-medium outline-none bg-white" required />
                                <button type="button" onClick={() => handleGetLocation('posting')} disabled={isGettingLocation} className={`px-4 rounded-2xl transition-all ${isGettingLocation ? 'bg-slate-100' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                  {isGettingLocation ? '...' : '📍'}
                                </button>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isAnalyzingImage || !foodImage || (safetyVerdict && !safetyVerdict.isSafe)}
                                className={`w-full text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-xs transition-all ${isAnalyzingImage || !foodImage || (safetyVerdict && !safetyVerdict.isSafe) ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                            >
                                {isAnalyzingImage ? 'Waiting for AI Verdict...' : 'Verify & Post Donation'}
                            </button>
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
