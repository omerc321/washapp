import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MapPin, Calendar, DollarSign, Star } from "lucide-react";
import type { Job, Customer } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CustomerTracking() {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [ratingJobId, setRatingJobId] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const { data: customer, error: customerError } = useQuery<Customer>({
    queryKey: ["/api/customer/profile", submittedPhone],
    queryFn: async () => {
      const res = await fetch(`/api/customer/profile/${submittedPhone}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch customer profile");
      }
      return res.json();
    },
    enabled: !!submittedPhone,
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/customer/jobs", customer?.id],
    queryFn: async () => {
      if (!customer?.id) return [];
      const res = await fetch(`/api/customer/jobs/${customer.id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch jobs");
      }
      return res.json();
    },
    enabled: !!customer?.id,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedPhone(phoneNumber);
  };

  const submitRating = useMutation({
    mutationFn: async () => {
      if (!ratingJobId) return;
      const res = await apiRequest("POST", `/api/jobs/${ratingJobId}/rate`, {
        rating: rating.toString(),
        review,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/jobs", customer?.id] });
      toast({
        title: "Rating Submitted",
        description: "Thank you for your feedback!",
      });
      setRatingJobId(null);
      setRating(0);
      setReview("");
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "default";
      case "assigned":
        return "default";
      case "paid":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle data-testid="text-title">Track Your Car Wash</CardTitle>
          <CardDescription>
            Enter your phone number to view your car wash history and track current jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  data-testid="input-phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
                <Button type="submit" data-testid="button-submit">
                  <Phone className="w-4 h-4 mr-2" />
                  Track Jobs
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {submittedPhone && customer && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-customer-name">
                Welcome, {customer.displayName || "Customer"}!
              </CardTitle>
              <CardDescription>
                Phone: {customer.phoneNumber}
              </CardDescription>
            </CardHeader>
          </Card>

          {jobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No car wash history found. Book your first wash to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Your Car Washes</h2>
              {jobs.map((job) => (
                <Card key={job.id} data-testid={`card-job-${job.id}`} className="hover-elevate">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">
                          {job.carPlateNumber}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="w-4 h-4" />
                          {job.locationAddress}
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusBadgeVariant(job.status)} data-testid={`status-${job.id}`}>
                        {getStatusLabel(job.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(job.createdAt), "PPp")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">${job.price}</span>
                      </div>
                    </div>

                    {job.parkingNumber && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Parking: {job.parkingNumber}
                      </div>
                    )}

                    {job.status === "completed" && job.rating && (
                      <div className="mt-3 flex items-center gap-2">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">Your Rating: {job.rating}/5</span>
                        {job.review && (
                          <p className="text-sm text-muted-foreground ml-2">
                            "{job.review}"
                          </p>
                        )}
                      </div>
                    )}

                    {job.status === "completed" && !job.rating && (
                      <Dialog open={ratingJobId === job.id} onOpenChange={(open) => !open && setRatingJobId(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setRatingJobId(job.id)}
                            data-testid={`button-rate-${job.id}`}
                          >
                            <Star className="w-4 h-4 mr-2" />
                            Rate This Wash
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Rate Your Car Wash</DialogTitle>
                            <DialogDescription>
                              How was your experience?
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Rating</Label>
                              <div className="flex gap-2 mt-2">
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setRating(value)}
                                    className="focus:outline-none"
                                    data-testid={`star-${value}`}
                                  >
                                    <Star
                                      className={`w-8 h-8 ${
                                        rating >= value
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-muted-foreground"
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="review">Review (Optional)</Label>
                              <Textarea
                                id="review"
                                placeholder="Tell us about your experience..."
                                value={review}
                                onChange={(e) => setReview(e.target.value)}
                                data-testid="textarea-review"
                              />
                            </div>
                            <Button
                              onClick={() => submitRating.mutate()}
                              disabled={rating === 0 || submitRating.isPending}
                              className="w-full"
                              data-testid="button-submit-rating"
                            >
                              {submitRating.isPending ? "Submitting..." : "Submit Rating"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {submittedPhone && !customer && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No account found with this phone number. Book a car wash to create your profile!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
