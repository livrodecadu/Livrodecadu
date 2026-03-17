/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  where, 
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  UserProfile, 
  Business, 
  Story, 
  Review, 
  Booking, 
  UserRole, 
  BusinessCategory 
} from './types';
import { 
  MapPin, 
  Star, 
  Calendar, 
  Info, 
  MessageSquare, 
  Plus, 
  User as UserIcon, 
  LogOut, 
  Settings, 
  Camera,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  Clock,
  Phone,
  ExternalLink,
  Home,
  Heart,
  Map as MapIcon,
  LayoutGrid
} from 'lucide-react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow,
  useAdvancedMarkerRef
} from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Utility ---
function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setHasError(true);
      setError(e.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <X size={32} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">Ops! Algo deu errado</h2>
          <p className="text-stone-600 mb-6">
            Ocorreu um erro inesperado. Por favor, recarregue a página ou tente novamente mais tarde.
          </p>
          {error && (
            <pre className="text-xs bg-stone-100 p-4 rounded-lg overflow-auto text-left mb-6 max-h-40">
              {error.message}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-stone-900 text-white rounded-xl py-3 font-medium hover:bg-stone-800 transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const StoryCircle = ({ business, stories, onClick }: { business: Business, stories: Story[], onClick: () => void }) => {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center space-y-1 shrink-0 group"
    >
      <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 group-hover:scale-105 transition-transform">
        <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-stone-200">
          <img 
            src={business.mainImage || `https://picsum.photos/seed/${business.id}/200`} 
            alt={business.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
      <span className="text-[10px] font-medium text-stone-600 truncate w-20 text-center">
        {business.name}
      </span>
    </button>
  );
};

const BusinessCard = ({ business, onClick, isFavorite, onToggleFavorite }: { 
  business: Business, 
  onClick: () => void,
  isFavorite?: boolean,
  onToggleFavorite?: (e: React.MouseEvent) => void
}) => {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-stone-100 relative"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img 
          src={business.mainImage || `https://picsum.photos/seed/${business.id}/600/400`} 
          alt={business.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={cn(
            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            business.isPaid ? "bg-stone-900 text-white" : "bg-emerald-500 text-white"
          )}>
            {business.isPaid ? "Pago" : "Gratuito"}
          </span>
          <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/90 text-stone-900 backdrop-blur-sm">
            {business.category}
          </span>
        </div>
        
        {onToggleFavorite && (
          <button 
            onClick={onToggleFavorite}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm text-stone-900 hover:text-red-500 transition-colors z-10"
          >
            <Heart size={16} className={cn(isFavorite && "fill-red-500 text-red-500")} />
          </button>
        )}

        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-bold text-stone-900">{business.rating.toFixed(1)}</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-serif font-bold text-stone-900 mb-1 group-hover:text-amber-600 transition-colors">
          {business.name}
        </h3>
        <div className="flex items-center gap-1 text-stone-500 text-xs mb-2">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{business.address}</span>
        </div>
        <p className="text-stone-600 text-sm line-clamp-2 mb-4">
          {business.description}
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-stone-50">
          <span className="text-stone-400 text-xs">{business.priceRange}</span>
          <div className="flex items-center gap-1 text-amber-600 font-medium text-sm">
            Ver detalhes <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const BottomNav = ({ activeView, setView, setActiveCategory, activeCategory }: { 
  activeView: string, 
  setView: (v: any) => void,
  setActiveCategory: (c: any) => void,
  activeCategory: string
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 px-2 py-3 flex justify-between items-center z-50">
      <button 
        onClick={() => { setView('home'); setActiveCategory('all'); }}
        className={cn("flex flex-col items-center gap-1 flex-1", activeView === 'home' && activeCategory === 'all' ? "text-amber-600" : "text-stone-400")}
      >
        <Home size={20} />
        <span className="text-[10px] font-medium">Home</span>
      </button>
      <button 
        onClick={() => { setView('home'); setActiveCategory('turismo'); }}
        className={cn("flex flex-col items-center gap-1 flex-1", activeView === 'home' && activeCategory === 'turismo' ? "text-amber-600" : "text-stone-400")}
      >
        <Camera size={20} />
        <span className="text-[10px] font-medium">Turismo</span>
      </button>
      <button 
        onClick={() => { setView('home'); setActiveCategory('gastronomia'); }}
        className={cn("flex flex-col items-center gap-1 flex-1", activeView === 'home' && activeCategory === 'gastronomia' ? "text-amber-600" : "text-stone-400")}
      >
        <Star size={20} />
        <span className="text-[10px] font-medium">Comer</span>
      </button>
      <button 
        onClick={() => setView('favorites')}
        className={cn("flex flex-col items-center gap-1 flex-1", activeView === 'favorites' ? "text-amber-600" : "text-stone-400")}
      >
        <Heart size={20} />
        <span className="text-[10px] font-medium">Favoritos</span>
      </button>
      <button 
        onClick={() => setView('profile')}
        className={cn("flex flex-col items-center gap-1 flex-1", activeView === 'profile' ? "text-amber-600" : "text-stone-400")}
      >
        <UserIcon size={20} />
        <span className="text-[10px] font-medium">Perfil</span>
      </button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [activeStoryBusiness, setActiveStoryBusiness] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<BusinessCategory | 'all'>('all');
  const [view, setView] = useState<'home' | 'profile' | 'admin' | 'business' | 'favorites'>('home');
  const [showMap, setShowMap] = useState(false);

  // --- Auth & Profile ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          // Auto-grant admin to the owner email
          if (firebaseUser.email === 'livrodecadu@gmail.com' && profile.role !== 'admin') {
            const updatedProfile = { ...profile, role: 'admin' as UserRole };
            await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(profile);
          }
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Usuário',
            photoURL: firebaseUser.photoURL || '',
            role: firebaseUser.email === 'livrodecadu@gmail.com' ? 'admin' : 'user',
            favorites: [],
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!isAuthReady) return;

    const businessesQuery = query(collection(db, 'businesses'), orderBy('createdAt', 'desc'));
    const unsubscribeBusinesses = onSnapshot(businessesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
      setBusinesses(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'businesses'));

    const storiesQuery = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribeStories = onSnapshot(storiesQuery, (snapshot) => {
      const now = new Date();
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Story))
        .filter(story => isAfter(parseISO(story.expiresAt), now));
      setStories(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'stories'));

    return () => {
      unsubscribeBusinesses();
      unsubscribeStories();
    };
  }, [isAuthReady]);

  // --- Connection Test ---
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('home');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleFavorite = async (businessId: string) => {
    if (!userProfile) {
      handleLogin();
      return;
    }
    const favorites = userProfile.favorites || [];
    const newFavorites = favorites.includes(businessId)
      ? favorites.filter(id => id !== businessId)
      : [...favorites, businessId];
    
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        favorites: newFavorites
      });
      setUserProfile({ ...userProfile, favorites: newFavorites });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    }
  };

  const filteredBusinesses = useMemo(() => {
    let result = businesses;
    
    if (view === 'favorites') {
      const favoriteIds = userProfile?.favorites || [];
      result = result.filter(b => favoriteIds.includes(b.id));
    }

    if (activeCategory !== 'all') {
      result = result.filter(b => b.category === activeCategory);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => 
        b.name.toLowerCase().includes(q) || 
        b.description.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [businesses, searchQuery, activeCategory, view, userProfile?.favorites]);

  const businessesWithStories = useMemo(() => {
    const ids = new Set(stories.map(s => s.businessId));
    return businesses.filter(b => ids.has(b.id));
  }, [businesses, stories]);

  const categories: { id: BusinessCategory | 'all', label: string }[] = [
    { id: 'all', label: 'Tudo' },
    { id: 'turismo', label: 'Turismo' },
    { id: 'gastronomia', label: 'Gastronomia' },
    { id: 'servicos', label: 'Serviços' },
    { id: 'comercio', label: 'Comércio' },
  ];

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-500 font-medium animate-pulse">Carregando Guia Local...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-amber-100 selection:text-amber-900">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => { setView('home'); setSelectedBusiness(null); }}
            >
              <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
                <MapPin className="text-white w-6 h-6" />
              </div>
              <h1 className="text-xl font-serif font-bold tracking-tight">
                Guia<span className="text-amber-600">Local</span>
              </h1>
            </div>

            <div className="hidden md:flex items-center gap-6">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setView('home');
                    setSelectedBusiness(null);
                  }}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    activeCategory === cat.id ? "text-amber-600" : "text-stone-500 hover:text-stone-900"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-bold text-stone-900">{userProfile?.displayName}</p>
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">{userProfile?.role}</p>
                  </div>
                  <div className="relative group">
                    <button className="w-10 h-10 rounded-full overflow-hidden border-2 border-stone-100 hover:border-amber-500 transition-colors">
                      <img 
                        src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName}`} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2">
                      {userProfile?.role === 'admin' && (
                        <button 
                          onClick={() => setView('admin')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 rounded-lg"
                        >
                          <Settings size={16} /> Painel Admin
                        </button>
                      )}
                      {userProfile?.role === 'business' && (
                        <button 
                          onClick={() => setView('business')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 rounded-lg"
                        >
                          <Camera size={16} /> Meus Stories
                        </button>
                      )}
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <LogOut size={16} /> Sair
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="bg-stone-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-stone-800 transition-all flex items-center gap-2"
                >
                  <UserIcon size={16} /> Entrar
                </button>
              )}
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {selectedBusiness ? (
            <BusinessProfileView 
              business={selectedBusiness} 
              onBack={() => setSelectedBusiness(null)}
              user={userProfile}
            />
          ) : view === 'admin' ? (
            <AdminDashboard 
              onBack={() => setView('home')} 
              businesses={businesses}
              user={userProfile!}
            />
          ) : view === 'business' ? (
            <BusinessDashboard 
              onBack={() => setView('home')} 
              businesses={businesses.filter(b => b.ownerUid === user?.uid)}
              user={userProfile!}
            />
          ) : view === 'profile' ? (
            <ProfileView 
              user={userProfile} 
              onLogout={handleLogout} 
              onLogin={handleLogin}
              onBack={() => setView('home')} 
            />
          ) : view === 'favorites' ? (
            <section>
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setView('home')}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <h1 className="text-3xl font-serif font-bold text-stone-900">Meus Favoritos</h1>
              </div>
              
              {filteredBusinesses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBusinesses.map(business => (
                    <BusinessCard 
                      key={business.id} 
                      business={business} 
                      onClick={() => setSelectedBusiness(business)}
                      isFavorite={userProfile?.favorites?.includes(business.id)}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        toggleFavorite(business.id);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
                  <Heart className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-stone-900 mb-2">Nenhum favorito ainda</h3>
                  <p className="text-stone-500 mb-6">Explore a cidade e salve seus lugares preferidos!</p>
                  <button 
                    onClick={() => setView('home')}
                    className="bg-stone-900 text-white px-6 py-2 rounded-xl font-medium"
                  >
                    Explorar Itaúna
                  </button>
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Stories Section */}
              {businessesWithStories.length > 0 && (
                <section className="mb-12">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-serif font-bold flex items-center gap-2">
                      <Camera className="text-amber-600" size={20} />
                      Acontecendo Agora
                    </h2>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {businessesWithStories.map(b => (
                      <StoryCircle 
                        key={b.id} 
                        business={b} 
                        stories={stories.filter(s => s.businessId === b.id)}
                        onClick={() => setActiveStoryBusiness(b.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Hero / Search */}
              <section className="mb-12 text-center max-w-2xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4 leading-tight">
                  Descubra o melhor da <br />
                  <span className="text-amber-600 italic">nossa região</span>
                </h2>
                <p className="text-stone-500 mb-8">
                  Encontre pontos turísticos, gastronomia local e serviços essenciais. 
                  Tudo o que você precisa para aproveitar sua cidade ao máximo.
                </p>
                <div className="relative max-w-lg mx-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                  <input 
                    type="text"
                    placeholder="O que você está procurando?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>
              </section>

              {/* Filters & View Toggle */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex flex-wrap gap-2 justify-center">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        activeCategory === cat.id 
                          ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" 
                          : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-stone-200 shadow-sm">
                  <button 
                    onClick={() => setShowMap(false)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      !showMap ? "bg-stone-100 text-stone-900" : "text-stone-500 hover:text-stone-900"
                    )}
                  >
                    <LayoutGrid size={16} /> Grade
                  </button>
                  <button 
                    onClick={() => setShowMap(true)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      showMap ? "bg-stone-100 text-stone-900" : "text-stone-500 hover:text-stone-900"
                    )}
                  >
                    <MapIcon size={16} /> Mapa
                  </button>
                </div>
              </div>

              {/* Main Content: Grid or Map */}
              {showMap ? (
                <MapView 
                  businesses={filteredBusinesses} 
                  onSelectBusiness={(b) => setSelectedBusiness(b)} 
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {filteredBusinesses.map(business => (
                      <BusinessCard 
                        key={business.id} 
                        business={business} 
                        onClick={() => setSelectedBusiness(business)}
                        isFavorite={userProfile?.favorites?.includes(business.id)}
                        onToggleFavorite={(e) => {
                          e.stopPropagation();
                          toggleFavorite(business.id);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {filteredBusinesses.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={32} className="text-stone-300" />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">Nenhum resultado encontrado</h3>
                  <p className="text-stone-500 mb-6">Tente buscar por outros termos ou categorias.</p>
                  
                  {businesses.length === 0 && userProfile?.role === 'admin' && (
                    <button 
                      onClick={() => setView('admin')}
                      className="bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2 mx-auto"
                    >
                      <Plus size={20} /> Semear Dados Iniciais
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Story Modal */}
        <AnimatePresence>
          {activeStoryBusiness && (
            <StoryModal 
              business={businesses.find(b => b.id === activeStoryBusiness)!}
              stories={stories.filter(s => s.businessId === activeStoryBusiness)}
              onClose={() => setActiveStoryBusiness(null)}
            />
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="bg-stone-900 text-stone-400 py-12 mt-20 mb-20 md:mb-0">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
                    <MapPin className="text-white w-5 h-5" />
                  </div>
                  <h1 className="text-xl font-serif font-bold text-white tracking-tight">
                    Guia<span className="text-amber-600">Local</span>
                  </h1>
                </div>
                <p className="max-w-sm mb-6">
                  O guia definitivo da nossa cidade. Conectando moradores e turistas às melhores experiências locais.
                </p>
                <div className="flex gap-4">
                  {/* Social icons placeholder */}
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center hover:bg-amber-600 transition-colors cursor-pointer">
                    <Camera size={18} className="text-white" />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-widest">Categorias</h4>
                <ul className="space-y-4 text-sm">
                  <li><button className="hover:text-white transition-colors">Turismo</button></li>
                  <li><button className="hover:text-white transition-colors">Gastronomia</button></li>
                  <li><button className="hover:text-white transition-colors">Serviços</button></li>
                  <li><button className="hover:text-white transition-colors">Comércio</button></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-widest">Para Empresas</h4>
                <ul className="space-y-4 text-sm">
                  <li><button className="hover:text-white transition-colors">Anuncie Aqui</button></li>
                  <li><button className="hover:text-white transition-colors">Painel do Parceiro</button></li>
                  <li><button className="hover:text-white transition-colors">Suporte</button></li>
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
              <p>© 2026 Guia Local Premium. Todos os direitos reservados.</p>
              <div className="flex gap-6">
                <button className="hover:text-white transition-colors">Privacidade</button>
                <button className="hover:text-white transition-colors">Termos</button>
              </div>
            </div>
          </div>
        </footer>

        <BottomNav activeView={view} setView={setView} setActiveCategory={setActiveCategory} activeCategory={activeCategory} />
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Views ---

function MapView({ businesses, onSelectBusiness }: { businesses: Business[], onSelectBusiness: (b: Business) => void }) {
  const center = { lat: -20.075, lng: -44.85 }; // Itaúna Center
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="h-[500px] w-full rounded-3xl bg-stone-100 flex items-center justify-center border border-stone-200 mb-12 p-8 text-center">
        <div>
          <MapIcon size={48} className="mx-auto mb-4 text-stone-300" />
          <p className="text-stone-500 font-medium">Chave da API do Google Maps não configurada.</p>
          <p className="text-xs text-stone-400 mt-2">Por favor, adicione VITE_GOOGLE_MAPS_API_KEY ao seu arquivo .env</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="h-[500px] w-full rounded-3xl overflow-hidden border border-stone-200 shadow-xl z-10 mb-12"
      >
        <Map
          defaultCenter={center}
          defaultZoom={14}
          mapId="DEMO_MAP_ID" // Required for AdvancedMarker
          disableDefaultUI={true}
          zoomControl={true}
        >
          {businesses.filter(b => b.location).map(business => (
            <BusinessMarker 
              key={business.id} 
              business={business} 
              onSelect={onSelectBusiness} 
            />
          ))}
        </Map>
      </motion.div>
    </APIProvider>
  );
}

function BusinessMarker({ business, onSelect }: { business: Business, onSelect: (b: Business) => void }) {
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: business.location!.lat, lng: business.location!.lng }}
        onClick={() => setOpen(true)}
        title={business.name}
      >
        <Pin background={'#d97706'} borderColor={'#78350f'} glyphColor={'#fff'} />
      </AdvancedMarker>

      {open && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setOpen(false)}
        >
          <div className="p-1 min-w-[180px] max-w-[220px]">
            <img 
              src={business.mainImage} 
              alt={business.name} 
              className="w-full h-24 object-cover rounded-lg mb-2"
              referrerPolicy="no-referrer"
            />
            <h3 className="font-serif font-bold text-stone-900 text-sm mb-1 leading-tight">{business.name}</h3>
            <div className="flex items-center gap-1 text-amber-500 mb-2">
              <Star size={10} className="fill-amber-500" />
              <span className="text-[10px] font-bold">{business.rating}</span>
            </div>
            <button 
              onClick={() => onSelect(business)}
              className="w-full py-2 bg-stone-900 text-white text-[10px] font-bold rounded-lg hover:bg-stone-800 transition-colors flex items-center justify-center gap-1"
            >
              Ver Detalhes <ArrowRight size={10} />
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function ProfileView({ user, onLogout, onLogin, onBack }: { user: UserProfile | null, onLogout: () => void, onLogin: () => void, onBack: () => void }) {
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'reviews'), where('userUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviewCount(snapshot.size);
    });
    return unsubscribe;
  }, [user?.uid]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <UserIcon size={32} className="text-stone-300" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">Acesse seu perfil</h2>
        <p className="text-stone-500 mb-8">Faça login para salvar favoritos, avaliar locais e gerenciar suas reservas.</p>
        <button 
          onClick={onLogin}
          className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
        >
          <UserIcon size={20} /> Entrar com Google
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-stone-100 mb-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-stone-50 mb-4 shadow-lg">
            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-900">{user.displayName}</h2>
          <p className="text-stone-500">{user.email}</p>
          <div className="mt-4 px-3 py-1 bg-stone-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-stone-600">
            {user.role === 'admin' ? 'Administrador' : user.role === 'business' ? 'Parceiro' : 'Explorador'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-stone-50 p-4 rounded-2xl text-center">
            <p className="text-2xl font-bold text-stone-900">{user.favorites?.length || 0}</p>
            <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">Favoritos</p>
          </div>
          <div className="bg-stone-50 p-4 rounded-2xl text-center">
            <p className="text-2xl font-bold text-stone-900">{reviewCount}</p>
            <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">Avaliações</p>
          </div>
        </div>

        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-4 hover:bg-stone-50 rounded-2xl transition-colors border border-stone-100">
            <div className="flex items-center gap-3">
              <Settings size={20} className="text-stone-400" />
              <span className="font-medium">Configurações da Conta</span>
            </div>
            <ChevronRight size={18} className="text-stone-300" />
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 rounded-2xl transition-colors border border-red-100 text-red-600"
          >
            <div className="flex items-center gap-3">
              <LogOut size={20} />
              <span className="font-medium">Sair da Conta</span>
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function BusinessProfileView({ business, onBack, user }: { business: Business, onBack: () => void, user: UserProfile | null }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), where('businessId', '==', business.id), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
    });
    return unsubscribe;
  }, [business.id]);

  const handleAddReview = async () => {
    if (!user) return alert('Você precisa estar logado para avaliar.');
    if (!newReview.comment.trim()) return;

    setIsSubmitting(true);
    try {
      const review: Omit<Review, 'id'> = {
        businessId: business.id,
        userUid: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'reviews'), review);
      
      // Update business rating (simplified)
      const newReviewCount = business.reviewCount + 1;
      const newRating = ((business.rating * business.reviewCount) + newReview.rating) / newReviewCount;
      await updateDoc(doc(db, 'businesses', business.id), {
        rating: newRating,
        reviewCount: newReviewCount
      });

      setNewReview({ rating: 5, comment: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-6 transition-colors group"
      >
        <ChevronLeft className="group-hover:-translate-x-1 transition-transform" /> Voltar para o início
      </button>

      <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-100 mb-8">
        <div className="relative h-80">
          <img 
            src={business.mainImage || `https://picsum.photos/seed/${business.id}/1200/800`} 
            alt={business.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-600 text-[10px] font-bold uppercase tracking-widest">
                {business.category}
              </span>
              {business.isPaid && (
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest">
                  Atração Paga
                </span>
              )}
            </div>
            <h1 className="text-4xl font-serif font-bold mb-2">{business.name}</h1>
            <div className="flex items-center gap-4 text-sm text-stone-200">
              <div className="flex items-center gap-1">
                <MapPin size={16} /> {business.address}
              </div>
              <div className="flex items-center gap-1">
                <Star size={16} className="fill-amber-400 text-amber-400" /> 
                {business.rating.toFixed(1)} ({business.reviewCount} avaliações)
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2">
            <section className="mb-8">
              <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
                <Info className="text-amber-600" size={20} /> Sobre
              </h2>
              <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">
                {business.description}
              </p>
            </section>

            {business.curiosities.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
                  <Star className="text-amber-600" size={20} /> Curiosidades
                </h2>
                <ul className="space-y-3">
                  {business.curiosities.map((c, i) => (
                    <li key={i} className="flex gap-3 text-stone-600 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                      <div className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                        {i + 1}
                      </div>
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                <MessageSquare className="text-amber-600" size={20} /> Avaliações
              </h2>
              
              {user && (
                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 mb-8">
                  <p className="font-bold text-stone-900 mb-4">Deixe sua avaliação</p>
                  <div className="flex gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button 
                        key={star}
                        onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star 
                          size={24} 
                          className={cn(
                            star <= newReview.rating ? "fill-amber-400 text-amber-400" : "text-stone-300"
                          )} 
                        />
                      </button>
                    ))}
                  </div>
                  <textarea 
                    placeholder="O que você achou deste lugar?"
                    value={newReview.comment}
                    onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full p-4 bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 mb-4 h-24 resize-none"
                  />
                  <button 
                    onClick={handleAddReview}
                    disabled={isSubmitting}
                    className="bg-stone-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Enviando..." : "Publicar Avaliação"}
                  </button>
                </div>
              )}

              <div className="space-y-6">
                {reviews.map(review => (
                  <div key={review.id} className="flex gap-4">
                    <img 
                      src={review.userPhoto || `https://ui-avatars.com/api/?name=${review.userName}`} 
                      alt={review.userName} 
                      className="w-12 h-12 rounded-full border border-stone-100 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-stone-900">{review.userName}</p>
                        <span className="text-[10px] text-stone-400">{format(parseISO(review.createdAt), "dd MMM yyyy", { locale: ptBR })}</span>
                      </div>
                      <div className="flex gap-0.5 mb-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star 
                            key={star} 
                            size={12} 
                            className={cn(star <= review.rating ? "fill-amber-400 text-amber-400" : "text-stone-200")} 
                          />
                        ))}
                      </div>
                      <p className="text-stone-600 text-sm leading-relaxed">{review.comment}</p>
                    </div>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <p className="text-center text-stone-400 py-8">Ainda não há avaliações. Seja o primeiro!</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 sticky top-24">
              <h3 className="font-serif font-bold text-lg mb-6">Informações Úteis</h3>
              
              <div className="space-y-6">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-200 shrink-0">
                    <Phone size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Contato</p>
                    <p className="text-sm font-medium text-stone-900">{business.contact}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-200 shrink-0">
                    <Clock size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Preço</p>
                    <p className="text-sm font-medium text-stone-900">{business.priceRange}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-stone-200 shrink-0">
                    <MapPin size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Localização</p>
                    <p className="text-sm font-medium text-stone-900">{business.address}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button className="w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2">
                  <Calendar size={18} /> Fazer Reserva
                </button>
                <button className="w-full bg-white text-stone-900 border border-stone-200 py-3 rounded-xl font-bold hover:bg-stone-100 transition-all flex items-center justify-center gap-2">
                  <ExternalLink size={18} /> Ver no Mapa
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AdminDashboard({ onBack, businesses, user }: { onBack: () => void, businesses: Business[], user: UserProfile }) {
  const [isSeeding, setIsSeeding] = useState(false);

  const seedData = async () => {
    setIsSeeding(true);
    try {
      const sampleBusinesses: Omit<Business, 'id'>[] = [
        {
          ownerUid: user.uid,
          name: "Gruta de Nossa Senhora de Itaúna",
          description: "Local de profunda fé e devoção, a Gruta é um dos pontos mais visitados da cidade. Oferece uma vista panorâmica e um ambiente de paz e reflexão, marcando o local das aparições de 1955.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "R. José de Moura, s/n - Graças, Itaúna - MG",
          location: { lat: -20.0754, lng: -44.8567 },
          contact: "(37) 3241-1233",
          curiosities: ["Local das aparições de Nossa Senhora em 1955", "Possui uma fonte de água considerada milagrosa por muitos fiéis"],
          mainImage: "https://picsum.photos/seed/itauna-gruta/800/600",
          rating: 4.9,
          reviewCount: 150,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Barragem do Benfica",
          description: "Principal área de lazer aquático da região. Ideal para esportes náuticos, pesca e contemplação da natureza. Um refúgio perfeito para o final de semana com a família.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Zona Rural (Benfica), Itaúna - MG",
          location: { lat: -20.1234, lng: -44.8901 },
          contact: "(37) 3241-4545",
          curiosities: ["Abastece grande parte da cidade", "Ponto de encontro para ciclistas e praticantes de jet-ski"],
          mainImage: "https://picsum.photos/seed/benfica/800/600",
          rating: 4.7,
          reviewCount: 85,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Igreja Matriz de Sant'Ana",
          description: "Coração histórico e religioso de Itaúna. Com arquitetura imponente e interior ricamente decorado, a Matriz é o símbolo da fé itaunense no centro da cidade.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Praça Dr. Augusto Gonçalves, Centro, Itaúna - MG",
          location: { lat: -20.0745, lng: -44.8512 },
          contact: "(37) 3241-1233",
          curiosities: ["A praça em frente é o principal ponto de eventos da cidade", "Abriga obras de arte sacra centenárias"],
          mainImage: "https://picsum.photos/seed/matriz-itauna/800/600",
          rating: 4.8,
          reviewCount: 60,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Museu Municipal Francisco Manoel Franco",
          description: "Localizado na antiga estação ferroviária, o museu preserva a memória de Itaúna através de um vasto acervo de fotografias, documentos e objetos que contam a história do desenvolvimento da cidade e da ferrovia.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Praça da Estação, s/n - Centro, Itaúna - MG",
          location: { lat: -20.0723, lng: -44.8489 },
          contact: "(37) 3243-6433",
          curiosities: ["O prédio é um patrimônio histórico tombado", "Abriga o arquivo público municipal"],
          mainImage: "https://picsum.photos/seed/museu-itauna/800/600",
          rating: 4.5,
          reviewCount: 42,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Cristo Redentor (Morro do Bonfim)",
          description: "Um dos pontos mais altos da cidade, oferecendo uma vista de 360 graus de Itaúna. É um local de peregrinação religiosa e também muito procurado para contemplação do pôr do sol.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Morro do Bonfim, Itaúna - MG",
          location: { lat: -20.0812, lng: -44.8601 },
          contact: "(37) 3241-1233",
          curiosities: ["A estátua foi inaugurada na década de 80", "É visível de quase todos os pontos da cidade"],
          mainImage: "https://picsum.photos/seed/cristo-itauna/800/600",
          rating: 4.7,
          reviewCount: 78,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Teatro Municipal Silvio de Mattos",
          description: "O principal centro cultural de Itaúna, recebendo peças teatrais, shows musicais, recitais e eventos corporativos. Possui excelente acústica e infraestrutura moderna.",
          category: "turismo",
          isPaid: true,
          priceRange: "Depende do Evento",
          address: "R. Antônio Corradi, 55 - Centro, Itaúna - MG",
          location: { lat: -20.0731, lng: -44.8495 },
          contact: "(37) 3243-6425",
          curiosities: ["Homenageia um importante industrial e benfeitor da cidade", "Localizado no complexo da Biblioteca Municipal"],
          mainImage: "https://picsum.photos/seed/teatro-itauna/800/600",
          rating: 4.6,
          reviewCount: 56,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Morro do Sol",
          description: "Ponto de encontro para os amantes de esportes de aventura e natureza. Muito utilizado para a prática de voo livre (parapente) e trilhas, oferecendo um contato direto com a fauna e flora local.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Acesso via MG-431, Itaúna - MG",
          location: { lat: -20.0956, lng: -44.8789 },
          contact: "(37) 3241-1212",
          curiosities: ["Considerado um dos melhores pontos de decolagem da região", "Vista privilegiada para a Barragem do Benfica"],
          mainImage: "https://picsum.photos/seed/morro-sol/800/600",
          rating: 4.8,
          reviewCount: 34,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Cachoeira do Engenho",
          description: "Uma das poucas quedas d'água acessíveis próximas ao centro urbano. Um local rústico e preservado, ideal para quem busca um banho de rio refrescante e trilhas leves.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Estrada para Itatiaiuçu, Itaúna - MG",
          location: { lat: -20.1056, lng: -44.8345 },
          contact: "(37) 3241-1212",
          curiosities: ["Mantém ruínas de um antigo engenho de cana", "Área de preservação ambiental"],
          mainImage: "https://picsum.photos/seed/cachoeira-itauna/800/600",
          rating: 4.3,
          reviewCount: 29,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Igreja de Nossa Senhora do Rosário",
          description: "Uma das igrejas mais antigas e charmosas de Itaúna, localizada no alto de uma colina. É o centro das celebrações do Reinado (Congado), uma das tradições culturais mais fortes da cidade.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Praça do Rosário, Itaúna - MG",
          location: { lat: -20.0789, lng: -44.8567 },
          contact: "(37) 3241-1233",
          curiosities: ["Palco principal da Festa do Reinado em agosto", "Arquitetura colonial preservada"],
          mainImage: "https://picsum.photos/seed/rosario-itauna/800/600",
          rating: 4.8,
          reviewCount: 45,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Parque Ecológico de Itaúna",
          description: "Área de preservação ambiental com trilhas, lagos e espaços para lazer. Ideal para caminhadas matinais, observação de aves e piqueniques em família.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Av. Jove Soares, Itaúna - MG",
          location: { lat: -20.0712, lng: -44.8456 },
          contact: "(37) 3243-6425",
          curiosities: ["Pulmão verde no centro da cidade", "Possui equipamentos de ginástica ao ar livre"],
          mainImage: "https://picsum.photos/seed/parque-ecologico/800/600",
          rating: 4.6,
          reviewCount: 120,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Casarão da Praça Dr. Augusto Gonçalves",
          description: "Imóvel histórico que remete aos tempos áureos da produção de tecidos em Itaúna. Hoje abriga espaços culturais e preserva a fachada original do início do século XX.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Praça Dr. Augusto Gonçalves, Centro, Itaúna - MG",
          location: { lat: -20.0748, lng: -44.8515 },
          contact: "(37) 3243-6433",
          curiosities: ["Exemplo da arquitetura eclética", "Ponto de referência para fotos históricas"],
          mainImage: "https://picsum.photos/seed/casarao-itauna/800/600",
          rating: 4.4,
          reviewCount: 15,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Restaurante do Peixe",
          description: "Especializado em peixes de água doce, o restaurante é famoso pela sua traíra sem espinhos e ambiente familiar à beira da rodovia.",
          category: "gastronomia",
          isPaid: true,
          priceRange: "$$ - $$$",
          address: "MG-431, Km 45, Itaúna - MG",
          location: { lat: -20.0567, lng: -44.8234 },
          contact: "(37) 3242-1010",
          curiosities: ["Receita secreta de tempero há 30 anos", "Muito frequentado por viajantes e locais"],
          mainImage: "https://picsum.photos/seed/peixe-itauna/800/600",
          rating: 4.8,
          reviewCount: 320,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Pizzaria Di Napoli",
          description: "A melhor pizza artesanal da cidade, com massa de fermentação lenta e ingredientes importados. Ambiente aconchegante e carta de vinhos selecionada.",
          category: "gastronomia",
          isPaid: true,
          priceRange: "$$ - $$$",
          address: "R. Silva Jardim, 120, Centro, Itaúna - MG",
          location: { lat: -20.0734, lng: -44.8523 },
          contact: "(37) 3241-5050",
          curiosities: ["Forno a lenha original", "Vencedora de prêmios locais de gastronomia"],
          mainImage: "https://picsum.photos/seed/pizza-itauna/800/600",
          rating: 4.7,
          reviewCount: 215,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Café com Prosa",
          description: "Um refúgio para quem aprecia um bom café mineiro acompanhado de pão de queijo quentinho e bolos caseiros. Perfeito para reuniões de trabalho ou um lanche à tarde.",
          category: "gastronomia",
          isPaid: true,
          priceRange: "$",
          address: "R. Getúlio Vargas, 450, Centro, Itaúna - MG",
          location: { lat: -20.0765, lng: -44.8534 },
          contact: "(37) 3242-8899",
          curiosities: ["Grãos selecionados de fazendas da região", "Decoração rústica inspirada em fazendas mineiras"],
          mainImage: "https://picsum.photos/seed/cafe-itauna/800/600",
          rating: 4.9,
          reviewCount: 180,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Restaurante Tropical",
          description: "Referência em gastronomia em Itaúna, oferecendo um buffet variado com o melhor da comida mineira e pratos internacionais em um ambiente sofisticado.",
          category: "gastronomia",
          isPaid: true,
          priceRange: "R$ 60 - R$ 150",
          address: "Av. Jove Soares, 1230, Itaúna - MG",
          location: { lat: -20.0715, lng: -44.8467 },
          contact: "(37) 3242-1010",
          curiosities: ["Famoso pelo seu rodízio de carnes e buffet de sobremesas", "Localizado na 'Prainha', a avenida mais badalada da cidade"],
          mainImage: "https://picsum.photos/seed/tropical-rest/800/600",
          rating: 4.6,
          reviewCount: 210,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Shopping Pátio Itaúna",
          description: "O principal centro de compras e entretenimento da cidade. Conta com cinema, praça de alimentação completa e as melhores lojas de departamentos e marcas locais.",
          category: "comercio",
          isPaid: true,
          priceRange: "Variável",
          address: "Av. Jove Soares, 675, Centro, Itaúna - MG",
          location: { lat: -20.0701, lng: -44.8432 },
          contact: "(37) 3249-1000",
          curiosities: ["Possui as únicas salas de cinema da cidade", "Ponto de encontro preferido dos jovens nos finais de semana"],
          mainImage: "https://picsum.photos/seed/patio-itauna/800/600",
          rating: 4.4,
          reviewCount: 340,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Museu Municipal Francisco Manoel Franco",
          description: "Localizado na antiga estação ferroviária, o museu preserva a memória ferroviária e cultural de Itaúna com um acervo rico em detalhes da 'Cidade Educativa'.",
          category: "turismo",
          isPaid: false,
          priceRange: "Gratuito",
          address: "Praça da Estação, s/n, Centro, Itaúna - MG",
          location: { lat: -20.0723, lng: -44.8489 },
          contact: "(37) 3243-6433",
          curiosities: ["Funciona no prédio histórico da antiga Rede Ferroviária Federal", "Promove exposições itinerantes de artistas locais"],
          mainImage: "https://picsum.photos/seed/museu-itauna/800/600",
          rating: 4.5,
          reviewCount: 42,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Ponto do Pão (Padaria 24h)",
          description: "A padaria mais tradicional da cidade, aberta 24 horas por dia. Famosa pelo pão de queijo sempre quentinho e pelo atendimento cordial a qualquer hora.",
          category: "gastronomia",
          isPaid: true,
          priceRange: "R$ 5 - R$ 40",
          address: "Rua Silva Jardim, 50, Centro, Itaúna - MG",
          location: { lat: -20.0739, lng: -44.8518 },
          contact: "(37) 3242-2233",
          curiosities: ["Parada obrigatória após as festas na Prainha", "O pão de queijo recheado é o item mais vendido"],
          mainImage: "https://picsum.photos/seed/padaria-itauna/800/600",
          rating: 4.7,
          reviewCount: 180,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Universidade de Itaúna (UIT)",
          description: "Um dos maiores polos educacionais do estado, a UIT atrai estudantes de todo o país. Seu campus é moderno e contribui significativamente para o título de 'Cidade Educativa'.",
          category: "servicos",
          isPaid: true,
          priceRange: "Mensalidades",
          address: "Rodovia MG-431, Km 45, Itaúna - MG",
          location: { lat: -20.0567, lng: -44.8234 },
          contact: "(37) 3249-3000",
          curiosities: ["Possui um dos cursos de Medicina mais conceituados da região", "O campus conta com hospital veterinário e clínicas escola"],
          mainImage: "https://picsum.photos/seed/uit-itauna/800/600",
          rating: 4.5,
          reviewCount: 120,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Hospital Manoel Gonçalves",
          description: "Instituição de saúde centenária e referência para toda a região. O hospital é um pilar fundamental da comunidade itaunense.",
          category: "servicos",
          isPaid: false,
          priceRange: "SUS / Convênios",
          address: "Rua Dr. Diogo de Castro, 120, Centro, Itaúna - MG",
          location: { lat: -20.0756, lng: -44.8543 },
          contact: "(37) 3249-5300",
          curiosities: ["Fundado em 1904", "Recentemente passou por grandes ampliações em sua UTI"],
          mainImage: "https://picsum.photos/seed/hospital-itauna/800/600",
          rating: 4.0,
          reviewCount: 55,
          createdAt: new Date().toISOString()
        },
        {
          ownerUid: user.uid,
          name: "Parque de Exposições Pedro Calambau",
          description: "Local que abriga as maiores festas e feiras agropecuárias da cidade, como a tradicional Expo Itaúna. Espaço amplo para eventos de grande porte.",
          category: "turismo",
          isPaid: true,
          priceRange: "Depende do Evento",
          address: "Av. Gabriel da Silva Pereira, Itaúna - MG",
          location: { lat: -20.0856, lng: -44.8678 },
          contact: "(37) 3241-1212",
          curiosities: ["Palco de grandes shows nacionais", "Área verde utilizada para caminhadas em dias sem eventos"],
          mainImage: "https://picsum.photos/seed/expo-itauna/800/600",
          rating: 4.3,
          reviewCount: 90,
          createdAt: new Date().toISOString()
        }
      ];

      for (const b of sampleBusinesses) {
        const docRef = await addDoc(collection(db, 'businesses'), b);
        await updateDoc(docRef, { id: docRef.id });

        // Add a sample story for each
        const story: Omit<Story, 'id'> = {
          businessId: docRef.id,
          mediaUrl: `https://picsum.photos/seed/story-${docRef.id}/1080/1920`,
          mediaType: 'image',
          caption: `Venha conhecer o ${b.name}!`,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        const storyRef = await addDoc(collection(db, 'stories'), story);
        await updateDoc(storyRef, { id: storyRef.id });
      }
      alert('Dados semeados com sucesso!');
    } catch (error) {
      console.error('Seed error:', error);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-900">
          <ChevronLeft /> Voltar
        </button>
        <h2 className="text-2xl font-serif font-bold">Painel Administrativo</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm">
          <h3 className="text-lg font-bold mb-2">Configurações Rápidas</h3>
          <p className="text-stone-500 text-sm mb-6">Use estas ferramentas para gerenciar o conteúdo inicial do app.</p>
          <button 
            onClick={seedData}
            disabled={isSeeding}
            className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSeeding ? <Clock className="animate-spin" /> : <Plus />} Semear Dados de Exemplo
          </button>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm">
          <h3 className="text-lg font-bold mb-2">Estatísticas</h3>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-stone-50 p-4 rounded-2xl">
              <p className="text-2xl font-bold text-stone-900">{businesses.length}</p>
              <p className="text-xs text-stone-400 uppercase font-bold">Empresas</p>
            </div>
            <div className="bg-stone-50 p-4 rounded-2xl">
              <p className="text-2xl font-bold text-stone-900">0</p>
              <p className="text-xs text-stone-400 uppercase font-bold">Usuários</p>
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-serif font-bold mb-6">Gerenciar Empresas</h3>
      <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Nome</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Categoria</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {businesses.map(b => (
              <tr key={b.id}>
                <td className="px-6 py-4 font-medium">{b.name}</td>
                <td className="px-6 py-4 text-sm text-stone-500 capitalize">{b.category}</td>
                <td className="px-6 py-4">
                  <button 
                    onClick={async () => {
                      if(confirm('Tem certeza?')) {
                        await deleteDoc(doc(db, 'businesses', b.id));
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-sm font-bold"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BusinessDashboard({ onBack, businesses, user }: { onBack: () => void, businesses: Business[], user: UserProfile }) {
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [storyCaption, setStoryCaption] = useState('');

  const handleAddStory = async (businessId: string) => {
    try {
      const story: Omit<Story, 'id'> = {
        businessId,
        mediaUrl: `https://picsum.photos/seed/story-${Date.now()}/1080/1920`,
        mediaType: 'image',
        caption: storyCaption,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      const docRef = await addDoc(collection(db, 'stories'), story);
      await updateDoc(docRef, { id: docRef.id });
      setStoryCaption('');
      setIsAddingStory(false);
      alert('Story publicado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stories');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-900">
          <ChevronLeft /> Voltar
        </button>
        <h2 className="text-2xl font-serif font-bold">Painel do Parceiro</h2>
      </div>

      {businesses.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center">
          <p className="text-stone-500 mb-4">Você ainda não tem uma empresa cadastrada.</p>
          <p className="text-sm text-stone-400">Entre em contato com o administrador para vincular sua empresa.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {businesses.map(b => (
            <div key={b.id} className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <img src={b.mainImage} alt={b.name} className="w-16 h-16 rounded-2xl object-cover" />
                  <div>
                    <h3 className="text-xl font-bold">{b.name}</h3>
                    <p className="text-sm text-stone-500">{b.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingStory(true)}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-700 transition-all flex items-center gap-2"
                >
                  <Camera size={16} /> Novo Story
                </button>
              </div>

              {isAddingStory && (
                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 mb-6">
                  <h4 className="font-bold mb-4">Publicar Novo Story</h4>
                  <input 
                    type="text" 
                    placeholder="Legenda do story..."
                    value={storyCaption}
                    onChange={(e) => setStoryCaption(e.target.value)}
                    className="w-full p-3 bg-white border border-stone-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAddStory(b.id)}
                      className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-bold"
                    >
                      Publicar
                    </button>
                    <button 
                      onClick={() => setIsAddingStory(false)}
                      className="text-stone-500 px-4 py-2 text-sm font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-xl font-bold">{b.rating.toFixed(1)}</p>
                  <p className="text-[10px] uppercase font-bold text-stone-400">Avaliação</p>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-xl font-bold">{b.reviewCount}</p>
                  <p className="text-[10px] uppercase font-bold text-stone-400">Comentários</p>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-xl font-bold">0</p>
                  <p className="text-[10px] uppercase font-bold text-stone-400">Reservas</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoryModal({ business, stories, onClose }: { business: Business, stories: Story[], onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStory = stories[currentIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onClose();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentIndex, stories.length, onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-0 md:p-4"
    >
      <div className="relative w-full max-w-md aspect-[9/16] bg-stone-900 rounded-none md:rounded-3xl overflow-hidden shadow-2xl">
        {/* Progress Bars */}
        <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
          {stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: i === currentIndex ? '100%' : i < currentIndex ? '100%' : '0%' }}
                transition={{ duration: i === currentIndex ? 5 : 0, ease: 'linear' }}
                className="h-full bg-white"
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
              <img src={business.mainImage} alt={business.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <p className="text-white font-bold text-sm shadow-sm">{business.name}</p>
              <p className="text-white/60 text-[10px] shadow-sm">{format(parseISO(currentStory.createdAt), "HH:mm", { locale: ptBR })}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:scale-110 transition-transform">
            <X size={24} />
          </button>
        </div>

        {/* Media */}
        <div className="absolute inset-0 flex items-center justify-center">
          {currentStory.mediaType === 'video' ? (
            <video 
              src={currentStory.mediaUrl} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover"
            />
          ) : (
            <img 
              src={currentStory.mediaUrl} 
              alt="Story" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-12 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-20">
            <p className="text-white text-sm text-center leading-relaxed">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Navigation Areas */}
        <div className="absolute inset-0 flex z-10">
          <div 
            className="flex-1 cursor-pointer" 
            onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} 
          />
          <div 
            className="flex-1 cursor-pointer" 
            onClick={() => currentIndex < stories.length - 1 ? setCurrentIndex(currentIndex + 1) : onClose()} 
          />
        </div>
      </div>
    </motion.div>
  );
}
