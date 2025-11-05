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
