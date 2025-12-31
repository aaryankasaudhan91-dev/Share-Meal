
import React, { useState, useRef, useEffect } from 'react';
import { User, Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onProfileClick: () => void;
  onLogoClick: () => void;
  notifications?: Notification[];
}

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png';

const Layout: React.FC<LayoutProps> = ({ 
  children, user, onLogout, onProfileClick, onLogoClick, notifications = [] 
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={onLogoClick}>
            <img src={LOGO_URL} className="h-10 w-10 group-hover:scale-110 transition-transform" />
            <div className="flex flex-col">
              <span className="font-black text-xl leading-none">ShareMeal</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Connect</span>
            </div>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 hover:bg-slate-100 rounded-full relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onProfileClick} className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-black">{user.name.charAt(0)}</button>
                <button onClick={onLogout} className="bg-white border-2 border-slate-200 p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-10">{children}</main>
    </div>
  );
};

export default Layout;
