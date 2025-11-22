import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Phone, ArrowLeft, User } from "lucide-react";
import logoUrl from "@assets/IMG_2508_1762619079711.png";

export default function CustomerLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Redirect if already logged in
  if (currentUser) {
    setLocation("/customer/jobs");
    return null;
  }

  const loginMutation = useMutation({
    mutationFn: async () => {
      if (!phoneNumber.trim()) {
        throw new Error("Phone number is required");
      }

      const response = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          displayName: displayName.trim() || undefined,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome!",
        description: "You're now logged in. Redirecting to your jobs...",
      });
      // Reload to update auth state
      window.location.href = "/customer/jobs";
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 sticky top-0 z-10 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <img src={logoUrl} alt="Washapp.ae" className="h-12 w-auto" data-testid="img-logo" />
              <div>
                <h1 className="text-white text-lg font-bold">Customer Login</h1>
                <p className="text-white/90 text-xs">Access your car wash history</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/")}
              className="text-white hover:bg-white/20"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                <Phone className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Login with Phone</CardTitle>
                <CardDescription>Enter your phone number to access your jobs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="text-base font-medium">
                  Phone Number *
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="050 123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10 h-12 text-lg"
                    required
                    data-testid="input-phone"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the phone number you used when booking
                </p>
              </div>

              {/* Display Name (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-base font-medium">
                  Your Name (Optional)
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Ahmed Ali"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10 h-12 text-lg"
                    data-testid="input-name"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Only needed if this is your first time logging in
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary h-12 text-lg"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Logging in..." : "Access My Jobs"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 bg-muted/50 border-muted">
          <CardContent className="pt-6">
            <div className="space-y-3 text-sm">
              <p className="font-medium">Why do I need to log in?</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>View your complete car wash history</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Submit complaints and track their status</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Rate your completed washes</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Don't have an account? Just enter your phone number and we'll create one for you!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
