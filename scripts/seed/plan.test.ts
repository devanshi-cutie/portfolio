/**
 * Run: npx tsx --test scripts/seed/plan.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { CreatorPackage } from "@/creators/types";
import { buildPlan, normalizeFolderRoot, seedPublicId, type PlanOptions } from "./plan";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seed-plan-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function file(rel: string, bytes = 10): void {
  const abs = path.join(tmp, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.alloc(bytes));
}

file("clip.mp4", 2000);
file("big.mov", 5000);
file("Photos/portrait.jpg", 50);
file("Photos/huge.png", 500);
file("a b.mp4");
file("a-b.mp4");

const options: PlanOptions = { dataDir: tmp, folderRoot: "acme", maxVideoBytes: 4000, maxImageBytes: 100 };

function pkg(overrides: Partial<CreatorPackage> = {}): CreatorPackage {
  return {
    id: "acme",
    settings: {} as CreatorPackage["settings"],
    settingsMedia: { portraitSource: "Photos/portrait.jpg" },
    collections: [{ slug: "work", title: "Work", coverSource: "clip.mp4" }],
    brands: [{ name: "The 202 Café", tags: [] }, { name: "Other", slug: "other-co", tags: [] }],
    testimonials: [{ quote: "Great", brandSlug: "the-202-cafe" }],
    media: [
      { source: "clip.mp4", kind: "reel", title: "Clip", collection: "work", brand: "other-co" },
      { source: "big.mov", kind: "bts", title: "Big" },
      { source: "Photos/portrait.jpg", kind: "portrait", title: "Me" },
      { source: "Photos/huge.png", kind: "photo", title: "Huge" },
    ],
    ...overrides,
  };
}

describe("seedPublicId", () => {
  it("slugs the path without its extension", () => {
    assert.equal(seedPublicId("acme", "Real estate/Copy of PARK ORNATE.mp4"), "acme/seed/real-estate-copy-of-park-ornate");
    assert.equal(seedPublicId("acme", "IMG_3603.JPG.jpeg"), "acme/seed/img-3603-jpg");
  });

  it("adds a stable hash when the slug may be truncated or is empty", () => {
    const long = `Folder/${"word ".repeat(30)}.mp4`;
    const id = seedPublicId("acme", long);
    assert.match(id, /^acme\/seed\/folder-word-[a-z0-9-]+-[0-9a-f]{8}$/);
    assert.equal(id, seedPublicId("acme", long));
    assert.match(seedPublicId("acme", "✨📢.mp4"), /^acme\/seed\/file-[0-9a-f]{8}$/);
  });
});

describe("normalizeFolderRoot", () => {
  it("trims slashes and rejects unsafe characters", () => {
    assert.equal(normalizeFolderRoot("/devanshi/"), "devanshi");
    assert.equal(normalizeFolderRoot("clients/devanshi"), "clients/devanshi");
    assert.equal(normalizeFolderRoot("../x"), null);
    assert.equal(normalizeFolderRoot("a b"), null);
  });
});

describe("buildPlan", () => {
  it("plans a valid package and flags oversize files", () => {
    const result = buildPlan(pkg(), options);
    assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
    const bySource = new Map(result.plan.media.map((m) => [m.source, m]));
    assert.equal(bySource.get("clip.mp4")!.compress, false);
    assert.equal(bySource.get("big.mov")!.compress, true);
    assert.equal(bySource.get("Photos/huge.png")!.compress, true);
    assert.equal(bySource.get("Photos/portrait.jpg")!.resourceType, "image");
    assert.deepEqual(result.plan.brandSlugs, ["the-202-cafe", "other-co"]);
    assert.equal(result.plan.assetFolder, "acme/seed");
  });

  it("reports every problem at once", () => {
    const result = buildPlan(
      pkg({
        settingsMedia: { heroSource: "not-in-media.mp4" },
        collections: [{ slug: "work", title: "Work", coverSource: "missing-cover.mp4" }],
        testimonials: [{ quote: "x", brandSlug: "nope" }],
        media: [
          { source: "clip.mp4", kind: "reel", title: "Clip", collection: "nope", brand: "ghost" },
          { source: "gone.mp4", kind: "reel", title: "Gone" },
          { source: "notes.txt", kind: "other", title: "Txt" },
          { source: "../escape.mp4", kind: "reel", title: "Escape" },
        ],
      }),
      options,
    );
    assert.equal(result.ok, false);
    const text = !result.ok ? result.errors.join("\n") : "";
    assert.match(text, /unknown collection slug "nope"/);
    assert.match(text, /unknown brand slug "ghost"/);
    assert.match(text, /"gone\.mp4": file not found/);
    assert.match(text, /unsupported file extension "\.txt"/);
    assert.match(text, /must be a plain relative path/);
    assert.match(text, /settingsMedia\.heroSource: "not-in-media\.mp4" is not listed in media\[\]/);
    assert.match(text, /coverSource: "missing-cover\.mp4" is not listed/);
    assert.match(text, /testimonials\[0\]: unknown brand slug "nope"/);
  });

  it("detects public_id collisions and duplicate entries", () => {
    const result = buildPlan(
      pkg({
        collections: [],
        settingsMedia: {},
        media: [
          { source: "a b.mp4", kind: "reel", title: "1" },
          { source: "a-b.mp4", kind: "reel", title: "2" },
          { source: "a-b.mp4", kind: "reel", title: "3" },
        ],
      }),
      options,
    );
    assert.equal(result.ok, false);
    const text = !result.ok ? result.errors.join("\n") : "";
    assert.match(text, /public_id collision "acme\/seed\/a-b" between "a b\.mp4" and "a-b\.mp4"/);
    assert.match(text, /"a-b\.mp4" is listed more than once/);
  });

  it("rejects duplicate and invalid slugs", () => {
    const result = buildPlan(
      pkg({
        collections: [
          { slug: "Work", title: "Work" },
          { slug: "x", title: "X" },
          { slug: "x", title: "X2" },
        ],
        brands: [{ name: "Same", tags: [] }, { name: "same", tags: [] }],
        testimonials: [],
        settingsMedia: {},
        media: [],
      }),
      options,
    );
    assert.equal(result.ok, false);
    const text = !result.ok ? result.errors.join("\n") : "";
    assert.match(text, /slug "Work" is not a valid slug/);
    assert.match(text, /duplicate slug "x"/);
    assert.match(text, /brands\[1\] "same": duplicate slug "same"/);
  });

  it("fails clearly when the data folder does not exist", () => {
    const result = buildPlan(pkg(), { ...options, dataDir: path.join(tmp, "nope") });
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.errors[0] : "", /Data folder not found/);
  });
});
