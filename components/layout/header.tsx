import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
            <Image
              src="/logo-akiya-dream.png"
              alt="Akiya Dream"
              width={44}
              height={44}
              priority
              className="h-10 w-10 object-contain"
            />
          </div>
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
