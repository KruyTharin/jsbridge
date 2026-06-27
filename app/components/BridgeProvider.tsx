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
        console.log("✅ Bridge detected");
      })
      .catch((err) => {
        console.error("❌ Bridge not available", err);
      });
  }, []);

  return <>{children}</>;
}
