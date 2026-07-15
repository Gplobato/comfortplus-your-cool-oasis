import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const { organizations, activeOrg, loading: orgLoading } = useOrganization();
  const location = useLocation();

  if (authLoading) return <FullPageLoader label="Carregando sessão..." />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (orgLoading) return <FullPageLoader label="Carregando organização..." />;
  if (organizations.length === 0) return <Navigate to="/onboarding" replace />;
  if (!activeOrg) return <FullPageLoader label="Selecionando organização..." />;

  return <>{children}</>;
}
