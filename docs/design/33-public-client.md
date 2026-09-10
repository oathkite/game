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

- アセットの配信最適化と正規pack登録。現在の生成素材を使用しているが、見た目の最終レビューは未完了。
- 日英表示、イントロ、音のイベント同期、診断、長時間/遅延/切断試験。
- 最後に承認済みデザイン原案と比較してUIを調整。
