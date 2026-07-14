import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/proads/Badges";
import { creativeService } from "@/services";
import type { Creative } from "@/types/proads";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "sonner";

export default function CreativeDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Creative | undefined>();
  useEffect(() => { creativeService.get(id).then(setC); }, [id]);
  if (!c) return <div className="p-8">Carregando...</div>;

  return (
    <>
      <PageHeader
        title={c.name}
        description={`${c.format} · ${c.resolution} · ${c.sizeKb} KB`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-3.5 w-3.5" /> Voltar</Button>
            <Button variant="outline" size="sm" className="gap-2"><Copy className="h-3.5 w-3.5" /> Duplicar</Button>
            <Button size="sm" className="gap-2 bg-gradient-brand text-primary-foreground" onClick={() => toast.success("Variação gerada")}>
              <Sparkles className="h-3.5 w-3.5" /> Criar variação
            </Button>
          </>
        }
      />
      <div className="grid gap-6 p-4 md:grid-cols-3 md:p-8">
        <Card className="overflow-hidden shadow-card md:col-span-2">
          <img src={c.thumbnailUrl} alt={c.name} className="w-full" />
        </Card>
        <div className="space-y-4">
          <Card className="p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Informações</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Plataforma</span><PlatformBadge platform={c.platform} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge>{c.status}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Criado em</span><span>{formatDate(c.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Criado por</span><span>{c.createdBy}</span></div>
            </div>
          </Card>
          <Card className="p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Desempenho</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div><p className="font-display text-xl font-bold">{c.performance.ctr}%</p><p className="text-[10px] text-muted-foreground">CTR</p></div>
              <div><p className="font-display text-xl font-bold">R$ {c.performance.cpl}</p><p className="text-[10px] text-muted-foreground">CPL</p></div>
              <div><p className="font-display text-xl font-bold">{formatNumber(c.performance.leads)}</p><p className="text-[10px] text-muted-foreground">Leads</p></div>
            </div>
          </Card>
          {c.headline && (
            <Card className="p-4 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Textos do anúncio</p>
              <div className="mt-3 space-y-2 text-sm">
                <div><span className="text-muted-foreground">Título:</span> <strong>{c.headline}</strong></div>
                <div><span className="text-muted-foreground">Texto:</span> {c.primaryText}</div>
                <div><span className="text-muted-foreground">CTA:</span> <Badge variant="outline">{c.cta}</Badge></div>
              </div>
            </Card>
          )}
          <Card className="p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Avaliação da IA</p>
            <p className="mt-2 text-sm">
              CTR abaixo da média para este formato. Sugestão: testar variação com um chamado mais direto ao gerente de obra.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
