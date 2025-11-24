import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import { mkdir, mkdirSync } from "fs";
import crypto from "crypto";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import passport from "./auth";
import { storage } from "./storage";
import { sessionStore } from "./session-store";
import { requireAuth, requireRole, optionalAuth, requireActiveCleaner } from "./middleware";
import { sendEmail } from "./lib/resend";
import { broadcastJobUpdate } from "./websocket";
import { createJobFinancialRecord, calculateJobFees } from "./financialUtils";
import { PushNotificationService } from "./push-service";
import { generateReceipt, generateReceiptNumber } from "./utils/receiptGenerator";
import { 
  JobStatus, 
  CleanerStatus, 
  UserRole,
  type Company,
  type Cleaner,
  type Job,
} from "@shared/schema";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");

const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = file.fieldname === "tradeLicense" ? "licenses" : "proofs";
    const fullPath = path.join(uploadDir, subDir);
    mkdirSync(fullPath, { recursive: true });
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage: storageConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed."));
    }
  },
});

// Stripe setup
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Helper function: Point in polygon algorithm (ray casting)
function isPointInPolygon(lat: number, lon: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [lat1, lon1] = polygon[i];
    const [lat2, lon2] = polygon[j];
    
    const intersect = ((lon1 > lon) !== (lon2 > lon)) &&
      (lat < (lat2 - lat1) * (lon - lon1) / (lon2 - lon1) + lat1);
    
    if (intersect) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Helper function: Generate email HTML for job status updates
function generateJobStatusEmailHTML(params: {
  carPlateNumber: string;
  status: string;
  jobId: number;
  companyName: string;
  cleanerName?: string;
  completedAt?: Date;
}): string {
  const { carPlateNumber, status, jobId, companyName, cleanerName, completedAt } = params;

  const statusMessages: Record<string, { title: string; message: string; color: string }> = {
    paid: {
      title: '✅ Payment Confirmed',
      message: 'Your payment has been received. We\'re finding a cleaner for you!',
      color: '#10B981'
    },
    assigned: {
      title: '👨‍🔧 Cleaner Assigned',
      message: cleanerName
        ? `${cleanerName} has been assigned to your car wash.`
        : 'A cleaner has been assigned to your car wash.',
      color: '#3B82F6'
    },
    in_progress: {
      title: '🚿 Wash in Progress',
      message: cleanerName
        ? `${cleanerName} is now washing your car.`
        : 'Your car wash is in progress.',
      color: '#8B5CF6'
    },
    completed: {
      title: '✨ Wash Completed',
      message: 'Your car wash is complete! Thank you for using Washapp.ae. Your receipt is attached.',
      color: '#059669'
    },
    refunded: {
      title: '💰 Refund Processed',
      message: 'Your payment has been refunded. We apologize for any inconvenience.',
      color: '#DC2626'
    }
  };

  const statusInfo = statusMessages[status] || {
    title: 'Job Update',
    message: `Your car wash status has been updated to: ${status}`,
    color: '#6B7280'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${statusInfo.title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Washapp.ae</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 30px 20px 30px; text-align: center;">
                  <div style="display: inline-block; background-color: ${statusInfo.color}; color: #ffffff; padding: 12px 24px; border-radius: 24px; font-size: 18px; font-weight: 600;">
                    ${statusInfo.title}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 30px 30px 30px; text-align: center;">
                  <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                    ${statusInfo.message}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 30px 30px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                    <tr>
                      <td style="padding: 8px 0;">
                        <span style="color: #6b7280; font-size: 14px;">Job ID:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 600; float: right;">#${jobId}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                        <span style="color: #6b7280; font-size: 14px;">Car Plate:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 600; float: right;">${carPlateNumber}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                        <span style="color: #6b7280; font-size: 14px;">Company:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 600; float: right;">${companyName}</span>
                      </td>
                    </tr>
                    ${completedAt ? `
                    <tr>
                      <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                        <span style="color: #6b7280; font-size: 14px;">Completed At:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 600; float: right;">${new Date(completedAt).toLocaleString('en-AE')}</span>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    Thank you for choosing Washapp.ae
                  </p>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">
                    This is an automated email. Please do not reply.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Helper function: Send job status email notification
async function sendJobStatusEmail(job: Job, company: Company, status: string, cleanerName?: string) {
  if (!job.customerEmail) {
    return; // Skip if no email provided
  }

  try {
    const fullPlateNumber = job.carPlateEmirate && job.carPlateCode
      ? `${job.carPlateEmirate} ${job.carPlateCode} ${job.carPlateNumber}`
      : job.carPlateNumber;

    const emailHTML = generateJobStatusEmailHTML({
      carPlateNumber: fullPlateNumber,
      status,
      jobId: job.id,
      companyName: company.name,
      cleanerName,
      completedAt: job.completedAt || undefined,
    });

    const statusTitles: Record<string, string> = {
      paid: 'Payment Confirmed',
      assigned: 'Cleaner Assigned',
      in_progress: 'Wash in Progress',
      completed: 'Wash Completed',
      refunded: 'Refund Processed'
    };

    const subject = `${statusTitles[status] || 'Job Update'} - ${fullPlateNumber}`;

    // If completed, attach the receipt
    let attachments = undefined;
    if (status === 'completed' && job.receiptNumber) {
      const receiptPath = path.join(process.cwd(), 'uploads', 'receipts', `receipt-${job.receiptNumber}.pdf`);
      attachments = [
        {
          filename: `receipt-${job.receiptNumber}.pdf`,
          path: receiptPath,
        }
      ];
    }

    await sendEmail(job.customerEmail, subject, emailHTML, attachments);
  } catch (error) {
    console.error('Failed to send job status email:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Global middleware: Add no-cache headers to ALL API responses
  app.use('/api/*', (req: Request, res: Response, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
  });
  
  // Ensure upload directory exists
  mkdirSync(uploadDir, { recursive: true });
  
  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadDir));
  
  // ===== FILE UPLOAD ROUTES =====
  
  // Upload trade license document (requires company admin auth)
  app.post("/api/upload/trade-license", requireRole(UserRole.COMPANY_ADMIN), upload.single("tradeLicense"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/licenses/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Upload job completion proof photo (requires cleaner auth)
  app.post("/api/upload/proof-photo", requireRole(UserRole.CLEANER), upload.single("proofPhoto"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/proofs/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Upload platform logo (requires admin auth)
  app.post("/api/upload/logo", requireRole(UserRole.ADMIN), upload.single("logo"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/logos/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // ===== LOCATION SEARCH ROUTES =====
  
  // Serve dynamic PWA manifest with uploaded logo (public endpoint)
  app.get("/manifest.json", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAllPlatformSettings();
      const platformSettings = settings[0] || {
        companyName: 'Washapp.ae',
        logoUrl: null,
      };

      // Default icons (always available as fallback)
      const defaultIcons = [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ];

      // If a custom logo is uploaded, use it for all icon sizes
      // Otherwise, fall back to default icons
      const icons = platformSettings.logoUrl ? [
        {
          src: platformSettings.logoUrl,
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: platformSettings.logoUrl,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ] : defaultIcons;

      const manifest = {
        name: platformSettings.companyName || "Washapp.ae",
        short_name: platformSettings.companyName || "Washapp.ae",
        description: "Professional car wash booking platform - Book cleaners, manage jobs, track payments",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        orientation: "portrait",
        icons,
        categories: ["business", "productivity"],
        screenshots: []
      };

      res.set('Content-Type', 'application/manifest+json');
      res.json(manifest);
    } catch (error: any) {
      console.error("Error generating manifest:", error);
      
      // On error, return a valid manifest with default icons
      const fallbackManifest = {
        name: "Washapp.ae",
        short_name: "Washapp.ae",
        description: "Professional car wash booking platform - Book cleaners, manage jobs, track payments",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        orientation: "portrait",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        categories: ["business", "productivity"],
        screenshots: []
      };
      
      res.set('Content-Type', 'application/manifest+json');
      res.json(fallbackManifest);
    }
  });

  // Search locations using Nominatim API (public endpoint)
  app.get("/api/location/search", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(400).json({ message: "Search query 'q' is required" });
      }

      // Make request to Nominatim API with English language
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?` + 
        `format=json&` +
        `q=${encodeURIComponent(q.trim())}&` +
        `limit=10&` +
        `addressdetails=1&` +
        `accept-language=en`;

      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Washapp.ae/1.0',
          'Accept-Language': 'en',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // ===== AUTHENTICATION ROUTES =====
  
  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: err.message });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        return res.json({ user });
      });
    })(req, res, next);
  });
  
  // Logout (with auto shift end for cleaners)
  app.post("/api/auth/logout", async (req, res) => {
    try {
      // End active shift if user is a cleaner
      if (req.user && req.user.role === UserRole.CLEANER) {
        const cleaner = await storage.getCleanerByUserId(req.user.id);
        if (cleaner) {
          const activeShift = await storage.getActiveShift(cleaner.id);
          if (activeShift) {
            await storage.endShift(cleaner.id);
          }
        }
      }
      
      req.logout((err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        res.json({ success: true });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.json({ user: null });
    }
  });
  
  // Password reset - Request reset
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      // Don't reveal if user exists or not (security best practice)
      if (!user) {
        return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
      }
      
      // Generate secure random token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      // Store token in database
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      
      // Get reset URL (use frontend URL)
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
      
      // Send email with reset link
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0ea5e9;">Password Reset Request</h2>
          <p>Hello ${user.displayName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            ${resetUrl}
          </p>
        </div>
      `;
      
      await sendEmail(
        user.email,
        "Password Reset Request - Washapp.ae",
        emailHtml
      );
      
      res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });
  
  // Password reset - Verify token
  app.get("/api/auth/verify-reset-token/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Invalid or expired reset token" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ valid: false, message: "Reset token has expired" });
      }
      
      res.json({ valid: true });
    } catch (error: any) {
      console.error("Verify token error:", error);
      res.status(500).json({ valid: false, message: "Failed to verify reset token" });
    }
  });
  
  // Password reset - Reset password
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      
      // Verify token
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ message: "Reset token has expired" });
      }
      
      // Update user password
      await storage.updateUserPassword(resetToken.userId, newPassword);
      
      // Delete the used token
      await storage.deletePasswordResetToken(token);
      
      // Clean up any other expired tokens
      await storage.deleteExpiredPasswordResetTokens();
      
      // Get user details for confirmation email
      const user = await storage.getUser(resetToken.userId);
      
      if (user) {
        // Send confirmation email
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0ea5e9;">Password Changed Successfully</h2>
            <p>Hello ${user.displayName},</p>
            <p>Your password has been successfully changed.</p>
            <p>If you didn't make this change, please contact support immediately.</p>
            <p style="color: #64748b; margin-top: 30px;">
              Thank you,<br>
              Washapp.ae Team
            </p>
          </div>
        `;
        
        await sendEmail(
          user.email,
          "Password Changed - Washapp.ae",
          emailHtml
        );
      }
      
      res.json({ message: "Password reset successful" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  
  // ===== REGISTRATION ROUTES =====
  
  // Register platform admin
  app.post("/api/auth/register/admin", async (req: Request, res: Response) => {
    try {
      const { email, password, displayName } = req.body;
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Create admin user (password hashing handled by storage layer)
      const user = await storage.createUser({
        email,
        password,
        displayName,
        role: UserRole.ADMIN,
      });
      
      // Log in the user
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Register company admin (creates user + company)
  app.post("/api/auth/register/company", async (req: Request, res: Response) => {
    try {
      const { 
        email,
        password,
        displayName, 
        phoneNumber,
        companyName, 
        companyDescription, 
        pricePerWash,
        tradeLicenseNumber,
        tradeLicenseDocumentURL,
        packageType,
        subscriptionCleanerSlots
      } = req.body;
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Use transaction to ensure atomicity
      const result = await storage.createCompanyWithAdmin({
        email,
        password,
        displayName,
        phoneNumber,
        companyName,
        companyDescription,
        pricePerWash: parseFloat(pricePerWash),
        tradeLicenseNumber,
        tradeLicenseDocumentURL,
        packageType,
        subscriptionCleanerSlots,
      });
      
      // Log in the user
      req.login(result.user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = result.user;
        res.json({ user: userWithoutPassword, company: result.company });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Validate cleaner phone number (step 1 of registration)
  app.post("/api/auth/validate-cleaner-phone", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;
      
      // Check if phone number has a pending invitation
      const invitation = await storage.getInvitationByPhone(phoneNumber);
      
      if (!invitation) {
        return res.status(400).json({ message: "Phone number not invited" });
      }
      
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation already used or revoked" });
      }
      
      // Get company details
      const company = await storage.getCompany(invitation.companyId);
      if (!company) {
        return res.status(400).json({ message: "Company not found" });
      }
      
      res.json({ 
        valid: true, 
        companyId: invitation.companyId,
        companyName: company.name
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Register cleaner (step 2 - requires valid phone invitation)
  app.post("/api/auth/register/cleaner", async (req: Request, res: Response) => {
    try {
      const { 
        email,
        password,
        displayName, 
        phoneNumber,
      } = req.body;
      
      // Validate phone number invitation again
      const invitation = await storage.getInvitationByPhone(phoneNumber);
      if (!invitation || invitation.status !== "pending") {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Use transaction to ensure atomicity
      const result = await storage.createCleanerWithUser({
        email,
        password,
        displayName,
        phoneNumber,
        companyId: invitation.companyId,
      });
      
      // Transfer geofence assignments from invitation to cleaner
      await storage.transferInvitationGeofencesToCleaner(invitation.id, result.cleaner.id);
      
      // Consume the invitation
      await storage.consumeInvitation(phoneNumber);
      
      // Log in the user
      req.login(result.user, (err) => {
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        const { passwordHash, ...userWithoutPassword } = result.user;
        res.json({ user: userWithoutPassword, cleaner: result.cleaner });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // ===== CUSTOMER ROUTES (ANONYMOUS) =====

  // Customer email-based login/registration
  app.post("/api/customer/login", async (req: Request, res: Response) => {
    try {
      const { email, displayName, phoneNumber } = req.body;
      console.log('[DEBUG] /api/customer/login received:', { email, displayName, phoneNumber, body: req.body });
      
      if (!email) {
        console.log('[DEBUG] Email missing in request');
        return res.status(400).json({ message: "Email is required" });
      }
      
      const customer = await storage.createOrGetCustomer(email, displayName, phoneNumber);
      console.log('[DEBUG] Customer created/found:', customer);
      res.json(customer);
    } catch (error: any) {
      console.error('[DEBUG] Error in /api/customer/login:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create or get customer by phone number (for QR payments)
  app.post("/api/customer/by-phone", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Try to get existing customer
      let customer = await storage.getCustomerByPhone(phoneNumber);
      
      // If no customer exists, create one with phone only
      if (!customer) {
        // Generate a temporary email from phone
        const tempEmail = `${phoneNumber.replace(/[^0-9]/g, '')}@temp.washapp.ae`;
        customer = await storage.createOrGetCustomer(tempEmail, undefined, phoneNumber);
      }

      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get customer profile by phone
  app.get("/api/customer/profile/:phoneNumber", async (req: Request, res: Response) => {
    try {
      const customer = await storage.getCustomerByPhone(req.params.phoneNumber);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get car history by car plate (returns previous bookings for this specific plate)
  app.get("/api/customer/car-history/:emirate/:code/:number", async (req: Request, res: Response) => {
    try {
      const { emirate, code, number } = req.params;
      
      if (!emirate || !code || !number) {
        return res.status(400).json({ message: "Car plate details are required" });
      }

      // Get history for this specific car plate
      const history = await storage.getCarHistoryByPlate(emirate, code, number);
      
      res.json({ history });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  // Get customer's previous cars (unique car plates from booking history)
  app.get("/api/customer/history/:phoneNumber", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;
      
      // Get customer first
      const customer = await storage.getCustomerByPhone(phoneNumber);
      if (!customer) {
        return res.json({ cars: [] });
      }

      // Get all jobs for this customer
      const jobsResult = await storage.getJobsByCustomer(customer.id, 1, 1000); // Get first 1000 jobs for history
      const jobs = jobsResult.data;
      
      // Extract unique cars (car plate + email combinations)
      const carsMap = new Map();
      for (const job of jobs) {
        const key = `${job.carPlateEmirate}-${job.carPlateCode}-${job.carPlateNumber}`;
        if (!carsMap.has(key)) {
          carsMap.set(key, {
            carPlateEmirate: job.carPlateEmirate,
            carPlateCode: job.carPlateCode,
            carPlateNumber: job.carPlateNumber,
            customerEmail: job.customerEmail,
            parkingNumber: job.parkingNumber || "",
            lastUsed: job.createdAt,
          });
        } else {
          // Update if this job is more recent
          const existing = carsMap.get(key);
          if (new Date(job.createdAt) > new Date(existing.lastUsed)) {
            carsMap.set(key, {
              ...existing,
              customerEmail: job.customerEmail,
              parkingNumber: job.parkingNumber || "",
              lastUsed: job.createdAt,
            });
          }
        }
      }

      // Convert to array and sort by most recent
      const cars = Array.from(carsMap.values()).sort(
        (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
      );

      res.json({ cars });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get customer's most recent car by email (for auto-fill after email verification)
  app.get("/api/customer/recent-car-by-email/:email", async (req: Request, res: Response) => {
    try {
      const { email } = req.params;
      
      // Get customer by email
      const customer = await storage.getCustomerByEmail(email);
      if (!customer) {
        return res.json({ car: null });
      }

      // Get most recent job for this customer
      const jobsResult = await storage.getJobsByCustomer(customer.id, 1, 1);
      const jobs = jobsResult.data;
      
      if (jobs.length === 0) {
        return res.json({ car: null });
      }

      const mostRecentJob = jobs[0];
      res.json({
        car: {
          carPlateEmirate: mostRecentJob.carPlateEmirate,
          carPlateCode: mostRecentJob.carPlateCode,
          carPlateNumber: mostRecentJob.carPlateNumber,
          parkingNumber: mostRecentJob.parkingNumber || "",
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get payment token details for customer
  app.get("/api/customer/payment-token/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const paymentToken = await storage.getCleanerPaymentToken(token);
      
      if (!paymentToken) {
        return res.status(404).json({ message: "Invalid payment token" });
      }

      if (paymentToken.isUsed) {
        return res.status(400).json({ message: "This token has already been used" });
      }

      if (!paymentToken.expiresAt || new Date(paymentToken.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This token has expired" });
      }

      const cleaner = await storage.getCleaner(paymentToken.cleanerId);
      const company = await storage.getCompany(paymentToken.companyId);
      
      if (!cleaner || !company) {
        return res.status(404).json({ message: "Cleaner or company not found" });
      }

      const cleanerUser = await storage.getUser(cleaner.userId);

      res.json({
        token: paymentToken.token,
        companyId: company.id,
        companyName: company.name,
        cleanerId: cleaner.id,
        cleanerName: cleanerUser?.displayName || "Unknown",
        expiresAt: paymentToken.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all companies (for registration dropdown)
  app.get("/api/companies/all", async (req: Request, res: Response) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get companies whose geofences contain the customer location
  // IMPORTANT: This must come BEFORE /api/companies/:id to avoid route matching issues
  app.get("/api/companies/nearby", async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      
      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ message: "Invalid latitude or longitude" });
      }

      const companiesWithCleaners = await storage.getNearbyCompanies(lat, lon);
      res.json(companiesWithCleaners);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company by ID
  // IMPORTANT: This parameterized route must come AFTER specific routes like /nearby
  app.get("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompany(parseInt(req.params.id));
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cleaner by ID (public endpoint for customer tracking)
  app.get("/api/cleaners/:id", async (req: Request, res: Response) => {
    try {
      const cleanerId = parseInt(req.params.id);
      if (isNaN(cleanerId)) {
        return res.status(400).json({ message: "Invalid cleaner ID" });
      }

      const cleaner = await storage.getCleaner(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      // Get user info to include phone number and name
      const user = await storage.getUser(cleaner.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return cleaner info with phone number
      res.json({
        ...cleaner,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        email: user.email,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Lookup cleaner by email with geofence validation (public endpoint for checkout validation)
  app.get("/api/cleaners/lookup", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email parameter is required" });
      }
      
      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ message: "Valid latitude and longitude are required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user || user.role !== UserRole.CLEANER) {
        return res.status(404).json({ message: "Cleaner not found" });
      }
      
      // Get cleaner profile
      const cleaner = await storage.getCleanerByUserId(user.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      // Check if cleaner is active
      if (cleaner.isActive !== 1) {
        return res.status(403).json({ message: "This cleaner is not active" });
      }
      
      // Get company info
      const company = await storage.getCompany(cleaner.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (company.isActive !== 1) {
        return res.status(403).json({ message: "This cleaner's company is not active" });
      }
      
      // Validate that customer location is within company's service area (geofence)
      const isInServiceArea = await storage.isLocationInCompanyGeofence(cleaner.companyId, lat, lon);
      if (!isInServiceArea) {
        return res.status(403).json({ 
          message: "This cleaner's company does not service your location. Please select your location on the map and choose from available companies." 
        });
      }
      
      res.json({
        cleanerId: cleaner.id,
        email: user.email,
        displayName: user.displayName,
        companyId: company.id,
        companyName: company.name,
        isActive: true,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create payment intent and job
  app.post("/api/create-payment-intent", async (req: Request, res: Response) => {
    try {
      const jobData = req.body;
      const tipAmount = Number(jobData.tipAmount || 0);
      const basePrice = Number(jobData.price);
      
      // Debug: Log the raw value
      console.log('[DEBUG] requestedCleanerEmail RAW:', JSON.stringify(jobData.requestedCleanerEmail), 'type:', typeof jobData.requestedCleanerEmail);
      
      // Normalize requestedCleanerEmail to avoid treating empty/whitespace as valid
      const requestedCleanerEmail = typeof jobData.requestedCleanerEmail === "string" 
        ? jobData.requestedCleanerEmail.trim() 
        : "";
      
      console.log('[DEBUG] requestedCleanerEmail NORMALIZED:', JSON.stringify(requestedCleanerEmail), 'length:', requestedCleanerEmail.length);
      
      // Get company to retrieve platform fee and fee package type
      const company = await storage.getCompany(parseInt(jobData.companyId));
      if (!company) {
        return res.status(400).json({ message: "Invalid company" });
      }
      const platformFee = Number(company.platformFee || 3.00);
      const feePackageType = company.feePackageType || 'custom';
      
      // Security: Validate requested cleaner belongs to selected company (only if email is provided)
      if (requestedCleanerEmail) {
        const user = await storage.getUserByEmail(requestedCleanerEmail);
        if (!user || user.role !== UserRole.CLEANER) {
          return res.status(400).json({ message: "Invalid cleaner email" });
        }
        
        const cleaner = await storage.getCleanerByUserId(user.id);
        if (!cleaner || cleaner.companyId !== parseInt(jobData.companyId)) {
          return res.status(403).json({ message: "Requested cleaner does not belong to selected company" });
        }
        
        if (cleaner.isActive !== 1) {
          return res.status(403).json({ message: "Requested cleaner is not active" });
        }
      }
      
      // Calculate fees and total amount with company-specific platform fee and package type
      const fees = await calculateJobFees(basePrice, tipAmount, platformFee, 'pay_per_wash', feePackageType);
      
      // Create payment intent with total amount (including tip)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(fees.totalAmount * 100), // Convert to fils (AED subunits)
        currency: "aed",
        metadata: {
          carPlateNumber: jobData.carPlateNumber,
          locationAddress: jobData.locationAddress,
          companyId: jobData.companyId,
          tipAmount: tipAmount.toString(),
          requestedCleanerEmail: requestedCleanerEmail || '',
        },
      });

      // Create job in database with pending payment status
      const job = await storage.createJob({
        customerId: jobData.customerId ? parseInt(jobData.customerId) : undefined,
        companyId: parseInt(jobData.companyId),
        carPlateNumber: jobData.carPlateNumber,
        carPlateEmirate: jobData.carPlateEmirate || null,
        carPlateCode: jobData.carPlateCode || null,
        locationAddress: jobData.locationAddress,
        locationLatitude: jobData.locationLatitude,
        locationLongitude: jobData.locationLongitude,
        parkingNumber: jobData.parkingNumber,
        customerPhone: jobData.customerPhone,
        customerEmail: jobData.customerEmail || null,
        price: basePrice.toString(),
        tipAmount: tipAmount.toString(),
        totalAmount: fees.totalAmount.toString(),
        stripePaymentIntentId: paymentIntent.id,
        status: JobStatus.PENDING_PAYMENT,
        requestedCleanerEmail: requestedCleanerEmail || null,
        assignmentMode: requestedCleanerEmail ? 'direct' : 'pool',
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret, 
        jobId: job.id,
        fees // Include full fee breakdown for accurate frontend display
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update payment intent with new tip amount
  app.patch("/api/payment-intents/:paymentIntentId", async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      const { tipAmount } = req.body;
      
      // Find the existing job to get the stored base price (prevent tampering)
      const job = await storage.getJobByPaymentIntent(paymentIntentId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Validate job is still in pending payment state
      if (job.status !== JobStatus.PENDING_PAYMENT) {
        return res.status(400).json({ message: "Payment already processed" });
      }
      
      // Validate tip amount
      const tip = Number(tipAmount || 0);
      if (tip < 0) {
        return res.status(400).json({ message: "Tip amount cannot be negative" });
      }
      if (tip > 1000) {
        return res.status(400).json({ message: "Tip amount too large" });
      }
      
      // Use the stored base price from the job (not from client)
      const basePrice = Number(job.price);
      
      // Get company to retrieve platform fee and fee package type
      const company = await storage.getCompany(job.companyId);
      if (!company) {
        return res.status(400).json({ message: "Company not found" });
      }
      const platformFee = Number(company.platformFee || 3.00);
      const feePackageType = company.feePackageType || 'custom';
      
      // Recalculate fees with new tip amount
      const fees = await calculateJobFees(basePrice, tip, platformFee, 'pay_per_wash', feePackageType);
      
      // Update the Stripe PaymentIntent with new amount
      const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
        amount: Math.round(fees.totalAmount * 100), // Convert to fils
        metadata: {
          tipAmount: tip.toString(),
        },
      });
      
      // Update the job with new tip and total
      await storage.updateJob(job.id, {
        tipAmount: tip.toString(),
        totalAmount: fees.totalAmount.toString(),
      });
      
      // Return updated fees for frontend display
      res.json({
        ...fees,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error('Payment intent update error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Stripe webhook endpoint with signature verification
  app.post("/api/stripe-webhook", express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } else {
        console.warn('No STRIPE_WEBHOOK_SECRET - skipping signature verification');
        event = req.body;
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Find job by payment intent ID
        const job = await storage.getJobByPaymentIntent(paymentIntent.id);

        if (job) {
          let assignedCleanerId: number | null = null;
          let finalStatus = JobStatus.PAID;
          let finalAssignmentMode = job.assignmentMode;
          
          // Handle direct assignment if requested
          if (job.assignmentMode === 'direct' && job.requestedCleanerEmail) {
            try {
              // Find the requested cleaner
              const user = await storage.getUserByEmail(job.requestedCleanerEmail);
              if (user && user.role === UserRole.CLEANER) {
                const cleaner = await storage.getCleanerByUserId(user.id);
                
                // Validate cleaner belongs to the job's company and is available
                if (cleaner && 
                    cleaner.isActive === 1 && 
                    cleaner.companyId === job.companyId &&
                    cleaner.status === CleanerStatus.ON_DUTY) {
                  
                  // Directly assign to the cleaner immediately
                  assignedCleanerId = cleaner.id;
                  finalStatus = JobStatus.ASSIGNED;
                  await storage.updateJob(job.id, {
                    status: JobStatus.ASSIGNED,
                    cleanerId: cleaner.id,
                    assignedAt: new Date(),
                    directAssignmentAt: new Date(),
                  });
                  
                  // Update cleaner status to busy
                  await storage.updateCleaner(cleaner.id, {
                    status: CleanerStatus.BUSY,
                  });
                } else {
                  // Fall back to pool if cleaner not available
                  const reason = !cleaner ? 'not found' :
                                cleaner.isActive !== 1 ? 'not active' :
                                cleaner.companyId !== job.companyId ? 'wrong company' :
                                cleaner.status === CleanerStatus.BUSY ? 'already busy' :
                                'off duty';
                  console.log(`Requested cleaner ${reason}, falling back to pool`);
                  finalAssignmentMode = 'pool';
                  await storage.updateJob(job.id, {
                    status: JobStatus.PAID,
                    assignmentMode: 'pool',
                    requestedCleanerEmail: null,
                  });
                }
              } else {
                // Fall back to pool if cleaner not found
                console.log('Requested cleaner not found, falling back to pool');
                finalAssignmentMode = 'pool';
                await storage.updateJob(job.id, {
                  status: JobStatus.PAID,
                  assignmentMode: 'pool',
                  requestedCleanerEmail: null,
                });
              }
            } catch (directAssignError) {
              console.error('Direct assignment error, falling back to pool:', directAssignError);
              finalAssignmentMode = 'pool';
              await storage.updateJob(job.id, {
                status: JobStatus.PAID,
                assignmentMode: 'pool',
                requestedCleanerEmail: null,
              });
            }
          } else {
            // Pool mode - just mark as PAID
            await storage.updateJob(job.id, {
              status: JobStatus.PAID,
            });
          }
          
          // Generate and store receipt number (atomic operation to prevent duplicates)
          const generatedReceipt = generateReceiptNumber();
          const receiptNumber = await storage.atomicSetReceipt(job.id, generatedReceipt, new Date());
          
          // Get company to retrieve platform fee
          const company = await storage.getCompany(job.companyId);
          const platformFee = company ? Number(company.platformFee || 3.00) : 3.00;
          
          // Create financial record for this job
          await createJobFinancialRecord(
            job.id,
            job.companyId,
            assignedCleanerId, // Pass cleaner ID if directly assigned
            Number(job.price),
            Number(job.tipAmount || 0),
            new Date(),
            platformFee
          );
          
          // Create transaction record for customer payment
          await storage.createTransaction({
            referenceNumber: paymentIntent.id,
            type: 'customer_payment',
            direction: 'credit',
            jobId: job.id,
            companyId: job.companyId,
            amount: (Number(job.price) + Number(job.tipAmount || 0)).toString(),
            currency: 'AED',
            description: `Customer payment for job ${job.id} - ${job.carPlateNumber}`,
          });
          
          // Broadcast update to relevant parties
          const updatedJob = await storage.getJob(job.id);
          if (updatedJob) {
            
            // Send push notification based on final status
            if (finalStatus === JobStatus.ASSIGNED && assignedCleanerId) {
              // Notify customer that cleaner is assigned
              const cleaner = await storage.getCleaner(assignedCleanerId);
              const cleanerUser = cleaner ? await storage.getUser(cleaner.userId) : null;
              
              PushNotificationService.notifyJobStatusChange(updatedJob.id, JobStatus.ASSIGNED, {
                carPlateNumber: updatedJob.carPlateNumber,
                cleanerName: cleanerUser?.displayName,
                customerId: updatedJob.customerId || undefined,
              }).catch(err => console.error('Push notification failed:', err));
              
              // Send email notification if customer provided email
              if (company) {
                await sendJobStatusEmail(updatedJob, company, 'assigned', cleanerUser?.displayName);
              }
              
              // Only broadcast to the assigned cleaner
              broadcastJobUpdate(updatedJob);
            } else {
              // Notify customer that payment is confirmed (pool mode)
              PushNotificationService.notifyJobStatusChange(updatedJob.id, JobStatus.PAID, {
                carPlateNumber: updatedJob.carPlateNumber,
                customerId: updatedJob.customerId || undefined,
              }).catch(err => console.error('Push notification failed:', err));
              
              // Send email notification if customer provided email
              if (company) {
                await sendJobStatusEmail(updatedJob, company, 'paid');
              }
              
              // Broadcast to all on-duty cleaners (pool mode)
              broadcastJobUpdate(updatedJob);
              
              // Send push notifications to all eligible on-duty cleaners
              PushNotificationService.notifyOnDutyCleaners(updatedJob.id, updatedJob.companyId, {
                carPlateNumber: updatedJob.carPlateNumber,
                locationAddress: updatedJob.locationAddress || 'Location provided',
                price: Number(updatedJob.price),
                locationLat: Number(updatedJob.locationLatitude),
                locationLng: Number(updatedJob.locationLongitude),
              }).catch(err => console.error('Push notification to cleaners failed:', err));
            }
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Manual payment confirmation endpoint (for development when webhooks don't fire)
  app.post("/api/confirm-payment/:paymentIntentId", async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      const { paymentToken } = req.body;
      
      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not successful" });
      }
      
      // Find job by payment intent ID
      const job = await storage.getJobByPaymentIntent(paymentIntentId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Handle QR code payment token if provided
      let cleanerIdToAssign: number | null = null;
      if (paymentToken) {
        const token = await storage.getCleanerPaymentToken(paymentToken);
        
        if (token && !token.isUsed && token.expiresAt && new Date(token.expiresAt) > new Date()) {
          cleanerIdToAssign = token.cleanerId;
          
          // Mark token as used
          await storage.markTokenAsUsed(token.id);
        }
      }
      
      // Only update status if not already PAID
      if (job.status === JobStatus.PENDING_PAYMENT) {
        const updateData: any = {
          status: cleanerIdToAssign ? JobStatus.ASSIGNED : JobStatus.PAID,
        };
        
        // Auto-assign to cleaner if token was provided
        if (cleanerIdToAssign) {
          updateData.cleanerId = cleanerIdToAssign;
        }
        
        await storage.updateJob(job.id, updateData);
      }
      
      // Always ensure receipt exists (atomic operation to prevent duplicates)
      const generatedReceipt = generateReceiptNumber();
      const receiptNumber = await storage.atomicSetReceipt(job.id, generatedReceipt, new Date());
      
      // If job was already confirmed and has receipt, we can skip financial record creation
      if (job.status !== JobStatus.PENDING_PAYMENT && job.receiptNumber) {
        return res.json({ message: "Job already confirmed", job });
      }
      
      // Get company to retrieve platform fee
      const company = await storage.getCompany(job.companyId);
      if (!company) {
        return res.status(400).json({ message: "Company not found" });
      }
      const platformFee = Number(company.platformFee || 3.00);
      
      // Create financial record for this job
      await createJobFinancialRecord(
        job.id,
        job.companyId,
        job.cleanerId, // Pass actual cleaner if assigned
        Number(job.price),
        Number(job.tipAmount || 0),
        new Date(),
        platformFee
      );
      
      // Broadcast update to all on-duty cleaners
      const updatedJob = await storage.getJob(job.id);
      if (updatedJob) {
        broadcastJobUpdate(updatedJob);
        
        // Send email notification if customer provided email
        if (company && updatedJob.customerEmail) {
          await sendJobStatusEmail(updatedJob, company, 'paid');
        }
        
        // Send push notification
        PushNotificationService.notifyJobStatusChange(updatedJob.id, JobStatus.PAID, {
          carPlateNumber: updatedJob.carPlateNumber,
          customerId: updatedJob.customerId || undefined,
        }).catch(err => console.error('Push notification failed:', err));
      }
      
      return res.json({ message: "Payment confirmed - job available for cleaners", job: updatedJob });
    } catch (error: any) {
      console.error('Payment confirmation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get customer's jobs
  app.get("/api/customer/jobs/:customerId?", async (req: Request, res: Response) => {
    try {
      const customerIdParam = req.params.customerId || req.query.customerId;
      if (!customerIdParam) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      const customerId = parseInt(customerIdParam as string);
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;
      
      const result = await storage.getJobsByCustomer(customerId, page, pageSize);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get jobs by car plate number (for tracking)
  app.get("/api/jobs/track/:plateNumber", async (req: Request, res: Response) => {
    try {
      const { plateNumber } = req.params;
      if (!plateNumber) {
        return res.status(400).json({ message: "Plate number is required" });
      }
      
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;
      
      // Disable caching completely for real-time updates
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      
      const result = await storage.getJobsByPlateNumber(plateNumber, page, pageSize);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get jobs by phone number (for tracking)
  app.get("/api/jobs/track-by-phone/:phoneNumber", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;
      
      // Disable caching completely for real-time updates
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      
      const result = await storage.getJobsByPhoneNumber(phoneNumber, page, pageSize);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single job by ID (for complaint submission)
  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Rate a completed job
  app.post("/api/jobs/:jobId/rate", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { rating, review } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (job.status !== JobStatus.COMPLETED) {
        return res.status(400).json({ message: "Job must be completed before rating" });
      }
      
      if (job.rating) {
        return res.status(400).json({ message: "Job has already been rated" });
      }

      if (!job.cleanerId) {
        return res.status(400).json({ message: "Job has no assigned cleaner" });
      }
      
      // Update job with rating
      await storage.updateJob(jobId, {
        rating: parseFloat(rating).toString(),
        review: review || null,
        ratedAt: new Date(),
      });

      // Update cleaner's aggregate rating
      const cleaner = await storage.getCleaner(job.cleanerId);
      if (cleaner) {
        // Get all rated jobs for this cleaner
        const cleanerJobs = await storage.getJobsByCleaner(job.cleanerId);
        const ratedJobs = cleanerJobs.filter(j => j.rating);
        
        // Calculate new average rating
        const totalRatings = ratedJobs.length;
        const averageRating = ratedJobs.reduce((sum, j) => sum + parseFloat(j.rating!), 0) / totalRatings;
        
        // Update cleaner's rating
        await storage.updateCleaner(job.cleanerId, {
          rating: averageRating.toFixed(2),
          totalRatings,
        });
      }
      
      res.json({ message: "Rating submitted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== CLEANER ROUTES =====

  // Consolidated dashboard endpoint - combines profile, shift, and jobs in one call
  app.get("/api/cleaner/dashboard", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');

      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }

      // Fetch all data in parallel
      const [activeShift, myJobs, availableJobsData] = await Promise.all([
        storage.getActiveShift(cleaner.id),
        storage.getJobsByCleaner(cleaner.id),
        (async () => {
          const allJobs = await storage.getJobsByCompany(cleaner.companyId, JobStatus.PAID);
          const assignedToAll = await storage.isCleanerAssignedToAllGeofences(cleaner.id);
          
          if (assignedToAll) {
            return allJobs;
          }
          
          const assignedGeofences = await storage.getCleanerGeofenceAssignments(cleaner.id);
          if (assignedGeofences.length === 0) {
            return [];
          }
          
          return allJobs.filter(job => {
            const lat = Number(job.locationLatitude);
            const lon = Number(job.locationLongitude);
            return assignedGeofences.some(geofence => {
              const polygon = geofence.polygon as Array<[number, number]>;
              if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
                return false;
              }
              return isPointInPolygon(lat, lon, polygon);
            });
          });
        })(),
      ]);

      res.json({
        cleaner,
        activeShift,
        myJobs,
        availableJobs: availableJobsData,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cleaner profile
  app.get("/api/cleaner/profile", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      res.json(cleaner);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cleaner tips with date filtering
  app.get("/api/cleaner/tips", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }

      const { startDate, endDate, page, pageSize } = req.query;
      
      const filters: { startDate?: Date; endDate?: Date; page?: number; pageSize?: number } = {};
      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        // Set to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      if (page) filters.page = parseInt(page as string);
      if (pageSize) filters.pageSize = parseInt(pageSize as string);

      const result = await storage.getCleanerTips(cleaner.id, filters);
      
      // Calculate totals
      const totalTips = result.data.reduce((sum, t) => sum + Number(t.tipAmount), 0);
      const totalStripeFees = result.data.reduce((sum, t) => sum + Number(t.cleanerStripeFeeShare), 0);
      const totalReceived = result.data.reduce((sum, t) => sum + Number(t.remainingTip), 0);

      res.json({
        tips: result.data,
        total: result.total,
        summary: {
          totalTips,
          totalStripeFees,
          totalReceived,
          count: result.data.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start shift
  app.post("/api/cleaner/start-shift", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const { latitude, longitude } = req.body;
      const shift = await storage.startShift(cleaner.id, latitude, longitude);
      
      // Automatically set cleaner status to ON_DUTY when starting shift
      await storage.updateCleaner(cleaner.id, { status: CleanerStatus.ON_DUTY });
      
      res.json(shift);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // End shift
  app.post("/api/cleaner/end-shift", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const { latitude, longitude } = req.body;
      await storage.endShift(cleaner.id, latitude, longitude);
      
      // Automatically set cleaner status to OFF_DUTY when ending shift
      await storage.updateCleaner(cleaner.id, { status: CleanerStatus.OFF_DUTY });
      
      res.json({ message: "Shift ended successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get active shift
  app.get("/api/cleaner/shift-status", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const activeShift = await storage.getActiveShift(cleaner.id);
      res.json({ activeShift, cleaner });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get shift history
  app.get("/api/cleaner/shift-history", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const filters: any = {};
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string);
      } else {
        filters.limit = 100;
      }
      
      const history = await storage.getCleanerShiftHistory(cleaner.id, filters);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept job (single cleaner can accept with locking)
  app.post("/api/cleaner/accept-job/:jobId", requireRole(UserRole.CLEANER), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const jobId = parseInt(req.params.jobId);
      const accepted = await storage.acceptJob(jobId, cleaner.id);
      
      if (!accepted) {
        return res.status(409).json({ message: "Job already assigned or not available" });
      }
      
      const job = await storage.getJob(jobId);
      
      // Send push notification
      if (job) {
        PushNotificationService.notifyJobStatusChange(jobId, JobStatus.ASSIGNED, {
          carPlateNumber: job.carPlateNumber,
          cleanerName: req.user?.displayName,
          customerId: job.customerId || undefined,
        }).catch(err => console.error('Push notification failed:', err));
        
        // Send email notification if customer provided email
        const company = await storage.getCompany(job.companyId);
        if (company && job.customerEmail) {
          await sendJobStatusEmail(job, company, 'assigned', req.user?.displayName);
        }
        
        // Broadcast update via WebSocket
        broadcastJobUpdate(job);
      }
      
      res.json({ message: "Job accepted successfully", job });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Toggle cleaner availability
  app.post("/api/cleaner/toggle-status", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (cleaner) {
        await storage.updateCleaner(cleaner.id, { status });
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Cleaner not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update cleaner location
  app.post("/api/cleaner/update-location", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const { latitude, longitude } = req.body;
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (cleaner) {
        await storage.updateCleaner(cleaner.id, { 
          currentLatitude: latitude.toString(),
          currentLongitude: longitude.toString(),
          lastLocationUpdate: new Date(),
        });
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Cleaner not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate payment QR token for cleaner
  app.post("/api/cleaner/generate-qr-token", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.createCleanerPaymentToken(cleaner.id, cleaner.companyId, token, expiresAt);

      res.json({ token, expiresAt });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get available jobs for cleaner
  app.get("/api/cleaner/available-jobs", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (!cleaner) {
        return res.json([]);
      }

      // Get paid jobs for this company without a cleaner assigned
      const allJobs = await storage.getJobsByCompany(cleaner.companyId, JobStatus.PAID);
      
      // Check if cleaner is assigned to all geofences
      const assignedToAll = await storage.isCleanerAssignedToAllGeofences(cleaner.id);
      
      if (assignedToAll) {
        return res.json(allJobs);
      }
      
      // Get cleaner's assigned geofences
      const assignedGeofences = await storage.getCleanerGeofenceAssignments(cleaner.id);
      
      // If no geofences assigned, show no jobs
      if (assignedGeofences.length === 0) {
        return res.json([]);
      }
      
      // Filter jobs by geofence assignment
      const filteredJobs = allJobs.filter(job => {
        const lat = Number(job.locationLatitude);
        const lon = Number(job.locationLongitude);
        
        // Check if job location is within any assigned geofence
        return assignedGeofences.some(geofence => {
          const polygon = geofence.polygon as Array<[number, number]>;
          if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
            return false;
          }
          return isPointInPolygon(lat, lon, polygon);
        });
      });
      
      res.json(filteredJobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cleaner's active jobs
  app.get("/api/cleaner/my-jobs", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      const cleaner = await storage.getCleanerByUserId(req.user!.id);

      if (!cleaner) {
        return res.json([]);
      }

      const jobs = await storage.getJobsByCleaner(cleaner.id);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept job (uses transactional locking)
  app.post("/api/cleaner/accept-job/:jobId", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner profile not found" });
      }
      
      const jobId = parseInt(req.params.jobId);
      const accepted = await storage.acceptJob(jobId, cleaner.id);
      
      if (!accepted) {
        return res.status(409).json({ message: "Job already assigned or not available" });
      }
      
      const job = await storage.getJob(jobId);
      
      // Send push notification
      if (job) {
        PushNotificationService.notifyJobStatusChange(jobId, JobStatus.ASSIGNED, {
          carPlateNumber: job.carPlateNumber,
          cleanerName: req.user?.displayName,
          customerId: job.customerId || undefined,
        }).catch(err => console.error('Push notification failed:', err));
        
        // Send email notification if customer provided email
        const company = await storage.getCompany(job.companyId);
        if (company && job.customerEmail) {
          await sendJobStatusEmail(job, company, 'assigned', req.user?.displayName);
        }
        
        // Broadcast update via WebSocket
        broadcastJobUpdate(job);
      }
      
      res.json({ message: "Job accepted successfully", job });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start job
  app.post("/api/cleaner/start-job/:jobId", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      await storage.updateJob(parseInt(jobId), {
        status: JobStatus.IN_PROGRESS,
        startedAt: new Date(),
      });
      
      const startedJob = await storage.getJob(parseInt(jobId));
      
      // Send push notification
      if (startedJob) {
        PushNotificationService.notifyJobStatusChange(parseInt(jobId), JobStatus.IN_PROGRESS, {
          carPlateNumber: startedJob.carPlateNumber,
          cleanerName: req.user?.displayName,
          customerId: startedJob.customerId || undefined,
        }).catch(err => console.error('Push notification failed:', err));
        
        // Send email notification if customer provided email
        const company = await storage.getCompany(startedJob.companyId);
        if (company && startedJob.customerEmail) {
          await sendJobStatusEmail(startedJob, company, 'in_progress', req.user?.displayName);
        }
        
        // Broadcast job start
        broadcastJobUpdate(startedJob);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update estimated times for job
  app.patch("/api/cleaner/update-estimated-times/:jobId", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { estimatedStartTime, estimatedFinishTime } = req.body;

      // Validate job ID
      if (!jobId || isNaN(parseInt(jobId))) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      // Validate request body - at least one time should be provided
      if (!estimatedStartTime && !estimatedFinishTime) {
        return res.status(400).json({ message: "At least one estimated time must be provided" });
      }

      const job = await storage.getJob(parseInt(jobId));
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Verify the cleaner owns this job
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (!cleaner) {
        return res.status(403).json({ message: "Cleaner profile not found" });
      }
      
      if (job.cleanerId !== cleaner.id) {
        return res.status(403).json({ message: "Not authorized to update this job" });
      }

      // Validate dates are in the future
      const now = new Date();
      if (estimatedStartTime && new Date(estimatedStartTime) < now) {
        return res.status(400).json({ message: "Estimated start time must be in the future" });
      }
      if (estimatedFinishTime && new Date(estimatedFinishTime) < now) {
        return res.status(400).json({ message: "Estimated finish time must be in the future" });
      }

      await storage.updateJob(parseInt(jobId), {
        estimatedStartTime: estimatedStartTime ? new Date(estimatedStartTime) : undefined,
        estimatedFinishTime: estimatedFinishTime ? new Date(estimatedFinishTime) : undefined,
      });

      const updatedJob = await storage.getJob(parseInt(jobId));
      
      // Broadcast update via WebSocket
      if (updatedJob) {
        broadcastJobUpdate(updatedJob);
      }

      res.json({ success: true, job: updatedJob });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Complete job with proof
  app.post("/api/cleaner/complete-job/:jobId", requireRole(UserRole.CLEANER), requireActiveCleaner(storage), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { proofPhotoURL } = req.body;

      const job = await storage.getJob(parseInt(jobId));
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Atomic idempotency check - prevent duplicate completion using storage layer
      const receiptNumber = generateReceiptNumber();
      const completedAt = new Date();
      
      const result = await storage.completeJobIfNotCompleted(parseInt(jobId), {
        proofPhotoURL,
        receiptNumber,
        completedAt,
      });

      // If job was already completed, return success without processing
      if (!result.updated) {
        console.log(`[Job Complete] Job ${jobId} already completed - ignoring duplicate request`);
        return res.json({ success: true, message: "Job already completed" });
      }
      
      const completedJob = result.job;
      
      // Generate receipt PDF
      if (completedJob) {
        try {
          const platformSettings = await storage.getAllPlatformSettings();
          const settings = platformSettings[0] || {
            id: 1,
            companyName: 'Washapp.ae',
            companyAddress: 'Dubai, United Arab Emirates',
            vatRegistrationNumber: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const fullPlateNumber = completedJob.carPlateEmirate && completedJob.carPlateCode
            ? `${completedJob.carPlateEmirate} ${completedJob.carPlateCode} ${completedJob.carPlateNumber}`
            : completedJob.carPlateNumber;

          // Get actual financial data from job_financials table
          const jobFinancials = await storage.getJobFinancialsByJobId(completedJob.id);
          
          // Use actual amounts from financials, or fallback to calculated values
          let baseJobAmount: number;
          let platformFeeAmount: number;
          let tipAmount: number;
          let vatAmount: number;
          
          if (jobFinancials) {
            // Use actual values from financial record
            baseJobAmount = Number(jobFinancials.baseJobAmount);
            platformFeeAmount = Number(jobFinancials.platformFeeAmount);
            tipAmount = Number(jobFinancials.tipAmount);
            vatAmount = Number(jobFinancials.taxAmount);
          } else {
            // Fallback for legacy jobs: use stored values from job record
            baseJobAmount = Number(completedJob.price);
            tipAmount = Number(completedJob.tipAmount || 0);
            vatAmount = Number(completedJob.taxAmount || 0);
            
            // Derive platform fee from total
            // total = service + VAT + tip
            // service = carWash + platformFee
            // platformFee = total - carWash - VAT - tip
            const totalAmount = Number(completedJob.totalAmount);
            platformFeeAmount = Number((totalAmount - baseJobAmount - vatAmount - tipAmount).toFixed(2));
            
            // Ensure platform fee is non-negative (guard against data inconsistencies)
            if (platformFeeAmount < 0) platformFeeAmount = 0;
          }
          
          const totalAmount = Number(completedJob.totalAmount);

          await generateReceipt({
            receiptData: {
              receiptNumber,
              jobId: completedJob.id,
              carPlateNumber: fullPlateNumber,
              customerPhone: completedJob.customerPhone,
              customerEmail: completedJob.customerEmail || undefined,
              locationAddress: completedJob.locationAddress,
              servicePrice: baseJobAmount,
              platformFee: platformFeeAmount,
              tipAmount,
              vatAmount,
              totalAmount,
              paymentMethod: completedJob.paymentMethod || 'card',
              completedAt,
            },
            platformSettings: settings,
          });
        } catch (receiptError) {
          console.error('Failed to generate receipt:', receiptError);
        }
        
        // Send push notification
        PushNotificationService.notifyJobStatusChange(parseInt(jobId), JobStatus.COMPLETED, {
          carPlateNumber: completedJob.carPlateNumber,
          cleanerName: req.user?.displayName,
          customerId: completedJob.customerId || undefined,
        }).catch(err => console.error('Push notification failed:', err));
        
        // Send email notification with receipt
        const company = await storage.getCompany(completedJob.companyId);
        if (company) {
          await sendJobStatusEmail(completedJob, company, 'completed', req.user?.displayName);
        }
        
        // Broadcast job completion
        broadcastJobUpdate(completedJob);
      }

      // Update cleaner status back to on-duty
      const cleaner = await storage.getCleanerByUserId(req.user!.id);
      if (cleaner) {
        await storage.updateCleaner(cleaner.id, {
          status: CleanerStatus.ON_DUTY,
          totalJobsCompleted: cleaner.totalJobsCompleted + 1,
        });

        // Update company stats
        const company = await storage.getCompany(job.companyId);
        if (company) {
          await storage.updateCompany(company.id, {
            totalJobsCompleted: company.totalJobsCompleted + 1,
            totalRevenue: (parseFloat(company.totalRevenue as any) + parseFloat(job.price as any)).toString(),
          });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== COMPANY ADMIN ROUTES =====

  // Get company analytics
  app.get("/api/company/analytics", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const analytics = await storage.getCompanyAnalytics(req.user.companyId);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company cleaners
  app.get("/api/company/cleaners", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleaners = await storage.getCompanyCleaners(req.user.companyId);
      
      // Fetch geofence assignments for each cleaner
      const cleanersWithGeofences = await Promise.all(
        cleaners.map(async (cleaner) => {
          const geofences = await storage.getCleanerGeofenceAssignments(cleaner.id);
          const isAssignedAll = await storage.isCleanerAssignedToAllGeofences(cleaner.id);
          
          return {
            ...cleaner,
            assignedGeofences: geofences,
            isAssignedToAll: isAssignedAll,
          };
        })
      );
      
      res.json(cleanersWithGeofences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company shift history
  app.get("/api/company/shift-history", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const filters: any = {};
      
      if (req.query.cleanerId) {
        filters.cleanerId = parseInt(req.query.cleanerId as string);
      }
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string);
      }
      
      const shifts = await storage.getCompanyShiftHistory(req.user.companyId, filters);
      res.json(shifts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Deactivate a cleaner
  app.post("/api/company/cleaners/:cleanerId/deactivate", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleanerId = parseInt(req.params.cleanerId);
      if (isNaN(cleanerId)) {
        return res.status(400).json({ message: "Invalid cleaner ID" });
      }

      // Get cleaner to verify it belongs to the company
      const cleaner = await storage.getCleaner(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      if (cleaner.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "You can only deactivate cleaners from your own company" });
      }

      // Deactivate the cleaner and set to off-duty
      await storage.updateCleaner(cleanerId, { isActive: 0, status: "off_duty" });

      // Immediately destroy all sessions for this cleaner to force logout
      // The requireActiveCleaner middleware will also catch them on next request
      if (sessionStore.all) {
        try {
          const sessions = await new Promise<any[]>((resolve, reject) => {
            sessionStore.all!((err: any, sessions: any) => {
              if (err) reject(err);
              else resolve(sessions || []);
            });
          });

          // Find and destroy sessions for this cleaner's user
          for (const session of sessions) {
            if (session.passport?.user?.id === cleaner.userId) {
              sessionStore.destroy(session.sid, (err: any) => {
                if (err) console.error('Failed to destroy session:', err);
              });
            }
          }
        } catch (sessionError) {
          console.error('Failed to destroy sessions:', sessionError);
          // Continue anyway - middleware will catch them on next request
        }
      }
      
      res.json({ success: true, message: "Cleaner deactivated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reactivate a cleaner
  app.post("/api/company/cleaners/:cleanerId/reactivate", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleanerId = parseInt(req.params.cleanerId);
      if (isNaN(cleanerId)) {
        return res.status(400).json({ message: "Invalid cleaner ID" });
      }

      // Get cleaner to verify it belongs to the company
      const cleaner = await storage.getCleaner(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      if (cleaner.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "You can only reactivate cleaners from your own company" });
      }

      // Reactivate the cleaner
      await storage.updateCleaner(cleanerId, { isActive: 1 });
      
      res.json({ success: true, message: "Cleaner reactivated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company invitations
  app.get("/api/company/invitations", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const invitations = await storage.getCompanyInvitations(req.user.companyId);
      res.json(invitations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invite cleaner by phone number
  app.post("/api/company/invite-cleaner", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const { phoneNumber, geofenceIds, assignAll } = req.body;

      // Check if phone number already has an invitation
      const existing = await storage.getInvitationByPhone(phoneNumber);
      if (existing) {
        return res.status(400).json({ message: "Phone number already invited" });
      }

      // Check cleaner limit for subscription packages
      const company = await storage.getCompany(req.user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      if (company.packageType === 'subscription' && company.subscriptionCleanerSlots) {
        const activeCleaners = await storage.getCompanyCleaners(req.user.companyId);
        const activeCount = activeCleaners.filter(c => c.isActive === 1).length;
        const pendingInvitations = await storage.getCompanyInvitations(req.user.companyId);
        const pendingCount = pendingInvitations.filter(inv => inv.status === 'pending').length;
        const totalCount = activeCount + pendingCount;

        if (totalCount >= company.subscriptionCleanerSlots) {
          return res.status(400).json({ 
            message: `Cleaner limit reached. Your subscription allows ${company.subscriptionCleanerSlots} cleaners. You currently have ${activeCount} active cleaners and ${pendingCount} pending invitations. Please upgrade your subscription to invite more cleaners.`
          });
        }
      }

      // Validate geofence IDs if provided
      if (geofenceIds && Array.isArray(geofenceIds) && geofenceIds.length > 0) {
        const companyGeofences = await storage.getCompanyGeofences(req.user.companyId);
        const validGeofenceIds = companyGeofences.map(g => g.id);
        const invalidIds = geofenceIds.filter(id => !validGeofenceIds.includes(id));
        
        if (invalidIds.length > 0) {
          return res.status(400).json({ message: "Invalid geofence IDs provided" });
        }
      }

      // Create invitation
      const invitation = await storage.createInvitation({
        companyId: req.user.companyId,
        phoneNumber,
        invitedBy: req.user.id,
        status: "pending",
      });

      // Assign geofences to invitation
      if (assignAll || (geofenceIds && geofenceIds.length > 0)) {
        await storage.assignGeofencesToInvitation(
          invitation.id,
          req.user.companyId,
          geofenceIds || [],
          assignAll || false
        );
      }

      res.json(invitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cleaner geofence assignments
  app.get("/api/company/cleaners/:cleanerId/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleanerId = parseInt(req.params.cleanerId);
      if (isNaN(cleanerId)) {
        return res.status(400).json({ message: "Invalid cleaner ID" });
      }

      const cleaner = await storage.getCleaner(cleanerId);
      if (!cleaner || cleaner.companyId !== req.user.companyId) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      const geofences = await storage.getCleanerGeofenceAssignments(cleanerId);
      const assignAll = await storage.isCleanerAssignedToAllGeofences(cleanerId);
      
      res.json({ geofences, assignAll });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update cleaner geofence assignments
  app.put("/api/company/cleaners/:cleanerId/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const cleanerId = parseInt(req.params.cleanerId);
      if (isNaN(cleanerId)) {
        return res.status(400).json({ message: "Invalid cleaner ID" });
      }

      const { geofenceIds, assignAll } = req.body;

      const cleaner = await storage.getCleaner(cleanerId);
      if (!cleaner || cleaner.companyId !== req.user.companyId) {
        return res.status(404).json({ message: "Cleaner not found" });
      }

      if (geofenceIds && Array.isArray(geofenceIds) && geofenceIds.length > 0) {
        const companyGeofences = await storage.getCompanyGeofences(req.user.companyId);
        const validGeofenceIds = companyGeofences.map(g => g.id);
        const invalidIds = geofenceIds.filter(id => !validGeofenceIds.includes(id));
        
        if (invalidIds.length > 0) {
          return res.status(400).json({ message: "Invalid geofence IDs provided" });
        }
      }

      await storage.assignGeofencesToCleaner(
        cleanerId,
        req.user.companyId,
        geofenceIds || [],
        assignAll || false
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get invitation geofence assignments
  app.get("/api/company/invitations/:invitationId/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const invitationId = parseInt(req.params.invitationId);
      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      const invitations = await storage.getCompanyInvitations(req.user.companyId);
      const invitation = invitations.find(inv => inv.id === invitationId);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      const geofences = await storage.getInvitationGeofenceAssignments(invitationId);
      
      res.json({ geofences });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update invitation geofence assignments
  app.put("/api/company/invitations/:invitationId/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const invitationId = parseInt(req.params.invitationId);
      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      const { geofenceIds, assignAll } = req.body;

      const invitations = await storage.getCompanyInvitations(req.user.companyId);
      const invitation = invitations.find(inv => inv.id === invitationId);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (geofenceIds && Array.isArray(geofenceIds) && geofenceIds.length > 0) {
        const companyGeofences = await storage.getCompanyGeofences(req.user.companyId);
        const validGeofenceIds = companyGeofences.map(g => g.id);
        const invalidIds = geofenceIds.filter(id => !validGeofenceIds.includes(id));
        
        if (invalidIds.length > 0) {
          return res.status(400).json({ message: "Invalid geofence IDs provided" });
        }
      }

      await storage.assignGeofencesToInvitation(
        invitationId,
        req.user.companyId,
        geofenceIds || [],
        assignAll || false
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company geofence
  app.get("/api/company/geofence", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const company = await storage.getCompany(req.user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json({ geofenceArea: company.geofenceArea || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update company geofence
  app.put("/api/company/geofence", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const { geofenceArea } = req.body;

      // Validate geofenceArea is an array of coordinate pairs
      if (geofenceArea && (!Array.isArray(geofenceArea) || !geofenceArea.every(coord => 
        Array.isArray(coord) && coord.length === 2 && 
        typeof coord[0] === 'number' && typeof coord[1] === 'number'
      ))) {
        return res.status(400).json({ message: "Invalid geofence format. Expected array of [lat, lng] pairs" });
      }

      await storage.updateCompany(req.user.companyId, { geofenceArea });
      
      res.json({ success: true, geofenceArea });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== COMPANY GEOFENCES ROUTES (Multiple Geofences) =====

  // Get all company geofences
  app.get("/api/company/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const geofences = await storage.getCompanyGeofences(req.user.companyId);
      res.json(geofences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new geofence
  app.post("/api/company/geofences", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const { name, polygon } = req.body;

      // Validate name
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Validate polygon is an array of coordinate pairs with at least 3 points
      if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
        return res.status(400).json({ message: "Polygon must have at least 3 points" });
      }

      if (!polygon.every((coord: any) => 
        Array.isArray(coord) && coord.length === 2 && 
        typeof coord[0] === 'number' && typeof coord[1] === 'number'
      )) {
        return res.status(400).json({ message: "Invalid polygon format. Expected array of [lat, lng] pairs" });
      }

      // Check for duplicate name
      const existing = await storage.getGeofenceByCompanyAndName(req.user.companyId, name.trim());
      if (existing) {
        return res.status(409).json({ message: "A geofence with this name already exists" });
      }

      const geofence = await storage.createGeofence({
        companyId: req.user.companyId,
        name: name.trim(),
        polygon,
      });

      res.status(201).json(geofence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a geofence (name or polygon)
  app.patch("/api/company/geofences/:geofenceId", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const geofenceId = parseInt(req.params.geofenceId);
      if (isNaN(geofenceId)) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }

      // Verify geofence exists and belongs to the company
      const geofence = await storage.getGeofence(geofenceId);
      if (!geofence) {
        return res.status(404).json({ message: "Geofence not found" });
      }

      if (geofence.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { name, polygon } = req.body;
      const updates: Partial<Pick<typeof geofence, 'name' | 'polygon'>> = {};

      // Validate and add name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: "Name must be a non-empty string" });
        }

        // Check for duplicate name (excluding current geofence)
        const existing = await storage.getGeofenceByCompanyAndName(req.user.companyId, name.trim());
        if (existing && existing.id !== geofenceId) {
          return res.status(409).json({ message: "A geofence with this name already exists" });
        }

        updates.name = name.trim();
      }

      // Validate and add polygon if provided
      if (polygon !== undefined) {
        if (!Array.isArray(polygon) || polygon.length < 3) {
          return res.status(400).json({ message: "Polygon must have at least 3 points" });
        }

        if (!polygon.every((coord: any) => 
          Array.isArray(coord) && coord.length === 2 && 
          typeof coord[0] === 'number' && typeof coord[1] === 'number'
        )) {
          return res.status(400).json({ message: "Invalid polygon format. Expected array of [lat, lng] pairs" });
        }

        updates.polygon = polygon;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      await storage.updateGeofence(geofenceId, updates);

      // Fetch and return updated geofence
      const updatedGeofence = await storage.getGeofence(geofenceId);
      res.json(updatedGeofence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a geofence
  app.delete("/api/company/geofences/:geofenceId", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }

      const geofenceId = parseInt(req.params.geofenceId);
      if (isNaN(geofenceId)) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }

      // Verify geofence exists and belongs to the company
      const geofence = await storage.getGeofence(geofenceId);
      if (!geofence) {
        return res.status(404).json({ message: "Geofence not found" });
      }

      if (geofence.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteGeofence(geofenceId);
      res.json({ success: true, message: "Geofence deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== ADMIN ROUTES =====

  // Get platform analytics
  app.get("/api/admin/analytics", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      const analytics = await storage.getAdminAnalytics();
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get platform settings
  app.get("/api/admin/platform-settings", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      const settings = await storage.getAllPlatformSettings();
      res.json(settings[0] || {
        id: 1,
        companyName: 'Washapp.ae',
        companyAddress: 'Dubai, United Arab Emirates',
        vatRegistrationNumber: '',
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update platform settings
  app.patch("/api/admin/platform-settings", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyName, companyAddress, vatRegistrationNumber, logoUrl } = req.body;
      await storage.updatePlatformSettings(1, {
        companyName,
        companyAddress,
        vatRegistrationNumber,
        logoUrl,
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending companies for approval
  app.get("/api/admin/pending-companies", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      
      const companies = await storage.getPendingCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve company
  app.post("/api/admin/approve-company/:companyId", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const { platformFee, feePackageType } = req.body;
      await storage.approveCompany(parseInt(companyId), platformFee, feePackageType);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reject company
  app.post("/api/admin/reject-company/:companyId", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      await storage.rejectCompany(parseInt(companyId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update company fee structure
  app.patch("/api/admin/company/:companyId/fee-structure", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const { platformFee, feePackageType } = req.body;
      
      const updateData: any = {};
      if (platformFee !== undefined) {
        updateData.platformFee = platformFee.toString();
      }
      if (feePackageType) {
        updateData.feePackageType = feePackageType;
      }
      
      await storage.updateCompany(parseInt(companyId), updateData);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== ADMIN FINANCIAL ROUTES ====
  
  // Get all companies financial summary
  app.get("/api/admin/financials/companies", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const summary = await storage.getAllCompaniesFinancialSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get detailed company financials
  app.get("/api/admin/financials/company/:companyId", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const { page, pageSize } = req.query;
      
      const filters: any = {};
      if (page) filters.page = parseInt(page as string);
      if (pageSize) filters.pageSize = parseInt(pageSize as string);
      
      const summary = await storage.getCompanyFinancialSummary(parseInt(companyId));
      const jobsResult = await storage.getCompanyFinancials(parseInt(companyId), filters);
      const withdrawals = await storage.getCompanyWithdrawals(parseInt(companyId));
      
      res.json({
        summary,
        jobs: jobsResult.data,
        jobsTotal: jobsResult.total,
        withdrawals,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all withdrawals (admin)
  app.get("/api/admin/financials/withdrawals", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Process withdrawal (update status)
  app.patch("/api/admin/financials/withdrawals/:id", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, referenceNumber, note } = req.body;
      
      const updates: any = { status };
      if (referenceNumber) updates.referenceNumber = referenceNumber;
      if (note) updates.note = note;
      if (status === 'completed') {
        updates.processedAt = new Date();
        updates.processedBy = (req.user as any).id;
      }
      
      await storage.updateWithdrawal(parseInt(id), updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company transactions
  app.get("/api/admin/financials/company/:companyId/transactions", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      const { companyId } = req.params;
      const transactions = await storage.getCompanyTransactions(parseInt(companyId));
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create admin payout transaction (tracks money paid to company from their revenue)
  app.post("/api/admin/financials/company/:companyId/transactions", requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const { amount, description } = req.body;

      const amountNumber = Number(amount);
      if (!amountNumber || amountNumber <= 0) {
        return res.status(400).json({ message: "Amount must be greater than 0" });
      }

      if (!description || description.trim().length === 0) {
        return res.status(400).json({ message: "Description is required" });
      }

      const summary = await storage.getCompanyFinancialSummary(parseInt(companyId));
      if (amountNumber > summary.availableBalance) {
        return res.status(400).json({ message: "Payout amount exceeds available balance" });
      }

      const referenceNumber = `PAY-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const transaction = await storage.createTransaction({
        referenceNumber,
        type: 'admin_payment',
        direction: 'debit',
        companyId: parseInt(companyId),
        amount: amountNumber.toString(),
        currency: 'AED',
        description,
      });

      res.json(transaction);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== COMPANY FINANCIAL ROUTES ====
  
  // Get company financial overview
  app.get("/api/company/financials/overview", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const summary = await storage.getCompanyFinancialSummary(companyId);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company job financials with filters
  app.get("/api/company/financials/jobs", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const { cleanerId, startDate, endDate, page, pageSize } = req.query;
      
      const filters: any = {};
      if (cleanerId) filters.cleanerId = parseInt(cleanerId as string);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (page) filters.page = parseInt(page as string);
      if (pageSize) filters.pageSize = parseInt(pageSize as string);
      
      const result = await storage.getCompanyFinancials(companyId, filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company withdrawals
  app.get("/api/company/financials/withdrawals", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const withdrawals = await storage.getCompanyWithdrawals(companyId);
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get company admin payment transactions
  app.get("/api/company/financials/admin-payouts", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const transactions = await storage.getCompanyTransactions(companyId);
      const adminPayouts = transactions.filter(t => t.type === 'admin_payment');
      res.json(adminPayouts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all company transactions (for transaction history)
  app.get("/api/company/financials/transactions", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const transactions = await storage.getCompanyTransactions(companyId);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export financials to Excel
  app.post("/api/company/financials/export", requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company not found for user" });
      }
      
      const { cleanerId, startDate, endDate } = req.body;
      
      const filters: any = {};
      if (cleanerId) filters.cleanerId = parseInt(cleanerId);
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      
      // Get all jobs (no pagination for Excel export)
      const jobsResult = await storage.getCompanyFinancials(companyId, { ...filters, page: 1, pageSize: 10000 });
      const jobs = jobsResult.data;
      const summary = await storage.getCompanyFinancialSummary(companyId);
      const company = await storage.getCompany(companyId);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Financial Report');
      
      worksheet.columns = [
        { header: 'Job ID', key: 'jobId', width: 10 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Receipt Number', key: 'receiptNumber', width: 20 },
        { header: 'Stripe Payment ID', key: 'stripePaymentId', width: 30 },
        { header: 'Stripe Refund ID', key: 'stripeRefundId', width: 30 },
        { header: 'Paid At', key: 'paidAt', width: 20 },
        { header: 'Cleaner Name', key: 'cleanerName', width: 20 },
        { header: 'Base Amount', key: 'baseAmount', width: 12 },
        { header: 'Base Tax', key: 'baseTax', width: 12 },
        { header: 'Total Tip', key: 'totalTip', width: 12 },
        { header: 'Tip VAT', key: 'tipVat', width: 12 },
        { header: 'Remaining Tip', key: 'remainingTip', width: 15 },
        { header: 'Platform Fee', key: 'platformFee', width: 12 },
        { header: 'Platform Tax', key: 'platformTax', width: 12 },
        { header: 'Stripe Fee', key: 'stripeFee', width: 12 },
        { header: 'Gross Amount', key: 'grossAmount', width: 15 },
        { header: 'Net Amount', key: 'netAmount', width: 15 },
      ];
      
      jobs.forEach(job => {
        const isPackage2 = (job.feePackageType || 'custom').toLowerCase() === 'package2';
        const tipAmount = parseFloat(job.tipAmount || "0");
        const tipTax = parseFloat(job.tipTax || "0");
        const totalTip = tipAmount + tipTax;
        const remainingTip = parseFloat(job.remainingTip || "0");
        
        const jobStatus = (job as any).jobStatus;
        const statusDisplay = jobStatus === 'refunded_unattended' ? 'Refunded (Unattended)' :
                            jobStatus === 'refunded' ? 'Refunded (Manual)' :
                            jobStatus?.toUpperCase() || 'N/A';
        
        worksheet.addRow({
          jobId: job.jobId,
          status: statusDisplay,
          receiptNumber: (job as any).receiptNumber || '-',
          stripePaymentId: (job as any).stripePaymentIntentId || '-',
          stripeRefundId: (job as any).stripeRefundId || '-',
          paidAt: new Date(job.paidAt).toLocaleString(),
          cleanerName: job.cleanerName || 'N/A',
          baseAmount: parseFloat(job.baseJobAmount || "0").toFixed(2),
          baseTax: parseFloat(job.baseTax || "0").toFixed(2),
          totalTip: totalTip > 0 ? totalTip.toFixed(2) : '-',
          tipVat: totalTip > 0 ? tipTax.toFixed(2) : '-',
          remainingTip: totalTip > 0 ? remainingTip.toFixed(2) : '-',
          platformFee: parseFloat(job.platformFeeAmount || "0").toFixed(2),
          platformTax: parseFloat(job.platformFeeTax || "0").toFixed(2),
          stripeFee: isPackage2 ? parseFloat(job.paymentProcessingFeeAmount || "0").toFixed(2) : '-',
          grossAmount: parseFloat(job.grossAmount || "0").toFixed(2),
          netAmount: parseFloat(job.netPayableAmount || "0").toFixed(2),
        });
      });
      
      worksheet.addRow({});
      worksheet.addRow({
        jobId: 'TOTAL',
        grossAmount: summary.totalRevenue.toFixed(2),
        platformFee: summary.platformFees.toFixed(2),
        processingFee: summary.paymentProcessingFees.toFixed(2),
        netAmount: summary.netEarnings.toFixed(2),
      });
      
      const totalRow = worksheet.lastRow;
      if (totalRow) {
        totalRow.font = { bold: true };
      }
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=financials-${company?.name || 'company'}-${Date.now()}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PUSH NOTIFICATION ROUTES ==========
  
  app.get("/api/push/vapid-public-key", (_req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { endpoint, keys, plateNumber, soundEnabled } = req.body;
      
      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }

      const userId = req.user?.id;
      let customerId: number | undefined;

      if (!userId && plateNumber) {
        const jobs = await storage.getJobsByPlateNumber(plateNumber, 1, 1);
        if (jobs.data.length > 0 && jobs.data[0].customerId) {
          customerId = jobs.data[0].customerId;
        } else {
          return res.status(404).json({ message: "No jobs found for this plate number" });
        }
      } else if (!userId) {
        return res.status(400).json({ message: "Authentication or plate number required" });
      }

      await storage.createPushSubscription({
        userId: userId || undefined,
        customerId: customerId || undefined,
        endpoint,
        keys,
        soundEnabled: soundEnabled || 0,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error subscribing to push notifications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint required" });
      }

      await storage.deletePushSubscription(endpoint);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error unsubscribing from push notifications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/push/settings", async (req, res) => {
    try {
      const { endpoint } = req.query;
      
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint required" });
      }

      const subscription = await storage.getPushSubscriptionByEndpoint(endpoint as string);
      
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      res.json({ soundEnabled: subscription.soundEnabled || 0 });
    } catch (error: any) {
      console.error("Error fetching push notification settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/push/update-sound", async (req, res) => {
    try {
      const { endpoint, soundEnabled } = req.body;
      
      if (!endpoint || soundEnabled === undefined) {
        return res.status(400).json({ message: "Endpoint and soundEnabled required" });
      }

      await storage.updatePushSubscriptionSound(endpoint, soundEnabled);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating push notification sound:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== EMAIL OTP ROUTES ===== 
  
  // Rate limiting map for OTP requests (email -> last request timestamp)
  const otpRateLimitMap = new Map<string, number>();
  const OTP_RATE_LIMIT_MS = 60 * 1000; // 60 seconds between requests per email
  
  // Send OTP to email (for anonymous complaint submission)
  app.post("/api/otp/send", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      // Rate limiting: Check if email requested OTP recently
      const lastRequestTime = otpRateLimitMap.get(email.toLowerCase());
      const now = Date.now();
      if (lastRequestTime && (now - lastRequestTime) < OTP_RATE_LIMIT_MS) {
        const remainingSeconds = Math.ceil((OTP_RATE_LIMIT_MS - (now - lastRequestTime)) / 1000);
        return res.status(429).json({ 
          message: `Please wait ${remainingSeconds} seconds before requesting another code`,
          remainingSeconds 
        });
      }
      
      // Update rate limit timestamp
      otpRateLimitMap.set(email.toLowerCase(), now);
      
      // Generate 6-digit OTP code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // OTP expires in 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      // Save OTP to database (this also deletes any existing unverified OTPs)
      await storage.createEmailOtp(email, code, expiresAt);
      
      // Send OTP email via Resend
      await sendEmail(
        email,
        'Verify Your Email - Washapp.ae',
        `
          <h2>Email Verification Code</h2>
          <p>Your verification code is: <strong style="font-size: 24px; color: #0ea5e9;">${code}</strong></p>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        `
      );
      
      res.json({ success: true, message: "OTP sent to email" });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });
  
  // Verify OTP code
  app.post("/api/otp/verify", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }
      
      // Check if unverified OTP exists and is valid
      const isValid = await storage.checkEmailOtp(email, code);
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP code" });
      }
      
      // Mark OTP as verified
      await storage.markEmailOtpAsVerified(email, code);
      
      // Check if this is a returning customer and fetch their phone number
      const customer = await storage.getCustomerByEmail(email);
      const phoneNumber = customer?.phoneNumber || null;
      
      res.json({ 
        success: true, 
        verified: true,
        phoneNumber // Return phone number if customer exists (null for new users)
      });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // ===== COMPLAINT ROUTES =====
  
  // Create complaint (Anonymous with Email OTP Verification)
  app.post("/api/complaints", async (req: Request, res: Response) => {
    try {
      const { jobId, type, description, email, otpCode } = req.body;
      
      // Validate inputs
      if (!jobId || !type || !description || !email || !otpCode) {
        return res.status(400).json({ message: "Job ID, type, description, email, and OTP code are required" });
      }
      
      // Validate type
      if (type !== 'refund_request' && type !== 'general') {
        return res.status(400).json({ message: "Invalid complaint type" });
      }
      
      // Verify that OTP has been verified AND marked as verified for this email
      const isOtpVerified = await storage.isEmailOtpVerified(email, otpCode);
      if (!isOtpVerified) {
        return res.status(403).json({ message: "Email not verified or OTP already used. Please verify your email again." });
      }
      
      // Get job details
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Only allow complaints for completed, cancelled, or refunded jobs
      if (job.status !== 'completed' && job.status !== 'cancelled' && job.status !== 'refunded') {
        return res.status(400).json({ message: "Can only create complaints for completed, cancelled, or refunded jobs" });
      }
      
      // Invalidate OTP immediately to prevent reuse
      await storage.invalidateEmailOtp(email, otpCode);
      
      // Create complaint
      const complaint = await storage.createComplaint({
        jobId,
        companyId: job.companyId,
        customerId: job.customerId || null,
        type,
        description,
        status: 'pending',
        customerEmail: email, // Use the verified email
        customerPhone: job.customerPhone,
      });
      
      // Send email to company admin
      try {
        const company = await storage.getCompany(job.companyId);
        if (company) {
          const companyAdmin = await storage.getUser(company.adminId);
          if (companyAdmin && companyAdmin.email) {
            const typeLabel = type === 'refund_request' ? 'Refund Request' : 'General Complaint';
            await sendEmail(
              companyAdmin.email,
              `New ${typeLabel} - Job #${job.id}`,
              `
                <h2>New Complaint Received</h2>
                <p><strong>Reference:</strong> ${complaint.referenceNumber}</p>
                <p><strong>Job ID:</strong> #${job.id}</p>
                <p><strong>Type:</strong> ${typeLabel}</p>
                <p><strong>Customer Phone:</strong> ${job.customerPhone}</p>
                <p><strong>Description:</strong></p>
                <p>${description}</p>
                <p><em>Please review and respond to this complaint in your dashboard.</em></p>
              `
            );
          }
        }
      } catch (emailError) {
        console.error('Failed to send complaint notification email:', emailError);
      }
      
      // Send confirmation email to customer (use verified OTP email)
      if (email) {
        try {
          const typeLabel = type === 'refund_request' ? 'Refund Request' : 'Complaint';
          await sendEmail(
            email,
            `${typeLabel} Received - Reference ${complaint.referenceNumber}`,
            `
              <h2>We've Received Your ${typeLabel}</h2>
              <p>Dear Customer,</p>
              <p>Thank you for contacting us. We've received your ${typeLabel.toLowerCase()} and will review it shortly.</p>
              <p><strong>Reference Number:</strong> ${complaint.referenceNumber}</p>
              <p><strong>Job ID:</strong> #${job.id}</p>
              <p><strong>Car Plate:</strong> ${job.carPlateNumber}</p>
              <p>You can use this reference number to track the status of your ${typeLabel.toLowerCase()}.</p>
              <p>We appreciate your patience and will get back to you soon.</p>
            `
          );
        } catch (emailError) {
          console.error('Failed to send customer confirmation email:', emailError);
        }
      }
      
      res.json(complaint);
    } catch (error: any) {
      console.error("Error creating complaint:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get single complaint
  app.get("/api/complaints/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const complaint = await storage.getComplaint(id);
      
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      
      res.json(complaint);
    } catch (error: any) {
      console.error("Error fetching complaint:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company complaints
  app.get("/api/company/complaints", requireAuth, requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const companyId = req.user!.companyId!;
      const complaints = await storage.getCompanyComplaints(companyId);
      
      res.json(complaints);
    } catch (error: any) {
      console.error("Error fetching company complaints:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all complaints (Admin)
  app.get("/api/admin/complaints", requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const complaints = await storage.getAllComplaints();
      res.json(complaints);
    } catch (error: any) {
      console.error("Error fetching complaints:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update complaint status (Company Admin)
  app.patch("/api/company/complaints/:id", requireAuth, requireRole(UserRole.COMPANY_ADMIN), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, resolution } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      // Validate status
      const validStatuses = ['pending', 'in_progress', 'resolved'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Require resolution for resolved status
      if (status === 'resolved' && !resolution) {
        return res.status(400).json({ message: "Resolution is required when marking as resolved" });
      }
      
      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      
      // Verify company owns this complaint
      if (complaint.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Don't allow status updates for refunded complaints
      if (complaint.status === 'refunded') {
        return res.status(400).json({ message: "Cannot update status of refunded complaint" });
      }
      
      // Update complaint
      await storage.updateComplaintStatus(id, status, req.user!.id, resolution);
      
      // Send resolution email if resolved
      if (status === 'resolved' && complaint.customerEmail && resolution) {
        try {
          const job = await storage.getJob(complaint.jobId);
          await sendEmail(
            complaint.customerEmail,
            `Complaint Resolved - ${complaint.referenceNumber}`,
            `
              <h2>Your Complaint Has Been Resolved</h2>
              <p>Dear Customer,</p>
              <p>We have reviewed and resolved your complaint.</p>
              <p><strong>Reference:</strong> ${complaint.referenceNumber}</p>
              <p><strong>Job ID:</strong> #${complaint.jobId}</p>
              ${job ? `<p><strong>Car Plate:</strong> ${job.carPlateNumber}</p>` : ''}
              <p><strong>Resolution:</strong></p>
              <p>${resolution}</p>
              <p>Thank you for your patience and for giving us the opportunity to resolve this matter.</p>
            `
          );
        } catch (emailError) {
          console.error('Failed to send resolution email:', emailError);
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating complaint:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Trigger refund (Admin or Company Admin)
  app.post("/api/complaints/:id/refund", requireAuth, async (req: Request, res: Response) => {
    try {
      // Verify role is admin or company_admin
      if (req.user!.role !== 'admin' && req.user!.role !== 'company_admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      const complaint = await storage.getComplaint(id);
      
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      
      // Verify company admin owns this complaint (or user is platform admin)
      if (req.user.role === 'company_admin' && complaint.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Get job
      const job = await storage.getJob(complaint.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Check if job can be refunded
      if (job.status === 'refunded') {
        return res.status(400).json({ message: "Job already refunded" });
      }
      
      if (!job.stripePaymentIntentId) {
        return res.status(400).json({ message: "No payment intent found for this job" });
      }
      
      // Process Stripe refund
      let refund;
      try {
        refund = await stripe.refunds.create({
          payment_intent: job.stripePaymentIntentId,
        });
      } catch (stripeError: any) {
        console.error('Stripe refund failed:', stripeError);
        return res.status(500).json({ message: `Refund failed: ${stripeError.message}` });
      }
      
      // Update job status
      await storage.updateJob(job.id, {
        status: 'refunded',
        refundedAt: new Date(),
        refundReason: `Complaint refund: ${complaint.description.substring(0, 200)}`,
        stripeRefundId: refund.id,
      });
      
      // Create refund transaction
      await storage.createTransaction({
        referenceNumber: `REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        type: 'refund',
        direction: 'debit',
        jobId: job.id,
        companyId: job.companyId,
        amount: job.totalAmount,
        currency: 'AED',
        stripeRefundId: refund.id,
        description: `Refund for complaint ${complaint.referenceNumber}`,
      });
      
      // Update complaint
      await storage.updateComplaintRefund(id, req.user.id, refund.id);
      
      // Send refund email to customer (use complaint email from verified OTP)
      if (complaint.customerEmail) {
        try {
          await sendEmail(
            complaint.customerEmail,
            `Refund Processed - ${complaint.referenceNumber}`,
            `
              <h2>Your Refund Has Been Processed</h2>
              <p>Dear Customer,</p>
              <p>We have processed a full refund for your complaint.</p>
              <p><strong>Complaint Reference:</strong> ${complaint.referenceNumber}</p>
              <p><strong>Job ID:</strong> #${job.id}</p>
              <p><strong>Car Plate:</strong> ${job.carPlateNumber}</p>
              <p><strong>Refund Amount:</strong> ${Number(job.totalAmount).toFixed(2)} AED</p>
              <p>The refund will appear in your account within 5-10 business days.</p>
              <p>We apologize for any inconvenience and thank you for your understanding.</p>
            `
          );
        } catch (emailError) {
          console.error('Failed to send refund email:', emailError);
        }
      }
      
      res.json({ success: true, refundId: refund.id });
    } catch (error: any) {
      console.error("Error processing refund:", error);
      res.status(500).json({ message: error.message });
    }
  });

  return createServer(app);
}

// Utility function for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Utility function to check if cleaner is active (on-duty and location updated within last 10 minutes)
function isCleanerActive(cleaner: Cleaner): boolean {
  if (cleaner.status !== CleanerStatus.ON_DUTY) return false;
  if (!cleaner.lastLocationUpdate) return false;
  
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const lastUpdate = new Date(cleaner.lastLocationUpdate);
  return lastUpdate >= tenMinutesAgo;
}
