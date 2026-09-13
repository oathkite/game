# 公開部屋一覧

2026-09-11。公開custom部屋を一覧から参加・観戦できるようにした。準備中は参加、対戦中は観戦のみ。満員の操作は無効。作成前に公開一覧へ掲載されることを表示する。

一覧APIは1回20部屋、roomId順のcursor方式。空室・期限切れ・quick部屋を除外する。既存一覧APIとquick割当は変更しない。取得失敗時の更新、追加ページ、schema検証、10秒timeout、画面退出時の中止に対応。

## 検証

- local Wrangler/SQLiteに21部屋を作り、複数ページの上限・重複なし・全対象の掲載・不正cursor400・Origin欠如403を確認。
- 既存edge専用2件（quick割当・再接続など）も成功。protocol24件と全対象typecheck成功。
- 配信buildの一覧取得失敗→更新→追加ページ・満員・対戦中の表示をChromium/Firefox/WebKit各1件で確認。
- local edgeと専用開発clientで独立3contextの部屋作成→一覧参加→開始→一覧観戦を3browserで確認。390×844画像はpublic-rooms.png。
- 同一Origin GETにOriginが付かない場合、Sec-Fetch-Siteがsame-originで、URLのOriginが許可済みなら通す。local HTTPで200を確認。実配備proxy経由は未検証。
- E2Eはproduction-rooms.config.tsに登録。Node専用rooms.config.tsから除外（Node serverには一覧HTTP APIがない）。この追加ケースはc4b9e35の配信build＋分割後local edgeでもChromium/Firefox/WebKitの3件成功（26.3秒）。検証用5189/8798で実行し、ユーザー用5186には干渉していない。

## 残る範囲

通常DEVのNode接続では一覧を表示しない。VITE_ROOM_SERVER_URL指定または本番の同一Origin構成で利用する。一覧は手動更新。既存のDirectoryは単一public DOであり、設計23.3の地域・モード・shard分割は未実装。旧listの100件上限とquick探索も今回変更しない。実Cloudflare配備・世界規模容量・費用の証明ではない。

2026-09-11更新: 後続のDirectory分割とquick探索上限の修正は2026-09-11-directory-partitions.mdを参照。上記の単一DO・quick探索の記載は一覧追加時点の状態。
