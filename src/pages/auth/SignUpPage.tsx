import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  friendlyAuthError,
  isStrongPassword,
  isValidUsername,
  normalizeUsername,
  passwordRequirements,
} from "@/lib/auth";
import { toast } from "sonner";

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const requirements = passwordRequirements(password);
  const valid = fullName.trim().length >= 2 &&
    isValidUsername(username) &&
    /\S+@\S+\.\S+/.test(email) &&
    isStrongPassword(password) &&
    password === confirm;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const result = await signUp({
        fullName,
        username: normalizeUsername(username),
        email,
        password,
      });
      if (result.needsConfirmation) {
        setConfirmationSent(true);
      } else {
        navigate("/onboarding", { replace: true });
      }
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  if (confirmationSent) {
    return (
      <AuthCard
        title="Confirme seu e-mail"
        description={`Enviamos um link de confirmação para ${email.trim().toLowerCase()}.`}
        footer={<Link className="font-semibold text-primary hover:underline" to="/login">Voltar ao login</Link>}
      >
        <div className="rounded-xl border border-success/30 bg-success-soft p-4 text-sm">
          Abra o e-mail e clique no link para ativar a conta. Depois você poderá entrar usando
          seu e-mail ou o usuário <strong>{normalizeUsername(username)}</strong>.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Criar conta"
      description="Cadastre-se com e-mail confirmado para começar no ProAds."
      footer={
        <>
          Já tem uma conta?{" "}
          <Link className="font-semibold text-primary hover:underline" to="/login">Entrar</Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="full-name">Nome</Label>
          <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Usuário</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            placeholder="seu.usuario"
            required
          />
          {username && !isValidUsername(username) && (
            <p className="text-xs text-destructive">Use 3–32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Senha</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
            {[
              ["8 caracteres", requirements.length],
              ["Maiúscula", requirements.upper],
              ["Minúscula", requirements.lower],
              ["Número", requirements.number],
              ["Caractere especial", requirements.special],
            ].map(([label, ok]) => (
              <span key={String(label)} className={ok ? "text-success" : undefined}>
                {ok ? <Check className="mr-1 inline h-3 w-3" /> : "• "}{label}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirmar senha</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {confirm && confirm !== password && <p className="text-xs text-destructive">As senhas não coincidem.</p>}
        </div>
        <Button type="submit" size="lg" className="w-full bg-gradient-brand text-primary-foreground" disabled={!valid || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
        </Button>
      </form>
    </AuthCard>
  );
}
