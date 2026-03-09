import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, FileText, Download, Plus, Play, CheckCircle, Eye } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { CreatePayrollDialog } from "@/components/payroll/CreatePayrollDialog";
import { GeneratePayrollDialog } from "@/components/payroll/GeneratePayrollDialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const { hasRole, user } = useAuth();
  const { toast } = useToast();
  const canManage = hasRole("admin") || hasRole("payroll_officer");

  const fetchPeriods = async () => {
    setLoading(true);
    const { data } = await supabase.from("payroll_periods").select("*").order("created_at", { ascending: false });
    if (data) setPeriods(data as PayrollPeriod[]);
    setLoading(false);
  };

  useEffect(() => { fetchPeriods(); }, []);

  const viewPayslips = async (period: PayrollPeriod) => {
    setViewPeriod(period);
    setItemsLoading(true);
    const { data } = await supabase.from("payroll_items").select("*").eq("period_id", period.id);
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((x: any) => x.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      setPayrollItems(data.map((x: any) => ({ ...x, profiles: { full_name: profileMap[x.user_id] || "Unknown" } })));
    } else {
      setPayrollItems([]);
    }
    setItemsLoading(false);
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                {canManage && <TableHead className="text-right">Actions</TableHead>}
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
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status === "draft" && (
                          <Button variant="ghost" size="sm" onClick={() => setGeneratePeriod(p)}>
                            <Play className="w-3.5 h-3.5 mr-1" />Generate
                          </Button>
                        )}
                        {(p.status === "preview" || p.status === "confirmed" || p.status === "paid") && (
                          <Button variant="ghost" size="sm" onClick={() => viewPayslips(p)}>
                            <Eye className="w-3.5 h-3.5 mr-1" />View
                          </Button>
                        )}
                        {p.status === "preview" && (
                          <Button variant="ghost" size="sm" onClick={() => confirmPayroll(p.id)}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Confirm
                          </Button>
                        )}
                        {p.status === "confirmed" && (
                          <Button variant="ghost" size="sm" onClick={() => markPaid(p.id)}>
                            <DollarSign className="w-3.5 h-3.5 mr-1" />Mark Paid
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
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
                  <TableCell className="text-right text-sm">${Number(item.basic_salary).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm text-destructive">${Number(item.tax).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">${Number(item.deductions).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">${Number(item.net_pay).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColors[item.status]}>{item.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Payroll;
