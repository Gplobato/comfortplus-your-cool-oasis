import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      // The same response avoids revealing whether an account exists.
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Recuperar senha"
      description={
        sent
          ? "Se houver uma conta para esse e-mail, o link de recuperação chegará em instantes."
          : "Informe o e-mail da conta para receber um link seguro."
      }
      footer={<Link className="font-semibold text-primary hover:underline" to="/login">Voltar ao login</Link>}
    >
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-blue-soft p-4 text-sm">
            Verifique a caixa de entrada e o spam. O link abrirá a tela para criar uma nova senha.
          </div>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Tentar outro e-mail
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="recovery-email">E-mail</Label>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full bg-gradient-brand text-primary-foreground" disabled={busy || !email}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
