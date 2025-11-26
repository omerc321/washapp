import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, TrendingDown, Download, Filter, ArrowLeft, Banknote, Upload, FileText, Briefcase, Wallet, Car } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cleaner } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/PaginationControls";

interface JobFinancial {
  id: number;
  jobId: number;
  cleanerId: number | null;
  baseJobAmount: string;
  baseTax: string;
  tipAmount: string;
  tipTax: string;
  platformFeeAmount: string;
  platformFeeTax: string;
  paymentProcessingFeeAmount: string;
  companyStripeFeeShare: string;
  cleanerStripeFeeShare: string;
  remainingTip: string;
  grossAmount: string;
  netPayableAmount: string;
  taxAmount: string;
  paidAt: Date;
  refundedAt: Date | null;
  cleanerName: string | null;
  cleanerEmail: string | null;
  cleanerPhone: string | null;
  feePackageType: string | null;
  receiptNumber: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  jobStatus: string | null;
}

interface FinancialSummary {
  totalRevenue: number;
  totalRefunds: number;
  platformFees: number;
  paymentProcessingFees: number;
  taxAmount: number;
  netEarnings: number;
  adminPayouts: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  availableBalance: number;
}

interface Transaction {
  id: number;
  referenceNumber: string;
  companyId: number;
  jobId: number | null;
  type: string;
  direction: string;
  amount: string;
  currency: string;
  description: string;
  createdAt: Date;
  grossAmount?: string;
  netAmount?: string;
  taxAmount?: string;
  cleanerName?: string;
  cleanerEmail?: string;
}

interface WithdrawalBalance {
  completedJobs: number;
  totalJobValue: number;
  totalTips: number;
  totalWithdrawn: number;
  availableJobs: number;
  availableJobValue: number;
  availableTips: number;
  pricePerWash: number;
  withdrawnJobs: number;
  withdrawnTips: number;
}

interface WithdrawalHistory {
  id: number;
  amount: string;
  status: string;
  referenceNumber: string | null;
  note: string | null;
  invoiceUrl: string | null;
  jobCountRequested: number | null;
  tipsRequested: string | null;
  baseAmount: string | null;
  vatAmount: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

interface OfflineJob {
  id: number;
  cleanerId: number;
  companyId: number;
  carPlateEmirate: string;
  carPlateCode: string;
  carPlateNumber: string;
  locationAddress: string | null;
  locationLatitude: string | null;
  locationLongitude: string | null;
  servicePrice: string;
  taxAmount: string;
  totalAmount: string;
  notes: string | null;
  createdAt: Date;
  cleanerName?: string | null;
}

export default function CompanyFinancials() {
  const { toast } = useToast();
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [jobCount, setJobCount] = useState<number>(0);
  const [tipsAmount, setTipsAmount] = useState<string>("0");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [offlineCleanerFilter, setOfflineCleanerFilter] = useState<string>("all");
  const [offlineStartDate, setOfflineStartDate] = useState<string>("");
  const [offlineEndDate, setOfflineEndDate] = useState<string>("");
  const [offlinePage, setOfflinePage] = useState(1);

  const { data: cleaners } = useQuery<Cleaner[]>({
    queryKey: ["/api/company/cleaners"],
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<FinancialSummary>({
    queryKey: ["/api/company/financials/overview"],
  });

  const { data: adminPayouts, isLoading: loadingAdminPayouts } = useQuery<Transaction[]>({
    queryKey: ["/api/company/financials/admin-payouts"],
  });

  const { data: withdrawalBalance } = useQuery<WithdrawalBalance>({
    queryKey: ["/api/company/financials/withdrawal-balance"],
  });

  const { data: withdrawalHistory } = useQuery<WithdrawalHistory[]>({
    queryKey: ["/api/company/financials/withdrawals"],
  });

  const offlinePageSize = 20;
  
  const offlineQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (offlineCleanerFilter && offlineCleanerFilter !== "all") params.append("cleanerId", offlineCleanerFilter);
    if (offlineStartDate) params.append("startDate", offlineStartDate);
    if (offlineEndDate) params.append("endDate", offlineEndDate);
    params.append("page", String(offlinePage));
    params.append("pageSize", String(offlinePageSize));
    return params.toString();
  }, [offlineCleanerFilter, offlineStartDate, offlineEndDate, offlinePage]);

  const { data: offlineJobsResponse, isLoading: loadingOfflineJobs } = useQuery<{ data: OfflineJob[], total: number }>({
    queryKey: ["/api/company/offline-jobs", offlineCleanerFilter, offlineStartDate, offlineEndDate, offlinePage],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/company/offline-jobs?${offlineQueryString}`);
      return response.json();
    },
  });

  const offlineJobs = offlineJobsResponse?.data || [];
  const offlineTotal = offlineJobsResponse?.total || 0;
  const offlineTotalPages = Math.ceil(offlineTotal / offlinePageSize);

  const withdrawalMutation = useMutation({
    mutationFn: async (data: { jobCount: number; tipsAmount: string; invoiceUrl: string }) => {
      return await apiRequest("POST", "/api/company/financials/request-withdrawal", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/withdrawal-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/financials/overview"] });
      setWithdrawalDialogOpen(false);
      setJobCount(0);
      setTipsAmount("0");
      setInvoiceFile(null);
      toast({
        title: "Withdrawal Requested",
        description: "Your withdrawal request has been submitted for processing.",
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

  const handleInvoiceUpload = async (): Promise<string | null> => {
    if (!invoiceFile) return null;
    
    const formData = new FormData();
    formData.append("file", invoiceFile);
    
    const response = await fetch("/api/upload-invoice", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error("Failed to upload invoice");
    }
    
    const result = await response.json();
    return result.url;
  };

  const handleWithdrawalSubmit = async () => {
    if (!invoiceFile) {
      toast({
        title: "Error",
        description: "Please upload an invoice",
        variant: "destructive",
      });
      return;
    }
    
    if (jobCount < 1) {
      toast({
        title: "Error",
        description: "Please select at least 1 job to withdraw",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setUploading(true);
      const invoiceUrl = await handleInvoiceUpload();
      if (!invoiceUrl) {
        throw new Error("Failed to upload invoice");
      }
      
      withdrawalMutation.mutate({
        jobCount,
        tipsAmount,
        invoiceUrl,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const calculateWithdrawalTotal = () => {
    if (!withdrawalBalance) return { baseAmount: 0, vatAmount: 0, tips: 0, total: 0 };
    const baseAmount = jobCount * withdrawalBalance.pricePerWash;
    const vatAmount = baseAmount * 0.05;
    const tips = parseFloat(tipsAmount || "0");
    const total = baseAmount + vatAmount + tips;
    return { baseAmount, vatAmount, tips, total };
  };

  const filters: any = {};
  if (selectedCleanerId && selectedCleanerId !== "all") filters.cleanerId = selectedCleanerId;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const queryParams = new URLSearchParams();
  if (selectedCleanerId && selectedCleanerId !== "all") queryParams.append("cleanerId", selectedCleanerId);
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);
  queryParams.append("page", String(page));
  queryParams.append("pageSize", String(pageSize));

  const { data: jobsResponse, isLoading: loadingJobs } = useQuery<{ data: JobFinancial[], total: number }>({
    queryKey: ["/api/company/financials/jobs", filters, page],
    queryFn: async () => {
      const response = await fetch(`/api/company/financials/jobs?${queryParams.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
  });

  const jobs = jobsResponse?.data || [];
  const total = jobsResponse?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleExport = async () => {
    try {
      const response = await fetch("/api/company/financials/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(filters),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financials-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Financial report has been downloaded",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loadingSummary || !summary) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 pt-4">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-32" /></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <Link href="/company">
          <Button variant="ghost" className="mb-4" data-testid="button-back-to-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Financial Reports</h1>
          <p className="text-muted-foreground">View revenue breakdown and export data</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card data-testid="card-total-revenue">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Number(summary.totalRevenue).toFixed(2)} AED</div>
              <p className="text-xs text-muted-foreground mt-1">Before refunds & fees</p>
            </CardContent>
          </Card>
          <Card data-testid="card-refunds">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Refunds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">-{Number(summary.totalRefunds).toFixed(2)} AED</div>
              <p className="text-xs text-muted-foreground mt-1">Auto-refunded jobs</p>
            </CardContent>
          </Card>
          <Card data-testid="card-platform-fees">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">-{Number(summary.platformFees).toFixed(2)} AED</div>
              <p className="text-xs text-muted-foreground mt-1">Service fees</p>
            </CardContent>
          </Card>
          <Card data-testid="card-net-earnings">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{Number(summary.netEarnings).toFixed(2)} AED</div>
              <p className="text-xs text-muted-foreground mt-1">After all deductions</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Payment Breakdown Row */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card data-testid="card-admin-payouts">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Admin Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">-{Number(summary.adminPayouts).toFixed(2)} AED</div>
              <p className="text-xs text-muted-foreground mt-1">Already paid to you</p>
            </CardContent>
          </Card>
          <Card data-testid="card-tax-collected">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tax Collected (5%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Number(summary.taxAmount).toFixed(2)} AED</div>
              <p className="text-xs text-muted-foreground mt-1">Included in gross revenue</p>
            </CardContent>
          </Card>
          <Card data-testid="card-available-balance">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${Number(summary.availableBalance) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {Number(summary.availableBalance).toFixed(2)} AED
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Number(summary.availableBalance) < 0 ? 'Negative balance' : 'Available for withdrawal'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Payouts Section */}
        {adminPayouts && adminPayouts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Admin Payouts</CardTitle>
              <CardDescription>Payments already made to your company</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAdminPayouts ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminPayouts.map((payout) => (
                        <TableRow key={payout.id} data-testid={`payout-${payout.id}`}>
                          <TableCell className="font-medium">{payout.referenceNumber}</TableCell>
                          <TableCell>{new Date(payout.createdAt).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Dubai' })}</TableCell>
                          <TableCell>{payout.description}</TableCell>
                          <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                            -{Number(payout.amount).toFixed(2)} {payout.currency}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Withdrawal Request Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Request Withdrawal
                </CardTitle>
                <CardDescription>Request payment for completed jobs</CardDescription>
              </div>
              <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-request-withdrawal" disabled={!withdrawalBalance || withdrawalBalance.availableJobs < 1}>
                    <Banknote className="h-4 w-4 mr-2" />
                    Request Withdrawal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Request Withdrawal</DialogTitle>
                    <DialogDescription>
                      Select jobs and tips to withdraw. Invoice upload is required.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {withdrawalBalance && (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Available Jobs:</span>
                          <span className="font-medium">{withdrawalBalance.availableJobs}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Price per Wash:</span>
                          <span className="font-medium">{withdrawalBalance.pricePerWash.toFixed(2)} AED</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Available Job Value:</span>
                          <span className="font-medium">{withdrawalBalance.availableJobValue.toFixed(2)} AED</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2">
                          <span>Available Tips:</span>
                          <span className="font-medium text-green-600">{withdrawalBalance.availableTips.toFixed(2)} AED</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="job-count">Number of Jobs to Withdraw</Label>
                        <Input
                          id="job-count"
                          type="number"
                          min="0"
                          max={withdrawalBalance.availableJobs}
                          value={jobCount}
                          onChange={(e) => setJobCount(Math.min(parseInt(e.target.value) || 0, withdrawalBalance.availableJobs))}
                          data-testid="input-job-count"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum: {withdrawalBalance.availableJobs} jobs
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tips-amount">Tips Amount (AED)</Label>
                        <Input
                          id="tips-amount"
                          type="number"
                          min="0"
                          max={withdrawalBalance.availableTips}
                          step="0.01"
                          value={tipsAmount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setTipsAmount(Math.min(val, withdrawalBalance.availableTips).toString());
                          }}
                          data-testid="input-tips-amount"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum: {withdrawalBalance.availableTips.toFixed(2)} AED (Tips are VAT-exempt)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice-upload">Upload Invoice (Required)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="invoice-upload"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                            data-testid="input-invoice-upload"
                            className="flex-1"
                          />
                          {invoiceFile && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {invoiceFile.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          PDF, PNG, or JPG. Max 5MB.
                        </p>
                      </div>

                      {/* Calculation Preview */}
                      {jobCount > 0 && (
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                          <h4 className="font-medium text-sm">Withdrawal Summary</h4>
                          <div className="flex justify-between text-sm">
                            <span>{jobCount} jobs × {withdrawalBalance.pricePerWash.toFixed(2)} AED:</span>
                            <span>{calculateWithdrawalTotal().baseAmount.toFixed(2)} AED</span>
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>VAT (5%):</span>
                            <span>{calculateWithdrawalTotal().vatAmount.toFixed(2)} AED</span>
                          </div>
                          {parseFloat(tipsAmount) > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Tips (VAT-exempt):</span>
                              <span>{parseFloat(tipsAmount).toFixed(2)} AED</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-base border-t pt-2">
                            <span>Total:</span>
                            <span>{calculateWithdrawalTotal().total.toFixed(2)} AED</span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setWithdrawalDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleWithdrawalSubmit}
                          disabled={uploading || withdrawalMutation.isPending || jobCount < 1 || !invoiceFile}
                          data-testid="button-submit-withdrawal"
                        >
                          {uploading || withdrawalMutation.isPending ? "Processing..." : "Submit Request"}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {withdrawalBalance ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-sm">Available Jobs</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-available-jobs">
                    {withdrawalBalance.availableJobs}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Worth {withdrawalBalance.availableJobValue.toFixed(2)} AED
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Available Tips</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-available-tips">
                    {withdrawalBalance.availableTips.toFixed(2)} AED
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    VAT-exempt
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-sm">Total Completed</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {withdrawalBalance.completedJobs}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    All-time jobs
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Banknote className="h-4 w-4" />
                    <span className="text-sm">Already Withdrawn</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {withdrawalBalance.withdrawnJobs} jobs
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {withdrawalBalance.totalWithdrawn.toFixed(2)} AED total
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading withdrawal balance...</p>
              </div>
            )}

            {/* Withdrawal History */}
            {withdrawalHistory && withdrawalHistory.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium mb-4">Withdrawal History</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Jobs</TableHead>
                        <TableHead>Tips</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalHistory.map((withdrawal) => (
                        <TableRow key={withdrawal.id} data-testid={`withdrawal-${withdrawal.id}`}>
                          <TableCell>
                            {new Date(withdrawal.createdAt).toLocaleDateString('en-AE', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              timeZone: 'Asia/Dubai'
                            })}
                          </TableCell>
                          <TableCell>{withdrawal.jobCountRequested || '-'}</TableCell>
                          <TableCell>{withdrawal.tipsRequested ? `${parseFloat(withdrawal.tipsRequested).toFixed(2)} AED` : '-'}</TableCell>
                          <TableCell className="font-medium">{parseFloat(withdrawal.amount).toFixed(2)} AED</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              withdrawal.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                : withdrawal.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                            }`}>
                              {withdrawal.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {withdrawal.invoiceUrl ? (
                              <a
                                href={withdrawal.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <FileText className="h-3 w-3" />
                                View
                              </a>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Job Financials</CardTitle>
                <CardDescription>Filter and export financial data</CardDescription>
              </div>
              <Button onClick={handleExport} data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div>
                <Label htmlFor="cleaner-filter">Filter by Cleaner</Label>
                <Select value={selectedCleanerId} onValueChange={setSelectedCleanerId}>
                  <SelectTrigger id="cleaner-filter" data-testid="select-cleaner">
                    <SelectValue placeholder="All Cleaners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cleaners</SelectItem>
                    {cleaners?.map((cleaner) => (
                      <SelectItem key={cleaner.id} value={String(cleaner.id)}>
                        Cleaner #{cleaner.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            {loadingJobs ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : jobs && jobs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Stripe Ref</TableHead>
                        <TableHead>Cleaner</TableHead>
                        <TableHead>Base Amount</TableHead>
                        <TableHead>Base Tax</TableHead>
                        <TableHead>Total Tip</TableHead>
                        <TableHead>Tip VAT</TableHead>
                        <TableHead>Remaining Tip</TableHead>
                        <TableHead>Platform Fee</TableHead>
                        <TableHead>Platform Tax</TableHead>
                        <TableHead>Stripe Fee</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Net</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => {
                        const isRefunded = job.refundedAt !== null;
                        const isPackage2 = (job.feePackageType || 'custom').toLowerCase() === 'package2';
                        const tipAmount = parseFloat(job.tipAmount || "0");
                        const tipTax = parseFloat(job.tipTax || "0");
                        const totalTip = tipAmount + tipTax;
                        const remainingTip = parseFloat(job.remainingTip || "0");
                        const hasTip = totalTip > 0;
                        
                        // Format job status for display
                        const statusDisplay = job.jobStatus === 'refunded_unattended' ? 'Refunded (Unattended)' :
                                            job.jobStatus === 'refunded' ? 'Refunded (Manual)' :
                                            job.jobStatus?.toUpperCase() || 'N/A';
                        const statusColor = job.jobStatus?.includes('refunded') ? 'text-red-600 dark:text-red-400' : 
                                          job.jobStatus === 'completed' ? 'text-green-600 dark:text-green-400' :
                                          'text-muted-foreground';
                        
                        return (
                          <TableRow key={job.id} data-testid={`job-${job.id}`}>
                            <TableCell className="font-medium">#{job.jobId}</TableCell>
                            <TableCell className={`min-w-[120px] ${statusColor}`}>{statusDisplay}</TableCell>
                            <TableCell className="font-mono text-xs min-w-[150px]">{job.receiptNumber || '-'}</TableCell>
                            <TableCell className="font-mono text-xs min-w-[180px]">
                              <div className="flex flex-col gap-1">
                                {job.stripePaymentIntentId && (
                                  <div className="text-green-600 dark:text-green-400" title="Payment Intent ID">
                                    Pay: {job.stripePaymentIntentId.substring(0, 20)}...
                                  </div>
                                )}
                                {job.stripeRefundId && (
                                  <div className="text-red-600 dark:text-red-400" title="Refund ID">
                                    Ref: {job.stripeRefundId.substring(0, 20)}...
                                  </div>
                                )}
                                {!job.stripePaymentIntentId && !job.stripeRefundId && '-'}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[120px]">{job.cleanerName || "Unassigned"}</TableCell>
                            <TableCell className="min-w-[100px]">{parseFloat(job.baseJobAmount || "0").toFixed(2)} AED</TableCell>
                            <TableCell className="min-w-[80px]">{parseFloat(job.baseTax || "0").toFixed(2)} AED</TableCell>
                            <TableCell className="text-primary font-medium min-w-[100px]">
                              {hasTip ? `${totalTip.toFixed(2)} AED` : "-"}
                            </TableCell>
                            <TableCell className="min-w-[80px]">
                              {hasTip ? `${tipTax.toFixed(2)} AED` : "-"}
                            </TableCell>
                            <TableCell className="text-green-600 dark:text-green-400 font-medium min-w-[120px]">
                              {hasTip ? `${remainingTip.toFixed(2)} AED` : "-"}
                            </TableCell>
                            <TableCell className="min-w-[110px]">{parseFloat(job.platformFeeAmount || "0").toFixed(2)} AED</TableCell>
                            <TableCell className="min-w-[100px]">{parseFloat(job.platformFeeTax || "0").toFixed(2)} AED</TableCell>
                            <TableCell className="min-w-[100px]">
                              {isPackage2 ? `${parseFloat(job.paymentProcessingFeeAmount || "0").toFixed(2)} AED` : "-"}
                            </TableCell>
                            <TableCell className="font-medium min-w-[100px]">{parseFloat(job.grossAmount || "0").toFixed(2)} AED</TableCell>
                            <TableCell className={`font-medium min-w-[100px] ${isRefunded ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {parseFloat(job.netPayableAmount || "0").toFixed(2)} AED
                            </TableCell>
                            <TableCell className="text-sm min-w-[100px]">{new Date(job.paidAt).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Dubai' })}</TableCell>
                            <TableCell className="min-w-[80px]">
                              {job.receiptNumber ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(`/api/company/receipt/${job.jobId}`, '_blank')}
                                  title="Download Receipt"
                                  data-testid={`button-download-receipt-${job.jobId}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls 
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  className="mt-4"
                />
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">No financial data available for the selected filters</p>
            )}
          </CardContent>
        </Card>

        {/* Offline Jobs Section */}
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Offline / Cash Jobs</CardTitle>
                  <CardDescription>Jobs recorded by cleaners with cash or other offline payments</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div>
                <Label htmlFor="offline-cleaner-filter">Filter by Cleaner</Label>
                <Select value={offlineCleanerFilter} onValueChange={(val) => { setOfflineCleanerFilter(val); setOfflinePage(1); }}>
                  <SelectTrigger id="offline-cleaner-filter" data-testid="select-offline-cleaner">
                    <SelectValue placeholder="All Cleaners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cleaners</SelectItem>
                    {cleaners?.map((cleaner) => (
                      <SelectItem key={cleaner.id} value={String(cleaner.id)}>
                        Cleaner #{cleaner.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="offline-start-date">Start Date</Label>
                <Input
                  id="offline-start-date"
                  type="date"
                  value={offlineStartDate}
                  onChange={(e) => { setOfflineStartDate(e.target.value); setOfflinePage(1); }}
                  data-testid="input-offline-start-date"
                />
              </div>
              <div>
                <Label htmlFor="offline-end-date">End Date</Label>
                <Input
                  id="offline-end-date"
                  type="date"
                  value={offlineEndDate}
                  onChange={(e) => { setOfflineEndDate(e.target.value); setOfflinePage(1); }}
                  data-testid="input-offline-end-date"
                />
              </div>
            </div>

            {loadingOfflineJobs ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : offlineJobs && offlineJobs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Car Plate</TableHead>
                        <TableHead>Cleaner</TableHead>
                        <TableHead>Service Price</TableHead>
                        <TableHead>VAT (5%)</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offlineJobs.map((job) => (
                        <TableRow key={job.id} data-testid={`offline-job-${job.id}`}>
                          <TableCell className="font-medium">#{job.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <span>{job.carPlateEmirate} {job.carPlateCode} {job.carPlateNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell>{job.cleanerName || `Cleaner #${job.cleanerId}`}</TableCell>
                          <TableCell>{parseFloat(job.servicePrice || "0").toFixed(2)} AED</TableCell>
                          <TableCell>{parseFloat(job.taxAmount || "0").toFixed(2)} AED</TableCell>
                          <TableCell className="font-semibold text-primary">{parseFloat(job.totalAmount || "0").toFixed(2)} AED</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={job.notes || ''}>
                            {job.notes || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(job.createdAt).toLocaleDateString('en-AE', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric', 
                              timeZone: 'Asia/Dubai' 
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls 
                  currentPage={offlinePage}
                  totalPages={offlineTotalPages}
                  onPageChange={setOfflinePage}
                  className="mt-4"
                />
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">No offline jobs recorded yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
