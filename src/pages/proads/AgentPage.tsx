import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Search,
  Star,
  Trash2,
  Plus,
  Wrench,
  StopCircle,
  Eraser,
  ImageIcon,
  MessageSquare,
  Bot,
} from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  loadCurrentId,
  loadThreads,
  saveCurrentId,
  saveThreads,
  type AgentThread,
} from "@/lib/agent-storage";
import type { AgentMessage } from "@/types/proads";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const suggestions = [
  "Analise minhas campanhas Meta",
  "Crie um plano de mídia para lançar um produto novo",
  "Gere um criativo de anúncio para um SaaS de gestão de obras",
  "Pesquise 3 concorrentes fortes no meu nicho",
  "Escreva uma copy de headline para tráfego frio",
];

export default function AgentPage() {
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
  const [forceImage, setForceImage] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  useEffect(() => {
    if (active) saveCurrentId(active.id);
  }, [active?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, loading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

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

  const send = async (text: string) => {
    if (!text.trim() || loading || !active) return;
    const userMsg: AgentMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    const isFirst = active.messages.length <= 1;
    updateThread(active.id, (t) => ({
      ...t,
      messages: [...t.messages, userMsg],
      title: isFirst ? text.slice(0, 60) : t.title,
      updatedAt: new Date().toISOString(),
    }));
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...active.messages, userMsg]
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.imageUrl
            ? `${m.content}\n[imagem gerada anteriormente]`
            : m.content,
        }));

      const { data, error } = await supabase.functions.invoke("nanogpt-chat", {
        body: {
          messages: history,
          textModel,
          imageModel,
          mode: forceImage ? "image" : "auto",
          prompt: forceImage ? text : undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const replyMsg: AgentMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        agent: data?.image ? "creative_director" : "director",
        content:
          data?.text ||
          (data?.image
            ? "Aqui está o criativo que preparei:"
            : "(sem resposta)"),
        createdAt: new Date().toISOString(),
        status: "sent",
        imageUrl: data?.image?.url,
        modelUsed: data?.image && !data?.text ? imageModel : textModel,
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

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader
        title="Agente IA"
        description="Time de agentes ProAds com memória persistente. Cérebro: NanoGPT."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={textModel} onValueChange={setTextModel}>
              <SelectTrigger className="h-9 w-[220px] gap-2 bg-card">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={imageModel} onValueChange={setImageModel}>
              <SelectTrigger className="h-9 w-[200px] gap-2 bg-card">
                <ImageIcon className="h-3.5 w-3.5 text-accent" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
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
            <Button
              size="sm"
              onClick={newThread}
              className="w-full gap-2 bg-gradient-brand text-primary-foreground"
            >
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
                    activeId === c.id
                      ? "bg-gradient-brand-soft"
                      : "hover:bg-secondary",
                  )}
                >
                  <button
                    onClick={() => setActiveId(c.id)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {c.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.messages.length} mensagens
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteThread(c.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Excluir conversa"
                  >
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
                <MessageBubble key={m.id} message={m} />
              ))}
              {loading && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-2xl bg-secondary px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
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
            <div className="rounded-xl border border-border bg-card p-2 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  forceImage
                    ? "Descreva a imagem que quer gerar..."
                    : "Digite sua mensagem... (peça uma imagem que ela é gerada junto)"
                }
                className="min-h-[52px] resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <div className="flex items-center gap-1 border-t border-border pt-2">
                <Button
                  variant={forceImage ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-xs",
                    forceImage &&
                      "bg-accent text-accent-foreground hover:bg-accent/90",
                  )}
                  onClick={() => setForceImage((v) => !v)}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  {forceImage ? "Modo imagem" : "Só imagem"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => {
                    if (!active) return;
                    updateThread(active.id, (t) => ({
                      ...t,
                      messages: t.messages.slice(0, 1),
                    }));
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
              Cérebro: NanoGPT · Texto: {textModel} · Imagem: {imageModel}
            </p>
          </div>
        </Card>

        {/* Context panel */}
        <Card className="hidden flex-col shadow-card lg:flex">
          <div className="border-b border-border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Contexto
            </p>
            <p className="mt-0.5 font-display text-sm font-bold">Sessão atual</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 text-xs">
              <ContextItem
                label="Conversa"
                value={active?.title ?? "—"}
              />
              <ContextItem
                label="Mensagens"
                value={`${active?.messages.length ?? 0} nesta sessão`}
              />
              <ContextItem
                label="Total de conversas"
                value={`${threads.length} salvas localmente`}
              />
              <ContextItem label="Modelo texto" value={textModel} />
              <ContextItem label="Modelo imagem" value={imageModel} />
              <Separator />
              <div>
                <p className="mb-2 font-semibold text-foreground">
                  Agentes disponíveis
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "conversa",
                    "pesquisa",
                    "estratégia",
                    "copywriting",
                    "criativo (imagem)",
                    "analytics",
                  ].map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="gap-1 border-border text-[10px] font-normal"
                    >
                      <Wrench className="h-2.5 w-2.5" />
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-1 font-semibold text-foreground">Memória</p>
                <p className="text-muted-foreground">
                  Persistente por sessão neste navegador (localStorage). Cada
                  conversa mantém o histórico completo enviado ao modelo.
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
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

const agentLabels: Record<string, string> = {
  director: "Diretor de Marketing",
  researcher: "Pesquisador",
  strategist: "Estrategista",
  copywriter: "Copywriter",
  creative_director: "Diretor Criativo",
  media_buyer: "Media Buyer",
  analyst: "Analista",
  auditor: "Auditor",
};

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          isUser
            ? "bg-secondary text-foreground"
            : "bg-gradient-brand text-white",
        )}
      >
        {isUser ? "GA" : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] space-y-2",
          isUser && "items-end text-right",
        )}
      >
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
        {message.imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <img
              src={message.imageUrl}
              alt="Criativo gerado"
              className="h-auto w-full max-w-md"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}
