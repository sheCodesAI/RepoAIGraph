import { parseGitHubUrl, githubService } from './github.js';
import { codeParser } from './parser.js';
import { aiService } from './ai.js';
import { buildArchitectureLayers, categorizeFileLayer } from './architecture.js';
import { neo4jService } from './neo4j.js';
import {
  GraphNode,
  GraphEdge,
  ParsedFileResult,
  RepositoryMetadata,
  DependencyCycle,
} from './types.js';

export interface AnalysisResult {
  repository: RepositoryMetadata;
  stats: {
    totalFiles: number;
    parsedFiles: number;
    functionsCount: number;
    classesCount: number;
    apisCount: number;
    dependenciesCount: number;
    cyclesCount: number;
    technologies: string[];
  };
  cycles: DependencyCycle[];
  nodesCount: number;
  edgesCount: number;
}

export class RepositoryAnalyzer {
  public async analyze(
    repoUrl: string,
    onProgress?: (step: string, percent: number, message: string) => void
  ): Promise<AnalysisResult> {
    const notify = (step: string, percent: number, msg: string) => {
      if (onProgress) onProgress(step, percent, msg);
      console.log(`[Analyzer] ${percent}% - ${msg}`);
    };

    notify('init', 5, 'Validating GitHub repository URL...');
    const { owner, repo, repoId } = parseGitHubUrl(repoUrl);

    notify('fetching_repo', 15, `Fetching metadata for ${owner}/${repo}...`);
    let metadata: RepositoryMetadata;
    let readmeContent = '';
    let treeFiles: Array<{ path: string; size: number; language: string }> = [];

    try {
      metadata = await githubService.fetchRepository(owner, repo);
    } catch (err: any) {
      // If GitHub rate-limited and no token, or repo not found, provide clear error
      throw new Error(`GitHub Ingestion Failed: ${err.message}`);
    }

    notify('tree_discovered', 30, `Fetching tree and README for ${owner}/${repo}...`);
    readmeContent = await githubService.fetchReadme(owner, repo);
    const rawTree = await githubService.fetchTree(owner, repo, metadata.defaultBranch);

    treeFiles = rawTree.map(f => ({
      path: f.path,
      size: f.size || 0,
      language: f.language || 'Other',
    }));

    if (treeFiles.length === 0) {
      throw new Error(`Repository ${owner}/${repo} contains no supported source files or is empty.`);
    }

    // Select files to analyze (prioritize source files: .py, .ts, .tsx, .js, .jsx)
    const prioritizedFiles = treeFiles.filter(f =>
      ['Python', 'TypeScript', 'JavaScript'].includes(f.language)
    );
    const filesToAnalyze = prioritizedFiles.slice(0, 45); // fetch contents for top 45 source files

    notify('parsing_code', 50, `Parsing AST and code patterns in ${filesToAnalyze.length} source files...`);

    const parsedResults: ParsedFileResult[] = [];
    const allRepoFilePaths = treeFiles.map(f => f.path);

    for (const file of filesToAnalyze) {
      try {
        const content = await githubService.fetchFileContent(
          owner,
          repo,
          file.path,
          metadata.defaultBranch
        );
        const parsed = codeParser.parseFile(file.path, content);
        parsedResults.push(parsed);
      } catch (err) {
        console.warn(`[Analyzer] Could not fetch/parse ${file.path}:`, err);
      }
    }

    notify('extracting_readme', 70, 'Analyzing README semantics with AI...');
    const readmeConcepts = await aiService.analyzeReadme(readmeContent, allRepoFilePaths);

    notify('building_graph', 85, 'Constructing Neo4j Knowledge Graph nodes & relationships...');

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const allTechnologies = new Set<string>();

    // 1. Repository Node
    const repoNodeId = repoId;
    nodes.push({
      id: repoNodeId,
      name: metadata.name,
      type: 'Repository',
      repoId,
      metadata: {
        owner: metadata.owner,
        stars: metadata.stars,
        forks: metadata.forks,
        defaultBranch: metadata.defaultBranch,
        language: metadata.language,
        url: metadata.url,
        description: metadata.description,
      },
    });

    // 2. Folder Nodes
    const folders = new Set<string>();
    for (const file of treeFiles) {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
          const folderPath = parts.slice(0, i).join('/');
          folders.add(folderPath);
        }
      }
    }

    for (const folder of folders) {
      const folderId = `${repoId}/${folder}`;
      nodes.push({
        id: folderId,
        name: folder.split('/').pop() || folder,
        type: 'Folder',
        repoId,
        metadata: { path: folder },
      });

      // Folder relationships
      const parentParts = folder.split('/');
      if (parentParts.length === 1) {
        edges.push({
          id: `${repoId}#HAS_FOLDER#${folder}`,
          source: repoNodeId,
          target: folderId,
          type: 'HAS_FOLDER',
        });
      } else {
        const parentFolder = parentParts.slice(0, -1).join('/');
        edges.push({
          id: `${repoId}#CONTAINS#${parentFolder}->${folder}`,
          source: `${repoId}/${parentFolder}`,
          target: folderId,
          type: 'CONTAINS',
        });
      }
    }

    // 3. File Nodes
    const parsedFileMap = new Map<string, ParsedFileResult>();
    for (const p of parsedResults) {
      parsedFileMap.set(p.path, p);
    }

    for (const file of treeFiles) {
      const fileId = `${repoId}/${file.path}`;
      const parsed = parsedFileMap.get(file.path);
      const layer = categorizeFileLayer(file.path);

      nodes.push({
        id: fileId,
        name: file.path.split('/').pop() || file.path,
        type: 'File',
        repoId,
        layer,
        metadata: {
          path: file.path,
          language: file.language,
          size: file.size,
          linesCount: parsed?.linesCount || 0,
          functionsCount: parsed?.functions.length || 0,
          classesCount: parsed?.classes.length || 0,
          apisCount: parsed?.apis.length || 0,
        },
      });

      // Folder CONTAINS File or Repo CONTAINS File
      const dir = file.path.split('/').slice(0, -1).join('/');
      if (dir) {
        edges.push({
          id: `${repoId}#CONTAINS#${dir}->${file.path}`,
          source: `${repoId}/${dir}`,
          target: fileId,
          type: 'CONTAINS',
        });
      } else {
        edges.push({
          id: `${repoId}#CONTAINS#root->${file.path}`,
          source: repoNodeId,
          target: fileId,
          type: 'CONTAINS',
        });
      }

      // If parsed, add Function, Class, and API nodes
      if (parsed) {
        // Collect Technologies
        for (const t of parsed.technologies) {
          allTechnologies.add(t);
        }

        // Functions
        for (const fn of parsed.functions) {
          const fnId = `${fileId}#${fn.name}`;
          nodes.push({
            id: fnId,
            name: fn.name,
            type: 'Function',
            repoId,
            layer,
            metadata: {
              filePath: file.path,
              startLine: fn.startLine,
              endLine: fn.endLine,
              parameters: fn.parameters,
              calls: fn.calls,
              isAsync: fn.isAsync,
            },
          });

          // File DEFINES Function
          edges.push({
            id: `${fileId}#DEFINES#${fn.name}`,
            source: fileId,
            target: fnId,
            type: 'DEFINES',
          });
        }

        // Classes
        for (const cls of parsed.classes) {
          const clsId = `${fileId}#class:${cls.name}`;
          nodes.push({
            id: clsId,
            name: cls.name,
            type: 'Class',
            repoId,
            layer,
            metadata: {
              filePath: file.path,
              startLine: cls.startLine,
              methods: cls.methods,
            },
          });

          // File DEFINES Class
          edges.push({
            id: `${fileId}#DEFINES#class:${cls.name}`,
            source: fileId,
            target: clsId,
            type: 'DEFINES',
          });
        }

        // APIs
        for (const api of parsed.apis) {
          const apiId = `${repoId}#${api.id}`;
          nodes.push({
            id: apiId,
            name: `${api.method} ${api.path}`,
            type: 'API',
            repoId,
            layer: 'API',
            metadata: {
              method: api.method,
              path: api.path,
              framework: api.framework,
              handlerName: api.handlerName,
              filePath: file.path,
              dbOperations: api.dbOperations || [],
            },
          });

          // API IMPLEMENTED_BY Function or File
          const targetFunctionId = `${fileId}#${api.handlerName}`;
          const handlerExists = parsed.functions.some(f => f.name === api.handlerName);
          edges.push({
            id: `${apiId}#IMPLEMENTED_BY#${api.handlerName}`,
            source: apiId,
            target: handlerExists ? targetFunctionId : fileId,
            type: 'IMPLEMENTED_BY',
            label: 'IMPLEMENTED_BY',
          });
        }
      }
    }

    // 4. Resolve File IMPORTS File dependencies
    for (const parsed of parsedResults) {
      const sourceFileId = `${repoId}/${parsed.path}`;
      for (const imp of parsed.imports) {
        const resolvedPath = codeParser.resolveImport(parsed.path, imp.source, allRepoFilePaths);
        if (resolvedPath && resolvedPath !== parsed.path) {
          const targetFileId = `${repoId}/${resolvedPath}`;
          edges.push({
            id: `${sourceFileId}#IMPORTS#${targetFileId}`,
            source: sourceFileId,
            target: targetFileId,
            type: 'IMPORTS',
            label: 'IMPORTS',
            metadata: {
              importedItems: imp.importedItems,
              raw: imp.raw,
            },
          });
        }
      }
    }

    // 5. Connect Function CALLS Function
    const allFunctionNames = new Map<string, string>(); // name -> fnId
    for (const n of nodes) {
      if (n.type === 'Function') {
        allFunctionNames.set(n.name, n.id);
      }
    }

    for (const parsed of parsedResults) {
      for (const fn of parsed.functions) {
        const callerId = `${repoId}/${parsed.path}#${fn.name}`;
        for (const called of fn.calls) {
          const targetFnId = allFunctionNames.get(called);
          if (targetFnId && targetFnId !== callerId) {
            edges.push({
              id: `${callerId}#CALLS#${targetFnId}`,
              source: callerId,
              target: targetFnId,
              type: 'CALLS',
              label: 'CALLS',
            });
          }
        }
      }
    }

    // 6. Technology Nodes & File USES Technology
    for (const techName of allTechnologies) {
      const techId = `${repoId}#tech:${techName}`;
      nodes.push({
        id: techId,
        name: techName,
        type: 'Technology',
        repoId,
        metadata: { category: 'stack' },
      });

      // Link files using this technology
      for (const parsed of parsedResults) {
        if (parsed.technologies.includes(techName)) {
          edges.push({
            id: `${repoId}/${parsed.path}#USES#${techId}`,
            source: `${repoId}/${parsed.path}`,
            target: techId,
            type: 'USES',
            label: 'USES',
          });
        }
      }
    }

    // 7. README Sections & Feature Nodes (Feature 2)
    const sectionsSeen = new Set<string>();
    for (const concept of readmeConcepts) {
      // ReadmeSection node
      const sectionId = `${repoId}#readme:${concept.sectionTitle}`;
      if (!sectionsSeen.has(concept.sectionTitle)) {
        sectionsSeen.add(concept.sectionTitle);
        nodes.push({
          id: sectionId,
          name: concept.sectionTitle,
          type: 'ReadmeSection',
          repoId,
          metadata: { title: concept.sectionTitle },
        });

        // Repository DOCUMENTS ReadmeSection
        edges.push({
          id: `${repoNodeId}#DOCUMENTS#${sectionId}`,
          source: repoNodeId,
          target: sectionId,
          type: 'DOCUMENTS',
        });
      }

      // Feature Node
      const featureId = `${repoId}#feature:${concept.name.replace(/\s+/g, '_')}`;
      nodes.push({
        id: featureId,
        name: concept.name,
        type: 'Feature',
        repoId,
        metadata: {
          description: concept.description,
          category: concept.category,
        },
      });

      // ReadmeSection DOCUMENTS Feature
      edges.push({
        id: `${sectionId}#DOCUMENTS#${featureId}`,
        source: sectionId,
        target: featureId,
        type: 'DOCUMENTS',
        label: 'DOCUMENTS',
      });

      // Feature IMPLEMENTED_BY File
      for (const relFile of concept.relatedFilePaths) {
        const fileNodeId = `${repoId}/${relFile}`;
        edges.push({
          id: `${featureId}#IMPLEMENTED_BY#${fileNodeId}`,
          source: featureId,
          target: fileNodeId,
          type: 'IMPLEMENTED_BY',
          label: 'IMPLEMENTED_BY',
        });
      }
    }

    // 8. Architecture Layers (Feature 5)
    const fileComponents = parsedResults.map(p => ({
      path: p.path,
      functions: p.functions.map(f => f.name),
    }));
    const { layerNodes, layerEdges } = buildArchitectureLayers(repoId, fileComponents);
    nodes.push(...layerNodes);
    edges.push(...layerEdges);

    // File BELONGS_TO_LAYER
    for (const file of treeFiles) {
      const layer = categorizeFileLayer(file.path);
      const layerNodeId = `${repoId}#layer:${layer}`;
      edges.push({
        id: `${repoId}/${file.path}#BELONGS_TO_LAYER#${layer}`,
        source: `${repoId}/${file.path}`,
        target: layerNodeId,
        type: 'BELONGS_TO_LAYER',
        label: 'BELONGS_TO_LAYER',
      });
    }

    notify('building_graph', 95, 'Persisting graph entities and verifying cycles...');

    // Save to Neo4j & Memory
    await neo4jService.saveGraph(repoId, nodes, edges);

    // Detect cycles
    const cycles = await neo4jService.detectCycles(repoId);

    const totalFunctions = nodes.filter(n => n.type === 'Function').length;
    const totalClasses = nodes.filter(n => n.type === 'Class').length;
    const totalAPIs = nodes.filter(n => n.type === 'API').length;
    const totalDependencies = edges.filter(e => e.type === 'IMPORTS').length;

    notify('complete', 100, `Graph constructed: ${nodes.length} nodes, ${edges.length} relationships.`);

    return {
      repository: metadata,
      stats: {
        totalFiles: treeFiles.length,
        parsedFiles: parsedResults.length,
        functionsCount: totalFunctions,
        classesCount: totalClasses,
        apisCount: totalAPIs,
        dependenciesCount: totalDependencies,
        cyclesCount: cycles.length,
        technologies: Array.from(allTechnologies),
      },
      cycles,
      nodesCount: nodes.length,
      edgesCount: edges.length,
    };
  }
}

export const repositoryAnalyzer = new RepositoryAnalyzer();
