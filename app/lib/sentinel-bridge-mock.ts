const MOCK_JWT =
  "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0.mock.dev.token";

const MOCK_HANDLERS: Record<string, () => string> = {
  onRequestInitialData: () => MOCK_JWT,
};

const IOS_HANDLERS = ["onRequestInitialData", "onCompleteKYCProcess"];

function hasNativeBridge() {
  const w = window as Window & {
    SentinelBridge?: Record<string, unknown>;
    webkit?: { messageHandlers?: Record<string, unknown> };
  };

  const iosHandlers = w.webkit?.messageHandlers;
  const hasIos =
    !!iosHandlers &&
    IOS_HANDLERS.some((name) => !!iosHandlers[name]);

  return !!w.SentinelBridge || hasIos;
}

function replyWithHandler(
  w: Window & { onResponseInitialData?: (jwt: string) => void },
  handlerName: string,
) {
  const handler = MOCK_HANDLERS[handlerName];

  setTimeout(() => {
    if (handler) {
      (globalThis as unknown as typeof w).onResponseInitialData?.(handler());
    }
  }, 150);
}

export function installDevBridgeMock() {
  if (process.env.NODE_ENV !== "development") return false;
  if (typeof window === "undefined") return false;
  if (hasNativeBridge()) return false;

  const w = window as Window & {
    SentinelBridge?: Record<string, (...args: unknown[]) => void>;
    webkit?: {
      messageHandlers?: Record<
        string,
        { postMessage: (msg: { payload: unknown }) => void }
      >;
    };
    onResponseInitialData?: (jwt: string) => void;
  };

  w.SentinelBridge = {
    onRequestInitialData: () => {
      console.log("[SentinelBridge] [DEV MOCK] android ← onRequestInitialData");
      replyWithHandler(w, "onRequestInitialData");
    },
    onCompleteKYCProcess: () => {
      console.log("[SentinelBridge] [DEV MOCK] android ← onCompleteKYCProcess");
    },
  };

  w.webkit = {
    messageHandlers: {
      onRequestInitialData: {
        postMessage: (message) => {
          console.log("[SentinelBridge] [DEV MOCK] ios ← onRequestInitialData", message);
          replyWithHandler(w, "onRequestInitialData");
        },
      },
      onCompleteKYCProcess: {
        postMessage: (message) => {
          console.log("[SentinelBridge] [DEV MOCK] ios ← onCompleteKYCProcess", message);
        },
      },
    },
  };

  console.log("[SentinelBridge] [DEV MOCK] installed for browser testing");
  return true;
}
