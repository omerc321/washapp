import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Briefcase, DollarSign, Star, TrendingUp, UserPlus, AlertCircle, Phone, CheckCircle, Clock, XCircle, FileText, ShieldOff, ShieldCheck, Map, Settings, History, Wallet } from "lucide-react";
import { CompanyAnalytics, Cleaner, Company, CleanerInvitation } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import GeofenceEditor from "@/components/geofence-editor";
import GeofenceManager from "@/components/geofence-manager";

export default function CompanyDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedGeofenceIds, setSelectedGeofenceIds] = useState<number[]>([]);
  const [assignAllGeofences, setAssignAllGeofences] = useState(true);
  const [editingCleanerId, setEditingCleanerId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSelectedGeofenceIds, setEditSelectedGeofenceIds] = useState<number[]>([]);
  const [editAssignAllGeofences, setEditAssignAllGeofences] = useState(false);
  const [deactivatingCleanerId, setDeactivatingCleanerId] = useState<number | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivatingCleanerId, setReactivatingCleanerId] = useState<number | null>(null);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [showGeofence, setShowGeofence] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");

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

  type CompanyGeofence = {
    id: number;
    companyId: number;
    name: string;
    polygon: Array<[number, number]>;
    createdAt: Date;
  };

  type CleanerWithUser = Cleaner & {
    displayName: string | null;
    phoneNumber: string | null;
    email: string | null;
    assignedGeofences: CompanyGeofence[];
    isAssignedToAll: boolean;
  };

  const { data: cleaners, isLoading: isLoadingCleaners } = useQuery<CleanerWithUser[]>({
    queryKey: ["/api/company/cleaners"],
    enabled: !!currentUser?.companyId && company?.isActive === 1,
  });

  const { data: invitations, isLoading: isLoadingInvitations } = useQuery<CleanerInvitation[]>({
    queryKey: ["/api/company/invitations"],
    enabled: !!currentUser?.companyId && company?.isActive === 1,
  });

  const { data: geofences = [], isLoading: isLoadingGeofences } = useQuery<CompanyGeofence[]>({
    queryKey: ["/api/company/geofences"],
    enabled: !!currentUser?.companyId && company?.isActive === 1,
  });


  const inviteCleanerMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; geofenceIds?: number[]; assignAll?: boolean }) => {
      return await apiRequest("POST", "/api/company/invite-cleaner", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/invitations"] });
      setIsInviteDialogOpen(false);
      setPhoneNumber("");
      setSelectedGeofenceIds([]);
      setAssignAllGeofences(true);
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

  type CleanerGeofenceResponse = {
    geofences: CompanyGeofence[];
    assignAll: boolean;
  };

  const { data: cleanerAssignmentData } = useQuery<CleanerGeofenceResponse>({
    queryKey: ["/api/company/cleaners", editingCleanerId, "geofences"],
    enabled: !!editingCleanerId,
  });

  const updateCleanerGeofencesMutation = useMutation({
    mutationFn: async (data: { cleanerId: number; geofenceIds?: number[]; assignAll?: boolean }) => {
      return await apiRequest("PUT", `/api/company/cleaners/${data.cleanerId}/geofences`, {
        geofenceIds: data.geofenceIds,
        assignAll: data.assignAll,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/cleaners", editingCleanerId, "geofences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/cleaners"] });
      setEditDialogOpen(false);
      setEditingCleanerId(null);
      setEditSelectedGeofenceIds([]);
      setEditAssignAllGeofences(false);
      toast({
        title: "Service Areas Updated",
        description: "The cleaner's service area assignments have been updated.",
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

  const handleEditGeofences = (cleanerId: number) => {
    setEditingCleanerId(cleanerId);
    setEditDialogOpen(true);
  };

  useEffect(() => {
    if (cleanerAssignmentData) {
      if (cleanerAssignmentData.assignAll) {
        setEditAssignAllGeofences(true);
        setEditSelectedGeofenceIds([]);
      } else {
        setEditAssignAllGeofences(false);
        const geofenceIds = cleanerAssignmentData.geofences.map(g => g.id);
        setEditSelectedGeofenceIds(geofenceIds);
      }
    } else if (editingCleanerId) {
      setEditAssignAllGeofences(false);
      setEditSelectedGeofenceIds([]);
    }
  }, [cleanerAssignmentData, editingCleanerId]);

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

  // Filter cleaners by name and location
  const filterCleaners = (cleanersList: CleanerWithUser[] | undefined) => {
    if (!cleanersList) return [];
    
    return cleanersList.filter((cleaner) => {
      // Filter by name
      const nameMatch = !nameFilter || 
        (cleaner.displayName && cleaner.displayName.toLowerCase().includes(nameFilter.toLowerCase())) ||
        (cleaner.phoneNumber && cleaner.phoneNumber.includes(nameFilter));
      
      // Filter by location
      let locationMatch = true;
      if (locationFilter && locationFilter !== "all") {
        const geofenceId = parseInt(locationFilter);
        if (cleaner.isAssignedToAll) {
          locationMatch = true;
        } else {
          locationMatch = cleaner.assignedGeofences.some(g => g.id === geofenceId);
        }
      }
      
      return nameMatch && locationMatch;
    });
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
      title: "Net Earnings",
      value: `${(analytics.totalNetEarnings || 0).toLocaleString()} AED`,
      icon: DollarSign,
      description: "All time (after fees)",
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
      title: "Net Earnings This Month",
      value: `${(analytics.netEarningsThisMonth || 0).toLocaleString()} AED`,
      icon: DollarSign,
      description: "After fees",
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
            
            <Link href="/company/live-report">
              <Button 
                variant="outline"
                data-testid="button-live-report"
                disabled={company?.isActive === 0}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Live Report
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

            <Link href="/company/shift-history">
              <Button
                variant="outline"
                data-testid="button-shift-history"
                disabled={company?.isActive === 0}
              >
                <History className="mr-2 h-4 w-4" />
                Shift History
              </Button>
            </Link>
            
            <Link href="/company/offline-jobs">
              <Button
                variant="outline"
                data-testid="button-offline-jobs"
                disabled={company?.isActive === 0}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Cash Jobs
              </Button>
            </Link>
            
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

                  {geofences.length > 0 && (
                    <div className="space-y-3 pt-2 border-t">
                      <Label>Assign to Service Areas</Label>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="assign-all"
                          checked={assignAllGeofences}
                          onCheckedChange={(checked) => {
                            setAssignAllGeofences(!!checked);
                            if (checked) {
                              setSelectedGeofenceIds([]);
                            }
                          }}
                          data-testid="checkbox-assign-all-geofences"
                        />
                        <label
                          htmlFor="assign-all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          All service areas
                        </label>
                      </div>

                      {!assignAllGeofences && (
                        <div className="space-y-2 pl-6">
                          <p className="text-sm text-muted-foreground">
                            Select specific service areas:
                          </p>
                          {geofences.map((geofence) => (
                            <div key={geofence.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`geofence-${geofence.id}`}
                                checked={selectedGeofenceIds.includes(geofence.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedGeofenceIds([...selectedGeofenceIds, geofence.id]);
                                  } else {
                                    setSelectedGeofenceIds(selectedGeofenceIds.filter(id => id !== geofence.id));
                                  }
                                }}
                                data-testid={`checkbox-geofence-${geofence.id}`}
                              />
                              <label
                                htmlFor={`geofence-${geofence.id}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {geofence.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      inviteCleanerMutation.mutate({
                        phoneNumber,
                        geofenceIds: assignAllGeofences ? [] : selectedGeofenceIds,
                        assignAll: assignAllGeofences,
                      });
                    }}
                    disabled={inviteCleanerMutation.isPending || !phoneNumber || (!assignAllGeofences && selectedGeofenceIds.length === 0 && geofences.length > 0)}
                    data-testid="button-submit-invite"
                  >
                    {inviteCleanerMutation.isPending ? "Inviting..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Cleaner Geofences Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage Service Areas</DialogTitle>
                  <DialogDescription>
                    Configure which service areas this cleaner can work in.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {geofences.length > 0 ? (
                    <div className="space-y-3">
                      <Label>Assign to Service Areas</Label>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-assign-all"
                          checked={editAssignAllGeofences}
                          onCheckedChange={(checked) => {
                            setEditAssignAllGeofences(!!checked);
                            if (checked) {
                              setEditSelectedGeofenceIds([]);
                            }
                          }}
                          data-testid="checkbox-edit-assign-all-geofences"
                        />
                        <label
                          htmlFor="edit-assign-all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          All service areas
                        </label>
                      </div>

                      {!editAssignAllGeofences && (
                        <div className="space-y-2 pl-6">
                          <p className="text-sm text-muted-foreground">
                            Select specific service areas:
                          </p>
                          {geofences.map((geofence) => (
                            <div key={geofence.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-geofence-${geofence.id}`}
                                checked={editSelectedGeofenceIds.includes(geofence.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setEditSelectedGeofenceIds([...editSelectedGeofenceIds, geofence.id]);
                                  } else {
                                    setEditSelectedGeofenceIds(editSelectedGeofenceIds.filter(id => id !== geofence.id));
                                  }
                                }}
                                data-testid={`checkbox-edit-geofence-${geofence.id}`}
                              />
                              <label
                                htmlFor={`edit-geofence-${geofence.id}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {geofence.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No service areas defined. Please create service areas first.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditDialogOpen(false);
                      setEditingCleanerId(null);
                      setEditSelectedGeofenceIds([]);
                      setEditAssignAllGeofences(false);
                    }}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (editingCleanerId) {
                        updateCleanerGeofencesMutation.mutate({
                          cleanerId: editingCleanerId,
                          geofenceIds: editAssignAllGeofences ? [] : editSelectedGeofenceIds,
                          assignAll: editAssignAllGeofences,
                        });
                      }
                    }}
                    disabled={updateCleanerGeofencesMutation.isPending}
                    data-testid="button-submit-edit"
                  >
                    {updateCleanerGeofencesMutation.isPending ? "Updating..." : "Update"}
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

        {/* Subscription Package Info */}
        {company && company.isActive === 1 && company.packageType === 'subscription' && (
          <Card className="mb-6" data-testid="card-subscription-info">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Subscription Package</span>
                <Badge variant="default">Monthly</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cleaner Slots</p>
                  <p className="text-2xl font-bold">
                    {cleaners?.filter(c => c.isActive === 1).length || 0} / {company.subscriptionCleanerSlots}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">Monthly Fee</p>
                  <p className="text-2xl font-bold text-primary">
                    {((company.subscriptionCleanerSlots || 0) / 10 * 500).toFixed(0)} AED
                  </p>
                </div>
              </div>
              
              {cleaners && invitations && (
                <>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, ((cleaners.filter(c => c.isActive === 1).length + invitations.filter(inv => inv.status === 'pending').length) / (company.subscriptionCleanerSlots || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {cleaners.filter(c => c.isActive === 1).length} active + {invitations.filter(inv => inv.status === 'pending').length} pending
                    </span>
                    {(cleaners.filter(c => c.isActive === 1).length + invitations.filter(inv => inv.status === 'pending').length) >= (company.subscriptionCleanerSlots || 0) && (
                      <span className="text-destructive font-medium">Limit reached</span>
                    )}
                  </div>
                  {(cleaners.filter(c => c.isActive === 1).length + invitations.filter(inv => inv.status === 'pending').length) >= (company.subscriptionCleanerSlots || 0) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        You have reached your cleaner limit. To invite more cleaners, please upgrade your subscription.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
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

        {/* Geofence Management - Multiple Named Service Areas */}
        {showGeofence && currentUser?.companyId && (
          <div className="mt-8">
            <GeofenceManager companyId={currentUser.companyId} />
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
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="name-filter" className="text-sm mb-1.5">Search by Name or Phone</Label>
                      <Input
                        id="name-filter"
                        placeholder="Search cleaners..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        data-testid="input-name-filter"
                        className="bg-background"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="location-filter" className="text-sm mb-1.5">Filter by Location</Label>
                      <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger id="location-filter" data-testid="select-location-filter" className="bg-background">
                          <SelectValue placeholder="All locations" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All locations</SelectItem>
                          {geofences.map((geofence) => (
                            <SelectItem key={geofence.id} value={geofence.id.toString()}>
                              {geofence.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Active Cleaners Section */}
                  {(() => {
                    const filteredActiveCleaners = filterCleaners(cleaners)?.filter(c => isCleanerOnline(c));
                    return filteredActiveCleaners && filteredActiveCleaners.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        Active Now ({filteredActiveCleaners.length})
                      </h3>
                      <div className="space-y-2">
                        {filteredActiveCleaners.map((cleaner) => {
                          const shiftInfo = analytics.shiftRoster?.find(s => s.cleanerId === cleaner.id);
                          const isThisCleanerBeingDeactivated = deactivatingCleanerId === cleaner.id && deactivateCleanerMutation.isPending;
                          const locationText = cleaner.isAssignedToAll 
                            ? "All locations" 
                            : cleaner.assignedGeofences.map(g => g.name).join(", ") || "No location assigned";
                          
                          return (
                            <div
                              key={`active-${cleaner.id}`}
                              className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate"
                              data-testid={`team-member-active-${cleaner.id}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-3 w-3 rounded-full bg-green-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{cleaner.displayName || `Car Washer #${cleaner.id}`}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {cleaner.phoneNumber || 'No phone'} • {cleaner.totalJobsCompleted} jobs • Rating: {cleaner.rating || "N/A"}
                                    {shiftInfo?.activeShift && ` • On shift: ${shiftInfo.activeShift.duration}m`}
                                  </p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <Map className="h-3 w-3" />
                                    {locationText}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="default">Active</Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditGeofences(cleaner.id)}
                                  data-testid={`button-edit-geofences-${cleaner.id}`}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
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
                  );
                  })()}

                  {/* Available/Off Duty Cleaners Section */}
                  {(() => {
                    const filteredOffDutyCleaners = filterCleaners(cleaners)?.filter(c => !isCleanerOnline(c));
                    return filteredOffDutyCleaners && filteredOffDutyCleaners.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                        Off Duty ({filteredOffDutyCleaners.length})
                      </h3>
                      <div className="space-y-2">
                        {filteredOffDutyCleaners.map((cleaner) => {
                          const isThisCleanerBeingDeactivated = deactivatingCleanerId === cleaner.id && deactivateCleanerMutation.isPending;
                          const locationText = cleaner.isAssignedToAll 
                            ? "All locations" 
                            : cleaner.assignedGeofences.map(g => g.name).join(", ") || "No location assigned";
                          
                          return (
                            <div
                              key={`offline-${cleaner.id}`}
                              className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate"
                              data-testid={`team-member-offline-${cleaner.id}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-3 w-3 rounded-full bg-gray-400 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{cleaner.displayName || `Car Washer #${cleaner.id}`}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {cleaner.phoneNumber || 'No phone'} • {cleaner.totalJobsCompleted} jobs • Rating: {cleaner.rating || "N/A"}
                                  </p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <Map className="h-3 w-3" />
                                    {locationText}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">Off Duty</Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditGeofences(cleaner.id)}
                                  data-testid={`button-edit-geofences-${cleaner.id}`}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
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
                  );
                  })()}

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
                                  Invited {new Date(invitation.invitedAt).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Dubai' })}
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
