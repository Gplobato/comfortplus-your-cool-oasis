import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError, isStrongPassword } from "@/lib/auth";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      const code = searchParams.get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      const current = await supabase.auth.getSession();
      if (!active) return;
      setValidSession(!!current.data.session);
      setChecking(false);
    };
    void prepare();
    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (session) {
      setValidSession(true);
      setChecking(false);
    }
  }, [session]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isStrongPassword(password) || password !== confirm) return;
    setBusy(true);
    try {
      await updatePassword(password);
      await signOut();
      toast.success("Senha atualizada. Entre novamente.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <AuthCard title="Validando link" description="Aguarde enquanto verificamos sua recuperação.">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      </AuthCard>
    );
  }

  if (!validSession) {
    return (
      <AuthCard
        title="Link inválido ou expirado"
        description="Solicite um novo link de recuperação para continuar."
        footer={<Link className="font-semibold text-primary hover:underline" to="/login">Voltar ao login</Link>}
      >
        <Button className="w-full" asChild>
          <Link to="/esqueci-senha">Solicitar novo link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Criar nova senha" description="Use uma senha forte e diferente das anteriores.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">Nova senha</Label>
          <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {password && !isStrongPassword(password) && (
            <p className="text-xs text-destructive">Use 8+ caracteres com maiúscula, minúscula, número e símbolo.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">Confirmar senha</Label>
          <Input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {confirm && confirm !== password && <p className="text-xs text-destructive">As senhas não coincidem.</p>}
        </div>
        <Button type="submit" size="lg" className="w-full bg-gradient-brand text-primary-foreground" disabled={busy || !isStrongPassword(password) || password !== confirm}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
        </Button>
      </form>
    </AuthCard>
  );
}
