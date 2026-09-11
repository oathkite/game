# クイック参加の地域自動選択

オンライン入口で、選択中modeの地域別Directory（asia/europe/americas）を各3回HTTP測定する。各地域2回以上成功した場合の中央値（2回なら大きい方）を比較し、最小の地域を選ぶ。候補なしなら地域を未選択とし、手動選択を案内する。手動選択後はmode変更に伴う再測定でも上書きしない。取得中も手動選択できる。画面退出時はabortし結果を反映しない。

測定は1回2秒で打ち切り、全地域を並行処理する。room allocation・席予約は行わない。地域・modeをサーバーで検証し、Origin制限、no-store、probe用IP rate limitを適用する。表示は「地域別の応答」であり、地域名から遅延を推測しない。従来Node開発接続では測定せず、地域選択を維持する。

DirectoryへのHTTP応答は地域候補を比べる目安。locationHintは配置保証ではなく、DirectoryとRoomが同じ場所にあるとは保証しない。選ばれた実RoomのHTTP応答も入室直前に別途測る。継続WS RTT・地域p95・公平性保証とは区別する。招待された部屋を自動で別地域へ変更しない。

## 検証

- client unitで最小の有効値選択・全失敗・各地域3回・事前abortを確認。翻訳coverage、client/server/e2e型チェック成功。
- 配信buildで低応答地域の自動選択→手動変更→mode変更でも維持→POSTのregion一致、全失敗時の未選択/手動復帰を3browser各2件、計6件確認（20.3秒）。測定応答はブラウザーで遅延を付けたstubを使用。
- local edgeで3地域×2modeのprobe成功と応答一致、不正mode400を確認。既存21部屋のRoom probe・席0・参加・一覧ページングも成功。

実Cloudflare配置での地域別RTT・自動選択の実用性評価は未実施。測定と実Room RTTの差はstagingで測る必要がある。
