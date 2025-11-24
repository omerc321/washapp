import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Calendar, Receipt, Car } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface TipRecord {
  jobId: number;
  completedAt: string;
  carPlateNumber: string;
  customerEmail: string;
  tipAmount: string;
  cleanerStripeFeeShare: string;
  remainingTip: string;
  receiptNumber: string | null;
}

interface TipsResponse {
  tips: TipRecord[];
  summary: {
    totalTips: number;
    totalStripeFees: number;
    totalReceived: number;
    count: number;
  };
}

export default function CleanerTips() {
  const { currentUser } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Construct query string
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);
  const queryString = queryParams.toString();

  const { data, isLoading, refetch } = useQuery<TipsResponse>({
    queryKey: ["/api/cleaner/tips", queryString],
    enabled: !!currentUser,
    staleTime: 0,
  });

  const handleFilter = () => {
    refetch();
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background pb-24 pt-4 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            My Tips
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your earnings from customer tips
          </p>
        </div>

        {/* Filter Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filter by Date
            </CardTitle>
            <CardDescription>Select a date range to view tips</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">From Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  data-testid="input-start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">To Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  data-testid="input-end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleFilter} data-testid="button-filter" className="flex-1">
                Apply Filter
              </Button>
              {(startDate || endDate) && (
                <Button
                  variant="outline"
                  onClick={handleClearFilter}
                  data-testid="button-clear-filter"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
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
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" data-testid="text-total-tips">
                    {data.summary.totalTips.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">AED</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.summary.count} {data.summary.count === 1 ? 'job' : 'jobs'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stripe Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" data-testid="text-stripe-fees">
                    {data.summary.totalStripeFees.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">AED</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Processing fees
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  You Received
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary" data-testid="text-total-received">
                    {data.summary.totalReceived.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">AED</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Net earnings
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Tips List */}
        <Card>
          <CardHeader>
            <CardTitle>Tip History</CardTitle>
            <CardDescription>
              {data?.tips.length === 0
                ? "No tips found for the selected period"
                : `${data?.tips.length || 0} tips received`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : data && data.tips.length > 0 ? (
              <div className="space-y-3">
                {data.tips.map((tip) => (
                  <Card
                    key={tip.jobId}
                    className="border-l-4 border-l-primary/40"
                    data-testid={`card-tip-${tip.jobId}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium" data-testid={`text-plate-${tip.jobId}`}>
                              {tip.carPlateNumber}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(tip.completedAt), "MMM dd, yyyy 'at' h:mm a")}
                          </div>
                          {tip.receiptNumber && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Receipt className="w-3 h-3" />
                              {tip.receiptNumber}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4 md:gap-6 text-center md:text-right">
                          <div>
                            <div className="text-xs text-muted-foreground">Tip</div>
                            <div className="font-semibold" data-testid={`text-tip-amount-${tip.jobId}`}>
                              {Number(tip.tipAmount).toFixed(2)} AED
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Fee</div>
                            <div className="font-semibold text-destructive">
                              -{Number(tip.cleanerStripeFeeShare).toFixed(2)} AED
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Received</div>
                            <div className="font-bold text-primary" data-testid={`text-received-${tip.jobId}`}>
                              {Number(tip.remainingTip).toFixed(2)} AED
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {startDate || endDate
                    ? "No tips found for the selected date range"
                    : "You haven't received any tips yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
