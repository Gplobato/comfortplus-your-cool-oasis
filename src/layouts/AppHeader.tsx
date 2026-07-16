import { useNavigate } from "react-router-dom";
import { Bell, Building2, Check, Command, Plus, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

export function AppHeader() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { organizations, activeOrg, setActiveOrg } = useOrganization();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    "Usuário";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "US";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="-ml-1" />

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar campanhas, criativos, públicos..."
          className="h-10 w-full rounded-lg border border-border bg-secondary/60 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {activeOrg && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden h-9 gap-2 md:inline-flex">
                <Building2 className="h-3.5 w-3.5" />
                <span className="max-w-[160px] truncate text-xs">{activeOrg.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Organizações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem key={org.id} onClick={() => setActiveOrg(org)}>
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === activeOrg.id && <Check className="ml-2 h-3.5 w-3.5" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/onboarding")}>
                + Nova organização
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
              <Bell className="h-[18px] w-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notificações
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma notificação
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2.5 rounded-full px-1.5 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-brand text-xs font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight md:block">
                <p className="max-w-[140px] truncate text-xs font-semibold">{displayName}</p>
                <p className="text-[10px] text-muted-foreground">{user?.email}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracoes/usuarios")}>
              Equipe
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracoes/seguranca")}>
              Segurança
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                toast.success("Sessão encerrada");
                navigate("/login", { replace: true });
              }}
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={() => navigate("/campanhas/nova")}
          className="hidden gap-2 bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-95 sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Nova campanha
        </Button>
      </div>
    </header>
  );
}
