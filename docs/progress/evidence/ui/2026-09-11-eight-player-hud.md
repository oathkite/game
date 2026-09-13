# 8人HUDの可読性

## 発見と修正

前工程で拡大したHUDを、独立した8つのブラウザーcontextによる実4v4対戦で確認。手番順の番号がHPバーの右端と重なっていた。

`assertRosterReadable`でHPバーと番号の矩形交差を検出し、修正前のproduction Chromiumで失敗を再現。その後、番号をカード上部へ移し、名前の右に18pxの余白を確保。HPの残量を番号で隠さないようにした。長い名前の省略とカードの完全なaria-labelは維持。

## 検証範囲

既存eight-players.spec.tsに、8席が画面内に収まること、名前領域・HPバーの最低幅、番号とHPの非重複を追加。1440×900、844×390、667×390で検証する。小画面はviewport変更であり、タッチ入力や実機の検証ではない。

試験用previewは5189、local Wranglerは8798。既存の作業用5186を停止せず、テスト専用ALLOWED_ORIGINSを5189へ変更した。初回は許可オリジン不一致で入室に失敗し、試験設定の補正後に再実行した。本番の許可設定は変更していない。

## 結果

修正後のproduction buildでChromium・Firefox・WebKitの3件成功（合計4.2分）。各テストは8独立contextで入室、準備、射撃共有、4名降参による決着、結果一致、全員帰還まで検証。CSSの非重複だけで対戦完走と判断していない。

音源込みの対戦開始までの累計転送は、Chromium最大7,682,043 B、Firefox最大7,651,772 B、WebKit最大7,652,265 B。各8contextすべて8MB以下。実機・実地域の通信条件の代用にはしない。

e2e TypeScriptとdiff check成功。テスト用一時configを削除。

- [8人のデスクトップHUD（WebKit）](eight-player-hud-desktop.png)
- [667pxのHUD（WebKit、タッチ入力の検証ではない）](eight-player-hud-667.png)

最終アートの承認、地形・搭乗パイロットと原案の照合は継続する。
