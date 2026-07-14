import { Plus } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const users = [
  { name: "Rafael Gomes", email: "rafael@promonitor.com.br", role: "Administrador", status: "Ativo", last: "há 2min" },
  { name: "Juliana Alves", email: "juliana@promonitor.com.br", role: "Gestor", status: "Ativo", last: "há 4h" },
  { name: "Lucas Silva", email: "lucas@promonitor.com.br", role: "Analista", status: "Ativo", last: "há 1d" },
  { name: "Ana Souza", email: "ana@promonitor.com.br", role: "Criativo", status: "Convidado", last: "—" },
  { name: "Bruno Lima", email: "bruno@promonitor.com.br", role: "Aprovador", status: "Ativo", last: "há 3h" },
];

export default function UsersSettingsPage() {
  return (
    <>
      <PageHeader
        title="Usuários & permissões"
        description="Gerencie a equipe e os níveis de acesso na plataforma."
        actions={<Button size="sm" className="gap-2 bg-gradient-brand text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Convidar</Button>}
      />
      <div className="p-4 md:p-8">
        <Card className="shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.email} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-gradient-brand text-xs text-white">{u.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell><Badge className={u.status === "Ativo" ? "bg-success-soft text-success border-0" : "bg-warning-soft text-warning border-0"}>{u.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.last}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
