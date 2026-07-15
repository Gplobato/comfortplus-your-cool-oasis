import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Search,
  Trash2,
  Plus,
  Wrench,
  StopCircle,
  Eraser,
  ImageIcon,
  MessageSquare,
  Bot,
  Paperclip,
  X,
  Film,
  Download,
  Megaphone,
  ChevronDown,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  loadCurrentId,
  loadThreads,
  saveCurrentId,
  saveThreads,
  type AgentThread,
} from "@/lib/agent-storage";
import type { AgentMessage, AgentRole } from "@/types/proads";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { campaigns as mockCampaigns } from "@/mocks/data";
import brandLogo from "@/assets/brand-logo.png";

const TEXT_MODELS = [
  { value: "zai-org/glm-5.2", label: "GLM 5.2 (padrão)" },
  { value: "openai/gpt-5.5", label: "GPT-5.5" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { value: "google/gemini-3-pro", label: "Gemini 3 Pro" },
];

const IMAGE_MODELS = [
  { value: "gpt-image-2", label: "GPT Image 2 (padrão)" },
  { value: "gemini-3-pro-image", label: "Gemini 3 Pro Image" },
  { value: "flux-kontext", label: "Flux Kontext" },
];

const VIDEO_MODELS = [
  { value: "happyhorse-1.1", label: "HappyHorse 1.1 (padrão)" },
  { value: "veo3-video", label: "Veo 3" },
  { value: "kling-v26-pro", label: "Kling 2.6 Pro" },
  { value: "seedance-video", label: "Seedance" },
];

const suggestions = [
  "Analise minhas campanhas Meta",
  "Crie um plano de mídia para lançar um novo produto",
  "Gere um criativo de anúncio com nossa logo",
  "Faça um vídeo curto de 5s para reels",
  "Pesquise 3 concorrentes fortes no meu nicho",
];

// Rotating status per intent
const STATUS_BY_INTENT: Record<"chat" | "image" | "video", { agent: AgentRole; label: string }[]> = {
  chat: [
    { agent: "director", label: "Diretor de Marketing analisando seu pedido…" },
    { agent: "researcher", label: "Pesquisador buscando referências…" },
    { agent: "strategist", label: "Estrategista montando o plano…" },
    { agent: "copywriter", label: "Copywriter escrevendo a resposta…" },
  ],
  image: [
    { agent: "creative_director", label: "Diretor de Arte pensando na composição…" },
    { agent: "creative_director", label: "Gerando variante 1:1 (Feed)…" },
    { agent: "creative_director", label: "Gerando variante 9:16 (Story/Reel)…" },
    { agent: "copywriter", label: "Copywriter revisando o texto do anúncio…" },
  ],
  video: [
    { agent: "creative_director", label: "Diretor de Arte roteirizando as cenas…" },
    { agent: "creative_director", label: "Renderizando storyboard animado…" },
    { agent: "media_buyer", label: "Media Buyer preparando entrega…" },
  ],
};

function detectIntent(text: string, forced?: "image" | "video"): "chat" | "image" | "video" {
  if (forced) return forced;
  const t = text.toLowerCase();
  if (/\b(v[íi]deo|reels?|film[ea]|animação)\b/.test(t)) return "video";
  if (/\b(imagem|criativo|anúncio|foto|banner|mockup|arte|design)\b/.test(t)) return "image";
  return "chat";
}

export default function AgentPage() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<AgentThread[]>(() => {
    const existing = loadThreads();
    if (existing.length) return existing;
    const t = createThread("Primeira conversa");
    saveThreads([t]);
    saveCurrentId(t.id);
    return [t];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = loadCurrentId();
    const list = loadThreads();
    if (stored && list.some((t) => t.id === stored)) return stored;
    return list[0]?.id ?? "";
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [textModel, setTextModel] = useState("zai-org/glm-5.2");
  const [imageModel, setImageModel] = useState("gpt-image-2");
  const [videoModel, setVideoModel] = useState("happyhorse-1.1");
  const [forceMode, setForceMode] = useState<"auto" | "image" | "video">("auto");
  const [useBrandLogo, setUseBrandLogo] = useState(true);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [statusStep, setStatusStep] = useState(0);
  const [statusIntent, setStatusIntent] = useState<"chat" | "image" | "video">("chat");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  useEffect(() => {
    if (active) saveCurrentId(active.id);
  }, [active?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, loading, statusStep]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  // Rotate status while loading
  useEffect(() => {
    if (!loading) return;
    const steps = STATUS_BY_INTENT[statusIntent];
    const t = setInterval(() => setStatusStep((s) => (s + 1) % steps.length), 1600);
    return () => clearInterval(t);
  }, [loading, statusIntent]);

  const updateThread = (id: string, patch: (t: AgentThread) => AgentThread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? patch(t) : t)));
  };

  const newThread = () => {
    const t = createThread();
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
  };

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = createThread();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const arr = await Promise.all(
      Array.from(files).slice(0, 4).map(
        (f) =>
          new Promise<{ name: string; url: string }>((res, rej) => {
            if (f.size > 4 * 1024 * 1024) {
              rej(new Error(`${f.name} maior que 4MB`));
              return;
            }
            const r = new FileReader();
            r.onload = () => res({ name: f.name, url: String(r.result) });
            r.onerror = () => rej(new Error("Erro ao ler"));
            r.readAsDataURL(f);
          }),
      ),
    ).catch((e) => {
      toast.error(e.message);
      return [];
    });
    setAttachments((prev) => [...prev, ...arr].slice(0, 4));
  };

  const send = async (text: string) => {
    if (!text.trim() || loading || !active) return;
    const intent = detectIntent(text, forceMode === "auto" ? undefined : forceMode);
    setStatusIntent(intent);
    setStatusStep(0);

    const attachList = [...attachments];
    const brandOn = useBrandLogo;

    const userMsg: AgentMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      status: "sent",
      attachments: [
        ...(brandOn ? [{ name: "Logo da marca", url: brandLogo }] : []),
        ...attachList,
      ],
    };
    const isFirst = active.messages.length <= 1;
    updateThread(active.id, (t) => ({
      ...t,
      messages: [...t.messages, userMsg],
      title: isFirst ? text.slice(0, 60) : t.title,
      updatedAt: new Date().toISOString(),
    }));
    setInput("");
    setAttachments([]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...active.messages, userMsg]
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.imageUrl || m.images?.length
            ? `${m.content}\n[imagem gerada anteriormente]`
            : m.content,
        }));

      const attachmentUrls = [
        ...(brandOn ? [brandLogo] : []),
        ...attachList.map((a) => a.url),
      ];

      const { data, error } = await supabase.functions.invoke("nanogpt-chat", {
        body: {
          messages: history,
          textModel,
          imageModel,
          videoModel,
          mode: forceMode,
          prompt: forceMode !== "auto" ? text : undefined,
          useBrandLogo: brandOn,
          attachments: attachmentUrls,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const hasVisual = !!(data?.images?.length || data?.videoUrl);
      const replyMsg: AgentMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        agent: hasVisual ? "creative_director" : "director",
        content:
          data?.text ||
          (data?.images?.length
            ? "Aqui estão as duas variantes prontas para Facebook Ads:"
            : data?.videoUrl
              ? "Aqui está o vídeo que preparei:"
              : "(sem resposta)"),
        createdAt: new Date().toISOString(),
        status: "sent",
        images: data?.images,
        videoUrl: data?.videoUrl,
        modelUsed: data?.videoUrl ? videoModel : hasVisual ? imageModel : textModel,
      };

      updateThread(active.id, (t) => ({
        ...t,
        messages: [...t.messages, replyMsg],
        updatedAt: new Date().toISOString(),
      }));
    } catch (err: any) {
      const errorMsg: AgentMessage = {
        id: `e_${Date.now()}`,
        role: "assistant",
        agent: "auditor",
        content: `⚠️ Falha ao chamar o modelo: ${err?.message ?? "erro desconhecido"}`,
        createdAt: new Date().toISOString(),
        status: "error",
      };
      updateThread(active.id, (t) => ({
        ...t,
        messages: [...t.messages, errorMsg],
      }));
      toast.error("Falha na chamada do agente");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const useInCampaign = (imgUrl: string, target: "new" | string) => {
    try {
      sessionStorage.setItem(
        "proads:pending-creative",
        JSON.stringify({ url: imgUrl, targetCampaignId: target === "new" ? null : target }),
      );
    } catch {/* ignore */}
    if (target === "new") {
      toast.success("Criativo enviado para nova campanha");
      navigate("/campanhas/nova");
    } else {
      const c = mockCampaigns.find((x) => x.id === target);
      toast.success(`Criativo anexado a "${c?.name ?? target}"`);
      navigate(`/campanhas/${target}`);
    }
  };

  const currentStatus = STATUS_BY_INTENT[statusIntent][statusStep];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader
        title="Agente IA"
        description="Time de agentes ProAds com memória persistente. Cérebro: NanoGPT."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={textModel} onValueChange={setTextModel}>
              <SelectTrigger className="h-9 w-[190px] gap-2 bg-card">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={imageModel} onValueChange={setImageModel}>
              <SelectTrigger className="h-9 w-[180px] gap-2 bg-card">
                <ImageIcon className="h-3.5 w-3.5 text-accent" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={videoModel} onValueChange={setVideoModel}>
              <SelectTrigger className="h-9 w-[160px] gap-2 bg-card">
                <Film className="h-3.5 w-3.5 text-accent" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:p-6 lg:grid-cols-[260px_1fr_280px]">
        {/* Conversations */}
        <Card className="hidden flex-col shadow-card lg:flex">
          <div className="border-b border-border p-3">
            <Button size="sm" onClick={newThread} className="w-full gap-2 bg-gradient-brand text-primary-foreground">
              <Plus className="h-3.5 w-3.5" /> Nova conversa
            </Button>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Buscar..."
                className="h-8 w-full rounded-md border border-border bg-secondary/60 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {threads.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group mb-1 flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs transition-colors",
                    activeId === c.id ? "bg-gradient-brand-soft" : "hover:bg-secondary",
                  )}
                >
                  <button onClick={() => setActiveId(c.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground">{c.messages.length} mensagens</p>
                    </div>
                  </button>
                  <button onClick={() => deleteThread(c.id)} className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Excluir conversa">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat */}
        <Card className="flex min-h-0 flex-col overflow-hidden shadow-card">
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl space-y-6 p-6">
              {active?.messages.map((m) => (
                <MessageBubble key={m.id} message={m} onUseInCampaign={useInCampaign} />
              ))}
              {loading && (
                <WorkingIndicator
                  agent={currentStatus.agent}
                  label={currentStatus.label}
                  steps={STATUS_BY_INTENT[statusIntent]}
                  current={statusStep}
                />
              )}
              <div ref={endRef} />
            </div>
          </ScrollArea>

          {active && active.messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 border-t border-border px-6 py-3">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-gradient-brand-soft hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-border bg-card/50 p-3">
            {/* Attachment chips */}
            {(useBrandLogo || attachments.length > 0) && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {useBrandLogo && (
                  <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-gradient-brand-soft px-2 py-1 text-[11px] text-primary">
                    <img src={brandLogo} alt="Logo" className="h-4 w-auto" />
                    <span className="font-semibold">Logo embutida</span>
                    <button onClick={() => setUseBrandLogo(false)} aria-label="Remover logo">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-1 text-[11px]">
                    <img src={a.url} alt={a.name} className="h-4 w-4 rounded object-cover" />
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} aria-label="Remover anexo">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-2 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  forceMode === "image"
                    ? "Descreva a imagem — geraremos 1:1 e 9:16 automaticamente..."
                    : forceMode === "video"
                      ? "Descreva o vídeo que quer gerar..."
                      : "Peça uma análise, um criativo, um vídeo, uma copy..."
                }
                className="min-h-[52px] resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                  <Paperclip className="h-3.5 w-3.5" /> Anexar
                </Button>
                <Button
                  variant={useBrandLogo ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs", useBrandLogo && "bg-primary text-primary-foreground")}
                  onClick={() => setUseBrandLogo((v) => !v)}
                  title="Embutir a logo da marca em todo criativo gerado"
                >
                  <Check className={cn("h-3.5 w-3.5", !useBrandLogo && "opacity-30")} />
                  Logo da marca
                </Button>
                <Button
                  variant={forceMode === "image" ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs", forceMode === "image" && "bg-accent text-accent-foreground hover:bg-accent/90")}
                  onClick={() => setForceMode((m) => (m === "image" ? "auto" : "image"))}
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Imagem
                </Button>
                <Button
                  variant={forceMode === "video" ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs", forceMode === "video" && "bg-accent text-accent-foreground hover:bg-accent/90")}
                  onClick={() => setForceMode((m) => (m === "video" ? "auto" : "video"))}
                >
                  <Film className="h-3.5 w-3.5" /> Vídeo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => {
                    if (!active) return;
                    updateThread(active.id, (t) => ({ ...t, messages: t.messages.slice(0, 1) }));
                  }}
                >
                  <Eraser className="h-3.5 w-3.5" /> Limpar
                </Button>
                {loading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-destructive"
                    onClick={() => {
                      abortRef.current?.abort();
                      setLoading(false);
                    }}
                  >
                    <StopCircle className="h-3.5 w-3.5" /> Parar
                  </Button>
                )}
                <Button
                  size="icon"
                  className="ml-auto h-8 w-8 bg-gradient-brand text-primary-foreground"
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Modo: <span className="font-semibold text-foreground">{forceMode}</span> · Texto: {textModel} · Imagem: {imageModel} · Vídeo: {videoModel}
            </p>
          </div>
        </Card>

        {/* Context panel */}
        <Card className="hidden flex-col shadow-card lg:flex">
          <div className="border-b border-border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contexto</p>
            <p className="mt-0.5 font-display text-sm font-bold">Sessão atual</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 text-xs">
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Marca ativa</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <img src={brandLogo} alt="Obras Timelapse" className="h-6 w-auto" />
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {useBrandLogo ? "✓ Sendo embutida em todo prompt visual" : "Desativada — ative no composer"}
                </p>
              </div>
              <ContextItem label="Conversa" value={active?.title ?? "—"} />
              <ContextItem label="Mensagens" value={`${active?.messages.length ?? 0} nesta sessão`} />
              <ContextItem label="Total de conversas" value={`${threads.length} salvas localmente`} />
              <Separator />
              <div>
                <p className="mb-2 font-semibold text-foreground">Time de agentes</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Diretor de Marketing",
                    "Pesquisador",
                    "Estrategista",
                    "Copywriter",
                    "Diretor de Arte",
                    "Media Buyer",
                    "Analista",
                  ].map((t) => (
                    <Badge key={t} variant="outline" className="gap-1 border-border text-[10px] font-normal">
                      <Wrench className="h-2.5 w-2.5" />
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-1 font-semibold text-foreground">Padrão de criativos</p>
                <p className="text-muted-foreground">
                  Toda geração de imagem produz automaticamente <strong>2 variantes</strong>: <strong>1:1 (Feed)</strong> e <strong>9:16 (Story/Reel)</strong> — padrão Facebook Ads.
                </p>
              </div>
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

const agentLabels: Record<string, string> = {
  director: "Diretor de Marketing",
  researcher: "Pesquisador",
  strategist: "Estrategista",
  copywriter: "Copywriter",
  creative_director: "Diretor de Arte",
  media_buyer: "Media Buyer",
  analyst: "Analista",
  auditor: "Auditor",
};

function WorkingIndicator({
  agent,
  label,
  steps,
  current,
}: {
  agent: AgentRole;
  label: string;
  steps: { agent: AgentRole; label: string }[];
  current: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
        <Sparkles className="h-4 w-4 text-white" />
        <span className="absolute -inset-0.5 animate-ping rounded-lg bg-primary/30" />
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
          {agentLabels[agent]}
        </p>
        <div className="rounded-2xl border border-primary/20 bg-gradient-brand-soft px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-foreground">{label}</p>
          </div>
          <div className="mt-2 flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i <= current ? "bg-primary" : "bg-primary/20",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onUseInCampaign,
}: {
  message: AgentMessage;
  onUseInCampaign: (url: string, target: "new" | string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          isUser ? "bg-secondary text-foreground" : "bg-gradient-brand text-white",
        )}
      >
        {isUser ? "GA" : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[85%] space-y-2", isUser && "items-end text-right")}>
        {!isUser && message.agent && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            {agentLabels[message.agent] ?? message.agent}
          </p>
        )}
        {message.content && (
          <div
            className={cn(
              "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground"
                : message.status === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-foreground",
            )}
          >
            {message.content}
          </div>
        )}

        {/* User attachments */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {message.attachments.map((a, i) => (
              <img
                key={i}
                src={a.url}
                alt={a.name}
                className="h-16 w-16 rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        )}

        {/* Legacy single image */}
        {message.imageUrl && !message.images?.length && (
          <ImageResult url={message.imageUrl} label="Criativo" onUseInCampaign={onUseInCampaign} />
        )}

        {/* Image pair */}
        {message.images && message.images.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {message.images.map((img, i) => (
              <ImageResult key={i} url={img.url} label={img.label ?? img.format} onUseInCampaign={onUseInCampaign} />
            ))}
          </div>
        )}

        {/* Video */}
        {message.videoUrl && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <video src={message.videoUrl} controls className="h-auto w-full max-w-md" />
            <div className="flex items-center justify-between gap-2 border-t border-border p-2">
              <span className="text-[11px] text-muted-foreground">Vídeo gerado</span>
              <a
                href={message.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Download className="h-3 w-3" /> Baixar
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageResult({
  url,
  label,
  onUseInCampaign,
}: {
  url: string;
  label: string;
  onUseInCampaign: (url: string, target: "new" | string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <Badge variant="outline" className="border-primary/30 bg-gradient-brand-soft text-[10px] font-semibold text-primary">
          {label}
        </Badge>
        <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Baixar">
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
      <img src={url} alt={label} className="h-auto w-full" loading="lazy" />
      <div className="border-t border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="w-full gap-1.5 bg-gradient-brand text-primary-foreground">
              <Megaphone className="h-3.5 w-3.5" /> Usar em campanha
              <ChevronDown className="ml-auto h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={() => onUseInCampaign(url, "new")} className="gap-2">
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold">Criar nova campanha</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Anexar a existente
            </DropdownMenuLabel>
            {mockCampaigns.slice(0, 6).map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => onUseInCampaign(url, c.id)} className="gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto text-[10px] uppercase text-muted-foreground">{c.platform}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
