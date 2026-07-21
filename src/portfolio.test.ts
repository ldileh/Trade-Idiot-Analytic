// Self-check for parseHoldings — run with: npx tsx src/portfolio.test.ts
import assert from "node:assert";
import { parseHoldings } from "./portfolio";

// JSON export round-trip.
let r = parseHoldings('[{"sym":"AAPL","qty":10,"price":150}]');
assert.deepEqual(r, [{ sym: "AAPL", qty: 10, price: 150 }]);

// CSV with lot column → ×100; currency symbol/space stripped from price.
r = parseHoldings("kode,lot,harga\nBBCA.JK,5,\"Rp 9500\"");
assert.deepEqual(r, [{ sym: "BBCA.JK", qty: 500, price: 9500 }]);

// Decimal price preserved (US shares can be fractional-priced).
r = parseHoldings("sym,shares,price\nAAPL,10,150.25");
assert.deepEqual(r, [{ sym: "AAPL", qty: 10, price: 150.25 }]);

// Semicolon separator + qty column (no lot).
r = parseHoldings("symbol;shares;price\nMSFT;3;400");
assert.deepEqual(r, [{ sym: "MSFT", qty: 3, price: 400 }]);

// Repeated symbol → weighted average merge.
r = parseHoldings("sym,qty,price\nAAPL,10,100\nAAPL,10,200");
assert.deepEqual(r, [{ sym: "AAPL", qty: 20, price: 150 }]);

// Invalid rows (missing/zero) dropped; bad header → empty.
assert.deepEqual(parseHoldings("sym,qty,price\nX,0,100\n,5,10"), []);
assert.deepEqual(parseHoldings("foo,bar\n1,2"), []);

console.log("portfolio.test.ts OK");
