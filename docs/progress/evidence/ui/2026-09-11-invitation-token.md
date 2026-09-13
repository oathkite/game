# 期限付き招待リンク

Edge Roomに参加中のplayerは、自分のsession tokenをAuthorizationヘッダーで送って招待を発行できる。spectatorや無効sessionは発行できない。部屋ごとにcrypto.randomUUIDの招待tokenをSQLiteへ保存し、24時間の期限を持つ。有効な間は同じtokenを再利用し、期限後の発行で更新する。

URLはroomコード＋fragmentのinvite token。fragmentは通常のHTTPリクエストに送らず、参加/観戦時の最初のWSメッセージで検証する。tokenを提示した場合、無効/期限切れなら席を与えず専用理由を返す。tokenをオーナー権限やresumeの証明には使わない。6桁コードと公開一覧の直接参加も維持するため、秘密部屋化する変更ではない。既存の有効resumeは招待より優先する。

APIのOrigin/CORSと発行sessionを検証し、invite発行・短コードWS接続にIPごとの120回/60秒の制限を設ける。tokenをlog本文やHTTP queryに追加しない。新しいリンクの期限表示・コピー・発行失敗の再試行をUIへ接続。従来Node開発接続ではコードリンクのままとし、Edge専用テストをNode設定から除外する。

## 検証

- SQLite unitでtoken保持・再構築・未知token・期限境界の拒否・期限後更新を確認。
- local edgeで発行資格なし403、参加者発行200、sessionとは異なるtoken、無効tokenの拒否、有効tokenで参加、コード直参加を確認。
- 配信build＋local edgeでリンク発行→有効期限表示→別contextで参加をChromium/Firefox/WebKit各1件、計3件成功（15.8秒）。
- 配信buildで無効tokenエラー→理由を維持→ロビーへ戻るを3browser確認（8.9秒）。WS応答はstub。
- protocol24件、client招待URL/翻訳テスト、client/server/e2e型チェック成功。

任意のログインや招待の手動失効UIは追加していない。招待期限のunitは時刻を指定するSQL試験で、実環境を24時間待つ検証ではない。公開APIの分散IP負荷や運用上限は別途必要。新しい招待機能の利用には更新後のEdge handlerを維持する。
