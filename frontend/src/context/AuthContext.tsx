import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Define the shape of the user object
export interface User {
  uid: string;
  email: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => { }
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Check sessionStorage cache first to avoid repeated Firestore reads
          const cacheKey = `user_role_${firebaseUser.uid}`;
          const cachedRole = sessionStorage.getItem(cacheKey);

          if (cachedRole) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: cachedRole
            });
          } else {
            const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (docSnap.exists()) {
              const userData = docSnap.data();
              const role = userData?.role || 'Cashier';
              sessionStorage.setItem(cacheKey, role);
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role
              });
            } else {
              sessionStorage.setItem(cacheKey, 'Cashier');
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: 'Cashier'
              });
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'Cashier'
          });
        }
        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const timeoutId = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("Auth state change timeout. Defaulting to logged out.");
          return false;
        }
        return prev;
      });
    }, 5000);

    return () => {
      unsubscribeAuth();
      clearTimeout(timeoutId);
    };
  }, []);

  const logout = async () => {
    // Clear cached role on logout
    if (user?.uid) {
      sessionStorage.removeItem(`user_role_${user.uid}`);
    }
    await signOut(auth);
    setUser(null);
  };

  const value = { user, loading, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};