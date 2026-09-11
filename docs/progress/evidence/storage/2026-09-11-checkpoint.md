# 圧縮地形checkpoint

32個以上のopが増えた射撃更新で、最新maskを列のsolid区間へ圧縮し、match_idと適用済みopCountとともに保存する。状態・op追加・checkpointは同じtransaction。通常移動時にはcheckpointを更新しない。再戦/部屋帰還で旧checkpointを消去する。全opはclientへの既存配信契約に必要なので保持する。

読込時はcheckpointのversion・寸法・適用数・区間の境界/重なり・checksumを検証し、残りopだけをmaskへ適用する。checksumは偶発的な変更検出用のFNV-1aで、認証用の署名ではない。不正なcheckpointは復元失敗として隔離される。checkpointのない旧保存は全opから復元する。

## 検証

- codec/Battle snapshotの7件、SQL adapter1件成功。穴＋末尾op、形式不正、40op checkpoint＋5op尾部の一致、checkpoint更新のrollback、再戦時の削除を確認。
- engine/serverのNode・Cloudflare型チェック成功。
- 8人・混合武器の75/69発fixtureで、各段階のSQLite読込後の全stateとmaskが元状態に一致。終盤の適用opは296→5、262→27。
- Node100回のp95: 全履歴Battle復元3.815/3.188ms、SQL hydrateを含むcheckpoint Room復元2.401/2.168ms。測定対象の処理範囲が異なり、実行間の揺れもあるため、一律の改善率やCloudflare CPU削減率にはしない。
- local edgeの既存replaying中SIGKILL→同一match/地形→generation2→重複発射拒否も成功。ただしこの短いシナリオは32op未満なので、checkpointを保存した後のlocal edge SIGKILLは追加検証が必要。

32opは初期の実装値。実DOのcheckpoint作成CPU・保存量・料金と復元負荷を測って調整する。checkpoint JSONと履歴テーブル自体の保存量は必要で、全履歴を削除して容量が一定になる方式ではない。
