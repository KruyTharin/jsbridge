"use client";

import { useEffect } from "react";
import { installDevBridgeMock } from "../lib/sentinel-bridge-mock";
import { sentinelBridge } from "../lib/sentinel-bridge";

export default function BridgeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Expose globally (optional but useful)
    (window as any).SentinelBridgeSDK = sentinelBridge;

    // Native → Web entry point
    (window as any).onNativeMessage = (message: any) => {
      console.log("[SentinelBridge] onNativeMessage", message);
      sentinelBridge.handleMessage(message);
    };

    installDevBridgeMock();

    console.log("[SentinelBridge] Injected into window", {
      sdk: "SentinelBridgeSDK",
      entryPoint: "onNativeMessage",
    });
  }, []);

  return <>{children}</>;
}
