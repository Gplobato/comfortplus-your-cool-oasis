import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_AI_SETTINGS,
  loadAiSettings,
  saveAiSettings,
  type AiModelOption,
  type AiSettings,
} from "@/lib/aiSettings";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";

const autonomy = [
  { level: 1, name: "Somente leitura", desc: "IA analisa mas não altera nada." },
  { level: 2, name: "Criar rascunhos", desc: "IA cria itens pausados aguardando aprovação." },
  { level: 3, name: "Operação supervisionada", desc: "Executa ações comuns; alterações críticas exigem aprovação." },
  { level: 4, name: "Autonomia limitada", desc: "Age dentro de limites financeiros e de risco definidos." },
  { level: 5, name: "Autonomia avançada", desc: "Máxima autonomia — recomendado apenas para contas maduras." },
];

const PRESET_TEXT: AiModelOption[] = [
  { id: "zai-org/glm-5.2", name: "GLM 5.2" },
  { id: "gpt-5.2", name: "GPT-5.2" },
  { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
];
const PRESET_IMAGE: AiModelOption[] = [
  { id: "gpt-image-2", name: "GPT-Image 2" },
  { id: "flux", name: "FLUX" },
];
const PRESET_VIDEO: AiModelOption[] = [
  { id: "veo-3", name: "Veo 3" },
  { id: "kling", name: "Kling" },
];

type FetchKind = "text" | "image" | "video";

export default function AISettingsPage() {
  const { organizationId } = useMetaIntegration();
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [textModels, setTextModels] = useState<AiModelOption[]>(PRESET_TEXT);
  const [imageModels, setImageModels] = useState<AiModelOption[]>(PRESET_IMAGE);
  const [videoModels, setVideoModels] = useState<AiModelOption[]>(PRESET_VIDEO);
  const [fetching, setFetching] = useState<FetchKind | "all" | null>(null);

  useEffect(() => {
    setSettings(loadAiSettings());
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    void (async () => {
      const { data, error } = await supabase
        .from("organization_ai_settings" as any)
        .select("text_model,image_model,video_model,autonomy_level")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error || !data) return;
      setSettings((current) => ({
        ...current,
        textModel: (data as any).text_model,
        imageModel: (data as any).image_model,
        videoModel: (data as any).video_model,
        autonomyLevel: Number((data as any).autonomy_level),
      }));
    })();
  }, [organizationId]);

  const fetchModels = async (type: FetchKind | "all") => {
    setFetching(type);
    try {
      const { data, error } = await supabase.functions.invoke("nanogpt-chat", {
        body: { action: "list_models", type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const models = data?.models ?? {};
      const merge = (fetched: AiModelOption[] | undefined, presets: AiModelOption[]) => {
        const list = Array.isArray(fetched) ? fetched : [];
        const byId = new Map<string, AiModelOption>();
        for (const p of presets) byId.set(p.id, p);
        for (const m of list) {
          if (m?.id) byId.set(m.id, { id: m.id, name: m.name || m.id, owned_by: m.owned_by });
        }
        return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
      };

      if (type === "text" || type === "all") setTextModels(merge(models.text, PRESET_TEXT));
      if (type === "image" || type === "all") setImageModels(merge(models.image, PRESET_IMAGE));
      if (type === "video" || type === "all") setVideoModels(merge(models.video, PRESET_VIDEO));

      const counts = [
        type === "text" || type === "all" ? `${(models.text ?? []).length} texto` : null,
        type === "image" || type === "all" ? `${(models.image ?? []).length} imagem` : null,
        type === "video" || type === "all" ? `${(models.video ?? []).length} vídeo` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success("Modelos NanoGPT atualizados", { description: counts || "Lista recebida" });
    } catch (e: any) {
      toast.error("Falha ao buscar modelos", { description: e?.message });
    } finally {
      setFetching(null);
    }
  };

  const patch = (partial: Partial<AiSettings>) => {
    setSettings((s) => ({ ...s, ...partial }));
  };

  const save = async () => {
    if (!organizationId) return toast.error("Organização não selecionada");
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase
      .from("organization_ai_settings" as any)
      .upsert({
        organization_id: organizationId,
        text_model: settings.textModel,
        image_model: settings.imageModel,
        video_model: settings.videoModel,
        autonomy_level: settings.autonomyLevel,
        allow_direct_pause: true,
        allow_direct_paused_drafts: true,
        require_approval_activation: true,
        require_approval_budget: true,
        max_budget_change_percent: 20,
        updated_by: userId ?? null,
      } as any, { onConflict: "organization_id" });
    if (error) return toast.error("Falha ao salvar no servidor", { description: error.message });
    const saved = saveAiSettings(settings);
    setSettings(saved);
    toast.success("Configuração de IA salva no servidor", {
      description: "A política conservadora será aplicada pelo executor Meta.",
    });
  };

  const ensureOption = (list: AiModelOption[], id: string) => {
    if (list.some((m) => m.id === id)) return list;
    return [{ id, name: id }, ...list];
  };

  return (
    <>
      <PageHeader
        title="Configuração da IA"
        description="Provedor NanoGPT — busque os modelos reais da API e escolha texto, imagem e vídeo."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void fetchModels("all")}
              disabled={!!fetching}
            >
              {fetching === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Buscar todos
            </Button>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" onClick={() => void save()}>
              Salvar
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-4 md:p-8">
        <Card className="grid gap-4 p-5 shadow-card md:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label>Modelo de texto</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px]"
                onClick={() => void fetchModels("text")}
                disabled={!!fetching}
              >
                {fetching === "text" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Buscar IAs
              </Button>
            </div>
            <Select value={settings.textModel} onValueChange={(v) => patch({ textModel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {ensureOption(textModels, settings.textModel).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}{m.owned_by ? ` · ${m.owned_by}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">Endpoint: /api/v1/models</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label>Modelo de imagem</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px]"
                onClick={() => void fetchModels("image")}
                disabled={!!fetching}
              >
                {fetching === "image" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Buscar IAs
              </Button>
            </div>
            <Select value={settings.imageModel} onValueChange={(v) => patch({ imageModel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {ensureOption(imageModels, settings.imageModel).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}{m.owned_by ? ` · ${m.owned_by}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">Endpoint: /api/v1/image-models</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label>Modelo de vídeo</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px]"
                onClick={() => void fetchModels("video")}
                disabled={!!fetching}
              >
                {fetching === "video" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Buscar IAs
              </Button>
            </div>
            <Select value={settings.videoModel} onValueChange={(v) => patch({ videoModel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {ensureOption(videoModels, settings.videoModel).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}{m.owned_by ? ` · ${m.owned_by}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">Endpoint: /api/v1/video-models</p>
          </div>

          <div>
            <Label>Provedor</Label>
            <Select value="nanogpt" disabled>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nanogpt">NanoGPT (ativo)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Padrão: {DEFAULT_AI_SETTINGS.textModel} / {DEFAULT_AI_SETTINGS.imageModel}
            </p>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold">Nível de autonomia</h3>
          <p className="text-xs text-muted-foreground">Define até onde a IA pode agir sem aprovação humana.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {autonomy.map((a) => (
              <button
                key={a.level}
                type="button"
                onClick={() => patch({ autonomyLevel: a.level })}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  settings.autonomyLevel === a.level
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
          <p className="mb-3 text-xs text-muted-foreground">
            Política conservadora aplicada no servidor; o frontend não pode ignorá-la.
          </p>
          <div className="space-y-3">
            {[
              ["Permitir pausas diretas", true],
              ["Permitir criar estruturas pausadas", true],
              ["Exigir aprovação para ativação", true],
              ["Exigir aprovação para qualquer alteração de orçamento", true],
            ].map(([permission, checked]) => (
              <div key={String(permission)} className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
                <span className="text-sm">{permission}</span>
                <Switch checked={Boolean(checked)} disabled />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
