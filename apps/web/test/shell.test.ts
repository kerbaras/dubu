import { describe, expect, it } from "vitest";
import { splitArgs } from "../src/terminal/split-args";
import { scanSymbols } from "../src/editor/symbols";

describe("splitArgs", () => {
  it("splits on whitespace and honours quotes", () => {
    expect(splitArgs(`tofu plan -var 'name=a b' -var "x=\\"y\\""`)).toEqual(["tofu", "plan", "-var", "name=a b", "-var", 'x="y"']);
  });

  it("joins quotes inside a word", () => {
    expect(splitArgs(`tofu plan -var="name=a b" '' x\\ y`)).toEqual(["tofu", "plan", "-var=name=a b", "", "x y"]);
  });
});

describe("scanSymbols", () => {
  it("finds top-level declarations and locals", () => {
    const src = `variable "a" {\n  default = { x = 1 }\n}\nlocals {\n  b = 1 # c = 2\n  d = { e = 1 }\n}\nresource "random_pet" "p" {}\ndata "http" "h" {\n  url = "x"\n}\n`;
    expect(scanSymbols("main.tf", src).map((s) => `${s.kind}:${s.type ?? ""}.${s.name}@${s.line}`)).toEqual([
      "variable:.a@1",
      "local:.b@5",
      "local:.d@6",
      "resource:random_pet.p@8",
      "data:http.h@9",
    ]);
  });
});
