import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Job } from "@shared/schema";

export default function CustomerComplaint() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [complaintType, setComplaintType] = useState<string>("");
  const [description, setDescription] = useState("");

  // Fetch customer jobs
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/customer/jobs"],
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

      return apiRequest("/api/complaints", {
        method: "POST",
        body: JSON.stringify({
          jobId: parseInt(selectedJobId),
          type: complaintType,
          description: description.trim(),
        }),
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

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/customer/jobs")}
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
      </div>
    </div>
  );
}
