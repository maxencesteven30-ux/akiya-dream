"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { computeAkiyaPassport, type AkiyaPassportInput } from "@/lib/akiya-passport";

// Phase Z — Akiya Passport : la synthèse finale du projet. Jamais "cette
// maison est bonne", toujours "voici ce qui est connu / estimé / inconnu /
// potentiellement bloquant / la prochaine information la plus importante
// à obtenir." N'introduit aucune nouvelle donnée : assemble uniquement ce
// que les moteurs existants ont déjà établi.

interface AkiyaPassportSectionProps {
  input: AkiyaPassportInput;
}

export function AkiyaPassportSection({ input }: AkiyaPassportSectionProps) {
  const passport = computeAkiyaPassport(input);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          🛂 Akiya Passport
        </h2>
      </div>
      <p className="mb-5 text-lg text-foreground">{passport.propertyName}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-emerald-600/30 bg-emerald-600/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">✅ Ce qui est connu</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {passport.known.map((fact) => (
              <li key={fact}>• {fact}</li>
            ))}
          </ul>
        </Card>

        <Card className="border-sky-600/30 bg-sky-600/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">🔵 Ce qui est estimé</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {passport.estimated.map((fact) => (
              <li key={fact}>• {fact}</li>
            ))}
          </ul>
        </Card>

        <Card className="border-amber-600/30 bg-amber-600/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">🟠 Ce qui reste inconnu</p>
          {passport.unknown.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {passport.unknown.map((fact) => (
                <li key={fact}>• {fact}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucune inconnue critique identifiée.</p>
          )}
        </Card>

        <Card className="border-destructive/30 bg-destructive/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            🔴 Potentiellement bloquant
          </p>
          {passport.potentiallyBlocking.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {passport.potentiallyBlocking.map((fact) => (
                <li key={fact}>• {fact}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucun blocage avéré identifié.</p>
          )}
        </Card>
      </div>

      <Card className="mt-4 border-border p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          🎯 Prochaine information la plus importante à obtenir
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{passport.nextMostImportantInfo}</p>
      </Card>
    </motion.section>
  );
}
