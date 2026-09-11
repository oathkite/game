# 残り時間計の台座

原案 `output/imagegen/game-screen-functional-v1/desktop-refined-v4.png` の上部中央に張り出した計器台座に合わせ、desktopの残り時間計に濃紺の台座と青灰色の縁を追加。CSSの疑似要素で描き、pointer-eventsは無効。既存のtimerと戦場のlayout寸法は維持する。

1440×900の開発版をChromium / Firefox / WebKitで確認。timer本体は各browserで64×64、y=6。設定dialogを開けること、667×375では台座を生成しないことを確認した。静的CSS変更のためunit testは追加しない。

[Chromium実画面](./cockpit-bezel-2026-09-11.png)

UI全体の正式採用や実機試験の証明ではない。直前の統合90件はe530142の証拠であり、このCSS調整後のproduction再検証ではない。
