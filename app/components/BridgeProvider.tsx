"use client";

import { useEffect } from "react";
import { sentinelBridge } from "../lib/sentinel-bridge";

export function BridgeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    sentinelBridge.init().then(() => {
      console.log("✅ Bridge ready");

      // Example call
      sentinelBridge.request("getUser").then((user) => {
        console.log("👤 User from native:", user);
      });
    });
  }, []);

  return <>{children}</>;
}
