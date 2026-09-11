"use client";

import { motion } from "framer-motion";
import type { BuyerProfile } from "@/lib/types";

interface RoadmapStep {
  period: string;
  title: string;
  description: string;
}

const LEGAL_STEP: RoadmapStep = {
  period: "Mois 1-3",
  title: "Phase légale",
  description: "Création de la structure juridique et sécurisation des fonds.",
};

const COMMON_STEPS: RoadmapStep[] = [
  {
    period: "Mois 4-6",
    title: "Veille",
    description: "Sélection des biens et contacts intermédiaires locaux.",
  },
  {
    period: "Mois 7",
    title: "Assaut terrain",
    description:
      "Voyage au Japon (15 jours) : visites, diagnostics (termites/séisme) et devis travaux.",
  },
  {
    period: "Mois 8",
    title: "Closing",
    description:
      "Signature du contrat, virement international et déclaration FEFTA (obligatoire sous 20 jours).",
  },
  {
    period: "Mois 9-18",
    title: "Rénovation",
    description: "Pilotage du chantier à distance et gestion de l'Akiya.",
  },
];

function buildSteps(profile: BuyerProfile): RoadmapStep[] {
  return profile === "duo" || profile === "investisseur"
    ? [LEGAL_STEP, ...COMMON_STEPS]
    : COMMON_STEPS;
}

interface RoadmapProps {
  profile: BuyerProfile | null;
}

export function Roadmap({ profile }: RoadmapProps) {
  if (!profile) return null;

  const steps = buildSteps(profile);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Votre feuille de route
      </h2>
      <p className="mb-6 text-lg text-foreground">De la décision à la remise des clés</p>

      <ol className="relative space-y-8 border-l border-border pl-6">
        {steps.map((step, index) => (
          <motion.li
            key={step.period}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            className="relative"
          >
            <span className="absolute -left-[1.65rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              {step.period}
            </p>
            <p className="mt-1 font-medium text-foreground">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </motion.li>
        ))}
      </ol>
    </motion.section>
  );
}
