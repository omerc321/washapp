import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, Briefcase, DollarSign, Star, TrendingUp, UserPlus, AlertCircle, Phone, CheckCircle, Clock, XCircle } from "lucide-react";
import { CompanyAnalytics, Cleaner, Company, CleanerInvitation } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function CompanyDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  const { data: company, isLoading: isLoadingCompany } = useQuery<Company>({
    queryKey: ["/api/companies", currentUser?.companyId],
    enabled: !!currentUser?.companyId,
  });

  const { data: analytics, isLoading } = useQuery<CompanyAnalytics>({
    queryKey: ["/api/company/analytics", currentUser?.companyId],
    enabled: !!currentUser?.companyId,
  });

  const { data: cleaners, isLoading: isLoadingCleaners } = useQuery<Cleaner[]>({
    queryKey: ["/api/company/cleaners"],
    enabled: !!currentUser?.companyId && company?.isActive === 1,
  });

  const { data: invitations, isLoading: isLoadingInvitations } = useQuery<CleanerInvitation[]>({
    queryKey: ["/api/company/invitations"],
    enabled: !!currentUser?.companyId && company?.isActive === 1,
  });

  const inviteCleanerMutation = useMutation({
    mutationFn: async (phone: string) => {
      return await apiRequest("POST", "/api/company/invite-cleaner", { phoneNumber: phone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/invitations"] });
      setIsInviteDialogOpen(false);
      setPhoneNumber("");
      toast({
        title: "Invitation Sent",
        description: "The cleaner invitation has been created. They can now register using this phone number.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 pt-4">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full text-center p-6">
          <p className="text-muted-foreground">Company analytics not available</p>
        </Card>
      </div>
    );
  }

  const metrics = [
    {
      title: "Jobs Completed",
      value: analytics.totalJobsCompleted,
      icon: Briefcase,
      description: "All time",
    },
    {
      title: "Active Cleaners",
      value: analytics.activeCleaners,
      icon: Users,
      description: "Currently available",
    },
    {
      title: "Total Revenue",
      value: `$${analytics.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      description: "All time",
    },
    {
      title: "Average Rating",
      value: analytics.averageRating.toFixed(1),
      icon: Star,
      description: "Customer satisfaction",
    },
    {
      title: "Jobs This Month",
      value: analytics.jobsThisMonth,
      icon: TrendingUp,
      description: "Current month",
    },
    {
      title: "Revenue This Month",
      value: `$${analytics.revenueThisMonth.toLocaleString()}`,
      icon: DollarSign,
      description: "Current month",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              Company Dashboard
            </h1>
            <p className="text-muted-foreground">
              Company analytics and performance
            </p>
          </div>
          
          {/* Invite Cleaner Button */}
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                data-testid="button-invite-cleaner"
                disabled={company?.isActive === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Cleaner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Car Washer</DialogTitle>
                <DialogDescription>
                  Invite a cleaner by their phone number. They will be able to register using this number.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+65 1234 5678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    data-testid="input-phone-number"
                  />
                  <p className="text-sm text-muted-foreground">
                    The cleaner will use this number to register on the platform
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => inviteCleanerMutation.mutate(phoneNumber)}
                  disabled={inviteCleanerMutation.isPending || !phoneNumber}
                  data-testid="button-submit-invite"
                >
                  {inviteCleanerMutation.isPending ? "Inviting..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Pending Approval Alert */}
        {company && company.isActive === 0 && (
          <Alert className="mb-6" data-testid="alert-pending-approval">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Pending Approval</AlertTitle>
            <AlertDescription>
              Your company registration is pending admin approval. You will be able to add cleaners and accept jobs once your company is approved.
            </AlertDescription>
          </Alert>
        )}

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.title} data-testid={`metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {metric.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Car Washers Management */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Car Washers</CardTitle>
              <CardDescription>
                Manage your team of car wash cleaners
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCleaners ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : cleaners && cleaners.length > 0 ? (
                <div className="space-y-4">
                  {cleaners.map((cleaner) => (
                    <div
                      key={cleaner.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`cleaner-${cleaner.id}`}
                    >
                      <div>
                        <p className="font-medium">Cleaner ID: {cleaner.id}</p>
                        <p className="text-sm text-muted-foreground">
                          Status: {cleaner.status.replace("_", " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Jobs: {cleaner.totalJobsCompleted}</p>
                        <p className="text-sm text-muted-foreground">
                          Rating: {cleaner.rating || "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No cleaners yet. Add your first car washer to get started!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cleaner Invitations */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Cleaner Invitations</CardTitle>
              <CardDescription>
                Track invited phone numbers and registration status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInvitations ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : invitations && invitations.length > 0 ? (
                <div className="space-y-4">
                  {invitations.map((invitation) => {
                    const statusIcons = {
                      pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
                      consumed: { icon: CheckCircle, color: "text-green-500", label: "Registered" },
                      revoked: { icon: XCircle, color: "text-red-500", label: "Revoked" },
                    };
                    const status = statusIcons[invitation.status];
                    const StatusIcon = status.icon;
                    
                    return (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`invitation-${invitation.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{invitation.phoneNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              Invited {new Date(invitation.invitedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${status.color}`} />
                          <Badge variant={invitation.status === "pending" ? "secondary" : "default"}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No invitations sent yet</p>
                  <p className="text-sm mt-1">Use the "Invite Cleaner" button to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
