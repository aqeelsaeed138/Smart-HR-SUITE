import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Shift { id: string; name: string; }
interface Employee { id: string; user_id: string; full_name: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  shifts: Shift[];
}

export const AssignShiftDialog = ({ open, onOpenChange, onSuccess, shifts }: Props) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ user_id: "", shift_id: "", date: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    if (open) {
      supabase.from("profiles").select("id, user_id, full_name").eq("status", "active").then(({ data }) => {
        if (data) setEmployees(data as Employee[]);
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.user_id || !form.shift_id || !form.date) {
      toast({ variant: "destructive", title: "Please fill all fields" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("shift_assignments").insert({
      user_id: form.user_id,
      shift_id: form.shift_id,
      date: form.date,
      company_id: profile?.company_id,
    });

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      await logAudit("assign_shift", "shift_assignment", undefined, undefined, form);
      toast({ title: "Shift assigned" });
      setForm({ user_id: "", shift_id: "", date: "" });
      onOpenChange(false);
      onSuccess();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Assign Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Shift *</Label>
            <Select value={form.shift_id} onValueChange={v => setForm({ ...form, shift_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
              <SelectContent>
                {shifts.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Assigning..." : "Assign"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
