import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, Edit, User, Mail, Phone, Building2 } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { AddEmployeeDialog } from "@/components/employees/AddEmployeeDialog";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  employee_id: string | null;
  phone: string | null;
  status: string | null;
  hire_date: string | null;
  avatar_url: string | null;
  basic_salary: number | null;
}

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-border",
  on_leave: "bg-warning/10 text-warning border-warning/20",
  terminated: "bg-destructive/10 text-destructive border-destructive/20",
};

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("hr_manager");

  const [form, setForm] = useState({
    full_name: "", email: "", department: "", position: "",
    employee_id: "", phone: "", status: "active", hire_date: "", basic_salary: ""
  });

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*");
    if (!error && data) setEmployees(data as Employee[]);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.department || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.employee_id || "").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp);
    setForm({
      full_name: emp.full_name, email: emp.email,
      department: emp.department || "", position: emp.position || "",
      employee_id: emp.employee_id || "", phone: emp.phone || "",
      status: emp.status || "active", hire_date: emp.hire_date || "",
      basic_salary: emp.basic_salary != null ? String(emp.basic_salary) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editEmployee) return;
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name,
      department: form.department || null,
      position: form.position || null,
      employee_id: form.employee_id || null,
      phone: form.phone || null,
      status: form.status || "active",
      hire_date: form.hire_date || null,
      basic_salary: form.basic_salary ? Number(form.basic_salary) : null,
    }).eq("id", editEmployee.id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Employee updated" });
      setDialogOpen(false);
      fetchEmployees();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Employees</h1>
            <p className="text-muted-foreground text-sm mt-1">{employees.length} total employees</p>
          </div>
          {canManage && (
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card className="shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden md:table-cell">Position</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                {canManage && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No employees found</TableCell></TableRow>
              ) : filtered.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{emp.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{emp.department || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{emp.position || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className={statusColors[emp.status || "active"]}>
                      {(emp.status || "active").replace("_", " ")}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Edit Employee</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="col-span-2 space-y-2">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} placeholder="EMP-001" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Input value={form.position} onChange={e => setForm({...form, position: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Hire Date</Label>
                <Input type="date" value={form.hire_date} onChange={e => setForm({...form, hire_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
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
                    onChange={e => setForm({...form, basic_salary: e.target.value})}
                    placeholder="50000"
                  />
                </div>
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Employee Dialog */}
        <AddEmployeeDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSuccess={fetchEmployees}
        />
      </div>
    </AppLayout>
  );
};

export default Employees;
