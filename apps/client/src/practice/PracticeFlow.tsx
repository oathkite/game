import type { CpuLevel } from "./cpuLevel";
import { useBrowserBackAction } from "@/worldUi/browserBack";
import { useState } from "react";
import type { Profile } from "@/app/profile";
import { FreePracticeSetup } from "./FreePracticeSetup";
import type { MapName } from "@game/protocol";
import { StageMenu } from "./StageMenu";
import { PracticeMenu } from "./PracticeMenu";
import { ChallengeScreen } from "./ChallengeScreen";
import { loadProgress, recordClear, saveProgress } from "./progress";
import { STAGES } from "./stages";
import "./practice.css";

type Props = { readonly onCpuStart: (map: MapName | "random", level: CpuLevel) => void; readonly profile: Profile; readonly onProfileChange: (profile: Profile) => void; readonly onExit: () => void; readonly onFreeStart: (map: MapName | "random") => void };
type Page = { readonly kind: "menu" } | { readonly kind: "stages" } | { readonly kind: "free" | "cpu" } | { readonly kind: "challenge"; readonly index: number; readonly attempt: number };

export const PracticeFlow = ({ onCpuStart, profile, onProfileChange, onExit, onFreeStart }: Props) => {
  const [page, setPage] = useState<Page>({ kind: "menu" });
  const [progress, setProgress] = useState(loadProgress);
  const [saved, setSaved] = useState(true);
  const back = () => setPage({ kind: "menu" });
  useBrowserBackAction(page.kind === "free" || page.kind === "cpu" || page.kind === "stages", back);
  if (page.kind === "free" || page.kind === "cpu") return <FreePracticeSetup cpu={page.kind === "cpu"} profile={profile} onProfileChange={onProfileChange} onStart={page.kind === "cpu" ? onCpuStart : onFreeStart} onBack={back} />;
  if (page.kind === "challenge") {
    const stage = STAGES[page.index]!;
    return <ChallengeScreen key={`${stage.id}-${page.attempt}`} stage={stage} profile={profile} onProfileChange={onProfileChange} best={progress[stage.id]} onBack={() => setPage({ kind: "stages" })}
      onRetry={() => setPage({ ...page, attempt: page.attempt + 1 })}
      onNext={page.index + 1 < STAGES.length ? () => setPage({ kind: "challenge", index: page.index + 1, attempt: 0 }) : null}
      onClear={(used) => { const next = recordClear(progress, stage.id, used); setProgress(next); setSaved(saveProgress(next)); }} />;
  }
  if (page.kind === "stages") return <StageMenu progress={progress} saved={saved} onStage={(index) => setPage({ kind: "challenge", index, attempt: 0 })} onBack={back} />;
  return <PracticeMenu onCpu={() => setPage({ kind: "cpu" })} onChallenge={() => setPage({ kind: "stages" })} onFree={() => setPage({ kind: "free" })} onBack={onExit} />;
};
