import { TurnOrderList } from "./TurnOrderList";
import { actionCost, type DelayState, type TankColors, type WeaponId } from "@game/protocol";
import { useEffect, useRef } from "react";
import { closeOnBackdrop } from "./dialogBackdrop";
import { DotIcon } from "./DotIcon";
import { useLanguage } from "@/i18n/locale";
import "./delay.css";

export type DelayInfo = {
  readonly state: DelayState;
  readonly serverNow?: number;
  readonly onOpen: () => void;
  readonly playerId: string;
  readonly acting: boolean;
  readonly players: readonly { readonly id: string; readonly name: string; readonly colors?: TankColors | undefined; readonly eliminated?: boolean }[];
};
export const DelayIndicator = ({ info, steps, weapon }: { readonly info: DelayInfo; readonly steps: number; readonly weapon?: WeaponId | undefined }) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.close(); }, [info.state.round]);
  const cost = info.state.costs[info.playerId] ?? (info.acting ? actionCost(30 - steps, weapon) : null);
  return <>
    <TurnOrderList info={info} cost={cost} onCostClick={() => { info.onOpen(); dialog.current?.showModal(); }} />
    <dialog onKeyDown={e => e.stopPropagation()} ref={dialog} className="room-filter-dialog delay-dialog" aria-label={t("行動コスト")} onClick={e => closeOnBackdrop(e, () => dialog.current?.close())}>
      <h2>{t("行動コスト")}</h2>
      <button className="modal-close" aria-label={t("閉じる")} onClick={() => dialog.current?.close()}><DotIcon name="close" /></button>
      <p>{t("次の出番までの待ち時間。同点なら先に予約した人を優先。")}</p>
      <table><thead><tr><th>{t("プレイヤー")}</th><th>{t("次の出番まで")}</th></tr></thead><tbody>
        {info.state.order.map(id => { const player = info.players.find(p => p.id === id); if (!player || player.eliminated) return null;
          return <tr key={id}><th>{player.name}</th><td>{info.state.readyAt[id]! - info.state.clock}</td></tr>;
        })}
      </tbody></table>
      <p>{t("行動後に基本50・武器・移動のコストを加算します。")}</p>
    </dialog>
  </>;
};
