type PendingRequest = {
  resolve: (data: any) => void;
  reject: (err: any) => void;
};

class SentinelBridge {
  private isReady = false;
  private pending: Record<string, PendingRequest> = {};

  constructor() {
    if (typeof window !== "undefined") {
      (window as any).onNativeMessage = this.handleMessage.bind(this);
    }
  }

  init(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.isReady) return resolve();
        setTimeout(check, 50);
      };
      check();
    });
  }

  private handleMessage(message: any) {
    console.log("📩 From Native:", message);

    if (message.event === "bridgeReady") {
      this.isReady = true;
      return;
    }

    // handle response with requestId
    if (message.requestId && this.pending[message.requestId]) {
      this.pending[message.requestId].resolve(message.data);
      delete this.pending[message.requestId];
      return;
    }

    // fallback events
    if (message.event === "userData") {
      console.log("👤 User:", message.data);
    }
  }

  send(action: string, payload: any = {}) {
    if (!(window as any).SentinelBridge) {
      console.warn("⚠️ Native bridge not available");
      return;
    }

    (window as any).SentinelBridge.postMessage(
      JSON.stringify({ action, payload })
    );
  }

  request<T = unknown>(action: string, payload: any = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const requestId = Date.now().toString();

      this.pending[requestId] = { resolve, reject };

      (window as any).SentinelBridge.postMessage(
        JSON.stringify({
          action,
          payload,
          requestId,
        })
      );

      // optional timeout
      setTimeout(() => {
        if (this.pending[requestId]) {
          reject("Timeout");
          delete this.pending[requestId];
        }
      }, 5000);
    });
  }
}

export const sentinelBridge = new SentinelBridge();
