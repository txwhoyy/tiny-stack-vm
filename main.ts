// Tiny stack VM for make.fun tiny-stack-vm-01. Runs each /input/<id>/program.bin
// on its input.bin and writes /output/<id>/stdout.bin + exit.txt. Follows the
// reference VM exactly: all ten traps with their own exit codes, 32-bit wrapping.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function run(p: Uint8Array, g: Uint8Array): [Uint8Array, number] {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const O = new Uint8Array(65536);
  let sp = 0, cp = 0, pc = 0, st = 0, ol = 0, ip = 0;
  const out = (code: number): [Uint8Array, number] => [O.slice(0, ol), code];
  for (;;) {
    if (st === 1000000) return out(10);
    if (pc < 0 || pc >= p.length) return out(9);
    const op = p[pc];
    if (op > 7 && !(op > 15 && op < 35 && op !== 31) && !(op > 47 && op < 53) && op !== 64 && op !== 65 && !(op > 79 && op < 84)) return out(5);
    const im = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + im >= p.length) return out(9);
    st++;
    const nx = pc + 1 + im;
    let po = 0, pu = 0;
    if (op === 4 || op === 5) pu = 2;
    else if (op === 6 || op === 7) pu = 3;
    else if (op === 1 || op === 2 || op === 64 || op === 82 || (op > 15 && op < 35)) pu = 1;
    if (op === 7) po = 3;
    else if (op === 5 || op === 6 || op === 65 || (op > 15 && op < 35 && op !== 23 && op !== 27)) po = 2;
    else if (op === 3 || op === 4 || op === 23 || op === 27 || op === 49 || op === 50 || op === 64 || op === 80 || op === 81 || op === 83) po = 1;
    if (sp < po) return out(2);
    if (sp - po + pu > 256) return out(3);
    pc = nx;
    if (op === 0) return out(0);
    else if (op === 23) D[sp - 1] = -D[sp - 1] | 0;
    else if (op === 27) D[sp - 1] = ~D[sp - 1];
    else if (op > 15 && op < 35) {
      const b = D[sp - 1], a = D[sp - 2];
      let r = 0;
      if (op === 16) r = (a + b) | 0;
      else if (op === 17) r = (a - b) | 0;
      else if (op === 18) r = Math.imul(a, b);
      else if (op === 19) {
        if (b === 0) return out(4);
        r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
      } else if (op === 20) {
        if (b === 0) return out(4);
        r = b === -1 ? 0 : (a % b) | 0;
      } else if (op === 21) {
        if (b === 0) return out(4);
        r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
      } else if (op === 22) {
        if (b === 0) return out(4);
        r = ((a >>> 0) % (b >>> 0)) | 0;
      } else if (op === 24) r = a & b;
      else if (op === 25) r = a | b;
      else if (op === 26) r = a ^ b;
      else if (op === 28) r = a << (b & 31);
      else if (op === 29) r = a >> (b & 31);
      else if (op === 30) r = (a >>> (b & 31)) | 0;
      else if (op === 32) r = a === b ? 1 : 0;
      else if (op === 33) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      sp -= 2;
      D[sp++] = r;
    }
    else if (op === 1) D[sp++] = (p[nx - 1] << 24) >> 24;
    else if (op === 2) D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24);
    else if (op === 3) sp--;
    else if (op === 4) { D[sp] = D[sp - 1]; sp++; }
    else if (op === 5) { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; }
    else if (op === 6) { D[sp] = D[sp - 2]; sp++; }
    else if (op === 7) { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; }
    else if (op === 48) pc = nx + (((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16);
    else if (op === 49 || op === 50) {
      const v = D[--sp];
      if ((op === 49) === (v === 0)) pc = nx + (((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16);
    } else if (op === 51) {
      if (cp === 64) return out(7);
      C[cp++] = nx;
      pc = p[nx - 2] | (p[nx - 1] << 8);
    } else if (op === 52) {
      if (cp === 0) return out(8);
      pc = C[--cp];
    } else if (op === 64) {
      const a = D[sp - 1];
      if (a < 0 || a > 255) return out(6);
      D[sp - 1] = M[a];
    } else if (op === 65) {
      const a = D[sp - 1], v = D[sp - 2];
      if (a < 0 || a > 255) return out(6);
      sp -= 2;
      M[a] = v;
    } else if (op === 80) {
      const s = String(D[sp - 1]);
      if (ol + s.length > 65536) return out(11);
      sp--;
      for (let k = 0; k < s.length; k++) O[ol++] = s.charCodeAt(k);
    } else if (op === 81) {
      if (ol + 1 > 65536) return out(11);
      O[ol++] = D[--sp] & 255;
    } else if (op === 82) D[sp++] = ip < g.length ? g[ip++] : -1;
    else if (op === 83) return out(D[--sp] & 255);
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const O = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const id of readdirSync(I).sort()) {
  let r: [Uint8Array, number] = [new Uint8Array(0), 0];
  try {
    r = run(new Uint8Array(readFileSync(join(I, id, "program.bin"))), new Uint8Array(readFileSync(join(I, id, "input.bin"))));
  } catch { /* one bad instance must not zero the rest */ }
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, "stdout.bin"), r[0]);
  writeFileSync(join(O, id, "exit.txt"), r[1] + "\n");
}
