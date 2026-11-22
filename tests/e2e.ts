/* End-to-end test against a running server in demo mode.
 * Run: npm run dev  (in another terminal), then: npx tsx tests/e2e.ts [baseUrl] */
import assert from "node:assert/strict";
import sharp from "sharp";
import QRCode from "qrcode";

const BASE = process.argv[2] || "http://localhost:3000";
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).stack?.split("\n").slice(0, 3).join("\n    ")}`);
    process.exitCode = 1;
  }
};
const RUN = Math.floor(Math.random() * 200) + 20;
let ipCounter = 10;
const freshIp = () => `10.${RUN}.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`;
const api = (path: string, init: RequestInit & { ip?: string; cookie?: string } = {}) =>
  fetch(BASE + path, {
    redirect: "manual",
    ...init,
    headers: { ...(init.headers as Record<string, string>), "x-forwarded-for": init.ip ?? freshIp(), ...(init.cookie ? { cookie: init.cookie } : {}) },
  });
const jpost = (path: string, body: unknown, o: { ip?: string; cookie?: string } = {}) =>
  api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), ...o });

async function overview() {
  const buf = new DataView(await (await api("/api/mosaic/overview")).arrayBuffer());
  const state = new Map<number, number>();
  for (let o = 0; o < buf.byteLength; o += 12) state.set(buf.getUint32(o, true), buf.getUint8(o + 4));
  return state;
}
let nextFree = 300_000;
async function freeTile() {
  const s = await overview();
  while (s.has(nextFree)) nextFree++;
  return nextFree++;
}
const art = async (color: string) => sharp({ create: { width: 900, height: 700, channels: 3, background: color } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: "secret-gps-test" } } }).toBuffer();

async function submit(tile: number, image: Buffer, fields: Record<string, string> = {}, ip = freshIp()) {
  const r = await (await jpost("/api/reserve", { tile }, { ip })).json();
  assert.ok(r.token, "reserved");
  const fd = new FormData();
  fd.set("tile", String(tile));
  fd.set("token", r.token);
  fd.set("image", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "a.jpg");
  fd.set("rightsConfirmed", "true");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const res = await api("/api/submissions", { method: "POST", body: fd, ip });
  return { res, body: await res.json() };
}

async function payMock(id: string, token: string) {
  const c = await jpost(`/api/submissions/${id}/checkout`, { t: token });
  assert.equal(c.status, 200, "checkout created");
  const { redirectUrl } = await c.json();
  const order = redirectUrl.match(/\/checkout\/test\/([^?]+)/)[1];
  const ret = decodeURIComponent(redirectUrl.split("return=")[1]);
  const fd = new FormData();
  fd.set("return", ret);
  fd.set("action", "pay");
  const p = await api(`/api/checkout/test/${order}`, { method: "POST", body: fd });
  assert.equal(p.status, 303);
  const back = await api(new URL(p.headers.get("location")!).pathname + new URL(p.headers.get("location")!).search);
  assert.equal(back.status, 303);
  return order;
}

async function main() {
  console.log(`\nE2E against ${BASE}\n`);
  let published: { id: string; token: string; tile: number } | null = null;

  await test("canvas has the Founding Collection and is mostly empty", async () => {
    const s = await (await api("/api/mosaic/stats")).json();
    assert.ok(s.founding > 10000);
    assert.ok(s.available > 980000);
  });

  await test("happy path: reserve → upload → approved → pay → published", async () => {
    const tile = await freeTile();
    const { res, body } = await submit(tile, await art("#2f7a5d"), { title: "Olive harvest", displayName: "Noa", country: "Israel", description: "My grandfather's grove" });
    assert.equal(res.status, 201);
    assert.equal(body.status, "awaiting_payment");
    // not public before payment
    assert.equal((await api(`/api/pieces/${tile + 1}`)).status, 404);
    assert.equal((await api(`/api/media/${tile + 1}/full.webp`)).status, 404);
    await payMock(body.id, body.statusToken);
    const st = await (await api(`/api/submissions/${body.id}?t=${body.statusToken}`)).json();
    assert.equal(st.status, "published");
    const piece = await (await api(`/api/pieces/${tile + 1}`)).json();
    assert.equal(piece.title, "Olive harvest");
    const img = await api(`/api/media/${tile + 1}/full.webp`);
    assert.equal(img.status, 200);
    const meta = await sharp(Buffer.from(await img.arrayBuffer())).metadata();
    assert.equal(meta.width, 1024);
    assert.ok(!meta.exif, "EXIF/GPS metadata stripped");
    published = { id: body.id, token: body.statusToken, tile };
  });

  await test("same square cannot be reserved twice", async () => {
    const tile = await freeTile();
    const a = await jpost("/api/reserve", { tile }, { ip: freshIp() });
    const b = await jpost("/api/reserve", { tile }, { ip: freshIp() });
    assert.equal(a.status, 200);
    assert.equal(b.status, 409);
  });

  await test("founding squares and published squares cannot be reserved", async () => {
    const s = await overview();
    const f = [...s.entries()].find(([, v]) => v === 4)![0];
    assert.equal((await jpost("/api/reserve", { tile: f }, { ip: freshIp() })).status, 409);
    assert.equal((await jpost("/api/reserve", { tile: published!.tile }, { ip: freshIp() })).status, 409);
  });

  await test("webhook replay and forged signatures are rejected", async () => {
    const bad = await api("/api/payments/webhook/mock", { method: "POST", headers: { "x-mock-signature": "nope" }, body: JSON.stringify({ id: "x", type: "payment.completed", data: {} }) });
    assert.equal(bad.status, 401);
  });

  let rejected: { id: string; statusToken: string; tile: number } | null = null;
  await test("link in title → rejected, cannot pay, square released", async () => {
    const tile = await freeTile();
    const { body } = await submit(tile, await art("#e9b949"), { title: "Order now at www.cheap-rugs.shop" });
    assert.equal(body.status, "rejected");
    assert.match(body.publicReason, /advertising/);
    const c = await jpost(`/api/submissions/${body.id}/checkout`, { t: body.statusToken });
    assert.equal(c.status, 409, "payment blocked for rejected piece");
    await new Promise((r) => setTimeout(r, 3200));
    assert.ok(!(await overview()).has(tile), "square released");
    rejected = { ...body, tile };
  });

  await test("QR code with a promo link inside the image → rejected", async () => {
    const qr = await QRCode.toBuffer("https://promo.example.com/deal", { width: 700, margin: 3 });
    const { body } = await submit(await freeTile(), await sharp(qr).jpeg().toBuffer());
    assert.equal(body.status, "rejected");
  });

  await test("contact details in description → held for manual review, square held", async () => {
    const tile = await freeTile();
    const { body } = await submit(tile, await art("#1f2a5a"), { description: "Write me: someone@example.com" });
    assert.equal(body.status, "in_review");
    await new Promise((r) => setTimeout(r, 3200)); // overview is cached for 3 s
    assert.equal((await overview()).get(tile), 2);
    assert.equal((await jpost(`/api/submissions/${body.id}/checkout`, { t: body.statusToken })).status, 409);
  });

  await test("peaceful religious & national expression → approved", async () => {
    for (const title of ["Shabbat Shalom", "Allahu Akbar", "Om Namah Shivaya", "Ave Maria", "Flag of Brazil"]) {
      const { body } = await submit(await freeTile(), await art("#c2452d"), { title });
      assert.equal(body.status, "awaiting_payment", title);
    }
  });

  await test("status link requires the token; checkout requires the token", async () => {
    assert.equal((await api(`/api/submissions/${published!.id}?t=wrong`)).status, 404);
    assert.equal((await jpost(`/api/submissions/${published!.id}/checkout`, { t: "wrong" })).status, 404);
  });

  await test("non-image file disguised as .jpg → refused", async () => {
    const { res, body } = await submit(await freeTile(), Buffer.from("<?php echo 'hi'; ?>".repeat(20)));
    assert.equal(res.status, 400);
    assert.equal(body.error, "invalid_image");
  });

  await test("missing confirmation → refused", async () => {
    const tile = await freeTile();
    const r = await (await jpost("/api/reserve", { tile }, { ip: `11.${RUN}.1` })).json();
    const fd = new FormData();
    fd.set("tile", String(tile));
    fd.set("token", r.token);
    fd.set("image", new Blob([new Uint8Array(await art("#000000"))]), "a.jpg");
    assert.equal((await api("/api/submissions", { method: "POST", body: fd, ip: `11.${RUN}.1` })).status, 400);
  });

  await test("client cannot inject a moderation decision", async () => {
    const { body } = await submit(await freeTile(), await art("#5f0f40"), { title: "Buy now at www.x.shop", status: "awaiting_payment", moderationDecision: "approved" } as never);
    assert.equal(body.status, "rejected");
  });

  await test("appeal → appealed; only once", async () => {
    const a = await jpost(`/api/submissions/${rejected!.id}/appeal`, { t: rejected!.statusToken, message: "It's a photo of my shop sign from 1950, family history." });
    assert.equal(a.status, 200);
    assert.equal((await a.json()).status, "appealed");
    assert.equal((await jpost(`/api/submissions/${rejected!.id}/appeal`, { t: rejected!.statusToken, message: "again" })).status, 409);
  });

  let cookie = "";
  await test("admin API is locked without a session", async () => {
    assert.equal((await jpost(`/api/admin/submissions/${rejected!.id}`, { action: "approve" })).status, 401);
    assert.equal((await api("/api/admin/export")).status, 401);
    assert.equal((await api(`/api/admin/media/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}/full.webp`)).status, 401);
  });

  await test("admin login (owner) and approve the appeal → awaiting payment", async () => {
    const l = await jpost("/api/admin/login", { username: "owner", password: "admin" }, { ip: `11.${RUN}.2` });
    assert.equal(l.status, 200);
    cookie = l.headers.get("set-cookie")!.split(";")[0];
    const r = await jpost(`/api/admin/submissions/${rejected!.id}`, { action: "approve", note: "Historic family sign — fine." }, { cookie });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, "awaiting_payment");
  });

  await test("report a published piece; rate limited; never auto-removed", async () => {
    const ip = `11.${RUN}.3`;
    for (let i = 0; i < 5; i++) assert.equal((await jpost("/api/reports", { pieceNumber: published!.tile + 1, reason: "other" }, { ip })).status, 200);
    assert.equal((await jpost("/api/reports", { pieceNumber: published!.tile + 1, reason: "other" }, { ip })).status, 429);
    for (let i = 0; i < 4; i++) await jpost("/api/reports", { pieceNumber: published!.tile + 1, reason: "hate" }, { ip: freshIp() });
    assert.equal((await api(`/api/pieces/${published!.tile + 1}`)).status, 200, "still published");
  });

  await test("admin removes published piece → refunded, gone from public", async () => {
    const r = await jpost(`/api/admin/submissions/${published!.id}`, { action: "remove", reason: "It appears to include content that our guidelines don’t allow." }, { cookie });
    assert.equal(r.status, 200);
    const st = await (await api(`/api/submissions/${published!.id}?t=${published!.token}`)).json();
    assert.equal(st.status, "removed");
    assert.equal(st.refunded, true);
    assert.equal((await api(`/api/pieces/${published!.tile + 1}`)).status, 404);
    assert.equal((await api(`/api/media/${published!.tile + 1}/full.webp`)).status, 404);
  });

  await test("CSV export works for admin and neutralises formulas", async () => {
    const r = await api("/api/admin/export", { cookie });
    assert.equal(r.status, 200);
    const csv = await r.text();
    assert.match(csv.split("\n")[0], /^piece_number,id,status/);
  });

  await test("admin login is rate limited", async () => {
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await jpost("/api/admin/login", { username: "owner", password: "wrong" }, { ip: `11.${RUN}.4` })).status;
    assert.equal(last, 429);
  });

  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}\n`);
}
main();
