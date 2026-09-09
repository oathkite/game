# 25. 多人数ルール基盤（工程B・第1段階）

2026-09-10。`codex/2d-multiplayer-rules`。統合先は`codex/2d-update`。

## 実装

`@game/engine/multiplayer`に、物理・ネットワークから独立した純関数を追加した。

- `createRoster(members, seed)`：2〜8人、2チーム以上、重複しないPlayerIdを検証。
  IDを安定順に並べた後、uint32 seedでチーム順・チーム内順を抽選し、交互に取り出してringを作る。
- `nextTurn(state)`：固定ringの脱落者を飛ばし、境界通過でroundを増やす。
  終了済みの対戦では次手番へ進まない。
- `eliminatePlayers(state, playerIds)`：複数人の脱落を一括適用する。重複指定は一度だけ適用。
- `outcome(state)`：生存チームが1つなら勝利、0なら引き分け、2以上なら続行。

入力配列は変更しない。配列indexで本人を識別せず、PlayerIdで関連付ける。
文字列の並びはlocaleに依存させない。同じseed・所属なら入力配列順が違っても同じringになる。
このモジュールは信頼済み内部データ用。通信からの入力は、後続のprotocol v2でスキーマ検証する。

## 呼び出し側の契約

射撃中に途中の勝者を公表しない。全着弾・落下を物理側で解決してから脱落をまとめて渡す。
降参・再接続猶予切れは対象PlayerIdだけを脱落させる。残る味方の行動回数を増やさない。
手番完了を一度だけ確定して`nextTurn`を呼ぶ。重複コマンドの排除は通信・host側の責務。
seedはサーバーが生成・保存し、次の再戦では別seedにする。

## 検証

2〜8人の全58編成を生成し、4種類のseedで順序・round・勝利を確認。
各編成の全脱落部分集合も検査し、生存者が一巡で一度ずつ行動することと、
残存チーム数に応じた続行・勝利・引き分けを確認する。
既存engine・connectionテストも回帰対象とし、全パッケージのtypecheckを実行する。

## 後続工程

これは工程B全体の完了ではなく、手番・所属・決着の基盤。
次は可変人数を物理の射撃結果へ接続し、MapSpecと検証済みspawn、protocol v2、
サーバー確定の移動コマンド、再接続snapshotへ展開する。
12round・20分上限の確定タイミングもmatch lifecycle側で実装する。
8人入室や相手のリアルタイム移動はまだ画面から利用できない。
カメラ試作は別ブランチに保持しており、本変更には含めない。

## 第2段階：物理とMapSpecへの接続（2026-09-10）

- simの弾道計算を可変人数の`simulateCombat`へ共通化。旧`simulateShot`の2席の入出力と決着規則は維持する。
- 新処理では全対象へ同じ着弾のダメージを計算し、HPで脱落した機体を後続の当たり判定から除く。
- `resolveBattleShot`はPlayerIdで確定位置を取得し、全弾道・地形破壊・落下の結果から脱落とチーム勝利を確定する。
  非手番・脱落者の射撃、rosterと一致しない機体一覧を拒否する。
- `createBattle`はMapSpecを使い、seedから決まる順序に配置した初期状態を作る。
- MapSpecの初版はid/version・寸法・地表配列・人数別spawn候補を持つ。500×225までに制限。
  寸法、地表、配置数、機体の重なり、即落下、頭上余白を検証する。
- 幅500の`multiplayer-test-arena`を追加。2〜8人の実験専用で、公開ロビーの選択肢には登録しない。

検証はworkspaceの452テストと全パッケージtypecheckが成功。
旧golden 25件を維持し、8武器の1対1の弾道・地形・HP互換、8機の同時被弾、
7人同時脱落後の勝利、全滅の引き分け、配列順を変えたPlayerId対応を確認した。
人数別spawnは左右へ1歩移動可能で、重なり・即落下がないことを検証した。

### 残る制約

物理の弾道解決順は既存の「弾道ごとに全段を解決」のまま。複数弾道を同一tickで進めるv2の
イベント順序への変更は未実装。同一着弾での複数機ダメージは一括だが、全武器の同時飛行仕様完了とは扱わない。
新MapSpecは地表配列型のみで、洞窟や浮島の生成定義・terrain digestの配布は後続。
spawnは開発用の人数別固定候補であり、チーム対称配置・全編成の競技バランス・最大逆風での
全8武器の到達性の承認はまだない。公開用汎用マップの完成ではない。
protocol v2、移動command、再接続snapshot、射撃重複排除とmatch lifecycle、対戦画面への組み込みは次工程。

## 第3段階：protocol v2の移動契約と確定処理（2026-09-10）

`@game/protocol/v2`にmove.commandとmove.snapshotのstrict schemaを追加。
commandはmatchId・turnId・commandId・moveSeq・direction・stepsのみを受け、
clientの座標・時刻・本人申告は受け取らない。本人はhostが認証済みsessionから渡す。

`handleMove`は既存walkを使い、初期2cell・上限2cellのcreditをサーバー時刻で
100msごとに1cell補充する。1手番30cell、1commandは1〜2歩。壁では移動予算を消費しない。
credit不足は部分成功または拒否。落下後は移動を止め、ring outなら即座に脱落する。
開始時刻以上・deadline未満だけ受け付け、順序飛びは同期要求、古い手番や別人の入力は拒否。
同じseqまたはcommandIdで内容を変えた再送は拒否する。
処理済みcommandの結果とsnapshotは保存し、完全一致の再送には元の結果を返す。
通常20秒×10Hzを収める256件でreceiptを制限し、過剰入力で無制限にメモリを使わせない。

`moveBattle`は確定位置をBattlePlayerへ戻し、致死落下をrosterとチーム決着へ即時反映する。
射撃前の移動が確定stateに残るため、後続の射撃原点もこの位置を使用できる。
`MovementState`はJSON保存可能で、位置・残量・credit時刻・seq・receiptを復元できる。
公開snapshotには位置・向き・残量・ackMoveSeq・eventSeq・serverTime・落下状態のみを含める。

検証：protocolの22テスト、engineの91テスト、全パッケージtypecheckが成功。
重複・順序飛び・なりすまし・旧手番・予算超過・部分受理・壁・落下・締切・保存復元を検査。

### 次に接続するもの

現時点ではWebSocketのv2メッセージ受付や10Hz配信、client予測・相手の補間は未配線。
ここで提供したsnapshotは移動用で、地形を含む対戦全体の再接続snapshotではない。
fireの最終moveSeq検証・commandId重複排除、turn遷移時のcreateMovement、match全体の
単調なeventSeq管理、60秒再接続期限・alarm処理はhost側の後続実装。
致死落下時の結果を通知して、必要なら次手番へ進める責務もhostが持つ。
従来のv1エンドポイントと対戦画面には変更を加えていない。
