import { describe, it, expect } from "vitest";
import { buildUserPrompt, buildOverviewPrompt, buildSimplifyPrompt } from "../systemPrompt.js";

describe("System Prompt Generators", () => {
  it("should build a valid overview prompt", () => {
    const chunks = [{ text: "Chunk 1", page: 1 }, { text: "Chunk 2", page: 2 }];
    const prompt = buildOverviewPrompt({ chunks, language: "English" });
    
    expect(prompt).toContain("Chunk 1");
    expect(prompt).toContain("Chunk 2");
    expect(prompt).toContain("Respond entirely in English");
  });

  it("should build a valid user Q&A prompt", () => {
    const question = "What is the rent amount?";
    const chunks = [{ text: "Rent is $500", page: 1 }];
    const prompt = buildUserPrompt({ question, chunks, language: "Hindi" });
    
    expect(prompt).toContain(question);
    expect(prompt).toContain("Rent is $500");
    expect(prompt).toContain("Respond entirely in Hindi");
  });

  it("should build a valid simplify prompt", () => {
    const text = "Indemnification means that party A will hold party B harmless.";
    const prompt = buildSimplifyPrompt({ text, language: "English" });
    
    expect(prompt).toContain(text);
    expect(prompt).toContain("Respond entirely in English");
    expect(prompt).toContain("simpleExplanation");
  });
});
