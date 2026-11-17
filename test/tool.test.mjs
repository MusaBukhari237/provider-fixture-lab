import test from "node:test";
import assert from "node:assert/strict";
import {inspectFixture} from "../docs/tool.mjs";
test("reads token counts and handles a function-only response",()=>{
 const body={candidates:[{finishReason:"STOP",content:{parts:[{functionCall:{name:"example"}}]}}],usageMetadata:{promptTokenCount:6,candidatesTokenCount:2}};
 const report=inspectFixture("gemini",200,"",JSON.stringify(body));
 assert.equal(report.usageIn,6);assert.equal(report.usageOut,2);assert.deepEqual(report.blocks,["Function call requested."]);
});
test("classifies a rate limit and tolerates a non-JSON response",()=>{
 const report=inspectFixture("chat",429,"Retry-After: 19\nContent-Type: text/html","<html>");
 assert.equal(report.category,"Rate limit");assert.equal(report.retryAfterSeconds,19);assert.equal(report.retryable,true);assert.match(report.issues.join(),/not a JSON object/);
 assert.equal(inspectFixture("messages",401,"",'{"error":{"message":"denied"}}').retryable,false);
});
