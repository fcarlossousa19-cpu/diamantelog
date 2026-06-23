/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, collection, query, where, onSnapshot } from '../lib/supabase';
import { 
  ClipboardList, 
  Scan, 
  HelpCircle, 
  Building, 
  User as UserIcon, 
  Check, 
  X, 
  Search, 
  SlidersHorizontal, 
  ArrowUpLeft,
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowDownRight,
  ArrowLeft,
  CornerUpLeft,
  RotateCcw, 
  Plus, 
  Trash2,
  PackageCheck,
  Package,
  Calendar,
  Layers,
  MapPin,
  Map,
  FileDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Empresa, Entregador, Expedicao, Pacote, User as SystemUser, Filial, ItemEstoque, MovimentacaoEstoque, Rota, ConciliacaoDiaria } from '../types';

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }
};

interface EstoqueViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  expedicoes: Expedicao[];
  rotas: Rota[];
  currentUser: SystemUser;
  filiais: Filial[];
  estoque: ItemEstoque[];
  movimentacoesEstoque: MovimentacaoEstoque[];
  onUpdateEstoque: (updatedEstoque: ItemEstoque[], updatedMovimentacoes: MovimentacaoEstoque[]) => void;
  usersList?: SystemUser[];
  conciliacoesDiarias?: ConciliacaoDiaria[];
  onUpdateConciliacao?: (conciliacao: ConciliacaoDiaria) => void;
  onClearTodayExpedicoes?: (dateStr: string) => void;
}

export default function EstoqueView({
  empresas,
  entregadores,
  expedicoes,
  rotas,
  currentUser,
  filiais,
  estoque,
  movimentacoesEstoque,
  onUpdateEstoque,
  usersList = [],
  conciliacoesDiarias = [],
  onUpdateConciliacao,
  onClearTodayExpedicoes
}: EstoqueViewProps) {
  // Current filial selection
  const userPermittedFiliais = useMemo(() => {
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      return filiais || [];
    }
    const permittedIds = currentUser.filiais || [];
    return (filiais || []).filter(f => permittedIds.includes(f.id));
  }, [filiais, currentUser]);

  const [selectedFilialId, setSelectedFilialId] = useState<string>(() => {
    if (currentUser.defaultFilialId && userPermittedFiliais.some(f => f.id === currentUser.defaultFilialId)) {
      return currentUser.defaultFilialId;
    }
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      const permittedIds = currentUser.filiais || [];
      if (permittedIds.length > 0) return permittedIds[0];
      return (filiais && filiais.length > 0) ? filiais[0].id : '';
    }
    const permittedIds = currentUser.filiais || [];
    return permittedIds.length > 0 ? permittedIds[0] : '';
  });

  // Basic States
  const isReadOnly = currentUser.permissions?.estoque_readonly === true;
  const canAlterSavedEstoque = currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master' || currentUser.permissions?.alterar_estoque_salvo === true;
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isZerarConfirmOpen, setIsZerarConfirmOpen] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);

  // Adicionar Pacote em Custódia Manual States
  const [isAddPacoteModalOpen, setIsAddPacoteModalOpen] = useState(false);
  const [addPacoteCompanyId, setAddPacoteCompanyId] = useState('');
  const [addPacoteBarcode, setAddPacoteBarcode] = useState('');
  const [addPacoteClassification, setAddPacoteClassification] = useState<'zona_rural' | 'avariado' | 'outra_cidade'>('zona_rural');

  // Limpar Pacotes por Empresa em Custódia States
  const [isLimparPacotesModalOpen, setIsLimparPacotesModalOpen] = useState(false);
  const [limparPacotesCompanyId, setLimparPacotesCompanyId] = useState('');

  // Pacotes cadastrados hoje para identificação na bipagem
  const todayDateStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [pacotesCadastradosHoje, setPacotesCadastradosHoje] = useState<{ codigoBarras: string; empresaId: string }[]>([]);

  useEffect(() => {
    if (!selectedFilialId || !todayDateStr) {
      setPacotesCadastradosHoje([]);
      return;
    }

    const q = query(
      collection(db, 'pacotes_cadastrados'),
      where('filialId', '==', selectedFilialId),
      where('data', '==', todayDateStr)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: { codigoBarras: string; empresaId: string }[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.codigoBarras && d.empresaId) {
          list.push({
            codigoBarras: String(d.codigoBarras).trim().toUpperCase(),
            empresaId: String(d.empresaId)
          });
        }
      });
      setPacotesCadastradosHoje(list);
    }, (err) => {
      console.error("Erro ao carregar pacotes cadastrados no estoque:", err);
    });

    return () => unsub();
  }, [selectedFilialId, todayDateStr]);

  const detectedCompany = useMemo(() => {
    const rawBarcode = addPacoteBarcode.trim().toUpperCase();
    if (!rawBarcode) return null;
    
    // 1. Tenta identificar por pacotesCadastradosHoje
    const matchedPackage = pacotesCadastradosHoje.find(p => p.codigoBarras === rawBarcode);
    if (matchedPackage) {
      return empresas.find(e => e.id === matchedPackage.empresaId) || null;
    }
    
    // 2. Tenta por prefixos
    for (const emp of empresas) {
      if (emp.prefixos) {
        const parts = emp.prefixos.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
        if (parts.some(prefix => rawBarcode.startsWith(prefix))) {
          return emp;
        }
      }
    }
    return null;
  }, [addPacoteBarcode, pacotesCadastradosHoje, empresas]);

  // States for the Extrato (Statement) Slideover Modal
  const [isExtratoOpen, setIsExtratoOpen] = useState(false);
  const [extratoSearchText, setExtratoSearchText] = useState('');
  const [extratoDriverFilter, setExtratoDriverFilter] = useState('');
  const [extratoRouteFilter, setExtratoRouteFilter] = useState('');
  const [extratoFilialFilter, setExtratoFilialFilter] = useState('');
  const [extratoTypeFilter, setExtratoTypeFilter] = useState('');
  const [extratoCompanyFilter, setExtratoCompanyFilter] = useState('');
  const [extratoOperatorFilter, setExtratoOperatorFilter] = useState('');
  const [extratoStartDate, setExtratoStartDate] = useState('');
  const [extratoEndDate, setExtratoEndDate] = useState('');

  // Feedback notifications
  const [errorFeedback, setErrorFeedback] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

  // Sincroniza a filial do extrato com a filial selecionada no cabeçalho por padrão
  useEffect(() => {
    setExtratoFilialFilter(selectedFilialId);
    setSelectedPackages([]);
  }, [selectedFilialId]);

  // --- CONCILIAÇÃO DE SAÍDAS DO PATIO DO DIA ---
  const [selectedConciliacaoDate, setSelectedConciliacaoDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [patioInputs, setPatioInputs] = useState<{[companyId: string]: string}>({});

  useEffect(() => {
    const inputs: {[companyId: string]: string} = {};
    empresas.forEach(emp => {
      const conciliacaoId = `${selectedConciliacaoDate}_${selectedFilialId}_${emp.id}`;
      const match = conciliacoesDiarias.find(c => c.id === conciliacaoId);
      inputs[emp.id] = match ? String(match.quantidadePatio) : '';
    });
    setPatioInputs(inputs);
  }, [selectedConciliacaoDate, selectedFilialId, conciliacoesDiarias, empresas]);

  const [localStorageTrigger, setLocalStorageTrigger] = useState(0);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentScannedItems' || e.key === 'currentSelectedFilialId') {
        setLocalStorageTrigger(prev => prev + 1);
      }
    };
    const interval = setInterval(() => {
      setLocalStorageTrigger(prev => prev + 1);
    }, 2500);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const totalBipadoByEmpresa = useMemo(() => {
    const counts: { [empresaId: string]: number } = {};
    empresas.forEach(emp => {
      counts[emp.id] = 0;
    });

    // To prevent double counting a unique package processed on the same day
    const processedBarcodes = new Set<string>();

    if (expedicoes) {
      expedicoes.forEach(exp => {
        if (exp.filialId !== selectedFilialId) return;
        if (!exp.dataHoraSaida) return;
        const expDate = exp.dataHoraSaida.substring(0, 10);
        if (expDate !== selectedConciliacaoDate) return;

        if (exp.itens && Array.isArray(exp.itens)) {
          exp.itens.forEach(item => {
            if (item.empresaId && counts[item.empresaId] !== undefined) {
              const barcodeUpper = String(item.codigoBarras).trim().toUpperCase();
              const uniqueKey = `${item.empresaId}_${barcodeUpper}`;
              if (!processedBarcodes.has(uniqueKey)) {
                counts[item.empresaId]++;
                processedBarcodes.add(uniqueKey);
              }
            }
          });
        }
      });
    }

    if (movimentacoesEstoque) {
      movimentacoesEstoque.forEach(mov => {
        if (mov.filialId !== selectedFilialId) return;
        if (!mov.dataHora) return;
        const movDate = mov.dataHora.substring(0, 10);
        if (movDate !== selectedConciliacaoDate) return;

        const isCustodiaManual = [
          'retirado_zona_rural', 
          'retirado_avariado', 
          'retirado_outra_cidade', 
          'retirada_filial'
        ].includes(mov.tipo);

        if (isCustodiaManual && mov.codigoBarras) {
          const barcodeUpper = mov.codigoBarras.trim().toUpperCase();
          const uniqueKey = `${mov.empresaId}_${barcodeUpper}`;
          if (!processedBarcodes.has(uniqueKey)) {
            if (mov.empresaId && counts[mov.empresaId] !== undefined) {
              counts[mov.empresaId]++;
              processedBarcodes.add(uniqueKey);
            }
          }
        }
      });
    }

    // Adiciona contagem de itens em tempo real vindos da remessa em andamento (ainda não finalizada)
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    const yyyy = localNow.getUTCFullYear();
    const mm = String(localNow.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(localNow.getUTCDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (selectedConciliacaoDate === todayStr) {
      try {
        const savedScanned = safeStorage.getItem('currentScannedItems');
        const activeScannedFilial = safeStorage.getItem('currentSelectedFilialId');

        if (savedScanned && (!activeScannedFilial || activeScannedFilial === selectedFilialId)) {
          const items = JSON.parse(savedScanned);
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              if (item && item.codigoBarras && item.empresaId) {
                const barcodeUpper = String(item.codigoBarras).trim().toUpperCase();
                const uniqueKey = `${item.empresaId}_${barcodeUpper}`;
                if (!processedBarcodes.has(uniqueKey)) {
                  if (counts[item.empresaId] !== undefined) {
                    counts[item.empresaId]++;
                    processedBarcodes.add(uniqueKey);
                  }
                }
              }
            });
          }
        }
      } catch (err) {
        console.error("Erro ao carregar itens escaneados em tempo real:", err);
      }
    }

    return counts;
  }, [expedicoes, movimentacoesEstoque, empresas, selectedFilialId, selectedConciliacaoDate, localStorageTrigger]);

  const handleLocalPatioChange = (empresaId: string, valStr: string) => {
    setPatioInputs(prev => ({
      ...prev,
      [empresaId]: valStr
    }));
  };

  const handleConfirmSavePatio = (empresaId: string) => {
    const valStr = patioInputs[empresaId] || '';
    if (valStr === '') {
      const conciliacaoId = `${selectedConciliacaoDate}_${selectedFilialId}_${empresaId}`;
      const newConciliacao: ConciliacaoDiaria = {
        id: conciliacaoId,
        data: selectedConciliacaoDate,
        filialId: selectedFilialId,
        empresaId: empresaId,
        quantidadePatio: 0,
        dataHoraAtualizacao: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username
      };
      if (onUpdateConciliacao) {
        onUpdateConciliacao(newConciliacao);
      }
      return;
    }

    const numVal = parseInt(valStr, 10);
    if (isNaN(numVal) || numVal < 0) return;

    const conciliacaoId = `${selectedConciliacaoDate}_${selectedFilialId}_${empresaId}`;
    const newConciliacao: ConciliacaoDiaria = {
      id: conciliacaoId,
      data: selectedConciliacaoDate,
      filialId: selectedFilialId,
      empresaId: empresaId,
      quantidadePatio: numVal,
      dataHoraAtualizacao: new Date().toISOString(),
      usuarioNome: currentUser.nomeCompleto || currentUser.username
    };

    if (onUpdateConciliacao) {
      onUpdateConciliacao(newConciliacao);
    }
  };

  // Função de exportação para PDF profissional do extrato
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const marginX = 15;
    let posY = 20;

    // Título Principal
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('EXPEDLOG - CONTROLE DE ESTOQUE', marginX, posY);
    posY += 7;

    // Subtítulo da Filial
    doc.setFontSize(10.5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(71, 85, 105); // slate-600
    const activeFilialName = filiais.find(f => f.id === selectedFilialId)?.nome || 'Todas as Filiais';
    doc.text(`EXTRATO DE MOVIMENTAÇÕES - FILIAL: ${activeFilialName.toUpperCase()}`, marginX, posY);
    posY += 6;

    // Informações de Geração
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    const formattedNow = new Date().toLocaleString('pt-BR');
    doc.text(`Relatório Gerado em: ${formattedNow} | Operador: ${currentUser.nomeCompleto || currentUser.username}`, marginX, posY);
    posY += 5;

    // Detalhamento dos filtros aplicados
    let activeFiltersText = 'Filtros ativos: ';
    const filtersUsed: string[] = [];
    if (extratoSearchText) filtersUsed.push(`Busca: "${extratoSearchText}"`);
    if (extratoDriverFilter) filtersUsed.push(`Entregador: ${extratoDriverFilter}`);
    if (extratoRouteFilter) filtersUsed.push(`Rota: ${extratoRouteFilter}`);
    if (extratoTypeFilter) filtersUsed.push(`Tipo: ${extratoTypeFilter}`);
    if (extratoCompanyFilter) {
      const cmp = empresas.find(e => e.id === extratoCompanyFilter);
      filtersUsed.push(`Empresa: ${cmp ? cmp.nome : extratoCompanyFilter}`);
    }
    if (extratoStartDate) filtersUsed.push(`Início: ${extratoStartDate}`);
    if (extratoEndDate) filtersUsed.push(`Fim: ${extratoEndDate}`);
    
    if (filtersUsed.length > 0) {
      activeFiltersText += filtersUsed.join(' | ');
    } else {
      activeFiltersText += 'Nenhum filtro de busca (Todos os logs da filial)';
    }
    doc.text(activeFiltersText, marginX, posY, { maxWidth: 180 });
    posY += 8;

    // Linha separadora
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.4);
    doc.line(marginX, posY, 195, posY);
    posY += 8;

    // Colunagem da Tabela (Soma de larguras = 180mm)
    const colWidths = [28, 42, 28, 24, 30, 28]; 
    const colHeaders = ['Data/Hora', 'Cod. Barras', 'Empresa', 'Tipo/Qtd', 'Entregador', 'Operador'];

    // Fundo cinza do cabeçalho
    doc.setFillColor(241, 245, 249); 
    doc.rect(marginX, posY, 180, 8, 'F');

    // Texto do cabeçalho
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85); 
    
    let currentX = marginX;
    colHeaders.forEach((header, idx) => {
      doc.text(header, currentX + 2, posY + 5.5);
      currentX += colWidths[idx];
    });
    posY += 8;

    // Renderização das Linhas da Tabela
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); 

    if (filteredExtratoList.length === 0) {
      doc.setFont('Helvetica', 'bold');
      doc.text('Nenhuma movimentação registrada para os filtros especificados no extrato.', marginX + 10, posY + 10);
    } else {
      filteredExtratoList.forEach((mov, rowIdx) => {
        // Controle de paginação (nova página antes do rodapé)
        if (posY > 275) {
          doc.addPage();
          posY = 20;

          // Redesenha cabeçalho na nova folha
          doc.setFillColor(241, 245, 249);
          doc.rect(marginX, posY, 180, 8, 'F');
          
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(51, 65, 85);
          
          let hX = marginX;
          colHeaders.forEach((header, hIdx) => {
            doc.text(header, hX + 2, posY + 5.5);
            hX += colWidths[hIdx];
          });
          posY += 8;
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
        }

        const dateStr = new Date(mov.dataHora).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        const displayType = mov.tipo === 'entrada' ? 'ENTRADA' :
                            mov.tipo === 'saida' ? 'SAÍDA' :
                            mov.tipo === 'devolucao' ? 'DEVOLUÇÃO' :
                            mov.tipo === 'retirada_filial' ? 'RETIRADA FILIAL' :
                            mov.tipo === 'retirado_zona_rural' ? 'ZONA RURAL' :
                            mov.tipo === 'retirado_avariado' ? 'AVARIADO' :
                            mov.tipo === 'retirado_outra_cidade' ? 'OUTRA CIDADE' :
                            mov.tipo === 'devolucao_empresa' ? 'DEV. EMPRESA' : 'EXCLUSÃO';

        const cleanBarcode = mov.codigoBarras || '';
        const cleanCompany = mov.empresaNome || '';
        const cleanDriver = mov.entregadorNome || '-';
        const cleanOperator = mov.usuarioNome || '-';

        // Sombreamento zebrado em linhas ímpares
        if (rowIdx % 2 === 1) {
          doc.setFillColor(250, 250, 250);
          doc.rect(marginX, posY, 180, 7, 'F');
        }

        let drawX = marginX;

        // Data / Hora Operação
        doc.text(dateStr, drawX + 1.5, posY + 5);
        drawX += colWidths[0];

        // Código de Barras do Pacote
        doc.setFont('Courier', 'bold');
        doc.setFontSize(7.5);
        doc.text(cleanBarcode, drawX + 1.5, posY + 5);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        drawX += colWidths[1];

        // Nome da Empresa Proprietária
        doc.text(cleanCompany.substring(0, 16), drawX + 1.5, posY + 5);
        drawX += colWidths[2];

        // Tipo da Movimentação com Destaque de Cor
        if (mov.tipo === 'entrada') doc.setTextColor(16, 124, 65); // Verde
        else if (mov.tipo === 'saida') doc.setTextColor(37, 99, 235); // Azul
        else if (mov.tipo === 'devolucao') doc.setTextColor(217, 119, 6); // Laranja (amber-600)
        else if (['retirada_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(mov.tipo)) doc.setTextColor(107, 33, 168); // Roxo (purple-800)
        else if (mov.tipo === 'devolucao_empresa') doc.setTextColor(217, 119, 6); // Amber / orange for return to company
        else doc.setTextColor(225, 29, 72); // Rosa forte (exclusão)

        doc.setFont('Helvetica', 'bold');
        doc.text(`${displayType} (1)`, drawX + 1.5, posY + 5);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        drawX += colWidths[3];

        // Entregador do Pacote
        doc.text(cleanDriver.substring(0, 16), drawX + 1.5, posY + 5);
        drawX += colWidths[4];

        // Operador responsável pela bipagem
        doc.text(cleanOperator.substring(0, 14), drawX + 1.5, posY + 5);

        // Linha discretizadora
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(marginX, posY + 7, 195, posY + 7);

        posY += 7;
      });
    }

    doc.save(`extrato_estoque_${activeFilialName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  };

  const handleZerarEstoqueCompleto = () => {
    if (isReadOnly) {
      setErrorFeedback('Você está em modo de Apenas Visualização. Não é possível limpar os registros.');
      return;
    }
    setIsZerarConfirmOpen(true);
  };

  const handleConfirmZerarEstoque = () => {
    onUpdateEstoque([], []);
    setErrorFeedback("O estoque e o extrato de movimentações foram completamente resetados pelo operador.");
    setSuccessFeedback("O estoque e as movimentações foram completamente zerados com sucesso.");
    setIsZerarConfirmOpen(false);
  };

  const handleLimparPacotesPorEmpresa = (empresaIdToClear: string) => {
    if (isReadOnly) {
      setErrorFeedback('Você está em modo de Apenas Visualização. Não é possível limpar os registros.');
      return;
    }

    const toRemove = estoque.filter(item => {
      const matchFilial = item.filialId === selectedFilialId;
      const matchCompany = empresaIdToClear ? item.empresaId === empresaIdToClear : true;
      return matchFilial && matchCompany;
    });

    if (toRemove.length === 0) {
      setErrorFeedback("Nenhum pacote localizado para a empresa selecionada nesta filial.");
      return;
    }

    // Registra a remoção no histórico de MovimentacaoEstoque
    const newMovements = toRemove.map(item => ({
      id: 'mov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4) + '-' + item.codigoBarras,
      codigoBarras: item.codigoBarras,
      empresaId: item.empresaId,
      filialId: selectedFilialId,
      tipo: 'exclusao' as 'exclusao',
      quantidade: item.quantidade,
      anterior: item.quantidade,
      novo: 0,
      dataHora: new Date().toISOString(),
      usuarioId: currentUser.id || 'usr-local',
      usuarioNome: currentUser.nomeCompleto || currentUser.username,
      observacoes: `Limpeza em lote de pacotes no estoque`
    }));

    // updatedEstoque mantém todos os itens do estoque exceto os removidos
    const updatedEstoque = estoque.filter(item => {
      const matchFilial = item.filialId === selectedFilialId;
      const matchCompany = empresaIdToClear ? item.empresaId === empresaIdToClear : true;
      const isTarget = matchFilial && matchCompany;
      return !isTarget;
    });

    const updatedMovimentacoes = [...movimentacoesEstoque, ...newMovements];

    onUpdateEstoque(updatedEstoque, updatedMovimentacoes);
    setSuccessFeedback(`Sucesso! Foram excluídos ${toRemove.length} pacotes da empresa selecionada nesta filial.`);
    setErrorFeedback('');
    setIsLimparPacotesModalOpen(false);
  };

  const handleDeleteEstoqueItem = (barcode: string) => {
    if (isReadOnly) {
      setErrorFeedback('Você está em modo de Apenas Visualização. Não é possível excluir itens.');
      return;
    }

    const existingItem = estoque.find(
      item => item.codigoBarras === barcode && item.filialId === selectedFilialId
    );

    if (!existingItem) {
      setErrorFeedback("Item não encontrado no estoque desta filial.");
      return;
    }

    const qtyToRemove = existingItem.quantidade;

    // Register subtraction in history of MovimentacaoEstoque
    const newMovement: MovimentacaoEstoque = {
      id: 'mov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      codigoBarras: barcode,
      empresaId: existingItem.empresaId,
      quantidade: qtyToRemove,
      tipo: 'exclusao',
      dataHora: new Date().toISOString(),
      usuarioNome: currentUser.nomeCompleto || currentUser.username,
      filialId: selectedFilialId
    };

    const updatedEstoque = estoque.map(item => {
      if (item.codigoBarras === barcode && item.filialId === selectedFilialId) {
        return {
          ...item,
          quantidade: 0,
          dataHoraAtualizacao: new Date().toISOString(),
          usuarioNome: currentUser.nomeCompleto || currentUser.username
        };
      }
      return item;
    });

    const updatedMovimentacoes = [newMovement, ...movimentacoesEstoque];
    onUpdateEstoque(updatedEstoque, updatedMovimentacoes);
    setSuccessFeedback(`Sucesso! O item "${barcode}" foi excluído do estoque (quantidade zerada) e registrado como exclusão no extrato.`);
    setErrorFeedback('');
  };

  const handleDevolverParaEmpresa = () => {
    if (isReadOnly) {
      setErrorFeedback('Você está em modo de Apenas Visualização. Não é possível devolver itens.');
      return;
    }

    const itemsToReturn = currentEstoqueList.filter(item => selectedPackages.includes(item.codigoBarras));
    if (itemsToReturn.length === 0) {
      setErrorFeedback("Nenhum pacote selecionado está disponível no estoque desta filial.");
      return;
    }

    const newMovements: MovimentacaoEstoque[] = [];
    const timestamp = new Date().toISOString();
    const operatorName = currentUser.nomeCompleto || currentUser.username;

    itemsToReturn.forEach((existingItem, index) => {
      const newMovement: MovimentacaoEstoque = {
        id: 'mov-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substr(2, 4),
        codigoBarras: existingItem.codigoBarras,
        empresaId: existingItem.empresaId,
        quantidade: existingItem.quantidade,
        tipo: 'devolucao_empresa',
        dataHora: timestamp,
        usuarioNome: operatorName,
        filialId: selectedFilialId
      };
      newMovements.push(newMovement);
    });

    const returnedBarcodes = itemsToReturn.map(i => i.codigoBarras);

    const updatedEstoque = estoque.map(item => {
      if (returnedBarcodes.includes(item.codigoBarras) && item.filialId === selectedFilialId) {
        return {
          ...item,
          quantidade: 0,
          dataHoraAtualizacao: timestamp,
          usuarioNome: operatorName
        };
      }
      return item;
    });

    const updatedMovimentacoes = [...newMovements, ...movimentacoesEstoque];
    onUpdateEstoque(updatedEstoque, updatedMovimentacoes);

    // Clear selection for returned packages
    setSelectedPackages(prev => prev.filter(code => !returnedBarcodes.includes(code)));

    setSuccessFeedback(`Sucesso! Os pacotes selecionados foram devolvidos à empresa de origem com sucesso e registrados no extrato.`);
    setErrorFeedback('');
  };

  const handleConfirmAddCustodiaPacote = () => {
    if (isReadOnly) {
      setErrorFeedback('Você está em modo de Apenas Visualização. Não é possível adicionar itens.');
      return;
    }

    const cleanBarcode = addPacoteBarcode.trim().toUpperCase();
    if (!cleanBarcode) {
      setErrorFeedback('Por favor, informe ou bipe o código de barras do pacote.');
      return;
    }

    // Identificação inteligente automática
    const matchedCompany = detectedCompany;
    if (!matchedCompany) {
      setErrorFeedback(`Aviso: O código "${cleanBarcode}" não corresponde a nenhuma empresa de origem ou prefixo cadastrado.`);
      return;
    }

    const companyIdToUse = matchedCompany.id;

    const existingIndex = estoque.findIndex(st => st.codigoBarras === cleanBarcode && st.filialId === selectedFilialId);
    let updatedEstoque = [...estoque];
    if (existingIndex === -1) {
      const newItem: ItemEstoque = {
        codigoBarras: cleanBarcode,
        empresaId: companyIdToUse,
        quantidade: 1,
        dataHoraAtualizacao: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username,
        filialId: selectedFilialId
      };
      updatedEstoque = [newItem, ...updatedEstoque];
    } else {
      updatedEstoque[existingIndex] = {
        ...updatedEstoque[existingIndex],
        quantidade: updatedEstoque[existingIndex].quantidade + 1,
        dataHoraAtualizacao: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username
      };
    }

    const movementType: any = addPacoteClassification === 'zona_rural' ? 'retirado_zona_rural' :
                               addPacoteClassification === 'avariado' ? 'retirado_avariado' :
                               'retirado_outra_cidade';

    const classificationLabel = addPacoteClassification === 'zona_rural' ? 'Zona Rural' :
                                addPacoteClassification === 'avariado' ? 'Avariado' :
                                'Outra Cidade';

    const newMovement: MovimentacaoEstoque = {
      id: 'mov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      codigoBarras: cleanBarcode,
      empresaId: companyIdToUse,
      quantidade: 1,
      tipo: movementType,
      dataHora: new Date().toISOString(),
      usuarioNome: currentUser.nomeCompleto || currentUser.username,
      filialId: selectedFilialId
    };

    const updatedMovimentacoes = [newMovement, ...movimentacoesEstoque];
    onUpdateEstoque(updatedEstoque, updatedMovimentacoes);

    setSuccessFeedback(`Sucesso! Pacote "${cleanBarcode}" identificado como [${matchedCompany.nome}] e adicionado em custódia como "${classificationLabel}".`);
    setErrorFeedback('');

    // Reset & Close
    setAddPacoteBarcode('');
    setAddPacoteCompanyId('');
    setAddPacoteClassification('zona_rural');
    setIsAddPacoteModalOpen(false);
  };

  // Compute calculated stock lists for displaying actual storage amounts
  const currentEstoqueList = useMemo(() => {
    return estoque.map(item => {
      const empresa = empresas.find(e => e.id === item.empresaId);
      const filial = filiais.find(f => f.id === item.filialId);
      return {
        ...item,
        empresaNome: empresa ? empresa.nome : 'Empresa não localizada',
        filialNome: filial ? filial.nome : 'Matriz/Padrão'
      };
    }).filter(item => {
      // Apply filters: selectedFilialId and stockSearchTerm
      if (item.filialId !== selectedFilialId) return false;
      
      // STRICT FILTER: Only show items in stock with quantity > 0
      if (item.quantidade <= 0) return false;
      
      const matchSearch = 
        item.codigoBarras.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
        item.empresaNome.toLowerCase().includes(stockSearchTerm.toLowerCase());
      
      const matchCompany = selectedCompanyFilter ? item.empresaId === selectedCompanyFilter : true;
      
      return matchSearch && matchCompany;
    });
  }, [estoque, selectedFilialId, stockSearchTerm, selectedCompanyFilter, empresas, filiais]);

  // Totals calculations
  const totals = useMemo(() => {
    const listForFilial = estoque.filter(item => item.filialId === selectedFilialId && item.quantidade > 0);
    const totalItensDiferentes = listForFilial.length;
    const totalItensFisicos = listForFilial.reduce((acc, current) => acc + current.quantidade, 0);
    return {
      totalItensDiferentes,
      totalItensFisicos
    };
  }, [estoque, selectedFilialId]);

  // Dynamic set of unique operators that did operations
  const uniqueOperators = useMemo(() => {
    const names = new Set<string>();
    if (currentUser) {
      names.add(currentUser.nomeCompleto || currentUser.username);
    }
    if (usersList) {
      usersList.forEach(u => {
        const uName = u.nomeCompleto || u.username;
        if (uName) names.add(uName);
      });
    }
    movimentacoesEstoque.forEach(m => {
      if (m.usuarioNome) {
        names.add(m.usuarioNome);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [currentUser, usersList, movimentacoesEstoque]);

  // Compute and Filter Extrato (Statement / Logs)
  const filteredExtratoList = useMemo(() => {
    return movimentacoesEstoque.map(mov => {
      const empresa = empresas.find(e => e.id === mov.empresaId);
      const filial = filiais.find(f => f.id === mov.filialId);
      
      return {
        ...mov,
        empresaNome: empresa ? empresa.nome : 'Empresa desconhecida',
        filialNome: filial ? filial.nome : 'Padrão'
      };
    }).filter(mov => {
      // Barcode Filter
      if (extratoSearchText) {
        const matchesCode = mov.codigoBarras.toLowerCase().includes(extratoSearchText.toLowerCase());
        if (!matchesCode) return false;
      }
      
      // Operator Filter
      if (extratoOperatorFilter) {
        if (!mov.usuarioNome || mov.usuarioNome !== extratoOperatorFilter) {
          return false;
        }
      }
      
      // Driver Filter (Dropdown match name-based)
      if (extratoDriverFilter) {
        if (!mov.entregadorNome || mov.entregadorNome.trim().toLowerCase() !== extratoDriverFilter.trim().toLowerCase()) {
          return false;
        }
      }

      // Route Filter (Dropdown match)
      if (extratoRouteFilter) {
        if (!mov.rotaNome || mov.rotaNome !== extratoRouteFilter) {
          return false;
        }
      }

      // Subsidiary Filter
      if (extratoFilialFilter && mov.filialId !== extratoFilialFilter) return false;

      // Type Filter
      if (extratoTypeFilter && mov.tipo !== extratoTypeFilter) return false;

      // Company Filter
      if (extratoCompanyFilter && mov.empresaId !== extratoCompanyFilter) return false;

      // Date Range Filter
      if (extratoStartDate) {
        const [sYr, sMn, sDy] = extratoStartDate.split('-').map(Number);
        const start = new Date(sYr, sMn - 1, sDy, 0, 0, 0, 0);
        const movDate = new Date(mov.dataHora);
        if (movDate < start) return false;
      }
      if (extratoEndDate) {
        const [eYr, eMn, eDy] = extratoEndDate.split('-').map(Number);
        const end = new Date(eYr, eMn - 1, eDy, 23, 59, 59, 999);
        const movDate = new Date(mov.dataHora);
        if (movDate > end) return false;
      }

      return true;
    });
  }, [movimentacoesEstoque, extratoSearchText, extratoDriverFilter, extratoRouteFilter, extratoFilialFilter, extratoTypeFilter, extratoCompanyFilter, extratoOperatorFilter, extratoStartDate, extratoEndDate, empresas, filiais]);

  return (
    <div className="space-y-6" id="view-estoque-container">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <ClipboardList className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight font-sans">
                Controle de Estoque & Armazenamento
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Monitore os pacotes em posse física da filial e audite o histórico operacional completo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sincronizador de Filial */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl shadow-xs">
            <MapPin className="h-4 w-4 text-slate-400 ml-1.5 shrink-0" />
            <select
              value={selectedFilialId}
              onChange={(e) => setSelectedFilialId(e.target.value)}
              className="text-xs font-black text-slate-700 bg-transparent border-0 ring-0 focus:ring-0 cursor-pointer pr-8"
              id="select-filial-estoque"
            >
              {userPermittedFiliais.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* PAINEL DE SÍNTESE - STATS BENTO CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: Volumes Físicos Totais */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Quantidade Total em Estoque</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">
              {totals.totalItensFisicos} <span className="text-xs text-slate-400 font-semibold">volumes</span>
            </h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package className="h-6 w-6" />
          </div>
        </div>

        {/* CARD 2: Códigos Únicos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Códigos de Barras Ativos</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">
              {totals.totalItensDiferentes} <span className="text-xs text-slate-400 font-semibold">produtos</span>
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <PackageCheck className="h-6 w-6" />
          </div>
        </div>

        {/* CARD 3: Responsável Atual */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Operador de Registro</p>
            <h3 className="text-base font-black text-slate-900 leading-tight truncate max-w-[170px]" title={currentUser.nomeCompleto || currentUser.username}>
              {currentUser.nomeCompleto || currentUser.username}
            </h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase">Via Autenticação Local</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <UserIcon className="h-6 w-6" />
          </div>
        </div>

        {/* CARD 4: Filial Monitorada */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider font-sans">Localização (Filial)</p>
            <h3 className="text-sm font-black text-slate-900 leading-tight truncate max-w-[170px]">
              {filiais.find(f => f.id === selectedFilialId)?.nome || 'Matriz Geral'}
            </h3>
            <p className="text-[10px] text-blue-600 font-black">Isolamento Ativo</p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100">
            <Map className="h-6 w-6 text-slate-400" />
          </div>
        </div>

      </div>

      {/* PAINEL DE CONCILIAÇÃO DIÁRIA DE EXPEDIÇÕES (CARGA DO DIA) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5" id="painel-conciliacao-diaria">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
                <ClipboardList className="h-4 w-4" />
              </span>
              <h3 className="font-extrabold text-slate-800 text-base">
                Conciliação de Saídas por Empresa (Carga do Dia)
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-semibold">
              Insira a quantidade total de pacotes recebida por nota fiscal no dia. O sistema calcula a diferença em relação às saídas bipadas das remessas.
            </p>
          </div>

          {/* Seletor de Data de Referência */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Calendar className="h-4 w-4 text-sky-500" /> Data de Carga:
              </span>
              <input
                type="date"
                value={selectedConciliacaoDate}
                onChange={(e) => setSelectedConciliacaoDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-black text-slate-700 px-3 py-1.5 rounded-xl outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-xs"
                id="input-data-ref-conciliacao"
              />
            </div>
          </div>
        </div>

        {/* Grid de Empresas para conciliação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-left">
          {empresas.map((emp) => {
            const conciliacaoId = `${selectedConciliacaoDate}_${selectedFilialId}_${emp.id}`;
            const match = conciliacoesDiarias.find(c => c.id === conciliacaoId);
            const totalNota = match ? match.quantidadePatio : 0;
            const totalBipado = totalBipadoByEmpresa[emp.id] || 0;
            const saldo = totalNota - totalBipado;

            // Determinando Status e Cor do card
            let cardBg = "bg-slate-50/50 border-slate-200/60";
            let statusBadge = null;
            let inputBorder = "border-slate-200 focus:border-sky-505";
            let subLabel = "Carga diária não informada";
            let valColorClass = "text-xl font-black text-slate-700";

            if (totalNota > 0) {
              if (saldo === 0) {
                // Zerado com Sucesso! - Cor verde
                cardBg = "bg-emerald-50/70 border-emerald-200";
                inputBorder = "border-emerald-300 focus:border-emerald-500";
                statusBadge = (
                  <span className="inline-flex items-center gap-0.5 bg-emerald-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-xs">
                    <Check className="h-3 w-3" /> Conciliado
                  </span>
                );
                subLabel = "Todas as saídas concluídas e zeradas!";
                valColorClass = "text-xl font-black text-emerald-600";
              } else if (saldo > 0) {
                // Falta bipar - Cor vermelha/alerta
                cardBg = "bg-rose-50/60 border-rose-200";
                inputBorder = "border-rose-300 focus:border-rose-500 text-rose-700";
                statusBadge = (
                  <span className="inline-flex items-center gap-0.5 bg-rose-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-xs animate-pulse">
                    Falta Bipar
                  </span>
                );
                subLabel = `Falta bipar ${saldo} pacote${saldo > 1 ? 's' : ''}`;
                valColorClass = "text-xl font-black text-rose-600";
              } else {
                // Excesso - Cor vermelha extrema
                cardBg = "bg-red-100/60 border-red-300";
                inputBorder = "border-red-350 focus:border-red-500 text-red-800";
                statusBadge = (
                  <span className="inline-flex items-center gap-0.5 bg-red-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-xs">
                    <X className="h-3 w-3" /> Excesso
                  </span>
                );
                subLabel = `Divergência: +${Math.abs(saldo)} a mais!`;
                valColorClass = "text-xl font-black text-red-600";
              }
            }

            return (
              <div 
                key={emp.id} 
                className={`p-4 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between ${cardBg}`}
                id={`card-conciliacao-empresa-${emp.id}`}
              >
                {/* Top Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-left">
                      <h4 className="font-extrabold text-slate-800 text-sm leading-tight truncate max-w-[130px]" title={emp.nome}>
                        {emp.nome}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                        Prefixos: {emp.prefixos || 'Sem prefixo'}
                      </p>
                    </div>
                    {statusBadge}
                  </div>

                  {/* Grid Comparativo */}
                  <div className="grid grid-cols-3 gap-1.5 bg-white p-2 rounded-xl border border-slate-150/70">
                    <div className="text-center">
                      <span className="text-[8px] font-bold text-slate-400 block uppercase">Pátio</span>
                      <span className="text-xs font-black text-slate-700">{totalNota}</span>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 block uppercase">Saídas</span>
                      <span className="text-xs font-black text-slate-700">{totalBipado}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[8px] font-bold text-slate-400 block uppercase">Diferença</span>
                      <span className={`text-xs font-black ${saldo === 0 ? (totalNota > 0 ? 'text-emerald-600' : 'text-slate-500') : 'text-rose-600 font-extrabold'}`}>
                        {saldo > 0 ? `-${saldo}` : saldo < 0 ? `+${Math.abs(saldo)}` : 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bloco de Entrada */}
                <div className="mt-4 pt-3 border-t border-slate-200/65 flex items-center justify-between gap-2.5">
                  <div className="flex-1 space-y-0.5 text-left">
                    <label 
                      htmlFor={`input-nota-empresa-${emp.id}`} 
                      className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider"
                    >
                      Qtd da Nota:
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Qtd no Pátio..."
                      id={`input-nota-empresa-${emp.id}`}
                      value={patioInputs[emp.id] !== undefined ? patioInputs[emp.id] : ''}
                      onChange={(e) => handleLocalPatioChange(emp.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleConfirmSavePatio(emp.id);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      disabled={isReadOnly || (!!match && !canAlterSavedEstoque)}
                      className={`w-full text-xs font-black p-1.5 rounded-lg outline-hidden focus:ring-1 focus:ring-sky-500 shadow-xs text-center transition-all ${inputBorder} ${
                        (isReadOnly || (!!match && !canAlterSavedEstoque)) 
                          ? 'bg-slate-100/85 text-slate-600 border-slate-200 cursor-not-allowed opacity-80' 
                          : 'bg-white'
                      }`}
                    />
                  </div>

                  {match && (patioInputs[emp.id] === undefined || patioInputs[emp.id] === String(match.quantidadePatio)) ? (
                    <div className="text-right self-end pb-1 pr-1 shrink-0" title={`Atualizado por ${match.usuarioNome} em ${new Date(match.dataHoraAtualizacao).toLocaleTimeString()}`}>
                      <span className="text-[8px] font-black text-slate-400 block uppercase">Salvo</span>
                      <span className="text-[8px] font-medium text-slate-400 block">
                        {new Date(match.dataHoraAtualizacao).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleConfirmSavePatio(emp.id)}
                        disabled={!patioInputs[emp.id] || isNaN(parseInt(patioInputs[emp.id], 10)) || parseInt(patioInputs[emp.id], 10) < 0}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:pointer-events-none text-white font-extrabold text-[9px] rounded-lg tracking-wider transition shadow-sm active:scale-95 cursor-pointer self-end mb-0.5 shrink-0"
                      >
                        {match ? 'ATUALIZAR' : 'SALVAR'}
                      </button>
                    )
                  )}
                </div>
                
                {/* Visual Sub Label */}
                <div className="mt-2 text-[10px] font-bold text-slate-400 tracking-tight leading-none text-left">
                  {subLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL DE TRABALHO: BIPAGEM DE ENTRADAS & LISTAGEM DO ESTOQUE ATUAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: PACOTES EM POSSE DA FILIAL (1 COLUNA) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-fit space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 flex-wrap gap-2">
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5 text-left">
                <PackageCheck className="h-5 w-5 text-emerald-500" />
                Pacotes em Posse da Filial
              </h3>
              <p className="text-xs text-slate-505 font-medium text-left">
                Volumes físicos sob custódia de pátio nesta filial.
              </p>
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setLimparPacotesCompanyId('');
                    setIsLimparPacotesModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-750 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-sm transition hover:scale-[1.02] cursor-pointer animate-in fade-in"
                  id="btn-limpar-pacotes-custodia"
                >
                  <Trash2 className="h-4 w-4 text-rose-200" />
                  <span>Limpar Pacotes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddPacoteBarcode('');
                    setAddPacoteCompanyId(empresas.length > 0 ? empresas[0].id : '');
                    setAddPacoteClassification('zona_rural');
                    setIsAddPacoteModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-sm transition hover:scale-[1.02] cursor-pointer"
                  id="btn-adicionar-pacote-custodia"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar Pacote</span>
                </button>
              </div>
            )}
          </div>

          {/* Feedback logs */}
          <AnimatePresence>
            {successFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-xs font-semibold leading-relaxed text-left"
              >
                {successFeedback}
              </motion.div>
            )}

            {errorFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-xs font-semibold leading-relaxed text-left"
              >
                {errorFeedback}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filtros rápidos do Estoque Físico */}
          <div className="space-y-2">
            {/* Input busca */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar código de barras..."
                value={stockSearchTerm}
                onChange={(e) => setStockSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 text-xs font-semibold rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white text-slate-700"
                id="input-busca-local-estoque-rapido"
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Select empresa */}
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="w-full border border-slate-200 text-xs font-semibold rounded-xl bg-slate-50 px-3 py-2 text-slate-700 cursor-pointer text-left"
              id="select-empresa-filtro-local-estoque-rapido"
            >
              <option value="">Todas as Empresas</option>
              {empresas.map(emp => {
                const qtyInLocalBranch = estoque
                  .filter(item => item.empresaId === emp.id && item.filialId === selectedFilialId)
                  .reduce((acc, curr) => acc + curr.quantidade, 0);
                return (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome} ({qtyInLocalBranch} un)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Select all bar & actions */}
          {currentEstoqueList.length > 0 && (
            <div className="flex flex-col gap-2 bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs text-left">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 font-bold text-slate-650 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentEstoqueList.every(item => selectedPackages.includes(item.codigoBarras))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const currentCodes = currentEstoqueList.map(item => item.codigoBarras);
                        setSelectedPackages(prev => {
                          const otherCodes = prev.filter(b => !currentCodes.includes(b));
                          return [...otherCodes, ...currentCodes];
                        });
                      } else {
                        const currentCodes = currentEstoqueList.map(item => item.codigoBarras);
                        setSelectedPackages(prev => prev.filter(b => !currentCodes.includes(b)));
                      }
                    }}
                    className="h-3.5 w-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Selecionar todos ({currentEstoqueList.length})</span>
                </label>
                
                {selectedPackages.filter(code => currentEstoqueList.some(item => item.codigoBarras === code)).length > 0 && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded-full font-mono">
                    {selectedPackages.filter(code => currentEstoqueList.some(item => item.codigoBarras === code)).length} pcts
                  </span>
                )}
              </div>

              {selectedPackages.some(code => currentEstoqueList.some(item => item.codigoBarras === code)) && (
                <button
                  type="button"
                  onClick={handleDevolverParaEmpresa}
                  disabled={isReadOnly}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-750 disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold text-xs py-2 px-3 rounded-xl shadow-xs transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Building className="h-4 w-4 text-amber-200" />
                  <span>Devolver ({selectedPackages.filter(code => currentEstoqueList.some(item => item.codigoBarras === code)).length}) para a Empresa</span>
                </button>
              )}
            </div>
          )}

          {/* Relação Física Compacta de Itens */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 p-1.5 max-h-[640px] overflow-y-auto space-y-1.5 animate-in fade-in duration-350">
            {currentEstoqueList.length === 0 ? (
              <div className="py-24 text-center text-slate-400 font-extrabold flex flex-col items-center justify-center">
                <Package className="h-10 w-10 text-slate-300 mb-2" />
                <span className="text-xs">Nenhum pacote em custódia</span>
                <p className="text-[9px] text-slate-400 font-medium font-sans mt-0.5 max-w-[180px] leading-normal mx-auto text-center">
                  Os pacotes entram no estoque automaticamente ao bipar carga de saída para o motorista.
                </p>
              </div>
            ) : (
              currentEstoqueList.map((item, idx) => {
                const isItemChecked = selectedPackages.includes(item.codigoBarras);
                return (
                  <div 
                    key={idx} 
                    className={`px-2.5 py-1.5 rounded-xl border transition flex items-center justify-between gap-2.5 ${isItemChecked ? 'border-amber-400 bg-amber-50/10' : 'border-slate-150 hover:border-slate-200 bg-white'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isItemChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPackages(prev => [...prev, item.codigoBarras]);
                        } else {
                          setSelectedPackages(prev => prev.filter(b => b !== item.codigoBarras));
                        }
                      }}
                      className="h-3.5 w-3.5 text-amber-600 border-slate-300 rounded focus:ring-amber-500 cursor-pointer shrink-0"
                    />

                    <div className="min-w-0 flex-1 space-y-0.5 text-left">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-[10px] tracking-tight text-slate-900 border-b border-indigo-50">
                          {item.codigoBarras}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 text-[9.5px] px-1 py-0.2 rounded font-black shrink-0 border border-emerald-100">
                          {item.quantidade} un
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-[9px] font-semibold text-slate-500">
                        <span className="text-slate-600 bg-slate-100 rounded px-1 py-0.1 font-bold uppercase text-[7.5px] border border-slate-150">
                          {item.empresaNome}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-405">
                          {new Date(item.dataHoraAtualizacao).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute:'2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium truncate">
                        Op: <span className="text-slate-500 font-bold">{item.usuarioNome}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Resumo Rodapé Esquerdo */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1">
            <span>Listando {currentEstoqueList.length} registro(s)</span>
            <span>Estoque Físico</span>
          </div>
        </div>

        {/* COLUNA DIREITA: EXTRATO COMPLETO DE MOVIMENTAÇÕES (2 COLUNAS) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          
          {/* Header do Extrato com opção de Exportar PDF */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="space-y-0.5 text-left">
              <h3 className="font-extrabold text-slate-800 text-base">
                Extrato de Movimentação do Estoque
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                Mostrando entradas, saídas, devoluções e exclusões registradas em tempo real.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                id="btn-exportar-extrato-pdf"
              >
                <FileDown className="h-4 w-4 text-emerald-400" />
                <span>Exportar PDF</span>
              </button>
            </div>
          </div>

          {/* Bloco de Filtros do Extrato - Estruturado em Grid Compacto de 3 colunas */}
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
            
            {/* Filtro: Código de barras */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Busca de Pacote</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Código de barras..."
                  className="w-full bg-white border border-slate-200 pl-8 pr-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-xs"
                  value={extratoSearchText}
                  onChange={(e) => setExtratoSearchText(e.target.value)}
                  id="input-extrato-busca-barras"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* Filtro: Entregadores */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Entregadores</span>
              <select
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 cursor-pointer text-ellipsis shadow-xs"
                value={extratoDriverFilter}
                onChange={(e) => setExtratoDriverFilter(e.target.value)}
                id="select-extrato-filtro-entregador"
              >
                <option value="">Todos os Entregadores</option>
                {entregadores.map(driver => (
                  <option key={driver.id} value={driver.nome}>{driver.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro: Rota */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Rota Vinculada</span>
              <select
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-xs"
                value={extratoRouteFilter}
                onChange={(e) => setExtratoRouteFilter(e.target.value)}
                id="select-extrato-filtro-rota"
              >
                <option value="">Todas as Rotas</option>
                {rotas.map(route => (
                  <option key={route.id} value={route.id}>{route.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro: Tipo Operação */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Tipo de Movimentação</span>
              <select
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-xs"
                value={extratoTypeFilter}
                onChange={(e) => setExtratoTypeFilter(e.target.value)}
                id="select-extrato-filtro-tipo"
              >
                <option value="">Todas as Movimentações</option>
                <option value="entrada">Entrada (Saída do Operador)</option>
                <option value="saida">Saída (Finalizadas / Concluídas)</option>
                <option value="devolucao">Devolução (Acertos / Retornos)</option>
                <option value="exclusao">Exclusão (Remoções de Estoque)</option>
              </select>
            </div>

            {/* Filtro: Empresa */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Empresa Proprietária</span>
              <select
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 cursor-pointer text-ellipsis shadow-xs"
                value={extratoCompanyFilter}
                onChange={(e) => setExtratoCompanyFilter(e.target.value)}
                id="select-extrato-filtro-empresa"
              >
                <option value="">Todas as Empresas</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro: Operador */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Operador Responsável</span>
              <select
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 cursor-pointer text-ellipsis shadow-xs"
                value={extratoOperatorFilter}
                onChange={(e) => setExtratoOperatorFilter(e.target.value)}
                id="select-extrato-filtro-operador"
              >
                <option value="">Todos os Operadores</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.username}>{u.nomeCompleto || u.username}</option>
                ))}
              </select>
            </div>

            {/* Filtro: Data Início */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Data Início</span>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-xs"
                value={extratoStartDate}
                onChange={(e) => setExtratoStartDate(e.target.value)}
                id="input-extrato-data-inicio"
              />
            </div>

            {/* Filtro: Data Fim */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Data Fim</span>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-xs"
                value={extratoEndDate}
                onChange={(e) => setExtratoEndDate(e.target.value)}
                id="input-extrato-data-fim"
              />
            </div>

            {/* Filtro Filial (Opcional, pre-setado) */}
            <div className="space-y-1">
              <span className="font-extrabold text-[#475569] block text-[9px] uppercase tracking-wider">Filial de Origem</span>
              <select
                className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-xs"
                value={extratoFilialFilter}
                onChange={(e) => setExtratoFilialFilter(e.target.value)}
                id="select-extrato-filtro-filial"
              >
                <option value="">Todas as Filiais</option>
                {filiais.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Resetar filtros aplicados */}
          {(extratoSearchText || extratoDriverFilter || extratoRouteFilter || extratoFilialFilter !== selectedFilialId || extratoTypeFilter || extratoCompanyFilter || extratoOperatorFilter || extratoStartDate || extratoEndDate) && (
            <div className="flex justify-end pr-1.5">
              <button
                type="button"
                onClick={() => {
                  setExtratoSearchText('');
                  setExtratoDriverFilter('');
                  setExtratoRouteFilter('');
                  setExtratoFilialFilter(selectedFilialId);
                  setExtratoTypeFilter('');
                  setExtratoCompanyFilter('');
                  setExtratoOperatorFilter('');
                  setExtratoStartDate('');
                  setExtratoEndDate('');
                }}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 font-extrabold transition cursor-pointer flex items-center gap-1 ml-auto"
              >
                <RotateCcw className="h-3 w-3" />
                Limpar filtros aplicados
              </button>
            </div>
          )}

          {/* Relação física de Logs com altura de rolagem fixa */}
          <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-3 max-h-[460px] overflow-y-auto space-y-2.5">
            {filteredExtratoList.length === 0 ? (
              <div className="text-center py-24 text-slate-400 font-extrabold flex flex-col items-center justify-center">
                <Layers className="h-10 w-10 text-slate-300 mb-2" />
                <span>Nenhuma movimentação registrada no extrato.</span>
                <p className="text-[10px] text-slate-400 font-medium font-sans mt-0.5 max-w-sm mx-auto text-center">
                  Modifique os filtros do extrato acima para expandir sua busca.
                </p>
              </div>
            ) : (
              filteredExtratoList.map((mov) => {
                const isEntrada = mov.tipo === 'entrada';
                const isSaida = mov.tipo === 'saida';
                const isDevolucao = mov.tipo === 'devolucao';
                const isDevolucaoEmpresa = mov.tipo === 'devolucao_empresa';
                const isExclusao = mov.tipo === 'exclusao';
                const isRetiradaFilial = mov.tipo === 'retirada_filial';
                const isRetiradaZonaRural = mov.tipo === 'retirado_zona_rural';
                const isRetiradaAvariada = mov.tipo === 'retirado_avariado';
                const isRetiradaOutraCidade = mov.tipo === 'retirado_outra_cidade';
                const isRetiradaGlobal = isRetiradaFilial || isRetiradaZonaRural || isRetiradaAvariada || isRetiradaOutraCidade;

                return (
                  <div
                    key={mov.id}
                    className="bg-white rounded-xl border border-slate-150 p-3 shadow-xs flex items-start gap-4 transition hover:shadow-xs"
                  >
                    {/* Icon indicators */}
                    <div className="shrink-0 pt-0.5">
                      {isEntrada && (
                        <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg block border border-emerald-100">
                          <ArrowDownRight className="h-4 w-4" />
                        </span>
                      )}
                      {isSaida && (
                        <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg block border border-blue-100">
                          <ArrowLeft className="h-4 w-4" />
                        </span>
                      )}
                      {isDevolucao && (
                        <span className="p-1.5 bg-orange-50 text-orange-600 rounded-lg block border border-orange-100">
                          <RotateCcw className="h-4 w-4 stroke-[2.5]" />
                        </span>
                      )}
                      {isDevolucaoEmpresa && (
                        <span className="p-1.5 bg-orange-50 text-orange-650 rounded-lg flex items-center gap-1 border border-orange-100">
                          <Building className="h-3.5 w-3.5" />
                          <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
                        </span>
                      )}
                      {isRetiradaGlobal && (
                        <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg block border border-purple-100">
                          <CornerUpLeft className="h-4 w-4" />
                        </span>
                      )}
                      {isExclusao && (
                        <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg block border border-rose-100">
                          <Trash2 className="h-4 w-4" />
                        </span>
                      )}
                    </div>

                    {/* Content description details */}
                    <div className="flex-1 min-w-0 text-left space-y-1 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-mono font-bold tracking-wider text-slate-900 border-b border-indigo-50">
                          {mov.codigoBarras}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {new Date(mov.dataHora).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                        <span className="text-slate-700 bg-slate-100 rounded-md px-1.5 py-0.2 font-bold uppercase text-[8px] border border-slate-200">
                          {mov.empresaNome}
                        </span>
                        
                        <span className="text-slate-300">•</span>
                        
                        <span className="text-indigo-700 bg-indigo-50 rounded-md px-1.5 py-0.2 font-extrabold text-[8px] border border-indigo-150">
                          QTD: {mov.quantidade || 1} { (mov.quantidade || 1) === 1 ? 'VOL' : 'VOLS' }
                        </span>
                        
                        <span className="text-slate-300">•</span>
                        
                        <span>Filial: <strong className="text-slate-700 font-bold">{mov.filialNome}</strong></span>
                        
                        <span className="text-slate-300">•</span>
                        
                        <span>Op: <strong className="text-slate-700 font-bold">{mov.usuarioNome}</strong></span>
                      </div>

                      {/* Context driver and route inside statement */}
                      {(mov.entregadorNome || mov.rotaNome) && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-1 flex flex-wrap items-center gap-3 text-[10px]">
                          {mov.entregadorNome && (
                            <span className="text-slate-500 border-0">
                              Motorista: <strong className="text-slate-900 font-extrabold">{mov.entregadorNome}</strong>
                            </span>
                          )}
                          {mov.rotaNome && (
                            <span className="text-slate-500 border-0">
                              Rota: <strong className="text-slate-900 font-extrabold">{mov.rotaNome}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Operation volume column */}
                    <div className="text-right shrink-0 min-w-[60px]">
                      <span className={`text-xs font-black rounded-lg px-2 py-0.5 block border ${
                        isEntrada ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        isSaida ? 'bg-blue-50 text-blue-700 border-blue-105' :
                        isExclusao ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        isRetiradaGlobal ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        (isDevolucao || isDevolucaoEmpresa) ? 'bg-orange-50 text-orange-700 border-orange-100' :
                        'bg-red-50 text-red-700 border-red-150'
                      }`}>
                        {isEntrada ? '+' : isSaida ? '-' : isExclusao ? '-' : isDevolucaoEmpresa ? '-' : '+'}{mov.quantidade || 1} un
                      </span>
                      <p className="text-[9px] uppercase text-slate-400 font-bold mt-1">
                        {isEntrada ? 'Entrada' :
                         isSaida ? 'Saída' :
                         isExclusao ? 'Exclusão' :
                         isDevolucaoEmpresa ? 'Dev. Empresa' :
                         isRetiradaZonaRural ? 'Zona Rural' :
                         isRetiradaAvariada ? 'Avariado' :
                         isRetiradaOutraCidade ? 'Outra Cidade' :
                         isRetiradaFilial ? 'Retirada Filial' : 'Retorno'}
                      </p>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Footer do Extrato */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
            <span>Listando {filteredExtratoList.length} logs filtrados</span>
            <span>Sistema DIAMANTE LOG</span>
          </div>

        </div>

      </div>

      {/* MODAL: ZERAR ESTOQUE COMPLETO */}
      <AnimatePresence>
        {isZerarConfirmOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsZerarConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 p-6 space-y-4 z-10"
            >
              <div className="flex items-center gap-3 text-red-655">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">Zerar Estoque do Sistema</h3>
              </div>
              
              <div className="text-xs text-slate-600 leading-relaxed font-semibold space-y-3">
                <p className="bg-amber-50 border border-amber-250 rounded-xl p-3 text-amber-800 text-[11px] leading-relaxed font-bold">
                  ATENÇÃO: Esta é uma ação crítica e irreversível!
                </p>
                <p>
                  Deseja realmente <span className="font-bold text-slate-800">ZERAR TODAS</span> as movimentações e níveis de estoque salvos?
                </p>
                <p className="text-slate-450 leading-normal font-medium">
                  Esta operação apagará todos os registros da tabela de fluxo de mercadoria física e o extrato completo de histórico de movimentações.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsZerarConfirmOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Não, Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmZerarEstoque}
                  className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer font-sans"
                >
                  Sim, tenho certeza!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EXCLUSÃO DE ITEM DO ESTOQUE */}
      <AnimatePresence>
        {itemToDelete && (() => {
          const targetItem = currentEstoqueList.find(i => i.codigoBarras === itemToDelete);
          return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setItemToDelete(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white w-full max-w-sm rounded-[24px] shadow-2xl border border-slate-100 p-6 space-y-4 z-10"
              >
                <div className="flex items-center gap-3 text-rose-600">
                  <div className="p-2 bg-rose-100 rounded-full">
                    <Trash2 className="h-6 w-6 text-rose-600" />
                  </div>
                  <h3 className="font-bold text-base text-slate-800">Confirmar Exclusão</h3>
                </div>
                
                <div className="text-xs text-slate-500 leading-normal font-semibold space-y-2">
                  <p>
                    Tem certeza que deseja excluir permanentemente o item de código de barras:
                  </p>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono text-slate-800 text-center font-bold tracking-wider">
                    {itemToDelete}
                  </div>
                  {targetItem && (
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Empresa proprietária: <span className="font-bold text-slate-700">{targetItem.empresaNome}</span>
                      <br />
                      Estoque físico atual: <span className="font-bold text-slate-700">{targetItem.quantidade} un</span>
                    </p>
                  )}
                  <p className="text-rose-500 font-bold mt-2 leading-normal">
                    Esta ação irá zerar o estoque físico listado e registrar a respectiva saída como "exclusão" no extrato de movimentação.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setItemToDelete(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteEstoqueItem(itemToDelete);
                      setItemToDelete(null);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer font-sans"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* RE-ESTILO SLIDE_OVER MODAL: EXTRATO COMPLETO DE MOVIMENTAÇÃO (LOGS) */}
      <AnimatePresence>
        {isExtratoOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="modal-extrato-movimentacao-estoque">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExtratoOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />

            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                {/* Modal panel card */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="pointer-events-auto w-screen max-w-2xl"
                >
                  <div className="flex h-full flex-col bg-white shadow-2xl border-l border-slate-150">
                    
                    {/* Header do Extrato */}
                    <div className="bg-slate-900 px-6 py-5 sm:flex sm:items-center sm:justify-between text-white shrink-0">
                      <div className="space-y-0.5">
                        <h2 className="text-base font-extrabold flex items-center gap-1.5 font-sans">
                          <Layers className="h-5 w-5 text-indigo-400" />
                          Extrato de Movimentação do Estoque
                        </h2>
                        <p className="text-[11px] text-zinc-300 font-semibold">
                          Histórico operacional completo: Recebimento, Saída (Checkout) e Devoluções.
                        </p>
                      </div>
                      <div className="mt-4 sm:mt-0 flex items-center">
                        <button
                          type="button"
                          onClick={() => setIsExtratoOpen(false)}
                          className="rounded-full bg-slate-800 text-slate-300 hover:text-white p-2 border border-slate-750 transition focus:outline-hidden cursor-pointer"
                        >
                          <X className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>

                    {/* Filtros em Accordion / Grid do Extrato */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 shrink-0 text-xs">
                      
                      {/* Busca Texto */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Código de Barras</span>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Buscar cód. barras..."
                            value={extratoSearchText}
                            onChange={(e) => setExtratoSearchText(e.target.value)}
                            className="w-full bg-white border border-slate-200 py-1.5 pl-8.5 pr-2 rounded-lg font-bold placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                            id="input-extrato-busca-barra"
                          />
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Busca Entregador */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Entregador Responsável</span>
                        <select
                          className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500"
                          value={extratoDriverFilter}
                          onChange={(e) => setExtratoDriverFilter(e.target.value)}
                          id="select-extrato-filtro-motorista"
                        >
                          <option value="">Todos os Entregadores</option>
                          {entregadores.map(e => (
                            <option key={e.id} value={e.nome}>{e.nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* Busca Rota */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Rota Atrelada</span>
                        <select
                          className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500"
                          value={extratoRouteFilter}
                          onChange={(e) => setExtratoRouteFilter(e.target.value)}
                          id="select-extrato-filtro-rota"
                        >
                          <option value="">Todas as Rotas</option>
                          {rotas.map(r => (
                            <option key={r.id} value={r.nome}>{r.nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filtro Operador */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Operador (Usuário)</span>
                        <select
                          className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500"
                          value={extratoOperatorFilter}
                          onChange={(e) => setExtratoOperatorFilter(e.target.value)}
                          id="select-extrato-filtro-operador"
                        >
                          <option value="">Todos os Operadores</option>
                          {uniqueOperators.map(op => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      </div>

                      {/* Select Filial */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Filial de Origem</span>
                        <select
                          className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-[11px] font-bold"
                          value={extratoFilialFilter}
                          onChange={(e) => setExtratoFilialFilter(e.target.value)}
                          id="select-extrato-filtro-filial"
                        >
                          <option value="">Todas as Filiais</option>
                          {filiais.map(f => (
                            <option key={f.id} value={f.id}>{f.nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* Select Tipo Movimentação */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Tipo Fluxo</span>
                        <select
                          className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-[11px] font-bold"
                          value={extratoTypeFilter}
                          onChange={(e) => setExtratoTypeFilter(e.target.value)}
                          id="select-extrato-filtro-tipo"
                        >
                          <option value="">Todos os Fluxos</option>
                          <option value="entrada">Entrada (Armazenamento)</option>
                          <option value="saida">Saída (Em Rota / Checkout)</option>
                          <option value="devolucao">Devolução (Acertos / Retornos)</option>
                          <option value="exclusao">Exclusão (Remoções de Estoque)</option>
                        </select>
                      </div>

                      {/* Select Empresa */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Empresa Vinculada</span>
                        <select
                          className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-[11px] font-bold"
                          value={extratoCompanyFilter}
                          onChange={(e) => setExtratoCompanyFilter(e.target.value)}
                          id="select-extrato-filtro-empresa"
                        >
                          <option value="">Todas as Empresas</option>
                          {empresas.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* Data Início */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Data Início</span>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 p-1 py-0.5 rounded-lg text-[11px] font-bold text-slate-700"
                          value={extratoStartDate}
                          onChange={(e) => setExtratoStartDate(e.target.value)}
                          id="input-extrato-data-inicio"
                        />
                      </div>

                      {/* Data Fim */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-[#475569] block text-[10px] uppercase">Data Fim</span>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 p-1 py-0.5 rounded-lg text-[11px] font-bold text-slate-700"
                          value={extratoEndDate}
                          onChange={(e) => setExtratoEndDate(e.target.value)}
                          id="input-extrato-data-fim"
                        />
                      </div>

                    </div>

                    {/* Botão de reset de filtros do extrato */}
                    {(extratoSearchText || extratoDriverFilter || extratoRouteFilter || extratoFilialFilter || extratoTypeFilter || extratoCompanyFilter || extratoOperatorFilter || extratoStartDate || extratoEndDate) && (
                      <div className="px-4 py-2 bg-zinc-50 border-b border-slate-100 flex justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setExtratoSearchText('');
                            setExtratoDriverFilter('');
                            setExtratoRouteFilter('');
                            setExtratoFilialFilter('');
                            setExtratoTypeFilter('');
                            setExtratoCompanyFilter('');
                            setExtratoOperatorFilter('');
                            setExtratoStartDate('');
                            setExtratoEndDate('');
                          }}
                          className="text-[10px] bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-500 font-bold hover:bg-slate-100 transition cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Limpar Filtros aplicados
                        </button>
                      </div>
                    )}

                    {/* Relação física de Logs */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                      {filteredExtratoList.length === 0 ? (
                        <div className="text-center py-24 text-slate-450 font-extrabold">
                          <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                          Nenhuma movimentação para os filtros especificados no Extrato.
                        </div>
                      ) : (
                        filteredExtratoList.map((mov) => {
                          const isEntrada = mov.tipo === 'entrada';
                          const isSaida = mov.tipo === 'saida';
                          const isDevolucao = mov.tipo === 'devolucao';
                          const isDevolucaoEmpresa = mov.tipo === 'devolucao_empresa';
                          const isExclusao = mov.tipo === 'exclusao';

                          return (
                            <div
                              key={mov.id}
                              className="bg-white rounded-xl border border-slate-150 p-3.5 shadow-xs flex items-start gap-3.5 transition hover:shadow-xs"
                            >
                              {/* Icon indicators */}
                              <div className="shrink-0 pt-0.5">
                                {isEntrada && (
                                  <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg block border border-emerald-100">
                                    <ArrowDownLeft className="h-4.5 w-4.5" />
                                  </span>
                                )}
                                {isSaida && (
                                  <span className="p-2 bg-blue-50 text-blue-600 rounded-lg block border border-blue-100">
                                    <ArrowLeft className="h-4.5 w-4.5" />
                                  </span>
                                )}
                                {isDevolucao && (
                                  <span className="p-2 bg-red-50 text-red-650 rounded-lg block border border-red-150">
                                    <CornerUpLeft className="h-4.5 w-4.5 stroke-[2.5]" />
                                  </span>
                                )}
                                {isDevolucaoEmpresa && (
                                  <span className="p-1.5 bg-orange-50 text-orange-655 rounded-lg flex items-center gap-0.5 border border-orange-100">
                                    <Building className="h-4 w-4" />
                                    <CornerUpLeft className="h-4.5 w-4.5 stroke-[2.5]" />
                                  </span>
                                )}
                                {isExclusao && (
                                  <span className="p-2 bg-rose-50 text-rose-600 rounded-lg block border border-rose-100">
                                    <Trash2 className="h-4.5 w-4.5" />
                                  </span>
                                )}
                              </div>

                              {/* Content description details */}
                              <div className="flex-1 min-w-0 text-left space-y-1 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="font-mono font-bold tracking-wider text-slate-900 border-b border-indigo-100">
                                    {mov.codigoBarras}
                                  </span>
                                  <span className="text-[10px] text-zinc-650 font-bold flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                    {new Date(mov.dataHora).toLocaleString('pt-BR')}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                  <span className="text-slate-700 bg-slate-100 rounded-md px-1.5 py-0.5 font-bold uppercase text-[9px] border border-slate-200">
                                    {mov.empresaNome}
                                  </span>
                                  
                                  <span className="text-slate-450">•</span>
                                  
                                  <span className="text-indigo-700 bg-indigo-50 rounded-md px-1.5 py-0.5 font-extrabold text-[9px] border border-indigo-100">
                                    QTD: {mov.quantidade || 1} { (mov.quantidade || 1) === 1 ? 'VOL' : 'VOLS' }
                                  </span>
                                  
                                  <span className="text-slate-450">•</span>
                                  
                                  <span>Filial: <strong className="text-zinc-650 font-bold">{mov.filialNome}</strong></span>
                                  
                                  <span className="text-slate-450">•</span>
                                  
                                  <span>Operador: <strong className="text-slate-700 font-bold">{mov.usuarioNome}</strong></span>
                                </div>

                                {/* Context driver and route inside statement */}
                                {(mov.entregadorNome || mov.rotaNome) && (
                                  <div className="bg-slate-50 border border-slate-100/50 rounded-lg p-2 mt-1.5 flex flex-wrap items-center gap-3.5 text-[11px]">
                                    {mov.entregadorNome && (
                                      <span className="text-slate-600">
                                        Entregador: <strong className="text-slate-900 font-black">{mov.entregadorNome}</strong>
                                      </span>
                                    )}
                                    {mov.rotaNome && (
                                      <span className="text-slate-600">
                                        Rota: <strong className="text-slate-950 font-black">{mov.rotaNome}</strong>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Operation volume column */}
                              <div className="text-right shrink-0">
                                <span className={`text-[13px] font-black rounded-lg px-2.5 py-1 ${
                                  isEntrada ? 'bg-emerald-50 text-emerald-700' :
                                  isSaida ? 'bg-indigo-50 text-indigo-700' :
                                  isExclusao ? 'bg-rose-50 text-rose-700' :
                                  isDevolucaoEmpresa ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                  'bg-amber-50 text-orange-700'
                                }`}>
                                  {isEntrada ? '+' : isSaida ? '-' : isExclusao ? '-' : isDevolucaoEmpresa ? '-' : '+'}{mov.quantidade} un
                                </span>
                                <p className="text-[9px] uppercase text-slate-405 font-black mt-1">
                                  {isEntrada ? 'Entrada' : isSaida ? 'Saída' : isExclusao ? 'Exclusão' : isDevolucaoEmpresa ? 'Dev. Empresa' : 'Retorno'}
                                </p>
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer of Slide Over */}
                    <div className="bg-white border-t border-slate-150 p-4 shrink-0 flex justify-between items-center text-xs text-slate-400 font-semibold font-sans">
                      <span>Exibindo {filteredExtratoList.length} logs com base nos filtros</span>
                      <button
                        type="button"
                        onClick={() => setIsExtratoOpen(false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition font-bold"
                      >
                        Fechar Extrato
                      </button>
                    </div>

                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL ADICIONAR PAC COUTO DE FORMA RETIRADO/CUSTÓDIA MANUAL */}
      <AnimatePresence>
        {isAddPacoteModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 shadow-2xl" id="modal-adicionar-custodia">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddPacoteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden z-10 p-6 space-y-5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-650 shrink-0">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base font-sans text-left">
                      Custódia: Adicionar Pacote
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 text-left font-sans leading-normal">
                      Adicione manualmente um volume diretamente em posse da filial. O sistema detectará automaticamente de qual empresa o pacote pertence.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddPacoteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-655 transition p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Código de barras / bipagem */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide font-sans">
                    Bipar ou Inserir Código de Barras
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Insira ou bipe o código de barras..."
                      value={addPacoteBarcode}
                      onChange={(e) => setAddPacoteBarcode(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:bg-white"
                      autoFocus
                    />
                    <Scan className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  </div>

                  {/* Feedback visual de identificação inteligente */}
                  {detectedCompany ? (
                    <div className="mt-1.5 px-3 py-2 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-[11px] font-bold font-sans flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Empresa de Origem: <strong className="text-emerald-900 font-extrabold">{detectedCompany.nome}</strong></span>
                    </div>
                  ) : addPacoteBarcode.trim() ? (
                    <div className="mt-1.5 px-3 py-2 bg-amber-50 border border-amber-150 text-amber-850 rounded-xl text-[11px] font-bold font-sans flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Prefixo / pacote não correspondente nas empresas de origem registradas</span>
                    </div>
                  ) : null}
                </div>

                {/* Classificação do Pacote (Zona Rural, Avariado ou Outra Cidade) */}
                <div className="space-y-2 text-left">
                  <label className="block text-[11px] font-bold text-slate-505 uppercase tracking-wide font-sans">
                    Classificação do Pacote
                  </label>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setAddPacoteClassification('zona_rural')}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold flex flex-col transition cursor-pointer ${
                        addPacoteClassification === 'zona_rural' 
                          ? 'bg-indigo-50/55 border-indigo-300 text-indigo-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-705 hover:bg-slate-50'
                      }`}
                    >
                      <span>Zona Rural (Endereço Rural)</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 font-sans">Endereço fora da delimitação urbana regular.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAddPacoteClassification('avariado')}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold flex flex-col transition cursor-pointer ${
                        addPacoteClassification === 'avariado' 
                          ? 'bg-indigo-50/55 border-indigo-300 text-indigo-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-705 hover:bg-slate-50'
                      }`}
                    >
                      <span>Pacote Avariado de Origem</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 font-sans">Conteúdo danificado, avaria ou amassado de fábrica.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAddPacoteClassification('outra_cidade')}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold flex flex-col transition cursor-pointer ${
                        addPacoteClassification === 'outra_cidade' 
                          ? 'bg-indigo-50/55 border-indigo-300 text-indigo-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-705 hover:bg-slate-50'
                      }`}
                    >
                      <span>Outra Cidade / Não Atendida</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 font-sans">Endereço pertencente a outro município não atendido.</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirm Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-end pt-3 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsAddPacoteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200 font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddCustodiaPacote}
                  disabled={!addPacoteBarcode.trim() || !detectedCompany}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border border-indigo-700 flex items-center justify-center gap-1.5 hover:scale-[1.01] font-sans"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar em Estoque</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL LIMPAR COMPANHIA DO ESTOQUE EM CUSTODIA */}
      <AnimatePresence>
        {isLimparPacotesModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 shadow-2xl" id="modal-limpar-estoque">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLimparPacotesModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden z-10 p-6 space-y-5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2.5 bg-rose-50 rounded-xl text-rose-650 shrink-0">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base font-sans text-left">
                      Limpar Pacotes do Estoque
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 text-left font-sans leading-normal">
                      Remova volumes atualmente sob custódia de pátio nesta filial. Escolha uma empresa específica ou limpe todas de uma vez.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLimparPacotesModalOpen(false)}
                  className="text-slate-400 hover:text-slate-655 transition p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-505 uppercase tracking-wide font-sans">
                    Selecione a Empresa de Origem
                  </label>
                  <select
                    value={limparPacotesCompanyId}
                    onChange={(e) => setLimparPacotesCompanyId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:bg-white cursor-pointer"
                    id="select-limpar-empresa-escolha"
                  >
                    <option value="">🧹 Limpar TODAS as Empresas</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        🏢 {emp.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-[10.5px] text-rose-800 font-semibold leading-relaxed">
                  ⚠️ <strong>Atenção:</strong> Essa operação removerá o saldo de posse física do pátio para a empresa/filial correspondente. Ela registrará baixa de devolução/ajuste administrativa automática no extrato para justificar a zeragem.
                </div>
              </div>

              {/* Confirm Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-end pt-3 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsLimparPacotesModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200 font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleLimparPacotesPorEmpresa(limparPacotesCompanyId)}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border border-rose-700 flex items-center justify-center gap-1.5 hover:scale-[1.01] font-sans"
                >
                  <Trash2 className="h-4 w-4 text-rose-200" />
                  <span>Confirmar Limpeza</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
