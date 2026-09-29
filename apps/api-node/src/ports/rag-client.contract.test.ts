import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ragQueryResponseSchema } from "./rag-client.js";

function readFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), "utf8")) as Record<string, unknown>;
}

const passFixture = readFixture("rag-query-pass.json");
const abstainFixture = readFixture("rag-query-abstain.json");

describe("RAG query response contract fixtures", () => {
  it.each([
    ["successful PASS", passFixture],
    ["successful ABSTAIN", abstainFixture],
  ])("validates the %s response and preserves its complete shape", (_label, fixture) => {
    const parsed = ragQueryResponseSchema.parse(fixture);
    // Zod objects strip unknown keys by default. Equality ensures the fixture still
    // describes fields in the schema instead of silently losing contract fields.
    expect(parsed).toEqual(fixture);
  });

  it("requires every required top-level field", () => {
    const required = ["retrieval_run_id", "corpus_version_id", "decision", "answer", "model", "policy_version"];
    for (const field of required) {
      const withoutField = { ...passFixture };
      delete withoutField[field];
      expect(ragQueryResponseSchema.safeParse(withoutField).success, `missing ${field}`).toBe(false);
    }

    const model = passFixture.model as Record<string, unknown>;
    const withoutModelName = { ...passFixture, model: { ...model } };
    delete (withoutModelName.model as Record<string, unknown>).name;
    expect(ragQueryResponseSchema.safeParse(withoutModelName).success, "missing model.name").toBe(false);

    const claim = (passFixture.claims as Record<string, unknown>[])[0]!;
    for (const field of ["claim_index", "claim_text", "support_status"]) {
      const withoutField = { ...passFixture, claims: [{ ...claim }] };
      delete (withoutField.claims[0] as Record<string, unknown>)[field];
      expect(ragQueryResponseSchema.safeParse(withoutField).success, `missing claims[0].${field}`).toBe(false);
    }

    const citation = (passFixture.citations as Record<string, unknown>[])[0]!;
    for (const field of ["label", "chunk_id", "authority", "document_title"]) {
      const withoutField = { ...passFixture, citations: [{ ...citation }] };
      delete (withoutField.citations[0] as Record<string, unknown>)[field];
      expect(ragQueryResponseSchema.safeParse(withoutField).success, `missing citations[0].${field}`).toBe(false);
    }
  });

  it("rejects incompatible types for required top-level and nested fields", () => {
    const wrongTypes: Array<[string, Record<string, unknown>]> = [
      ["retrieval_run_id", { ...passFixture, retrieval_run_id: 17 }],
      ["corpus_version_id", { ...passFixture, corpus_version_id: 17 }],
      ["decision", { ...passFixture, decision: "DONE" }],
      ["answer", { ...passFixture, answer: 17 }],
      ["model", { ...passFixture, model: "local-model" }],
      ["policy_version", { ...passFixture, policy_version: 17 }],
      ["model.name", { ...passFixture, model: { name: 17, version: "v1" } }],
      ["claims[0].claim_index", { ...passFixture, claims: [{ ...((passFixture.claims as Record<string, unknown>[])[0]), claim_index: "0" }] }],
      ["claims[0].claim_text", { ...passFixture, claims: [{ ...((passFixture.claims as Record<string, unknown>[])[0]), claim_text: 0 }] }],
      ["claims[0].support_status", { ...passFixture, claims: [{ ...((passFixture.claims as Record<string, unknown>[])[0]), support_status: "UNVERIFIED" }] }],
      ["citations[0].label", { ...passFixture, citations: [{ ...((passFixture.citations as Record<string, unknown>[])[0]), label: 1 }] }],
      ["citations[0].chunk_id", { ...passFixture, citations: [{ ...((passFixture.citations as Record<string, unknown>[])[0]), chunk_id: "not-a-uuid" }] }],
      ["citations[0].authority", { ...passFixture, citations: [{ ...((passFixture.citations as Record<string, unknown>[])[0]), authority: 1 }] }],
      ["citations[0].document_title", { ...passFixture, citations: [{ ...((passFixture.citations as Record<string, unknown>[])[0]), document_title: 1 }] }],
    ];

    for (const [field, fixture] of wrongTypes) {
      expect(ragQueryResponseSchema.safeParse(fixture).success, `invalid ${field}`).toBe(false);
    }
  });
});
