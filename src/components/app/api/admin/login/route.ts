import { checkLogin, setSession } from "@/lib/admin-auth";
import { fail, json, limit, sameOrigin } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden");
  const limited = await limit(req, "admin-login", 900, 8);
  if (limited) return limited;
  const { username, password } = await req.json().catch(() => ({}));
  const s = typeof username === "string" && typeof password === "string" ? checkLogin(username.trim(), password) : null;
  if (!s) {
    await new Promise((r) => setTimeout(r, 400));
    return fail(401, "invalid_credentials", "Those details didn’t work.");
  }
  await setSession(s);
  await getRepo().logEvent({ submissionId: null, reportId: null, tile: null, actor: `admin:${s.u}`, action: "login", fromStatus: null, toStatus: null, note: null, data: { role: s.r } });
  return json({ ok: true });
}
