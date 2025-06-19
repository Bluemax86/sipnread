
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase'; // Import db
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  type AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { SignUpFormValues, LoginFormValues } from '@/components/auth/AuthFormFields';


export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'tassologist';
  birthdate?: Timestamp | null; // Changed to Timestamp
  numberOfReadings: number;
  lastReadingDate: Date | Timestamp | null;
  profilePicUrl?: string | null;
  bio?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null | undefined; // undefined: not yet fetched, null: fetched, no profile
  loading: boolean; // General auth loading
  loadingProfile: boolean; // Profile specific loading
  signUp: (values: SignUpFormValues) => Promise<{ success: boolean; error?: AuthError; userId?: string }>;
  signIn: (values: LoginFormValues) => Promise<{ success: boolean; error?: AuthError; userProfile?: UserProfile | null }>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const profileDocRef = doc(db, 'profiles', uid);
    const profileDocSnap = await getDoc(profileDocRef);
    if (profileDocSnap.exists()) {
      const profileData = profileDocSnap.data() as UserProfile;
      return profileData;
    }
    return null;
  } catch (error) {
    console.error("[AuthContext] fetchUserProfile - Error fetching user profile:", error);
    return null;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
      setLoadingProfile(true); 

      if (currentUser) {
        const profile = await fetchUserProfile(currentUser.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null); 
      }
      setLoadingProfile(false); 
    });
    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    if (user) {
      setLoadingProfile(true);
      const profile = await fetchUserProfile(user.uid);
      setUserProfile(profile);
      setLoadingProfile(false);
    }
  };

  const signUp = async (values: SignUpFormValues) => {
    setLoading(true);
    setLoadingProfile(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        const profileData: UserProfile = { 
          uid: firebaseUser.uid,
          email: firebaseUser.email || values.email, 
          name: values.name,
          role: 'user',
          numberOfReadings: 0,
          lastReadingDate: null,
          profilePicUrl: null,
          bio: '',
          createdAt: serverTimestamp() as Timestamp, 
          updatedAt: serverTimestamp() as Timestamp,
        };

        if (values.birthdate && values.birthdate !== '') {
          const dateParts = values.birthdate.split('-');
          if (dateParts.length === 3) {
             const year = parseInt(dateParts[0], 10);
             const month = parseInt(dateParts[1], 10) - 1; 
             const day = parseInt(dateParts[2], 10);
             if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                profileData.birthdate = Timestamp.fromDate(new Date(year, month, day));
             }
          }
        } else {
          profileData.birthdate = null;
        }
        
        const profileRef = doc(db, 'profiles', firebaseUser.uid);
        await setDoc(profileRef, profileData);
        setUserProfile(profileData as UserProfile); 
        return { success: true, userId: firebaseUser.uid };
      }
      return { success: false, error: { code: 'auth/user-creation-failed', message: 'User creation succeeded but profile creation failed.' } as AuthError };
    } catch (error) {
      console.error('[AuthContext] signUp - Error:', error);
      return { success: false, error: error as AuthError };
    } finally {
      setLoading(false);
      setLoadingProfile(false);
    }
  };

  const signIn = async (values: LoginFormValues) => {
    setLoading(true);
    setLoadingProfile(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = auth.currentUser; 
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        setUserProfile(profile); 
        setLoading(false);
        setLoadingProfile(false);
        return { success: true, userProfile: profile };
      }
      // This case should ideally not be reached if signInWithEmailAndPassword succeeds
      setLoading(false);
      setLoadingProfile(false);
      return { success: false, error: { code: 'auth/internal-error', message: 'User authentication succeeded but user object is not available.' } as AuthError };
    } catch (error) {
      const authError = error as AuthError;
      // Log common, handled auth errors with console.info, others with console.error
      if (authError.code === 'auth/invalid-credential' || 
          authError.code === 'auth/user-not-found' || 
          authError.code === 'auth/wrong-password' ||
          authError.code === 'auth/invalid-email') {
        console.info(`[AuthContext] signIn - Handled authentication error: ${authError.code}`);
      } else {
        console.error('[AuthContext] signIn - Error:', authError);
      }
      setLoading(false);
      setLoadingProfile(false);
      return { success: false, error: authError };
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null); 
      setUserProfile(null); 
    } catch (error) {
      console.error("[AuthContext] signOutUser - Error signing out: ", error);
    } finally {
      setLoading(false);
      setLoadingProfile(false);
    }
  };

  const contextValue = { user, userProfile, loading, loadingProfile, signUp, signIn, signOut: signOutUser, refreshUserProfile };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

