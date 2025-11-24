import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomerQRPayment() {
  const [, params] = useRoute("/customer/pay/:token");
  const token = params?.token;
  const { toast } = useToast();
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  const { data: tokenData, isLoading, error } = useQuery<{
    token: string;
    companyId: number;
    companyName: string;
    cleanerId: number;
    cleanerName: string;
    expiresAt: string;
  }>({
    queryKey: ["/api/customer/payment-token", token],
    enabled: !!token,
  });

  useEffect(() => {
    if (error) {
      setIsValidToken(false);
      toast({
        variant: "destructive",
        title: "Invalid Token",
        description: "This payment link is invalid or has expired.",
      });
    } else if (tokenData) {
      setIsValidToken(true);
    }
  }, [error, tokenData, toast]);

  const handleStartBooking = () => {
    if (tokenData) {
      window.location.href = `/customer/booking?token=${token}`;
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Invalid Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">This payment link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying payment link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isValidToken === false || !tokenData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Invalid or Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This payment link is either invalid, has been used, or has expired.
            </p>
            <p className="text-sm text-muted-foreground">
              Please ask the cleaner for a new payment link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">Pay with QR Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Company:</span>
                <span className="text-sm font-semibold" data-testid="text-company-name">
                  {tokenData.companyName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Cleaner:</span>
                <span className="text-sm font-semibold" data-testid="text-cleaner-name">
                  {tokenData.cleanerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Expires:</span>
                <span className="text-sm" data-testid="text-expires-at">
                  {new Date(tokenData.expiresAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <p className="text-sm text-center text-muted-foreground">
                This payment will be automatically assigned to <span className="font-semibold text-foreground">{tokenData.cleanerName}</span>
              </p>
            </div>
          </div>

          <Button
            onClick={handleStartBooking}
            className="w-full"
            size="lg"
            data-testid="button-start-booking"
          >
            Continue to Booking
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You'll enter your car details and complete payment on the next page
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
