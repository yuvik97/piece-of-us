import "server-only";
import { fail, json } from "./http";
import { providerByName } from "./payments";
import { getRepo } from "./repo";
import { confirmPayment } from "./service";

export async function handleWebhook(providerName: string, headers: Headers, body: string) {
  const provider = providerByName(providerName);
  if (!provider) return fail(404, "unknown_provider");
  let event;
  try {
    event = await provider.parseWebhook(headers, body);
  } catch {
    return fail(401, "invalid_signature");
  }
  const fresh = await getRepo().recordPaymentEvent(provider.name, event.id, event.type, event.raw);
  if (!fresh) return json({ ok: true, duplicate: true });
  if (event.type === "payment.completed" && event.payment) {
    const r = await confirmPayment(provider.name, event.payment);
    return json({ ok: true, result: r.result });
  }
  return json({ ok: true, ignored: true });
}
