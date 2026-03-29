import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  periodId: string;
  periodName: string;
}

export const GeneratePayrollDialog = ({ open, onOpenChange, onSuccess, periodId, periodName }: Props) => {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const handleGenerate = async () => {
    setGenerating(true);

    // Fetch all active employees
    const { data: employees, error: empError } = await supabase
      .from("profiles")
      .select("user_id, full_name, basic_salary")
      .eq("status", "active");

    if (empError || !employees) {
      toast({ variant: "destructive", title: "Error fetching employees", description: empError?.message });
      setGenerating(false);
      return;
    }

    // Fetch all active employee deductions with their type info
    const { data: empDeductions } = await supabase
      .from("employee_deductions")
      .select("user_id, deduction_type_id, override_value")
      .eq("is_active", true);

    const { data: deductionTypes } = await supabase
      .from("deduction_types")
      .select("id, name, type, value")
      .eq("is_active", true);

    // Build lookup maps
    const dtMap = Object.fromEntries((deductionTypes || []).map((d: any) => [d.id, d]));
    const empDeductionMap: Record<string, Array<{ type_name: string; calc_type: string; value: number; calculated: number }>> = {};

    for (const ed of (empDeductions || []) as any[]) {
      const dt = dtMap[ed.deduction_type_id];
      if (!dt) continue;
      if (!empDeductionMap[ed.user_id]) empDeductionMap[ed.user_id] = [];
      empDeductionMap[ed.user_id].push({
        type_name: dt.name,
        calc_type: dt.type,
        value: ed.override_value != null ? Number(ed.override_value) : Number(dt.value),
        calculated: 0, // will be calculated per employee
      });
    }

    const items: any[] = [];
    const breakdownInserts: any[] = [];

    for (const emp of employees) {
      const salary = Number(emp.basic_salary) || 0;
      const tax = Math.round(salary * 0.1 * 100) / 100;

      // Calculate deductions for this employee
      const empDeds = empDeductionMap[emp.user_id] || [];
      let totalDeductions = 0;
      const breakdown: Array<{ type_name: string; calc_type: string; value: number; calculated: number }> = [];

      for (const ded of empDeds) {
        let amount = 0;
        if (ded.calc_type === "fixed") {
          amount = ded.value;
        } else {
          // percentage of basic salary
          amount = Math.round(salary * (ded.value / 100) * 100) / 100;
        }
        totalDeductions += amount;
        breakdown.push({ ...ded, calculated: amount });
      }

      totalDeductions = Math.round(totalDeductions * 100) / 100;
      const netPay = salary - tax - totalDeductions;

      const itemId = crypto.randomUUID();
      items.push({
        id: itemId,
        period_id: periodId,
        user_id: emp.user_id,
        basic_salary: salary,
        tax,
        deductions: totalDeductions,
        net_pay: netPay,
        working_days: 22,
        status: "draft",
        company_id: profile?.company_id,
      });

      // Store deduction breakdown for this payroll item
      for (const bd of breakdown) {
        breakdownInserts.push({
          payroll_item_id: itemId,
          deduction_type_name: bd.type_name,
          deduction_type: bd.calc_type,
          value: bd.value,
          calculated_amount: bd.calculated,
        });
      }
    }

    if (items.length === 0) {
      toast({ variant: "destructive", title: "No active employees found" });
      setGenerating(false);
      return;
    }

    const { error } = await supabase.from("payroll_items").insert(items);
    if (error) {
      toast({ variant: "destructive", title: "Error generating payroll", description: error.message });
    } else {
      // Insert deduction breakdowns
      if (breakdownInserts.length > 0) {
        await supabase.from("payroll_item_deductions").insert(breakdownInserts);
      }
      await supabase.from("payroll_periods").update({ status: "preview" }).eq("id", periodId);
      await logAudit("generate_payroll", "payroll_period", periodId, undefined, { employees_count: items.length });
      toast({ title: `Payroll generated for ${items.length} employees` });
      onOpenChange(false);
      onSuccess();
    }
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Generate Payroll</DialogTitle>
          <DialogDescription>
            Generate payslips for all active employees in <strong>{periodName}</strong>. Salary, tax (10%), and assigned deductions will be calculated automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {generating ? "Generating..." : "Generate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
