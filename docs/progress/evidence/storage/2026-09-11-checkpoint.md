# 圧縮地形checkpoint

32個以上のopが増えた射撃更新で、最新maskを列のsolid区間へ圧縮し、match_idと適用済みopCountとともに保存する。状態・op追加・checkpointは同じtransaction。通常移動時にはcheckpointを更新しない。再戦/部屋帰還で旧checkpointを消去する。全opはclientへの既存配信契約に必要なので保持する。

読込時はcheckpointのversion・寸法・適用数・区間の境界/重なり・checksumを検証し、残りopだけをmaskへ適用する。checksumは偶発的な変更検出用のFNV-1aで、認証用の署名ではない。不正なcheckpointは復元失敗として隔離される。checkpointのない旧保存は全opから復元する。

## 検証

- codec/Battle snapshotの7件、SQL adapter1件成功。穴＋末尾op、形式不正、40op checkpoint＋5op尾部の一致、checkpoint更新のrollback、再戦時の削除を確認。
- engine/serverのNode・Cloudflare型チェック成功。
- 8人・混合武器の75/69発fixtureで、各段階のSQLite読込後の全stateとmaskが元状態に一致。終盤の適用opは296→5、262→27。
- Node100回のp95: 全履歴Battle復元3.815/3.188ms、SQL hydrateを含むcheckpoint Room復元2.401/2.168ms。測定対象の処理範囲が異なり、実行間の揺れもあるため、一律の改善率やCloudflare CPU削減率にはしない。
- local edgeの既存replaying中SIGKILL→同一match/地形→generation2→重複発射拒否も成功。この短いシナリオは32op未満。下記でcheckpoint後の検証を追加した。

32opは初期の実装値。実DOのcheckpoint作成CPU・保存量・料金と復元負荷を測って調整する。checkpoint JSONと履歴テーブル自体の保存量は必要で、全履歴を削除して容量が一定になる方式ではない。

## checkpoint保存後のlocal edge再起動

`pnpm --filter @game/server exec tsx scripts/verify-checkpoint-restart.ts` が成功。既定8805を使用し、使用中なら他のprocessを止めず終了する。

1. 通常の部屋作成・2人参加・ready・開始・multiple射撃で45個の地形opを蓄積（checkpoint36＋末尾9）。state/terrainの改変や特殊な射撃受付は使用しない。
2. replaying中に自分で起動したWranglerのprocess groupをSIGKILL。
3. 保存されたcheckpoint適用数をSQLiteから確認し、SQL readerで復元したmaskと、確定frameの全opから復元したmaskを比較。
4. 同じ保存先で再起動し、以前のtokenでgeneration2復帰。同じmatch/地形を受信し、直前の発射再送がduplicateになることを確認。
5. もう一人も復帰し、次手番で通常射撃。再起動前の保存stateから独立にtick/fire計算した結果と、serverの新しい地形op列が一致。

検証serverと保存先はfinallyで破棄する。local workerdの再起動証拠であり、実Cloudflare障害・容量・料金の証明ではない。fbd8dadのCI validateも成功（run34590242046）。
