import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Briefcase, DollarSign, TrendingUp, CheckCircle2, Check, X, ArrowLeft, Banknote } from "lucide-react";
import { AdminAnalytics, Company } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompanyFinancialSummary {
  companyId: number;
  companyName: string;
  totalRevenue: number;
  platformFees: number;
  netEarnings: number;
  totalWithdrawals: number;
  availableBalance: number;
}

interface CompanyWithdrawal {
  id: number;
  companyId: number;
  amount: string;
  status: 'pending' | 'completed' | 'cancelled';
  referenceNumber?: string;
  note?: string;
  processedAt?: Date;
  createdAt: Date;
}

function FinancialsTab() {
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<CompanyWithdrawal | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<'completed' | 'cancelled'>('completed');

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyFinancialSummary[]>({
    queryKey: ["/api/admin/financials/companies"],
  });

  const { data: companyDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["/api/admin/financials/company", selectedCompany],
    enabled: !!selectedCompany,
  });

  const processWithdrawalMutation = useMutation({
    mutationFn: async (data: { id: number; status: string; referenceNumber?: string; note?: string }) => {
      return await apiRequest("PATCH", `/api/admin/financials/withdrawals/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials/company", selectedCompany] });
      setWithdrawalDialogOpen(false);
      setSelectedWithdrawal(null);
      setReferenceNumber("");
      setNote("");
      toast({
        title: "Withdrawal Processed",
        description: "The withdrawal has been updated successfully.",
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

  if (selectedCompany && companyDetails) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedCompany(null)} data-testid="button-back-to-companies">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Companies
        </Button>

        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-total-revenue">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyDetails.summary.totalRevenue.toFixed(2)} AED</div>
            </CardContent>
          </Card>
          <Card data-testid="card-platform-fees">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyDetails.summary.platformFees.toFixed(2)} AED</div>
            </CardContent>
          </Card>
          <Card data-testid="card-net-earnings">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyDetails.summary.netEarnings.toFixed(2)} AED</div>
            </CardContent>
          </Card>
          <Card data-testid="card-available-balance">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyDetails.summary.availableBalance.toFixed(2)} AED</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawals</CardTitle>
            <CardDescription>Company withdrawal history</CardDescription>
          </CardHeader>
          <CardContent>
            {companyDetails.withdrawals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyDetails.withdrawals.map((withdrawal: CompanyWithdrawal) => (
                    <TableRow key={withdrawal.id} data-testid={`withdrawal-${withdrawal.id}`}>
                      <TableCell className="font-medium">{Number(withdrawal.amount).toFixed(2)} AED</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          withdrawal.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100' :
                          withdrawal.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100' :
                          'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                        }`}>
                          {withdrawal.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{withdrawal.referenceNumber || "—"}</TableCell>
                      <TableCell className="text-sm">{new Date(withdrawal.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {withdrawal.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal);
                              setWithdrawalDialogOpen(true);
                            }}
                            data-testid={`button-process-${withdrawal.id}`}
                          >
                            Process
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No withdrawals yet</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
          <DialogContent data-testid="dialog-process-withdrawal">
            <DialogHeader>
              <DialogTitle>Process Withdrawal</DialogTitle>
              <DialogDescription>
                Update the status of this withdrawal request
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  value={`${Number(selectedWithdrawal?.amount || 0).toFixed(2)} AED`}
                  disabled
                  data-testid="input-amount"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as 'completed' | 'cancelled')}>
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reference">Reference Number</Label>
                <Input
                  id="reference"
                  placeholder="Bank transfer reference"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  data-testid="input-reference"
                />
              </div>
              <div>
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  placeholder="Optional note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  data-testid="textarea-note"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (selectedWithdrawal) {
                    processWithdrawalMutation.mutate({
                      id: selectedWithdrawal.id,
                      status,
                      referenceNumber: referenceNumber || undefined,
                      note: note || undefined,
                    });
                  }
                }}
                disabled={processWithdrawalMutation.isPending}
                data-testid="button-submit-withdrawal"
              >
                Update Withdrawal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Financials</CardTitle>
        <CardDescription>View and manage company financial data</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingCompanies ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : companies && companies.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Platform Fees</TableHead>
                <TableHead>Net Earnings</TableHead>
                <TableHead>Withdrawals</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.companyId} data-testid={`company-${company.companyId}`}>
                  <TableCell className="font-medium">{company.companyName}</TableCell>
                  <TableCell>{company.totalRevenue.toFixed(2)} AED</TableCell>
                  <TableCell>{company.platformFees.toFixed(2)} AED</TableCell>
                  <TableCell>{company.netEarnings.toFixed(2)} AED</TableCell>
                  <TableCell>{company.totalWithdrawals.toFixed(2)} AED</TableCell>
                  <TableCell className="font-medium">{company.availableBalance.toFixed(2)} AED</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedCompany(company.companyId)}
                      data-testid={`button-view-${company.companyId}`}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No financial data available</p>
        )}
      </CardContent>
    </Card>
  );
}

function AnalyticsTab() {
  const { toast } = useToast();
  const { data: analytics, isLoading } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: pendingCompanies, isLoading: isLoadingPending } = useQuery<Company[]>({
    queryKey: ["/api/admin/pending-companies"],
  });

  const approveMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest("POST", `/api/admin/approve-company/${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({
        title: "Company Approved",
        description: "The company has been approved and is now active.",
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

  const rejectMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest("POST", `/api/admin/reject-company/${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({
        title: "Company Rejected",
        description: "The company has been rejected.",
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

  if (isLoading || !analytics) {
    return (
      <div className="space-y-4">
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
    );
  }

  const metrics = [
    { title: "Total Companies", value: analytics.totalCompanies, icon: Building2, description: "Registered companies" },
    { title: "Total Cleaners", value: analytics.totalCleaners, icon: Users, description: "Active cleaners" },
    { title: "Active Jobs", value: analytics.activeJobs, icon: Briefcase, description: "Currently ongoing" },
    { title: "Completed Jobs", value: analytics.completedJobs, icon: CheckCircle2, description: "All time" },
    { title: "Total Revenue", value: `${analytics.totalRevenue.toLocaleString()} AED`, icon: DollarSign, description: "All time" },
    { title: "Revenue This Month", value: `${analytics.revenueThisMonth.toLocaleString()} AED`, icon: TrendingUp, description: "Current month" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title} data-testid={`metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Company Approvals</CardTitle>
          <CardDescription>Review and approve new company registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPending ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pendingCompanies && pendingCompanies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead>Price/Wash</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCompanies.map((company) => (
                  <TableRow key={company.id} data-testid={`pending-company-${company.id}`}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground">{company.description || "N/A"}</TableCell>
                    <TableCell>{company.pricePerWash} AED</TableCell>
                    <TableCell className="text-sm">{company.tradeLicenseNumber || "N/A"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => approveMutation.mutate(company.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-approve-${company.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMutation.mutate(company.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-reject-${company.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No pending companies to review</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform analytics and insights</p>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6" data-testid="tabs-admin">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials">
              <Banknote className="h-4 w-4 mr-2" />
              Financials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-4">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="financials" className="space-y-4">
            <FinancialsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
