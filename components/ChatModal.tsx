
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest truncate max-w-[200px]">{posting.foodName}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Coordination Chat</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Message List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <p className="text-xs font-black uppercase tracking-widest">No messages yet</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMe 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 rounded-tl-none border border-slate-200'
                  }`}>
                    <p className="font-medium leading-relaxed">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                      {isMe ? 'You' : msg.senderName} ({msg.senderRole})
                    </span>
                    <span className="text-[8px] text-slate-300">•</span>
                    <span className="text-[8px] text-slate-300 font-bold">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Type a message..." 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-white rounded-xl px-4 py-2 text-sm border border-black focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
            />
            <button 
              type="submit"
              disabled={!inputText.trim()}
              className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
