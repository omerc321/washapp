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
-   **Booking Flow**: Modern 3-step wizard (Car Details → Location & Company → Payment) with persistent progress indicator, framer-motion animations, and mobile-first design. Reuses existing checkout component to avoid code duplication.

### Technical Implementations
-   **Frontend**: React, Tailwind CSS, shadcn/ui components, Roboto font, Framer Motion for animations.
-   **Backend**: Express.js, Node.js.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Authentication**: Passport.js with bcrypt for email/password (staff roles), `connect-pg-simple` for PostgreSQL session storage.
-   **Payments**: Stripe integration for customer payments in AED currency.
-   **Email**: Resend for notifications.
-   **Real-time**: WebSocket server for job status updates.
-   **File Uploads**: Multer for local file storage (job photos, trade licenses).
-   **Location**: Geofence polygon matching using ray-casting algorithm for point-in-polygon checks. Companies can define multiple named service areas.
-   **Security**: Session-based authentication, CSRF protection, role-based access control, Stripe webhook signature verification.
-   **PWA**: Progressive Web App implementation with service worker for offline capabilities, web app manifest for installability, and install prompt UI. Users can install the app on their mobile devices for an app-like experience.
-   **Performance Optimization**: Consolidated API endpoints reduce HTTP roundtrips. Cleaner dashboard uses single `/api/cleaner/dashboard` endpoint that fetches profile, shift status, and jobs in parallel (Promise.all) instead of 4 separate requests. Polling only active when cleaner is on duty. Mutations use single invalidation pattern (no double refetch).

### Feature Specifications
-   **Customer Booking Flow**: Modern 3-step wizard at `/customer/booking`:
    -   **Step 1 - Car Details**: Animated car plate and phone number entry with gradient icon backgrounds
    -   **Step 2 - Location & Company**: Integrated map location picker with geofence-based company matching (only companies with service areas containing the customer location are shown), company selection with pricing display
    -   **Step 3 - Payment**: Redirects to existing `/customer/checkout` page to complete Stripe payment (reuses checkout component to avoid code duplication)
    -   **Features**: Persistent progress indicator showing "Step X of 3", framer-motion animations for smooth transitions, mobile-first responsive design, gradient accents and vibrant colors
-   **Customer Flow**: Anonymous booking with car plate entry, map-based location selection, geofence-based company matching, Stripe payment in AED (company price + 3 AED platform fee clearly displayed in booking flow), and job tracking (Paid → Assigned → In Progress → Completed). Completed jobs remain in active tracker with full progress indicator before moving to history.
-   **Cleaner Flow**: Invitation-based registration, streamlined shift-based status (starting shift automatically sets ON_DUTY, ending shift sets OFF_DUTY), job acceptance, "Open in Google Maps" navigation to job location, and photo-based job completion. Compact header design with 40% reduced height. Periodic location tracking for on-duty cleaners. Cleaners can only see and accept jobs within their assigned service areas.
-   **Company Admin Flow**: Registration (requires admin approval), multiple named geofence management with location search and GPS positioning, cleaner invitation management with service area assignment (all areas or specific areas), detailed financial reports (revenue breakdown, withdrawals, cleaner filtering, Excel export), cleaner service area management post-registration, and company settings management.
-   **Admin Flow**: Platform-wide analytics, company approval/rejection, financial oversight with drill-down, manual withdrawal processing, and transaction history management. Admins can view all company transactions and create payment transactions that reduce company balances.
-   **Job Acceptance**: Stripe payment triggers PENDING_PAYMENT, webhook confirmation to PAID, job becomes available to on-duty cleaners within both the company's geofence area AND the cleaner's assigned service areas, manual acceptance (first-come-first-served), and WebSocket updates.
-   **Geofence Validation**: All customer interactions (company browsing, cleaner email lookup) validate that the customer's location is within the company's service areas. Requests outside all geofences are rejected with clear error messages.
-   **Cleaner Geofence Assignment**: Companies can assign cleaners to specific service areas during invitation or post-registration. Each cleaner can be assigned to "all service areas" or specific named service areas. Jobs are filtered by cleaner's assigned areas using point-in-polygon validation. Assignments automatically transfer from invitation to cleaner record during registration.

### System Design Choices
-   **Data Models**: Comprehensive models for Users, Companies, Cleaners, Cleaner Invitations, Cleaner Geofence Assignments, Jobs, Job Financials, Company Withdrawals, Fee Settings, and Transactions.
-   **Currency**: All transactions in AED (United Arab Emirates Dirham) with "AED" displayed.
-   **Fee Structure**: 5% tax + 3 AED flat platform fee + 2.9% + 1 AED Stripe payment processing fees.
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