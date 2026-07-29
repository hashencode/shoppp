import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'
import {
  resolveActionColumnWidth,
  type ActionColumnTableSize,
} from '../shared/template-kit/list/resolve-action-column-width'

export type TableWidthIssueType =
  | 'missing-width'
  | 'unknown-width'
  | 'missing-scroll'
  | 'scroll-too-small'

export type TableWidthIssueSeverity = 'error' | 'warn'

export type TableWidthIssue = {
  type: TableWidthIssueType
  severity: TableWidthIssueSeverity
  filePath: string
  line: number
  message: string
}

export type ColumnAudit = {
  title: string
  key?: string
  line: number
  width?: number
  widthSource?: string
  suggestedWidth: number
}

export type ColumnGroupAudit = {
  name: string
  line: number
  columns: ColumnAudit[]
  knownWidthTotal: number
}

export type TableUsageAudit = {
  line: number
  hasScroll: boolean
}

export type SourceAuditResult = {
  filePath: string
  tableUsages: TableUsageAudit[]
  columnGroups: ColumnGroupAudit[]
  scrollValues: Array<{ name: string; value: number; line: number }>
  issues: TableWidthIssue[]
}

const DEFAULT_COLUMN_WIDTH = 120
const MAX_SUGGESTED_COLUMN_WIDTH = 220
const TABLE_FILE_EXTENSIONS = new Set(['.tsx'])

const WIDTH_RULES: Array<{ patterns: RegExp[]; width: number }> = [
  { patterns: [/身份证/], width: 190 },
  { patterns: [/手机号|手机|电话/], width: 130 },
  { patterns: [/创建时间|更新时间|开始时间|结束时间|调度时间/], width: 180 },
  { patterns: [/日期/], width: 130 },
  { patterns: [/时段|时间段/], width: 180 },
  { patterns: [/地址|考场/], width: 320 },
  { patterns: [/基地|机构|单位/], width: 220 },
  { patterns: [/名称|标题/], width: 220 },
  { patterns: [/姓名|学员|姓名|用户/], width: 100 },
  { patterns: [/状态|结果|类型|属性/], width: 110 },
  { patterns: [/序号|人数|数量|次数|金额|单价/], width: 100 },
  { patterns: [/ID|编号|#|排名/], width: 90 },
  { patterns: [/操作/], width: 126 },
]

export const suggestColumnWidth = (title: string, key?: string): number => {
  const subject = `${title} ${key ?? ''}`
  const width =
    WIDTH_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(subject)))?.width ??
    DEFAULT_COLUMN_WIDTH

  return Math.min(width, MAX_SUGGESTED_COLUMN_WIDTH)
}

const getLine = (sourceFile: ts.SourceFile, node: ts.Node) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

const getPropertyNameText = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }

  return undefined
}

const getJsxAttributeNameText = (name: ts.JsxAttributeName): string | undefined => {
  if (ts.isIdentifier(name)) {
    return name.text
  }

  return undefined
}

const getObjectProperty = (node: ts.ObjectLiteralExpression, propertyName: string) => {
  return node.properties.find((property): property is ts.PropertyAssignment => {
    if (!ts.isPropertyAssignment(property)) {
      return false
    }

    return getPropertyNameText(property.name) === propertyName
  })
}

const getTextValue = (expression: ts.Expression | undefined): string | undefined => {
  if (!expression) {
    return undefined
  }

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text
  }

  if (ts.isIdentifier(expression)) {
    return expression.text
  }

  return undefined
}

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression

  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }

  return current
}

const getNumericLiteralValue = (expression: ts.Expression): number | undefined => {
  const unwrappedExpression = unwrapExpression(expression)

  if (ts.isNumericLiteral(unwrappedExpression)) {
    return Number(unwrappedExpression.text)
  }

  if (
    ts.isPrefixUnaryExpression(unwrappedExpression) &&
    ts.isNumericLiteral(unwrappedExpression.operand)
  ) {
    const value = Number(unwrappedExpression.operand.text)
    return unwrappedExpression.operator === ts.SyntaxKind.MinusToken ? -value : value
  }

  return undefined
}

const getObjectNumericProperties = (expression: ts.Expression) => {
  const values = new Map<string, number>()
  const unwrappedExpression = unwrapExpression(expression)

  if (!ts.isObjectLiteralExpression(unwrappedExpression)) {
    return values
  }

  for (const property of unwrappedExpression.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue
    }

    const propertyName = getPropertyNameText(property.name)
    const propertyValue = getNumericLiteralValue(property.initializer)

    if (propertyName && typeof propertyValue === 'number') {
      values.set(propertyName, propertyValue)
    }
  }

  return values
}

const getResolvableExpressionName = (expression: ts.Expression): string | undefined => {
  const unwrappedExpression = unwrapExpression(expression)

  if (ts.isIdentifier(unwrappedExpression)) {
    return unwrappedExpression.text
  }

  if (ts.isPropertyAccessExpression(unwrappedExpression)) {
    return unwrappedExpression.getText()
  }

  if (
    ts.isElementAccessExpression(unwrappedExpression) &&
    ts.isIdentifier(unwrappedExpression.expression) &&
    unwrappedExpression.argumentExpression &&
    ts.isStringLiteral(unwrappedExpression.argumentExpression)
  ) {
    return `${unwrappedExpression.expression.text}.${unwrappedExpression.argumentExpression.text}`
  }

  return undefined
}

const getResolvedActionColumnTableSize = (expression: ts.Expression | undefined): ActionColumnTableSize => {
  const unwrappedExpression = expression ? unwrapExpression(expression) : undefined

  if (
    unwrappedExpression &&
    (ts.isStringLiteral(unwrappedExpression) ||
      ts.isNoSubstitutionTemplateLiteral(unwrappedExpression)) &&
    ['large', 'middle', 'small'].includes(unwrappedExpression.text)
  ) {
    return unwrappedExpression.text as ActionColumnTableSize
  }

  return 'large'
}

const resolveWidth = (
  expression: ts.Expression | undefined,
  numericConstants: Map<string, number>
): { value?: number; source?: string; unknown: boolean } => {
  if (!expression) {
    return { unknown: false }
  }

  const unwrappedExpression = unwrapExpression(expression)
  const literalValue = getNumericLiteralValue(unwrappedExpression)
  if (typeof literalValue === 'number') {
    return { value: literalValue, source: String(literalValue), unknown: false }
  }

  if (
    ts.isCallExpression(unwrappedExpression) &&
    ts.isIdentifier(unwrappedExpression.expression) &&
    unwrappedExpression.expression.text === 'resolveActionColumnWidth'
  ) {
    const [baseExpression, sizeOrMaxExpression, maxExpression] = unwrappedExpression.arguments
    const baseWidth = resolveWidth(baseExpression, numericConstants)
    if (typeof baseWidth.value !== 'number') {
      return { source: unwrappedExpression.getText(), unknown: true }
    }

    const unwrappedSizeOrMaxExpression = sizeOrMaxExpression
      ? unwrapExpression(sizeOrMaxExpression)
      : undefined
    const tableSize = getResolvedActionColumnTableSize(unwrappedSizeOrMaxExpression)
    const inlineMaxWidth =
      unwrappedSizeOrMaxExpression &&
      !(ts.isStringLiteral(unwrappedSizeOrMaxExpression) ||
        ts.isNoSubstitutionTemplateLiteral(unwrappedSizeOrMaxExpression))
        ? resolveWidth(unwrappedSizeOrMaxExpression, numericConstants).value
        : undefined
    const explicitMaxWidth = maxExpression
      ? resolveWidth(maxExpression, numericConstants).value
      : undefined
    const maxWidth =
      typeof explicitMaxWidth === 'number'
        ? explicitMaxWidth
        : typeof inlineMaxWidth === 'number'
          ? inlineMaxWidth
          : undefined
    return {
      value: resolveActionColumnWidth(baseWidth.value, tableSize, maxWidth),
      source: unwrappedExpression.getText(),
      unknown: false,
    }
  }

  const expressionName = getResolvableExpressionName(unwrappedExpression)
  if (expressionName) {
    const constantValue = numericConstants.get(expressionName)
    return {
      value: constantValue,
      source: expressionName,
      unknown: typeof constantValue !== 'number',
    }
  }

  return { source: expression.getText(), unknown: true }
}

const isTableColumnObject = (node: ts.ObjectLiteralExpression): boolean => {
  const hasTitle = Boolean(getObjectProperty(node, 'title'))
  const hasColumnShape =
    Boolean(getObjectProperty(node, 'key')) ||
    Boolean(getObjectProperty(node, 'dataIndex')) ||
    Boolean(getObjectProperty(node, 'render')) ||
    Boolean(getObjectProperty(node, 'width')) ||
    Boolean(getObjectProperty(node, 'align'))

  return hasTitle && hasColumnShape
}

const getArrayGroupName = (node: ts.ArrayLiteralExpression): string => {
  const parent = node.parent

  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text
  }

  if (ts.isPropertyAssignment(parent)) {
    return getPropertyNameText(parent.name) ?? 'inline-columns'
  }

  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    return getJsxAttributeNameText(parent.parent.name) ?? 'inline-columns'
  }

  return 'inline-columns'
}

const isColumnLikeName = (name: string | undefined): boolean =>
  Boolean(name && /column/i.test(name))

const getContainingVariableName = (node: ts.Node): string | undefined => {
  let current: ts.Node | undefined = node

  while (current) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text
    }

    current = current.parent
  }

  return undefined
}

const isWithinBuildColumnsProperty = (node: ts.Node): boolean => {
  let current: ts.Node | undefined = node.parent

  while (current) {
    if (
      ts.isPropertyAssignment(current) &&
      getPropertyNameText(current.name) === 'buildColumns'
    ) {
      return true
    }

    current = current.parent
  }

  return false
}

const isColumnArrayContext = (node: ts.ArrayLiteralExpression): boolean => {
  const parent = node.parent

  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return isColumnLikeName(parent.name.text)
  }

  if (ts.isPropertyAssignment(parent)) {
    const propertyName = getPropertyNameText(parent.name)
    return propertyName === 'columns' || propertyName === 'buildColumns'
  }

  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    return getJsxAttributeNameText(parent.parent.name) === 'columns'
  }

  return isColumnLikeName(getContainingVariableName(node)) || isWithinBuildColumnsProperty(node)
}

const collectNumericConstants = (sourceFile: ts.SourceFile) => {
  const numericConstants = new Map<string, number>()

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const literalValue = getNumericLiteralValue(node.initializer)

      if (typeof literalValue === 'number') {
        numericConstants.set(node.name.text, literalValue)
      }

      for (const [propertyName, propertyValue] of getObjectNumericProperties(node.initializer)) {
        numericConstants.set(`${node.name.text}.${propertyName}`, propertyValue)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return numericConstants
}

const buildColumnAudit = (
  sourceFile: ts.SourceFile,
  node: ts.ObjectLiteralExpression,
  numericConstants: Map<string, number>
): ColumnAudit | null => {
  if (!isTableColumnObject(node)) {
    return null
  }

  const title = getTextValue(getObjectProperty(node, 'title')?.initializer)
  if (!title) {
    return null
  }

  const key =
    getTextValue(getObjectProperty(node, 'key')?.initializer) ??
    getTextValue(getObjectProperty(node, 'dataIndex')?.initializer)
  const widthResult = resolveWidth(getObjectProperty(node, 'width')?.initializer, numericConstants)

  return {
    title,
    key,
    line: getLine(sourceFile, node),
    width: widthResult.value,
    widthSource: widthResult.source,
    suggestedWidth: suggestColumnWidth(title, key),
  }
}

const collectColumnGroups = (
  sourceFile: ts.SourceFile,
  numericConstants: Map<string, number>
): ColumnGroupAudit[] => {
  const groups: ColumnGroupAudit[] = []

  const addGroup = (name: string, line: number, columns: ColumnAudit[]) => {
    if (columns.length === 0) {
      return
    }

    groups.push({
      name,
      line,
      columns,
      knownWidthTotal: columns.reduce((total, column) => total + (column.width ?? 0), 0),
    })
  }

  const visit = (node: ts.Node) => {
    if (ts.isArrayLiteralExpression(node) && isColumnArrayContext(node)) {
      const columns = node.elements
        .filter(ts.isObjectLiteralExpression)
        .map((element) => buildColumnAudit(sourceFile, element, numericConstants))
        .filter((column): column is ColumnAudit => Boolean(column))

      addGroup(getArrayGroupName(node), getLine(sourceFile, node), columns)
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'push' &&
      ts.isIdentifier(node.expression.expression) &&
      isColumnLikeName(node.expression.expression.text)
    ) {
      const columns = node.arguments
        .filter(ts.isObjectLiteralExpression)
        .map((argument) => buildColumnAudit(sourceFile, argument, numericConstants))
        .filter((column): column is ColumnAudit => Boolean(column))

      addGroup(`${node.expression.expression.text}.push`, getLine(sourceFile, node), columns)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return groups
}

const isTableJsxTag = (tagName: ts.JsxTagNameExpression): boolean => {
  if (ts.isIdentifier(tagName)) {
    return tagName.text === 'Table'
  }

  if (ts.isPropertyAccessExpression(tagName)) {
    return tagName.name.text === 'Table'
  }

  return false
}

const collectTableUsages = (sourceFile: ts.SourceFile): TableUsageAudit[] => {
  const usages: TableUsageAudit[] = []

  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      isTableJsxTag(node.tagName)
    ) {
      usages.push({
        line: getLine(sourceFile, node),
        hasScroll: node.attributes.properties.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) && getJsxAttributeNameText(attribute.name) === 'scroll'
        ),
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return usages
}

const collectScrollValues = (
  sourceFile: ts.SourceFile,
  numericConstants: Map<string, number>
): Array<{ name: string; value: number; line: number }> => {
  const values: Array<{ name: string; value: number; line: number }> = []

  for (const [name, value] of numericConstants) {
    if (name.toUpperCase().includes('SCROLL_X')) {
      values.push({ name, value, line: 1 })
    }
  }

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.toUpperCase().includes('SCROLL_X') &&
      node.initializer
    ) {
      const constantName = node.name.text
      const value = getNumericLiteralValue(node.initializer)
      if (typeof value === 'number') {
        const existing = values.find((item) => item.name === constantName)
        if (existing) {
          existing.line = getLine(sourceFile, node)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return values
}

const buildIssues = (result: Omit<SourceAuditResult, 'issues'>): TableWidthIssue[] => {
  const issues: TableWidthIssue[] = []
  const maxScroll = Math.max(0, ...result.scrollValues.map((item) => item.value))

  for (const tableUsage of result.tableUsages) {
    if (!tableUsage.hasScroll) {
      issues.push({
        type: 'missing-scroll',
        severity: 'error',
        filePath: result.filePath,
        line: tableUsage.line,
        message: 'Table is missing a scroll.x contract.',
      })
    }
  }

  for (const group of result.columnGroups) {
    for (const column of group.columns) {
      if (column.width === undefined && column.widthSource === undefined) {
        issues.push({
          type: 'missing-width',
          severity: 'error',
          filePath: result.filePath,
          line: column.line,
          message: `${group.name} column "${column.title}" is missing width; suggested ${column.suggestedWidth}px.`,
        })
      } else if (column.width === undefined && column.widthSource !== undefined) {
        issues.push({
          type: 'unknown-width',
          severity: 'warn',
          filePath: result.filePath,
          line: column.line,
          message: `${group.name} column "${column.title}" uses unresolved width "${column.widthSource}".`,
        })
      }
    }

    if (group.knownWidthTotal > 0 && maxScroll > 0 && group.knownWidthTotal > maxScroll) {
      issues.push({
        type: 'scroll-too-small',
        severity: 'error',
        filePath: result.filePath,
        line: group.line,
        message: `${group.name} width total ${group.knownWidthTotal}px exceeds max scroll.x ${maxScroll}px.`,
      })
    }
  }

  return issues
}

export const auditSourceText = (filePath: string, sourceText: string): SourceAuditResult => {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const numericConstants = collectNumericConstants(sourceFile)
  const result = {
    filePath,
    tableUsages: collectTableUsages(sourceFile),
    columnGroups: collectColumnGroups(sourceFile, numericConstants),
    scrollValues: collectScrollValues(sourceFile, numericConstants),
  }

  return {
    ...result,
    issues: buildIssues(result),
  }
}

const listFiles = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return []
  }

  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      return listFiles(fullPath)
    }

    if (!TABLE_FILE_EXTENSIONS.has(path.extname(fullPath))) {
      return []
    }

    if (/\.test\.tsx$|\.spec\.tsx$|\.browser\.test\.tsx$/.test(fullPath)) {
      return []
    }

    return [fullPath]
  })
}

export const auditProject = (rootDir = process.cwd()): SourceAuditResult[] => {
  const srcDir = path.join(rootDir, 'src')

  return listFiles(srcDir)
    .map((filePath) =>
      auditSourceText(path.relative(rootDir, filePath), readFileSync(filePath, 'utf8'))
    )
    .filter((result) => result.tableUsages.length > 0)
}

const formatIssue = (issue: TableWidthIssue) =>
  `  [${issue.severity.toUpperCase()}] ${issue.filePath}:${issue.line} ${issue.message}`

export const formatAuditReport = (results: SourceAuditResult[]): string => {
  const issueResults = results.filter((result) => result.issues.length > 0)
  const okCount = results.length - issueResults.length
  const lines = [
    'Table Width Audit',
    `Files checked: ${results.length}`,
    `OK: ${okCount}`,
    `With issues: ${issueResults.length}`,
  ]

  for (const result of issueResults) {
    lines.push('', result.filePath)
    lines.push(...result.issues.map(formatIssue))
  }

  if (issueResults.length === 0) {
    lines.push('', 'All audited Table usages have static width and scroll contracts.')
  }

  return lines.join('\n')
}

const runCli = () => {
  const results = auditProject()
  const report = formatAuditReport(results)
  const isStrict = process.argv.includes('--strict')
  console.log(report)

  const hasErrors = results.some((result) =>
    result.issues.some((issue) => issue.severity === 'error')
  )
  if (isStrict && hasErrors) {
    process.exitCode = 1
  }
}

if (
  process.argv[1]?.endsWith('table-width-audit.ts') ||
  process.argv[1]?.endsWith('table-width-audit.js')
) {
  runCli()
}
