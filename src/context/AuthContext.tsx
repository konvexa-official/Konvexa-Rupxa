/**
 * Konvexa Rupxa Authentication Context
 * Powered by Firebase Authentication with Cloud Firestore.
 * Uses Firebase Email/Password authentication provider with real user accounts.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, isFirebaseConfigured, testFirestoreConnection } from '../lib/firebase';
import { getProfile, createOrUpdateProfile } from '../lib/db';
import { Profile } from '../types';
import { normalizePhoneNumber } from '../lib/formatters';
import { formatFirebaseAuthError } from '../lib/authErrors';

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
  resetPassword: (email: string) => Promise<void>;
  updateProfileData: (updates: { fullName?: string; phone?: string; avatarUrl?: string; upiId?: string | null }) => Promise<void>;
  updateProfile: (updates: { full_name?: string; fullName?: string; phone?: string; avatar_url?: string; avatarUrl?: string; upi_id?: string | null; upiId?: string | null }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
          if (mounted) setUser(null);
        }

        if (mounted) setLoading(false);
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } else {
      if (mounted) {
        setUser(null);
        setLoading(false);
      }
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

    if (!isConfigured || !auth) {
      throw new Error('Firebase configuration is not initialized. Please verify firebase-applet-config.json.');
    }

    try {
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
    } catch (err: unknown) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const login = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('Email is required.');
    if (!password) throw new Error('Password is required.');

    if (!isConfigured || !auth) {
      throw new Error('Firebase configuration is not initialized. Please verify firebase-applet-config.json.');
    }

    try {
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
    } catch (err: unknown) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('Please enter your registered email address.');

    if (!isConfigured || !auth) {
      throw new Error('Firebase configuration is not initialized.');
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err: unknown) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const updateProfileData = async (updates: {
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    upiId?: string | null;
  }) => {
    if (!user) throw new Error('No user logged in.');

    const cleanPhone = updates.phone ? normalizePhoneNumber(updates.phone) : user.phone;
    const cleanName = updates.fullName?.trim() || user.full_name;

    if (cleanPhone && cleanPhone.length < 10) {
      throw new Error('Please provide a valid 10-digit phone number.');
    }

    if (auth?.currentUser && updates.fullName) {
      await updateFirebaseProfile(auth.currentUser, {
        displayName: cleanName,
      });
    }

    const updated = await createOrUpdateProfile({
      id: user.id,
      full_name: cleanName,
      phone: cleanPhone,
      avatar_url: updates.avatarUrl !== undefined ? updates.avatarUrl : user.avatar_url,
      upi_id: updates.upiId !== undefined ? (updates.upiId ? updates.upiId.trim() : null) : user.upi_id,
    });

    setUser(updated);
  };

  const updateProfile = async (updates: {
    full_name?: string;
    fullName?: string;
    phone?: string;
    avatar_url?: string;
    avatarUrl?: string;
    upi_id?: string | null;
    upiId?: string | null;
  }) => {
    return updateProfileData({
      fullName: updates.fullName || updates.full_name,
      phone: updates.phone,
      avatarUrl: updates.avatarUrl || updates.avatar_url,
      upiId: updates.upiId !== undefined ? updates.upiId : updates.upi_id,
    });
  };

  const logout = async () => {
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
