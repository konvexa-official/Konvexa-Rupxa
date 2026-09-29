/**
 * Konvexa Rupxa Authentication Context
 * Powered by Firebase Authentication and Cloud Firestore.
 * Supports Google Sign-In with popup, Email/Password auth, and persistent user profiles.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured, testFirestoreConnection } from '../lib/firebase';
import { getProfile, createOrUpdateProfile } from '../lib/db';
import { Profile } from '../types';
import { normalizePhoneNumber } from '../lib/formatters';

interface AuthContextType {
  user: Profile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isConfigured: boolean;
  signup: (params: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemoUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileData: (updates: { fullName?: string; phone?: string; avatarUrl?: string }) => Promise<void>;
  updateProfile: (updates: { full_name?: string; fullName?: string; phone?: string; avatar_url?: string; avatarUrl?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = 'rupxa_active_session_v1';

export const DEV_DEFAULT_USER: Profile = {
  id: 'usr_konvexa_dev',
  full_name: 'Konvexa User',
  email: 'hello.konvexa@gmail.com',
  phone: '9876543210',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    let mounted = true;

    // Run connection test as required by Firebase skill
    testFirestoreConnection().catch((err) => {
      console.warn('Initial Firestore connection check notice:', err);
    });

    if (isConfigured && auth) {
      // Listen to Firebase Auth state
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!mounted) return;

        setFirebaseUser(fbUser);

        if (fbUser) {
          try {
            // Retrieve profile from Firestore
            const existingProfile = await getProfile(fbUser.uid);
            if (existingProfile) {
              if (mounted) setUser(existingProfile);
            } else {
              // Create profile in Firestore for new user
              const newProf = await createOrUpdateProfile({
                id: fbUser.uid,
                full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                email: (fbUser.email || '').toLowerCase().trim(),
                phone: fbUser.phoneNumber || '',
                avatar_url: fbUser.photoURL || null,
              });
              if (mounted) setUser(newProf);
            }
          } catch (err) {
            console.error('Error syncing user profile from Firestore:', err);
            // Create fallback profile from auth user details
            if (mounted) {
              setUser({
                id: fbUser.uid,
                full_name: fbUser.displayName || 'User',
                email: fbUser.email || '',
                phone: fbUser.phoneNumber || '',
                avatar_url: fbUser.photoURL || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        } else {
          // Check local stored session fallback
          const localStored = localStorage.getItem(LOCAL_SESSION_KEY);
          if (localStored) {
            try {
              const parsed = JSON.parse(localStored);
              if (parsed?.id) {
                const prof = await getProfile(parsed.id);
                if (mounted) setUser(prof || DEV_DEFAULT_USER);
              } else {
                if (mounted) setUser(null);
              }
            } catch {
              if (mounted) setUser(null);
            }
          } else {
            if (mounted) setUser(null);
          }
        }

        if (mounted) setLoading(false);
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } else {
      // Fallback local mode
      const localStored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (localStored) {
        try {
          const parsed = JSON.parse(localStored);
          setUser(parsed);
        } catch {
          setUser(DEV_DEFAULT_USER);
        }
      } else {
        setUser(DEV_DEFAULT_USER);
      }
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
  }, [isConfigured]);

  const signup = async (params: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }) => {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(params.phone);
    const cleanName = params.fullName.trim();

    if (!cleanName) throw new Error('Full name is required.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Valid email address is required.');
    if (!cleanPhone || cleanPhone.length < 10) throw new Error('Valid 10-digit phone number is required.');
    if (!params.password) throw new Error('Password is required.');
    if (params.password.length < 6) throw new Error('Password must be at least 6 characters long.');
    if (params.password !== params.confirmPassword) throw new Error('Passwords do not match.');

    if (isConfigured && auth) {
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      if (userCred.user) {
        // Update display name in Firebase Auth
        await updateFirebaseProfile(userCred.user, {
          displayName: cleanName,
        });

        // Persist profile in Firestore
        const prof = await createOrUpdateProfile({
          id: userCred.user.uid,
          full_name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          avatar_url: null,
        });
        setUser(prof);
      }
      return;
    }

    // Local fallback
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newProf = await createOrUpdateProfile({
      id: userId,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      avatar_url: null,
    });
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(newProf));
    setUser(newProf);
  };

  const login = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('Email is required.');
    if (!password) throw new Error('Password is required.');

    if (isConfigured && auth) {
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      if (userCred.user) {
        const prof = await getProfile(userCred.user.uid);
        if (prof) {
          setUser(prof);
        } else {
          const newProf = await createOrUpdateProfile({
            id: userCred.user.uid,
            full_name: userCred.user.displayName || cleanEmail.split('@')[0],
            email: cleanEmail,
            phone: userCred.user.phoneNumber || '',
          });
          setUser(newProf);
        }
      }
      return;
    }

    // Local fallback
    const profiles = JSON.parse(localStorage.getItem('rupxa_profiles_v1') || '[]') as Profile[];
    const matched = profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (!matched) {
      throw new Error('Invalid email or password. Please check your credentials or create a new account.');
    }
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(matched));
    setUser(matched);
  };

  const loginWithGoogle = async () => {
    if (!isConfigured || !auth) {
      throw new Error('Firebase Auth is not configured.');
    }

    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        const existing = await getProfile(res.user.uid);
        if (existing) {
          setUser(existing);
        } else {
          const newProf = await createOrUpdateProfile({
            id: res.user.uid,
            full_name: res.user.displayName || 'Google User',
            email: res.user.email || '',
            phone: res.user.phoneNumber || '',
            avatar_url: res.user.photoURL || null,
          });
          setUser(newProf);
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('popup-closed-by-user')) {
        throw new Error('Sign-in cancelled. Please try again.');
      }
      throw new Error(`Google Sign-In error: ${errMsg}`);
    }
  };

  const loginAsDemoUser = async () => {
    await createOrUpdateProfile(DEV_DEFAULT_USER);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(DEV_DEFAULT_USER));
    setUser(DEV_DEFAULT_USER);
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('Please enter your registered email address.');

    if (isConfigured && auth) {
      await sendPasswordResetEmail(auth, cleanEmail);
      return;
    }

    throw new Error('Password reset is available when Firebase is configured.');
  };

  const updateProfileData = async (updates: {
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
  }) => {
    if (!user) throw new Error('No user logged in.');

    const cleanPhone = updates.phone ? normalizePhoneNumber(updates.phone) : user.phone;
    const cleanName = updates.fullName?.trim() || user.full_name;

    if (cleanPhone && cleanPhone.length < 10) {
      throw new Error('Please provide a valid 10-digit phone number.');
    }

    if (auth.currentUser && updates.fullName) {
      await updateFirebaseProfile(auth.currentUser, {
        displayName: cleanName,
      });
    }

    const updated = await createOrUpdateProfile({
      id: user.id,
      full_name: cleanName,
      phone: cleanPhone,
      avatar_url: updates.avatarUrl !== undefined ? updates.avatarUrl : user.avatar_url,
    });

    setUser(updated);
    if (!auth.currentUser) {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updated));
    }
  };

  const updateProfile = async (updates: {
    full_name?: string;
    fullName?: string;
    phone?: string;
    avatar_url?: string;
    avatarUrl?: string;
  }) => {
    return updateProfileData({
      fullName: updates.fullName || updates.full_name,
      phone: updates.phone,
      avatarUrl: updates.avatarUrl || updates.avatar_url,
    });
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    if (isConfigured && auth) {
      await signOut(auth);
    }
    setUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isConfigured,
        signup,
        login,
        loginWithGoogle,
        loginAsDemoUser,
        resetPassword,
        updateProfileData,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
