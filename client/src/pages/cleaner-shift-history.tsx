import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Download, Calendar, Clock, AlertCircle, Timer, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
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

  const queryKey = ["/api/cleaner/shift-history"];
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const queryString = params.toString();
  const fullUrl = queryString ? `${queryKey[0]}?${queryString}` : queryKey[0];

  const { data: shiftHistory = [], isLoading, error } = useQuery<ShiftHistoryItem[]>({
    queryKey: [fullUrl],
    enabled: !!currentUser,
  });

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("My Shift History");

    worksheet.columns = [
      { header: "Start Date", key: "startDate", width: 20 },
      { header: "Start Time", key: "startTime", width: 15 },
      { header: "End Date", key: "endDate", width: 20 },
      { header: "End Time", key: "endTime", width: 15 },
      { header: "Duration (Hours)", key: "duration", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];

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

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

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

  const totalDuration = shiftHistory.reduce((acc, shift) => {
    return acc + (shift.durationMinutes || 0);
  }, 0);

  const totalHours = Math.floor(totalDuration / 60);
  const totalMinutes = totalDuration % 60;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-20">
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 mb-6 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-4">
            <Link href="/cleaner">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">Shift History</h1>
              <p className="text-white/90">
                Track your work hours and performance
              </p>
            </div>
            <Button 
              onClick={exportToExcel}
              disabled={shiftHistory.length === 0}
              className="bg-white text-primary hover:bg-white/90 shadow-lg"
              data-testid="button-export-excel"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          {/* Stats Summary */}
          {shiftHistory.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4" />
                  <p className="text-sm opacity-90">Total Shifts</p>
                </div>
                <p className="text-3xl font-bold">{shiftHistory.length}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="h-4 w-4" />
                  <p className="text-sm opacity-90">Total Hours</p>
                </div>
                <p className="text-3xl font-bold">{totalHours}h {totalMinutes}m</p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Filters Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-6 shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Filter by Date</CardTitle>
              </div>
              <CardDescription>Select a date range to view specific shifts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-12"
                    data-testid="input-start-date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-12"
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              {(startDate || endDate) && (
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
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load shift history. Please try again later.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Shift History Cards */}
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-1/3 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : shiftHistory.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-12 text-center border-dashed">
                <Clock className="h-20 w-20 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-xl font-medium mb-2">No Shift History Found</p>
                <p className="text-muted-foreground">
                  No shifts have been recorded yet. Start your first shift to see it here!
                </p>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {shiftHistory.map((shift, index) => {
                const isOngoing = !shift.shiftEnd;
                const startDate = new Date(shift.shiftStart);
                const endDate = shift.shiftEnd ? new Date(shift.shiftEnd) : null;
                const durationHours = shift.durationMinutes ? Math.floor(shift.durationMinutes / 60) : 0;
                const durationMinutes = shift.durationMinutes ? shift.durationMinutes % 60 : 0;

                return (
                  <motion.div
                    key={shift.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    layout
                  >
                    <Card 
                      className={`overflow-hidden shadow-md hover-elevate ${
                        isOngoing ? 'border-green-500/50 bg-gradient-to-r from-green-500/5 to-transparent' : ''
                      }`}
                      data-testid={`shift-row-${shift.id}`}
                    >
                      {/* Status Banner */}
                      <div className={`p-4 ${isOngoing ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-primary to-primary/80'}`}>
                        <div className="flex items-center justify-between text-white">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                              {isOngoing ? (
                                <Timer className="h-6 w-6 animate-pulse" />
                              ) : (
                                <CheckCircle2 className="h-6 w-6" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm opacity-90">
                                {format(startDate, "EEEE, MMM d, yyyy")}
                              </p>
                              <p className="text-2xl font-bold" data-testid={`shift-date-${shift.id}`}>
                                {isOngoing ? "Ongoing Shift" : `${durationHours}h ${durationMinutes}m`}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            className={`${
                              isOngoing 
                                ? 'bg-white text-green-600 animate-pulse' 
                                : 'bg-white/20 text-white border-white/30'
                            } px-3 py-1.5`}
                          >
                            {isOngoing ? "● Active" : "Completed"}
                          </Badge>
                        </div>
                      </div>

                      <CardContent className="p-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Start Time */}
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Clock className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Started</p>
                              <p className="font-bold" data-testid={`shift-start-${shift.id}`}>
                                {format(startDate, "h:mm a")}
                              </p>
                            </div>
                          </div>

                          {/* End Time */}
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              isOngoing ? 'bg-green-500/10' : 'bg-primary/10'
                            }`}>
                              {isOngoing ? (
                                <Timer className="h-5 w-5 text-green-600 animate-pulse" />
                              ) : (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {isOngoing ? "In Progress" : "Ended"}
                              </p>
                              <p className="font-bold" data-testid={`shift-end-${shift.id}`}>
                                {isOngoing ? (
                                  <span className="text-green-600">Active Now</span>
                                ) : (
                                  endDate && format(endDate, "h:mm a")
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Duration Summary */}
                        {!isOngoing && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Timer className="h-5 w-5 text-primary" />
                                <span className="font-medium">Total Duration</span>
                              </div>
                              <span className="text-2xl font-bold text-primary" data-testid={`shift-duration-${shift.id}`}>
                                {durationHours}h {durationMinutes}m
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
