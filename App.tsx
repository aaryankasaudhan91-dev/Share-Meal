
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Notification } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import ProfileView from './components/ProfileView';

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD' | 'PROFILE'>('LOGIN');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  
  // Login/Registration States
  const [loginName, setLoginName] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);

  // Post Food Modal State
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [quantityNum, setQuantityNum] = useState('');
  const [unit, setUnit] = useState('meals');
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setPostings(storage.getPostings());
    if (user) setNotifications(storage.getNotifications(user.id));
    
    // Get Location
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.log("Location access denied", err)
    );
  }, [user]);

  // Clean up camera on unmount or modal close
  useEffect(() => {
    if (!isAddingFood) stopCamera();
  }, [isAddingFood]);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setFoodImage(null);
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
            
            // AI Analysis
            const analysis = await analyzeFoodSafetyImage(base64);
            setIsAnalyzing(false);
            
            if (!analysis.isSafe) {
                alert(`Safety Warning: ${analysis.reasoning}. Please retain only safe food.`);
                setFoodImage(null);
            }
        }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = storage.getUsers().find(u => u.name.toLowerCase() === loginName.toLowerCase());
    if (existing) {
      setUser(existing);
      setView('DASHBOARD');
    } else alert("User not found.");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = { id: Math.random().toString(36).substr(2, 9), name: regName, email: regEmail, role: regRole };
    storage.saveUser(newUser);
    setUser(newUser);
    setView('DASHBOARD');
  };

  const handlePostFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!foodImage) {
        alert("Please take a photo of the food.");
        return;
    }

    const newPost: FoodPosting = {
      id: Math.random().toString(36).substr(2, 9), 
      donorId: user.id, 
      donorName: user.name, 
      foodName, 
      quantity: `${quantityNum} ${unit}`,
      location: user.address || { line1: 'Main St', line2: 'Apt 4', pincode: '123456' },
      expiryDate, 
      status: FoodStatus.AVAILABLE, 
      imageUrl: foodImage, 
      createdAt: Date.now()
    };
    storage.savePosting(newPost);
    setIsAddingFood(false);
    setPostings(storage.getPostings());
    
    // Reset Form
    setFoodName('');
    setQuantityNum('');
    setFoodImage(null);
    setExpiryDate('');
  };

  if (view === 'LOGIN' || view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-white">
          <div className="text-center mb-10"><img src={LOGO_URL} className="h-20 mx-auto mb-4" /><h1 className="text-3xl font-black">{view === 'LOGIN' ? 'Welcome Back' : 'Join Us'}</h1></div>
          {view === 'LOGIN' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Username" className="w-full p-4 border border-black bg-white rounded-2xl font-bold" value={loginName} onChange={e => setLoginName(e.target.value)} required />
              <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Sign In</button>
              <button type="button" onClick={() => setView('REGISTER')} className="w-full text-emerald-600 font-bold mt-4">Create Account</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                  {[UserRole.DONOR, UserRole.VOLUNTEER, UserRole.REQUESTER].map(role => (
                      <button key={role} type="button" onClick={() => setRegRole(role)} className={`p-2 rounded-xl border text-[10px] font-black uppercase ${regRole === role ? 'bg-emerald-600 text-white' : 'bg-slate-50'}`}>{role}</button>
                  ))}
              </div>
              <input type="text" placeholder="Full Name" className="w-full p-4 border border-black bg-white rounded-2xl font-bold" value={regName} onChange={e => setRegName(e.target.value)} required />
              <input type="email" placeholder="Email" className="w-full p-4 border border-black bg-white rounded-2xl font-bold" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
              <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Register</button>
              <button type="button" onClick={() => setView('LOGIN')} className="w-full text-slate-400 font-bold mt-4">Login</button>
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
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <h3 className="text-2xl font-black mb-6">Donate Food</h3>
                    <form onSubmit={handlePostFood} className="space-y-4">
                        
                        {/* Camera UI */}
                        <div className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-300 relative h-64 flex flex-col items-center justify-center">
                            {isCameraOpen ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                                    <button type="button" onClick={capturePhoto} className="absolute bottom-4 bg-white rounded-full p-4 shadow-lg border-4 border-slate-200">
                                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                                    </button>
                                </>
                            ) : foodImage ? (
                                <>
                                    <img src={foodImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                            <div className="text-white font-bold text-sm animate-pulse">AI Checking Safety...</div>
                                        </div>
                                    )}
                                    <button type="button" onClick={() => setFoodImage(null)} className="absolute top-2 right-2 bg-slate-900/80 text-white p-2 rounded-full text-xs font-bold z-10">Retake</button>
                                </>
                            ) : (
                                <button type="button" onClick={startCamera} className="flex flex-col items-center text-slate-400 gap-2">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <span className="font-bold">Tap to take photo</span>
                                </button>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        <input type="text" placeholder="Food Name" value={foodName} onChange={e => setFoodName(e.target.value)} className="w-full p-4 border border-black bg-white rounded-xl font-bold" required />
                        
                        <div className="flex gap-4">
                            <input type="number" placeholder="Quantity" value={quantityNum} onChange={e => setQuantityNum(e.target.value)} className="flex-1 p-4 border border-black bg-white rounded-xl font-bold" required />
                            <select value={unit} onChange={e => setUnit(e.target.value)} className="w-32 p-4 border border-black bg-white rounded-xl font-bold appearance-none">
                                <option value="meals">meals</option>
                                <option value="kg">kg</option>
                                <option value="lbs">lbs</option>
                                <option value="boxes">boxes</option>
                                <option value="liters">liters</option>
                                <option value="items">items</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                             <label className="text-[10px] uppercase font-black text-slate-500 ml-2">Best Before</label>
                             <input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full p-4 border border-black bg-white rounded-xl font-bold" required />
                        </div>
                        
                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={() => setIsAddingFood(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold">Cancel</button>
                            <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black disabled:bg-slate-300 disabled:text-slate-500" disabled={!foodImage || isAnalyzing}>Post</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        {view === 'PROFILE' && user ? <ProfileView user={user} onUpdate={u => storage.updateUser(user.id, u)} onBack={() => setView('DASHBOARD')} /> : (
            <>
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black tracking-tight">Rescue <span className="text-emerald-600">Feed</span></h2>
                    {user?.role === UserRole.DONOR && <button onClick={() => setIsAddingFood(true)} className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-emerald-100">Donate Food</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {postings.map(p => user && <FoodCard key={p.id} posting={p} user={user} currentLocation={userLocation} onUpdate={(id, updates) => { storage.updatePosting(id, updates); setPostings(storage.getPostings()); }} />)}
                </div>
            </>
        )}
    </Layout>
  );
};

export default App;
