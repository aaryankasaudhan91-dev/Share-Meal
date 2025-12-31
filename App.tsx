
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Notification, Rating } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage, reverseGeocode } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import ProfileView from './components/ProfileView';

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png';

const SplashScreen: React.FC = () => (
  <div className="fixed inset-0 bg-gradient-to-br from-emerald-600 to-teal-800 z-[1000] flex flex-col items-center justify-center text-white">
    <div className="relative mb-6">
        <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-150 animate-pulse"></div>
        <img src={LOGO_URL} className="w-24 h-24 relative z-10 animate-bounce-slow drop-shadow-2xl" />
    </div>
    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 animate-fade-in-up">ShareMeal</h1>
    <p className="text-emerald-100 font-bold tracking-[0.2em] text-xs uppercase animate-fade-in-up-delay bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10">Rescue. Feed. Protect.</p>
  </div>
);

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD' | 'PROFILE'>('LOGIN');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  
  // Login/Registration States
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regContactNo, setRegContactNo] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  
  // Registration - Organization & Address
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regLine1, setRegLine1] = useState('');
  const [regLine2, setRegLine2] = useState('');
  const [regLandmark, setRegLandmark] = useState('');
  const [regPincode, setRegPincode] = useState('');
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Post Food Modal State
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodDescription, setFoodDescription] = useState('');
  const [quantityNum, setQuantityNum] = useState('');
  const [unit, setUnit] = useState('meals');
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [safetyVerdict, setSafetyVerdict] = useState<{isSafe: boolean, reasoning: string} | undefined>(undefined);
  
  // Post Food - Address State
  const [foodLine1, setFoodLine1] = useState('');
  const [foodLine2, setFoodLine2] = useState('');
  const [foodLandmark, setFoodLandmark] = useState('');
  const [foodPincode, setFoodPincode] = useState('');
  const [isFoodAutoDetecting, setIsFoodAutoDetecting] = useState(false);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Splash Screen Timer
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setPostings(storage.getPostings());
    if (user) setNotifications(storage.getNotifications(user.id));
    
    // Location Logic
    let watchId: number;
    
    if (user?.role === UserRole.VOLUNTEER) {
        // Active tracking for volunteers to simulate live updates
        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setUserLocation({ lat: latitude, lng: longitude });
                
                // Automatically update any active deliveries with new location
                const activePostings = storage.getPostings().filter(p => 
                    p.status === FoodStatus.IN_TRANSIT && p.volunteerId === user.id
                );
                
                if (activePostings.length > 0) {
                    activePostings.forEach(p => {
                        storage.updatePosting(p.id, { volunteerLocation: { lat: latitude, lng: longitude } });
                    });
                }
            },
            (err) => console.log("Location tracking denied", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    } else {
        // Standard one-time fetch for others
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log("Location access denied", err)
        );
    }
    
    return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  // Clean up camera on unmount or modal close
  useEffect(() => {
    if (!isAddingFood) stopCamera();
  }, [isAddingFood]);

  // Pre-fill address when opening food modal if user has saved address
  useEffect(() => {
    if (isAddingFood) {
        if (user?.address) {
            setFoodLine1(user.address.line1 || '');
            setFoodLine2(user.address.line2 || '');
            setFoodLandmark(user.address.landmark || '');
            setFoodPincode(user.address.pincode || '');
        } else {
            setFoodLine1('');
            setFoodLine2('');
            setFoodLandmark('');
            setFoodPincode('');
        }
        setSafetyVerdict(undefined);
    }
  }, [isAddingFood, user]);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setFoodImage(null);
    setSafetyVerdict(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Unable to access camera. Please ensure permissions are granted.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg');
            
            stopCamera();
            setFoodImage(base64);
            setIsAnalyzing(true);
            setSafetyVerdict(undefined);
            
            // AI Analysis
            const analysis = await analyzeFoodSafetyImage(base64);
            setIsAnalyzing(false);
            setSafetyVerdict({ isSafe: analysis.isSafe, reasoning: analysis.reasoning });
            
            if (!analysis.isSafe) {
                const keep = window.confirm(`Safety Warning: ${analysis.reasoning}.\n\nDo you want to keep this photo anyway?`);
                if (!keep) {
                    setFoodImage(null);
                    setSafetyVerdict(undefined);
                }
            }
        }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setFoodImage(base64);
        setIsAnalyzing(true);
        setSafetyVerdict(undefined);
        
        // AI Analysis
        const analysis = await analyzeFoodSafetyImage(base64);
        setIsAnalyzing(false);
        setSafetyVerdict({ isSafe: analysis.isSafe, reasoning: analysis.reasoning });
        
        if (!analysis.isSafe) {
            const keep = window.confirm(`Safety Warning: ${analysis.reasoning}.\n\nDo you want to keep this photo anyway?`);
            if (!keep) {
                setFoodImage(null);
                setSafetyVerdict(undefined);
                if(fileInputRef.current) fileInputRef.current.value = '';
            }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    setIsAutoDetecting(true);
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                const address = await reverseGeocode(latitude, longitude);
                if (address) {
                    setRegLine1(address.line1);
                    setRegLine2(address.line2);
                    setRegLandmark(address.landmark || '');
                    setRegPincode(address.pincode);
                } else {
                    alert("Could not detect detailed address. Please fill manually.");
                }
            } catch (e) {
                console.error(e);
                alert("Error detecting address.");
            } finally {
                setIsAutoDetecting(false);
            }
        },
        (err) => {
            console.error(err);
            alert("Location permission denied. Please enable location or enter manually.");
            setIsAutoDetecting(false);
        }
    );
  };

  const handleFoodAutoDetectLocation = () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    setIsFoodAutoDetecting(true);
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                const address = await reverseGeocode(latitude, longitude);
                if (address) {
                    setFoodLine1(address.line1);
                    setFoodLine2(address.line2);
                    setFoodLandmark(address.landmark || '');
                    setFoodPincode(address.pincode);
                } else {
                    alert("Could not detect detailed address. Please fill manually.");
                }
            } catch (e) {
                console.error(e);
                alert("Error detecting address.");
            } finally {
                setIsFoodAutoDetecting(false);
            }
        },
        (err) => {
            console.error(err);
            alert("Location permission denied. Please enable location or enter manually.");
            setIsFoodAutoDetecting(false);
        }
    );
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = storage.getUsers().find(u => u.name.toLowerCase() === loginName.toLowerCase());
    if (existing) {
      if (existing.password && existing.password !== loginPassword) {
        alert("Invalid password.");
        return;
      }
      setUser(existing);
      setView('DASHBOARD');
    } else alert("User not found.");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate Contact No
    if (!/^\d{10}$/.test(regContactNo)) {
      alert("Please enter a valid 10-digit Contact Number.");
      return;
    }
    
    // Validate Pincode ONLY for Requesters
    if (regRole === UserRole.REQUESTER && !/^\d{6}$/.test(regPincode)) {
        alert("Please enter a valid 6-digit Pincode.");
        return;
    }

    const newUser: User = { 
        id: Math.random().toString(36).substr(2, 9), 
        name: regName, 
        email: regEmail, 
        contactNo: regContactNo,
        password: regPassword,
        role: regRole,
        // Only add Org details if Requester
        orgName: regRole === UserRole.REQUESTER ? regOrgName : undefined,
        orgCategory: regRole === UserRole.REQUESTER ? regOrgCategory : undefined,
        address: regRole === UserRole.REQUESTER ? {
            line1: regLine1,
            line2: regLine2,
            landmark: regLandmark,
            pincode: regPincode
        } : undefined,
        // Initialize ratings
        averageRating: 0,
        ratingsCount: 0
    };
    storage.saveUser(newUser);
    setUser(newUser);
    setView('DASHBOARD');
  };

  const handleRateVolunteer = (postingId: string, ratingValue: number, feedback: string) => {
     if (!user) return;
     const rating: Rating = {
         raterId: user.id,
         raterRole: user.role,
         rating: ratingValue,
         feedback,
         createdAt: Date.now()
     };
     storage.addVolunteerRating(postingId, rating);
     setPostings(storage.getPostings()); // Refresh to update UI
     alert("Thank you for your feedback!");
  };

  const handlePostFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!foodImage) {
        alert("Please take a photo of the food.");
        return;
    }

    if (!foodLine1 || !foodLine2 || !foodPincode) {
        alert("Please enter a valid pickup address.");
        return;
    }

    const newPost: FoodPosting = {
      id: Math.random().toString(36).substr(2, 9), 
      donorId: user.id, 
      donorName: user.name, 
      donorOrg: user.orgName, // Pass org name if exists
      foodName, 
      description: foodDescription,
      quantity: `${quantityNum} ${unit}`,
      location: {
        line1: foodLine1,
        line2: foodLine2,
        landmark: foodLandmark,
        pincode: foodPincode
      },
      expiryDate, 
      status: FoodStatus.AVAILABLE, 
      imageUrl: foodImage, 
      safetyVerdict,
      createdAt: Date.now()
    };
    storage.savePosting(newPost);
    setIsAddingFood(false);
    setPostings(storage.getPostings());
    
    // Reset Form
    setFoodName('');
    setFoodDescription('');
    setQuantityNum('');
    setFoodImage(null);
    setSafetyVerdict(undefined);
    setExpiryDate('');
    setFoodLine1('');
    setFoodLine2('');
    setFoodLandmark('');
    setFoodPincode('');
  };

  if (showSplash) return <SplashScreen />;

  if (view === 'LOGIN' || view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

        <div className="glass-panel p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-10 my-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="text-center mb-10">
              <div className="inline-block p-4 bg-emerald-50 rounded-3xl mb-4 shadow-inner">
                  <img src={LOGO_URL} className="h-16 w-16" />
              </div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">{view === 'LOGIN' ? 'Welcome Back' : 'Join the Mission'}</h1>
              <p className="text-slate-500 font-medium mt-2 text-sm">{view === 'LOGIN' ? 'Sign in to continue rescuing food.' : 'Create an account to start helping.'}</p>
          </div>
          
          {view === 'LOGIN' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Username</label>
                 <input type="text" className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={loginName} onChange={e => setLoginName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
                 <input type="password" className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
              </div>
              
              <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transform hover:-translate-y-1 transition-all mt-6">Sign In</button>
              
              <div className="text-center mt-6">
                <span className="text-slate-400 text-sm font-medium">New here? </span>
                <button type="button" onClick={() => setView('REGISTER')} className="text-emerald-600 font-bold text-sm hover:underline">Create Account</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-3 gap-2 mb-6 bg-slate-100 p-1 rounded-2xl">
                  {[UserRole.DONOR, UserRole.VOLUNTEER, UserRole.REQUESTER].map(role => (
                      <button key={role} type="button" onClick={() => setRegRole(role)} className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${regRole === role ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{role}</button>
                  ))}
              </div>

              {/* Basic Info */}
              <input type="text" placeholder="Full Name" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regName} onChange={e => setRegName(e.target.value)} required />
              <input type="email" placeholder="Email" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
              
              <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <span className="text-slate-500 font-bold text-sm border-r border-slate-300 pr-2">+91</span>
                  </div>
                  <input 
                      type="tel" 
                      placeholder="Contact Number" 
                      maxLength={10} 
                      className="w-full pl-20 pr-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" 
                      value={regContactNo} 
                      onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if(val.length <= 10) setRegContactNo(val);
                      }} 
                      required 
                  />
              </div>

              <input type="password" placeholder="Password" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
              
              {/* Organization Details (Requester Only) */}
              {regRole === UserRole.REQUESTER && (
                <div className="space-y-4 pt-2 animate-fade-in-up">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-[10px] font-black uppercase text-slate-400">Organization Details</span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>
                    <input type="text" placeholder="Organization Name" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} required />
                    <select value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)} className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer">
                        <option value="Orphanage">Orphanage</option>
                        <option value="Old Age Home">Old Age Home</option>
                        <option value="NGO">NGO</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
              )}

              {/* Address Section - Only for Requester */}
              {regRole === UserRole.REQUESTER && (
              <div className="space-y-3 pt-2">
                 <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-black uppercase text-slate-400 ml-2">Address Details</span>
                     <button type="button" onClick={handleAutoDetectLocation} disabled={isAutoDetecting} className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-colors disabled:opacity-50">
                        {isAutoDetecting ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        )}
                        Auto Detect
                     </button>
                 </div>
                 <input type="text" placeholder="Line 1 (House/Flat No)" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regLine1} onChange={e => setRegLine1(e.target.value)} required />
                 <input type="text" placeholder="Line 2 (Street/Area)" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regLine2} onChange={e => setRegLine2(e.target.value)} required />
                 <div className="flex gap-3">
                     <input type="text" placeholder="Landmark (Optional)" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regLandmark} onChange={e => setRegLandmark(e.target.value)} />
                     <input type="text" placeholder="Pincode (6 digits)" maxLength={6} className="w-32 px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" value={regPincode} onChange={e => setRegPincode(e.target.value)} required />
                 </div>
              </div>
              )}
              
              <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transform hover:-translate-y-1 transition-all mt-6">Create Account</button>
              
              <div className="text-center mt-4">
                 <button type="button" onClick={() => setView('LOGIN')} className="text-slate-400 font-bold text-sm hover:text-emerald-600 transition-colors">Back to Login</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} onLogout={() => { setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} notifications={notifications}>
        {isAddingFood && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative">
                    <button onClick={() => setIsAddingFood(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <h3 className="text-2xl font-black mb-1 text-slate-800">Donate Food</h3>
                    <p className="text-slate-400 text-sm font-bold mb-6">Details help volunteers connect faster.</p>
                    
                    <form onSubmit={handlePostFood} className="space-y-5">
                        
                        {/* Camera UI */}
                        <div className={`rounded-3xl overflow-hidden border-2 relative h-64 flex flex-col items-center justify-center transition-all ${isCameraOpen ? 'border-emerald-500 shadow-xl' : 'border-dashed border-slate-300 bg-slate-50'}`}>
                            {isCameraOpen ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                                    <button type="button" onClick={capturePhoto} className="absolute bottom-6 bg-white rounded-full p-1 shadow-2xl">
                                        <div className="w-16 h-16 border-4 border-white rounded-full bg-red-500 flex items-center justify-center"></div>
                                    </button>
                                </>
                            ) : foodImage ? (
                                <>
                                    <img src={foodImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm p-6 text-center">
                                            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-3"></div>
                                            <div className="text-white font-bold text-sm animate-pulse">AI is checking food safety...</div>
                                        </div>
                                    )}
                                    <button type="button" onClick={() => setFoodImage(null)} className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold z-10 backdrop-blur-md transition-colors">Retake Photo</button>
                                    {safetyVerdict && !safetyVerdict.isSafe && !isAnalyzing && (
                                        <div className="absolute bottom-4 left-4 right-4 bg-rose-500/90 backdrop-blur-md p-3 rounded-xl text-white text-xs font-bold border border-rose-400 shadow-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                Safety Warning
                                            </div>
                                            {safetyVerdict.reasoning}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center gap-8">
                                    <button type="button" onClick={startCamera} className="flex flex-col items-center text-slate-400 gap-3 group">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </div>
                                        <span className="font-bold text-sm group-hover:text-emerald-600 transition-colors">Camera</span>
                                    </button>

                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center text-slate-400 gap-3 group">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        </div>
                                        <span className="font-bold text-sm group-hover:text-blue-600 transition-colors">Upload</span>
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleFileUpload} 
                                    />
                                </div>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">What are you donating?</label>
                            <input type="text" placeholder="e.g. 5 Boxes of Veg Pizza" value={foodName} onChange={e => setFoodName(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" required />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Message / Description</label>
                            <textarea placeholder="e.g. Prepared this morning, contains nuts. Please consume within 4 hours." value={foodDescription} onChange={e => setFoodDescription(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none h-24" />
                        </div>
                        
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Quantity</label>
                                <input type="number" placeholder="0" value={quantityNum} onChange={e => setQuantityNum(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" required />
                            </div>
                            <div className="w-1/3">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Unit</label>
                                <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer">
                                    <option value="meals">meals</option>
                                    <option value="kg">kg</option>
                                    <option value="lbs">lbs</option>
                                    <option value="boxes">boxes</option>
                                    <option value="items">items</option>
                                </select>
                            </div>
                        </div>

                        <div>
                             <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Best Before</label>
                             <input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-600" required />
                        </div>
                        
                        {/* Address Section */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                             <div className="flex items-center justify-between mb-1 mt-2">
                                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Pickup Address</label>
                                 <button type="button" onClick={handleFoodAutoDetectLocation} disabled={isFoodAutoDetecting} className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-colors disabled:opacity-50">
                                    {isFoodAutoDetecting ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    )}
                                    Auto Detect
                                 </button>
                             </div>
                             <input type="text" placeholder="Line 1 (House/Flat No)" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm" value={foodLine1} onChange={e => setFoodLine1(e.target.value)} required />
                             <input type="text" placeholder="Line 2 (Street/Area)" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm" value={foodLine2} onChange={e => setFoodLine2(e.target.value)} required />
                             <div className="flex gap-3">
                                 <input type="text" placeholder="Landmark" className="w-full px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm" value={foodLandmark} onChange={e => setFoodLandmark(e.target.value)} />
                                 <input type="text" placeholder="Pincode" maxLength={6} className="w-32 px-5 py-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm" value={foodPincode} onChange={e => setFoodPincode(e.target.value)} required />
                             </div>
                        </div>

                        <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-emerald-200 disabled:bg-slate-300 disabled:shadow-none disabled:text-slate-500 transition-all mt-4" disabled={!foodImage || isAnalyzing}>
                            Post Donation
                        </button>
                    </form>
                </div>
            </div>
        )}
        {view === 'PROFILE' && user ? <ProfileView user={user} onUpdate={u => storage.updateUser(user.id, u)} onBack={() => setView('DASHBOARD')} /> : (
            <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 animate-fade-in-up">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight text-slate-900">Live <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Donations</span></h2>
                        <p className="text-slate-500 font-medium mt-1">Real-time food rescue opportunities near you.</p>
                    </div>
                    {user?.role === UserRole.DONOR && (
                        <button onClick={() => setIsAddingFood(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-emerald-200 transform hover:-translate-y-1 transition-all flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            Donate Food
                        </button>
                    )}
                </div>
                
                {postings.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm animate-fade-in-up">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                        </div>
                        <h3 className="text-lg font-black text-slate-800">No donations yet</h3>
                        <p className="text-slate-500">Be the first to donate food today!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                        {postings.map((p, idx) => (
                            <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                                {user && (
                                    <FoodCard 
                                        posting={p} 
                                        user={user} 
                                        currentLocation={userLocation} 
                                        onUpdate={(id, updates) => { storage.updatePosting(id, updates); setPostings(storage.getPostings()); }}
                                        onRateVolunteer={handleRateVolunteer}
                                        volunteerProfile={p.volunteerId ? storage.getUser(p.volunteerId) : undefined}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}
    </Layout>
  );
};

export default App;
