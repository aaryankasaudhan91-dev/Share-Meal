
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Address, Notification } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage, ImageAnalysisResult } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import RequesterMap from './components/RequesterMap';

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/1000/1000399.png';

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
                 const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                 setUserLocation(newLoc);
                 myActiveJobs.forEach(job => {
                     storage.updatePosting(job.id, { volunteerLocation: newLoc });
                 });
             });
         }
     }, 10000); // Every 10 seconds

     return () => clearInterval(trackerInterval);
  }, [user]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = storage.getUsers();
    const found = users.find(u => u.name.toLowerCase() === loginName.toLowerCase());
    if (found) {
        setUser(found);
        setView('DASHBOARD');
    } else {
        alert("User not found. Please register.");
    }
  };

  const handleRegister = (e: React.FormEvent) => {
      e.preventDefault();
      const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name: regName,
          email: regEmail,
          role: regRole,
      };

      if (regRole === UserRole.REQUESTER) {
          newUser.orgCategory = regOrgCategory;
          newUser.orgName = regOrgName;
          newUser.address = {
              line1: regAddrLine1,
              line2: regAddrLine2,
              landmark: regAddrLandmark,
              pincode: regAddrPincode,
              lat: regLat,
              lng: regLng
          };
      }

      storage.saveUser(newUser);
      setUser(newUser);
      setView('DASHBOARD');
  };
  
  const handleGetLocation = (type: 'reg' | 'posting') => {
      const setter = type === 'reg' ? setIsGettingLocation : setIsGettingPostingLocation;
      setter(true);
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              if (type === 'reg') {
                  setRegLat(pos.coords.latitude);
                  setRegLng(pos.coords.longitude);
              } else {
                  setLocLat(pos.coords.latitude);
                  setLocLng(pos.coords.longitude);
              }
              setter(false);
          },
          (err) => {
              alert("Could not fetch location.");
              setter(false);
          }
      );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsAnalyzingImage(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              setFoodImage(base64);
              const analysis = await analyzeFoodSafetyImage(base64);
              setSafetyVerdict(analysis);
              setIsAnalyzingImage(false);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleCreatePosting = (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (safetyVerdict && !safetyVerdict.isSafe) {
          if (!window.confirm("AI warning: This food might be unsafe. Are you sure you want to post it?")) {
              return;
          }
      }

      const newPosting: FoodPosting = {
          id: Math.random().toString(36).substr(2, 9),
          donorId: user.id,
          donorName: user.name,
          foodName,
          quantity,
          location: {
              line1: locLine1,
              line2: locLine2,
              landmark: locLandmark,
              pincode: locPincode,
              lat: locLat,
              lng: locLng
          },
          expiryDate,
          status: FoodStatus.AVAILABLE,
          createdAt: Date.now(),
          imageUrl: foodImage || undefined,
          safetyVerdict: safetyVerdict || undefined
      };

      storage.savePosting(newPosting);
      setIsAddingFood(false);
      // Reset form
      setFoodName('');
      setQuantity('');
      setLocLine1('');
      setLocPincode('');
      setFoodImage(null);
      setSafetyVerdict(null);
  };

  const filteredPostings = postings.filter(p => {
      if (user?.role === UserRole.DONOR) {
          if (donorViewMode === 'active') return p.donorId === user.id && p.status !== FoodStatus.DELIVERED;
          return p.donorId === user.id && p.status === FoodStatus.DELIVERED;
      }
      if (user?.role === UserRole.VOLUNTEER) {
          // Show available for pickup or my active deliveries
          return p.status === FoodStatus.REQUESTED || (p.volunteerId === user.id && p.status === FoodStatus.IN_TRANSIT);
      }
      if (user?.role === UserRole.REQUESTER) {
          // Show available food or my requests
          return p.status === FoodStatus.AVAILABLE || p.orphanageId === user.id;
      }
      return true;
  }).sort((a, b) => {
      if (sortBy === 'expiry') {
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      return b.createdAt - a.createdAt;
  });

  if (view === 'LOGIN') {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
                  <img src={LOGO_URL} alt="Logo" className="w-16 h-16 mx-auto mb-4" />
                  <h1 className="text-2xl font-black text-slate-800">ShareMeal Connect</h1>
                  <p className="text-emerald-600 font-bold mb-6">Welcome</p>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input 
                          type="text" 
                          placeholder="Enter your name" 
                          value={loginName}
                          onChange={e => setLoginName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-black bg-white focus:border-emerald-500 outline-none"
                          required
                      />
                      <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors">
                          Login
                      </button>
                  </form>
                  <p className="mt-4 text-sm text-slate-500">
                      New here? <button onClick={() => setView('REGISTER')} className="text-emerald-600 font-bold hover:underline">Create Account</button>
                  </p>
              </div>
          </div>
      );
  }

  if (view === 'REGISTER') {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg">
                  <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">Join ShareMeal</h2>
                  <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Full Name" value={regName} onChange={e => setRegName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black bg-white outline-none" required />
                        <input type="email" placeholder="Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black bg-white outline-none" required />
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">I want to...</label>
                          <div className="grid grid-cols-3 gap-2">
                              {[UserRole.DONOR, UserRole.VOLUNTEER, UserRole.REQUESTER].map(r => (
                                  <button 
                                    key={r}
                                    type="button"
                                    onClick={() => setRegRole(r)}
                                    className={`py-2 rounded-lg text-xs font-bold border ${regRole === r ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-black'}`}
                                  >
                                      {r}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {regRole === UserRole.REQUESTER && (
                          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-black">
                              <p className="text-sm font-bold text-slate-700">Organization Details</p>
                              <input type="text" placeholder="Organization Name" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-black bg-white text-sm" required />
                              <select value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-black bg-white text-sm">
                                  <option>Orphanage</option>
                                  <option>Old Age Home</option>
                                  <option>Shelter</option>
                                  <option>Other</option>
                              </select>
                              <div className="space-y-2">
                                  <input type="text" placeholder="Address Line 1" value={regAddrLine1} onChange={e => setRegAddrLine1(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-black bg-white text-sm" required />
                                  <div className="flex gap-2">
                                     <input type="text" placeholder="Landmark" value={regAddrLandmark} onChange={e => setRegAddrLandmark(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-black bg-white text-sm" />
                                     <input type="text" placeholder="Pincode" value={regAddrPincode} onChange={e => setRegAddrPincode(e.target.value)} className="w-24 px-3 py-2 rounded-lg border border-black bg-white text-sm" required />
                                  </div>
                                  <button type="button" onClick={() => handleGetLocation('reg')} className="text-xs text-blue-600 font-bold hover:underline">
                                      {isGettingLocation ? 'Locating...' : '📍 Use Current GPS Location'}
                                  </button>
                              </div>
                          </div>
                      )}

                      <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors">
                          Complete Registration
                      </button>
                  </form>
                  <p className="mt-4 text-sm text-slate-500 text-center">
                      Already have an account? <button onClick={() => setView('LOGIN')} className="text-emerald-600 font-bold hover:underline">Login</button>
                  </p>
              </div>
          </div>
      );
  }

  return (
    <Layout 
        user={user} 
        onLogout={() => { setUser(null); setView('LOGIN'); }} 
        notifications={notifications}
        onMarkNotificationRead={storage.markNotificationRead}
    >
        {/* Controls Header */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-black text-slate-800">
                    {user?.role === UserRole.DONOR ? 'My Donations' : 
                     user?.role === UserRole.VOLUNTEER ? 'Delivery Hub' : 'Food Requests'}
                </h2>
                <p className="text-slate-500 text-sm">Welcome back, {user?.name}</p>
            </div>
            
            <div className="flex gap-3">
                {user?.role === UserRole.DONOR && (
                    <div className="bg-white p-1 rounded-lg border border-black flex text-xs font-bold">
                        <button onClick={() => setDonorViewMode('active')} className={`px-3 py-1.5 rounded ${donorViewMode === 'active' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}>Active</button>
                        <button onClick={() => setDonorViewMode('history')} className={`px-3 py-1.5 rounded ${donorViewMode === 'history' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}>History</button>
                    </div>
                )}
                
                {user?.role === UserRole.VOLUNTEER && (
                    <button 
                        onClick={() => setShowVolunteerMap(!showVolunteerMap)}
                        className="bg-white border border-black text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50"
                    >
                        {showVolunteerMap ? 'Hide Map' : 'Show Map'}
                    </button>
                )}

                {user?.role === UserRole.DONOR && (
                    <button 
                        onClick={() => setIsAddingFood(true)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2"
                    >
                        <span className="text-xl leading-none">+</span> Donate Food
                    </button>
                )}
            </div>
        </div>

        {/* Volunteer Map */}
        {user?.role === UserRole.VOLUNTEER && showVolunteerMap && (
            <div className="mb-8">
                <RequesterMap requesters={allUsers.filter(u => u.role === UserRole.REQUESTER)} currentLocation={userLocation} />
            </div>
        )}

        {/* Food Grid */}
        {filteredPostings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-black">
                <div className="text-6xl mb-4">🍽️</div>
                <h3 className="text-xl font-bold text-slate-700">No postings found</h3>
                <p className="text-slate-400">Check back later or change your filters.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPostings.map(post => (
                    <FoodCard 
                        key={post.id} 
                        posting={post} 
                        user={user!}
                        onUpdate={(id, updates) => {
                            const updated = storage.updatePosting(id, updates);
                            if (updated) {
                                setPostings(prev => prev.map(p => p.id === id ? updated : p));
                            }
                        }}
                    />
                ))}
            </div>
        )}

        {/* Add Food Modal */}
        {isAddingFood && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-800">Donate Food</h3>
                        <button onClick={() => setIsAddingFood(false)} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleCreatePosting} className="space-y-6">
                        <div className="flex gap-4 items-start">
                            <div className="w-1/3">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded-xl border-2 border-dashed border-black flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-emerald-500 transition-colors overflow-hidden relative bg-white"
                                >
                                    {foodImage ? (
                                        <img src={foodImage} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <span className="text-xs font-bold text-slate-500">Add Photo</span>
                                        </>
                                    )}
                                    {isAnalyzingImage && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                {safetyVerdict && (
                                    <div className={`mt-2 text-[10px] p-2 rounded border ${safetyVerdict.isSafe ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                        <strong>AI Analysis:</strong> {safetyVerdict.reasoning}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-4">
                                <input type="text" placeholder="Food Name (e.g., 20 Veg Meals)" value={foodName} onChange={e => setFoodName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black bg-white outline-none font-bold" required />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" placeholder="Quantity (e.g., 5kg)" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black bg-white outline-none" required />
                                    <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black bg-white outline-none" required />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-black">
                            <h4 className="text-sm font-bold text-slate-700">Pickup Location</h4>
                            <input type="text" placeholder="Address Line 1" value={locLine1} onChange={e => setLocLine1(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-black bg-white text-sm" required />
                            <div className="flex gap-3">
                                <input type="text" placeholder="Landmark" value={locLandmark} onChange={e => setLocLandmark(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-black bg-white text-sm" />
                                <input type="text" placeholder="Pincode" value={locPincode} onChange={e => setLocPincode(e.target.value)} className="w-28 px-3 py-2 rounded-lg border border-black bg-white text-sm" required />
                            </div>
                            <button type="button" onClick={() => handleGetLocation('posting')} className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {isGettingPostingLocation ? 'Locating...' : 'Use Current Location'}
                            </button>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isAnalyzingImage}
                            className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-all shadow-lg disabled:opacity-50"
                        >
                            Confirm Donation
                        </button>
                    </form>
                </div>
            </div>
        )}
    </Layout>
  );
};

export default App;
