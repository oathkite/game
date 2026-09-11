# 初回設定画面のカメラ調整レイアウト

タイトル→ロビー→設定と進み、練習を一度も読み込まない場合、カメラ設定のCSSが練習画面のchunkに残っていた。説明文がinlineのままリセットボタンの隣へ回り込み、値の左右配置やfieldsetの見た目も変わっていた。

既存の7ルールを `prototype.css` から `cameraSettings.css` へ移し、`CameraSettingsPanel` が直接importする。練習を開いたかどうかで表示が変わらないようにし、重複ルールは残さない。

`production-tests/camera-settings-layout.spec.ts` を追加。修正前は初回設定の説明文display検査で失敗。修正後はChromium / Firefox / WebKitの3件成功（13.7秒）。390×844で説明文がボタンの下に来ることと値の左右配置、その後667×375の練習内設定でも説明がblockになることを検証。client/e2e typecheck成功。

[修正後の初回設定画面](./settings-first-entry-390.png)

全UIの採用判断や実機検証を完了扱いにしない。
