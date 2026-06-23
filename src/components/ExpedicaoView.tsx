/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db, cleanBarcode, collection, query, where, onSnapshot, doc, setDoc } from '../lib/supabase';
import { 
  Scan, 
  Trash2, 
  FileText, 
  Printer, 
  CheckCircle, 
  Plus, 
  Building2,
  User,
  Barcode,
  Sparkles,
  ClipboardList,
  Copy,
  Check,
  MapPin,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertTriangle,
  HelpCircle,
  Lock
} from 'lucide-react';
import { Empresa, Entregador, Expedicao, Pacote, Rota, User as SystemUser, Filial, ConciliacaoDiaria } from '../types';

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

interface ExpedicaoViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  rotas: Rota[];
  onAddExpedicao: (novaExpedicao: Expedicao) => void;
  currentUser: SystemUser;
  filiais: Filial[];
  expedicoes: Expedicao[];
  conciliacoesDiarias?: ConciliacaoDiaria[];
}

export default function ExpedicaoView({ 
  empresas, 
  entregadores, 
  rotas, 
  onAddExpedicao, 
  currentUser, 
  filiais, 
  expedicoes,
  conciliacoesDiarias = []
}: ExpedicaoViewProps) {
  // Gestão de filiais permitidas e filial selecionada como padrão
  const userPermittedFiliais = useMemo(() => {
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      return filiais || [];
    }
    const permittedIds = currentUser.filiais || [];
    return (filiais || []).filter(f => permittedIds.includes(f.id));
  }, [filiais, currentUser]);

  const [selectedFilialId, setSelectedFilialId] = useState<string>(() => {
    const savedFilialId = safeStorage.getItem('currentSelectedFilialId');
    if (savedFilialId && userPermittedFiliais.some(f => f.id === savedFilialId)) {
      return savedFilialId;
    }
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

  const filteredEntregadores = useMemo(() => {
    if (!selectedFilialId) return [];
    return entregadores.filter(ent => ent.filialId === selectedFilialId);
  }, [entregadores, selectedFilialId]);

  const [selectedEntregadorId, setSelectedEntregadorId] = useState<string>(() => {
    return safeStorage.getItem('currentSelectedEntregadorId') || '';
  });

  // Ao alterar de filial, resetar entregador se ele não fizer parte da nova filial
  useEffect(() => {
    if (selectedEntregadorId && !filteredEntregadores.some(e => e.id === selectedEntregadorId)) {
      setSelectedEntregadorId('');
    }
  }, [selectedFilialId, filteredEntregadores, selectedEntregadorId]);
  
  const [selectedRotaIds, setSelectedRotaIds] = useState<string[]>(() => {
    try {
      const saved = safeStorage.getItem('currentSelectedRotaIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isRoutesDropdownOpen, setIsRoutesDropdownOpen] = useState<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  const [scannedItems, setScannedItems] = useState<Array<{ codigoBarras: string; empresaId: string }>>(() => {
    try {
      const saved = safeStorage.getItem('currentScannedItems');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Sincronizar estado de bipagem em tempo real com o Painel de TV (HDMI)
  // Grava localmente no localStorage e sincroniza online na nuvem central para que celulares falem com TVs em tempo real!
  useEffect(() => {
    safeStorage.setItem('currentScannedItems', JSON.stringify(scannedItems));
    safeStorage.setItem('currentSelectedEntregadorId', selectedEntregadorId);
    safeStorage.setItem('currentSelectedRotaIds', JSON.stringify(selectedRotaIds));
    safeStorage.setItem('currentSelectedFilialId', selectedFilialId);

    const syncWithCloud = async () => {
      try {
        await setDoc(doc(db, 'user_sessions', 'active_triagem'), {
          id: 'active_triagem',
          scannedItems,
          selectedEntregadorId,
          selectedRotaIds,
          selectedFilialId,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Erro ao salvar triagem ativa em nuvem:", err);
      }
    };

    if (db) {
      syncWithCloud();
    }
  }, [scannedItems, selectedEntregadorId, selectedRotaIds, selectedFilialId]);

  const handleToggleRota = (rotaId: string) => {
    setSelectedRotaIds(prev => 
      prev.includes(rotaId) 
        ? prev.filter(id => id !== rotaId) 
        : [...prev, rotaId]
    );
  };
  
  // Controle para o documento de manifesto gerado no final
  const [completedExpedicao, setCompletedExpedicao] = useState<Expedicao | null>(null);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState<boolean>(false);

  // --- CONCILIAÇÃO & INDICADORES DE EXCESSO ---
  const todayDateStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Carregar pacotes cadastrados da filial ativa para hoje
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
      console.error("Erro ao carregar pacotes cadastrados na expedição:", err);
    });

    return () => unsub();
  }, [selectedFilialId, todayDateStr]);

  const previouslyShippedCountByCompany = useMemo(() => {
    const counts: { [empresaId: string]: number } = {};
    empresas.forEach(emp => {
      counts[emp.id] = 0;
    });

    if (expedicoes) {
      expedicoes.forEach(exp => {
        if (exp.filialId !== selectedFilialId) return;
        if (!exp.dataHoraSaida) return;
        const expDate = exp.dataHoraSaida.substring(0, 10);
        if (expDate !== todayDateStr) return;

        if (exp.itens && Array.isArray(exp.itens)) {
          exp.itens.forEach(item => {
            if (item.empresaId && counts[item.empresaId] !== undefined) {
              counts[item.empresaId]++;
            }
          });
        }
      });
    }
    return counts;
  }, [expedicoes, empresas, selectedFilialId, todayDateStr]);

  const patioLimitByCompany = useMemo(() => {
    const limits: { [empresaId: string]: number } = {};
    empresas.forEach(emp => {
      const conciliacaoId = `${todayDateStr}_${selectedFilialId}_${emp.id}`;
      const match = conciliacoesDiarias?.find(c => c.id === conciliacaoId);
      limits[emp.id] = match ? match.quantidadePatio : 0;
    });
    return limits;
  }, [empresas, conciliacoesDiarias, selectedFilialId, todayDateStr]);

  // Mapeia os pacotes bipados e identifica os que são excedentes em relação ao pátio do dia
  const scannedItemsWithExcessFlag = useMemo(() => {
    const counts: { [empresaId: string]: number } = {};
    empresas.forEach(emp => {
      counts[emp.id] = previouslyShippedCountByCompany[emp.id] || 0;
    });

    return scannedItems.map(item => {
      const empId = item.empresaId;
      const limit = patioLimitByCompany[empId] || 0;

      if (empId) {
        counts[empId] = (counts[empId] || 0) + 1;
      }

      // Estar em excesso se o limite foi cadastrado (> 0) e a contagem acumulada for maior que o limite
      const isExcess = limit > 0 && counts[empId] > limit;

      return {
        ...item,
        isExcess
      };
    });
  }, [scannedItems, empresas, previouslyShippedCountByCompany, patioLimitByCompany]);

  const completedFilial = useMemo(() => {
    if (!completedExpedicao) return null;
    return filiais.find(f => f.id === completedExpedicao.filialId);
  }, [completedExpedicao, filiais]);

  const filialNameUsed = completedFilial ? completedFilial.nome : "LOGISTIC EXPRESS DISTRIBUIDORA";

  useEffect(() => {
    if (!completedExpedicao) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setCompletedExpedicao(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [completedExpedicao]);
  const [printHour, setPrintHour] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  
  // Feedback visuais temporários
  const [errorFeedback, setErrorFeedback] = useState<string>('');
  const [successFeedback, setSuccessFeedback] = useState<string>('');
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannedItemsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new item is scanned to ensure the last item is always fully visible on the last row
  useEffect(() => {
    if (scannedItemsContainerRef.current) {
      scannedItemsContainerRef.current.scrollTop = scannedItemsContainerRef.current.scrollHeight;
      const timeoutId = setTimeout(() => {
        if (scannedItemsContainerRef.current) {
          scannedItemsContainerRef.current.scrollTop = scannedItemsContainerRef.current.scrollHeight;
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [scannedItems]);

  // Buscar Entregador Selecionado e obter o Primeiro Nome
  const selectedDeliverer = useMemo(() => {
    return entregadores.find(ent => ent.id === selectedEntregadorId);
  }, [entregadores, selectedEntregadorId]);

  const selectedDelivererFirstName = useMemo(() => {
    if (!selectedDeliverer) return '';
    return selectedDeliverer.nome.trim().split(' ')[0];
  }, [selectedDeliverer]);

  // Som de aviso / erro mais forte para alertas (Unidades não identificadas sem padrão de fallback)
  const playWarningSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBuzz = (delayTime: number, freq: number, dur: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sawtooth'; // textura mais ríspida ideal para buzzer de erro
        oscillator.frequency.value = freq;
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime + delayTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delayTime + dur);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(audioCtx.currentTime + delayTime);
        oscillator.stop(audioCtx.currentTime + delayTime + dur);
      };
      
      playBuzz(0, 150, 0.22);
      playBuzz(0.2, 120, 0.32);
    } catch (e) {
      // blocked or unsupported
    }
  };

  // Simular Bip / Scanner de código de barras
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.permissions.expedicao_readonly) {
      setErrorFeedback("Acesso Negado: Você possui permissão de apenas leitura para esta tela.");
      return;
    }
    if (!barcodeInput.trim()) return;

    // Sanatiza o input do código de barras
    const code = cleanBarcode(barcodeInput);

    // Função auxiliar inteligente para verificar se dois códigos possuem correlação de duplicidade (ex: QR-Code longo e código de barras padrão)
    const isBarcodeDuplicate = (newCode: string, existingCode: string): boolean => {
      const c1 = newCode.trim().toUpperCase();
      const c2 = existingCode.trim().toUpperCase();
      
      // Igualdade absoluta
      if (c1 === c2) return true;
      
      // Se um código contém o outro (mínimo de 6 caracteres para evitar falsos positivos de siglas minúsculas)
      if (c1.length >= 6 && c2.length >= 6) {
        if (c1.includes(c2) || c2.includes(c1)) {
          return true;
        }
      }
      
      // Extrai todas as sequências de números de pelo menos 7 dígitos consecutivos e compara
      const num1 = c1.match(/\d{7,}/g) || [];
      const num2 = c2.match(/\d{7,}/g) || [];
      
      for (const n1 of num1) {
        for (const n2 of num2) {
          if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) {
            return true;
          }
        }
      }
      
      return false;
    };

    // Realiza busca inteligente de duplicidade no lote atual e no histórico global anterior
    let duplicateMatchCode = '';
    
    // 1. Procurar no lote atual sendo bipado (scannedItems)
    const duplicateInCurrent = scannedItems.find(item => isBarcodeDuplicate(code, item.codigoBarras));
    if (duplicateInCurrent) {
      duplicateMatchCode = duplicateInCurrent.codigoBarras;
    }
    
    // 2. Procurar no histórico global de todas as saídas
    if (!duplicateMatchCode && expedicoes) {
      for (const exp of expedicoes) {
        if (exp.itens) {
          const matchedItem = exp.itens.find(item => isBarcodeDuplicate(code, item.codigoBarras));
          if (matchedItem) {
            duplicateMatchCode = matchedItem.codigoBarras;
            break;
          }
        }
      }
    }

    if (duplicateMatchCode) {
      playWarningSound();
      if (code === duplicateMatchCode) {
        setErrorFeedback(`Aviso: O pacote "${code}" já foi registrado anteriormente no sistema!`);
      } else {
        setErrorFeedback(`Tentativa de Bip Duplicado: O código "${code}" foi bloqueado porque corresponde ao pacote "${duplicateMatchCode}" já registrado!`);
      }
      setSuccessFeedback('');
      setBarcodeInput('');
      setTimeout(() => setErrorFeedback(''), 6500);
      return;
    }

    // Determina a empresa do item: busca completa nos cadastros primeiro, senão por prefixo
    let finalEmpresaId = '';
    let detectionMethod = '';

    // 1. Verifica primeiro se existe cadastro para aquele pacote (da planilha ou bipagem de pátio prévia)
    const matchedPackageInDb = pacotesCadastradosHoje.find(p => p.codigoBarras === code);
    if (matchedPackageInDb) {
      finalEmpresaId = matchedPackageInDb.empresaId;
      detectionMethod = '(via Importação de Pacote)';
    } else {
      // 2. Se não existir o cadastro exato, segue a regra do prefixo do cadastro de empresas
      for (const emp of empresas) {
        if (emp.prefixos) {
          const parts = emp.prefixos.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
          if (parts.some(prefix => code.startsWith(prefix))) {
            finalEmpresaId = emp.id;
            detectionMethod = `(via Prefixo '${parts.find(prefix => code.startsWith(prefix))}')`;
            break;
          }
        }
      }
    }

    if (!finalEmpresaId) {
      playWarningSound();
      setErrorFeedback(`Aviso: O prefixo do código "${code}" não está cadastrado em nenhuma empresa parceira!`);
      setSuccessFeedback('');
      setBarcodeInput('');
      setTimeout(() => setErrorFeedback(''), 5500);
      return;
    }

    const matchedEmpName = empresas.find(e => e.id === finalEmpresaId)?.nome || 'Empresa';

    // Toca som de "beep" virtual (Web Audio API)
    playBeepSound(650, 0.08);

    const count = scannedItems.filter(item => item.codigoBarras === code).length + 1;
    const volumeLabel = count > 1 ? ` (Volume #${count})` : '';

    setScannedItems([...scannedItems, { codigoBarras: code, empresaId: finalEmpresaId }]);
    setBarcodeInput('');
    setSuccessFeedback(`Item ${code} associado à [${matchedEmpName}] ${detectionMethod}${volumeLabel}!`);
    setTimeout(() => setSuccessFeedback(''), 3000);
    
    // Devolve o foco ao input para bipadas consecutivas
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  // Gerador automático de códigos de barras de teste rápido com suporte a prefixos inteligentes
  const handleGenerateMockBarcode = () => {
    if (empresas.length === 0) {
      setErrorFeedback("Favor cadastrar pelo menos uma empresa!");
      setTimeout(() => setErrorFeedback(''), 3000);
      return;
    }

    // Escolhe uma empresa aleatória com prefixo cadastrado para demonstrar a auto-associação
    const empresasComPrefixo = empresas.filter(e => e.prefixos && e.prefixos.trim().length > 0);
    let targetEmpresa = empresasComPrefixo.length > 0 
      ? empresasComPrefixo[Math.floor(Math.random() * empresasComPrefixo.length)]
      : empresas[Math.floor(Math.random() * empresas.length)];

    // Pega o primeiro prefixo ou gera um a partir do nome
    let prefix = 'PC';
    if (targetEmpresa.prefixos) {
      const parts = targetEmpresa.prefixos.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
      if (parts.length > 0) {
        prefix = parts[Math.floor(Math.random() * parts.length)];
      }
    } else {
      prefix = targetEmpresa.nome.substring(0, 2).toUpperCase();
    }

    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const mockCode = `${prefix}${randomNumber}`;

    setBarcodeInput(mockCode);
    setTimeout(() => {
      // Simula submissão
      playBeepSound(800, 0.05);
      
      const count = scannedItems.filter(item => item.codigoBarras === mockCode).length + 1;
      const volumeLabel = count > 1 ? ` (Volume #${count})` : '';

      setScannedItems(prev => [...prev, { codigoBarras: mockCode, empresaId: targetEmpresa.id }]);
      setBarcodeInput('');
      setSuccessFeedback(`[BIP DETECTADO] Item ${mockCode} auto-associado à [${targetEmpresa.nome}] via prefixo '${prefix}'${volumeLabel}!`);
      setTimeout(() => setSuccessFeedback(''), 3500);
      
      // Devolve foco
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }, 105);
  };

  // Remover item bipado
  const handleRemoveItem = (indexToRemove: number) => {
    setScannedItems(scannedItems.filter((_, idx) => idx !== indexToRemove));
  };

  // Som de bip virtual em Web Audio API para simular scanner real
  const playBeepSound = (freq: number, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = freq; 
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Navegador bloqueou áudio ou não suporta
    }
  };

  // Finalizar Expedição
  const handleFinalizeExpedicao = () => {
    if (currentUser.permissions.expedicao_readonly) {
      setErrorFeedback("Acesso Negado: Você possui permissão de apenas leitura para esta tela.");
      return;
    }
    if (!selectedEntregadorId) {
      setErrorFeedback("Favor preencher o Nome do Entregador!");
      return;
    }
    if (scannedItems.length === 0) {
      setErrorFeedback("Nenhum pacote foi bipado na lista de saída!");
      return;
    }

    const agora = new Date();
    const uniqueEmpresaIds: string[] = Array.from(new Set(scannedItems.map(item => item.empresaId))) as string[];

    const novaExp: Expedicao = {
      id: `exp-${agora.getTime()}`,
      entregadorId: selectedEntregadorId,
      empresaIds: uniqueEmpresaIds,
      dataHoraSaida: agora.toISOString(),
      itens: scannedItems.map(item => ({
        codigoBarras: item.codigoBarras,
        empresaId: item.empresaId,
        status: 'pendente'
      })),
      concluido: false,
      rotaId: selectedRotaIds[0] || undefined,
      rotaIds: selectedRotaIds,
      filialId: selectedFilialId
    };

    onAddExpedicao(novaExp);
    
    // Setar para visualização e impressão imediata de documento
    setCompletedExpedicao(novaExp);
    setPrintHour(agora.toLocaleString('pt-BR'));
    
    // Resetar campos de controle
    setSelectedEntregadorId('');
    setSelectedRotaIds([]);
    setIsRoutesDropdownOpen(false);
    setScannedItems([]);
    setIsConfirmingCancel(false);
  };

  const handleCancelExpedicao = () => {
    setScannedItems([]);
    setSelectedEntregadorId('');
    setSelectedRotaIds([]);
    setBarcodeInput('');
    setIsConfirmingCancel(false);
    safeStorage.removeItem('currentScannedItems');
    safeStorage.removeItem('currentSelectedEntregadorId');
    safeStorage.removeItem('currentSelectedRotaIds');
  };

  // Aciona cópia do manifesto formatado em texto para o clipboard (ótimo para WhatsApp)
  const handleCopyToClipboard = () => {
    if (!completedExpedicao) return;
    const deliverer = entregadores.find(ent => ent.id === completedExpedicao.entregadorId);
    
    const rNames = rotas
      .filter(r => (completedExpedicao.rotaIds || (completedExpedicao.rotaId ? [completedExpedicao.rotaId] : [])).includes(r.id))
      .map(r => r.nome)
      .join(', ') || "Nenhuma";
    
    let report = `========================================\n`;
    report += `     ${filialNameUsed.toUpperCase()}     \n`;
    report += `========================================\n`;
    report += `COD. REMESSA: #${completedExpedicao.id.substring(completedExpedicao.id.length - 8).toUpperCase()}\n`;
    report += `DATA EMISSÃO: ${printHour}\n`;
    report += `----------------------------------------\n`;
    report += `ENTREGADOR: ${deliverer?.nome || "CARGA AVULSA"}\n`;
    report += `CPF: ${deliverer?.cpf || "Não cadastrado"}\n`;
    report += `CONTATO: ${deliverer?.contato || "N/A"}\n`;
    report += `ROTAS VINCULADAS: ${rNames}\n`;
    report += `----------------------------------------\n`;
    report += `RELAÇÃO DE VOLUMES (${completedExpedicao.itens.length} PACOTES):\n`;
    
    completedExpedicao.itens.forEach((item, idx) => {
      const emp = empresas.find(e => e.id === item.empresaId);
      report += `${idx + 1}. [${item.codigoBarras}] - ${emp?.nome || 'Desconhecida'}\n`;
    });
    
    report += `----------------------------------------\n`;
    report += `DECLARAÇÃO DE RECEBIMENTO:\n`;
    report += `Declaro que recebi em perfeito estado as mercadorias descritas acima e me comprometo com a guarda e transporte final.\n\n`;
    report += `Assinatura: ____________________________________\n`;
    report += `========================================`;

    try {
      const textarea = document.createElement('textarea');
      textarea.value = report;
      textarea.style.position = 'fixed'; // Evita scroll na página no Safari
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
        return;
      }
    } catch (e) {
      console.warn('Cópia via textarea falhou, tentando API nativa:', e);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(() => {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      }).catch(err => {
        console.error('Falha geral ao copiar texto:', err);
      });
    }
  };

  // Trigger exportação em PDF e impressão do romaneio de saída
  const handlePrintManifest = async () => {
    if (!completedExpedicao) return;
    setIsExporting(true);

    try {
      // Instancia o jsPDF diretamente (sem html2canvas) para evitar falhas de CORS, sandbox ou oklch
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // 1. Cabeçalho Principal (Marca)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(`EXPEDLOG - ${filialNameUsed.toUpperCase()}`, 15, 19);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("RECIBO DE REMESSA (SAÍDA) - ACERTO DE VOLUMES", 15, 24);
      
      // Código e Data no canto direito
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate-900
      const codeText = `COD. REMESSA: #${completedExpedicao.id.substring(completedExpedicao.id.length - 8).toUpperCase()}`;
      doc.text(codeText, 135, 20);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`DATA EMISSÃO: ${printHour}`, 135, 25);

      // Divisor elegante
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.line(15, 28, 195, 28);

      // 2. Quadro de Informações do Entregador
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, 33, 180, 27, "F");
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(15, 33, 180, 27, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("ENTREGADOR DESTINATÁRIO (CARGA / ROTAS)", 20, 39);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(activeDeliverer?.nome || "CARGA AVULSA", 20, 45);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`CPF: ${activeDeliverer?.cpf || "Não cadastrado"}`, 20, 51);
      doc.text(`Contato / Tel: ${activeDeliverer?.contato || "N/A"}`, 100, 51);

      const expRoutesText = rotas
        .filter(r => (completedExpedicao.rotaIds || (completedExpedicao.rotaId ? [completedExpedicao.rotaId] : [])).includes(r.id))
        .map(r => r.nome)
        .join(', ') || "Nenhuma rota vinculada";
      doc.text(`Rotas Ativas: ${expRoutesText}`, 20, 56);

      // 3. Relação de Volumes (Tabela)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const totalPacotes = completedExpedicao.itens.length;
      doc.text(`RELAÇÃO DE VOLUMES EXPEDIDOS (${totalPacotes} PACOTES)`, 15, 67);

      // Cabeçalho da Tabela
      let y = 71;
      doc.setFillColor(30, 41, 59); // Slate-800 Header
      doc.rect(15, y, 180, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("SEQ", 18, y + 5.5);
      doc.text("CÓDIGO DE BARRAS / ETIQUETA", 35, y + 5.5);
      doc.text("EMPRESA REMETENTE - ORIGEM", 120, y + 5.5);

      y += 8;

      // Iterando nas linhas da tabela
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);

      completedExpedicao.itens.forEach((item, index) => {
        // Controle estrito de overflow de página
        if (y > 255) {
          doc.addPage();
          y = 20; // Recomeça do topo na nova página
          
          doc.setFillColor(30, 41, 59);
          doc.rect(15, y, 180, 8, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          doc.text("SEQ", 18, y + 5.5);
          doc.text("CÓDIGO DE BARRAS / ETIQUETA", 35, y + 5.5);
          doc.text("EMPRESA REMETENTE - ORIGEM", 120, y + 5.5);
          y += 8;
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(51, 65, 85);
        }

        // Fundo zebrado para facilitar leitura de códigos longos
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, y, 180, 6.5, "F");
        }
        
        // Borda inferior fraca
        doc.setDrawColor(241, 245, 249);
        doc.line(15, y + 6.5, 195, y + 6.5);

        const emp = empresas.find(e => e.id === item.empresaId);
        doc.text((index + 1).toString().padStart(2, "0"), 18, y + 4.5);
        doc.text(item.codigoBarras, 35, y + 4.5);
        doc.text(emp?.nome || "Desconhecida", 120, y + 4.5);

        y += 6.5;
      });

      // 4. Declaração e Bloco de Assinatura
      y += 8;
      if (y > 235) {
        doc.addPage();
        y = 20;
      }

      // Caixa de Termo de Responsabilidade
      doc.setFillColor(250, 251, 252);
      doc.rect(15, y, 180, 22, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, y, 180, 22, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text("DECLARAÇÃO DE RECEBIMENTO & RESPONSABILIDADE LEGAL", 20, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      
      const textLine1 = "Declaro para os devidos fins que recebi em perfeito estado os volumes acima descritos para transporte,";
      const textLine2 = "comprometendo-me com a guarda física, integridade e correta baixa final perante esta distribuidora.";
      doc.text(textLine1, 20, y + 11);
      doc.text(textLine2, 20, y + 16);

      y += 33;
      if (y > 275) {
        doc.addPage();
        y = 35;
      }

      // Linha de Assinatura
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.4);
      doc.line(45, y, 165, y);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text("ASSINATURA E TERMO DE ACORDO DO ENTREGADOR RECEBEDOR", 55, y + 4.5);

      // Nome do Arquivo de saída
      const delivererName = activeDeliverer?.nome || 'Entregador';
      const fileId = completedExpedicao?.id ? completedExpedicao.id.substring(completedExpedicao.id.length - 8).toUpperCase() : 'manifesto';
      const fileName = `romaneio-saida-${delivererName.trim().toLowerCase().replace(/\s+/g, '-')}-${fileId}.pdf`;

      // Salva o PDF no navegador local de forma limpa e nativa
      doc.save(fileName);

      // Na sequência, se o navegador permitir, tenta acionar a janela de impressão do frame
      try {
        window.print();
      } catch (err) {
        console.warn('Função de impressão nativa pode requerer abertura fora do frame:', err);
      }
    } catch (error) {
      console.error('Falha geral ao gerar PDF usando jsPDF nativo:', error);
      // Fallback para impressão da tela via browser caso o PDF falhe
      try {
        window.print();
      } catch (pErr) {
        console.error('Window print falhou:', pErr);
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Dados do entregador ativo concluído
  const activeDeliverer = useMemo(() => {
    if (!completedExpedicao) return null;
    return entregadores.find(ent => ent.id === completedExpedicao.entregadorId);
  }, [completedExpedicao, entregadores]);

  return (
    <div className="space-y-6" id="view-expedicao">
      
      {currentUser.permissions.expedicao_readonly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-sm">
          <Lock className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
          <span>
            <strong>Modo de Leitura Ativo:</strong> Suas permissões no sistema são de apenas consulta. A criação e o encerramento de novas guias de saídas estão desabilitados.
          </span>
        </div>
      )}
      
      {/* Banner de informações rápidas e contador gigante */}
      {!completedExpedicao && (
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center md:justify-between shadow-lg border border-blue-950/25 gap-5">
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold font-heading tracking-tight flex items-center gap-2">
              <Scan className="h-6 w-6 text-blue-300 animate-pulse shrink-0" />
              CONTROLE DE SAÍDA: BIPAGEM DE PACOTES
            </h2>
            <p className="text-blue-100 text-xs font-semibold">
              Bipe consecutivamente os códigos de barras dos cartões/volumes para triagem de {selectedEntregadorId ? 'carregamento' : 'remessa'}.
            </p>
          </div>
          
          {/* Contador Gigante de alta visibilidade */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-2xl flex items-center gap-5 shadow-inner shrink-0 justify-between md:justify-start">
            <div className="text-right">
              <p className="text-[10px] uppercase font-black text-blue-200 tracking-wider">LIDOS NO MOMENTO</p>
              <p className="text-xs text-emerald-300 font-bold mt-1 uppercase tracking-wide font-mono flex items-center gap-1.5 justify-end">
                <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                {selectedDelivererFirstName ? `RESPONSÁVEL: ${selectedDelivererFirstName}` : 'Aguardando Responsável'}
              </p>
            </div>
            
            {/* O widget numérico do contador em tamanho extra grande para ser visível de longe */}
            <div className="bg-white text-blue-900 rounded-xl px-5 py-2 flex flex-col items-center justify-center shadow-md min-w-[95px] border border-blue-50">
              <span className="text-4xl font-extrabold font-mono leading-none tracking-tight">
                {scannedItems.length}
              </span>
              <span className="text-[8px] font-black text-blue-800/80 uppercase tracking-widest mt-1">ITENS</span>
            </div>
          </div>
        </div>
      )}

      {/* Container Principal da Expedição */}
      {!completedExpedicao ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LADO ESQUERDO: Configurações de Saída e Bipagem */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-500" />
              1. Configurar Carregamento
            </h3>

            {/* Filial do Carregamento */}
            <div className="space-y-2">
              <label htmlFor="select-filial" className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                Filial de Carregamento
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <select
                  id="select-filial"
                  value={selectedFilialId}
                  onChange={(e) => setSelectedFilialId(e.target.value)}
                  className="w-full bg-slate-50 pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  {userPermittedFiliais.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                  {userPermittedFiliais.length === 0 && (
                    <option value="" disabled>Nenhuma filial autorizada</option>
                  )}
                </select>
              </div>
            </div>

            {/* Nome do Entregador */}
            <div className="space-y-2">
              <label htmlFor="select-entregador" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Responsável (Entregador)
              </label>
              <div className="relative flex items-center">
                {selectedDeliverer?.foto ? (
                  <img
                    src={selectedDeliverer.foto}
                    alt={selectedDeliverer.nome}
                    referrerPolicy="no-referrer"
                    className="absolute left-3 top-2.5 h-6 w-6 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                )}
                <select
                  id="select-entregador"
                  value={selectedEntregadorId}
                  onChange={(e) => setSelectedEntregadorId(e.target.value)}
                  className="w-full bg-slate-50 pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="">Selecione o entregador...</option>
                  {filteredEntregadores.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.nome} (CPF: {ent.cpf})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seleção de Rotas (Múltiplas Opcionais) */}
            <div className="space-y-2 relative" style={{ zIndex: isRoutesDropdownOpen ? 30 : 5 }} id="container-select-rotas">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Rotas Vinculadas ({selectedRotaIds.length} selecionada(s))
              </label>
              
              <button
                type="button"
                id="btn-selecionar-rotas-popover"
                onClick={() => setIsRoutesDropdownOpen(prev => !prev)}
                className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between cursor-pointer text-left transition hover:bg-slate-100"
              >
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="h-5 w-5 text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold truncate">
                    {selectedRotaIds.length === 0 
                      ? 'Nenhuma rota (Carga Avulsa)' 
                      : rotas
                          .filter(r => selectedRotaIds.includes(r.id))
                          .map(r => r.nome)
                          .join(', ')
                    }
                  </span>
                </div>
                {isRoutesDropdownOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {isRoutesDropdownOpen && (
                  <>
                    {/* Backdrop invisível para fechar o popover ao clicar fora */}
                    <div 
                      className="fixed inset-0 z-10 cursor-default" 
                      onClick={() => setIsRoutesDropdownOpen(false)} 
                    />
                    
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-72 flex flex-col overflow-hidden"
                    >
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-52">
                        {rotas.length === 0 ? (
                          <div className="text-xs text-slate-400 text-center py-4">Nenhuma rota cadastrada</div>
                        ) : (
                          rotas.map(rot => {
                            const isChecked = selectedRotaIds.includes(rot.id);
                            return (
                              <button
                                key={rot.id}
                                type="button"
                                onClick={() => handleToggleRota(rot.id)}
                                className={`w-full flex items-start space-x-2.5 p-2 rounded-lg text-left transition select-none ${
                                  isChecked 
                                    ? 'bg-emerald-50 text-emerald-800 font-bold' 
                                    : 'hover:bg-slate-50 text-slate-600'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                  className="mt-0.5 h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-500 shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold block truncate">{rot.nome}</span>
                                  <span className="text-[10px] text-slate-400 font-medium block truncate leading-none mt-0.5">{rot.descricao}</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                      <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                        <button
                          type="button"
                          id="btn-confirm-rotas"
                          onClick={() => setIsRoutesDropdownOpen(false)}
                          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer text-center"
                        >
                          Confirmar Rotas Selecionadas
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Bipar Itens */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <label htmlFor="input-barcode" className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                  2. Bipar Código de Barras (Auto-associação via Prefixo)
                </label>
                {!currentUser.permissions.expedicao_readonly && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleGenerateMockBarcode}
                      className="text-[10px] text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                      id="btn-mock-scan"
                    >
                      <Sparkles className="h-3 w-3" />
                      Gerar Carga de Teste
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleBarcodeSubmit} className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    ref={barcodeInputRef}
                    id="input-barcode"
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes('^') || val.includes('Id') || val.includes('ID') || val.startsWith('`')) {
                        setBarcodeInput(cleanBarcode(val));
                      } else {
                        setBarcodeInput(val);
                      }
                    }}
                    placeholder={currentUser.permissions.expedicao_readonly ? "Modo de apenas leitura..." : "Bipe ou digite o código..."}
                    disabled={empresas.length === 0 || currentUser.permissions.expedicao_readonly}
                    className="w-full bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  id="btn-bipar-submit"
                  type="submit"
                  disabled={empresas.length === 0 || currentUser.permissions.expedicao_readonly}
                  className="bg-slate-800 hover:bg-slate-900 duration-150 text-white p-3 rounded-xl block disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Scan className="h-5 w-5" />
                </button>
              </form>

              {/* Feedbacks de Error */}
              <AnimatePresence>
                {errorFeedback && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-2.5 text-xs bg-rose-50 border border-rose-100 text-rose-700 rounded-lg"
                  >
                    {errorFeedback}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Botão Concluir Expedição */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                id="btn-checkout-concluir"
                onClick={handleFinalizeExpedicao}
                disabled={scannedItems.length === 0 || !selectedEntregadorId || currentUser.permissions.expedicao_readonly}
                className="w-full py-3 bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 transition"
              >
                {currentUser.permissions.expedicao_readonly ? <Lock className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                {currentUser.permissions.expedicao_readonly ? "Bloqueado pelo Administrador" : `Concluir Remessa (${scannedItems.length} itens)`}
              </button>

              {(scannedItems.length > 0 || selectedEntregadorId) && (
                <div className="pt-1">
                  {!isConfirmingCancel ? (
                    <button
                      id="btn-checkout-cancelar"
                      type="button"
                      onClick={() => setIsConfirmingCancel(true)}
                      className="w-full py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-bold rounded-xl flex items-center justify-center gap-2 transition text-xs uppercase tracking-wide"
                    >
                      <Trash2 className="h-4 w-4" />
                      Cancelar Remessa
                    </button>
                  ) : (
                    <div className="bg-rose-50 border border-rose-150 p-2.5 rounded-xl space-y-2">
                      <p className="text-[10px] text-rose-800 font-black block text-center uppercase tracking-wider">
                        Confirmar cancelamento da remessa ativa? Todos os itens bipados serão descartados.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleCancelExpedicao}
                          className="py-1.5 bg-rose-605 hover:bg-rose-600 bg-rose-500 font-black text-white rounded-lg text-[10px] uppercase text-center transition"
                        >
                          Sim, Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingCancel(false)}
                          className="py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black rounded-lg text-[10px] uppercase text-center transition"
                        >
                          Não, Voltar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* LADO DIREITO: Lista de Itens Bipados no Momento */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col justify-between min-h-[660px]">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Scan className="h-5 w-5 text-blue-500" />
                  Visualizador de Triagem de Saída
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedDelivererFirstName && (
                    <div className="bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
                      <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest font-sans">
                        Entregador:
                      </span>
                      <span className="text-blue-900 font-extrabold text-sm uppercase tracking-wide">
                        {selectedDelivererFirstName}
                      </span>
                    </div>
                  )}
                  <div className="bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-xl flex items-center gap-3 shadow-xs">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest font-sans">
                      Qtd Bipada:
                    </span>
                    <span className="bg-emerald-600 text-white rounded-lg px-3 py-1 text-xl font-mono font-black shadow-sm leading-none min-w-[36px] text-center">
                      {scannedItems.length}
                    </span>
                  </div>
                </div>
              </div>

              {scannedItems.length === 0 ? (
                <div className="text-center py-24 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl flex-1 flex flex-col justify-center items-center">
                  <Barcode className="h-12 w-12 mx-auto text-slate-300 stroke-1 mb-3" />
                  <p className="font-semibold text-slate-500">Nenhum pacote bipado ainda</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Selecione o entregador e as empresas à esquerda, e use o campo de bipagem para dar saída de forma rápida de cada item.
                  </p>
                </div>
              ) : (
                <div 
                  ref={scannedItemsContainerRef}
                  className="overflow-x-auto flex-1 min-h-[480px] max-h-[580px] overflow-y-auto border border-slate-100 rounded-xl shadow-xs"
                >
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nº</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Código de Barras</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Empresa Origem</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {scannedItemsWithExcessFlag.map((item, idx) => {
                        const emp = empresas.find(e => e.id === item.empresaId);
                        return (
                          <motion.tr 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={idx} 
                            className={item.isExcess 
                              ? "bg-rose-50/80 hover:bg-rose-100/70 border-l-4 border-l-rose-500 transition duration-150" 
                              : "hover:bg-slate-50/50 transition duration-150"
                            }
                          >
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-700">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-bold ${item.isExcess ? "text-rose-700" : ""}`}>
                                  {item.codigoBarras}
                                </span>
                                {item.isExcess && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[9px] font-black bg-rose-600 text-white animate-pulse shadow-xs tracking-wider uppercase">
                                    <AlertTriangle className="h-3 w-3" /> Excesso
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${item.isExcess ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                                {emp?.nome || 'Desconhecida'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="text-rose-500 hover:text-rose-700 transition p-1"
                                id={`btn-remover-item-${idx}`}
                                title="Remover item da remessa"
                              >
                                <Trash2 className="h-4 w-4 inline-block" />
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Avisos Informativos rápidos */}
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <span className="font-bold text-slate-600 block uppercase tracking-wide">💡 Dicas para a Expedição Rápida:</span>
              <p>• Ao término das leituras, clique em <strong>Concluir Remessa</strong>.</p>
              <p>• O documento impresso emitido vincula o entregador e serve de comprovante no acerto salarial devidamente assinado.</p>
            </div>
          </div>

        </div>
      ) : (
        /* MANIFESTO IMPRESSO / COMPROVANTE DE ENTREGA */
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-3xl mx-auto space-y-6"
          id="ready-manifest-screen"
        >
          {/* Alertas print */}
          <div className="flex flex-col gap-4 print:hidden bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-2 text-emerald-700">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <span className="font-bold text-sm">Expedição concluída e registrada!</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={handleCopyToClipboard}
                  className="bg-slate-800 hover:bg-slate-900 duration-150 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  id="btn-copy-manifest-text"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar Texto (WhatsApp)
                    </>
                  )}
                </button>
                <button
                  onClick={handlePrintManifest}
                  disabled={isExporting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  id="btn-print-manifest"
                >
                  {isExporting ? (
                    <>
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      Exportar PDF / Imprimir
                    </>
                  )}
                </button>
                <button
                  onClick={() => setCompletedExpedicao(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  id="btn-close-manifest"
                  title="Voltar à Expedição (Pode também pressionar a tecla ESC)"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar à Expedição (ESC)
                </button>
              </div>
            </div>
            
            {/* Aviso sobre Iframe / Sandbox */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-normal">
              <strong>⚠️ Restrição de Impressão do Visualizador:</strong> Se o botão acima não abrir o PDF ou diálogo de impressão devido ao sandbox de segurança do AI Studio, clique em <strong>"Abrir em Nova Aba"</strong> no cabeçalho superior para que o navegador permita downloads e impressões sem impedimentos. Como alternativa, utilize o botão <strong>"Copiar Texto"</strong> para enviar a relação via WhatsApp.
            </div>
          </div>

          {/* ÁREA IMPRIMÍVEL DO DOCUMENTO (FORMATO PAPEL A4 LOGÍSTICO) */}
          <div className="p-6 border-2 border-slate-100 rounded-xl uppercase font-sans text-xs space-y-6 text-black print:border-none print:p-0" id="printable-area">
            
            {/* Cabeçalho */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900" id="distributor-title">EXPEDLOG - {filialNameUsed.toUpperCase()}</h2>
                <p className="text-[10px] text-slate-600 font-bold tracking-wide mt-1">RECIBO DE REMESSA (SAÍDA) - ACERTO DE VOLUMES</p>
              </div>
              <div className="text-right">
                <span className="block font-black text-slate-900">COD. REMESSA: #{completedExpedicao.id.substring(completedExpedicao.id.length - 8).toUpperCase()}</span>
                <span className="block text-[10px] font-semibold text-slate-500">DATA EMISSÃO: {printHour}</span>
              </div>
            </div>

            {/* Informações da Distribuição */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[9px] font-black text-slate-400">ENTREGADOR DESTINATÁRIO</span>
                <span className="font-black text-slate-800 text-sm block mt-0.5">{activeDeliverer?.nome || "CARGA AVULSA"}</span>
                <span className="block text-slate-500 mt-1">CPF: {activeDeliverer?.cpf || "Não cadastrado"}</span>
                <span className="block text-slate-500">Contato: {activeDeliverer?.contato || "N/A"}</span>
              </div>
              <div>
                <span className="block text-[9px] font-black text-slate-400">EMPRESAS PARCEIRAS</span>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {completedExpedicao.empresaIds.map(eid => {
                    const emp = empresas.find(e => e.id === eid);
                    return (
                      <span key={eid} className="border border-slate-900 px-2 py-0.5 font-bold text-[9px] tracking-wide rounded">
                        {emp?.nome}
                      </span>
                    );
                  })}
                </div>
                <span className="block text-slate-500 mt-2">DURAÇÃO ESTIMADA: Turno de Entrega</span>
              </div>
            </div>

            {/* Listagem completa dos volumes pacotes */}
            <div className="space-y-2">
              <h4 className="font-black text-sm tracking-tight border-b border-slate-300 pb-1 flex items-center justify-between">
                <span>Relação de Volumes ({completedExpedicao.itens.length} Pacotes)</span>
                <span className="text-xs text-slate-400 font-bold">CONFERÊNCIA INTERNA</span>
              </h4>
              
              <table className="w-full text-left uppercase text-[10px]">
                <thead>
                  <tr className="border-b border-slate-900 font-black">
                    <th scope="col" className="py-2 w-12">Nº</th>
                    <th scope="col" className="py-2">Código de Barras Volume</th>
                    <th scope="col" className="py-2">Empresa Atribuída</th>
                    <th scope="col" className="py-2 text-right">Acordo / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedExpedicao.itens.map((item, idx) => {
                    const emp = empresas.find(e => e.id === item.empresaId);
                    return (
                      <tr key={idx}>
                        <td className="py-2 select-none font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2 font-mono font-bold tracking-wider">{item.codigoBarras}</td>
                        <td className="py-2 font-bold">{emp?.nome}</td>
                        <td className="py-2 text-right text-slate-500">[ ] PENDENTE</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Linha de Termo de Recebimento de Carga */}
            <div className="pt-6 border-t-2 border-dashed border-slate-300 text-[10px] text-justify text-slate-600 font-medium">
              Declaro que recebi em perfeito estado as mercadorias/cartões descriminados acima e me comprometo com a guarda, transporte e entrega correta no prazo estipulado por mim e pela distribuidora. Em caso de extravio ou recusa, farei a devida baixa motivada na distribuidora antes do fechamento do expediente diário físico.
            </div>

            {/* Assinaturas */}
            <div className="grid grid-cols-2 gap-10 pt-10">
              <div className="text-center">
                <div className="border-t border-slate-900 mx-auto w-48 mt-4 pt-1 font-bold text-slate-700">
                  Responsável Expedição
                </div>
                <span className="text-[9px] text-slate-400">LOGI-EXPRESS CORP</span>
              </div>
              <div className="text-center">
                <div className="border-t border-slate-900 mx-auto w-56 mt-4 pt-1 font-black text-slate-900">
                  {activeDeliverer?.nome || "ENTREGADOR"}
                </div>
                <span className="text-[9px] text-slate-400">Assinatura Recebimento / Chapa</span>
              </div>
            </div>

          </div>
        </motion.div>
      )}

    </div>
  );
}
