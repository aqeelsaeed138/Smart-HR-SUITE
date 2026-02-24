import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Shield, User } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  new_data: any;
  old_data: any;
  profile_name?: string;
}

const actionColors: Record<string, string> = {
  create: "bg-success/10 text-success border-success/20",
  update: "bg-info/10 text-info border-info/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
  generate_payroll: "bg-primary/10 text-primary border-primary/20",
  confirm: "bg-warning/10 text-warning border-warning/20",
  mark_paid: "bg-success/10 text-success border-success/20",
  assign_shift: "bg-info/10 text-info border-info/20",
};

const AuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (data && data.length > 0) {
        // Fetch profile names
        const userIds = [...new Set(data.filter(e => e.user_id).map(e => e.user_id!))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]));
        setEntries(data.map(e => ({ ...e, profile_name: e.user_id ? profileMap[e.user_id] || "Unknown" : "System" })) as AuditEntry[]);
      }
      setLoading(false);
    };
    fetchEntries();
  }, []);

  const entityTypes = [...new Set(entries.map(e => e.entity_type))];

  const filtered = entries.filter(e => {
    const matchesSearch = e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (e.profile_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesEntity = entityFilter === "all" || e.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-1">Immutable record of all system changes</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search actions, entities, users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entityTypes.map(t => (
                <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead className="hidden md:table-cell">Entity ID</TableHead>
                <TableHead className="hidden lg:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  No audit entries found
                </TableCell></TableRow>
              ) : filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm text-nowrap">{format(new Date(e.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm">{e.profile_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={actionColors[e.action] || ""}>{e.action.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{e.entity_type.replace("_", " ")}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">{e.entity_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                    {e.new_data ? JSON.stringify(e.new_data).slice(0, 80) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AuditLog;
