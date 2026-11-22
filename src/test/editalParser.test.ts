import { describe, expect, it } from 'vitest';
import {
  instantiateParsedDiscipline,
  parseEditalText,
} from '../domain/editalParser';

describe('Analisador Algorítmico de Edital', () => {
  it('detecta múltiplas disciplinas, categorias e sub-itens hierárquicos', () => {
    const raw = `
CONHECIMENTOS BÁSICOS

LÍNGUA PORTUGUESA
1. Compreensão e interpretação de textos de gêneros variados.
2. Domínio da coesão textual.
2.1 Emprego de elementos de referenciação e conectores.
2.2 Emprego de tempos e modos verbais.

CONHECIMENTOS ESPECÍFICOS

DIREITO ADMINISTRATIVO
1. Estado, governo e administração pública: conceitos e poderes.
2. Ato administrativo: conceito, requisitos, atributos e espécies.
`;

    const result = parseEditalText(raw);

    expect(result.disciplines).toHaveLength(2);
    expect(result.disciplines[0].name).toBe('Língua Portuguesa');
    expect(result.disciplines[0].category).toBe('Conhecimentos Básicos');
    expect(result.disciplines[0].theme).toBe('lavender');

    expect(result.disciplines[1].name).toBe('Direito Administrativo');
    expect(result.disciplines[1].category).toBe('Conhecimentos Específicos');
    expect(result.disciplines[1].theme).toBe('deep');
    expect(result.disciplines[1].weight).toBe(4);
    expect(result.totalContents).toBeGreaterThanOrEqual(5);
  });

  it('separa corretamente edital em formato inline estilo Cebraspe', () => {
    const raw = `NOÇÕES DE INFORMÁTICA: 1 Conceitos básicos de hardware e software. 2 Edição de textos, planilhas e apresentações (Microsoft Office). 3 Segurança da informação: noções de vírus, worms e pragas virtuais.`;

    const result = parseEditalText(raw);

    expect(result.disciplines).toHaveLength(1);
    const disc = result.disciplines[0];
    expect(disc.name).toBe('Noções de Informática');
    const allContents = disc.levels.flatMap((l) => l.modules.flatMap((m) => m.contents));
    expect(allContents).toHaveLength(3);
    expect(allContents[0].editalRef).toBe('Item 1');
    expect(allContents[2].title).toBe('Segurança da informação');
    expect(allContents[2].description).toContain('vírus');
  });

  it('agrupa tópicos sem cabeçalho em disciplina padrão com aviso', () => {
    const raw = `
1. Conjuntos numéricos e operações.
2. Equações de 1º e 2º grau.
3. Regra de três simples e composta.
`;

    const result = parseEditalText(raw, {
      defaultDisciplineName: 'Matemática Básica',
    });

    expect(result.disciplines).toHaveLength(1);
    expect(result.disciplines[0].name).toBe('Matemática Básica');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.totalContents).toBe(3);
  });

  it('converte rascunho analisado em Discipline completa com checklist padrão', () => {
    const raw = `
RACIOCÍNIO LÓGICO
1. Estruturas lógicas e tabela-verdade.
2. Análise combinatória e probabilidade.
`;
    const parsed = parseEditalText(raw);
    const disc = instantiateParsedDiscipline(parsed.disciplines[0], {
      examId: 'exam_custom',
      inCycle: true,
      sortOrder: 2,
    });

    expect(disc.examId).toBe('exam_custom');
    expect(disc.inCycle).toBe(true);
    expect(disc.sortOrder).toBe(2);
    expect(disc.levels.length).toBeGreaterThanOrEqual(1);
    const firstContent = disc.levels[0].modules[0].contents[0];
    expect(firstContent.disciplineId).toBe(disc.id);
    expect(firstContent.checklist.length).toBe(4);
    expect(firstContent.status).toBe('nao_iniciado');
  });
});
