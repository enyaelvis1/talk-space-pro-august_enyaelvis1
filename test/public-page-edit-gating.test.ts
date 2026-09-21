import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editLayer = await readFile(
  new URL("../src/components/site/AdminPageEditLayer.tsx", import.meta.url),
  "utf8",
);
const editableSections = await readFile(
  new URL("../src/components/site/EditableSections.tsx", import.meta.url),
  "utf8",
);
const adminFunctions = await readFile(
  new URL("../src/lib/admin.functions.ts", import.meta.url),
  "utf8",
);

/**
 * The "Edit this page" affordance and the in-page section editor must never be
 * reachable by visitors or signed-in non-admins. These tests lock the gating in
 * place on both the client surfaces and the server functions behind them.
 */

test("edit layer starts locked and only unlocks from the server permission probe", () => {
  assert.match(editLayer, /const \[canEdit, setCanEdit\] = useState\(false\)/);
  assert.match(editLayer, /getCmsPermissions\(\)/);
  assert.match(editLayer, /setCanEdit\(permissions\.canEdit\)/);
  // No other code path may flip canEdit on.
  const assignments = editLayer.match(/setCanEdit\(/g) ?? [];
  assert.equal(assignments.length, 1);
});

test("the floating edit button renders only for permitted admins", () => {
  assert.match(editLayer, /\{canEdit \? \(/);
  const gateIndex = editLayer.indexOf("{canEdit ? (");
  const buttonIndex = editLayer.lastIndexOf("Edit this page");
  assert.ok(gateIndex > -1 && buttonIndex > gateIndex);
});

test("?edit=1, sticky edit mode and auto-open all require canEdit", () => {
  assert.match(editLayer, /if \(!canEdit \|\| autoOpened \|\| preview/);
  // Sticky session mode cannot resurrect the editor for a non-admin.
  const autoEffect = editLayer.slice(editLayer.indexOf("if (!canEdit || autoOpened"));
  assert.ok(autoEffect.includes("isStickyEditMode()"));
  assert.ok(autoEffect.indexOf("isStickyEditMode()") > autoEffect.indexOf("if (!canEdit"));
});

test("section deep links and the in-page editor UI are gated on canEdit", () => {
  assert.match(editableSections, /const \[canEdit, setCanEdit\] = useState\(false\)/);
  assert.match(editableSections, /if \(!canEdit \|\| deepLinkHandled\.current/);
  assert.match(editableSections, /if \(!canEdit \|\| !deepLinkHandled\.current\) return;/);
  assert.match(editableSections, /\{canEdit \? \(/);
  // Autosave of drafts must not run for non-admins either.
  assert.match(editableSections, /if \(!editing \|\| !canEdit \|\| !dirty\) return;/);
});

test("permission probe denies visitors and non-admin accounts", () => {
  const probe = adminFunctions.slice(adminFunctions.indexOf("export const getCmsPermissions"));
  assert.match(probe, /signedIn: false,\s*isAdmin: false,\s*canEdit: false,\s*canPublish: false/);
  assert.match(probe, /if \(!user\) \{[\s\S]*?return denied;/);
  assert.match(probe, /rpc\("has_role", \{\s*_user_id: user\.id,\s*_role: "admin",/);
  assert.match(probe, /const admin = !error && isAdmin === true;/);
  assert.match(probe, /canEdit: admin, canPublish: admin/);
});

test("editor data and save endpoints require an admin session server-side", () => {
  const preview = adminFunctions.slice(
    adminFunctions.indexOf("export const getContentEntryPreview"),
  );
  assert.match(preview.slice(0, 1500), /const bag = await requireAdmin\(\);/);

  const save = adminFunctions.slice(adminFunctions.indexOf("export const updateContentSections"));
  assert.match(save.slice(0, 1500), /const bag = await requireAdmin\(\);/);

  const requireAdmin = adminFunctions.slice(
    adminFunctions.indexOf("async function requireAdmin()"),
  );
  assert.match(requireAdmin.slice(0, 900), /requireRequestRole\("admin"\)/);
});
