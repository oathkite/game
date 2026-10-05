/** タッチの操作盤の高さ。縦持ちのスマートフォンはパワーと残り移動を別の段に分けるので高い。battleTouch.css の media query と同じ条件で決める */
export const touchConsoleHeight = (width: number, height: number): number => (height >= width && width < 600 ? 216 : 112);

/** 操作盤の高さ。対戦と練習（ターゲットチャレンジ、チュートリアル）の盤面は、画面の高さからこれを引いて求める。
 * battleHud.css と battleHudDesktop.css の media query と同じ条件で決める */
export const battleConsoleHeight = (width: number, height: number, touch: boolean): number =>
  touch ? touchConsoleHeight(width, height) : width >= 1200 && height >= 700 ? 160 : height < 500 || width < 1000 ? 96 : 120;
