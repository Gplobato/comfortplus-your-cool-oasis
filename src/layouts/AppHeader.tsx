import { useNavigate } from "react-router-dom";
import { Bell, Command, Moon, Plus, Search, Sparkles, Sun } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { notifications } from "@/mocks/data";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

export function AppHeader() {
  const navigate = useNavigate();
  const { demoMode, setDemoMode } = useDemoMode();
  const { theme, toggleTheme } = useTheme();
  const unread = demoMode ? notifications.filter((n) => !n.read).length : 0;

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
        <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 md:flex">
          <Sparkles className={`h-3.5 w-3.5 ${demoMode ? "text-accent" : "text-muted-foreground"}`} />
          <Label htmlFor="demo-mode" className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {demoMode ? "Modo demo" : "Modo clean"}
          </Label>
          <Switch
            id="demo-mode"
            checked={demoMode}
            onCheckedChange={(v) => {
              setDemoMode(v);
              toast.success(v ? "Modo demo ativado" : "Modo clean ativado");
            }}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-10 w-10 rounded-full"
          aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notificações <span className="text-xs text-muted-foreground">{unread} novas</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {demoMode ? (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.description}</span>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhuma notificação
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2.5 rounded-full px-1.5 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-brand text-xs font-bold text-white">
                  GA
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight md:block">
                <p className="text-xs font-semibold">Gabriel</p>
                <p className="text-[10px] text-muted-foreground">Administrador</p>
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
            <DropdownMenuItem onClick={() => toast.info("Sessão encerrada (simulação)")}>
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
