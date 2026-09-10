import { useEffect, useRef } from "react";
export const BattleMenu = ({ close, surrender, exit, finished }: { readonly close: () => void; readonly surrender: () => void; readonly exit: (() => void) | undefined; readonly finished: boolean }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="battle-menu-panel" aria-label="対戦設定" onCancel={e => { e.preventDefault(); close(); }}>
    <button autoFocus onClick={close}>対戦に戻る</button><button disabled={finished} onClick={surrender}>降参</button><button onClick={exit}>ロビーに戻る</button>
    <p>A / D・← / →：移動　W / S・↑ / ↓：角度<br />Space：溜めて発射　Q / E：武器　Tab：機体を順に見る</p>
  </dialog>;
};
