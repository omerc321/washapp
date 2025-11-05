import { useEffect } from "react";
import { useNavigate } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { UserRole } from "@shared/schema";

export default function AuthPage() {
  const { currentUser, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && currentUser) {
      // Redirect based on user role
      switch (currentUser.role) {
        case UserRole.CUSTOMER:
          navigate("/customer");
          break;
        case UserRole.CLEANER:
          navigate("/cleaner");
          break;
        case UserRole.COMPANY_ADMIN:
          navigate("/company");
          break;
        case UserRole.ADMIN:
          navigate("/admin");
          break;
        default:
          navigate("/customer");
      }
    }
  }, [currentUser, loading, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">
            CarWash Pro
          </CardTitle>
          <CardDescription className="text-base">
            Professional car wash booking platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={signInWithGoogle}
            variant="outline"
            size="lg"
            className="w-full gap-2"
            data-testid="button-signin-google"
          >
            <SiGoogle className="h-5 w-5" />
            Sign in with Google
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Sign in to access your dashboard and manage car wash services
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
