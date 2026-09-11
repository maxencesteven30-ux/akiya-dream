import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Akiya Dream
          </span>
          <Badge variant="secondary" className="font-normal">
            Simulateur
          </Badge>
        </div>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Le coût réel de votre maison abandonnée au Japon
        </p>
      </div>
    </header>
  );
}
