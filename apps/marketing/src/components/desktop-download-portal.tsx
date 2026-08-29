"use client";

import { useEffect, useState } from "react";

type Platform = "windows" | "macos" | "linux" | "mobile" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|mobile/.test(ua)) return "mobile";
  if (/windows/.test(ua)) return "windows";
  if (/macintosh|mac os/.test(ua)) return "macos";
  if (/linux/.test(ua)) return "linux";
  return "unknown";
}

export function DesktopDownloadPortal({ installerUrl, handoff }: { installerUrl: string; handoff: string | null }) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const available = installerUrl !== "#download-unavailable";

  useEffect(() => {
    const detectionTask = window.setTimeout(() => setPlatform(detectPlatform()), 0);
    return () => window.clearTimeout(detectionTask);
  }, []);

  const platformLabel = platform === "mobile" ? "Mobile device" : platform === "macos" ? "macOS" : platform === "linux" ? "Linux" : platform === "windows" ? "Windows" : "Detecting platform";

  return (
    <div className="deskdown-shell deskdown-portal">
      <div className="deskdown-detected" aria-live="polite"><small>Detected</small><strong>{platformLabel}</strong><span>{platform === "mobile" ? "Desktop runs on your development computer." : platform === "windows" ? "Windows is the first planned stable platform." : "Choose the computer you use for development."}</span></div>
      <div className="deskdown-artifact-card">
        <header><div><small>Recommended artifact</small><h2>Tellann Desktop</h2></div><span className={available ? "is-ready" : ""}>{available ? "Available" : "Manifest pending"}</span></header>
        <dl><div><dt>Version</dt><dd>Pending</dd></div><div><dt>Platform</dt><dd>Windows</dd></div><div><dt>Architecture</dt><dd>x64 planned</dd></div><div><dt>Installer</dt><dd>Pending</dd></div><div><dt>File size</dt><dd>Pending</dd></div><div><dt>Signing status</dt><dd>Not published</dd></div></dl>
        {handoff ? <a className="deskdown-download" href={`tellann://connect?handoff=${encodeURIComponent(handoff)}`}>Open Tellann Desktop <span>↗</span></a> : available ? <a className="deskdown-download" href={installerUrl}>Download for Windows <span>↓</span></a> : <button className="deskdown-download" type="button" disabled>Download unavailable <span>—</span></button>}
        <footer><span>{available ? "Artifact details supplied by the configured release URL" : "A verified release manifest is required before downloading"}</span><a href="#platforms">View all platforms ↓</a></footer>
      </div>
      <div className="deskdown-platforms" id="platforms" aria-label="Desktop platform availability">
        <button type="button" aria-pressed={platform === "windows"} onClick={() => setPlatform("windows")}><small>01</small><strong>Windows</strong><span>{available ? "Available" : "Release pending"}</span></button>
        <button type="button" aria-pressed={platform === "macos"} onClick={() => setPlatform("macos")}><small>02</small><strong>macOS</strong><span>Not currently available</span></button>
        <button type="button" aria-pressed={platform === "linux"} onClick={() => setPlatform("linux")}><small>03</small><strong>Linux</strong><span>Not currently available</span></button>
      </div>
    </div>
  );
}
