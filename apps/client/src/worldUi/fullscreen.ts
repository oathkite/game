// 対戦画面の全画面（設計書 30 章）。全画面にするのは document 全体で、手番の一覧（position:fixed）や部屋の再接続の案内も一緒に映す。
// iPad の Safari は webkit 接頭辞の名前だけを持つ。iPhone の Safari は要素の全画面を持たないので、ボタンを出さない（TBD-51）。

/** 全画面の API のうち、ここで使う部分。標準の名前と webkit 接頭辞の名前のどちらか、または両方を持つ */
export type FullscreenDocument = EventTarget & {
  readonly documentElement: { readonly requestFullscreen?: () => Promise<void>; readonly webkitRequestFullscreen?: () => void };
  readonly fullscreenEnabled?: boolean;
  readonly webkitFullscreenEnabled?: boolean;
  readonly fullscreenElement?: unknown;
  readonly webkitFullscreenElement?: unknown;
  readonly exitFullscreen?: () => Promise<void>;
  readonly webkitExitFullscreen?: () => void;
};

const CHANGE_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;

export const fullscreenSupported = (doc: FullscreenDocument): boolean =>
  (doc.fullscreenEnabled === true && typeof doc.documentElement.requestFullscreen === "function")
  || (doc.webkitFullscreenEnabled === true && typeof doc.documentElement.webkitRequestFullscreen === "function");

export const isFullscreen = (doc: FullscreenDocument): boolean => (doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null) !== null;

const enter = async (doc: FullscreenDocument): Promise<void> => {
  const root = doc.documentElement;
  if (root.requestFullscreen) await root.requestFullscreen();
  else root.webkitRequestFullscreen?.();
};

const exit = async (doc: FullscreenDocument): Promise<void> => {
  if (doc.exitFullscreen) await doc.exitFullscreen();
  else doc.webkitExitFullscreen?.();
};

/** 全画面を出入りする。押す操作の中で呼ぶ。ブラウザが断った（押す操作の外、権限ポリシー）ときは何もしない */
export const toggleFullscreen = async (doc: FullscreenDocument): Promise<void> => {
  if (!fullscreenSupported(doc)) return;
  try {
    await (isFullscreen(doc) ? exit(doc) : enter(doc));
  } catch {
    // 断られたら今の表示のまま続ける。状態は fullscreenchange だけから読むので、ここで直すものは無い
  }
};

/** 全画面の出入りを知らせる。Esc やブラウザの操作で抜けたときも届く。戻り値で購読をやめる */
export const subscribeFullscreen = (doc: FullscreenDocument, listener: () => void): (() => void) => {
  for (const type of CHANGE_EVENTS) doc.addEventListener(type, listener);
  return () => { for (const type of CHANGE_EVENTS) doc.removeEventListener(type, listener); };
};
