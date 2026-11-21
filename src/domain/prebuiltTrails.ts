import { DEFAULT_EXAM_ID } from './constants';
import { uid } from './text';
import type {
  ChecklistItem,
  ContentNode,
  Difficulty,
  Discipline,
  DisciplineTheme,
  Exam,
  TrailLevel,
  TrailModule,
  TrailTemplate,
} from './types';

export function createDefaultExam(
  id: string = DEFAULT_EXAM_ID,
  name: string = 'Concurso Principal',
): Exam {
  const now = new Date().toISOString();
  return {
    id,
    name,
    description: 'Espaço principal de estudos',
    theme: 'sky',
    targetDate: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
  };
}

export function defaultChecklist(): ChecklistItem[] {
  return [
    { id: uid('chk'), label: 'Explorar o conceito central', done: false },
    { id: uid('chk'), label: 'Organizar anotações e exemplos', done: false },
    { id: uid('chk'), label: 'Praticar exercícios de fixação', done: false },
    { id: uid('chk'), label: 'Sintetizar o aprendizado com minhas palavras', done: false },
  ];
}

export const TRAIL_TEMPLATES: TrailTemplate[] = [
  {
    id: 'rlm-analista-ti',
    name: 'Raciocínio Lógico e Matemático',
    category: 'Ciências Exatas',
    description:
      'Álgebra, funções, lógica proposicional e argumentativa, combinatória, matrizes, sequências e geometria para Analista de TI.',
    theme: 'sky',
    icon: 'Compass',
    levels: [
      {
        title: 'Nível 1 — Álgebra, Conjuntos e Proporções',
        subtitle: 'Estruturas numéricas, equações e relações de proporcionalidade',
        landscapeName: 'Vale da Álgebra',
        modules: [
          {
            title: 'Equações, Inequações e Conjuntos',
            contents: [
              { title: 'Equações de 1º e 2º grau', description: 'Resolução, fatoração, fórmula quadrática e modelagem de problemas.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Inequações de 1º e 2º grau', description: 'Estudo do sinal, desigualdades e intervalos na reta real.', editalRef: 'Item 2', difficulty: 2 },
              { title: 'Conjuntos numéricos e relações', description: 'Naturais, inteiros, racionais, reais; pertinência, inclusão, igualdade e operações (união, interseção, diferença).', editalRef: 'Itens 11 e 16', difficulty: 2 },
              { title: 'Polinômios e operações', description: 'Conceito, grau, valor numérico, divisão e raízes de polinômios.', editalRef: 'Item 13', difficulty: 3 },
            ],
          },
          {
            title: 'Proporções e Sequências',
            contents: [
              { title: 'Regra de três simples e composta', description: 'Grandezas direta e inversamente proporcionais, porcentagem e aplicações.', editalRef: 'Item 9', difficulty: 2 },
              { title: 'Razões especiais', description: 'Velocidade média, densidade demográfica, escala e razões de proporção.', editalRef: 'Item 14', difficulty: 2 },
              { title: 'Progressões Aritméticas e Geométricas (PA e PG)', description: 'Termo geral, propriedades, soma dos termos e aplicações em problemas.', editalRef: 'Item 15', difficulty: 3 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Funções, Matrizes e Geometria',
        subtitle: 'Relações funcionais, sistemas lineares e visão espacial',
        landscapeName: 'Planalto das Formas e Matrizes',
        modules: [
          {
            title: 'Funções e Álgebra Linear',
            contents: [
              { title: 'Funções de 1º e 2º grau', description: 'Domínio, imagem, coeficientes, raízes, vértices, máximos e mínimos e interpretação gráfica.', editalRef: 'Item 3', difficulty: 3 },
              { title: 'Matrizes, determinantes e sistemas lineares', description: 'Operações com matrizes, determinante (regra de Sarrus, Laplace) e resolução/classificação de sistemas.', editalRef: 'Item 12', difficulty: 3 },
            ],
          },
          {
            title: 'Geometria e Trigonometria',
            contents: [
              { title: 'Geometria analítica', description: 'Ponto, distância, ponto médio, equações da reta e da circunferência no plano cartesiano.', editalRef: 'Item 4', difficulty: 3 },
              { title: 'Geometria plana e espacial', description: 'Triângulos, quadriláteros, círculos, áreas; poliedros, prismas, cilindros, pirâmides, cones, esferas e volumes.', editalRef: 'Item 17', difficulty: 3 },
              { title: 'Trigonometria', description: 'Razões no triângulo retângulo (seno, cosseno, tangente), círculo trigonométrico e identidades fundamentais.', editalRef: 'Item 18', difficulty: 3 },
            ],
          },
        ],
      },
      {
        title: 'Nível 3 — Lógica, Sequências e Combinatória',
        subtitle: 'Raciocínio dedutivo, estruturas lógicas e probabilidade',
        landscapeName: 'Cúpula do Raciocínio Lógico',
        modules: [
          {
            title: 'Lógica e Argumentação',
            contents: [
              { title: 'Lógica dedutiva, argumentativa e quantitativa', description: 'Proposições, conectivos, tabela-verdade, argumentos válidos e diagramas lógicos.', editalRef: 'Item 7', difficulty: 2 },
              { title: 'Lógica matemática qualitativa', description: 'Associações lógicas, verdades e mentiras, ordenação e correlações.', editalRef: 'Item 8', difficulty: 2 },
              { title: 'Princípio da Regressão ou Reversão', description: 'Problemas de raciocínio inverso, trabalhando do fim para o início.', editalRef: 'Item 6', difficulty: 3 },
              { title: 'Sequências lógicas com números, letras e figuras', description: 'Identificação de padrões, regularidades e analogias visuais/sequenciais.', editalRef: 'Item 10', difficulty: 2 },
            ],
          },
          {
            title: 'Análise Combinatória e Probabilidade',
            contents: [
              { title: 'Análise combinatória e probabilidade', description: 'Princípio fundamental da contagem, arranjos, permutações, combinações e probabilidade simples/condicional.', editalRef: 'Item 5', difficulty: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'portugues-analista-ti',
    name: 'Língua Portuguesa',
    category: 'Linguagens',
    description:
      'Interpretação textual, tipologia, sintaxe do período, crase, concordância, regência, pontuação e novo acordo ortográfico.',
    theme: 'lavender',
    icon: 'BookOpen',
    levels: [
      {
        title: 'Nível 1 — Compreensão Textual e Semântica',
        subtitle: 'Leitura crítica, significado e mecanismos de coesão',
        landscapeName: 'Jardim da Linguagem',
        modules: [
          {
            title: 'Texto, Tipologia e Sentido',
            contents: [
              { title: 'Compreensão e interpretação de textos', description: 'Ideia central, inferências, pressupostos, implícitos e intenção discursiva.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Tipologia e gênero textual', description: 'Textos narrativos, descritivos, dissertativos/argumentativos, injuntivos e gêneros cotidianos/oficiais.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Coesão e coerência textual', description: 'Mecanismos de referência, substituição, elipse e conectivos interparágrafos.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Denotação, conotação e figuras de linguagem', description: 'Sentido literal vs. figurado, metáfora, metonímia, hipérbole, ironia e estilística.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Significação das palavras e semântica', description: 'Sinonímia, antonímia, homonímia, paronímia, polissemia e ambiguidade.', editalRef: 'Item 1', difficulty: 2 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Morfossintaxe e Estrutura da Oração',
        subtitle: 'Classes gramaticais e organização sintática',
        landscapeName: 'Alameda Sintática',
        modules: [
          {
            title: 'Morfologia e Sintaxe',
            contents: [
              { title: 'Emprego das classes de palavras', description: 'Substantivo, adjetivo, pronome, verbo, advérbio, conjunção e preposição em contexto.', editalRef: 'Item 1', difficulty: 3 },
              { title: 'Sintaxe da oração e do período', description: 'Termos essenciais, integrantes e acessórios da oração; coordenação e subordinação.', editalRef: 'Item 1', difficulty: 3 },
              { title: 'Pontuação', description: 'Regras da vírgula (adjunto adverbial, aposto, orações coordenadas/subordinadas), ponto e vírgula e dois pontos.', editalRef: 'Item 1', difficulty: 3 },
            ],
          },
        ],
      },
      {
        title: 'Nível 3 — Regência, Concordância e Norma Padrão',
        subtitle: 'Domínio das relações de dependência gramatical',
        landscapeName: 'Câmara da Norma Culta',
        modules: [
          {
            title: 'Concordância, Regência e Ortografia',
            contents: [
              { title: 'Concordância verbal e nominal', description: 'Regras gerais e casos especiais (sujeito composto, partitivos, voz passiva sintética).', editalRef: 'Item 1', difficulty: 3 },
              { title: 'Regência verbal e nominal e estudo da crase', description: 'Transitividade de verbos frequentes em provas e casos obrigatórios, facultativos e proibidos da crase.', editalRef: 'Item 1', difficulty: 4 },
              { title: 'Ortografia oficial e acentuação gráfica', description: 'Novo acordo ortográfico, regras gerais de acentuação, oxítonas, paroxítonas, proparoxítonas e hiatos.', editalRef: 'Itens 2 e 3', difficulty: 2 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'conhecimentos-gerais-analista',
    name: 'Conhecimentos Gerais',
    category: 'Atualidades e Sociedade',
    description:
      'Panorama de acontecimentos políticos, econômicos, sociais, tecnológicos, ambientais e relações internacionais em âmbito municipal, regional e nacional.',
    theme: 'gold',
    icon: 'Globe',
    levels: [
      {
        title: 'Nível 1 — Política, Economia e Relações Internacionais',
        subtitle: 'Estruturas institucionais, geopolítica e conjuntura macroeconômica',
        landscapeName: 'Fórum da Atualidade',
        modules: [
          {
            title: 'Cenário Político-Institucional e Geopolítica',
            contents: [
              { title: 'Política e Sociedade no Brasil', description: 'Instituições democráticas, políticas públicas, cidadania, desigualdades e dinâmica social contemporânea.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Economia e Finanças Públicas', description: 'Inflação, taxa de juros, crescimento econômico, emprego, orçamento público e reformas.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Relações Internacionais e Conflitos Globais', description: 'Organizações multilaterais, acordos comerciais, transição energética e tensões geopolíticas.', editalRef: 'Item 1', difficulty: 2 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Tecnologia, Sustentabilidade e Cultura',
        subtitle: 'Transformação digital, desenvolvimento sustentável e raízes culturais',
        landscapeName: 'Mirante do Desenvolvimento',
        modules: [
          {
            title: 'Tecnologia, Meio Ambiente e Cultura',
            contents: [
              { title: 'Tecnologia, Inovação e Inteligência Artificial', description: 'Impactos da digitalização, IA, segurança cibernética, inclusão digital e mercado de trabalho.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Desenvolvimento Sustentável, Meio Ambiente e Energia', description: 'Mudanças climáticas, ESG, matriz energética renovável e acordos ambientais globais.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Educação, Segurança Pública, Artes e Literatura', description: 'Desafios educacionais, segurança nas cidades, patrimônio histórico-cultural e expressões artísticas nacionais.', editalRef: 'Item 1', difficulty: 2 },
              { title: 'Contextualização Histórica: Municipal, Regional e Nacional', description: 'Vinculações históricas dos fatos contemporâneos e diversidade regional brasileira.', editalRef: 'Item 1', difficulty: 2 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ti-governanca-gestao',
    name: 'TI — Governança e Gestão de TI',
    category: 'Conhecimentos Específicos',
    description:
      'Planejamento estratégico, PDTI, gerenciamento de serviços (ITIL/incidentes/mudanças), gestão de projetos ágeis (Scrum, Kanban).',
    theme: 'rose',
    icon: 'Layers',
    levels: [
      {
        title: 'Nível 1 — Estratégia e Planejamento de TI',
        subtitle: 'Alinhamento estratégico e planejamento tático de TI',
        landscapeName: 'Cúpula da Governança',
        modules: [
          {
            title: 'Governança, Estratégia e PDTI',
            contents: [
              { title: 'Governança e Gestão de TI', description: 'Conceitos de governança vs. gestão, alinhamento aos objetivos institucionais e tomada de decisão.', editalRef: 'Item 1.1', difficulty: 2 },
              { title: 'Planejamento Estratégico de TI (PETI)', description: 'Metodologias, mapa estratégico, metas, indicadores de desempenho (KPIs) e direcionamento.', editalRef: 'Item 1.1', difficulty: 3 },
              { title: 'Plano Diretor de Tecnologia da Informação (PDTI)', description: 'Estrutura, elaboração, inventário de necessidades, plano de metas, alocação orçamentária e acompanhamento.', editalRef: 'Item 1.2', difficulty: 3 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Serviços e Métodos Ágeis',
        subtitle: 'Operação de serviços de TI e execução ágil de projetos',
        landscapeName: 'Oficina Ágil de Serviços',
        modules: [
          {
            title: 'Gestão de Serviços e Projetos',
            contents: [
              { title: 'Gestão de Serviços de TI: Incidentes e Problemas', description: 'Conceitos fundamentais (ITIL), distinção entre incidente e problema, ciclo de atendimento e causas-raiz.', editalRef: 'Item 1.3', difficulty: 3 },
              { title: 'Gestão de Mudanças e Níveis de Serviço (SLA/OLA)', description: 'Comitê de mudanças (CAB), gestão de risco de liberação, acordos de nível de serviço e catálogo de serviços.', editalRef: 'Item 1.3', difficulty: 3 },
              { title: 'Gestão de Projetos e Métodos Ágeis: Scrum', description: 'Papéis (Product Owner, Scrum Master, Developers), cerimônias (Sprint, Daily, Review, Retrospective) e artefatos.', editalRef: 'Item 1.4', difficulty: 3 },
              { title: 'Métodos Ágeis: Kanban', description: 'Fluxo contínuo, limites de trabalho em progresso (WIP), cartões, lead time e cycle time.', editalRef: 'Item 1.4', difficulty: 2 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ti-infraestrutura-redes',
    name: 'TI — Infraestrutura e Redes de Computadores',
    category: 'Conhecimentos Específicos',
    description:
      'Arquitetura, virtualização, nuvem, Windows/Linux, storage, backup, modelos OSI/TCP-IP, IPv4/IPv6, roteamento e serviços fundamentais de rede.',
    theme: 'deep',
    icon: 'Cpu',
    levels: [
      {
        title: 'Nível 1 — Infraestrutura, Virtualização e Sistemas Operacionais',
        subtitle: 'Hardware, servidores, virtualização e sistemas operacionais essenciais',
        landscapeName: 'Data Center Central',
        modules: [
          {
            title: 'Servidores e Virtualização',
            contents: [
              { title: 'Arquitetura de computadores e servidores', description: 'CPUs, memórias, barramentos, servidores físicos (rack, blade), tolerância a falhas e alta disponibilidade.', editalRef: 'Item 2.1', difficulty: 3 },
              { title: 'Virtualização e Computação em Nuvem', description: 'Hipervisores (Tipo 1 e Tipo 2), VMs, containers, modelos de nuvem (IaaS, PaaS, SaaS) e implantação (pública, privada, híbrida).', editalRef: 'Item 2.2', difficulty: 3 },
            ],
          },
          {
            title: 'Sistemas Operacionais e Armazenamento',
            contents: [
              { title: 'Sistemas Operacionais Windows e Linux', description: 'Administração de usuários, permissões, processos, serviços essenciais, PowerShell e shell Bash.', editalRef: 'Item 2.3', difficulty: 3 },
              { title: 'Armazenamento, Desempenho, Backup e Recuperação', description: 'DAS, NAS, SAN, RAID, políticas de backup (completo, incremental, diferencial), RTO, RPO e disaster recovery.', editalRef: 'Item 2.4', difficulty: 3 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Redes, Protocolos e Serviços de Conectividade',
        subtitle: 'Arquitetura de rede, pilha de protocolos e serviços essenciais',
        landscapeName: 'Malha de Conexões',
        modules: [
          {
            title: 'Arquitetura de Redes e Endereçamento',
            contents: [
              { title: 'Modelos de Referência OSI e TCP/IP', description: 'Camadas, funções, encapsulamento e protocolos correspondentes em cada nível.', editalRef: 'Item 3.1', difficulty: 3 },
              { title: 'IPv4, IPv6, Sub-redes e Roteamento', description: 'Máscaras de rede, CIDR, cálculo de sub-redes, tipos de endereços IPv6 e protocolos de roteamento estático/dinâmico.', editalRef: 'Item 3.2', difficulty: 4 },
              { title: 'Topologias e Abrangência: LAN, WLAN e WAN', description: 'Redes locais cabeadas (Ethernet), sem fio (padrões 802.11/Wi-Fi) e redes de longa distância.', editalRef: 'Item 3.3', difficulty: 2 },
            ],
          },
          {
            title: 'Serviços de Rede e Monitoramento',
            contents: [
              { title: 'Serviços Fundamentais: DNS, DHCP, HTTP/HTTPS', description: 'Resolução de nomes, concessão dinâmica de IP, requisições HTTP, SSL/TLS e códigos de status.', editalRef: 'Item 3.4', difficulty: 3 },
              { title: 'Equipamentos e Monitoramento de Redes', description: 'Switches (camada 2 e 3), roteadores, access points, protocolo SNMP, NetFlow e ferramentas de monitoramento.', editalRef: 'Item 3.5', difficulty: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ti-desenvolvimento-dados',
    name: 'TI — Desenvolvimento de Sistemas e Banco de Dados',
    category: 'Conhecimentos Específicos',
    description:
      'Engenharia de software, requisitos, ciclo de vida, testes, POO, APIs, modelagem relacional, SQL, transações ACID e índices.',
    theme: 'sage',
    icon: 'Database',
    levels: [
      {
        title: 'Nível 1 — Engenharia de Software e Desenvolvimento',
        subtitle: 'Da análise de requisitos ao código orientado a objetos e APIs',
        landscapeName: 'Laboratório de Software',
        modules: [
          {
            title: 'Ciclo de Software e Requisitos',
            contents: [
              { title: 'Engenharia de Software e Requisitos', description: 'Levantamento, análise, especificação, requisitos funcionais vs. não funcionais e matriz de rastreabilidade.', editalRef: 'Item 4.1', difficulty: 3 },
              { title: 'Ciclo de vida, modelagem, testes e implantação', description: 'Modelos cascata/iterativo, UML (casos de uso, classes), testes (unitários, integração, regressão), CI/CD e manutenção.', editalRef: 'Item 4.2', difficulty: 3 },
            ],
          },
          {
            title: 'Orientação a Objetos e Integrações',
            contents: [
              { title: 'Programação Orientada a Objetos (POO)', description: 'Classes, objetos, encapsulamento, herança, polimorfismo, interfaces e princípios SOLID.', editalRef: 'Item 4.3', difficulty: 3 },
              { title: 'APIs e Integração entre Sistemas', description: 'APIs RESTful, métodos HTTP, JSON, XML, autenticação por token (JWT) e padrões de integração.', editalRef: 'Item 4.3', difficulty: 3 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Bancos de Dados Relacionais',
        subtitle: 'Modelagem de dados, linguagem SQL e otimização de transações',
        landscapeName: 'Cofre Relacional',
        modules: [
          {
            title: 'Modelagem e Linguagem SQL',
            contents: [
              { title: 'Bancos de dados relacionais e modelagem', description: 'Modelo Entidade-Relacionamento (MER/DER), chaves primárias/estrangeiras e formas normais (1FN, 2FN, 3FN).', editalRef: 'Item 4.4', difficulty: 3 },
              { title: 'Linguagem SQL (DDL, DML, DQL e DCL)', description: 'SELECT, JOINs (INNER, LEFT, RIGHT), GROUP BY, HAVING, subqueries, INSERT, UPDATE, DELETE e views.', editalRef: 'Item 4.4', difficulty: 3 },
              { title: 'Transações, Integridade e Índices', description: 'Propriedades ACID, níveis de isolamento, integridade referencial, criação de índices B-Tree e tuning de consultas.', editalRef: 'Item 4.4', difficulty: 4 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ti-seguranca-informacao',
    name: 'TI — Segurança da Informação',
    category: 'Conhecimentos Específicos',
    description:
      'Princípios de segurança (CIDAN), gestão de identidades, criptografia, ameaças, malware, firewall, logs, monitoramento e continuidade.',
    theme: 'rose',
    icon: 'Shield',
    levels: [
      {
        title: 'Nível 1 — Fundamentos, Acesso e Criptografia',
        subtitle: 'Pilares essenciais de segurança e proteção de dados',
        landscapeName: 'Bastião Criptográfico',
        modules: [
          {
            title: 'Princípios e Controle de Acesso',
            contents: [
              { title: 'Princípios da Segurança da Informação', description: 'Confidencialidade, integridade, disponibilidade, autenticidade e não repúdio (CIDAN).', editalRef: 'Item 5.1', difficulty: 2 },
              { title: 'Gestão de identidades e controle de acesso', description: 'Modelos DAC, MAC, RBAC, autenticação multifator (MFA), Single Sign-On (SSO) e diretórios (LDAP/AD).', editalRef: 'Item 5.2', difficulty: 3 },
              { title: 'Criptografia e Certificados Digitais', description: 'Criptografia simétrica vs. assimétrica, funções de hash (SHA, MD5), assinatura digital e infraestrutura de chaves públicas (ICP-Brasil).', editalRef: 'Item 5.3', difficulty: 3 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Ameaças, Defesa Perimetral e Continuidade',
        subtitle: 'Detecção de incidentes, proteção de redes e resiliência operacional',
        landscapeName: 'Central de Operações de Segurança (SOC)',
        modules: [
          {
            title: 'Ameaças e Mecanismos de Defesa',
            contents: [
              { title: 'Vulnerabilidades, ameaças e códigos maliciosos', description: 'Vírus, worms, trojans, ransomware, phishing, ataques DoS/DDoS, SQL Injection e XSS.', editalRef: 'Item 5.4', difficulty: 3 },
              { title: 'Firewall, proteção de endpoints e monitoramento de logs', description: 'Firewall com e sem estado, Next-Gen Firewall, IDS/IPS, antivírus/EDR, SIEM e análise de logs.', editalRef: 'Item 5.5', difficulty: 3 },
              { title: 'Gestão de Incidentes, Continuidade e Recuperação', description: 'Plano de Continuidade de Negócios (PCN), resposta a incidentes de segurança e mitigação de perdas.', editalRef: 'Item 5.5', difficulty: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ti-legislacao-governanca-publica',
    name: 'TI — Legislação, Contratações e Governo Digital',
    category: 'Conhecimentos Específicos',
    description:
      'Contratações de TI na Administração Pública (Lei 14.133/2021, ETP, TR), LGPD (Lei 13.709/2018), LAI (Lei 12.527/2011) e Governo Digital (Lei 14.129/2021).',
    theme: 'deep',
    icon: 'Scale',
    levels: [
      {
        title: 'Nível 1 — Contratações de TI na Administração Pública',
        subtitle: 'Processo de planejamento e execução de contratações de tecnologia sob a Lei 14.133/2021',
        landscapeName: 'Tribunal de Contratos Públicos',
        modules: [
          {
            title: 'Planejamento e Instrumentos Contratuais de TI',
            contents: [
              { title: 'Planejamento das Contratações de Tecnologia', description: 'Alinhamento ao plano de contratações anual, fases do processo de contratação e boas práticas públicas.', editalRef: 'Item 6.1', difficulty: 3 },
              { title: 'Estudo Técnico Preliminar (ETP) e Termo de Referência (TR)', description: 'Definição de requisitos, viabilidade técnica/econômica, especificação técnica de TI e estimativa de custos.', editalRef: 'Item 6.2', difficulty: 3 },
              { title: 'Gestão e Fiscalização de Contratos de TI', description: 'Papéis do fiscal técnico, fiscal administrativo, critérios de aceitação, ordem de serviço e glosas.', editalRef: 'Item 6.3', difficulty: 3 },
              { title: 'Lei Federal nº 14.133/2021 aplicada a Contratações de TI', description: 'Modalidades licitatórias, contratação direta (dispensa e inexigibilidade), sanções e regime de execução em TI.', editalRef: 'Item 6.4', difficulty: 4 },
            ],
          },
        ],
      },
      {
        title: 'Nível 2 — Proteção de Dados, Transparência e Governo Digital',
        subtitle: 'Marco legal da privacidade, acesso à informação e serviços digitais no setor público',
        landscapeName: 'Portal da Cidadania Digital',
        modules: [
          {
            title: 'LGPD, LAI e Governo Digital',
            contents: [
              { title: 'Lei Geral de Proteção de Dados (Lei 13.709/2018 - LGPD)', description: 'Princípios, bases legais, direitos dos titulares, agentes de tratamento e papel do DPO/Encarregado.', editalRef: 'Item 7.1', difficulty: 3 },
              { title: 'Tratamento de Dados Pessoais pelo Poder Público', description: 'Finalidade pública, governança de dados, compartilhamento de bases e segurança da informação.', editalRef: 'Item 7.2', difficulty: 3 },
              { title: 'Lei de Acesso à Informação (Lei 12.527/2011 - LAI)', description: 'Transparência ativa e passiva, prazos de resposta, hipóteses de sigilo e classificação de documentos.', editalRef: 'Item 7.3', difficulty: 2 },
              { title: 'Governo Digital (Lei Federal nº 14.129/2021)', description: 'Princípios do governo digital, desburocratização, serviços públicos digitais, interoperabilidade e identificação digital.', editalRef: 'Item 7.4', difficulty: 3 },
            ],
          },
        ],
      },
    ],
  },
];

export function instantiateTrailTemplate(
  template: TrailTemplate,
  options?: {
    examId?: string;
    weight?: 1 | 2 | 3 | 4 | 5;
    difficulty?: Difficulty;
    inCycle?: boolean;
    sortOrder?: number;
  },
): Discipline {
  const now = new Date().toISOString();
  const disciplineId = uid('disc');
  const levels: TrailLevel[] = template.levels.map((lvl, lIdx) => {
    const levelId = uid('lvl');
    const modules: TrailModule[] = lvl.modules.map((mod, mIdx) => {
      const moduleId = uid('mod');
      const contents: ContentNode[] = mod.contents.map((cnt, cIdx) => ({
        id: uid('cnt'),
        disciplineId,
        levelId,
        moduleId,
        title: cnt.title,
        description: cnt.description,
        editalRef: cnt.editalRef,
        sortOrder: cIdx,
        status: 'nao_iniciado',
        checklist: defaultChecklist(),
        completedAt: null,
        exercisesDone: 0,
        exercisesCorrect: 0,
        difficulty: cnt.difficulty,
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
        title: mod.title,
        subtitle: mod.subtitle,
        sortOrder: mIdx,
        contents,
      };
    });
    return {
      id: levelId,
      disciplineId,
      title: lvl.title,
      subtitle: lvl.subtitle,
      landscapeName: lvl.landscapeName,
      sortOrder: lIdx,
      modules,
    };
  });

  return {
    id: disciplineId,
    examId: options?.examId ?? DEFAULT_EXAM_ID,
    name: template.name,
    description: template.description,
    theme: template.theme,
    icon: template.icon,
    templateId: template.id,
    sortOrder: options?.sortOrder ?? 0,
    inCycle: options?.inCycle ?? true,
    weight: options?.weight ?? 3,
    difficulty: options?.difficulty ?? 'medium',
    sessionMinutesOverride: null,
    adjustment: 1,
    levels,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
  };
}

export function createCustomDiscipline(input: {
  examId?: string;
  name: string;
  description: string;
  theme: DisciplineTheme;
  icon?: string;
  weight?: 1 | 2 | 3 | 4 | 5;
  difficulty?: Difficulty;
  inCycle?: boolean;
  sortOrder?: number;
}): Discipline {
  const now = new Date().toISOString();
  const disciplineId = uid('disc');
  const levelId = uid('lvl');
  const moduleId = uid('mod');

  return {
    id: disciplineId,
    examId: input.examId ?? DEFAULT_EXAM_ID,
    name: input.name.trim(),
    description: input.description.trim() || 'Trilha personalizada de aprendizagem.',
    theme: input.theme,
    icon: input.icon ?? 'Compass',
    sortOrder: input.sortOrder ?? 0,
    inCycle: input.inCycle ?? true,
    weight: input.weight ?? 3,
    difficulty: input.difficulty ?? 'medium',
    sessionMinutesOverride: null,
    adjustment: 1,
    levels: [
      {
        id: levelId,
        disciplineId,
        title: 'Nível 1 — Fundamentos',
        subtitle: 'Primeiros conteúdos da disciplina',
        landscapeName: 'Ponto de Partida',
        sortOrder: 0,
        modules: [
          {
            id: moduleId,
            levelId,
            disciplineId,
            title: 'Módulo Inicial',
            sortOrder: 0,
            contents: [],
          },
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
  };
}

export function createStarterDisciplines(examId: string = DEFAULT_EXAM_ID): Discipline[] {
  const math = instantiateTrailTemplate(TRAIL_TEMPLATES[0], {
    examId,
    weight: 4,
    difficulty: 'medium',
    inCycle: true,
    sortOrder: 0,
  });
  // Marca os 2 primeiros conteúdos como concluídos/em andamento para demonstrar o fluxo integrado
  const firstContents = math.levels[0]?.modules[0]?.contents ?? [];
  if (firstContents[0]) {
    firstContents[0].status = 'concluido';
    firstContents[0].completedAt = new Date().toISOString();
    firstContents[0].lastStudiedAt = new Date().toISOString();
    firstContents[0].exercisesDone = 10;
    firstContents[0].exercisesCorrect = 9;
    firstContents[0].checklist = firstContents[0].checklist.map((c) => ({
      ...c,
      done: true,
    }));
  }
  if (firstContents[1]) {
    firstContents[1].status = 'em_andamento';
    firstContents[1].lastStudiedAt = new Date().toISOString();
    firstContents[1].checklist[0].done = true;
  }

  const portuguese = instantiateTrailTemplate(TRAIL_TEMPLATES[1], {
    examId,
    weight: 3,
    difficulty: 'medium',
    inCycle: true,
    sortOrder: 1,
  });

  return [math, portuguese];
}

