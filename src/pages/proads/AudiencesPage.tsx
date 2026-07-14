import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { PlatformBadge } from "@/components/proads/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { audienceService } from "@/services";
import type { Audience } from "@/types/proads";
import { formatCurrency, formatNumber } from "@/lib/format";

const typeLabel: Record<Audience["type"], string> = {
  interest: "Interesse",
  custom: "Personalizado",
  lookalike: "Semelhante",
  remarketing: "Remarketing",
  customer_list: "Lista de clientes",
  website_visitors: "Visitantes do site",
  engagement: "Engajamento",
};

export default function AudiencesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Audience[]>([]);
  useEffect(() => { audienceService.list().then(setItems); }, []);
  return (
    <>
      <PageHeader
        title="Públicos"
        description="Segmentações, listas e lookalikes disponíveis para suas campanhas."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-2"><Sparkles className="h-3.5 w-3.5 text-accent" /> Sugerir com IA</Button>
            <Button size="sm" className="h-9 gap-2 bg-gradient-brand text-primary-foreground shadow-brand"><Plus className="h-3.5 w-3.5" /> Criar público</Button>
          </>
        }
      />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-8 lg:grid-cols-3">
        {items.map((a) => (
          <Card key={a.id} className="cursor-pointer p-5 shadow-card transition-shadow hover:shadow-card-md" onClick={() => navigate(`/publicos/${a.id}`)}>
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-soft text-blue-soft-foreground">
                <Users className="h-4 w-4" />
              </div>
              <PlatformBadge platform={a.platform} />
            </div>
            <h3 className="mt-3 font-display font-bold">{a.name}</h3>
            <Badge variant="outline" className="mt-1 bg-violet-soft text-violet-soft-foreground">{typeLabel[a.type]}</Badge>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div><p className="font-display text-sm font-bold">{formatNumber(a.size)}</p><p className="text-[10px] text-muted-foreground">Tamanho</p></div>
              <div><p className="font-display text-sm font-bold">{formatCurrency(a.performance.cpl)}</p><p className="text-[10px] text-muted-foreground">CPL</p></div>
              <div><p className="font-display text-sm font-bold">{a.performance.ctr}%</p><p className="text-[10px] text-muted-foreground">CTR</p></div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
