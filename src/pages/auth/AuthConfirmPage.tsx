import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function AuthConfirmPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const confirm = async () => {
      const code = searchParams.get("code");
      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) {
          if (active) setFailed(true);
          return;
        }
      }
      const current = await supabase.auth.getSession();
      if (!active) return;
      if (current.data.session) navigate("/", { replace: true });
      else setFailed(true);
    };
    void confirm();
    return () => {
      active = false;
    };
  }, [navigate, searchParams]);

  if (failed) {
    return (
      <AuthCard title="Não foi possível confirmar" description="O link pode ter expirado ou já ter sido utilizado.">
        <Button className="w-full" asChild>
          <Link to="/login">Ir para o login</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirmando sua conta" description="Estamos validando seu e-mail com segurança.">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
    </AuthCard>
  );
}
