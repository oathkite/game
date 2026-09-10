import type { WeaponId } from "@game/protocol";
const outlines: Record<WeaponId, string> = {
  cannon: "M14 30V16Q14 8 20 4Q26 8 26 16V30ZM14 24H26M14 30V35H26V30",
  triple: "M4 30V19L8 12L12 19V30ZM16 27V12L20 5L24 12V27ZM28 30V19L32 12L36 19V30Z",
  multiple: "M5 22V12L9 5L13 12V22ZM17 29V19L21 12L25 19V29ZM29 22V12L33 5L37 12V22ZM5 35V29H13V35ZM29 35V29H37V35Z",
  drill: "M8 30L20 4L32 30ZM12 22H28M15 15H25M8 30V35H32V30",
  laser: "M5 27L13 35L27 21L19 13ZM24 13L33 4M29 18L38 9M19 8L28 0",
  digger: "M11 6H29V20Q29 30 20 36Q11 30 11 20ZM11 14H29M20 6V26",
  floater: "M8 16A12 12 0 1 1 32 16Q32 23 23 27H17Q8 23 8 16ZM17 27V34H23V27M11 34H29",
  stinger: "M20 3L25 22L34 31L23 29L20 37L17 29L6 31L15 22Z",
};
export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) => <svg viewBox="0 0 40 40" aria-hidden="true"><path d={outlines[weapon]} fill="#dcc995" stroke="#8baec2" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
