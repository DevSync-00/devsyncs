import ts from 'typescript';
import type { ApplicationReference, ApplicationReferenceKind } from './schema-scanner';

type TableShape = { name: string; columns: Array<{ name: string }> };

function operationForMethod(method: string): ApplicationReference['operation'] {
  if (['delete', 'deleteMany'].includes(method)) return 'delete';
  if (['insert', 'update', 'upsert', 'create', 'createMany', 'updateMany'].includes(method)) return 'write';
  if (['select', 'findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(method)) return 'read';
  return 'unknown';
}

function stringArgument(call: ts.CallExpression, position = 0): string | null {
  const argument = call.arguments[position];
  return argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : null;
}

function statementFor(node: ts.Node): ts.Node {
  let current = node;
  while (current.parent && !ts.isStatement(current.parent)) current = current.parent;
  return current.parent && ts.isStatement(current.parent) ? current.parent : current;
}

function columnsInQuery(text: string, columns: Array<{ name: string }>): string[] {
  return columns
    .filter((column) => new RegExp(`(^|[^a-zA-Z0-9_])${column.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zA-Z0-9_]|$)`, 'i').test(text))
    .map((column) => column.name);
}

export function extractAstReferences(
  content: string,
  file: string,
  kind: ApplicationReferenceKind,
  tables: TableShape[],
): ApplicationReference[] {
  if (!/\.[cm]?[jt]sx?$/.test(file)) return [];
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const tableMap = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  const references: ApplicationReference[] = [];

  const add = (node: ts.Node, tableName: string, operation: ApplicationReference['operation'], confidence: number) => {
    const table = tableMap.get(tableName.toLowerCase());
    if (!table) return;
    const statement = statementFor(node);
    const excerpt = statement.getText(source).replace(/\s+/g, ' ').trim().slice(0, 220);
    const columns = columnsInQuery(excerpt, table.columns || []);
    const location = source.getLineAndCharacterOfPosition(node.getStart(source));
    references.push({
      id: '',
      table: table.name,
      column: columns.length === 1 ? columns[0] : undefined,
      file,
      line: location.line + 1,
      kind,
      operation,
      excerpt,
      confidence,
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === 'from') {
        const table = stringArgument(node);
        if (table) {
          const statement = statementFor(node).getText(source);
          const chainedMethod = Array.from(statement.matchAll(/\.(select|insert|update|upsert|delete)\s*\(/g)).at(-1)?.[1] || 'unknown';
          add(node, table, operationForMethod(chainedMethod), 0.98);
        }
      } else if (ts.isPropertyAccessExpression(node.expression.expression)) {
        const modelAccess = node.expression.expression;
        const client = modelAccess.expression;
        if (ts.isIdentifier(client) && /^(prisma|db|client)$/i.test(client.text)) {
          add(node, modelAccess.name.text, operationForMethod(method), 0.97);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return references;
}
