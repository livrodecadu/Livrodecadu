export type UserRole = 'admin' | 'business' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  favorites?: string[];
  createdAt: string;
}

export type BusinessCategory = 'turismo' | 'gastronomia' | 'servicos' | 'comercio';

export interface Business {
  id: string;
  ownerUid: string;
  name: string;
  description: string;
  category: BusinessCategory;
  isPaid: boolean;
  priceRange: string;
  address: string;
  location?: { lat: number; lng: number };
  contact: string;
  curiosities: string[];
  mainImage: string;
  rating: number;
  reviewCount: number;
  createdAt: string;
}

export interface Story {
  id: string;
  businessId: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  caption?: string;
  createdAt: string;
  expiresAt: string;
}

export interface Review {
  id: string;
  businessId: string;
  userUid: string;
  userName: string;
  userPhoto: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  businessId: string;
  userUid: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes: string;
  createdAt: string;
}
