
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Address, Notification } from './types';
import { storage } from './services/storageService';
import { analyzeFoodSafetyImage, ImageAnalysisResult } from './services/geminiService';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import RequesterMap from './components/RequesterMap';

const LOGO_URL = 'https://cdn-icons-png.flaticon.com/512/1000/1000399.png';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD'>('LOGIN');
  const [showVolunteerMap, setShowVolunteerMap] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'recent' | 'expiry'>('recent');
  const [donorViewMode, setDonorViewMode] = useState<'active' | 'history'>('active');
  
  // Registration form states
  const [loginName, setLoginName] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  
  // Requester specific registration states
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regOrgName, setRegOrgName] = useState('');
  const [regAddrLine1, setRegAddrLine1] = useState('');
  const [regAddrLine2, setRegAddrLine2] = useState('');
  const [regAddrLandmark, setRegAddrLandmark] = useState('');
  const [regAddrPincode, setRegAddrPincode] = useState('');
  const [regLat, setRegLat] = useState<number | undefined>(undefined);
  const [regLng, setRegLng] = useState<number | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Posting form state
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locLine1, setLocLine1] = useState('');
  const [locLine2, setLocLine2] = useState('');
  const [locLandmark, setLocLandmark] = useState('');
  const [locPincode, setLocPincode] = useState('');
  const [locLat, setLocLat] = useState<number | undefined>(undefined);
  const [locLng, setLocLng] = useState<number | undefined>(undefined);
  const [isGettingPostingLocation, setIsGettingPostingLocation] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [safetyVerdict, setSafetyVerdict] = useState<{ isSafe: boolean; reasoning: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load postings on mount
  useEffect(() => {
    setPostings(storage.getPostings());
    setAllUsers(storage.getUsers());
  }, []);

  // Poll for notifications and posting updates
  useEffect(() => {
    if (!user) return;
    
    // Get current location for map centering if volunteer
    if (user.role === UserRole.VOLUNTEER && !userLocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log("Location access denied")
        );
    }

    const fetchData = () => {
      const userNotifications = storage.getNotifications(user.id);
      setNotifications(userNotifications);
      
      const currentPostings = storage.getPostings();
      setPostings(currentPostings); // Also refresh postings to see status changes in real-time
      setAllUsers(storage.getUsers());

      // Check for expiry warnings for Donors
      if (user.role === UserRole.DONOR) {
        const now = Date.now();
        const WARNING_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours

        currentPostings.forEach(p => {
            if (p.donorId === user.id && p.status === FoodStatus.AVAILABLE) {
                const expiryTime = new Date(p.expiryDate).getTime();
                const timeUntilExpiry = expiryTime - now;

                if (timeUntilExpiry > 0 && timeUntilExpiry < WARNING_THRESHOLD) {
                    const message = `⚠️ Urgent: Your donation "${p.foodName}" expires in < 2 hours and hasn't been picked up.`;
                    const alreadyNotified = userNotifications.some(n => n.message === message);
                    
                    if (!alreadyNotified) {
                        storage.createNotification(user.id, message, 'ACTION');
                    }
                }
            }
        });
      }
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Volunteer Location Tracker Logic
