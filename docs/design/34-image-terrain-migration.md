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
