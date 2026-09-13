import { useEffect, useRef, useState } from "react";
import { MULTIPLAYER_MAP_LABELS } from "@game/maps";
import { roomPageSchema, type RoomPage } from "@game/protocol/v2-rooms";
import { useLanguage } from "@/i18n/locale";
import { PixelButton } from "./PixelUi";

export const PublicRooms = ({ base, busy, close, join }: {
  readonly base: string; readonly busy: boolean; readonly close: () => void;
  readonly join: (roomId: string, role: "room.join" | "room.spectate") => void;
}) => {
  const { t } = useLanguage();
  const [page, setPage] = useState<RoomPage>({ rooms: [], nextCursor: null });
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const current = useRef<AbortController | null>(null);
  const load = async (after = ""): Promise<void> => {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    setLoading(true); setFailed(false);
    try {
      const url = new URL("/v2/rooms/page", base); if (after) url.searchParams.set("after", after);
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("room list unavailable");
      const next = roomPageSchema.parse(await response.json());
      if (current.current !== controller) return;
      setPage(previous => ({ ...next, rooms: after ? [...previous.rooms, ...next.rooms.filter(room => !previous.rooms.some(old => old.roomId === room.roomId))] : next.rooms }));
    } catch { if (current.current === controller) setFailed(true); }
    finally { clearTimeout(timer); if (current.current === controller) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { current.current?.abort(); current.current = null; }; }, []);
  return <section className="public-rooms" aria-label={t("公開部屋")}>
    <header><h2>{t("公開部屋")}</h2><PixelButton disabled={busy} onClick={close}>{t("一覧を閉じる")}</PixelButton></header>
    <PixelButton disabled={loading || busy} onClick={() => { void load(); }}>{t("一覧を更新")}</PixelButton>
    {failed && <p role="alert">{t("部屋一覧を取得できませんでした。更新して再試行してください。")}</p>}
    {!failed && !loading && page.rooms.length === 0 && <p>{t("公開部屋はありません。部屋を作るかクイック参加で遊べます。")}</p>}
    <ul>{page.rooms.map(room => <li key={room.roomId}>
      <div><strong>{room.roomId}</strong><span>{t(MULTIPLAYER_MAP_LABELS[room.mapId] ?? room.mapId)} · {t(({ asia: "アジア", europe: "ヨーロッパ", americas: "アメリカ" })[room.region])}</span>
        <span>{t("参加者 {count}/8", { count: room.members })} · {t(room.phase === "waiting" ? "準備中" : "対戦中")}</span></div>
      <div>{room.phase === "waiting" && <PixelButton disabled={busy || room.members >= 8} onClick={() => join(room.roomId, "room.join")}>{t("部屋に参加")}</PixelButton>}
        <PixelButton disabled={busy || room.spectators >= 8} onClick={() => join(room.roomId, "room.spectate")}>{t("観戦する")}</PixelButton></div>
    </li>)}</ul>
    {loading && <p role="status">{t("部屋一覧を読み込み中…")}</p>}
    {page.nextCursor && <PixelButton disabled={loading || busy} onClick={() => { void load(page.nextCursor!); }}>{t("もっと見る")}</PixelButton>}
  </section>;
};
