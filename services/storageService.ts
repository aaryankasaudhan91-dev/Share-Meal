
import { User, FoodPosting, FoodStatus, UserRole, Notification } from '../types';

const STORAGE_KEY_POSTINGS = 'food_rescue_postings';
const STORAGE_KEY_USERS = 'food_rescue_users';
const STORAGE_KEY_NOTIFICATIONS = 'food_rescue_notifications';

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
    users.push(user);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  },
  getPostings: (): FoodPosting[] => {
    const data = localStorage.getItem(STORAGE_KEY_POSTINGS);
    return data ? JSON.parse(data) : [];
  },
  
  // Notification Methods
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

    // Notify Volunteers about new food
    const users = storage.getUsers();
    const notifications = getStoredNotifications();
    
    users.forEach(u => {
      if (u.role === UserRole.VOLUNTEER) {
        notifications.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: u.id,
          message: `New food donation available: ${posting.foodName} near ${posting.location.landmark || posting.location.pincode}`,
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
      const newPosting = { ...oldPosting, ...updates };
      postings[index] = newPosting;
      localStorage.setItem(STORAGE_KEY_POSTINGS, JSON.stringify(postings));

      // Notification Logic
      const notifications = getStoredNotifications();
      const users = storage.getUsers();

      // Case 1: Status changed to REQUESTED (Needs Volunteer)
      if (oldPosting.status !== FoodStatus.REQUESTED && newPosting.status === FoodStatus.REQUESTED) {
        users.forEach(u => {
          if (u.role === UserRole.VOLUNTEER) {
            notifications.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: u.id,
              message: `Pickup requested: ${newPosting.foodName} from ${newPosting.donorName}`,
              isRead: false,
              createdAt: Date.now(),
              type: 'ACTION'
            });
          }
        });
      }

      // Case 2: Volunteer Assigned (Status -> IN_TRANSIT)
      if (oldPosting.status !== FoodStatus.IN_TRANSIT && newPosting.status === FoodStatus.IN_TRANSIT && newPosting.volunteerId) {
        // Notify Volunteer (Confirmation)
        notifications.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: newPosting.volunteerId,
          message: `You accepted the pickup for ${newPosting.foodName}`,
          isRead: false,
          createdAt: Date.now(),
          type: 'SUCCESS'
        });

        // Notify Donor
        notifications.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: newPosting.donorId,
          message: `${newPosting.volunteerName} is picking up ${newPosting.foodName}`,
          isRead: false,
          createdAt: Date.now(),
          type: 'INFO'
        });

        // Notify Requester
        if (newPosting.orphanageId) {
          notifications.push({
            id: Math.random().toString(36).substr(2, 9),
            userId: newPosting.orphanageId,
            message: `${newPosting.volunteerName} is bringing ${newPosting.foodName}`,
            isRead: false,
            createdAt: Date.now(),
            type: 'INFO'
          });
        }
      }

      // Case 3: Delivered (Status -> DELIVERED)
      if (oldPosting.status !== FoodStatus.DELIVERED && newPosting.status === FoodStatus.DELIVERED) {
         // Notify Donor
         notifications.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: newPosting.donorId,
          message: `Delivery Complete: ${newPosting.foodName} has reached its destination!`,
          isRead: false,
          createdAt: Date.now(),
          type: 'SUCCESS'
        });

        // Notify Volunteer
        if (newPosting.volunteerId) {
             notifications.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: newPosting.volunteerId,
              message: `Delivery confirmed for ${newPosting.foodName}. Great job!`,
              isRead: false,
              createdAt: Date.now(),
              type: 'SUCCESS'
            });
        }

        // Notify Requester
        if (newPosting.orphanageId) {
          notifications.push({
            id: Math.random().toString(36).substr(2, 9),
            userId: newPosting.orphanageId,
            message: `Delivery Arrived: ${newPosting.foodName} is here.`,
            isRead: false,
            createdAt: Date.now(),
            type: 'SUCCESS'
          });
        }
      }

      saveStoredNotifications(notifications);
      return newPosting;
    }
    return null;
  }
};
