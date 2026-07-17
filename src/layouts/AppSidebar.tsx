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
  ExternalLink,
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
import proadsSidebarWordmark from "@/assets/proads-sidebar-wordmark.png";
import proadsSidebarMark from "@/assets/proads-sidebar-mark.png";

const nav = [
  { title: "Visão Geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "Criativos", url: "/criativos", icon: Images },
  { title: "Agente IA", url: "/agente", icon: Sparkles },
  { title: "Públicos", url: "/publicos", icon: Users },
  { title: "Aprovações", url: "/aprovacoes", icon: CheckCheck },
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
    <Sidebar
      collapsible="icon"
      className="border-r border-white/10"
      innerClassName="proads-sidebar-surface"
    >
      <SidebarHeader className="px-3 py-3">
        <NavLink to="/dashboard" className={cn("flex items-center", collapsed ? "justify-center" : "px-1")}>
          <img
            src={collapsed ? proadsSidebarMark : proadsSidebarWordmark}
            alt="ProAds Marketing OS"
            className={cn(
              "object-contain",
              collapsed
                ? "h-9 w-9 rounded-lg object-cover"
                : "h-14 w-full max-w-[205px] object-left",
            )}
          />
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-white/45">
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
                      tooltip={item.title}
                      className={cn(
                        "relative h-10 rounded-lg border border-transparent font-medium text-white/75 transition-all hover:text-white focus-visible:ring-white/40",
                        active
                          ? "border-white/10 bg-white/[0.12] text-white shadow-sm backdrop-blur-sm before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r-full before:bg-gradient-to-b before:from-blue-400 before:to-violet-500 hover:bg-white/[0.16]"
                          : "hover:border-white/[0.06] hover:bg-white/[0.08]",
                      )}
                    >
                      <NavLink to={item.url} className="flex items-center gap-3">
                        <item.icon
                          className={cn("h-[18px] w-[18px] shrink-0", active && "text-blue-300")}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate text-sm">{item.title}</span>
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

      <SidebarFooter className="p-3">
        <a
          href="https://promonitor.app"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group flex items-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2.5 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/[0.15]",
            collapsed && "justify-center px-0",
          )}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex-1 truncate text-sm font-semibold">Abrir ProMonitor</span>
          )}
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
