import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Download, Calendar, Clock, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import ExcelJS from "exceljs";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ShiftHistoryItem = {
  id: number;
  cleanerId: number;
  companyId: number;
  shiftStart: string;
  shiftEnd: string | null;
  durationMinutes: number | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
};

export default function CleanerShiftHistory() {
  const { currentUser } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Construct query key with filters as separate segments
  const queryKey = ["/api/cleaner/shift-history"];
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const queryString = params.toString();
  const fullUrl = queryString ? `${queryKey[0]}?${queryString}` : queryKey[0];

  // Fetch shift history using default query setup
  const { data: shiftHistory = [], isLoading, error } = useQuery<ShiftHistoryItem[]>({
    queryKey: [fullUrl],
    enabled: !!currentUser,
  });

  // Export to Excel
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("My Shift History");

    // Define columns
    worksheet.columns = [
      { header: "Start Date", key: "startDate", width: 20 },
      { header: "Start Time", key: "startTime", width: 15 },
      { header: "End Date", key: "endDate", width: 20 },
      { header: "End Time", key: "endTime", width: 15 },
      { header: "Duration (Hours)", key: "duration", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];

    // Add data
    shiftHistory.forEach(shift => {
      const startDate = new Date(shift.shiftStart);
      const endDate = shift.shiftEnd ? new Date(shift.shiftEnd) : null;
      const durationHours = shift.durationMinutes ? (shift.durationMinutes / 60).toFixed(2) : "Ongoing";

      worksheet.addRow({
        startDate: format(startDate, "PPP"),
        startTime: format(startDate, "p"),
        endDate: endDate ? format(endDate, "PPP") : "-",
        endTime: endDate ? format(endDate, "p") : "-",
        duration: durationHours,
        status: shift.shiftEnd ? "Completed" : "Ongoing",
      });
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Generate file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-shift-history-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/cleaner">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">My Shift History</h1>
            <p className="text-muted-foreground">
              View and export your shift records
            </p>
          </div>
          <Button 
            onClick={exportToExcel}
            disabled={shiftHistory.length === 0}
            data-testid="button-export-excel"
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        {/* Filters Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter your shift history by date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
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

            {/* Clear Filters Button */}
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {shiftHistory.length} shift{shiftHistory.length !== 1 ? "s" : ""}
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load shift history. Please try again later.
            </AlertDescription>
          </Alert>
        )}

        {/* Shift History List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : shiftHistory.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Shift History Found</p>
            <p className="text-muted-foreground">
              No shifts have been recorded yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {shiftHistory.map((shift) => {
              const isOngoing = !shift.shiftEnd;
              const durationText = shift.durationMinutes
                ? `${Math.floor(shift.durationMinutes / 60)}h ${shift.durationMinutes % 60}m`
                : "Ongoing";

              return (
                <Card key={shift.id} data-testid={`shift-${shift.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          Shift on {format(new Date(shift.shiftStart), "PPP")}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            Started {formatDistanceToNow(new Date(shift.shiftStart), { addSuffix: true })}
                          </div>
                        </CardDescription>
                      </div>
                      <Badge
                        variant={isOngoing ? "default" : "secondary"}
                        data-testid={`badge-status-${shift.id}`}
                      >
                        {isOngoing ? "Ongoing" : "Completed"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {/* Start Time */}
                      <div>
                        <p className="text-muted-foreground font-medium mb-1">Start Time</p>
                        <p className="font-semibold" data-testid={`shift-start-${shift.id}`}>
                          {format(new Date(shift.shiftStart), "p")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(shift.shiftStart), "PPP")}
                        </p>
                      </div>

                      {/* End Time / Duration */}
                      <div>
                        <p className="text-muted-foreground font-medium mb-1">
                          {isOngoing ? "Current Duration" : "End Time"}
                        </p>
                        {isOngoing ? (
                          <>
                            <p className="font-semibold" data-testid={`shift-duration-${shift.id}`}>
                              {formatDistanceToNow(new Date(shift.shiftStart))}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">In progress</p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold" data-testid={`shift-end-${shift.id}`}>
                              {shift.shiftEnd ? format(new Date(shift.shiftEnd), "p") : "-"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {shift.shiftEnd ? format(new Date(shift.shiftEnd), "PPP") : "-"}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Total Duration */}
                      <div>
                        <p className="text-muted-foreground font-medium mb-1">
                          {isOngoing ? "Time Elapsed" : "Total Duration"}
                        </p>
                        <p className="font-semibold">{durationText}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {shift.durationMinutes ? `${(shift.durationMinutes / 60).toFixed(1)} hours` : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
