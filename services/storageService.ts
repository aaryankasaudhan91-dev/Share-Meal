
import { User, FoodPosting, FoodStatus, UserRole, Notification, ChatMessage } from '../types';

const STORAGE_KEY_POSTINGS = 'food_rescue_postings';
const STORAGE_KEY_USERS = 'food_rescue_users';
const STORAGE_KEY_NOTIFICATIONS = 'food_rescue_notifications';
const STORAGE_KEY_CHATS = 'food_rescue_chats';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
};

const getStoredNotifications = (): Notification[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFICATIONS) || '[]');
};

const saveStoredNotifications = (notifications: Notification[]) => {
  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
};

export const storage = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(STORAGE_KEY_USERS);
    return data ? JSON.parse(data) : [];
  },
  saveUser: (user: User) => {
    const users = storage.getUsers();
    users.push({ ...user, impactScore: 0 });
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  },
  updateUser: (id: string, updates: Partial<User>) => {
    const users = storage.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      const updatedUser = { ...users[index], ...updates };
      users[index] = updatedUser;
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      return updatedUser;
    }
    return null;
  },
  toggleFavorite: (donorId: string, requesterId: string) => {
    const users = storage.getUsers();
    const donorIndex = users.findIndex(u => u.id === donorId);
    if (donorIndex !== -1) {
      const donor = users[donorIndex];
      const favorites = donor.favoriteRequesterIds || [];
      const isFavorite = favorites.includes(requesterId);
      
      if (isFavorite) {
        donor.favoriteRequesterIds = favorites.filter(id => id !== requesterId);
      } else {
        donor.favoriteRequesterIds = [...favorites, requesterId];
      }
      
      users[donorIndex] = donor;
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      return donor;
    }
    return null;
  },
  getPostings: (): FoodPosting[] => {
    const data = localStorage.getItem(STORAGE_KEY_POSTINGS);
    return data ? JSON.parse(data) : [];
  },
  getMessages: (postingId: string): ChatMessage[] => {
    const allChats = JSON.parse(localStorage.getItem(STORAGE_KEY_CHATS) || '{}');
    return allChats[postingId] || [];
  },
  saveMessage: (postingId: string, message: ChatMessage) => {
    const allChats = JSON.parse(localStorage.getItem(STORAGE_KEY_CHATS) || '{}');
    if (!allChats[postingId]) allChats[postingId] = [];
    allChats[postingId].push(message);
    localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(allChats));
  },
  getNotifications: (userId: string): Notification[] => {
    const all = getStoredNotifications();
    return all
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  markNotificationRead: (notificationId: string) => {
    const all = getStoredNotifications();
    const updated = all.map(n => n.id === notificationId ? { ...n, isRead: true } : n);
    saveStoredNotifications(updated);
  },
  markAllNotificationsRead: (userId: string) => {
    const all = getStoredNotifications();
    const updated = all.map(n => n.userId === userId ? { ...n, isRead: true } : n);
    saveStoredNotifications(updated);
  },
  createNotification: (userId: string, message: string, type: 'INFO' | 'ACTION' | 'SUCCESS') => {
    const notifications = getStoredNotifications();
    notifications.push({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      message,
      isRead: false,
      createdAt: Date.now(),
      type
    });
    saveStoredNotifications(notifications);
  },
  savePosting: (posting: FoodPosting) => {
    const postings = storage.getPostings();
    postings.unshift(posting);
    localStorage.setItem(STORAGE_KEY_POSTINGS, JSON.stringify(postings));

    const users = storage.getUsers();
    const notifications = getStoredNotifications();
    
    users.forEach(u => {
      if (u.role === UserRole.VOLUNTEER) {
        let shouldNotify = false;
        let distanceText = '';

        if (u.address?.lat && u.address?.lng && posting.location.lat && posting.location.lng) {
          const distance = calculateDistance(
            posting.location.lat,
            posting.location.lng,
            u.address.lat,
            u.address.lng
          );

          if (distance <= 10) {
            shouldNotify = true;
            distanceText = ` (${distance.toFixed(1)}km away)`;
          }
        }

        if (shouldNotify) {
          notifications.push({
            id: Math.random().toString(36).substr(2, 9),
            userId: u.id,
            message: `New food donation: ${posting.foodName} near ${posting.location.landmark || posting.location.pincode}${distanceText}`,
            isRead: false,
            createdAt: Date.now(),
            type: 'INFO'
          });
        }
      }
    });
    saveStoredNotifications(notifications);
  },
  updatePosting: (id: string, updates: Partial<FoodPosting>) => {
    const postings = storage.getPostings();
    const index = postings.findIndex(p => p.id === id);
    if (index !== -1) {
      const oldPosting = postings[index];
      const newPosting = { ...oldPosting, ...updates };
      postings[index] = newPosting;
      localStorage.setItem(STORAGE_KEY_POSTINGS, JSON.stringify(postings));

      const notifications = getStoredNotifications();
      const users = storage.getUsers();

      if (!oldPosting.isPickedUp && updates.isPickedUp) {
         if (newPosting.orphanageId) {
             notifications.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: newPosting.orphanageId,
              message: `Status Update: ${newPosting.volunteerName} has picked up "${newPosting.foodName}"!`,
              isRead: false, createdAt: Date.now(), type: 'INFO'
            });
         }
      }

      if (oldPosting.status !== FoodStatus.DELIVERED && newPosting.status === FoodStatus.DELIVERED) {
         const donorIndex = users.findIndex(u => u.id === newPosting.donorId);
         const volunteerIndex = users.findIndex(u => u.id === newPosting.volunteerId);
         if (donorIndex !== -1) users[donorIndex].impactScore = (users[donorIndex].impactScore || 0) + 1;
         if (volunteerIndex !== -1) users[volunteerIndex].impactScore = (users[volunteerIndex].impactScore || 0) + 1;
         localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      }

      saveStoredNotifications(notifications);
      return newPosting;
    }
    return null;
  }
};
