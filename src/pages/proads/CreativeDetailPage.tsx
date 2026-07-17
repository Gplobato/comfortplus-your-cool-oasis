import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Copy, ImageIcon, Link2, Save, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { EmptyState } from "@/components/proads/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMetaCreatives, useMetaCampaignDetail, useMetaCampaigns } from "@/hooks/useMetaData";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import {
  archiveCreative,
  deleteCreative,
  duplicateCreative,
  updateCreative,
} from "@/lib/creative-library";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import { metaActionToastMessage, submitMetaAction } from "@/lib/meta-actions";

export default function CreativeDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = useMetaIntegration();
  const { organizationId } = meta;
  const query = useMetaCreatives({ includeArchived: true });
  const campaignQuery = useMetaCampaigns({ status: "all" });
  const creative = useMemo(() => query.data?.creatives.find((item) => item.id === id), [id, query.data]);
  const [form, setForm] = useState({
    name: "",
    headline: "",
    primary_text: "",
    cta: "",
    destination_url: "",
    description: "",
    tags: "",
    publication_status: "draft",
  });
  const [campaignId, setCampaignId] = useState("");
  const [adsetId, setAdsetId] = useState("");
  const [pageId, setPageId] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCampaignDetail = useMetaCampaignDetail(campaignId || undefined);
  const pages = useQuery({
    queryKey: ["meta-pages-for-creative", meta.connectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_assets")
        .select("id,external_id,name")
        .eq("connection_id", meta.connectionId!)
        .eq("asset_type", "page");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!meta.connectionId,
  });

  useEffect(() => {
    if (!creative) return;
    setForm({
      name: creative.name,
      headline: creative.headline ?? "",
      primary_text: creative.primary_text ?? "",
      cta: creative.cta ?? "",
      destination_url: creative.destination_url ?? "",
      description: creative.description ?? "",
      tags: (creative.tags ?? []).join(", "),
      publication_status: creative.publication_status,
    });
  }, [creative]);

  const links = useQuery({
    queryKey: ["creative-links", organizationId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_campaign_links" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("creative_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId && !!id,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["creative-library"] }),
      queryClient.invalidateQueries({ queryKey: ["creative-links", organizationId, id] }),
    ]);
  };

  if (query.isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando criativo…</div>;
  if (!creative) {
    return (
      <div className="space-y-4 p-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/criativos")}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <EmptyState icon={ImageIcon} title="Criativo não encontrado" description="Ele pode ter sido excluído da galeria." />
      </div>
    );
  }

  const assetUrl = creative.signed_url || creative.media_url || creative.thumbnail_url;

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe um nome");
    setSaving(true);
    try {
      await updateCreative(creative.id, {
        name: form.name.trim(),
        headline: form.headline.trim() || null,
        primary_text: form.primary_text.trim() || null,
        cta: form.cta.trim() || null,
        destination_url: form.destination_url.trim() || null,
        description: form.description.trim() || null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        publication_status: form.publication_status as typeof creative.publication_status,
      });
      await refresh();
      toast.success("Criativo atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const linkCampaign = async () => {
    const campaign = campaignQuery.data?.campaigns.find((item) => item.id === campaignId);
    const adset = selectedCampaignDetail.data?.adsets.find((item) => item.id === adsetId);
    if (!campaign || !adset || !organizationId || !pageId) {
      return toast.error("Selecione campanha, conjunto e Página");
    }
    if (!/^https?:\/\//i.test(form.destination_url)) return toast.error("Informe e salve uma URL de destino válida");
    try {
      const result = await submitMetaAction({
        organizationId,
        toolName: "meta.publish_creative_paused",
        title: `Criar anúncio pausado com ${creative.name}`,
        arguments: {
          creative_id: creative.id,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          adset_id: adset.id,
          adset_name: adset.name,
          page_id: pageId,
          destination_url: form.destination_url,
          cta: form.cta || "LEARN_MORE",
          headline: form.headline,
          primary_text: form.primary_text,
        },
      });
      await refresh();
      toast.success(metaActionToastMessage(result));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao vincular");
    }
  };

  return (
    <>
      <PageHeader
        title={creative.name}
        description="Edite a copy, organize tags e atrele este ativo a campanhas."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate("/criativos")}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                try {
                  const copy = await duplicateCreative(creative);
                  await refresh();
                  toast.success("Criativo duplicado");
                  navigate(`/criativos/${copy.id}`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao duplicar");
                }
              }}
            >
              <Copy className="h-4 w-4" /> Duplicar
            </Button>
            <Button size="sm" className="gap-2 bg-gradient-brand text-primary-foreground" disabled={saving} onClick={save}>
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-4 lg:grid-cols-3 md:p-8">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden shadow-card">
            {assetUrl ? (
              creative.type === "video" ? (
                <video src={assetUrl} controls className="max-h-[560px] w-full bg-black object-contain" />
              ) : (
                <img src={assetUrl} alt={creative.name} className="max-h-[560px] w-full bg-muted object-contain" />
              )
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted"><ImageIcon className="h-12 w-12 text-muted-foreground" /></div>
            )}
          </Card>

          <Card className="p-5 shadow-card">
            <h2 className="font-display font-bold">Informações e copy</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Estado">
                <Select value={form.publication_status} onValueChange={(value) => setForm({ ...form, publication_status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="ready">Pronto para publicar</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Título"><Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></Field>
              <Field label="CTA"><Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value.toUpperCase() })} /></Field>
              <Field label="Texto principal" className="md:col-span-2">
                <Textarea className="min-h-28" value={form.primary_text} onChange={(e) => setForm({ ...form, primary_text: e.target.value })} />
              </Field>
              <Field label="URL de destino"><Input type="url" value={form.destination_url} onChange={(e) => setForm({ ...form, destination_url: e.target.value })} /></Field>
              <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
              <Field label="Observações" className="md:col-span-2">
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 shadow-card">
            <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><h2 className="font-display font-bold">Usar em campanha</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">O vínculo organiza a galeria. A publicação sempre criará um anúncio pausado.</p>
            <Select value={campaignId} onValueChange={(value) => {
              setCampaignId(value);
              setAdsetId("");
            }}>
              <SelectTrigger className="mt-4"><SelectValue placeholder="Selecione a campanha" /></SelectTrigger>
              <SelectContent>
                {(campaignQuery.data?.campaigns ?? []).map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={adsetId} onValueChange={setAdsetId}>
              <SelectTrigger className="mt-3"><SelectValue placeholder="Selecione o conjunto" /></SelectTrigger>
              <SelectContent>
                {(selectedCampaignDetail.data?.adsets ?? []).map((adset) => (
                  <SelectItem key={adset.id} value={adset.id}>{adset.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pageId} onValueChange={setPageId}>
              <SelectTrigger className="mt-3"><SelectValue placeholder="Selecione a Página" /></SelectTrigger>
              <SelectContent>
                {(pages.data ?? []).map((page) => (
                  <SelectItem key={page.id} value={page.external_id}>{page.name || page.external_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="mt-3 w-full gap-2" variant="outline" onClick={linkCampaign}>
              <Link2 className="h-4 w-4" /> Criar anúncio pausado
            </Button>
          </Card>

          <Card className="p-5 shadow-card">
            <h2 className="font-display font-bold">Vínculos</h2>
            <div className="mt-3 space-y-2">
              {(links.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Ainda não vinculado.</p>
              ) : (links.data as Array<{
                id: string;
                campaign_name: string | null;
                campaign_external_id: string;
                adset_name: string | null;
                publication_status: string;
              }> ?? []).map((link) => (
                <div key={link.id} className="rounded-md border border-border p-3 text-xs">
                  <p className="font-semibold">{link.campaign_name || link.campaign_external_id}</p>
                  <p className="mt-1 text-muted-foreground">{link.adset_name || "Conjunto ainda não escolhido"} · {link.publication_status}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 text-sm shadow-card">
            <div className="space-y-2">
              <Info label="Origem" value={creative.source === "ai" ? "Agente IA" : "Upload"} />
              <Info label="Tipo" value={creative.type === "video" ? "Vídeo" : "Imagem"} />
              <Info label="Tamanho" value={creative.file_size ? `${formatNumber(Math.round(creative.file_size / 1024))} KB` : "—"} />
              <Info label="Atualizado" value={formatDate(creative.updated_at)} />
            </div>
            <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => navigate("/agente")}>
              <Sparkles className="h-4 w-4" /> Gerar variação
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full gap-2"
              onClick={async () => {
                await archiveCreative(creative.id, !creative.archived_at);
                await refresh();
                toast.success(creative.archived_at ? "Criativo restaurado" : "Criativo arquivado");
              }}
            >
              <Archive className="h-4 w-4" /> {creative.archived_at ? "Restaurar" : "Arquivar"}
            </Button>
            <Button
              variant="ghost"
              className="mt-1 w-full gap-2 text-destructive hover:text-destructive"
              onClick={async () => {
                if (!window.confirm("Excluir este criativo permanentemente?")) return;
                await deleteCreative(creative);
                await refresh();
                toast.success("Criativo excluído");
                navigate("/criativos");
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className}><Label className="mb-1.5 block">{label}</Label>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}
