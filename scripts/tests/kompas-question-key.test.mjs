import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  filterPreparedQuestionContext,
  questionKey,
  sameQuestionKey,
} from "../../src/lib/kompasQuestionKey.ts";
import { matchBank } from "../../src/lib/kompasPreparedQuestionBank.ts";
import { normLedger, pickProject, toLedgerProjects } from "../../src/lib/kompasAnswer.ts";

const SAME_QUESTION_PAIRS = [
  ["Tell me about yourself.", "Introduce yourself."],
  ["Walk me through your background.", "Tell me about your career background."],
  ["Why do you want this role?", "Why are you interested in this position?"],
  ["Why are you leaving your current role?", "Why are you moving on from your current position?"],
  ["Why are you interested in this company?", "Why do you want to work here?"],
  ["What questions do you have for us?", "Do you have any questions for me?"],
  ["What is authentication?", "Define authentication."],
  ["What is authorization?", "Define authorization."],
  ["What is the difference between authentication and authorization?", "What is the difference between authn and authz?"],
  ["What is a one-time password?", "What is an OTP?"],
  ["What is multi-factor authentication?", "What is MFA?"],
  ["How do you onboard log sources into Splunk?", "How did you onboard the log source in Splunk?"],
  ["How do you tune a noisy SIEM rule?", "How would you tune noisy rules in a SIEM?"],
  ["How do you map controls to NIST CSF¶»§q«^