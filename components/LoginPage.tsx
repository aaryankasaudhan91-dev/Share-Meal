import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { storage } from '../services/storageService';
import { reverseGeocode } from '../services/geminiService';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  // Login State
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regContactNo, setRegContactNo] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regLine1, setRegLine1] = useState('');
  const [regLine2, setRegLine2] = useState('');
  const [regLandmark, setRegLandmark] = useState('');
  const [regPincode, setRegPincode] = useState('');
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = storage.getUsers().find(u => u?.name?.toLowerCase() === loginName.toLowerCase());
    if (existing) {
      if (existing.password && existing.password !== loginPassword) {
        alert("Invalid password.");
        return;
      }
      onLogin(existing);
    } else {
        alert("User not found.");
    }
  };

  const handleDemoLogin = (role: UserRole) => {
    const users = storage.getUsers();
    let demoUser = users.find(u => u.role === role && u.id.startsWith('demo-'));
    
    if (!demoUser) {
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
    onLogin(demoUser);
  };

  const handleSocialLogin = (provider: string) => {
      // Simulate social login for demo purposes
      const mockEmail = `user.${provider.toLowerCase()}@example.com`;
      const users = storage.getUsers();
      let user = users.find(u => u.email === mockEmail);

      if (!user) {
          // Create new simulated user if not exists
          user = {
              id: `social-${provider.toLowerCase()}-${Math.floor(Math.random() * 10000)}`,
              name: `${provider} User`,
              email: mockEmail,
              contactNo: '0000000000',
              role: UserRole.DONOR, // Default role for social logins
              impactScore: 5,
              averageRating: 5,
              ratingsCount: 1,
              profilePictureUrl: provider === 'Google' 
                ? 'https://lh3.googleusercontent.com/a/default-user=s96-c' 
                : undefined
          };
          storage.saveUser(user);
      }
      onLogin(user);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!/^\d{10}$/.test(regContactNo)) {
      alert("Please enter a valid 10-digit Contact Number.");
      return;
    }
    
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
        orgName: regRole === UserRole.REQUESTER ? regOrgName : undefined,
        orgCategory: regRole === UserRole.REQUESTER ? regOrgCategory : undefined,
        address: regRole === UserRole.REQUESTER ? {
            line1: regLine1,
            line2: regLine2,
            landmark: regLandmark,
            pincode: regPincode
        } : undefined,
        averageRating: 0,
        ratingsCount: 0
    };
    storage.saveUser(newUser);
    onLogin(newUser);
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

  return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-100 to-teal-50 flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
        {/* Animated Background Decor */}
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-cyan-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-[30%] left-[20%] w-[600px] h-[600px] bg-teal-100/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

        <div className="glass-panel p-8 md:p-12 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-lg relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/60">
          <div className="text-center mb-10">
              <div className="inline-block p-5 bg-gradient-to-br from-emerald-50 to-white rounded-[2rem] mb-6 shadow-sm ring-1 ring-emerald-100">
                  <div className="text-5xl filter drop-shadow-sm">🍃</div>
              </div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">MEALers <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">connect</span></h1>
              <p className="text-slate-500 font-medium mt-3 text-base">{view === 'LOGIN' ? 'Welcome back! Ready to make a difference?' : 'Join the community and start helping.'}</p>
          </div>
          
          {view === 'LOGIN' ? (
            <div className="animate-fade-in-up">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                   <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Username</label>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <input type="text" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all hover:bg-white" placeholder="e.g. John Doe" value={loginName} onChange={e => setLoginName(e.target.value)} required />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Password</label>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <input type="password" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all hover:bg-white" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                   </div>
                </div>

                <div className="flex justify-end">
                    <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">Forgot Password?</button>
                </div>
                
                <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-emerald-200/50 hover:shadow-emerald-300/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all mt-6">
                    Sign In
                </button>

                <div className="mt-6">
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or login with</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <button type="button" onClick={() => handleSocialLogin('Google')} className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all hover:shadow-sm">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
                                <path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853"/>
                                <path d="M5.50253 14.3003C5.00236 12.8099 5.00236 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC05"/>
                                <path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335"/>
                            </svg>
                            Google
                        </button>
                        <button type="button" onClick={() => handleSocialLogin('Facebook')} className="flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white rounded-xl text-xs font-bold hover:bg-[#166fe5] transition-all hover:shadow-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                            Facebook
                        </button>
                    </div>
                </div>
              </form>
              
              <div className="my-8 flex items-center gap-4">
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent flex-1"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick Demo Access</span>
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent flex-1"></div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleDemoLogin(UserRole.DONOR)} className="py-3 bg-white border border-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 hover:scale-105 transition-all shadow-sm">Donor</button>
                  <button onClick={() => handleDemoLogin(UserRole.VOLUNTEER)} className="py-3 bg-white border border-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase hover:bg-blue-50 hover:scale-105 transition-all shadow-sm">Volunteer</button>
                  <button onClick={() => handleDemoLogin(UserRole.REQUESTER)} className="py-3 bg-white border border-orange-100 text-orange-700 rounded-xl text-[10px] font-black uppercase hover:bg-orange-50 hover:scale-105 transition-all shadow-sm">Requester</button>
              </div>
              
              <div className="text-center mt-10">
                <span className="text-slate-500 text-sm font-medium">New here? </span>
                <button type="button" onClick={() => setView('REGISTER')} className="text-emerald-600 font-black text-sm hover:underline decoration-2 underline-offset-4 decoration-emerald-200">Create Account</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6 animate-fade-in-up">
              <div className="bg-slate-50 p-1.5 rounded-3xl mb-8 flex gap-1 shadow-inner border border-slate-100/50">
                  {[
                      { role: UserRole.DONOR, label: 'Donor', icon: '🎁', desc: 'Share Food' },
                      { role: UserRole.VOLUNTEER, label: 'Volunteer', icon: '🤝', desc: 'Deliver' },
                      { role: UserRole.REQUESTER, label: 'Requester', icon: '🏠', desc: 'Need Food' }
                  ].map(({ role, label, icon, desc }) => (
                      <button 
                        key={role} 
                        type="button" 
                        onClick={() => setRegRole(role)} 
                        className={`flex-1 flex flex-col items-center justify-center py-4 rounded-2xl transition-all duration-300 relative overflow-hidden group ${regRole === role ? 'bg-white text-emerald-600 shadow-md ring-1 ring-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                      >
                          <span className={`text-2xl mb-1 filter drop-shadow-sm transition-transform ${regRole === role ? 'scale-110' : 'scale-100 group-hover:scale-110'}`}>{icon}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider z-10">{label}</span>
                          {regRole === role && <span className="text-[9px] font-semibold text-emerald-400/80 mt-0.5">{desc}</span>}
                          {regRole === role && <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 to-transparent opacity-50"></div>}
                      </button>
                  ))}
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <input type="text" placeholder="Full Name" className="w-full pl-12 pr-4 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regName} onChange={e => setRegName(e.target.value)} required />
                     </div>
                     <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <input type="email" placeholder="Email" className="w-full pl-12 pr-4 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                     </div>
                 </div>
              
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                      <span className="font-bold text-sm border-r border-slate-300 pr-3 mr-1">+91</span>
                  </div>
                  <input 
                      type="tel" 
                      placeholder="Contact Number" 
                      maxLength={10} 
                      className="w-full pl-20 pr-4 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" 
                      value={regContactNo} 
                      onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if(val.length <= 10) setRegContactNo(val);
                      }} 
                      required 
                  />
                </div>

                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <input type="password" placeholder="Create Password" className="w-full pl-12 pr-4 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                 </div>
              </div>

              {/* Requester Specific Details */}
              {regRole === UserRole.REQUESTER && (
                 <div className="space-y-4 pt-6 border-t border-slate-100 animate-fade-in-up">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Organization Details</span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>
                    <input type="text" placeholder="Organization Name" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} required />
                    
                    <div className="relative">
                        <select className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all appearance-none" value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)}>
                            <option>Orphanage</option>
                            <option>Old Age Home</option>
                            <option>Shelter</option>
                            <option>Community Center</option>
                        </select>
                        <div className="absolute right-5 top-5 pointer-events-none text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-3">
                             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Location</p>
                             <button type="button" onClick={handleAutoDetectLocation} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                                {isAutoDetecting ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Detecting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        Auto-Detect
                                    </>
                                )}
                             </button>
                        </div>
                        <div className="space-y-3">
                            <input type="text" placeholder="Line 1 (e.g. Building, Street)" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regLine1} onChange={e => setRegLine1(e.target.value)} required />
                            <input type="text" placeholder="Line 2 (e.g. Area, City)" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regLine2} onChange={e => setRegLine2(e.target.value)} required />
                            <div className="flex gap-3">
                                <input type="text" placeholder="Landmark" className="flex-1 px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regLandmark} onChange={e => setRegLandmark(e.target.value)} />
                                <input type="text" placeholder="Pincode" maxLength={6} className="w-32 px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regPincode} onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    if(val.length <= 6) setRegPincode(val);
                                }} required />
                            </div>
                        </div>
                 </div>
              )}

              <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-emerald-200/50 hover:shadow-emerald-300/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all mt-6">
                  Create Account
              </button>
              
              <div className="text-center mt-8">
                <span className="text-slate-500 text-sm font-medium">Already have an account? </span>
                <button type="button" onClick={() => setView('LOGIN')} className="text-emerald-600 font-black text-sm hover:underline decoration-2 underline-offset-4 decoration-emerald-200">Sign In</button>
              </div>
            </form>
          )}
        </div>
      </div>
  );
};