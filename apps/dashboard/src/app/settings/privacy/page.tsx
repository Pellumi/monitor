import { CheckCircle } from "lucide-react";
import { SettingsPage, SettingsSection, UpgradeNotice } from "@/components/settings/settings-page";

const protectedValues = [
  "Passwords",
  "Payment card data",
  "Authentication tokens and cookies",
  "Authorisation headers",
  "Private keys",
  "Security answers",
];

export default function PrivacyPage() {
  return (
    <SettingsPage title="Privacy & Capture" description="Control application capture while preserving Tellann’s non-removable privacy protections." scope="APPLICATION">
      <SettingsSection title="Automatic privacy protections" description="These protections are always active and cannot be disabled.">
        <div className="grid gap-3 md:grid-cols-2">
          {protectedValues.map((value) => <div key={value} className="flex items-center gap-2 text-sm text-neutral-300"><CheckCircle className="h-4 w-4 text-emerald-400" />Never capture {value.toLowerCase()}</div>)}
        </div>
      </SettingsSection>
      <SettingsSection title="Capture and masking policies">
        <UpgradeNotice>Application capture rules and the shared sanitisation-rule tester require the Release Two ingestion-policy migration. Existing SDK privacy defaults remain enforced.</UpgradeNotice>
      </SettingsSection>
    </SettingsPage>
  );
}
