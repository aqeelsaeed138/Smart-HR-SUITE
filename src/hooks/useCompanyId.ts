import { useAuth } from "@/contexts/AuthContext";

export const useCompanyId = () => {
  const { profile } = useAuth();
  return profile?.company_id || null;
};
