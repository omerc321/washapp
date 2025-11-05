import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { Loader2, Shield } from "lucide-react";

export default function RegisterAdminPage() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await register({
        ...formData,
        role: UserRole.ADMIN,
      });
      setLocation("/admin");
    } catch (error) {
      // Error shown by toast in auth context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-8 w-8" />
            <CardTitle className="text-3xl font-bold">Platform Admin</CardTitle>
          </div>
          <CardDescription className="text-base">
            Create platform administrator account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                placeholder="Admin Name"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
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
                minLength={6}
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
              data-testid="button-register"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Admin...
                </>
              ) : (
                "Create Admin Account"
              )}
            </Button>
            
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Button
                type="button"
                variant="ghost"
                className="p-0 h-auto"
                onClick={() => setLocation("/login")}
                data-testid="link-login"
              >
                Sign In
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
