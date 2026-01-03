import React, { useState, useEffect, useRef } from 'react';
import { User, FoodPosting, ChatMessage } from '../types';
import { storage } from '../services/storageService';

interface ChatModalProps {
  posting: FoodPosting;
  user: User;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ posting, user, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(storage.getMessages(posting.id));
    const interval = setInterval(() => setMessages(storage.getMessages(posting.id)), 2000);
    return () => clearInterval(interval);
  }, [posting.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;
    const msg: ChatMessage = { 
        id: Math.random().toString(36).substr(2, 9), 
        postingId: posting.id, 
        senderId: user.id, 
        senderName: user.name || 'Unknown', 
        senderRole: user.role, 
        text: inputText, 
        createdAt: Date.now() 
    };
    storage.saveMessage(posting.id, msg);
    setMessages([...messages, msg]);
    setInputText('');
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md h-[600px] flex flex-col overflow-hidden">
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center"><h3 className="font-black text-sm uppercase">{posting.foodName}</h3><button onClick={onClose}>Close</button></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map(m => (
            <div key={m.id} className={`flex flex-col ${m.senderId === user.id ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2 rounded-2xl text-sm ${m.senderId === user.id ? 'bg-slate-800 text-white' : 'bg-white border'}`}>{m.text}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={sendMessage} className="p-4 bg-white flex gap-2"><input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Type a message..." className="flex-1 bg-white border border-black p-3 rounded-xl" /><button type="submit" className="bg-slate-900 text-white p-3 rounded-xl">Send</button></form>
      </div>
    </div>
  );
};

export default ChatModal;