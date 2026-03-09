import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin or hr_manager for the same company
    const [{ data: callerRoles }, { data: callerProfile }] = await Promise.all([
      adminClient.from("user_roles").select("role").eq("user_id", caller.id),
      adminClient.from("profiles").select("company_id").eq("user_id", caller.id).single(),
    ]);

    const isAdmin = callerRoles?.some((r: any) => r.role === "admin" || r.role === "hr_manager");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { employee_user_id } = await req.json();

    if (!employee_user_id) {
      return new Response(JSON.stringify({ error: "employee_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (employee_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the employee belongs to the same company
    const { data: empProfile } = await adminClient
      .from("profiles")
      .select("company_id, full_name")
      .eq("user_id", employee_user_id)
      .single();

    if (!empProfile || empProfile.company_id !== callerProfile?.company_id) {
      return new Response(JSON.stringify({ error: "Employee not found in your company" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete all dependent data in order (foreign key safe)
    // 1. Shift assignments
    await adminClient.from("shift_assignments").delete().eq("user_id", employee_user_id);

    // 2. Attendance records
    await adminClient.from("attendance_records").delete().eq("user_id", employee_user_id);

    // 3. Leave requests
    await adminClient.from("leave_requests").delete().eq("user_id", employee_user_id);

    // 4. Payroll items
    await adminClient.from("payroll_items").delete().eq("user_id", employee_user_id);

    // 5. Delete the auth user — this cascades: profiles + user_roles are deleted automatically
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(employee_user_id);

    if (deleteUserError) {
      return new Response(JSON.stringify({ error: deleteUserError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
