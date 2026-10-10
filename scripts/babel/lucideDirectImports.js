// Rewrites `import { Compass } from "lucide-react-native"` to the icon's own
// module, so bundles Metro does not tree-shake (development) skip the barrel.
const fs = require("fs");
const path = require("path");

const PACKAGE = "lucide-react-native";
const EXPORT_LINE = /export \{ ([^}]+) \} from '\.\/icons\/([\w-]+)\.mjs';/g;

/** Every exported icon name, aliases included, to the module it lives in. */
const readIconModules = () => {
  const cjsEntry = require.resolve(PACKAGE);
  const barrel = path.join(path.dirname(cjsEntry), "../esm/lucide-react-native.mjs");
  const modules = new Map();
  for (const [, names, file] of fs.readFileSync(barrel, "utf8").matchAll(EXPORT_LINE)) {
    for (const name of names.split(",")) modules.set(name.replace("default as", "").trim(), file);
  }
  return modules;
};

module.exports = ({ types: t }) => {
  const modules = readIconModules();

  return {
    name: "lucide-direct-imports",
    visitor: {
      ImportDeclaration(declaration) {
        const { node } = declaration;
        if (node.source.value !== PACKAGE || node.importKind === "type") return;

        const direct = [];
        const kept = node.specifiers.filter((specifier) => {
          const file =
            t.isImportSpecifier(specifier) &&
            specifier.importKind !== "type" &&
            modules.get(specifier.imported.name);
          if (!file) return true;
          direct.push(
            t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier(specifier.local.name))],
              t.stringLiteral(`${PACKAGE}/icons/${file}`)
            )
          );
          return false;
        });

        if (direct.length === 0) return;
        if (kept.length === 0) declaration.replaceWithMultiple(direct);
        else {
          node.specifiers = kept;
          declaration.insertAfter(direct);
        }
      },
    },
  };
};
