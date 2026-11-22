// Runs the real migration + SQL functions in Postgres (PGlite/WASM). Run: npm run test:sql
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p).then(r => r.rows);
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
await db.exec(readFileSync(new URL("../supabase/migrations/0001_init.sql", import.meta.url),"utf8"));
await db.exec(readFileSync(new URL("../supabase/seed_founding.sql", import.meta.url),"utf8"));
const ok = (c, m) => { if (!c) { console.log("FAIL", m); process.exitCode = 1 } else console.log("ok  ", m) };
ok((await q("select count(*)::int n from tile_claims"))[0].n === 7430, "founding seeded into claims");
const F = (await q("select tile from founding_pieces order by tile limit 1"))[0].tile;
ok((await q("select reserve_tile($1,'a',15) e",[F]))[0].e === null, "founding square cannot be reserved");
ok((await q("select reserve_tile(1,'a',15) e"))[0].e !== null, "reserve free square");
ok((await q("select reserve_tile(1,'b',15) e"))[0].e === null, "second person blocked");
ok((await q("select reserve_tile(1,'a',15) e"))[0].e !== null, "same token can extend");
const id = "11111111-1111-1111-1111-111111111111";
const cs = (tile, tok, id, decision) => q(`select * from create_submission($1,$2,$3,'acc',null,null,'t',null,null,null,null,null,'x/full.webp','x/thumb.webp','#aabbcc',null,$4,'{}'::text[],'{}'::jsonb,'{}'::jsonb,'local',null,null,30)`, [id, tile, tok, decision]);
ok((await cs(1, "wrong", id, "approved"))[0].id === null, "wrong reservation token refused");
ok((await cs(1, "a", id, "approved"))[0].status === "awaiting_payment", "approved → awaiting_payment");
await q("update submissions set payment_provider='mock', payment_order_id='o1' where id=$1",[id]);
let r = await q("select * from confirm_payment('mock','o1','c1',800,'USD')");
ok(r[0].result === "confirmed", "payment confirmed → " + r[0].result);
ok((await q("select status from submissions where id=$1",[id]))[0].status === "published", "published");
ok((await q("select * from confirm_payment('mock','o1','c1',800,'USD')"))[0].result === "already", "idempotent confirm");
const ov = await q("select mosaic_overview() j");
ok(ov[0].j.find(x => x[0] === 1)?.[1] === 3, "overview shows published");
// conflict: approved piece whose hold expired and square taken by someone else
await q("select reserve_tile(2,'p',15)");
const id2 = "22222222-2222-2222-2222-222222222222";
await cs(2, "p", id2, "approved");
await q("update tile_claims set expires_at = now() - interval '1 minute' where tile=2");
await q("select reserve_tile(2,'other',15)");
await q("update submissions set payment_provider='mock', payment_order_id='o2' where id=$1",[id2]);
ok((await q("select * from confirm_payment('mock','o2','c2',800,'USD')"))[0].result === "conflict", "late payment after square lost → conflict");
// amount mismatch
await q("select reserve_tile(3,'z',15)"); const id3="33333333-3333-3333-3333-333333333333"; await cs(3,"z",id3,"approved");
await q("update submissions set payment_provider='mock', payment_order_id='o3' where id=$1",[id3]);
ok((await q("select * from confirm_payment('mock','o3','c3',50,'USD')"))[0].result === "amount_mismatch", "amount mismatch");
// rejected + appeal + approve
await q("select reserve_tile(4,'r',15)"); const id4="44444444-4444-4444-4444-444444444444";
ok((await cs(4,"r",id4,"rejected"))[0].status === "rejected", "rejected status");
ok((await q("select count(*)::int n from tile_claims where tile=4"))[0].n === 0, "rejected square released");
ok((await q("select appeal_submission($1,'please',4320) r",[id4]))[0].r === "ok", "appeal ok");
ok((await q("select appeal_submission($1,'again',4320) r",[id4]))[0].r === "not_appealable", "appeal only once");
ok((await q("select status from moderate_submission($1,'approve','admin:x',null,'fine',2880)",[id4]))[0].status === "awaiting_payment", "moderator approves appeal");
// in review hold
await q("select reserve_tile(5,'v',15)"); const id5="55555555-5555-5555-5555-555555555555";
ok((await cs(5,"v",id5,"pending_review"))[0].status === "in_review", "pending_review → in_review");
ok((await q("select mosaic_overview() j"))[0].j.find(x=>x[0]===5)?.[1] === 2, "overview shows held-in-review");
ok((await q("select status from moderate_submission($1,'reject','admin:x','reason',null,0)",[id5]))[0].status === "rejected", "reject");
// remove published
ok((await q("select status from moderate_submission($1,'remove','admin:x','r',null,0)",[id]))[0].status === "removed", "remove published");
ok(!(await q("select mosaic_overview() j"))[0].j.find(x=>x[0]===1), "removed piece gone from overview");
// audit log append-only
let blocked=false; try { await q("delete from moderation_events"); } catch { blocked=true } ok(blocked, "moderation log is append-only");
ok((await q("select count(*)::int n from moderation_events"))[0].n >= 8, "events logged");
// rate limit
for (let i=0;i<3;i++) await q("select hit_rate_limit('k',60,3)");
ok((await q("select hit_rate_limit('k',60,3) a"))[0].a === false, "rate limit trips");
ok((await q("select set_founding_hidden("+F+",true) r"))[0].r === "ok", "hide founding");
ok((await q("select set_founding_hidden("+F+",false) r"))[0].r === "ok", "restore founding");
const m = (await q("select admin_money() j"))[0].j; ok(m.revenue_cents === 350 - 100 + 0 || m.paid >= 3, "admin_money " + JSON.stringify(m));
await q("update submissions set reviewed_at = now() - interval '40 days' where id=$1",[id5]);
const paths = await q("select * from apply_retention() p");
ok(paths.length === 2, "retention returns image paths " + JSON.stringify(paths));
ok((await q("select expire_holds() n"))[0].n >= 0, "expire_holds runs");
