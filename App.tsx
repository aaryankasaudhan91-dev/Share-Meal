import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Address, Notification } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import RequesterMap from './components/RequesterMap';
import ProfileView from './components/ProfileView';
import LocationPickerMap from './components/LocationPickerMap';

// New Logo URL - Heart with Food Bowl
const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png';

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
  const [showPassword, setShowPassword] = useState(false); // UI Enhancement
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
    if (isAddingFood) {
        setDonErrors({}); // Clear errors when opening
        if (user?.address) {
           setDonLine1(user.address.line1);
           setDonLine2(user.address.line2);
           setDonLandmark(user.address.landmark || '');
           setDonPincode(user.address.pincode);
           setDonLat(user.address.lat);
           setDonLng(user.address.lng);
        } else {
           setDonLine1('');
           setDonLine2('');
           setDonLandmark('');
           setDonPincode('');
           // Initialize with userLocation if available to prevent "India center" default if user doesn't touch map
           if (userLocation) {
               setDonLat(userLocation.lat);
               setDonLng(userLocation.lng);
           } else {
               setDonLat(undefined);
               setDonLng(undefined);
           }
        }
    }
  }, [isAddingFood, user, userLocation]);

  // Auto-fill location if userLocation becomes available while modal is open and no location set
  useEffect(() => {
    if (isAddingFood && !user?.address && donLat === undefined && userLocation) {
        setDonLat(userLocation.lat);
        setDonLng(userLocation.lng);
    }
  }, [userLocation, isAddingFood, donLat, user?.address]);

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

        // Use nullish checks or explicit checks to allow 0 coordinates
        const finalRegLat = regLat !== undefined ? regLat : (userLocation?.lat || 28.6139);
        const finalRegLng = regLng !== undefined ? regLng : (userLocation?.lng || 77.2090);

        userAddress = {
            line1: regLine1,
            line2: regLine2,
            landmark: regLandmark,
            pincode: regPincode,
            lat: finalRegLat,
            lng: finalRegLng
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

  const handlePostFood = async (e: React.SyntheticEvent) => {
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
    
    // Explicitly check undefined to allow 0 coordinates (though unlikely)
    const finalLat = donLat !== undefined ? donLat : (userLocation?.lat || 28.6139);
    const finalLng = donLng !== undefined ? donLng : (userLocation?.lng || 77.2090);

    const postLocation: Address = {
        line1: donLine1,
        line2: donLine2,
        landmark: donLandmark,
        pincode: donPincode,
        lat: finalLat,
        lng: finalLng
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
  const handleContactRequester = (requesterId: string, message?: string) => {
      const targetUser = allUsers.find(u => u.id === requesterId);
      if (targetUser) {
          if (message && user) {
             // Direct send if message provided
             const fullMessage = `Inquiry from ${user.name}: ${message}`;
             storage.createNotification(targetUser.id, fullMessage, 'INFO');
             alert(`Message sent to ${targetUser.orgName || targetUser.name}!`);
          } else {
             // Open global modal if no message (default)
             setContactTargetUser(targetUser);
             setShowContactModal(true);
             setShowRequesterDetailsModal(false);
          }
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
        <div className={`relative mb-6 transition-all duration-1000 delay-100 transform ${showSplash ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
            <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-20 animate-pulse rounded-full"></div>
            <img src={LOGO_URL} className="w-32 h-32 relative z-10 drop-shadow-2xl" alt="Logo" />
        </div>
        <div className="text-center space-y-3">
            <h1 className={`text-4xl font-black text-slate-800 tracking-tighter transition-all duration-1000 delay-300 transform ${showSplash ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            ShareMeal <span className="text-emerald-600">Connect</span>
            </h1>
            <p className={`text-sm font-bold text-slate-400 uppercase tracking-[0.3em] transition-all duration-1000 delay-500 transform ${showSplash ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
            Rescue • Feed • Protect
            </p>
        </div>
        <div className={`absolute bottom-12 w-48 h-1 bg-slate-200 rounded-full overflow-hidden transition-all duration-700 delay-700 ${showSplash ? 'opacity-100' : 'opacity-0'}`}>
            <div className="h-full bg-emerald-500 animate-[loading_2s_ease-in-out_infinite] w-full origin-left" style={{animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'}}></div>
        </div>
    </div>
  );

  // Add Food Modal Render
  const renderAddFoodModal = () => (
    <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsAddingFood(false)}>
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <span className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></span>
                        Post New Donation
                    </h3>
                    <p className="text-slate-500 text-sm font-medium mt-1 ml-1">Share surplus food and help someone in need.</p>
                </div>
                <button onClick={() => setIsAddingFood(false)} className="bg-white p-2 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <form onSubmit={handlePostFood} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Col - Image */}
                        <div className="space-y-4">
                                <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Food Image</label>
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
                                        className={`w-full h-64 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${foodImage ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}
                                    >
                                        {isAnalyzing ? (
                                            <div className="text-center text-emerald-600">
                                                <svg className="animate-spin h-10 w-10 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span className="text-sm font-bold animate-pulse">AI Checking Safety...</span>
                                            </div>
                                        ) : foodImage ? (
                                            <img src={foodImage} alt="Preview" className="h-full w-full object-cover rounded-3xl shadow-sm" />
                                        ) : (
                                            <div className="text-center text-slate-400">
                                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3">
                                                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <span className="text-sm font-bold">Click to Upload Photo</span>
                                                <p className="text-xs font-medium mt-1 opacity-70">AI will verify food safety</p>
                                            </div>
                                        )}
                                    </label>
                                    {foodAnalysis && (
                                        <div className={`mt-3 text-xs font-bold p-3 rounded-xl flex items-start gap-2 shadow-sm ${foodAnalysis.isSafe ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                                            <span className="text-lg mt-px">{foodAnalysis.isSafe ? '✅' : '⚠️'}</span>
                                            {foodAnalysis.reasoning}
                                        </div>
                                    )}
                                </div>
                                </div>
                        </div>
                        
                        {/* Right Col - Details */}
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Details</label>
                                <input 
                                    type="text" 
                                    placeholder="Food Title (e.g., 20 Curry Meals)" 
                                    value={foodName} 
                                    onChange={e => setFoodName(e.target.value)} 
                                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700 mb-3 transition-all"
                                    required 
                                />
                                <select 
                                    value={foodCategory} 
                                    onChange={e => setFoodCategory(e.target.value)}
                                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700 mb-3 transition-all"
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
                                <div className="flex gap-3 mb-3">
                                    <input 
                                        type="number" 
                                        placeholder="Qty" 
                                        value={quantity} 
                                        onChange={e => setQuantity(e.target.value)} 
                                        className="flex-1 px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                                        required 
                                    />
                                    <select 
                                        value={unit} 
                                        onChange={e => setUnit(e.target.value)}
                                        className="w-32 px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                                    >
                                        <option value="meals">Meals</option>
                                        <option value="kg">kg</option>
                                        <option value="items">Items</option>
                                        <option value="servings">Servings</option>
                                        <option value="pieces">Pieces</option>
                                    </select>
                                </div>
                                <div className="relative">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Expiry Date & Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={expiryDate} 
                                        onChange={e => setExpiryDate(e.target.value)} 
                                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-slate-50 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                                        required 
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center mb-2 ml-1">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Pickup Location</label>
                                </div>

                                <div className="mb-4 h-40 rounded-2xl overflow-hidden border border-slate-200">
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

                                <div className="space-y-3">
                                    <input 
                                        type="text" 
                                        placeholder="Address Line 1" 
                                        value={donLine1} 
                                        onChange={e => {
                                            setDonLine1(e.target.value);
                                            if (donErrors.line1) setDonErrors({...donErrors, line1: ''});
                                        }} 
                                        className={`w-full px-4 py-3 rounded-xl border ${donErrors.line1 ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50'} font-medium focus:bg-white focus:border-emerald-500 outline-none transition-all`} 
                                    />
                                    {donErrors.line1 && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{donErrors.line1}</p>}
                                    
                                    <div className="grid grid-cols-2 gap-3">
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
                                                className={`w-full px-4 py-3 rounded-xl border ${donErrors.pincode ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50'} font-medium focus:bg-white focus:border-emerald-500 outline-none transition-all`} 
                                            />
                                            {donErrors.pincode && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{donErrors.pincode}</p>}
                                        </div>
                                        <input type="text" placeholder="Landmark" value={donLandmark} onChange={e => setDonLandmark(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:bg-white focus:border-emerald-500 outline-none transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                    onClick={() => setIsAddingFood(false)}
                    className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-sm transition-all"
                >
                    Cancel
                </button>
                <button 
                    onClick={handlePostFood}
                    disabled={isAnalyzing}
                    className="px-8 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                    Post Donation
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
            </div>
        </div>
    </div>
  );

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        {splashScreen}
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-emerald-300/20 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-blue-300/20 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '1s'}}></div>
            <div className="absolute bottom-[10%] left-[20%] w-[45%] h-[45%] bg-amber-200/20 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="bg-white/80 backdrop-blur-2xl p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-white/60 relative z-10 animate-in fade-in zoom-in-95 duration-700 flex flex-col items-center">
          <div className="text-center mb-10 w-full">
            <div className="inline-flex relative mb-6">
                <div className="absolute inset-0 bg-emerald-200/50 rounded-full blur-2xl transform scale-150"></div>
                <img src={LOGO_URL} className="h-24 w-24 relative z-10 transform hover:scale-110 transition-transform duration-500 drop-shadow-xl" alt="Logo" />
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">ShareMeal</h1>
            <div className="flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-slate-200"></span>
                <p className="text-emerald-600 font-bold text-xs uppercase tracking-[0.3em]">Rescue • Feed • Protect</p>
                <span className="h-px w-8 bg-slate-200"></span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 w-full">
            <div className="space-y-4">
                <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </span>
                    <input 
                      type="text" 
                      placeholder="Username" 
                      className="w-full pl-14 pr-5 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-700 shadow-sm"
                      value={loginName}
                      onChange={e => setLoginName(e.target.value)}
                      required
                    />
                </div>
                <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                    <input 
                      type={showPassword ? "text" : "password"}
                      placeholder="Password" 
                      className="w-full pl-14 pr-12 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-700 shadow-sm"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                        {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                    </button>
                </div>
            </div>

            <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200 hover:shadow-emerald-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2 group">
                Sign In
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-100 text-center w-full">
            <p className="text-slate-400 text-xs font-bold mb-3">Don't have an account?</p>
            <button 
                onClick={() => setView('REGISTER')} 
                className="w-full py-3 rounded-2xl border-2 border-emerald-100 text-emerald-600 font-black text-xs uppercase tracking-widest hover:bg-emerald-50 hover:border-emerald-200 transition-all"
            >
                Create Account
            </button>
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
        {isAddingFood && renderAddFoodModal()}
        
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
            // Dashboard Content
            <>
                <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                            Welcome back, <span className="text-emerald-600">{user?.name.split(' ')[0]}</span>
                        </h2>
                        <p className="text-slate-500 font-medium mt-1">Here's what's happening with food rescue in your area.</p>
                    </div>

                    <div className="flex gap-3 items-center w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                         <button 
                            onClick={handleManualRefresh}
                            className={`p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 shadow-sm transition-all ${isRefreshing ? 'text-emerald-600 border-emerald-200 rotate-180' : ''}`}
                            title="Refresh Data"
                         >
                            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                         </button>

                         <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex shadow-sm">
                            <button 
                                onClick={() => setDashboardMode('FEED')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${dashboardMode === 'FEED' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                Feed
                            </button>
                            <button 
                                onClick={() => setDashboardMode('MAP')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${dashboardMode === 'MAP' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                Map
                            </button>
                            {user?.role === UserRole.VOLUNTEER && (
                                <button 
                                    onClick={() => setDashboardMode('TASKS')}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${dashboardMode === 'TASKS' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                    Tasks
                                </button>
                            )}
                         </div>
                         {user?.role === UserRole.DONOR && (
                            <button 
                                onClick={() => setIsAddingFood(true)}
                                className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                Donate Food
                            </button>
                         )}
                    </div>
                </div>

                {dashboardMode !== 'MAP' && (
                    <div className="mb-8 relative group">
                         <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                         </span>
                         <input 
                            type="text" 
                            placeholder={dashboardMode === 'TASKS' ? "Search your tasks..." : "Search food, donors, or organizations..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-14 pr-5 py-4 rounded-2xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 shadow-sm placeholder:text-slate-400 placeholder:font-medium"
                         />
                    </div>
                )}
                
                {dashboardMode === 'MAP' ? (
                    <div className="h-[600px] rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-xl bg-white">
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
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredPostings.length === 0 ? (
                            <div className="col-span-full py-32 text-center rounded-[2.5rem] bg-slate-50 border border-slate-200 border-dashed">
                                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </div>
                                <h3 className="text-xl font-black text-slate-700 mb-2">
                                    {dashboardMode === 'TASKS' ? 'All caught up!' : 'No food listings found'}
                                </h3>
                                <p className="text-slate-400 font-medium max-w-sm mx-auto">
                                    {dashboardMode === 'TASKS' ? 'Great job! Check the Feed for new opportunities.' : 'Be the first to donate or check back later for new listings.'}
                                </p>
                            </div>
                        ) : (
                            filteredPostings.map(posting => (
                                user && (
                                <FoodCard 
                                    key={posting.id} 
                                    posting={posting} 
                                    user={user} 
                                    onUpdate={updatePosting} 
                                />
                                )
                            ))
                        )}
                    </div>
                )}
            </>
        )}

        {/* Contact Modal */}
        {showContactModal && contactTargetUser && (
            <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Contact</h3>
                            <p className="text-xs text-slate-500 font-medium">Message to <span className="text-indigo-600 font-bold">{contactTargetUser.orgName || contactTargetUser.name}</span></p>
                        </div>
                        <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    
                    <form onSubmit={submitContactMessage}>
                        <div className="mb-6">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Message</label>
                            <textarea 
                                rows={5}
                                required
                                placeholder="Hi, I saw your location and wanted to check if you are accepting food donations..."
                                value={contactMessage}
                                onChange={(e) => setContactMessage(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 bg-slate-50 focus:bg-white outline-none transition-all resize-none font-medium text-slate-700 text-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setShowContactModal(false)}
                                className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                            >
                                Send
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Requester Details Modal */}
        {showRequesterDetailsModal && selectedRequesterDetails && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowRequesterDetailsModal(false)}>
                <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-emerald-50 to-blue-50"></div>
                    
                    <button onClick={() => setShowRequesterDetailsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all z-10">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="relative z-10 flex flex-col items-center mb-6 mt-4">
                        <div className="w-24 h-24 bg-white text-emerald-600 rounded-full flex items-center justify-center text-3xl font-black mb-4 border-4 border-white shadow-xl">
                            {selectedRequesterDetails.orgName ? selectedRequesterDetails.orgName.charAt(0) : selectedRequesterDetails.name.charAt(0)}
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 text-center leading-tight mb-1">{selectedRequesterDetails.orgName || selectedRequesterDetails.name}</h4>
                        <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-200">
                            {selectedRequesterDetails.orgCategory || 'Organization'}
                        </span>
                    </div>

                    <div className="space-y-4 mb-8">
                        {selectedRequesterDetails.address && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-4">
                                <span className="bg-white p-2 rounded-xl shadow-sm text-slate-400 text-lg">
                                    📍
                                </span>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Address</p>
                                    <p className="text-sm font-bold text-slate-700 leading-snug">
                                        {selectedRequesterDetails.address.line1}<br/>
                                        {selectedRequesterDetails.address.line2 && <>{selectedRequesterDetails.address.line2}<br/></>}
                                        {selectedRequesterDetails.address.landmark && <span className="text-slate-500 text-xs font-medium block mt-1">Near {selectedRequesterDetails.address.landmark}</span>}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Status</p>
                                <p className="text-lg font-black text-slate-800">Active</p>
                             </div>
                             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Verified</p>
                                <p className="text-lg font-black text-emerald-600">Yes</p>
                             </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => handleContactRequester(selectedRequesterDetails.id)}
                            className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 hover:shadow-emerald-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Message
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
                                className={`p-4 rounded-2xl border-2 transition-all ${user.favoriteRequesterIds?.includes(selectedRequesterDetails.id) ? 'bg-amber-100 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-300 hover:border-amber-300 hover:text-amber-400'}`}
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