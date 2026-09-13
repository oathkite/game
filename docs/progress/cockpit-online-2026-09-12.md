# 計器盤変更後のオンライン統合検証

対象のゲームコードはb87a72d（計器盤・移動残量・角度計の収容修正）。本番配備は行っていない。

## モバイルの移動残量

`pnpm --filter @game/e2e exec playwright test --config dev.config.ts resize-input.spec.ts`

Chromium / Firefox / WebKitの3件成功（39.6秒）。独立2contextの実Roomで、回転後にタッチの1歩移動を行い、操作側の残量30→29がサーバーframeと一致することを追加確認。待機側の残量は0を維持する。キャンセルした長押しから発射せず、新しいタップで1発だけ発射する既存確認も維持。

## 配信用ビルドの8人対戦

`pnpm --filter @game/e2e exec playwright test --config online-terrain.config.ts eight-players.spec.ts`

local Wrangler、rock-arch v2、独立8contextの4v4。3ブラウザ成功、全体4.7分。

| browser | 実行時間（runner表示） | 初回対戦までのencoded transfer最大 |
| --- | --- | --- |
| Chromium | 1.1分 | 6,999,490B |
| Firefox | 25.5秒 | 6,969,726B |
| WebKit | 3.0分 | 7,653,325B |

8人のカード、844/667pxでの可読性、射撃再生とタイマー、次の手番、設定中の手番通知、降参によるチーム決着、全員の成績一致と部屋帰還を確認。自然射撃のみの決着ではなく、テストの終了手順は降参を使用。
全contextで8MB以内。WebKitの実行時間は上限180秒に近いため、短時間で安定するとは主張しない。成功結果を実機・地域間遅延・DO容量の証拠にはしない。

e2e型チェックとdiff checkも成功。最新の配信UI全111件を再実行した結果ではなく、今回の対象は上記6件。
