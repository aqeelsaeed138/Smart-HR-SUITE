import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Clock, CalendarDays, DollarSign, TrendingUp, AlertTriangle,
  CheckCircle, UserCheck, LogIn, LogOut, CalendarClock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Admin / Manager Dashboard ───────────────────────────────────────────────

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalEmployees: 0, presentToday: 0, pendingLeaves: 0, onLeave: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [profilesRes, attendanceRes, pendingRes, onLeaveRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("attendance_records").select("id", { count: "exact", head: true }).gte("clock_in", today),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("leave_requests").select("id", { count: "exact", head: true })
          .eq("status", "approved").lte("start_date", today).gte("end_date", today),
      ]);
      setStats({
        totalEmployees: profilesRes.count || 0,
        presentToday: attendanceRes.count || 0,
        pendingLeaves: pendingRes.count || 0,
        onLeave: onLeaveRes.count || 0,
      });
    };
    fetchStats();
  }, []);

  const kpis = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users, color: "text-primary" },
    { label: "Present Today", value: stats.presentToday, icon: UserCheck, color: "text-success" },
    { label: "Pending Leaves", value: stats.pendingLeaves, icon: CalendarDays, color: "text-warning" },
    { label: "On Leave", value: stats.onLeave, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-5 shadow-card hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-3xl font-bold text-foreground mt-2">{kpi.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg bg-muted ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 shadow-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Recent Attendance
          </h3>
          <p className="text-sm text-muted-foreground">Clock in/out records will appear here once employees start tracking time.</p>
        </Card>
        <Card className="p-6 shadow-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" /> Pending Approvals
          </h3>
          <p className="text-sm text-muted-foreground">Leave requests and time corrections requiring review will show here.</p>
        </Card>
      </div>

      <Card className="p-6 shadow-card">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Workforce Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active", value: stats.totalEmployees, icon: CheckCircle, color: "text-success" },
            { label: "Departments", value: "—", icon: Users, color: "text-primary" },
            { label: "Avg. Hours", value: "—", icon: Clock, color: "text-info" },
            { label: "Payroll Cost", value: "—", icon: DollarSign, color: "text-warning" },
          ].map((item) => (
            <div key={item.label} className="text-center p-3 rounded-lg bg-muted/50">
              <item.icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
              <p className="text-lg font-bold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
};

// ─── Employee Dashboard ──────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  leave_type_id: string;
}

interface ShiftAssignment {
  id: string;
  date: string;
  shift_templates: { name: string; start_time: string; end_time: string } | null;
}

const EmployeeDashboard = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [clockingIn, setClockingIn] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [attRes, leaveRes, shiftRes] = await Promise.all([
        supabase.from("attendance_records").select("id, clock_in, clock_out, status")
          .eq("user_id", user.id).order("clock_in", { ascending: false }).limit(5),
        supabase.from("leave_requests").select("id, start_date, end_date, days_count, status, leave_type_id")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("shift_assignments").select("id, date, shift_templates(name, start_time, end_time)")
          .eq("user_id", user.id).gte("date", today).order("date").limit(5),
      ]);
      if (attRes.data) {
        setAttendance(attRes.data as AttendanceRecord[]);
        const active = attRes.data.find((r: any) => !r.clock_out);
        setActiveSession((active as AttendanceRecord) || null);
      }
      if (leaveRes.data) setLeaves(leaveRes.data as LeaveRequest[]);
      if (shiftRes.data) setShifts(shiftRes.data as ShiftAssignment[]);
    };
    fetchData();
  }, [user]);

  const handleClockIn = async () => {
    if (!user) return;
    setClockingIn(true);
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch {}
    const { error } = await supabase.from("attendance_records").insert({
      user_id: user.id, clock_in: new Date().toISOString(), source: "web",
      latitude: lat, longitude: lng, company_id: profile?.company_id,
    });
    setClockingIn(false);
    if (error) toast({ variant: "destructive", title: "Clock in failed", description: error.message });
    else { toast({ title: "Clocked in!" }); window.location.reload(); }
  };

  const handleClockOut = async () => {
    if (!activeSession) return;
    setClockingIn(true);
    const { error } = await supabase.from("attendance_records")
      .update({ clock_out: new Date().toISOString() }).eq("id", activeSession.id);
    setClockingIn(false);
    if (error) toast({ variant: "destructive", title: "Clock out failed", description: error.message });
    else { toast({ title: "Clocked out!" }); window.location.reload(); }
  };

  const getHours = (clockIn: string, clockOut: string | null) => {
    const diff = ((clockOut ? new Date(clockOut) : new Date()).getTime() - new Date(clockIn).getTime()) / 3600000;
    return diff.toFixed(1);
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    approved: "bg-success/10 text-success border-success/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
    present: "bg-success/10 text-success border-success/20",
  };

  return (
    <>
      {/* Clock In/Out */}
      <Card className="p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center">
            <Clock className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-center sm:text-left flex-1">
            <p className="text-sm text-muted-foreground">Current Time</p>
            <p className="text-3xl font-bold font-display text-foreground">{format(new Date(), "hh:mm a")}</p>
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          </div>
          <div>
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
              ✓ Clocked in since {format(new Date(activeSession.clock_in), "hh:mm a")} — {getHours(activeSession.clock_in, null)} hrs
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Attendance */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">Recent Attendance</h3>
          </div>
          <div className="divide-y">
            {attendance.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No records yet</p>
            ) : attendance.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{format(new Date(r.clock_in), "MMM d")}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.clock_in), "hh:mm a")} – {r.clock_out ? format(new Date(r.clock_out), "hh:mm a") : "Active"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground">{getHours(r.clock_in, r.clock_out)}h</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Leave Requests */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">My Leaves</h3>
          </div>
          <div className="divide-y">
            {leaves.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No leave requests</p>
            ) : leaves.map(l => (
              <div key={l.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(l.start_date), "MMM d")} – {format(new Date(l.end_date), "MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.days_count} day{l.days_count > 1 ? "s" : ""}</p>
                </div>
                <Badge variant="outline" className={statusColors[l.status] || ""}>{l.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Shifts */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">Upcoming Shifts</h3>
          </div>
          <div className="divide-y">
            {shifts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No upcoming shifts</p>
            ) : shifts.map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{format(new Date(s.date), "EEE, MMM d")}</p>
                  <p className="text-xs text-muted-foreground">{s.shift_templates?.name}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.shift_templates ? `${formatTime(s.shift_templates.start_time)} – ${formatTime(s.shift_templates.end_time)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const Dashboard = () => {
  const { profile, roles, hasRole } = useAuth();
  const isManager = hasRole("admin") || hasRole("hr_manager") || hasRole("department_manager") || hasRole("payroll_officer");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isManager ? "Here's your company overview" : "Here's your personal summary"}
          </p>
        </div>

        {isManager ? <AdminDashboard /> : <EmployeeDashboard />}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
