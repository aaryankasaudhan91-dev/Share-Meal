
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
  
  // Registration States
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  
  // Requester Registration States
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regLine1, setRegLine1] = useState('');
  const [regLine2, setRegLine2] = useState('');
  const [regLandmark, setRegLandmark] = useState('');
  const [regPincode, setRegPincode] = useState('');
  const [regLat, setRegLat] = useState<number | undefined>(undefined);
  const [regLng, setRegLng] = useState<number | undefined>(undefined);
  
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [regLocationStatus, setRegLocationStatus] = useState('');

  // Post Food States
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('meals');
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [foodAnalysis, setFoodAnalysis] = useState<{isSafe: boolean, reasoning: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Donation Address States
  const [donLine1, setDonLine1] = useState('');
  const [donLine2, setDonLine2] = useState('');
  const [donLandmark, setDonLandmark] = useState('');
  const [donPincode, setDonPincode] = useState('');
  const [donLat, setDonLat] = useState<number | undefined>(undefined);
  const [donLng, setDonLng] = useState<number | undefined>(undefined);
  const [isDetectingDonLocation, setIsDetectingDonLocation] = useState(false);
  const [donLocationStatus, setDonLocationStatus] = useState('');

  useEffect(() => {
    refreshData();
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log("Location access denied")
    );

    // Live Tracking Simulation Interval
    const trackingInterval = setInterval(() => {
      const currentPostings = storage.getPostings();
      let hasUpdates = false;

      const updatedPostings = currentPostings.map(post => {
        if (post.status === FoodStatus.IN_TRANSIT && post.requesterAddress && post.location.lat && post.location.lng && post.requesterAddress.lat && post.requesterAddress.lng) {
          hasUpdates = true;
          const currentPos = post.volunteerLocation || { lat: post.location.lat, lng: post.location.lng };
          const destPos = { lat: post.requesterAddress.lat, lng: post.requesterAddress.lng };

          // Move 2% closer to destination each tick
          const latDiff = destPos.lat - currentPos.lat;
          const lngDiff = destPos.lng - currentPos.lng;
          
          const nextLat = currentPos.lat + (latDiff * 0.05);
          const nextLng = currentPos.lng + (lngDiff * 0.05);

          // Update ETA based on distance (simplified)
          const distance = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2));
          const newEta = Math.max(1, Math.floor(distance * 1000));

          return {
            ...post,
            volunteerLocation: { lat: nextLat, lng: nextLng },
            etaMinutes: newEta
          };
        }
        return post;
      });

      if (hasUpdates) {
        localStorage.setItem('food_rescue_postings', JSON.stringify(updatedPostings));
        setPostings(updatedPostings);
      }
    }, 3000);

    return () => clearInterval(trackingInterval);
  }, []);

  // Pre-fill donor address when adding food
  useEffect(() => {
    if (isAddingFood && user?.address) {
       setDonLine1(user.address.line1);
       setDonLine2(user.address.line2);
       setDonLandmark(user.address.landmark || '');
       setDonPincode(user.address.pincode);
       setDonLat(user.address.lat);
       setDonLng(user.address.lng);
    } else if (isAddingFood && !user?.address) {
       setDonLine1('');
       setDonLine2('');
       setDonLandmark('');
       setDonPincode('');
       setDonLat(undefined);
       setDonLng(undefined);
    }
  }, [isAddingFood, user]);

  const refreshData = () => {
    setPostings(storage.getPostings());
    setAllUsers(storage.getUsers());
    if (user) {
      setNotifications(storage.getNotifications(user.id));
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = allUsers.find(u => u.name.toLowerCase() === loginName.toLowerCase());
    
    if (existing) {
      if (existing.password && existing.password !== loginPassword) {
        alert("Incorrect password.");
        return;
      }
      setUser(existing);
      setNotifications(storage.getNotifications(existing.id));
      setView('DASHBOARD');
      setLoginPassword('');
    } else {
      alert("User not found. Please register.");
    }
  };

  const handleDetectLocation = () => {
    setIsDetectingLocation(true);
    setRegLocationStatus('Locating...');
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setRegLat(latitude);
        setRegLng(longitude);
        setRegLocationStatus('AI Analyzing Address...');
        
        try {
            const address = await reverseGeocode(latitude, longitude);
            if (address) {
                setRegLine1(address.line1);
                setRegLine2(address.line2);
                setRegLandmark(address.landmark);
                setRegPincode(address.pincode);
                setRegLocationStatus('Location Detected!');
            } else {
                setRegLocationStatus('Location found. Please verify address.');
            }
        } catch (e) {
            setRegLocationStatus('Manual entry required.');
        }
        setIsDetectingLocation(false);
      },
      (err) => {
        alert("Could not access location. Please enter manually.");
        setIsDetectingLocation(false);
        setRegLocationStatus('');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleDetectDonLocation = () => {
    setIsDetectingDonLocation(true);
    setDonLocationStatus('Locating...');
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setDonLat(latitude);
        setDonLng(longitude);
        setDonLocationStatus('AI Analyzing Address...');
        
        try {
            const address = await reverseGeocode(latitude, longitude);
            if (address) {
                setDonLine1(address.line1);
                setDonLine2(address.line2);
                setDonLandmark(address.landmark);
                setDonPincode(address.pincode);
                setDonLocationStatus('Location Detected!');
            } else {
                setDonLocationStatus('Location found. Please verify address.');
            }
        } catch (e) {
            setDonLocationStatus('Manual entry required.');
        }
        setIsDetectingDonLocation(false);
      },
      (err) => {
        alert("Could not access location. Please enter manually.");
        setIsDetectingDonLocation(false);
        setDonLocationStatus('');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    let userAddress: Address | undefined = undefined;
    if (regRole === UserRole.REQUESTER) {
        if (!regLine1 || !regLine2 || !regPincode) {
            alert("Please fill in all required address fields (Line 1, Line 2, Pincode).");
            return;
        }
        userAddress = {
            line1: regLine1,
            line2: regLine2,
            landmark: regLandmark,
            pincode: regPincode,
            lat: regLat || userLocation?.lat || 28.6139,
            lng: regLng || userLocation?.lng || 77.2090
        };
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: regName,
      email: regEmail,
      password: regPassword,
      role: regRole,
      orgName: regRole === UserRole.REQUESTER ? regOrgName : undefined,
      orgCategory: regRole === UserRole.REQUESTER ? regOrgCategory : undefined,
      address: userAddress
    };
    storage.saveUser(newUser);
    setUser(newUser);
    setView('DASHBOARD');
    setRegPassword('');
    refreshData();
  };

  const handlePostFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const postLocation: Address = {
        line1: donLine1,
        line2: donLine2,
        landmark: donLandmark,
        pincode: donPincode,
        lat: donLat || userLocation?.lat || 28.6139,
        lng: donLng || userLocation?.lng || 77.2090
    };

    const newPost: FoodPosting = {
      id: Math.random().toString(36).substr(2, 9),
      donorId: user.id,
      donorName: user.name,
      foodName,
      quantity: `${quantity} ${unit}`,
      location: postLocation,
      expiryDate,
      status: FoodStatus.AVAILABLE,
      imageUrl: foodImage || undefined,
      safetyVerdict: foodAnalysis || undefined,
      createdAt: Date.now()
    };
    
    storage.savePosting(newPost);
    setIsAddingFood(false);
    setFoodName('');
    setQuantity('');
    setUnit('meals');
    setFoodImage(null);
    setFoodAnalysis(null);
    refreshData();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size too large. Please upload an image under 5MB.");
        return;
      }
      
      setIsAnalyzing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const analysis = await analyzeFoodSafetyImage(base64);
          if (analysis.isSafe) {
             setFoodImage(base64);
             setFoodAnalysis({ isSafe: true, reasoning: analysis.reasoning });
             // Auto-fill food name if empty and high confidence
             if (!foodName && analysis.detectedFoodName) {
               setFoodName(analysis.detectedFoodName);
             }
          } else {
             alert(`Safety Alert: ${analysis.reasoning}`);
             setFoodImage(null);
             setFoodAnalysis(null);
          }
        } catch (error) {
           console.error("AI Analysis Error:", error);
           alert("Could not verify image with AI.");
        }
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const updatePosting = (id: string, updates: Partial<FoodPosting>) => {
    storage.updatePosting(id, updates);
    refreshData();
  };

  const handleLogout = () => {
    setUser(null);
    setView('LOGIN');
    // Reset reg forms
    setRegName(''); setRegEmail(''); setRegPassword(''); setRegRole(UserRole.DONOR);
    setRegOrgName(''); setRegOrgCategory('Orphanage');
    setRegLine1(''); setRegLine2(''); setRegLandmark(''); setRegPincode('');
    setLoginName(''); setLoginPassword('');
  };

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-100">
          <div className="text-center mb-8">
            <img src={LOGO_URL} className="h-16 w-16 mx-auto mb-4" alt="Logo" />
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">ShareMeal</h1>
            <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">Connect</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="Username" 
              className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              required
            />
            <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs">Login</button>
          </form>
          <button onClick={() => setView('REGISTER')} className="w-full mt-4 text-slate-500 text-xs font-bold hover:text-emerald-600">Don't have an account? Register</button>
        </div>
      </div>
    );
  }

  if (view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-100 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <svg className="w-64 h-64 transform translate-x-1/2 -translate-y-1/2 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
                 <button onClick={() => setView('LOGIN')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                 </button>
                 <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Join the Mission</h2>
            </div>
            
            <form onSubmit={handleRegister} className="space-y-5">
              
              <div className="space-y-4">
                <div className="relative group">
                    <span className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </span>
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium" 
                      value={regName} 
                      onChange={e => setRegName(e.target.value)} 
                      required 
                    />
                </div>
                <div className="relative group">
                    <span className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2z" /></svg>
                    </span>
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium" 
                      value={regEmail} 
                      onChange={e => setRegEmail(e.target.value)} 
                      required 
                    />
                </div>
                <div className="relative group">
                    <span className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                    <input 
                      type="password" 
                      placeholder="Password" 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium" 
                      value={regPassword} 
                      onChange={e => setRegPassword(e.target.value)} 
                      required 
                    />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">I want to...</label>
                <div className="grid grid-cols-3 gap-3">
                    {[
                      { role: UserRole.DONOR, label: 'Donate', icon: '🎁', desc: 'Give Food' },
                      { role: UserRole.VOLUNTEER, label: 'Volunteer', icon: '🚚', desc: 'Deliver' },
                      { role: UserRole.REQUESTER, label: 'Request', icon: '🏠', desc: 'Need Food' }
                    ].map((item) => (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setRegRole(item.role)}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 relative overflow-hidden ${
                          regRole === item.role 
                            ? 'border-black bg-emerald-50 text-emerald-900 shadow-md transform scale-105 z-10' 
                            : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-emerald-200 hover:bg-white hover:text-emerald-600'
                        }`}
                      >
                        <span className="text-2xl mb-1">{item.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                        <span className="text-[9px] font-medium opacity-70">{item.desc}</span>
                        {regRole === item.role && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              {regRole === UserRole.REQUESTER && (
                <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-300 pt-2 border-t border-slate-100">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3 mt-2">
                        <span className="text-lg">ℹ️</span>
                        <p className="text-[10px] font-medium text-blue-800 leading-relaxed mt-0.5">
                            Requester accounts are for orphanages, shelters, and NGOs. Verification may be required.
                        </p>
                    </div>
                    <div className="relative group">
                        <span className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </span>
                        <input 
                            type="text" 
                            placeholder="Organization Name" 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium" 
                            value={regOrgName} 
                            onChange={e => setRegOrgName(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="relative group">
                        <span className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                        </span>
                        <select 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all text-slate-700 font-medium appearance-none" 
                            value={regOrgCategory} 
                            onChange={e => setRegOrgCategory(e.target.value)}
                        >
                            <option value="Orphanage">Orphanage</option>
                            <option value="Old Age Home">Old Age Home</option>
                            <option value="Shelter">Homeless Shelter</option>
                            <option value="NGO">NGO</option>
                            <option value="Other">Other</option>
                        </select>
                        <div className="absolute right-4 top-4 pointer-events-none">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                    
                    {/* Enhanced Address Section */}
                    <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Address Details</label>
                            <button 
                                type="button"
                                onClick={handleDetectLocation}
                                disabled={isDetectingLocation}
                                className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 disabled:opacity-50 transition-colors"
                            >
                                {isDetectingLocation ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Detecting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                        Auto-Detect
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <input 
                            type="text" 
                            placeholder="Line 1 (House No, Building)" 
                            className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                            value={regLine1} 
                            onChange={e => setRegLine1(e.target.value)} 
                            required 
                            disabled={isDetectingLocation}
                        />
                        <input 
                            type="text" 
                            placeholder="Line 2 (Street, Area)" 
                            className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                            value={regLine2} 
                            onChange={e => setRegLine2(e.target.value)} 
                            required 
                            disabled={isDetectingLocation}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <input 
                                type="text" 
                                placeholder="Landmark (Optional)" 
                                className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                                value={regLandmark} 
                                onChange={e => setRegLandmark(e.target.value)} 
                                disabled={isDetectingLocation}
                            />
                            <input 
                                type="text" 
                                placeholder="Pincode" 
                                className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                                value={regPincode} 
                                onChange={e => setRegPincode(e.target.value)} 
                                required 
                                disabled={isDetectingLocation}
                            />
                        </div>
                        {regLocationStatus && (
                            <p className="text-[10px] font-bold text-emerald-600 text-center animate-pulse">{regLocationStatus}</p>
                        )}
                    </div>
                </div>
              )}

              <button className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg uppercase tracking-widest text-xs flex items-center justify-center gap-2 group">
                Create Account
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </form>
            <div className="mt-6 text-center">
                <p className="text-slate-400 text-xs font-medium">By registering, you agree to our <a href="#" className="underline hover:text-emerald-600">Terms</a> & <a href="#" className="underline hover:text-emerald-600">Privacy Policy</a>.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      onLogoClick={() => setView('DASHBOARD')}
      onProfileClick={() => setView('PROFILE')}
      notifications={notifications}
      onMarkNotificationRead={(id) => { storage.markNotificationRead(id); refreshData(); }}
    >
      {view === 'PROFILE' ? (
        <ProfileView user={user!} onUpdate={(updates) => { storage.updateUser(user!.id, updates); refreshData(); }} onBack={() => setView('DASHBOARD')} />
      ) : (
        <div className="space-y-8">
          {user?.role === UserRole.DONOR && (
            <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Post Surplus Food</h2>
                <button onClick={() => setIsAddingFood(!isAddingFood)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest">{isAddingFood ? 'Close' : 'New Donation'}</button>
              </div>
              {isAddingFood && (
                <form onSubmit={handlePostFood} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-300">
                  <input 
                    type="text" 
                    placeholder="What are you donating?" 
                    className="px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none" 
                    value={foodName} 
                    onChange={e => setFoodName(e.target.value)} 
                    required 
                  />
                  
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      min="1"
                      placeholder="Qty" 
                      className="flex-1 px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none font-medium" 
                      value={quantity} 
                      onChange={e => setQuantity(e.target.value)}
                      onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                      required 
                    />
                    <div className="relative w-1/3 min-w-[120px]">
                      <select 
                        value={unit} 
                        onChange={e => setUnit(e.target.value)}
                        className="w-full h-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none appearance-none font-medium text-slate-700 cursor-pointer"
                      >
                        <option value="meals">Meals</option>
                        <option value="servings">Servings</option>
                        <option value="kg">kg</option>
                        <option value="lbs">lbs</option>
                        <option value="boxes">Boxes</option>
                        <option value="packets">Packets</option>
                        <option value="items">Items</option>
                        <option value="liters">Liters</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  <input 
                    type="datetime-local" 
                    className="md:col-span-2 px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none" 
                    value={expiryDate} 
                    onChange={e => setExpiryDate(e.target.value)} 
                    required 
                  />
                  
                  {/* Donation Address Section */}
                   <div className="md:col-span-2 space-y-3 pt-2 border-t border-slate-100 mt-2">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Pickup Location</label>
                            <button 
                                type="button"
                                onClick={handleDetectDonLocation}
                                disabled={isDetectingDonLocation}
                                className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 disabled:opacity-50 transition-colors"
                            >
                                {isDetectingDonLocation ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Detecting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                        Auto-Detect
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <input 
                            type="text" 
                            placeholder="Line 1 (House No, Building)" 
                            className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                            value={donLine1} 
                            onChange={e => setDonLine1(e.target.value)} 
                            required 
                            disabled={isDetectingDonLocation}
                           />
                           <input 
                            type="text" 
                            placeholder="Line 2 (Street, Area)" 
                            className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                            value={donLine2} 
                            onChange={e => setDonLine2(e.target.value)} 
                            required 
                            disabled={isDetectingDonLocation}
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input 
                                type="text" 
                                placeholder="Landmark (Optional)" 
                                className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                                value={donLandmark} 
                                onChange={e => setDonLandmark(e.target.value)} 
                                disabled={isDetectingDonLocation}
                            />
                            <input 
                                type="text" 
                                placeholder="Pincode" 
                                className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm disabled:bg-slate-50 disabled:text-slate-400" 
                                value={donPincode} 
                                onChange={e => setDonPincode(e.target.value)} 
                                required 
                                disabled={isDetectingDonLocation}
                            />
                        </div>
                        {donLocationStatus && (
                            <p className="text-[10px] font-bold text-emerald-600 text-center animate-pulse">{donLocationStatus}</p>
                        )}
                    </div>
                  
                   {/* Image Upload */}
                   <div className="md:col-span-2 border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative group">
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isAnalyzing}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    
                    {isAnalyzing ? (
                         <div className="flex flex-col items-center gap-2 py-2">
                            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Analyzing Food Safety...</span>
                         </div>
                    ) : foodImage ? (
                        <div className="relative z-20 w-full">
                            <img src={foodImage} alt="Preview" className="h-48 w-full object-cover rounded-lg shadow-sm" />
                            <div className="absolute top-2 right-2 flex flex-col items-end gap-1 max-w-[70%]">
                                <span className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    AI Verified
                                </span>
                                {foodAnalysis?.reasoning && (
                                    <div className="bg-black/60 backdrop-blur-md text-white text-[9px] p-2 rounded-lg text-right shadow-sm border border-white/10">
                                        {foodAnalysis.reasoning}
                                    </div>
                                )}
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setFoodImage(null);
                                        setFoodAnalysis(null);
                                    }}
                                    className="bg-white text-red-500 p-1 rounded-full shadow-sm hover:bg-red-50 mt-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-2 flex flex-col items-center gap-1 pointer-events-none">
                            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full mb-1 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Upload Food Photo</span>
                            <span className="text-[10px] font-medium text-slate-400">AI will verify safety & detect food type</span>
                        </div>
                    )}
                  </div>

                  <button disabled={isAnalyzing} className="md:col-span-2 bg-emerald-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs disabled:opacity-50">Publish Donation</button>
                </form>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
               <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Active Postings</h2>
                  <div className="flex bg-slate-200 p-1 rounded-xl">
                    <button onClick={() => setDashboardMode('FEED')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dashboardMode === 'FEED' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Feed</button>
                    <button onClick={() => setDashboardMode('MAP')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dashboardMode === 'MAP' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Map</button>
                  </div>
               </div>

               {dashboardMode === 'FEED' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {postings.filter(p => p.status !== FoodStatus.DELIVERED).map(post => (
                      <FoodCard key={post.id} posting={post} user={user!} onUpdate={updatePosting} />
                    ))}
                    {postings.filter(p => p.status !== FoodStatus.DELIVERED).length === 0 && (
                      <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                        No active food rescues found.
                      </div>
                    )}
                 </div>
               ) : (
                 <RequesterMap requesters={allUsers.filter(u => u.role === UserRole.REQUESTER)} currentLocation={userLocation} user={user!} onToggleFavorite={(rid) => { storage.toggleFavorite(user!.id, rid); refreshData(); }} />
               )}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-1">Impact Score</h3>
                  <div className="text-4xl font-black">{user?.impactScore || 0}</div>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Meals Rescued & Delivered</p>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4">Rescue History</h3>
                <div className="space-y-3">
                  {postings.filter(p => p.status === FoodStatus.DELIVERED).slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800">{p.foodName}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">{new Date(p.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
