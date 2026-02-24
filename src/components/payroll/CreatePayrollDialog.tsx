import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreatePayrollDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast({ variant: "destructive", title: "Please fill all fields" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("payroll_periods").insert({
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      created_by: user?.id,
      company_id: profile?.company_id,
    }).select().single();

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      await logAudit("create", "payroll_period", data?.id, undefined, { name: form.name });
      toast({ title: "Payroll period created" });
      setForm({ name: "", start_date: "", end_date: "" });
      onOpenChange(false);
      onSuccess();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Create Payroll Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Period Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="February 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Period"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
