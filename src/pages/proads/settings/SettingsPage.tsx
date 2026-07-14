import { NavLink } from "react-router-dom";
import { Building2, Users, Sparkles, ShieldCheck, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";

const sections = [
  { url: "/configuracoes/empresa", icon: Building2, title: "Empresa", desc: "Marca, tom de voz, serviços e público-alvo." },
  { url: "/configuracoes/usuarios", icon: Users, title: "Usuários & permissões", desc: "Equipe, perfis e acessos." },
  { url: "/configuracoes/ia", icon: Sparkles, title: "Configuração da IA", desc: "Modelos, autonomia e orçamento." },
  { url: "/configuracoes/seguranca", icon: ShieldCheck, title: "Segurança", desc: "2FA, tokens e limites financeiros." },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Gerencie sua conta, equipe, IA e segurança." />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-8">
        {sections.map((s) => (
          <NavLink key={s.url} to={s.url}>
            <Card className="group flex items-center gap-4 p-5 shadow-card transition-shadow hover:shadow-card-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand-soft text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </Card>
          </NavLink>
        ))}
      </div>
    </>
  );
}
