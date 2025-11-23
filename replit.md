# CarWash Pro - Mobile-First Car Wash Booking Platform

## Overview
CarWash Pro is a professional, mobile-first platform designed for car wash booking, featuring an Uber-style black/white interface. The platform facilitates anonymous customer car wash requests, allows companies to manage their cleaners, and enables cleaners to complete jobs with photo verification. The project aims to capture market potential by streamlining the car wash booking process and providing comprehensive management tools for car wash businesses.

## User Preferences
I prefer simple language and clear explanations. I want iterative development with frequent, small updates. Ask before making major changes to the architecture or core functionalities. Ensure the code is clean, well-commented, and follows modern React and Node.js best practices. Do not make changes to the `uploads/` folder or modify existing environment variables without explicit confirmation.

## System Architecture

### UI/UX Decisions
-   **Design**: Mobile-first responsive design, optimized for potential app store wrapping.
-   **Theme**: Modern vibrant interface with bright blue primary color (220 95% 50%), gradient accents, and dark mode support with theme toggle.
-   **Navigation**: Role-based bottom navigation with login button in top-right for staff access (company admin, cleaner, platform admin).
-   **Mapping**: Interactive OpenStreetMap integration with Leaflet for location selection, geolocation support, and Nominatim reverse geocoding.
-   **Booking Flow**: Phone-first 4-step wizard (Phone Number → Car Details → Location & Company → Payment) with persistent progress indicator showing "Step X of 4", framer-motion animations, and mobile-first design. Step 1 has dedicated button, steps 2-3 use sticky bottom CTA. Reuses existing checkout component to avoid code duplication.

### Technical Implementations
-   **Frontend**: React, Tailwind CSS, shadcn/ui components, Roboto font, Framer Motion for animations.
-   **Backend**: Express.js, Node.js.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Authentication**: Passport.js with bcrypt for email/password (staff roles), `connect-pg-simple` for PostgreSQL session storage. Auto-admin setup on server startup ensures production admin account exists with correct credentials. Session cookies configured with `sameSite: 'none'` in production for cross-origin requests, `trust proxy: 1` enabled for HTTPS load balancers. Password reset functionality with secure token-based flow, 1-hour expiration, and email notifications via Resend.
-   **Payments**: Stripe integration for customer payments in AED currency.
-   **Email**: Resend for notifications.
-   **Real-time**: WebSocket server for job status updates.
-   **File Uploads**: Multer for local file storage (job photos, trade licenses).
-   **Location**: Geofence polygon matching using ray-casting algorithm for point-in-polygon checks. Companies can define multiple named service areas.
-   **Security**: Session-based authentication with cross-origin cookie support (SameSite=None in production, Lax in dev), CSRF protection, role-based access control, Stripe webhook signature verification. Push notification coordinates validated server-side using Number.isFinite to prevent abuse while allowing legitimate zero values (equator/prime meridian).
-   **PWA**: Progressive Web App implementation with service worker for offline capabilities, web app manifest for installability, and install prompt UI. Users can install the app on their mobile devices for an app-like experience.
-   **Push Notifications**: Web Push API for real-time alerts to customers and cleaners. Cleaners receive notifications when new jobs become available in their service areas. Features include: sound preferences, stale subscription cleanup (410/404 responses), structured error logging with delivery summaries, parallel geofence eligibility checks to avoid N+1 queries, and post-subscribe UI synchronization.
-   **Performance Optimization**: Consolidated API endpoints reduce HTTP roundtrips. Cleaner dashboard uses single `/api/cleaner/dashboard` endpoint that fetches profile, shift status, and jobs in parallel (Promise.all) instead of 4 separate requests. Polling only active when cleaner is on duty. Mutations use single invalidation pattern (no double refetch). Push notification eligibility checks run in parallel using Promise.allSettled.
-   **Cache Management**: Zero API data caching - service worker excludes `/api/*`, React Query uses `staleTime: 0`, global no-cache headers on all API responses. Automatic version checking (`version.json`) with cache invalidation and page reload on deployment updates.
-   **Admin Auto-Setup**: Server automatically creates/updates admin account on startup (server/utils/ensureAdmin.ts) ensuring production always has correct credentials (omer.eldirdieri@gmail.com / Network#123).

### Feature Specifications
-   **Customer Booking Flow**: Phone-first 4-step wizard at `/customer/booking`:
    -   **Step 1 - Phone Number**: Phone number entry with smart auto-fill (single car auto-fills, multiple cars show selection grid, new users see blank form)
    -   **Step 2 - Car Details**: Animated car plate entry with gradient icon backgrounds (phone number NOT shown here - captured in step 1)
    -   **Step 3 - Location & Company**: Integrated map location picker with geofence-based company matching (only companies with service areas containing the customer location are shown), company selection with pricing display
    -   **Step 4 - Payment**: Redirects to existing `/customer/checkout` page to complete Stripe payment (reuses checkout component to avoid code duplication)
    -   **Features**: Persistent progress indicator showing "Step X of 4", framer-motion animations for smooth transitions, mobile-first responsive design, gradient accents and vibrant colors, dual search tracking (phone OR car plate) with URL sync
-   **Customer Flow**: Anonymous booking with car plate entry, map-based location selection, geofence-based company matching, Stripe payment in AED (company price + 3 AED platform fee clearly displayed in booking flow), and job tracking (Paid → Assigned → In Progress → Completed). Completed jobs remain in active tracker with full progress indicator before moving to history.
-   **Cleaner Flow**: Invitation-based registration, streamlined shift-based status (starting shift automatically sets ON_DUTY, ending shift sets OFF_DUTY), job acceptance, "Open in Google Maps" navigation to job location, and photo-based job completion. Compact header design with 40% reduced height. Periodic location tracking for on-duty cleaners. Cleaners can only see and accept jobs within their assigned service areas. Password reset available via "Forgot password?" link on login page.
-   **Company Admin Flow**: Registration (requires admin approval), multiple named geofence management with location search and GPS positioning, cleaner invitation management with service area assignment (all areas or specific areas), detailed financial reports (revenue breakdown, withdrawals, cleaner filtering, Excel export), cleaner service area management post-registration, and company settings management. Password reset available via "Forgot password?" link on login page.
-   **Admin Flow**: Platform-wide analytics, company approval/rejection with fee package selection (custom/package1/package2), financial oversight with drill-down, manual withdrawal processing, transaction history management, and platform settings management (company name, logo, VAT registration). Admins can view all company transactions, create payment transactions that reduce company balances, and update company fee structures anytime. Password reset available via "Forgot password?" link on login page.
-   **Job Acceptance**: Stripe payment triggers PENDING_PAYMENT, webhook confirmation to PAID, job becomes available to on-duty cleaners within both the company's geofence area AND the cleaner's assigned service areas, manual acceptance (first-come-first-served), and WebSocket updates.
-   **Geofence Validation**: All customer interactions (company browsing, cleaner email lookup) validate that the customer's location is within the company's service areas. Requests outside all geofences are rejected with clear error messages.
-   **Cleaner Geofence Assignment**: Companies can assign cleaners to specific service areas during invitation or post-registration. Each cleaner can be assigned to "all service areas" or specific named service areas. Jobs are filtered by cleaner's assigned areas using point-in-polygon validation. Assignments automatically transfer from invitation to cleaner record during registration.

### System Design Choices
-   **Data Models**: Comprehensive models for Users, Companies, Cleaners, Cleaner Invitations, Cleaner Geofence Assignments, Jobs, Job Financials, Company Withdrawals, Fee Settings, Transactions, and Password Reset Tokens.
-   **Currency**: All transactions in AED (United Arab Emirates Dirham) with "AED" displayed.
-   **Fee Structure**: Flexible three-tier package system:
    -   **Custom Package**: Any platform fee > 0 AED set by admin + 5% VAT on (car wash + platform fee)
    -   **Package 1**: 2 AED base + 5% of car wash price + 5% VAT on (car wash + calculated fee)
    -   **Package 2**: Offline payment mode - car wash price + 5% VAT only (no platform fees)
    -   Example (Package 1, 15 AED wash): 2 + (15 × 0.05) = 2.75 AED fee → 17.75 subtotal → 0.89 VAT → 18.64 total
    -   Stripe fees (2.9% + 1 AED) are calculated on final total amount
    -   Admin can change fee package and amounts anytime via `/api/admin/company/:id/fee-structure`
-   **Transaction Tracking**: All payments, refunds, and withdrawals tracked with unique reference numbers. Note: Dual-ledger architecture - withdrawals tracked in companyWithdrawals table, payment transactions tracked in transactions table. These are separate with no overlap to prevent double-counting.
-   **Auto-Refund**: Jobs not accepted within 15 minutes are automatically refunded with Stripe refund processing.
-   **Payment Options**: Card, Apple Pay, and Google Pay via Stripe Payment Request Button.
-   **API**: RESTful API built with Express.js.
-   **Transactions**: Database transactions for multi-step operations.
-   **Environment**: PostgreSQL database with Drizzle ORM for schema management.

## External Dependencies
-   **Mapping**: OpenStreetMap (via `react-leaflet`), Nominatim (reverse geocoding), Google Maps (for navigation links).
-   **Payments**: Stripe.
-   **Email**: Resend.
-   **Database**: PostgreSQL.
-   **Authentication**: Passport.js, bcrypt.
-   **Session Store**: `connect-pg-simple`.
-   **File Uploads**: `multer`.