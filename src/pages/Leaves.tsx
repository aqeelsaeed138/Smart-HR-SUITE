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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X } from "lucide-react";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface RequestForm {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-warning/10 text-warning border-warning/20",
  approved:  "bg-success/10 text-success border-success/20",
  rejected:  "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const INITIAL_FORM: RequestForm = {
  leave_type_id: "",
  start_date: "",
  end_date: "",
  reason: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LeaveTypeCard({ type }: { type: LeaveType }) {
  return (
    <Card className="p-4 shadow-card text-center space-y-1">
      <div
        className="w-3 h-3 rounded-full mx-auto"
        style={{ backgroundColor: type.color ?? "#3b82f6" }}
      />
      <p className="text-xs text-muted-foreground font-medium leading-tight">
        {type.name}
      </p>
      <p className="text-2xl font-bold text-foreground">{type.days_per_year}</p>
      <p className="text-[10px] text-muted-foreground">days / year</p>
      <Badge
        variant="outline"
        className={
          type.is_paid
            ? "text-[10px] border-success/30 text-success bg-success/10"
            : "text-[10px] border-border text-muted-foreground bg-muted"
        }
      >
        {type.is_paid ? "Paid" : "Unpaid"}
      </Badge>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const Leaves = () => {
  const { user, hasRole, profile } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(INITIAL_FORM);

  const canApprove =
    hasRole("admin") ||
    hasRole("hr_manager") ||
    hasRole("department_manager");

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    const [leavesRes, typesRes] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("leave_types").select("*").order("name"),
    ]);

    if (leavesRes.data) setRequests(leavesRes.data as LeaveRequest[]);
    if (typesRes.data) setLeaveTypes(typesRes.data as LeaveType[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const getLeaveTypeName = (id: string) =>
    leaveTypes.find((t) => t.id === id)?.name ?? "—";

  const handleSubmit = async () => {
    if (!user || !form.leave_type_id || !form.start_date || !form.end_date) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in leave type, start date, and end date.",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: calcDays(form.start_date, form.end_date),
      reason: form.reason || null,
      company_id: profile?.company_id,
    });
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Leave request submitted" });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      fetchData();
    }
  };

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: `Leave ${status}` });
      fetchData();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Leave Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Request and manage time off
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Request Leave
          </Button>
        </div>

        {/* Leave type balance cards */}
        {leaveTypes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {leaveTypes.map((type) => (
              <LeaveTypeCard key={type.id} type={type} />
            ))}
          </div>
        )}

        {/* Requests table */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">
              Leave Requests
            </h3>
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
                <TableRow>
                  <TableCell
                    colSpan={canApprove ? 6 : 5}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canApprove ? 6 : 5}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No leave requests yet
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">
                      {getLeaveTypeName(r.leave_type_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.start_date), "MMM d")}
                      {" – "}
                      {format(new Date(r.end_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {r.days_count}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[r.status] ?? ""}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {r.reason || "—"}
                    </TableCell>
                    {canApprove && (
                      <TableCell>
                        {r.status === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-success h-8 w-8"
                              onClick={() => handleReview(r.id, "approved")}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive h-8 w-8"
                              onClick={() => handleReview(r.id, "rejected")}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Request leave dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Request Leave</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Leave type */}
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select
                  value={form.leave_type_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, leave_type_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loading
                          ? "Loading types…"
                          : leaveTypes.length === 0
                          ? "No leave types available"
                          : "Select type"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: t.color ?? "#3b82f6" }}
                          />
                          <span>{t.name}</span>
                          <span className="text-muted-foreground text-xs ml-auto pl-3">
                            {t.days_per_year}d · {t.is_paid ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, end_date: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Days preview */}
              {form.start_date && form.end_date && (
                <p className="text-xs text-muted-foreground">
                  Duration:{" "}
                  <span className="font-semibold text-foreground">
                    {calcDays(form.start_date, form.end_date)} day
                    {calcDays(form.start_date, form.end_date) !== 1 ? "s" : ""}
                  </span>
                </p>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  placeholder="Brief reason for leave…"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setForm(INITIAL_FORM);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
};

export default Leaves;
