import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import proadsLogo from "@/assets/proads-logo.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) navigate("/", { replace: true });
  }, [session, loading, navigate]);

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha no login com Google", { description: result.error.message });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-brand-soft p-6">
      <Card className="w-full max-w-md p-8 shadow-card-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 inline-flex overflow-hidden rounded-2xl bg-black px-4 py-2 shadow-sm">
            <img src={proadsLogo} alt="ProAds Marketing OS" className="h-10 w-auto" />
          </div>
          <h1 className="font-display text-2xl font-bold">Entrar no ProAds</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Plataforma de operação e otimização de campanhas com IA.
          </p>
        </div>
        <Button
          onClick={handleGoogle}
          className="w-full bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-95"
          size="lg"
        >
          Continuar com Google
        </Button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Ao entrar você concorda com nossos termos de uso.
        </p>
      </Card>
    </div>
  );
}
