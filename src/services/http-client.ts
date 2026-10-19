function getApiBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env;
  if (env?.VITE_API_BASE_URL) return env.VITE_API_BASE_URL;
  // Vite reemplaza import.meta.env.DEV por una constante en el build: el backend local no
  // queda en el bundle de producción, que usa el mismo dominio (Nginx redirige /api).
  return import.meta.env.DEV ? 'http://localhost:8080/api/v1' : '/api/v1';
}

/**
 * Base absoluta de la API, siempre terminada en "/". En producción
 * VITE_API_BASE_URL es relativa ("/api/v1", mismo dominio detrás de Nginx) y
 * `new URL(path, base)` no acepta una base relativa: se resuelve contra el
 * origen de la página. Una base absoluta (desarrollo) queda igual. Sin
 * `window` (pruebas en Node) el origen es "http://localhost".
 */
export function resolveApiBaseUrl(baseUrl: string = getApiBaseUrl()): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';
  return new URL(`${baseUrl.replace(/\/+$/, '')}/`, `${origin}/`).href;
}

type RefreshHandler = () => Promise<string | null>;
type UnauthorizedHandler = () => void;
type HttpClientInit = RequestInit & {
  auth?: {
    skipAuthorization?: boolean;
    skipRefresh?: boolean;
  };
  /** `blob` lee el cuerpo como binario (p. ej. una imagen) en vez de JSON o texto. */
  responseType?: 'blob';
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly data?: unknown,
  ) {
    super(getUserFacingHttpErrorMessage(status, data));
    this.name = 'HttpError';
  }
}

const TECHNICAL_ERROR_TEXT =
  /^(?:http\s*\d{3}|(?:type|reference|syntax|range|uri|aggregate)?error:|internal server error|internal error|bad gateway|service unavailable|gateway timeout|bad request|forbidden|unauthorized|access denied|not authorized|authentication required|not found|conflict|unprocessable entity|(?:an? )?unexpected error occurred|(?:an? )?error occurred while processing the request|something went wrong|fetch failed|networkerror|request failed with status code|cannot (?:read|access) properties of|unexpected token|invalid .* (?:character|json|token))|\b(?:access denied:\s*\/|endpoint not found|no handler found for|exception|stacktrace|stack trace|sqlstate|hibernate|jdbc|org\.springframework|java\.[a-z]+\.|could not execute|failed to execute|constraint violation|transaction rollback| at [\w$.]+\()/i;

function isSafeBackendMessage(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const message = value.trim();
  return (
    message.length > 0 &&
    message.length <= 500 &&
    !TECHNICAL_ERROR_TEXT.test(message) &&
    !/[<>]/.test(message)
  );
}

/** Read supported API error envelopes without exposing framework/exception text. */
export function getControlledBackendMessage(data: unknown, depth = 0): string | undefined {
  if (depth > 3) return undefined;
  if (typeof data === 'string') return isSafeBackendMessage(data) ? data.trim() : undefined;
  if (!data || typeof data !== 'object') return undefined;

  const body = data as Record<string, unknown>;
  for (const key of ['message', 'detail', 'userMessage', 'description', 'title']) {
    if (isSafeBackendMessage(body[key])) return body[key].trim();
  }

  for (const key of ['errors', 'violations']) {
    const errors = body[key];
    if (Array.isArray(errors)) {
      const messages = errors
        .map((entry) => {
          if (typeof entry === 'string') return isSafeBackendMessage(entry) ? entry.trim() : '';
          if (!entry || typeof entry !== 'object') return '';
          const value = entry as Record<string, unknown>;
          const message = value.message ?? value.defaultMessage ?? value.detail;
          return isSafeBackendMessage(message) ? message.trim() : '';
        })
        .filter(Boolean);
      if (messages.length) return [...new Set(messages)].join(' ');
    }
    if (errors && typeof errors === 'object') {
      const messages = Object.entries(errors as Record<string, unknown>).flatMap(
        ([field, value]) => {
          const values = Array.isArray(value) ? value : [value];
          return values
            .filter(isSafeBackendMessage)
            .map((message) => `${field}: ${message.trim()}`);
        },
      );
      if (messages.length) return [...new Set(messages)].join(' ');
    }
  }

  if (isSafeBackendMessage(body.error)) return body.error.trim();
  for (const key of ['error', 'data', 'payload', 'response']) {
    const nested = getControlledBackendMessage(body[key], depth + 1);
    if (nested) return nested;
  }
  return undefined;
}

function getUserFacingHttpErrorMessage(status: number, data?: unknown): string {
  const controlled = getControlledBackendMessage(data);
  if (controlled) return controlled;
  if (status === 400 || status === 422) return 'Revisa los datos ingresados e intenta de nuevo.';
  if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (status === 403) return 'No tienes permiso para realizar esta acción.';
  if (status === 404)
    return 'No encontramos la información solicitada. Actualiza e inténtalo de nuevo.';
  if (status === 409) return 'La información cambió. Actualiza e inténtalo de nuevo.';
  if (status === 429)
    return 'Hay muchas solicitudes en curso. Espera un momento e inténtalo de nuevo.';
  if (status >= 500) return 'No pudimos completar la operación. Intenta nuevamente.';
  return 'No pudimos completar la solicitud. Intenta nuevamente.';
}

/** Converts transport and HTTP failures into readable, non-technical UI copy. */
export function getUserFacingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    return getControlledBackendMessage(error.data) ?? getUserFacingHttpErrorMessage(error.status);
  }
  if (error instanceof TypeError) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
  if (error instanceof Error && isSafeBackendMessage(error.message)) return error.message.trim();
  return fallback;
}

export class HttpClient {
  private token?: string;
  private refreshHandler?: RefreshHandler;
  private unauthorizedHandler?: UnauthorizedHandler;
  private refreshPromise?: Promise<string | null>;

  setToken(token: string): void {
    this.token = token;
  }

  setRefreshHandler(handler: RefreshHandler): void {
    this.refreshHandler = handler;
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler): void {
    this.unauthorizedHandler = handler;
  }

  clearToken(): void {
    this.token = undefined;
  }

  get<T>(path: string, init?: HttpClientInit): Promise<T> {
    return this.request<T>('GET', path, undefined, init);
  }

  post<T>(path: string, body?: unknown, init?: HttpClientInit): Promise<T> {
    return this.request<T>('POST', path, body, init);
  }

  put<T>(path: string, body?: unknown, init?: HttpClientInit): Promise<T> {
    return this.request<T>('PUT', path, body, init);
  }

  patch<T>(path: string, body?: unknown, init?: HttpClientInit): Promise<T> {
    return this.request<T>('PATCH', path, body, init);
  }

  delete<T>(path: string, init?: HttpClientInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, init);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: HttpClientInit,
    hasRetried = false,
  ): Promise<T> {
    const response = await this.fetchResponse(method, path, body, init);
    const data =
      response.ok && init?.responseType === 'blob'
        ? await response.blob()
        : await this.parseResponse(response);
    if (response.ok) return data as T;

    if (response.status === 401 && !hasRetried && !init?.auth?.skipRefresh && this.refreshHandler) {
      const token = await this.refreshAccessToken();
      if (token) {
        this.setToken(token);
        return this.request<T>(method, path, body, init, true);
      }
      this.unauthorizedHandler?.();
    }
    throw new HttpError(response.status, response.statusText, data);
  }

  private async fetchResponse(
    method: string,
    path: string,
    body?: unknown,
    init?: HttpClientInit,
  ): Promise<Response> {
    const url = new URL(path.replace(/^\/+/, ''), resolveApiBaseUrl());
    const headers = new Headers(init?.headers);
    // Multipart: el navegador arma el Content-Type con su boundary; fijarlo a mano lo rompe.
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (init?.responseType !== 'blob') headers.set('Accept', 'application/json');
    if ((body !== undefined || init?.body !== undefined) && !isFormData)
      headers.set('Content-Type', 'application/json');
    if (this.token && !init?.auth?.skipAuthorization)
      headers.set('Authorization', `Bearer ${this.token}`);

    const requestInit: RequestInit = { ...(init ?? {}) };
    delete (requestInit as HttpClientInit).auth;
    delete (requestInit as HttpClientInit).responseType;
    try {
      return await fetch(url, {
        ...requestInit,
        credentials: requestInit.credentials ?? 'include',
        method,
        headers,
        body: body === undefined ? requestInit.body : isFormData ? body : JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('No pudimos conectar con el servicio. Intenta nuevamente.');
      }
      throw error;
    }
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    return response.status === 204
      ? undefined
      : contentType.includes('application/json')
        ? await response.json()
        : await response.text();
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshHandler) return null;
    this.refreshPromise ??= this.refreshHandler().finally(() => {
      this.refreshPromise = undefined;
    });
    try {
      return await this.refreshPromise;
    } catch {
      this.unauthorizedHandler?.();
      return null;
    }
  }
}

export const httpClient = new HttpClient();
export default httpClient;
