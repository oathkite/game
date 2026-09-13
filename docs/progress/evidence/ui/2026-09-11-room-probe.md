# 入室前のRoom応答測定

新規作成・一覧/コード参加・quick・観戦で接続先を解決した後、席へ参加する前にそのRoom ObjectへのHTTP GET /probeを測る。Roomの保存済み状態が存在することだけを確認し、RoomRuntimeの更新・WS確保・参加・Directory参照は行わない。Origin検証・no-store・IP単位のprobe rate limitを適用する。

ブラウザーのperformance.nowで往復を計測する。待機画面には「入室前の応答 N ms」、300ms超では遅延が大きい旨を表示する。HTTP接続・Worker経由・cold startを含む単発値であり、継続WS RTTや地域p95とは異なる。測定後に自動で入室を続ける。2秒timeout/失敗はnullとして表示せず、入室を妨げない。再接続には追加待ちを挟まない。古い接続試行の結果は反映しない。

## 検証

- client unit: 実Room URL・単調時計・no-store・失敗/不正応答・2秒timeoutとtimer解放を確認。既存transport3件と翻訳coverageも成功。
- client/server/e2e型チェック成功。
- 配信build＋local edgeの独立3contextで、公開一覧参加→応答ms表示→対戦開始→観戦をChromium/Firefox/WebKitで確認（3件、26.2秒）。
- local edgeの21部屋それぞれでprobe成功・roomId一致・probe後の参加者0を確認し、続いて通常参加と一覧ページングを確認。

VITE_ROOM_SERVER_URL指定または本番同一Origin向け。従来の開発用Node WS接続では測定しない。最小RTTの地域自動選択・複数回サンプルによる地域比較・実環境の地域性能測定は残る。quickは割当後の部屋を測るため、これは地域選択用の測定を置き換えない。
