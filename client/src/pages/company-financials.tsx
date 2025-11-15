import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, TrendingUp, TrendingDown, Download, Filter, ArrowLeft } from "lucide-react";
import { Cleaner } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  grossAmount: string;
  netPayableAmount: string;
  taxAmount: string;
  paidAt: Date;
  cleanerName: string | null;
  cleanerEmail: string | null;
  cleanerPhone: string | null;
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
}

export default function CompanyFinancials() {
  const { toast } = useToast();
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: cleaners } = useQuery<Cleaner[]>({
    queryKey: ["/api/company/cleaners"],
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<FinancialSummary>({
    queryKey: ["/api/company/financials/overview"],
  });

  const { data: adminPayouts, isLoading: loadingAdminPayouts } = useQuery<Transaction[]>({
    queryKey: ["/api/company/financials/admin-payouts"],
  });

  const { data: allTransactions, isLoading: loadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/company/financials/transactions"],
  });

  const filters: any = {};
  if (selectedCleanerId && selectedCleanerId !== "all") filters.cleanerId = selectedCleanerId;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const queryParams = new URLSearchParams();
  if (selectedCleanerId && selectedCleanerId !== "all") queryParams.append("cleanerId", selectedCleanerId);
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);

  const { data: jobs, isLoading: loadingJobs } = useQuery<JobFinancial[]>({
    queryKey: ["/api/company/financials/jobs", filters],
    queryFn: async () => {
      const response = await fetch(`/api/company/financials/jobs?${queryParams.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
  });

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
                          <TableCell>{new Date(payout.createdAt).toLocaleDateString()}</TableCell>
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

        {/* Transaction History Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Complete ledger of all financial transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTransactions ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : allTransactions && allTransactions.length > 0 ? (
              <div className="overflow-x-auto">
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
                    {allTransactions.map((transaction) => {
                      const isCredit = transaction.direction === 'credit';
                      const badgeColor = 
                        transaction.type === 'customer_payment' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        transaction.type === 'refund' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        transaction.type === 'admin_payment' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        transaction.type === 'withdrawal' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
                      
                      const typeLabel = 
                        transaction.type === 'customer_payment' ? 'Customer Payment' :
                        transaction.type === 'refund' ? 'Refund' :
                        transaction.type === 'admin_payment' ? 'Admin Payment' :
                        transaction.type === 'withdrawal' ? 'Withdrawal' :
                        transaction.type;

                      return (
                        <TableRow key={transaction.id} data-testid={`transaction-${transaction.id}`}>
                          <TableCell className="text-sm">{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${badgeColor}`}>
                              {typeLabel}
                            </span>
                          </TableCell>
                          <TableCell data-testid={`transaction-job-${transaction.id}`}>
                            {transaction.jobId ? `#${transaction.jobId}` : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{transaction.referenceNumber}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{transaction.description}</TableCell>
                          <TableCell className={`text-right font-medium ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isCredit ? '+' : '-'}{Number(transaction.amount).toFixed(2)} {transaction.currency}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No transactions available</p>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Cleaner</TableHead>
                      <TableHead>Base Amount</TableHead>
                      <TableHead>Base Tax</TableHead>
                      <TableHead>Tip Amount</TableHead>
                      <TableHead>Tip Tax</TableHead>
                      <TableHead>Platform Fee</TableHead>
                      <TableHead>Platform Tax</TableHead>
                      <TableHead>Stripe Fee</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} data-testid={`job-${job.id}`}>
                        <TableCell className="font-medium">#{job.jobId}</TableCell>
                        <TableCell className="min-w-[120px]">{job.cleanerName || "Unassigned"}</TableCell>
                        <TableCell className="min-w-[100px]">{parseFloat(job.baseJobAmount || "0").toFixed(2)} AED</TableCell>
                        <TableCell className="min-w-[80px]">{parseFloat(job.baseTax || "0").toFixed(2)} AED</TableCell>
                        <TableCell className="text-primary font-medium min-w-[100px]">
                          {parseFloat(job.tipAmount || "0") > 0 ? `${parseFloat(job.tipAmount).toFixed(2)} AED` : "-"}
                        </TableCell>
                        <TableCell className="min-w-[80px]">
                          {parseFloat(job.tipTax || "0") > 0 ? `${parseFloat(job.tipTax).toFixed(2)} AED` : "-"}
                        </TableCell>
                        <TableCell className="min-w-[110px]">{parseFloat(job.platformFeeAmount || "0").toFixed(2)} AED</TableCell>
                        <TableCell className="min-w-[100px]">{parseFloat(job.platformFeeTax || "0").toFixed(2)} AED</TableCell>
                        <TableCell className="min-w-[100px]">{parseFloat(job.paymentProcessingFeeAmount || "0").toFixed(2)} AED</TableCell>
                        <TableCell className="font-medium min-w-[100px]">{parseFloat(job.grossAmount || "0").toFixed(2)} AED</TableCell>
                        <TableCell className="font-medium text-green-600 dark:text-green-400 min-w-[100px]">{parseFloat(job.netPayableAmount || "0").toFixed(2)} AED</TableCell>
                        <TableCell className="text-sm min-w-[100px]">{new Date(job.paidAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No financial data available for the selected filters</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
