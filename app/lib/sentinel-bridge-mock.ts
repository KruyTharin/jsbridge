const MOCK_USER = {
  name: "Dev User",
  email: "dev@example.com",
  phone: "+1 555-0100",
  address: "123 Dev Street",
  city: "San Francisco",
  state: "CA",
  zip: "94105",
  country: "US",
  createdAt: new Date().toISOString(),
};

const MOCK_HANDLERS: Record<string, () => unknown> = {
  getUser: () => MOCK_USER,
};

function hasNativeBridge() {
  const w = window as Window & {
    SentinelBridge?: { postMessage?: (msg: string) => void };
    webkit?: { messageHandlers?: { SentinelBridge?: unknown } };
  };

  return (
    !!w.SentinelBridge?.postMessage ||
    !!w.webkit?.messageHandlers?.SentinelBridge
  );
}

export function installDevBridgeMock() {
  if (process.env.NODE_ENV !== "development") return false;
  if (typeof window === "undefined") return false;
  if (hasNativeBridge()) return false;

  const w = window as Window & {
    SentinelBridge?: { postMessage: (msg: string) => void };
    onNativeMessage?: (message: unknown) => void;
  };

  w.SentinelBridge = {
    postMessage: (raw: string) => {
      let message: { id?: string; method?: string };
      try {
        message = JSON.parse(raw);
      } catch {
        console.warn("[SentinelBridge] [DEV MOCK] invalid message", raw);
        return;
      }

      console.log("[SentinelBridge] [DEV MOCK] native received ←", message);

      const handler = message.method ? MOCK_HANDLERS[message.method] : undefined;

      setTimeout(() => {
        if (handler && message.id) {
          w.onNativeMessage?.({ id: message.id, data: handler() });
          return;
        }

        if (message.id) {
          w.onNativeMessage?.({
            id: message.id,
            error: `Unknown method: ${message.method}`,
          });
        }
      }, 150);
    },
  };

  setTimeout(() => {
    console.log("[SentinelBridge] [DEV MOCK] sending bridgeReady");
    w.onNativeMessage?.({ event: "bridgeReady" });
  }, 300);

  console.log("[SentinelBridge] [DEV MOCK] installed for browser testing");
  return true;
}
