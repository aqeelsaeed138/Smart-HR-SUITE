import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const roles = [
  { value: "employee", label: "Employee" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "payroll_officer", label: "Payroll Officer" },
  { value: "department_manager", label: "Department Manager" },
  { value: "it_ops", label: "IT Ops" },
  { value: "admin", label: "Admin" },
];

export const AddEmployeeDialog = ({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "employee",
    department: "", position: "", employee_id: "", phone: "", basic_salary: "",
  });

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast({ variant: "destructive", title: "Please fill in name, email and password" });
      return;
    }
    if (form.password.length < 6) {
      toast({ variant: "destructive", title: "Password must be at least 6 characters" });
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("create-employee", {
      body: form,
    });

    setSaving(false);

    if (res.error || res.data?.error) {
      toast({ variant: "destructive", title: "Error", description: res.data?.error || res.error?.message });
      return;
    }

    toast({ title: "Employee added successfully" });
    setForm({ full_name: "", email: "", password: "", role: "employee", department: "", position: "", employee_id: "", phone: "", basic_salary: "" });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Add New Employee</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="col-span-2 space-y-2">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Employee ID</Label>
            <Input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} placeholder="EMP-001" />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Position</Label>
            <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Basic Salary (PKR)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">PKR</span>
              <Input
                type="number"
                min="0"
                className="pl-12"
                value={form.basic_salary}
                onChange={e => setForm({ ...form, basic_salary: e.target.value })}
                placeholder="50000"
              />
            </div>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Employee
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
