import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, Plus, UserPlus, Trash2 } from "lucide-react";
import { AddShiftDialog } from "@/components/shifts/AddShiftDialog";
import { AssignShiftDialog } from "@/components/shifts/AssignShiftDialog";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
}

interface Assignment {
  id: string;
  date: string;
  user_id: string;
  shift_id: string;
  shift_templates: { name: string } | null;
  profiles: { full_name: string } | null;
}

const Shifts = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canManage = hasRole("admin") || hasRole("hr_manager");

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("shift_templates").select("*"),
      supabase.from("shift_assignments").select("*, shift_templates(name)").order("date", { ascending: false }).limit(50),
    ]);
    if (s) setShifts(s as Shift[]);

    // Fetch profile names for assignments
    if (a && a.length > 0) {
      const userIds = [...new Set(a.map((x: any) => x.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      setAssignments(a.map((x: any) => ({ ...x, profiles: { full_name: profileMap[x.user_id] || "Unknown" } })));
    } else {
      setAssignments([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${m} ${ampm}`;
  };

  const deleteShift = async (id: string) => {
    const { error } = await supabase.from("shift_templates").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      await logAudit("delete", "shift_template", id);
      toast({ title: "Shift deleted" });
      fetchAll();
    }
  };

  const deleteAssignment = async (id: string) => {
    const { error } = await supabase.from("shift_assignments").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      await logAudit("delete", "shift_assignment", id);
      toast({ title: "Assignment removed" });
      fetchAll();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Shifts & Roster</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage shift templates and employee schedules</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />New Shift
              </Button>
              <Button onClick={() => setAssignOpen(true)} disabled={shifts.length === 0}>
                <UserPlus className="w-4 h-4 mr-2" />Assign Shift
              </Button>
            </div>
          )}
        </div>

        {/* Shift Templates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {shifts.map((shift) => (
            <Card key={shift.id} className="p-5 shadow-card">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarClock className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{shift.break_minutes}m break</Badge>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteShift(shift.id)}>
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
              <h3 className="font-display font-semibold text-foreground">{shift.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
              </p>
            </Card>
          ))}
          {shifts.length === 0 && !loading && (
            <Card className="p-8 col-span-full text-center text-muted-foreground">
              No shift templates yet. {canManage ? "Create your first shift to get started." : ""}
            </Card>
          )}
        </div>

        {/* Roster / Assignments Table */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">Shift Assignments</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Date</TableHead>
                {canManage && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : assignments.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No shift assignments yet. {canManage ? "Assign employees to shifts above." : ""}
                </TableCell></TableRow>
              ) : assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-sm">{a.profiles?.full_name || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{a.shift_templates?.name || "—"}</Badge></TableCell>
                  <TableCell className="text-sm">{format(new Date(a.date), "MMM d, yyyy")}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteAssignment(a.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AddShiftDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={fetchAll} />
      <AssignShiftDialog open={assignOpen} onOpenChange={setAssignOpen} onSuccess={fetchAll} shifts={shifts} />
    </AppLayout>
  );
};

export default Shifts;
