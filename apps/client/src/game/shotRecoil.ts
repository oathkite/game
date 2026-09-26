/** 反動で砲身が引っ込む量（art px、1/4 セル）。180 ms の山で最大 2 px。同時に撃った砲身どうしで足さない（設計書 40.5） */
export const shotRecoil = (now: number, launches: readonly number[]): number =>
  Math.max(0, ...launches.map(at => {
    const age = now - at;
    return age >= 0 && age < 180 ? Math.round(2 * Math.sin(age / 180 * Math.PI)) : 0;
  }));
