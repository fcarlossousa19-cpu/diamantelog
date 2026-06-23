/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Package, 
  RotateCcw, 
  Clock, 
  DollarSign, 
  Users, 
  Building2, 
  CheckCircle2, 
  ArrowLeftRight,
  Calendar,
  MapPin,
  Filter,
  Award,
  ChevronRight,
  TrendingDown,
  Percent,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { Empresa, Entregador, Expedicao, Rota } from '../types';
import { db, doc, setDoc } from '../lib/supabase';

interface DashboardViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  expedicoes: Expedicao[];
  rotas: Rota[];
  onNavigate: (tab: string, entregadorId?: string) => void;
  campanhaAtiva?: boolean;
}

export default function DashboardView({ empresas, entregadores, expedicoes, rotas, onNavigate, campanhaAtiva = false }: DashboardViewProps) {
  
  // 1. Estados dos Filtros (Visão de Negócios para Donos de Distribuidoras)
  const [filterPeriod, setFilterPeriod] = useState<number>(0); // 0 (Hoje), 7, 15, 30, 9999 (Tudo), -1 (Customizado)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterRotaId, setFilterRotaId] = useState<string>('all');
  const [filterEntregadorId, setFilterEntregadorId] = useState<string>('all');
  const [filterEmpresaId, setFilterEmpresaId] = useState<string>('all');
  const [exibicaoMode, setExibicaoMode] = useState<'absoluto' | 'percentual'>('absoluto');

  const handleToggleCampanha = async () => {
    try {
      await setDoc(doc(db, 'configs', 'campanha'), {
        ativa: !campanhaAtiva
      });
    } catch (err) {
      console.error("Erro ao alterar campanha:", err);
    }
  };
 
  // 2. Filtragem Dinâmica das Expedições com Base nos Filtros Selecionados
  const filteredExpedicoes = useMemo(() => {
    return expedicoes.filter(exp => {
      // Filtrar por período de dias ou datas customizadas
      if (filterPeriod === -1) {
        const expDate = new Date(exp.dataHoraSaida);
        if (startDate) {
          const start = new Date(`${startDate}T00:00:00`);
          if (expDate < start) return false;
        }
        if (endDate) {
          const end = new Date(`${endDate}T23:59:59`);
          if (expDate > end) return false;
        }
      } else if (filterPeriod === 0) {
        const expDate = new Date(exp.dataHoraSaida);
        const today = new Date();
        const isToday = expDate.getDate() === today.getDate() &&
                        expDate.getMonth() === today.getMonth() &&
                        expDate.getFullYear() === today.getFullYear();
        if (!isToday) return false;
      } else if (filterPeriod !== 9999) {
        const diffMs = new Date().getTime() - new Date(exp.dataHoraSaida).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > filterPeriod) return false;
      }

      // Filtrar por Rota
      if (filterRotaId !== 'all') {
        const hasRoute = exp.rotaIds ? exp.rotaIds.includes(filterRotaId) : (exp.rotaId === filterRotaId);
        if (!hasRoute) return false;
      }

      // Filtrar por Entregador
      if (filterEntregadorId !== 'all' && exp.entregadorId !== filterEntregadorId) {
        return false;
      }

      // Filtrar caso algum pacote pertença à Empresa Parceira
      if (filterEmpresaId !== 'all') {
        const hasCompanyPack = exp.itens.some(item => item.empresaId === filterEmpresaId);
        if (!hasCompanyPack) return false;
      }

      return true;
    });
  }, [expedicoes, filterPeriod, startDate, endDate, filterRotaId, filterEntregadorId, filterEmpresaId]);

  // 3. Cálculo das Métricas Gerais baseadas no filtro ativo
  const stats = useMemo(() => {
    const concluidas = filteredExpedicoes.filter(e => e.concluido);
    const emAndamento = filteredExpedicoes.filter(e => !e.concluido);

    let totalPacotesExpedidos = 0;
    let totalEntregues = 0;
    let totalDevolvidos = 0;
    let totalMinutosVolta = 0;
    let totalExpedicoesComTempo = 0;

    filteredExpedicoes.forEach(exp => {
      exp.itens.forEach(item => {
        // Se houver filtro de empresa, computar pacotes exclusivamente desse parceiro
        if (filterEmpresaId !== 'all' && item.empresaId !== filterEmpresaId) return;
        if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) return;

        totalPacotesExpedidos++;
        if (item.status === 'entregue') totalEntregues++;
        if (item.status === 'devolvido') totalDevolvidos++;
      });
      if (exp.concluido && exp.tempoVoltaMinutos) {
        totalMinutosVolta += exp.tempoVoltaMinutos;
        totalExpedicoesComTempo++;
      }
    });

    let lucroDistribuidora = 0;
    let comissoesPagas = 0;
    let receitaBruta = 0;

    empresas.forEach(emp => {
      if (filterEmpresaId !== 'all' && emp.id !== filterEmpresaId) return;

      // Conta a quantidade de pacotes entregues deste embarcador no filtro atual
      let qtdEntregues = 0;
      filteredExpedicoes.forEach(exp => {
        exp.itens.forEach(item => {
          if (item.empresaId === emp.id && item.status === 'entregue') {
            qtdEntregues++;
          }
        });
      });

      if (qtdEntregues > 0) {
        const faturamentoEmpresa = emp.valorPorPacote * qtdEntregues;
        const comissaoEmpresa = emp.comissaoEntregador * qtdEntregues;
        
        receitaBruta += faturamentoEmpresa;
        comissoesPagas += comissaoEmpresa;
        lucroDistribuidora += (faturamentoEmpresa - comissaoEmpresa);
      }
    });

    const taxaEntrega = totalPacotesExpedidos > 0 
      ? ((totalEntregues / (totalEntregues + totalDevolvidos || 1)) * 100) 
      : 0;

    const tempoMedioRota = totalExpedicoesComTempo > 0 
      ? Math.round(totalMinutosVolta / totalExpedicoesComTempo) 
      : 0;

    return {
      expedidos: totalPacotesExpedidos,
      entregues: totalEntregues,
      devolvidos: totalDevolvidos,
      concluidasCount: concluidas.length,
      emAndamentoCount: emAndamento.length,
      lucro: lucroDistribuidora,
      comissoes: comissoesPagas,
      receita: receitaBruta,
      taxaEntrega,
      tempoMedioRota
    };
  }, [filteredExpedicoes, empresas, filterEmpresaId]);

  // 4. Gráfico: Desempenho de Entregadores filtrado
  const entregadoresChartData = useMemo(() => {
    return entregadores.map(ent => {
      let entregues = 0;
      let devolvidos = 0;
      let totalTempo = 0;
      let rotasConcluidas = 0;

      filteredExpedicoes.forEach(exp => {
        if (exp.entregadorId === ent.id) {
          exp.itens.forEach(item => {
            if (filterEmpresaId !== 'all' && item.empresaId !== filterEmpresaId) return;
            if (item.status === 'entregue') entregues++;
            if (item.status === 'devolvido') devolvidos++;
          });
          if (exp.concluido && exp.tempoVoltaMinutos) {
            totalTempo += exp.tempoVoltaMinutos;
            rotasConcluidas++;
          }
        }
      });

      const total = entregues + devolvidos;
      const taxaSucesso = total > 0 ? Math.round((entregues / total) * 100) : 0;
      const tempoMedio = rotasConcluidas > 0 ? Math.round(totalTempo / rotasConcluidas) : 0;

      return {
        id: ent.id,
        name: ent.nome.split(' ')[0] + ' ' + (ent.nome.split(' ')[1] || ''),
        'Entregues': entregues,
        'Devolvidos': devolvidos,
        'Taxa de Sucesso (%)': taxaSucesso,
        'Tempo Médio (Min)': tempoMedio,
        total
      };
    }).filter(ent => ent.total > 0 || filterEntregadorId === 'all' || filterEntregadorId === ent.id)
      .sort((a, b) => b.total - a.total);
  }, [entregadores, filteredExpedicoes, filterEmpresaId, filterEntregadorId]);

  // 5. Gráfico: Resultados por Empresa filtrados
  const empresasChartData = useMemo(() => {
    return empresas.map(emp => {
      let enviados = 0;
      let entregues = 0;
      let devolvidos = 0;
      let faturamento = 0;
      let repasseEntregadores = 0;

      filteredExpedicoes.forEach(exp => {
        exp.itens.forEach(item => {
          if (item.empresaId === emp.id) {
            if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) return;
            enviados++;
            if (item.status === 'entregue') {
              entregues++;
              faturamento += emp.valorPorPacote;
              repasseEntregadores += emp.comissaoEntregador;
            } else if (item.status === 'devolvido') {
              devolvidos++;
            }
          }
        });
      });

      const lucroLiq = faturamento - repasseEntregadores;

      return {
        id: emp.id,
        name: emp.nome,
        'Enviados': enviados,
        'Entregues': entregues,
        'Devolvidos': devolvidos,
        'Devoluções': devolvidos,
        'Faturamento (R$)': parseFloat(faturamento.toFixed(2)),
        'Repasse (R$)': parseFloat(repasseEntregadores.toFixed(2)),
        'Lucro Distribuidora (R$)': parseFloat(lucroLiq.toFixed(2)),
        lucroLiq
      };
    }).filter(emp => emp.Enviados > 0 || filterEmpresaId === 'all' || filterEmpresaId === emp.id)
      .sort((a, b) => b.lucroLiq - a.lucroLiq);
  }, [empresas, filteredExpedicoes, filterEmpresaId]);

  // 6. Gráfico: Principais Motivos de Devolução filtrados
  const devolucoesMotivoData = useMemo(() => {
    const motivosMap: { [key: string]: number } = {};
    filteredExpedicoes.forEach(exp => {
      exp.itens.forEach(item => {
        if (filterEmpresaId !== 'all' && item.empresaId !== filterEmpresaId) return;
        if (item.status === 'devolvido' && item.motivoDevolucao) {
          motivosMap[item.motivoDevolucao] = (motivosMap[item.motivoDevolucao] || 0) + 1;
        }
      });
    });

    const data = Object.keys(motivosMap).map(key => ({
      name: key.length > 25 ? key.substring(0, 25) + '...' : key,
      value: motivosMap[key]
    }));

    return data.sort((a, b) => b.value - a.value);
  }, [filteredExpedicoes, filterEmpresaId]);

  // 7. Relação/Ranking de Rotas mais Lucrativas - Resolução do "POR ROTA QUE DÁ MAIS LUCRO"
  const rotasRankData = useMemo(() => {
    return rotas.map(rot => {
      let totalPacotes = 0;
      let totalEntregues = 0;
      let totalDevolvidos = 0;
      let lucroRota = 0;
      let faturamentoRota = 0;
      let comissaoRota = 0;
      let tempoAcumulado = 0;
      let expedicoesConcluidas = 0;

      // Pegamos as expedições vinculadas a esta rota (filtradas por período, mas não por rota em si)
      const expsDaRota = expedicoes.filter(exp => {
        const belongsToRoute = exp.rotaIds ? exp.rotaIds.includes(rot.id) : (exp.rotaId === rot.id);
        if (!belongsToRoute) return false;
        
        // Aplica os outros filtros ativos na tela
        if (filterPeriod === -1) {
          const expDate = new Date(exp.dataHoraSaida);
          if (startDate) {
            const start = new Date(`${startDate}T00:00:00`);
            if (expDate < start) return false;
          }
          if (endDate) {
            const end = new Date(`${endDate}T23:59:59`);
            if (expDate > end) return false;
          }
        } else if (filterPeriod === 0) {
          const expDate = new Date(exp.dataHoraSaida);
          const today = new Date();
          const isToday = expDate.getDate() === today.getDate() &&
                          expDate.getMonth() === today.getMonth() &&
                          expDate.getFullYear() === today.getFullYear();
          if (!isToday) return false;
        } else if (filterPeriod !== 9999) {
          const diffMs = new Date().getTime() - new Date(exp.dataHoraSaida).getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > filterPeriod) return false;
        }
        if (filterEntregadorId !== 'all' && exp.entregadorId !== filterEntregadorId) return false;
        return true;
      });

      expsDaRota.forEach(exp => {
        exp.itens.forEach(item => {
          if (filterEmpresaId !== 'all' && item.empresaId !== filterEmpresaId) return;

          totalPacotes++;
          if (item.status === 'entregue') {
            totalEntregues++;
            const emp = empresas.find(e => e.id === item.empresaId);
            if (emp) {
              faturamentoRota += emp.valorPorPacote;
              comissaoRota += emp.comissaoEntregador;
              lucroRota += (emp.valorPorPacote - emp.comissaoEntregador);
            }
          } else if (item.status === 'devolvido') {
            totalDevolvidos++;
          }
        });

        if (exp.concluido && exp.tempoVoltaMinutos) {
          tempoAcumulado += exp.tempoVoltaMinutos;
          expedicoesConcluidas++;
        }
      });

      const taxaSucesso = totalPacotes > 0 ? (totalEntregues / (totalEntregues + totalDevolvidos || 1)) * 100 : 0;
      const tempoMedio = expedicoesConcluidas > 0 ? Math.round(tempoAcumulado / expedicoesConcluidas) : 0;

      return {
        id: rot.id,
        nome: rot.nome,
        descricao: rot.descricao,
        totalPacotes,
        totalEntregues,
        totalDevolvidos,
        taxaSucesso,
        tempoMedio,
        lucro: lucroRota,
        faturamento: faturamentoRota,
        comissao: comissaoRota
      };
    }).sort((a, b) => b.lucro - a.lucro); // Ordenar por Lucro decrescente
  }, [rotas, expedicoes, empresas, filterPeriod, startDate, endDate, filterEntregadorId, filterEmpresaId]);

  // Função para limpar todos os filtros simultaneamente
  const handleClearFilters = () => {
    setFilterPeriod(0);
    setFilterRotaId('all');
    setFilterEntregadorId('all');
    setFilterEmpresaId('all');
    setStartDate('');
    setEndDate('');
  };

  const isFilterActive = filterPeriod !== 0 || filterRotaId !== 'all' || filterEntregadorId !== 'all' || filterEmpresaId !== 'all' || startDate !== '' || endDate !== '';

  const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280'];

  return (
    <div className="space-y-8" id="view-dashboard">
      {/* Painel de Filtros e BI Corporativo */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4" id="dashboard-filters-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-50 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans uppercase tracking-wider">
              <Filter className="h-4 w-4 text-blue-500" />
              Central de Filtros de BI & Planejamento
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-semibold">Defina os parâmetros para ajustar a análise de desempenho do seu hub de distribuição</p>
          </div>
          {isFilterActive && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1 shrink-0 self-end md:self-center cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro 1: Período */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Intervalo de Tempo
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value={0}>Hoje (Atual)</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={15}>Últimos 15 dias</option>
              <option value={30}>Últimos 30 dias (Mensal)</option>
              <option value={9999}>Todo o histórico (Geral)</option>
              <option value={-1}>Intervalo Personalizado</option>
            </select>
          </div>

          {/* Filtro 2: Rota de Distribuição */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              Filtrar por Rota
            </label>
            <select
              value={filterRotaId}
              onChange={(e) => setFilterRotaId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todas as Rotas</option>
              {rotas.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro 3: Entregador Responsável */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Filtrar por Entregador
            </label>
            <select
              value={filterEntregadorId}
              onChange={(e) => setFilterEntregadorId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos os Entregadores</option>
              {entregadores.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro 4: Empresa Contratante (Origem) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Filtrar por Embarcador
            </label>
            <select
              value={filterEmpresaId}
              onChange={(e) => setFilterEmpresaId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos os Embarcadores</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {filterPeriod === -1 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3.5 border-t border-slate-100"
            id="custom-date-filters"
          >
            {/* Data de Início */}
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Data de Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Data de Fim */}
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Data de Fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </motion.div>
        )}

        {/* Barra de resumo dos filtros selecionados */}
        <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
            <span className="text-slate-500 font-semibold">Remessas consolidadas no filtro: <strong>{filteredExpedicoes.length} lotes</strong></span>
            <span className="text-slate-300 font-normal">|</span>
            <span className="text-slate-500 font-semibold">Total de Volumes expedidos no filtro: <strong>{stats.expedidos} pacotes</strong></span>
          </div>

          {isFilterActive && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Filtros Ativados</span>
              {filterPeriod !== 0 && filterPeriod !== -1 && <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg border border-slate-200">Período: {filterPeriod === 9999 ? 'Tudo' : `${filterPeriod}d`}</span>}
              {filterPeriod === 0 && <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg border border-blue-200">Período: Hoje</span>}
              {filterPeriod === -1 && <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg border border-blue-200">Período: {startDate || '(Indefinido)'} até {endDate || '(Hoje)'}</span>}
              {filterRotaId !== 'all' && <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg border border-slate-200">Rota activa</span>}
              {filterEntregadorId !== 'all' && <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg border border-slate-200">Entregador ativo</span>}
              {filterEmpresaId !== 'all' && <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg border border-slate-200">Embarcador ativo</span>}
            </div>
          )}
        </div>
      </div>

      {/* Resumos em Cards com Animação - Layout Responsivo e Compacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full min-w-0" id="dashboard-main-stats">
        
        {/* Card 1: Saídas da Filial (Expedições) */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white p-4 sm:p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 sm:gap-4 min-w-0"
          id="stat-expedidos"
        >
          <div className="p-3 sm:p-4 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Package className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Saídas para Entregas</p>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight block mt-0.5">{filteredExpedicoes.length}</h3>
            <span className="text-[10px] sm:text-xs text-blue-650 font-medium block mt-0.5 truncate">{stats.emAndamentoCount} na rua / {stats.concluidasCount} finalizadas</span>
          </div>
        </motion.div>

        {/* Card 2: Lucro Líquido Distribuidora */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white p-4 sm:p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 sm:gap-4 min-w-0"
          id="stat-salario-comissao"
        >
          <div className="p-3 sm:p-4 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <DollarSign className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Lucro da Distribuidora</p>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight block mt-0.5">
              R$ {stats.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] sm:text-xs text-emerald-650 font-medium block mt-0.5 truncate">Faturamento: R$ {stats.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </motion.div>

        {/* Card 3: Taxa de Sucesso de Entrega */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white p-4 sm:p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 sm:gap-4 min-w-0"
          id="stat-taxa-entrega"
        >
          <div className="p-3 sm:p-4 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <TrendingUp className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Taxa de Conclusão</p>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight block mt-0.5">
              {stats.taxaEntrega.toFixed(1)}%
            </h3>
            <span className="text-[10px] sm:text-xs text-indigo-650 font-medium block mt-0.5 truncate">
              {stats.entregues} entregues / {stats.devolvidos} devoluções
            </span>
          </div>
        </motion.div>

        {/* Card 4: Tempo Médio de Volta */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white p-4 sm:p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 sm:gap-4 min-w-0"
          id="stat-tempo-medio"
        >
          <div className="p-3 sm:p-4 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Clock className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Tempo Médio de Volta</p>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight block mt-0.5">
              {stats.tempoMedioRota > 0 ? `${stats.tempoMedioRota} min` : "N/A"}
            </h3>
            <span className="text-[10px] sm:text-xs text-amber-650 font-medium block mt-0.5 truncate">Ciclo completo de expedição</span>
          </div>
        </motion.div>
      </div>

      {/* Operação em Tempo Real - Rotas Atuais Recorrentes */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-500" />
            Operação na Rua no Momento
          </h3>
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full animate-pulse">
            {stats.emAndamentoCount} Rota(s) ativa(s)
          </span>
        </div>

        {expedicoes.filter(e => !e.concluido).length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p>Nenhum entregador está na rua com carga no momento.</p>
            <button 
              onClick={() => onNavigate('expedicao')} 
              className="mt-3 text-sm text-blue-600 font-semibold hover:underline"
              id="btn-goto-expedicao"
            >
              Iniciar Nova Expedição →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expedicoes.filter(e => !e.concluido).map(exp => {
              const deliverer = entregadores.find(ent => ent.id === exp.entregadorId);
              const totalPacotes = exp.itens.length;
              const tempoDecorridoMin = Math.round((new Date().getTime() - new Date(exp.dataHoraSaida).getTime()) / (1000 * 60));
              
              return (
                <div key={exp.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-3 shadow-inner">
                  <div className="flex items-center space-x-3">
                    {deliverer?.foto ? (
                      <img 
                        src={deliverer.foto} 
                        alt={deliverer.nome} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-500 text-white flex items-center justify-center font-bold rounded-full border-2 border-white text-sm">
                        {deliverer?.nome.substring(0,2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-slate-700 text-sm">{deliverer?.nome}</h4>
                      <p className="text-xs text-slate-500">Saiu há {tempoDecorridoMin} min</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="text-center">
                      <span className="block text-xs text-slate-400 font-medium">Pacotes</span>
                      <span className="text-sm font-bold text-slate-700">{totalPacotes}</span>
                    </div>
                    <div className="text-center border-l border-slate-100 pl-4">
                      <span className="block text-xs text-slate-400 font-medium">Empresas</span>
                      <div className="flex gap-1 mt-0.5">
                        {exp.empresaIds.map(eid => {
                          const emp = empresas.find(e => e.id === eid);
                          return (
                            <span key={eid} className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded">
                              {emp?.nome.split(' ')[0]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('baixas', exp.entregadorId)}
                    className="w-full text-center py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                    id={`btn-dar-baixa-${exp.id}`}
                  >
                    Dar Baixa / Finalizar Rota
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ranking de Lucratividade por Rota (Atende o "POR ROTA QUE DÁ MAIS LUCRO") */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100" id="view-ranking-rotas">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-5 gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-heading">
              <Award className="h-5 w-5 text-amber-500 animate-bounce" />
              Ranking de Rentabilidade por Rota (BI Distribuidora)
            </h3>
            <p className="text-xs text-slate-550 mt-0.5">
              Rotas ordenadas pela rentabilidade líquida gerada para a distribuidora (Faturamento de Entrega menos Comissões Repassadas)
            </p>
          </div>
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 self-start sm:self-center">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Supervisão Financeira Ativa
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse" id="table-rotas-lucro">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center w-16">Posição</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rota / Itinerário</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Volumes</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Eficiência (%)</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Faturamento</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Repasse Entr.</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Lucro Líquido</th>
              </tr>
            </thead>
            <tbody>
              {rotasRankData.map((item, index) => {
                const isTop1 = index === 0;
                const isZero = item.lucro === 0;

                return (
                  <tr 
                    key={item.id} 
                    className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${isTop1 && !isZero ? 'bg-amber-500/[0.03]' : ''}`}
                  >
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                        index === 0 && !isZero
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 shadow-sm' 
                          : index === 1 && !isZero
                            ? 'bg-slate-200 text-slate-800' 
                            : index === 2 && !isZero
                              ? 'bg-amber-700/10 text-amber-900' 
                              : 'bg-slate-100 text-slate-600'
                      }`}>
                        {index + 1}º
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium">
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                        {item.nome}
                        {isTop1 && !isZero && (
                          <span className="text-[8px] bg-amber-500 text-white font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 uppercase tracking-wide">
                            <Sparkles className="h-2 w-2 shrink-0 fill-current" />
                            Mais Lucrativa
                          </span>
                        )}
                        {isZero && (
                          <span className="text-[8px] bg-slate-150 text-slate-500 font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide border border-slate-200">
                            Sem Movimento
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5 max-w-sm sm:max-w-md truncate">
                        {item.descricao}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-slate-600 font-semibold">
                      <div>{item.totalPacotes} pacotes</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        ({item.totalEntregues} ent / {item.totalDevolvidos} dev)
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="inline-block">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-xs font-bold ${
                            item.taxaSucesso >= 90 
                              ? 'text-emerald-600' 
                              : item.taxaSucesso >= 75 
                                ? 'text-blue-600' 
                                : item.taxaSucesso > 0 
                                  ? 'text-amber-600' 
                                  : 'text-slate-400'
                          }`}>
                            {item.totalPacotes > 0 ? `${item.taxaSucesso.toFixed(0)}%` : '0%'}
                          </span>
                        </div>
                        {item.totalPacotes > 0 && (
                          <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden mt-1 mx-auto">
                            <div 
                              className={`h-full rounded-full ${
                                item.taxaSucesso >= 90 
                                  ? 'bg-emerald-500' 
                                  : item.taxaSucesso >= 75 
                                    ? 'bg-blue-500' 
                                    : 'bg-amber-500'
                              }`}
                              style={{ width: `${item.taxaSucesso}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-700 text-xs font-mono">
                      R$ {item.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs font-mono">
                      R$ {item.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      <span className={`inline-block px-2.5 py-1 text-xs font-extrabold rounded-lg ${
                        isZero 
                          ? 'bg-slate-50 text-slate-400 border border-slate-100' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm font-black'
                      }`}>
                        R$ {item.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos em Grade de 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full min-w-0">
        
        {/* Gráfico 1: Performance dos Entregadores */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-w-0" id="chart-entregadores">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Desempenho dos Entregadores
              </h3>
              <p className="text-xs text-slate-400">Total de pacotes entregues com sucesso e devoluções por entregador</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle de Exibição (Absoluto ou % de Sucesso/Desempenho) */}
              <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  onClick={() => setExibicaoMode('absoluto')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    exibicaoMode === 'absoluto'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Absoluto
                </button>
                <button
                  type="button"
                  onClick={() => setExibicaoMode('percentual')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    exibicaoMode === 'percentual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Percentual (%)
                </button>
              </div>

              {/* Botão de Campanha (Ativar Campanha) */}
              <button
                type="button"
                onClick={handleToggleCampanha}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                  campanhaAtiva
                    ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 font-bold shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{campanhaAtiva ? 'Campanha Ativa' : 'Ativar Campanha'}</span>
              </button>
            </div>
          </div>
          <div className="h-80 w-full min-w-0 relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={entregadoresChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                   contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }}
                   itemStyle={{ fontSize: "12px" }}
                />
                <Legend iconType="circle" fontSize={11} />
                {exibicaoMode === 'percentual' ? (
                  <Bar 
                    dataKey="Taxa de Sucesso (%)" 
                    name="Desempenho (%)" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                    barSize={24}
                    label={{ 
                      position: 'top', 
                      formatter: (val: any) => `${val}%`, 
                      fill: '#4954e6', 
                      fontSize: 10, 
                      fontWeight: 'bold' 
                    }} 
                  />
                ) : (
                  <>
                    <Bar dataKey="Entregues" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="Devolvidos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Resultados e Margem de Lucro Bruto por Empresa */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-w-0" id="chart-empresas">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-500" />
              Margem de Lucros por Empresa
            </h3>
            <p className="text-xs text-slate-400">Lucro gerado para a distribuidora por empresa parceira (deduzido repasse)</p>
          </div>
          <div className="h-80 w-full min-w-0 relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={empresasChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  formatter={(value) => [`R$ ${value}`, '']}
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="Lucro Distribuidora (R$)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Motivos de Devoluções */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-w-0" id="chart-devolucoes">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-rose-500" />
              Motivos Comuns de Devolução
            </h3>
            <p className="text-xs text-slate-400">Frequência absoluta dos motivos mapeados nas devoluções</p>
          </div>
          {devolucoesMotivoData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-slate-400">
              Não há dados de devolução registrados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 w-full min-w-0">
              <div className="h-64 w-full min-w-0 relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={devolucoesMotivoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {devolucoesMotivoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 min-w-0 flex-1">
                {devolucoesMotivoData.map((item, idx) => (
                  <div key={idx} className="flex items-start space-x-2 min-w-0">
                    <span 
                      className="w-3.5 h-3.5 rounded mt-0.5 shrink-0" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <div className="text-xs min-w-0 flex-1">
                      <span className="font-semibold text-slate-700 block truncate">{item.value} ocorrências</span>
                      <p className="text-slate-400 leading-tight truncate">{item.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Gráfico 4: Histórico de eficiência e entregas absolutas / devoluções */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" id="chart-devolucoes-por-empresa">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              Taxa de Devolução por Empresa (%)
            </h3>
            <p className="text-xs text-slate-400">Porcentagem de itens devolvidos em relação ao total expedido de cada parceiro</p>
          </div>
          <div className="h-85 flex flex-col justify-end space-y-4">
            {empresasChartData.map((emp, index) => {
              const taxaDev = emp.Enviados > 0 
                ? Math.round((emp.Devolvidos / emp.Enviados) * 100) 
                : 0;
              return (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700">{emp.name}</span>
                    <span className="font-semibold text-slate-500">{emp.Devolvidos} devolvidos de {emp.Enviados} enviados ({taxaDev}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(taxaDev, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="text-xs text-slate-400 pt-3 border-t border-slate-100">
              * Uma menor taxa de devolução otimiza o uso de combustível e o pagamento das comissões dos entregadores.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
