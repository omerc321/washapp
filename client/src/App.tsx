import { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { SplashScreen } from "@/components/splash-screen";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import RegisterCleanerPage from "@/pages/register-cleaner";
import RegisterCompanyPage from "@/pages/register-company";
import RegisterAdminPage from "@/pages/register-admin";
import CustomerHome from "@/pages/customer-home";
import CustomerBooking from "@/pages/customer-booking";
import SelectCompany from "@/pages/select-company";
import Checkout from "@/pages/checkout";
import CustomerJobs from "@/pages/customer-jobs";
import CustomerTrack from "@/pages/customer-track";
import CustomerComplaint from "@/pages/customer-complaint";
import CleanerDashboard from "@/pages/cleaner-dashboard";
import CleanerShiftHistory from "@/pages/cleaner-shift-history";
import CleanerTips from "@/pages/cleaner-tips";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSettings from "@/pages/admin-settings";
import AdminComplaints from "@/pages/admin-complaints";
import CompanyDashboard from "@/pages/company-dashboard";
import CompanyFinancials from "@/pages/company-financials";
import CompanyShiftHistory from "@/pages/company-shift-history";
import CompanyComplaints from "@/pages/company-complaints";
import About from "@/pages/about";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import { UserRole } from "@shared/schema";

function ProtectedRoute({ 
  component: Component, 
  allowedRoles 
}: { 
  component: React.ComponentType; 
  allowedRoles?: UserRole[] 
}) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (!currentUser) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role as UserRole)) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Theme Toggle - Fixed in top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="flex-1">
        <Switch>
          {/* Auth Routes */}
          <Route path="/login" component={LoginPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/register/cleaner" component={RegisterCleanerPage} />
          <Route path="/register/company" component={RegisterCompanyPage} />
          <Route path="/register/admin" component={RegisterAdminPage} />

          {/* Customer Routes - No auth required */}
          <Route path="/customer" component={CustomerBooking} />
          <Route path="/customer/booking" component={CustomerBooking} />
          <Route path="/customer/home" component={CustomerHome} />
          <Route path="/customer/select-company" component={SelectCompany} />
          <Route path="/customer/checkout" component={Checkout} />
          <Route path="/customer/jobs" component={CustomerJobs} />
          <Route path="/customer/complaint/:jobId" component={CustomerComplaint} />
          <Route path="/customer/track" component={CustomerTrack} />
          <Route path="/customer/track/:plateNumber" component={CustomerTrack} />

          {/* Public Info Pages - No auth required */}
          <Route path="/about" component={About} />
          <Route path="/terms" component={Terms} />
          <Route path="/privacy" component={Privacy} />

          {/* Cleaner Routes - Auth required */}
          <Route path="/cleaner">
            {() => <ProtectedRoute component={CleanerDashboard} allowedRoles={[UserRole.CLEANER]} />}
          </Route>
          <Route path="/cleaner/shift-history">
            {() => <ProtectedRoute component={CleanerShiftHistory} allowedRoles={[UserRole.CLEANER]} />}
          </Route>
          <Route path="/cleaner/tips">
            {() => <ProtectedRoute component={CleanerTips} allowedRoles={[UserRole.CLEANER]} />}
          </Route>

          {/* Company Routes - Auth required */}
          <Route path="/company">
            {() => <ProtectedRoute component={CompanyDashboard} allowedRoles={[UserRole.COMPANY_ADMIN]} />}
          </Route>
          <Route path="/company/financials">
            {() => <ProtectedRoute component={CompanyFinancials} allowedRoles={[UserRole.COMPANY_ADMIN]} />}
          </Route>
          <Route path="/company/shift-history">
            {() => <ProtectedRoute component={CompanyShiftHistory} allowedRoles={[UserRole.COMPANY_ADMIN]} />}
          </Route>
          <Route path="/company/complaints">
            {() => <ProtectedRoute component={CompanyComplaints} allowedRoles={[UserRole.COMPANY_ADMIN]} />}
          </Route>

          {/* Admin Routes - Auth required */}
          <Route path="/admin">
            {() => <ProtectedRoute component={AdminDashboard} allowedRoles={[UserRole.ADMIN]} />}
          </Route>
          <Route path="/admin/settings">
            {() => <ProtectedRoute component={AdminSettings} allowedRoles={[UserRole.ADMIN]} />}
          </Route>
          <Route path="/admin/complaints">
            {() => <ProtectedRoute component={AdminComplaints} allowedRoles={[UserRole.ADMIN]} />}
          </Route>

          {/* Default Route - New customer booking flow */}
          <Route path="/" component={CustomerBooking} />

          {/* 404 */}
          <Route component={NotFound} />
        </Switch>

        <BottomNav />
      </div>

      <Footer />
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('splashShown');
    if (hasSeenSplash) {
      setShowSplash(false);
      setSplashComplete(true);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true');
    setSplashComplete(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            {showSplash && !splashComplete && (
              <SplashScreen onComplete={handleSplashComplete} />
            )}
            <Toaster />
            <PWAInstallPrompt />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
