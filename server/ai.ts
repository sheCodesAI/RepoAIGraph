import { GoogleGenAI } from '@google/genai';
import { ReadmeFeatureConcept } from './types.js';

class AIService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  /**
   * Analyze README text and extract structured features, technologies, and architecture concepts
   */
  public async analyzeReadme(
    readmeContent: string,
    discoveredFiles: string[]
  ): Promise<ReadmeFeatureConcept[]> {
    if (!readmeContent || readmeContent.trim().length === 0) {
      return this.fallbackReadmeExtraction(readmeContent, discoveredFiles);
    }

    const prompt = `You are a software architect analyzing a repository's README.md file.
Analyze the following README content and identify:
1. Core features implemented in the application
2. Technologies / libraries used
3. High-level architectural concepts

For each feature/concept, associate it with the most likely file paths from this list of discovered repository files:
${JSON.stringify(discoveredFiles.slice(0, 40))}

Return ONLY a JSON array with this exact structure:
[
  {
    "id": "feature-1",
    "name": "Feature or Tech Name",
    "description": "Brief description of what it does",
    "category": "feature" | "technology" | "architecture",
    "sectionTitle": "Section in README where this was mentioned",
    "relatedFilePaths": ["path/to/relevant/file.py"]
  }
]

README CONTENT:
${readmeContent.slice(0, 5000)}`;

    try {
      if (this.genAI) {
        const response = await this.genAI.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || '';
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item, idx) => ({
              id: item.id || `concept-${idx + 1}`,
              name: item.name || 'Unnamed Concept',
              description: item.description || '',
              category: item.category || 'feature',
              sectionTitle: item.sectionTitle || 'Overview',
              relatedFilePaths: Array.isArray(item.relatedFilePaths)
                ? item.relatedFilePaths.filter((p: string) => discoveredFiles.includes(p))
                : [],
            }));
          }
        }
      } else if (process.env.OPENAI_API_KEY) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices[0]?.message?.content || '{}');
          const list = Array.isArray(parsed) ? parsed : (parsed.features || parsed.concepts || []);
          if (list.length > 0) {
            return list;
          }
        }
      }
    } catch (err) {
      console.warn('[AI] Failed to extract README concepts via LLM, falling back to heuristic parser:', err);
    }

    return this.fallbackReadmeExtraction(readmeContent, discoveredFiles);
  }

  /**
   * Explain a node or graph pattern strictly grounded in retrieved Neo4j facts
   */
  public async explainGraphNode(
    node: any,
    dependencies: any[],
    dependents: any[],
    relatedEntities: any[],
    cycles: any[] = []
  ): Promise<string> {
    const isCycleInvolved = cycles.some(c => c.files.includes(node.id));

    const factsPrompt = `You are RepoGraph AI's graph explainer.
Strictly adhere to this rule: DO NOT invent repository relationships or files.
All explanations MUST be grounded strictly in the provided Neo4j graph facts below.
If sufficient graph evidence is unavailable, state that clearly instead of speculating.

TARGET NODE:
- ID: ${node.id}
- Name: ${node.name}
- Type: ${node.type}
- Layer: ${node.layer || 'Unassigned'}
- Metadata: ${JSON.stringify(node.metadata || {})}

DIRECT DEPENDENCIES (Files this node imports):
${dependencies.map(d => `- ${d.name} (${d.id})`).join('\n') || 'None detected'}

DIRECT DEPENDENTS (Files importing this node):
${dependents.map(d => `- ${d.name} (${d.id})`).join('\n') || 'None detected'}

CONNECTED ENTITIES (APIs, Functions, Classes, Technologies):
${relatedEntities.map(r => `- [${r.relationship}] ${r.direction === 'out' ? '→' : '←'} ${r.node.name} (${r.node.type})`).join('\n') || 'None'}

CIRCULAR DEPENDENCY STATUS:
${isCycleInvolved ? 'WARNING: This node is part of a circular dependency cycle detected by graph traversal.' : 'Clean: No circular dependency detected for this node.'}

TASK:
Provide a concise, developer-focused explanation:
1. Architectural role and responsibility of this entity.
2. How data and calls flow into and out of it based on the facts.
3. If dependencies or cycles exist, highlight architectural implications.
Keep it strictly under 180 words, crisp and professional.`;

    try {
      if (this.genAI) {
        const response = await this.genAI.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: factsPrompt,
        });
        const text = response.text?.trim();
        if (text) return text;
      } else if (process.env.OPENAI_API_KEY) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: factsPrompt }],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.choices[0]?.message?.content?.trim();
        }
      }
    } catch (err) {
      console.warn('[AI] Explain failed, generating deterministic explanation:', err);
    }

    // Deterministic factual fallback based on graph
    let desc = `**${node.name}** is a ${node.type} situated within the **${node.layer || 'Application'}** layer. `;
    if (dependencies.length > 0) {
      desc += `It directly depends on ${dependencies.length} module(s): ${dependencies.map(d => d.name).join(', ')}. `;
    } else {
      desc += `It has zero outgoing file dependencies, acting as a foundational unit. `;
    }
    if (dependents.length > 0) {
      desc += `It is imported by ${dependents.length} downstream component(s): ${dependents.map(d => d.name).join(', ')}. `;
    }
    if (isCycleInvolved) {
      desc += `⚠️ Notice: This entity is part of an active circular dependency cycle.`;
    }
    return desc;
  }

  /**
   * Deterministic heuristic fallback when LLM is unavailable or offline
   */
  private fallbackReadmeExtraction(readme: string, discoveredFiles: string[]): ReadmeFeatureConcept[] {
    const concepts: ReadmeFeatureConcept[] = [];
    const lines = readme.split('\n');

    let currentSection = 'Overview';
    for (const line of lines) {
      const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headerMatch) {
        currentSection = headerMatch[1].trim();
        const sectionLower = currentSection.toLowerCase();

        // Check if section name matches common features
        let category: 'feature' | 'technology' | 'architecture' = 'feature';
        if (/tech|stack|built with|dependencies/i.test(sectionLower)) {
          category = 'technology';
        } else if (/architecture|design|structure|overview/i.test(sectionLower)) {
          category = 'architecture';
        }

        // Match possible files
        const related = discoveredFiles.filter(f => {
          const baseName = f.split('/').pop()?.split('.')[0].toLowerCase() || '';
          return baseName.length > 2 && sectionLower.includes(baseName);
        });

        concepts.push({
          id: `concept-${concepts.length + 1}`,
          name: currentSection,
          description: `Extracted from README section "${currentSection}"`,
          category,
          sectionTitle: currentSection,
          relatedFilePaths: related,
        });
      }
    }

    if (concepts.length === 0) {
      // Create sensible defaults
      concepts.push({
        id: 'concept-1',
        name: 'Core Application Architecture',
        description: 'Primary codebase execution and routing foundation',
        category: 'architecture',
        sectionTitle: 'Architecture',
        relatedFilePaths: discoveredFiles.slice(0, 3),
      });
    }

    return concepts.slice(0, 10);
  }
}

export const aiService = new AIService();
