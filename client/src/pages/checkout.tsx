// Stripe checkout integration - from javascript_stripe blueprint
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Car, MapPin, DollarSign, Building2, Phone } from "lucide-react";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function CheckoutForm({ paymentIntentId }: { paymentIntentId?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [processing, setProcessing] = useState(false);

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
        
        // Clear pending job and redirect
        sessionStorage.removeItem("pendingJob");
        setTimeout(() => setLocation("/customer/jobs"), 1000);
      } catch (confirmError) {
        console.error("Payment confirmation error:", confirmError);
        toast({
          title: "Payment Processed",
          description: "Confirming your booking...",
        });
        setTimeout(() => setLocation("/customer/jobs"), 2000);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

  useEffect(() => {
    const stored = sessionStorage.getItem("pendingJob");
    if (!stored) {
      setLocation("/customer");
      return;
    }
    
    const data = JSON.parse(stored);
    setJobData(data);

    // Create PaymentIntent
    apiRequest("POST", "/api/create-payment-intent", data)
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        // Extract payment intent ID from client secret
        const piId = data.clientSecret.split('_secret_')[0];
        setPaymentIntentId(piId);
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
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Payment</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Review and complete
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/customer/select-company")}
              data-testid="button-back"
            >
              Back
            </Button>
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

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">Total</span>
              </div>
              <span className="text-2xl font-bold">${jobData.price}</span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div>
          <h2 className="text-base font-semibold mb-4">Payment Details</h2>
          <div className="border rounded-lg p-4">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm paymentIntentId={paymentIntentId} />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}
