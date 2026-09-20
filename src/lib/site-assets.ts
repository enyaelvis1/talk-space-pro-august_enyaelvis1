/**
 * Image sources used by page sections.
 *
 * A section image `src` can be:
 *  - `asset:<key>`  — a bundled image shipped with the site (see registry below)
 *  - `http(s)://…`  — an absolute URL
 *  - `content-media/…` or any storage path — resolved against Supabase storage
 */

import couplesTherapy from "@/assets/couples-therapy.jpg";
import familyTherapy from "@/assets/family-therapy.jpg";
import groupTherapy from "@/assets/group-therapy.jpg";
import heroPortrait from "@/assets/hero-portrait.jpg";
import individualTherapy from "@/assets/individual-therapy.jpg";
import officeSpace from "@/assets/office-space.jpg";
import therapistOne from "@/assets/therapist-1.jpg";
import therapistTwo from "@/assets/therapist-2.jpg";
import therapistThree from "@/assets/therapist-3.jpg";
import tsBeyondSilence from "@/assets/ts-beyond-silence.avif";
import tsCoupleSmiling from "@/assets/ts-couple-smiling.webp";
import tsHeroPeople from "@/assets/ts-hero-people.avif";
import tsIndividual from "@/assets/ts-individual.jpg";
import tsMarriageCouple from "@/assets/ts-marriage-couple.avif";
import tsPtsd from "@/assets/ts-ptsd.webp";
import africanCouch from "@/assets/unsplash-african-couch-conversation.jpg";
import africanTeam from "@/assets/unsplash-african-team-session.jpg";
import africanWomen from "@/assets/unsplash-african-women-conversation.jpg";
import nigerianMan from "@/assets/unsplash-nigerian-man-portrait.jpg";

export type SiteAssetEntry = { key: string; label: string; url: string };

export const SITE_ASSETS: SiteAssetEntry[] = [
  { key: "individual-therapy", label: "Individual therapy", url: individualTherapy },
  { key: "couples-therapy", label: "Couples therapy", url: couplesTherapy },
  { key: "family-therapy", label: "Family therapy", url: familyTherapy },
  { key: "group-therapy", label: "Group therapy", url: groupTherapy },
  { key: "hero-portrait", label: "Hero portrait", url: heroPortrait },
  { key: "office-space", label: "Office space", url: officeSpace },
  { key: "therapist-1", label: "Therapist 1", url: therapistOne },
  { key: "therapist-2", label: "Therapist 2", url: therapistTwo },
  { key: "therapist-3", label: "Therapist 3", url: therapistThree },
  { key: "ts-hero-people", label: "Hero people", url: tsHeroPeople },
  { key: "ts-beyond-silence", label: "Beyond silence", url: tsBeyondSilence },
  { key: "ts-couple-smiling", label: "Couple smiling", url: tsCoupleSmiling },
  { key: "ts-individual", label: "Individual session", url: tsIndividual },
  { key: "ts-marriage-couple", label: "Marriage counselling", url: tsMarriageCouple },
  { key: "ts-ptsd", label: "Trauma support", url: tsPtsd },
  { key: "african-couch", label: "Couch conversation", url: africanCouch },
  { key: "african-team", label: "Team session", url: africanTeam },
  { key: "african-women", label: "Women conversation", url: africanWomen },
  { key: "nigerian-man", label: "Portrait", url: nigerianMan },
];

const ASSET_URLS = new Map(SITE_ASSETS.map((asset) => [asset.key, asset.url]));

function storageBase() {
  const url =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL : undefined) ?? "";
  return url.replace(/\/$/, "");
}

/** Resolve a section image `src` to a URL usable in an `<img>` tag. */
export function resolveImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const value = src.trim();
  if (!value) return null;
  if (value.startsWith("asset:")) return ASSET_URLS.get(value.slice(6)) ?? null;
  if (/^(https?:)?\/\//.test(value) || value.startsWith("data:") || value.startsWith("/"))
    return value;
  const base = storageBase();
  if (!base) return null;
  return `${base}/storage/v1/object/public/${value.replace(/^\/+/, "")}`;
}
