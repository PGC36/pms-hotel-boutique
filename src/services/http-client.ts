const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1';

function getApiBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env;
  return env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
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
    super(`HTTP ${status}: ${statusText}`);
    this.name = 'HttpError';
  }
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
    const baseUrl = getApiBaseUrl();
    const url = new URL(path.replace(/^\/+/, ''), `${baseUrl.replace(/\/+$/, '')}/`);
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
    return fetch(url, {
      ...requestInit,
      credentials: requestInit.credentials ?? 'include',
      method,
      headers,
      body: body === undefined ? requestInit.body : isFormData ? body : JSON.stringify(body),
    });
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
