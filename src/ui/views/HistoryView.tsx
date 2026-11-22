import React, { useMemo, useState } from 'react';
import { Clock, History as HistoryIcon } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { formatMinutes } from '../../domain/explain';
import { dailyStudySeries, totalStudiedMinutes } from '../../domain/stats';
import { formatDateTimeBR } from '../../domain/text';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';

type HistoryFilter = 'all' | 'sessions';

export const HistoryView: React.FC = () => {
  const { sessions, operationLogs, disciplines } = useApp();
  const [tab, setTab] = useState<HistoryFilter>('all');
  const [discFilter, setDiscFilter] = useState('all');

  const filteredSessions = useMemo(
    () =>
      sessions.filter((s) =>
        discFilter === 'all' ? true : s.disciplineId === discFilter,
      ),
    [sessions, discFilter],
  );

  const series = useMemo(
    () => dailyStudySeries(filteredSessions, 14),
    [filteredSessions],
  );
  const maxDayMin = Math.max(1, ...series.map((s) => s.minutes));
  const totalMin = totalStudiedMinutes(filteredSessions);

  const filteredLogs = useMemo(
    () =>
      operationLogs.filter((l) =>
        discFilter === 'all' ? true : l.disciplineId === discFilter,
      ),
    [operationLogs, discFilter],
  );

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto pt-1">
      <PageHeader
        badge="Histórico Unificado"
        badgeDotClassName="bg-[#A78BFA]"
        title="Linha do Tempo de Estudos e Operações"
        subtitle="Registro contínuo das suas sessões de foco e movimentações no espaço de aprendizagem."
        actions={
          <select
            value={discFilter}
            onChange={(e) => setDiscFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-[#EAE9E4] bg-white/95 shadow-[0_2px_8px_rgba(17,24,39,0.03)] text-[13px] text-[#111827] focus:outline-none focus:border-[#9CA3AF]"
          >
            <option value="all">Todas as disciplinas</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        }
      />

      {/* Série dos últimos 14 dias */}
      <section className="rounded-[26px] surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="font-display text-base font-semibold text-[#111827]">
            Ritmo dos Últimos 14 Dias
          </h3>
          <span className="text-xs text-[#6B7280] tabular-nums">
            Total acumulado: {formatMinutes(totalMin)} ({filteredSessions.length}{' '}
            {filteredSessions.length === 1 ? 'sessão' : 'sessões'})
          </span>
        </div>
        <div className="grid grid-cols-14 gap-1.5 items-end h-28 pt-2">
          {series.map((day) => {
            const heightPct = Math.round((day.minutes / maxDayMin) * 100);
            return (
              <div
                key={day.dateKey}
                className="flex flex-col items-center justify-end h-full gap-1.5 group"
                title={`${day.label}: ${formatMinutes(day.minutes)}`}
              >
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      day.minutes > 0
                        ? 'bg-gradient-to-t from-[#A7F3D0]/35 via-[#6EE7B7]/85 to-[#10B981] group-hover:to-[#059669]'
                        : 'bg-gradient-to-t from-[#F9FAFB]/40 to-[#E5E7EB]/70'
                    }`}
                    style={{
                      height: `${day.minutes > 0 ? Math.max(14, heightPct) : 12}%`,
                    }}
                  />
                </div>
                <span className="text-[9.5px] text-[#9CA3AF] tabular-nums">
                  {day.label.slice(0, 2)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Abas */}
      <SegmentedControl
        ariaLabel="Filtro de histórico"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'all', label: 'Todas as operações' },
          { id: 'sessions', label: `Sessões de estudo (${filteredSessions.length})` },
        ]}
      />

      {tab === 'sessions' ? (
        <section className="rounded-[26px] surface-card divide-y divide-[#F3F4F6]">
          {filteredSessions.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#6B7280]">
              Nenhuma sessão registrada ainda.
            </p>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                className="p-4 md:px-5 flex items-center justify-between gap-4 hover:bg-[#FAFAF9]/80 transition-colors first:rounded-t-[26px] last:rounded-b-[26px]"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Clock className="w-4 h-4 text-[#38BDF8] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#111827] truncate">
                        {s.disciplineName}
                        {s.contentTitle ? ` — ${s.contentTitle}` : ''}
                      </p>
                      <span
                        className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          s.origin === 'trilha'
                            ? 'bg-[#ECFDF5] text-[#047857]'
                            : 'bg-[#EFF6FF] text-[#1D4ED8]'
                        }`}
                      >
                        {s.origin === 'trilha' ? 'Trilha' : 'Ciclo'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {s.origin === 'trilha'
                        ? `Estudo direto pela Trilha · Meta ${s.plannedMinutes} min`
                        : `Ciclo #${s.cycleNumber} · Planejado ${s.plannedMinutes} min`}{' '}
                      ·{' '}
                      {s.status === 'skipped'
                        ? 'Pulado'
                        : `Estudado ${formatMinutes(s.studiedMinutes)}`}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-[#4B5563] mt-1">{s.notes}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[#9CA3AF] shrink-0 tabular-nums">
                  {formatDateTimeBR(s.endedAt)}
                </span>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="rounded-[26px] surface-card divide-y divide-[#F3F4F6]">
          {filteredLogs.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#6B7280]">
              Nenhuma operação registrada.
            </p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 md:px-5 flex items-center justify-between gap-4 hover:bg-[#FAFAF9]/80 transition-colors first:rounded-t-[26px] last:rounded-b-[26px]"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <HistoryIcon className="w-4 h-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[#111827]">{log.summary}</p>
                    <p className="text-[11px] text-[#9CA3AF] uppercase tracking-wider mt-0.5">
                      {log.entityType} · {log.action}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[#9CA3AF] shrink-0 tabular-nums">
                  {formatDateTimeBR(log.timestamp)}
                </span>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
};
