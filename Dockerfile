# syntax=docker/dockerfile:1

# --- build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_OLLAMA_MODEL=mistral:latest
ENV VITE_OLLAMA_MODEL=$VITE_OLLAMA_MODEL

RUN npm run build

# --- serve ---
FROM nginx:1.27-alpine

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Runtime: set OLLAMA_URL to your llm-runtime / Ollama host
ENV OLLAMA_URL=http://host.docker.internal:11434

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
