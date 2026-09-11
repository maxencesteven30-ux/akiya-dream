"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BuyerProfile } from "@/lib/types";

const PROFILES: { value: BuyerProfile; title: string; description: string }[] = [
  {
    value: "solo",
    title: "Acheteur Solo",
    description: "Vous achetez seul, en votre nom propre.",
  },
  {
    value: "duo",
    title: "À deux (Amis / Couple)",
    description: "Achat partagé — nécessite une structure juridique (SCI).",
  },
  {
    value: "investisseur",
    title: "Investisseur Locatif",
    description: "Mise en location — nécessite une société japonaise (Gōdō Kaisha).",
  },
];

interface ProfilSectionProps {
  value: BuyerProfile | null;
  onChange: (profile: BuyerProfile) => void;
}

export function ProfilSection({ value, onChange }: ProfilSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Étape 1 — Votre profil
      </h2>
      <p className="mb-5 text-lg text-foreground">Qui achète ce bien ?</p>
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        {PROFILES.map((profile) => (
          <Card
            key={profile.value}
            onClick={() => onChange(profile.value)}
            className={cn(
              "cursor-pointer border p-6 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40",
              value === profile.value
                ? "border-primary bg-accent"
                : "border-border",
            )}
          >
            <p className="mb-1 font-medium text-foreground">{profile.title}</p>
            <p className="text-sm text-muted-foreground">{profile.description}</p>
          </Card>
        ))}
      </div>
    </motion.section>
  );
}
