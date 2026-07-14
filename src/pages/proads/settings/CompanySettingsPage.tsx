import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { company } from "@/mocks/data";
import { toast } from "sonner";

export default function CompanySettingsPage() {
  return (
    <>
      <PageHeader
        title="Empresa"
        description="Informações da marca usadas pela IA na criação de campanhas e criativos."
        actions={<Button size="sm" className="bg-gradient-brand text-primary-foreground" onClick={() => toast.success("Salvo")}>Salvar</Button>}
      />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-8">
        <Card className="p-5 shadow-card md:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Nome da empresa</Label><Input className="mt-1.5" defaultValue={company.name} /></div>
            <div><Label>CNPJ</Label><Input className="mt-1.5" defaultValue={company.cnpj} /></div>
            <div><Label>Segmento</Label><Input className="mt-1.5" defaultValue={company.segment} /></div>
            <div><Label>Site</Label><Input className="mt-1.5" defaultValue={company.website} /></div>
            <div className="md:col-span-2"><Label>Descrição</Label><Textarea className="mt-1.5" rows={3} defaultValue={company.description} /></div>
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <Label>Cores da marca</Label>
          <div className="mt-2 flex gap-2">{company.brandColors.map((c) => (<div key={c} className="h-10 w-10 rounded-lg border border-border" style={{ background: c }} />))}</div>
          <div className="mt-4"><Label>Tom de voz</Label><Textarea className="mt-1.5" defaultValue={company.toneOfVoice} /></div>
        </Card>
        <Card className="p-5 shadow-card">
          <Label>Serviços</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">{company.services.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
          <Label className="mt-4 block">Regiões atendidas</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">{company.regions.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
        </Card>
        <Card className="p-5 shadow-card md:col-span-2">
          <Label>Público-alvo</Label>
          <Input className="mt-1.5" defaultValue={company.audience} />
          <Label className="mt-4 block">Diferenciais</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">{company.differentials.map((s) => <Badge key={s} variant="outline" className="bg-blue-soft text-blue-soft-foreground">{s}</Badge>)}</div>
          <Label className="mt-4 block">Palavras proibidas</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">{company.forbiddenWords.map((s) => <Badge key={s} variant="outline" className="bg-destructive/10 text-destructive">{s}</Badge>)}</div>
        </Card>
      </div>
    </>
  );
}
