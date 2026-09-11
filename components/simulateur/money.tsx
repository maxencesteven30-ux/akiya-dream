import { jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";

interface MoneyProps {
  jpy: number;
  className?: string;
  eurClassName?: string;
  /** "stacked" (JPY puis EUR en dessous, pour les listes verticales) ou
   * "inline" (JPY (≈ EUR) sur une seule ligne, pour le texte courant). */
  variant?: "stacked" | "inline";
}

/** Affiche un montant JPY avec son équivalent EUR au taux courant
 * (EUR_JPY_RATE, cf. lib/data.ts), pour ne jamais afficher un montant
 * en JPY sans sa contrepartie en EUR. */
export function Money({ jpy, className, eurClassName, variant = "stacked" }: MoneyProps) {
  const eur = formatEur(jpyToEur(jpy));
  const eurClass = eurClassName ?? "text-xs font-normal text-muted-foreground";

  if (variant === "inline") {
    return (
      <span className={className}>
        {formatJpy(jpy)} <span className={eurClass}>(≈ {eur})</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col items-end ${className ?? ""}`}>
      <span>{formatJpy(jpy)}</span>
      <span className={eurClass}>≈ {eur}</span>
    </span>
  );
}
