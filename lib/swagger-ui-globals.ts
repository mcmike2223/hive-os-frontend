export {};

type SwaggerUiInstance = {
  destroy?: () => void;
};

type SwaggerUiRequest = {
  headers?: Record<string, string>;
};

type SwaggerUiConfig = {
  spec?: unknown;
  domNode?: HTMLElement;
  deepLinking?: boolean;
  docExpansion?: string;
  filter?: boolean;
  displayRequestDuration?: boolean;
  tryItOutEnabled?: boolean;
  presets?: unknown[];
  layout?: string;
  requestInterceptor?: (request: SwaggerUiRequest) => SwaggerUiRequest;
};

export type SwaggerUIBundleFn = {
  (config: SwaggerUiConfig): SwaggerUiInstance;
  presets: { apis: unknown };
};

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIBundleFn;
    SwaggerUIStandalonePreset?: unknown;
    hiveSwaggerUi?: SwaggerUiInstance | null;
  }
}
