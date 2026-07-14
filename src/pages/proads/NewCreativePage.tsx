import { useNavigate } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Video, Layers, Sparkles, Upload } from "lucide-react";
import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const options = [
  { icon: Upload, title: "Upload de imagem", desc: "Envie um arquivo do seu computador." },
  { icon: Video, title: "Upload de vídeo", desc: "Envie um vídeo pronto para publicação." },
  { icon: Sparkles, title: "Gerar imagem com IA", desc: "Descreva e a IA cria variações." },
  { icon: Sparkles, title: "Gerar vídeo com IA", desc: "Vídeos curtos e reels automáticos." },
  { icon: Layers, title: "Criar carrossel", desc: "Combine imagens em um único carrossel." },
  { icon: ImageIcon, title: "Usar template", desc: "Escolha um template pronto da marca." },
];

export default function NewCreativePage() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Novo criativo"
        description="Envie um arquivo, gere com IA ou combine tudo isso."
        actions={<Button variant="ghost" size="sm" onClick={() => navigate("/criativos")}><ArrowLeft className="h-3.5 w-3.5" /> Voltar</Button>}
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-3 md:grid-cols-3">
          {options.map((o) => (
            <Card key={o.title} className="cursor-pointer p-5 shadow-card transition-shadow hover:shadow-brand">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand-soft text-primary">
                <o.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-3 font-display font-bold">{o.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{o.desc}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h3 className="font-display font-bold">Gerar com IA</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Prompt</Label>
              <Textarea placeholder="Ex: Engenheiro visualizando canteiro de obras no celular, luz natural, estilo fotográfico realista..." className="mt-1.5 min-h-[100px]" />
            </div>
            <div><Label>Estilo</Label><Select><SelectTrigger className="mt-1.5"><SelectValue placeholder="Fotográfico" /></SelectTrigger><SelectContent><SelectItem value="1">Fotográfico</SelectItem><SelectItem value="2">Ilustração</SelectItem><SelectItem value="3">Cinema</SelectItem></SelectContent></Select></div>
            <div><Label>Formato</Label><Select><SelectTrigger className="mt-1.5"><SelectValue placeholder="Feed 1:1" /></SelectTrigger><SelectContent><SelectItem value="1">Feed 1:1</SelectItem><SelectItem value="2">Story 9:16</SelectItem><SelectItem value="3">Feed 4:5</SelectItem></SelectContent></Select></div>
            <div><Label>Proporção</Label><Input className="mt-1.5" placeholder="1080x1080" /></div>
            <div><Label>Plataforma</Label><Select><SelectTrigger className="mt-1.5"><SelectValue placeholder="Meta" /></SelectTrigger><SelectContent><SelectItem value="1">Meta</SelectItem><SelectItem value="2">Google</SelectItem><SelectItem value="3">TikTok</SelectItem></SelectContent></Select></div>
            <div><Label>Título</Label><Input className="mt-1.5" placeholder="Acompanhe sua obra de qualquer lugar" /></div>
            <div><Label>CTA</Label><Input className="mt-1.5" placeholder="Solicitar demonstração" /></div>
            <div className="md:col-span-2"><Label>Texto principal</Label><Textarea className="mt-1.5" placeholder="Câmeras + IA + relatórios semanais no seu celular." /></div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline">Cancelar</Button>
            <Button className="gap-2 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => { toast.success("Gerando criativos..."); setTimeout(() => navigate("/criativos"), 800); }}>
              <Sparkles className="h-4 w-4" /> Gerar
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
