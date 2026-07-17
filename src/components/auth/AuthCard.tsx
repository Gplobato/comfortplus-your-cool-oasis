import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import proadsLogo from "@/assets/proads-logo.png";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-brand-soft p-4 sm:p-6">
      <Card className="w-full max-w-md p-6 shadow-card-md sm:p-8">
        <div className="mb-6 text-center">
          <img
            src={proadsLogo}
            alt="ProAds Marketing OS"
            className="mx-auto mb-4 h-11 w-auto max-w-[210px] object-contain"
          />
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </Card>
    </div>
  );
}
