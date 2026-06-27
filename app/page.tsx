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
    sentinelBridge
      .init()
      .then(() => setStatus("ready"))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Bridge not available");
        setStatus("error");
      });
  }, []);

  async function handleRequestInitialData() {
    setActionError(null);
    setLoadingAction("onRequestInitialData");

    try {
      const jwt = await sentinelBridge.request<string>(
        "onRequestInitialData",
        null,
      );
      setData(jwt);
    } catch (err) {
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

    try {
      const payload = JSON.stringify({ token: "jwt" });

      // this now supports BOTH iOS + Android correctly
      sentinelBridge.send("onCompleteKYCProcess", payload);
    } catch (err) {
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
