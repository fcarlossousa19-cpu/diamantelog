/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  DollarSign, 
  Calendar, 
  FileText, 
  Printer, 
  Download, 
  UserCheck, 
  TrendingUp, 
  RotateCcw, 
  Package, 
  Building,
  CheckCircle,
  Hash,
  Lock,
  X,
  History,
  Search,
  Info
} from 'lucide-react';
import { Empresa, Entregador, Expedicao, User as SystemUser, Filial, Vale, ReciboPagamento } from '../types';

interface FolhaSalarialViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  expedicoes: Expedicao[];
  currentUser: SystemUser;
  filiais: Filial[];
  vales: Vale[];
  onAddVale: (vale: Vale) => void;
  onDeleteVale?: (valeId: string) => void;
  recibos?: ReciboPagamento[];
  onAddRecibo?: (recibo: ReciboPagamento) => void;
  onDeleteRecibo?: (reciboId: string) => void;
}

export default function FolhaSalarialView({ 
  empresas, 
  entregadores, 
  expedicoes, 
  currentUser, 
  filiais,
  vales = [],
  onAddVale,
  onDeleteVale,
  recibos = [],
  onAddRecibo,
  onDeleteRecibo
}: FolhaSalarialViewProps) {
  // Filtrar as Filiais de Acordo com as Permissões do Usuário
  const allowedFiliais = useMemo(() => {
    if (currentUser.isMaster) {
      return filiais;
    }
    const userFilialIds = currentUser.filiais || [];
    return filiais.filter(f => userFilialIds.includes(f.id));
  }, [currentUser, filiais]);

  const [selectedFilialId, setSelectedFilialId] = useState<string>('');

  // Sincronizar Filial Ativa Padrão
  useEffect(() => {
    if (allowedFiliais.length > 0) {
      const defaultId = currentUser.defaultFilialId;
      if (defaultId && allowedFiliais.some(f => f.id === defaultId)) {
        if (!selectedFilialId || !allowedFiliais.some(f => f.id === selectedFilialId)) {
          setSelectedFilialId(defaultId);
        }
      } else if (!selectedFilialId || !allowedFiliais.some(f => f.id === selectedFilialId)) {
        setSelectedFilialId(allowedFiliais[0].id);
      }
    } else {
      setSelectedFilialId('');
    }
  }, [allowedFiliais, selectedFilialId, currentUser.defaultFilialId]);

  // Filtrar Entregadores da Filial Ativa
  const filteredEntregadores = useMemo(() => {
    if (!selectedFilialId) {
      return [];
    }
    return entregadores.filter(e => e.filialId === selectedFilialId);
  }, [entregadores, selectedFilialId]);

  const [selectedEntregadorId, setSelectedEntregadorId] = useState<string>('');

  // Sincronizar Entregador caso ele mude de filial ou a lista mude
  useEffect(() => {
    if (selectedEntregadorId && !filteredEntregadores.some(e => e.id === selectedEntregadorId)) {
      setSelectedEntregadorId('');
    }
  }, [filteredEntregadores, selectedEntregadorId]);
  
  // Períodos com Datas
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Últimos 30 dias de padrão
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Controle de Recibo Selecionado
  const [showReceipt, setShowReceipt] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [taxaAbatimentoDevolucao, setTaxaAbatimentoDevolucao] = useState<number>(0);
  const [taxaAbatimentoInput, setTaxaAbatimentoInput] = useState<string>('');

  // Estados de Gerenciamento de Vales (Antecipações)
  const [valeEntregadorId, setValeEntregadorId] = useState<string>('');
  const [valeValor, setValeValor] = useState<number | ''>('');
  const [valeValorInput, setValeValorInput] = useState<string>('');
  const [valeObservacao, setValeObservacao] = useState<string>('');
  const [activeValeReceipt, setActiveValeReceipt] = useState<Vale | null>(null);

  // Estados do Modal de Histórico Geral
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTab, setHistoryTab] = useState<'vales' | 'abatimentos'>('vales');
  const [historyStartDate, setHistoryStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Últimos 30 dias de padrão
    return d.toISOString().split('T')[0];
  });
  const [historyEndDate, setHistoryEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [historyEntregadorId, setHistoryEntregadorId] = useState<string>('todos');
  const [historyFilialId, setHistoryFilialId] = useState<string>('todas');
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  const selectedDeliverer = useMemo(() => {
    return filteredEntregadores.find(e => e.id === selectedEntregadorId);
  }, [selectedEntregadorId, filteredEntregadores]);

  const delivererFilial = useMemo(() => {
    if (!selectedDeliverer?.filialId) return null;
    return filiais.find(f => f.id === selectedDeliverer.filialId);
  }, [selectedDeliverer, filiais]);

  const receiptTitle = useMemo(() => {
    return (delivererFilial?.nome || "EXPEDLOG LOGISTICA & DISTRIBUIÇÃO").toUpperCase();
  }, [delivererFilial]);

  const receiptCNPJ = useMemo(() => {
    return delivererFilial?.cnpj || "44.512.981/0001-92";
  }, [delivererFilial]);

  const receiptAddress = useMemo(() => {
    return (delivererFilial?.endereco || (delivererFilial?.cidade ? `${delivererFilial.cidade} - ${delivererFilial.estado || 'SP'}` : "AV. JUSCELINO KUBITSCHEK, 1200 - CONGONHAS - SP")).toUpperCase();
  }, [delivererFilial]);

  // Memoria do histórico de vales filtrados para o modal
  const computedHistoryVales = useMemo(() => {
    return (vales || []).filter(v => {
      const dataValeStr = v.dataHora ? v.dataHora.split('T')[0] : '';
      if (!dataValeStr) return false;
      const matchPeriod = dataValeStr >= historyStartDate && dataValeStr <= historyEndDate;
      if (!matchPeriod) return false;

      if (historyEntregadorId !== 'todos' && v.entregadorId !== historyEntregadorId) return false;

      if (historyFilialId !== 'todas') {
        const entregador = entregadores.find(e => e.id === v.entregadorId);
        if (!entregador || entregador.filialId !== historyFilialId) return false;
      }

      return true;
    });
  }, [vales, historyStartDate, historyEndDate, historyEntregadorId, historyFilialId, entregadores]);

  // Memoria de abatimentos acumulados dos motoristas no período para o modal
  const computedHistoryAbatimentos = useMemo(() => {
    const result: {
      id: string; // ID do Recibo para chave única
      entregadorId: string;
      entregadorNome: string;
      filialNome: string;
      totalDevolvidos: number;
      totalAbatido: number;
      detalhesOcorrencias: { codigoExpedicao: string; data: string; empresaNome: string; quantidade: number }[];
      periodo: string;
      dataGeracao: string;
    }[] = [];

    const filteredRecibos = (recibos || []).filter(rec => {
      // O histórico de abatimento só deve aparecer se a taxa foi preenchida (> 0) e o recibo de pagamento correspondente foi gerado
      if (!rec.taxaAbatimento || rec.taxaAbatimento <= 0) return false;

      const recDate = rec.dataHora ? rec.dataHora.split('T')[0] : '';
      if (!recDate) return false;
      const dateInPeriod = recDate >= historyStartDate && recDate <= historyEndDate;
      if (!dateInPeriod) return false;

      if (historyEntregadorId !== 'todos' && rec.entregadorId !== historyEntregadorId) return false;
      if (historyFilialId !== 'todas' && rec.filialId !== historyFilialId) return false;
      return true;
    });

    filteredRecibos.forEach(rec => {
      // Ocorrências originais que motivaram este abatimento, baseando-se no período correspondente ao recibo
      const driverExpedicoes = expedicoes.filter(exp => {
        if (exp.entregadorId !== rec.entregadorId) return false;
        const dataExpStr = exp.dataHoraSaida ? exp.dataHoraSaida.split('T')[0] : '';
        if (!dataExpStr) return false;
        return dataExpStr >= rec.periodoInicio && dataExpStr <= rec.periodoFim;
      });

      const ocorrencias: { codigoExpedicao: string; data: string; empresaNome: string; quantidade: number }[] = [];
      driverExpedicoes.forEach(exp => {
        const mapDevolvidosPorEmpresa: { [empId: string]: number } = {};
        exp.itens.forEach(item => {
          if (item.status === 'devolvido') {
            mapDevolvidosPorEmpresa[item.empresaId] = (mapDevolvidosPorEmpresa[item.empresaId] || 0) + 1;
          }
        });

        Object.entries(mapDevolvidosPorEmpresa).forEach(([empId, qty]) => {
          const emp = empresas.find(company => company.id === empId);
          ocorrencias.push({
            codigoExpedicao: exp.id.substring(0, 8).toUpperCase(),
            data: exp.dataHoraSaida ? exp.dataHoraSaida.split('T')[0] : '',
            empresaNome: emp?.nome || 'Operação',
            quantidade: qty
          });
        });
      });

      const f = filiais.find(b => b.id === rec.filialId);
      result.push({
        id: rec.id,
        entregadorId: rec.entregadorId,
        entregadorNome: rec.entregadorNome,
        filialNome: f?.nome || 'Não definida',
        totalDevolvidos: rec.totalDevolvidos,
        totalAbatido: rec.totalAbatido,
        detalhesOcorrencias: ocorrencias,
        periodo: `${new Date(rec.periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(rec.periodoFim).toLocaleDateString('pt-BR')}`,
        dataGeracao: new Date(rec.dataHora).toLocaleDateString('pt-BR')
      });
    });

    return result;
  }, [historyStartDate, historyEndDate, historyEntregadorId, historyFilialId, recibos, expedicoes, empresas, filiais]);

  // Filtrar e analisar expedições do motorista no período
  const payrollData = useMemo(() => {
    if (!selectedEntregadorId) return null;

    // Filtrar expedições atendidas por este motorista dentro do período usando comparação segura de strings de data
    const filtradas = expedicoes.filter(exp => {
      if (exp.entregadorId !== selectedEntregadorId) return false;
      const dataExpStr = exp.dataHoraSaida ? exp.dataHoraSaida.split('T')[0] : '';
      if (!dataExpStr) return false;
      return dataExpStr >= startDate && dataExpStr <= endDate;
    });

    let totalVolumesCarregados = 0;
    let totalEntregues = 0;
    let totalDevolvidos = 0;
    let comissaoAcumulada = 0;
    
    // Detalhamento por empresa para tabela explicativa
    const detalhePorEmpresa: { [key: string]: { nome: string; comissaoUnidade: number; enviados: number; entregues: number; devolvidos: number; totalComissao: number } } = {};

    // Iniciar dados de empresa no mapa
    empresas.forEach(emp => {
      detalhePorEmpresa[emp.id] = {
        nome: emp.nome,
        comissaoUnidade: emp.comissaoEntregador,
        enviados: 0,
        entregues: 0,
        devolvidos: 0,
        totalComissao: 0
      };
    });

    filtradas.forEach(exp => {
      exp.itens.forEach(item => {
        if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) {
          return; // Skip withdrawn packages entirely!
        }
        totalVolumesCarregados++;
        const empDetail = detalhePorEmpresa[item.empresaId];
        
        if (empDetail) {
          if (item.status === 'entregue') {
            totalEntregues++;
            empDetail.entregues++;
            empDetail.enviados++;
            const comissaoGanhas = empDetail.comissaoUnidade;
            comissaoAcumulada += comissaoGanhas;
            empDetail.totalComissao += comissaoGanhas;
          } else if (item.status === 'devolvido') {
            totalDevolvidos++;
            empDetail.devolvidos++;
            empDetail.enviados++;
          } else {
            // Em trânsito, não conta para pagamento ainda
            empDetail.enviados++;
          }
        }
      });
    });

    const valorAbatido = totalDevolvidos * (taxaAbatimentoDevolucao || 0);

    // Calcular Vales deste entregador no período
    const valesFiltrados = (vales || []).filter(v => {
      if (v.entregadorId !== selectedEntregadorId) return false;
      const dataValeStr = v.dataHora ? v.dataHora.split('T')[0] : '';
      if (!dataValeStr) return false;
      return dataValeStr >= startDate && dataValeStr <= endDate;
    });
    const totalVales = valesFiltrados.reduce((acc, curr) => acc + curr.valor, 0);

    const comissaoLiquida = Math.max(0, comissaoAcumulada - valorAbatido - totalVales);

    return {
      expedicoes: filtradas,
      totalVolumesCarregados,
      totalEntregues,
      totalDevolvidos,
      comissaoBruta: comissaoAcumulada,
      totalAbatido: valorAbatido,
      totalVales,
      valesList: valesFiltrados,
      comissaoTotal: comissaoLiquida,
      detalheEmpresas: Object.values(detalhePorEmpresa).filter(d => d.enviados > 0)
    };
  }, [selectedEntregadorId, startDate, endDate, expedicoes, empresas, taxaAbatimentoDevolucao, vales]);

  // Escolha de botões rápidos para preencher períodos comuns
  const handleQuickPeriod = (dias: number) => {
    const hoje = new Date();
    const anterior = new Date();
    anterior.setDate(hoje.getDate() - dias);

    setStartDate(anterior.toISOString().split('T')[0]);
    setEndDate(hoje.toISOString().split('T')[0]);
  };

  const handleTaxaAbatimentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const cleanValue = rawValue.replace(/\D/g, '');
    
    if (!cleanValue) {
      setTaxaAbatimentoDevolucao(0);
      setTaxaAbatimentoInput('');
      setShowReceipt(false);
      return;
    }
    
    const numericValue = parseInt(cleanValue, 10) / 100;
    setTaxaAbatimentoDevolucao(numericValue);
    
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setTaxaAbatimentoInput(formatted);
    setShowReceipt(false);
  };

  const handleValeValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Remove tudo que não for dígito
    const cleanValue = rawValue.replace(/\D/g, '');
    
    if (!cleanValue) {
      setValeValor('');
      setValeValorInput('');
      return;
    }
    
    const numericValue = parseInt(cleanValue, 10) / 100;
    setValeValor(numericValue);
    
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setValeValorInput(formatted);
  };

  const handleGenerateVale = () => {
    if (!valeEntregadorId) {
      alert("Por favor, selecione o entregador solicitante.");
      return;
    }
    const val = parseFloat(valeValor as string);
    if (isNaN(val) || val <= 0) {
      alert("Por favor, insira um valor válido para o vale.");
      return;
    }

    const entregador = entregadores.find(e => e.id === valeEntregadorId);
    if (!entregador) {
      alert("Entregador não encontrado.");
      return;
    }

    const novoVale: Vale = {
      id: 'vale-' + Date.now().toString(),
      entregadorId: valeEntregadorId,
      entregadorNome: entregador.nome,
      valor: val,
      dataHora: new Date().toISOString(),
      usuarioNome: currentUser.nomeCompleto || currentUser.username || 'Administrador',
      filialId: entregador.filialId || selectedFilialId || '',
      observacao: valeObservacao.trim() || undefined
    };

    onAddVale(novoVale);
    
    // Mostra o cheque e limpa os campos!
    setActiveValeReceipt(novoVale);
    setValeValor('');
    setValeValorInput('');
    setValeObservacao('');
  };

  const handleExportValePDF = (v: Vale) => {
    const entregador = entregadores.find(e => e.id === v.entregadorId);
    const valeFilial = entregador?.filialId ? filiais.find(f => f.id === entregador.filialId) : null;
    const valeFilialNome = (valeFilial?.nome || "EXPEDLOG DISTRIBUIÇÃO").toUpperCase();
    const valeFilialCidade = (valeFilial?.cidade || "CONGONHAS").toUpperCase();
    const valeFilialEstado = (valeFilial?.estado || "SP").toUpperCase();
    
    const doc = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: [180, 80] // formato cheque
    });

    // Borda do Cheque
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.rect(4, 4, 172, 72);
    
    // Linha interna tracejada de cheque
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([2, 1], 0);
    doc.rect(5.5, 5.5, 169, 69);
    doc.setLineDashPattern([], 0); // reset

    // Topo/Cabeçalho do Cheque
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(valeFilialNome, 8, 12);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${valeFilialCidade} - ${valeFilialEstado} | CNPJ: ${valeFilial?.cnpj || "44.512.981/0001-92"}`, 8, 16);

    // Box do Valor do Cheque (Canto Direito)
    doc.setFillColor(248, 250, 252);
    doc.rect(125, 8, 45, 10, "F");
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.rect(125, 8, 45, 10, "S");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`R$ ${v.valor.toFixed(2)}`, 147.5, 14.5, { align: "center" });

    // Título Principal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RECIBO DE VALE / ANTECIPAÇÃO", 8, 25);
    
    // Divisor fino
    doc.setDrawColor(203, 213, 225);
    doc.line(8, 27, 172, 27);

    // Texto do Cheque
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    
    const words = numberToWords(v.valor);
    const dateObj = new Date(v.dataHora);
    
    const checkText = `Pague-se por este vale a quantia de ${words.toUpperCase()} ao motorista credenciado ${v.entregadorNome.toUpperCase()} (CPF: ${entregador?.cpf || "---"}), referente a adiantamento/antecipação de pagamento de comissões.${v.observacao ? ` Motivo: ${v.observacao.toUpperCase()}` : ''}`;
    const wrappedCheckText = doc.splitTextToSize(checkText, 164);
    doc.text(wrappedCheckText, 8, 33);

    // Data e Cidade
    const city = valeFilialCidade;
    const dateStr = `${city.toUpperCase()}, ${dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}`;
    doc.setFont("helvetica", "bold");
    doc.text(dateStr, 8, 52);

    // Assinaturas
    doc.setLineWidth(0.25);
    doc.setDrawColor(15, 23, 42);
    
    // Linha 1: Pagador
    doc.line(8, 64, 75, 64);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("ADMINISTRATIVO / PAGADOR", 41.5, 67.5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(v.usuarioNome || "ADMINISTRADOR", 41.5, 63, { align: "center" });

    // Linha 2: Entregador
    doc.line(100, 64, 172, 64);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("ASSINATURA DO ENTREGADOR", 136, 67.5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(v.entregadorNome.toUpperCase(), 136, 63, { align: "center" });

    // Cheque MICR Numbers (brutalism typography style accent)
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`[: 001358 [: 098412 ||  ${v.id.substring(0, 8).toUpperCase()}  ||`, 86, 74.5, { align: "center" });

    doc.save(`vale-${v.entregadorNome.toLowerCase().replace(/\s+/g, '-')}-${v.id.substring(0,6)}.pdf`);
  };

  // Aciona exportação profissional em PDF do recibo de pagamento
  const handleExportPDF = async () => {
    if (!payrollData || !selectedDeliverer) return;
    setIsExporting(true);

    try {
      // Instancia o jsPDF diretamente (sem html2canvas) para evitar falhas de CORS, sandbox ou oklch
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // 1. Header do Recibo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(receiptTitle, 15, 20);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(receiptAddress, 15, 25);
      
      // Código e Tipo de Documento no canto direito
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("RECIBO DE PRESTAÇÃO DE CONTAS", 135, 20);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const periodText = `PERÍODO: ${new Date(startDate).toLocaleDateString('pt-BR')} A ${new Date(endDate).toLocaleDateString('pt-BR')}`;
      doc.text(periodText, 135, 25);

      // Divisor elegante
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.line(15, 28, 195, 28);

      // 2. Declaração Principal (Texto de Quitação por Extenso)
      const formattedTotal = payrollData.comissaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const wordsValue = numberToWords(payrollData.comissaoTotal);
      const descriptionText = `Recebi de ${receiptTitle}, inscrita no CNPJ sob o nº ${receiptCNPJ}, a importância líquida de R$ ${formattedTotal} (por extenso: ${wordsValue}), referente à comissão pactuada de fretes e entregas porta-a-porta executadas no período compreendido de ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}.`;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      
      // Auto-wrap do texto com splitTextToSize
      const wrappedDesc = doc.splitTextToSize(descriptionText, 180);
      doc.text(wrappedDesc, 15, 34);

      // Calcula Y subsequente baseado no volume de linhas do texto escrito
      let y = 34 + (wrappedDesc.length * 4.5) + 3;

      // 3. Quadro de Informações do Beneficiário
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, y, 180, 25, "F");
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(15, y, 180, 25, "S");

      // Coluna 1
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("PRESTADOR CREDENCIADO (FAVORECIDO)", 20, y + 6);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(selectedDeliverer.nome, 20, y + 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`CPF: ${selectedDeliverer.cpf}`, 20, y + 17);
      doc.text(`Contato: ${selectedDeliverer.contato}`, 20, y + 21);

      // Coluna 2 (Consolidado)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("RESULTADO CONSOLIDADO DA ATIVIDADE", 110, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Cargas Expedidas: ${payrollData.totalVolumesCarregados} vol.`, 110, y + 11);
      doc.text(`Devoluções Abatidas: ${payrollData.totalDevolvidos} un.`, 110, y + 16);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(`Entregas Efetuadas: ${payrollData.totalEntregues} pacotes pagos`, 110, y + 21);

      // 4. Demonstrativo Detalhado (Tabela)
      y += 33;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("DISCRIMINAÇÃO DAS ATIVIDADES / PARCEIROS", 15, y);

      y += 4;
      // Cabeçalho da Tabela
      doc.setFillColor(30, 41, 59); // Slate Header
      doc.rect(15, y, 180, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("ATENDIMENTO PARTNER", 18, y + 5.5);
      doc.text("COMISSÃO UN.", 75, y + 5.5);
      doc.text("CARREGADOS", 100, y + 5.5);
      doc.text("ABATIDOS", 125, y + 5.5);
      doc.text("EFETIVADOS", 150, y + 5.5);
      doc.text("SUBTOTAL", 192, y + 5.5, { align: "right" });

      y += 8;

      // Linhas da tabela
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);

      payrollData.detalheEmpresas.map((det, index) => {
        // Fundo zebrado
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, y, 180, 6.5, "F");
        }
        
        // Borda inferior
        doc.setDrawColor(241, 245, 249);
        doc.line(15, y + 6.5, 195, y + 6.5);

        // Textos
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(det.nome, 18, y + 4.5);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`R$ ${det.comissaoUnidade.toFixed(2)}`, 75, y + 4.5);
        doc.text(det.enviados.toString(), 100, y + 4.5);
        
        doc.setTextColor(244, 63, 94); // rose-500
        doc.text(det.devolvidos.toString(), 125, y + 4.5);
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.text(det.entregues.toString(), 150, y + 4.5);

        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(`R$ ${det.totalComissao.toFixed(2)}`, 192, y + 4.5, { align: "right" });

        y += 6.5;
      });

      // Rodapé da Tabela com Totalização
      doc.setDrawColor(15, 23, 42);
      doc.line(15, y, 195, y);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("TOTAL COMISSÕES ACUMULADAS:", 140, y + 5, { align: "right" });
      doc.text(`R$ ${payrollData.comissaoBruta.toFixed(2)}`, 192, y + 5, { align: "right" });

      doc.text("TAXA ABATIMENTO ACAREAÇÃO:", 140, y + 9, { align: "right" });
      doc.text(`- R$ ${payrollData.totalAbatido.toFixed(2)}`, 192, y + 9, { align: "right" });

      doc.text("VALES RETIDOS / ADIANTAMENTOS:", 140, y + 13, { align: "right" });
      doc.text(`- R$ ${payrollData.totalVales.toFixed(2)}`, 192, y + 13, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("VALOR LÍQUIDO REPASSADO:", 140, y + 19, { align: "right" });
      doc.text(`R$ ${payrollData.comissaoTotal.toFixed(2)}`, 192, y + 19, { align: "right" });

      y += 25;

      // 5. Termo de Quitação & Assinaturas
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("DECLARAÇÃO DE COMPROMISSO & QUITAÇÃO FINANCEIRA", 15, y);
      
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const quitacaoText = "Quito para todos os efeitos as prestações de serviços acima detalhadas, de forma plena e irrevogável, não restando qualquer pendência financeira ou de carga de mercadorias referente ao período mencionado. Assinaturas abaixo validam legalmente este recibo sob as normas vigentes.";
      const wrappedQuitacao = doc.splitTextToSize(quitacaoText, 180);
      doc.text(wrappedQuitacao, 15, y);

      y += 24;

      // Linhas para assinaturas de ambas as partes
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
      
      // Assinatura 1: Distribuidora
      doc.line(20, y, 90, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(receiptTitle, 32, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Administrativo / Pagador", 44, y + 8);

      // Assinatura 2: Prestador
      doc.setDrawColor(15, 23, 42);
      doc.line(120, y, 190, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(selectedDeliverer.nome, 125, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Assinatura do Credor / Sacado", 135, y + 8);

      // Nome do Arquivo de saída
      const delivererName = selectedDeliverer.nome || 'Entregador';
      const fileName = `recibo-pagamento-${delivererName.trim().toLowerCase().replace(/\s+/g, '-')}.pdf`;

      // Salva o arquivo de maneira nativa e robusta
      doc.save(fileName);

      // Dispara a janela de impressão do frame caso seja suportado
      try {
        window.print();
      } catch (err) {
        console.warn('Foco de impressão nativa:', err);
      }
    } catch (error) {
      console.error('Erro de geração direta do PDF de holerite:', error);
      try {
        window.print();
      } catch (e) {}
    } finally {
      setIsExporting(false);
    }
  };

  const handleTriggerPaymentReceipt = () => {
    if (!payrollData) return;

    if (onAddRecibo) {
      const novoRecibo: ReciboPagamento = {
        id: `recibo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        entregadorId: selectedEntregadorId,
        entregadorNome: selectedDeliverer?.nome || "",
        periodoInicio: startDate,
        periodoFim: endDate,
        totalDevolvidos: payrollData.totalDevolvidos,
        taxaAbatimento: taxaAbatimentoDevolucao || 0,
        totalAbatido: payrollData.totalAbatido,
        comissaoTotal: payrollData.comissaoTotal,
        dataHora: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username || 'Administrador',
        filialId: selectedDeliverer?.filialId || ""
      };
      onAddRecibo(novoRecibo);
    }

    setShowReceipt(true);
  };

  return (
    <div className="space-y-6" id="view-folha">

      {/* BARRA DE TÍTULO DA TELA COM BOTÃO DE HISTÓRICO GERAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <DollarSign className="h-5 w-5 text-emerald-500 shrink-0" />
            Fechamento de Repasse Salarial
          </h2>
          <p className="text-[11px] text-slate-400 font-medium leading-normal">
            Calcule comissões por pacotes entregues, liquide abatimentos de acareação e emita recibos de vales.
          </p>
        </div>
        
        {/* Botão de Histórico Geral */}
        <button
          type="button"
          onClick={() => setShowHistoryModal(true)}
          className="bg-slate-800 hover:bg-slate-950 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition hover:shadow-md cursor-pointer shrink-0"
        >
          <History className="h-4 w-4 text-emerald-400 shrink-0" />
          Ver Histórico de Vales e Abatimentos
        </button>
      </div>
      
      {currentUser.permissions.folha_readonly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-sm">
          <Lock className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
          <span>
            <strong>Modo de Leitura Ativo:</strong> Suas permissões no sistema são de apenas consulta. O fechamento financeiro de repasse e a emissão de demonstrativos estão protegidos.
          </span>
        </div>
      )}
      
      {/* Se não estiver exibindo o recibo inteiro para impressão */}
      {!showReceipt ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUNA ESQUERDA: PARÂMETROS E VALES */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* PAINEL DE FILTROS E PARÂMETROS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Parâmetros de Fechamento
              </h3>

              {/* Selecionar Filial */}
              <div className="space-y-1.5">
                <label htmlFor="payroll-filial" className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  Filial de Fechamento
                </label>
                <select
                  id="payroll-filial"
                  value={selectedFilialId}
                  onChange={(e) => { setSelectedFilialId(e.target.value); setShowReceipt(false); }}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {allowedFiliais.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} ({f.cidade || f.estado || 'SP'})</option>
                  ))}
                  {allowedFiliais.length === 0 && (
                    <option value="" disabled>Nenhuma filial autorizada</option>
                  )}
                </select>
              </div>

              {/* Selecionar Entregador */}
              <div className="space-y-1.5">
                <label htmlFor="payroll-entregador" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Selecione o Entregador
                </label>
                <select
                  id="payroll-entregador"
                  value={selectedEntregadorId}
                  onChange={(e) => { setSelectedEntregadorId(e.target.value); setShowReceipt(false); }}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Selecione para calcular...</option>
                  {filteredEntregadores.map(e => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                  {filteredEntregadores.length === 0 && selectedFilialId && (
                    <option value="" disabled>Nenhum entregador nesta filial</option>
                  )}
                </select>
              </div>

              {/* Filtros de Período de Data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="payroll-start" className="block text-[11px] font-bold text-slate-400 uppercase">Data Inicial</label>
                  <input
                    id="payroll-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setShowReceipt(false); }}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="payroll-end" className="block text-[11px] font-bold text-slate-400 uppercase">Data Final</label>
                  <input
                    id="payroll-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setShowReceipt(false); }}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label htmlFor="payroll-abatimento" className="block text-[11px] font-bold text-slate-400 uppercase">
                    TAXA DE ABATIMENTO DE ACAREAÇÃO
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                    <input
                      id="payroll-abatimento"
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={taxaAbatimentoInput}
                      onChange={handleTaxaAbatimentoChange}
                      className="w-full bg-slate-50 border border-slate-200 pl-8 pr-2.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Atalhos rápidos de períodos */}
              <div className="space-y-1 pt-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Atalhos de Período</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod(7)}
                    className="py-1 px-2 text-[10px] font-bold bg-slate-50 border border-slate-250 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                  >
                    7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod(15)}
                    className="py-1 px-2 text-[10px] font-bold bg-slate-50 border border-slate-250 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                  >
                    15 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod(30)}
                    className="py-1 px-2 text-[10px] font-bold bg-slate-50 border border-slate-250 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                  >
                    30 dias
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-50/55 border border-blue-100 rounded-xl space-y-1 text-[10.5px] text-blue-800 leading-normal font-medium">
                <p className="font-bold">Como funciona?</p>
                <p>• O sistema busca todas as saídas no período.</p>
                <p>• Só remunera pacotes com status de <strong>'Entregue'</strong>.</p>
              </div>

            </div>

            {/* PAINEL DE EMISSÃO DE VALE / ANTECIPAÇÃO */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-500 shrink-0" />
                Opção de Vale (Antecipação)
              </h3>

              <div className="space-y-3">
                {/* Selecionar Entregador */}
                <div className="space-y-1.5">
                  <label htmlFor="vale-entregador" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Entregador Solicitante
                  </label>
                  <select
                    id="vale-entregador"
                    value={valeEntregadorId}
                    onChange={(e) => setValeEntregadorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="">Selecione o entregador...</option>
                    {filteredEntregadores.map(e => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                    {filteredEntregadores.length === 0 && selectedFilialId && (
                      <option value="" disabled>Nenhum entregador nesta filial</option>
                    )}
                  </select>
                </div>

                {/* Valor do Vale */}
                <div className="space-y-1.5">
                  <label htmlFor="vale-valor" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Valor do Vale (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                    <input
                      id="vale-valor"
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={valeValorInput}
                      onChange={handleValeValorChange}
                      className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Motivo do Vale */}
                <div className="space-y-1.5">
                  <label htmlFor="vale-observacao" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Motivo / Observação do Vale
                  </label>
                  <textarea
                    id="vale-observacao"
                    rows={2}
                    placeholder="Ex: Combustível, manutenção, adiantamento..."
                    value={valeObservacao}
                    onChange={(e) => setValeObservacao(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-medium text-slate-705 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    maxLength={100}
                  />
                </div>

                {/* Botão Gerar Vale */}
                <button
                  type="button"
                  id="btn-generate-vale"
                  disabled={currentUser.permissions.folha_readonly}
                  onClick={handleGenerateVale}
                  className={`w-full text-white font-bold text-xs p-3 rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition ${currentUser.permissions.folha_readonly ? 'bg-amber-300 cursor-not-allowed shadow-none' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10'}`}
                >
                  <FileText className="h-4 w-4" />
                  Gerar Vale (Emitir Recibo)
                </button>
              </div>

              {currentUser.permissions.folha_readonly && (
                <p className="text-[10px] text-amber-600 font-medium text-center">
                  * Indisponível em modo de apenas consulta.
                </p>
              )}
            </div>

          </div>

          {/* PAINEL CENTRAL DE RESUMO FINANCEIRO INTEGRADO */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col justify-between min-h-[440px]">
            <div>
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  Demonstrativo de Pagamento
                </h3>
                {selectedDeliverer && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase">
                    Status: Ativo
                  </span>
                )}
              </div>

              {!selectedEntregadorId || !payrollData ? (
                <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                  <DollarSign className="h-12 w-12 mx-auto text-slate-300 stroke-1 mb-2" />
                  <p className="font-semibold text-slate-500">Selecione o entregador desejado</p>
                  <p className="text-xs text-slate-400 mt-1">Insira os filtros de data no painel lateral e escolha o cooperado para emitir o demonstrativo.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Cards de Métricas do Fechamento do Período */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" id="payroll-overview-cards">
                    
                    {/* Carga Carregada */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3 shadow-inner">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Carga Total</span>
                        <h4 className="text-xl font-extrabold text-slate-800">{payrollData.totalVolumesCarregados}</h4>
                        <span className="text-[9px] text-slate-400">Pacotes expedidos</span>
                      </div>
                    </div>

                    {/* Devoluções Deduções */}
                    <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center space-x-3">
                      <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                        <RotateCcw className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-rose-400 uppercase">Devoluções (Glosa)</span>
                        <h4 className="text-xl font-extrabold text-rose-800">{payrollData.totalDevolvidos}</h4>
                        <span className="text-[9px] text-rose-500 font-medium">{payrollData.totalVolumesCarregados > 0 ? Math.round((payrollData.totalDevolvidos / payrollData.totalVolumesCarregados) * 100) : 0}% abatido da carga</span>
                      </div>
                    </div>

                    {/* Vales Deduções */}
                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 flex items-center space-x-3">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-amber-500 uppercase font-sans">Vales Retidos</span>
                        <h4 className="text-xl font-extrabold text-amber-800">R$ {payrollData.totalVales.toFixed(2)}</h4>
                        <span className="text-[9px] text-amber-500 font-medium">Antecipado p/ o motorista</span>
                      </div>
                    </div>

                    {/* Crédito Líquido à Pagar */}
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-150 flex items-center space-x-3">
                      <div className="p-2.5 bg-emerald-500 text-white rounded-lg">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Valor Líquido</span>
                        <h4 className="text-xl font-black text-emerald-800">
                          R$ {payrollData.comissaoTotal.toFixed(2)}
                        </h4>
                        <span className="text-[9px] text-emerald-600 font-semibold">{payrollData.totalEntregues} entregues c/ sucesso</span>
                      </div>
                    </div>

                  </div>

                  {/* Detalhamento de Comissões por Empresa */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detalhamento por Operação Parceira</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-left">
                          <tr>
                            <th scope="col" className="px-4 py-3">Empresa Cliente</th>
                            <th scope="col" className="px-4 py-3 text-center">Taxa Comissão</th>
                            <th scope="col" className="px-4 py-3 text-center">Enviados</th>
                            <th scope="col" className="px-4 py-3 text-center">Devolvidos</th>
                            <th scope="col" className="px-4 py-3 text-center">Entregues</th>
                            <th scope="col" className="px-4 py-3 text-right">Crédito Provisório</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {payrollData.detalheEmpresas.map((det, index) => (
                            <tr key={index} className="hover:bg-slate-50/40">
                              <td className="px-4 py-2.5 font-bold text-slate-800">{det.nome}</td>
                              <td className="px-4 py-2.5 text-center font-semibold text-slate-600">R$ {det.comissaoUnidade.toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-center font-medium text-slate-500">{det.enviados}</td>
                              <td className="px-4 py-2.5 text-center font-medium text-rose-500 font-bold">{det.devolvidos}</td>
                              <td className="px-4 py-2.5 text-center text-emerald-600 font-extrabold">{det.entregues}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-800">R$ {det.totalComissao.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Detalhamento de Vales do Período */}
                  {payrollData.valesList && payrollData.valesList.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pt-2">
                        <DollarSign className="h-4 w-4 text-amber-500 shrink-0" />
                        Histórico de Vales / Adiantamentos no Período
                      </h4>
                      <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-100 text-xs">
                          <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-left">
                            <tr>
                              <th scope="col" className="px-4 py-3">Código/Data</th>
                              <th scope="col" className="px-4 py-3">Autorizado por</th>
                              <th scope="col" className="px-4 py-3 text-right">Valor do Vale</th>
                              <th scope="col" className="px-4 py-3 text-center print:hidden">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100">
                            {payrollData.valesList.map((v) => (
                              <tr key={v.id} className="hover:bg-slate-50/40">
                                <td className="px-4 py-2.5 font-mono">
                                  <span className="font-bold text-slate-800">{v.id.substring(0, 8).toUpperCase()}</span>
                                  <span className="block text-[10px] text-slate-400 font-sans">{new Date(v.dataHora).toLocaleDateString('pt-BR')} {new Date(v.dataHora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 font-medium">{v.usuarioNome || "Administrador"}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-amber-600 font-mono">R$ {v.valor.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-center print:hidden">
                                  <div className="flex justify-center gap-1.5">
                                    <button
                                      onClick={() => setActiveValeReceipt(v)}
                                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline py-1 px-2 text-[11px] bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                      title="Imprimir Recibo de Vale"
                                    >
                                      Imprimir Recibo
                                    </button>
                                    {!currentUser.permissions.folha_readonly && onDeleteVale && (
                                      <button
                                        onClick={() => {
                                          if (confirm("Confirmar exclusão deste vale? Ele retornará como crédito no fechamento sonegando o desconto.")) {
                                            onDeleteVale(v.id);
                                          }
                                        }}
                                        className="text-rose-600 hover:text-rose-800 font-bold hover:underline py-1 px-2 text-[11px] bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                                        title="Excluir"
                                      >
                                        Excluir
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Botão de Fechamento & Geração de Recibo */}
                  <div className="flex justify-end pt-3">
                    <button
                      id="btn-trigger-payment-receipt"
                      onClick={() => handleTriggerPaymentReceipt()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 transition"
                    >
                      <FileText className="h-4 w-4" />
                      GERAR RECIBO DE PAGAMENTO
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Aviso Rodapé */}
            <div className="mt-4 p-4 bg-slate-50 border border-slate-150 rounded-xl text-[10px] text-slate-400">
              * Para exportar como PDF ou imprimir em impressoras térmicas/jato de tinta, utilize o recibo gerado clicando no botão acima. O documento já carrega assinaturas cruzadas protocolares.
            </div>

          </div>

        </div>
      ) : (
        /* TELA DE RECIBO DE PAGAMENTO PROFISSIONAL (HOLERITE LOGÍSTICO) */
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-slate-150 max-w-3xl mx-auto space-y-6"
          id="receipt-holerite-card"
        >
          {/* Painel Administrativo de Controle para Exportar */}
          <div className="flex justify-between items-center print:hidden bg-slate-50 p-4 border border-slate-100 rounded-xl">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Recibo Emitido Prontamente!
            </span>
            <div className="flex gap-2">
              <button
                id="btn-print-receipt-pdf"
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${isExporting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isExporting ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    Exportar PDF / Imprimir Recibo
                  </>
                )}
              </button>
              <button
                id="btn-back-to-payroll"
                onClick={() => setShowReceipt(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                Voltar aos Filtros
              </button>
            </div>
          </div>

          {/* CORPO DO RECIBO COM CSS @MEDIA PRINT CONFIGURADO */}
          <div className="p-6 border border-slate-900 rounded-md font-serif text-[11px] text-black space-y-6 uppercase print:border-none print:p-0" id="receipt-printable-area">
            
            {/* Header com Logo */}
            <div className="flex justify-between items-start border-b border-slate-900 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white shrink-0">
                    <Building className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight text-slate-950">{receiptTitle}</h2>
                    <p className="text-[9px] text-slate-500 font-sans tracking-wide">{receiptAddress}</p>
                  </div>
                </div>
              </div>
              <div className="text-right font-sans text-[10px]">
                <span className="block font-bold">RECIBO DE PRESTAÇÃO DE CONTAS</span>
                <span className="block text-slate-500 font-semibold uppercase mt-0.5">PERÍODO: {new Date(startDate).toLocaleDateString('pt-BR')} A {new Date(endDate).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {/* Declaração de Recebimento de Valores */}
            <div className="leading-relaxed text-justify font-sans text-xs lowercase first-letter:uppercase text-slate-800">
              Recebi de <strong>{receiptTitle}</strong>, inscrita no CNPJ sob o nº <strong>{receiptCNPJ}</strong>, a importância líquida de <strong>R$ {payrollData?.comissaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (por extenso: <strong>{numberToWords(payrollData?.comissaoTotal || 0)}</strong>), referente à comissão pactuada de fretes e entregas porta-a-porta executadas no período compreendido de {new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')}.
            </div>

            {/* Informações detalhadas do beneficiário */}
            <div className="grid grid-cols-2 gap-4 border-y border-slate-900 py-3 text-xs font-sans">
              <div>
                <span className="block text-[9px] text-slate-400 font-bold uppercase shrink-0">Prestador Credenciado (Favorecido)</span>
                <span className="block font-black text-slate-800">{selectedDeliverer?.nome}</span>
                <span className="block mt-0.5">CPF: {selectedDeliverer?.cpf}</span>
                <span className="block">Contato: {selectedDeliverer?.contato}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 font-bold uppercase">Resultado Consolidado da Atividade</span>
                <span className="block font-semibold">Total Cargas Expedidas: {payrollData?.totalVolumesCarregados} volumes</span>
                <span className="block text-rose-700 font-semibold font-mono">Devoluções Abatidas: {payrollData?.totalDevolvidos} unidades</span>
                <span className="block text-emerald-700 font-black">Entregas Efetivadas: {payrollData?.totalEntregues} pacotes pagos</span>
              </div>
            </div>

            {/* Demonstrativo da Conta */}
            <div className="space-y-2">
              <span className="font-bold font-sans text-xs border-b border-slate-300 pb-0.5 block">Discriminação das Atividades</span>
              <table className="w-full text-left uppercase text-[9px] font-sans">
                <thead>
                  <tr className="border-b border-slate-900 font-bold text-slate-600">
                    <th scope="col" className="py-1">Atendimento Partner</th>
                    <th scope="col" className="py-1 text-center">Comissão Un.</th>
                    <th scope="col" className="py-1 text-center">Carregados</th>
                    <th scope="col" className="py-1 text-center">Devolvidos (-/Abatido)</th>
                    <th scope="col" className="py-1 text-center">Efetivados</th>
                    <th scope="col" className="py-1 text-right">Subtotal Creditado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollData?.detalheEmpresas.map((det, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-bold">{det.nome}</td>
                      <td className="py-1.5 text-center">R$ {det.comissaoUnidade.toFixed(2)}</td>
                      <td className="py-1.5 text-center">{det.enviados}</td>
                      <td className="py-1.5 text-center text-rose-600 font-bold">{det.devolvidos}</td>
                      <td className="py-1.5 text-center text-emerald-600 font-bold">{det.entregues}</td>
                      <td className="py-1.5 text-right font-black">R$ {det.totalComissao.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-300 text-slate-500 text-[10px]">
                    <td colSpan={4} className="py-1 text-right">COMISSÕES ACUMULADAS:</td>
                    <td colSpan={2} className="py-1 text-right font-semibold">R$ {payrollData?.comissaoBruta.toFixed(2)}</td>
                  </tr>
                  <tr className="text-slate-500 text-[10px]">
                    <td colSpan={4} className="py-1 text-right">TAXA DE ABATIMENTO DE ACAREAÇÃO:</td>
                    <td colSpan={2} className="py-1 text-right font-semibold text-rose-600">- R$ {payrollData?.totalAbatido.toFixed(2)}</td>
                  </tr>
                  <tr className="text-slate-500 text-[10px]">
                    <td colSpan={4} className="py-1 text-right">VALES RETIDOS / ADIANTAMENTOS:</td>
                    <td colSpan={2} className="py-1 text-right font-semibold text-amber-600">- R$ {payrollData?.totalVales.toFixed(2)}</td>
                  </tr>
                  <tr className="border-t border-slate-900 font-bold text-xs">
                    <td colSpan={4} className="py-2 text-right">TOTAL LÍQUIDO REPASSADO:</td>
                    <td colSpan={2} className="py-2 text-right font-black text-slate-950">R$ {payrollData?.comissaoTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-[9px] text-slate-400 font-sans leading-relaxed text-justify">
              Quito para todos os efeitos as prestações de serviços acima detalhadas, de forma plena e irrevogável, não restando qualquer pendência financeira ou de carga referente ao período mencionado. Assinaturas abaixo validam legalmente este recibo.
            </div>

            {/* Linha de Assinatura Dupla */}
            <div className="grid grid-cols-2 gap-10 pt-12 text-center font-sans tracking-tight text-[10px]">
              <div>
                <div className="border-t border-slate-900 mx-auto w-44 pt-1.5 text-slate-500 font-bold">
                  {receiptTitle}
                </div>
                <span className="text-[8px] text-slate-400 uppercase">Administrativo / Pagador</span>
              </div>
              
              <div>
                <div className="border-t border-slate-900 mx-auto w-48 pt-1.5 text-slate-950 font-black">
                  {selectedDeliverer?.nome}
                </div>
                <span className="text-[8px] text-slate-400 uppercase">Assinatura do Credor / Sacado</span>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* MODAL HOLERITE DE VALE (CHEQUE ESTILIZADO) */}
      <AnimatePresence>
        {activeValeReceipt && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#f0ece1] border-2 border-slate-300 p-6 md:p-8 rounded-3xl shadow-2xl max-w-2xl w-full text-slate-800 relative font-serif"
            >
              {/* Botão de Fechar */}
              <button 
                onClick={() => setActiveValeReceipt(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 bg-white/80 hover:bg-white rounded-full p-2 transition whitespace-nowrap print:hidden shadow-sm z-50"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>

              {(() => {
                const valeDeliverer = entregadores.find(e => e.id === activeValeReceipt.entregadorId);
                const valeFilial = valeDeliverer?.filialId ? filiais.find(f => f.id === valeDeliverer.filialId) : null;
                const valeFilialNome = (valeFilial?.nome || "EXPEDLOG LOGISTICA & DISTRIBUIÇÃO").toUpperCase();
                const valeFilialCidade = (valeFilial?.cidade || "CONGONHAS").toUpperCase();
                const valeFilialEstado = (valeFilial?.estado || "SP").toUpperCase();

                return (
                  <div className="border border-slate-900 rounded-xl p-6 space-y-6 relative bg-[#fdfaf2] shadow-inner font-sans">
                    {/* Dotted border accent */}
                    <div className="absolute inset-1.5 border border-dashed border-slate-300 rounded-lg pointer-events-none"></div>

                    {/* Header */}
                    <div className="flex justify-between items-start relative z-10 border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="text-sm font-black tracking-tight text-slate-950">{valeFilialNome}</h2>
                        <p className="text-[9px] text-slate-500 font-sans tracking-wide uppercase">{valeFilialCidade} - {valeFilialEstado}</p>
                      </div>
                      <div className="bg-white/90 border-2 border-slate-950 px-4 py-1.5 rounded-lg text-right font-black text-sm font-mono shrink-0">
                        R$ {activeValeReceipt.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="space-y-4 relative z-10">
                      <h3 className="text-center font-black text-slate-800 text-sm tracking-widest border-b border-dashed border-slate-200 pb-2 uppercase">
                        RECIBO DE VALE (ANTECIPAÇÃO)
                      </h3>

                      <p className="text-xs leading-relaxed text-slate-800 text-justify font-sans normal-case">
                        Pague-se por este recibo de vale a importância de <strong className="uppercase font-bold">{numberToWords(activeValeReceipt.valor)}</strong> ao motorista credenciado <strong className="uppercase font-extrabold text-slate-900">{activeValeReceipt.entregadorNome}</strong>, como antecipação de pagamento de comissão de frete.{activeValeReceipt.observacao && <span> Motivo: <strong className="text-slate-950 underline decoration-dotted">{activeValeReceipt.observacao}</strong>.</span>}
                      </p>

                      <div className="text-[11px] font-semibold text-slate-600 block text-right pt-2">
                        {valeFilialCidade}, {new Date(activeValeReceipt.dataHora).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
                      </div>
                    </div>

                    {/* Rodapé e Assinaturas */}
                    <div className="grid grid-cols-2 gap-10 pt-8 relative z-10 text-center text-[10px]">
                      <div>
                        <div className="border-t border-slate-900 pt-1 text-slate-600 font-bold uppercase font-sans">
                          ● {activeValeReceipt.usuarioNome || 'Administrador'}
                        </div>
                        <span className="text-[8px] text-slate-400 uppercase font-bold">ADMINISTRATIVO / PAGADOR</span>
                      </div>
                      <div>
                        <div className="border-t border-slate-900 pt-1 text-slate-950 font-black uppercase font-sans">
                          {activeValeReceipt.entregadorNome}
                        </div>
                        <span className="text-[8px] text-slate-400 uppercase font-bold">ASSINATURA DO ENTREGADOR</span>
                      </div>
                    </div>

                    {/* Barcode representation */}
                    <div className="text-center font-mono text-[9px] text-slate-400 select-none pt-4 relative z-10">
                      ⑆ 001358 ⑆ 098412 ⑈ {activeValeReceipt.id.substring(0, 8).toUpperCase()} ⑈
                    </div>
                  </div>
                );
              })()}

              {/* Actions bar inside modal */}
              <div className="flex justify-end gap-3 mt-6 print:hidden">
                <button
                  onClick={() => handleExportValePDF(activeValeReceipt)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-blue-500/15"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir / Baixar Cheque PDF
                </button>
                <button
                  onClick={() => setActiveValeReceipt(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE HISTÓRICO GERAL DE VALES E ABATIMENTOS DE ACAREAÇÃO */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[85vh]"
            >
              {/* Header do Modal */}
              <div className="bg-white p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">Histórico de Vales e Abatimentos de Acareação</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Consulte registros retroativos, glosas de devoluções e emita duplicatas de recibos.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    setExpandedDriverId(null);
                  }}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 p-2 rounded-xl transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Filtros e Controles do Histórico */}
              <div className="bg-white px-5 py-4 border-b border-slate-150 grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
                {/* Data Inicio */}
                <div className="space-y-1">
                  <label htmlFor="hist-start" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Período Inicial</label>
                  <input
                    id="hist-start"
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                {/* Data Fim */}
                <div className="space-y-1">
                  <label htmlFor="hist-end" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Período Final</label>
                  <input
                    id="hist-end"
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                {/* Selecionar Filial */}
                <div className="space-y-1">
                  <label htmlFor="hist-filial" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Filial</label>
                  <select
                    id="hist-filial"
                    value={historyFilialId}
                    onChange={(e) => setHistoryFilialId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="todas">Todas as Filiais</option>
                    {filiais.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
                {/* Selecionar Entregador */}
                <div className="space-y-1">
                  <label htmlFor="hist-entregador" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Entregador</label>
                  <select
                    id="hist-entregador"
                    value={historyEntregadorId}
                    onChange={(e) => setHistoryEntregadorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="todos">Todos os Entregadores</option>
                    {entregadores
                      .filter(driver => historyFilialId === 'todas' || driver.filialId === historyFilialId)
                      .map(e => (
                        <option key={e.id} value={e.id}>{e.nome}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {/* Tabs de Seleção */}
              <div className="bg-white border-b border-slate-100 flex px-5 py-1 gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setHistoryTab('vales')}
                  className={`py-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition ${historyTab === 'vales' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Vales Emitidos ({computedHistoryVales.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('abatimentos')}
                  className={`py-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition ${historyTab === 'abatimentos' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Abatimentos de Acareação ({computedHistoryAbatimentos.length})
                </button>
              </div>

              {/* Área com Scroll */}
              <div className="flex-1 p-5 overflow-y-auto">
                {historyTab === 'vales' ? (
                  /* TAB DE VALES */
                  computedHistoryVales.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Nenhum vale encontrado para este período/filtros.</p>
                      <p className="text-slate-400 text-[10px] mt-1">Experimente alterar as datas ou selecionar outro entregador.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse bg-white rounded-2xl overflow-hidden shadow-xs border border-slate-100">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            <th className="px-4 py-3">Data / Hora</th>
                            <th className="px-4 py-3">Entregador</th>
                            <th className="px-4 py-3">Motivo / Obs</th>
                            <th className="px-4 py-3">Autorizado Por</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                            <th className="px-4 py-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[11px] font-semibold text-slate-600">
                          {computedHistoryVales.map(v => (
                            <tr key={v.id} className="hover:bg-slate-50/70 transition">
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-400">
                                {new Date(v.dataHora).toLocaleDateString('pt-BR')} {new Date(v.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3">
                                <span className="block font-bold text-slate-800">{v.entregadorNome}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">
                                  {filiais.find(f => f.id === v.filialId)?.nome || "Sem filial"}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-xs truncate text-slate-500 font-medium">
                                {v.observacao || <span className="text-slate-300 italic">Nenhum motivo informado</span>}
                              </td>
                              <td className="px-4 py-3 text-slate-400">
                                {v.usuarioNome || "Administrador"}
                              </td>
                              <td className="px-4 py-3 text-right text-amber-600 font-bold font-mono text-xs">
                                R$ {v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setActiveValeReceipt(v)}
                                    className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-[10px] font-bold flex items-center gap-1 transition"
                                  >
                                    <Printer className="h-3 w-3 text-slate-500" />
                                    Visualizar Recibo
                                  </button>
                                  {!currentUser.permissions.folha_readonly && onDeleteVale && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Confirma a exclusão deste vale de R$ ${v.valor.toFixed(2)} emitido para ${v.entregadorNome}? Esta ação é irreversível e o valor será devolvido ao saldo a pagar.`)) {
                                          onDeleteVale(v.id);
                                        }
                                      }}
                                      className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition"
                                      title="Excluir Vale"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  /* TAB DE ABATIMENTOS DE devoluções */
                  computedHistoryAbatimentos.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Nenhum abatimento de acareação encontrado neste período.</p>
                      <p className="text-slate-400 text-[10px] mt-1">Só aparecem entregadores com pacotes marcados como "devolvidos" no intervalo selecionado.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      
                      <div className="bg-amber-50/50 p-3.5 px-4 rounded-xl border border-amber-100 flex items-start gap-2.5 text-amber-800 text-xs font-medium">
                        <Info className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Informação sobre a Regra de Negócio de Acareação:</p>
                          <p className="text-[10.5px] text-amber-700 mt-0.5">Os abatimentos são glosas debitadas do repasse do entregador baseadas em pacotes devolvidos sem justificativa aceita no período. A taxa atual configurada na tela principal é de <strong className="font-bold">R$ {taxaAbatimentoDevolucao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> por pacote devolvido.</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              <th className="px-4 py-3">Entregador</th>
                              <th className="px-4 py-3">Filial</th>
                              <th className="px-4 py-3 text-center">Quantidade de Devoluções</th>
                              <th className="px-4 py-3 text-right">Abatimento de Acareação</th>
                              <th className="px-4 py-3 text-center">Detalhes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-[11px] font-semibold text-slate-600">
                            {computedHistoryAbatimentos.map(item => {
                              const isExpanded = expandedDriverId === item.id;
                              return (
                                <React.Fragment key={item.id}>
                                  <tr className="hover:bg-slate-50/40 transition">
                                    <td className="px-4 py-3.5">
                                      <span className="block font-bold text-slate-800">{item.entregadorNome}</span>
                                      <span className="block text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Período: {item.periodo}</span>
                                      <span className="block text-[9px] text-slate-400 font-mono italic mt-0.5">Registrado em {item.dataGeracao}</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-400 uppercase">{item.filialNome}</td>
                                    <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">{item.totalDevolvidos} un.</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-extrabold text-rose-600 font-mono text-xs">
                                      - R$ {item.totalAbatido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedDriverId(isExpanded ? null : item.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-bold transition hover:underline"
                                      >
                                        {isExpanded ? 'Ocultar Ocorrências ▲' : 'Ver Ocorrências (' + item.detalhesOcorrencias.length + ') ▼'}
                                      </button>
                                    </td>
                                  </tr>
                                  
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={5} className="bg-slate-50 p-4 border-t border-b border-slate-100">
                                        <div className="space-y-2 max-h-52 overflow-y-auto">
                                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ocorrências de Devolução Relacionadas:</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                            {item.detalhesOcorrencias.map((oc, idx) => (
                                              <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-xs flex flex-col justify-between">
                                                <div>
                                                  <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                                                    <span>Expedição: {oc.codigoExpedicao}</span>
                                                    <span>{new Date(oc.data).toLocaleDateString('pt-BR')}</span>
                                                  </div>
                                                  <p className="text-xs font-bold text-slate-700 mt-1">{oc.empresaNome}</p>
                                                </div>
                                                <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100 text-[10px]">
                                                  <span className="text-slate-400 font-medium">Glosa Rejeitada</span>
                                                  <span className="text-rose-600 font-mono font-bold">{oc.quantidade} un. devolvida</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Rodapé do Modal */}
              <div className="bg-slate-150 px-5 py-3.5 border-t border-slate-200/60 flex justify-end shrink-0 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    setExpandedDriverId(null);
                  }}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-black text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md"
                >
                  Fechar Histórico
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Pequeno conversor de número para texto por extenso (Básico para exibição visual do recibo logístico)
function numberToWords(num: number): string {
  if (num === 0) return "zero reais";
  
  const reais = Math.floor(num);
  const centavos = Math.round((num - reais) * 100);
  
  let extensoStr = `${reais} reais`;
  if (centavos > 0) {
    extensoStr += ` e ${centavos} centavos`;
  }
  return extensoStr;
}
