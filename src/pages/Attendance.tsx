import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogIn, LogOut, MapPin } from "lucide-react";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  source: string;
  status: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

const Attendance = () => {
  const { user, profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const { toast } = useToast();

  const fetchRecords = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .order("clock_in", { ascending: false })
      .limit(30);
    if (data) {
      setRecords(data as AttendanceRecord[]);
      const active = data.find(r => !r.clock_out);
      setActiveSession(active as AttendanceRecord || null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [user]);

  const handleClockIn = async () => {
    if (!user) return;
    setClockingIn(true);

    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const { error } = await supabase.from("attendance_records").insert({
      user_id: user.id,
      clock_in: new Date().toISOString(),
      source: "web",
      latitude: lat,
      longitude: lng,
      company_id: profile?.company_id,
    });

    setClockingIn(false);
    if (error) {
      toast({ variant: "destructive", title: "Clock in failed", description: error.message });
    } else {
      toast({ title: "Clocked in successfully!" });
      fetchRecords();
    }
  };

  const handleClockOut = async () => {
    if (!activeSession) return;
    setClockingIn(true);
    const { error } = await supabase.from("attendance_records")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", activeSession.id);

    setClockingIn(false);
    if (error) {
      toast({ variant: "destructive", title: "Clock out failed", description: error.message });
    } else {
      toast({ title: "Clocked out successfully!" });
      fetchRecords();
    }
  };

  const getHoursWorked = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diff.toFixed(1);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Attendance</h1>
            <p className="text-muted-foreground text-sm mt-1">Track your daily clock-in and clock-out</p>
          </div>
        </div>

        {/* Clock In/Out Card */}
        <Card className="p-6 shadow-card">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-2xl gradient-brand flex items-center justify-center">
              <Clock className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="text-center sm:text-left flex-1">
              <p className="text-sm text-muted-foreground">Current Time</p>
              <p className="text-3xl font-bold font-display text-foreground">{format(new Date(), "hh:mm a")}</p>
              <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            </div>
            <div className="flex gap-3">
              {activeSession ? (
                <Button onClick={handleClockOut} disabled={clockingIn} variant="destructive" size="lg" className="gap-2">
                  <LogOut className="w-5 h-5" /> Clock Out
                </Button>
              ) : (
                <Button onClick={handleClockIn} disabled={clockingIn} size="lg" className="gap-2">
                  <LogIn className="w-5 h-5" /> Clock In
                </Button>
              )}
            </div>
          </div>
          {activeSession && (
            <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm text-success font-medium">
                ✓ Currently clocked in since {format(new Date(activeSession.clock_in), "hh:mm a")} — {getHoursWorked(activeSession.clock_in, null)} hrs
              </p>
            </div>
          )}
        </Card>

        {/* History */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">Recent Records</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No attendance records yet</TableCell></TableRow>
              ) : records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{format(new Date(r.clock_in), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-sm">{format(new Date(r.clock_in), "hh:mm a")}</TableCell>
                  <TableCell className="text-sm">{r.clock_out ? format(new Date(r.clock_out), "hh:mm a") : "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{getHoursWorked(r.clock_in, r.clock_out)}h</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{r.source}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Attendance;
