import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

export default function CustomerQRPayment() {
  const [, params] = useRoute("/customer/pay/:token");
  const [, setLocation] = useLocation();
  const token = params?.token;
  const { toast } = useToast();
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  
  // Form state
  const [carPlateEmirate, setCarPlateEmirate] = useState("");
  const [carPlateCode, setCarPlateCode] = useState("");
  const [carPlateNumber, setCarPlateNumber] = useState("");
  const [parkingNumber, setParkingNumber] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  // Also fetch company details to get price
  const { data: companyData } = useQuery<{
    id: number;
    name: string;
    carWashPrice: number;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!carPlateEmirate || !carPlateCode || !carPlateNumber || !customerPhone || !tokenData || !companyData) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create or get customer by phone
      const customerRes = await fetch("/api/customer/by-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: customerPhone }),
      });
      
      if (!customerRes.ok) {
        throw new Error("Failed to create customer record");
      }
      
      const customer = await customerRes.json();

      // Build job data for checkout
      const jobData = {
        carPlateEmirate,
        carPlateCode,
        carPlateNumber,
        parkingNumber: parkingNumber || "",
        customerPhone,
        customerEmail: customer.email || "",
        locationAddress: "Customer Location (QR Payment)",
        locationLatitude: 0, // Will be set by cleaner location
        locationLongitude: 0,
        companyId: tokenData.companyId.toString(),
        customerId: customer.id.toString(),
        price: companyData.carWashPrice,
        tipAmount: 0,
      };

      // Store in sessionStorage for checkout
      sessionStorage.setItem("pendingJob", JSON.stringify(jobData));

      // Redirect to checkout with token
      setLocation(`/customer/checkout?token=${token}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to process payment request",
      });
      setSubmitting(false);
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
          <CardTitle className="text-2xl">Quick Payment</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Pay {tokenData.cleanerName} from {tokenData.companyName}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Info */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company:</span>
                <span className="font-semibold" data-testid="text-company-name">
                  {tokenData.companyName}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cleaner:</span>
                <span className="font-semibold" data-testid="text-cleaner-name">
                  {tokenData.cleanerName}
                </span>
              </div>
              {companyData && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-semibold text-primary">
                    {companyData.carWashPrice.toFixed(2)} AED
                  </span>
                </div>
              )}
            </div>

            {/* Car Details Form */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Car className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Your Car Details</h3>
              </div>

              {/* Emirate */}
              <div>
                <Label htmlFor="emirate">Emirate</Label>
                <Select value={carPlateEmirate} onValueChange={setCarPlateEmirate}>
                  <SelectTrigger id="emirate" data-testid="select-emirate">
                    <SelectValue placeholder="Select emirate" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMIRATES.map((emirate) => (
                      <SelectItem key={emirate} value={emirate}>
                        {emirate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Plate Code and Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="code">Plate Code</Label>
                  <Input
                    id="code"
                    placeholder="A, B, C..."
                    value={carPlateCode}
                    onChange={(e) => setCarPlateCode(e.target.value.toUpperCase())}
                    maxLength={3}
                    data-testid="input-plate-code"
                  />
                </div>
                <div>
                  <Label htmlFor="number">Plate Number</Label>
                  <Input
                    id="number"
                    placeholder="12345"
                    value={carPlateNumber}
                    onChange={(e) => setCarPlateNumber(e.target.value)}
                    maxLength={6}
                    data-testid="input-plate-number"
                  />
                </div>
              </div>

              {/* Parking Number */}
              <div>
                <Label htmlFor="parking">Parking Number (Optional)</Label>
                <Input
                  id="parking"
                  placeholder="Enter parking number"
                  value={parkingNumber}
                  onChange={(e) => setParkingNumber(e.target.value)}
                  data-testid="input-parking-number"
                />
              </div>

              {/* Customer Phone */}
              <div>
                <Label htmlFor="phone">Your Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+971 XX XXX XXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  data-testid="input-customer-phone"
                />
              </div>
            </div>

            {/* Info Note */}
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground text-center">
                This job will be automatically assigned to {tokenData.cleanerName}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting || !companyData}
              data-testid="button-proceed-to-payment"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Proceed to Payment"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You'll see the final amount with VAT on the next page
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
