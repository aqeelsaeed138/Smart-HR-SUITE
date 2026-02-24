import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Shield, Key, Building2, Calendar, Users } from "lucide-react";
import { format } from "date-fns";

interface Company {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
}

const SettingsPage = () => {
  const { profile, roles, user, updatePassword, hasRole } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: profile?.full_name || "", phone: profile?.phone || "" });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const isAdmin = hasRole("admin");

  // Company state
  const [company, setCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyLoading, setCompanyLoading] = useState(true);
  const [employeeCount, setEmployeeCount] = useState(0);

  useEffect(() => {
    if (profile?.company_id) {
      const fetchCompany = async () => {
        setCompanyLoading(true);
        const [{ data: companyData }, { count }] = await Promise.all([
          supabase.from("companies").select("*").eq("id", profile.company_id!).single(),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
        ]);
        if (companyData) {
          setCompany(companyData as Company);
          setCompanyName(companyData.name);
        }
        setEmployeeCount(count || 0);
        setCompanyLoading(false);
      };
      fetchCompany();
    }
  }, [profile?.company_id]);

  const handleProfileSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name,
      phone: form.phone || null,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Profile updated" });
  };

  const handleCompanySave = async () => {
    if (!company) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({ name: companyName }).eq("id", company.id);
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else {
      setCompany({ ...company, name: companyName });
      toast({ title: "Company updated" });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.password !== passwordForm.confirm) {
      toast({ variant: "destructive", title: "Passwords don't match" });
      return;
    }
    if (passwordForm.password.length < 6) {
      toast({ variant: "destructive", title: "Password must be at least 6 characters" });
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(passwordForm.password);
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else {
      toast({ title: "Password updated" });
      setPasswordForm({ password: "", confirm: "" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account and company settings</p>
        </div>

        {/* Company Settings (admin only) */}
        {isAdmin && (
          <Card className="p-6 shadow-card space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Company Settings</h3>
            </div>
            <Separator />
            {companyLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : company ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company ID</Label>
                    <Input value={company.id.slice(0, 8) + "..."} disabled className="bg-muted font-mono text-xs" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Created {format(new Date(company.created_at), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {employeeCount} employee{employeeCount !== 1 ? "s" : ""}
                  </div>
                </div>
                <Button onClick={handleCompanySave} disabled={saving || companyName === company.name}>
                  Save Company
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No company found.</p>
            )}
          </Card>
        )}

        {/* Profile */}
        <Card className="p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Profile Information</h3>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
          <Button onClick={handleProfileSave} disabled={saving}>Save Profile</Button>
        </Card>

        {/* Roles */}
        <Card className="p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Roles & Permissions</h3>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            {roles.map(role => (
              <Badge key={role} variant="outline" className="capitalize text-sm py-1 px-3">
                {role.replace("_", " ")}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Contact your administrator to change your roles.</p>
        </Card>

        {/* Password */}
        <Card className="p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Change Password</h3>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={passwordForm.password} onChange={e => setPasswordForm({...passwordForm, password: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
            </div>
          </div>
          <Button onClick={handlePasswordChange} disabled={saving || !passwordForm.password}>Update Password</Button>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
