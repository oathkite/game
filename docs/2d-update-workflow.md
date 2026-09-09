# 2Dアップデートのブランチ運用

## 総合ブランチ

`codex/2d-update` を2Dアップデート全体の統合先とする。
最初のコミットには、これまで制作した仕様・コンセプト・スプライト・確認ツール・ハーネスをまとめる。
ゲーム本体への新rendererの組み込みやアバター権限管理は、この時点で完了したとは扱わない。

## 作業の流れ

1. 作業ツリーと現在のブランチを確認する。未コミット変更を勝手に破棄しない。
2. `git fetch origin` で総合ブランチを更新する。
3. `git switch -c codex/2d-<作業名> origin/codex/2d-update` で作業ブランチを作る。別作業がある場合は独立worktreeを使う。
4. 実装・画像・仕様・検証をその作業ブランチで進め、関連するテストを実行してコミット・pushする。
5. PRのbaseを `codex/2d-update` にする。統合はその時点のユーザー指示に従う。
6. 次の作業も更新済みの総合ブランチから分岐する。

仕様変更、画像の差し替え、ペイント調整、キャラクター追加、確認ツールの変更もこの運用に含める。
総合ブランチ完成後の `main` への統合・リリースは別途指示を受けて行う。
`main`へのpushは本番Cloudflareデプロイを起動するが、総合ブランチへのpushでは起動しない。

## 検証

- アセット形式とUnit tests：`pnpm assets:test`、`pnpm assets:check`
- 確認ツール：`pnpm assets:test:browser`
- プロジェクト全体：`pnpm test`、`pnpm -r typecheck`
- 見た目の変更：`pnpm assets:capture`の結果を目視し、制作ルールと回帰検査を更新

APIキーは `.env.imagegen.local` に置き、Git管理対象にしない。
