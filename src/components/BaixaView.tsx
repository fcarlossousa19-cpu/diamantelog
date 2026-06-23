/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, cleanBarcode, collection, query, where, onSnapshot } from '../lib/supabase';
import { 
  CheckCircle, 
  RotateCcw, 
  Clock, 
  Barcode, 
  Scan, 
  HelpCircle, 
  BookOpen, 
  AlertTriangle,
  ArrowRightCircle,
  Building,
  User,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { Empresa, Entregador, Expedicao, Pacote, MOTIVOS_PADRAO, User as SystemUser, Filial } from '../types';

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

interface ReturnItem {
  id: string;
  codigoBarras: string;
  empresaId: string;
  status: 'pendente' | 'entregue' | 'devolvido';
  motivoDevolucao?: string;
  observacaoDevolucao?: string;
  expId: string;
  originalIndexInExp: number;
}

interface BaixaViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  expedicoes: Expedicao[];
  onFinalizeExpedicao: (expId: string, itensFinalizados: Pacote[], tempoVoltaMinutos: number) => void;
  syncExpedicoes: (updatedList: Expedicao[]) => void;
  initialEntregadorId?: string;
  onClearInitialEntregadorId?: () => void;
  currentUser: SystemUser;
  filiais: Filial[];
  motivosDevolucao?: string[];
}

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

export default function BaixaView({ 
  empresas, 
  entregadores, 
  expedicoes, 
  onFinalizeExpedicao,
  syncExpedicoes,
  initialEntregadorId,
  onClearInitialEntregadorId,
  currentUser,
  filiais,
  motivosDevolucao = []
}: BaixaViewProps) {
  // Gestão de filiais permitidas e filial selecionada como padrão
  const userPermittedFiliais = useMemo(() => {
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      return filiais || [];
    }
    const permittedIds = currentUser.filiais || [];
    return (filiais || []).filter(f => permittedIds.includes(f.id));
  }, [filiais, currentUser]);

  const [selectedFilialId, setSelectedFilialId] = useState<string>(() => {
    const saved = safeStorage.getItem('baixas_filialId');
    if (saved) return saved;
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

  const [selectedEntregadorId, setSelectedEntregadorId] = useState<string>(() => {
    return safeStorage.getItem('baixas_entregadorId') || '';
  });
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [barcodeScanInput, setBarcodeScanInput] = useState<string>('');

  // Lista de itens carregados para retorno
  const [localItens, setLocalItens] = useState<ReturnItem[]>(() => {
    const saved = safeStorage.getItem('baixas_localItens');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Persistir estados no localStorage para evitar perda ao alternar abas
  useEffect(() => {
    if (selectedFilialId) {
      safeStorage.setItem('baixas_filialId', selectedFilialId);
    } else {
      safeStorage.removeItem('baixas_filialId');
    }
  }, [selectedFilialId]);

  useEffect(() => {
    if (selectedEntregadorId) {
      safeStorage.setItem('baixas_entregadorId', selectedEntregadorId);
    } else {
      safeStorage.removeItem('baixas_entregadorId');
    }
  }, [selectedEntregadorId]);

  useEffect(() => {
    safeStorage.setItem('baixas_localItens', JSON.stringify(localItens));
  }, [localItens]);
  
  // Ao alterar de filial, resetar entregador se ele não fizer parte da nova filial selecionada
  useEffect(() => {
    if (selectedEntregadorId) {
      const ent = entregadores.find(e => e.id === selectedEntregadorId);
      if (ent && ent.filialId !== selectedFilialId) {
        setSelectedEntregadorId('');
        setSelectedEmpresaId('');
        setLocalItens([]);
        safeStorage.removeItem('baixas_entregadorId');
        safeStorage.removeItem('baixas_localItens');
      }
    }
  }, [selectedFilialId, selectedEntregadorId, entregadores]);

  // Captura o entregador inicial se passado via navegação e sincroniza com a filial dele
  useEffect(() => {
    if (initialEntregadorId) {
      const ent = entregadores.find(e => e.id === initialEntregadorId);
      if (ent && ent.filialId) {
        setSelectedFilialId(ent.filialId);
        safeStorage.setItem('baixas_filialId', ent.filialId);
      }
      setSelectedEntregadorId(initialEntregadorId);
      safeStorage.setItem('baixas_entregadorId', initialEntregadorId);
      setSelectedEmpresaId(''); // Limpar empresa anterior
      if (onClearInitialEntregadorId) {
        onClearInitialEntregadorId();
      }
    }
  }, [initialEntregadorId, onClearInitialEntregadorId, entregadores]);
  

  
  // Item sendo configurado para devolução no momento
  const [devolucaoConfigIndex, setDevolucaoConfigIndex] = useState<number | null>(null);

  // Atalho global do teclado para fechar/confirmar o modal de justificativa de devolução com ENTER
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (devolucaoConfigIndex !== null && e.key === 'Enter') {
        if (target && target.id === 'input-devolucao-barcode') {
          // Ignorar o Enter vindo do leitor de código de barras para não fechar o modal na mesma hora do bip
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setDevolucaoConfigIndex(null);
      }
    };
    if (devolucaoConfigIndex !== null) {
      window.addEventListener('keydown', handleGlobalKeyDown, true);
    }
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [devolucaoConfigIndex]);

  // Focar novamente no input de código de barras sempre que fechar o modal
  useEffect(() => {
    if (devolucaoConfigIndex === null) {
      barcodeInputRef.current?.focus();
    }
  }, [devolucaoConfigIndex]);
  
  // Modal de Aviso de finalização sem motivo
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // Estados para detecção inteligente de pacotes e modais correspondentes
  const [pendingDevolucaoCode, setPendingDevolucaoCode] = useState<string | null>(null);
  const [unrecognizedCodeModal, setUnrecognizedCodeModal] = useState<{ code: string } | null>(null);

  // Feedbacks
  const [errorFeedback, setErrorFeedback] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

   const barcodeInputRef = useRef<HTMLInputElement>(null);
 
  const todayDateStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
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
      console.error("Erro ao carregar cadastros de pacotes na baixa:", err);
    });

    return () => unsub();
  }, [selectedFilialId, todayDateStr]);

  // 1. Filtrar entregadores que possuem alguma rota ativa (não concluída) e pertencem à filial ativa
  const deliverersWithOpenRoutes = useMemo(() => {
    const ids = new Set(
      expedicoes
        .filter(e => !e.concluido && (!selectedFilialId || e.filialId === selectedFilialId))
        .map(e => e.entregadorId)
    );
    return entregadores.filter(ent => ids.has(ent.id) && (!selectedFilialId || ent.filialId === selectedFilialId));
  }, [expedicoes, entregadores, selectedFilialId]);

  // 2. Filtrar empresas parceiras que têm carga pendente de retorno para o entregador selecionado
  const companiesWithPendingCarga = useMemo(() => {
    if (!selectedEntregadorId) return [];
    const ids = new Set<string>();
    expedicoes.forEach(exp => {
      if (!exp.concluido && exp.entregadorId === selectedEntregadorId) {
        exp.itens.forEach(item => {
          if (item.status === 'pendente') {
            ids.add(item.empresaId);
          }
        });
      }
    });
    return empresas.filter(emp => ids.has(emp.id));
  }, [selectedEntregadorId, expedicoes, empresas]);

  const selectedDeliverer = useMemo(() => {
    return entregadores.find(ent => ent.id === selectedEntregadorId);
  }, [selectedEntregadorId, entregadores]);

  const selectedCompany = useMemo(() => {
    return empresas.find(emp => emp.id === selectedEmpresaId);
  }, [selectedEmpresaId, empresas]);

  // Referência mutável para obter a lista de expedições mais recente do Firestore
  // sem precisar listar 'expedicoes' como dependência e consequentemente resetar
  // os itens locais parciais enquanto o usuário faz a bipagem.
  const expedicoesRef = useRef(expedicoes);
  useEffect(() => {
    expedicoesRef.current = expedicoes;
  }, [expedicoes]);

  // 3. Ao mudar o motorista desejado, carregar no estado local todas as cargas correspondentes (todas as empresas)
  // Isso previne que ao scanear itens de empresas diferentes as alterações locais sejam descartadas por resets de estado.
  useEffect(() => {
    if (selectedEntregadorId) {
      // Verificar se já temos itens salvos em localStorage correspondentes a este entregador
      const savedEntregadorId = safeStorage.getItem('baixas_entregadorId');
      const savedLocalItensStr = safeStorage.getItem('baixas_localItens');
      if (savedEntregadorId === selectedEntregadorId && savedLocalItensStr) {
        try {
          const parsed = JSON.parse(savedLocalItensStr);
          if (parsed && parsed.length > 0) {
            setLocalItens(parsed);
            return;
          }
        } catch (e) {
          console.error("Erro ao resgatar itens salvos no localStorage:", e);
        }
      }

      const items: ReturnItem[] = [];
      expedicoesRef.current.forEach((exp) => {
        if (!exp.concluido && exp.entregadorId === selectedEntregadorId) {
          exp.itens.forEach((pack, packIdx) => {
            // Carregar todos os pacotes, sejam pendentes ou já entregues
            items.push({
              id: `${exp.id}-${packIdx}`,
              codigoBarras: pack.codigoBarras,
              empresaId: pack.empresaId,
              status: pack.status || 'pendente', // Mantém o status original do pacote
              expId: exp.id,
              originalIndexInExp: packIdx
            });
          });
        }
      });

      // Se temos um código de barras pendente de devolução automática via detecção inteligente
      if (pendingDevolucaoCode) {
        const itemIdx = items.findIndex(it => isBarcodeDuplicate(pendingDevolucaoCode, it.codigoBarras) && it.status === 'pendente');
        if (itemIdx !== -1) {
          items[itemIdx].status = 'devolvido';
          setDevolucaoConfigIndex(itemIdx);
          setSuccessFeedback(`Volume ${pendingDevolucaoCode} detectado e registrado automaticamente como devolvido!`);
          setTimeout(() => setSuccessFeedback(''), 4000);
        }
        setPendingDevolucaoCode(null);
      }

      setLocalItens(items);
      safeStorage.setItem('baixas_localItens', JSON.stringify(items));
    } else {
      setLocalItens([]);
      setDevolucaoConfigIndex(null);
      safeStorage.removeItem('baixas_localItens');
    }
  }, [selectedEntregadorId, pendingDevolucaoCode]);

  // Simular som de bip (virtual)
  const playBeep = (freq = 700, dur = 0.1) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  // Som de aviso / erro mais forte para alertas (Duplicidade ou prefixos inválidos)
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
      
      playBuzz(0, 140, 0.15);
      playBuzz(0.12, 110, 0.28);
    } catch (e) {}
  };

  // Submit do bip faturamento de devolução (com suporte a detecção inteligente global)
  const handleDevolucaoScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.permissions.baixas_readonly) {
      setErrorFeedback("Você está no modo de Apenas Leitura.");
      return;
    }
    if (!barcodeScanInput.trim()) return;

    const codeToFind = cleanBarcode(barcodeScanInput);

    // REGRA DE BIPAGEM PARA EVITAR BIPAGEM DUPLICADA (Exatamente igual à saída)
    let duplicateMatchCode = '';
    let duplicateStatus = '';

    // 1. Procurar duplicidade no lote/itens do motorista selecionado
    if (selectedEntregadorId) {
      const duplicateInLocal = localItens.find(item => isBarcodeDuplicate(codeToFind, item.codigoBarras) && item.status !== 'pendente');
      if (duplicateInLocal) {
        duplicateMatchCode = duplicateInLocal.codigoBarras;
        duplicateStatus = duplicateInLocal.status;
      }
    }

    // 2. Procurar duplicidade no histórico global de todas as expedicoes
    if (!duplicateMatchCode && expedicoes) {
      for (const exp of expedicoes) {
        if (exp.itens) {
          const matchedItem = exp.itens.find(item => isBarcodeDuplicate(codeToFind, item.codigoBarras) && item.status !== 'pendente');
          if (matchedItem) {
            duplicateMatchCode = matchedItem.codigoBarras;
            duplicateStatus = matchedItem.status;
            break;
          }
        }
      }
    }

    if (duplicateMatchCode) {
      playWarningSound();
      if (codeToFind === duplicateMatchCode) {
        setErrorFeedback(`Aviso: O pacote "${codeToFind}" já foi registrado anteriormente no sistema como ${duplicateStatus === 'devolvido' ? 'DEVOLVIDO' : 'ENTREGUE'}!`);
      } else {
        setErrorFeedback(`Tentativa de Bip Duplicado: O código "${codeToFind}" foi bloqueado porque corresponde ao pacote "${duplicateMatchCode}" já registrado como ${duplicateStatus === 'devolvido' ? 'DEVOLVIDO' : 'ENTREGUE'}!`);
      }
      setSuccessFeedback('');
      setBarcodeScanInput('');
      setTimeout(() => setErrorFeedback(''), 6500);
      return;
    }

    // 1. Se o motorista está selecionado E o código de barras existe nas rotas dele (Pendente):
    if (selectedEntregadorId) {
      const itemIndex = localItens.findIndex(item => isBarcodeDuplicate(codeToFind, item.codigoBarras) && item.status === 'pendente');
      if (itemIndex !== -1) {
        playBeep(900, 0.08);
        const updated = [...localItens];
        updated[itemIndex].status = 'devolvido';
        setLocalItens(updated);
        setDevolucaoConfigIndex(itemIndex);
        // Não altera o filtro de empresa para os pacotes restantes de outras empresas não sumirem da tela
        setBarcodeScanInput('');
        setSuccessFeedback(`Volume ${codeToFind} registrado como devolvido!`);
        setTimeout(() => setSuccessFeedback(''), 2505);
        return;
      }
    }

    // 2. Se NÃO está nas rotas pré-selecionadas ou não havia pré-seleção, vamos fazer a DETECÇÃO INTELIGENTE / GLOBAL:
    const activeOpenExpedicoes = expedicoes.filter(exp => !exp.concluido && (!selectedFilialId || exp.filialId === selectedFilialId));
    
    let globalMatch: { exp: Expedicao; pack: Pacote } | null = null;
    
    for (const exp of activeOpenExpedicoes) {
      const pack = exp.itens.find(p => isBarcodeDuplicate(codeToFind, p.codigoBarras) && p.status === 'pendente');
      if (pack) {
        globalMatch = { exp, pack };
        break; // Achou o primeiro correspondente pendente
      }
    }

    if (globalMatch) {
      // Encontrou o pacote de forma inteligente!
      playBeep(900, 0.08);
      setPendingDevolucaoCode(globalMatch.pack.codigoBarras);
      
      // Sincroniza os selects para carregar automaticamente a rota correspondente
      setSelectedFilialId(globalMatch.exp.filialId);
      setSelectedEntregadorId(globalMatch.exp.entregadorId);
      setSelectedEmpresaId(globalMatch.pack.empresaId);
      
      setBarcodeScanInput('');
      setSuccessFeedback(`[AUTO DETECTADO] Rotas de ${entregadores.find(en => en.id === globalMatch?.exp.entregadorId)?.nome || ''} carregadas!`);
      setTimeout(() => setSuccessFeedback(''), 3000);
      // Foca de volta
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
      return;
    }

    // 3. Se NÃO encontrou o pacote em nenhuma rota ativa:
    // Tenta primeiro identificar a empresa com base na lista de pacotes cadastrados de hoje
    let identifiedCompany = empresas.find(emp => 
      pacotesCadastradosHoje.some(p => isBarcodeDuplicate(codeToFind, p.codigoBarras) && p.empresaId === emp.id)
    );
    let detectionSrc = '(via Cadastro de Pacote)';

    // Se não encontrou por cadastro de pacote, valida pelo prefixo em todas as empresas registradas
    if (!identifiedCompany) {
      const matchingCompaniesByPrefix = empresas.filter(emp => {
        if (!emp.prefixos) return false;
        const parts = emp.prefixos.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
        return parts.some(prefix => isBarcodeDuplicate(codeToFind, prefix) || codeToFind.startsWith(prefix));
      });
      if (matchingCompaniesByPrefix.length > 0) {
        identifiedCompany = matchingCompaniesByPrefix[0];
        const matchedPref = identifiedCompany.prefixos?.split(',').map(p => p.trim().toUpperCase()).find(prefix => codeToFind.startsWith(prefix));
        detectionSrc = matchedPref ? `(via Prefixo '${matchedPref}')` : '(via Prefixo)';
      }
    }

    if (identifiedCompany) {
      // Reconheceu o pacote/prefixo, mas não tem de fato carga pendente de retorno nas rotas ativas do pátio
      playWarningSound(); // som de erro/aviso correspondente à saída
      setErrorFeedback(`Pacote identificado como da empresa [${identifiedCompany.nome}] ${detectionSrc}, porém o código "${codeToFind}" não consta em nenhuma rota ativa no pátio!`);
      setTimeout(() => setErrorFeedback(''), 5000);
      setBarcodeScanInput('');
    } else {
      // NÃO reconheceu o prefixo! Abre a janela (modal) perguntando qual é a empresa deste pacote.
      playBeep(550, 0.15);
      setUnrecognizedCodeModal({ code: codeToFind });
      setBarcodeScanInput('');
    }
  };

  // Gerar bip fictício de devolução para teste rápido
  const handleGenerateDevolucaoMock = () => {
    let mockCode = '';
    
    // Se há motorista e empresa pré-selecionados, preenchemos um item desse motorista/empresa
    if (selectedEntregadorId && selectedEmpresaId && localItens.length > 0) {
      const pendentes = localItens.filter(it => it.status === 'pendente');
      if (pendentes.length > 0) {
        mockCode = pendentes[Math.floor(Math.random() * pendentes.length)].codigoBarras;
      }
    }
    
    // Se não há ou não achamos pendente na pré-seleção, pegamos de qualquer expedição aberta
    if (!mockCode) {
      const activeOpenExpedicoes = expedicoes.filter(e => !e.concluido && (!selectedFilialId || e.filialId === selectedFilialId));
      const allOpenPacks: string[] = [];
      activeOpenExpedicoes.forEach(exp => {
        exp.itens.forEach(p => {
          if (p.status === 'pendente') {
            allOpenPacks.push(p.codigoBarras);
          }
        });
      });
      
      if (allOpenPacks.length > 0) {
        mockCode = allOpenPacks[Math.floor(Math.random() * allOpenPacks.length)];
      } else {
        // Se realmente não há nada em trânsito, gera um código de teste sem prefixo
        mockCode = "XYZ987654";
      }
    }

    setBarcodeScanInput(mockCode);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Alterar motivo
  const handleSetMotivo = (index: number, motivo: string) => {
    const updated = [...localItens];
    updated[index].motivoDevolucao = motivo;
    setLocalItens(updated);
  };

  // Alterar observação
  const handleSetObservacao = (index: number, obs: string) => {
    const updated = [...localItens];
    updated[index].observacaoDevolucao = obs;
    setLocalItens(updated);
  };

  // Mover item de volta para pendente
  const handleRemoveDevolucao = (index: number) => {
    const updated = [...localItens];
    updated[index].status = 'pendente';
    updated[index].motivoDevolucao = undefined;
    updated[index].observacaoDevolucao = undefined;
    setLocalItens(updated);
    if (devolucaoConfigIndex === index) {
      setDevolucaoConfigIndex(null);
    }
  };

  // Mover todos os pacotes atualmente em "Baixas Automáticas" que estão pendentes para devolvidos
  const handleDevolverTodos = () => {
    if (currentUser.permissions.baixas_readonly) return;
    const updated = localItens.map(item => {
      // O botão devolver todos deve funcionar apenas para pacotes PENDENTES, e não para pacotes que já foram ENTREGUES.
      if (item.status === 'pendente') {
        return {
          ...item,
          status: 'devolvido' as const,
          motivoDevolucao: undefined, // Sem especificação inicial do motivo
          observacaoDevolucao: undefined
        };
      }
      return item;
    });
    setLocalItens(updated);
    playBeep(850, 0.12);
    setSuccessFeedback("Todos os pacotes pendentes restantes foram marcados como devolvidos!");
    setTimeout(() => setSuccessFeedback(''), 3000);
  };

  // Aciona conclusão
  const handleTriggerFinalize = () => {
    if (currentUser.permissions.baixas_readonly) {
      setErrorFeedback("Acesso Negado: Você possui permissão de apenas leitura para esta tela.");
      return;
    }
    if (localItens.length === 0) {
      setErrorFeedback("Selecione um entregador com carga pendente para concluir!");
      setTimeout(() => setErrorFeedback(''), 4000);
      return;
    }

    // Verificar se existe algum devolvido sem motivo preenchido
    const itemsDevolvidosSemMotivo = localItens.filter(it => it.status === 'devolvido' && !it.motivoDevolucao);

    if (itemsDevolvidosSemMotivo.length > 0) {
      // Abre modal de confirmação especial informando os motivos zerados
      setShowConfirmationModal(true);
    } else {
      executeSaveAcerto();
    }
  };

  // Prorroga fechamento definitivo
  const executeSaveAcerto = () => {
    // Atualizar todas as expedições afetadas
    const updatedExpedicoes = expedicoes.map((exp) => {
      // Apenas expedições em aberto do motorista selecionado
      if (exp.concluido || exp.entregadorId !== selectedEntregadorId) {
        return exp;
      }

      // Procurar se algum item dessa expedição faz parte dos itens locais
      const localUpdatesOfThisExp = localItens.filter(li => li.expId === exp.id);

      // Modifica itens
      const updatedItens = exp.itens.map((item, idx) => {
        const localMatch = localUpdatesOfThisExp.find(li => li.originalIndexInExp === idx);
        if (localMatch) {
          return {
            ...item,
            status: (localMatch.status === 'devolvido' ? 'devolvido' : 'entregue') as 'entregue' | 'devolvido', // Baixa automática ou devolução física
            motivoDevolucao: localMatch.status === 'devolvido' ? (localMatch.motivoDevolucao || "Não especificado") : undefined,
            observacaoDevolucao: localMatch.status === 'devolvido' ? localMatch.observacaoDevolucao : undefined,
            dataHoraLeitura: new Date().toISOString()
          };
        }
        
        // Se NÃO há localMatch mas o item ainda está pendente, realizamos a baixa automática como entregue com sucesso.
        if (item.status === 'pendente') {
          return {
            ...item,
            status: 'entregue' as const,
            dataHoraLeitura: new Date().toISOString()
          };
        }

        return item; // Itens que já estavam entregues ou devolvidos continuam como estão
      });

      // Valida se a expedição inteira está sem nenhum pendente global
      const isExpFullyFinished = updatedItens.every(it => it.status !== 'pendente');

      if (isExpFullyFinished) {
        const dataSaida = new Date(exp.dataHoraSaida);
        const dataRetorno = new Date();
        const diffMs = dataRetorno.getTime() - dataSaida.getTime();
        const tempoVoltaMin = Math.round(diffMs / (1000 * 60));

        return {
          ...exp,
          itens: updatedItens,
          concluido: true,
          dataHoraRetorno: dataRetorno.toISOString(),
          tempoVoltaMinutos: tempoVoltaMin
        };
      }

      return {
        ...exp,
        itens: updatedItens
      };
    });

    syncExpedicoes(updatedExpedicoes);

    // Sucesso
    const docName = entregadores.find(e => e.id === selectedEntregadorId)?.nome || 'Entregador';
    const successMsg = `Acerto geral do entregador ${docName} concluído com sucesso! Devolvidos registrados e o restante com baixa de entrega.`;
    
    setSuccessFeedback(successMsg);
    setSelectedEntregadorId('');
    setSelectedEmpresaId('');
    setLocalItens([]);
    safeStorage.removeItem('baixas_entregadorId');
    safeStorage.removeItem('baixas_localItens');
    setShowConfirmationModal(false);
    setTimeout(() => setSuccessFeedback(''), 5000);
  };

  // Separação de status (unificado para todas as empresas sem filtro de empresa cliente)
  const partitionedLists = useMemo(() => {
    const devolvidos: ReturnItem[] = [];
    const autoEntregues: ReturnItem[] = []; // Itens que receberão baixa automática ("restante")

    localItens.forEach(it => {
      if (it.status === 'devolvido') {
        devolvidos.push(it);
      } else {
        autoEntregues.push(it);
      }
    });

    return { devolvidos, autoEntregues };
  }, [localItens]);

  return (
    <div className="space-y-6" id="view-baixas">
      
      {currentUser.permissions.baixas_readonly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-sm">
          <BookOpen className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
          <span>
            <strong>Modo de Leitura Ativo:</strong> Suas permissões no sistema são de apenas consulta. A baixa de pacotes e fechamento de guias de retorno estão desabilitados.
          </span>
        </div>
      )}
      
      {/* Alerta de feedback global */}
      <AnimatePresence>
        {successFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold rounded-xl shadow-sm text-center"
          >
            {successFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PARTE ESQUERDA: Selección de Entregador, Empresa, bipagem */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1 space-y-6">
          {/* Seleção de Filial */}
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-500" />
              Filial do Retorno
            </h3>
            <p className="text-xs text-slate-400">Selecione de qual filial deseja processar os retornos</p>
            
            <select
              id="baixas-select-filial"
              value={selectedFilialId}
              onChange={(e) => { 
                setSelectedFilialId(e.target.value); 
                setSelectedEntregadorId('');
                setSelectedEmpresaId(''); 
              }}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {userPermittedFiliais.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
              {userPermittedFiliais.length === 0 && (
                <option value="" disabled>Nenhuma filial autorizada</option>
              )}
            </select>
          </div>

          {/* Selecionar Entregador */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              Selecionar Entregador
            </h3>
            <p className="text-xs text-slate-400">Cooperados com cargas ativas em trânsito no pátio</p>
            
            <select
              id="baixas-select-entregador"
              value={selectedEntregadorId}
              onChange={(e) => { 
                setSelectedEntregadorId(e.target.value); 
                setSelectedEmpresaId(''); 
              }}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Selecione o Entregador em trânsito...</option>
              {deliverersWithOpenRoutes.map(ent => (
                <option key={ent.id} value={ent.id}>{ent.nome} (CPF: {ent.cpf})</option>
              ))}
            </select>
          </div>

          {/* Leitor Inteligente de Baixas - Sempre Visível */}
          <div className={`space-y-2 p-4 rounded-xl border relative transition-all duration-150 ${
            !selectedFilialId || !selectedEntregadorId
              ? "bg-slate-100/60 border-slate-200 opacity-65"
              : "bg-slate-50/50 border-slate-150"
          }`}>
            <div className="flex justify-between items-center">
              <label htmlFor="input-devolucao-barcode" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Barcode className={`h-4 w-4 ${!selectedFilialId || !selectedEntregadorId ? "text-slate-400" : "text-blue-550 animate-pulse"}`} />
                Leitor Inteligente
              </label>
              {!currentUser.permissions.baixas_readonly && selectedFilialId && selectedEntregadorId && (
                <button
                  type="button"
                  onClick={handleGenerateDevolucaoMock}
                  className="text-[9px] text-rose-600 font-bold bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                  id="btn-mock-scan-devolucao"
                  title="Simular leitura de um código de barras pendente"
                >
                  <Sparkles className="h-3 w-3" />
                  Bipar Teste
                </button>
              )}
            </div>

            <form onSubmit={handleDevolucaoScanSubmit} className="relative flex items-center gap-2 mt-1.5">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  ref={barcodeInputRef}
                  id="input-devolucao-barcode"
                  type="text"
                  placeholder={
                    !selectedFilialId || !selectedEntregadorId 
                      ? "⚠️ Selecione Filial e Entregador primeiro!" 
                      : currentUser.permissions.baixas_readonly 
                        ? "Apenas leitura..." 
                        : "Bipe qualquer código para devolução..."
                  }
                  value={barcodeScanInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('^') || val.includes('Id') || val.includes('ID') || val.startsWith('`')) {
                      setBarcodeScanInput(cleanBarcode(val));
                    } else {
                      setBarcodeScanInput(val);
                    }
                  }}
                  disabled={currentUser.permissions.baixas_readonly || !selectedFilialId || !selectedEntregadorId}
                  className="w-full bg-white disabled:bg-slate-50/50 pl-9 pr-4 py-2 mt-0.5 rounded-xl border border-slate-200 text-xs text-slate-750 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <button
                id="btn-confirm-return-scan"
                type="submit"
                disabled={currentUser.permissions.baixas_readonly || !selectedFilialId || !selectedEntregadorId}
                className="p-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition shadow cursor-pointer"
              >
                <Scan className="h-4 w-4" />
              </button>
            </form>

            <AnimatePresence>
              {errorFeedback && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[10px] text-rose-700 font-bold bg-rose-50 p-2 rounded-xl border border-rose-100"
                >
                  {errorFeedback}
                </motion.p>
              )}
            </AnimatePresence>
            <p className="text-[9px] text-slate-400 leading-normal">
              * O sistema lê a etiqueta, busca a rota ativa correspondente e muda o status para <strong>'Devolvido'</strong> de forma automática.
            </p>
          </div>

          {selectedEntregadorId && (
            <div className="space-y-4 animate-fade-in pt-4 border-t border-slate-100">
              {localItens.length > 0 && (
                <div className="space-y-3">
                  {/* Controle de fechamento físico */}
                  <button
                    id="btn-concluir-acerto"
                    onClick={handleTriggerFinalize}
                    disabled={currentUser.permissions.baixas_readonly}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg flex flex-col items-center justify-center gap-1 transition active:scale-98 cursor-pointer"
                  >
                    {currentUser.permissions.baixas_readonly ? (
                      <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wide">
                        <BookOpen className="h-4 w-4" />
                        <span>Acerto Bloqueado (Leitura)</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">
                          <CheckCircle className="h-4 w-4" />
                          <span>Confirmar e Concluir Acerto</span>
                        </div>
                        <div className="text-[10px] sm:text-[10.5px] font-bold text-blue-100/90 leading-tight">
                          Total: {localItens.length} pacotes • {localItens.filter(it => it.status === 'devolvido').length} devolvidos • {localItens.filter(it => it.status !== 'devolvido').length} entregues
                        </div>
                      </>
                    )}
                  </button>

                  {/* Botão Cancelar Retorno */}
                  <button
                    id="btn-cancelar-retorno"
                    type="button"
                    onClick={() => {
                      setSelectedEntregadorId('');
                      setSelectedEmpresaId('');
                      setLocalItens([]);
                      safeStorage.removeItem('baixas_entregadorId');
                      safeStorage.removeItem('baixas_localItens');
                    }}
                    className="w-full py-2.5 bg-slate-150 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-rose-200"
                  >
                    <X className="h-4 w-4 shrink-0" />
                    Cancelar Retorno
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PARTE DIREITA: Listas de separação (Devolvidos Bipados & Baixa Automática) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col justify-between min-h-[500px]">
          <div>
             {!selectedEntregadorId ? (
              <div className="text-center py-32 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                <Clock className="h-14 w-14 mx-auto text-slate-350 stroke-1 mb-2.5 animate-pulse" />
                <p className="font-extrabold text-slate-500 font-sans tracking-tight">Selecione o Entregador Parceiro</p>
                <p className="text-xs text-slate-400 mt-1">Logo após selecionar o entregador, todos os pacotes da rota aparecerão como entregues para baixa automática rápida.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 2. TAB CONTROLS PARA SEPARAR VISUALMENTE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* LISTA DE DEVOLVIDOS */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-rose-50 border-b border-rose-100 p-3 flex justify-between items-center text-xs">
                      <span className="font-extrabold text-rose-800 flex items-center gap-1">
                        <RotateCcw className="h-4 w-4 text-rose-600" />
                        Pacotes Devolvidos ({partitionedLists.devolvidos.length})
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(!currentUser.permissions.baixas_readonly && partitionedLists.autoEntregues.length > 0) && (
                          <button
                            type="button"
                            onClick={handleDevolverTodos}
                            className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wide transition shadow-xs cursor-pointer"
                          >
                            Devolver Todos
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 bg-white">
                      {partitionedLists.devolvidos.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 font-medium text-xs">
                          Nenhum pacote devolvido bipado ainda.
                        </div>
                      ) : (
                        partitionedLists.devolvidos.map((item) => {
                          const originalIdx = localItens.findIndex(li => li.id === item.id);
                          const isFocused = originalIdx === devolucaoConfigIndex;
                          return (
                            <div 
                              key={item.id} 
                              className={`p-3 flex justify-between items-center text-xs transition-colors ${
                                isFocused ? 'bg-amber-50/20' : 'hover:bg-slate-50/30'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-800">{item.codigoBarras}</span>
                                  <span className="text-[9px] bg-slate-100 text-slate-600 font-extrabold px-1.5 py-0.2 rounded uppercase">
                                    {empresas.find(e => e.id === item.empresaId)?.nome}
                                  </span>
                                </div>
                                {item.motivoDevolucao ? (
                                  <span className="text-[10px] text-rose-600 font-bold block mt-0.5 truncate max-w-[180px]">
                                    Motivo: {item.motivoDevolucao}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
                                    ⚠️ Sem Motivo Registrado
                                  </span>
                                )}
                              </div>

                              {!currentUser.permissions.baixas_readonly && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setDevolucaoConfigIndex(originalIdx)}
                                    className="px-2 py-1 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 font-black rounded-md transition cursor-pointer"
                                  >
                                    Motivo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDevolucao(originalIdx)}
                                    className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-md transition cursor-pointer"
                                    title="Remover devolução"
                                  >
                                    Remover
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* LISTA DE BAIXA AUTOMÁTICA (ENTREGUES) */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-emerald-50 border-b border-emerald-100 p-3 flex justify-between items-center text-xs">
                      <span className="font-extrabold text-emerald-800 flex items-center gap-1">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Baixas Automáticas ({partitionedLists.autoEntregues.length})
                      </span>
                      <span className="text-[10px] bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-black font-mono">
                        Pago ao Cooperado
                      </span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 bg-white">
                      {partitionedLists.autoEntregues.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 font-medium text-xs">
                          Sem itens para baixa automática. Todos os pacotes marcados como devolvidos.
                        </div>
                      ) : (
                        partitionedLists.autoEntregues.map((item) => {
                          const originalIdx = localItens.findIndex(li => li.id === item.id);
                          return (
                            <div key={item.id} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50/30">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-700">{item.codigoBarras}</span>
                                  <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold px-1.5 py-0.2 rounded uppercase">
                                    {empresas.find(e => e.id === item.empresaId)?.nome}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                  {item.status === 'entregue' ? (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                      ✓ Entregue na rota
                                    </span>
                                  ) : (
                                    <span>Será baixado como <strong className="text-emerald-600 font-bold">Entregue</strong> automaticamente</span>
                                  )}
                                </span>
                              </div>
                              {!currentUser.permissions.baixas_readonly && item.status !== 'entregue' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Forçar manual para devolvido
                                    const updated = [...localItens];
                                    updated[originalIdx].status = 'devolvido';
                                    setLocalItens(updated);
                                  }}
                                  className="text-[10px] text-rose-500 hover:underline font-bold"
                                >
                                  Devolver
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-slate-50 border border-slate-150 rounded-xl text-[11px] text-slate-500 flex items-start gap-1.5 font-medium leading-relaxed">
            <span className="font-black text-slate-650 shrink-0 uppercase">ℹ️ REGRA DE COMISSIONAMENTO:</span>
            <p>
              Ao salvar o fechamento, todos os pacotes em **Baixas Automáticas** serão dados como entregues com sucesso. Já os pacotes listados em **Devolvidos** não contabilizarão crédito de repasse na folha salarial do motorista, permanecendo glosados.
            </p>
          </div>
        </div>

      </div>

      {/* MODAL DE CONFIRMAÇÃO DE DEVOLUÇÕES SEM MOTIVO */}
      <AnimatePresence>
        {showConfirmationModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-150 max-w-md w-full p-6 space-y-4 shadow-2xl"
              id="confirm-without-reason-modal"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />
                <h4 className="text-base font-black text-slate-900 uppercase">Justificativa em Falta!</h4>
              </div>
              
              <div className="text-slate-600 text-xs leading-relaxed space-y-2">
                <p>
                  Você registrou devoluções físicas, porém **não especificou o motivo** para todos os pacotes devolvidos.
                </p>
                <p className="font-semibold text-slate-700">
                  Deseja concluir a baixa de todos os pacotes sem justificar o motivo das devoluções assim mesmo?
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  id="btn-confirm-without-reason"
                  onClick={executeSaveAcerto}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-amber-600/10"
                >
                  Sim, Concluir assim mesmo
                </button>
                <button
                  type="button"
                  id="btn-cancel-without-reason"
                  onClick={() => setShowConfirmationModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
                >
                  Não, vou preencher
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AJUSTE DE MOTIVO DE DEVOLUÇÃO */}
      <AnimatePresence>
        {devolucaoConfigIndex !== null && localItens[devolucaoConfigIndex]?.status === 'devolvido' && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <motion.form 
              onSubmit={(e) => {
                e.preventDefault();
                setDevolucaoConfigIndex(null);
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-150 max-w-lg w-full p-6 space-y-4 shadow-2xl text-left"
              id="occurrence-setup-modal"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setDevolucaoConfigIndex(null);
                }
              }}
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Devolução - Código: <strong className="font-mono text-indigo-700">{localItens[devolucaoConfigIndex].codigoBarras}</strong>
                </h4>
                <button 
                  type="button"
                  onClick={() => setDevolucaoConfigIndex(null)}
                  className="hover:bg-slate-100 text-slate-400 hover:text-slate-600 p-1 rounded-full transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="select-motivo-padrao" className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">Motivo da Ocorrência</label>
                  <select
                    id="select-motivo-padrao"
                    autoFocus
                    value={localItens[devolucaoConfigIndex].motivoDevolucao || ''}
                    onChange={(e) => handleSetMotivo(devolucaoConfigIndex, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setDevolucaoConfigIndex(null);
                      }
                    }}
                    className="bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 text-xs w-full text-slate-800 outline-none font-bold cursor-pointer transition-all"
                  >
                    <option value="">Sem motivo / Concluir sem especificar</option>
                    {Array.from(new Set([
                      ...(motivosDevolucao || []),
                      ...MOTIVOS_PADRAO
                    ])).map((motivoStr, idx) => (
                      <option key={idx} value={motivoStr}>{motivoStr}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="input-devolucao-obs" className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">Observação Adicional</label>
                  <textarea
                    id="input-devolucao-obs"
                    rows={3}
                    placeholder="Ex: Vizinho recusou, endereço deserto, portão fechado..."
                    value={localItens[devolucaoConfigIndex].observacaoDevolucao || ''}
                    onChange={(e) => handleSetObservacao(devolucaoConfigIndex, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setDevolucaoConfigIndex(null);
                      }
                    }}
                    className="bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 text-xs w-full text-slate-700 font-medium outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDevolucaoConfigIndex(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-occurrence-modal"
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition active:scale-95 border border-indigo-750"
                >
                  Confirmar e Salvar
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Modal para Bip de código sem prefixo reconhecido */}
      <AnimatePresence>
        {unrecognizedCodeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4"
              id="unrecognized-prefix-modal"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <div className="p-2.5 bg-amber-55 bg-amber-100 rounded-full">
                  <HelpCircle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-800">Prefixo Não Reconhecido</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Código lido: <span className="font-black text-rose-600">{unrecognizedCodeModal.code}</span></p>
                </div>
              </div>
              
              <div className="text-slate-650 text-xs leading-relaxed space-y-2 font-medium">
                <p>
                  O código de barras bipado não corresponde a nenhum prefixo cadastrado das suas empresas parceiras.
                </p>
                <p className="font-bold text-slate-700">
                  Selecione abaixo a qual empresa de origem pertence este pacote:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-1 custom-scrollbar">
                {empresas.map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      const chosenCompany = emp;
                      setUnrecognizedCodeModal(null);
                      
                      // Procuramos se existe alguma rota ativa desse código para essa empresa específica
                      const activeOpenExpedicoes = expedicoes.filter(exp => !exp.concluido && (!selectedFilialId || exp.filialId === selectedFilialId));
                      let matchedRoute = null;
                      for (const exp of activeOpenExpedicoes) {
                        const pack = exp.itens.find(p => p.codigoBarras === unrecognizedCodeModal.code && p.status === 'pendente' && p.empresaId === chosenCompany.id);
                        if (pack) {
                          matchedRoute = { exp, pack };
                          break;
                        }
                      }

                      if (matchedRoute) {
                        playBeep(900, 0.08);
                        setPendingDevolucaoCode(unrecognizedCodeModal.code);
                        setSelectedFilialId(matchedRoute.exp.filialId);
                        setSelectedEntregadorId(matchedRoute.exp.entregadorId);
                        setSelectedEmpresaId(matchedRoute.pack.empresaId);
                      } else {
                        // Se não achou em nenhuma rota ativa, informa com precisão ao usuário
                        playBeep(450, 0.25);
                        setErrorFeedback(`O pacote "${unrecognizedCodeModal.code}" foi associado à empresa [${chosenCompany.nome}], mas não foi localizado em nenhuma rota ativa/pendente!`);
                        setTimeout(() => setErrorFeedback(''), 5500);
                      }
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <Building className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate">{emp.nome}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnrecognizedCodeModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
