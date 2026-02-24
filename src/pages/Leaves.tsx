import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarDays, Check, X } from "lucide-react";
import { format } from "date-fns";

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  is_paid: boolean;
  color: string;
}

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const Leaves = () => {
  const { user, hasRole, profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const canApprove = hasRole("admin") || hasRole("hr_manager") || hasRole("department_manager");

  const [form, setForm] = useState({
    leave_type_id: "", start_date: "", end_date: "", reason: ""
  });

  const fetchData = async () => {
    setLoading(true);
    const [leavesRes, typesRes] = await Promise.all([
      supabase.from("leave_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("leave_types").select("*"),
    ]);
    if (leavesRes.data) setRequests(leavesRes.data as LeaveRequest[]);
    if (typesRes.data) setLeaveTypes(typesRes.data as LeaveType[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getLeaveTypeName = (id: string) => leaveTypes.find(t => t.id === id)?.name || "—";

  const handleSubmit = async () => {
    if (!user || !form.leave_type_id || !form.start_date || !form.end_date) {
      toast({ variant: "destructive", title: "Please fill all required fields" });
      return;
    }
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: days,
      reason: form.reason || null,
      company_id: profile?.company_id,
    });

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Leave request submitted" });
      setDialogOpen(false);
      setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      fetchData();
    }
  };

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    const { error } = await supabase.from("leave_requests")
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: `Leave ${status}` });
      fetchData();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Leave Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Request and manage time off</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Request Leave
          </Button>
        </div>

        {/* Leave Balance Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {leaveTypes.map((type) => (
            <Card key={type.id} className="p-4 shadow-card text-center">
              <p className="text-xs text-muted-foreground font-medium">{type.name}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{type.days_per_year}</p>
              <p className="text-[10px] text-muted-foreground">days/year</p>
            </Card>
          ))}
        </div>

        {/* Requests Table */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">Leave Requests</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                {canApprove && <TableHead className="w-24">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No leave requests</TableCell></TableRow>
              ) : requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{getLeaveTypeName(r.leave_type_id)}</TableCell>
                  <TableCell className="text-sm">{format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-sm font-medium">{r.days_count}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColors[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                  {canApprove && (
                    <TableCell>
                      {r.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="text-success h-8 w-8" onClick={() => handleReview(r.id, "approved")}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleReview(r.id, "rejected")}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* New Request Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Request Leave</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={form.leave_type_id} onValueChange={v => setForm({...form, leave_type_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Brief reason for leave..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>Submit Request</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Leaves;
