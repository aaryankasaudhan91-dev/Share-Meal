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
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regPincode, setRegPincode] = useState('');

  // Post Food States
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      setUser(existing);
      setNotifications(storage.getNotifications(existing.id));
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
      orgName: regRole === UserRole.REQUESTER ? regOrgName : undefined,
      orgCategory: regRole === UserRole.REQUESTER ? regOrgCategory : undefined,
      address: regRole === UserRole.REQUESTER ? { line1: 'Main St', line2: 'Area 51', pincode: regPincode, lat: 28.6139, lng: 77.2090 } : undefined
    };
    storage.saveUser(newUser);
    setUser(newUser);
    setView('DASHBOARD');
    refreshData();
  };

  const handlePostFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const newPost: FoodPosting = {
      id: Math.random().toString(36).substr(2, 9),
      donorId: user.id,
      donorName: user.name,
      foodName,
      quantity,
      location: user.address || { line1: 'Donor HQ', line2: 'Downtown', pincode: '110001', lat: 28.6139, lng: 77.2090 },
      expiryDate,
      status: FoodStatus.AVAILABLE,
      imageUrl: foodImage || undefined,
      createdAt: Date.now()
    };
    
    storage.savePosting(newPost);
    setIsAddingFood(false);
    setFoodName('');
    setQuantity('');
    setFoodImage(null);
    refreshData();
  };

  const updatePosting = (id: string, updates: Partial<FoodPosting>) => {
    storage.updatePosting(id, updates);
    refreshData();
  };

  const handleLogout = () => {
    setUser(null);
    setView('LOGIN');
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
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
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
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-emerald-100">
          <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Join the Mission</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" placeholder="Full Name" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={regName} onChange={e => setRegName(e.target.value)} required />
            <input type="email" placeholder="Email" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
            <select className="w-full px-4 py-3 rounded-xl border border-slate-200" value={regRole} onChange={e => setRegRole(e.target.value as UserRole)}>
              <option value={UserRole.DONOR}>Food Donor</option>
              <option value={UserRole.VOLUNTEER}>Volunteer</option>
              <option value={UserRole.REQUESTER}>Orphanage / Requester</option>
            </select>
            {regRole === UserRole.REQUESTER && (
              <>
                <input type="text" placeholder="Organization Name" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} required />
                <input type="text" placeholder="Pincode" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={regPincode} onChange={e => setRegPincode(e.target.value)} required />
              </>
            )}
            <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs">Register</button>
          </form>
          <button onClick={() => setView('LOGIN')} className="w-full mt-4 text-slate-500 text-xs font-bold">Already registered? Login</button>
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
                  <input type="text" placeholder="What are you donating?" className="px-4 py-3 rounded-xl border border-slate-200" value={foodName} onChange={e => setFoodName(e.target.value)} required />
                  <input type="text" placeholder="Quantity (e.g., 5kg, 10 meals)" className="px-4 py-3 rounded-xl border border-slate-200" value={quantity} onChange={e => setQuantity(e.target.value)} required />
                  <input type="datetime-local" className="px-4 py-3 rounded-xl border border-slate-200" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                  <button className="md:col-span-2 bg-emerald-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs">Publish Donation</button>
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