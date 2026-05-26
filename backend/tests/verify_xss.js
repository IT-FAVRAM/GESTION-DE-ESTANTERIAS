import React from 'react';
import ReactMarkdown from 'react-markdown';
import { renderToStaticMarkup } from 'react-dom/server';

const maliciousPayload = `
# Safe Title
<img src=x onerror=alert(1)>
[Click me](javascript:alert(1))
<script>alert('XSS')</script>
**Bold Text**
`;

console.log("Testing payload:", maliciousPayload);

const output = renderToStaticMarkup(
    React.createElement(ReactMarkdown, {
        components: {
            h1: (props) => React.createElement('h1', { className: 'text-2xl' }, props.children),
        }
    }, maliciousPayload)
);

console.log("\nRENDERED OUTPUT:\n", output);

// Checks
const hasUnescapedScript = output.includes('<script');
const hasUnescapedImg = output.includes('<img');
const hasUnescapedOnerror = output.match(/<[^>]*\sonerror\s*=/i); // simple regex for onerror inside a tag
const hasUnsafeHref = output.includes('href="javascript:');

if (!hasUnescapedScript && !hasUnescapedImg && !hasUnescapedOnerror && !hasUnsafeHref) {
    console.log("\n✅ SUCCESS: No malicious unescaped tags or attributes found.");
} else {
    console.error("\n❌ FAILURE: Vulnerabilities detected!");
    if (hasUnescapedScript) console.error(" - Found <script> tag");
    if (hasUnescapedImg) console.error(" - Found <img> tag");
    if (hasUnescapedOnerror) console.error(" - Found onerror attribute in tag");
    if (hasUnsafeHref) console.error(" - Found javascript: protocol");
    process.exit(1);
}
