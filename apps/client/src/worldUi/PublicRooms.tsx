import { DotIcon } from "./DotIcon";
import { useEffect, useRef, useState } from "react";
import { MULTIPLAYER_MAPS, MULTIPLAYER_MAP_LABELS } from "@game/maps";
import { roomPageSchema, type RoomPage } from "@game/protocol/v2-rooms";
import { useLanguage } from "@/i18n/locale";
import { PixelButton } from "./PixelUi";

export const PublicRooms = ({ initialCode = "", base, busy, filtersOpen, closeFilters, join }: {
  readonly initialCode?: string; readonly base: string; readonly busy: boolean; readonly filtersOpen: boolean; readonly closeFilters: () => void;
  readonly join: (roomId: string, role: "room.join" | "room.spectate", locked: boolean) => void;
}) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (filtersOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [filtersOpen]);
  const [page, setPage] = useState<RoomPage>({ rooms: [], nextCursor: null });
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [map, setMap] = useState("");
  const [phase, setPhase] = useState("");
  const [vacancy, setVacancy] = useState("");
  const filtering = Boolean(code || map || phase || vacancy);
  const current = useRef<AbortController | null>(null);
  const loadedPages = useRef(1);
  const load = async (after = "", background = false): Promise<void> => {
    if (background && current.current) return;
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    if (!background) setLoading(true);
    try {
      let next: RoomPage = { rooms: [], nextCursor: null };
      let cursor = after;
      const count = after ? 1 : loadedPages.current;
      for (let index = 0; index < count; index++) {
        const url = new URL("/v2/rooms/page", base); if (cursor) url.searchParams.set("after", cursor);
        for (const [key, value] of Object.entries({ code, map, phase, vacancy })) if (value) url.searchParams.set(key, value);
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("room list unavailable");
        const result = roomPageSchema.parse(await response.json());
        next = { ...result, rooms: [...next.rooms, ...result.rooms.filter(room => !next.rooms.some(old => old.roomId === room.roomId))] };
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
      if (current.current !== controller) return;
      if (after) loadedPages.current++;
      setFailed(false);
      setPage(previous => ({ ...next, rooms: after ? [...previous.rooms, ...next.rooms.filter(room => !previous.rooms.some(old => old.roomId === room.roomId))] : next.rooms }));
    } catch { if (current.current === controller) setFailed(true); }
    finally { clearTimeout(timer); if (current.current === controller) { current.current = null; setLoading(false); } }
  };
  useEffect(() => {
    loadedPages.current = 1;
    setPage({ rooms: [], nextCursor: null });
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load("", true); };
    const interval = setInterval(refresh, 3000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval); document.removeEventListener("visibilitychange", refresh);
      current.current?.abort(); current.current = null;
    };
  }, [base, code, map, phase, vacancy]);
  return <section className="public-rooms" aria-label={t("公開部屋")}>
    <dialog ref={dialog} className="room-filter-dialog" id="room-filters" aria-labelledby="room-filter-title" onCancel={closeFilters} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeFilters();
    }}>
      <h2 id="room-filter-title">{t("部屋を探す")}</h2>
      <div className="room-filters">
      <label>{t("部屋コード")}<input aria-label={t("部屋コード")} maxLength={6} autoComplete="off" spellCheck={false} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))} /></label>
      <label>{t("マップ")}<select aria-label={t("マップ")} value={map} onChange={event => setMap(event.target.value)}><option value="">{t("すべて")}</option>{MULTIPLAYER_MAPS.map(value => <option key={value.id} value={value.id}>{t(MULTIPLAYER_MAP_LABELS[value.id] ?? value.id)}</option>)}</select></label>
      <label>{t("対戦状態")}<select aria-label={t("対戦状態")} value={phase} onChange={event => setPhase(event.target.value)}><option value="">{t("すべて")}</option><option value="waiting">{t("準備中")}</option><option value="started">{t("対戦中")}</option></select></label>
      <label>{t("空席")}<select aria-label={t("空席")} value={vacancy} onChange={event => setVacancy(event.target.value)}><option value="">{t("すべて")}</option><option value="available">{t("参加可能")}</option></select></label>
      <PixelButton disabled={!filtering} onClick={() => { setCode(""); setMap(""); setPhase(""); setVacancy(""); }}>{t("クリア")}</PixelButton>
      <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={closeFilters}><DotIcon name="close" /></PixelButton>
      </div>
    </dialog>
    {filtering && !loading && !failed && page.rooms.length === 0 && <p role="status">{t("条件に一致する部屋はありません。")}</p>}
    {failed && <p role="alert">{t("部屋一覧を取得できませんでした。更新して再試行してください。")}</p>}
    {!failed && !loading && !filtering && page.rooms.length === 0 && <p>{t("部屋がありません。「部屋を作る」から作成できます。")}</p>}
    <ul>{page.rooms.map(room => <li key={room.roomId}>
      <div><strong>{room.passwordProtected && <span role="img" aria-label={t("パスワードルーム")}><DotIcon name="lock" /></span>}{room.name || room.roomId}</strong>{room.name && <span>{room.roomId}</span>}<span>{t(MULTIPLAYER_MAP_LABELS[room.mapId] ?? room.mapId)} · {t(({ asia: "アジア", europe: "ヨーロッパ", americas: "アメリカ" })[room.region])}</span>
        <span>{t("参加者 {count}/8", { count: room.members })} · {t(room.phase === "waiting" ? "準備中" : "対戦中")}</span></div>
      <div>{room.phase === "waiting" && <PixelButton disabled={busy || room.members >= 8} onClick={() => join(room.roomId, "room.join", Boolean(room.passwordProtected))}>{t("部屋に参加")}</PixelButton>}
        <PixelButton disabled={busy || room.spectators >= 8} onClick={() => join(room.roomId, "room.spectate", Boolean(room.passwordProtected))}>{t("観戦する")}</PixelButton></div>
    </li>)}</ul>
    {loading && <p role="status">{t("部屋一覧を読み込み中…")}</p>}
    {page.nextCursor && <PixelButton disabled={loading || busy} onClick={() => { void load(page.nextCursor!); }}>{t("もっと見る")}</PixelButton>}
  </section>;
};
