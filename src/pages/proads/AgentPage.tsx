import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Paperclip,
  Search,
  Star,
  Trash2,
  Plus,
  Wrench,
  StopCircle,
  Eraser,
  ChevronDown,
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
import { conversations } from "@/mocks/data";
import { aiAgentService } from "@/services";
import type { AgentMessage, AgentRole } from "@/types/proads";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const agentLabels: Record<AgentRole, string> = {
  director: "Diretor de Marketing",
  researcher: "Pesquisador",
  strategist: "Estrategista",
  copywriter: "Copywriter",
  creative_director: "Diretor Criativo",
  media_buyer: "Media Buyer",
  analyst: "Analista",
  auditor: "Auditor",
};

const suggestions = [
  "Analise minhas campanhas",
  "Crie uma nova campanha",
  "Gere novos criativos",
  "Pesquise meus concorrentes",
  "Encontre anúncios com CPL alto",
];

export default function AgentPage() {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "m0",
      role: "assistant",
      agent: "director",
      content:
        "Olá, Rafael! 👋\n\nComo posso te ajudar a criar campanhas de alto desempenho hoje?",
      createdAt: new Date().toISOString(),
      status: "sent",
    },
  ]);
  const [input, setInput] = useState("");
  const [agent, setAgent] = useState<AgentRole>("director");
  const [loading, setLoading] = useState(false);
  const [activeConv, setActiveConv] = useState(conversations[0].id);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: AgentMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    const reply = await aiAgentService.send({ conversationId: activeConv, content: text });
    setMessages((m) => [...m, { ...reply, agent }]);
    setLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader
        title="Agente IA"
        description="Converse com agentes especializados que executam pesquisas, criam campanhas e otimizam resultados."
        actions={
          <Select value={agent} onValueChange={(v) => setAgent(v as AgentRole)}>
            <SelectTrigger className="h-9 w-[220px] gap-2 bg-card">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(agentLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:p-6 lg:grid-cols-[260px_1fr_280px]">
        {/* Conversations */}
        <Card className="hidden flex-col shadow-card lg:flex">
          <div className="border-b border-border p-3">
            <Button size="sm" className="w-full gap-2 bg-gradient-brand text-primary-foreground">
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
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveConv(c.id)}
                  className={cn(
                    "group mb-1 flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs transition-colors",
                    activeConv === c.id ? "bg-gradient-brand-soft" : "hover:bg-secondary",
                  )}
                >
                  <Star
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      c.favorite ? "fill-accent text-accent" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">{c.messagesCount} mensagens</p>
                  </div>
                  <Trash2 className="hidden h-3.5 w-3.5 text-muted-foreground hover:text-destructive group-hover:block" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat */}
        <Card className="flex min-h-0 flex-col overflow-hidden shadow-card">
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl space-y-6 p-6">
              {messages.map((m) => (
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

          {messages.length <= 1 && (
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="min-h-[52px] resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <div className="flex items-center gap-1 border-t border-border pt-2">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4" /></Button>
                <Select defaultValue="gpt-5.5">
                  <SelectTrigger className="h-8 gap-1 border-0 bg-transparent text-xs shadow-none hover:bg-secondary">
                    <SelectValue />
                    <ChevronDown className="h-3 w-3" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5.5">GPT-5.5</SelectItem>
                    <SelectItem value="claude">Claude Sonnet 4.5</SelectItem>
                    <SelectItem value="gemini">Gemini 3 Pro</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setMessages([messages[0]])}>
                  <Eraser className="h-3.5 w-3.5" /> Limpar
                </Button>
                {loading && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-destructive" onClick={() => setLoading(false)}>
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
              O Assistente pode cometer erros. Sempre revise as sugestões.
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
              <ContextItem label="Conta de anúncios" value="ProMonitor — Meta BR" />
              <ContextItem label="Empresa" value="ProMonitor" />
              <ContextItem label="Orçamento permitido" value="R$ 50.000/mês" />
              <ContextItem label="Modo de autonomia" value="Operação supervisionada" />
              <ContextItem label="Modelo" value="GPT-5.5" />
              <ContextItem label="Memória ativa" value="12 fatos · 4 preferências" />
              <Separator />
              <div>
                <p className="mb-2 font-semibold text-foreground">Ferramentas disponíveis</p>
                <div className="flex flex-wrap gap-1.5">
                  {["campaigns.read", "campaigns.write", "creatives.generate", "audience.build", "web.search", "analytics.query"].map((t) => (
                    <Badge key={t} variant="outline" className="gap-1 border-border text-[10px] font-normal">
                      <Wrench className="h-2.5 w-2.5" />
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-1 font-semibold text-foreground">Ações pendentes</p>
                <p className="text-muted-foreground">2 aprovações aguardando decisão.</p>
              </div>
              <ContextItem label="Custo estimado da tarefa" value="≈ $ 0,024" />
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

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          isUser ? "bg-secondary text-foreground" : "bg-gradient-brand text-white",
        )}
      >
        {isUser ? "RG" : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[85%] space-y-2", isUser && "items-end text-right")}>
        {!isUser && message.agent && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            {agentLabels[message.agent]}
          </p>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
          )}
        >
          {message.content}
        </div>
        {message.toolsUsed?.length ? (
          <div className="flex flex-wrap gap-1">
            {message.toolsUsed.map((t) => (
              <Badge key={t.id} variant="outline" className="gap-1 text-[10px]">
                <Wrench className="h-2.5 w-2.5" /> {t.tool}
              </Badge>
            ))}
          </div>
        ) : null}
        {message.actions?.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.actions.map((a, i) => (
              <Button
                key={i}
                size="sm"
                variant={a.kind === "primary" ? "default" : a.kind === "secondary" ? "outline" : "ghost"}
                className={cn("h-7 text-xs", a.kind === "primary" && "bg-gradient-brand text-primary-foreground")}
                onClick={() => toast.success(`${a.label} — simulação`)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
