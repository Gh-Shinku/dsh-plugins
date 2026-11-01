import ts from "typescript";

/** Lower standard decorators for Node 24; Node cannot parse decorators yet. */
export function decorators() {
  return {
    name: "dsh-standard-decorators",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]manager\.ts(?:\?.*)?$/.test(id) || !code.includes("@Remote")) return null;
      return {
        code: ts.transpileModule(code, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            sourceMap: true,
            inlineSources: true,
          },
          fileName: id,
        }).outputText,
        map: null,
      };
    },
  };
}
