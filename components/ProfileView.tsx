
import React, { useState } from 'react';
import { User } from '../types';

interface ProfileViewProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
  onBack: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdate, onBack }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ name, email });
    alert("Profile updated!");
  };

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <button onClick={onBack} className="mb-6 text-slate-500 font-bold text-sm">Back</button>
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-emerald-600 p-8 text-white"><h2 className="text-3xl font-black uppercase">My Profile</h2></div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div><label className="text-[10px] font-black uppercase text-slate-500">Full Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black bg-white font-bold" /></div>
          <div><label className="text-[10px] font-black uppercase text-slate-500">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black bg-white font-bold" /></div>
          <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase text-xs">Update Profile</button>
        </form>
      </div>
    </div>
  );
};

export default ProfileView;
