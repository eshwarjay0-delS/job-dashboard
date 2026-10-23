# Gmail multi-account application-chain identity

**Date:** 23 October 2026  
**Method:** Source and artifact analysis  
**Scope:** Poke-inspired multi-account inbox alerts and recruiter-reply attachment. No Gmail or WhatsApp message was sent.

## Owner-approved behavior

The unified inbox must keep every receiving-account boundary visible, and recruiter replies must attach to the right application. The standing Gmail vision already says that account plus thread identifies a conversation and that cross-account grouping must never merge silently.

## What the source audit found

`/api/gmail/alerts` combined every application chain into a summary and `shapeInboxAlerts` indexed those summaries by `threadId` alone. It also used `threadId + kind` to collapse alerts and `threadId + messageId` as the persisted alert ID.

Gmail thread IDs belong to an account. With several connected inboxes, the same string cannot be treated as a global conversation identity. Two accounts carrying the same thread ID could therefore:

- attach an urgent message to the other account's application chain;
- collapse two legitimate urgent alerts into one; and
- produce the same persisted dismissal ID for different inboxes.

This is an identity-boundary defect, not evidence that such a collision occurred in the owner's live data.

## Implemented boundary

- `ChainSummary` carries the chain's receiving account.
- Direct chain lookup uses normalized `accountEmail + threadId`.
- Alert grouping and stable alert IDs include the receiving account.
- Same-company/same-role similarity may still point to a possible chain in another connected inbox, but the alert names that inbox and asks for confirmation. It does not merge the chains.

## Verification

A regression creates two connected accounts with identical thread and message IDs and separate application chains. Both alerts survive and each resolves to the holder/company in its own account. A second regression proves a possible cross-account chain is labelled with the other inbox and remains `check-chain`.

Automated tests, type checking, lint, build, deployment, and authenticated live acceptance are recorded separately in Plan & Vision and the REA register. A unit regression does not prove that a real recruiter reply was received or attached correctly in production.

Release evidence: PR #53 preview succeeded for commit `7591155c4f86211a0e30dcad2edd2f273a17b21d`. The PR merged as `2987143ab07a6574a1048df91851c020d2c5ee7d`, and Vercel reported a successful production deployment for that exact merge commit. This is deployment evidence, not authenticated inbox acceptance.

## Remaining acceptance

After deployment, use two connected test inboxes: create separate application chains, deliver an urgent message to each, and confirm the cards open the correct receiving account and application. No real-message acceptance was performed in this run.
