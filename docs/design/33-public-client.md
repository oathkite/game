# 33. 通常起動と配信用クライアント

KEROPODの入口を`/`へ統合。`?prototype=world`も同じ画面になる。
招待URLの`?room=ABCDEF`はタイトルを省略して部屋画面へ進む。
旧1対1UIは開発時のみ`?prototype=legacy`から確認できる。
`?prototype=camera`と`?prototype=network`も開発専用。

## 接続先

- `VITE_ROOM_SERVER_URL`指定時はそのHTTP originの`/v2/rooms`、`/v2/quick`、部屋別WebSocketを使う。
- 配信用buildで未指定の場合は同一originの`/v2/*`へ接続。公開時にはWorkerへのroutingが必要。
- 開発時の未指定だけNode8795へ直接接続する。
- 本番の許可Origin、domain、Worker routing、配備順序は公開gate。今回の変更はデプロイを行わない。

保存済み音量・ミュートは画面起動時に適用する。音声の再生開始はユーザー操作時。
固定8席の試験リンクやプレビュー表記を配信用画面に表示しない。
旧UIのE2Eはlegacy URLへ移し、新しい通常入口はproduction.config.tsで実際のbuild/previewを検証する。

## 残る公開準備

- 配信最適化・日英表示・イントロ・音イベント・診断は接続済み。正規packの人間承認、最終アートレビューは未完了。
- 長時間試験の完走確認、実機・実地域の性能、実DO容量/費用、運営/法務の公開判断。ローカル検証をこれらの代替とはしない。
- 最後に承認済みデザイン原案と比較してUIを調整。

## 画面コードの再取得

配信buildは`assets/chunks.json`を出力する。通常はViteのdynamic importとCSS preloadを使い、初期表示ではmanifestを取得しない。
画面取得エラーからの再読み込みでは、URLにsceneRetryを付ける。通常importが再び失敗した場合だけ、manifestにある同一originの画面entryを新しいquery付きURLで取得する。WebKitで失敗したmodule URLが再読み込み後も再取得されないケースへの対応。
再読み込みURLは既存の部屋queryを保持する。manifest取得失敗もエラー画面へ戻し、無限自動再試行はしない。配信時はmanifestを他のassetsと一緒に含める。
