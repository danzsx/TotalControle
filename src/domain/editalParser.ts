import { DEFAULT_EXAM_ID } from './constants';
import { defaultChecklist } from './prebuiltTrails';
import { normalizeText, uid } from './text';
import type {
  ContentNode,
  Difficulty,
  Discipline,
  DisciplineTheme,
  TrailLevel,
  TrailModule,
} from './types';

export interface ParsedContentDraft {
  id: string;
  title: string;
  description: string;
  editalRef?: string;
  difficulty: 1 | 2 | 3 | 4;
}

export interface ParsedModuleDraft {
  id: string;
  title: string;
  subtitle?: string;
  contents: ParsedContentDraft[];
}

export interface ParsedLevelDraft {
  id: string;
  title: string;
  subtitle: string;
  landscapeName: string;
  modules: ParsedModuleDraft[];
}

export interface ParsedDisciplineDraft {
  id: string;
  name: string;
  description: string;
  category: string;
  theme: DisciplineTheme;
  icon: string;
  weight: 1 | 2 | 3 | 4 | 5;
  difficulty: Difficulty;
  selected: boolean;
  levels: ParsedLevelDraft[];
}

export interface ParsedEditalResult {
  disciplines: ParsedDisciplineDraft[];
  warnings: string[];
  totalContents: number;
}

const THEME_ROTATION: DisciplineTheme[] = [
  'sky',
  'lavender',
  'deep',
  'sage',
  'gold',
  'rose',
];

const LANDSCAPE_NAMES = [
  'Vale dos Fundamentos',
  'Planalto da Consolidação',
  'Cúpula do Domínio',
  'Horizonte de Aprofundamento',
];

const SECTION_GROUP_HEADERS = [
  /^conhecimentos\s+b[aá]sicos$/i,
  /^conhecimentos\s+gerais$/i,
  /^conhecimentos\s+espec[ií]ficos$/i,
  /^conhecimentos\s+complementares$/i,
  /^parte\s+(i|ii|iii|iv|1|2|3|4)\b/i,
  /^bloco\s+(i|ii|iii|iv|1|2|3|4)\b/i,
];

const NOISE_LINE_PATTERNS = [
  /^p[aá]gina\s+\d+(\s+de\s+\d+)?$/i,
  /^edital\s+n[º°o]?\s*[\d/.-]+/i,
  /^anexo\s+[ivx\d]+/i,
  /^conte[uú]do\s+program[aá]tico\s*:?$/i,
  /^\d+\s*$/,
];

const KNOWN_DISCIPLINE_KEYWORDS: Array<{
  pattern: RegExp;
  theme: DisciplineTheme;
  icon: string;
}> = [
  { pattern: /portugu[eê]s|reda[cç][aã]o|literatura|l[ií]ngua/i, theme: 'lavender', icon: 'BookOpen' },
  { pattern: /matem[aá]tica|racioc[ií]nio|l[oó]gic|estat[ií]stica|c[aá]lculo/i, theme: 'sky', icon: 'Compass' },
  { pattern: /direito|legisla[cç][aã]o|constitucional|administrativo|penal|civil|tribut[aá]rio|processual/i, theme: 'deep', icon: 'Scale' },
  { pattern: /inform[aá]tica|tecnologia|dados|software|redes|seguran[cç]a|computa[cç][aã]o|sistemas|ti\b/i, theme: 'sage', icon: 'Cpu' },
  { pattern: /administra[cç][aã]o|gest[aã]o|economia|contabilidade|finan[cç]as|afo|or[cç]amento/i, theme: 'gold', icon: 'Briefcase' },
  { pattern: /ingl[eê]s|espanhol|atualidades|[eé]tica|hist[oó]ria|geografia|biologia|qu[ií]mica|f[ií]sica/i, theme: 'rose', icon: 'Globe' },
];

function inferDisciplineVisuals(
  name: string,
  index: number,
): { theme: DisciplineTheme; icon: string } {
  for (const entry of KNOWN_DISCIPLINE_KEYWORDS) {
    if (entry.pattern.test(name)) {
      return { theme: entry.theme, icon: entry.icon };
    }
  }
  return {
    theme: THEME_ROTATION[index % THEME_ROTATION.length],
    icon: 'Compass',
  };
}

function cleanLine(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[•▪◦➢►●■□]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseLine(line: string): boolean {
  if (!line) return true;
  return NOISE_LINE_PATTERNS.some((re) => re.test(line));
}

function isGroupHeader(line: string): boolean {
  const stripped = line.replace(/[:\-–—]+$/, '').trim();
  return SECTION_GROUP_HEADERS.some((re) => re.test(stripped));
}

/**
 * Junta quebras de linha artificiais típicas de cópia de PDF
 * (quando uma linha termina sem pontuação final e a próxima não inicia novo item ou título).
 */
function preprocessLines(rawText: string): string[] {
  const rawLines = rawText
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter((l) => !isNoiseLine(l));

  const merged: string[] = [];
  const itemStartRe = /^(\d+(?:\.\d+)*[\.\)\-–—]?\s+|[ivxIVX]{1,5}[\.\)\-–—]\s+|[a-zA-Z][\)\.]\s+|-\s+)/;

  for (const line of rawLines) {
    if (merged.length === 0) {
      merged.push(line);
      continue;
    }

    const prev = merged[merged.length - 1];
    const prevEndsSentence = /[.;:!?]$/.test(prev);
    const currStartsItem = itemStartRe.test(line);
    const currIsHeader = isLikelyDisciplineHeader(line) || isGroupHeader(line);
    const prevIsHeader = isLikelyDisciplineHeader(prev) || isGroupHeader(prev);

    if (!prevEndsSentence && !prevIsHeader && !currStartsItem && !currIsHeader) {
      // Se a linha anterior terminou com hífen de hifenização, remove o hífen
      if (/[a-zà-ú]-$/.test(prev) && /^[a-zà-ú]/.test(line)) {
        merged[merged.length - 1] = prev.slice(0, -1) + line;
      } else {
        merged[merged.length - 1] = `${prev} ${line}`;
      }
    } else {
      merged.push(line);
    }
  }

  return merged;
}

/**
 * Heurística para detectar se uma linha isolada representa o cabeçalho de uma disciplina.
 */
function isLikelyDisciplineHeader(line: string): boolean {
  if (line.length < 3 || line.length > 95) return false;
  if (isGroupHeader(line)) return false;

  // Linha que já começa com sub-numeração tipo 1.1 não é disciplina
  if (/^\d+\.\d+/.test(line)) return false;

  const cleaned = line
    .replace(/^(\d+[\.\)\-–—]?\s+|[ivxIVX]{1,5}[\.\)\-–—]\s+)/, '')
    .replace(/[:\-–—]+$/, '')
    .trim();

  if (cleaned.length < 3) return false;

  // Caso 1: Tudo em MAIÚSCULAS (com pelo menos 2 letras e sem parecer frase longa)
  const letters = cleaned.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length >= 3 && cleaned === cleaned.toUpperCase() && !/[.;]$/.test(line)) {
    return true;
  }

  // Caso 2: Termina com ":" e não tem muitos termos internos (ex.: "Língua Portuguesa:")
  if (/:\s*$/.test(line) && cleaned.split(/\s+/).length <= 7 && !/^\d+\.\d+/.test(line)) {
    return true;
  }

  // Caso 3: Casa com nome conhecido de disciplina e é curto (sem ponto final)
  if (
    !/[.;]$/.test(line) &&
    cleaned.split(/\s+/).length <= 6 &&
    KNOWN_DISCIPLINE_KEYWORDS.some((k) => k.pattern.test(cleaned))
  ) {
    return true;
  }

  return false;
}

/**
 * Detecta padrão inline tipo:
 * "LÍNGUA PORTUGUESA: 1 Compreensão... 2 Tipologia..."
 * ou "DIREITO CONSTITUCIONAL - 1. Princípios... 2. Direitos..."
 */
function splitInlineDisciplineHeader(line: string): { header: string; rest: string } | null {
  const match = /^([A-ZÀ-Ú0-9][A-ZÀ-Úa-zà-ú0-9\s/(),\-]{2,70}?)(?:\s*:\s*|\s+[-–—]\s+)(?=(?:\d+[\.\)]?\s+[A-ZÀ-Úa-zà-ú]))/.exec(line);
  if (!match) return null;

  const candidate = match[1]
    .replace(/^(\d+[\.\)\-–—]?\s+|[ivxIVX]{1,5}[\.\)\-–—]\s+)/, '')
    .trim();
  const rest = line.slice(match[0].length).trim();

  if (!rest || candidate.length < 3) return null;

  const isUpper = candidate === candidate.toUpperCase() && /[A-ZÀ-Ú]{3,}/.test(candidate);
  const isKnown = KNOWN_DISCIPLINE_KEYWORDS.some((k) => k.pattern.test(candidate));
  if (isUpper || isKnown || candidate.split(/\s+/).length <= 5) {
    return { header: candidate, rest };
  }
  return null;
}

interface RawTopicItem {
  ref?: string;
  majorNum?: number;
  isSubItem: boolean;
  text: string;
}

/**
 * Extrai itens numerados ou com marcadores de um bloco de texto de disciplina.
 */
function extractItemsFromBlock(blockLines: string[]): RawTopicItem[] {
  const joined = blockLines.join('\n');

  // Primeiro tenta quebrar itens numerados inline (ex: "1 Texto... 2 Texto... 3 Texto...")
  // Preserva quebras de linha existentes e insere quebra antes de "N " ou "N. " ou "N.M "
  const expanded = joined
    .replace(/(?:^|\s)(\d{1,2}(?:\.\d{1,2})*[\.\)]?)\s+(?=[A-ZÀ-Ú(])/g, '\n$1 ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const items: RawTopicItem[] = [];

  for (const line of expanded) {
    // Sub-item: 1.1, 2.3.1, etc.
    const subMatch = /^(\d+\.\d+(?:\.\d+)*)[\.\)\-–—]?\s+(.+)$/.exec(line);
    if (subMatch) {
      items.push({
        ref: `Item ${subMatch[1]}`,
        majorNum: Number(subMatch[1].split('.')[0]),
        isSubItem: true,
        text: subMatch[2].trim(),
      });
      continue;
    }

    // Item principal numerado: 1. Texto, 1) Texto, 1 Texto
    const numMatch = /^(\d{1,2})[\.\)\-–—]?\s+(.+)$/.exec(line);
    if (numMatch) {
      items.push({
        ref: `Item ${numMatch[1]}`,
        majorNum: Number(numMatch[1]),
        isSubItem: false,
        text: numMatch[2].trim(),
      });
      continue;
    }

    // Marcador alfabético ou hífen: a) Texto, - Texto
    const bulletMatch = /^(?:[a-zA-Z][\)\.]|[-–—])\s+(.+)$/.exec(line);
    if (bulletMatch) {
      items.push({
        isSubItem: true,
        text: bulletMatch[1].trim(),
      });
      continue;
    }

    // Linha sem marcador: se já temos itens e a linha parece continuação, ou novo tópico se termina com ponto
    if (items.length > 0 && /^[a-zà-ú]/.test(line)) {
      items[items.length - 1].text = `${items[items.length - 1].text} ${line}`;
    } else {
      // Quebra por ponto e vírgula se houver múltiplos tópicos na mesma linha sem numeração
      const parts = line
        .split(/\s*;\s*/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);
      if (parts.length > 1) {
        for (const p of parts) {
          items.push({ isSubItem: false, text: p });
        }
      } else {
        items.push({ isSubItem: false, text: line });
      }
    }
  }

  return items;
}

function estimateTopicDifficulty(text: string, isSubItem: boolean): 1 | 2 | 3 | 4 {
  const norm = normalizeText(text);
  if (
    /avancad|complex|jurisprud|controle de constitucionalidade|algoritmo|arquitetura|criptografia|calculo|matriz|determinante|probabilidade|analise combinatoria|sintaxe do periodo|regencia|crase/.test(
      norm,
    )
  ) {
    return 3;
  }
  if (/nocoes|introducao|conceito|principio|basico|fundamento|definicao/.test(norm)) {
    return 2;
  }
  if (text.length > 140) return 3;
  return isSubItem ? 2 : 2;
}

function buildContentDraft(raw: RawTopicItem): ParsedContentDraft {
  const cleaned = raw.text.replace(/[.;]+$/, '').trim();

  // Se tiver "Título: detalhes", separa quando o título tem tamanho razoável
  const colonIdx = cleaned.indexOf(':');
  let title = cleaned;
  let description = cleaned;

  if (colonIdx >= 4 && colonIdx <= 78) {
    title = cleaned.slice(0, colonIdx).trim();
    const rest = cleaned.slice(colonIdx + 1).trim();
    description = rest.length > 0 ? rest : cleaned;
  } else if (cleaned.length > 82) {
    // Encurta título mantendo palavras inteiras
    const cut = cleaned.slice(0, 78);
    const lastSpace = cut.lastIndexOf(' ');
    title = `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
    description = cleaned;
  }

  return {
    id: uid('cnt_draft'),
    title,
    description,
    editalRef: raw.ref,
    difficulty: estimateTopicDifficulty(cleaned, raw.isSubItem),
  };
}

/**
 * Se um único item é muito denso (ex: "Direito Administrativo: conceito; princípios; atos; poderes; licitações."),
 * podemos manter como 1 conteúdo se curto, ou desmembrar se tiver >= 3 cláusulas separadas por `;`.
 */
function expandDenseItems(items: RawTopicItem[]): RawTopicItem[] {
  const result: RawTopicItem[] = [];
  for (const item of items) {
    const semiParts = item.text.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean);
    if (semiParts.length >= 3 && item.text.length > 120) {
      semiParts.forEach((part, idx) => {
        result.push({
          ref: item.ref ? `${item.ref}.${idx + 1}` : undefined,
          majorNum: item.majorNum,
          isSubItem: true,
          text: part,
        });
      });
    } else {
      result.push(item);
    }
  }
  return result;
}

function organizeItemsIntoLevels(items: RawTopicItem[]): ParsedLevelDraft[] {
  const expanded = expandDenseItems(items);
  if (expanded.length === 0) return [];

  // Verifica se há hierarquia clara (itens principais + sub-itens)
  const hasHierarchy =
    expanded.some((i) => !i.isSubItem) && expanded.some((i) => i.isSubItem);

  const modules: ParsedModuleDraft[] = [];

  if (hasHierarchy) {
    let currentMod: ParsedModuleDraft | null = null;
    for (const item of expanded) {
      if (!item.isSubItem) {
        if (currentMod && currentMod.contents.length === 0) {
          // O item anterior não tinha sub-itens, então ele mesmo era um conteúdo
          currentMod.contents.push(
            buildContentDraft({
              isSubItem: false,
              text: currentMod.title,
              ref: currentMod.subtitle,
            }),
          );
        }
        currentMod = {
          id: uid('mod_draft'),
          title: item.text.replace(/[.;:]+$/, '').slice(0, 75),
          subtitle: item.ref,
          contents: [],
        };
        modules.push(currentMod);
      } else {
        if (!currentMod) {
          currentMod = {
            id: uid('mod_draft'),
            title: 'Módulo 1 — Tópicos do Edital',
            contents: [],
          };
          modules.push(currentMod);
        }
        currentMod.contents.push(buildContentDraft(item));
      }
    }
    if (currentMod && currentMod.contents.length === 0) {
      currentMod.contents.push(
        buildContentDraft({
          isSubItem: false,
          text: currentMod.title,
          ref: currentMod.subtitle,
        }),
      );
    }

    // Se muitos módulos pequenos (1 conteúdo cada) ficaram espalhados, agrupa os unitários
    const mergedModules: ParsedModuleDraft[] = [];
    let bufferContents: ParsedContentDraft[] = [];

    const flushBuffer = () => {
      if (bufferContents.length === 0) return;
      mergedModules.push({
        id: uid('mod_draft'),
        title: `Bloco ${mergedModules.length + 1} — Tópicos do Edital`,
        contents: bufferContents,
      });
      bufferContents = [];
    };

    for (const mod of modules) {
      if (mod.contents.length <= 1 && modules.length > 5) {
        bufferContents.push(...mod.contents);
        if (bufferContents.length >= 4) flushBuffer();
      } else {
        flushBuffer();
        mergedModules.push(mod);
      }
    }
    flushBuffer();

    return groupModulesIntoLevels(mergedModules);
  }

  // Lista plana: agrupa em módulos de até 5 conteúdos cada
  const chunkSize = expanded.length <= 6 ? expanded.length : 4;
  for (let i = 0; i < expanded.length; i += chunkSize) {
    const slice = expanded.slice(i, i + chunkSize);
    const modIndex = modules.length + 1;
    const firstRef = slice[0]?.ref;
    const lastRef = slice[slice.length - 1]?.ref;
    const refRange =
      firstRef && lastRef && firstRef !== lastRef
        ? `${firstRef} a ${lastRef}`
        : firstRef;

    modules.push({
      id: uid('mod_draft'),
      title: `Módulo ${modIndex}${refRange ? ` (${refRange})` : ''}`,
      contents: slice.map(buildContentDraft),
    });
  }

  return groupModulesIntoLevels(modules);
}

function groupModulesIntoLevels(modules: ParsedModuleDraft[]): ParsedLevelDraft[] {
  if (modules.length === 0) return [];

  const modulesPerLevel = modules.length <= 3 ? modules.length : 2;
  const levels: ParsedLevelDraft[] = [];

  for (let i = 0; i < modules.length; i += modulesPerLevel) {
    const idx = levels.length;
    const slice = modules.slice(i, i + modulesPerLevel);
    const levelNumber = idx + 1;

    const levelTitle =
      idx === 0
        ? `Nível ${levelNumber} — Base do Edital`
        : idx === 1
          ? `Nível ${levelNumber} — Desenvolvimento`
          : `Nível ${levelNumber} — Aprofundamento`;

    levels.push({
      id: uid('lvl_draft'),
      title: levelTitle,
      subtitle: `${slice.reduce((acc, m) => acc + m.contents.length, 0)} tópicos mapeados do edital`,
      landscapeName: LANDSCAPE_NAMES[idx % LANDSCAPE_NAMES.length],
      modules: slice,
    });
  }

  return levels;
}

function formatDisciplineName(rawHeader: string): string {
  const cleaned = rawHeader
    .replace(/^(\d+[\.\)\-–—]?\s+|[ivxIVX]{1,5}[\.\)\-–—]\s+)/, '')
    .replace(/[:\-–—]+$/, '')
    .trim();

  // Se estiver todo em maiúsculas, converte para Title Case legível
  if (cleaned === cleaned.toUpperCase()) {
    const minorWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'a', 'o']);
    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((word, idx) => {
        if (idx > 0 && minorWords.has(word)) return word;
        if (word === 'ti' || word === 'afo' || word === 'rh' || word === 'sus') {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  return cleaned;
}

/**
 * Analisa o texto bruto de um edital colado pelo usuário e o transforma
 * em rascunhos estruturados de Disciplinas -> Níveis -> Módulos -> Conteúdos.
 */
export function parseEditalText(
  rawText: string,
  options?: { defaultDisciplineName?: string },
): ParsedEditalResult {
  const warnings: string[] = [];
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      disciplines: [],
      warnings: ['Cole o conteúdo do edital para iniciar a análise.'],
      totalContents: 0,
    };
  }

  const lines = preprocessLines(trimmed);
  let currentCategory = 'Geral';
  let currentSection: { name: string; category: string; lines: string[] } | null = null;
  const sections: Array<{ name: string; category: string; lines: string[] }> = [];

  const pushCurrent = () => {
    if (currentSection && currentSection.lines.length > 0) {
      sections.push(currentSection);
    }
  };

  for (const line of lines) {
    if (isGroupHeader(line)) {
      currentCategory = formatDisciplineName(line);
      continue;
    }

    const inlineSplit = splitInlineDisciplineHeader(line);
    if (inlineSplit) {
      pushCurrent();
      currentSection = {
        name: formatDisciplineName(inlineSplit.header),
        category: currentCategory,
        lines: [inlineSplit.rest],
      };
      continue;
    }

    if (isLikelyDisciplineHeader(line)) {
      pushCurrent();
      currentSection = {
        name: formatDisciplineName(line),
        category: currentCategory,
        lines: [],
      };
      continue;
    }

    if (!currentSection) {
      currentSection = {
        name: options?.defaultDisciplineName?.trim() || 'Disciplina do Edital',
        category: currentCategory,
        lines: [],
      };
    }
    currentSection.lines.push(line);
  }
  pushCurrent();

  // Caso nenhuma seção com linhas tenha sido formada
  if (sections.length === 0) {
    warnings.push(
      'Não foi possível identificar tópicos estruturados. Tente colar a lista de conteúdos do edital.',
    );
    return { disciplines: [], warnings, totalContents: 0 };
  }

  if (
    sections.length === 1 &&
    sections[0].name === (options?.defaultDisciplineName?.trim() || 'Disciplina do Edital')
  ) {
    warnings.push(
      'Nenhum cabeçalho de disciplina foi detectado automaticamente; os tópicos foram agrupados em uma única trilha (você pode renomeá-la abaixo).',
    );
  }

  const disciplines: ParsedDisciplineDraft[] = [];

  sections.forEach((sec, idx) => {
    const items = extractItemsFromBlock(sec.lines);
    const levels = organizeItemsIntoLevels(items);
    const contentCount = levels.reduce(
      (acc, lvl) => acc + lvl.modules.reduce((mAcc, m) => mAcc + m.contents.length, 0),
      0,
    );
    if (contentCount === 0) return;

    const visuals = inferDisciplineVisuals(sec.name, idx);
    const difficulty: Difficulty = contentCount >= 12 ? 'hard' : 'medium';
    const weight: 1 | 2 | 3 | 4 | 5 =
      sec.category.toLowerCase().includes('espec') ? 4 : 3;

    disciplines.push({
      id: uid('disc_draft'),
      name: sec.name,
      description: `Trilha gerada a partir do edital (${sec.category}) com ${contentCount} tópico${contentCount === 1 ? '' : 's'}.`,
      category: sec.category,
      theme: visuals.theme,
      icon: visuals.icon,
      weight,
      difficulty,
      selected: true,
      levels,
    });
  });

  const totalContents = disciplines.reduce(
    (acc, d) =>
      acc +
      d.levels.reduce(
        (lAcc, l) => lAcc + l.modules.reduce((mAcc, m) => mAcc + m.contents.length, 0),
        0,
      ),
    0,
  );

  return { disciplines, warnings, totalContents };
}

/**
 * Converte um rascunho analisado de disciplina em uma `Discipline` pronta para persistência.
 */
export function instantiateParsedDiscipline(
  draft: ParsedDisciplineDraft,
  options?: {
    examId?: string;
    inCycle?: boolean;
    sortOrder?: number;
  },
): Discipline {
  const now = new Date().toISOString();
  const disciplineId = uid('disc');

  const levels: TrailLevel[] = draft.levels.map((lvlDraft, lIdx) => {
    const levelId = uid('lvl');
    const modules: TrailModule[] = lvlDraft.modules.map((modDraft, mIdx) => {
      const moduleId = uid('mod');
      const contents: ContentNode[] = modDraft.contents.map((cntDraft, cIdx) => ({
        id: uid('cnt'),
        disciplineId,
        levelId,
        moduleId,
        title: cntDraft.title.trim(),
        description: cntDraft.description.trim(),
        editalRef: cntDraft.editalRef,
        sortOrder: cIdx,
        status: 'nao_iniciado',
        checklist: defaultChecklist(),
        completedAt: null,
        exercisesDone: 0,
        exercisesCorrect: 0,
        difficulty: cntDraft.difficulty,
        markedForReview: false,
        reviewCount: 0,
        lastStudiedAt: null,
        notes: '',
        difficulties: '',
        history: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending',
      }));

      return {
        id: moduleId,
        levelId,
        disciplineId,
        title: modDraft.title.trim(),
        subtitle: modDraft.subtitle,
        sortOrder: mIdx,
        contents,
      };
    });

    return {
      id: levelId,
      disciplineId,
      title: lvlDraft.title,
      subtitle: lvlDraft.subtitle,
      landscapeName: lvlDraft.landscapeName,
      sortOrder: lIdx,
      modules,
    };
  });

  return {
    id: disciplineId,
    examId: options?.examId ?? DEFAULT_EXAM_ID,
    name: draft.name.trim(),
    description: draft.description.trim(),
    theme: draft.theme,
    icon: draft.icon,
    sortOrder: options?.sortOrder ?? 0,
    inCycle: options?.inCycle ?? false,
    weight: draft.weight,
    difficulty: draft.difficulty,
    sessionMinutesOverride: null,
    adjustment: 1,
    levels,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
  };
}
