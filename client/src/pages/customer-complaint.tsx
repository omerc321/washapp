import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, AlertCircle, Mail, CheckCircle, Loader2 } from "lucide-react";
import { Job } from "@shared/schema";

export default function CustomerComplaint() {
  const [, params] = useRoute("/customer/complaint/:jobId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const jobId = params?.jobId ? parseInt(params.jobId) : null;
  
  // Form states
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [complaintType, setComplaintType] = useState<string>("");
  const [description, setDescription] = useState("");
  
  // OTP verification states
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpSendCooldown, setOtpSendCooldown] = useState(0);

  // Fetch job details using jobId from URL
  const { data: job, isLoading } = useQuery<Job>({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId,
  });

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (otpSendCooldown > 0) {
      const timer = setTimeout(() => setOtpSendCooldown(otpSendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpSendCooldown]);

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      if (!email.trim()) {
        throw new Error("Please enter your email address");
      }
      
      return apiRequest("POST", "/api/otp/send", {
        email: email.trim(),
      });
    },
    onSuccess: () => {
      setIsOtpSent(true);
      setOtpSendCooldown(60); // 60 second cooldown
      toast({
        title: "Verification Code Sent",
        description: "Check your email for the 6-digit code",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Send Code",
        description: error.message || "Please try again",
      });
    },
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      if (!otpCode.trim()) {
        throw new Error("Please enter the verification code");
      }
      
      return apiRequest("POST", "/api/otp/verify", {
        email: email.trim(),
        code: otpCode.trim(),
      });
    },
    onSuccess: () => {
      setIsEmailVerified(true);
      toast({
        title: "Email Verified",
        description: "You can now submit your complaint",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: error.message || "Please check the code and try again",
      });
    },
  });

  // Submit complaint mutation
  const submitComplaint = useMutation({
    mutationFn: async () => {
      if (!isEmailVerified) {
        throw new Error("Please verify your email first");
      }
      
      if (!complaintType || !description.trim()) {
        throw new Error("Please fill in all fields");
      }

      return apiRequest("POST", "/api/complaints", {
        jobId,
        type: complaintType,
        description: description.trim(),
        email: email.trim(),
        otpCode: otpCode,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Complaint Submitted",
        description: `Your complaint reference is ${data.referenceNumber}. We'll review it shortly.`,
      });
      setLocation("/customer/track");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit complaint",
      });
    },
  });

  if (!jobId) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid Request</CardTitle>
            <CardDescription>No job specified for complaint</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/customer/track")} data-testid="button-back">
              Go to Tracking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Job Not Found</CardTitle>
            <CardDescription>Unable to load job details</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/customer/track")} data-testid="button-back">
              Go to Tracking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/customer/track")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Report Issue
            </h1>
            <p className="text-muted-foreground text-sm">
              Job #{job.id} • {job.carPlateEmirate} {job.carPlateCode} {job.carPlateNumber}
            </p>
          </div>
        </div>

        {/* Email Verification Section */}
        {!isEmailVerified && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Verification
              </CardTitle>
              <CardDescription>
                Verify your email to submit a complaint
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isOtpSent}
                    data-testid="input-email"
                  />
                  {!isOtpSent && (
                    <Button
                      onClick={() => sendOtpMutation.mutate()}
                      disabled={sendOtpMutation.isPending || !email.trim()}
                      data-testid="button-send-otp"
                    >
                      {sendOtpMutation.isPending ? "Sending..." : "Send Code"}
                    </Button>
                  )}
                </div>
              </div>

              {/* OTP Input */}
              {isOtpSent && (
                <div className="space-y-2">
                  <Label htmlFor="otpCode">Verification Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="otpCode"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      data-testid="input-otp"
                    />
                    <Button
                      onClick={() => verifyOtpMutation.mutate()}
                      disabled={verifyOtpMutation.isPending || otpCode.length !== 6}
                      data-testid="button-verify-otp"
                    >
                      {verifyOtpMutation.isPending ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">
                      Check your email for the code
                    </p>
                    {otpSendCooldown > 0 ? (
                      <p className="text-muted-foreground">
                        Resend in {otpSendCooldown}s
                      </p>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOtpCode("");
                          sendOtpMutation.mutate();
                        }}
                        data-testid="button-resend-otp"
                      >
                        Resend Code
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Verification Success Banner */}
        {isEmailVerified && (
          <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Email Verified
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {email}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complaint Form - Only shown after email verification */}
        {isEmailVerified && (
          <Card>
            <CardHeader>
              <CardTitle>Complaint Details</CardTitle>
              <CardDescription>
                Tell us about the issue you're experiencing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Complaint Type */}
              <div className="space-y-2">
                <Label htmlFor="complaintType">Issue Type</Label>
                <Select value={complaintType} onValueChange={setComplaintType}>
                  <SelectTrigger id="complaintType" data-testid="select-type">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund_request">Refund Request</SelectItem>
                    <SelectItem value="general">General Complaint</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Please describe the issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  data-testid="input-description"
                />
                <p className="text-xs text-muted-foreground">
                  Provide as much detail as possible to help us resolve your issue
                </p>
              </div>

              {/* Submit Button */}
              <Button
                className="w-full"
                onClick={() => submitComplaint.mutate()}
                disabled={submitComplaint.isPending || !complaintType || !description.trim()}
                data-testid="button-submit-complaint"
              >
                {submitComplaint.isPending ? "Submitting..." : "Submit Complaint"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Help Text */}
        {!isEmailVerified && (
          <Card className="mt-6 bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium">Why verify email?</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Receive updates about your complaint</li>
                    <li>Get notified when it's resolved</li>
                    <li>Track complaint status via email</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
