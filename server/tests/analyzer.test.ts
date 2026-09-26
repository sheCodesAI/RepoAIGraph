import { parseGitHubUrl, isRelevantSourceFile, detectLanguage } from '../github.js';
import { CodeParser } from '../parser.js';
import { neo4jService } from '../neo4j.js';
import { seedSampleRepository } from '../sampleData.js';

async function runTests() {
  console.log('🧪 Starting RepoGraph AI Automated Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. GitHub URL Parsing Tests
  console.log('1. Testing GitHub URL Parsing:');
  try {
    const res1 = parseGitHubUrl('https://github.com/facebook/react');
    assert(res1.owner === 'facebook' && res1.repo === 'react', 'Parses standard HTTPS GitHub URL');

    const res2 = parseGitHubUrl('git@github.com:torvalds/linux.git');
    assert(res2.owner === 'torvalds' && res2.repo === 'linux', 'Parses SSH GitHub URL');

    const res3 = parseGitHubUrl('tiangolo/fastapi');
    assert(res3.owner === 'tiangolo' && res3.repo === 'fastapi', 'Parses shorthand owner/repo');

    let threw = false;
    try {
      parseGitHubUrl('https://google.com/invalid');
    } catch {
      threw = true;
    }
    assert(threw, 'Throws on non-GitHub URL');
  } catch (err: any) {
    assert(false, `URL parsing threw unexpectedly: ${err.message}`);
  }

  // 2. Repository Ingestion & File Filtering Tests
  console.log('\n2. Testing Repository Ingestion & File Filtering:');
  assert(isRelevantSourceFile('src/auth/service.ts'), 'Accepts source TypeScript file');
  assert(isRelevantSourceFile('app/api/endpoints.py'), 'Accepts source Python file');
  assert(!isRelevantSourceFile('node_modules/express/index.js'), 'Ignores node_modules');
  assert(!isRelevantSourceFile('.git/HEAD'), 'Ignores .git metadata');
  assert(!isRelevantSourceFile('assets/logo.png'), 'Ignores binary images');
  assert(detectLanguage('test.py') === 'Python', 'Detects Python language');
  assert(detectLanguage('component.tsx') === 'TypeScript', 'Detects TypeScript language');

  // 3. Code Parser & API Detection Tests
  console.log('\n3. Testing Code Parser & API Detection:');
  const parser = new CodeParser();

  // Python FastAPI test
  const pyCode = `
from fastapi import FastAPI, Depends
from .auth import authenticate_user
from ..models import User

app = FastAPI()

@app.post("/api/users/login")
def login_controller(credentials):
    user = authenticate_user(credentials)
    return user

class UserRepository:
    def get_by_id(self, id):
        pass
`;
  const parsedPy = parser.parseFile('app/routes.py', pyCode);
  assert(parsedPy.apis.length === 1, 'Detects FastAPI route endpoint');
  assert(parsedPy.apis[0]?.path === '/api/users/login', 'Identifies API path correctly');
  assert(parsedPy.apis[0]?.method === 'POST', 'Identifies HTTP method correctly');
  assert(parsedPy.functions.some(f => f.name === 'login_controller'), 'Extracts function definition');
  assert(parsedPy.classes.some(c => c.name === 'UserRepository'), 'Extracts class definition');
  assert(parsedPy.imports.length >= 2, 'Extracts imports');

  // TypeScript Express test
  const tsCode = `
import { Router } from 'express';
import { authService } from './auth';

const router = Router();

router.get('/api/v1/health', (req, res) => {
  res.json({ ok: true });
});

export const checkAuth = async () => {
  return authService.verify();
};
`;
  const parsedTS = parser.parseFile('src/api/routes.ts', tsCode);
  assert(parsedTS.apis.length === 1 && parsedTS.apis[0].path === '/api/v1/health', 'Detects Express route');
  assert(parsedTS.functions.some(f => f.name === 'checkAuth'), 'Extracts TS arrow function');

  // 4. Graph Creation & Persistence Tests
  console.log('\n4. Testing Graph Creation & Persistence:');
  const seed = await seedSampleRepository('test/sample-repo');
  assert(seed.nodes.length > 10, 'Creates comprehensive node graph');
  assert(seed.edges.length > 10, 'Creates inter-node relationships');

  const retrieved = await neo4jService.getGraph('test/sample-repo');
  assert(retrieved.nodes.length > 0, 'Retrieves persisted graph from Neo4j engine');

  // 5. Dependency & Traversal Queries Tests
  console.log('\n5. Testing Dependency Queries:');
  const deps = await neo4jService.getFileDependencies('test/sample-repo', 'test/sample-repo/app/services/auth.py');
  assert(deps.nodes.length >= 2, 'Traverses outgoing dependencies (auth.py imports users.py and jwt.py)');

  const dependents = await neo4jService.getFileDependents('test/sample-repo', 'test/sample-repo/app/services/auth.py');
  assert(dependents.nodes.length >= 2, 'Traverses incoming dependents (authentication.py imports auth.py)');

  // 6. Circular Dependency Detection Tests
  console.log('\n6. Testing Circular Dependency Detection:');
  const detectedCycles = await neo4jService.detectCycles('test/sample-repo');
  assert(detectedCycles.length >= 1, 'Detects circular dependency cycle in graph');
  assert(detectedCycles[0]?.files.length === 2, 'Identifies files participating in cycle');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
