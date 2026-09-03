import { goldenDump } from "@game/sim";

// Node で golden replay を走らせて JSON を出す。ブラウザの結果と比べる側。
process.stdout.write(goldenDump());
