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
  CalendarPlus,
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
import { loadAiSettings } from "@/lib/aiSettings";
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
import brandLogo from "@/assets/brand-logo.png";
import { useMetaAgentContext } from "@/hooks/useMetaAgentContext";
import { saveAiCreative, useMetaCampaigns } from "@/hooks/useMetaData";
import { signedCreativeUrl } from "@/lib/creative-library";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";

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
  { value: "google/gemini-omni-flash", label: "Gemini Omni Flash" },
  { value: "veo3-video", label: "Veo 3" },
  { value: "kling-v26-pro", label: "Kling 2.6 Pro" },
  { value: "seedance-video", label: "Seedance" },
];

const suggestions = [
  "Analise minhas campanhas Meta",
  "Crie um criativo em vídeo com narração sobre a Obras Timelapse",
  "Gere um anúncio de imagem com nossa logo",
  "Faça um vídeo curto 9:16 para reels",
  "Pesquise 3 concorrentes fortes no meu nicho",
];

type MediaRequest =
  | { type: "image"; prompt: string }
  | { type: "video"; prompt: string }
  | { type: "ad_video"; prompt?: string; script: string; visual: string };

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
    { agent: "strategist", label: "Estrategista definindo ângulo e público…" },
    { agent: "copywriter", label: "Roteirista escrevendo a narração…" },
    { agent: "creative_director", label: "Diretor de Arte criando o frame-âncora…" },
    { agent: "creative_director", label: "HappyHorse 1.1 renderizando o vídeo…" },
    { agent: "creative_director", label: "Renderizando movimento e transições…" },
    { agent: "media_buyer", label: "Media Buyer preparando entrega…" },
  ],
};

function detectIntent(text: string, forced?: "image" | "video"): "chat" | "image" | "video" {
  if (forced) return forced;
  const t = text.toLowerCase();
  if (/\b(v[íi]deo|reels?|film[ea]|animaç[ãa]o|narra[çc][ãa]o|roteiro|storyboard)\b/.test(t)) return "video";
  if (/\b(imagem|criativo|an[úu]ncio|foto|banner|mockup|arte|design)\b/.test(t)) return "image";
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
  const [textModel, setTextModel] = useState(() => loadAiSettings().textModel);
  const [imageModel, setImageModel] = useState(() => loadAiSettings().imageModel);
  const [videoModel, setVideoModel] = useState(() => loadAiSettings().videoModel);
  const [forceMode, setForceMode] = useState<"auto" | "image" | "video">("auto");
  const [useBrandLogo, setUseBrandLogo] = useState(true);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [statusStep, setStatusStep] = useState(0);
  const [statusIntent, setStatusIntent] = useState<"chat" | "image" | "video">("chat");
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const metaContext = useMetaAgentContext();
  const metaCampaigns = useMetaCampaigns({ status: "ACTIVE" });
  const campaignOptions = metaCampaigns.data?.campaigns ?? [];
  const { activeOrg } = useOrganization();
  const { user } = useAuth();

  const persistAiImages = (
    images?: { url: string; label?: string; aspect?: string; storage_path?: string }[] | null,
  ) => {
    if (!activeOrg?.id || !images?.length) return;
    void Promise.allSettled(
      images.map((img, i) =>
        saveAiCreative({
          organizationId: activeOrg.id,
          name: img.label || `Criativo IA ${img.aspect || ""}`.trim() || `Criativo IA ${i + 1}`,
          thumbnailUrl: img.url,
          mediaUrl: img.url,
          storagePath: img.storage_path ?? null,
          mimeType: "image/png",
          type: "image",
          userId: user?.id ?? null,
        }),
      ),
    ).then((results) => {
      const ok = results.filter((r) => r.status === "fulfilled").length;
      if (ok > 0) toast.success(`${ok} criativo(s) salvos na biblioteca`);
    });
  };

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

  // Rotate status + elapsed timer while loading
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now();
    const steps = STATUS_BY_INTENT[statusIntent];
    const rot = setInterval(() => setStatusStep((s) => (s + 1) % steps.length), 1600);
    const tick = setInterval(
      () => setElapsed(Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)),
      500,
    );
    return () => {
      clearInterval(rot);
      clearInterval(tick);
    };
  }, [loading, statusIntent]);

  // Poll pending video jobs across all threads
  useEffect(() => {
    const pending: { threadId: string; msgId: string; runId: string }[] = [];
    threads.forEach((t) => {
      t.messages.forEach((m) => {
        if (m.videoJob && !m.videoUrl && m.videoStatus !== "failed") {
          pending.push({ threadId: t.id, msgId: m.id, runId: m.videoJob.runId });
        }
      });
    });
    if (!pending.length) return;

    let cancelled = false;
    const poll = async () => {
      for (const p of pending) {
        try {
          const { data, error } = await supabase.functions.invoke("nanogpt-video-status", {
            body: { runId: p.runId, organization_id: activeOrg?.id },
          });
          if (cancelled) return;
          if (error) continue;
          const s = data?.status as string | undefined;
          setThreads((prev) =>
            prev.map((t) =>
              t.id !== p.threadId
                ? t
                : {
                    ...t,
                    messages: t.messages.map((m) => {
                      if (m.id !== p.msgId) return m;
                      if (s === "completed" && data?.videoUrl) {
                        return {
                          ...m,
                          videoUrl: data.videoUrl,
                          videoStoragePath: data.storage_path ?? m.videoStoragePath,
                          videoStatus: "completed",
                          videoProgress: 100,
                          content: m.content.replace(
                            /Job de vídeo enviado[^\n]*/,
                            "Vídeo pronto:",
                          ),
                        };
                      }
                      if (s === "failed") {
                        return {
                          ...m,
                          videoStatus: "failed",
                          videoError: data?.error ?? "Falha desconhecida",
                        };
                      }
                      return {
                        ...m,
                        videoStatus: (s as any) ?? "processing",
                        videoProgress: data?.progress ?? m.videoProgress ?? null,
                      };
                    }),
                  },
            ),
          );
          if (s === "completed") toast.success("Vídeo pronto");
          if (s === "failed") toast.error(`Vídeo falhou: ${data?.error ?? ""}`);
        } catch {
          /* keep polling */
        }
      }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [threads, activeOrg?.id]);

  const updateThread = (id: string, patch: (t: AgentThread) => AgentThread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? patch(t) : t)));
  };

  const updateMessage = (threadId: string, messageId: string, patch: (m: AgentMessage) => AgentMessage) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id !== threadId
          ? t
          : {
              ...t,
              updatedAt: new Date().toISOString(),
              messages: t.messages.map((m) => (m.id === messageId ? patch(m) : m)),
            },
      ),
    );
  };

  const startMediaJob = async ({
    threadId,
    messageId,
    request,
    attachmentUrls,
    brandOn,
  }: {
    threadId: string;
    messageId: string;
    request: MediaRequest;
    attachmentUrls: string[];
    brandOn: boolean;
  }) => {
    updateMessage(threadId, messageId, (m) => ({
      ...m,
      generationStatus: "processing",
      generationStartedAt: m.generationStartedAt ?? new Date().toISOString(),
    }));

    try {
      const body: Record<string, unknown> = {
        textModel,
        imageModel,
        videoModel,
        useBrandLogo: brandOn,
        attachments: attachmentUrls,
        metaContext,
        organization_id: activeOrg?.id,
      };

      if (request.type === "image") {
        body.mode = "image";
        body.prompt = request.prompt;
      } else if (request.type === "video") {
        body.mode = "video";
        body.prompt = request.prompt;
      } else {
        body.mode = "ad_video";
        body.prompt = request.visual;
        body.script = request.script;
        body.visual = request.visual;
      }

      const { data, error } = await supabase.functions.invoke("nanogpt-chat", { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      updateMessage(threadId, messageId, (m) => {
        const nextText = data?.text && !m.content.includes(data.text) ? `${m.content}\n\n${data.text}`.trim() : m.content;
        const hasVideo = !!(data?.videoJob || data?.videoUrl);
        const hasImages = !!data?.images?.length;
        return {
          ...m,
          agent: hasVideo || hasImages ? "creative_director" : m.agent,
          content:
            nextText ||
            (data?.videoJob
              ? "Job de vídeo enviado. Renderizando abaixo — pode levar 1–4 min."
              : data?.images?.length
                ? "Aqui estão as variantes prontas para Facebook Ads:"
                : m.content),
          status: "sent",
          generationStatus: "completed",
          images: data?.images ?? m.images,
          videoUrl: data?.videoUrl ?? m.videoUrl,
          videoJob: data?.videoJob ?? m.videoJob,
          videoStatus: data?.videoJob ? "queued" : m.videoStatus,
          videoStartedAt: data?.videoJob ? new Date().toISOString() : m.videoStartedAt,
          phases: data?.phases ?? m.phases,
          modelUsed: hasVideo ? videoModel : hasImages ? imageModel : m.modelUsed,
        };
      });
      if (data?.images?.length) persistAiImages(data.images);
    } catch (err: any) {
      updateMessage(threadId, messageId, (m) => ({
        ...m,
        agent: "auditor",
        status: "error",
        generationStatus: "failed",
        content: `${m.content}\n\n⚠️ Falha na tarefa de mídia: ${err?.message ?? "erro desconhecido"}`.trim(),
      }));
      toast.error("Falha na tarefa de mídia");
    }
  };

  const startOrchestrationJob = async ({
    threadId,
    messageId,
    history,
    attachmentUrls,
    brandOn,
  }: {
    threadId: string;
    messageId: string;
    history: { role: "user" | "assistant"; content: string }[];
    attachmentUrls: string[];
    brandOn: boolean;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke("nanogpt-chat", {
        body: {
          messages: history,
          textModel,
          imageModel,
          videoModel,
          mode: "auto",
          useBrandLogo: brandOn,
          attachments: attachmentUrls,
          deferMedia: true,
          metaContext,
          organization_id: activeOrg?.id,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const mediaRequest = data?.mediaRequest as MediaRequest | undefined;
      updateMessage(threadId, messageId, (m) => ({
        ...m,
        agent: mediaRequest || data?.images?.length || data?.videoJob ? "creative_director" : "director",
        content: data?.text || m.content,
        status: "sent",
        generationStatus: mediaRequest ? "processing" : "completed",
        phases: data?.phases ?? m.phases,
        images: data?.images ?? m.images,
        videoJob: data?.videoJob ?? m.videoJob,
        videoUrl: data?.videoUrl ?? m.videoUrl,
        videoStatus: data?.videoJob ? "queued" : m.videoStatus,
        videoStartedAt: data?.videoJob ? new Date().toISOString() : m.videoStartedAt,
        modelUsed: data?.videoJob || data?.videoUrl ? videoModel : mediaRequest || data?.images?.length ? imageModel : textModel,
      }));
      if (data?.images?.length) persistAiImages(data.images);

      if (mediaRequest) {
        void startMediaJob({ threadId, messageId, request: mediaRequest, attachmentUrls, brandOn });
      }
    } catch (err: any) {
      updateMessage(threadId, messageId, (m) => ({
        ...m,
        agent: "auditor",
        status: "error",
        generationStatus: "failed",
        content: `⚠️ Falha ao chamar o modelo: ${err?.message ?? "erro desconhecido"}`,
      }));
      toast.error("Falha na chamada do agente");
    }
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

      if (forceMode !== "auto") {
        const replyId = `a_${Date.now()}`;
        const request: MediaRequest = { type: forceMode, prompt: text };
        const replyMsg: AgentMessage = {
          id: replyId,
          role: "assistant",
          agent: "creative_director",
          content:
            forceMode === "image"
              ? "Tarefa criada. Diretor de Arte gerando as variantes 1:1 e 9:16 em segundo plano."
              : "Tarefa criada. HappyHorse 1.1 vai receber o job e eu acompanho o status aqui.",
          createdAt: new Date().toISOString(),
          status: "sent",
          generationStatus: "queued",
          generationStartedAt: new Date().toISOString(),
          phases: STATUS_BY_INTENT[forceMode],
          modelUsed: forceMode === "image" ? imageModel : videoModel,
        };
        updateThread(active.id, (t) => ({
          ...t,
          messages: [...t.messages, replyMsg],
          updatedAt: new Date().toISOString(),
        }));
        void startMediaJob({ threadId: active.id, messageId: replyId, request, attachmentUrls, brandOn });
        return;
      }

      if (intent !== "chat") {
        const replyId = `a_${Date.now()}`;
        const replyMsg: AgentMessage = {
          id: replyId,
          role: "assistant",
          agent: intent === "video" ? "strategist" : "creative_director",
          content:
            intent === "video"
              ? "Tarefa criada. Analisando solicitação, estruturando roteiro e preparando o fluxo de vídeo."
              : "Tarefa criada. Analisando solicitação e preparando o briefing visual antes da geração.",
          createdAt: new Date().toISOString(),
          status: "sent",
          generationStatus: "processing",
          generationStartedAt: new Date().toISOString(),
          phases: STATUS_BY_INTENT[intent],
          modelUsed: intent === "video" ? videoModel : imageModel,
        };
        updateThread(active.id, (t) => ({
          ...t,
          messages: [...t.messages, replyMsg],
          updatedAt: new Date().toISOString(),
        }));
        void startOrchestrationJob({
          threadId: active.id,
          messageId: replyId,
          history,
          attachmentUrls,
          brandOn,
        });
        return;
      }

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
          deferMedia: true,
          metaContext,
          organization_id: activeOrg?.id,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const mediaRequest = data?.mediaRequest as MediaRequest | undefined;
      const hasVisual = !!(mediaRequest || data?.images?.length || data?.videoUrl || data?.videoJob);
      const replyMsg: AgentMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        agent: hasVisual ? "creative_director" : "director",
        content:
          data?.text ||
          (data?.videoJob
            ? "Job de vídeo enviado. Renderizando abaixo — pode levar 1–4 min."
            : data?.images?.length
              ? "Aqui estão as duas variantes prontas para Facebook Ads:"
              : data?.videoUrl
                ? "Aqui está o vídeo que preparei:"
                : "(sem resposta)"),
        createdAt: new Date().toISOString(),
        status: "sent",
        generationStatus: mediaRequest ? "queued" : undefined,
        generationStartedAt: mediaRequest ? new Date().toISOString() : undefined,
        images: data?.images,
        videoUrl: data?.videoUrl,
        videoJob: data?.videoJob,
        videoStatus: data?.videoJob ? "queued" : undefined,
        videoStartedAt: data?.videoJob ? new Date().toISOString() : undefined,
        phases: data?.phases,
        modelUsed: data?.videoJob || data?.videoUrl ? videoModel : hasVisual ? imageModel : textModel,
      };

      updateThread(active.id, (t) => ({
        ...t,
        messages: [...t.messages, replyMsg],
        updatedAt: new Date().toISOString(),
      }));
      if (data?.images?.length) persistAiImages(data.images);
      if (mediaRequest) {
        void startMediaJob({
          threadId: active.id,
          messageId: replyMsg.id,
          request: mediaRequest,
          attachmentUrls,
          brandOn,
        });
      }
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
      const c = campaignOptions.find((x) => x.id === target);
      toast.success(`Criativo anexado a "${c?.name ?? target}"`);
      navigate(`/campanhas/${target}`);
    }
  };

  const useInPost = (imgUrl: string, storagePath?: string, label?: string) => {
    try {
      sessionStorage.setItem(
        "proads:pending-post-media",
        JSON.stringify({
          url: imgUrl,
          storagePath: storagePath ?? null,
          label: label || "Criativo do Agente IA",
          type: "image",
        }),
      );
    } catch {/* ignore */}
    toast.success("Criativo enviado para um novo post");
    navigate("/conteudo/novo?generated=1");
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
                <MessageBubble
                  key={m.id}
                  message={m}
                  onUseInCampaign={useInCampaign}
                  onUseInPost={useInPost}
                  campaigns={campaignOptions}
                />
              ))}
              {loading && (
                <WorkingIndicator
                  agent={currentStatus.agent}
                  label={currentStatus.label}
                  steps={STATUS_BY_INTENT[statusIntent]}
                  current={statusStep}
                  elapsed={elapsed}
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
  elapsed,
}: {
  agent: AgentRole;
  label: string;
  steps: { agent: AgentRole; label: string }[];
  current: number;
  elapsed: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
        <Sparkles className="h-4 w-4 text-white" />
        <span className="absolute -inset-0.5 animate-ping rounded-lg bg-primary/30" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            {agentLabels[agent]}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
          </p>
        </div>
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
          <ol className="mt-3 space-y-1">
            {steps.map((s, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-2 text-[11px] transition-colors",
                  i < current
                    ? "text-muted-foreground line-through decoration-primary/40"
                    : i === current
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i < current ? "bg-primary" : i === current ? "bg-primary animate-pulse" : "bg-primary/20",
                  )}
                />
                {agentLabels[s.agent]} — {s.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onUseInCampaign,
  onUseInPost,
  campaigns,
}: {
  message: AgentMessage;
  onUseInCampaign: (url: string, target: "new" | string) => void;
  onUseInPost: (url: string, storagePath?: string, label?: string) => void;
  campaigns: { id: string; name: string }[];
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

        {!isUser && message.generationStatus && message.generationStatus !== "completed" && !message.videoJob && !message.images?.length && (
          <GenerationJobCard
            status={message.generationStatus}
            phases={message.phases}
            startedAt={message.generationStartedAt}
          />
        )}

        {!isUser && message.phases && message.phases.length > 0 && message.generationStatus === "completed" && (
          <AgentPhases phases={message.phases} />
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
          <ImageResult
            url={message.imageUrl}
            label="Criativo"
            onUseInCampaign={onUseInCampaign}
            onUseInPost={onUseInPost}
            campaigns={campaigns}
          />
        )}

        {/* Image pair */}
        {message.images && message.images.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {message.images.map((img, i) => (
              <ImageResult
                key={i}
                url={img.url}
                storagePath={img.storage_path}
                label={img.label ?? img.format}
                onUseInCampaign={onUseInCampaign}
                onUseInPost={onUseInPost}
                campaigns={campaigns}
              />
            ))}
          </div>
        )}

        {/* Video pending job */}
        {message.videoJob && !message.videoUrl && (
          <VideoJobCard
            model={message.videoJob.model}
            status={message.videoStatus ?? "queued"}
            progress={message.videoProgress ?? null}
            error={message.videoError}
            startedAt={message.videoStartedAt}
          />
        )}

        {/* Video */}
        {message.videoUrl && (
          <VideoResult url={message.videoUrl} storagePath={message.videoStoragePath} />
        )}
      </div>
    </div>
  );
}

function VideoResult({ url, storagePath }: { url: string; storagePath?: string }) {
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [mediaError, setMediaError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAttempted = useRef(false);

  useEffect(() => {
    setResolvedUrl(url);
    setMediaError(false);
    refreshAttempted.current = false;
  }, [url]);

  const recoverMedia = async (force = false) => {
    if (!storagePath || refreshing || (refreshAttempted.current && !force)) {
      setMediaError(true);
      return;
    }
    refreshAttempted.current = true;
    setRefreshing(true);
    const refreshed = await signedCreativeUrl(storagePath);
    setRefreshing(false);
    if (refreshed) {
      setResolvedUrl(refreshed);
      setMediaError(false);
    } else {
      setMediaError(true);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {mediaError ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
          <Film className="h-8 w-8 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">
            Este vídeo expirou ou não pôde ser carregado.
          </p>
          {storagePath && (
            <Button size="sm" variant="outline" disabled={refreshing} onClick={() => void recoverMedia(true)}>
              {refreshing ? "Atualizando…" : "Tentar novamente"}
            </Button>
          )}
        </div>
      ) : (
        <video
          src={resolvedUrl}
          controls
          preload="metadata"
          className="h-auto w-full max-w-md bg-black"
          onError={() => void recoverMedia()}
        />
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border p-2">
        <span className="text-[11px] text-muted-foreground">Vídeo gerado</span>
        <a
          href={resolvedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          <Download className="h-3 w-3" /> Baixar
        </a>
      </div>
    </div>
  );
}

function ImageResult({
  url,
  storagePath,
  label,
  onUseInCampaign,
  onUseInPost,
  campaigns,
}: {
  url: string;
  storagePath?: string;
  label: string;
  onUseInCampaign: (url: string, target: "new" | string) => void;
  onUseInPost: (url: string, storagePath?: string, label?: string) => void;
  campaigns: { id: string; name: string }[];
}) {
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [mediaError, setMediaError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAttempted = useRef(false);
  const isVertical = /9:16|story|reel/i.test(label);
  const aspectClass = isVertical ? "aspect-[9/16]" : "aspect-square";

  useEffect(() => {
    setResolvedUrl(url);
    setMediaError(false);
    refreshAttempted.current = false;
  }, [url]);

  const recoverMedia = async (force = false) => {
    if (!storagePath || refreshing || (refreshAttempted.current && !force)) {
      setMediaError(true);
      return;
    }
    refreshAttempted.current = true;
    setRefreshing(true);
    const refreshed = await signedCreativeUrl(storagePath);
    setRefreshing(false);
    if (refreshed) {
      setResolvedUrl(refreshed);
      setMediaError(false);
    } else {
      setMediaError(true);
    }
  };

  return (
    <div className="self-start overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <Badge variant="outline" className="border-primary/30 bg-gradient-brand-soft text-[10px] font-semibold text-primary">
          {label}
        </Badge>
        <a href={resolvedUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Baixar">
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
      {mediaError ? (
        <div className={cn("flex w-full flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center", aspectClass)}>
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">
            Esta mídia expirou ou não pôde ser carregada.
          </p>
          {storagePath && (
            <Button size="sm" variant="outline" disabled={refreshing} onClick={() => void recoverMedia(true)}>
              {refreshing ? "Atualizando…" : "Tentar novamente"}
            </Button>
          )}
        </div>
      ) : (
        <div className={cn("relative w-full overflow-hidden bg-muted/30", aspectClass)}>
          <img
            src={resolvedUrl}
            alt={label}
            className="absolute inset-0 h-full w-full object-contain"
            loading="eager"
            decoding="async"
            onLoad={() => setMediaError(false)}
            onError={() => void recoverMedia()}
          />
        </div>
      )}
      <div className="space-y-2 border-t border-border p-2">
        <Button
          size="sm"
          className="w-full gap-1.5 bg-gradient-brand text-primary-foreground"
          onClick={() => onUseInPost(resolvedUrl, storagePath, label)}
          disabled={mediaError}
        >
          <CalendarPlus className="h-3.5 w-3.5" /> Usar em post
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="w-full gap-1.5">
              <Megaphone className="h-3.5 w-3.5" /> Usar em campanha
              <ChevronDown className="ml-auto h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={() => onUseInCampaign(resolvedUrl, "new")} className="gap-2">
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold">Criar nova campanha</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Anexar a existente
            </DropdownMenuLabel>
            {campaigns.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                Nenhuma campanha ativa na Meta
              </div>
            ) : (
              campaigns.slice(0, 6).map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => onUseInCampaign(resolvedUrl, c.id)} className="gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">meta</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function AgentPhases({ phases }: { phases: { label: string; agent: AgentRole }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Etapas executadas</p>
      <ol className="mt-2 space-y-1.5">
        {phases.map((phase, index) => (
          <li key={`${phase.agent}-${index}`} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
              {index + 1}
            </span>
            <span className="font-semibold text-foreground">{agentLabels[phase.agent]}</span>
            <span>— {phase.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GenerationJobCard({
  status,
  phases,
  startedAt,
}: {
  status: "queued" | "processing" | "failed";
  phases?: { label: string; agent: AgentRole }[];
  startedAt?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status === "failed") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const startMs = startedAt ? new Date(startedAt).getTime() : now;
  const secs = Math.max(0, Math.round((now - startMs) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const safePhases = phases?.length ? phases : STATUS_BY_INTENT.image;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        status === "failed" ? "border-destructive/40 bg-destructive/5" : "border-primary/20 bg-gradient-brand-soft",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className={cn("h-4 w-4", status === "failed" ? "text-destructive" : "text-primary")} />
          <p className={cn("text-sm font-semibold", status === "failed" ? "text-destructive" : "text-foreground")}>
            {status === "queued" ? "Tarefa criada — iniciando agentes…" : status === "processing" ? "Agentes trabalhando em segundo plano…" : "Tarefa interrompida"}
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">{mm}:{ss}</span>
      </div>
      {status !== "failed" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
        </div>
      )}
      <ol className="mt-3 space-y-1">
        {safePhases.map((phase, index) => (
          <li key={`${phase.agent}-${index}`} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-semibold text-foreground">{agentLabels[phase.agent]}</span>
            <span>— {phase.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VideoJobCard({
  model,
  status,
  progress,
  error,
  startedAt,
}: {
  model: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number | null;
  error?: string;
  startedAt?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);
  const startMs = startedAt ? new Date(startedAt).getTime() : now;
  const secs = Math.max(0, Math.round((now - startMs) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const pct = progress != null ? Math.max(0, Math.min(100, Math.round(progress))) : null;

  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <p className="font-semibold">⚠️ Vídeo falhou</p>
        <p className="mt-1 text-xs">{error ?? "Erro desconhecido"}</p>
      </div>
    );
  }

  const label =
    status === "queued"
      ? "Job na fila do NanoGPT…"
      : status === "processing"
        ? "Renderizando frames…"
        : "Finalizando…";

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-brand-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">{mm}:{ss}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-all",
            pct == null && "animate-pulse",
          )}
          style={{ width: pct != null ? `${pct}%` : "35%" }}
        />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Modelo: <span className="font-mono">{model}</span>
        {pct != null && <> · {pct}%</>}
        {" · "}vídeo assíncrono — você pode continuar conversando enquanto renderiza.
      </p>
    </div>
  );
}
