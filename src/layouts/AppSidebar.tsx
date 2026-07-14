import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Megaphone,
  Images,
  Sparkles,
  Users,
  CheckCheck,
  BarChart3,
  Plug,
  History,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/contexts/DemoModeContext";


const nav = [
  { title: "Visão Geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "Criativos", url: "/criativos", icon: Images },
  { title: "Agente IA", url: "/agente", icon: Sparkles },
  { title: "Públicos", url: "/publicos", icon: Users },
  { title: "Aprovações", url: "/aprovacoes", icon: CheckCheck, badge: 4 },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Integrações", url: "/integracoes", icon: Plug },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-brand">
            <span className="font-display text-lg font-extrabold text-white">P</span>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-sidebar" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-extrabold tracking-tight">ProAds</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Marketing OS
              </span>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Navegação
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  item.url === "/dashboard"
                    ? pathname === "/" || pathname.startsWith("/dashboard")
                    : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={cn(
                        "h-10 rounded-lg font-medium transition-colors",
                        active
                          ? "bg-gradient-brand-soft text-primary hover:bg-gradient-brand-soft"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                      )}
                    >
                      <NavLink to={item.url} className="flex items-center gap-3">
                        <item.icon
                          className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate text-sm">{item.title}</span>
                            {item.badge && (
                              <span className="ml-auto rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3" />

    </Sidebar>
  );
}
