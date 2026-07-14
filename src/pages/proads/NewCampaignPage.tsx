import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Wand2, Check } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const steps = [
  "Plataforma",
  "Objetivo",
  "Configuração",
  "Público",
  "Orçamento",
  "Criativos",
  "Rastreamento",
  "Revisão",
];

export default function NewCampaignPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isAI = params.get("ai") === "1";
  const [mode, setMode] = useState<"choose" | "manual" | "ai">(isAI ? "ai" : "choose");
  const [step, setStep] = useState(0);

  if (mode === "choose") {
    return (
      <>
        <PageHeader title="Nova campanha" description="Escolha como deseja criar sua campanha." />
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-8">
          <Card className="group cursor-pointer p-6 shadow-card transition-shadow hover:shadow-brand" onClick={() => setMode("manual")}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-soft text-blue-soft-foreground">
              <Wand2 className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold">Criar manualmente</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Passo a passo tradicional para configurar cada detalhe da campanha.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 gap-1 p-0 text-primary">
              Começar <ArrowRight className="h-3 w-3" />
            </Button>
          </Card>

          <Card className="group cursor-pointer overflow-hidden p-6 shadow-card transition-shadow hover:shadow-brand" onClick={() => setMode("ai")}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold">Criar com inteligência artificial</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Descreva seu objetivo em linguagem natural e a IA monta a campanha completa como rascunho.
            </p>
            <Button size="sm" className="mt-4 gap-1 bg-gradient-brand text-primary-foreground">
              Conversar com IA <ArrowRight className="h-3 w-3" />
            </Button>
          </Card>
        </div>
      </>
    );
  }

  if (mode === "ai") {
    return (
      <>
        <PageHeader
          title="Criar campanha com IA"
          description="Responda perguntas rápidas e a IA vai propor uma campanha completa."
          actions={
            <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => navigate("/campanhas")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          }
        />
        <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
          {[
            { label: "Qual serviço será anunciado?", ph: "Ex: Monitoramento de obras com IA" },
            { label: "Qual público?", ph: "Ex: Gerentes de obra 28-55 anos" },
            { label: "Qual região?", ph: "Ex: São Paulo capital + Grande SP" },
            { label: "Qual orçamento?", ph: "Ex: R$ 150/dia" },
            { label: "Qual objetivo?", ph: "Leads / Conversões / Tráfego" },
            { label: "Qual landing page?", ph: "https://promonitor.com.br/lp" },
            { label: "Quais materiais podem ser usados?", ph: "Fotos, vídeos, logos, cases..." },
          ].map((q) => (
            <Card key={q.label} className="p-4 shadow-card">
              <Label className="text-sm font-semibold">{q.label}</Label>
              <Textarea placeholder={q.ph} className="mt-2 min-h-[70px] bg-secondary/40" />
            </Card>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMode("choose")}>Cancelar</Button>
            <Button
              className="gap-2 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => {
                toast.success("Proposta gerada — abrindo revisão");
                setMode("manual");
                setStep(steps.length - 1);
              }}
            >
              <Sparkles className="h-4 w-4" /> Gerar proposta
            </Button>
          </div>
        </div>
      </>
    );
  }

  const pct = ((step + 1) / steps.length) * 100;

  return (
    <>
      <PageHeader
        title="Nova campanha"
        description={`Etapa ${step + 1} de ${steps.length} — ${steps[step]}`}
        actions={
          <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => setMode("choose")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Trocar modo
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
        <div>
          <Progress value={pct} className="h-1.5" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                  i === step
                    ? "border-primary bg-gradient-brand-soft text-primary"
                    : i < step
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {i < step && <Check className="h-3 w-3" />}
                {s}
              </button>
            ))}
          </div>
        </div>

        <Card className="p-6 shadow-card">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {["Meta Ads", "Google Ads", "TikTok Ads", "LinkedIn"].map((p) => (
                <button
                  key={p}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm font-medium transition-colors hover:border-primary hover:bg-gradient-brand-soft"
                >
                  <span className="text-lg">{p[0]}</span>
                  {p}
                </button>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {["Leads", "Conversões", "Tráfego", "Reconhecimento", "Engajamento", "Vendas"].map((o) => (
                <button key={o} className="rounded-lg border border-border p-4 text-sm font-medium hover:border-primary hover:bg-gradient-brand-soft">
                  {o}
                </button>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Nome da campanha</Label>
                <Input className="mt-1.5" placeholder="Ex: Monitoramento SP — jul" />
              </div>
              <div>
                <Label>Conta de anúncio</Label>
                <Select><SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">ProMonitor — Meta BR</SelectItem>
                    <SelectItem value="2">ProMonitor — Google Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Localização</Label>
                <Input className="mt-1.5" placeholder="Ex: São Paulo (SP)" />
              </div>
              <div>
                <Label>Idade</Label>
                <Input className="mt-1.5" placeholder="28 - 55" />
              </div>
              <div className="md:col-span-2">
                <Label>Interesses</Label>
                <Input className="mt-1.5" placeholder="construção, engenharia, obras..." />
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Orçamento diário</Label>
                <Input className="mt-1.5" placeholder="R$ 150,00" />
              </div>
              <div>
                <Label>Data de início</Label>
                <Input type="date" className="mt-1.5" />
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Selecione criativos da biblioteca ou gere com IA.
            </div>
          )}
          {step === 6 && (
            <div className="space-y-3">
              <div><Label>Pixel / GTM</Label><Input className="mt-1.5" placeholder="GTM-XXXXXX" /></div>
              <div><Label>URL de destino</Label><Input className="mt-1.5" placeholder="https://..." /></div>
            </div>
          )}
          {step === 7 && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle className="text-sm">Rascunho pausado</AlertTitle>
                <AlertDescription className="text-xs">
                  Esta campanha será criada como rascunho e permanecerá <strong>pausada</strong> até ser aprovada.
                </AlertDescription>
              </Alert>
              <div className="grid gap-3 rounded-lg border border-border bg-secondary/30 p-4 text-sm md:grid-cols-2">
                <div><span className="text-muted-foreground">Plataforma:</span> <strong>Meta Ads</strong></div>
                <div><span className="text-muted-foreground">Objetivo:</span> <strong>Leads</strong></div>
                <div><span className="text-muted-foreground">Orçamento diário:</span> <strong>R$ 150,00</strong></div>
                <div><span className="text-muted-foreground">Duração:</span> <strong>30 dias</strong></div>
                <div><span className="text-muted-foreground">Público:</span> <strong>Gerentes de obra — SP</strong></div>
                <div><span className="text-muted-foreground">Criativos:</span> <strong>3 selecionados</strong></div>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Voltar
          </Button>
          {step < steps.length - 1 ? (
            <Button className="gap-2 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => setStep((s) => s + 1)}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="gap-2 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => {
                toast.success("Campanha criada como rascunho pausado");
                navigate("/campanhas");
              }}
            >
              <Check className="h-4 w-4" /> Criar como rascunho
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
