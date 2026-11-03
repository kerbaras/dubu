// Runs the real tofu.wasm against the in-memory machine (requires a wasm build).
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMachine, tofuEnv } from "../src/machine";
import { runProcess } from "../src/process";
import { restore, snapshot } from "../src/vfs/snapshot";

const wasmPath = new URL("../../tofu-wasm/dist/tofu.wasm", import.meta.url);
const enc = new TextEncoder();
const dec = new TextDecoder();

const MAIN = `
variable "name" {
  default = "world"
}
locals {
  greeting = "hello \${var.name}"
  nums     = [1, 2, 3]
}
resource "random_pet" "p" {
  length = 2
}
resource "local_file" "f" {
  filename = "out.txt"
  content  = local.greeting
}
output "g" {
  value = local.greeting
}
`;

let module: WebAssembly.Module | undefined;
const getModule = async () => (module ??= await WebAssembly.compile(readFileSync(wasmPath)));

async function tofu(m: ReturnType<typeof createMachine>, out: string[], ...args: string[]) {
  return runProcess(await getModule(), {
    argv: ["tofu", ...args],
    env: tofuEnv(80, 24),
    fs: m.fs,
    process: m.process,
    tty: m.tty.bridge(),
  });
}

function machine(out: string[]) {
  const m = createMachine({ output: (d) => out.push(dec.decode(d)), interrupt: () => {} }, () => {});
  restore(m.tree, [{ path: "/workspace/main.tf", kind: "file", mode: 0o644, mtimeMs: 0, data: enc.encode(MAIN) }]);
  return m;
}

describe.skipIf(!existsSync(wasmPath))("tofu.wasm on the virtual machine", () => {
  it("evaluates console expressions from stdin", async () => {
    const out: string[] = [];
    const m = machine(out);
    m.tty.input("upper(local.greeting)\nsum(local.nums)\n\x04");
    expect(await tofu(m, out, "console")).toBe(0);
    expect(out.join("")).toContain('"HELLO WORLD"');
    expect(out.join("")).toContain("6");
  }, 60_000);

  it("runs init, plan and apply with bundled providers", async () => {
    const out: string[] = [];
    const m = machine(out);
    expect(await tofu(m, out, "init", "-no-color")).toBe(0);
    expect(await tofu(m, out, "plan", "-no-color")).toBe(0);
    expect(out.join("")).toContain("Plan: 2 to add");
    expect(await tofu(m, out, "apply", "-auto-approve", "-no-color")).toBe(0);
    const files = snapshot(m.tree, "/workspace").map((e) => e.path);
    expect(files).toContain("/workspace/terraform.tfstate");
    expect(files).toContain("/workspace/out.txt");
  }, 120_000);
});
