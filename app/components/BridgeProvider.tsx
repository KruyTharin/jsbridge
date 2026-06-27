"use client";

import { useEffect } from "react";
import { installDevBridgeMock } from "../lib/sentinel-bridge-mock";
import { sentinelBridge } from "../lib/sentinel-bridge";

export function BridgeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installDevBridgeMock();

    sentinelBridge
      .init()
      .then(() => {
        console.log("[SentinelBridge] BridgeProvider: ready");
      })
      .catch((err) => {
        console.error("[SentinelBridge] BridgeProvider: failed", err);
      });
  }, []);

  return <>{children}</>;
}
