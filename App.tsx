
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Address, Notification } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage, ImageAnalysisResult } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import RequesterMap from './components/RequesterMap';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD'>('LOGIN');
  const [showVolunteerMap, setShowVolunteerMap] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'recent' | 'expiry'>('recent');
  const [donorViewMode, setDonorViewMode] = useState<'active' | 'history'>('active');
  
  // Registration form states
  const [loginName, setLoginName] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  
  // Requester specific registration states
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regOrgName, setRegOrgName] = useState('');
  const [regAddrLine1, setRegAddrLine1] = useState('');
  const [regAddrLine2, setRegAddrLine2] = useState('');
  const [regAddrLandmark, setRegAddrLandmark] = useState('');
  const [regAddrPincode, setRegAddrPincode] = useState('');
  const [regLat, setRegLat] = useState<number | undefined>(undefined);
  const [regLng, setRegLng] = useState<number | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Posting form state
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locLine1, setLocLine1] = useState('');
  const [locLine2, setLocLine2] = useState('');
  const [locLandmark, setLocLandmark] = useState('');
  const [locPincode, setLocPincode] = useState('');
  const [locLat, setLocLat] = useState<number | undefined>(undefined);
  const [locLng, setLocLng] = useState<number | undefined>(undefined);
  const [isGettingPostingLocation, setIsGettingPostingLocation] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [safetyVerdict, setSafetyVerdict] = useState<{ isSafe: boolean; reasoning: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load postings on mount
  useEffect(() => {
    setPostings(storage.getPostings());
    setAllUsers(storage.getUsers());
  }, []);

  // Poll for notifications and posting updates
  useEffect(() => {
    if (!user) return;
    
    // Get current location for map centering if volunteer
    if (user.role === UserRole.VOLUNTEER && !userLocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log("Location access denied")
        );
    }

    const fetchData = () => {
      const userNotifications = storage.getNotifications(user.id);
      setNotifications(userNotifications);
      
      const currentPostings = storage.getPostings();
      setPostings(currentPostings); // Also refresh postings to see status changes in real-time
      setAllUsers(storage.getUsers());

      // Check for expiry warnings for Donors
      if (user.role === UserRole.DONOR) {
        const now = Date.now();
        const WARNING_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours

        currentPostings.forEach(p => {
            if (p.donorId === user.id && p.status === FoodStatus.AVAILABLE) {
                const expiryTime = new Date(p.expiryDate).getTime();
                const timeUntilExpiry = expiryTime - now;

                if (timeUntilExpiry > 0 && timeUntilExpiry < WARNING_THRESHOLD) {
                    const message = `⚠️ Urgent: Your donation "${p.foodName}" expires in < 2 hours and hasn't been picked up.`;
                    const alreadyNotified = userNotifications.some(n => n.message === message);
                    
                    if (!alreadyNotified) {
                        storage.createNotification(user.id, message, 'ACTION');
                    }
                }
            }
        });
      }
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Volunteer Location Tracker Logic
  useEffect(() => {
     if (user?.role !== UserRole.VOLUNTEER) return;
     
     // Periodically send location if I am a volunteer on the move
     const trackerInterval = setInterval(() => {
         const currentPostings = storage.getPostings();
         const myActiveJobs = currentPostings.filter(p => p.volunteerId === user.id && p.status === FoodStatus.IN_TRANSIT);
         
         if (myActiveJobs.length > 0) {
             navigator.geolocation.getCurrentPosition((pos) => {
                 myActiveJobs.forEach(job => {
                     // Check if location actually changed significantly to avoid storage spam? 
                     // For demo simplicity, we just update.
                     storage.updatePosting(job.id, {
                         volunteerLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude }
                     });
                 });
             }, (err) => console.log("Tracker error", err), { enableHighAccuracy: true });
         }
     }, 5000); // Update location every 5 seconds
     
     return () => clearInterval(trackerInterval);
  }, [user]);

  const handleMarkNotificationRead = (id: string) => {
    storage.markNotificationRead(id);
    if (user) {
      setNotifications(storage.getNotifications(user.id));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setFoodImage(base64);
        setIsAnalyzingImage(true);
        setSafetyVerdict(null);
        try {
          const result = await analyzeFoodSafetyImage(base64);
          setSafetyVerdict({ isSafe: result.isSafe, reasoning: result.reasoning });
          if (result.detectedFoodName && !foodName) {
            setFoodName(result.detectedFoodName);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsAnalyzingImage(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetLocation = () => {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setRegLat(pos.coords.latitude);
              setRegLng(pos.coords.longitude);
              setIsGettingLocation(false);
          },
          (err) => {
              alert("Could not retrieve location. Please enter address manually.");
              setIsGettingLocation(false);
          }
      );
  };

  const handleGetPostingLocation = () => {
      setIsGettingPostingLocation(true);
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setLocLat(pos.coords.latitude);
              setLocLng(pos.coords.longitude);
              setIsGettingPostingLocation(false);
          },
          (err) => {
              alert("Could not retrieve location. Please enter address manually.");
              setIsGettingPostingLocation(false);
          }
      );
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail) return;
    
    const address: Address | undefined = regRole === UserRole.REQUESTER ? {
      line1: regAddrLine1,
      line2: regAddrLine2,
      landmark: regAddrLandmark,
      pincode: regAddrPincode,
      lat: regLat,
      lng: regLng
    } : undefined;

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: regName,
      email: regEmail,
      role: regRole,
      address,
      orgCategory: regRole === UserRole.REQUESTER ? regOrgCategory : undefined,
      orgName: regRole === UserRole.REQUESTER ? regOrgName : undefined,
    };
    storage.saveUser(newUser);
    setUser(newUser);
    setView('DASHBOARD');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = storage.getUsers();
    const existing = users.find(u => u.name.toLowerCase() === loginName.toLowerCase());
    if (existing) {
      setUser(existing);
      setView('DASHBOARD');
    } else {
      alert("User not found. Try registering!");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setNotifications([]);
    setView('LOGIN');
    setShowVolunteerMap(false);
  };

  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== UserRole.DONOR) return;
    
    const location: Address = {
      line1: locLine1,
      line2: locLine2,
      landmark: locLandmark,
      pincode: locPincode,
      lat: locLat,
      lng: locLng
    };

    const newPost: FoodPosting = {
      id: Math.random().toString(36).substr(2, 9),
      donorId: user.id,
      donorName: user.name,
      foodName,
      quantity,
      location,
      expiryDate,
      status: FoodStatus.AVAILABLE,
      imageUrl: foodImage || undefined,
      safetyVerdict: safetyVerdict || undefined,
      createdAt: Date.now()
    };
    
    storage.savePosting(newPost);
    setPostings(prev => [newPost, ...prev]);
    setIsAddingFood(false);
    setFoodName('');
    setQuantity('');
    setLocLine1('');
    setLocLine2('');
    setLocLandmark('');
    setLocPincode('');
    setLocLat(undefined);
    setLocLng(undefined);
    setExpiryDate('');
    setFoodImage(null);
    setSafetyVerdict(null);
  };

  const updatePostingStatus = (id: string, updates: Partial<FoodPosting>) => {
    const updated = storage.updatePosting(id, updates);
    if (updated) {
      setPostings(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  };

  // Shared input class with white background and black border
  const inputClass = "w-full px-4 py-3 rounded-xl border border-black bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all";
  const smallInputClass = "w-full px-3 py-2 rounded-lg border border-black bg-white focus:ring-1 focus:ring-emerald-500 outline-none text-sm";

  const AppBrand = () => (
    <div className="flex flex-col items-center mb-6">
      <img src="logo.png" alt="Share Meal Connect" className="h-24 w-24 object-contain mb-4" />
      <span className="font-bold text-2xl tracking-tight text-slate-800">Share Meal Connect</span>
    </div>
  );

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-emerald-100">
          <div className="text-center mb-8">
            <AppBrand />
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome Back</h1>
            <p className="text-slate-500">Sign in to start rescuing food</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
              <input 
                type="text" 
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                className={inputClass}
                placeholder="Enter your name"
                required
              />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-200">
              Sign In
            </button>
          </form>
          <p className="text-center mt-6 text-sm text-slate-500">
            Don't have an account? 
            <button onClick={() => setView('REGISTER')} className="ml-1 text-emerald-600 font-bold hover:underline">Register</button>
          </p>
        </div>
      </div>
    );
  }

  if (view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-emerald-100 max-h-[95vh] overflow-y-auto">
          <div className="text-center mb-6">
            <AppBrand />
            <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Join Us</h1>
            <p className="text-slate-500">Become a part of the solution</p>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
              <input 
                type="text" 
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className={inputClass.replace('py-3', 'py-2.5')}
                placeholder="Full Name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className={inputClass.replace('py-3', 'py-2.5')}
                placeholder="email@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
              <select 
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as UserRole)}
                className={inputClass.replace('py-3', 'py-2.5')}
              >
                <option value={UserRole.DONOR}>Food Donor</option>
                <option value={UserRole.VOLUNTEER}>Volunteer Transporter</option>
                <option value={UserRole.REQUESTER}>Requester</option>
              </select>
            </div>
            {regRole === UserRole.REQUESTER && (
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                <h4 className="font-bold text-slate-700 text-sm border-b pb-2">Organisation Details</h4>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Organisation Name*</label>
                  <input 
                    type="text" required value={regOrgName} onChange={e => setRegOrgName(e.target.value)} 
                    className={inputClass.replace('py-3', 'py-2.5')} 
                    placeholder="Name of your Organisation" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Organisation Category*</label>
                  <select 
                    value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)} 
                    className={inputClass.replace('py-3', 'py-2.5')}
                  >
                    <option value="Orphanage">Orphanage</option>
                    <option value="Old age home">Old age home</option>
                    <option value="NGO's">NGO's</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                
                <h4 className="font-bold text-slate-700 text-sm border-b pb-2 mt-4 flex justify-between items-center">
                    Drop-off Address
                    <button 
                        type="button" 
                        onClick={handleGetLocation}
                        className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 transition-colors flex items-center gap-1"
                    >
                        {isGettingLocation ? 'Getting location...' : (regLat ? '✓ Location Set' : '📍 Use Current Location')}
                    </button>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Address Line 1*</label>
                    <input type="text" required value={regAddrLine1} onChange={e => setRegAddrLine1(e.target.value)} className={smallInputClass} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Address Line 2*</label>
                    <input type="text" required value={regAddrLine2} onChange={e => setRegAddrLine2(e.target.value)} className={smallInputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Landmark (Optional)</label>
                    <input type="text" value={regAddrLandmark} onChange={e => setRegAddrLandmark(e.target.value)} className={smallInputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Pincode*</label>
                    <input type="text" required value={regAddrPincode} onChange={e => setRegAddrPincode(e.target.value)} className={smallInputClass} />
                  </div>
                </div>
                {regLat && <p className="text-[10px] text-emerald-600 font-medium text-center">Coordinates captured: {regLat.toFixed(4)}, {regLng?.toFixed(4)}</p>}
              </div>
            )}
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg">
              Create Account
            </button>
          </form>
          <p className="text-center mt-4 text-sm text-slate-500">
            Already have an account? 
            <button onClick={() => setView('LOGIN')} className="ml-1 text-emerald-600 font-bold hover:underline">Login</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
    >
      <div className="space-y-8">
        <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">Hello, {user?.name}!</h2>
            <p className="text-emerald-50 opacity-90 max-w-md text-sm sm:text-base">
              {user?.role === UserRole.DONOR && "Share your surplus food with those who need it most today."}
              {user?.role === UserRole.VOLUNTEER && "Check out available pickups and help deliver smiles."}
              {user?.role === UserRole.REQUESTER && `Browse available surplus for ${user?.orgName || 'your organization'}.`}
            </p>
            {user?.role === UserRole.DONOR && !isAddingFood && (
              <button 
                onClick={() => setIsAddingFood(true)}
                className="mt-6 bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-sm text-sm"
              >
                + Post New Surplus
              </button>
            )}
            {user?.role === UserRole.VOLUNTEER && (
                <button 
                    onClick={() => setShowVolunteerMap(!showVolunteerMap)}
                    className="mt-6 bg-white/20 text-white border-2 border-white/50 px-6 py-3 rounded-xl font-bold hover:bg-white/30 transition-colors shadow-sm text-sm flex items-center gap-2"
                >
                    {showVolunteerMap ? 'Show List View' : 'Show Nearby Organizations Map'}
                </button>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full -mr-20 -mt-20 opacity-20"></div>
        </div>

        {isAddingFood && user?.role === UserRole.DONOR && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-in slide-in-from-top duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Post Surplus Food</h3>
              <button onClick={() => setIsAddingFood(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddFood} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Food Photo (AI Safety Check)</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="relative w-full sm:w-auto">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-xl transition-all w-full sm:w-auto ${
                        foodImage ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-300 text-slate-500 hover:border-emerald-500 hover:bg-emerald-50'
                      }`}
                    >
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      {isAnalyzingImage ? 'Analyzing...' : foodImage ? 'Change Photo' : 'Capture / Add Photo'}
                    </button>
                    <input 
                      type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" capture="environment"
                    />
                  </div>
                  {foodImage && !isAnalyzingImage && (
                    <div className="flex-1 w-full sm:w-auto animate-in fade-in duration-300">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="relative h-16 w-16 rounded-lg overflow-hidden shrink-0">
                          <img src={foodImage} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                           {safetyVerdict ? (
                             <>
                               <p className={`text-xs font-bold uppercase tracking-tight ${safetyVerdict.isSafe ? 'text-emerald-600' : 'text-red-600'}`}>
                                 {safetyVerdict.isSafe ? '✓ AI Verified Safe' : '⚠ AI Warning'}
                               </p>
                               <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight mt-0.5">{safetyVerdict.reasoning}</p>
                             </>
                           ) : (
                             <p className="text-xs text-slate-400 italic">Waiting for verdict...</p>
                           )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">What are you donating?</label>
                <input type="text" required value={foodName} onChange={e => setFoodName(e.target.value)} className={inputClass.replace('py-3', 'py-2.5')} placeholder="e.g., 20 Lunch Boxes" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity/Weight</label>
                <input type="text" required value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass.replace('py-3', 'py-2.5')} placeholder="e.g., 5kg or 20 packets" />
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 text-sm border-b pb-2 flex justify-between items-center">
                    Pickup Location Details
                    <button 
                        type="button" 
                        onClick={handleGetPostingLocation}
                        className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 transition-colors flex items-center gap-1"
                    >
                        {isGettingPostingLocation ? 'Getting location...' : (locLat ? '✓ Location Set' : '📍 Use Current Location')}
                    </button>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Address Line 1*</label>
                    <input type="text" required value={locLine1} onChange={e => setLocLine1(e.target.value)} className={smallInputClass} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Address Line 2*</label>
                    <input type="text" required value={locLine2} onChange={e => setLocLine2(e.target.value)} className={smallInputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Landmark (Optional)</label>
                    <input type="text" value={locLandmark} onChange={e => setLocLandmark(e.target.value)} className={smallInputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Pincode*</label>
                    <input type="text" required value={locPincode} onChange={e => setLocPincode(e.target.value)} className={smallInputClass} />
                  </div>
                  {locLat && <p className="col-span-2 text-[10px] text-emerald-600 font-medium text-center">Coordinates captured: {locLat.toFixed(4)}, {locLng?.toFixed(4)}</p>}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Expiry / Best Before</label>
                <input type="datetime-local" required value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputClass.replace('py-3', 'py-2.5')} />
              </div>
              <button 
                type="submit" 
                disabled={isAnalyzingImage}
                className={`col-span-1 md:col-span-2 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-2 ${
                  isAnalyzingImage ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isAnalyzingImage ? 'Verifying Food...' : 'Publish Food Posting'}
              </button>
            </form>
          </div>
        )}

        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {user?.role === UserRole.VOLUNTEER ? (showVolunteerMap ? 'Map View' : 'Available Pickups') : user?.role === UserRole.DONOR ? (donorViewMode === 'history' ? 'Donation History' : 'My Donations & Tracking') : 'Recent Postings'}
              </h3>
              {user?.role === UserRole.DONOR && donorViewMode === 'history' && (
                 <p className="text-sm text-slate-500 mt-1">Thank you for your contributions!</p>
              )}
            </div>
            
            {(!showVolunteerMap || user?.role !== UserRole.VOLUNTEER) && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {user?.role === UserRole.DONOR && (
                        <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
                             <button 
                               onClick={() => setDonorViewMode('active')}
                               className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${donorViewMode === 'active' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                             >
                               Active
                             </button>
                             <button 
                               onClick={() => setDonorViewMode('history')}
                               className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${donorViewMode === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                             >
                               History
                             </button>
                        </div>
                    )}

                    <label className="text-xs font-semibold text-slate-500 hidden sm:block">Sort by:</label>
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'recent' | 'expiry')}
                        className="text-sm border-slate-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 bg-white border px-3 py-2 outline-none cursor-pointer hover:border-emerald-400 transition-colors"
                    >
                        <option value="recent">Recently Added</option>
                        <option value="expiry">Expiring Soon (Urgent)</option>
                    </select>
                </div>
            )}
          </div>
          
          {showVolunteerMap && user?.role === UserRole.VOLUNTEER ? (
              <RequesterMap 
                requesters={allUsers.filter(u => u.role === UserRole.REQUESTER)} 
                currentLocation={userLocation}
              />
          ) : (
              <>
                {postings
                    .filter(p => {
                        if (user?.role === UserRole.VOLUNTEER) return p.status !== FoodStatus.DELIVERED;
                        if (user?.role === UserRole.DONOR) {
                            if (p.donorId !== user.id) return false;
                            return donorViewMode === 'history' 
                                ? p.status === FoodStatus.DELIVERED 
                                : p.status !== FoodStatus.DELIVERED;
                        }
                        return p.status === FoodStatus.AVAILABLE || p.orphanageId === user?.id;
                    }).length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                    <h4 className="text-lg font-bold text-slate-700">
                        {user?.role === UserRole.DONOR && donorViewMode === 'history' 
                         ? "No delivered donations yet" 
                         : "No active postings"}
                    </h4>
                    <p className="text-slate-500 mt-1">
                        {user?.role === UserRole.DONOR && donorViewMode === 'history' 
                         ? "Your completed donations will appear here."
                         : "Be the first to rescue food in your area!"}
                    </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {postings
                        .filter(p => {
                            if (user?.role === UserRole.VOLUNTEER) return p.status !== FoodStatus.DELIVERED;
                            if (user?.role === UserRole.DONOR) {
                                if (p.donorId !== user.id) return false;
                                return donorViewMode === 'history' 
                                    ? p.status === FoodStatus.DELIVERED 
                                    : p.status !== FoodStatus.DELIVERED;
                            }
                            return p.status === FoodStatus.AVAILABLE || p.orphanageId === user?.id;
                        })
                        .sort((a, b) => {
                            if (sortBy === 'expiry') {
                                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
                            }
                            return b.createdAt - a.createdAt;
                        })
                        .map(posting => (
                        <FoodCard key={posting.id} posting={posting} user={user!} onUpdate={updatePostingStatus} />
                    ))}
                    </div>
                )}
              </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default App;
