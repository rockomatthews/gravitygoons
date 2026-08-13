import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
test("replacement escrow compiles with a ten-minute correction window",()=>{const source=fs.readFileSync(path.join(root,"src/GoonMatchEscrowV2.sol"),"utf8");assert.match(source,/contract GoonMatchEscrowV2/);assert.match(source,/DISPUTE_WINDOW = 10 minutes/);const artifact=JSON.parse(fs.readFileSync(path.join(root,"artifacts/GoonMatchEscrowV2.json")));assert.ok(artifact.bytecode.length>100);});
