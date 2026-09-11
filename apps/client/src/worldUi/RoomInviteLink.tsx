import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/locale";
import { PixelButton } from "./PixelUi";
import { roomInviteUrl } from "./roomInvite";
export const RoomInviteLink = ({ base, roomId, token }: { readonly base: string; readonly roomId: string; readonly token: string | null }) => {
  const { t } = useLanguage();
  const [url, setUrl] = useState(base ? "" : roomInviteUrl(location.href, roomId));
  const [expires, setExpires] = useState<number | null>(null), [status, setStatus] = useState("");
  useEffect(() => {
    if (!base) return;
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
  }, [base, roomId, token]);
  return <div>{url ? <label>{t("招待リンク")}<input aria-label={t("招待リンク")} readOnly value={url} onFocus={e => e.currentTarget.select()} />
    {expires !== null && <small>{t("有効期限")} {new Date(expires).toLocaleString()}</small>}
    <PixelButton onClick={() => { void (navigator.clipboard?.writeText(url) ?? Promise.reject()).then(() => setStatus("招待リンクをコピーしました。"), () => setStatus("リンクを選択してコピーしてください。")); }}>{t("コピー")}</PixelButton>
  </label> : !status && <span role="status">{t("招待リンクを作成中…")}</span>}{status && <span role="status">{t(status)}</span>}</div>;
};
