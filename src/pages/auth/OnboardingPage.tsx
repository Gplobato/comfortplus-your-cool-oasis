import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function OnboardingPage() {
  const [name, setName] = useState("Obras Timelapse (MB Group)");
  const [saving, setSaving] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { createOrganization } = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, navigate, user]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createOrganization(name.trim());
      toast.success("Organização criada");
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast.error("Falha ao criar organização", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-brand-soft p-6">
      <Card className="w-full max-w-md p-8 shadow-card-md">
        <h1 className="font-display text-2xl font-bold">Crie sua organização</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você ainda não pertence a uma organização. Dê um nome para começar.
        </p>
        <div className="mt-6 space-y-2">
          <Label htmlFor="org-name">Nome da organização</Label>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button
          onClick={handleCreate}
          disabled={saving || !name.trim()}
          className="mt-6 w-full bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-95"
          size="lg"
        >
          {saving ? "Criando..." : "Criar organização"}
        </Button>
      </Card>
    </div>
  );
}
