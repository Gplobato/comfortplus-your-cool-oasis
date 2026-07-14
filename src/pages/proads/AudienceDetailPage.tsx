import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { audienceService } from "@/services";
import type { Audience } from "@/types/proads";
import { formatCurrency, formatNumber } from "@/lib/format";

export default function AudienceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState<Audience | undefined>();
  useEffect(() => { audienceService.get(id).then(setA); }, [id]);
  if (!a) return <div className="p-8">Carregando...</div>;

  return (
    <>
      <PageHeader
        title={a.name}
        description={`${formatNumber(a.size)} pessoas · origem: ${a.origin}`}
        actions={<Button variant="ghost" size="sm" onClick={() => navigate("/publicos")}><ArrowLeft className="h-3.5 w-3.5" /> Voltar</Button>}
      />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-8">
        <Card className="p-5 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Definição</p>
          <div className="mt-3 space-y-2 text-sm">
            <div><span className="text-muted-foreground">Localização:</span> {a.location ?? "—"}</div>
            <div><span className="text-muted-foreground">Idade:</span> {a.ageRange ? `${a.ageRange[0]} - ${a.ageRange[1]}` : "—"}</div>
            <div><span className="text-muted-foreground">Interesses:</span> {a.interests?.join(", ") ?? "—"}</div>
            <div><span className="text-muted-foreground">Exclusões:</span> {a.exclusions?.join(", ") ?? "Nenhuma"}</div>
            <div><span className="text-muted-foreground">Sobreposição:</span> {a.overlap ?? 0}%</div>
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Desempenho</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div><p className="font-display text-2xl font-bold">{formatCurrency(a.performance.cpl)}</p><p className="text-[10px] text-muted-foreground">CPL médio</p></div>
            <div><p className="font-display text-2xl font-bold">{a.performance.ctr}%</p><p className="text-[10px] text-muted-foreground">CTR médio</p></div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold">Campanhas vinculadas</p>
            <div className="flex flex-wrap gap-1">{a.campaignIds.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}</div>
          </div>
        </Card>
        <Card className="p-5 shadow-card md:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sugestões da IA</p>
          <p className="mt-2 text-sm">
            Este público tem <strong>alta correlação</strong> com "Segurança em obras". Criar um público semelhante de 1% pode expandir o alcance mantendo o CPL abaixo de R$ 12.
          </p>
        </Card>
      </div>
    </>
  );
}
