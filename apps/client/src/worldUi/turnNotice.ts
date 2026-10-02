// 「あなたのターン」の告知の規則。YourTurn から呼ぶ純関数。

/** 告知した手番。操作できるようになった手番を 1 回だけ告知し、落下などで操作が止まって戻っても告知し直さない */
export const announceTurn = (announced: string | null, turnKey: string, active: boolean): string | null =>
  active && announced !== turnKey ? turnKey : announced;

/** 告知を出しておくか。出し始めたら、操作が止まっても同じ手番のあいだは消さない（消すと戻ったときに入りの演出をやり直す） */
export const showsNotice = (notice: string | null, turnKey: string): boolean => notice === turnKey;
