/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  Download, 
  TrendingUp, 
  Users, 
  Building, 
  AlertTriangle, 
  Calculator, 
  MapPin, 
  ChevronRight, 
  Percent,
  Search,
  CheckCircle,
  Clock,
  X,
  Calendar,
  Layers,
  ArrowRight,
  UserCheck,
  PackageOpen,
  Eye,
  RotateCcw,
  FileText,
  Lock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Empresa, Entregador, Expedicao, Pacote, User as SystemUser, Filial } from '../types';

interface RelatoriosViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  expedicoes: Expedicao[];
  currentUser: SystemUser;
  filiais: Filial[];
}

export default function RelatoriosView({ empresas, entregadores, expedicoes, currentUser, filiais }: RelatoriosViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'operacional' | 'financeiro' | 'problemas'>('operacional');
  const [successExport, setSuccessExport] = useState('');
  
  // Branch permissions and selection states
  const userPermittedFiliais = useMemo(() => {
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      return filiais;
    }
    const permittedIds = currentUser.filiais || [];
    return filiais.filter(f => permittedIds.includes(f.id));
  }, [filiais, currentUser]);

  const [selectedFilialId, setSelectedFilialId] = useState<string>(() => {
    if (currentUser.defaultFilialId) {
      return currentUser.defaultFilialId;
    }
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      return 'all';
    }
    const permittedIds = currentUser.filiais || [];
    return permittedIds.length > 0 ? permittedIds[0] : 'all';
  });

  const permittedFilialIds = useMemo(() => {
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      return null; // Master can see all by default
    }
    return currentUser.filiais || [];
  }, [currentUser]);

  // Date and driver filtering states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [activePreset, setActivePreset] = useState<string>('');

  // Sincronizar motorista selecionado se mudar a filial para garantir compatibilidade
  React.useEffect(() => {
    if (selectedDriverId !== 'all') {
      const driverObj = entregadores.find(d => d.id === selectedDriverId);
      if (driverObj) {
        const isCompatibleWithFilial = selectedFilialId === 'all' 
          ? (!permittedFilialIds || (driverObj.filialId && permittedFilialIds.includes(driverObj.filialId)))
          : (driverObj.filialId === selectedFilialId);
        if (!isCompatibleWithFilial) {
          setSelectedDriverId('all');
        }
      } else {
        setSelectedDriverId('all');
      }
    }
  }, [selectedFilialId, selectedDriverId]);

  // Helper date formatting function
  const formatDateToYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSetHoje = () => {
    const today = new Date();
    const formatted = formatDateToYYYYMMDD(today);
    setStartDate(formatted);
    setEndDate(formatted);
    setActivePreset('hoje');
  };

  const handleSetSemanaAtual = () => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 1 is Monday ...
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    const sunday = new Date(today.getFullYear(), today.getMonth(), diff + 6);
    setStartDate(formatDateToYYYYMMDD(monday));
    setEndDate(formatDateToYYYYMMDD(sunday));
    setActivePreset('semana');
  };

  const handleSetQuinzena = () => {
    const today = new Date();
    const fifteenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
    setStartDate(formatDateToYYYYMMDD(fifteenDaysAgo));
    setEndDate(formatDateToYYYYMMDD(today));
    setActivePreset('quinzena');
  };

  const handleSetMesAtual = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setStartDate(formatDateToYYYYMMDD(firstDay));
    setEndDate(formatDateToYYYYMMDD(lastDay));
    setActivePreset('mesAtual');
  };

  const handleSetAnoAtual = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), 0, 1);
    const lastDay = new Date(today.getFullYear(), 11, 31);
    setStartDate(formatDateToYYYYMMDD(firstDay));
    setEndDate(formatDateToYYYYMMDD(lastDay));
    setActivePreset('anoAtual');
  };

  const handleSetMesAnterior = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    setStartDate(formatDateToYYYYMMDD(firstDay));
    setEndDate(formatDateToYYYYMMDD(lastDay));
    setActivePreset('mesAnterior');
  };

  // Modal Detail state
  const [detailsDriver, setDetailsDriver] = useState<any | null>(null);
  const [detailsFilterStatus, setDetailsFilterStatus] = useState<'todos' | 'entregue' | 'devolvido'>('todos');

  // Relatório de Itens Devolvidos states and memos
  const [searchReturnedItem, setSearchReturnedItem] = useState('');
  const [selectedReturnedReasonFilter, setSelectedReturnedReasonFilter] = useState('all');
  const [returnedStartDate, setReturnedStartDate] = useState<string>(() => {
    return formatDateToYYYYMMDD(new Date());
  });
  const [returnedEndDate, setReturnedEndDate] = useState<string>(() => {
    return formatDateToYYYYMMDD(new Date());
  });

  const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280'];

  // Helper mapping
  const companyMap = useMemo(() => {
    const map: { [key: string]: Empresa } = {};
    empresas.forEach(emp => {
      map[emp.id] = emp;
    });
    return map;
  }, [empresas]);

  // Filter expeditions based on startup period
  const filteredExpedicoes = useMemo(() => {
    return expedicoes.filter(exp => {
      if (startDate) {
        const saDateRaw = exp.dataHoraSaida ? exp.dataHoraSaida.split('T')[0] : '';
        if (!saDateRaw || saDateRaw < startDate) return false;
      }
      if (endDate) {
        const saDateRaw = exp.dataHoraSaida ? exp.dataHoraSaida.split('T')[0] : '';
        if (!saDateRaw || saDateRaw > endDate) return false;
      }
      
      // Filial check
      if (selectedFilialId !== 'all') {
        if (exp.filialId) {
          if (exp.filialId !== selectedFilialId) return false;
        } else {
          const driver = entregadores.find(d => d.id === exp.entregadorId);
          if (driver && driver.filialId !== selectedFilialId) return false;
        }
      } else {
        if (permittedFilialIds) {
          const targetFilialId = exp.filialId || entregadores.find(d => d.id === exp.entregadorId)?.filialId;
          if (targetFilialId && !permittedFilialIds.includes(targetFilialId)) return false;
        }
      }
      
      return true;
    });
  }, [expedicoes, startDate, endDate, selectedFilialId, permittedFilialIds, entregadores]);

  const returnedItemsList = useMemo(() => {
    const list: any[] = [];
    expedicoes.forEach(exp => {
      // Filial check
      if (selectedFilialId !== 'all') {
        if (exp.filialId) {
          if (exp.filialId !== selectedFilialId) return;
        } else {
          const driver = entregadores.find(d => d.id === exp.entregadorId);
          if (driver && driver.filialId !== selectedFilialId) return;
        }
      } else {
        if (permittedFilialIds) {
          const targetFilialId = exp.filialId || entregadores.find(d => d.id === exp.entregadorId)?.filialId;
          if (targetFilialId && !permittedFilialIds.includes(targetFilialId)) return;
        }
      }

      const dateToCheck = exp.dataHoraRetorno || exp.dataHoraSaida;
      const expDateRaw = dateToCheck ? dateToCheck.split('T')[0] : '';
      if (!expDateRaw) return;
      
      if (returnedStartDate && expDateRaw < returnedStartDate) return;
      if (returnedEndDate && expDateRaw > returnedEndDate) return;

      const driverObj = entregadores.find(d => d.id === exp.entregadorId);
      exp.itens.forEach(item => {
        if (item.status === 'devolvido') {
          list.push({
            id: `${exp.id}-${item.codigoBarras}`,
            codigoBarras: item.codigoBarras,
            entregadorId: exp.entregadorId,
            entregadorNome: driverObj ? driverObj.nome : 'Desconhecido',
            empresaNome: companyMap[item.empresaId]?.nome || 'Empresa Cliente',
            motivoDevolucao: item.motivoDevolucao || 'Não especificado',
            observacaoDevolucao: item.observacaoDevolucao || '',
            dataDeRetorno: dateToCheck
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.dataDeRetorno).getTime() - new Date(a.dataDeRetorno).getTime());
  }, [expedicoes, returnedStartDate, returnedEndDate, entregadores, companyMap, selectedFilialId, permittedFilialIds]);

  const filteredReturnedItems = useMemo(() => {
    return returnedItemsList.filter(item => {
      const matchesSearch = item.codigoBarras.toLowerCase().includes(searchReturnedItem.toLowerCase()) || 
                            item.entregadorNome.toLowerCase().includes(searchReturnedItem.toLowerCase()) ||
                            item.empresaNome.toLowerCase().includes(searchReturnedItem.toLowerCase()) ||
                            item.observacaoDevolucao.toLowerCase().includes(searchReturnedItem.toLowerCase());
                            
      const matchesMotive = selectedReturnedReasonFilter === 'all' || item.motivoDevolucao === selectedReturnedReasonFilter;
      
      return matchesSearch && matchesMotive;
    });
  }, [returnedItemsList, searchReturnedItem, selectedReturnedReasonFilter]);

  const uniqueMotiveOptions = useMemo(() => {
    const motives = new Set<string>();
    returnedItemsList.forEach(item => {
      if (item.motivoDevolucao) motives.add(item.motivoDevolucao);
    });
    return Array.from(motives);
  }, [returnedItemsList]);

  const handleExportReturnedItemsCSV = () => {
    const headers = 'Código de Barras;Entregador;Empresa Parceira;Motivo da Devolução;Observação;Data de Devolução\n';
    const rows = filteredReturnedItems.map(item => 
      `"${item.codigoBarras}";"${item.entregadorNome}";"${item.empresaNome}";"${item.motivoDevolucao}";"${item.observacaoDevolucao.replace(/"/g, '""') || ''}";"${new Date(item.dataDeRetorno).toLocaleString('pt-BR')}"`
    );

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_de_itens_devolvidos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!detailsDriver) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let pageNum = 1;
    
    // Draw Header Banner
    doc.setFillColor(30, 41, 59); // deep slate slate-800
    doc.rect(0, 0, pageWidth, 42, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('DIAMANTE LOG', margin, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240); // slate-200
    doc.text('Sistema de Distribuição & BI', margin, 26);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin - 60, 26, { align: 'right' });
    
    // Date range indicator on header if present
    const periodStr = startDate || endDate
      ? `Período da Consulta: ${startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'} até ${endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Hoje'}`
      : 'Período da Consulta: Histórico Completo';
    doc.text(periodStr, margin, 34);
    
    let y = 54;
    
    // 1. Driver info card
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(margin, y, pageWidth - 2 * margin, 28, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(margin, y, pageWidth - 2 * margin, 28, 'D');
    
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(detailsDriver.nomeCompleto.toUpperCase(), margin + 6, y + 9);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Contato: ${detailsDriver.contato || 'N/A'}  |  Vínculo: Auxiliar Ativo`, margin + 6, y + 16);
    doc.text(`Taxa Operacional de Entregas Realizadas: ${detailsDriver.taxaSucesso}%`, margin + 6, y + 23);
    
    // Performance indicator badge
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(pageWidth - margin - 45, y + 5, 40, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RENDIMENTO', pageWidth - margin - 25, y + 11, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${detailsDriver.taxaSucesso}%`, pageWidth - margin - 25, y + 19, { align: 'center' });
    
    y += 38;
    
    // 2. Metrics Block
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('MÉTRICAS OPERACIONAIS NO PERÍODO', margin, y);
    y += 6;
    
    // Grid boxes
    const boxWidth = (pageWidth - 2 * margin - 9) / 4;
    const statsData = [
      { label: 'VOLUME CARREGADO', val: `${detailsDriver.itensVinculados ? detailsDriver.itensVinculados.length : 0} pacotes`, bg: [241, 245, 249], text: [15, 23, 42] },
      { label: 'CONCLUÍDO COM SUCESSO', val: `${detailsDriver.entregues ?? 0} pacotes`, bg: [240, 253, 244], text: [21, 128, 61] },
      { label: 'DEVOLUÇÕES / MOTIVOS', val: `${detailsDriver.devolvidos ?? 0} pacotes`, bg: [254, 242, 242], text: [185, 28, 28] },
      { label: 'T. MÉDIO DE TRAJETO', val: getAverageTimeFormatted(detailsDriver.tempoMedioVolta), bg: [239, 246, 255], text: [29, 78, 216] }
    ];
    
    statsData.forEach((stat, idx) => {
      const bx = margin + idx * (boxWidth + 3);
      doc.setFillColor(stat.bg[0], stat.bg[1], stat.bg[2]);
      doc.rect(bx, y, boxWidth, 22, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(bx, y, boxWidth, 22, 'D');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(stat.label, bx + boxWidth / 2, y + 6, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(stat.text[0], stat.text[1], stat.text[2]);
      doc.text(stat.val, bx + boxWidth / 2, y + 15, { align: 'center' });
    });
    
    y += 34;
    
    // 3. Table title and active filter subtext
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const filterText = detailsFilterStatus === 'todos' ? 'TODOS OS PACOTES' : 
                       detailsFilterStatus === 'entregue' ? 'ENTREGUES APENAS' : 'DEVOLVIDOS APENAS';
    doc.text(`LISTA ANALÍTICA DE ENCOMENDAS (${filterText})`, margin, y);
    y += 6;
    
    // Table Header
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(margin, y, pageWidth - margin, y);
    doc.line(margin, y + 8, pageWidth - margin, y + 8);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // slate-600
    
    doc.text('CÓDIGO DE BARRAS', margin + 2, y + 5.5);
    doc.text('PARCEIRO', margin + 40, y + 5.5);
    doc.text('SAÍDA DO HUB', margin + 75, y + 5.5);
    doc.text('RETORNO / ACERTO', margin + 110, y + 5.5);
    doc.text('SITUAÇÃO DO PACOTE', margin + 142, y + 5.5);
    
    y += 8;
    
    // Table rows
    const items = (detailsDriver.itensVinculados || []).filter(
      (it: any) => detailsFilterStatus === 'todos' || it.status === detailsFilterStatus
    );
    
    doc.setFont('helvetica', 'normal');
    
    if (items.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Nenhum pacote localizado para o status selecionado neste filtro.', margin + 4, y + 8);
      y += 12;
    } else {
      items.forEach((item: any, idx: number) => {
        // Check for page overflow
        if (y > 275) {
          // Draw page footer before adding new page
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text('Página ' + pageNum, pageWidth / 2, pageHeight - 10, { align: 'center' });
          
          doc.addPage();
          pageNum++;
          y = 20;
          
          // Redraw table header on new page
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.line(margin, y, pageWidth - margin, y);
          doc.line(margin, y + 8, pageWidth - margin, y + 8);
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text('CÓDIGO DE BARRAS', margin + 2, y + 5.5);
          doc.text('PARCEIRO', margin + 40, y + 5.5);
          doc.text('SAÍDA DO HUB', margin + 75, y + 5.5);
          doc.text('RETORNO / ACERTO', margin + 110, y + 5.5);
          doc.text('SITUAÇÃO DO PACOTE', margin + 142, y + 5.5);
          
          y += 8;
          doc.setFont('helvetica', 'normal');
        }
        
        // Zebra effect background stripe
        if (idx % 2 === 1) {
          doc.setFillColor(250, 251, 252);
          doc.rect(margin, y, pageWidth - 2 * margin, 6.5, 'F');
        }
        
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42); // slate-900
        
        // Barcode
        doc.setFont('courier', 'bold');
        doc.text(String(item.codigoBarras || ''), margin + 2, y + 4.5);
        doc.setFont('helvetica', 'normal');
        
        // Partner
        doc.text(String(item.empresaNome || 'N/A'), margin + 40, y + 4.5);
        
        // Saída
        const saidaStr = item.dataHoraSaida 
          ? new Date(item.dataHoraSaida).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})
          : '-';
        doc.text(saidaStr, margin + 75, y + 4.5);
        
        // Retorno
        const retornoStr = item.dataHoraRetorno
          ? new Date(item.dataHoraRetorno).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})
          : '-';
        doc.text(retornoStr, margin + 110, y + 4.5);
        
        // Status
        if (item.status === 'entregue') {
          doc.setTextColor(21, 128, 61); // green-700
          doc.setFont('helvetica', 'bold');
          doc.text('ENTREGUE', margin + 142, y + 4.5);
        } else {
          doc.setTextColor(185, 28, 28); // red-700
          doc.setFont('helvetica', 'bold');
          const reason = item.motivoDevolucao ? ` - ${item.motivoDevolucao}` : '';
          doc.text(`DEV${reason}`.substring(0, 38), margin + 142, y + 4.5);
        }
        
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + 6.5, pageWidth - margin, y + 6.5);
        
        y += 6.5;
      });
    }
    
    // Draw Footer on the final page
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento Corporativo de Rastreabilidade DIAMANTE LOG', margin, pageHeight - 15);
    doc.text('Página ' + pageNum, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    doc.save(`detalhes_performance_${detailsDriver.nome.toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // 1. Relatório Financeiro de Margens com Parceiros (scoped with active Date filters!)
  const financialMargins = useMemo(() => {
    return empresas.map((emp, idx) => {
      let pacotesEnviados = 0;
      let pacotesEntregues = 0;
      let faturamentoDistribuidora = 0;
      let comissaoPagaEntregadores = 0;

      filteredExpedicoes.forEach(exp => {
        exp.itens.forEach(item => {
          if (item.empresaId === emp.id) {
            if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) return;
            pacotesEnviados++;
            if (item.status === 'entregue') {
              pacotesEntregues++;
              faturamentoDistribuidora += emp.valorPorPacote;
              comissaoPagaEntregadores += emp.comissaoEntregador;
            }
          }
        });
      });

      const lucroBruto = faturamentoDistribuidora - comissaoPagaEntregadores;
      const margemRetidaPercent = faturamentoDistribuidora > 0 
        ? Math.round((lucroBruto / faturamentoDistribuidora) * 100) 
        : 0;

      return {
        id: emp.id,
        nome: emp.nome,
        enviados: pacotesEnviados,
        entregues: pacotesEntregues,
        taxaEntrega: pacotesEnviados > 0 ? Math.round((pacotesEntregues / pacotesEnviados) * 100) : 0,
        faturamento: faturamentoDistribuidora,
        repasses: comissaoPagaEntregadores,
        lucro: lucroBruto,
        margem: margemRetidaPercent,
        cor: COLORS[idx % COLORS.length]
      };
    }).sort((a, b) => b.lucro - a.lucro);
  }, [empresas, filteredExpedicoes]);

  // Helper formatting for Hours and Minutes from start state to end state
  const getElapsedFormatted = (startStr: string, endStr?: string) => {
    if (!endStr) return "N/A";
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    if (isNaN(diffMs) || diffMs <= 0) return "0 minutos";
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  // 2. Ranking de Performance e Velocidade dos Entregadores
  const driverPerformances = useMemo(() => {
    return entregadores.map((ent) => {
      let totalRotas = 0;
      let totalMinutos = 0;
      let totalItens = 0;
      let totalEntregues = 0;
      let totalDevolvidos = 0;
      const itensVinculados: any[] = [];

      filteredExpedicoes.forEach(exp => {
        if (exp.entregadorId === ent.id) {
          const nonWithdrawnItens = exp.itens.filter(i => !['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(i.status));
          totalItens += nonWithdrawnItens.length;
          exp.itens.forEach(item => {
            if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) return;
            if (item.status === 'entregue') totalEntregues++;
            if (item.status === 'devolvido') totalDevolvidos++;
            
            // push item details for the details screen
            itensVinculados.push({
              codigoBarras: item.codigoBarras,
              status: item.status,
              empresaId: item.empresaId,
              empresaNome: companyMap[item.empresaId]?.nome || 'Empresa Cliente',
              motivoDevolucao: item.motivoDevolucao,
              observacaoDevolucao: item.observacaoDevolucao,
              dataHoraSaida: exp.dataHoraSaida,
              dataHoraRetorno: exp.dataHoraRetorno,
              duracaoFormatada: getElapsedFormatted(exp.dataHoraSaida, exp.dataHoraRetorno)
            });
          });

          if (exp.concluido && exp.dataHoraSaida && exp.dataHoraRetorno) {
            const start = new Date(exp.dataHoraSaida);
            const end = new Date(exp.dataHoraRetorno);
            const diffMs = end.getTime() - start.getTime();
            if (!isNaN(diffMs) && diffMs > 0) {
              totalRotas++;
              totalMinutos += Math.floor(diffMs / (1000 * 60));
            }
          }
        }
      });

      const totalAValiar = totalEntregues + totalDevolvidos;
      const taxaSucesso = totalAValiar > 0 
        ? Math.round((totalEntregues / totalAValiar) * 100) 
        : 0;

      const tempoMedio = totalRotas > 0 ? Math.round(totalMinutos / totalRotas) : 0;

      // Extract Name and Surname / Sobrenome specifically as requested
      const trimmedName = ent.nome.trim();
      const firstSpaceIdx = trimmedName.indexOf(' ');
      const nome = firstSpaceIdx > 0 ? trimmedName.substring(0, firstSpaceIdx) : trimmedName;
      const sobrenome = firstSpaceIdx > 0 ? trimmedName.substring(firstSpaceIdx + 1) : "---";

      return {
        id: ent.id,
        nomeCompleto: ent.nome,
        nome,
        sobrenome,
        contato: ent.contato,
        numRotas: totalRotas,
        itensAtendidos: totalItens,
        entregues: totalEntregues,
        devolvidos: totalDevolvidos,
        taxaSucesso,
        tempoMedioVolta: tempoMedio,
        status: totalRotas > 0 ? 'produtivo' : 'ocioso',
        itensVinculados
      };
    });
  }, [entregadores, filteredExpedicoes, companyMap]);

  // Displayed and filtered drivers based on selection drop down
  const displayedDrivers = useMemo(() => {
    if (selectedDriverId === 'all') {
      return [...driverPerformances].sort((a, b) => b.entregues - a.entregues);
    }
    return driverPerformances.filter(d => d.id === selectedDriverId);
  }, [driverPerformances, selectedDriverId]);

  // 3. Tipologia de Ocorrências (filtered by active Date filters)
  const occurrenceStats = useMemo(() => {
    const motivosMap: { [key: string]: number } = {};
    let totalReturns = 0;

    filteredExpedicoes.forEach(exp => {
      exp.itens.forEach(item => {
        if (item.status === 'devolvido' && item.motivoDevolucao) {
          motivosMap[item.motivoDevolucao] = (motivosMap[item.motivoDevolucao] || 0) + 1;
          totalReturns++;
        }
      });
    });

    const lista = Object.keys(motivosMap).map((m, index) => {
      return {
        name: m,
        value: motivosMap[m],
        percent: totalReturns > 0 ? Math.round((motivosMap[m] / totalReturns) * 100) : 0
      };
    }).sort((a, b) => b.value - a.value);

    return {
      totalReturns,
      lista
    };
  }, [filteredExpedicoes]);

  // 3b. Ranking de Devoluções de Entregadores (quem mais faz devoluções)
  const driversByReturnsRank = useMemo(() => {
    return [...driverPerformances]
      .filter(d => d.devolvidos > 0)
      .sort((a, b) => b.devolvidos - a.devolvidos);
  }, [driverPerformances]);

  // Helper readable average time formatting
  const getAverageTimeFormatted = (minutes: number) => {
    if (!minutes || minutes <= 0) return "N/A";
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
  };

  // Simular download de planilha em Excel/CSV
  const handleExportDataCSV = (type: string) => {
    let headers = '';
    let rows = [];

    if (type === 'financeiro') {
      headers = 'Empresa;Volume Enviado;Entregas Concluídas;Faturamento Bruto Distribuidora (R$);Repasses Entregadores (R$);Lucro Líquido Distribuidora (R$);Margem (%)\n';
      rows = financialMargins.map(item => 
        `"${item.nome}";${item.enviados};${item.entregues};${item.faturamento.toFixed(2)};${item.repasses.toFixed(2)};${item.lucro.toFixed(2)};${item.margem}`
      );
    } else if (type === 'entregadores') {
      headers = 'Entregador Nome;Entregador Sobrenome;Rotas Efetuadas;Pacotes Atendidos;Entregas;Devoluções;Taxa Sucesso (%);Tempo Médio Volta (Min)\n';
      rows = displayedDrivers.map(item => 
        `"${item.nome}";"${item.sobrenome}";${item.numRotas};${item.itensAtendidos};${item.entregues};${item.devolvidos};${item.taxaSucesso};${item.tempoMedioVolta}`
      );
    } else {
      headers = 'Motivo de Devolução / Erro;Ocorrências Registradas;Porcentagem (%)\n';
      rows = occurrenceStats.lista.map(item => 
        `"${item.name}";${item.value};${item.percent}`
      );
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_distribuidora_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessExport(`Relatório exportado em formato CSV com sucesso! Verifique a pasta de downloads.`);
    setTimeout(() => setSuccessExport(''), 4000);
  };

  return (
    <div className="space-y-6" id="view-relatorios">
      
      {currentUser.permissions.relatorios_readonly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-sm">
          <Lock className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
          <span>
            <strong>Modo de Leitura Ativo:</strong> Suas permissões no sistema são de apenas consulta. A exportação de dados brutos de comissionamentos e os demonstrativos estratégicos estão protegidos.
          </span>
        </div>
      )}
      
      {/* Alertas de Exportação */}
      {successExport && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl shadow-sm text-center">
          {successExport}
        </div>
      )}

      {/* SUB-MENU TABS */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-slate-100 w-full sm:max-w-md" id="bi-subtabs">
          <button
            onClick={() => setActiveSubTab('operacional')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'operacional'
                ? 'bg-blue-900 text-white'
                : 'text-slate-500 hover:text-slate-850'
            }`}
            id="btn-subtab-operacional"
          >
            <Users className="h-4 w-4" />
            <span>Equipe & Velocidade</span>
          </button>

          <button
            onClick={() => setActiveSubTab('financeiro')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'financeiro'
                ? 'bg-blue-900 text-white'
                : 'text-slate-500 hover:text-slate-850'
            }`}
            id="btn-subtab-financeiro"
          >
            <Calculator className="h-4 w-4" />
            <span>Faturamento & Margens</span>
          </button>

          <button
            onClick={() => setActiveSubTab('problemas')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'problemas'
                ? 'bg-blue-900 text-white'
                : 'text-slate-500 hover:text-slate-850'
            }`}
            id="btn-subtab-problemas"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Tipagem de Devolução</span>
          </button>
        </div>
      </div>

      {/* FILTROS GERAIS: PERÍODO DO FILTRO & SELEÇÃO DE ENTREGADOR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4" id="relatorios-filtros-container">
        {/* Filtros Rápidos de Período */}
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-50" id="preset-filtros-rapidos">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Filtro Rápido:</span>
          
          <button
            onClick={handleSetHoje}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 border ${
              activePreset === 'hoje'
                ? 'bg-blue-900 border-blue-900 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            id="btn-preset-hoje"
          >
            Hoje
          </button>

          <button
            onClick={handleSetSemanaAtual}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 border ${
              activePreset === 'semana'
                ? 'bg-blue-900 border-blue-900 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            id="btn-preset-semana"
          >
            Semana Atual
          </button>

          <button
            onClick={handleSetQuinzena}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 border ${
              activePreset === 'quinzena'
                ? 'bg-blue-900 border-blue-900 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            id="btn-preset-quinzena"
          >
            Quinzena (15 dias)
          </button>

          <button
            onClick={handleSetMesAnterior}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 border ${
              activePreset === 'mesAnterior'
                ? 'bg-blue-900 border-blue-900 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            id="btn-preset-mes-anterior"
          >
            Mês Anterior
          </button>

          <button
            onClick={handleSetMesAtual}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 border ${
              activePreset === 'mesAtual'
                ? 'bg-blue-900 border-blue-900 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            id="btn-preset-mes-atual"
          >
            Mês Atual
          </button>

          <button
            onClick={handleSetAnoAtual}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 border ${
              activePreset === 'anoAtual'
                ? 'bg-blue-900 border-blue-900 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            id="btn-preset-ano-atual"
          >
            Ano Atual
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
            activePreset === '' 
              ? 'bg-amber-50 text-amber-700 border border-amber-100' 
              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          }`} id="label-tipo-calendario">
            {activePreset === '' ? '📅 Data Livre' : '⚡ Filtro Inteligente'}
          </span>
        </div>

        {/* Linha de Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end" id="relatorios-filtros">
          <div className="space-y-1">
            <label htmlFor="filter-start-date" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Data Inicial (Período)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="date"
                id="filter-start-date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('');
                }}
                className="w-full bg-slate-50 pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-end-date" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Data Final (Período)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="date"
                id="filter-end-date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('');
                }}
                className="w-full bg-slate-50 pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div className="space-y-1 col-span-1">
            <label htmlFor="filter-filial" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Filtrar por Filial
            </label>
            <select 
              id="filter-filial"
              value={selectedFilialId}
              onChange={(e) => {
                setSelectedFilialId(e.target.value);
              }}
              className="w-full bg-slate-50 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">
                {currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master'
                  ? 'SISTEMA: Todas as Filiais'
                  : 'SISTEMA: Todas as Filiais Autorizadas'}
              </option>
              {userPermittedFiliais.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 col-span-1">
            <label htmlFor="filter-driver" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Puxar Entregador Selecionado
            </label>
            <select 
              id="filter-driver"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full bg-slate-50 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">SISTEMA: Todos os Entregadores</option>
              {entregadores
                .filter(ent => {
                  if (selectedFilialId === 'all') {
                    if (permittedFilialIds) {
                      return ent.filialId && permittedFilialIds.includes(ent.filialId);
                    }
                    return true;
                  }
                  return ent.filialId === selectedFilialId;
                })
                .map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.nome}</option>
                ))}
            </select>
          </div>

          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSelectedDriverId('all');
              setActivePreset('');
              const initialFilial = currentUser.defaultFilialId || 
                ((currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') ? 'all' : (currentUser.filiais && currentUser.filiais.length > 0 ? currentUser.filiais[0] : 'all'));
              setSelectedFilialId(initialFilial);
            }}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
            id="btn-limpar-filtros"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Limpar Filtros</span>
          </button>
        </div>
      </div>

      {/* SUB-ABA 1: EQUIPE & VELOCIDADE (OPERACIONAL) */}
      {activeSubTab === 'operacional' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="panel-operacional">
          
          {/* Lado Esquerdo: Tabela detalhada de Entregadores */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Classificação & Performance Operacional</h3>
                <p className="text-xs text-slate-400">Tempo de roteiro e taxa de sucesso mapeados pelo filtro</p>
              </div>
              <button
                id="btn-export-drivers-csv"
                onClick={() => handleExportDataCSV('entregadores')}
                className="text-[11px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-100 border border-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-left">
                  <tr>
                    <th scope="col" className="px-4 py-3.5">Nome do Entregador</th>
                    <th scope="col" className="px-4 py-3.5">Sobrenome</th>
                    <th scope="col" className="px-4 py-3.5 text-center">Entregas (Qtd)</th>
                    <th scope="col" className="px-4 py-3.5 text-center">Devoluções</th>
                    <th scope="col" className="px-4 py-3.5 text-center">Tempo Médio</th>
                    <th scope="col" className="px-4 py-3.5 text-center">S. Rate</th>
                    <th scope="col" className="px-4 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-medium text-slate-700">
                  {displayedDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        Nenhum registro encontrado no período selecionado para este motorista.
                      </td>
                    </tr>
                  ) : (
                    displayedDrivers.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/45">
                        <td className="px-4 py-3.5 font-bold text-slate-900">{item.nome}</td>
                        <td className="px-4 py-3.5 text-slate-600">{item.sobrenome}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-800">{item.entregues}</td>
                        <td className="px-4 py-3.5 text-center text-rose-600 font-bold">{item.devolvidos}</td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-blue-700">
                          {getAverageTimeFormatted(item.tempoMedioVolta)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded font-black font-mono text-[10px] ${
                            item.taxaSucesso >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-110' :
                            item.taxaSucesso >= 70 ? 'bg-amber-50 text-amber-700 border border-amber-110' :
                            'bg-rose-50 text-rose-700 border border-rose-110'
                          }`}>
                            {item.taxaSucesso}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => {
                              setDetailsDriver(item);
                              setDetailsFilterStatus('todos');
                            }}
                            className="bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 text-[10px] font-black uppercase px-2.5 py-1 rounded transition"
                            title="Ver itens detalhados"
                          >
                            Detalhe
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lado Direito: Gráficos ou Indicador bento */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-1">Média de Tempo por Driver</h3>
              <p className="text-xs text-slate-400">Tempo de curso contando a partir da finalização de saída até acerto de pátio</p>
            </div>

            <div className="h-60 w-full min-w-0 relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={displayedDrivers.filter(d => d.numRotas > 0)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                  <YAxis dataKey="nome" type="category" stroke="#94a3b8" fontSize={9} width={65} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", color: "#fff", borderRadius: "10px", fontSize: "11px" }} />
                  <Bar name="Minutos" dataKey="tempoMedioVolta" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-blue-50/50 p-3.5 border border-blue-100 rounded-xl">
              <span className="text-xs font-bold text-blue-900 block mb-1">SLA Ativo Diamante:</span>
              <p className="text-[11px] text-blue-700 leading-normal">
                Todas as rotas devem idealmente ser finalizadas em menos de <strong>6 horas (360 minutos)</strong> para assegurar os prazos de re-bipagens do turno seguinte.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* SUB-ABA 2: FATURAMENTO & MARGENS */}
      {activeSubTab === 'financeiro' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="panel-financeiro">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Análise de Rentabilidade por Empresa</h3>
                <p className="text-xs text-slate-400">Margem e receita retida no hub baseados no período filtrado</p>
              </div>
              <button
                id="btn-export-finance-csv"
                onClick={() => handleExportDataCSV('financeiro')}
                className="text-[11px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-100 border border-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Planilha CSV
              </button>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-left">
                  <tr>
                    <th className="px-4 py-3">Parceiro Cliente</th>
                    <th className="px-4 py-3 text-center">Volume Total</th>
                    <th className="px-4 py-3 text-center">Faturamento Bruto</th>
                    <th className="px-4 py-3 text-center">Comissão Repasses</th>
                    <th className="px-4 py-3 text-right">Margem Retida</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {financialMargins.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/40 font-medium text-slate-700">
                      <td className="px-4 py-3 font-bold text-slate-800 flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.cor }} />
                        <span>{item.nome}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.enviados} itens</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">R$ {item.faturamento.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-slate-500">R$ {item.repasses.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-extrabold pr-6">
                        {item.margem}% (R$ {item.lucro.toFixed(2)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Margem de Contribuição</h3>
              <p className="text-xs text-slate-400">Eficiência de retenção por empresa parceira</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5 my-4">
              {financialMargins.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-750">{item.nome}</span>
                    <span className="text-blue-700">{item.margem}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ width: `${item.margem}%`, backgroundColor: item.cor }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 text-justify italic font-medium leading-relaxed">
              * Nota: Valores representados somam unicamente itens com status 'entregue'. Devoluções ou extravios não geram receita nem custo de repasse ao entregador parceiro.
            </p>
          </div>
        </div>
      )}

      {/* SUB-ABA 3: ACERTO / ERROS DE DEVOLUÇÃO */}
      {activeSubTab === 'problemas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="panel-problemas">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Ocorrências Lançadas na Baixa</h3>
                <p className="text-xs text-slate-400">Causas de insucesso de entrega mapeados no período</p>
              </div>
              <button
                id="btn-export-issues-csv"
                onClick={() => handleExportDataCSV('devolucoes')}
                className="text-[11px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-100 border border-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
            </div>

            <div className="space-y-4">
              {occurrenceStats.lista.length === 0 ? (
                <div className="text-center py-20 text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
                  Nenhuma ocorrência de devolução foi catalogada pelo conferente no escopo de datas.
                </div>
              ) : (
                occurrenceStats.lista.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-700">{item.name}</span>
                      <span className="font-extrabold text-slate-600">{item.value} ocorrências ({item.percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${item.percent}%`,
                          backgroundColor: COLORS[idx % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-1">Carga Geral Devolvida</h3>
              <p className="text-xs text-slate-400">Total acumulado de pacotes retornados: <strong>{occurrenceStats.totalReturns} pacotes</strong></p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Ranking de Devoluções
              </h4>
              <p className="text-[11px] text-slate-400">Cooperados ordenados por volume de glosas/retornos</p>

              <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
                {driversByReturnsRank.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center italic">Sem devoluções no período.</p>
                ) : (
                  driversByReturnsRank.map((driver, rankIdx) => {
                    const badgeColors = [
                      "bg-rose-100 text-rose-800 border-rose-200",
                      "bg-amber-100 text-amber-800 border-amber-100",
                      "bg-slate-100 text-slate-700 border-slate-200"
                    ];
                    return (
                      <div key={driver.id} className="py-2.5 flex justify-between items-center text-xs border-b border-slate-50 last:border-b-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-black border ${
                            rankIdx < 3 ? badgeColors[rankIdx] : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {rankIdx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate max-w-[125px]" title={driver.nomeCompleto}>{driver.nomeCompleto}</span>
                            <span className="text-[9px] text-slate-400 font-mono">Sucesso: {driver.taxaSucesso}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="font-extrabold text-rose-600 block">{driver.devolvidos} retornos</span>
                          </div>
                          <button
                            onClick={() => {
                              setDetailsDriver(driver);
                              setDetailsFilterStatus('devolvido');
                            }}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition shrink-0 cursor-pointer"
                            id={`btn-detalhes-ranking-${driver.id}`}
                          >
                            Detalhes
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[10px] text-slate-450 tracking-widest font-mono text-center">
              Filtro ativo: {activePreset === '' ? 'Filtro por datas' : `Período ${activePreset}`}
            </div>
          </div>
        </div>

        {/* Relatório Geral de Itens Devolvidos (Comprehensive Table View as explicitly requested) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4" id="relatorio-itens-devolvidos-tabela">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b border-slate-50 gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Relatório Geral de Itens Devolvidos</h3>
              <p className="text-xs text-slate-400">Relação individualizada de todos os pacotes retornados com insucesso</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black bg-slate-100 text-slate-650 px-3 py-1.5 rounded-lg border border-slate-200">
                {filteredReturnedItems.length} de {returnedItemsList.length} itens devolvidos
              </span>
              <button
                id="btn-export-devolvidos-detalhado-csv"
                onClick={handleExportReturnedItemsCSV}
                className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar Relatório CSV
              </button>
            </div>
          </div>

          {/* Filtros Internos do Relatório */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            {/* Campo de Busca */}
            <div className="flex flex-col justify-end">
              <label className="text-[10px] font-bold text-slate-550 uppercase mb-1.5 tracking-wider block">Filtro Geral</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar código, entregador..."
                  value={searchReturnedItem}
                  onChange={(e) => setSearchReturnedItem(e.target.value)}
                  className="w-full bg-white pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-550/50 h-[34px]"
                />
                {searchReturnedItem && (
                  <button 
                    onClick={() => setSearchReturnedItem('')} 
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    X
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown de Motivos */}
            <div className="flex flex-col justify-end">
              <label className="text-[10px] font-bold text-slate-550 uppercase mb-1.5 tracking-wider block">Motivo do Retorno</label>
              <select
                value={selectedReturnedReasonFilter}
                onChange={(e) => setSelectedReturnedReasonFilter(e.target.value)}
                className="w-full bg-white px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-750 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-550/50 cursor-pointer h-[34px]"
              >
                <option value="all">Todos os motivos</option>
                {uniqueMotiveOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Data Início */}
            <div className="flex flex-col justify-end">
              <label className="text-[10px] font-bold text-slate-550 uppercase mb-1.5 tracking-wider block flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-rose-500" />
                Data de Início
              </label>
              <input
                type="date"
                value={returnedStartDate}
                onChange={(e) => setReturnedStartDate(e.target.value)}
                className="w-full bg-white px-3 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-755 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-550/50 cursor-pointer h-[34px]"
              />
            </div>

            {/* Data Fim */}
            <div className="flex flex-col justify-end">
              <label className="text-[10px] font-bold text-slate-550 uppercase mb-1.5 tracking-wider block flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-rose-500" />
                Data de Fim
              </label>
              <input
                type="date"
                value={returnedEndDate}
                onChange={(e) => setReturnedEndDate(e.target.value)}
                className="w-full bg-white px-3 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-755 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-550/50 cursor-pointer h-[34px]"
              />
            </div>
          </div>

          {/* Tabela do relatório */}
          <div className="border border-slate-100 rounded-xl overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-left">
                <tr>
                  <th scope="col" className="px-4 py-3">Código de Barras</th>
                  <th scope="col" className="px-4 py-3">Entregador</th>
                  <th scope="col" className="px-4 py-3">Parceiro Embarcador</th>
                  <th scope="col" className="px-4 py-3">Motivo da Devolução</th>
                  <th scope="col" className="px-4 py-3">Observações Extras</th>
                  <th scope="col" className="px-4 py-3">Data de Retorno</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredReturnedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 italic">
                      Nenhum item devolvido corresponde aos filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredReturnedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-rose-50/10">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 border-l-2 border-rose-500">{item.codigoBarras}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{item.entregadorNome}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-650 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                          {item.empresaNome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-rose-700 font-bold">{item.motivoDevolucao}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]" title={item.observacaoDevolucao}>
                        {item.observacaoDevolucao || <span className="text-slate-350 italic font-normal">Sem observações</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {new Date(item.dataDeRetorno).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* SCREEN MODAL / TELA DE DETALHES DO ENTREGADOR */}
      {detailsDriver && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm shadow-2xl" id="modal-detalhes-entregador">
          
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-900 text-white">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 bg-white/10 rounded-full border border-white/20 flex items-center justify-center font-bold text-lg text-white">
                  {detailsDriver.nome.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-lg">
                      {detailsDriver.nomeCompleto}
                    </h3>
                    <span className="text-[9px] bg-blue-950 px-2 py-0.5 rounded font-bold uppercase border border-blue-800">
                      Rendimento: {detailsDriver.taxaSucesso}%
                    </span>
                  </div>
                  <p className="text-xs text-blue-150 mt-0.5 font-medium">CPF: {detailsDriver.contato} (Celular) | Contrato Ativo</p>
                </div>
              </div>

              <button
                onClick={() => setDetailsDriver(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition focus:outline-none"
                id="btn-close-modal-driver-details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* General metrics row inside modal */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="block text-[9px] text-slate-400 font-bold uppercase">Volume Total Carregado</span>
                <span className="text-lg font-black block text-slate-800 font-mono mt-1">{detailsDriver.itensVinculados.length} pacotes</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="block text-[9px] text-emerald-600 font-bold uppercase">Concluídos com Sucesso</span>
                <span className="text-lg font-black block text-emerald-700 font-mono mt-1">{detailsDriver.entregues} pacotes</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="block text-[9px] text-rose-600 font-bold uppercase">Devoluções / Pendências</span>
                <span className="text-lg font-black block text-rose-700 font-mono mt-1">{detailsDriver.devolvidos} pacotes</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="block text-[9px] text-blue-600 font-bold uppercase">Tempo Médio de Trajeto</span>
                <span className="text-lg font-black block text-blue-700 font-mono mt-1">
                  {getAverageTimeFormatted(detailsDriver.tempoMedioVolta)}
                </span>
              </div>
            </div>

            {/* Control status switches and lists */}
            <div className="p-6 flex-1 overflow-y-auto min-h-0 space-y-4">
              
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Lista Analítica de Encomendas</h4>
                  <p className="text-xs text-slate-400">Relação completa de código de barras e tempo individual de trânsito</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg text-[11px] font-bold border border-slate-150">
                  <button
                    onClick={() => setDetailsFilterStatus('todos')}
                    className={`px-3 py-1.5 rounded transition ${
                      detailsFilterStatus === 'todos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setDetailsFilterStatus('entregue')}
                    className={`px-3 py-1.5 rounded transition ${
                      detailsFilterStatus === 'entregue' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-705'
                    }`}
                  >
                    Entregues
                  </button>
                  <button
                    onClick={() => setDetailsFilterStatus('devolvido')}
                    className={`px-3 py-1.5 rounded transition ${
                      detailsFilterStatus === 'devolvido' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-705'
                    }`}
                  >
                    Devolvidos
                  </button>
                </div>
              </div>

              {/* Items Table or Cards list */}
              <div className="space-y-2.5">
                {detailsDriver.itensVinculados
                  .filter((it: any) => detailsFilterStatus === 'todos' || it.status === detailsFilterStatus)
                  .length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-medium">
                      Nenhum pacote localizado para o status selecionado.
                    </div>
                  ) : (
                    detailsDriver.itensVinculados
                      .filter((it: any) => detailsFilterStatus === 'todos' || it.status === detailsFilterStatus)
                      .map((item: any, i: number) => (
                        <div 
                          key={i} 
                          className="p-4 bg-slate-50 hover:bg-slate-100/60 border border-slate-100 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 text-xs font-semibold"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-mono font-black rounded px-1.5 py-0.5">
                                {item.empresaNome}
                              </span>
                              <span className="text-slate-400">/</span>
                              <p className="font-mono text-slate-750 font-bold truncate">{item.codigoBarras}</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-y-1 gap-x-4 text-[11px] text-slate-500 font-medium">
                              <p className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                Saída: {new Date(item.dataHoraSaida).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}
                              </p>
                              {item.dataHoraRetorno && (
                                <p className="flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3 text-slate-400" />
                                  <span>Retorno: {new Date(item.dataHoraRetorno).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-row sm:flex-col justify-between sm:justify-center items-end text-right shrink-0 gap-2">
                            {item.status === 'entregue' ? (
                              <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-110 font-bold flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                Entregue
                              </span>
                            ) : (
                              <div className="space-y-0.5 text-right">
                                <span className="px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-110 font-bold inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-rose-600" />
                                  Devolvido
                                </span>
                                {item.motivoDevolucao && (
                                  <span className="block text-[9px] text-rose-600 font-medium">{item.motivoDevolucao}</span>
                                )}
                              </div>
                            )}

                            <span className="text-[10px] text-slate-400 font-mono font-medium block mt-0.5">
                              Tempo decorrido: <strong className="text-slate-650">{item.duracaoFormatada}</strong>
                            </span>
                          </div>
                        </div>
                      ))
                  )}
              </div>

            </div>

            {/* Modal Bottom control panel */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={handleExportPDF}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-2 cursor-pointer"
                id="btn-export-driver-details-pdf"
              >
                <FileText className="h-4 w-4" />
                Exportar em PDF
              </button>
              <button
                onClick={() => setDetailsDriver(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition shadow"
                id="btn-close-details-driver"
              >
                Fechar Painel
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
