import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { formatPKR } from "@/lib/currency";

interface DeductionType {
  id: string;
  name: string;
  type: string;
  value: number;
}

interface Employee {
  user_id: string;
  full_name: string;
}

interface EmployeeDeduction {
  id: string;
  user_id: string;
  deduction_type_id: string;
  override_value: number | null;
  is_active: boolean;
  deduction_types?: DeductionType;
  profiles?: { full_name: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssignDeductionDialog = ({ open, onOpenChange }: Props) => {
  const [assignments, setAssignments] = useState<EmployeeDeduction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [overrideValue, setOverrideValue] = useState("");
  const [adding, setAdding] = useState(false);
  const companyId = useCompanyId();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [{ data: empData }, { data: dtData }, { data: edData }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").eq("status", "active"),
      supabase.from("deduction_types").select("*").eq("is_active", true),
      supabase.from("employee_deductions").select("*"),
    ]);

    setEmployees((empData as Employee[]) || []);
    setDeductionTypes((dtData as DeductionType[]) || []);

    // Enrich assignments with names
    const empMap = Object.fromEntries((empData || []).map((e: any) => [e.user_id, e.full_name]));
    const dtMap = Object.fromEntries((dtData || []).map((d: any) => [d.id, d]));

    const enriched = ((edData as any[]) || []).map(a => ({
      ...a,
      profiles: { full_name: empMap[a.user_id] || "Unknown" },
      deduction_types: dtMap[a.deduction_type_id] || { name: "Unknown", type: "fixed", value: 0 },
    }));
    setAssignments(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const handleAssign = async () => {
    if (!selectedEmployee || !selectedType || !companyId) return;
    setAdding(true);
    const { error } = await supabase.from("employee_deductions").insert({
      company_id: companyId,
      user_id: selectedEmployee,
      deduction_type_id: selectedType,
      override_value: overrideValue ? Number(overrideValue) : null,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message?.includes("duplicate") ? "This deduction is already assigned to this employee" : error.message });
    } else {
      toast({ title: "Deduction assigned" });
      setSelectedEmployee("");
      setSelectedType("");
      setOverrideValue("");
      fetchData();
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    await supabase.from("employee_deductions").delete().eq("id", id);
    toast({ title: "Deduction removed" });
    fetchData();
  };

  const toggleActive = async (a: EmployeeDeduction) => {
    await supabase.from("employee_deductions").update({ is_active: !a.is_active }).eq("id", a.id);
    fetchData();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Assign Deductions to Employees</DialogTitle>
        </DialogHeader>

        {/* Assign new */}
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Employee</label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Deduction Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {deductionTypes.map(dt => (
                  <SelectItem key={dt.id} value={dt.id}>
                    {dt.name} ({dt.type === "fixed" ? formatPKR(dt.value) : `${dt.value}%`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Override</label>
            <Input type="number" placeholder="Optional" value={overrideValue} onChange={e => setOverrideValue(e.target.value)} className="w-[100px]" />
          </div>
          <Button onClick={handleAssign} disabled={adding || !selectedEmployee || !selectedType} size="icon" className="shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* List */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Deduction</TableHead>
              <TableHead className="text-right">Default Value</TableHead>
              <TableHead className="text-right">Override</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : assignments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No deductions assigned yet</TableCell></TableRow>
            ) : assignments.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-sm">{a.profiles?.full_name}</TableCell>
                <TableCell className="text-sm">{a.deduction_types?.name}</TableCell>
                <TableCell className="text-right text-sm">
                  {a.deduction_types?.type === "fixed" ? formatPKR(a.deduction_types?.value || 0) : `${a.deduction_types?.value}%`}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {a.override_value != null
                    ? (a.deduction_types?.type === "fixed" ? formatPKR(a.override_value) : `${a.override_value}%`)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={a.is_active ? "bg-success/10 text-success border-success/20 cursor-pointer" : "bg-muted text-muted-foreground cursor-pointer"}
                    onClick={() => toggleActive(a)}
                  >
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemove(a.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};
