"use client";

import { useState } from "react";
import { DesktopVisual } from "@/components/desktop-visual";

const permissions = [
  ["Browser", "Observe a development or preview URL without repository access."],
  ["Read", "Inspect approved workspace metadata and files without write or command permission."],
  ["Propose", "Prepare a bounded instrumentation plan without applying it."],
  ["Write", "Apply only the files and task scope the developer explicitly approved."],
  ["Command", "Run separately approved commands within the displayed scope."],
] as const;

export function DesktopPermissionModel() {
  const [active, setActive] = useState(1);
  return (
    <div className="desksec-permission-model">
      <div className="desksec-permission-ladder" role="tablist" aria-label="Desktop permission levels">
        {permissions.map(([label], index) => <button key={label} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)}><small>Level {index}</small><strong>{label}</strong></button>)}
      </div>
      <div className="desksec-permission-detail" role="tabpanel">
        <div><p>Selected permission</p><h3>{permissions[active][0]}</h3><span>{permissions[active][1]}</span><b>Lower-privilege workflows remain available if this permission is refused.</b></div>
        <DesktopVisual id="SEC-D02" label={`${permissions[active][0]} permission prompt`} source="1440 × 900" display="880 × 550" />
      </div>
    </div>
  );
}
