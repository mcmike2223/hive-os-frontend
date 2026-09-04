import assert from "node:assert/strict";
import { sanitizeRichText } from "../../lib/security/sanitize-rich-text";

const malicious = sanitizeRichText([
  '<script>alert("xss")</script>',
  '<svg onload="alert(1)"><foreignObject>bad</foreignObject></svg>',
  '<p onclick="alert(1)" style="text-align:center;position:fixed;color:#ff0000">',
  'Hello',
  '<a href="javascript:alert(1)" onclick="alert(1)">unsafe</a>',
  '<a href="java&#x73;cript:alert(1)">encoded</a>',
  '<a href="DaTa:text/html;base64,PHNjcmlwdD4=">data</a>',
  '<a href="https://example.com/wrong-target" target="popup">popup</a>',
  '<a href="https://example.com/docs" target="_blank">safe</a>',
  '<img src=x onerror="alert(1)">',
  '</p>',
].join(""));

for (const forbidden of [
  "<script",
  "<svg",
  "<foreignObject",
  "<img",
  "onclick",
  "onerror",
  "javascript:",
  "data:text/html",
  'target="popup"',
  "position:",
]) {
  assert.equal(
    malicious.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    "sanitizer retained forbidden content: " + forbidden,
  );
}

assert.match(malicious, /text-align:\s*center/);
assert.match(malicious, /color:\s*#ff0000/i);
assert.match(malicious, /href="https:\/\/example\.com\/docs"/);
assert.match(malicious, /target="_blank"/);
assert.match(malicious, /rel="noopener noreferrer"/);

const legitimate = sanitizeRichText(
  '<p><strong>Approved</strong> <em>formatting</em></p><ul><li>One</li></ul>',
);
assert.match(legitimate, /<strong>Approved<\/strong>/);
assert.match(legitimate, /<em>formatting<\/em>/);
assert.match(legitimate, /<ul><li>One<\/li><\/ul>/);

console.log("Safe rich-text sanitizer security checks passed.");
