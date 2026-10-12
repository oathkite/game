import { TitleLogo } from "./TitleLogo";

// 部屋コード。題名と同じドット文字で描き、人に伝える番号として覚えやすくする（設計書 45.6 のシグネチャー）。
// 文字は支援技術向けに残るので、textContent は部屋コードのまま。
export const RoomCode = ({ code, large = false, testId = true }: { readonly code: string; readonly large?: boolean; readonly testId?: boolean }) =>
  <span className={`room-code${large ? " room-code-large" : ""}`} {...(testId ? { "data-testid": "room-code" } : {})}><TitleLogo text={code} /></span>;
