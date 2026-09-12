"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import {
  QUESTION_BY_ID,
  computeQuestionAnswer,
  listAnswerableQuestions,
  type ProjectSnapshot,
  type QuestionAnswer,
  type Verdict,
} from "@/lib/question-intelligence";

// Phase 4b — "Ask My Project" : PAS un chatbot libre. L'utilisateur
// choisit parmi les questions que l'application sait réellement traiter
// (listAnswerableQuestions), chacune répondue par une règle déterministe
// — jamais de texte généré à la volée.

interface AskMyProjectSectionProps {
  snapshot: ProjectSnapshot;
}

type Theme = "bien" | "argent" | "securite" | "decision";

const THEME_LABELS: Record<Theme, string> = {
  bien: "🏠 Le bien",
  argent: "💰 Argent",
  securite: "⚖️ Sécurité",
  decision: "🎯 Décision",
};

const THEME_ORDER: Theme[] = ["bien", "argent", "securite", "decision"];

const DOMAIN_THEME: Record<string, Theme> = {
  legal: "bien",
  utilities: "bien",
  building: "bien",
  inspection: "bien",
  market: "bien",
  history: "bien",
  hazards: "bien",
  exit: "bien",
  finance: "argent",
  subsidies: "argent",
  workflow: "securite",
  remote_owner: "securite",
  sharing: "securite",
  local_life: "securite",
  process: "securite",
  decision: "decision",
  next_action: "decision",
  explainability: "decision",
  data_quality: "decision",
};

const VERDICT_STYLES: Record<NonNullable<Verdict>, string> = {
  GREEN: "border-emerald-600/40 bg-emerald-600/10",
  ORANGE: "border-amber-600/30 bg-amber-600/5",
  RED: "border-destructive/30 bg-destructive/5",
};

function answerStyle(answer: QuestionAnswer): string {
  if (answer.verdict) return VERDICT_STYLES[answer.verdict];
  if (answer.status === "ANSWERED") return "border-border";
  return "border-amber-600/30 bg-amber-600/5";
}

export function AskMyProjectSection({ snapshot }: AskMyProjectSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const questionsByTheme = useMemo(() => {
    const questions = listAnswerableQuestions();
    const grouped = new Map<Theme, typeof questions>();
    for (const theme of THEME_ORDER) grouped.set(theme, []);
    for (const question of questions) {
      const theme = DOMAIN_THEME[question.domain] ?? "decision";
      grouped.get(theme)?.push(question);
    }
    return grouped;
  }, []);

  const selectedDef = selectedId ? QUESTION_BY_ID[selectedId] : null;
  const answer = selectedId ? computeQuestionAnswer(selectedId, snapshot) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          🧠 Ask My Project
        </h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Choisissez une question parmi celles que l&apos;application sait réellement traiter — jamais
        une réponse inventée.
      </p>

      <div className="space-y-4">
        {THEME_ORDER.map((theme) => {
          const questions = questionsByTheme.get(theme) ?? [];
          if (questions.length === 0) return null;
          return (
            <div key={theme}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {THEME_LABELS[theme]}
              </p>
              <div className="flex flex-wrap gap-2">
                {questions.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setSelectedId(question.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      selectedId === question.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {question.questionFr}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDef && answer && (
        <Card className={`mt-5 border p-6 ${answerStyle(answer)}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            🧠 Réponse — {selectedDef.questionFr}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{answer.answer}</p>

          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pourquoi ?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Règle : {answer.reason.ruleId} — {answer.reason.message}
            </p>
          </div>

          {answer.knownFacts.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ce que nous savons
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-foreground">
                {answer.knownFacts.map((fact) => (
                  <li key={fact}>• {fact}</li>
                ))}
              </ul>
            </div>
          )}

          {answer.unknowns.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ce qui reste inconnu
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-foreground">
                {answer.unknowns.map((unknown) => (
                  <li key={unknown}>• {unknown}</li>
                ))}
              </ul>
            </div>
          )}

          {answer.nextBestAction && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                🎯 Prochaine meilleure action
              </p>
              <p className="mt-1 text-xs text-foreground">{answer.nextBestAction}</p>
            </div>
          )}
        </Card>
      )}
    </motion.section>
  );
}
