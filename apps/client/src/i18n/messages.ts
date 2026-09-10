import { playEnglish } from "./playMessages";
import { roomEnglish } from "./roomMessages";
export const english: Readonly<Record<string, string>> = {
  ...roomEnglish, ...playEnglish,
  "はじめる": "Play", "スキップ": "Skip", "出発の準備": "Get ready", "設定": "Settings",
  "湿地の観測所": "Wetland observatory", "名前": "Name", "装備": "Weapon", "ケロポッド": "KEROPOD",
  "タイトルへ": "Title", "オンライン対戦": "Online battle", "プラクティスへ": "Practice",
  "整備と設定": "Settings", "音量": "Volume", "音を出す": "Unmute", "音を消す": "Mute",
  "機体の表示サイズ": "Tank scale", "等倍": "Native size", "0.75倍（従来）": "75% size",
  "イントロを再生": "Replay intro", "この端末に保存されます。": "Saved on this device.", "ロビーに戻る": "Back to lobby",
  "いい一発だった。またここで。": "Good shot. See you out there.", "もう一度プレイ": "Play again",
  "カメラ調整": "Camera", "移動速度": "Pan speed", "倍": "×", "慣性の長さ": "Inertia duration",
  "ドラッグ・スワイプ・端スクロール・キーボードに反映": "Applies to dragging, swiping, edge scrolling and keyboard panning.",
  "大きいほど、離したあと長く流れます。0で無効。": "Higher values glide longer after release. Set to 0 to disable.",
  "カメラを初期値に戻す": "Reset camera", "変更は即時反映され、このブラウザに保存されます。": "Changes apply immediately and are saved in this browser.",
  "標準砲": "Cannon", "トリプル弾": "Triple", "マルチ弾": "Multiple", "貫通弾": "Drill",
  "レーザー弾": "Laser", "掘削弾": "Digger", "浮遊弾": "Floater", "針弾": "Stinger",
  "KEROPOD（ケロポッド）": "KEROPOD", "カエルのパイロットと黄色いケロポッド": "Frog pilot and yellow KEROPOD",
};
