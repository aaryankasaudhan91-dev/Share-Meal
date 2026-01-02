
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Notification, Rating } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage, reverseGeocode } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import ProfileView from './components/ProfileView';
import VerificationRequestModal from './components/VerificationRequestModal';

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png';

const SplashScreen: React.FC = () => (
  <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-400 via-emerald-600 to-teal-900 z-[1000] flex flex-col items-center justify-center text-white">
    <div className="relative mb-8">
        <div className="absolute inset-0 bg-white/30 blur-3xl rounded-full scale-150 animate-pulse"></div>
        <img src={LOGO_URL} className="w-28 h-28 relative z-10 animate-bounce-slow drop-shadow-2xl" />
    </div>
    <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4 animate-fade-in-up drop-shadow-sm">ShareMeal</h1>
    <p className="text-emerald-50 font-bold tracking-[0.3em] text-xs uppercase animate-fade-in-up-delay bg-white/20 px-6 py-2.5 rounded-full backdrop-blur-md border border-white/20 shadow-lg">Rescue. Feed. Protect.</p>
  </div>
);

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD' | 'PROFILE'>('LOGIN');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('default');
  
  // Pending Verification State for Donors
  const [pendingVerificationPosting, setPendingVerificationPosting] = useState<FoodPosting | null>(null);

  // Login/Registration States
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showFacebookModal, setShowFacebookModal] = useState(false);
  
  // Forgot Password States
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetStep, setResetStep] = useState<'INPUT' | 'SUCCESS'>('INPUT');
  
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
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
    if (user) {
        setNotifications(storage.getNotifications(user.id));
        // Reset tab when user logs in/changes
        if (user.role === UserRole.DONOR) setActiveTab('active');
        else if (user.role === UserRole.VOLUNTEER) setActiveTab('opportunities');
        else setActiveTab('browse');
    }
    
    // Global Polling for real-time updates
    const interval = setInterval(() => {
        setPostings(storage.getPostings());
        if (user) setNotifications(storage.getNotifications(user.id));
    }, 3000);

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
        clearInterval(interval);
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  // Poll for postings that require Donor Verification
  useEffect(() => {
      if (!user || user.role !== UserRole.DONOR) return;

      const checkPendingVerifications = () => {
          const currentPostings = storage.getPostings();
          const pending = currentPostings.find(p => 
              p.donorId === user.id && 
              p.status === FoodStatus.PICKUP_VERIFICATION_PENDING
          );
          
          // Only update state if it's different to avoid loops/flicker
          if (pending && (!pendingVerificationPosting || pendingVerificationPosting.id !== pending.id)) {
              setPendingVerificationPosting(pending);
          } else if (!pending && pendingVerificationPosting) {
              setPendingVerificationPosting(null);
          }
      };

      checkPendingVerifications();
      const interval = setInterval(checkPendingVerifications, 3000);
      return () => clearInterval(interval);
  }, [user, pendingVerificationPosting]);


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
        setSelectedTags([]);
    }
  }, [isAddingFood, user]);

  // Filtered Postings based on Tab and Role
  const filteredPostings = useMemo(() => {
    if (!user) return [];
    
    let filtered = [...postings];

    if (user.role === UserRole.DONOR) {
        if (activeTab === 'active') {
            return filtered.filter(p => p.donorId === user.id && p.status !== FoodStatus.DELIVERED);
        } else if (activeTab === 'history') {
            return filtered.filter(p => p.donorId === user.id && p.status === FoodStatus.DELIVERED);
        }
    } else if (user.role === UserRole.VOLUNTEER) {
        if (activeTab === 'opportunities') {
            // Show Available or Requested items (not yet picked up)
            return filtered.filter(p => (p.status === FoodStatus.AVAILABLE || (p.status === FoodStatus.REQUESTED && !p.volunteerId)));
        } else if (activeTab === 'mytasks') {
            return filtered.filter(p => p.volunteerId === user.id && p.status !== FoodStatus.DELIVERED);
        } else if (activeTab === 'history') {
             return filtered.filter(p => p.volunteerId === user.id && p.status === FoodStatus.DELIVERED);
        }
    } else if (user.role === UserRole.REQUESTER) {
        if (activeTab === 'browse') {
            return filtered.filter(p => p.status === FoodStatus.AVAILABLE);
        } else if (activeTab === 'myrequests') {
            return filtered.filter(p => p.orphanageId === user.id);
        }
    }
    
    return [];
  }, [postings, user, activeTab]);

  // Stats Logic
  const stats = useMemo(() => {
      if (!user) return null;
      if (user.role === UserRole.DONOR) {
          const totalDonations = postings.filter(p => p.donorId === user.id).length;
          const completed = postings.filter(p => p.donorId === user.id && p.status === FoodStatus.DELIVERED).length;
          // Estimate meals (approximate) - in real app, parse quantity string
          const mealsEstimate = totalDonations * 15; // Assume avg 15 meals per donation
          return { total: totalDonations, active: totalDonations - completed, completed, mealsEstimate };
      }
      if (user.role === UserRole.VOLUNTEER) {
          const tasks = postings.filter(p => p.volunteerId === user.id);
          return { total: tasks.length, active: tasks.filter(p => p.status !== FoodStatus.DELIVERED).length, completed: tasks.filter(p => p.status === FoodStatus.DELIVERED).length };
      }
      if (user.role === UserRole.REQUESTER) {
          const reqs = postings.filter(p => p.orphanageId === user.id);
          return { total: reqs.length, active: reqs.filter(p => p.status !== FoodStatus.DELIVERED).length, received: reqs.filter(p => p.status === FoodStatus.DELIVERED).length };
      }
      return null;
  }, [postings, user]);


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

  const handleDemoLogin = (role: UserRole) => {
    // Check if a demo user exists
    const users = storage.getUsers();
    let demoUser = users.find(u => u.role === role && u.id.startsWith('demo-'));
    
    if (!demoUser) {
        // Create one on the fly
        demoUser = {
            id: `demo-${role.toLowerCase()}-${Math.floor(Math.random() * 1000)}`,
            name: `Demo ${role.charAt(0) + role.slice(1).toLowerCase()}`,
            email: `demo.${role.toLowerCase()}@sharemeal.com`,
            contactNo: '9876543210',
            password: 'demo',
            role: role,
            impactScore: role === UserRole.DONOR ? 125 : 0,
            averageRating: 4.8,
            ratingsCount: 24,
            address: role === UserRole.REQUESTER ? {
                line1: "12 Sunshine Orphanage",
                line2: "Happy Valley, MG Road",
                landmark: "Near Central Park",
                pincode: "560001"
            } : undefined,
            orgName: role === UserRole.REQUESTER ? "Sunshine Orphanage" : undefined,
            orgCategory: role === UserRole.REQUESTER ? "Orphanage" : undefined
        };
        storage.saveUser(demoUser);
    }
    setUser(demoUser);
    setView('DASHBOARD');
  };

  const handleGoogleSignIn = (selectedUser: User) => {
      setUser(selectedUser);
      setShowGoogleModal(false);
      setView('DASHBOARD');
  };

  const createGoogleUser = () => {
      const randomId = Math.random().toString(36).substr(2, 5);
      const newGoogleUser: User = {
          id: `google-${randomId}`,
          name: `Google User ${randomId}`,
          email: `user${randomId}@gmail.com`,
          role: UserRole.DONOR, // Default role
          password: 'google-oauth-token',
          impactScore: 0,
          averageRating: 0,
          ratingsCount: 0
      };
      storage.saveUser(newGoogleUser);
      handleGoogleSignIn(newGoogleUser);
  };

  const handleFacebookSignIn = (selectedUser: User) => {
      setUser(selectedUser);
      setShowFacebookModal(false);
      setView('DASHBOARD');
  };

  const createFacebookUser = () => {
      const randomId = Math.random().toString(36).substr(2, 5);
      const newFacebookUser: User = {
          id: `fb-${randomId}`,
          name: `Facebook User ${randomId}`,
          email: `user${randomId}@facebook.com`,
          role: UserRole.DONOR, // Default role
          password: 'fb-oauth-token',
          impactScore: 0,
          averageRating: 0,
          ratingsCount: 0,
          profilePictureUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomId}`
      };
      storage.saveUser(newFacebookUser);
      handleFacebookSignIn(newFacebookUser);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if(!forgotEmail) return;
    // Simulate API call
    setTimeout(() => {
        setResetStep('SUCCESS');
    }, 1000);
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

  const handleRefresh = () => {
    setPostings(storage.getPostings());
    if (user) setNotifications(storage.getNotifications(user.id));
  };

  const toggleTag = (tag: string) => {
      if (selectedTags.includes(tag)) {
          setSelectedTags(selectedTags.filter(t => t !== tag));
      } else {
          setSelectedTags([...selectedTags, tag]);
      }
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
      foodTags: selectedTags,
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
    setSelectedTags([]);
  };

  const handleDonorApprove = () => {
      if (pendingVerificationPosting) {
          storage.updatePosting(pendingVerificationPosting.id, {
              status: FoodStatus.IN_TRANSIT
          });
          setPendingVerificationPosting(null);
          handleRefresh();
          alert("Pickup Approved! Volunteer can now proceed.");
      }
  };

  const handleDonorReject = () => {
      if (pendingVerificationPosting) {
          storage.updatePosting(pendingVerificationPosting.id, {
              status: FoodStatus.REQUESTED, // Revert to requested
              pickupVerificationImageUrl: undefined, // Clear image
              volunteerId: undefined, // Optionally clear volunteer or keep them assigned
              volunteerName: undefined
          });
          setPendingVerificationPosting(null);
          handleRefresh();
          alert("Pickup Rejected. Posting is back to Requested status.");
      }
  };

  if (showSplash) return <SplashScreen />;

  if (view === 'LOGIN' || view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-100 to-teal-50 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>

        <div className="glass-panel p-8 md:p-12 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-lg relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/60">
          <div className="text-center mb-10">
              <div className="inline-block p-4 bg-emerald-100/50 rounded-[2rem] mb-6 shadow-sm ring-1 ring-emerald-50">
                  <img src={LOGO_URL} className="h-14 w-14" />
              </div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">{view === 'LOGIN' ? 'Welcome Back' : 'Join the Mission'}</h1>
              <p className="text-slate-500 font-medium mt-2 text-base">{view === 'LOGIN' ? 'Sign in to continue rescuing food.' : 'Create an account to start helping.'}</p>
          </div>
          
          {view === 'LOGIN' ? (
            <div className="animate-fade-in-up">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Username</label>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <input type="text" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" placeholder="Enter your username" value={loginName} onChange={e => setLoginName(e.target.value)} required />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Password</label>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <input type="password" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" placeholder="Enter your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                   </div>
                </div>

                <div className="flex justify-end">
                    <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Forgot Password?</button>
                </div>
                
                <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-emerald-200/50 hover:shadow-emerald-300/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all mt-4">Sign In</button>
              </form>
              
              <div className="my-8 flex items-center gap-4">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Or continue with</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                  <button type="button" onClick={() => setShowGoogleModal(true)} className="py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm relative overflow-hidden group">
                     <div className="absolute inset-0 bg-slate-100 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                     <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 relative z-10" alt="Google" />
                     <span className="relative z-10">Google</span>
                  </button>
                  <button type="button" onClick={() => setShowFacebookModal(true)} className="py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm relative overflow-hidden group">
                     <div className="absolute inset-0 bg-[#1877F2]/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                     <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-5 h-5 relative z-10" alt="Facebook" />
                     <span className="relative z-10 group-hover:text-[#1877F2] transition-colors">Facebook</span>
                  </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center mb-3">Quick Demo Access</p>
                  <div className="flex gap-2">
                      <button onClick={() => handleDemoLogin(UserRole.DONOR)} className="flex-1 py-2 bg-white border border-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 transition-colors">Donor</button>
                      <button onClick={() => handleDemoLogin(UserRole.VOLUNTEER)} className="flex-1 py-2 bg-white border border-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase hover:bg-blue-50 transition-colors">Volunteer</button>
                      <button onClick={() => handleDemoLogin(UserRole.REQUESTER)} className="flex-1 py-2 bg-white border border-orange-100 text-orange-700 rounded-xl text-[10px] font-black uppercase hover:bg-orange-50 transition-colors">Requester</button>
                  </div>
              </div>
              
              <div className="text-center mt-8">
                <span className="text-slate-500 text-sm font-medium">New here? </span>
                <button type="button" onClick={() => setView('REGISTER')} className="text-emerald-600 font-bold text-sm hover:underline decoration-2 underline-offset-4">Create Account</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-3 gap-3 mb-8 bg-slate-100/80 p-2 rounded-3xl">
                  {[
                      { role: UserRole.DONOR, label: 'Donor', icon: '🎁' },
                      { role: UserRole.VOLUNTEER, label: 'Volunteer', icon: '🤝' },
                      { role: UserRole.REQUESTER, label: 'Requester', icon: '🏠' }
                  ].map(({ role, label, icon }) => (
                      <button 
                        key={role} 
                        type="button" 
                        onClick={() => setRegRole(role)} 
                        className={`flex flex-col items-center justify-center py-4 rounded-2xl transition-all ${regRole === role ? 'bg-white text-emerald-600 shadow-lg scale-100 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 scale-95'}`}
                      >
                          <span className="text-2xl mb-1 filter drop-shadow-sm">{icon}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
                      </button>
                  ))}
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                 <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <input type="text" placeholder="Full Name" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regName} onChange={e => setRegName(e.target.value)} required />
                 </div>
                 
                 <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <input type="email" placeholder="Email Address" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                 </div>
              
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                      <span className="font-bold text-sm border-r border-slate-300 pr-3 mr-1">+91</span>
                  </div>
                  <input 
                      type="tel" 
                      placeholder="Contact Number" 
                      maxLength={10} 
                      className="w-full pl-24 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" 
                      value={regContactNo} 
                      onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if(val.length <= 10) setRegContactNo(val);
                      }} 
                      required 
                  />
                </div>

                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <input type="password" placeholder="Password" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                </div>
              </div>
              
              {/* Organization Details (Requester Only) */}
              {regRole === UserRole.REQUESTER && (
                <div className="space-y-4 pt-4 animate-fade-in-up">
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Organization & Address</span>
                        </div>
                        
                        <div className="space-y-3">
                            <input type="text" placeholder="Organization Name" className="w-full px-5 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} required />
                            <div className="relative">
                                <select value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all appearance-none cursor-pointer">
                                    <option value="Orphanage">Orphanage</option>
                                    <option value="Old Age Home">Old Age Home</option>
                                    <option value="NGO">NGO</option>
                                    <option value="Other">Other</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none text-slate-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-end">
                                <button type="button" onClick={handleAutoDetectLocation} disabled={isAutoDetecting} className="flex items-center gap-1.5 text-blue-600 text-[10px] font-black uppercase hover:text-blue-700 transition-colors disabled:opacity-50 tracking-wider">
                                    {isAutoDetecting ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    )}
                                    Auto Detect Location
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <input type="text" placeholder="Line 1 (House/Flat No)" className="w-full px-5 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-sm" value={regLine1} onChange={e => setRegLine1(e.target.value)} required />
                                <input type="text" placeholder="Line 2 (Street/Area)" className="w-full px-5 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-sm" value={regLine2} onChange={e => setRegLine2(e.target.value)} required />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Landmark" className="w-full px-5 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-sm" value={regLandmark} onChange={e => setRegLandmark(e.target.value)} />
                                    <input type="text" placeholder="Pincode" maxLength={6} className="w-full px-5 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-sm" value={regPincode} onChange={e => setRegPincode(e.target.value)} required />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              )}
              
              <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-emerald-200/50 hover:shadow-emerald-300/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all mt-6">Create Account</button>
              
              <div className="text-center mt-6">
                 <button type="button" onClick={() => setView('LOGIN')} className="text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">Back to Login</button>
              </div>
            </form>
          )}

          {/* Google Login Simulation Modal */}
          {showGoogleModal && (
            <div className="absolute inset-0 z-50 bg-white rounded-[2.5rem] p-8 flex flex-col items-center animate-fade-in-up">
                <div className="w-full max-w-sm">
                    <button onClick={() => setShowGoogleModal(false)} className="absolute top-8 left-8 text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div className="text-center mb-8 mt-4">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-12 h-12 mx-auto mb-4" />
                        <h3 className="text-2xl font-black text-slate-800">Choose an account</h3>
                        <p className="text-slate-500 text-sm font-medium">to continue to ShareMeal</p>
                    </div>

                    <div className="space-y-2 mb-6">
                        {storage.getUsers().length > 0 ? (
                            storage.getUsers().slice(0, 4).map(u => (
                                <button 
                                    key={u.id}
                                    onClick={() => handleGoogleSignIn(u)}
                                    className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all text-left group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                                        {u.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate group-hover:text-emerald-700">{u.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-4 text-slate-400 text-sm italic">
                                No detected accounts.
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={createGoogleUser}
                        className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl border-t border-slate-100 transition-all text-left"
                    >
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-lg shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-slate-700 text-sm">Use another account</p>
                            <p className="text-xs text-slate-400">Creates a new Google user</p>
                        </div>
                    </button>
                    
                    <div className="mt-8 text-center text-[10px] text-slate-400 leading-tight">
                        To continue, Google will share your name, email address, and language preference with ShareMeal.
                    </div>
                </div>
            </div>
          )}

          {/* Facebook Login Simulation Modal */}
          {showFacebookModal && (
            <div className="absolute inset-0 z-50 bg-white rounded-[2.5rem] p-0 flex flex-col animate-fade-in-up overflow-hidden">
                {/* Facebook Blue Header */}
                <div className="bg-[#1877F2] p-6 text-white relative">
                    <button onClick={() => setShowFacebookModal(false)} className="absolute top-6 left-6 text-white/80 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div className="text-center mt-2">
                        <h3 className="text-xl font-bold">Facebook</h3>
                        <p className="text-blue-200 text-xs">Log in to ShareMeal</p>
                    </div>
                </div>

                <div className="p-8 flex-1 flex flex-col items-center">
                    <div className="text-center mb-8">
                        <p className="text-slate-600 font-bold text-lg">Continue as...</p>
                    </div>

                    <div className="space-y-3 w-full max-w-sm mb-6">
                        {storage.getUsers().length > 0 ? (
                            storage.getUsers().slice(0, 4).map(u => (
                                <button 
                                    key={u.id}
                                    onClick={() => handleFacebookSignIn(u)}
                                    className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-[#1877F2]/30 transition-all text-left group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                        {u.profilePictureUrl ? <img src={u.profilePictureUrl} className="w-full h-full object-cover" /> : <span className="text-slate-500">{u.name.charAt(0)}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate group-hover:text-[#1877F2]">{u.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-4 text-slate-400 text-sm italic">
                                No active sessions found.
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={createFacebookUser}
                        className="w-full max-w-sm bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Create New Account
                    </button>
                    
                    <div className="mt-auto text-center text-[10px] text-slate-400 pt-8">
                        ShareMeal will receive your name and profile picture.
                    </div>
                </div>
            </div>
          )}

          {/* Forgot Password Modal */}
          {showForgotPasswordModal && (
            <div className="absolute inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
                <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative overflow-hidden">
                    {resetStep === 'INPUT' && (
                        <form onSubmit={handleResetPassword}>
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">Forgot Password?</h3>
                                <p className="text-slate-500 text-sm font-medium">No worries! Enter your email and we'll send you reset instructions.</p>
                            </div>
                            
                            <div className="space-y-4 mb-6">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                                    </div>
                                    <input 
                                        type="email" 
                                        placeholder="Enter your email" 
                                        className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" 
                                        value={forgotEmail} 
                                        onChange={e => setForgotEmail(e.target.value)} 
                                        required 
                                    />
                                </div>
                            </div>

                            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transform hover:-translate-y-0.5 transition-all">
                                Send Reset Link
                            </button>
                            
                            <button type="button" onClick={() => setShowForgotPasswordModal(false)} className="w-full mt-4 py-3 text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors">
                                Back to Login
                            </button>
                        </form>
                    )}

                    {resetStep === 'SUCCESS' && (
                        <div className="text-center py-4">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-slow">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Check your mail</h3>
                            <p className="text-slate-500 text-sm font-medium mb-8">We have sent password recovery instructions to your email.</p>
                            <button 
                                onClick={() => {
                                    setShowForgotPasswordModal(false);
                                    setResetStep('INPUT');
                                    setForgotEmail('');
                                }} 
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl transition-all"
                            >
                                Back to Login
                            </button>
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout user={user!} onLogout={() => { setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} notifications={notifications}>
      {view === 'PROFILE' && user ? (
        <ProfileView 
          user={user} 
          onUpdate={(updates) => {
            const updated = storage.updateUser(user.id, updates);
            if (updated) setUser(updated);
          }}
          onBack={() => setView('DASHBOARD')}
        />
      ) : (
        <>
          {/* Dashboard Content */}
          {/* If Donor and Verification Pending, show modal */}
          {pendingVerificationPosting && (
              <VerificationRequestModal 
                posting={pendingVerificationPosting}
                onApprove={handleDonorApprove}
                onReject={handleDonorReject}
              />
          )}

          {/* Impact Board (Hero Section) */}
          <div className="mb-8 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 md:p-12 shadow-2xl">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                  <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          {user?.role === UserRole.DONOR ? 'Donor Dashboard' : user?.role}
                      </div>
                      <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                        Hi, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">{user?.name.split(' ')[0]}</span>
                      </h2>
                      <p className="text-slate-400 font-medium max-w-md">
                        {user?.role === UserRole.DONOR ? "Your contributions are changing lives. Track your impact and keep the cycle of kindness moving." : 
                         user?.role === UserRole.VOLUNTEER ? "Thanks for bridging the gap. Every delivery counts." : 
                         "Browse available food and request pickups."}
                      </p>
                  </div>

                  {stats && (
                      <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
                           <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center min-w-[100px]">
                               <p className="text-2xl md:text-3xl font-black">{stats.mealsEstimate || stats.total * 5 || 0}</p>
                               <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">Meals Shared</p>
                           </div>
                           <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center min-w-[100px]">
                               <p className="text-2xl md:text-3xl font-black">{stats.completed}</p>
                               <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Rescues</p>
                           </div>
                           <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center min-w-[100px]">
                               <p className="text-2xl md:text-3xl font-black">{user?.impactScore || 0}</p>
                               <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Score</p>
                           </div>
                      </div>
                  )}
              </div>
              
              {/* Decorative Blobs */}
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl"></div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              {user?.role === UserRole.DONOR && (
                  <>
                    <button onClick={() => setActiveTab('active')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'active' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:text-slate-600'}`}>
                        Active Donations
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:text-slate-600'}`}>
                        Past History
                    </button>
                  </>
              )}
              {user?.role === UserRole.VOLUNTEER && (
                  <>
                    <button onClick={() => setActiveTab('opportunities')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'opportunities' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:text-slate-600'}`}>
                        Opportunities
                    </button>
                    <button onClick={() => setActiveTab('mytasks')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'mytasks' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:text-slate-600'}`}>
                        My Tasks
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:text-slate-600'}`}>
                        History
                    </button>
                  </>
              )}
              {user?.role === UserRole.REQUESTER && (
                  <>
                    <button onClick={() => setActiveTab('browse')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'browse' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:text-slate-600'}`}>
                        Browse Food
                    </button>
                    <button onClick={() => setActiveTab('myrequests')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'myrequests' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:text-slate-600'}`}>
                        My Requests
                    </button>
                  </>
              )}
          </div>
          
          {/* Postings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPostings.length === 0 ? (
                  <div className="col-span-full py-24 text-center">
                      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                         <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <h3 className="text-xl font-black text-slate-800 mb-2">It's quiet here...</h3>
                      <p className="font-medium text-slate-400 text-sm max-w-xs mx-auto">
                          {user?.role === UserRole.DONOR ? "You have no active donations at the moment. Ready to share a meal?" : "No items found in this section."}
                      </p>
                      {user?.role === UserRole.DONOR && activeTab === 'active' && (
                          <button onClick={() => setIsAddingFood(true)} className="mt-8 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-200 hover:scale-105 transition-transform">
                              Donate Now
                          </button>
                      )}
                  </div>
              ) : (
                filteredPostings.map(posting => (
                    <FoodCard 
                        key={posting.id} 
                        posting={posting} 
                        user={user!} 
                        onUpdate={(id, updates) => {
                            const updated = storage.updatePosting(id, updates);
                            if (updated) handleRefresh();
                        }}
                        currentLocation={userLocation}
                        onRateVolunteer={handleRateVolunteer}
                        volunteerProfile={posting.volunteerId ? storage.getUser(posting.volunteerId) : undefined}
                    />
                ))
              )}
          </div>

          {/* Floating Action Button for Donors */}
          {user?.role === UserRole.DONOR && (
              <button 
                onClick={() => setIsAddingFood(true)}
                className="fixed bottom-8 right-8 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border-4 border-white"
              >
                  <svg className="w-8 h-8 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </button>
          )}
        </>
      )}

      {/* Modern Add Food Modal */}
      {isAddingFood && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col md:flex-row">
              {/* Close Button Mobile */}
              <button onClick={() => setIsAddingFood(false)} className="absolute top-4 right-4 z-50 p-2 bg-white/20 backdrop-blur-md rounded-full text-slate-800 hover:bg-white md:hidden">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              {/* Left Column: Image & AI Analysis (Visual Heavy) */}
              <div className="w-full md:w-5/12 bg-slate-100 relative flex flex-col">
                  <div className="flex-1 relative group bg-slate-200 overflow-hidden">
                      {foodImage ? (
                          <>
                            <img src={foodImage} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent"></div>
                            
                            {/* AI Verdict Card Overlay */}
                            {safetyVerdict && (
                                <div className="absolute top-6 left-6 right-6">
                                    <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-xl ${safetyVerdict.isSafe ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-rose-500/90 border-rose-400 text-white'}`}>
                                        <div className="flex items-center gap-3 font-bold mb-1">
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                                {safetyVerdict.isSafe ? (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                )}
                                            </div>
                                            <span className="uppercase tracking-wider text-xs">AI Safety Check</span>
                                        </div>
                                        <p className="text-sm font-medium leading-snug opacity-95 pl-11">{safetyVerdict.reasoning}</p>
                                    </div>
                                </div>
                            )}

                            <button type="button" onClick={() => setFoodImage(null)} className="absolute bottom-6 left-6 right-6 py-3 bg-white/90 text-slate-900 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg hover:bg-white transition-colors">
                                Retake Photo
                            </button>
                          </>
                      ) : isCameraOpen ? (
                          <div className="w-full h-full relative bg-black">
                              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                              <canvas ref={canvasRef} className="hidden"></canvas>
                              <button onClick={capturePhoto} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 border-4 border-white rounded-full bg-white/20 hover:bg-white/40 transition-colors"></button>
                              <button onClick={stopCamera} className="absolute top-4 right-4 text-white p-2">
                                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                          </div>
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
                              <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-300">
                                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              </div>
                              <div>
                                  <h3 className="text-xl font-black text-slate-800">Add Food Photo</h3>
                                  <p className="text-sm text-slate-400 font-medium mt-1">Required for AI verification</p>
                              </div>
                              <div className="flex flex-col gap-3 w-full max-w-xs">
                                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-colors">
                                      Upload from Gallery
                                  </button>
                                  <button type="button" onClick={startCamera} className="w-full py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-colors">
                                      Use Camera
                                  </button>
                              </div>
                              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                          </div>
                      )}
                  </div>
              </div>

              {/* Right Column: Form Details */}
              <div className="w-full md:w-7/12 flex flex-col h-full bg-white relative">
                  <div className="p-8 pb-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                      <div>
                          <h2 className="text-3xl font-black text-slate-800">Food Details</h2>
                          <p className="text-slate-400 font-medium text-sm">Help others understand your donation.</p>
                      </div>
                      <button onClick={() => setIsAddingFood(false)} className="hidden md:block p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  <form onSubmit={handlePostFood} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                      {/* Section 1: Basic Info */}
                      <div className="space-y-4">
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">What are you donating?</label>
                              <input type="text" value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="e.g. 50 Packets of Veg Biryani" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" required />
                          </div>
                          
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Quick Tags</label>
                              <div className="flex flex-wrap gap-2">
                                  {['Veg', 'Non-Veg', 'Bakery', 'Raw Ingredients', 'Cooked Meals'].map(tag => (
                                      <button 
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide border transition-all ${selectedTags.includes(tag) ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                      >
                                          {tag}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Quantity</label>
                                  <input type="number" value={quantityNum} onChange={e => setQuantityNum(e.target.value)} placeholder="10" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" required />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Unit</label>
                                  <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none">
                                      <option value="meals">Meals</option>
                                      <option value="kg">Kg</option>
                                      <option value="liters">Liters</option>
                                      <option value="boxes">Boxes</option>
                                  </select>
                              </div>
                          </div>
                          
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Expires By</label>
                              <input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" required />
                          </div>

                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Description (Optional)</label>
                              <textarea value={foodDescription} onChange={e => setFoodDescription(e.target.value)} placeholder="Any allergens? Special instructions?" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none h-24" />
                          </div>
                      </div>

                      {/* Section 2: Location */}
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Pickup Location</label>
                              <button type="button" onClick={handleFoodAutoDetectLocation} disabled={isFoodAutoDetecting} className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1">
                                  {isFoodAutoDetecting ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                  Auto Detect
                              </button>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                                <input type="text" value={foodLine1} onChange={e => setFoodLine1(e.target.value)} placeholder="Line 1 (House/Flat)" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" required />
                                <input type="text" value={foodLine2} onChange={e => setFoodLine2(e.target.value)} placeholder="Line 2 (Street/Area)" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" required />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" value={foodLandmark} onChange={e => setFoodLandmark(e.target.value)} placeholder="Landmark" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" />
                                    <input type="text" value={foodPincode} onChange={e => setFoodPincode(e.target.value)} placeholder="Pincode" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" required />
                                </div>
                          </div>
                      </div>
                  </form>
                  
                  <div className="p-8 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                      <button 
                        onClick={handlePostFood} 
                        disabled={isAnalyzing} 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-1 transition-all"
                      >
                          {isAnalyzing ? 'Analyzing Image...' : 'Post Donation'}
                      </button>
                  </div>
              </div>
            </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
