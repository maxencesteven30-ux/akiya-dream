import { describe, expect, it } from "vitest";
import { SIGNAL_LEVEL_PRIORITY, sortSignalsByPriority, type Signal } from "@/lib/data-origin";

function signal(level: Signal["level"], id: string): Signal {
  return { level, reason: { ruleId: id, message: id, fieldsUsed: [] } };
}

describe("SIGNAL_LEVEL_PRIORITY", () => {
  it("respecte l'ordre BLOCKING > CRITICAL_UNKNOWN > DOCUMENTED_RISK > MISSING_INFO > OPTIMIZATION", () => {
    expect(SIGNAL_LEVEL_PRIORITY).toEqual([
      "BLOCKING",
      "CRITICAL_UNKNOWN",
      "DOCUMENTED_RISK",
      "MISSING_INFO",
      "OPTIMIZATION",
    ]);
  });
});

describe("sortSignalsByPriority", () => {
  it("place un signal BLOCKING avant un signal OPTIMIZATION même reçu en premier", () => {
    const signals = [signal("OPTIMIZATION", "opt"), signal("BLOCKING", "block")];
    expect(sortSignalsByPriority(signals).map((s) => s.reason.ruleId)).toEqual(["block", "opt"]);
  });

  it("conserve l'ordre d'arrivée entre deux signaux de même niveau", () => {
    const signals = [signal("MISSING_INFO", "a"), signal("MISSING_INFO", "b")];
    expect(sortSignalsByPriority(signals).map((s) => s.reason.ruleId)).toEqual(["a", "b"]);
  });

  it("trie un mélange complet dans le bon ordre de priorité", () => {
    const signals = [
      signal("OPTIMIZATION", "opt"),
      signal("MISSING_INFO", "missing"),
      signal("DOCUMENTED_RISK", "risk"),
      signal("BLOCKING", "block"),
      signal("CRITICAL_UNKNOWN", "unknown"),
    ];
    expect(sortSignalsByPriority(signals).map((s) => s.level)).toEqual([
      "BLOCKING",
      "CRITICAL_UNKNOWN",
      "DOCUMENTED_RISK",
      "MISSING_INFO",
      "OPTIMIZATION",
    ]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const signals = [signal("OPTIMIZATION", "opt"), signal("BLOCKING", "block")];
    const original = [...signals];
    sortSignalsByPriority(signals);
    expect(signals).toEqual(original);
  });
});
