import { Loader2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

type MemberRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  roles: string[];
  joinedAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  analyst: "Analista",
  creative: "Criativo",
  approver: "Aprovador",
  viewer: "Visualizador",
};

export default function UsersSettingsPage() {
  const { activeOrg } = useOrganization();
  const [users, setUsers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("user_id, created_at")
      .eq("organization_id", activeOrg.id);
    const ids = (memberships ?? []).map((item) => item.user_id);
    if (!ids.length) {
      setUsers([]);
      setLoading(false);
      return;
    }
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, username").in("id", ids),
      supabase.from("user_roles").select("user_id, role").eq("organization_id", activeOrg.id),
    ]);
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const rolesById = new Map<string, string[]>();
    for (const role of roles ?? []) {
      const list = rolesById.get(role.user_id) ?? [];
      list.push(role.role);
      rolesById.set(role.user_id, list);
    }
    setUsers((memberships ?? []).map((membership) => {
      const profile = profileById.get(membership.user_id);
      return {
        id: membership.user_id,
        name: profile?.full_name || profile?.username || "Usuário",
        username: profile?.username || null,
        email: profile?.email || "—",
        roles: rolesById.get(membership.user_id) ?? [],
        joinedAt: membership.created_at,
      };
    }));
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Usuários & permissões"
        description="Membros reais com acesso à organização selecionada."
      />
      <div className="p-4 md:p-8">
        <Card className="shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando membros…
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Users className="h-6 w-6" />
              Nenhum membro encontrado.
            </div>
          ) : <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-gradient-brand text-xs text-white">{u.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length
                        ? u.roles.map((role) => <Badge key={role} variant="outline">{ROLE_LABELS[role] || role}</Badge>)
                        : <Badge variant="outline">Membro</Badge>}
                    </div>
                  </TableCell>
                  <TableCell><Badge className="border-0 bg-success-soft text-success">Ativo</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.username ? `@${u.username}` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>}
        </Card>
      </div>
    </>
  );
}
