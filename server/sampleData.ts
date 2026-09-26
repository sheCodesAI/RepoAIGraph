import { GraphNode, GraphEdge, RepositoryMetadata, DependencyCycle } from './types.js';
import { neo4jService } from './neo4j.js';

export const SAMPLE_REPOSITORIES: RepositoryMetadata[] = [
  {
    id: 'gothinkster/golang-gin-realworld-example-app',
    owner: 'gothinkster',
    name: 'golang-gin-realworld-example-app',
    description: 'Exemplary real world backend API built with Golang and Gin framework',
    defaultBranch: 'master',
    stars: 3200,
    forks: 890,
    language: 'Go',
    url: 'https://github.com/gothinkster/golang-gin-realworld-example-app',
    analyzedAt: new Date().toISOString(),
  },
  {
    id: 'tiangolo/fastapi-realworld-example-app',
    owner: 'tiangolo',
    name: 'fastapi-realworld-example-app',
    description: 'Backend codebase containing real world examples (CRUD, auth, advanced patterns) adhering to the RealWorld spec and API.',
    defaultBranch: 'master',
    stars: 14200,
    forks: 2900,
    language: 'Python',
    url: 'https://github.com/tiangolo/fastapi-realworld-example-app',
    analyzedAt: new Date().toISOString(),
  },
  {
    id: 'santiq/bulletproof-nodejs',
    owner: 'santiq',
    name: 'bulletproof-nodejs',
    description: 'Implementation of a production-ready 3-tier architecture Node.js Express REST API server using TypeScript.',
    defaultBranch: 'master',
    stars: 12400,
    forks: 1800,
    language: 'TypeScript',
    url: 'https://github.com/santiq/bulletproof-nodejs',
    analyzedAt: new Date().toISOString(),
  },
];

export async function seedSampleRepository(repoId: string = 'tiangolo/fastapi-realworld-example-app'): Promise<{
  repository: RepositoryMetadata;
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: DependencyCycle[];
}> {
  const meta: RepositoryMetadata = {
    id: repoId,
    owner: 'tiangolo',
    name: 'fastapi-realworld-example-app',
    description: 'Exemplary real world backend API built with FastAPI, SQLAlchemy, PostgreSQL, and Pydantic.',
    defaultBranch: 'master',
    stars: 14200,
    forks: 2900,
    language: 'Python',
    url: 'https://github.com/tiangolo/fastapi-realworld-example-app',
    analyzedAt: new Date().toISOString(),
  };

  const nodes: GraphNode[] = [
    // Repository
    {
      id: repoId,
      name: 'fastapi-realworld-example-app',
      type: 'Repository',
      repoId,
      metadata: { stars: 14200, language: 'Python', defaultBranch: 'master' },
    },

    // Architecture Layers
    {
      id: `${repoId}#layer:Frontend`,
      name: 'Frontend',
      type: 'ArchitectureLayer',
      repoId,
      layer: 'Frontend',
      metadata: { description: 'Client UI and Single-Page Application presentation layer', filesCount: 3 },
    },
    {
      id: `${repoId}#layer:API`,
      name: 'API',
      type: 'ArchitectureLayer',
      repoId,
      layer: 'API',
      metadata: { description: 'FastAPI routing, request validation, and endpoint handlers', filesCount: 6 },
    },
    {
      id: `${repoId}#layer:Backend/Services`,
      name: 'Backend/Services',
      type: 'ArchitectureLayer',
      repoId,
      layer: 'Backend/Services',
      metadata: { description: 'Domain business logic, authentication service, and cryptographic hashing', filesCount: 8 },
    },
    {
      id: `${repoId}#layer:Database`,
      name: 'Database',
      type: 'ArchitectureLayer',
      repoId,
      layer: 'Database',
      metadata: { description: 'SQLAlchemy models, PostgreSQL session manager, and data repositories', filesCount: 5 },
    },
    {
      id: `${repoId}#layer:External Services`,
      name: 'External Services',
      type: 'ArchitectureLayer',
      repoId,
      layer: 'External Services',
      metadata: { description: 'JWT token signing, SMTP notifications, and external telemetry', filesCount: 2 },
    },

    // Files
    {
      id: `${repoId}/app/main.py`,
      name: 'main.py',
      type: 'File',
      repoId,
      layer: 'API',
      metadata: { path: 'app/main.py', language: 'Python', linesCount: 92 },
    },
    {
      id: `${repoId}/app/api/api_v1/endpoints/authentication.py`,
      name: 'authentication.py',
      type: 'File',
      repoId,
      layer: 'API',
      metadata: { path: 'app/api/api_v1/endpoints/authentication.py', language: 'Python', linesCount: 145 },
    },
    {
      id: `${repoId}/app/api/api_v1/endpoints/articles.py`,
      name: 'articles.py',
      type: 'File',
      repoId,
      layer: 'API',
      metadata: { path: 'app/api/api_v1/endpoints/articles.py', language: 'Python', linesCount: 180 },
    },
    {
      id: `${repoId}/app/services/auth.py`,
      name: 'auth.py',
      type: 'File',
      repoId,
      layer: 'Backend/Services',
      metadata: { path: 'app/services/auth.py', language: 'Python', linesCount: 120 },
    },
    {
      id: `${repoId}/app/services/article_service.py`,
      name: 'article_service.py',
      type: 'File',
      repoId,
      layer: 'Backend/Services',
      metadata: { path: 'app/services/article_service.py', language: 'Python', linesCount: 165 },
    },
    {
      id: `${repoId}/app/db/repositories/users.py`,
      name: 'users.py',
      type: 'File',
      repoId,
      layer: 'Database',
      metadata: { path: 'app/db/repositories/users.py', language: 'Python', linesCount: 210 },
    },
    {
      id: `${repoId}/app/db/repositories/articles.py`,
      name: 'articles.py',
      type: 'File',
      repoId,
      layer: 'Database',
      metadata: { path: 'app/db/repositories/articles.py', language: 'Python', linesCount: 240 },
    },
    {
      id: `${repoId}/app/models/domain/users.py`,
      name: 'users.py',
      type: 'File',
      repoId,
      layer: 'Database',
      metadata: { path: 'app/models/domain/users.py', language: 'Python', linesCount: 88 },
    },
    {
      id: `${repoId}/app/models/schemas/users.py`,
      name: 'schemas/users.py',
      type: 'File',
      repoId,
      layer: 'Database',
      metadata: { path: 'app/models/schemas/users.py', language: 'Python', linesCount: 95 },
    },
    {
      id: `${repoId}/app/core/jwt.py`,
      name: 'jwt.py',
      type: 'File',
      repoId,
      layer: 'External Services',
      metadata: { path: 'app/core/jwt.py', language: 'Python', linesCount: 65 },
    },

    // APIs
    {
      id: `${repoId}#api:POST:/api/users/login`,
      name: 'POST /api/users/login',
      type: 'API',
      repoId,
      layer: 'API',
      metadata: {
        method: 'POST',
        path: '/api/users/login',
        framework: 'FastAPI',
        handlerName: 'login_controller',
        filePath: 'app/api/api_v1/endpoints/authentication.py',
        dbOperations: ['PostgreSQL / Users Repository Query'],
      },
    },
    {
      id: `${repoId}#api:POST:/api/users`,
      name: 'POST /api/users',
      type: 'API',
      repoId,
      layer: 'API',
      metadata: {
        method: 'POST',
        path: '/api/users',
        framework: 'FastAPI',
        handlerName: 'register_user',
        filePath: 'app/api/api_v1/endpoints/authentication.py',
      },
    },
    {
      id: `${repoId}#api:GET:/api/articles`,
      name: 'GET /api/articles',
      type: 'API',
      repoId,
      layer: 'API',
      metadata: {
        method: 'GET',
        path: '/api/articles',
        framework: 'FastAPI',
        handlerName: 'list_articles',
        filePath: 'app/api/api_v1/endpoints/articles.py',
      },
    },

    // Functions
    {
      id: `${repoId}/app/api/api_v1/endpoints/authentication.py#login_controller`,
      name: 'login_controller',
      type: 'Function',
      repoId,
      layer: 'API',
      metadata: { parameters: ['user_login', 'users_repo'], calls: ['authenticate_user'] },
    },
    {
      id: `${repoId}/app/services/auth.py#authenticate_user`,
      name: 'authenticate_user',
      type: 'Function',
      repoId,
      layer: 'Backend/Services',
      metadata: { parameters: ['email', 'password', 'users_repo'], calls: ['get_user_by_email', 'verify_password', 'create_access_token'] },
    },
    {
      id: `${repoId}/app/services/auth.py#verify_password`,
      name: 'verify_password',
      type: 'Function',
      repoId,
      layer: 'Backend/Services',
      metadata: { parameters: ['plain_password', 'hashed_password'] },
    },
    {
      id: `${repoId}/app/db/repositories/users.py#get_user_by_email`,
      name: 'get_user_by_email',
      type: 'Function',
      repoId,
      layer: 'Database',
      metadata: { parameters: ['email'], calls: ['execute_sql'] },
    },
    {
      id: `${repoId}/app/core/jwt.py#create_access_token`,
      name: 'create_access_token',
      type: 'Function',
      repoId,
      layer: 'External Services',
      metadata: { parameters: ['user_id', 'expires_delta'] },
    },

    // Classes
    {
      id: `${repoId}/app/db/repositories/users.py#class:UsersRepository`,
      name: 'UsersRepository',
      type: 'Class',
      repoId,
      layer: 'Database',
      metadata: { methods: ['get_user_by_email', 'create_user', 'update_user'] },
    },

    // Technologies
    { id: `${repoId}#tech:FastAPI`, name: 'FastAPI', type: 'Technology', repoId, metadata: { category: 'framework' } },
    { id: `${repoId}#tech:SQLAlchemy`, name: 'SQLAlchemy', type: 'Technology', repoId, metadata: { category: 'orm' } },
    { id: `${repoId}#tech:PostgreSQL`, name: 'PostgreSQL', type: 'Technology', repoId, metadata: { category: 'database' } },
    { id: `${repoId}#tech:JWT`, name: 'JWT Auth', type: 'Technology', repoId, metadata: { category: 'security' } },
    { id: `${repoId}#tech:Pydantic`, name: 'Pydantic', type: 'Technology', repoId, metadata: { category: 'validation' } },

    // README Sections & Features (Feature 2)
    {
      id: `${repoId}#readme:Authentication_Spec`,
      name: 'Authentication & Security',
      type: 'ReadmeSection',
      repoId,
      metadata: { title: 'Authentication & Security' },
    },
    {
      id: `${repoId}#feature:JWT_Authentication`,
      name: 'JWT User Authentication',
      type: 'Feature',
      repoId,
      metadata: { description: 'Stateless JSON Web Token auth using Argon2 password hashing and token refresh.' },
    },
    {
      id: `${repoId}#feature:Articles_Feed`,
      name: 'Global & Personal Article Feed',
      type: 'Feature',
      repoId,
      metadata: { description: 'Paginated feeds with tag filtering, author favorites, and follower graph.' },
    },
  ];

  const edges: GraphEdge[] = [
    // Architecture Layer Flow
    { id: 'l1', source: `${repoId}#layer:Frontend`, target: `${repoId}#layer:API`, type: 'CONNECTS_TO', label: 'HTTP / REST' },
    { id: 'l2', source: `${repoId}#layer:API`, target: `${repoId}#layer:Backend/Services`, type: 'CONNECTS_TO', label: 'Dispatches Request' },
    { id: 'l3', source: `${repoId}#layer:Backend/Services`, target: `${repoId}#layer:Database`, type: 'CONNECTS_TO', label: 'Queries State' },
    { id: 'l4', source: `${repoId}#layer:Backend/Services`, target: `${repoId}#layer:External Services`, type: 'CONNECTS_TO', label: 'Signs Tokens' },

    // API to Handler Function (Feature 6: API -> Code Graph)
    {
      id: 'e-api-impl',
      source: `${repoId}#api:POST:/api/users/login`,
      target: `${repoId}/app/api/api_v1/endpoints/authentication.py#login_controller`,
      type: 'IMPLEMENTED_BY',
      label: 'IMPLEMENTED_BY',
    },
    // Function CALLS Function (Call graph traversal)
    {
      id: 'e-call-1',
      source: `${repoId}/app/api/api_v1/endpoints/authentication.py#login_controller`,
      target: `${repoId}/app/services/auth.py#authenticate_user`,
      type: 'CALLS',
      label: 'CALLS',
    },
    {
      id: 'e-call-2',
      source: `${repoId}/app/services/auth.py#authenticate_user`,
      target: `${repoId}/app/db/repositories/users.py#get_user_by_email`,
      type: 'CALLS',
      label: 'CALLS',
    },
    {
      id: 'e-call-3',
      source: `${repoId}/app/services/auth.py#authenticate_user`,
      target: `${repoId}/app/core/jwt.py#create_access_token`,
      type: 'CALLS',
      label: 'CALLS',
    },

    // File DEFINES Function & Class
    {
      id: 'e-def-1',
      source: `${repoId}/app/api/api_v1/endpoints/authentication.py`,
      target: `${repoId}/app/api/api_v1/endpoints/authentication.py#login_controller`,
      type: 'DEFINES',
    },
    {
      id: 'e-def-2',
      source: `${repoId}/app/services/auth.py`,
      target: `${repoId}/app/services/auth.py#authenticate_user`,
      type: 'DEFINES',
    },
    {
      id: 'e-def-3',
      source: `${repoId}/app/db/repositories/users.py`,
      target: `${repoId}/app/db/repositories/users.py#get_user_by_email`,
      type: 'DEFINES',
    },
    {
      id: 'e-def-4',
      source: `${repoId}/app/db/repositories/users.py`,
      target: `${repoId}/app/db/repositories/users.py#class:UsersRepository`,
      type: 'DEFINES',
    },

    // File IMPORTS File (Feature 3: Dependency Explorer)
    {
      id: 'imp-1',
      source: `${repoId}/app/main.py`,
      target: `${repoId}/app/api/api_v1/endpoints/authentication.py`,
      type: 'IMPORTS',
      label: 'IMPORTS',
    },
    {
      id: 'imp-2',
      source: `${repoId}/app/api/api_v1/endpoints/authentication.py`,
      target: `${repoId}/app/services/auth.py`,
      type: 'IMPORTS',
      label: 'IMPORTS',
    },
    {
      id: 'imp-3',
      source: `${repoId}/app/services/auth.py`,
      target: `${repoId}/app/db/repositories/users.py`,
      type: 'IMPORTS',
      label: 'IMPORTS',
    },
    {
      id: 'imp-4',
      source: `${repoId}/app/services/auth.py`,
      target: `${repoId}/app/core/jwt.py`,
      type: 'IMPORTS',
      label: 'IMPORTS',
    },

    // Circular Dependency Cycle between models/domain/users.py and models/schemas/users.py (Feature 4)
    {
      id: 'cycle-e1',
      source: `${repoId}/app/models/domain/users.py`,
      target: `${repoId}/app/models/schemas/users.py`,
      type: 'IMPORTS',
      label: 'IMPORTS',
    },
    {
      id: 'cycle-e2',
      source: `${repoId}/app/models/schemas/users.py`,
      target: `${repoId}/app/models/domain/users.py`,
      type: 'IMPORTS',
      label: 'IMPORTS',
    },

    // File USES Technology
    { id: 'tech-1', source: `${repoId}/app/main.py`, target: `${repoId}#tech:FastAPI`, type: 'USES', label: 'USES' },
    { id: 'tech-2', source: `${repoId}/app/db/repositories/users.py`, target: `${repoId}#tech:SQLAlchemy`, type: 'USES', label: 'USES' },
    { id: 'tech-3', source: `${repoId}/app/core/jwt.py`, target: `${repoId}#tech:JWT`, type: 'USES', label: 'USES' },

    // README ↔ Code Connections (Feature 2)
    {
      id: 'rm-doc-1',
      source: `${repoId}#readme:Authentication_Spec`,
      target: `${repoId}#feature:JWT_Authentication`,
      type: 'DOCUMENTS',
      label: 'DOCUMENTS',
    },
    {
      id: 'feat-impl-1',
      source: `${repoId}#feature:JWT_Authentication`,
      target: `${repoId}/app/services/auth.py`,
      type: 'IMPLEMENTED_BY',
      label: 'IMPLEMENTED_BY',
    },
  ];

  const cycles: DependencyCycle[] = [
    {
      id: 'cycle-1',
      length: 2,
      files: [
        `${repoId}/app/models/domain/users.py`,
        `${repoId}/app/models/schemas/users.py`,
      ],
      cyclePath: [
        `${repoId}/app/models/domain/users.py`,
        `${repoId}/app/models/schemas/users.py`,
        `${repoId}/app/models/domain/users.py`,
      ],
    },
  ];

  // Save into Neo4j
  await neo4jService.saveGraph(repoId, nodes, edges);

  return { repository: meta, nodes, edges, cycles };
}
