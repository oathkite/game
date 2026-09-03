// client の MatchStage が開発と e2e のために window に置くフック。表示状態を読むだけ。

type FortressPlayer = { readonly x: number; readonly hp: number };

type FortressView = {
  readonly phase: string;
  readonly turnNumber: number;
  readonly currentSeat: 0 | 1;
  readonly mySeat: 0 | 1 | null;
  readonly players: readonly [FortressPlayer, FortressPlayer] | null;
  readonly mask: { readonly cells: Uint8Array } | null;
  readonly mismatches: number;
};

interface Window {
  __fortress?: { readonly getView: () => FortressView };
  __golden?: string;
}
