import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Briefcase, DollarSign, Star, TrendingUp, UserPlus, AlertCircle, Phone, CheckCircle, Clock, XCircle, FileText, ShieldOff, ShieldCheck, Map } from "lucide-react";
import { CompanyAnalytics, Cleaner, Company, CleanerInvitation } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import GeofenceEditor from "@/components/geofence-editor";

export default function CompanyDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deactivatingCleanerId, setDeactivatingCleanerId] = useState<number | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivatingCleanerId, setReactivatingCleanerId] = useState<number | null>(null);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [showGeofence, setShowGeofence] = useState(false);

  // Helper function to check if a cleaner is truly online (active within last 10 minutes)
  const isCleanerOnline = (cleaner: Cleaner): boolean => {
    if (cleaner.status !== "on_duty" || !cleaner.lastLocationUpdate) {
      return false;
    }
    const lastUpdate = new Date(cleaner.lastLocationUpdate);
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    return lastUpdate > tenMinutesAgo;
  };

  const { data: company, isLoading: isLoadingCompany } = useQuery<Company>({
    queryKey: ["/api/companies", currentUser?.companyId],
    enabled: !!currentUser?.companyId,
  });

  const { data: analytics, isLoading } = useQuery<CompanyAnalytics>({
    queryKey: ["/api/company/analytics"],
    enabled: !!currentUser?.companyId,
  });

  type CleanerWithUser = Cleaner & {
    displayName: string | null;
    phoneNumber: string | null;
    email: string | null;
  };

  const { data: cleaners, isLoading: isLoadingCleaners } = useQuery<CleanerWithUser[]>({
    queryKey: ["/api/company/cleaners"],
    enabled: !!currentUser?.companyId && company?.isActive === 1,
  });

  const { data: invitations, isLoading: isLoadingInvitations } = useQuery<CleanerInvitation[]>({
    queryKey: ["/api/company/invitations"],
    enabled: !!currentUser?.companyId && company?.isActive === 1,
  });

  const { data: geofenceData, isLoading: isLoadingGeofence } = useQuery<{ geofenceArea: Array<[number, number]> | null }>({
    queryKey: ["/api/company/geofence"],
    enabled: !!currentUser?.companyId,
  });

  const updateGeofenceMutation = useMutation({
    mutationFn: async (geofenceArea: Array<[number, number]> | null) => {
      return await apiRequest("PUT", "/api/company/geofence", { geofenceArea });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/geofence"] });
      toast({
        title: "Geofence Updated",
        description: "Your working area geofence has been updated successfully.",
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

  const deactivateCleanerMutation = useMutation({
    mutationFn: async (cleanerId: number) => {
      return await apiRequest("POST", `/api/company/cleaners/${cleanerId}/deactivate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/cleaners"] });
      setDeactivateDialogOpen(false);
      setDeactivatingCleanerId(null);
      toast({
        title: "Cleaner Deactivated",
        description: "The cleaner has been deactivated and logged out.",
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

  const handleDeactivateClick = (cleanerId: number) => {
    setDeactivatingCleanerId(cleanerId);
    setDeactivateDialogOpen(true);
  };

  const handleConfirmDeactivate = () => {
    if (deactivatingCleanerId !== null) {
      deactivateCleanerMutation.mutate(deactivatingCleanerId);
    }
  };

  const handleCancelDeactivate = () => {
    setDeactivateDialogOpen(false);
    setDeactivatingCleanerId(null);
  };

  const reactivateCleanerMutation = useMutation({
    mutationFn: async (cleanerId: number) => {
      return await apiRequest("POST", `/api/company/cleaners/${cleanerId}/reactivate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/cleaners"] });
      setReactivateDialogOpen(false);
      setReactivatingCleanerId(null);
      toast({
        title: "Cleaner Reactivated",
        description: "The cleaner has been reactivated and can now login.",
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

  const handleReactivateClick = (cleanerId: number) => {
    setReactivatingCleanerId(cleanerId);
    setReactivateDialogOpen(true);
  };

  const handleConfirmReactivate = () => {
    if (reactivatingCleanerId !== null) {
      reactivateCleanerMutation.mutate(reactivatingCleanerId);
    }
  };

  const handleCancelReactivate = () => {
    setReactivateDialogOpen(false);
    setReactivatingCleanerId(null);
  };

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
      value: `${analytics.totalRevenue.toLocaleString()} د.إ`,
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
      value: `${analytics.revenueThisMonth.toLocaleString()} د.إ`,
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
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Link href="/company/financials">
              <Button 
                variant="outline"
                data-testid="button-view-financials"
                disabled={company?.isActive === 0}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Financials
              </Button>
            </Link>
            
            <Button
              variant="outline"
              onClick={() => setShowGeofence(!showGeofence)}
              data-testid="button-manage-geofence"
            >
              <Map className="mr-2 h-4 w-4" />
              {showGeofence ? "Hide" : "Manage"} Working Area
            </Button>
            
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

        {/* Geofence Management */}
        {showGeofence && (
          <div className="mt-8">
            {isLoadingGeofence ? (
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[500px] w-full" />
                </CardContent>
              </Card>
            ) : (
              <GeofenceEditor
                initialGeofence={geofenceData?.geofenceArea || undefined}
                onSave={(geofence) => updateGeofenceMutation.mutate(geofence)}
                centerPosition={[25.2048, 55.2708]}
              />
            )}
          </div>
        )}

        {/* Team Management - Unified View */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Your car washers and pending invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCleaners || isLoadingInvitations ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Active Cleaners Section */}
                  {cleaners && cleaners.filter(c => isCleanerOnline(c)).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        Active Now ({cleaners.filter(c => isCleanerOnline(c)).length})
                      </h3>
                      <div className="space-y-2">
                        {cleaners.filter(c => isCleanerOnline(c)).map((cleaner) => {
                          const shiftInfo = analytics.shiftRoster?.find(s => s.cleanerId === cleaner.id);
                          const isThisCleanerBeingDeactivated = deactivatingCleanerId === cleaner.id && deactivateCleanerMutation.isPending;
                          return (
                            <div
                              key={`active-${cleaner.id}`}
                              className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate"
                              data-testid={`team-member-active-${cleaner.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-green-500" />
                                <div>
                                  <p className="font-medium">{cleaner.displayName || `Car Washer #${cleaner.id}`}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {cleaner.phoneNumber || 'No phone'} • {cleaner.totalJobsCompleted} jobs • Rating: {cleaner.rating || "N/A"}
                                    {shiftInfo?.activeShift && ` • On shift: ${shiftInfo.activeShift.duration}m`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="default">Active</Badge>
                                {cleaner.isActive !== 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isThisCleanerBeingDeactivated}
                                    onClick={() => handleDeactivateClick(cleaner.id)}
                                    data-testid={`button-deactivate-${cleaner.id}`}
                                  >
                                    <ShieldOff className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={reactivatingCleanerId === cleaner.id && reactivateCleanerMutation.isPending}
                                    onClick={() => handleReactivateClick(cleaner.id)}
                                    data-testid={`button-reactivate-${cleaner.id}`}
                                  >
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Available/Off Duty Cleaners Section */}
                  {cleaners && cleaners.filter(c => !isCleanerOnline(c)).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                        Off Duty ({cleaners.filter(c => !isCleanerOnline(c)).length})
                      </h3>
                      <div className="space-y-2">
                        {cleaners.filter(c => !isCleanerOnline(c)).map((cleaner) => {
                          const isThisCleanerBeingDeactivated = deactivatingCleanerId === cleaner.id && deactivateCleanerMutation.isPending;
                          return (
                            <div
                              key={`offline-${cleaner.id}`}
                              className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate"
                              data-testid={`team-member-offline-${cleaner.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-gray-400" />
                                <div>
                                  <p className="font-medium">{cleaner.displayName || `Car Washer #${cleaner.id}`}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {cleaner.phoneNumber || 'No phone'} • {cleaner.totalJobsCompleted} jobs • Rating: {cleaner.rating || "N/A"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">Off Duty</Badge>
                                {cleaner.isActive !== 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isThisCleanerBeingDeactivated}
                                    onClick={() => handleDeactivateClick(cleaner.id)}
                                    data-testid={`button-deactivate-${cleaner.id}`}
                                  >
                                    <ShieldOff className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={reactivatingCleanerId === cleaner.id && reactivateCleanerMutation.isPending}
                                    onClick={() => handleReactivateClick(cleaner.id)}
                                    data-testid={`button-reactivate-${cleaner.id}`}
                                  >
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pending Invitations Section */}
                  {invitations && invitations.filter(i => i.status === "pending").length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        Pending Invitations ({invitations.filter(i => i.status === "pending").length})
                      </h3>
                      <div className="space-y-2">
                        {invitations.filter(i => i.status === "pending").map((invitation) => (
                          <div
                            key={`invitation-${invitation.id}`}
                            className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                            data-testid={`team-invitation-${invitation.id}`}
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
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {(!cleaners || cleaners.length === 0) && (!invitations || invitations.filter(i => i.status === "pending").length === 0) && (
                    <div className="text-center text-muted-foreground py-12">
                      <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">No team members yet</p>
                      <p className="text-sm mt-2">
                        Click "Invite Cleaner" to add your first car washer
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Deactivate Confirmation Dialog */}
        <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Deactivate {cleaners?.find(c => c.id === deactivatingCleanerId)?.displayName || `Car Washer #${deactivatingCleanerId}`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                They'll immediately lose access and be logged out. This action can be reversed by clicking the reactivate button.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={handleCancelDeactivate}
                disabled={deactivateCleanerMutation.isPending}
                data-testid="button-cancel-deactivate"
              >
                Cancel
              </AlertDialogCancel>
              <Button
                onClick={handleConfirmDeactivate}
                disabled={deactivateCleanerMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-deactivate"
              >
                {deactivateCleanerMutation.isPending ? "Deactivating..." : "Deactivate"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reactivate Confirmation Dialog */}
        <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Reactivate {cleaners?.find(c => c.id === reactivatingCleanerId)?.displayName || `Car Washer #${reactivatingCleanerId}`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                They'll regain access and be able to login and work again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={handleCancelReactivate}
                disabled={reactivateCleanerMutation.isPending}
                data-testid="button-cancel-reactivate"
              >
                Cancel
              </AlertDialogCancel>
              <Button
                onClick={handleConfirmReactivate}
                disabled={reactivateCleanerMutation.isPending}
                data-testid="button-confirm-reactivate"
              >
                {reactivateCleanerMutation.isPending ? "Reactivating..." : "Reactivate"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
