import { useState } from "react";
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
import { ArrowLeft, AlertCircle, Car } from "lucide-react";
import { Job } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

// UAE Emirates list
const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah"
];

// Plate codes: A-Z, AA-MM, 1-50
const PLATE_CODES = [
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  ...Array.from({ length: 13 }, (_, i) => {
    const char = String.fromCharCode(65 + i);
    return char + char;
  }),
  ...Array.from({ length: 50 }, (_, i) => (i + 1).toString())
];

export default function CustomerComplaint() {
  const [, params] = useRoute("/customer/complaint/:plateNumber?");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [complaintType, setComplaintType] = useState<string>("");
  const [description, setDescription] = useState("");
  
  // Plate number input for anonymous users
  const [plateEmirate, setPlateEmirate] = useState("");
  const [plateCode, setPlateCode] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [submittedPlate, setSubmittedPlate] = useState(params?.plateNumber || "");

  // Determine which endpoint to use based on authentication
  const queryKey = currentUser 
    ? ["/api/customer/jobs"]
    : submittedPlate 
    ? ["/api/jobs/track", submittedPlate]
    : null;

  // Fetch jobs (either by customer or by plate)
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: queryKey || ["empty"],
    enabled: !!queryKey,
  });

  // Filter completed or refunded jobs
  const eligibleJobs = jobs.filter(j => 
    j.status === 'completed' || j.status === 'refunded' || j.status === 'cancelled'
  );

  const submitComplaint = useMutation({
    mutationFn: async () => {
      if (!selectedJobId || !complaintType || !description.trim()) {
        throw new Error("Please fill in all fields");
      }

      return apiRequest("POST", "/api/complaints", {
        jobId: parseInt(selectedJobId),
        type: complaintType,
        description: description.trim(),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Complaint Submitted",
        description: `Your complaint reference is ${data.referenceNumber}. We'll review it shortly.`,
      });
      setLocation("/customer/jobs");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit complaint",
      });
    },
  });

  const handlePlateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateEmirate || !plateCode || !plateNumber.trim()) {
      toast({
        title: "Car Plate Required",
        description: "Please complete all car plate fields",
        variant: "destructive",
      });
      return;
    }
    const combinedPlate = `${plateEmirate} ${plateCode} ${plateNumber.trim().toUpperCase()}`;
    setSubmittedPlate(combinedPlate);
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(currentUser ? "/customer/jobs" : "/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Submit Complaint
            </h1>
            <p className="text-muted-foreground text-sm">
              We're here to help resolve any issues
            </p>
          </div>
        </div>

        {/* Plate Number Input for Anonymous Users */}
        {!currentUser && !submittedPlate && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Enter Your Car Plate</CardTitle>
              <CardDescription>
                We'll find your jobs to submit a complaint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePlateSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="plateEmirate" className="text-sm mb-1.5 block">
                      Emirate
                    </Label>
                    <Select value={plateEmirate} onValueChange={setPlateEmirate}>
                      <SelectTrigger id="plateEmirate" data-testid="select-emirate">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {UAE_EMIRATES.map((emirate) => (
                          <SelectItem key={emirate} value={emirate}>
                            {emirate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="plateCode" className="text-sm mb-1.5 block">
                      Code
                    </Label>
                    <Select value={plateCode} onValueChange={setPlateCode}>
                      <SelectTrigger id="plateCode" data-testid="select-code">
                        <SelectValue placeholder="A-Z" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATE_CODES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="plateNumber" className="text-sm mb-1.5 block">
                      Number
                    </Label>
                    <Input
                      id="plateNumber"
                      data-testid="input-plate-number"
                      placeholder="12345"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" data-testid="button-find-jobs">
                  <Car className="h-4 w-4 mr-2" />
                  Find My Jobs
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Show complaint form if authenticated OR plate submitted */}
        {(currentUser || submittedPlate) && (
          <Card>
          <CardHeader>
            <CardTitle>Complaint Details</CardTitle>
            <CardDescription>
              Please provide details about your concern
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Job Selection */}
            <div className="space-y-2">
              <Label htmlFor="job">Select Job</Label>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading your jobs...</p>
              ) : eligibleJobs.length === 0 ? (
                <div className="bg-muted p-4 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    No completed jobs found. You can only submit complaints for completed jobs.
                  </p>
                </div>
              ) : (
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger id="job" data-testid="select-job">
                    <SelectValue placeholder="Choose a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleJobs.map((job) => (
                      <SelectItem key={job.id} value={String(job.id)}>
                        Job #{job.id} - {job.carPlateNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Complaint Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Complaint Type</Label>
              <Select value={complaintType} onValueChange={setComplaintType}>
                <SelectTrigger id="type" data-testid="select-type">
                  <SelectValue placeholder="Select type" />
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
                placeholder="Please describe your concern in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                data-testid="textarea-description"
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/500 characters
              </p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => submitComplaint.mutate()}
              disabled={!selectedJobId || !complaintType || !description.trim() || submitComplaint.isPending || eligibleJobs.length === 0}
              className="w-full"
              data-testid="button-submit-complaint"
            >
              {submitComplaint.isPending ? "Submitting..." : "Submit Complaint"}
            </Button>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
