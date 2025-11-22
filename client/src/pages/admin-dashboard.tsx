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
import { Building2, Users, Briefcase, DollarSign, TrendingUp, CheckCircle2, Check, X, ArrowLeft, Banknote, Settings } from "lucide-react";
import { AdminAnalytics, Company, Transaction, CompanyWithdrawal } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface CompanyFinancialSummary {
  companyId: number;
  companyName: string;
  totalRevenue: number;
  platformFees: number;
  netEarnings: number;
  totalWithdrawals: number;
  availableBalance: number;
}

function FinancialsTab() {
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<CompanyWithdrawal | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<'completed' | 'cancelled'>('completed');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [feeStructureDialogOpen, setFeeStructureDialogOpen] = useState(false);
  const [editFeePackageType, setEditFeePackageType] = useState("custom");
  const [editPlatformFee, setEditPlatformFee] = useState("3.00");

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyFinancialSummary[]>({
    queryKey: ["/api/admin/financials/companies"],
  });

  const { data: companyDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["/api/admin/financials/company", selectedCompany],
    enabled: !!selectedCompany,
  });

  const { data: transactions = [], isLoading: loadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/financials/company", selectedCompany, "transactions"],
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

  const createPaymentMutation = useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return await apiRequest("POST", `/api/admin/financials/company/${selectedCompany}/transactions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials/company", selectedCompany] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials/company", selectedCompany, "transactions"] });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentDescription("");
      toast({
        title: "Payment Transaction Created",
        description: "The payment has been recorded successfully.",
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

  const updateFeeStructureMutation = useMutation({
    mutationFn: async (data: { platformFee: number; feePackageType: string }) => {
      return await apiRequest("PATCH", `/api/admin/company/${selectedCompany}/fee-structure`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financials/company", selectedCompany] });
      setFeeStructureDialogOpen(false);
      setEditPlatformFee("3.00");
      setEditFeePackageType("custom");
      toast({
        title: "Fee Structure Updated",
        description: "The company's fee structure has been updated successfully.",
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
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => setSelectedCompany(null)} data-testid="button-back-to-companies">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Companies
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const company = companies?.find(c => c.companyId === selectedCompany);
              if (company) {
                // Fetch company details to get current fee structure
                fetch(`/api/companies/${selectedCompany}`)
                  .then(res => res.json())
                  .then(data => {
                    setEditFeePackageType(data.feePackageType || "custom");
                    setEditPlatformFee(data.platformFee || "3.00");
                    setFeeStructureDialogOpen(true);
                  });
              }
            }}
            data-testid="button-edit-fee-structure"
          >
            Edit Fee Structure
          </Button>
        </div>

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All financial transactions for this company</CardDescription>
            </div>
            <Button
              onClick={() => setPaymentDialogOpen(true)}
              data-testid="button-add-payment"
            >
              <Banknote className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </CardHeader>
          <CardContent>
            {loadingTransactions ? (
              <p className="text-center text-muted-foreground py-8">Loading transactions...</p>
            ) : transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const typeLabels: Record<string, string> = {
                      customer_payment: 'Customer Payment',
                      admin_payment: 'Admin Payment',
                      refund: 'Refund',
                      withdrawal: 'Withdrawal',
                    };
                    const typeColors: Record<string, string> = {
                      customer_payment: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100',
                      admin_payment: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100',
                      refund: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100',
                      withdrawal: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100',
                    };
                    const isCredit = transaction.direction === 'credit';
                    const displayType = typeLabels[transaction.type] || transaction.type;
                    
                    return (
                      <TableRow key={transaction.id} data-testid={`transaction-${transaction.id}`}>
                        <TableCell className="text-sm">{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            typeColors[transaction.type] || 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100'
                          }`}>
                            {displayType}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-mono" data-testid={`transaction-job-${transaction.id}`}>
                          {transaction.jobId ? `#${transaction.jobId}` : '—'}
                        </TableCell>
                        <TableCell className="text-sm font-mono">{transaction.referenceNumber}</TableCell>
                        <TableCell className="text-sm">{transaction.description || "—"}</TableCell>
                        <TableCell className={`text-right font-medium ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isCredit ? '+' : '-'}{Number(transaction.amount).toFixed(2)} {transaction.currency}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
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

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent data-testid="dialog-add-payment">
            <DialogHeader>
              <DialogTitle>Add Payment Transaction</DialogTitle>
              <DialogDescription>
                Record a payment that reduces the company balance
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="payment-amount">Amount (AED)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  data-testid="input-payment-amount"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available balance: {companyDetails?.summary.availableBalance.toFixed(2)} AED
                </p>
              </div>
              <div>
                <Label htmlFor="payment-description">Description</Label>
                <Textarea
                  id="payment-description"
                  placeholder="Payment description or reference"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  data-testid="textarea-payment-description"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  const amount = parseFloat(paymentAmount);
                  if (!amount || amount <= 0) {
                    toast({
                      title: "Invalid Amount",
                      description: "Please enter a valid amount greater than 0",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!paymentDescription.trim()) {
                    toast({
                      title: "Description Required",
                      description: "Please enter a description for this payment",
                      variant: "destructive",
                    });
                    return;
                  }
                  createPaymentMutation.mutate({
                    amount,
                    description: paymentDescription.trim(),
                  });
                }}
                disabled={createPaymentMutation.isPending}
                data-testid="button-submit-payment"
              >
                Create Payment Transaction
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={feeStructureDialogOpen} onOpenChange={setFeeStructureDialogOpen}>
          <DialogContent data-testid="dialog-edit-fee-structure">
            <DialogHeader>
              <DialogTitle>Edit Fee Structure</DialogTitle>
              <DialogDescription>
                Update the company's pricing package and platform fee
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-feePackageType">Fee Package</Label>
                <Select value={editFeePackageType} onValueChange={setEditFeePackageType}>
                  <SelectTrigger data-testid="select-edit-fee-package">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Fee</SelectItem>
                    <SelectItem value="package1">Package 1 (2 AED + 5% of wash)</SelectItem>
                    <SelectItem value="package2">Package 2 (Offline - No platform fees)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {editFeePackageType === "custom" && "Set a custom platform fee per wash"}
                  {editFeePackageType === "package1" && "2 AED base + 5% of car wash price + 5% VAT"}
                  {editFeePackageType === "package2" && "Offline mode - Car wash price + VAT only (no platform fees)"}
                </p>
              </div>

              {editFeePackageType === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-platformFee">Custom Platform Fee (AED per wash)</Label>
                  <Input
                    id="edit-platformFee"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editPlatformFee}
                    onChange={(e) => setEditPlatformFee(e.target.value)}
                    placeholder="3.00"
                    data-testid="input-edit-platform-fee"
                  />
                  <p className="text-sm text-muted-foreground">
                    Flat fee charged to customers per wash (in addition to company's base price and 5% VAT).
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setFeeStructureDialogOpen(false)}
                  disabled={updateFeeStructureMutation.isPending}
                  data-testid="button-cancel-fee-structure"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    let feeToApply = 0;
                    if (editFeePackageType === "custom") {
                      feeToApply = parseFloat(editPlatformFee);
                    } else if (editFeePackageType === "package1") {
                      feeToApply = 2;
                    }
                    
                    updateFeeStructureMutation.mutate({
                      platformFee: feeToApply,
                      feePackageType: editFeePackageType,
                    });
                  }}
                  disabled={
                    updateFeeStructureMutation.isPending || 
                    (editFeePackageType === "custom" && (!editPlatformFee || parseFloat(editPlatformFee) <= 0))
                  }
                  data-testid="button-confirm-fee-structure"
                >
                  {updateFeeStructureMutation.isPending ? "Updating..." : "Update Fee Structure"}
                </Button>
              </div>
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
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedCompanyForApproval, setSelectedCompanyForApproval] = useState<Company | null>(null);
  const [platformFee, setPlatformFee] = useState("3.00");
  const [feePackageType, setFeePackageType] = useState("custom");
  
  const { data: analytics, isLoading } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: pendingCompanies, isLoading: isLoadingPending } = useQuery<Company[]>({
    queryKey: ["/api/admin/pending-companies"],
  });

  const approveMutation = useMutation({
    mutationFn: async (data: { companyId: number; platformFee: number; feePackageType: string }) => {
      return await apiRequest("POST", `/api/admin/approve-company/${data.companyId}`, {
        platformFee: data.platformFee,
        feePackageType: data.feePackageType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      setApprovalDialogOpen(false);
      setSelectedCompanyForApproval(null);
      setPlatformFee("3.00");
      setFeePackageType("custom");
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
                  <TableHead>Package</TableHead>
                  <TableHead>Price/Wash</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCompanies.map((company) => (
                  <TableRow key={company.id} data-testid={`pending-company-${company.id}`}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.packageType === 'subscription' 
                        ? `Subscription (${company.subscriptionCleanerSlots} slots)` 
                        : 'Pay Per Wash'}
                    </TableCell>
                    <TableCell>{company.pricePerWash} AED</TableCell>
                    <TableCell className="text-sm">{company.tradeLicenseNumber || "N/A"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedCompanyForApproval(company);
                          setPlatformFee("3.00");
                          setFeePackageType("custom");
                          setApprovalDialogOpen(true);
                        }}
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
      
      {/* Approval Dialog with Platform Fee */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent data-testid="dialog-approve-company">
          <DialogHeader>
            <DialogTitle>Approve Company</DialogTitle>
            <DialogDescription>
              Review and approve {selectedCompanyForApproval?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Company Name:</span>
                <span className="text-sm text-muted-foreground">{selectedCompanyForApproval?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Package Type:</span>
                <span className="text-sm text-muted-foreground">
                  {selectedCompanyForApproval?.packageType === 'subscription' ? 'Monthly Subscription' : 'Pay Per Wash'}
                </span>
              </div>
              {selectedCompanyForApproval?.packageType === 'subscription' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Cleaner Slots:</span>
                    <span className="text-sm text-muted-foreground">{selectedCompanyForApproval.subscriptionCleanerSlots}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Monthly Fee:</span>
                    <span className="text-sm font-bold text-primary">
                      {((selectedCompanyForApproval.subscriptionCleanerSlots || 0) / 10 * 500).toFixed(2)} AED
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-sm font-medium">Price Per Wash:</span>
                <span className="text-sm text-muted-foreground">{selectedCompanyForApproval?.pricePerWash} AED</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="feePackageType">Fee Package</Label>
              <Select value={feePackageType} onValueChange={setFeePackageType}>
                <SelectTrigger data-testid="select-fee-package">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Fee</SelectItem>
                  <SelectItem value="package1">Package 1 (2 AED + 5% of wash)</SelectItem>
                  <SelectItem value="package2">Package 2 (Offline - No platform fees)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {feePackageType === "custom" && "Set a custom platform fee per wash"}
                {feePackageType === "package1" && "2 AED base + 5% of car wash price + 5% VAT"}
                {feePackageType === "package2" && "Offline mode - Car wash price + VAT only (no platform fees)"}
              </p>
            </div>

            {feePackageType === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="platformFee">Custom Platform Fee (AED per wash)</Label>
                <Input
                  id="platformFee"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(e.target.value)}
                  placeholder="3.00"
                  data-testid="input-platform-fee"
                />
                <p className="text-sm text-muted-foreground">
                  Flat fee charged to customers per wash (in addition to company's base price and 5% VAT).
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setApprovalDialogOpen(false)}
                disabled={approveMutation.isPending}
                data-testid="button-cancel-approval"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedCompanyForApproval) {
                    let feeToApply = 0;
                    if (feePackageType === "custom") {
                      feeToApply = parseFloat(platformFee);
                    } else if (feePackageType === "package1") {
                      feeToApply = 2; // Base fee for package1, actual calculation done by fee-calculator
                    }
                    
                    approveMutation.mutate({
                      companyId: selectedCompanyForApproval.id,
                      platformFee: feeToApply,
                      feePackageType,
                    });
                  }
                }}
                disabled={
                  approveMutation.isPending || 
                  (feePackageType === "custom" && (!platformFee || parseFloat(platformFee) <= 0))
                }
                data-testid="button-confirm-approval"
              >
                {approveMutation.isPending ? "Approving..." : "Approve Company"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 pt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Admin Dashboard</h1>
            <p className="text-muted-foreground">Platform analytics and insights</p>
          </div>
          <Link href="/admin/settings">
            <Button variant="outline" size="sm" data-testid="button-admin-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
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
