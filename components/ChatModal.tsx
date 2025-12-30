
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { User, FoodPosting, ChatMessage, UserRole } from '../types';
import { storage } from '../services/storageService';

interface ChatModalProps {
  posting: FoodPosting;
  user: User;
  onClose: () => void;
}

const QUICK_REPLIES = {
  [UserRole.DONOR]: ["Is the food still needed?", "When will you arrive?", "Food is ready for pickup", "Thank you!"],
  [UserRole.VOLUNTEER]: ["I'm on my way", "Running a few mins late", "I have arrived", "Picked up the food"],
  [UserRole.REQUESTER]: ["Is this still available?", "Thank you so much!", "We are located near the...", "Contact me at..."]
};

const ChatModal: React.FC<ChatModalProps> = ({ posting, user, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshMessages = () => {
    const data = storage.getMessages(posting.id);
    setMessages(prev => {
        if (prev.length !== data.length) return data;
        return prev;
    });
  };

  useEffect(() => {
    refreshMessages();
    const interval = setInterval(refreshMessages, 2000);
    return () => clearInterval(interval);
  }, [posting.id]);

  // Scroll to bottom on new messages
  useLayoutEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      postingId: posting.id,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text: text.trim(),
      createdAt: Date.now(),
    };

    storage.saveMessage(posting.id, newMessage);
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleColor = (role: UserRole) => {
      switch (role) {
          case UserRole.DONOR: return 'bg-emerald-500';
          case UserRole.VOLUNTEER: return 'bg-amber-500';
          case UserRole.REQUESTER: return 'bg-blue-500';
          default: return 'bg-slate-500';
      }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md h-[700px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-900/5">
        
        {/* Header */}
        <div className="bg-slate-900 p-4 text-white shadow-lg z-10 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-white truncate max-w-[200px]">{posting.foodName}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Live Chat</span>
                    </div>
                </div>
            </div>
            
            <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm" title={posting.donorName}>
                    {posting.donorName.charAt(0)}
                </div>
                {posting.volunteerName && (
                    <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm" title={posting.volunteerName}>
                        {posting.volunteerName.charAt(0)}
                    </div>
                )}
                {posting.orphanageName && (
                    <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm" title={posting.orphanageName}>
                        {posting.orphanageName.charAt(0)}
                    </div>
                )}
            </div>
          </div>
          
          {/* Context Banner */}
          <div className="bg-white/5 rounded-xl p-2.5 flex items-center justify-between border border-white/10">
             <div className="text-[10px] text-slate-400">
                <span className="block font-bold text-slate-300 uppercase tracking-wider">Quantity</span>
                {posting.quantity}
             </div>
             <div className="h-6 w-px bg-white/10"></div>
             <div className="text-[10px] text-slate-400">
                <span className="block font-bold text-slate-300 uppercase tracking-wider">Status</span>
                {posting.status.replace('_', ' ')}
             </div>
             <div className="h-6 w-px bg-white/10"></div>
             <div className="text-[10px] text-slate-400">
                <span className="block font-bold text-slate-300 uppercase tracking-wider">Expires</span>
                {new Date(posting.expiryDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
             </div>
          </div>
        </div>

        {/* Message List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-50 relative">
           {/* Decorative background */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgb(16, 185, 129) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgb(59, 130, 246) 0%, transparent 20%)' }}></div>

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-60">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-2 shadow-inner">
                 <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <div className="text-center px-6">
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500">No messages yet</p>
                  <p className="text-xs mt-2 text-slate-400 leading-relaxed">This chat is shared between the Donor, Volunteer, and Requester. Coordinate details here!</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === user.id;
              const showHeader = idx === 0 || messages[idx - 1].senderId !== msg.senderId || (msg.createdAt - messages[idx - 1].createdAt > 300000); // 5 min gap
              
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                  {showHeader && !isMe && (
                      <div className="flex items-center gap-2 mb-1 ml-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white uppercase tracking-wider ${getRoleColor(msg.senderRole)}`}>
                              {msg.senderRole}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{msg.senderName}</span>
                      </div>
                  )}
                  
                  <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar for non-me users */}
                      {!isMe && showHeader ? (
                          <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${getRoleColor(msg.senderRole)}`}>
                              {msg.senderName.charAt(0)}
                          </div>
                      ) : !isMe && (
                          <div className="w-6 h-6 flex-shrink-0" /> // Spacer
                      )}

                      <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm relative transition-all ${
                        isMe 
                          ? 'bg-slate-800 text-white rounded-tr-none hover:bg-slate-900' 
                          : 'bg-white text-slate-700 rounded-tl-none border border-slate-200 hover:border-slate-300'
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <span className={`text-[9px] mt-1 block font-medium opacity-60 ${isMe ? 'text-right text-slate-300' : 'text-left text-slate-400'}`}>
                            {formatTime(msg.createdAt)}
                        </span>
                      </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        <div className="pt-3 px-4 bg-white border-t border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Quick Replies</p>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar hide-scrollbar">
                {(QUICK_REPLIES[user.role] || []).map((reply, i) => (
                    <button
                        key={i}
                        onClick={() => sendMessage(reply)}
                        className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                    >
                        {reply}
                    </button>
                ))}
            </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 bg-white shrink-0">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
                <textarea 
                  rows={1}
                  placeholder="Type a message..." 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(inputText);
                      }
                  }}
                  className="w-full bg-slate-50 rounded-2xl px-4 py-3.5 text-sm border-0 focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all font-medium resize-none max-h-24 custom-scrollbar text-slate-800 placeholder:text-slate-400"
                />
            </div>
            <button 
              type="submit"
              disabled={!inputText.trim()}
              className="bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-slate-200"
            >
              <svg className="w-5 h-5 transform rotate-90 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
    