import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Clapperboard,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Palette,
  Rocket,
  Sparkles,
  Target,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EMPTY_WIZARD_ANSWERS,
  generateWizardPreview,
  joinWizardWaitlist,
  loadWizardSession,
  saveWizardSession,
  wizardErrorMessage,
  type WizardAnswers,
  type WizardFormat,
  type WizardObjective,
  type WizardPreview,
  type WizardStyle,
} from "@/lib/wizard";
import proadsWordmark from "@/assets/proads-sidebar-wordmark.png";
import { toast } from "sonner";

const LAST_FORM_STEP = 5;
const wizardInputClass = "border-white/10 bg-white/[0.06] text-white placeholder:text-white/25 focus-visible:ring-blue-400/40";

const objectiveOptions: Array<{
  value: WizardObjective;
  title: string;
  description: string;
  icon: typeof Target;
}> = [
  { value: "leads", title: "Gerar leads", description: "Captar contatos interessados", icon: Target },
  { value: "sales", title: "Vender agora", description: "Levar pessoas para a oferta", icon: Zap },
  { value: "whatsapp", title: "Conversas no WhatsApp", description: "Iniciar atendimentos", icon: MessageCircle },
  { value: "awareness", title: "Fortalecer a marca", description: "Ser lembrado pelo público", icon: Rocket },
];

const styleOptions: Array<{
  value: WizardStyle;
  title: string;
  description: string;
  swatch: string;
}> = [
  { value: "direct", title: "Direto e vendedor", description: "Contraste forte e oferta em destaque", swatch: "from-blue-500 to-violet-600" },
  { value: "premium", title: "Premium", description: "Editorial, sofisticado e aspiracional", swatch: "from-amber-300 to-amber-600" },
  { value: "ugc", title: "Autêntico / UGC", description: "Humano, natural e próximo", swatch: "from-rose-400 to-orange-400" },
  { value: "minimal", title: "Minimalista", description: "Limpo, elegante e objetivo", swatch: "from-slate-200 to-slate-500" },
];

const generationPhases = [
  "Entendendo sua oferta",
  "Escolhendo o melhor ângulo",
  "Escrevendo headline e copy",
  "Compondo o anúncio com IA",
  "Fazendo a revisão final",
];

export default function WizardPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const restored = useMemo(() => loadWizardSession(), []);
  const [step, setStep] = useState(restored?.preview ? 7 : 0);
  const [answers, setAnswers] = useState<WizardAnswers>(restored?.answers ?? EMPTY_WIZARD_ANSWERS);
  const [preview, setPreview] = useState<WizardPreview | null>(restored?.preview ?? null);
  const [generating, setGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [waitlistIntent, setWaitlistIntent] = useState<"pricing" | "video">("pricing");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step, generating]);

  useEffect(() => {
    if (!generating) return;
    const interval = window.setInterval(() => {
      setGenerationProgress((current) => Math.min(current + Math.max(1, (92 - current) * 0.08), 92));
      setGenerationPhase((current) => Math.min(current + 1, generationPhases.length - 1));
    }, 3_200);
    return () => window.clearInterval(interval);
  }, [generating]);

  const update = <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const canContinue = (() => {
    if (step === 1) return answers.businessName.trim().length >= 2 && answers.niche.trim().length >= 2;
    if (step === 2) return answers.offer.trim().length >= 5;
    if (step === 3) return answers.audience.trim().length >= 3;
    return true;
  })();

  const next = () => {
    if (!canContinue) {
      setError("Preencha os campos essenciais para continuar.");
      return;
    }
    setStep((current) => Math.min(current + 1, 6));
  };

  const generate = async () => {
    setGenerating(true);
    setGenerationPhase(0);
    setGenerationProgress(8);
    setError(null);
    saveWizardSession({ version: 1, answers, preview: null, completedAt: null });
    try {
      const result = await generateWizardPreview(answers);
      setGenerationProgress(100);
      setPreview(result);
      saveWizardSession({
        version: 1,
        answers,
        preview: result,
        completedAt: new Date().toISOString(),
      });
      window.setTimeout(() => {
        setGenerating(false);
        setStep(7);
      }, reduceMotion ? 100 : 650);
    } catch (generationError) {
      setGenerating(false);
      setError(wizardErrorMessage(generationError));
    }
  };

  const openWaitlist = (intent: "pricing" | "video") => {
    setWaitlistIntent(intent);
    setPricingOpen(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080512] text-white">
      <WizardBackdrop reducedMotion={!!reduceMotion} />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 md:px-8">
        <Link to="/wizard" aria-label="ProAds">
          <img src={proadsWordmark} alt="ProAds Marketing OS" className="h-11 w-auto max-w-[180px] object-contain object-left" />
        </Link>
        <Button variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={() => navigate("/login")}>
          Já tenho conta
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-7xl items-center px-4 pb-10 md:px-8">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          {step > 0 && step < 7 ? (
            <WizardRail current={step} />
          ) : (
            <div className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">ProAds Creative Sprint</p>
              <h2 className="mt-4 max-w-xs text-3xl font-semibold leading-tight text-white">
                Da ideia ao anúncio em poucos minutos.
              </h2>
              <div className="mt-6 space-y-3 text-sm text-white/60">
                <TrustLine>Briefing simples, sem termos técnicos</TrustLine>
                <TrustLine>Direção criativa pensada para Meta Ads</TrustLine>
                <TrustLine>Uma prévia gratuita por visitante</TrustLine>
              </div>
            </div>
          )}

          <section className="relative min-h-[610px] overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.065] shadow-2xl shadow-violet-950/40 backdrop-blur-2xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={generating ? "generating" : `step-${step}`}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 34, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -28, scale: 0.985 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[610px]"
              >
                {generating ? (
                  <GeneratingView
                    headingRef={headingRef}
                    phase={generationPhase}
                    progress={generationProgress}
                    format={answers.format}
                  />
                ) : step === 0 ? (
                  <IntroView headingRef={headingRef} onStart={() => setStep(1)} />
                ) : step === 1 ? (
                  <BrandStep headingRef={headingRef} answers={answers} update={update} />
                ) : step === 2 ? (
                  <OfferStep headingRef={headingRef} answers={answers} update={update} />
                ) : step === 3 ? (
                  <AudienceStep headingRef={headingRef} answers={answers} update={update} />
                ) : step === 4 ? (
                  <ObjectiveStep headingRef={headingRef} value={answers.objective} onChange={(value) => update("objective", value)} />
                ) : step === 5 ? (
                  <StyleStep
                    headingRef={headingRef}
                    style={answers.style}
                    format={answers.format}
                    onStyle={(value) => update("style", value)}
                    onFormat={(value) => update("format", value)}
                  />
                ) : step === 6 ? (
                  <ReviewStep headingRef={headingRef} answers={answers} error={error} onGenerate={() => void generate()} />
                ) : (
                  <ResultView
                    headingRef={headingRef}
                    preview={preview}
                    answers={answers}
                    onPricing={() => openWaitlist("pricing")}
                    onVideo={() => openWaitlist("video")}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {!generating && step > 0 && step < 6 && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-white/10 bg-[#0b0715]/80 px-5 py-4 backdrop-blur-xl md:px-8">
                <Button variant="ghost" className="gap-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setStep((current) => current - 1)}>
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <div className="text-xs text-white/40">{step} de {LAST_FORM_STEP}</div>
                <Button className="gap-2 bg-gradient-brand px-6 text-white shadow-brand" disabled={!canContinue} onClick={next}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>

      <PricingWaitlistDialog
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        intent={waitlistIntent}
        answers={answers}
      />
    </div>
  );
}

function WizardBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(37,99,235,0.20),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(124,58,237,0.22),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(168,85,247,0.13),transparent_42%)]" />
      <motion.div
        className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
        animate={reducedMotion ? undefined : { y: [0, -28, 0], x: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-20 bottom-12 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl"
        animate={reducedMotion ? undefined : { y: [0, 24, 0], x: [0, -24, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:42px_42px]" />
    </div>
  );
}

function WizardRail({ current }: { current: number }) {
  const labels = ["Sua marca", "Sua oferta", "Seu público", "Objetivo", "Estilo"];
  return (
    <aside className="hidden lg:block" aria-label="Progresso">
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">Seu anúncio</p>
      <ol className="space-y-2">
        {labels.map((label, index) => {
          const number = index + 1;
          const complete = current > number;
          const active = current === number;
          return (
            <li key={label} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 transition-colors", active && "bg-white/[0.08]")}>
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                complete ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" :
                  active ? "border-blue-400 bg-blue-500/20 text-blue-200" :
                    "border-white/10 text-white/35",
              )}>
                {complete ? <Check className="h-4 w-4" /> : number}
              </span>
              <span className={cn("text-sm", active ? "font-medium text-white" : complete ? "text-white/70" : "text-white/35")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function TrustLine({ children }: { children: ReactNode }) {
  return <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-300" />{children}</p>;
}

type HeadingRef = RefObject<HTMLHeadingElement>;
type UpdateAnswer = <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => void;

function StepShell({ eyebrow, title, description, headingRef, children }: {
  eyebrow: string;
  title: string;
  description: string;
  headingRef: HeadingRef;
  children: ReactNode;
}) {
  return (
    <div className="px-5 pb-28 pt-8 md:px-10 md:pt-10">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-white outline-none md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">{description}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function IntroView({ headingRef, onStart }: { headingRef: HeadingRef; onStart: () => void }) {
  return (
    <div className="grid min-h-[610px] items-center gap-8 px-6 py-10 md:grid-cols-[1.08fr_.92fr] md:px-12">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200">
          <Sparkles className="h-3.5 w-3.5" /> Sua primeira campanha começa aqui
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-4xl font-semibold leading-[1.08] text-white outline-none md:text-6xl">
          Crie um anúncio que parece feito por uma{" "}
          <span className="bg-gradient-to-r from-blue-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">agência.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-white/60">
          Responda cinco perguntas rápidas. A ProAds transforma suas respostas em estratégia, copy e uma peça pronta para Meta Ads.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button size="lg" className="h-12 gap-2 bg-gradient-brand px-7 text-white shadow-brand" onClick={onStart}>
            Criar minha prévia grátis <ArrowRight className="h-4 w-4" />
          </Button>
          <span className="text-xs text-white/40">Sem cartão · leva poucos minutos</span>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-sm">
        <div className="absolute -inset-5 rounded-[36px] bg-gradient-to-br from-blue-500/20 to-violet-500/20 blur-2xl" />
        <div className="relative rotate-2 overflow-hidden rounded-[28px] border border-white/15 bg-[#120c22] p-3 shadow-2xl">
          <div className="aspect-square rounded-[20px] bg-[radial-gradient(circle_at_65%_22%,rgba(96,165,250,.55),transparent_28%),linear-gradient(145deg,#17112b,#26134a_55%,#101936)] p-7">
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-widest text-white/70">Seu anúncio</span>
                <WandSparkles className="h-5 w-5 text-violet-200" />
              </div>
              <div>
                <p className="text-4xl font-bold leading-none">Ideia.</p>
                <p className="mt-1 text-4xl font-bold leading-none text-blue-300">Impacto.</p>
                <p className="mt-4 max-w-[220px] text-sm text-white/55">Uma direção criativa construída para o seu negócio.</p>
              </div>
              <div className="h-9 w-fit rounded-full bg-white px-5 py-2 text-xs font-semibold text-[#110921]">Saiba mais</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandStep({ headingRef, answers, update }: { headingRef: HeadingRef; answers: WizardAnswers; update: UpdateAnswer }) {
  return (
    <StepShell eyebrow="Passo 1 · Sua marca" title="Vamos começar pelo essencial." description="Não precisa usar linguagem de marketing. Conte como você explicaria seu negócio para um cliente." headingRef={headingRef}>
      <div className="grid gap-5 md:grid-cols-2">
        <WizardField label="Nome da empresa" hint="Como aparece para seus clientes?">
          <Input className={wizardInputClass} value={answers.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="Ex.: Clínica Aurora" autoFocus />
        </WizardField>
        <WizardField label="Segmento / nicho" hint="O que sua empresa faz?">
          <Input className={wizardInputClass} value={answers.niche} onChange={(event) => update("niche", event.target.value)} placeholder="Ex.: Estética facial" />
        </WizardField>
      </div>
    </StepShell>
  );
}

function OfferStep({ headingRef, answers, update }: { headingRef: HeadingRef; answers: WizardAnswers; update: UpdateAnswer }) {
  return (
    <StepShell eyebrow="Passo 2 · Sua oferta" title="O que você quer colocar na frente das pessoas?" description="Pode ser um produto, serviço, avaliação, orçamento ou condição especial." headingRef={headingRef}>
      <div className="space-y-5">
        <WizardField label="Oferta principal" hint="Seja concreto e evite promessas que não possa garantir.">
          <Textarea className={wizardInputClass} value={answers.offer} onChange={(event) => update("offer", event.target.value)} placeholder="Ex.: Avaliação personalizada para montar um protocolo de cuidados com a pele" rows={3} autoFocus />
        </WizardField>
        <WizardField label="Por que escolher você?" hint="Opcional, mas ajuda a IA a fugir do anúncio genérico.">
          <Input className={wizardInputClass} value={answers.differentiator} onChange={(event) => update("differentiator", event.target.value)} placeholder="Ex.: Atendimento individual e 8 anos de experiência" />
        </WizardField>
      </div>
    </StepShell>
  );
}

function AudienceStep({ headingRef, answers, update }: { headingRef: HeadingRef; answers: WizardAnswers; update: UpdateAnswer }) {
  return (
    <StepShell eyebrow="Passo 3 · Seu público" title="Quem precisa parar para ver este anúncio?" description="Quanto mais humano for o retrato, melhor será o ângulo criativo." headingRef={headingRef}>
      <div className="space-y-5">
        <WizardField label="Quem é essa pessoa?" hint="Momento de vida, perfil ou necessidade.">
          <Textarea className={wizardInputClass} value={answers.audience} onChange={(event) => update("audience", event.target.value)} placeholder="Ex.: Mulheres de 30 a 50 anos que querem cuidar da pele, mas têm pouco tempo" rows={3} autoFocus />
        </WizardField>
        <WizardField label="Qual dor ou desejo mais pesa?" hint="Opcional. Pense no que faz essa pessoa agir agora.">
          <Input className={wizardInputClass} value={answers.pain} onChange={(event) => update("pain", event.target.value)} placeholder="Ex.: Já tentou vários produtos sem resultado" />
        </WizardField>
      </div>
    </StepShell>
  );
}

function ObjectiveStep({ headingRef, value, onChange }: { headingRef: HeadingRef; value: WizardObjective; onChange: (value: WizardObjective) => void }) {
  return (
    <StepShell eyebrow="Passo 4 · Objetivo" title="O que este anúncio precisa fazer?" description="A resposta muda a headline, o CTA e a composição visual." headingRef={headingRef}>
      <div className="grid gap-3 md:grid-cols-2">
        {objectiveOptions.map((option) => (
          <ChoiceCard key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>
            <option.icon className="h-5 w-5 text-blue-300" />
            <div><p className="font-semibold">{option.title}</p><p className="mt-1 text-xs text-white/45">{option.description}</p></div>
          </ChoiceCard>
        ))}
      </div>
    </StepShell>
  );
}

function StyleStep({ headingRef, style, format, onStyle, onFormat }: {
  headingRef: HeadingRef;
  style: WizardStyle;
  format: WizardFormat;
  onStyle: (value: WizardStyle) => void;
  onFormat: (value: WizardFormat) => void;
}) {
  return (
    <StepShell eyebrow="Passo 5 · Direção criativa" title="Qual personalidade combina com sua marca?" description="Você receberá uma prévia no formato escolhido. Outros formatos e vídeo ficam disponíveis nos planos." headingRef={headingRef}>
      <div className="grid gap-3 md:grid-cols-2">
        {styleOptions.map((option) => (
          <ChoiceCard key={option.value} active={style === option.value} onClick={() => onStyle(option.value)}>
            <span className={cn("h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br", option.swatch)} />
            <div><p className="font-semibold">{option.title}</p><p className="mt-1 text-xs text-white/45">{option.description}</p></div>
          </ChoiceCard>
        ))}
      </div>
      <div className="mt-6">
        <Label className="text-sm text-white/70">Formato da prévia</Label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ChoiceCard active={format === "feed"} onClick={() => onFormat("feed")} compact>
            <span className="h-7 w-7 rounded-md border-2 border-white/60" /><span className="text-sm font-medium">Feed 1:1</span>
          </ChoiceCard>
          <ChoiceCard active={format === "story"} onClick={() => onFormat("story")} compact>
            <span className="h-8 w-5 rounded border-2 border-white/60" /><span className="text-sm font-medium">Story 9:16</span>
          </ChoiceCard>
        </div>
      </div>
    </StepShell>
  );
}

function ReviewStep({ headingRef, answers, error, onGenerate }: { headingRef: HeadingRef; answers: WizardAnswers; error: string | null; onGenerate: () => void }) {
  return (
    <div className="flex min-h-[610px] flex-col justify-center px-6 py-10 md:px-12">
      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10">
          <WandSparkles className="h-7 w-7 text-violet-200" />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-3xl font-semibold text-white outline-none md:text-4xl">Seu briefing está pronto.</h1>
        <p className="mt-3 text-white/55">Agora a IA vai transformar estratégia, copy e direção de arte em uma peça única para {answers.businessName}.</p>
      </div>
      <div className="mx-auto mt-8 grid w-full max-w-2xl gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm md:grid-cols-2">
        <BriefItem label="Oferta" value={answers.offer} />
        <BriefItem label="Público" value={answers.audience} />
        <BriefItem label="Objetivo" value={objectiveOptions.find((item) => item.value === answers.objective)?.title ?? answers.objective} />
        <BriefItem label="Formato" value={answers.format === "feed" ? "Feed 1:1" : "Story 9:16"} />
      </div>
      {error && <p role="alert" className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>}
      <div className="mt-7 flex flex-col items-center">
        <Button size="lg" className="h-13 gap-2 bg-gradient-brand px-8 text-white shadow-brand" onClick={onGenerate}>
          <Sparkles className="h-4 w-4" /> Gerar minha prévia grátis
        </Button>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-white/35"><LockKeyhole className="h-3 w-3" /> Uma geração por dispositivo; seus dados não são publicados.</p>
      </div>
    </div>
  );
}

function GeneratingView({ headingRef, phase, progress, format }: { headingRef: HeadingRef; phase: number; progress: number; format: WizardFormat }) {
  return (
    <div className="grid min-h-[610px] items-center gap-10 px-6 py-10 md:grid-cols-2 md:px-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300">A equipe de IA entrou em ação</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-semibold text-white outline-none md:text-4xl">Construindo seu anúncio…</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">Não feche esta página. A composição final pode levar um pouco mais de um minuto.</p>
        <div className="mt-8 space-y-4" aria-live="polite">
          {generationPhases.map((label, index) => (
            <div key={label} className={cn("flex items-center gap-3 text-sm transition-colors", index <= phase ? "text-white" : "text-white/25")}>
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border", index < phase ? "border-emerald-400/30 bg-emerald-400/15" : index === phase ? "border-violet-400/50 bg-violet-400/15" : "border-white/10")}>
                {index < phase ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : index === phase ? <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-200" /> : index + 1}
              </span>
              {label}
            </div>
          ))}
        </div>
        <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" animate={{ width: `${progress}%` }} /></div>
        <p className="mt-2 text-right text-xs text-white/35">{Math.round(progress)}%</p>
      </div>
      <div className={cn("relative mx-auto overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.06] p-3", format === "story" ? "w-[230px]" : "w-full max-w-sm")}>
        <div className={cn("relative overflow-hidden rounded-[19px] bg-[#130d22]", format === "story" ? "aspect-[9/16]" : "aspect-square")}>
          <motion.div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-fuchsia-500/20" animate={{ opacity: [0.45, 0.85, 0.45] }} transition={{ duration: 2.2, repeat: Infinity }} />
          <div className="absolute inset-x-6 bottom-7 space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/20" />
            <div className="h-8 w-full animate-pulse rounded bg-white/15" />
            <div className="h-8 w-4/5 animate-pulse rounded bg-white/10" />
          </div>
          <Sparkles className="absolute left-1/2 top-1/3 h-10 w-10 -translate-x-1/2 text-violet-200/70" />
        </div>
      </div>
    </div>
  );
}

function ResultView({ headingRef, preview, answers, onPricing, onVideo }: {
  headingRef: HeadingRef;
  preview: WizardPreview | null;
  answers: WizardAnswers;
  onPricing: () => void;
  onVideo: () => void;
}) {
  if (!preview) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(`${preview.headline}\n\n${preview.primary_text}\n\n${preview.cta}`);
    toast.success("Copy copiada");
  };
  return (
    <div className="grid min-h-[610px] gap-8 px-5 py-8 md:grid-cols-[minmax(280px,.9fr)_1.1fr] md:px-8">
      <div className={cn("relative mx-auto overflow-hidden rounded-[24px] border border-white/15 bg-black/30 shadow-2xl", answers.format === "story" ? "aspect-[9/16] h-[510px]" : "aspect-square w-full max-w-[480px] self-center")}>
        <img src={preview.image_url} alt={`Prévia de anúncio para ${answers.businessName}`} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <span className="rounded-full border border-white/20 bg-black/45 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75 backdrop-blur-md">Prévia ProAds</span>
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200">
          <BadgeCheck className="h-3.5 w-3.5" /> Sua primeira peça está pronta
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-3xl font-semibold text-white outline-none md:text-4xl">Agora imagine uma campanha inteira.</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">A prévia mostra a direção. No ProAds você cria variações, adapta formatos, gera vídeos e organiza tudo na galeria.</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs uppercase tracking-widest text-white/35">Headline</p>
          <p className="mt-1 text-lg font-semibold">{preview.headline}</p>
          <p className="mt-4 text-xs uppercase tracking-widest text-white/35">Texto principal</p>
          <p className="mt-1 text-sm leading-6 text-white/65">{preview.primary_text}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#110921]">{preview.cta}</span>
            <Button variant="ghost" size="sm" className="gap-2 text-white/55 hover:bg-white/10 hover:text-white" onClick={() => void copy()}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button className="h-11 gap-2 bg-gradient-brand text-white shadow-brand" onClick={onPricing}><Download className="h-4 w-4" /> Baixar sem marca</Button>
          <Button variant="outline" className="h-11 gap-2 border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white" onClick={onVideo}><Clapperboard className="h-4 w-4" /> Transformar em vídeo</Button>
        </div>
        <Button variant="link" className="mt-3 text-blue-300" asChild><Link to="/cadastro?source=wizard">Criar minha conta gratuita</Link></Button>
      </div>
    </div>
  );
}

function WizardField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-white/80">{label}</Label>
      {children}
      <p className="text-xs text-white/35">{hint}</p>
    </div>
  );
}

function ChoiceCard({ active, onClick, compact, children }: { active: boolean; onClick: () => void; compact?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        compact ? "p-3" : "p-4",
        active ? "border-blue-400/55 bg-blue-400/10 shadow-[0_0_0_1px_rgba(96,165,250,.12)]" : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.055]",
      )}
    >
      {children}
      {active && <Check className="ml-auto h-4 w-4 shrink-0 text-blue-300" />}
    </button>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] uppercase tracking-widest text-white/30">{label}</p><p className="mt-1 line-clamp-2 text-white/70">{value}</p></div>;
}

function PricingWaitlistDialog({ open, onOpenChange, intent, answers }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: "pricing" | "video";
  answers: WizardAnswers;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await joinWizardWaitlist({ name, email, whatsapp, intent, answers });
      setDone(true);
    } catch {
      toast.error("Não foi possível entrar na lista agora");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setDone(false); }}>
      <DialogContent className="max-w-2xl overflow-hidden border-white/10 bg-[#100a1c] text-white">
        {done ? (
          <div className="py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15"><Check className="h-7 w-7 text-emerald-300" /></div>
            <DialogTitle className="mt-5 text-2xl text-white">Você está na lista.</DialogTitle>
            <DialogDescription className="mt-2 text-white/50">Avisaremos quando os planos e a geração de vídeo forem liberados.</DialogDescription>
            <Button className="mt-6 bg-gradient-brand text-white" onClick={() => onOpenChange(false)}>Continuar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10"><Palette className="h-5 w-5 text-violet-200" /></div>
              <DialogTitle className="text-2xl text-white">{intent === "video" ? "Seja avisado sobre vídeos" : "Conheça os planos primeiro"}</DialogTitle>
              <DialogDescription className="text-white/50">
                Estamos abrindo as primeiras vagas. Entre na lista para receber os planos e condições de lançamento — sem cobrança agora.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <PlanPreview icon={ImageIcon} title="ProAds Criativo" items={["Variações de imagem", "Copy e formatos", "Galeria organizada"]} />
              <PlanPreview icon={Clapperboard} title="ProAds Vídeo" items={["Imagem para vídeo", "Roteiro e narração", "Formatos para Reels"]} />
            </div>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
              <div><Label>Nome</Label><Input className={cn("mt-1.5", wizardInputClass)} value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" /></div>
              <div><Label>E-mail</Label><Input className={cn("mt-1.5", wizardInputClass)} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" /></div>
              <div className="sm:col-span-2"><Label>WhatsApp <span className="text-white/35">(opcional)</span></Label><Input className={cn("mt-1.5", wizardInputClass)} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="(11) 99999-9999" /></div>
              <Button type="submit" className="mt-2 bg-gradient-brand text-white sm:col-span-2" disabled={saving || !email}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar na lista de lançamento"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanPreview({ icon: Icon, title, items }: { icon: typeof ImageIcon; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <Icon className="h-5 w-5 text-blue-300" />
      <p className="mt-3 font-semibold">{title}</p>
      <ul className="mt-3 space-y-2 text-xs text-white/50">
        {items.map((item) => <li key={item} className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-300" />{item}</li>)}
      </ul>
    </div>
  );
}
