import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileUp, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMetaIntegration } from "@/contexts/MetaIntegrationContext";
import { uploadCreativeAsset } from "@/lib/creative-library";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function NewCreativePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId } = useMetaIntegration();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [cta, setCta] = useState("SAIBA_MAIS");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!organizationId) return toast.error("Organização não selecionada");
    if (!file) return toast.error("Selecione uma imagem ou vídeo");
    if (!name.trim()) return toast.error("Informe um nome para o criativo");
    setSaving(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const creative = await uploadCreativeAsset({
        organizationId,
        userId,
        file,
        name,
        headline,
        primaryText,
        cta,
        destinationUrl,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      await queryClient.invalidateQueries({ queryKey: ["creative-library", organizationId] });
      toast.success("Criativo adicionado à galeria");
      navigate(`/criativos/${creative.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar o criativo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Adicionar criativo"
        description="Envie um arquivo privado e prepare a copy antes de atrelar a uma campanha."
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/criativos")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        }
      />
      <div className="grid gap-6 p-4 md:grid-cols-3 md:p-8">
        <Card className="p-6 shadow-card md:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="creative-file">Arquivo</Label>
              <label
                htmlFor="creative-file"
                className="mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center hover:bg-secondary/40"
              >
                <FileUp className="mb-2 h-7 w-7 text-primary" />
                <span className="text-sm font-semibold">{file?.name || "Clique para selecionar"}</span>
                <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, GIF, MP4, MOV ou WebM · até 100 MB</span>
              </label>
              <input
                id="creative-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                className="sr-only"
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  if (next && !name) setName(next.name.replace(/\.[^.]+$/, ""));
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="creative-name">Nome</Label>
              <Input id="creative-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="creative-headline">Título do anúncio</Label>
              <Input id="creative-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} className="mt-1.5" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="creative-copy">Texto principal</Label>
              <Textarea id="creative-copy" value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} className="mt-1.5 min-h-28" />
            </div>
            <div>
              <Label htmlFor="creative-cta">CTA da Meta</Label>
              <Input id="creative-cta" value={cta} onChange={(event) => setCta(event.target.value.toUpperCase())} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="creative-url">URL de destino</Label>
              <Input id="creative-url" type="url" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} className="mt-1.5" placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="creative-tags">Tags</Label>
              <Input id="creative-tags" value={tags} onChange={(event) => setTags(event.target.value)} className="mt-1.5" placeholder="promoção, inverno, lead" />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/criativos")}>Cancelar</Button>
            <Button className="gap-2 bg-gradient-brand text-primary-foreground" disabled={saving} onClick={submit}>
              <FileUp className="h-4 w-4" /> {saving ? "Enviando…" : "Salvar na galeria"}
            </Button>
          </div>
        </Card>

        <Card className="h-fit p-5 shadow-card">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="mt-3 font-display font-bold">Precisa criar?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O Agente IA gera imagens e vídeos e salva o resultado nesta mesma galeria.
          </p>
          <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => navigate("/agente")}>
            <Sparkles className="h-4 w-4" /> Abrir Agente IA
          </Button>
        </Card>
      </div>
    </>
  );
}
