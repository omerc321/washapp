// Stripe checkout integration - from javascript_stripe blueprint
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useStripe, Elements, PaymentElement, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import { loadStripe, PaymentRequest } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Car, MapPin, DollarSign, Building2, Phone, LogIn } from "lucide-react";
import logoUrl from "@assets/IMG_2508_1762619079711.png";
import { Link } from "wouter";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function CheckoutForm({ 
  paymentIntentId, 
  clientSecret, 
  jobData, 
  onTipUpdate 
}: { 
  paymentIntentId?: string;
  clientSecret: string;
  jobData: any;
  onTipUpdate: (fees: any) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [processing, setProcessing] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [updatingTip, setUpdatingTip] = useState(false);
  const [customTipError, setCustomTipError] = useState("");

  // Handle tip update
  const updateTip = async (newTip: number) => {
    if (!paymentIntentId) return;
    
    setUpdatingTip(true);
    setCustomTipError("");
    try {
      const response = await apiRequest("PATCH", `/api/payment-intents/${paymentIntentId}`, {
        tipAmount: newTip,
      });
      const fees = await response.json();
      
      // Update parent component with new fees
      onTipUpdate(fees);
      
      // Update payment request if available
      if (paymentRequest) {
        paymentRequest.update({
          total: {
            label: 'Car Wash Service',
            amount: Math.round(fees.totalAmount * 100),
          },
        });
      }
      
      setTipAmount(newTip);
      setCustomTip(""); // Clear custom input after successful update
    } catch (error) {
      console.error("Failed to update tip:", error);
      toast({
        title: "Error",
        description: "Failed to update tip amount",
        variant: "destructive",
      });
    } finally {
      setUpdatingTip(false);
    }
  };

  // Setup Payment Request for Apple Pay / Google Pay
  useEffect(() => {
    if (!stripe || !jobData) {
      return;
    }

    const pr = stripe.paymentRequest({
      country: 'AE', // United Arab Emirates
      currency: 'aed',
      total: {
        label: 'Car Wash Service',
        amount: Math.round(jobData.price * 100), // Convert AED to fils (cents)
      },
      requestPayerName: true,
      requestPayerPhone: true,
    });

    // Check if wallets are available
    pr.canMakePayment().then(result => {
      if (result) {
        setPaymentRequest(pr);
      }
    });

    // Handle payment method from wallet
    pr.on('paymentmethod', async (e) => {
      try {
        // Confirm payment with the payment method from the wallet
        const { error: confirmError } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: e.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          e.complete('fail');
          toast({
            title: "Payment Failed",
            description: confirmError.message,
            variant: "destructive",
          });
        } else {
          e.complete('success');
          
          // Manually confirm on backend
          if (paymentIntentId) {
            await apiRequest("POST", `/api/confirm-payment/${paymentIntentId}`, {});
          }
          
          toast({
            title: "Payment Successful",
            description: "Your car wash has been booked!",
          });
          
          const carPlate = jobData.carPlateNumber;
          sessionStorage.removeItem("pendingJob");
          setTimeout(() => setLocation(`/customer/track/${carPlate}`), 1000);
        }
      } catch (error) {
        e.complete('fail');
        console.error("Wallet payment error:", error);
      }
    });
  }, [stripe, jobData, clientSecret, paymentIntentId, toast, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setProcessing(false);
    } else {
      // Payment succeeded - manually confirm on backend for development
      try {
        if (paymentIntentId) {
          await apiRequest("POST", `/api/confirm-payment/${paymentIntentId}`, {});
        }
        
        toast({
          title: "Payment Successful",
          description: "Your car wash has been booked!",
        });
        
        // Clear pending job and redirect to tracking
        const carPlate = jobData.carPlateNumber;
        sessionStorage.removeItem("pendingJob");
        setTimeout(() => setLocation(`/customer/track/${carPlate}`), 1000);
      } catch (confirmError) {
        console.error("Payment confirmation error:", confirmError);
        toast({
          title: "Payment Processed",
          description: "Confirming your booking...",
        });
        const carPlate = jobData.carPlateNumber;
        setTimeout(() => setLocation(`/customer/track/${carPlate}`), 2000);
      }
    }
  };

  const presetTips = [0, 5, 10, 15, 20];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tip Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Add a tip for your cleaner (optional)</label>
        <div className="grid grid-cols-3 gap-2">
          {presetTips.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant={tipAmount === amount ? "default" : "outline"}
              size="sm"
              onClick={() => updateTip(amount)}
              disabled={updatingTip}
              data-testid={`button-tip-${amount}`}
            >
              {amount === 0 ? "No tip" : `${amount} AED`}
            </Button>
          ))}
          <div className="col-span-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Custom amount"
                  value={customTip}
                  onChange={(e) => {
                    setCustomTip(e.target.value);
                    setCustomTipError("");
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  min="0"
                  max="1000"
                  step="1"
                  data-testid="input-custom-tip"
                />
                {customTipError && (
                  <p className="text-xs text-destructive mt-1">{customTipError}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const amount = parseFloat(customTip) || 0;
                  if (amount < 0) {
                    setCustomTipError("Tip cannot be negative");
                    return;
                  }
                  if (amount > 1000) {
                    setCustomTipError("Maximum tip is 1000 AED");
                    return;
                  }
                  setCustomTipError("");
                  updateTip(amount);
                }}
                disabled={updatingTip || !customTip}
                data-testid="button-apply-custom-tip"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
        {updatingTip && (
          <p className="text-xs text-muted-foreground">Updating total...</p>
        )}
      </div>

      <Separator />

      {/* Apple Pay / Google Pay Button */}
      {paymentRequest && (
        <div className="space-y-4">
          <PaymentRequestButtonElement 
            options={{ paymentRequest }}
            className="w-full"
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or pay with card
              </span>
            </div>
          </div>
        </div>
      )}
      
      <PaymentElement />
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-20">
        <div className="max-w-md mx-auto">
          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={!stripe || processing}
            data-testid="button-pay"
          >
            {processing ? "Processing Payment..." : "Pay Now"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [jobData, setJobData] = useState<any>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<any>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("pendingJob");
    if (!stored) {
      setLocation("/customer");
      return;
    }
    
    const data = JSON.parse(stored);
    setJobData(data);

    // Create PaymentIntent and get authoritative fees from backend
    apiRequest("POST", "/api/create-payment-intent", data)
      .then((res) => res.json())
      .then((responseData) => {
        setClientSecret(responseData.clientSecret);
        // Extract payment intent ID from client secret
        const piId = responseData.clientSecret.split('_secret_')[0];
        setPaymentIntentId(piId);
        
        // Set fee breakdown from backend response (includes platform fee tax!)
        if (responseData.fees) {
          setFeeBreakdown({
            basePrice: responseData.fees.baseJobAmount,
            taxAmount: responseData.fees.taxAmount,
            platformFee: responseData.fees.platformFeeAmount,
            tipAmount: responseData.fees.tipAmount,
            totalAmount: responseData.fees.totalAmount,
          });
        }
      })
      .catch((error) => {
        toast({
          title: "Error",
          description: "Failed to initialize payment",
          variant: "destructive",
        });
        console.error(error);
      });
  }, [setLocation, toast]);

  const handleTipUpdate = (fees: any) => {
    setFeeBreakdown(fees);
  };

  if (!clientSecret || !jobData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Clean and minimal */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <img src={logoUrl} alt="Washapp.ae" className="h-10 w-auto" data-testid="img-logo" />
            <div className="flex-1">
              <h1 className="text-base font-semibold">Payment</h1>
              <p className="text-xs text-muted-foreground">
                Review and complete
              </p>
            </div>
            <Link href="/login">
              <Button 
                variant="ghost" 
                size="sm"
                className="hover-elevate active-elevate-2"
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4 mr-1" />
                Login
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-6 pb-32">
        {/* Job Summary - Receipt style */}
        <div className="mb-8">
          <h2 className="text-base font-semibold mb-4">Booking Summary</h2>
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Car className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Car Plate</p>
                <p className="font-medium">{jobData.carPlateNumber}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{jobData.locationAddress}</p>
              </div>
            </div>

            {jobData.parkingNumber && (
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Parking</p>
                  <p className="font-medium">{jobData.parkingNumber}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{jobData.customerPhone}</p>
              </div>
            </div>

            <Separator />

            {/* Price Breakdown */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Price</span>
                <span>
                  {feeBreakdown?.servicePrice?.toFixed(2) || 
                   ((feeBreakdown?.basePrice || jobData.basePrice) + (feeBreakdown?.platformFee || jobData.platformFee)).toFixed(2)} AED
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (5%)</span>
                <span>{feeBreakdown?.taxAmount?.toFixed(2) || jobData.taxAmount} AED</span>
              </div>
              {feeBreakdown?.tipAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tip for Cleaner</span>
                  <span className="text-primary font-medium">{feeBreakdown.tipAmount.toFixed(2)} AED</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">Total</span>
                </div>
                <span className="text-2xl font-bold">{feeBreakdown?.totalAmount?.toFixed(2) || jobData.price} AED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div>
          <h2 className="text-base font-semibold mb-4">Payment Details</h2>
          <div className="border rounded-lg p-4">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm 
                paymentIntentId={paymentIntentId} 
                clientSecret={clientSecret}
                jobData={jobData}
                onTipUpdate={handleTipUpdate}
              />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}
