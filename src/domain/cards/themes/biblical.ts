import type { Discipline } from '../../types';
import type {
  AchievementContext,
  CardThemeDefinition,
  CollectibleCard,
} from '../types';

function getAllContents(disciplines: Discipline[]) {
  return disciplines.flatMap((d) =>
    d.levels.flatMap((l) => l.modules.flatMap((m) => m.contents)),
  );
}

function getTotalStudiedMinutes(ctx: AchievementContext): number {
  return ctx.sessions.reduce((acc, s) => acc + Math.max(0, s.studiedMinutes), 0);
}

function getCompletedContentsCount(ctx: AchievementContext): number {
  return getAllContents(ctx.disciplines).filter((c) => c.status === 'concluido').length;
}

function getTotalExercisesDone(ctx: AchievementContext): number {
  return getAllContents(ctx.disciplines).reduce((acc, c) => acc + c.exercisesDone, 0);
}

function getTotalExercisesCorrect(ctx: AchievementContext): number {
  return getAllContents(ctx.disciplines).reduce((acc, c) => acc + c.exercisesCorrect, 0);
}

function getOvercomeErrorsCount(ctx: AchievementContext): number {
  return ctx.errors.filter((e) => e.priority === 'superado').length;
}

function getActiveStudyDaysCount(ctx: AchievementContext): number {
  const days = new Set<string>();
  for (const s of ctx.sessions) {
    if (s.endedAt) {
      days.add(s.endedAt.slice(0, 10));
    }
  }
  return days.size;
}

function getTotalReviewsCount(ctx: AchievementContext): number {
  const contentReviews = getAllContents(ctx.disciplines).reduce(
    (acc, c) => acc + c.reviewCount,
    0,
  );
  const errorReviews = ctx.errors.reduce(
    (acc, e) => acc + e.reviewHistory.length,
    0,
  );
  return contentReviews + errorReviews;
}

export const BIBLICAL_THEME: CardThemeDefinition = {
  id: 'biblico',
  name: 'Crônicas Bíblicas',
  subtitle: 'Personagens, Epopeias e Milagres',
  description:
    'Obras-primas da arte sacra retratando figuras marcantes, narrativas épicas e os milagres de Jesus.',
  badgeLabel: 'Tema Bíblico',
  accentGradient: 'from-[#F59E0B] via-[#D97706] to-[#92400E]',
  categories: [
    {
      id: 'personagens',
      label: 'Personagens',
      description: 'Líderes, profetas, reis e apóstolos que marcaram a história.',
    },
    {
      id: 'historias',
      label: 'Histórias Épicas',
      description: 'Grandes provações, travessias e batalhas de fé.',
    },
    {
      id: 'milagres',
      label: 'Milagres de Jesus',
      description: 'Sinais prodigiosos de compaixão, poder e restauração.',
    },
  ],
};

export const BIBLICAL_CARDS: CollectibleCard[] = [
  // =========================================================================
  // PERSONAGENS
  // =========================================================================
  {
    id: 'bib-moses',
    number: '#001',
    themeId: 'biblico',
    categoryId: 'personagens',
    name: 'Moisés',
    subtitle: 'O Libertador e Legislador',
    rarity: 'rara',
    reference: 'Êxodo 3:10-14 · Êxodo 34:29',
    imageUrl: '/cards/biblical/moses.jpg',
    artwork: {
      title: 'Moisés (Estátua da Tumba de Júlio II)',
      artist: 'Michelangelo Buonarroti',
      year: '1513–1515',
      museum: 'San Pietro in Vincoli, Roma',
    },
    quote:
      '“Certamente eu estarei contigo; e este será o sinal de que eu te enviei.”',
    lore:
      'Criado na corte do faraó e forjado no deserto de Midiã, Moisés atendeu ao chamado na sarça ardente para conduzir um povo inteiro da servidão à terra prometida, recebendo no Monte Sinai as tábuas da Lei.',
    attributes: [
      { label: 'Liderança', value: 96 },
      { label: 'Perseverança', value: 94 },
      { label: 'Sabedoria', value: 90 },
    ],
    achievement: {
      id: 'ach-journey-start',
      title: 'Chamado à Jornada',
      description: 'Inicie sua jornada de aprendizagem no TotalControle.',
      hint: 'Disponível automaticamente ao iniciar seu primeiro objetivo de estudos.',
      evaluate: (ctx) => ({
        current: Math.max(1, ctx.exams.length),
        target: 1,
      }),
    },
  },
  {
    id: 'bib-david-king',
    number: '#002',
    themeId: 'biblico',
    categoryId: 'personagens',
    name: 'Rei Davi',
    subtitle: 'O Pastor, Salmista e Rei',
    rarity: 'lendaria',
    reference: '1 Samuel 16:13 · Salmos 23',
    imageUrl: '/cards/biblical/david-king.jpg',
    artwork: {
      title: 'Davi',
      artist: 'Michelangelo Buonarroti',
      year: '1501–1504',
      museum: "Galleria dell'Accademia, Florença",
    },
    quote:
      '“O Senhor é o meu pastor; nada me faltará.”',
    lore:
      'De jovem pastor de ovelhas em Belém a soberano de Israel, Davi uniu coragem guerreira e sensibilidade poética. Mesmo diante de adversidades extremas, manteve o coração voltado para a retidão e compôs salmos eternos.',
    attributes: [
      { label: 'Coragem', value: 98 },
      { label: 'Fé', value: 97 },
      { label: 'Inspiração', value: 95 },
    ],
    achievement: {
      id: 'ach-ten-hours',
      title: 'Coração de Rei',
      description: 'Acumule 600 minutos (10 horas) totais de estudo focado.',
      hint: 'Conclua sessões de estudo pelo Ciclo ou pela Trilha.',
      evaluate: (ctx) => ({
        current: getTotalStudiedMinutes(ctx),
        target: 600,
      }),
    },
  },
  {
    id: 'bib-solomon',
    number: '#003',
    themeId: 'biblico',
    categoryId: 'personagens',
    name: 'Salomão',
    subtitle: 'O Rei da Sabedoria',
    rarity: 'epica',
    reference: '1 Reis 3:9-12 · Provérbios 4:7',
    imageUrl: '/cards/biblical/solomon.jpg',
    artwork: {
      title: 'O Julgamento de Salomão',
      artist: 'Obra Clássica Europeia',
      year: 'Séc. XVII',
      museum: 'Acervo Histórico Europeu',
    },
    quote:
      '“O princípio da sabedoria é: adquire a sabedoria; e com tudo o que possuis, adquire o entendimento.”',
    lore:
      'Ao ser convidado a pedir o que quisesse, Salomão não pediu riquezas nem poder, mas um coração compreensivo para discernir entre o justo e o injusto. Seu reinado tornou-se sinônimo de ciência, provérbios e arquitetura monumental.',
    attributes: [
      { label: 'Sabedoria', value: 99 },
      { label: 'Discernimento', value: 96 },
      { label: 'Justiça', value: 92 },
    ],
    achievement: {
      id: 'ach-solomon-exercises',
      title: 'Discernimento em Questões',
      description: 'Resolva pelo menos 25 exercícios registrados nas trilhas.',
      hint: 'Atualize o contador de questões feitas nos conteúdos das suas trilhas.',
      evaluate: (ctx) => ({
        current: getTotalExercisesDone(ctx),
        target: 25,
      }),
    },
  },
  {
    id: 'bib-elijah',
    number: '#004',
    themeId: 'biblico',
    categoryId: 'personagens',
    name: 'Profeta Elias',
    subtitle: 'A Voz do Monte Carmelo',
    rarity: 'epica',
    reference: '1 Reis 18:36-39 · 2 Reis 2:11',
    imageUrl: '/cards/biblical/elijah.jpg',
    artwork: {
      title: 'Elias no Monte Horebe / Tradição Iconográfica',
      artist: 'Arte Sacra Clássica',
      year: 'Domínio Público',
      museum: 'Acervo Wikimedia Commons',
    },
    quote:
      '“Não estava o Senhor no vento, nem no terremoto, nem no fogo; mas em um cicio tranquilo e suave.”',
    lore:
      'Profeta intrépido em tempos de crise espiritual, Elias enfrentou centenas de falsos profetas no Monte Carmelo e ouviu a voz divina no silêncio do Horebe, antes de ser arrebatado em uma carruagem de fogo.',
    attributes: [
      { label: 'Zelo', value: 97 },
      { label: 'Ousadia', value: 94 },
      { label: 'Fé', value: 95 },
    ],
    achievement: {
      id: 'ach-elijah-days',
      title: 'Constância Profética',
      description: 'Estude em pelo menos 3 dias distintos com sessões registradas.',
      hint: 'Mantenha a consistência registrando sessões em dias diferentes.',
      evaluate: (ctx) => ({
        current: getActiveStudyDaysCount(ctx),
        target: 3,
      }),
    },
  },
  {
    id: 'bib-mary',
    number: '#005',
    themeId: 'biblico',
    categoryId: 'personagens',
    name: 'Maria de Nazaré',
    subtitle: 'Graça, Humildade e Entrega',
    rarity: 'rara',
    reference: 'Lucas 1:26-38 · Lucas 1:46-55',
    imageUrl: '/cards/biblical/mary.jpg',
    artwork: {
      title: 'A Anunciação',
      artist: 'Leonardo da Vinci & Andrea del Verrocchio',
      year: 'c. 1472–1476',
      museum: 'Galleria degli Uffizi, Florença',
    },
    quote:
      '“A minha alma engrandece ao Senhor, e o meu espírito se alegra em Deus, meu Salvador.”',
    lore:
      'Em uma pequena aldeia da Galileia, Maria recebeu o anúncio que mudaria o curso da história. Sua serenidade diante do extraordinário e sua firmeza até os momentos mais difíceis inspiram gerações.',
    attributes: [
      { label: 'Serenidade', value: 98 },
      { label: 'Fé', value: 96 },
      { label: 'Humildade', value: 97 },
    ],
    achievement: {
      id: 'ach-mary-first-session',
      title: 'Primeiro Passo Sereno',
      description: 'Conclua sua primeira sessão de estudo no TotalControle.',
      hint: 'Inicie e finalize uma sessão no Ciclo de Estudos ou na Trilha.',
      evaluate: (ctx) => ({
        current: ctx.sessions.length,
        target: 1,
      }),
    },
  },
  {
    id: 'bib-paul',
    number: '#006',
    themeId: 'biblico',
    categoryId: 'personagens',
    name: 'Paulo de Tarso',
    subtitle: 'O Apóstolo das Nações',
    rarity: 'epica',
    reference: 'Atos 9:1-19 · 2 Timóteo 4:7',
    imageUrl: '/cards/biblical/paul.jpg',
    artwork: {
      title: 'A Conversão de São Paulo no Caminho de Damasco',
      artist: 'Caravaggio (Michelangelo Merisi)',
      year: '1601',
      museum: 'Santa Maria del Popolo, Roma',
    },
    quote:
      '“Combati o bom combate, acabei a carreira, guardei a fé.”',
    lore:
      'Erudito e incansável, Saulo teve sua visão transformada no caminho de Damasco. Tornou-se o maior viajante e escritor do cristianismo primitivo, enfrentando naufrágios, prisões e debates filosóficos sem jamais recuar.',
    attributes: [
      { label: 'Erudição', value: 96 },
      { label: 'Resiliência', value: 95 },
      { label: 'Visão', value: 94 },
    ],
    achievement: {
      id: 'ach-paul-accuracy',
      title: 'Caminho de Damasco',
      description: 'Alcance 50 acertos acumulados em exercícios nas trilhas.',
      hint: 'Pratique questões nos conteúdos e registre seus acertos.',
      evaluate: (ctx) => ({
        current: getTotalExercisesCorrect(ctx),
        target: 50,
      }),
    },
  },

  // =========================================================================
  // HISTÓRIAS ÉPICAS
  // =========================================================================
  {
    id: 'bib-noah-ark',
    number: '#007',
    themeId: 'biblico',
    categoryId: 'historias',
    name: 'A Arca de Noé',
    subtitle: 'Aliança em Meio ao Dilúvio',
    rarity: 'comum',
    reference: 'Gênesis 6:14-22 · Gênesis 9:13',
    imageUrl: '/cards/biblical/noah-ark.jpg',
    artwork: {
      title: 'A Arca de Noé',
      artist: 'Edward Hicks / Acervo Clássico',
      year: '1846',
      museum: 'Philadelphia Museum of Art',
    },
    quote:
      '“Porei o meu arco nas nuvens, e ele será por sinal da aliança entre mim e a terra.”',
    lore:
      'Diante de um mundo em ruínas, Noé perseverou por décadas na construção da arca, mesmo sob descrença geral. Quando as águas cobriram a terra, a embarcação preservou a vida até o surgimento do arco da aliança.',
    attributes: [
      { label: 'Preparo', value: 93 },
      { label: 'Obediência', value: 92 },
      { label: 'Esperança', value: 90 },
    ],
    achievement: {
      id: 'ach-noah-disciplines',
      title: 'Arquitetura do Saber',
      description: 'Organize pelo menos 2 disciplinas em seu plano de estudos.',
      hint: 'Adicione disciplinas na Trilha (prontas ou personalizadas).',
      evaluate: (ctx) => ({
        current: ctx.disciplines.length,
        target: 2,
      }),
    },
  },
  {
    id: 'bib-red-sea',
    number: '#008',
    themeId: 'biblico',
    categoryId: 'historias',
    name: 'Travessia do Mar Vermelho',
    subtitle: 'Caminho Aberto no Impossível',
    rarity: 'lendaria',
    reference: 'Êxodo 14:13-22',
    imageUrl: '/cards/biblical/red-sea.jpg',
    artwork: {
      title: 'A Travessia do Mar Vermelho',
      artist: 'Nicolas Poussin',
      year: '1633–1634',
      museum: 'National Gallery of Victoria, Melbourne',
    },
    quote:
      '“Não temais; estai quietos e vede o livramento que o Senhor hoje vos fará.”',
    lore:
      'Encurralados entre o exército egípcio e o mar profundo, os israelitas viram as águas se dividirem em duas muralhas. A travessia em terra seca tornou-se o símbolo máximo de libertação diante do impossível.',
    attributes: [
      { label: 'Grandiosidade', value: 99 },
      { label: 'Libertação', value: 97 },
      { label: 'Fé', value: 96 },
    ],
    achievement: {
      id: 'ach-red-sea-contents',
      title: 'Travessia Triunfal',
      description: 'Conclua 10 tópicos de conteúdo em suas trilhas de estudo.',
      hint: 'Marque conteúdos como concluídos ao dominar cada assunto.',
      evaluate: (ctx) => ({
        current: getCompletedContentsCount(ctx),
        target: 10,
      }),
    },
  },
  {
    id: 'bib-daniel-lions',
    number: '#009',
    themeId: 'biblico',
    categoryId: 'historias',
    name: 'Daniel na Cova dos Leões',
    subtitle: 'Fidelidade Sob Provação',
    rarity: 'epica',
    reference: 'Daniel 6:10-23',
    imageUrl: '/cards/biblical/daniel-lions.jpg',
    artwork: {
      title: 'Daniel na Cova dos Leões',
      artist: 'Peter Paul Rubens',
      year: 'c. 1614–1616',
      museum: 'National Gallery of Art, Washington D.C.',
    },
    quote:
      '“O meu Deus enviou o seu anjo e fechou a boca dos leões, para que não me fizessem dano.”',
    lore:
      'Alvo de uma armadilha política na Babilônia por permanecer fiel às suas convicções, Daniel foi lançado à cova dos leões. Ao amanhecer, saiu ileso, provando que a integridade sobrevive até às maiores ameaças.',
    attributes: [
      { label: 'Integridade', value: 98 },
      { label: 'Coragem', value: 95 },
      { label: 'Paz', value: 91 },
    ],
    achievement: {
      id: 'ach-daniel-error',
      title: 'Vencendo os Leões',
      description: 'Supere seu primeiro erro no Caderno de Erros.',
      hint: 'Registre um erro e marque-o como superado após revisar.',
      evaluate: (ctx) => ({
        current: getOvercomeErrorsCount(ctx),
        target: 1,
      }),
    },
  },
  {
    id: 'bib-david-goliath',
    number: '#010',
    themeId: 'biblico',
    categoryId: 'historias',
    name: 'Davi e Golias',
    subtitle: 'O Triunfo da Precisão Sobre a Força',
    rarity: 'rara',
    reference: '1 Samuel 17:45-50',
    imageUrl: '/cards/biblical/david-goliath.jpg',
    artwork: {
      title: 'Davi com a Cabeça de Golias',
      artist: 'Caravaggio (Michelangelo Merisi)',
      year: '1609–1610',
      museum: 'Galleria Borghese, Roma',
    },
    quote:
      '“Tu vens a mim com espada, lança e escudo; eu, porém, vou a ti em nome do Senhor.”',
    lore:
      'Quando todo um exército recuou diante do gigante filisteu, o jovem Davi recusou a armadura pesada e avançou apenas com cinco pedras lisas e sua funda, derrubando Golias com um único arremesso certeiro.',
    attributes: [
      { label: 'Precisão', value: 96 },
      { label: 'Bravura', value: 95 },
      { label: 'Estratégia', value: 90 },
    ],
    achievement: {
      id: 'ach-goliath-minutes',
      title: 'Gigante Derrubado',
      description: 'Acumule 60 minutos de estudo registrado em sessões.',
      hint: 'Complete 1 hora total de estudo no Ciclo ou na Trilha.',
      evaluate: (ctx) => ({
        current: getTotalStudiedMinutes(ctx),
        target: 60,
      }),
    },
  },
  {
    id: 'bib-tower-babel',
    number: '#011',
    themeId: 'biblico',
    categoryId: 'historias',
    name: 'A Torre de Babel',
    subtitle: 'Lição Sobre Humildade e Linguagem',
    rarity: 'rara',
    reference: 'Gênesis 11:1-9',
    imageUrl: '/cards/biblical/tower-of-babel.jpg',
    artwork: {
      title: 'A Torre de Babel',
      artist: 'Pieter Bruegel, o Velho',
      year: '1563',
      museum: 'Kunsthistorisches Museum, Viena',
    },
    quote:
      '“Eis que o povo é um, e todos têm uma mesma língua; e isto é o que começam a fazer.”',
    lore:
      'Na planície de Sinear, a humanidade tentou erguer uma torre cujo topo tocasse os céus por pura vaidade. A confusão das línguas espalhou os povos pela terra, lembrando que o verdadeiro progresso exige propósito e humildade.',
    attributes: [
      { label: 'Magnitude', value: 94 },
      { label: 'Engenharia', value: 91 },
      { label: 'Reflexão', value: 89 },
    ],
    achievement: {
      id: 'ach-babel-contents',
      title: 'Mestre da Construção',
      description: 'Conclua 20 tópicos de conteúdo ao longo das suas trilhas.',
      hint: 'Avance nos módulos da trilha concluindo conteúdos estudados.',
      evaluate: (ctx) => ({
        current: getCompletedContentsCount(ctx),
        target: 20,
      }),
    },
  },

  // =========================================================================
  // MILAGRES DE JESUS
  // =========================================================================
  {
    id: 'bib-storm-galilee',
    number: '#012',
    themeId: 'biblico',
    categoryId: 'milagres',
    name: 'A Tempestade Acalmada',
    subtitle: 'Soberania Sobre os Ventos e o Mar',
    rarity: 'lendaria',
    reference: 'Marcos 4:35-41 · Mateus 8:23-27',
    imageUrl: '/cards/biblical/storm-galilee.jpg',
    artwork: {
      title: 'Cristo na Tempestade no Mar da Galileia',
      artist: 'Rembrandt van Rijn',
      year: '1633',
      museum: 'Isabella Stewart Gardner Museum, Boston',
    },
    quote:
      '“Acalma-te, emudece! E o vento se aquietou, e houve grande bonança.”',
    lore:
      'Enquanto ondas violentas ameaçavam afundar o barco no Mar da Galileia e os discípulos entravam em pânico, Jesus levantou-se, repreendeu o vento e o mar, transformando o caos em silêncio absoluto.',
    attributes: [
      { label: 'Autoridade', value: 99 },
      { label: 'Serenidade', value: 98 },
      { label: 'Poder', value: 99 },
    ],
    achievement: {
      id: 'ach-storm-completed',
      title: 'Bonança na Tempestade',
      description: 'Conclua 3 sessões completas (sem pular) de estudo focado.',
      hint: 'Finalize sessões no cronômetro até atingir o status concluído.',
      evaluate: (ctx) => ({
        current: ctx.sessions.filter((s) => s.status === 'completed').length,
        target: 3,
      }),
    },
  },
  {
    id: 'bib-loaves-fishes',
    number: '#013',
    themeId: 'biblico',
    categoryId: 'milagres',
    name: 'Multiplicação dos Pães e Peixes',
    subtitle: 'Abundância que Nasce da Partilha',
    rarity: 'comum',
    reference: 'João 6:1-14 · Mateus 14:13-21',
    imageUrl: '/cards/biblical/loaves-fishes.jpg',
    artwork: {
      title: 'A Multiplicação dos Pães e dos Peixes',
      artist: 'Arte Sacra Clássica',
      year: 'Domínio Público',
      museum: 'Acervo Histórico Internacional',
    },
    quote:
      '“Tomou Jesus os pães e, tendo dado graças, repartiu-os pelos que estavam assentados.”',
    lore:
      'Diante de uma multidão faminta com apenas cinco pães de cevada e dois peixinhos, Jesus abençoou a pequena oferta e saciou mais de cinco mil pessoas, restando ainda doze cestos cheios.',
    attributes: [
      { label: 'Generosidade', value: 97 },
      { label: 'Provisão', value: 95 },
      { label: 'Compaixão', value: 96 },
    ],
    achievement: {
      id: 'ach-loaves-contents',
      title: 'Multiplicando o Saber',
      description: 'Conclua 3 tópicos de conteúdo em qualquer trilha.',
      hint: 'Altere o status de 3 conteúdos para Concluído.',
      evaluate: (ctx) => ({
        current: getCompletedContentsCount(ctx),
        target: 3,
      }),
    },
  },
  {
    id: 'bib-walking-water',
    number: '#014',
    themeId: 'biblico',
    categoryId: 'milagres',
    name: 'Caminhando Sobre as Águas',
    subtitle: 'Fé Acima das Ondas',
    rarity: 'epica',
    reference: 'Mateus 14:22-33',
    imageUrl: '/cards/biblical/walking-water.jpg',
    artwork: {
      title: 'Cristo Caminhando Sobre as Águas',
      artist: 'Ivan Aivazovsky',
      year: '1888',
      museum: 'Acervo Clássico Russo',
    },
    quote:
      '“Tende bom ânimo, sou eu, não temais.”',
    lore:
      'Na quarta vigília da noite, em meio a ventos contrários, Jesus veio ao encontro dos discípulos caminhando sobre o mar agitado. Pedro deu passos sobre as águas enquanto manteve o olhar firme no Mestre.',
    attributes: [
      { label: 'Fé', value: 98 },
      { label: 'Foco', value: 96 },
      { label: 'Coragem', value: 94 },
    ],
    achievement: {
      id: 'ach-walking-cycle',
      title: 'Passos Firmes no Ciclo',
      description: 'Complete 1 ciclo inteiro de estudos ou acumule 180 minutos.',
      hint: 'Finalize todos os blocos de um ciclo ou estude 3 horas totais.',
      evaluate: (ctx) => {
        const minutes = getTotalStudiedMinutes(ctx);
        const cycles = ctx.cycleState.completedCycles;
        return {
          current: cycles >= 1 ? 180 : Math.min(179, minutes),
          target: 180,
        };
      },
    },
  },
  {
    id: 'bib-lazarus',
    number: '#015',
    themeId: 'biblico',
    categoryId: 'milagres',
    name: 'A Ressurreição de Lázaro',
    subtitle: 'Vida Onde Havia Fim',
    rarity: 'lendaria',
    reference: 'João 11:1-44',
    imageUrl: '/cards/biblical/lazarus.jpg',
    artwork: {
      title: 'A Ressurreição de Lázaro',
      artist: 'Caravaggio (Michelangelo Merisi)',
      year: 'c. 1609',
      museum: 'Museo Regionale, Messina',
    },
    quote:
      '“Eu sou a ressurreição e a vida; quem crê em mim, ainda que esteja morto, viverá.”',
    lore:
      'Em Betânia, diante do túmulo de seu amigo Lázaro já sepultado havia quatro dias, Jesus chorou por compaixão e bradou em alta voz: “Lázaro, vem para fora!”, devolvendo a vida diante de todos.',
    attributes: [
      { label: 'Renovação', value: 99 },
      { label: 'Compaixão', value: 97 },
      { label: 'Esperança', value: 98 },
    ],
    achievement: {
      id: 'ach-lazarus-errors',
      title: 'Renascimento do Domínio',
      description: 'Supere 5 erros registrados no Caderno de Erros.',
      hint: 'Revise seus erros e transforme falhas em pontos superados.',
      evaluate: (ctx) => ({
        current: getOvercomeErrorsCount(ctx),
        target: 5,
      }),
    },
  },
  {
    id: 'bib-wedding-cana',
    number: '#016',
    themeId: 'biblico',
    categoryId: 'milagres',
    name: 'As Bodas de Caná',
    subtitle: 'O Primeiro Sinal na Galileia',
    rarity: 'rara',
    reference: 'João 2:1-11',
    imageUrl: '/cards/biblical/wedding-cana.jpg',
    artwork: {
      title: 'As Bodas de Caná',
      artist: 'Paolo Veronese',
      year: '1563',
      museum: 'Museu do Louvre, Paris',
    },
    quote:
      '“Guardaste até agora o bom vinho.”',
    lore:
      'Durante uma celebração em Caná da Galileia, quando o vinho acabou, Jesus transformou seis talhas de água pura no melhor vinho da festa — inaugurando seus sinais com alegria, cuidado e generosidade.',
    attributes: [
      { label: 'Harmonia', value: 94 },
      { label: 'Transformação', value: 93 },
      { label: 'Alegria', value: 95 },
    ],
    achievement: {
      id: 'ach-cana-reviews',
      title: 'O Melhor para o Final',
      description: 'Realize 3 revisões em conteúdos da trilha ou no caderno de erros.',
      hint: 'Registre revisões de conteúdos ou revise erros do 2º ciclo.',
      evaluate: (ctx) => ({
        current: getTotalReviewsCount(ctx),
        target: 3,
      }),
    },
  },
];
