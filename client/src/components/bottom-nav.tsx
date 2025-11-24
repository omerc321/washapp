import { Home, Briefcase, BarChart3, LogOut, AlertCircle, DollarSign } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";

export function BottomNav() {
  const [location, navigate] = useLocation();
  const { currentUser, signOut } = useAuth();

  if (!currentUser) return null;

  const getNavItems = () => {
    switch (currentUser.role) {
      case UserRole.CUSTOMER:
        return [
          { icon: Home, label: "Book", path: "/customer", testId: "nav-home" },
          { icon: Briefcase, label: "Jobs", path: "/customer/jobs", testId: "nav-jobs" },
        ];
      case UserRole.CLEANER:
        return [
          { icon: Home, label: "Dashboard", path: "/cleaner", testId: "nav-dashboard" },
          { icon: DollarSign, label: "Tips", path: "/cleaner/tips", testId: "nav-tips" },
        ];
      case UserRole.COMPANY_ADMIN:
        return [
          { icon: BarChart3, label: "Dashboard", path: "/company", testId: "nav-dashboard" },
          { icon: AlertCircle, label: "Complaints", path: "/company/complaints", testId: "nav-complaints" },
        ];
      case UserRole.ADMIN:
        return [
          { icon: BarChart3, label: "Dashboard", path: "/admin", testId: "nav-dashboard" },
          { icon: AlertCircle, label: "Complaints", path: "/admin/complaints", testId: "nav-complaints" },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              data-testid={item.testId}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
        
        <button
          onClick={() => signOut()}
          data-testid="nav-signout"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
