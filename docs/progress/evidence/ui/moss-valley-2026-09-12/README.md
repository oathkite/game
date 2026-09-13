# 苔の谷 v3

1870×841のGPT Image素材をalpha cleanupし、500×225の初期solid列へ変換。
右側の空洞と岩床を含む。旧版はid@versionの素材選択でタイル表示を維持。
旧heightマップ生成専用の未使用arena helperをカタログから削除した。

- hash・2〜8人配置/左右移動・空洞への着地を含むmaps95件成功。
- 全3マップの武器/人数/全編成と8人混合武器・毎turn復元25件成功。
- 全対象型検査、素材の版別選択テスト、server79件成功（edge専用4件skip）。
- 配信build＋local SQLite DO、3browser各2contextの選択→実射撃→地形共有→再接続成功。
  Chromium15.6秒、Firefox14.3秒、WebKit13.4秒。
- 最初のブラウザ試験は期待幅400の固定値で失敗。苔の谷の500列を正しく期待するよう変更。
- importerの寸法指定追加後も、既存rock-arch/reed-hills生成データが完全一致することをcmpで確認。

未完: 苔の谷の8独立browser完走、実機性能、最終UI/正式art照合。
再接続直後のスクリーンショットはカメラ追従アニメーション途中を含む。
最終UIではミニマップと機体表示の重なり、および再接続時の初期focusも確認する。
本番公開/main統合は未実施。
