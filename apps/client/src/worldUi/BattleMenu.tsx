import { useEffect, useRef, useState } from "react";
export const BattleMenu = ({ close, surrender, exit, finished, diagnostics, spectator = false }: { readonly diagnostics?: string; readonly spectator?: boolean; readonly close: () => void; readonly surrender: () => void; readonly exit: (() => void) | undefined; readonly finished: boolean }) => {
  const [copied, setCopied] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="battle-menu-panel" aria-label="対戦設定" onCancel={e => { e.preventDefault(); close(); }}>
    <button autoFocus onClick={close}>対戦に戻る</button>{!spectator && <button disabled={finished} onClick={surrender}>降参</button>}<button onClick={exit}>ロビーに戻る</button>
    {!spectator && <p>A / D・← / →：移動　W / S・↑ / ↓：角度<br />Space：溜めて発射　Q / E：武器　Tab：機体を順に見る</p>}
    {diagnostics && <details><summary>試合の診断情報</summary>
      <textarea ref={text} aria-label="試合の診断情報" readOnly value={diagnostics} rows={7} onFocus={e => e.currentTarget.select()} />
      <button onClick={() => { void (navigator.clipboard?.writeText(diagnostics) ?? Promise.reject()).then(() => setCopied(true), () => { text.current?.focus(); text.current?.select(); }); }}>診断情報をコピー</button>
      {copied && <span role="status">コピーしました</span>}
    </details>}
  </dialog>;
};
