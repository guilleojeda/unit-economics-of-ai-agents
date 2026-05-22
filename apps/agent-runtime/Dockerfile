FROM node:24-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/agent-runtime ./apps/agent-runtime

RUN pnpm install --frozen-lockfile --filter @agentcore-pdf-translator/agent-runtime...
RUN pnpm --filter @agentcore-pdf-translator/agent-runtime build
RUN pnpm --filter @agentcore-pdf-translator/agent-runtime deploy --legacy --prod /runtime

FROM node:24-slim
WORKDIR /app

COPY --from=builder /runtime ./

RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore

EXPOSE 8080 8000 9000

CMD ["node", "dist/agent.js"]
