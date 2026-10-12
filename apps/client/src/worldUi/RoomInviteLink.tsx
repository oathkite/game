import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/locale";
import { roomInviteUrl } from "./roomInvite";
import { RoomCode } from "./RoomCode";

export type InviteLink = { readonly url: string; readonly expires: number | null; readonly status: string };

/** 招待リンクを作る。部屋の API があるときは期限付きの招待を発行し、無いときは部屋コードだけの URL にする。
 *  発行は Durable Object への要求になるので、招待の面を出している間（enabled）だけ行う */
export const useInviteLink = (base: string, roomId: string, token: string | null, enabled = true): InviteLink => {
  const [url, setUrl] = useState(base ? "" : roomInviteUrl(location.href, roomId));
  const [expires, setExpires] = useState<number | null>(null), [status, setStatus] = useState("");
  useEffect(() => {
    if (!base || !enabled) return;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    let active = true;
    void (async () => {
      try {
        const response = await fetch(new URL(`/v2/rooms/${roomId}/invite`, base), { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` }, signal: controller.signal });
        if (!response.ok) throw new Error("invite unavailable");
        const invitation = await response.json();
        if (typeof invitation.token !== "string" || !/^[a-f0-9-]{36}$/i.test(invitation.token) || !Number.isSafeInteger(invitation.expiresAt)) throw new Error("invalid invite");
        if (active) { setUrl(roomInviteUrl(location.href, roomId, invitation.token)); setExpires(invitation.expiresAt); }
      } catch { if (active) setStatus("招待リンクを作成できませんでした。一度閉じて再試行してください。"); }
      finally { clearTimeout(timer); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [base, roomId, token, enabled]);
  return { url, expires, status };
};

/** 押した操作の中でクリップボードへ書く。書けない環境ではリンクを選んでもらう */
export const copyInvite = (url: string): Promise<string> =>
  (navigator.clipboard?.writeText(url) ?? Promise.reject()).then(() => "招待リンクをコピーしました。", () => "リンクを選択してコピーしてください。");

/** 招待の面。大きな部屋コードと招待リンク。コピーの操作はドック（1 人のとき）かダイアログ（2 人以上）が持つ（設計書 45.3） */
export const RoomInvite = ({ roomId, invite, copied, codeTestId = true }: { readonly roomId: string; readonly invite: InviteLink; readonly copied: string; readonly codeTestId?: boolean }) => {
  const { t } = useLanguage();
  return <section className="room-invite" aria-label={t("相手を招待")}>
    <div className="room-invite-code"><small>{t("部屋コード")}</small><RoomCode code={roomId} large testId={codeTestId} /></div>
    {invite.url
      ? <label>{t("招待リンク")}<input aria-label={t("招待リンク")} readOnly value={invite.url} onFocus={e => e.currentTarget.select()} /></label>
      : !invite.status && <span role="status">{t("招待リンクを作成中…")}</span>}
    {invite.expires !== null && <small>{t("有効期限")} {new Date(invite.expires).toLocaleString()}</small>}
    {(invite.status || copied) && <span role="status">{t(invite.status || copied)}</span>}
  </section>;
};
