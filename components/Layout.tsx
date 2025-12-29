
import React, { useState, useRef, useEffect } from 'react';
import { User, Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  notifications?: Notification[];
  onMarkNotificationRead?: (id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  onLogout, 
  notifications = [], 
  onMarkNotificationRead 
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
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
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="logo.png" alt="Logo" className="h-10 w-10 object-contain" />
              <span className="font-bold text-xl tracking-tight text-slate-800">Share Meal Connect</span>
            </div>
            
            {user && (
              <div className="flex items-center space-x-4">
                {/* Notification Bell */}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200">
                      <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 text-sm">Notifications</h3>
                        {unreadCount > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{unreadCount} new</span>}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">
                            No notifications yet
                          </div>
                        ) : (
                          <ul>
                            {notifications.map(n => (
                              <li 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)}
                                className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.isRead ? 'bg-emerald-50/40' : ''}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.isRead ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                  <div className="flex-1">
                                    <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                      {n.message}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">{formatTime(n.createdAt)}</p>
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

                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{user.role}</p>
                </div>
                <button 
                  onClick={onLogout}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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

      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Share Meal Connect. Fighting food waste together.
          </div>
          <button 
            onClick={() => setShowSupportModal(true)}
            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:underline flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Contact Support
          </button>
        </div>
      </footer>

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Contact Support</h3>
                    <button onClick={() => setShowSupportModal(false)} className="text-slate-400 hover:text-slate-600">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSendSupport} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
                        <select 
                            required 
                            value={supportSubject} 
                            onChange={(e) => setSupportSubject(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Message</label>
                        <textarea 
                            required 
                            rows={4}
                            value={supportMessage}
                            onChange={(e) => setSupportMessage(e.target.value)}
                            placeholder="How can we help you?"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                        ></textarea>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setShowSupportModal(false)}
                            className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSendingSupport}
                            className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSendingSupport ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
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
