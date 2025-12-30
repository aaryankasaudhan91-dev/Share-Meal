
import { User, FoodPosting, FoodStatus, UserRole, Notification, ChatMessage } from '../types';

const STORAGE_KEY_POSTINGS = 'food_rescue_postings';
const STORAGE_KEY_USERS = 'food_rescue_users';
const STORAGE_KEY_NOTIFICATIONS = 'food_rescue_notifications';
const STORAGE_KEY_CHATS = 'food_rescue_chats';

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
  
  // Chat Methods
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
        notifications.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: u.id,
          message: `New food donation: ${posting.foodName} near ${posting.location.landmark || posting.location.pincode}`,
          isRead: false,
          createdAt: Date.now(),
          type: 'INFO'
        });
      }
    });
    saveStoredNotifications(notifications);
  },

  updatePosting: (id: string, updates: Partial<FoodPosting>) => {
    const postings = storage.getPostings();
    const index = postings.findIndex(p => p.id === id);
    if (index !== -1) {
      const oldPosting = postings[index];
      
      if (oldPosting.status !== FoodStatus.IN_TRANSIT && updates.status === FoodStatus.IN_TRANSIT) {
        updates.etaMinutes = Math.floor(Math.random() * 26) + 15;
      }

      const newPosting = { ...oldPosting, ...updates };
      postings[index] = newPosting;
      localStorage.setItem(STORAGE_KEY_POSTINGS, JSON.stringify(postings));

      const notifications = getStoredNotifications();
      const users = storage.getUsers();

      if (oldPosting.status !== FoodStatus.DELIVERED && newPosting.status === FoodStatus.DELIVERED) {
         // Increment impact scores
         const donorIndex = users.findIndex(u => u.id === newPosting.donorId);
         const volunteerIndex = users.findIndex(u => u.id === newPosting.volunteerId);
         
         if (donorIndex !== -1) {
           users[donorIndex].impactScore = (users[donorIndex].impactScore || 0) + 1;
         }
         if (volunteerIndex !== -1) {
           users[volunteerIndex].impactScore = (users[volunteerIndex].impactScore || 0) + 1;
         }
         localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));

         notifications.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: newPosting.donorId,
          message: `Success! Your donation "${newPosting.foodName}" was delivered. Impact +1!`,
          isRead: false,
          createdAt: Date.now(),
          type: 'SUCCESS'
        });

        if (newPosting.volunteerId) {
             notifications.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: newPosting.volunteerId,
              message: `Fantastic work! Delivery verified for ${newPosting.foodName}. Impact +1!`,
              isRead: false,
              createdAt: Date.now(),
              type: 'SUCCESS'
            });
        }
      }

      // Handle Ratings
      if (updates.ratings && updates.ratings.length > (oldPosting.ratings?.length || 0)) {
         // A new rating was added
         const newRating = updates.ratings[updates.ratings.length - 1]; // Assume newly added is last
         if (newPosting.volunteerId) {
             const vIndex = users.findIndex(u => u.id === newPosting.volunteerId);
             if (vIndex !== -1) {
                 const vol = users[vIndex];
                 const currentTotal = (vol.averageRating || 0) * (vol.ratingsCount || 0);
                 const newCount = (vol.ratingsCount || 0) + 1;
                 vol.ratingsCount = newCount;
                 vol.averageRating = parseFloat(((currentTotal + newRating.rating) / newCount).toFixed(1));
                 users[vIndex] = vol;
                 localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
             }
         }
      }

      saveStoredNotifications(notifications);
      return newPosting;
    }
    return null;
  }
};
