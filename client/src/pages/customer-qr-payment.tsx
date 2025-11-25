import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomerQRPayment() {
  const [, params] = useRoute("/customer/pay/:token");
  const [, setLocation] = useLocation();
  const token = params?.token;
  const { toast } = useToast();
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

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

  // Fetch company details to get price
  const { data: companyData } = useQuery<{
    id: number;
    name: string;
    pricePerWash: string;
    feePackageType: string;
  }>({
    queryKey: ["/api/companies", tokenData?.companyId],
    enabled: !!tokenData?.companyId,
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

  // Auto-redirect to checkout when data is ready
  useEffect(() => {
    if (tokenData && companyData && !processingPayment) {
      setProcessingPayment(true);
      
      // Create anonymous customer with minimal data
      fetch("/api/customer/by-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: `QR-${Date.now()}` }),
      })
        .then(res => res.json())
        .then(customer => {
          // Parse price as number (comes as string from numeric column)
          const price = parseFloat(companyData.pricePerWash) || 0;
          
          // Build minimal job data for checkout
          const jobData = {
            carPlateEmirate: "Anonymous",
            carPlateCode: "QR",
            carPlateNumber: `${Date.now()}`,
            parkingNumber: "",
            customerPhone: `QR-${Date.now()}`,
            customerEmail: customer.email || "",
            locationAddress: "On-site (QR Payment)",
            locationLatitude: 0,
            locationLongitude: 0,
            companyId: tokenData.companyId,
            customerId: customer.id,
            price: price,
            tipAmount: 0,
          };

          // Store in sessionStorage for checkout
          sessionStorage.setItem("pendingJob", JSON.stringify(jobData));

          // Redirect to checkout with token
          setLocation(`/customer/checkout?token=${token}`);
        })
        .catch(err => {
          console.error("Error processing QR payment:", err);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to process payment request",
          });
          setProcessingPayment(false);
        });
    }
  }, [tokenData, companyData, token, processingPayment, setLocation, toast]);

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

  if (isLoading || processingPayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              {processingPayment ? "Preparing payment..." : "Verifying payment link..."}
            </p>
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
          <CardTitle className="text-2xl">Redirecting to Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-center">
            Loading payment details for {tokenData.cleanerName} from {tokenData.companyName}...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
