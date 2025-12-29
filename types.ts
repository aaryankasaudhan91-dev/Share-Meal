
export enum UserRole {
  DONOR = 'DONOR',
  VOLUNTEER = 'VOLUNTEER',
  REQUESTER = 'REQUESTER'
}

export enum FoodStatus {
  AVAILABLE = 'AVAILABLE',
  REQUESTED = 'REQUESTED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED'
}

export interface Address {
  line1: string;
  line2: string;
  landmark?: string;
  pincode: string;
  lat?: number;
  lng?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  address?: Address;
  orgCategory?: string;
  orgName?: string;
  favoriteRequesterIds?: string[];
}

export interface FoodPosting {
  id: string;
  donorId: string;
  donorName: string;
  foodName: string;
  quantity: string;
  location: Address;
  expiryDate: string;
  status: FoodStatus;
  imageUrl?: string;
  safetyVerdict?: {
    isSafe: boolean;
    reasoning: string;
  };
  orphanageId?: string;
  orphanageName?: string;
  requesterAddress?: Address;
  volunteerId?: string;
  volunteerName?: string;
  volunteerLocation?: { lat: number; lng: number };
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: number;
  type: 'INFO' | 'ACTION' | 'SUCCESS';
}
