import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Address, Notification } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import RequesterMap from './components/RequesterMap';
import ProfileView from './components/ProfileView';
import LocationPickerMap from './components/LocationPickerMap';

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/1000/1000399.png';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD' | 'PROFILE'>('LOGIN');
  const [dashboardMode, setDashboardMode] = useState<'FEED' | 'MAP' | 'TASKS'>('FEED');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  
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
  const [regErrors, setRegErrors] = useState<{ [key: string]: string }>({});
  
  // Post Food States
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodCategory, setFoodCategory] = useState('Prepared Meal');
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
  const [donErrors, setDonErrors] = useState<{ [key: string]: string }>({});

  // Contact Modal States
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactTargetUser, setContactTargetUser] = useState<User | null>(null);
  const [contactMessage, setContactMessage] = useState('');

  // Requester Details Modal States
  const [showRequesterDetailsModal, setShowRequesterDetailsModal] = useState(false);
  const [selectedRequesterDetails, setSelectedRequesterDetails] = useState<User | null>(null);

  // General UI States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Splash Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
        setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

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

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 750);
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrors({});

    let userAddress: Address | undefined = undefined;
    if (regRole === UserRole.REQUESTER) {
        const errors: { [key: string]: string } = {};
        if (!regLine1.trim()) errors.line1 = "Address Line 1 is required.";
        if (!regLine2.trim()) errors.line2 = "Address Line 2 is required.";
        if (!regPincode.trim()) {
            errors.pincode = "Pincode is required.";
        } else if (!/^\d{6}$/.test(regPincode)) {
            errors.pincode = "Pincode must be exactly 6 digits.";
        }

        if (Object.keys(errors).length > 0) {
            setRegErrors(errors);
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
    setDonErrors({});

    const errors: { [key: string]: string } = {};
    if (!donLine1.trim()) errors.line1 = "Address Line 1 is required.";
    if (!donLine2.trim()) errors.line2 = "Address Line 2 is required.";
    if (!donPincode.trim()) {
        errors.pincode = "Pincode is required.";
    } else if (!/^\d{6}$/.test(donPincode)) {
        errors.pincode = "Pincode must be exactly 6 digits.";
    }

    if (Object.keys(errors).length > 0) {
        setDonErrors(errors);
        return;
    }
    
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
      donorOrg: user.orgName,
      foodName,
      foodCategory,
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
    setFoodCategory('Prepared Meal');
    setQuantity('');
    setUnit('meals');
    setExpiryDate('');
    setFoodImage(null);
    setFoodAnalysis(null);
    setDonErrors({});
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
    setRegErrors({});
    setLoginName(''); setLoginPassword('');
  };

  // Contact Handlers
  const handleContactRequester = (requesterId: string) => {
      const targetUser = allUsers.find(u => u.id === requesterId);
      if (targetUser) {
          setContactTargetUser(targetUser);
          setShowContactModal(true);
          setShowRequesterDetailsModal(false);
      }
  };

  const handleViewRequesterDetails = (requesterId: string) => {
      const targetUser = allUsers.find(u => u.id === requesterId);
      if (targetUser) {
          setSelectedRequesterDetails(targetUser);
          setShowRequesterDetailsModal(true);
      }
  };

  const submitContactMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!contactTargetUser || !user) return;

      // In a real app, this would create a proper chat session or email.
      // Here we use notifications to simulate the contact.
      const message = `Inquiry from ${user.name}: ${contactMessage}`;
      
      storage.createNotification(contactTargetUser.id, message, 'INFO');
      
      alert(`Message sent to ${contactTargetUser.orgName || contactTargetUser.name}!`);
      setShowContactModal(false);
      setContactMessage('');
      setContactTargetUser(null);
  };

  // Helper to filter postings based on current view mode
  const getFilteredPostings = () => {
    return postings.filter(p => {
        const matchesSearch = !searchQuery || 
            p.foodName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            p.donorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.donorOrg && p.donorOrg.toLowerCase().includes(searchQuery.toLowerCase()));

        if (dashboardMode === 'TASKS') {
            const isAssigned = p.volunteerId === user?.id;
            const isInterested = (p.interestedVolunteers || []).some(v => v.userId === user?.id);
            return matchesSearch && (isAssigned || isInterested);
        } else {
            // FEED
            const isRecentOrActive = p.status !== FoodStatus.DELIVERED || (Date.now() - p.createdAt < 86400000);
            return isRecentOrActive && matchesSearch;
        }
    }).sort((a, b) => b.createdAt - a.createdAt);
  };

  const filteredPostings = getFilteredPostings();

  const splashScreen = (
    <div className={`fixed inset-0 z-[9999] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-100 via-teal-50 to-slate-50 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${showSplash ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Logo Animation */}
        <div className={`relative mb-6 transition-all duration-1000 delay-100 transform ${showSplash ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
            <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-20 animate-pulse rounded-full"></div>
            <img src={LOGO_URL} className="w-28 h-28 relative z-10 drop-shadow-2xl" alt="Logo" />
        </div>
        
        {/* Text Animation */}
        <div className="text-center space-y-3">
            <h1 className={`text-4xl font-black text-slate-800 tracking-tighter transition-all duration-1000 delay-300 transform ${showSplash ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            ShareMeal <span className="text-emerald-600">Connect</span>
            </h1>
            <p className={`text-sm font-bold text-slate-400 uppercase tracking-[0.3em] transition-all duration-1000 delay-500 transform ${showSplash ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
            Rescue • Feed • Protect
            </p>
        </div>

        {/* Loading Bar */}
        <div className={`absolute bottom-12 w-48 h-1 bg-slate-200 rounded-full overflow-hidden transition-all duration-700 delay-700 ${showSplash ? 'opacity-100' : 'opacity-0'}`}>
            <div className="h-full bg-emerald-500 animate-[loading_2s_ease-in-out_infinite] w-full origin-left" style={{animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'}}></div>
        </div>
    </div>
  );

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        {splashScreen}
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-200/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-200/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
            <div className="absolute bottom-[10%] left-[20%] w-[35%] h-[35%] bg-amber-200/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/50 relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center mb-10">
            <div className="inline-block relative">
                <div className="absolute inset-0 bg-emerald-200 rounded-full blur-xl opacity-50"></div>
                <img src={LOGO_URL} className="h-20 w-20 mx-auto mb-4 relative z-10 transform hover:scale-110 transition-transform duration-300" alt="Logo" />
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-1">ShareMeal</h1>
            <p className="text-emerald-600 font-bold text-xs uppercase tracking-[0.3em]">Rescue • Feed • Protect</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-4">
                <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </span>
                    <input 
                      type="text" 
                      placeholder="Username" 
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-700"
                      value={loginName}
                      onChange={e => setLoginName(e.target.value)}
                      required
                    />
                </div>
                <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                    <input 
                      type="password" 
                      placeholder="Password" 
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-700"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                    />
                </div>
            </div>

            <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200 hover:shadow-emerald-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2 group">
                Login
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-400 text-xs font-bold mb-3">New to ShareMeal?</p>
            <button 
                onClick={() => setView('REGISTER')} 
                className="text-emerald-600 hover:text-emerald-700 font-black text-sm hover:underline decoration-2 underline-offset-4 transition-all"
            >
                Create an Account
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-6 text-center w-full z-10 pointer-events-none">
            <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-widest">Ending Hunger • Reducing Waste</p>
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
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7 7-7" /></svg>
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
                      placeholder="Create Password" 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium" 
                      value={regPassword} 
                      onChange={e => setRegPassword(e.target.value)} 
                      required 
                    />
                </div>

                <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">I want to...</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { role: UserRole.DONOR, label: 'Donate', icon: '🎁' },
                            { role: UserRole.VOLUNTEER, label: 'Volunteer', icon: '🚚' },
                            { role: UserRole.REQUESTER, label: 'Request', icon: '🏠' }
                        ].map((option) => (
                            <button
                                key={option.role}
                                type="button"
                                onClick={() => setRegRole(option.role)}
                                className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${regRole === option.role ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200'}`}
                            >
                                <span className="text-lg">{option.icon}</span>
                                <span className="text-[10px] font-black uppercase tracking-tight">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {regRole === UserRole.REQUESTER && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                        <input 
                          type="text" 
                          placeholder="Organization Name" 
                          className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm" 
                          value={regOrgName} 
                          onChange={e => setRegOrgName(e.target.value)} 
                          required 
                        />
                         <select 
                            value={regOrgCategory} 
                            onChange={e => setRegOrgCategory(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all font-medium text-slate-700 text-sm"
                        >
                            <option>Orphanage</option>
                            <option>Old care home</option>
                            <option>NGO's</option>
                            <option>Other</option>
                        </select>
                        
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Location</label>
                             </div>
                             
                             <LocationPickerMap 
                                lat={regLat}
                                lng={regLng}
                                onLocationSelect={(lat, lng) => {
                                    setRegLat(lat);
                                    setRegLng(lng);
                                }}
                                onAddressFound={(addr) => {
                                    setRegLine1(addr.line1);
                                    setRegLine2(addr.line2);
                                    if (addr.landmark) setRegLandmark(addr.landmark);
                                    setRegPincode(addr.pincode);
                                    setRegErrors({}); // Clear errors when auto-filled
                                }}
                             />
                             
                             <div>
                                <input 
                                    type="text" 
                                    placeholder="Address Line 1" 
                                    className={`w-full px-4 py-3 rounded-xl border ${regErrors.line1 ? 'border-red-500 bg-red-50' : 'border-black bg-white'} focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm`}
                                    value={regLine1} 
                                    onChange={e => {
                                        setRegLine1(e.target.value);
                                        if (regErrors.line1) setRegErrors({...regErrors, line1: ''});
                                    }} 
                                />
                                {regErrors.line1 && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{regErrors.line1}</p>}
                             </div>

                             <div>
                                <input 
                                    type="text" 
                                    placeholder="Address Line 2" 
                                    className={`w-full px-4 py-3 rounded-xl border ${regErrors.line2 ? 'border-red-500 bg-red-50' : 'border-black bg-white'} focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm`}
                                    value={regLine2} 
                                    onChange={e => {
                                        setRegLine2(e.target.value);
                                        if (regErrors.line2) setRegErrors({...regErrors, line2: ''});
                                    }} 
                                />
                                {regErrors.line2 && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{regErrors.line2}</p>}
                             </div>

                             <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <input 
                                        type="text" 
                                        placeholder="Pincode" 
                                        maxLength={6}
                                        className={`w-full px-4 py-3 rounded-xl border ${regErrors.pincode ? 'border-red-500 bg-red-50' : 'border-black bg-white'} focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm`}
                                        value={regPincode} 
                                        onChange={e => {
                                            setRegPincode(e.target.value.replace(/\D/g, ''));
                                            if (regErrors.pincode) setRegErrors({...regErrors, pincode: ''});
                                        }} 
                                    />
                                    {regErrors.pincode && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 leading-tight">{regErrors.pincode}</p>}
                                </div>
                                 <input 
                                    type="text" 
                                    placeholder="Landmark" 
                                    className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm" 
                                    value={regLandmark} 
                                    onChange={e => setRegLandmark(e.target.value)} 
                                 />
                             </div>
                        </div>
                    </div>
                )}

              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2 group"
              >
                Create Account
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout}
      onProfileClick={() => setView('PROFILE')}
      onLogoClick={() => setView('DASHBOARD')}
      notifications={notifications}
      onMarkNotificationRead={(id) => {
          storage.markNotificationRead(id);
          refreshData();
      }}
      onMarkAllNotificationsRead={() => {
          if(user) {
              storage.markAllNotificationsRead(user.id);
              refreshData();
          }
      }}
    >
        {splashScreen}
        {view === 'PROFILE' && user ? (
            <ProfileView 
                user={user} 
                onUpdate={(updates) => {
                    storage.updateUser(user.id, updates);
                    refreshData();
                    setUser({...user, ...updates});
                }} 
                onBack={() => setView('DASHBOARD')}
            />
        ) : (
            <>
                <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                            Welcome back, <span className="text-emerald-600">{user?.name}</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-medium">Here's what's happening with food rescue in your area.</p>
                    </div>

                    <div className="flex gap-2 items-center">
                         <button 
                            onClick={handleManualRefresh}
                            className={`p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 shadow-sm transition-all ${isRefreshing ? 'text-emerald-600 border-emerald-200' : ''}`}
                            title="Refresh Data"
                         >
                            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                         </button>

                         <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
                            <button 
                                onClick={() => setDashboardMode('FEED')}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${dashboardMode === 'FEED' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                Feed
                            </button>
                            <button 
                                onClick={() => setDashboardMode('MAP')}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${dashboardMode === 'MAP' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                Map
                            </button>
                            {user?.role === UserRole.VOLUNTEER && (
                                <button 
                                    onClick={() => setDashboardMode('TASKS')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${dashboardMode === 'TASKS' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                    My Tasks
                                </button>
                            )}
                         </div>
                         {user?.role === UserRole.DONOR && (
                            <button 
                                onClick={() => setIsAddingFood(!isAddingFood)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                Donate Food
                            </button>
                         )}
                    </div>
                </div>

                {dashboardMode !== 'MAP' && (
                    <div className="mb-6 relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                         </span>
                         <input 
                            type="text" 
                            placeholder={dashboardMode === 'TASKS' ? "Search your tasks..." : "Search food, donors, or organizations..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 outline-none transition-all font-medium text-slate-600 shadow-sm placeholder:text-slate-400"
                         />
                    </div>
                )}

                {isAddingFood && (
                    <div className="mb-8 bg-white p-6 rounded-3xl shadow-xl border border-emerald-100 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <span className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></span>
                                Post New Donation
                            </h3>
                            <button onClick={() => setIsAddingFood(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handlePostFood} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Left Col */}
                                <div className="space-y-4">
                                     <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Food Image</label>
                                        <div className="relative group">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                id="food-image-upload"
                                            />
                                            <label 
                                                htmlFor="food-image-upload" 
                                                className={`w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${foodImage ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}
                                            >
                                                {isAnalyzing ? (
                                                    <div className="text-center text-emerald-600">
                                                        <svg className="animate-spin h-8 w-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        <span className="text-xs font-bold animate-pulse">AI Checking Safety...</span>
                                                    </div>
                                                ) : foodImage ? (
                                                    <img src={foodImage} alt="Preview" className="h-full w-full object-cover rounded-2xl" />
                                                ) : (
                                                    <div className="text-center text-slate-400">
                                                        <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        <span className="text-xs font-bold">Upload Photo</span>
                                                    </div>
                                                )}
                                            </label>
                                            {foodAnalysis && (
                                                <div className={`mt-2 text-xs font-bold p-2 rounded-lg flex items-start gap-2 ${foodAnalysis.isSafe ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    <span className="text-lg mt-px">{foodAnalysis.isSafe ? '✅' : '⚠️'}</span>
                                                    {foodAnalysis.reasoning}
                                                </div>
                                            )}
                                        </div>
                                     </div>
                                </div>
                                
                                {/* Right Col */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Details</label>
                                        <input 
                                            type="text" 
                                            placeholder="What food is this?" 
                                            value={foodName} 
                                            onChange={e => setFoodName(e.target.value)} 
                                            className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-bold text-slate-700 mb-3"
                                            required 
                                        />
                                        <select 
                                            value={foodCategory} 
                                            onChange={e => setFoodCategory(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-bold text-slate-700 mb-3"
                                        >
                                            <option value="Prepared Meal">Prepared Meal</option>
                                            <option value="Produce">Produce</option>
                                            <option value="Dairy">Dairy</option>
                                            <option value="Grains">Grains</option>
                                            <option value="Bakery">Bakery</option>
                                            <option value="Canned Goods">Canned Goods</option>
                                            <option value="Beverages">Beverages</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        <div className="flex gap-2 mb-3">
                                            <input 
                                                type="number" 
                                                placeholder="Quantity" 
                                                value={quantity} 
                                                onChange={e => setQuantity(e.target.value)} 
                                                className="flex-1 px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-bold text-slate-700"
                                                required 
                                            />
                                            <select 
                                                value={unit} 
                                                onChange={e => setUnit(e.target.value)}
                                                className="w-28 px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-bold text-slate-700"
                                            >
                                                <option value="meals">Meals</option>
                                                <option value="kg">kg</option>
                                                <option value="items">Items</option>
                                                <option value="servings">Servings</option>
                                                <option value="pieces">Pieces</option>
                                            </select>
                                        </div>
                                        <input 
                                            type="datetime-local" 
                                            value={expiryDate} 
                                            onChange={e => setExpiryDate(e.target.value)} 
                                            className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none font-bold text-slate-700 text-sm"
                                            required 
                                        />
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5 ml-1">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Pickup Location</label>
                                        </div>

                                        <div className="mb-3">
                                            <LocationPickerMap 
                                                lat={donLat}
                                                lng={donLng}
                                                onLocationSelect={(newLat, newLng) => {
                                                    setDonLat(newLat);
                                                    setDonLng(newLng);
                                                }}
                                                onAddressFound={(addr) => {
                                                    setDonLine1(addr.line1);
                                                    setDonLine2(addr.line2);
                                                    if (addr.landmark) setDonLandmark(addr.landmark);
                                                    setDonPincode(addr.pincode);
                                                    setDonErrors({});
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div>
                                                <input 
                                                    type="text" 
                                                    placeholder="Line 1" 
                                                    value={donLine1} 
                                                    onChange={e => {
                                                        setDonLine1(e.target.value);
                                                        if (donErrors.line1) setDonErrors({...donErrors, line1: ''});
                                                    }} 
                                                    className={`w-full px-3 py-2 rounded-lg border ${donErrors.line1 ? 'border-red-500 bg-red-50' : 'border-black bg-white'} text-sm font-medium focus:ring-1 focus:ring-emerald-500 outline-none`} 
                                                />
                                                {donErrors.line1 && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{donErrors.line1}</p>}
                                            </div>
                                            
                                            <div>
                                                <input 
                                                    type="text" 
                                                    placeholder="Line 2" 
                                                    value={donLine2} 
                                                    onChange={e => {
                                                        setDonLine2(e.target.value);
                                                        if (donErrors.line2) setDonErrors({...donErrors, line2: ''});
                                                    }} 
                                                    className={`w-full px-3 py-2 rounded-lg border ${donErrors.line2 ? 'border-red-500 bg-red-50' : 'border-black bg-white'} text-sm font-medium focus:ring-1 focus:ring-emerald-500 outline-none`} 
                                                />
                                                {donErrors.line2 && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{donErrors.line2}</p>}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Pincode" 
                                                        value={donPincode} 
                                                        maxLength={6}
                                                        onChange={e => {
                                                            setDonPincode(e.target.value.replace(/\D/g, ''));
                                                            if (donErrors.pincode) setDonErrors({...donErrors, pincode: ''});
                                                        }} 
                                                        className={`w-full px-3 py-2 rounded-lg border ${donErrors.pincode ? 'border-red-500 bg-red-50' : 'border-black bg-white'} text-sm font-medium focus:ring-1 focus:ring-emerald-500 outline-none`} 
                                                    />
                                                    {donErrors.pincode && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 leading-tight">{donErrors.pincode}</p>}
                                                </div>
                                                <input type="text" placeholder="Landmark" value={donLandmark} onChange={e => setDonLandmark(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-black bg-white text-sm font-medium focus:ring-1 focus:ring-emerald-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={isAnalyzing}
                                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 uppercase tracking-widest text-sm disabled:opacity-50"
                            >
                                Post Donation
                            </button>
                        </form>
                    </div>
                )}
                
                {dashboardMode === 'MAP' ? (
                    <RequesterMap 
                        requesters={allUsers.filter(u => u.role === UserRole.REQUESTER)} 
                        currentLocation={userLocation}
                        user={user || undefined}
                        onToggleFavorite={(id) => {
                             if (user) {
                                 const updated = storage.toggleFavorite(user.id, id);
                                 if (updated) {
                                     setUser(updated);
                                     refreshData();
                                 }
                             }
                        }}
                        onContact={handleContactRequester}
                        onViewDetails={handleViewRequesterDetails}
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPostings.length === 0 ? (
                            <div className="col-span-full text-center py-20 opacity-50">
                                <svg className="w-20 h-20 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                <p className="font-bold text-slate-400">
                                    {dashboardMode === 'TASKS' ? 'No active tasks found.' : 'No matching donations found.'}
                                </p>
                                {dashboardMode === 'TASKS' && <p className="text-xs text-slate-400 mt-2">Express interest in donations from the Feed to see them here.</p>}
                            </div>
                        ) : (
                            filteredPostings.map(posting => (
                                <FoodCard 
                                    key={posting.id} 
                                    posting={posting} 
                                    user={user!} 
                                    onUpdate={updatePosting} 
                                />
                            ))
                        )}
                    </div>
                )}
            </>
        )}

        {/* Contact Modal */}
        {showContactModal && contactTargetUser && (
            <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Contact Organization</h3>
                            <p className="text-xs text-slate-500 font-medium">Sending message to <span className="text-indigo-600 font-bold">{contactTargetUser.orgName || contactTargetUser.name}</span></p>
                        </div>
                        <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    
                    {/* Organization Details with Favorite Button */}
                    <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-lg font-black text-slate-800 leading-tight">{contactTargetUser.orgName || contactTargetUser.name}</h4>
                                <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide mt-1">
                                    {contactTargetUser.orgCategory || 'Organization'}
                                </span>
                                {contactTargetUser.address && (
                                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                        {contactTargetUser.address.line1}, {contactTargetUser.address.pincode}
                                    </p>
                                )}
                            </div>
                             {user?.role === UserRole.DONOR && (
                                <button 
                                    onClick={() => {
                                        if (user) {
                                            const updated = storage.toggleFavorite(user.id, contactTargetUser.id);
                                            if (updated) {
                                                setUser(updated);
                                                refreshData();
                                            }
                                        }
                                    }}
                                    className={`p-2 rounded-lg border transition-all ${user.favoriteRequesterIds?.includes(contactTargetUser.id) ? 'bg-amber-100 text-amber-500 border-amber-200' : 'bg-white text-slate-300 border-slate-200 hover:text-amber-400'}`}
                                    title={user.favoriteRequesterIds?.includes(contactTargetUser.id) ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                </button>
                             )}
                        </div>
                    </div>
                    
                    <form onSubmit={submitContactMessage}>
                        <div className="mb-4">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Message</label>
                            <textarea 
                                rows={4}
                                required
                                placeholder="Hi, I saw your location and wanted to check if you are accepting food donations..."
                                value={contactMessage}
                                onChange={(e) => setContactMessage(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-slate-50 outline-none transition-all resize-none font-medium text-slate-700 text-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setShowContactModal(false)}
                                className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                            >
                                Send Message
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Requester Details Modal */}
        {showRequesterDetailsModal && selectedRequesterDetails && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowRequesterDetailsModal(false)}>
                <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Organization Profile</h3>
                        <button onClick={() => setShowRequesterDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl font-black mb-3 border-4 border-white shadow-lg">
                            {selectedRequesterDetails.orgName ? selectedRequesterDetails.orgName.charAt(0) : selectedRequesterDetails.name.charAt(0)}
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 text-center">{selectedRequesterDetails.orgName || selectedRequesterDetails.name}</h4>
                        <span className="mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                            {selectedRequesterDetails.orgCategory || 'Organization'}
                        </span>
                    </div>

                    <div className="space-y-4 mb-6">
                        {selectedRequesterDetails.address && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-3">
                                <span className="bg-white p-1.5 rounded-lg shadow-sm text-slate-400 mt-0.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                </span>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Location</p>
                                    <p className="text-sm font-medium text-slate-700 leading-tight">
                                        {selectedRequesterDetails.address.line1}<br/>
                                        {selectedRequesterDetails.address.line2 && <>{selectedRequesterDetails.address.line2}<br/></>}
                                        {selectedRequesterDetails.address.landmark && <span className="text-slate-500 text-xs italic">Near {selectedRequesterDetails.address.landmark}</span>}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3">
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Requests</p>
                                <p className="text-xl font-black text-slate-800">Active</p>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Verification</p>
                                <p className="text-xl font-black text-emerald-600">Verified</p>
                             </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => handleContactRequester(selectedRequesterDetails.id)}
                            className="flex-1 bg-slate-900 text-white font-black py-3.5 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200 hover:shadow-emerald-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Send Message
                        </button>
                        {user?.role === UserRole.DONOR && (
                            <button 
                                onClick={() => {
                                    if(user) {
                                        const updated = storage.toggleFavorite(user.id, selectedRequesterDetails.id);
                                        if(updated) {
                                            setUser(updated);
                                            refreshData();
                                        }
                                    }
                                }}
                                className={`p-3.5 rounded-xl border-2 transition-all ${user.favoriteRequesterIds?.includes(selectedRequesterDetails.id) ? 'bg-amber-100 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-300 hover:border-amber-300 hover:text-amber-400'}`}
                            >
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
    </Layout>
  );
};

export default App;