import { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  registerAdmin: (data: RegisterAdminData) => Promise<void>;
  registerCompany: (data: RegisterCompanyData) => Promise<void>;
  registerCleaner: (data: RegisterCleanerData) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface RegisterAdminData {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterCompanyData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
  companyName: string;
  companyDescription?: string;
  pricePerWash: string;
  tradeLicenseNumber?: string;
  tradeLicenseDocumentURL?: string;
}

export interface RegisterCleanerData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
  companyId?: string;
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
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      setCurrentUser(data.user);
      
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

  const registerAdmin = async (data: RegisterAdminData) => {
    try {
      const response = await fetch("/api/auth/register/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      const result = await response.json();
      setCurrentUser(result.user);
      
      toast({
        title: "Registration Successful",
        description: "Admin account created!",
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

  const registerCompany = async (data: RegisterCompanyData) => {
    try {
      const response = await fetch("/api/auth/register/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      const result = await response.json();
      setCurrentUser(result.user);
      
      toast({
        title: "Registration Successful",
        description: "Your company has been registered!",
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

  const registerCleaner = async (data: RegisterCleanerData) => {
    try {
      const response = await fetch("/api/auth/register/cleaner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      const result = await response.json();
      setCurrentUser(result.user);
      
      toast({
        title: "Registration Successful",
        description: "Your cleaner account has been created!",
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
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      
      setCurrentUser(null);
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Sign-out Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const value = {
    currentUser,
    loading,
    signIn,
    registerAdmin,
    registerCompany,
    registerCleaner,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
