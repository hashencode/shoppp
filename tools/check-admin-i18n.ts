import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

export type MessageUse = { key: string; filePath: string; line: number };
export type I18nIssue = MessageUse & {
  type: "missing-key" | "empty-translation" | "placeholder-mismatch";
};

const placeholders = (message: string) =>
  [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort().join(",");

export const checkMessages = (uses: MessageUse[], messages: Record<string, string>): I18nIssue[] =>
  uses.flatMap((use): I18nIssue[] => {
    if (!Object.hasOwn(messages, use.key)) return [{ ...use, type: "missing-key" }];
    const translated = messages[use.key]!;
    if (!translated.trim()) return [{ ...use, type: "empty-translation" }];
    if (placeholders(use.key) !== placeholders(translated))
      return [{ ...use, type: "placeholder-mismatch" }];
    return [];
  });

const walk = (node: ts.Node, visit: (node: ts.Node) => void) => {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
};
const literal = (node: ts.Node | undefined): node is ts.StringLiteralLike =>
  !!node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
const source = (filePath: string, text: string) =>
  ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
const location = (file: ts.SourceFile, node: ts.Node) => ({
  filePath: file.fileName,
  line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
});

// Resolve lexical symbols, not identifier spellings: an inner `t` parameter is not our translator.
// No type/library resolution is needed for this deliberately bounded, single-file scan.
export const scanTranslationCalls = (filePath: string, text: string) => {
  const file = source(filePath, text);
  const options: ts.CompilerOptions = { noLib: true, noResolve: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => (name === filePath ? file : undefined);
  const checker = ts.createProgram([filePath], options, host).getTypeChecker();
  const hooks = new Map<ts.Symbol, string>();
  const translators = new Set<ts.Symbol>();
  const contexts = new Set<ts.Symbol>();
  const symbol = (node: ts.Node) => checker.getSymbolAtLocation(node);
  walk(file, (node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !literal(node.moduleSpecifier) ||
      !/(?:^|\/)contexts\/i18n-context(?:\.tsx?)?$/.test(node.moduleSpecifier.text)
    )
      return;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return;
    for (const binding of bindings.elements) {
      const name = (binding.propertyName ?? binding.name).text;
      const bindingSymbol = symbol(binding.name);
      if (bindingSymbol && ["useI18n", "useCurrentTranslate"].includes(name))
        hooks.set(bindingSymbol, name);
    }
  });
  const hookCall = (node: ts.Expression, name: string) =>
    ts.isCallExpression(node) &&
    !!symbol(node.expression) &&
    hooks.get(symbol(node.expression)!) === name;
  const isContext = (node: ts.Expression) =>
    hookCall(node, "useI18n") || (!!symbol(node) && contexts.has(symbol(node)!));
  const isTranslator = (node: ts.Expression) =>
    hookCall(node, "useCurrentTranslate") ||
    (!!symbol(node) && translators.has(symbol(node)!)) ||
    (ts.isPropertyAccessExpression(node) && node.name.text === "t" && isContext(node.expression));
  // Fixed point supports aliases declared outside/after a component without leaking across scopes.
  let changed = true;
  while (changed) {
    changed = false;
    const add = (set: Set<ts.Symbol>, node: ts.Node) => {
      const value = symbol(node);
      if (value && !set.has(value)) {
        set.add(value);
        changed = true;
      }
    };
    walk(file, (node) => {
      if (ts.isCallExpression(node)) {
        for (const declaration of symbol(node.expression)?.declarations ?? []) {
          const fn = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
          if (
            !fn ||
            (!ts.isArrowFunction(fn) &&
              !ts.isFunctionExpression(fn) &&
              !ts.isFunctionDeclaration(fn))
          )
            continue;
          node.arguments.forEach((argument, index) => {
            const parameter = fn.parameters[index];
            if (parameter && ts.isIdentifier(parameter.name) && isTranslator(argument))
              add(translators, parameter.name);
          });
        }
      }
      if (!ts.isVariableDeclaration(node) || !node.initializer) return;
      if (ts.isIdentifier(node.name)) {
        if (isContext(node.initializer)) add(contexts, node.name);
        if (isTranslator(node.initializer)) add(translators, node.name);
      } else if (ts.isObjectBindingPattern(node.name) && isContext(node.initializer)) {
        for (const binding of node.name.elements) {
          if ((binding.propertyName ?? binding.name).getText(file) === "t")
            add(translators, binding.name);
        }
      }
    });
  }
  const messages: MessageUse[] = [];
  const unresolvedDynamic: Array<{ filePath: string; line: number; expression: string }> = [];
  walk(file, (node) => {
    if (!ts.isCallExpression(node) || !isTranslator(node.expression)) return;
    const argument = node.arguments[0];
    if (literal(argument)) messages.push({ ...location(file, argument), key: argument.text });
    else
      unresolvedDynamic.push({
        ...location(file, node),
        expression: argument?.getText(file) ?? "<no argument>",
      });
  });
  return { messages, unresolvedDynamic };
};

// These are catalogs of application-owned messages, not arbitrary API/user strings.
// U3/U4 add their finite theme/timeline catalogs here when those modules are implemented.
export const dynamicCatalogs = [
  {
    filePath: "packages/contracts/src/admin.ts",
    variable: "ADMIN_PERMISSION_CATALOG",
    fields: ["category", "label", "description"],
  },
  { filePath: "apps/admin/src/shared/i18n/api-error.ts", variable: "API_ERROR_MESSAGE" },
  { filePath: "apps/admin/src/pages/iam/users-page.tsx", variable: "labels" },
  {
    filePath: "apps/admin/src/pages/storefront/theme-editor-page.tsx",
    variable: "operatorRunStatusMessages",
  },
  {
    filePath: "apps/admin/src/pages/storefront/theme-editor-page.tsx",
    variable: "previewBuildStatus",
    fields: ["label"],
  },
] as const;

export const scanMessageCatalog = (
  filePath: string,
  text: string,
  variable: string,
  fields?: readonly string[],
) => {
  const file = source(filePath, text);
  const messages: MessageUse[] = [];
  let found = false;
  walk(file, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      node.name.text !== variable ||
      !node.initializer
    )
      return;
    found = true;
    walk(node.initializer, (entry) => {
      if (!ts.isPropertyAssignment(entry) || !literal(entry.initializer)) return;
      const name = ts.isIdentifier(entry.name) || literal(entry.name) ? entry.name.text : undefined;
      if (!fields || (name && fields.includes(name)))
        messages.push({ ...location(file, entry.initializer), key: entry.initializer.text });
    });
  });
  if (!found || messages.length === 0)
    throw new Error(
      `Message catalog ${variable} was not found or has no literal messages in ${filePath}`,
    );
  return messages;
};

export const isProductionSource = (filePath: string) => {
  const relative = filePath.replaceAll("\\", "/");
  return (
    /\.tsx?$/.test(relative) &&
    !/\.d\.ts$/.test(relative) &&
    !/\.(?:test|spec)\./.test(relative) &&
    !/(?:^|\/)(?:test|tests|__tests__|fixtures|__fixtures__)(?:\/|$)/.test(relative) &&
    // routes.config.ts mounts commerce pages only; scaffold examples are not shipped routes.
    !/(?:^|\/)pages\/templates\//.test(relative)
  );
};

export const auditAdminI18n = (root: string, messages: Record<string, string>) => {
  const files: string[] = [];
  const collect = (directory: string) => {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const filePath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) collect(filePath);
      else if (isProductionSource(filePath)) files.push(filePath);
    }
  };
  collect("apps/admin/src");
  const results = files
    .sort()
    .map((filePath) =>
      scanTranslationCalls(filePath, readFileSync(path.join(root, filePath), "utf8")),
    );
  const uses = results.flatMap((result) => result.messages);
  for (const catalog of dynamicCatalogs) {
    uses.push(
      ...scanMessageCatalog(
        catalog.filePath,
        readFileSync(path.join(root, catalog.filePath), "utf8"),
        catalog.variable,
        "fields" in catalog ? catalog.fields : undefined,
      ),
    );
  }
  return {
    issues: checkMessages(uses, messages),
    messages: uses,
    unresolvedDynamic: results.flatMap((result) => result.unresolvedDynamic),
    files,
  };
};
