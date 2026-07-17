import { Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  friendlyAuthError,
  isStrongPassword,
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth";

export default function SecuritySettingsPage() {
  const { user, updatePassword } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name || user.user_metadata?.full_name || "");
        setUsername(data?.username || user.user_metadata?.username || "");
      });
  }, [user]);

  const saveProfile = async () => {
    if (!user || !isValidUsername(username)) return;
    setProfileBusy(true);
    const normalized = normalizeUsername(username);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), username: normalized })
      .eq("id", user.id);
    if (error) {
      toast.error("Não foi possível salvar o perfil", { description: error.message });
    } else {
      await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), username: normalized },
      });
      toast.success("Perfil atualizado");
    }
    setProfileBusy(false);
  };

  const changePassword = async () => {
    if (!isStrongPassword(password) || password !== confirm) return;
    setPasswordBusy(true);
    try {
      await updatePassword(password);
      setPassword("");
      setConfirm("");
      toast.success("Senha atualizada");
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Conta e segurança" description="Perfil, login e proteção da sua conta ProAds." />
      <div className="space-y-4 p-4 md:p-8">
        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-blue-soft p-2.5 text-primary"><UserRound className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display font-bold">Perfil de acesso</h3>
              <p className="text-xs text-muted-foreground">Seu usuário pode ser usado no lugar do e-mail para entrar.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nome</Label><Input className="mt-1.5" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div>
              <Label>Usuário</Label>
              <Input className="mt-1.5" value={username} onChange={(e) => setUsername(normalizeUsername(e.target.value))} />
              {username && !isValidUsername(username) && <p className="mt-1 text-xs text-destructive">Usuário inválido.</p>}
            </div>
            <div className="md:col-span-2"><Label>E-mail</Label><Input className="mt-1.5" readOnly value={user?.email ?? ""} /></div>
          </div>
          <Button className="mt-4" onClick={() => void saveProfile()} disabled={profileBusy || !isValidUsername(username)}>
            {profileBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar perfil"}
          </Button>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-violet-soft p-2.5 text-accent"><LockKeyhole className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display font-bold">Alterar senha</h3>
              <p className="text-xs text-muted-foreground">Use 8+ caracteres com maiúscula, minúscula, número e símbolo.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nova senha</Label><Input className="mt-1.5" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div><Label>Confirmar senha</Label><Input className="mt-1.5" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          </div>
          <Button className="mt-4" onClick={() => void changePassword()} disabled={passwordBusy || !isStrongPassword(password) || password !== confirm}>
            {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar senha"}
          </Button>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-success-soft p-2.5 text-success"><ShieldCheck className="h-5 w-5" /></div>
            <div className="flex-1">
              <h3 className="font-display font-bold">Sessão atual</h3>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Badge className="border-0 bg-success-soft text-success">Ativa</Badge>
          </div>
        </Card>
      </div>
    </>
  );
}
