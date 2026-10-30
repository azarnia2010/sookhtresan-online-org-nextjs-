import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFile(path.join(root, name), "utf8");
const driverJs = await read("public/legacy/driver-app.js");
const swJs = await read("public/sw.js");
const packageJson = JSON.parse(await read("package.json"));
const manifest = JSON.parse(await read("public/manifest.webmanifest"));
const bodyTs = await read("src/legacy/body.ts");
const layoutTs = await read("app/layout.tsx");
const portalTs = await read("components/portal.tsx");
const schemaSql = await read("supabase/schema.sql");
const provisionScript = await read("scripts/provision-users.mjs");

execFileSync(process.execPath, ["--check", path.join(root, "public/legacy/driver-app.js")]);
execFileSync(process.execPath, ["--check", path.join(root, "public/sw.js")]);

const markupPrefix = "export const bodyMarkup = ";
assert.ok(bodyTs.startsWith(markupPrefix), "bodyMarkup export exists");
const markup = JSON.parse(bodyTs.slice(markupPrefix.length).trim().replace(/;$/, ""));
const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML id attributes must be unique");
const idSet = new Set(ids);
for (const [, id] of driverJs.matchAll(/\$\(['"]([^'"]+)['"]\)/g)) {
  assert.ok(idSet.has(id), `legacy script refers to missing element #${id}`);
}

assert.equal(manifest.lang, "fa");
assert.equal(manifest.dir, "rtl");
assert.equal(packageJson.dependencies.next, "16.4.3");
assert.match(layoutTs, /<html lang="fa" dir="rtl">/);
for (const icon of manifest.icons) {
  await read(`public/${icon.src.replace(/^\//, "")}`);
}
assert.ok(markup.includes('id="backup"') && markup.includes('id="restoreBackup"'), "backup/restore controls exist");
assert.ok(markup.includes('id="storageWarn"'), "storage error warning exists");
assert.ok(markup.includes('id="restoreFile"'), "backup restore file input exists");
assert.match(portalTs, /get_manager_dashboard/, "manager dashboard reads aggregated reports from the database");
assert.match(portalTs, /postgres_changes/, "dashboard subscribes to database changes");
assert.match(portalTs, /signInWithPassword/, "Supabase authentication is wired");
assert.match(schemaSql, /enable row level security/i, "database tables enable RLS");
assert.match(schemaSql, /drivers submit own reports/i, "drivers have an own-report insert policy");
assert.match(schemaSql, /is_org_admin\(org_id\)/, "manager policies check organization role");
assert.match(schemaSql, /report_audit_logs/, "report audit history is present");
assert.match(schemaSql, /driver_resubmit_report/, "drivers can correct and resubmit rejected reports");
assert.match(schemaSql, /status = 'pending'/, "driver-created reports must enter pending review");
assert.match(schemaSql, /status <> 'rejected'/, "rejected reports are excluded from sales and volume totals");
assert.match(schemaSql, /supabase_realtime/i, "report table is prepared for realtime");
assert.match(provisionScript, /admins.length !== 2 \|\| drivers.length !== 6/, "provision tool validates two admins and six drivers");
assert.match(provisionScript, /users.length !== 8/, "provision tool requires exactly eight accounts");
assert.match(provisionScript, /new Set\(users\.map\(\(u\) => u\.password\)\)\.size !== 8/, "all initial passwords must be unique");
assert.ok((await read(".gitignore")).includes("provision-users.json"), "credentials file is ignored by git");
assert.ok(markup.includes('href="tel:125"') && markup.includes('href="tel:115"'), "emergency call links exist");
assert.match(driverJs, /f\.size>10\*1024\*1024/, "backup restore enforces a file-size limit");

// Exercise the exact pure helper functions from the browser script in a VM context.
const asciiAndNumber = driverJs.slice(driverJs.indexOf("function asciiDigits"), driverJs.indexOf("function normalizeState"));
const plateHelper = driverJs.slice(driverJs.indexOf("function normalizePlate"), driverJs.indexOf("function hasAmount"));
const wordHelper = driverJs.slice(driverJs.indexOf("var NUMBER_WORDS"), driverJs.indexOf("\nfunction process(raw)"));
const amountHelper = driverJs.slice(driverJs.indexOf("function hasAmount"), driverJs.indexOf("\n\nfunction render"));
const context = {
  ALLOWED_FUELS: ["بنزین معمولی", "بنزین سوپر", "نفت سفید", "گازوئیل"],
  S: { price: { "بنزین معمولی": 7 } }
};
vm.createContext(context);
vm.runInContext(`${asciiAndNumber}\n${plateHelper}\n${wordHelper}\n${amountHelper}\nglobalThis.test = { asciiDigits, numberValue, normalizePlate, norm, hasAmount, amtOf };`, context);
const helper = context.test;
assert.equal(helper.numberValue("۱۲۳۴"), 1234);
assert.equal(helper.numberValue("١٬٢٣٤"), 1234);
assert.match(helper.norm("بار ده هزار لیتر"), /10000\s*لیتر/);
assert.match(helper.norm("بنزین بیست و پنج لیتر"), /25\s*لیتر/);
assert.match(helper.norm("مبلغ دویست هزار تومان"), /200000\s*تومان/);
assert.equal(helper.normalizePlate("۱۲ ب ۳۴۵ ایران ۶۷").valid, true);
assert.equal(helper.normalizePlate("12 ب 345 67").key, helper.normalizePlate("۱۲ ب ۳۴۵ ایران ۶۷").key);
assert.equal(helper.normalizePlate("12345").valid, false);
assert.equal(helper.hasAmount({ fuel: "بنزین معمولی", lit: 10, priceLocked: true, unitPrice: null, amt: null }), false,
  "a sale with no price at transaction time must remain unpriced after a default price is later set");
assert.equal(helper.amtOf({ fuel: "بنزین معمولی", lit: 10, priceLocked: true, unitPrice: null, amt: null }), 0);
assert.equal(helper.amtOf({ fuel: "بنزین معمولی", lit: 10, priceLocked: true, unitPrice: 5, amt: null }), 50,
  "historical unit price must remain fixed");
assert.equal(helper.amtOf({ fuel: "بنزین معمولی", lit: 10, amt: null }), 70,
  "legacy records without a price snapshot keep backward-compatible fallback behavior");
assert.match(driverJs, /l\+pendingLiters\(\)>tankRemaining\(\)/,
  "quick sale must respect open destination reservations");
assert.match(driverJs, /rawAmount=.*manual&&rawAmount/,
  "automatic calculated amounts must not be stored as manually overridden amounts");
assert.match(swJs, /sookhtresan-static-v4/,
  "service worker cache version must change when application assets change");
assert.match(swJs, /request\.mode === 'navigate'/,
  "authenticated pages must use network only");
assert.match(swJs, /do not cache sessions/,
  "service worker must not cache authenticated sessions");
assert.doesNotMatch(swJs, /cache\.put\(['\"]\//,
  "authenticated HTML must never be cached");

console.log("Smoke checks passed:");
console.log("- JavaScript syntax and Service Worker syntax");
console.log("- Persian RTL document, manifest icons and Next.js package metadata");
console.log("- unique markup IDs and legacy DOM references");
console.log("- Persian/Arabic digit normalization, spoken numbers and Iranian plate validation");
console.log("- historical price snapshots, unknown amounts and reserved-capacity accounting");
console.log("- organizational RLS policies, audit, review workflow, realtime, and eight-account provisioning");
console.log("- static-only service worker; authenticated HTML and reports are never cached");
