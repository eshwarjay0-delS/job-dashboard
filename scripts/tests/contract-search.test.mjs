import test from "node:test"
import assert from "node:assert/strict"
import { matchesContractSearch } from "../../src/lib/contract-search.ts"

test("multi-word contract searches match any term instead of requiring an exact phrase", () => {
  assert.equal(matchesContractSearch("Salesforce CPQ developer", {
    title: "Senior Salesforce Engineer",
    company: "Example Systems",
    location: "Remote",
    body: "Own platform delivery and automation.",
  }), true)

  assert.equal(matchesContractSearch("Salesforce CPQ developer", {
    title: "Data Engineer",
    company: "Example Systems",
    location: "Chicago",
    body: "Build CPQ pricing integrations for the sales team.",
  }), true)

  assert.equal(matchesContractSearch("Salesforce CPQ developer", {
    title: "Data Engineer",
    company: "Example Systems",
    location: "Chicago",
    body: "Build reliable data pipelines.",
  }), false)
})

test("search includes title, company, location, description and tags", () => {
  assert.equal(matchesContractSearch("platform", { title: "Platform Engineer" }), true)
  assert.equal(matchesContractSearch("acme", { company: "Acme Systems" }), true)
  assert.equal(matchesContractSearch("chicago", { location: "Chicago, IL" }), true)
  assert.equal(matchesContractSearch("incident", { body: "Incident response operations" }), true)
  assert.equal(matchesContractSearch("terraform", { tags: ["Terraform", "AWS"] }), true)
})

test("technical punctuation remains intact for C++, C#, and .NET", () => {
  assert.equal(matchesContractSearch("C++", { body: "Modern C++ development" }), true)
  assert.equal(matchesContractSearch("C#", { title: "C# API Engineer" }), true)
  assert.equal(matchesContractSearch(".NET", { tags: [".NET", "Azure"] }), true)
  assert.equal(matchesContractSearch("C++", { body: "C# and .NET development" }), false)
})

test("empty and whitespace-only searches keep the full list", () => {
  const fields = { title: "Security Engineer", company: "Example" }
  assert.equal(matchesContractSearch("", fields), true)
  assert.equal(matchesContractSearch("   \t  ", fields), true)
})
 
test("short search terms such as IT require whole-token boundaries", () => {
  assert.equal(matchesContractSearch("IT", { title: "IT Security Engineer" }), true)
  assert.equal(matchesContractSearch("it", { tags: ["IT support"] }), true)
  assert.equal(matchesContractSearch("IT", { body: "Build systems with Terraform" }), false)
  assert.equal(matchesContractSearch("IT", { body: "Site reliability engineering" }), false)
  assert.equal(matchesContractSearch("IT", { body: "Security engineering" }), false)
  assert.equal(matchesContractSearch("IT", { body: "Commit the infrastructure code" }), false)
})
