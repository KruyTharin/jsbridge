const MOCK_JWT =
  "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0.mock.dev.token";

const MOCK_HANDLERS: Record<string, () => string> = {
  onRequestInitialData: () => MOCK_JWT,
};

function hasNativeBridge() {
  const w = window as Window & {
    SentinelBridge?: Record<string, unknown>;
    webkit?: { messageHandlers?: { iOSBridge?: unknown } };
  };

  return !!w.SentinelBridge || !!w.webkit?.messageHandlers?.iOSBridge;
}

function replyWithHandler(
  w: Window & { onResponseInitialData?: (jwt: string) => void },
  handlerName: string,
) {
  const handler = MOCK_HANDLERS[handlerName];

  setTimeout(() => {
    if (handler) {
      // Mirrors native: evaluateJavaScript("onResponseInitialData('\(jwtToken)')")
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
      messageHandlers?: {
        iOSBridge?: {
          postMessage: (msg: {
            handlerName: string;
            payload: unknown;
          }) => void;
        };
      };
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
      iOSBridge: {
        postMessage: (message) => {
          console.log("[SentinelBridge] [DEV MOCK] ios ←", message);
          if (message.handlerName === "onRequestInitialData") {
            replyWithHandler(w, message.handlerName);
          }
        },
      },
    },
  };

  console.log("[SentinelBridge] [DEV MOCK] installed for browser testing");
  return true;
}
