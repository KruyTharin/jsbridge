"use client";

import { useEffect, useState } from "react";
import { sentinelBridge } from "./lib/sentinel-bridge";

type BridgeStatus = "loading" | "ready" | "error";

export default function Home() {
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    console.log("[SentinelBridge] Page: waiting for bridge");

    sentinelBridge
      .init()
      .then(() => {
        console.log("[SentinelBridge] Page: bridge ready");
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[SentinelBridge] Page: bridge failed", err);
        setError(err instanceof Error ? err.message : "Bridge not available");
        setStatus("error");
      });
  }, []);

  async function handleRequestInitialData() {
    setActionError(null);
    setLoadingAction("onRequestInitialData");
    console.log("[SentinelBridge] Page: onRequestInitialData clicked");

    try {
      const jwt = await sentinelBridge.request<string>(
        "onRequestInitialData",
        null,
      );
      console.log("[SentinelBridge] Page: got JWT", jwt.slice(0, 80) + "...");
      setData(jwt);
    } catch (err) {
      console.error("[SentinelBridge] Page: onRequestInitialData failed", err);
      setActionError(
        err instanceof Error ? err.message : "onRequestInitialData failed",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  function handleCompleteKYCProcess() {
    setActionError(null);
    setLoadingAction("onCompleteKYCProcess");
    console.log("[SentinelBridge] Page: onCompleteKYCProcess clicked");

    try {
      const payload = JSON.stringify({ token: "jwt" });
      sentinelBridge.send("onCompleteKYCProcess", payload);
    } catch (err) {
      console.error("[SentinelBridge] Page: onCompleteKYCProcess failed", err);
      setActionError(
        err instanceof Error ? err.message : "onCompleteKYCProcess failed",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  if (status === "loading") {
    return <div>Loading bridge...</div>;
  }

  if (status === "error") {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Home</h1>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleRequestInitialData}
          disabled={loadingAction !== null}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loadingAction === "onRequestInitialData"
            ? "Loading..."
            : "onRequestInitialData"}
        </button>

        <button
          type="button"
          onClick={handleCompleteKYCProcess}
          disabled={loadingAction !== null}
          className="rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loadingAction === "onCompleteKYCProcess"
            ? "Processing..."
            : "onCompleteKYCProcess"}
        </button>
      </div>

      {actionError && <p className="text-sm text-red-500">{actionError}</p>}

      {data && (
        <pre className="max-w-full break-all rounded-lg border border-foreground/10 p-4 text-xs">
          {data}
        </pre>
      )}
    </div>
  );
}
