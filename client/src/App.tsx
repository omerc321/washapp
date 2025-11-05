import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav } from "@/components/bottom-nav";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import CustomerHome from "@/pages/customer-home";
import SelectCompany from "@/pages/select-company";
import Checkout from "@/pages/checkout";
import CustomerJobs from "@/pages/customer-jobs";
import CleanerDashboard from "@/pages/cleaner-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import CompanyDashboard from "@/pages/company-dashboard";
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
    return <Redirect to="/auth" />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}

function Router() {
  return (
    <div className="relative min-h-screen">
      {/* Theme Toggle - Fixed in top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <Switch>
        {/* Auth */}
        <Route path="/auth" component={AuthPage} />

        {/* Customer Routes */}
        <Route path="/customer">
          {() => <ProtectedRoute component={CustomerHome} allowedRoles={[UserRole.CUSTOMER]} />}
        </Route>
        <Route path="/customer/select-company">
          {() => <ProtectedRoute component={SelectCompany} allowedRoles={[UserRole.CUSTOMER]} />}
        </Route>
        <Route path="/customer/checkout">
          {() => <ProtectedRoute component={Checkout} allowedRoles={[UserRole.CUSTOMER]} />}
        </Route>
        <Route path="/customer/jobs">
          {() => <ProtectedRoute component={CustomerJobs} allowedRoles={[UserRole.CUSTOMER]} />}
        </Route>

        {/* Cleaner Routes */}
        <Route path="/cleaner">
          {() => <ProtectedRoute component={CleanerDashboard} allowedRoles={[UserRole.CLEANER]} />}
        </Route>

        {/* Company Routes */}
        <Route path="/company">
          {() => <ProtectedRoute component={CompanyDashboard} allowedRoles={[UserRole.COMPANY_ADMIN]} />}
        </Route>

        {/* Admin Routes */}
        <Route path="/admin">
          {() => <ProtectedRoute component={AdminDashboard} allowedRoles={[UserRole.ADMIN]} />}
        </Route>

        {/* Default Route */}
        <Route path="/">
          <Redirect to="/auth" />
        </Route>

        {/* 404 */}
        <Route component={NotFound} />
      </Switch>

      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
