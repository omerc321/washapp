import { createContext, useContext, useEffect, useState } from "react";
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut 
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User, UserRole } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  companyId?: string; // For cleaners
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadUserProfile(user);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadUserProfile = async (firebaseUser: FirebaseUser) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      setCurrentUser(userSnap.data() as User);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Normalize email to lowercase for case-insensitive login
      const normalizedEmail = email.toLowerCase().trim();
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      toast({
        title: "Signed In",
        description: "Welcome back!",
      });
    } catch (error: any) {
      toast({
        title: "Sign-in Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      // Normalize email to lowercase for case-insensitive matching
      const normalizedEmail = data.email.toLowerCase().trim();
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, data.password);
      
      // Create user profile in Firestore
      const newUser: User = {
        id: userCredential.user.uid,
        email: normalizedEmail,
        displayName: data.displayName,
        role: data.role,
        phoneNumber: data.phoneNumber,
        companyId: data.companyId,
        createdAt: Date.now(),
      };
      
      const userRef = doc(db, "users", userCredential.user.uid);
      await setDoc(userRef, newUser);
      
      // If registering as cleaner, create cleaner profile
      if (data.role === UserRole.CLEANER && data.companyId) {
        await fetch('/api/cleaner/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userCredential.user.uid,
            companyId: data.companyId,
          }),
        });
      }
      
      setCurrentUser(newUser);
      toast({
        title: "Registration Successful",
        description: "Your account has been created!",
      });
    } catch (error: any) {
      toast({
        title: "Registration Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const value = {
    currentUser,
    firebaseUser,
    loading,
    signIn,
    register,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
