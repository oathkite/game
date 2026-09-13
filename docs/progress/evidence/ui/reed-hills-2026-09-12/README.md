# 葦の丘 v3 オンライン接続

オンラインカタログを画像地形v3へ更新。素材はmap idとversionの両方で選択する。
保存されたreed-hills v2は元のsurface・heightとタイル表示を維持する。

検証:
- 素材version選択1件、maps92件、BattleSnapshot9件、全対象型検査成功。
- 3マップの全武器/人数/編成と8人混合武器・毎turn保存復元25件成功。
- local SQLite DO＋配信buildで独立2contextの選択→準備→実射撃→地形一致→再接続を3browser確認。
  Chromium16.9秒、Firefox14.7秒、WebKit14.5秒。
- 正常な新旧素材選択と、保存済み旧height200のmapが新height225に置き換わらないことを検証。

未完: 新しい葦の丘の8独立browser完走、苔の谷の画像素材、実機検証、最終アート/UI照合。
本番公開/main統合は行っていない。
