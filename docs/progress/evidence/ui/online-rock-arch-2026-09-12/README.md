# オンライン岩橋

新規マップrock-arch v2を登録。2〜8人のspawnと移動を検証済み。
NetworkFieldは画像地形を読み込み、全破壊履歴から復元する。

検証:
- protocol 27件、maps 89件、server 79件（edge専用4件skip）。
- BattleSnapshot 8件: 既知の旧height形式を現buildへ移行し、旧buildに新solidColumnsを混ぜたデータを拒否。
- 全3マップの武器/人数/全編成と8人混合武器完走・毎turn保存復元25件。
- 配信build＋local SQLite DO、独立2contextでマップ選択→実射撃→地形一致→再接続。Chromium14.1秒、Firefox14.4秒、WebKit13.7秒。
- 最初のブラウザ試験はチーム変更の反映を待たないテスト操作が原因で開始待ちになった。相手画面の反映を確認する手順へ修正後に成功。サーバー開始条件は変更しない。

接続buildのprotocol値を2→3へ変更。旧クライアントは更新が必要。
既知の従来surface保存形式だけを移行する。物理sim/rulesバージョンは変更しない。
既存の苔の谷・葦の丘は引き続き旧タイル素材。他マップの固有画像制作、8独立browserでの新マップ完走、実機検証は残る。
本番公開/main統合は未実施。
