import { useLanguage } from "@/i18n/locale";
import { DotIcon } from "./DotIcon";
import { PixelButton } from "./PixelUi";
import type { RoomStep, RoomStepMessage } from "./roomStep";
import { SceneLoading } from "./SceneLoading";
import type { ComponentProps } from "react";

export type DockAction =
  | { readonly kind: "copy"; readonly disabled: boolean; readonly run: () => void }
  | { readonly kind: "start"; readonly disabled: boolean; readonly run: () => void }
  | { readonly kind: "ready"; readonly ready: boolean; readonly disabled: boolean; readonly run: () => void }
  | { readonly kind: "reconnect"; readonly disabled: boolean; readonly run: () => void }
  | null;

/** 状態に応じた主操作を 1 つだけ選ぶ。切断中は再接続が次にすること */
export const dockAction = (step: RoomStep, handlers: { readonly connected: boolean; readonly canResume: boolean; readonly busy: boolean; readonly canCopy: boolean; readonly copy: () => void; readonly start: () => void; readonly toggleReady: () => void; readonly resume: () => void }): DockAction => {
  if (!handlers.connected && handlers.canResume) return { kind: "reconnect", disabled: handlers.busy, run: handlers.resume };
  if (step.kind === "invite") return { kind: "copy", disabled: !handlers.canCopy, run: handlers.copy };
  if (step.kind === "start") return { kind: "start", disabled: !handlers.connected || step.blocker !== null, run: handlers.start };
  if (step.kind === "ready" || step.kind === "quick") return { kind: "ready", ready: step.ready, disabled: !handlers.connected, run: handlers.toggleReady };
  return null;
};

const ActionButton = ({ action }: { readonly action: Exclude<DockAction, null> }) => {
  const { t } = useLanguage();
  if (action.kind === "ready") return <PixelButton className="room-primary room-ready-button" aria-pressed={action.ready} disabled={action.disabled} onClick={action.run}>
    {action.ready ? <><DotIcon name="check" />{t("準備完了済み")}</> : t("準備完了")}
  </PixelButton>;
  const label = { copy: "招待リンクをコピー", start: "対戦開始", reconnect: "再接続" }[action.kind];
  return <PixelButton className={`room-primary${action.kind === "start" ? " room-start-button" : ""}`} disabled={action.disabled} onClick={action.run}>{t(label)}</PixelButton>;
};

/** ドック。次にすることの 1 文と、主操作を 1 つだけ置く（設計書 45.3）。通信の失敗は次にすることより先に出す */
export const RoomDock = ({ message, loading, action }: {
  readonly message: RoomStepMessage; readonly loading: ComponentProps<typeof SceneLoading>["steps"] | null; readonly action: DockAction;
}) => {
  const { t } = useLanguage();
  return <footer className="room-dock">
    {loading ? <SceneLoading className="scene-loading-inline" steps={loading} />
      : <p className="room-next" role="status" data-tone={message.tone}>{t(message.key, message.values)}</p>}
    {action && <ActionButton action={action} />}
  </footer>;
};
