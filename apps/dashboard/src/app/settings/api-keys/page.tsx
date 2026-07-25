import { redirect } from "next/navigation";

export default function LegacyApiKeysRedirect() {
  redirect("/settings/ingestion-keys");
}
