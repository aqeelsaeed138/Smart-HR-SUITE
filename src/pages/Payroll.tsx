import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, FileText, Download, Plus, Play, CheckCircle, Eye, Trash2, TrendingUp } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { CreatePayrollDialog } from "@/components/payroll/CreatePayrollDialog";
import { GeneratePayrollDialog } from "@/components/payroll/GeneratePayrollDialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PayrollPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

interface PayrollItem {
  id: string;
  user_id: string;
  basic_salary: number;
  tax: number;
  deductions: number;
  net_pay: number;
  working_days: number;
  status: string;
  profiles?: { full_name: string } | null;
}

interface PeriodSummary {
  totalNetPay: number;
  totalBasicSalary: number;
  totalTax: number;
  employeeCount: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  preview: "bg-info/10 text-info border-info/20",
  confirmed: "bg-success/10 text-success border-success/20",
  paid: "bg-primary/10 text-primary border-primary/20",
};

const Payroll = () => {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState<PayrollPeriod | null>(null);
  const [viewPeriod, setViewPeriod] = useState<PayrollPeriod | null>(null);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PayrollPeriod | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [summaryPeriodId, setSummaryPeriodId] = useState<string>("");
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const { hasRole, user } = useAuth();
  const { toast } = useToast();
  const canManage = hasRole("admin") || hasRole("payroll_officer");

  const fetchPeriods = async () => {
    setLoading(true);
    const { data } = await supabase.from("payroll_periods").select("*").order("created_at", { ascending: false });
    if (data) {
      setPeriods(data as PayrollPeriod[]);
      // Auto-select the most recent non-draft period for the summary
      const firstWithItems = (data as PayrollPeriod[]).find(p => p.status !== "draft");
      if (firstWithItems) setSummaryPeriodId(firstWithItems.id);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPeriods(); }, []);

  useEffect(() => {
    if (!summaryPeriodId) { setPeriodSummary(null); return; }
    const fetchSummary = async () => {
      setSummaryLoading(true);
      const { data } = await supabase
        .from("payroll_items")
        .select("basic_salary, tax, deductions, net_pay")
        .eq("period_id", summaryPeriodId);
      if (data && data.length > 0) {
        setPeriodSummary({
          totalNetPay: data.reduce((s, r) => s + Number(r.net_pay), 0),
          totalBasicSalary: data.reduce((s, r) => s + Number(r.basic_salary), 0),
          totalTax: data.reduce((s, r) => s + Number(r.tax), 0),
          employeeCount: data.length,
        });
      } else {
        setPeriodSummary(null);
      }
      setSummaryLoading(false);
    };
    fetchSummary();
  }, [summaryPeriodId]);

  const fetchItemsForPeriod = async (period: PayrollPeriod): Promise<PayrollItem[]> => {
    const { data } = await supabase.from("payroll_items").select("*").eq("period_id", period.id);
    if (!data || data.length === 0) return [];
    const userIds = [...new Set(data.map((x: any) => x.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));
    return data.map((x: any) => ({ ...x, profiles: { full_name: profileMap[x.user_id] || "Unknown" } }));
  };

  const viewPayslips = async (period: PayrollPeriod) => {
    setViewPeriod(period);
    setItemsLoading(true);
    const items = await fetchItemsForPeriod(period);
    setPayrollItems(items);
    setItemsLoading(false);
  };

  const downloadCSV = async (period: PayrollPeriod) => {
    const items = await fetchItemsForPeriod(period);
    if (items.length === 0) {
      toast({ variant: "destructive", title: "No payslips to download" });
      return;
    }
    const headers = ["Employee", "Basic Salary (PKR)", "Tax (PKR)", "Deductions (PKR)", "Net Pay (PKR)", "Working Days", "Status"];
    const rows = items.map(item => [
      item.profiles?.full_name || "Unknown",
      Number(item.basic_salary).toFixed(2),
      Number(item.tax).toFixed(2),
      Number(item.deductions).toFixed(2),
      Number(item.net_pay).toFixed(2),
      item.working_days,
      item.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${period.name.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded payroll for ${period.name}` });
  };

  const deletePeriod = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("payroll_items").delete().eq("period_id", deleteTarget.id);
    await supabase.from("payroll_periods").delete().eq("id", deleteTarget.id);
    await logAudit("delete", "payroll_period", deleteTarget.id);
    toast({ title: `Payroll period "${deleteTarget.name}" deleted` });
    setDeleteTarget(null);
    setDeleting(false);
    fetchPeriods();
  };

  const confirmPayroll = async (periodId: string) => {
    await supabase.from("payroll_periods").update({ status: "confirmed", confirmed_by: user?.id, confirmed_at: new Date().toISOString() }).eq("id", periodId);
    await supabase.from("payroll_items").update({ status: "confirmed" }).eq("period_id", periodId);
    await logAudit("confirm", "payroll_period", periodId);
    toast({ title: "Payroll confirmed" });
    fetchPeriods();
    if (viewPeriod?.id === periodId) setViewPeriod(prev => prev ? { ...prev, status: "confirmed" } : null);
  };

  const markPaid = async (periodId: string) => {
    await supabase.from("payroll_periods").update({ status: "paid" }).eq("id", periodId);
    await supabase.from("payroll_items").update({ status: "paid" }).eq("period_id", periodId);
    await logAudit("mark_paid", "payroll_period", periodId);
    toast({ title: "Payroll marked as paid" });
    fetchPeriods();
    if (viewPeriod?.id === periodId) setViewPeriod(prev => prev ? { ...prev, status: "paid" } : null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Payroll</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage payroll periods and payslips</p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />New Period
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10"><Banknote className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Periods</p>
                <p className="text-xl font-bold text-foreground">{periods.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-warning/10"><FileText className="w-5 h-5 text-warning" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Draft</p>
                <p className="text-xl font-bold text-foreground">{periods.filter(p => p.status === "draft").length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-success/10"><Download className="w-5 h-5 text-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-foreground">{periods.filter(p => p.status === "paid").length}</p>
              </div>
            </div>
          </Card>

          {/* Payroll Cost Summary Card */}
          <Card className="p-5 shadow-card col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-chart-1/10 shrink-0"><TrendingUp className="w-5 h-5 text-chart-1" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-muted-foreground font-medium">Monthly Payroll Cost</p>
                </div>
                <Select value={summaryPeriodId} onValueChange={setSummaryPeriodId}>
                  <SelectTrigger className="h-7 text-xs mb-2">
                    <SelectValue placeholder="Select period…" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.filter(p => p.status !== "draft").map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {summaryLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : periodSummary ? (
                  <>
                    <p className="text-lg font-bold text-foreground leading-tight">{formatPKR(periodSummary.totalNetPay)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {periodSummary.employeeCount} employees · Tax {formatPKR(periodSummary.totalTax)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Periods Table */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">Payroll Periods</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : periods.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No payroll periods yet. {canManage ? "Create your first payroll run to get started." : ""}
                </TableCell></TableRow>
              ) : periods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell className="text-sm">{p.start_date}</TableCell>
                  <TableCell className="text-sm">{p.end_date}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColors[p.status]}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {canManage && p.status === "draft" && (
                        <Button variant="ghost" size="sm" onClick={() => setGeneratePeriod(p)}>
                          <Play className="w-3.5 h-3.5 mr-1" />Generate
                        </Button>
                      )}
                      {(p.status === "preview" || p.status === "confirmed" || p.status === "paid") && (
                        <Button variant="ghost" size="sm" onClick={() => viewPayslips(p)}>
                          <Eye className="w-3.5 h-3.5 mr-1" />View
                        </Button>
                      )}
                      {(p.status === "preview" || p.status === "confirmed" || p.status === "paid") && (
                        <Button variant="ghost" size="sm" onClick={() => downloadCSV(p)}>
                          <Download className="w-3.5 h-3.5 mr-1" />Download
                        </Button>
                      )}
                      {canManage && p.status === "preview" && (
                        <Button variant="ghost" size="sm" onClick={() => confirmPayroll(p.id)}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />Confirm
                        </Button>
                      )}
                      {canManage && p.status === "confirmed" && (
                        <Button variant="ghost" size="sm" onClick={() => markPaid(p.id)}>
                          <Banknote className="w-3.5 h-3.5 mr-1" />Mark Paid
                        </Button>
                      )}
                      {canManage && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(p)}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <CreatePayrollDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={fetchPeriods} />
      {generatePeriod && (
        <GeneratePayrollDialog
          open={!!generatePeriod}
          onOpenChange={(o) => !o && setGeneratePeriod(null)}
          onSuccess={fetchPeriods}
          periodId={generatePeriod.id}
          periodName={generatePeriod.name}
        />
      )}

      {/* Payslips View Dialog */}
      <Dialog open={!!viewPeriod} onOpenChange={(o) => !o && setViewPeriod(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Payslips — {viewPeriod?.name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic Salary</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : payrollItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payslips generated</TableCell></TableRow>
              ) : payrollItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.profiles?.full_name}</TableCell>
                  <TableCell className="text-right text-sm">{formatPKR(Number(item.basic_salary))}</TableCell>
                  <TableCell className="text-right text-sm text-destructive">{formatPKR(Number(item.tax))}</TableCell>
                  <TableCell className="text-right text-sm">{formatPKR(Number(item.deductions))}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatPKR(Number(item.net_pay))}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColors[item.status]}>{item.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {viewPeriod && (
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => downloadCSV(viewPeriod)}>
                <Download className="w-4 h-4 mr-2" />Download CSV
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all its payslips. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deletePeriod}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Payroll;
