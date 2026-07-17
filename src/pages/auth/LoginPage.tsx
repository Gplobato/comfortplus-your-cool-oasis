import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/auth/AuthCard";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      const state = location.state as { from?: { pathname?: string } } | null;
      const destination = state?.from?.pathname || "/";
      navigate(destination, { replace: true });
    }
  }, [session, loading, navigate, location.state]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) return;
    setBusy(true);
    try {
      await signIn(identifier, password);
      toast.success("Bem-vindo ao ProAds");
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Entrar no ProAds"
      description="Acesse sua operação de campanhas com usuário ou e-mail."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link className="font-semibold text-primary hover:underline" to="/cadastro">
            Criar conta
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Usuário ou e-mail</Label>
          <Input
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="emanuele ou voce@empresa.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link className="text-xs font-medium text-primary hover:underline" to="/esqueci-senha">
              Esqueci a senha
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-10"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-95"
          size="lg"
          disabled={busy || !identifier.trim() || !password}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Ao entrar você concorda com nossos termos de uso.
        </p>
      </form>
    </AuthCard>
  );
}
