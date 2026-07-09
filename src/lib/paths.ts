/**
 * Central path constants for all server-side file I/O.
 *
 * On Vercel, process.cwd() is read-only (Lambda bundle directory).
 * VERCEL=1 is automatically injected, so we detect it and redirect all
 * writes to /tmp/mf — Vercel gives each function up to 512 MB of ephemeral
 * /tmp space. Files survive within a warm function instance but are cleared
 * on cold starts and new deploys.
 *
 * For a more durable setup, migrate to Supabase Storage (resumeContent table
 * or storage bucket) — see the migration checklist in docs/storage-migration.md.
 *
 * NEVER import from this file in Client Components ('use client').
 * It is safe in Server Components, Route Handlers, and lib files.
 */

import path from "path"

const IS_VERCEL = !!process.env.VERCEL

/** Root of all mutable data (writable on all environments). */
export const DATA_DIR = IS_VERCEL
  ? "/tmp/mf"
  : path.join(process.cwd(), "data")

/** Per-user uploaded resumes: DATA_DIR/user-resumes/<userId>/ */
export const USER_RESUMES_DIR = path.join(DATA_DIR, "user-resumes")

/** AI-tailored output .docx files: DATA_DIR/tailored/ */
export const TAILORED_DIR = path.join(DATA_DIR, "tailored")

/** Tailor cache (avoids re-running identical JD + resume): DATA_DIR/tailored_cache/ */
export const TAILORED_CACHE_DIR = path.join(DATA_DIR, "tailored_cache")

/** Job tracker data: DATA_DIR/jobs/ */
export const JOBS_DIR = path.join(DATA_DIR, "jobs")

/** Aggregated resume keyword index: DATA_DIR/resume_keywords.json */
export const KEYWORDS_FILE = path.join(DATA_DIR, "resume_keywords.json")

/** User feedback log: DATA_DIR/feedback.json */
export const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json")

/**
 * Base resume library — the canonical set of reference .docx files used as
 * tailoring templates. READ-ONLY: committed to the repo at ./resumes/ so it's
 * available in the Vercel deployment bundle.
 *
 * Override with RESUMES_DIR env var for a local dev folder outside the repo.
 */
export const RESUMES_LIB = process.env.RESUMES_DIR ?? path.join(process.cwd(), "resumes")
