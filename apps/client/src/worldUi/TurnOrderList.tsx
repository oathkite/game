import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { DelayInfo } from "./DelayIndicator";
import { useLanguage } from "@/i18n/locale";
import "./delay.css";

export const TurnOrderList = ({ info, cost, onCostClick }: { readonly info: DelayInfo; readonly cost?: number | null; readonly onCostClick?: () => void }) => {
  const { t } = useLanguage();
  const order = info.state.order.filter(id => info.players.some(p => p.id === id && !p.eliminated));
  const list = useRef<HTMLOListElement>(null);
  const previous = useRef<readonly string[]>([]);
  const orderKey = order.join("/");
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = order;
    if (!before.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations: Animation[] = [];
    list.current?.querySelectorAll<HTMLElement>("[data-player]").forEach(row => {
      const id = row.dataset.player!, from = before.indexOf(id), to = order.indexOf(id);
      if (from >= 0 && from !== to) {
        const outgoing = from === 0;
        animations.push(row.animate([
          { transform: `translate(0, ${from * 24}px)`, offset: 0 },
          { transform: `translate(${outgoing ? 18 : 0}px, ${from * 24}px)`, offset: 0.2 },
          { transform: `translate(${outgoing ? 18 : 0}px, ${to * 24}px)`, offset: 0.8 },
          { transform: `translate(0, ${to * 24}px)`, offset: 1 },
        ], { duration: 480, easing: "ease-in-out" }));
      }
      if (to === 0) animations.push(row.animate([
        { backgroundColor: "#33ff66" }, { backgroundColor: "#d6ffe0" }, { backgroundColor: "#33ff66" },
      ], { duration: 700, easing: "ease-out" }));
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [orderKey, info.state.round]);
  return createPortal(
    <ol ref={list} className="turn-order-list" aria-label={t("各プレイヤーの次の出番")} style={{ height: `${order.length * 24}px` }}>
      {order.map((id, index) => {
        const player = info.players.find(p => p.id === id)!;
        const shownCost = (id === info.playerId ? cost : null) ?? info.state.costs[id] ?? info.state.previous[id] ?? "—";
        return <li key={id} data-player={id} className="turn-order-name" data-first={index === 0}
          aria-current={index === 0 ? "true" : undefined}
          title={player.name} style={{ transform: `translateY(${index * 24}px)` }}>
          <span className="turn-order-player">{player.name}</span>
          {id === info.playerId && onCostClick
            ? <button className="turn-order-cost" aria-label={t("行動コストを確認")} onClick={onCostClick}>{t("コスト")} {shownCost}</button>
            : <span className="turn-order-cost">{t("コスト")} {shownCost}</span>}
        </li>;
      })}
    </ol>, document.body,
  );
};
