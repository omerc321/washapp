import { Request, Response, NextFunction } from "express";
import { UserRole } from "@shared/schema";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      displayName: string;
      role: string;
      photoURL?: string | null;
      phoneNumber?: string | null;
      companyId?: number | null;
    }
  }
}

// Middleware to ensure user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

// Middleware to require specific role
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRole = req.user?.role as UserRole;
    if (roles.includes(userRole)) {
      return next();
    }

    res.status(403).json({ message: "Insufficient permissions" });
  };
}

// Middleware for routes that allow anonymous customers OR authenticated users
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Allow through regardless of authentication status
  next();
}

// Middleware to check if cleaner is active (must run after requireRole)
export function requireActiveCleaner(storage: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRole = req.user?.role as UserRole;
    
    // Only check if user is a cleaner
    if (userRole === UserRole.CLEANER) {
      try {
        const cleaner = await storage.getCleanerByUserId(req.user.id);
        
        if (!cleaner) {
          return res.status(404).json({ message: "Cleaner profile not found" });
        }
        
        if (cleaner.isActive === 0) {
          // Logout the user
          req.logout((err) => {
            if (err) console.error('Logout error:', err);
          });
          return res.status(403).json({ message: "Your account has been deactivated. Please contact your company administrator." });
        }
        
        return next();
      } catch (error: any) {
        return res.status(500).json({ message: error.message });
      }
    }
    
    // Not a cleaner, allow through
    next();
  };
}
