import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-display text-7xl font-extrabold text-gradient-brand">404</p>
      <p className="font-display text-xl font-bold">Página não encontrada</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Button className="gap-2 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="h-4 w-4" /> Voltar para a visão geral
      </Button>
    </div>
  );
}
