// Function signatures and provider schemas generated from the real binary at
// build time (packages/tofu-wasm/gen-metadata.sh).
export interface FnParam {
  name: string;
  type: unknown;
}
export interface FnSig {
  description?: string;
  return_type: unknown;
  parameters?: FnParam[];
  variadic_parameter?: FnParam;
}
export interface Attr {
  type?: unknown;
  description?: string;
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
  sensitive?: boolean;
}
export interface Block {
  attributes?: Record<string, Attr>;
  block_types?: Record<string, { nesting_mode: string; block: Block }>;
  description?: string;
}
export interface Schema {
  block: Block;
}

export interface Metadata {
  functions: Record<string, FnSig>;
  resources: Record<string, Schema>;
  dataSources: Record<string, Schema>;
}

interface ProviderSchemas {
  provider_schemas: Record<string, { resource_schemas?: Record<string, Schema>; data_source_schemas?: Record<string, Schema> }>;
}

const builtinResources: Record<string, Schema> = {
  terraform_data: {
    block: {
      description: "Stores a value and follows the managed resource lifecycle; built into OpenTofu.",
      attributes: {
        id: { type: "string", computed: true },
        input: { type: "dynamic", optional: true, description: "A value to store in state; changes trigger replace of output." },
        output: { type: "dynamic", computed: true, description: "The value of input after apply." },
        triggers_replace: { type: "dynamic", optional: true, description: "Changes to this value replace the resource." },
      },
    },
  },
};

export async function loadMetadata(base: string): Promise<Metadata> {
  const [fns, schemas] = await Promise.all([
    fetch(`${base}functions.json`).then((r) => r.json()),
    fetch(`${base}schemas.json`).then((r) => r.json() as Promise<ProviderSchemas>),
  ]);
  const meta: Metadata = { functions: fns.function_signatures, resources: { ...builtinResources }, dataSources: {} };
  for (const p of Object.values(schemas.provider_schemas)) {
    Object.assign(meta.resources, p.resource_schemas);
    Object.assign(meta.dataSources, p.data_source_schemas);
  }
  return meta;
}

export const typeName = (t: unknown): string =>
  typeof t === "string" ? t : Array.isArray(t) ? `${t[0]}(${t.slice(1).map(typeName).join(", ")})` : JSON.stringify(t);

export function fnSignature(name: string, f: FnSig): string {
  const params = (f.parameters ?? []).map((p) => `${p.name} ${typeName(p.type)}`);
  if (f.variadic_parameter) params.push(`${f.variadic_parameter.name}... ${typeName(f.variadic_parameter.type)}`);
  return `${name}(${params.join(", ")}) ${typeName(f.return_type)}`;
}
