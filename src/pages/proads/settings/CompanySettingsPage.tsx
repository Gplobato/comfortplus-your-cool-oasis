import { PageHeader } from "@/components/proads/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

export default function CompanySettingsPage() {
  const { activeOrg } = useOrganization();

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
            <div>
              <Label>Nome da empresa</Label>
              <Input className="mt-1.5" defaultValue={activeOrg?.name ?? ""} placeholder="Nome da organização" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input className="mt-1.5" defaultValue="" placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Segmento</Label>
              <Input className="mt-1.5" defaultValue="" placeholder="Ex.: construção, SaaS, varejo" />
            </div>
            <div>
              <Label>Site</Label>
              <Input className="mt-1.5" defaultValue="" placeholder="https://" />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea className="mt-1.5" rows={3} defaultValue="" placeholder="Descreva a empresa e o que ela oferece" />
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <Label>Cores da marca</Label>
          <p className="mt-2 text-xs text-muted-foreground">Nenhuma cor configurada ainda.</p>
          <div className="mt-4">
            <Label>Tom de voz</Label>
            <Textarea className="mt-1.5" defaultValue="" placeholder="Ex.: profissional, próximo, técnico" />
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <Label>Serviços</Label>
          <Input className="mt-1.5" defaultValue="" placeholder="Liste os principais serviços (separados por vírgula)" />
          <Label className="mt-4 block">Regiões atendidas</Label>
          <Input className="mt-1.5" defaultValue="" placeholder="Ex.: São Paulo, Brasil" />
        </Card>
        <Card className="p-5 shadow-card md:col-span-2">
          <Label>Público-alvo</Label>
          <Input className="mt-1.5" defaultValue="" placeholder="Quem é o cliente ideal?" />
          <Label className="mt-4 block">Diferenciais</Label>
          <Textarea className="mt-1.5" rows={2} defaultValue="" placeholder="O que diferencia a marca" />
          <Label className="mt-4 block">Palavras proibidas</Label>
          <Input className="mt-1.5" defaultValue="" placeholder="Termos que a IA não deve usar" />
        </Card>
      </div>
    </>
  );
}
