// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs } from "firebase/firestore";

type Volunteer = {
  id: string;
  avatar: string;
  email: string;
  name: string;
  role: string;
};

type AuthContextType = {
  user: FirebaseUser | null;
  volunteer: Volunteer | null;
  isAdmin: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  volunteer: null,
  isAdmin: false,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        if (firebaseUser.email) {
          const q = query(
            collection(db, "volunteers"),
            where("email", "==", firebaseUser.email)
          );

          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            const volunteerData = {
              id: docSnap.id,
              ...docSnap.data(),
            } as Volunteer;

            setVolunteer(volunteerData);
            setIsAdmin(volunteerData.role === "Admin");
          } else {
            setVolunteer(null);
            setIsAdmin(false);
          }
        } else {
          setVolunteer(null);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setVolunteer(null);
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, volunteer, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

