# 6. データモデル

この章では、対戦の状態を表す型と、サーバーとクライアントで同じ結果を得るための決定論の契約を定める。
型はすべて共有パッケージに置き、サーバーとクライアントが同じ定義を参照する。
永続化は最初の版では持たないので、ここで定めるのはメモリ上の構造だけである。

## 6.1 部屋の状態（RoomState）

部屋の状態は対戦の外側にあり、対戦が終わっても残る。
`room.state` でそのまま配信する。

```ts
type RoomPhase = "open" | "inMatch" | "result";

type RoomMember = {
  readonly seat: Seat;
  readonly playerId: string;        // 端末ごとの匿名 ID
  readonly nickname: string;
  readonly colors: TankColors;
  readonly ready: boolean;
  readonly colorConflict: boolean;  // 先にいる参加者と主色が重なっている
  readonly connected: boolean;
};

type Spectator = {
  readonly playerId: string;
  readonly nickname: string;
};

type RoomState = {
  readonly code: string;            // 入室コード。サーバーが生成
  readonly title: string;           // 表示名
  readonly isPublic: boolean;
  readonly mapName: string;
  readonly maxPlayers: number;      // 最初の版では 2
  readonly ownerSeat: Seat;
  readonly phase: RoomPhase;
  readonly members: readonly RoomMember[];
  readonly spectators: readonly Spectator[];
  readonly maxSpectators: number;   // 最初の版では 8
};
```

## 6.2 対戦状態（MatchState）

対戦の全体を表す。
サーバーが正を持ち、再接続時には `conn.state` でそのまま送る。

```ts
type Seat = 0 | 1;

type Phase =
  | "ready"
  | "turnStart"
  | "acting"
  | "resolving"
  | "replaying"
  | "finished";

type MatchState = {
  readonly roomCode: string;      // RoomState.code と同じ
  readonly mapName: string;
  readonly phase: Phase;
  readonly turnNumber: number;        // 1 から始まる通し番号
  readonly turnLimit: number;         // 合計ターン数の上限
  readonly currentSeat: Seat;
  readonly deadlineAt: number | null; // Acting 中の期限。サーバー時刻の ms
  readonly wind: Wind;
  readonly players: readonly [PlayerState, PlayerState];
  readonly terrainOps: readonly TerrainOp[]; // 対戦開始からの地形破壊の履歴
  readonly result: MatchResult | null;
};
```

地形マスクそのものは MatchState に含めない。
初期マスクはマップ名から生成でき、そこに `terrainOps` を順に適用すれば現在の地形が再現できる。
再接続したクライアントはこの履歴を再適用して地形を復元する。
一戦のターン数は多くても 20 なので、履歴の長さは問題にならない。

## 6.3 プレイヤー状態（PlayerState）

```ts
type PlayerState = {
  readonly seat: Seat;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly hp: number;
  readonly x: number;                 // 機体中心の x（整数セル）
  readonly facing: Facing;            // 最後に動いた方向
  readonly connected: boolean;
};

type Facing = -1 | 1;                 // -1 が左、1 が右
```

y 座標と車体の傾きは持たない。
どちらも x と現在の地形から一意に決まるので、持つと不整合の元になる。
描画のたびに地表の高さと傾きの対応表から求める。

色は主色と副色の 2 つで、候補は [グラフィックの方向性](./08-visual-direction.md) の 7 色を名前で持つ。

```ts
type TankColors = {
  readonly primary: PlayerColor;    // 車体、弾、HP バー、名前
  readonly secondary: PlayerColor;  // 砲塔と主砲
};

type PlayerColor =
  | "red"
  | "orange"
  | "yellow"
  | "cyan"
  | "blue"
  | "pink"
  | "purple";
```

## 6.4 風（Wind）

```ts
type Wind = {
  readonly value: number;   // -10 から 10 の整数
  readonly gust: boolean;   // このターンが突風で再抽選されたか
};
```

## 6.5 射撃の入力と結果

```ts
type TrajectoryInput = {
  readonly seat: Seat;
  readonly x: number;        // 移動後の機体 x
  readonly facing: Facing;   // 向き
  readonly elevation: number;// 10 から 90 の整数（度）。車体基準の仰角
  readonly power: number;    // 0 から 100 の整数
  readonly wind: number;     // -10 から 10 の整数
};

type TerrainOp = {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
};

type ShotResult = {
  readonly input: TrajectoryInput;
  readonly impact: { readonly x: number; readonly y: number } | null;
  readonly terrainOp: TerrainOp | null;
  readonly damage: readonly [number, number];
  readonly hpAfter: readonly [number, number];
  readonly xAfter: readonly [number, number];
  readonly ringOut: readonly Seat[];
  readonly finished: MatchResult | null;
};
```

`TrajectoryInput` は弾道を再計算するのに必要なものをすべて含み、それ以外を含まない。
地形は `terrainOps` から復元する前提なので、入力には含めない。
車体の傾きも地形と x から求まるので含めない。
発射角は「傾き + 仰角」を向きに応じて鏡像にした値で、物理コードの中で求める。

## 6.6 対戦結果（MatchResult）

```ts
type FinishReason =
  | "hp"
  | "ringOut"
  | "turnLimit"
  | "surrender"
  | "disconnect";

type MatchResult = {
  readonly winner: Seat | null;   // null は引き分け
  readonly reason: FinishReason;
  readonly turns: number;         // 経過ターン数
  readonly stats: readonly [SeatStats, SeatStats];
};

type SeatStats = {
  readonly damageDealt: number;
  readonly directHits: number;    // 爆心が相手の判定円の内側だった回数
};
```

## 6.7 決定論の契約

弾道再計算方式は、「同じ `TrajectoryInput` と同じ地形から、サーバーとクライアントが同じ `ShotResult` を得る」ことに依存する。
これを保証するため、共有パッケージの物理コードは次の制約を守る。

**整数と固定小数点だけを使う。**
浮動小数点は環境で結果が変わりうるので、位置と速度は固定小数点の整数で持つ。
長さの単位はセルで、小数部は 8 bit（256 分の 1 セル）とする。
弾の位置はセルの中を細かく持つが、当たり判定は「どのセルにいるか」だけで行う。
三角関数は使わず、角度 0 から 180 度の正弦と余弦を固定小数点の表として埋め込む。
車体の傾きは、左右 3 セルの地表の高さの差（-6 から +6）と角度の対応表で求める。
除算は整数除算だけを使い、丸めの方向を仕様として固定する。

**積分の刻みを固定する。**
弾道は一定の刻みで位置と速度を更新する。
刻みは 1 ステップを 1/60 秒相当とし、描画のフレームレートとは切り離す。
描画は計算済みの位置列を補間して描く。

| 項目 | 初期値 |
|---|---|
| 固定小数点の小数部 | 8 bit |
| 積分の刻み | 1/60 秒相当 |
| 重力 | TBD-8（初期案は 1 ステップあたり下向き 0.04 セル/step^2） |
| 風の作用 | TBD-8（初期案は風 1 につき 1 ステップあたり 0.0004 セル/step^2） |
| パワーから初速への換算 | TBD-8（初期案はパワー 100 で 3 セル/step） |

重力、風、初速の 3 つは互いに依存し、マップの大きさと合わせて「最大パワーで画面の 8 割を飛ぶ」「風 10 で着弾が 25 セル程度ずれる」という感触を目標に調整する。
初期案の根拠は次の概算である。
初速 3 セル/step を 45 度で撃つと鉛直成分は約 2.1 セル/step、重力 0.04 なら滞空は約 106 ステップになる。
風 10 で 0.004 セル/step^2 の横加速が 106 ステップ続くと、ずれは約 22 セルになる。
水平方向の到達距離は約 225 セルで、幅 400 セルの 6 割弱にとどまるので、初速か重力は調整が要る。

**地形の判定は整数セルで行う。**
弾の位置を整数に丸めてマスクを見る。
1 ステップで複数セルを進む場合は、前の位置との間を 1 セルずつ辿り、最初に地面か機体に触れたセルを着弾点とする。
この辿り方も仕様として固定する。

**地形の削りは整数の円で行う。**
爆心と半径から、マスク上のどのセルを消すかは整数演算だけで決める（`dx*dx + dy*dy <= r*r`）。

**発射位置は機体の位置と発射角から決める。**
弾は主砲の先端から出る。
発射角は、車体の傾きと仰角の和を、向きが右ならそのまま、左なら 180 度から引いた値とする。
主砲の付け根は機体中心の 1 セル上とし、そこから発射角の方向に主砲の長さだけ進んだ点を発射位置とする。
主砲の長さは 4 セルで、機体の判定半径 3 セルより長いので、発射直後の弾が自機に当たることはない。
発射位置の計算も固定小数点の正弦と余弦の表で行い、浮動小数点を使わない。

| 項目 | 初期値 |
|---|---|
| 主砲の付け根 | 機体中心の 1 セル上 |
| 主砲の長さ | 4 セル |

**乱数を使わない。**
物理コードは乱数を持たない。
風の抽選はサーバーだけが行い、結果を数値として送る。

**入力以外の状態を読まない。**
物理コードは `TrajectoryInput`、現在の地形マスク、両者の x だけを読む。
時刻、環境変数、グローバル状態を読まない。

## 6.8 契約の検証

契約が守られていることは、テストで固定する。

- **golden replay**：代表的な入力（角度とパワーの組み合わせ、風の端の値、山越え、リングアウト）について `ShotResult` を記録し、コードを変えても同じ結果が出ることを確認する。記録する入力は `TrajectoryInput` に加えて、地形マスクの初期状態と適用済みの `terrainOps`、両者の x を含める。この 3 つがなければ 1 発の射撃を再現できないからである。
- **クロス環境**：同じテストを Node とブラウザ（Playwright）で実行し、結果を比較する。
- **不整合の記録**：本番でクライアントの再計算がサーバーの `turn.result` と食い違ったら、その `TrajectoryInput` を記録する。これが契約違反の発見手段になる。

物理コードを変更したら golden replay を更新する。
更新の差分が意図した変更だけであることを、レビューで確認する。
