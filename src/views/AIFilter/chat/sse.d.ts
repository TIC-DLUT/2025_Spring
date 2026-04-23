export class SSE {
  constructor(
    url: string,
    options?: {
      headers?: Record<string, string>;
      payload?: string;
      method?: string;
      withCredentials?: boolean;
      start?: boolean;
      debug?: boolean;
    },
  );
  addEventListener(type: string, listener: (e: any) => void): void;
  removeEventListener(type: string, listener: (e: any) => void): void;
  stream(): void;
  close(): void;
  readyState: number;
  static INITIALIZING: -1;
  static CONNECTING: 0;
  static OPEN: 1;
  static CLOSED: 2;
}
