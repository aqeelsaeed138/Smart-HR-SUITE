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

    // Fetch all active employees in the same company
    const { data: employees, error: empError } = await supabase
      .from("profiles")
      .select("user_id, full_name, basic_salary")
      .eq("status", "active");

    if (empError || !employees) {
      toast({ variant: "destructive", title: "Error fetching employees", description: empError?.message });
      setGenerating(false);
      return;
    }

    const items = employees.map(emp => {
      const salary = Number(emp.basic_salary) || 0;
      const tax = Math.round(salary * 0.1 * 100) / 100;
      const deductions = 0;
      const netPay = salary - tax - deductions;
      return {
        period_id: periodId,
        user_id: emp.user_id,
        basic_salary: salary,
        tax,
        deductions,
        net_pay: netPay,
        working_days: 22,
        status: "draft",
        company_id: profile?.company_id,
      };
    });

    if (items.length === 0) {
      toast({ variant: "destructive", title: "No active employees found" });
      setGenerating(false);
      return;
    }

    const { error } = await supabase.from("payroll_items").insert(items);
    if (error) {
      toast({ variant: "destructive", title: "Error generating payroll", description: error.message });
    } else {
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
            Generate payslips for all active employees in <strong>{periodName}</strong>. This will calculate salary, tax (10%), and net pay based on each employee's basic salary.
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
