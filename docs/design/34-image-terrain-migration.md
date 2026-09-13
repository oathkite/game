# 画像地形の多人数対戦への移行

2026-09-12の実装照合。現時点では練習のrock-archだけが画像由来の地形。
既存オンライン2マップの見た目だけを差し替えることはしない。

## 必要な変更

1. MapSpecに画像alphaから生成した初期solid列を保持する。surfaceだけでは橋下の空洞と独立した下段岩を表現できない。
2. buildMapSpec/createBattleとクライアントの基底mask生成を同じ関数へ接続する。画像は表示専用とし、各ブラウザでalphaから物理を生成しない。
3. mapの送信schema、BattleSnapshot、SQL checkpoint生成に同じ初期solid列を渡す。既存surface形式は読み取り互換を維持し、新mapのversionを区別する。
4. NetworkFieldとNetworkLabの角度計算・表示、自然決着E2Eも共通maskを使用する。
5. 画像rendererは再接続時の全破壊履歴を順に反映する。現在の差分cell削除fallbackだけでは円の縁や装飾が通常再生と一致しないため、表示復元も検証する。
6. 2〜8名のspawn、橋破壊後の落下・下段着地、全員のmask一致、保存復元、独立context再接続を検証してからmapを公開ロビーに登録する。

## 現在の変更対象

- packages/maps/src/spec.ts / catalog.ts
- packages/protocol/src/v2Lab.ts
- packages/engine/src/multiplayer/create.ts / lobby.ts / snapshot.ts
- apps/server/src/cf/roomSqlSnapshot.ts
- apps/client/src/worldUi/NetworkField.tsx
- apps/client/src/networkLab/NetworkLab.tsx
- apps/client/src/game/imageTerrainLayer.ts

## 素材と表示

元画像1672×941。ユーザー指定により標準cellを12から9へ変更した。
高解像度化の完了とは扱わない。全マップの固有造形・素材はこの移行と合わせて制作する。
旧マップの保存中の試合を新しい造形で復元しない。画像hash・map versionと物理定義を一緒に固定する。
本番公開/main統合はこの作業に含めない。

## 共通データの実装状況（2026-09-12）

- optional solidColumnsとbuildInitialTerrainを実装。surface形式は従来どおり復元する。
- MapSpec、通信schema、battleコピー、JSON復元、SQL checkpoint、NetworkField、NetworkLabの角度/表示、自然決着試験の基底maskを接続。
- 練習rock-archとMapSpecのmask一致、通信schemaの維持/不正範囲拒否、JSON復元、SQLiteの40op checkpointから空洞/下段岩復元を確認。
- 画像描画は全履歴・巻き戻し・空履歴の復元を実装し、通常破壊とのピクセル一致をブラウザで確認。旧クライアントとの互換制御、新マップの2〜8人配置・登録は未接続。solidColumns付きマップはまだオンライン一覧に登録していない。
- 既存物理テストは並行実行時に5秒timeoutが4件発生。maxWorkers=1の再検証では110件成功。全対象型検査成功。engine全体の単独実行は継続中。

追加検証: client型検査とe2e型検査成功。client240件成功・weaponDemo1件timeout後、同ファイル17件を単独実行して成功。engineは129件成功・matrix14件timeout後、matrixのみ60秒期限で再実行中。6c29229に画像復元を分離コミット。

2026-09-12更新: matrix試験の長い同期ループがonTaskUpdate通知を止めていたため、ケース間でsetImmediateを待機。比較条件を変えず15件・正常exitを確認（35.8秒、実行時testTimeout60秒）。ROCK_ARCH_SPECの2〜8人配置と左右1歩の安全性を5件の岩橋試験で確認。マップ登録は旧クライアント互換制御と画像loader接続後に行う。

2026-09-12オンライン接続: rock-arch v2を登録、NetworkFieldの画像loaderを接続。protocol build 3で旧クライアントを区別し、旧surface保存buildのみ移行。3browser各2contextの実射撃・再接続で確認。詳細はprogress/evidence/ui/online-rock-arch-2026-09-12。先行する未登録/未接続の記述はこの更新で解消。全マップ素材制作と実機等の残項目は維持。

2026-09-12 葦の丘v3を登録。素材selectorはid@versionで固定し、旧版保存試合はタイルと元のsurfaceを維持する。3browserの2context射撃/再接続成功。詳細はprogress/evidence/ui/reed-hills-2026-09-12。

2026-09-12 苔の谷v3を登録し、通常オンライン3マップの画像地形接続が完了。500×225を維持し、画像alpha由来の空洞/床を共有。3browserの2context射撃/再接続とserver79件成功。全体ゴールは未完で、苔の谷8browser・最終UI・実機/公開前gateを残す。

2026-09-12 検証更新: 苔の谷8contextのChromium/Firefox成功ログに加えてWebKitを完走。射撃共有・降参決着・全員の成績一致と帰還を確認し、画像をprogress/evidence/ui/moss-valley-eight-2026-09-12へ保存。最終UI・実機/公開前gateは引き続き未完。
