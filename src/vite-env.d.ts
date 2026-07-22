/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_OLLAMA_MODEL?: string
  readonly VITE_OPENAI_MODEL?: string
  readonly VITE_SCRIPTURA_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
