import {
  ParsedFileResult,
  ParsedFunction,
  ParsedClass,
  ParsedImport,
  ParsedAPI,
} from './types.js';

export class CodeParser {
  /**
   * Parse a single file's content based on its extension
   */
  public parseFile(filePath: string, content: string): ParsedFileResult {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    const lines = content.split('\n');
    const linesCount = lines.length;

    let imports: ParsedImport[] = [];
    let functions: ParsedFunction[] = [];
    let classes: ParsedClass[] = [];
    let apis: ParsedAPI[] = [];
    const technologies = new Set<string>();

    if (ext === '.py') {
      imports = this.parsePythonImports(content);
      functions = this.parsePythonFunctions(filePath, lines);
      classes = this.parsePythonClasses(filePath, lines);
      apis = this.parsePythonAPIs(filePath, lines, content);
      this.detectPythonTechnologies(content, technologies);
    } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      imports = this.parseJSImports(content);
      functions = this.parseJSFunctions(filePath, lines);
      classes = this.parseJSClasses(filePath, lines);
      apis = this.parseJSAPIs(filePath, lines, content);
      this.detectJSTechnologies(filePath, content, technologies);
    }

    return {
      path: filePath,
      language: ext === '.py' ? 'Python' : (ext.startsWith('.t') ? 'TypeScript' : 'JavaScript'),
      imports,
      functions,
      classes,
      apis,
      technologies: Array.from(technologies),
      linesCount,
    };
  }

  // ==========================================
  // PYTHON PARSING
  // ==========================================

  private parsePythonImports(content: string): ParsedImport[] {
    const imports: ParsedImport[] = [];
    const fromRegex = /from\s+([a-zA-Z0-9_.]+)\s+import\s+([^#\n]+)/g;
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      const source = match[1].trim();
      const items = match[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      imports.push({
        raw: match[0],
        source,
        importedItems: items,
      });
    }

    const importRegex = /^import\s+([^#\n]+)/gm;
    while ((match = importRegex.exec(content)) !== null) {
      const parts = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      for (const p of parts) {
        imports.push({
          raw: match[0],
          source: p,
          importedItems: [p],
        });
      }
    }

    return imports;
  }

  private parsePythonFunctions(filePath: string, lines: string[]): ParsedFunction[] {
    const functions: ParsedFunction[] = [];
    const funcRegex = /^[ \t]*(async\s+def|def)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(funcRegex);
      if (match) {
        const isAsync = match[1].includes('async');
        const name = match[2];
        const rawParams = match[3];
        const parameters = rawParams
          .split(',')
          .map(p => p.trim().split(':')[0].split('=')[0].trim())
          .filter(p => p && p !== 'self' && p !== 'cls');

        // Lookahead to find function calls inside this function body
        const calls: string[] = [];
        let j = i + 1;
        const baseIndent = line.search(/\S/);
        while (j < lines.length) {
          const bodyLine = lines[j];
          if (!bodyLine.trim() || bodyLine.trim().startsWith('#')) {
            j++;
            continue;
          }
          const indent = bodyLine.search(/\S/);
          if (indent <= baseIndent && indent !== -1) {
            break;
          }

          // Simple call detection foo(...)
          const callMatches = bodyLine.matchAll(/([a-zA-Z0-9_]+)\s*\(/g);
          for (const cm of callMatches) {
            const called = cm[1];
            if (!['if', 'for', 'while', 'print', 'len', 'range', 'str', 'int', 'dict', 'list', 'set', 'super', 'isinstance'].includes(called)) {
              if (!calls.includes(called)) calls.push(called);
            }
          }
          j++;
        }

        functions.push({
          id: `${filePath}#${name}`,
          name,
          filePath,
          startLine: i + 1,
          endLine: j,
          parameters,
          calls,
          isAsync,
        });
      }
    }
    return functions;
  }

  private parsePythonClasses(filePath: string, lines: string[]): ParsedClass[] {
    const classes: ParsedClass[] = [];
    const classRegex = /^[ \t]*class\s+([a-zA-Z0-9_]+)(?:\(([^)]*)\))?:/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(classRegex);
      if (match) {
        const name = match[1];
        const methods: string[] = [];
        let j = i + 1;
        const baseIndent = line.search(/\S/);
        while (j < lines.length) {
          const bodyLine = lines[j];
          if (bodyLine.trim()) {
            const indent = bodyLine.search(/\S/);
            if (indent <= baseIndent && indent !== -1) break;
            const defMatch = bodyLine.match(/^[ \t]+def\s+([a-zA-Z0-9_]+)/);
            if (defMatch) methods.push(defMatch[1]);
          }
          j++;
        }

        classes.push({
          id: `${filePath}#${name}`,
          name,
          filePath,
          startLine: i + 1,
          methods,
        });
      }
    }
    return classes;
  }

  private parsePythonAPIs(filePath: string, lines: string[], content: string): ParsedAPI[] {
    const apis: ParsedAPI[] = [];
    // FastAPI / Flask route decorators:
    // @app.get("/users") or @router.post("/auth/login")
    const routeRegex = /@(app|router|api_router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i;
    // Flask route: @app.route("/items", methods=["POST"])
    const flaskRegex = /@app\.route\s*\(\s*["']([^"']+)["'](?:.*methods=\[([^\]]+)\])?/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(routeRegex);
      if (match) {
        const method = match[2].toUpperCase() as any;
        const path = match[3];

        // Next line or nearby is def handler
        let handlerName = 'anonymous_handler';
        for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
          const fnMatch = lines[k].match(/def\s+([a-zA-Z0-9_]+)/);
          if (fnMatch) {
            handlerName = fnMatch[1];
            break;
          }
        }

        const dbOperations: string[] = [];
        if (/db\.query|session\.query|db\.add|session\.commit|execute\(/i.test(content)) {
          dbOperations.push('PostgreSQL / SQLAlchemy Database Query');
        }

        apis.push({
          id: `api:${method}:${path}`,
          method,
          path,
          framework: 'FastAPI',
          handlerName,
          filePath,
          line: i + 1,
          dbOperations,
        });
      } else {
        const flaskMatch = line.match(flaskRegex);
        if (flaskMatch) {
          const path = flaskMatch[1];
          let method: any = 'GET';
          if (flaskMatch[2]) {
            if (flaskMatch[2].includes('POST')) method = 'POST';
            else if (flaskMatch[2].includes('DELETE')) method = 'DELETE';
            else if (flaskMatch[2].includes('PUT')) method = 'PUT';
          }

          let handlerName = 'flask_handler';
          for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
            const fnMatch = lines[k].match(/def\s+([a-zA-Z0-9_]+)/);
            if (fnMatch) {
              handlerName = fnMatch[1];
              break;
            }
          }

          apis.push({
            id: `api:${method}:${path}`,
            method,
            path,
            framework: 'Flask',
            handlerName,
            filePath,
            line: i + 1,
          });
        }
      }
    }
    return apis;
  }

  private detectPythonTechnologies(content: string, tech: Set<string>) {
    if (/fastapi/i.test(content)) tech.add('FastAPI');
    if (/flask/i.test(content)) tech.add('Flask');
    if (/django/i.test(content)) tech.add('Django');
    if (/sqlalchemy|sessionmaker/i.test(content)) tech.add('SQLAlchemy');
    if (/pydantic|BaseModel/i.test(content)) tech.add('Pydantic');
    if (/neo4j/i.test(content)) tech.add('Neo4j');
    if (/redis/i.test(content)) tech.add('Redis');
    if (/celery/i.test(content)) tech.add('Celery');
    if (/openai|genai|gemini/i.test(content)) tech.add('AI / LLM');
    if (/pytest/i.test(content)) tech.add('Pytest');
    if (/jwt|oauth2/i.test(content)) tech.add('JWT Auth');
  }

  // ==========================================
  // JAVASCRIPT / TYPESCRIPT PARSING
  // ==========================================

  private parseJSImports(content: string): ParsedImport[] {
    const imports: ParsedImport[] = [];

    // ES6 static import: import ... from './path'
    const importRegex = /import\s+(?:([\w\s{},*]+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const clause = match[1] || '';
      const source = match[2];
      const items = clause
        .replace(/[{}]/g, '')
        .split(',')
        .map(s => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean);

      imports.push({
        raw: match[0],
        source,
        importedItems: items.length > 0 ? items : [source],
      });
    }

    // CommonJS require: const x = require('./path')
    const requireRegex = /(?:const|let|var)\s+([\w\s{},*]+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const clause = match[1];
      const source = match[2];
      const items = clause
        .replace(/[{}]/g, '')
        .split(',')
        .map(s => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean);

      imports.push({
        raw: match[0],
        source,
        importedItems: items.length > 0 ? items : [source],
      });
    }

    return imports;
  }

  private parseJSFunctions(filePath: string, lines: string[]): ParsedFunction[] {
    const functions: ParsedFunction[] = [];
    const funcDeclRegex = /^[ \t]*(export\s+)?(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;
    const arrowFuncRegex = /^[ \t]*(export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*[^=>]+)?\s*=>/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let name = '';
      let isAsync = false;
      let rawParams = '';

      const declMatch = line.match(funcDeclRegex);
      if (declMatch) {
        isAsync = Boolean(declMatch[2]);
        name = declMatch[3];
        rawParams = declMatch[4];
      } else {
        const arrowMatch = line.match(arrowFuncRegex);
        if (arrowMatch) {
          name = arrowMatch[2];
          isAsync = Boolean(arrowMatch[3]);
          rawParams = arrowMatch[4];
        }
      }

      if (name) {
        const parameters = rawParams
          .split(',')
          .map(p => p.trim().split(':')[0].trim())
          .filter(Boolean);

        // Find function calls inside next 25 lines
        const calls: string[] = [];
        for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
          const bodyLine = lines[j];
          const callMatches = bodyLine.matchAll(/([a-zA-Z0-9_]+)\s*\(/g);
          for (const cm of callMatches) {
            const called = cm[1];
            if (!['if', 'for', 'while', 'switch', 'catch', 'require', 'import', 'console', 'Object', 'Array'].includes(called)) {
              if (!calls.includes(called) && called !== name) calls.push(called);
            }
          }
        }

        functions.push({
          id: `${filePath}#${name}`,
          name,
          filePath,
          startLine: i + 1,
          parameters,
          calls,
          isAsync,
        });
      }
    }
    return functions;
  }

  private parseJSClasses(filePath: string, lines: string[]): ParsedClass[] {
    const classes: ParsedClass[] = [];
    const classRegex = /^[ \t]*(export\s+)?class\s+([a-zA-Z0-9_]+)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(classRegex);
      if (match) {
        const name = match[2];
        const methods: string[] = [];
        for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
          const methodMatch = lines[j].match(/^[ \t]*(async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/);
          if (methodMatch && !['constructor', 'if', 'while'].includes(methodMatch[2])) {
            methods.push(methodMatch[2]);
          }
        }
        classes.push({
          id: `${filePath}#${name}`,
          name,
          filePath,
          startLine: i + 1,
          methods,
        });
      }
    }
    return classes;
  }

  private parseJSAPIs(filePath: string, lines: string[], content: string): ParsedAPI[] {
    const apis: ParsedAPI[] = [];

    // 1. Express / Router routes:
    // app.get('/api/users', handler)
    // router.post('/auth/login', [authMiddleware], loginController)
    const expressRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*[^,]+)*\s*,\s*([a-zA-Z0-9_]+|\([^)]*\)\s*=>)/g;
    let match;
    while ((match = expressRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase() as any;
      const path = match[2];
      const handlerRaw = match[3];
      const handlerName = handlerRaw.includes('=>') ? 'inline_handler' : handlerRaw;

      const dbOperations: string[] = [];
      if (/prisma\.|findMany|findOne|findUnique|insert|update|query\(|select\(/i.test(content)) {
        dbOperations.push('Database Query (Prisma/ORM/SQL)');
      }

      apis.push({
        id: `api:${method}:${path}`,
        method,
        path,
        framework: 'Express',
        handlerName,
        filePath,
        line: 1,
        dbOperations,
      });
    }

    // 2. Next.js App Router route handlers:
    // src/app/api/auth/login/route.ts -> POST /api/auth/login
    if (filePath.includes('/api/') && (filePath.endsWith('route.ts') || filePath.endsWith('route.js'))) {
      const routePath = filePath
        .replace(/.*\/app\/api/, '/api')
        .replace(/\/route\.(ts|js)/, '');

      const methodMatches = content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/g);
      for (const mm of methodMatches) {
        const method = mm[1] as any;
        apis.push({
          id: `api:${method}:${routePath}`,
          method,
          path: routePath,
          framework: 'Next.js',
          handlerName: `${method}_handler`,
          filePath,
          line: 1,
          dbOperations: /prisma|drizzle|db\./i.test(content) ? ['Database ORM Query'] : undefined,
        });
      }
    }

    return apis;
  }

  private detectJSTechnologies(filePath: string, content: string, tech: Set<string>) {
    if (/react|jsx-runtime|useState|useEffect/i.test(content) || filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) tech.add('React');
    if (/express/i.test(content)) tech.add('Express');
    if (/next|next\/router|next\/navigation/i.test(content)) tech.add('Next.js');
    if (/prisma|@prisma\/client/i.test(content)) tech.add('Prisma ORM');
    if (/drizzle-orm/i.test(content)) tech.add('Drizzle ORM');
    if (/tailwind/i.test(content)) tech.add('Tailwind CSS');
    if (/neo4j-driver/i.test(content)) tech.add('Neo4j');
    if (/mongodb|mongoose/i.test(content)) tech.add('MongoDB');
    if (/redis/i.test(content)) tech.add('Redis');
    if (/jsonwebtoken|bcrypt|passport/i.test(content)) tech.add('Auth / JWT');
    if (/zod/i.test(content)) tech.add('Zod');
    if (/@google\/genai|openai/i.test(content)) tech.add('AI / LLM');
    if (/jest|vitest/i.test(content)) tech.add('Testing (Jest/Vitest)');
  }

  /**
   * Resolve a relative import statement to an exact target file path in the repo
   */
  public resolveImport(currentFilePath: string, importSource: string, repoFiles: string[]): string | null {
    // Only resolve relative or root-aliased internal imports
    if (!importSource.startsWith('.') && !importSource.startsWith('@/')) {
      return null;
    }

    let targetBase: string;
    if (importSource.startsWith('@/')) {
      targetBase = importSource.replace('@/', '');
    } else {
      const currentDir = currentFilePath.split('/').slice(0, -1).join('/');
      const parts = (currentDir ? `${currentDir}/${importSource}` : importSource).split('/');
      const normalizedParts: string[] = [];
      for (const p of parts) {
        if (p === '.' || p === '') continue;
        if (p === '..') {
          normalizedParts.pop();
        } else {
          normalizedParts.push(p);
        }
      }
      targetBase = normalizedParts.join('/');
    }

    const candidateExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '/index.ts', '/index.js', '/index.tsx'];
    for (const ext of candidateExtensions) {
      const testPath = `${targetBase}${ext}`;
      if (repoFiles.includes(testPath)) {
        return testPath;
      }
    }

    return null;
  }
}

export const codeParser = new CodeParser();
