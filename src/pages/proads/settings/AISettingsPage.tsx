import { useState } from "react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const autonomy = [
  { level: 1, name: "Somente leitura", desc: "IA analisa mas não altera nada." },
  { level: 2, name: "Criar rascunhos", desc: "IA cria itens pausados aguardando aprovação." },
  { level: 3, name: "Operação supervisionada", desc: "Executa ações comuns; alterações críticas exigem aprovação." },
  { level: 4, name: "Autonomia limitada", desc: "Age dentro de limites financeiros e de risco definidos." },
  { level: 5, name: "Autonomia avançada", desc: "Máxima autonomia — recomendado apenas para contas maduras." },
];

export default function AISettingsPage() {
  const [level, setLevel] = useState(3);
  return (
    <>
      <PageHeader
        title="Configuração da IA"
        description="Ajuste modelos, autonomia e permissões do seu Diretor de Marketing artificial."
        actions={<Button size="sm" className="bg-gradient-brand text-primary-foreground" onClick={() => toast.success("Configuração salva")}>Salvar</Button>}
      />
      <div className="space-y-4 p-4 md:p-8">
        <Card className="grid gap-4 p-5 shadow-card md:grid-cols-2">
          <div><Label>Modelo principal</Label><Select defaultValue="gpt5"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gpt5">GPT-5.5</SelectItem><SelectItem value="claude">Claude Sonnet 4.5</SelectItem><SelectItem value="gemini">Gemini 3 Pro</SelectItem></SelectContent></Select></div>
          <div><Label>Modelo de fallback</Label><Select defaultValue="claude"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="claude">Claude Sonnet 4.5</SelectItem><SelectItem value="gpt4o">GPT-4o</SelectItem></SelectContent></Select></div>
          <div><Label>Modelo de imagem</Label><Select defaultValue="banana"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="banana">Nano Banana 2</SelectItem><SelectItem value="gptimg">GPT-Image 2</SelectItem></SelectContent></Select></div>
          <div><Label>Modelo de vídeo</Label><Select defaultValue="veo"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="veo">Veo 3</SelectItem><SelectItem value="runway">Runway Gen-4</SelectItem></SelectContent></Select></div>
          <div><Label>Provedor de pesquisa</Label><Select defaultValue="perp"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="perp">Perplexity</SelectItem><SelectItem value="tavily">Tavily</SelectItem></SelectContent></Select></div>
          <div><Label>Orçamento mensal de IA</Label><Select defaultValue="500"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="200">R$ 200</SelectItem><SelectItem value="500">R$ 500</SelectItem><SelectItem value="1000">R$ 1.000</SelectItem></SelectContent></Select></div>
          <div><Label>Temperatura</Label><Slider defaultValue={[35]} max={100} className="mt-3" /></div>
          <div><Label>Limite de tokens</Label><Slider defaultValue={[64]} max={128} className="mt-3" /></div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold">Nível de autonomia</h3>
          <p className="text-xs text-muted-foreground">Define até onde a IA pode agir sem aprovação humana.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {autonomy.map((a) => (
              <button
                key={a.level}
                onClick={() => setLevel(a.level)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  level === a.level
                    ? "border-primary bg-gradient-brand-soft"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <p className="text-xs font-semibold text-primary">Nível {a.level}</p>
                <p className="mt-1 text-sm font-bold">{a.name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{a.desc}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="mb-3 font-display font-bold">Permissões da IA</h3>
          <div className="space-y-3">
            {[
              "Permitir pausar anúncios",
              "Permitir criar campanhas",
              "Permitir aumentar orçamento",
              "Permitir reduzir orçamento",
              "Exigir aprovação para ativação",
              "Exigir aprovação para alterações acima de 20%",
            ].map((p, i) => (
              <div key={p} className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
                <span className="text-sm">{p}</span>
                <Switch defaultChecked={i !== 3} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
