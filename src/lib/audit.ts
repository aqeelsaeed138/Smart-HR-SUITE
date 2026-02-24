import { supabase } from "@/integrations/supabase/client";

export const logAudit = async (
  action: string,
  entityType: string,
  entityId?: string,
  oldData?: Record<string, any>,
  newData?: Record<string, any>
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get user's company_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  await supabase.from("audit_log").insert({
    user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    old_data: oldData || null,
    new_data: newData || null,
    company_id: profile?.company_id || null,
  });
};
