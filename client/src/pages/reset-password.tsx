import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoUrl from "@assets/IMG_2508_1762619079711.png";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const token = searchParams.get("token");
  
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidating(false);
        setIsValidToken(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-reset-token/${token}`);
        const data = await response.json();
        
        setIsValidToken(data.valid);
        
        if (!data.valid) {
          toast({
            title: "Invalid Token",
            description: data.message || "This reset link is invalid or has expired",
            variant: "destructive",
          });
        }
      } catch (error) {
        setIsValidToken(false);
        toast({
          title: "Error",
          description: "Failed to validate reset token",
          variant: "destructive",
        });
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    
    try {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        newPassword,
      });
      const data = await response.json();
      
      setResetSuccess(true);
      toast({
        title: "Success",
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating reset token...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription className="text-base">
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => setLocation("/forgot-password")}
              className="w-full"
              data-testid="button-request-new"
            >
              Request New Reset Link
            </Button>
            <Button
              onClick={() => setLocation("/login")}
              variant="ghost"
              className="w-full"
              data-testid="button-back-login"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle>Password Reset Successful</CardTitle>
            <CardDescription className="text-base">
              Your password has been successfully reset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full"
              data-testid="button-login"
            >
              Continue to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4">
            <img src={logoUrl} alt="Washapp.ae" className="h-24 w-auto" data-testid="img-logo" />
          </div>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription className="text-base">
            Enter your new password
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-new-password"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-confirm-password"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
              data-testid="button-reset-password"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
