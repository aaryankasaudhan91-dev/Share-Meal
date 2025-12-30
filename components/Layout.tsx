
import React, { useState, useRef, useEffect } from 'react';
import { User, Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onProfileClick: () => void;
  onLogoClick: () => void;
  notifications?: Notification[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
}

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/1000/1000399.png';

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  onLogout, 
  onProfileClick,
  onLogoClick,
  notifications = [], 
  onMarkNotificationRead,
  onMarkAllNotificationsRead
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead && onMarkNotificationRead) {
      onMarkNotificationRead(n.id);
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return '1d+ ago';
  };

  const handleSendSupport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingSupport(true);
    
    // Simulate API call
    setTimeout(() => {
        alert("Support request sent successfully! We will get back to you shortly.");
        setIsSendingSupport(false);
        setShowSupportModal(false);
        setSupportSubject('');
        setSupportMessage('');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 group cursor-pointer" onClick={onLogoClick}>
              <div className="relative">
                <img 
                  src={LOGO_URL}
                  alt="Share Meal Connect Logo" 
                  className="h-10 w-10 object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300" 
                />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div className="flex flex-col -space-y-1">
                <span className="font-black text-xl tracking-tight text-slate-800">ShareMeal</span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Connect</span>
              </div>
            </div>
            
            {user && (
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Notification Bell */}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
                    aria-label="Notifications"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-orange-500 rounded-full border-2 border-white"></span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200">
                      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 text-sm">Recent Updates</h3>
                        <div className="flex items-center gap-2">
                             {unreadCount > 0 && onMarkAllNotificationsRead && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onMarkAllNotificationsRead(); }}
                                    className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold uppercase tracking-wider hover:underline decoration-emerald-200 underline-offset-2 transition-all mr-1"
                                >
                                    Mark all read
                                </button>
                             )}
                             {unreadCount > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{unreadCount} new</span>}
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                            <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                            All caught up!
                          </div>
                        ) : (
                          <ul>
                            {notifications.map(n => (
                              <li 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)}
                                className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.isRead ? 'bg-emerald-50/30' : ''}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.isRead ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                  <div className="flex-1">
                                    <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                      {n.message}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                      {formatTime(n.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="hidden sm:flex flex-col items-end border-l border-slate-100 pl-4 pr-2">
                  <p className="text-sm font-bold text-slate-800">{user.name}</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded">{user.role}</p>
                </div>

                <button 
                  onClick={onProfileClick}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                  aria-label="My Profile"
                  title="My Profile"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>

                <button 
                  onClick={() => setShowLogoutConfirm(true)}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-3">
              <img src={LOGO_URL} alt="Logo" className="h-8 w-8 object-contain opacity-50 grayscale" />
              <div className="text-slate-500 text-sm">
                &copy; {new Date().getFullYear()} <span className="font-bold">Share Meal Connect</span>.
                <p className="text-xs opacity-75">Eliminating food waste, one meal at a time.</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setShowSupportModal(true)}
                className="text-slate-600 hover:text-emerald-600 text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                Support Hub
              </button>
              <div className="flex gap-4">
                 <a href="#" className="text-slate-400 hover:text-emerald-600 transition-colors"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg></a>
                 <a href="#" className="text-slate-400 hover:text-emerald-600 transition-colors"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.947.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Confirm Logout</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">Are you sure you want to log out of ShareMeal Connect?</p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onLogout}
                        className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-900 transition-all shadow-lg uppercase tracking-widest text-xs"
                    >
                        Yes, Log Me Out
                    </button>
                    <button 
                        onClick={() => setShowLogoutConfirm(false)}
                        className="w-full bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                    >
                        Stay Logged In
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Support Hub</h3>
                    </div>
                    <button onClick={() => setShowSupportModal(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSendSupport} className="space-y-5">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                        <select 
                            required 
                            value={supportSubject} 
                            onChange={(e) => setSupportSubject(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none transition-all font-medium text-slate-700"
                        >
                            <option value="">Select a topic...</option>
                            <option value="Technical Issue">Technical Issue</option>
                            <option value="Report a User/Post">Report a User/Post</option>
                            <option value="Account Help">Account Help</option>
                            <option value="Feedback">Feedback</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Message</label>
                        <textarea 
                            required 
                            rows={4}
                            value={supportMessage}
                            onChange={(e) => setSupportMessage(e.target.value)}
                            placeholder="Tell us how we can help..."
                            className="w-full px-4 py-3 rounded-xl border border-black focus:border-emerald-500 bg-white outline-none transition-all resize-none font-medium text-slate-700"
                        ></textarea>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button 
                            type="button" 
                            onClick={() => setShowSupportModal(false)}
                            className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSendingSupport}
                            className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSendingSupport ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending
                                </>
                            ) : 'Send Message'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
