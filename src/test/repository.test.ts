import { describe, expect, it } from 'vitest';
import {
  calculateContentMetrics,
  calculateGlobalMetrics,
  flattenContents,
} from '../domain/mastery';
import { createCustomDiscipline, createDefaultExam } from '../domain/prebuiltTrails';
import { MemoryStorageBackend } from '../infra/desktop/bridge';
import { UnifiedRepository } from '../infra/sqlite/repository';

describe('UnifiedRepository (SQLite Compartilhado)', () => {
  it('inicializa trilhas base, relaciona sessão/erro ao mesmo conteúdo e restaura backup', async () => {
    const backend = new MemoryStorageBackend();
    const repo = await UnifiedRepository.open(backend);

    const initial = repo.loadAll();
    expect(initial.disciplines.length).toBeGreaterThanOrEqual(2);
    expect(initial.cycleState.plan?.blocks.length).toBeGreaterThan(0);

    const disc = initial.disciplines[0];
    const content = flattenContents(disc)[0];

    // Registra erro vinculado ao mesmo disciplineId e contentId
    const errRes = await repo.addErrorRecord({
      disciplineId: disc.id,
      contentId: content.id,
      description: 'Erro de sinal na fração',
      correction: 'Conservar o sinal negativo do numerador',
      prevention: 'Revisar sinais antes de somar',
      priority: 'alta',
      origin: 'esquecimento',
      registrationDate: '18/11/2026',
    });
    expect(errRes.ok).toBe(true);

    // Bloqueia duplicidade idêntica
    const dupRes = await repo.addErrorRecord({
      disciplineId: disc.id,
      contentId: content.id,
      description: 'Erro de sinal na fração',
      correction: 'Conservar o sinal negativo do numerador',
      prevention: '',
      priority: 'alta',
      origin: 'esquecimento',
      registrationDate: '18/11/2026',
    });
    expect(dupRes.ok).toBe(false);

    if (errRes.ok) {
      await repo.submitErrorReview({
        error: errRes.value,
        newPriority: 'superado',
        action: 'revisao_2_ciclo',
      });
    }

    expect(repo.loadAll().syncSummary.pendingChanges).toBeGreaterThan(0);

    // Exporta backup e restaura em um novo banco limpo
    const backupJson = JSON.stringify(repo.createBackupPayload());

    const backend2 = new MemoryStorageBackend();
    const repo2 = await UnifiedRepository.open(backend2);
    const restoreRes = await repo2.restoreFromBackup(backupJson, 'replace');
    expect(restoreRes.ok).toBe(true);

    const restored = repo2.loadAll();
    expect(restored.errors.length).toBe(1);
    expect(restored.errors[0].priority).toBe('superado');
    expect(restored.errors[0].reviewHistory.length).toBe(1);
  });

  it('compartilha progresso no mesmo conteúdo entre sessões de Trilha e Ciclo sem duplicar nem acoplar o ciclo', async () => {
    const backend = new MemoryStorageBackend();
    const repo = await UnifiedRepository.open(backend);

    const initial = repo.loadAll();
    const disc = initial.disciplines[0];
    const targetContent = flattenContents(disc)[1];
    const initialPos = initial.cycleState.position;
    const nowIso = new Date().toISOString();

    // 1. Sessão originada na Trilha: NÃO avança o ciclo, mas atualiza o conteúdo
    await repo.finishStudySession({
      record: {
        id: 'sess_trilha_1',
        origin: 'trilha',
        disciplineId: disc.id,
        disciplineName: disc.name,
        disciplineTheme: disc.theme,
        contentId: targetContent.id,
        contentTitle: targetContent.title,
        cycleNumber: 0,
        blockIndex: -1,
        startedAt: nowIso,
        endedAt: nowIso,
        plannedMinutes: 50,
        studiedMinutes: 30,
        status: 'partial',
        notes: 'Estudo direto pela trilha',
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
      },
      nextCycleState: null,
      linkedContent: targetContent,
    });

    const afterTrail = repo.loadAll();
    expect(afterTrail.cycleState.position).toBe(initialPos);
    expect(afterTrail.sessions.find((s) => s.id === 'sess_trilha_1')?.origin).toBe(
      'trilha',
    );

    // 2. Sessão originada no Ciclo no MESMO conteúdo: soma tempo e avança o ciclo
    const updatedContent = flattenContents(afterTrail.disciplines[0]).find(
      (c) => c.id === targetContent.id,
    )!;
    await repo.finishStudySession({
      record: {
        id: 'sess_ciclo_1',
        origin: 'ciclo',
        disciplineId: disc.id,
        disciplineName: disc.name,
        disciplineTheme: disc.theme,
        contentId: targetContent.id,
        contentTitle: targetContent.title,
        cycleNumber: 1,
        blockIndex: 0,
        startedAt: nowIso,
        endedAt: nowIso,
        plannedMinutes: 50,
        studiedMinutes: 45,
        status: 'completed',
        notes: 'Estudo pelo bloco do ciclo',
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
      },
      nextCycleState: {
        ...afterTrail.cycleState,
        position: initialPos + 1,
      },
      linkedContent: updatedContent,
    });

    const afterCycle = repo.loadAll();
    expect(afterCycle.cycleState.position).toBe(initialPos + 1);

    const finalContent = flattenContents(afterCycle.disciplines[0]).find(
      (c) => c.id === targetContent.id,
    )!;
    const unifiedMetrics = calculateContentMetrics({
      node: finalContent,
      sessions: afterCycle.sessions,
      errors: afterCycle.errors,
    });

    // Tempo unificado = 30 (Trilha) + 45 (Ciclo) = 75 min
    expect(unifiedMetrics.studiedMinutes).toBe(75);
    expect(finalContent.history.length).toBeGreaterThanOrEqual(2);

    // 3. Remover disciplina do ciclo não apaga progresso nem sessões da trilha
    await repo.saveDiscipline({ ...afterCycle.disciplines[0], inCycle: false });
    const afterLeaveCycle = repo.loadAll();
    const preservedContent = flattenContents(afterLeaveCycle.disciplines[0]).find(
      (c) => c.id === targetContent.id,
    )!;
    expect(preservedContent.status).toBe('em_andamento');
    expect(afterLeaveCycle.sessions.length).toBe(2);
  });

  it('restaura com sucesso backup legado do Ciclo de Estudos preservando 4 matérias, 26 sessões, 18h e ciclo', async () => {
    const legacyBackup = {
      app: 'ciclo',
      kind: 'backup',
      schemaVersion: 3,
      exportedAt: '2026-11-19T03:25:32.659Z',
      data: {
        schemaVersion: 3,
        courses: [
          {
            id: 'default',
            name: 'Curso Principal',
            color: '#002a32',
            subjects: [
              {
                id: 'c_1794166407900_o73c1fs',
                name: 'Matemática',
                weight: 5,
                difficulty: 'hard',
                sessionMinutes: null,
                color: '#5c64e8',
                createdAt: '2026-11-08T19:33:27.900Z',
                updatedAt: '2026-11-08T19:33:27.900Z',
                adjustment: 1,
              },
              {
                id: 'c_1794199545907_vsxffis',
                name: 'Português',
                weight: 3,
                difficulty: 'medium',
                sessionMinutes: null,
                color: '#f7a072',
                createdAt: '2026-11-09T04:45:45.907Z',
                updatedAt: '2026-11-09T04:45:45.907Z',
                adjustment: 1,
              },
              {
                id: 'c_1794539502628_u2704a2',
                name: 'Governança e gestão de TI',
                weight: 3,
                difficulty: 'medium',
                sessionMinutes: null,
                color: '#1e555c',
                createdAt: '2026-11-13T03:11:42.628Z',
                updatedAt: '2026-11-13T03:11:42.628Z',
                adjustment: 1,
              },
            ],
            settings: {
              cycleMinutes: 720,
              sessionMinutes: 50,
              minBlockMinutes: 25,
            },
            cycle: {
              plan: {
                totalMinutes: 720,
                blocks: [
                  { index: 0, subjectId: 'c_1794166407900_o73c1fs', minutes: 50, part: 1, parts: 7 },
                  { index: 1, subjectId: 'c_1794199545907_vsxffis', minutes: 50, part: 1, parts: 4 },
                  { index: 2, subjectId: 'c_1794166407900_o73c1fs', minutes: 45, part: 2, parts: 7 },
                ],
                allocations: [
                  {
                    subjectId: 'c_1794166407900_o73c1fs',
                    weight: 5,
                    difficulty: 'hard',
                    difficultyFactor: 1.25,
                    adjustment: 1,
                    score: 6.25,
                    rawShare: 0.51,
                    share: 0.45,
                    clamp: 'max',
                    minutes: 325,
                    blocks: 7,
                    sessionMinutes: 50,
                  },
                ],
                signature: '66b7ys',
              },
              position: 3,
              cycleNumber: 1,
              completedCycles: 0,
            },
          },
          {
            id: 'c_1794766537194_kd7tib9',
            name: 'Vestibular',
            color: '#d98254',
            subjects: [
              {
                id: 'c_1794251387788_0lcz8vj',
                name: 'Biologia',
                weight: 3,
                difficulty: 'medium',
                sessionMinutes: 30,
                color: '#529e7e',
                createdAt: '2026-11-09T19:09:47.781Z',
                updatedAt: '2026-11-15T18:15:45.499Z',
                adjustment: 1,
              },
            ],
          },
        ],
        activeCourseId: 'default',
        subjects: [
          {
            id: 'c_1794166407900_o73c1fs',
            name: 'Matemática',
            weight: 5,
            difficulty: 'hard',
            sessionMinutes: null,
            color: '#5c64e8',
            createdAt: '2026-11-08T19:33:27.900Z',
            updatedAt: '2026-11-08T19:33:27.900Z',
            adjustment: 1,
          },
          {
            id: 'c_1794199545907_vsxffis',
            name: 'Português',
            weight: 3,
            difficulty: 'medium',
            sessionMinutes: null,
            color: '#f7a072',
            createdAt: '2026-11-09T04:45:45.907Z',
            updatedAt: '2026-11-09T04:45:45.907Z',
            adjustment: 1,
          },
          {
            id: 'c_1794539502628_u2704a2',
            name: 'Governança e gestão de TI',
            weight: 3,
            difficulty: 'medium',
            sessionMinutes: null,
            color: '#1e555c',
            createdAt: '2026-11-13T03:11:42.628Z',
            updatedAt: '2026-11-13T03:11:42.628Z',
            adjustment: 1,
          },
        ],
        settings: {
          cycleMinutes: 720,
          sessionMinutes: 50,
          minBlockMinutes: 25,
        },
        cycle: {
          plan: {
            totalMinutes: 720,
            blocks: [
              { index: 0, subjectId: 'c_1794166407900_o73c1fs', minutes: 50, part: 1, parts: 7 },
              { index: 1, subjectId: 'c_1794199545907_vsxffis', minutes: 50, part: 1, parts: 4 },
              { index: 2, subjectId: 'c_1794166407900_o73c1fs', minutes: 45, part: 2, parts: 7 },
            ],
            allocations: [
              {
                subjectId: 'c_1794166407900_o73c1fs',
                weight: 5,
                difficulty: 'hard',
                score: 6.25,
                rawShare: 0.51,
                share: 0.45,
                minutes: 325,
                blocks: 7,
                sessionMinutes: 50,
              },
            ],
            signature: '66b7ys',
          },
          position: 3,
          cycleNumber: 1,
          completedCycles: 0,
        },
        history: [
          {
            id: 'c_1795048275412_znc0hos',
            subjectId: 'c_1794166407900_o73c1fs',
            subjectName: 'Matemática',
            subjectColor: '#5c64e8',
            cycleNumber: 1,
            blockIndex: 2,
            startedAt: '2026-11-18T22:53:13.800Z',
            endedAt: '2026-11-19T00:31:15.412Z',
            plannedMinutes: 45,
            studiedMinutes: 62,
            status: 'completed',
            notes: 'Proposições Simples e Compostas e Operadores Lógicos',
          },
          {
            id: 'c_1794423535172_8eqsmav',
            subjectId: 'c_1794251387788_0lcz8vj',
            subjectName: 'Biologia',
            subjectColor: '#529e7e',
            cycleNumber: 1,
            blockIndex: 1,
            startedAt: '2026-11-11T18:37:54.310Z',
            endedAt: '2026-11-11T18:58:55.172Z',
            plannedMinutes: 30,
            studiedMinutes: 21,
            status: 'partial',
            notes: 'Flashcards e estudo específico do nucléolo.',
          },
        ],
      },
    };

    const backend = new MemoryStorageBackend();
    const repo = await UnifiedRepository.open(backend);

    const res = await repo.restoreFromBackup(JSON.stringify(legacyBackup), 'replace');
    expect(res.ok).toBe(true);

    const loaded = repo.loadAll();
    expect(loaded.disciplines.length).toBe(4);
    expect(loaded.disciplines.map((d) => d.name)).toContain('Matemática');
    expect(loaded.disciplines.map((d) => d.name)).toContain('Português');
    expect(loaded.disciplines.map((d) => d.name)).toContain('Governança e gestão de TI');
    expect(loaded.disciplines.map((d) => d.name)).toContain('Biologia');

    expect(loaded.sessions.length).toBe(2);
    expect(loaded.sessions[0].studiedMinutes).toBe(62);
    expect(loaded.sessions[1].studiedMinutes).toBe(21);

    expect(loaded.cycleState.position).toBe(3);
    expect(loaded.cycleState.cycleNumber).toBe(1);
    expect(loaded.cycleSettings.cycleMinutes).toBe(720);
  });

  it('mescla backup legado do ERRATA sem duplicar disciplinas e preservando tópicos, erros e revisões', async () => {
    const cicloFixture = {
      app: 'ciclo',
      kind: 'backup',
      schemaVersion: 3,
      exportedAt: '2026-11-19T03:25:32.659Z',
      data: {
        subjects: [
          { id: 'sub_math', name: 'Matemática', weight: 5, difficulty: 'hard', color: '#5c64e8' },
          { id: 'sub_pt', name: 'Português', weight: 3, difficulty: 'medium', color: '#f7a072' },
        ],
        settings: { cycleMinutes: 600, sessionMinutes: 50, minBlockMinutes: 25 },
        history: [
          {
            id: 'h_1',
            subjectId: 'sub_math',
            subjectName: 'Matemática',
            studiedMinutes: 50,
            plannedMinutes: 50,
            status: 'completed',
            startedAt: '2026-11-18T10:00:00Z',
            endedAt: '2026-11-18T10:50:00Z',
          },
        ],
      },
    };

    const errataFixture = {
      appName: 'ERRATA',
      exportedAt: '2026-11-19T04:00:00.000Z',
      data: {
        subjects: [{ id: 'err_pt', name: 'Língua Portuguesa' }],
        topics: [
          { id: 'top_crase', subjectId: 'err_pt', name: 'Crase' },
          { id: 'top_regencia', subjectId: 'err_pt', name: 'Regência Verbal' },
        ],
        errors: [
          {
            id: 'e_1',
            subjectId: 'err_pt',
            topicId: 'top_crase',
            description: 'Usou crase antes de verbo',
            correction: 'Não há crase antes de verbo no infinitivo',
            prevention: 'Identificar se a palavra seguinte é verbo',
            priority: 'superado',
            origin: 'confusao',
            registrationDate: '18/11/2026',
            reviewHistory: [
              {
                id: 'r_1',
                timestamp: '2026-11-19T03:00:00Z',
                previousPriority: 'alta',
                newPriority: 'superado',
                action: 'revisao_2_ciclo',
              },
            ],
          },
          {
            id: 'e_2',
            subjectId: 'err_pt',
            topicId: 'top_regencia',
            description: 'Regência do verbo assistir',
            correction: 'No sentido de ver, exige preposição "a"',
            prevention: 'Trocar por presenciar',
            priority: 'media',
            origin: 'esquecimento',
            registrationDate: '18/11/2026',
            reviewHistory: [],
          },
        ],
      },
    };

    const backend = new MemoryStorageBackend();
    const repo = await UnifiedRepository.open(backend);

    const res1 = await repo.restoreFromBackup(JSON.stringify(cicloFixture), 'replace');
    expect(res1.ok).toBe(true);

    const res2 = await repo.restoreFromBackup(JSON.stringify(errataFixture), 'merge');
    expect(res2.ok).toBe(true);

    const loaded = repo.loadAll();
    // Continua com exatamente 2 disciplinas (sem duplicar Língua Portuguesa / Português)
    expect(loaded.disciplines.length).toBe(2);
    expect(loaded.sessions.length).toBe(1);
    expect(loaded.errors.length).toBe(2);
    expect(loaded.errors.filter((e) => e.priority === 'superado').length).toBe(1);
    expect(loaded.errors.filter((e) => e.priority === 'media').length).toBe(1);

    const pt = loaded.disciplines.find((d) => d.name === 'Português')!;
    expect(flattenContents(pt).length).toBe(2);
  });

  it('coloca banco corrompido em quarentena, recupera fila persistChain após erro transitório e compacta sync_outbox', async () => {
    const backend = new MemoryStorageBackend();
    // Simula bytes corrompidos
    await backend.saveBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

    const repo = await UnifiedRepository.open(backend);
    expect(backend.quarantinedCount).toBe(1);
    expect(repo.recoveryNotice).toBeTruthy();

    // Testa compactação de sync_outbox ao salvar a mesma disciplina várias vezes
    const disc = repo.loadAll().disciplines[0];
    await repo.saveDiscipline({ ...disc, description: 'v1' });
    await repo.saveDiscipline({ ...disc, description: 'v2' });
    await repo.saveDiscipline({ ...disc, description: 'v3' });
    expect(repo.loadAll().syncSummary.pendingChanges).toBe(1);

    // Testa que persistChain se recupera após uma falha transitória de I/O
    const originalSave = backend.saveBytes.bind(backend);
    let failOnce = true;
    backend.saveBytes = async (bytes: Uint8Array) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('EBUSY: transient lock');
      }
      await originalSave(bytes);
    };

    await expect(repo.updateUserName('Falha Transitória')).rejects.toThrow('EBUSY');
    await expect(repo.updateUserName('Recuperado')).resolves.toBeUndefined();
    expect(repo.loadAll().meta.userName).toBe('Recuperado');

    // Testa restauração de .sqlite e ocultação de erros/sessões de disciplina excluída
    const sqliteBytes = repo.exportSqliteBytes();
    const repoFromSqlite = await UnifiedRepository.open(new MemoryStorageBackend());
    const sqliteRes = await repoFromSqlite.restoreFromSqliteBytes(sqliteBytes);
    expect(sqliteRes.ok).toBe(true);
    expect(repoFromSqlite.loadAll().meta.userName).toBe('Recuperado');

    const d0 = repoFromSqlite.loadAll().disciplines[0];
    const c0 = flattenContents(d0)[0];
    await repoFromSqlite.addErrorRecord({
      disciplineId: d0.id,
      contentId: c0.id,
      description: 'Erro teste',
      correction: 'Correção teste',
      prevention: '',
      priority: 'alta',
      origin: 'confusao',
      registrationDate: '22/11/2026',
    });
    expect(repoFromSqlite.loadAll().errors.length).toBe(1);
    await repoFromSqlite.deleteDiscipline(d0.id, d0.name);
    expect(repoFromSqlite.loadAll().errors.length).toBe(0);
  });

  it('isola disciplinas, ciclo de estudos e estatísticas por concurso ao alternar entre múltiplos concursos', async () => {
    const backend = new MemoryStorageBackend();
    const repo = await UnifiedRepository.open(backend);

    const initial = repo.loadAll();
    expect(initial.exams.length).toBe(1);
    const exam1 = initial.exams[0];

    // Configura ciclo do Concurso 1
    await repo.updateCycleSettings(
      { cycleMinutes: 480, sessionMinutes: 40, minBlockMinutes: 20 },
      exam1.id,
    );

    // Cria Concurso 2 (ex.: TJ-SP)
    const exam2 = createDefaultExam('exam_tjsp', 'TJ-SP');
    await repo.saveExam(exam2, 'Concurso TJ-SP criado.');
    await repo.setActiveExamId(exam2.id);

    const discTjsp = createCustomDiscipline({
      examId: exam2.id,
      name: 'Direito Administrativo',
      description: 'Edital TJ-SP',
      theme: 'lavender',
      inCycle: true,
      weight: 5,
    });
    await repo.saveDiscipline(discTjsp);
    await repo.updateCycleSettings(
      { cycleMinutes: 300, sessionMinutes: 60, minBlockMinutes: 30 },
      exam2.id,
    );

    // Registra sessão no Concurso 2
    const nowIso = new Date().toISOString();
    await repo.finishStudySession({
      record: {
        id: 'sess_tjsp_1',
        origin: 'ciclo',
        disciplineId: discTjsp.id,
        disciplineName: discTjsp.name,
        disciplineTheme: discTjsp.theme,
        contentId: null,
        contentTitle: null,
        cycleNumber: 1,
        blockIndex: 0,
        startedAt: nowIso,
        endedAt: nowIso,
        plannedMinutes: 60,
        studiedMinutes: 55,
        status: 'completed',
        notes: '',
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
      },
      examId: exam2.id,
    });

    // Com Concurso 2 ativo: vê apenas disciplinas do TJ-SP e ciclo de 300 min
    const stateExam2 = repo.loadAll();
    expect(stateExam2.meta.activeExamId).toBe(exam2.id);
    const exam2Discs = stateExam2.disciplines.filter((d) => d.examId === exam2.id);
    expect(exam2Discs.map((d) => d.name)).toEqual(['Direito Administrativo']);
    expect(stateExam2.cycleSettings.cycleMinutes).toBe(300);
    expect(stateExam2.cycleState.plan?.blocks.every((b) => b.disciplineId === discTjsp.id)).toBe(true);

    const exam2DiscIds = new Set(exam2Discs.map((d) => d.id));
    const exam2Stats = calculateGlobalMetrics(
      exam2Discs,
      stateExam2.sessions.filter((s) => exam2DiscIds.has(s.disciplineId)),
      stateExam2.errors.filter((e) => exam2DiscIds.has(e.disciplineId)),
    );
    expect(exam2Stats.totalStudiedMinutes).toBe(55);

    // Troca para Concurso 1: restaura ciclo de 480 min e disciplinas originais, sem misturar horas do Concurso 2
    await repo.setActiveExamId(exam1.id);
    const stateExam1 = repo.loadAll();
    expect(stateExam1.meta.activeExamId).toBe(exam1.id);
    expect(stateExam1.cycleSettings.cycleMinutes).toBe(480);

    const exam1Discs = stateExam1.disciplines.filter((d) => d.examId === exam1.id);
    const exam1DiscIds = new Set(exam1Discs.map((d) => d.id));
    expect(exam1Discs.some((d) => d.id === discTjsp.id)).toBe(false);
    const exam1Stats = calculateGlobalMetrics(
      exam1Discs,
      stateExam1.sessions.filter((s) => exam1DiscIds.has(s.disciplineId)),
      stateExam1.errors.filter((e) => exam1DiscIds.has(e.disciplineId)),
    );
    expect(exam1Stats.totalStudiedMinutes).toBe(0);

    // Backup e restore preservam ambos os concursos e seus ciclos independentes
    const backupJson = JSON.stringify(repo.createBackupPayload());
    const repo2 = await UnifiedRepository.open(new MemoryStorageBackend());
    const restoreRes = await repo2.restoreFromBackup(backupJson, 'replace');
    expect(restoreRes.ok).toBe(true);
    const restored = repo2.loadAll();
    expect(restored.exams.length).toBe(2);
    expect(restored.examCycles[exam1.id].cycleSettings.cycleMinutes).toBe(480);
    expect(restored.examCycles[exam2.id].cycleSettings.cycleMinutes).toBe(300);
  });
});
