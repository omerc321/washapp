# CarWash Pro - Mobile-First Car Wash Booking Platform

## Overview
CarWash Pro is a professional, mobile-first platform designed for car wash booking, featuring an Uber-style black/white interface. The platform facilitates anonymous customer car wash requests, allows companies to manage their cleaners, and enables cleaners to complete jobs with photo verification. The project aims to capture market potential by streamlining the car wash booking process and providing comprehensive management tools for car wash businesses.

## User Preferences
I prefer simple language and clear explanations. I want iterative development with frequent, small updates. Ask before making major changes to the architecture or core functionalities. Ensure the code is clean, well-commented, and follows modern React and Node.js best practices. Do not make changes to the `uploads/` folder or modify existing environment variables without explicit confirmation.

## System Architecture

### UI/UX Decisions
-   **Design**: Mobile-first responsive design, optimized for potential app store wrapping.
-   **Theme**: Uber-style black/white professional theme with dark mode support and a theme toggle.
-   **Navigation**: Role-based bottom navigation.
-   **Mapping**: Interactive OpenStreetMap integration with Leaflet for location selection, geolocation support, and Nominatim reverse geocoding.

### Technical Implementations
-   **Frontend**: React, Tailwind CSS, shadcn/ui components, Roboto font.
-   **Backend**: Express.js, Node.js.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Authentication**: Passport.js with bcrypt for email/password (staff roles), `connect-pg-simple` for PostgreSQL session storage.
-   **Payments**: Stripe integration for customer payments in AED currency.
-   **Email**: Resend for notifications.
-   **Real-time**: WebSocket server for job status updates.
-   **File Uploads**: Multer for local file storage (job photos, trade licenses).
-   **Location**: Haversine formula for distance calculations (50m radius matching).
-   **Security**: Session-based authentication, CSRF protection, role-based access control, Stripe webhook signature verification.

### Feature Specifications
-   **Customer Flow**: Anonymous booking with car plate entry, map-based location selection, nearby company viewing, Stripe payment in AED (company price + 3 AED platform fee clearly displayed), and job tracking (Paid → Assigned → In Progress → Completed).
-   **Cleaner Flow**: Invitation-based registration, on-duty/off-duty toggle, job acceptance, "Open in Google Maps" navigation to job location, and photo-based job completion. Periodic location tracking for on-duty cleaners.
-   **Company Admin Flow**: Registration (requires admin approval), cleaner invitation management, detailed financial reports (revenue breakdown, withdrawals, cleaner filtering, Excel export), and company settings management.
-   **Admin Flow**: Platform-wide analytics, company approval/rejection, financial oversight with drill-down, and manual withdrawal processing.
-   **Job Acceptance**: Stripe payment triggers PENDING_PAYMENT, webhook confirmation to PAID, job becomes available to on-duty cleaners, manual acceptance (first-come-first-served), and WebSocket updates.

### System Design Choices
-   **Data Models**: Comprehensive models for Users, Companies, Cleaners, Cleaner Invitations, Jobs, Job Financials, Company Withdrawals, Fee Settings, and Transactions.
-   **Currency**: All transactions in AED (United Arab Emirates Dirham) with د.إ symbol displayed.
-   **Fee Structure**: 5% tax + 3 AED flat platform fee + 2.9% + 1 AED Stripe payment processing fees.
-   **Transaction Tracking**: All payments, refunds, and withdrawals tracked with unique reference numbers.
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