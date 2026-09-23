#!/usr/bin/env node
// Simple test harness for sanitizeFilename without TypeScript compilation overhead
import assert from "node:assert";

// Inline the sanitizeFilename function for testing
function sanitizeFilename(input, defaultName = "pass") {
  if (!input || typeof input !== "string") return defaultName;

  let sanitized = input
    // Trim leading/trailing whitespace
    .trim()
    // Remove leading @ symbols
    .replace(/^@+/, "")
    // Convert spaces to hyphens
    .replace(/\s+/g, "-")
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, "")
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, "-")
    // Trim hyphens from start and end
    .replace(/^-+|-+$/g, "");

  return sanitized || defaultName;
}

// Test cases
const tests = [
  { input: "alice", expected: "alice", description: "basic username" },
  { input: "bob123", expected: "bob123", description: "alphanumeric" },
  { input: "@alice", expected: "alice", description: "removes leading @" },
  { input: "@@bob", expected: "bob", description: "removes multiple @" },
  { input: "alice smith", expected: "alice-smith", description: "converts spaces to hyphens" },
  { input: "  multiple   spaces  ", expected: "multiple-spaces", description: "handles multiple spaces" },
  { input: "josé", expected: "josé", description: "preserves Unicode" },
  { input: "françois", expected: "françois", description: "preserves accented chars" },
  { input: "武藤", expected: "武藤", description: "preserves non-Latin Unicode" },
  { input: "alice\x00bob", expected: "alicebob", description: "removes null control char" },
  { input: "alice\x1Fbob", expected: "alicebob", description: "removes control chars" },
  { input: "alice.smith", expected: "alice.smith", description: "preserves dots" },
  { input: "alice_smith", expected: "alice_smith", description: "preserves underscores" },
  { input: "alice-smith", expected: "alice-smith", description: "preserves hyphens" },
  { input: "alice---smith", expected: "alice-smith", description: "collapses multiple hyphens" },
  { input: "alice   smith", expected: "alice-smith", description: "multiple spaces to single hyphen" },
  { input: "-alice-", expected: "alice", description: "trims edge hyphens" },
  { input: "---alice---", expected: "alice", description: "trims multiple edge hyphens" },
  { input: "", expected: "pass", description: "empty string defaults" },
  { input: "   ", expected: "pass", description: "whitespace only defaults" },
  { input: "@john doe smith", expected: "john-doe-smith", description: "complex case with @" },
  { input: "  @alice  jones  ", expected: "alice-jones", description: "complex case with spaces" },
  { input: "josé-garcía", expected: "josé-garcía", description: "Unicode with hyphens" },
];

// Run tests
let passed = 0;
let failed = 0;

tests.forEach(({ input, expected, description }) => {
  try {
    const result = sanitizeFilename(input);
    assert.strictEqual(result, expected, `${description}: expected "${expected}" but got "${result}"`);
    console.log(`✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${description}: ${err.message}`);
    failed++;
  }
});

// Test custom default
try {
  assert.strictEqual(sanitizeFilename("", "default"), "default");
  console.log(`✓ respects custom default`);
  passed++;
} catch (err) {
  console.error(`✗ respects custom default: ${err.message}`);
  failed++;
}

try {
  assert.strictEqual(sanitizeFilename("@", "exported"), "exported");
  console.log(`✓ uses custom default for @ only`);
  passed++;
} catch (err) {
  console.error(`✗ uses custom default for @ only: ${err.message}`);
  failed++;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
