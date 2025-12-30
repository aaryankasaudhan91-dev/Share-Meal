
import React, { useState, useEffect, useRef } from 'react';
import { User, FoodPosting, ChatMessage, UserRole } from '../types';
import { storage } from '../services/storageService';

interface ChatModalProps {
  posting: FoodPosting;
  user: User;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ posting, user, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = () => {
      const data = storage.getMessages(posting.id);
      if (data.length !== messages.length) {
        setMessages(data);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [posting.id, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      postingId: posting.id,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text: inputText.trim(),
      createdAt: Date.now(),
    };

    storage.saveMessage(posting.id, newMessage);
    setMessages([...messages, newMessage]);
    setInputText('');
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-900/5">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white shadow-lg z-10 shrink-0">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest truncate max-w-[200px] text-white">{posting.foodName}</h3>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-tight mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Coordination
              </p>
            </div>
            <button 
                onClick={onClose} 
                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all text-white/80 hover:text-white backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {/* Participants Badge Row */}
          <div className="flex flex-wrap gap-2 text-[10px] font-medium">
             <div className="bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/5">
                <span className="text-emerald-400 text-xs">🎁</span>
                <span className="opacity-70">Donor:</span>
                <span className="font-bold text-white">{posting.donorName}</span>
             </div>
             {posting.volunteerName && (
                <div className="bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/5">
                    <span className="text-amber-400 text-xs">🚚</span>
                    <span className="opacity-70">Vol:</span>
                    <span className="font-bold text-white">{posting.volunteerName}</span>
                </div>
             )}
             {posting.orphanageName && (
                <div className="bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/5">
                    <span className="text-blue-400 text-xs">🏠</span>
                    <span className="opacity-70">Req:</span>
                    <span className="font-bold text-white">{posting.orphanageName}</span>
                </div>
             )}
          </div>
        </div>

        {/* Message List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50 relative">
           {/* Decorative background */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgb(16, 185, 129) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgb(59, 130, 246) 0%, transparent 20%)' }}></div>

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-60">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                 <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">No messages yet</p>
                  <p className="text-[10px] mt-1 text-slate-400 max-w-[200px]">Start the conversation to coordinate the food rescue.</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm relative group ${
                    isMe 
                      ? 'bg-emerald-600 text-white rounded-tr-sm' 
                      : 'bg-white text-slate-700 rounded-tl-sm border border-slate-100'
                  }`}>
                    <p className="font-medium leading-relaxed">{msg.text}</p>
                    {/* Timestamp tooltip */}
                    <span className={`absolute bottom-0 ${isMe ? '-left-12' : '-right-12'} text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap py-3`}>
                        {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 px-1">
                    {!isMe && (
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                            msg.senderRole === UserRole.DONOR ? 'bg-emerald-400' :
                            msg.senderRole === UserRole.VOLUNTEER ? 'bg-amber-400' : 'bg-blue-400'
                        }`}>
                            {msg.senderName.charAt(0)}
                        </div>
                    )}
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                      {isMe ? 'You' : msg.senderName}
                    </span>
                    <span className="text-[9px] font-medium text-slate-300 lowercase px-1 bg-slate-100 rounded-full border border-slate-200">
                      {msg.senderRole}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white shrink-0">
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
                          handleSend(e);
                      }
                  }}
                  className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm border-0 focus:ring-2 focus:ring-emerald-500 transition-all font-medium resize-none max-h-24 custom-scrollbar text-slate-800 placeholder:text-slate-400"
                />
            </div>
            <button 
              type="submit"
              disabled={!inputText.trim()}
              className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md shadow-emerald-200"
            >
              <svg className="w-5 h-5 transform rotate-90 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-2 font-medium">Messages are shared with all involved parties.</p>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
