import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { useMetaCreatives } from "@/hooks/useMetaData";
import { supabase } from "@/integrations/supabase/client";
import { metaActionToastMessage, submitMetaAction } from "@/lib/meta-actions";
import { toast } from "sonner";

const OBJECTIVES = [
  ["OUTCOME_TRAFFIC", "Tráfego"],
  ["OUTCOME_LEADS", "Leads"],
  ["OUTCOME_SALES", "Vendas"],
  ["OUTCOME_ENGAGEMENT", "Engajamento"],
  ["OUTCOME_AWARENESS", "Reconhecimento"],
] as const;

function objectiveConfig(objective: string, pageId: string, pixelId: string) {
  if (objective === "OUTCOME_LEADS") {
    return { optimization_goal: "LEAD_GENERATION", promoted_object: pageId ? { page_id: pageId } : undefined };
  }
  if (objective === "OUTCOME_SALES") {
    return {
      optimization_goal: "OFFSITE_CONVERSIONS",
      promoted_object: pixelId ? { pixel_id: pixelId, custom_event_type: "PURCHASE" } : undefined,
    };
  }
  if (objective === "OUTCOME_ENGAGEMENT") return { optimization_goal: "POST_ENGAGEMENT" };
  if (objective === "OUTCOME_AWARENESS") return { optimization_goal: "REACH" };
  return { optimization_goal: "LINK_CLICKS" };
}

export default function NewCampaignPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const meta = useMetaIntegration();
  const gallery = useMetaCreatives();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [adsetName, setAdsetName] = useState("");
  const [country, setCountry] = useState("BR");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [dailyBudget, setDailyBudget] = useState("");
  const [pageId, setPageId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [creativeId, setCreativeId] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const assets = useQuery({
    queryKey: ["meta-assets-for-campaign", meta.connectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_assets")
        .select("id,asset_type,external_id,name,metadata_sanitized")
        .eq("connection_id", meta.connectionId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!meta.connectionId,
  });
  const pages = useMemo(() => (assets.data ?? []).filter((asset) => asset.asset_type === "page"), [assets.data]);
  const pixels = useMemo(() => (assets.data ?? []).filter((asset) => asset.asset_type === "pixel"), [assets.data]);
  const selectedCreative = gallery.data?.creatives.find((creative) => creative.id === creativeId);

  const create = async () => {
    if (!meta.organizationId || !meta.selectedAdAccount) return toast.error("Conecte e selecione uma conta Meta");
    const budget = Number(dailyBudget.replace(",", "."));
    if (!name.trim() || !adsetName.trim()) return toast.error("Preencha os nomes da campanha e do conjunto");
    if (!Number.isFinite(budget) || budget <= 0) return toast.error("Informe um orçamento diário válido");
    if (creativeId && !pageId) return toast.error("Selecione a Página para publicar o criativo");
    if (creativeId && !/^https?:\/\//i.test(destinationUrl || selectedCreative?.destination_url || "")) {
      return toast.error("Informe uma URL de destino válida");
    }
    if (objective === "OUTCOME_SALES" && !pixelId) return toast.error("Selecione um Pixel para campanhas de vendas");

    setSaving(true);
    try {
      const config = objectiveConfig(objective, pageId, pixelId);
      const result = await submitMetaAction({
        organizationId: meta.organizationId,
        toolName: "meta.create_campaign_structure",
        title: `Criar estrutura pausada: ${name.trim()}`,
        arguments: {
          campaign: {
            name: name.trim(),
            objective,
            buying_type: "AUCTION",
            special_ad_categories: [],
          },
          adset: {
            name: adsetName.trim(),
            billing_event: "IMPRESSIONS",
            optimization_goal: config.optimization_goal,
            promoted_object: config.promoted_object,
            daily_budget_brl: budget,
            targeting: {
              geo_locations: { countries: [country.toUpperCase()] },
              age_min: Number(ageMin),
              age_max: Number(ageMax),
            },
          },
        },
      });
      if (result.status === "awaiting_approval") {
        toast.success(metaActionToastMessage(result));
        navigate("/aprovacoes");
        return;
      }
      const payload = result.result as {
        partial_failure?: boolean;
        error?: string;
        campaign?: { campaign_id?: string };
        adset?: { adset_id?: string };
      } | undefined;
      if (payload?.partial_failure) {
        toast.warning("A campanha foi criada pausada, mas o conjunto falhou", { description: payload.error });
        navigate("/campanhas");
        return;
      }
      const campaignId = payload?.campaign?.campaign_id;
      const adsetId = payload?.adset?.adset_id;
      if (creativeId && campaignId && adsetId) {
        await submitMetaAction({
          organizationId: meta.organizationId,
          toolName: "meta.publish_creative_paused",
          title: `Criar anúncio pausado: ${selectedCreative?.name}`,
          arguments: {
            creative_id: creativeId,
            campaign_id: campaignId,
            campaign_name: name.trim(),
            adset_id: adsetId,
            adset_name: adsetName.trim(),
            page_id: pageId,
            destination_url: destinationUrl || selectedCreative?.destination_url,
            cta: selectedCreative?.cta || "LEARN_MORE",
          },
        });
      }
      toast.success("Campanha, conjunto e anúncio criados pausados na Meta");
      navigate(`/campanhas/${campaignId || ""}`);
    } catch (error) {
      toast.error("Não foi possível criar a estrutura", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nova campanha Meta"
        description="A estrutura será criada de verdade, sempre pausada e pronta para revisão."
        actions={<Button variant="ghost" size="sm" onClick={() => navigate("/campanhas")}><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
      />
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        {params.get("ai") === "1" && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Rascunho assistido por IA</AlertTitle>
            <AlertDescription>Revise todos os campos. A política do servidor impedirá publicação ativa.</AlertDescription>
          </Alert>
        )}
        {!meta.connected || !meta.selectedAdAccount ? (
          <Alert variant="destructive">
            <AlertTitle>Meta não conectada</AlertTitle>
            <AlertDescription>Conecte e selecione uma conta de anúncios antes de criar uma campanha.</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>{meta.selectedAdAccount.name}</AlertTitle>
            <AlertDescription>Conta real selecionada · criação com status PAUSED.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5 shadow-card">
            <h2 className="font-display font-bold">Campanha</h2>
            <div className="mt-4 space-y-4">
              <Field label="Nome da campanha"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Leads SP · julho" /></Field>
              <Field label="Objetivo">
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OBJECTIVES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Nome do conjunto"><Input value={adsetName} onChange={(e) => setAdsetName(e.target.value)} placeholder="Ex: Público amplo · SP" /></Field>
              <Field label="Orçamento diário (R$)"><Input inputMode="decimal" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} placeholder="150,00" /></Field>
            </div>
          </Card>

          <Card className="p-5 shadow-card">
            <h2 className="font-display font-bold">Público e rastreamento</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="País"><Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Idade mín."><Input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} /></Field>
                <Field label="Idade máx."><Input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} /></Field>
              </div>
              <Field label="Página" className="sm:col-span-2">
                <Select value={pageId} onValueChange={setPageId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma Página" /></SelectTrigger>
                  <SelectContent>{pages.map((page) => <SelectItem key={page.id} value={page.external_id}>{page.name || page.external_id}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {objective === "OUTCOME_SALES" && (
                <Field label="Pixel" className="sm:col-span-2">
                  <Select value={pixelId} onValueChange={setPixelId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o Pixel" /></SelectTrigger>
                    <SelectContent>{pixels.map((pixel) => <SelectItem key={pixel.id} value={pixel.external_id}>{pixel.name || pixel.external_id}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
            </div>
          </Card>

          <Card className="p-5 shadow-card lg:col-span-2">
            <h2 className="font-display font-bold">Criativo da galeria</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Criativo">
                <Select value={creativeId || "none"} onValueChange={(value) => {
                  const next = value === "none" ? "" : value;
                  setCreativeId(next);
                  const creative = gallery.data?.creatives.find((item) => item.id === next);
                  if (creative?.destination_url) setDestinationUrl(creative.destination_url);
                }}>
                  <SelectTrigger><SelectValue placeholder="Sem anúncio agora" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Criar somente campanha e conjunto</SelectItem>
                    {(gallery.data?.creatives ?? []).map((creative) => <SelectItem key={creative.id} value={creative.id}>{creative.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="URL de destino"><Input type="url" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://..." /></Field>
            </div>
          </Card>
        </div>

        <Alert>
          <AlertTitle>Proteção de veiculação</AlertTitle>
          <AlertDescription>
            Campanha, conjunto e anúncio serão criados com status PAUSED. Ativação e orçamento posterior passam por Aprovações.
          </AlertDescription>
        </Alert>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/campanhas")}>Cancelar</Button>
          <Button className="gap-2 bg-gradient-brand text-primary-foreground" disabled={saving || !meta.connected} onClick={() => void create()}>
            <Check className="h-4 w-4" /> {saving ? "Criando na Meta…" : "Criar estrutura pausada"}
          </Button>
        </div>
      </div>
    </>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label className="mb-1.5 block">{label}</Label>{children}</div>;
}
