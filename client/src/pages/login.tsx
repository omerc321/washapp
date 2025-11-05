import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Car } from "lucide-react";

export default function LoginPage() {
  const { signIn, loading, currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  // Redirect based on user role after successful login
  useEffect(() => {
    if (currentUser) {
      switch (currentUser.role) {
        case "cleaner":
          setLocation("/cleaner");
          break;
        case "company_admin":
          setLocation("/company");
          break;
        case "admin":
          setLocation("/admin");
          break;
        default:
          setLocation("/customer");
      }
    }
  }, [currentUser, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await signIn(formData.email, formData.password);
      // Navigation handled by auth state change
    } catch (error) {
      // Error shown by toast in auth context
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="flex items-center justify-center gap-2 mb-2">
            <Car className="h-8 w-8" />
            <CardTitle className="text-3xl font-bold">CarWash Pro</CardTitle>
          </div>
          <CardDescription className="text-base">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="input-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                data-testid="input-password"
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
              data-testid="button-signin"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            
            <div className="text-center text-sm space-y-2">
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground p-0"
                onClick={() => setLocation("/register/cleaner")}
                data-testid="link-register-cleaner"
              >
                Register as Cleaner
              </Button>
              <span className="text-muted-foreground mx-2">|</span>
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground p-0"
                onClick={() => setLocation("/register/company")}
                data-testid="link-register-company"
              >
                Register Company
              </Button>
            </div>
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
