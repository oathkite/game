# AI と二人でゲームを作った話

TANK SHOOT を AI と二人で作った経緯を話す、4 分 49 秒のプレゼンテーション動画とその制作一式。
社内のメンバーに向けて作り、会社のサイトで社外にも公開する予定である。

- 動画：[TANK-SHOOT-presentation-20261001.mp4](TANK-SHOOT-presentation-20261001.mp4)（1920×1080、30fps、14 MB）
- Web で見る（章ごとに頭出しできる）：https://claude.ai/artifact/Y3Ecw8KpZ5jixiGKb4i6cz
- 台本：[script.md](script.md)

## 作り方

台本と映像は Claude Code が作った。
ナレーションは作者本人の録音である。
はじめは ElevenLabs で作者の声を合成したが、イントネーションが不自然だったので録音に切り替えた。

映像は、章ごとの絵を HTML の canvas に時刻の関数として描き、1 コマずつ撮って動画にしている（`video/stage.js` と `video/chapters/ch<章>.js`）。
録音を音声認識にかけて各行の話し始めの時刻を取り、その時刻で場面を切り替える。
BGM はゲームの曲（hangar、ridgeline、result）を一定の音量で敷いている。

## 作り直す手順

すべてリポジトリのルートで実行する。
ffmpeg、Python 3、Node.js、Playwright の Chromium が要る。
`render.mjs` などは Playwright をメインのチェックアウトの `node_modules` から読む。
別の場所にあるときは `PLAYWRIGHT_PATH` に `playwright/index.mjs` のパスを渡す。

1. 録音ツールのサーバーを起動する：`python3 presentation/recorder_server.py`（8771）。録音と、以下の撮影の両方で使う
2. 録音する：http://localhost:8771/recorder.html を開き、章ごとに録って「採用する」を押す。録音は `recordings/ch<章>-take<番号>.webm` に残り、採用した take は `recordings/selections.json` に書かれる
3. ノイズを減らして音量をそろえる：`python3 presentation/clean_audio.py`（`recordings/clean/ch<章>.wav`、-16 LUFS）
4. 各行の話し始めの時刻を取る：`python3 presentation/cues.py`（`cues.json`）。ElevenLabs の音声認識を使い、API キーは macOS のキーチェーン（サービス名 `elevenlabs-api-key`）から読む。書き起こしは `recordings/clean/ch<章>.stt.json` に残し、次からは使い回す
5. 映像の素材を作る：`PROMO=… X_VIDEO=… presentation/video/prepare-assets.sh`。素材の出どころは、スクリプトの先頭に書いた
6. 章ごとの映像を書き出す：`presentation/video/render-all.sh`（`video/out/ch<章>.mp4`）。途中の絵は `node presentation/video/stills.mjs <章> <秒...>` で確かめられる
7. つないで BGM を敷く：`python3 presentation/video/assemble.py`（`video/out/presentation.mp4`、63 MB）
8. 配信用に縮める：`ffmpeg -i presentation/video/out/presentation.mp4 -c:v libx264 -preset slow -crf 34 -tune animation -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart presentation/TANK-SHOOT-presentation-20261001.mp4`

素材（`video/assets/`、約 290 MB）、書き出した映像（`video/out/`）、処理した音声は大きいので git に入れていない。
上の手順で作り直せる。

## 素材の出どころと注意

- 5 章の X の作例は、Rehan Sheikh さんの投稿（https://x.com/rehan_shei/status/2102794467032154206）の動画を、本人の了承を得て使っている。元の動画はリポジトリに入れていない
- 「ポトリス 2」は名前だけを出し、画像は権利の扱いが難しいので使っていない
- `video/artifacts/` は作者のアーティファクト（初日のモック Radar Fortress、地形スケッチ、演出案）の写しで、`capture.mjs` が動かして撮る
- 次の場面は実際の映像ではなく、説明のために描いた図である
  - 1 章：初日のモックの上で弾が飛んで地面が削れる動き
  - 3 章：言葉で頼んで返ってきた地形の曲線。地形スケッチを描く操作はスクリプトの自動操作
  - 0 章：8 台の戦車（アイコン）
  - 5 章と 7 章：開発期間の線の上の「Opus 5.5」の位置（目分量）
- `tts.py` は合成音声を試したときのスクリプトで、今の動画では使っていない。`cues.py` が台本の読み込みにだけ使っている
