"use client";

import { useEffect, useState } from "react";
import { sentinelBridge } from "./lib/sentinel-bridge";

type BridgeStatus = "loading" | "ready" | "error";

interface User {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  createdAt: string;
}

export default function Home() {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("loading");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    async function run() {
      console.log("[SentinelBridge] Page: init started");

      try {
        await sentinelBridge.init();
        console.log("[SentinelBridge] Page: init done, calling getUser");
        setBridgeStatus("ready");

        const user = await sentinelBridge.request<User>("getUser");
        console.log("[SentinelBridge] Page: getUser result", user);
        setUser(user);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Bridge initialization failed";
        console.error("[SentinelBridge] Page: init failed", err);
        setBridgeError(message);
        setBridgeStatus("error");
      }
    }

    run();
  }, []);

  if (bridgeStatus === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground"
          aria-hidden
        />
        <p className="text-sm text-foreground/70">Connecting to bridge...</p>
      </div>
    );
  }

  if (bridgeStatus === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-red-500">
          Bridge connection failed
        </p>
        <p className="text-sm text-foreground/60">{bridgeError}</p>
      </div>
    );
  }

  return <div>Home {JSON.stringify(user)}</div>;
}
