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

export const AddShiftDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const [form, setForm] = useState({ name: "", start_time: "09:00", end_time: "17:00", break_minutes: "60", color: "#3b82f6" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const handleSave = async () => {
    if (!form.name || !form.start_time || !form.end_time) {
      toast({ variant: "destructive", title: "Please fill all required fields" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("shift_templates").insert({
      name: form.name,
      start_time: form.start_time,
      end_time: form.end_time,
      break_minutes: parseInt(form.break_minutes) || 60,
      color: form.color,
      company_id: profile?.company_id,
    }).select().single();

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      await logAudit("create", "shift_template", data?.id, undefined, { name: form.name });
      toast({ title: "Shift template created" });
      setForm({ name: "", start_time: "09:00", end_time: "17:00", break_minutes: "60", color: "#3b82f6" });
      onOpenChange(false);
      onSuccess();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Create Shift Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Shift Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Morning Shift" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Break (minutes)</Label>
              <Input type="number" value={form.break_minutes} onChange={e => setForm({ ...form, break_minutes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-10 p-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Shift"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
