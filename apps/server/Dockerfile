# ゲームサーバー。リポジトリのルートをビルドコンテキストにする。
#   docker build -f apps/server/Dockerfile -t fortress-server .
#   docker run -p 8787:8787 fortress-server
FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile --filter @game/server...
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8787/health || exit 1
CMD ["pnpm", "--filter", "@game/server", "start"]
