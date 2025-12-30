
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
  password?: string; // Added password field
  role: UserRole;
  address?: Address;
  orgCategory?: string;
  orgName?: string;
  favoriteRequesterIds?: string[];
  impactScore?: number; // Total successful deliveries/donations
  averageRating?: number;
  ratingsCount?: number;
}

export interface ChatMessage {
  id: string;
  postingId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: number;
}

export interface Rating {
  raterId: string;
  raterRole: UserRole;
  rating: number; // 1-5
  feedback?: string;
  createdAt: number;
}

export interface FoodPosting {
  id: string;
  donorId: string;
  donorName: string;
  donorOrg?: string; // Added donor organization
  foodName: string;
  quantity: string;
  location: Address;
  expiryDate: string;
  status: FoodStatus;
  imageUrl?: string;
  foodTags?: string[]; // New: Veg, Non-Veg, etc.
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
  interestedVolunteers?: { userId: string; userName: string }[]; // New: Track interested volunteers
  etaMinutes?: number;
  isPickedUp?: boolean; // New: Track if volunteer has picked up food
  pickupVerificationImageUrl?: string; // New: Proof of pickup
  verificationImageUrl?: string; // New: Proof of delivery
  ratings?: Rating[]; // New: Volunteer ratings
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
