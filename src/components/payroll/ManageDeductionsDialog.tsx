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
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageDeductionsDialog = ({ open, onOpenChange }: Props) => {
  const [types, setTypes] = useState<DeductionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"fixed" | "percentage">("fixed");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const companyId = useCompanyId();
  const { toast } = useToast();

  const fetchTypes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("deduction_types")
      .select("*")
      .order("created_at", { ascending: true });
    setTypes((data as DeductionType[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchTypes();
  }, [open]);

  const handleAdd = async () => {
    if (!name.trim() || !value || !companyId) return;
    setAdding(true);
    const { error } = await supabase.from("deduction_types").insert({
      company_id: companyId,
      name: name.trim(),
      type,
      value: Number(value),
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: `Deduction type "${name}" added` });
      setName("");
      setValue("");
      setType("fixed");
      fetchTypes();
    }
    setAdding(false);
  };

  const toggleActive = async (dt: DeductionType) => {
    await supabase.from("deduction_types").update({ is_active: !dt.is_active }).eq("id", dt.id);
    fetchTypes();
  };

  const handleDelete = async (dt: DeductionType) => {
    const { error } = await supabase.from("deduction_types").delete().eq("id", dt.id);
    if (error) {
      toast({ variant: "destructive", title: "Cannot delete", description: "This deduction type may be assigned to employees." });
    } else {
      toast({ title: `"${dt.name}" deleted` });
      fetchTypes();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Manage Deduction Types</DialogTitle>
        </DialogHeader>

        {/* Add new */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <Input placeholder="e.g. Provident Fund" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <Select value={type} onValueChange={(v: "fixed" | "percentage") => setType(v)}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed (PKR)</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Value</label>
            <Input type="number" placeholder={type === "fixed" ? "Amount" : "%"} value={value} onChange={e => setValue(e.target.value)} className="w-[90px]" />
          </div>
          <Button onClick={handleAdd} disabled={adding || !name.trim() || !value} size="icon" className="shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* List */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : types.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No deduction types defined yet</TableCell></TableRow>
            ) : types.map(dt => (
              <TableRow key={dt.id}>
                <TableCell className="font-medium text-sm">{dt.name}</TableCell>
                <TableCell className="text-sm capitalize">{dt.type}</TableCell>
                <TableCell className="text-right text-sm">
                  {dt.type === "fixed" ? formatPKR(dt.value) : `${dt.value}%`}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={dt.is_active ? "bg-success/10 text-success border-success/20 cursor-pointer" : "bg-muted text-muted-foreground cursor-pointer"}
                    onClick={() => toggleActive(dt)}
                  >
                    {dt.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(dt)}>
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
