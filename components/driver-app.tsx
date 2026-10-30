"use client";

import { useEffect } from "react";

type DriverWindow = Window & { __fuelDriverScriptPromise?: Promise<void> };
type DriverAppProps = { markup: string };

function loadLegacyDriverScript() {
  const w = window as DriverWindow;
  if (w.__fuelDriverScriptPromise) return w.__fuelDriverScriptPromise;
  w.__fuelDriverScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/legacy/driver-app.js";
    script.async = true;
    script.dataset.fuelDriver = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("بارگذاری منطق برنامه ناموفق بود."));
    document.body.appendChild(script);
  });
  return w.__fuelDriverScriptPromise;
}

export default function DriverApp({ markup }: DriverAppProps) {
  useEffect(() => {
    void loadLegacyDriverScript().catch(() => {
      const warning = document.getElementById("storageWarn");
      if (warning) {
        warning.hidden = false;
        warning.style.display = "block";
        warning.textContent = "بخشی از برنامه بارگذاری نشد. اتصال اینترنت را بررسی و صفحه را دوباره بارگذاری کنید.";
      }
    });

    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return <div id="driver-app" dangerouslySetInnerHTML={{ __html: markup }} />;
}
