/**
 * Web3Forms email notification (client-side).
 *
 * Web3Forms access keys are public, form-scoped identifiers designed to be used
 * from the browser. Nothing else is required — no server, no SMTP credentials.
 *
 * The local SQLite submission is the source of truth: this notification is
 * best-effort. Any failure is logged to the console and never shown to the
 * visitor, because the enquiry has already been stored on the server.
 */

export const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
export const WEB3FORMS_ACCESS_KEY = "7e585472-f844-436e-a458-3e8c3ce2097b";

export type Web3FormsResult = { ok: boolean; error?: string };

export async function sendWeb3FormsNotification(
  fields: Record<string, unknown>,
  subject = "New website submission — Knight Medical Billing",
): Promise<Web3FormsResult> {
  try {
    const response = await fetch(WEB3FORMS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject,
        from_name: "Knight Medical Billing Website",
        ...fields,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;

    if (!response.ok || payload?.success === false) {
      const error = payload?.message ?? `Web3Forms responded ${response.status}`;
      console.warn("[web3forms] notification failed:", error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    console.warn("[web3forms] notification failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Network error" };
  }
}

/** Tells the server whether the owner email was accepted. Never throws. */
export async function reportNotificationStatus(id: number | undefined, ok: boolean): Promise<void> {
  if (!id) return;
  try {
    await fetch("/api/submissions/email-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ok }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}
