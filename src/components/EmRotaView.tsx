/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  User, 
  Clock, 
  MapPin, 
  Search, 
  Calendar, 
  Layers, 
  Building2, 
  Activity,
  Maximize2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Tv,
  XCircle,
  AlertCircle,
  X,
  ArrowLeftRight,
  CornerUpLeft,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Empresa, Entregador, Expedicao, Pacote, Rota, User as SystemUser, Filial, TransferenciaPacote, RetiradaPacote } from '../types';
import { db, cleanBarcode, cleanUndefined, doc, setDoc } from '../lib/supabase';

interface EmRotaViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  expedicoes: Expedicao[];
  rotas: Rota[];
  currentUser: SystemUser;
  filiais: Filial[];
  onOpenTvMode?: () => void;
  onCancelExpedicao?: (expId: string) => void;
  onCancelAllExpedicoes?: (expIds: string[]) => void;
  syncExpedicoes?: (updatedList: Expedicao[]) => Promise<void>;
  transferencias?: TransferenciaPacote[];
  retiradas?: RetiradaPacote[];
}

export default function EmRotaView({ 
  empresas, 
  entregadores, 
  expedicoes, 
  rotas, 
  currentUser, 
  filiais, 
  onOpenTvMode, 
  onCancelExpedicao, 
  onCancelAllExpedicoes,
  syncExpedicoes,
  transferencias = [],
  retiradas = []
}: EmRotaViewProps) {
  // Gestão de filiais permitidas e filial selecionada como padrão
  const userPermittedFiliais = React.useMemo(() => {
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
      return 'all';
    }
    const permittedIds = currentUser.filiais || [];
    return permittedIds.length > 0 ? permittedIds[0] : '';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);
  const [confirmCancelExpId, setConfirmCancelExpId] = useState<string | null>(null);
  const [confirmCancelAllOpen, setConfirmCancelAllOpen] = useState<boolean>(false);

  // States de transferência de pacotes
  const [successFeedback, setSuccessFeedback] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');
  const [localPackageSearch, setLocalPackageSearch] = useState<{ [expId: string]: string }>({});
  const [targetDriverSearch, setTargetDriverSearch] = useState('');
  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    packageItem: Pacote | null;
    sourceExpedicao: Expedicao | null;
    targetExpedicaoId: string;
  }>({
    open: false,
    packageItem: null,
    sourceExpedicao: null,
    targetExpedicaoId: '',
  });

  const [isTransferHistoryOpen, setIsTransferHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historySelectedDriverId, setHistorySelectedDriverId] = useState('');
  const [historySelectedDriverRole, setHistorySelectedDriverRole] = useState<'any' | 'origin' | 'destination'>('any');
  const [historyTypeTab, setHistoryTypeTab] = useState<'all' | 'transfer' | 'withdraw'>('all');

  // States de retirada de pacotes (Zona Rural, Avaria ou Outra Cidade)
  const [retirarModal, setRetirarModal] = useState<{
    open: boolean;
    packageItem: Pacote | null;
    sourceExpedicao: Expedicao | null;
    reason: 'zona_rural' | 'avariado' | 'outra_cidade' | 'outro';
    customReason: string;
  }>({
    open: false,
    packageItem: null,
    sourceExpedicao: null,
    reason: 'zona_rural',
    customReason: '',
  });
  
  // Real-time ticking effect to calculate exact elapsed times
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // refresh every 30 seconds
    return () => clearInterval(timer);
  }, []);

  // Map driver names and profiles
  const getDriver = (driverId: string): Entregador | undefined => {
    return entregadores.find(d => d.id === driverId);
  };

  // Map company details
  const getCompany = (companyId: string): Empresa | undefined => {
    return empresas.find(c => c.id === companyId);
  };

  // Filter transferencias of packages and retiradas of packages
  const combinedHistory = React.useMemo(() => {
    const rawTransfers = (transferencias || []).map(t => ({
      ...t,
      logType: 'transfer' as const
    }));
    
    const rawWithdrawals = (retiradas || []).map(w => ({
      ...w,
      logType: 'withdraw' as const
    }));
    
    let combined: any[] = [...rawTransfers, ...rawWithdrawals];
    
    // Filter by branch
    if (selectedFilialId !== 'all') {
      combined = combined.filter(t => t.filialId === selectedFilialId);
    }
    
    // Filter by type tab
    if (historyTypeTab === 'transfer') {
      combined = combined.filter(item => item.logType === 'transfer');
    } else if (historyTypeTab === 'withdraw') {
      combined = combined.filter(item => item.logType === 'withdraw');
    }
    
    // Filter by specific deliverer
    if (historySelectedDriverId) {
      if (historySelectedDriverRole === 'origin') {
        combined = combined.filter(item => item.origemEntregadorId === historySelectedDriverId);
      } else if (historySelectedDriverRole === 'destination') {
        combined = combined.filter(item => 
          item.logType === 'transfer' && item.destinoEntregadorId === historySelectedDriverId
        );
      } else {
        // 'any'
        combined = combined.filter(item => 
          item.origemEntregadorId === historySelectedDriverId || 
          (item.logType === 'transfer' && item.destinoEntregadorId === historySelectedDriverId)
        );
      }
    }
    
    // Filter by search term (barcode, names, operator, reason)
    const q = historySearch.trim().toLowerCase();
    if (q) {
      combined = combined.filter(item => {
        const matchesBarcode = item.codigoBarras.toLowerCase().includes(q) || cleanBarcode(item.codigoBarras).toLowerCase().includes(q);
        const matchesOriginDriver = item.origemEntregadorNome.toLowerCase().includes(q);
        const matchesUser = item.usuarioNome.toLowerCase().includes(q);
        
        let matchesDest = false;
        if (item.logType === 'transfer') {
          matchesDest = item.destinoEntregadorNome.toLowerCase().includes(q);
        } else if (item.logType === 'withdraw') {
          matchesDest = item.observacao.toLowerCase().includes(q);
        }
        
        return matchesBarcode || matchesOriginDriver || matchesUser || matchesDest;
      });
    }
    
    return combined.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
  }, [transferencias, retiradas, selectedFilialId, historyTypeTab, historySearch, historySelectedDriverId, historySelectedDriverRole]);

  // Filter expeditions that are active (concluido === false) based on selected filial
  const activeExpeditions = expedicoes.filter(exp => {
    if (exp.concluido) return false;
    
    if (selectedFilialId !== 'all') {
      const expFilialId = exp.filialId || getDriver(exp.entregadorId)?.filialId;
      if (expFilialId !== selectedFilialId) return false;
    } else {
      const expFilialId = exp.filialId || getDriver(exp.entregadorId)?.filialId;
      if (expFilialId) {
        const permittedIds = userPermittedFiliais.map(f => f.id);
        if (!permittedIds.includes(expFilialId)) return false;
      }
    }
    return true;
  });

  // Convert difference to readable hours and minutes in real-time
  const getElapsedTime = (startTimeStr: string) => {
    const diffMs = currentTime.getTime() - new Date(startTimeStr).getTime();
    if (diffMs <= 0) return "0 min";
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const filteredExpeditions = activeExpeditions.filter(exp => {
    const driver = getDriver(exp.entregadorId);
    const driverName = driver ? driver.nome.toLowerCase() : '';
    const companies = exp.empresaIds.map(id => getCompany(id)?.nome.toLowerCase() || '');
    
    // Check if any package matches the searched barcode
    const cleanSearch = cleanBarcode(searchTerm);
    const hasMatchingPackage = exp.itens.some(item => {
      if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) {
        return false;
      }
      const barcodeClean = item.codigoBarras.trim().toUpperCase();
      return barcodeClean.includes(searchTerm.toUpperCase()) || 
             (cleanSearch && barcodeClean.includes(cleanSearch));
    });

    return driverName.includes(searchTerm.toLowerCase()) || 
           companies.some(c => c.includes(searchTerm.toLowerCase())) ||
           exp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
           hasMatchingPackage;
  });

  const toggleExpand = (expId: string) => {
    if (expandedExpId === expId) {
      setExpandedExpId(null);
    } else {
      setExpandedExpId(expId);
    }
  };

  const handleStartTransfer = (exp: Expedicao, item: Pacote) => {
    setTargetDriverSearch('');
    setTransferModal({
      open: true,
      packageItem: item,
      sourceExpedicao: exp,
      targetExpedicaoId: ''
    });
  };

  const handleConfirmTransfer = async () => {
    if (!transferModal.packageItem || !transferModal.sourceExpedicao || !transferModal.targetExpedicaoId) {
      return;
    }

    const { packageItem, sourceExpedicao, targetExpedicaoId } = transferModal;

    // Exatidão de Rotas: Pegamos as rotas associadas ao pacote de origem
    const sourceRotaIds = sourceExpedicao.rotaIds || (sourceExpedicao.rotaId ? [sourceExpedicao.rotaId] : []);

    // 1. Remove the package from source expedition
    let updatedExpedicoes = expedicoes.map(exp => {
      if (exp.id === sourceExpedicao.id) {
        const updatedItens = exp.itens.filter(i => i.codigoBarras !== packageItem.codigoBarras);
        return {
          ...exp,
          itens: updatedItens,
          // Clean up empresaIds if no items from that company remain in this expedition
          empresaIds: exp.empresaIds.filter(empId =>
            updatedItens.some(i => i.empresaId === empId)
          )
        };
      }
      return exp;
    });

    // Verificação de Carga: Se o entregador de origem ficou sem pacotes após a transferência,
    // a expedição dele deve ser cancelada automaticamente (removida do estado/banco) para que NENHUMA comissão seja paga a ele.
    const sourceExpCheck = updatedExpedicoes.find(exp => exp.id === sourceExpedicao.id);
    const isSourceEmpty = sourceExpCheck ? sourceExpCheck.itens.length === 0 : false;

    if (isSourceEmpty) {
      updatedExpedicoes = updatedExpedicoes.filter(exp => exp.id !== sourceExpedicao.id);
    }

    // 2. Add the package to the target
    const isCreatingNew = targetExpedicaoId.startsWith('new_driver_');

    if (isCreatingNew) {
      const targetDriverId = targetExpedicaoId.replace('new_driver_', '');
      const newExpId = `exp-transf-${Date.now()}`;
      const newExp: Expedicao = {
        id: newExpId,
        entregadorId: targetDriverId,
        empresaIds: [packageItem.empresaId],
        dataHoraSaida: new Date().toISOString(),
        itens: [{
          ...packageItem,
          status: 'pendente'
        }],
        concluido: false,
        filialId: sourceExpedicao.filialId || selectedFilialId || 'all',
        createdById: currentUser.id,
        // Transfere a rota do pacote para a nova expedição
        rotaId: sourceExpedicao.rotaId,
        rotaIds: sourceRotaIds
      };
      updatedExpedicoes = [newExp, ...updatedExpedicoes];
    } else {
      updatedExpedicoes = updatedExpedicoes.map(exp => {
        if (exp.id === targetExpedicaoId) {
          const updatedItens = [...exp.itens, { ...packageItem, status: 'pendente' as const }];
          const updatedEmpresaIds = exp.empresaIds.includes(packageItem.empresaId)
            ? exp.empresaIds
            : [...exp.empresaIds, packageItem.empresaId];

          // Transfere as rotas da carga de origem. Se o entregador de destino já tiver a rota, nada muda (mantém as dele).
          const existingRotaIds = exp.rotaIds || (exp.rotaId ? [exp.rotaId] : []);
          const mergedRotaIds = [...existingRotaIds];
          sourceRotaIds.forEach(id => {
            if (!mergedRotaIds.includes(id)) {
              mergedRotaIds.push(id);
            }
          });

          return {
            ...exp,
            itens: updatedItens,
            empresaIds: updatedEmpresaIds,
            rotaId: exp.rotaId || sourceExpedicao.rotaId,
            rotaIds: mergedRotaIds
          };
        }
        return exp;
      });
    }

    // 3. Sync to database/state!
    if (syncExpedicoes) {
      try {
        // Encontra o motorista origem e destino para registrar no log
        const sourceDriver = entregadores.find(d => d.id === sourceExpedicao.entregadorId);
        const sourceDriverName = sourceDriver ? sourceDriver.nome : 'Desconhecido';

        let destDriverId = '';
        let destDriverName = 'Desconhecido';

        if (isCreatingNew) {
          destDriverId = targetExpedicaoId.replace('new_driver_', '');
          const targetDriver = entregadores.find(d => d.id === destDriverId);
          destDriverName = targetDriver ? targetDriver.nome : 'Desconhecido';
        } else {
          const targetExp = expedicoes.find(e => e.id === targetExpedicaoId);
          destDriverId = targetExp ? targetExp.entregadorId : '';
          const targetDriver = entregadores.find(d => d.id === destDriverId);
          destDriverName = targetDriver ? targetDriver.nome : 'Desconhecido';
        }

        const logId = `transf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const logRecord: TransferenciaPacote = {
          id: logId,
          codigoBarras: packageItem.codigoBarras,
          empresaId: packageItem.empresaId,
          origemExpedicaoId: sourceExpedicao.id,
          origemEntregadorId: sourceExpedicao.entregadorId,
          origemEntregadorNome: sourceDriverName,
          destinoExpedicaoId: isCreatingNew ? 'nova_expedicao' : targetExpedicaoId,
          destinoEntregadorId: destDriverId,
          destinoEntregadorNome: destDriverName,
          dataHora: new Date().toISOString(),
          usuarioNome: currentUser.nomeCompleto || currentUser.username || 'Sistema',
          filialId: sourceExpedicao.filialId || selectedFilialId || 'all'
        };

        // Salva o log de transferência de forma durável
        await setDoc(doc(db, 'transferencias_pacotes', logId), cleanUndefined(logRecord));

        await syncExpedicoes(updatedExpedicoes);
        setSuccessFeedback(`Sucesso: Pacote "${packageItem.codigoBarras}" transferido com sucesso!`);
        setTimeout(() => setSuccessFeedback(''), 5000);
      } catch (err) {
        setErrorFeedback('Erro ao realizar a transferência no banco de dados.');
        setTimeout(() => setErrorFeedback(''), 5000);
      }
    }

    // Close modal
    setTargetDriverSearch('');
    setTransferModal({
      open: false,
      packageItem: null,
      sourceExpedicao: null,
      targetExpedicaoId: ''
    });
  };

  const handleStartRetirar = (exp: Expedicao, item: Pacote) => {
    setRetirarModal({
      open: true,
      packageItem: item,
      sourceExpedicao: exp,
      reason: 'zona_rural',
      customReason: ''
    });
  };

  const handleConfirmRetirar = async () => {
    if (!retirarModal.packageItem || !retirarModal.sourceExpedicao) {
      return;
    }

    const { packageItem, sourceExpedicao, reason, customReason } = retirarModal;

    let displayReason = '';
    if (reason === 'zona_rural') displayReason = 'Zona Rural (Endereço Rural)';
    else if (reason === 'avariado') displayReason = 'Pacote Avariado de Origem';
    else if (reason === 'outra_cidade') displayReason = 'Outra Cidade/Não Atendida';
    else displayReason = customReason || 'Outro Motivo';

    let targetStatus: Pacote['status'] = 'retirado_filial';
    if (reason === 'zona_rural') targetStatus = 'retirado_zona_rural';
    else if (reason === 'avariado') targetStatus = 'retirado_avariado';
    else if (reason === 'outra_cidade') targetStatus = 'retirado_outra_cidade';

    // 1. Update package status inside this expedition
    let updatedExpedicoes = expedicoes.map(exp => {
      if (exp.id === sourceExpedicao.id) {
        const updatedItens = exp.itens.map(item => {
          if (item.codigoBarras === packageItem.codigoBarras) {
            return {
              ...item,
              status: targetStatus,
              motivoDevolucao: 'Retirada da Rota',
              observacaoDevolucao: displayReason,
              dataHoraLeitura: new Date().toISOString()
            };
          }
          return item;
        });
        return {
          ...exp,
          itens: updatedItens
        };
      }
      return exp;
    });

    // Check if the specific expedition now has ZERO active (non-withdrawn) packages.
    // If all packages in the shipment are marked with any withdrawn status, the shipment is cancelled automatically.
    const targetExpKey = sourceExpedicao.id;
    const expInUpdate = updatedExpedicoes.find(exp => exp.id === targetExpKey);
    let wasCancelledAutomatically = false;

    if (expInUpdate) {
      const allWithdrawn = expInUpdate.itens.every(item => 
        ['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)
      );
      if (allWithdrawn) {
        updatedExpedicoes = updatedExpedicoes.filter(exp => exp.id !== targetExpKey);
        wasCancelledAutomatically = true;
      }
    }

    // 2. Sync to database/state!
    if (syncExpedicoes) {
      try {
        const sourceDriver = entregadores.find(d => d.id === sourceExpedicao.entregadorId);
        const sourceDriverName = sourceDriver ? sourceDriver.nome : 'Desconhecido';

        const logId = `retirada-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const logRecord: RetiradaPacote = {
          id: logId,
          codigoBarras: packageItem.codigoBarras || '',
          empresaId: packageItem.empresaId || (sourceExpedicao.empresaIds && sourceExpedicao.empresaIds[0]) || 'all',
          origemExpedicaoId: sourceExpedicao.id || '',
          origemEntregadorId: sourceExpedicao.entregadorId || '',
          origemEntregadorNome: sourceDriverName,
          motivo: reason || 'outro',
          observacao: displayReason || 'Outro',
          dataHora: new Date().toISOString(),
          usuarioNome: (currentUser && (currentUser.nomeCompleto || currentUser.username)) || 'Sistema',
          filialId: sourceExpedicao.filialId || (selectedFilialId !== 'all' ? selectedFilialId : '') || 'all'
        };

        // Salva o log de retirada de forma durável no Firebase
        try {
          await setDoc(doc(db, 'retiradas_pacotes', logId), cleanUndefined(logRecord));
        } catch (dbErr) {
          console.error("FAILED writing to retiradas_pacotes:", dbErr);
          throw new Error(`[escrevendo em retiradas_pacotes ID ${logId}]: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
        }

        try {
          await syncExpedicoes(updatedExpedicoes);
        } catch (dbErr) {
          console.error("FAILED calling syncExpedicoes from retirar:", dbErr);
          throw new Error(`[syncExpedicoes ao retirar]: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
        }
        
        if (wasCancelledAutomatically) {
          setSuccessFeedback(`Sucesso: Pacote "${packageItem.codigoBarras}" retirado! Como todos os volumes desta remessa foram retirados, a viagem do entregador foi cancelada automaticamente.`);
        } else {
          setSuccessFeedback(`Sucesso: Pacote "${packageItem.codigoBarras}" retirado e retornado ao estoque da filial!`);
        }
        setTimeout(() => setSuccessFeedback(''), 5000);
      } catch (err) {
        console.error("Retirar Error:", err);
        setErrorFeedback(`Erro ao realizar a retirada no banco de dados: ${err instanceof Error ? err.message : String(err)}`);
        setTimeout(() => setErrorFeedback(''), 7000);
      }
    }

    // Close modal
    setRetirarModal({
      open: false,
      packageItem: null,
      sourceExpedicao: null,
      reason: 'zona_rural',
      customReason: ''
    });
  };

  return (
    <div className="space-y-6" id="view-em-rota">
      
      {/* Overview stats container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="em-rota-stats">
        <div className="bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 rounded-2xl shadow-sm border border-blue-950 flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-blue-200 uppercase tracking-widest">Veículos em Trânsito</span>
            <span className="text-3xl font-black mt-1 block font-mono">{activeExpeditions.length}</span>
            <p className="text-[11px] opacity-80 mt-1">Carretas e motoristas nas ruas agora</p>
          </div>
          <div className="p-3 bg-blue-800/40 border border-blue-700/30 rounded-xl">
            <Truck className="h-6 w-6 text-blue-300" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Pacotes em Rota</span>
            <span className="text-3xl font-black mt-1 block text-slate-800 font-mono">
              {activeExpeditions.reduce((sum, exp) => sum + exp.itens.filter(i => i.status === 'pendente').length, 0)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Aguardando realização de entrega</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <Layers className="h-6 w-6 text-slate-500" />
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-100 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-extrabold text-emerald-800 uppercase tracking-widest">Sincronização de Trânsito</span>
            <span className="text-sm font-bold text-emerald-800 mt-1.5 block flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              Acompanhamento de Tráfego: Online
            </span>
            <p className="text-[11px] text-emerald-600 mt-1">Atualizando a cada 30 segundos</p>
          </div>
          <div className="p-3 bg-emerald-100/60 rounded-xl text-emerald-600">
            <Activity className="h-6 w-6 stroke-[1.5]" />
          </div>
        </div>
      </div>

      {/* Feedbacks de Operações */}
      <AnimatePresence>
        {successFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3.5 rounded-xl font-extrabold flex items-center space-x-2.5 shadow-sm"
          >
            <span className="bg-emerald-250 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-black">✔</span>
            <span>{successFeedback}</span>
          </motion.div>
        )}

        {errorFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3.5 rounded-xl font-extrabold flex items-center space-x-2.5 shadow-sm"
          >
            <span className="bg-rose-250 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-black">✕</span>
            <span>{errorFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card and control filter */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
            <div>
              <h3 className="font-bold text-lg text-slate-800">Monitoramento de Entregas em Tempo Real</h3>
              <p className="text-xs text-slate-500">Acompanhe as viagens iniciadas que ainda não deram baixa de retorno no pátio</p>
            </div>
            {onOpenTvMode && (
              <button
                onClick={onOpenTvMode}
                className="mt-1 sm:mt-0 flex items-center gap-1.5 self-start bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-3.5 py-2 rounded-xl transition border border-blue-200/50 cursor-pointer shadow-inner hover:scale-[1.02] active:scale-[0.98]"
                id="btn-open-tv-from-within-em-rota"
              >
                <Tv className="h-4 w-4 text-blue-600 animate-pulse" />
                <span>Modo TV (HDMI)</span>
              </button>
            )}

            {/* Histórico de Transferências */}
            <button
              onClick={() => setIsTransferHistoryOpen(true)}
              className="mt-1 sm:mt-0 flex items-center gap-1.5 self-start bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[11px] px-3.5 py-2 rounded-xl transition border border-amber-200/50 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              id="btn-open-transfer-history"
              title="Ver histórico de transferências de pacotes entre entregadores"
            >
              <History className="h-4 w-4 text-amber-600" />
              <span>Histórico de Transferências</span>
            </button>

            {/* Cancelar Todas as Entregas */}
            {filteredExpeditions.length > 0 && !currentUser.permissions.emRota_readonly && onCancelAllExpedicoes && (
              <button
                onClick={() => setConfirmCancelAllOpen(true)}
                className="mt-1 sm:mt-0 flex items-center gap-1.5 self-start bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 px-3.5 py-2 rounded-xl text-[11px] font-black transition cursor-pointer hover:shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                id="btn-cancel-all-expeditions-global"
                title="Cancelar todas as saídas de entregas em andamento"
              >
                <XCircle className="h-4 w-4" />
                <span>Cancelar Todas as Entregas</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
            {/* Filtro de Filial */}
            <div className="relative w-full sm:w-48 shrink-0">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                id="select-filial-em-rota"
                value={selectedFilialId}
                onChange={(e) => setSelectedFilialId(e.target.value)}
                className="w-full bg-slate-50 pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                {(currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') && (
                  <option value="all">Todas as Filiais</option>
                )}
                {userPermittedFiliais.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
                {userPermittedFiliais.length === 0 && (
                  <option value="" disabled>Nenhuma filial autorizada</option>
                )}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-400 w-0 h-0"></div>
            </div>

            {/* Input de Busca */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="input-search-em-rota"
                type="text"
                placeholder="Buscar por motorista ou parceira..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* List of active expeditions */}
        {filteredExpeditions.length === 0 ? (
          <div className="text-center py-20 text-slate-400 border border-dashed border-slate-150 rounded-2xl bg-slate-50/50">
            <Truck className="h-10 w-10 text-slate-300 mx-auto mb-3 stroke-1" />
            <p className="font-bold text-sm text-slate-600">Nenhum carregamento em progresso</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Todos os motoristas cadastrados estão ociosos no pátio ou todos os retornos de rota já foram devidamente liquidados pelas baixas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExpeditions.map((exp) => {
              const driver = getDriver(exp.entregadorId);
              const cleanSearch = cleanBarcode(searchTerm);
              const hasSearchedPackage = searchTerm.trim().length >= 3 && exp.itens.some(item => {
                if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) return false;
                const barcode = item.codigoBarras.toUpperCase();
                return barcode.includes(searchTerm.toUpperCase()) || (cleanSearch && barcode.includes(cleanSearch));
              });
              const isExpanded = expandedExpId === exp.id || hasSearchedPackage;
              
              return (
                <div 
                  key={exp.id} 
                  className={`border rounded-xl transition duration-250 ${
                    isExpanded ? 'border-blue-500 bg-blue-50/10 shadow-sm' : 'border-slate-100 hover:border-slate-300 bg-white'
                  }`}
                  id={`exp-active-row-${exp.id}`}
                >
                  {/* Row main header */}
                  <div 
                    onClick={() => toggleExpand(exp.id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-4">
                      {/* Driver visual identity */}
                      {driver?.foto ? (
                        <img 
                          src={driver.foto} 
                          alt={driver.nome} 
                          className="w-11 h-11 rounded-full object-cover border-2 border-slate-100 shrink-0 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm">
                          {driver?.nome.substring(0, 2).toUpperCase() || 'TR'}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">
                            {driver?.nome || 'Motorista Não Identificado'}
                          </h4>
                          <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-black uppercase font-mono tracking-wider animate-pulse">
                            Em Trânsito
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-0.5 gap-x-4 text-xs text-slate-500 font-medium mt-1">
                          <p className="flex items-center gap-1">
                            <Clock className="h-3 w-3 inline text-slate-400" />
                            Saída em: <strong>{new Date(exp.dataHoraSaida).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</strong> 
                            <span className="text-slate-300">({new Date(exp.dataHoraSaida).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})})</span>
                          </p>
                          <p className="flex items-center gap-1">
                            <Layers className="h-3 w-3 inline text-slate-400" />
                            Volume Carregado: <strong className="text-slate-700 font-bold">{exp.itens.filter(i => !['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(i.status)).length} pacotes</strong>
                          </p>
                          <p className="flex items-center gap-1 sm:col-span-2 mt-0.5 pointer-events-none">
                            <MapPin className="h-3.5 w-3.5 inline text-emerald-500 shrink-0" />
                            <span>Rotas: <strong className="text-emerald-700 font-extrabold">{
                              rotas
                                .filter(r => (exp.rotaIds || (exp.rotaId ? [exp.rotaId] : [])).includes(r.id))
                                .map(r => r.nome)
                                .join(', ') || 'Carga Avulsa'
                            }</strong></span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Operational values and actions */}
                    <div className="flex items-center justify-between md:justify-end gap-5">
                      <div className="text-left md:text-right">
                        <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Tempo Decorrido</span>
                        <span className="text-sm font-black text-blue-700 block mt-0.5 font-mono flex items-center gap-1.5 md:justify-end">
                          <Clock className="h-3.5 w-3.5 text-blue-500 animate-spin stroke-[1.5]" style={{ animationDuration: '4s' }} />
                          {getElapsedTime(exp.dataHoraSaida)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* List companies tags */}
                        <div className="hidden lg:flex items-center gap-1.5">
                          {exp.empresaIds.map(id => {
                            const comp = getCompany(id);
                            return (
                              <span 
                                key={id} 
                                className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold font-mono border border-slate-150"
                              >
                                {comp?.nome || 'Cliente'}
                              </span>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          {!currentUser.permissions.emRota_readonly && onCancelExpedicao && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmCancelExpId(exp.id);
                              }}
                              className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 px-3 py-2 text-xs font-black rounded-lg transition duration-150 flex items-center gap-1 cursor-pointer hover:shadow-md"
                              title="Cancelar saída de entrega e retornar os itens ao pátio"
                              id={`btn-cancel-exp-${exp.id}`}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Cancelar Entregas</span>
                            </button>
                          )}

                          <button 
                            className={`p-2.5 rounded-lg border transition ${
                              isExpanded ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650'
                            }`}
                            title={isExpanded ? "Ocultar Pacotes" : "Ver Lista de Carga"}
                            id={`btn-expand-exp-${exp.id}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded package list */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/40 p-5 rounded-b-xl space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                        <div>
                          <p className="text-xs font-bold text-slate-750">Relação de Notas e Código de Barras</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            O status de todos os itens em rota é temporariamente fixado como <strong>Pendente</strong> até a finalização do acerto de contas físico na portaria.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="relative w-full sm:w-60">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Buscar pacote nesta viagem..."
                              value={localPackageSearch[exp.id] || ''}
                              onChange={(e) => setLocalPackageSearch(prev => ({ ...prev, [exp.id]: e.target.value }))}
                              className="w-full pl-8 pr-8 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono focus:border-blue-500"
                            />
                            {(localPackageSearch[exp.id] || '') && (
                              <button
                                onClick={() => setLocalPackageSearch(prev => ({ ...prev, [exp.id]: '' }))}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <span className="text-[11px] bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5 font-mono font-bold shrink-0">
                            EXP #{exp.id}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(() => {
                          const query = (localPackageSearch[exp.id] || '').trim().toUpperCase();
                          const cleanQuery = cleanBarcode(query);
                          
                          // Se houver busca global por código de barras, filtra os pacotes por ela se o usuário não digitar busca local
                          const globalQuery = searchTerm.trim().toUpperCase();
                          const globalCleanQuery = cleanBarcode(globalQuery);
                          const isGlobalBarcodeSearch = globalQuery.length >= 3 && !driver?.nome.toLowerCase().includes(searchTerm.toLowerCase());

                          const filteredItens = exp.itens.filter(item => {
                            if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) {
                              return false;
                            }
                            const barcode = item.codigoBarras.toUpperCase();
                            if (query) {
                              return barcode.includes(query) || (cleanQuery && barcode.includes(cleanQuery));
                            }
                            if (isGlobalBarcodeSearch) {
                              return barcode.includes(globalQuery) || (globalCleanQuery && barcode.includes(globalCleanQuery));
                            }
                            return true;
                          });

                          if (filteredItens.length === 0) {
                            return (
                              <div className="col-span-full py-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-150">
                                <Search className="h-5 w-5 mx-auto text-slate-300 stroke-1 mb-1.5" />
                                <p className="font-bold text-slate-600">Nenhum pacote localizado nesta carga</p>
                                <p className="text-[10px] mt-0.5">Revise o código ou limpe os filtros da busca.</p>
                              </div>
                            );
                          }

                          return filteredItens.map((item, index) => {
                            const comp = getCompany(item.empresaId);
                            return (
                              <div 
                                key={index} 
                                className="bg-white p-3.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2 hover:border-slate-350 transition duration-150"
                              >
                                <div className="space-y-1 min-w-0">
                                  <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-black font-mono inline-block">
                                    {comp?.nome || 'Carregamento'}
                                  </span>
                                  <p className="font-mono text-xs font-bold text-slate-750 truncate" title={item.codigoBarras}>
                                    {item.codigoBarras}
                                  </p>
                                </div>

                                <div className="flex items-center space-x-2 shrink-0">
                                  {['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status) ? (
                                    <div className="flex flex-col items-end space-y-0.5 text-right">
                                      <span className="text-[10px] bg-purple-50 border border-purple-200 text-purple-700 font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                                        {item.status === 'retirado_zona_rural' ? 'Zona Rural' :
                                         item.status === 'retirado_avariado' ? 'Avariado' :
                                         item.status === 'retirado_outra_cidade' ? 'Outra Cidade' : 'Retirado Filial'}
                                      </span>
                                      <span className="text-[8px] text-purple-600 font-bold leading-none max-w-[120px] truncate" title={item.observacaoDevolucao || ''}>
                                        {item.observacaoDevolucao || 'Custódia Filial'}
                                      </span>
                                    </div>
                                  ) : item.status === 'devolvido' ? (
                                    <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-800 font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                                      Devolvido
                                    </span>
                                  ) : item.status === 'entregue' ? (
                                    <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                                      Entregue
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono mr-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        Pendente
                                      </span>

                                      {!currentUser.permissions.emRota_readonly && syncExpedicoes && (
                                        <div className="flex items-center space-x-1">
                                          <button
                                            type="button"
                                            onClick={() => handleStartTransfer(exp, item)}
                                            className="p-1 px-1.5 border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-700 rounded-lg transition duration-150 cursor-pointer flex items-center gap-1 text-[10px] font-black"
                                            title="Transferir pacote para outro entregador"
                                          >
                                            <ArrowLeftRight className="h-3 w-3 shrink-0" />
                                            <span>Transf.</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleStartRetirar(exp, item)}
                                            className="p-1 px-1.5 border border-slate-200 hover:border-purple-300 bg-slate-50 hover:bg-purple-50 text-slate-400 hover:text-purple-700 rounded-lg transition duration-150 cursor-pointer flex items-center gap-1 text-[10px] font-black"
                                            title="Retirar pacote (Zona Rural, Avaria ou Outra Cidade)"
                                          >
                                            <CornerUpLeft className="h-3 w-3 shrink-0" />
                                            <span>Retirar</span>
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL DE CONFIRMAÇÃO DE CANCELAMENTO */}
      <AnimatePresence>
        {confirmCancelExpId && (() => {
          const targetExp = expedicoes.find(e => e.id === confirmCancelExpId);
          const targetDriver = targetExp ? getDriver(targetExp.entregadorId) : null;
          const targetDriverName = targetDriver ? `${targetDriver.nome}` : 'este entregador';

          return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 shadow-2xl" id="modal-confirm-cancel-exp">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmCancelExpId(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              />

              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden z-10 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-rose-50 rounded-full shrink-0 text-rose-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1.5 text-left w-full min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-extrabold text-slate-900 text-base font-sans">
                        Confirmar Cancelamento
                      </h3>
                      <button
                        onClick={() => setConfirmCancelExpId(null)}
                        className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
                        id="btn-close-cancel-confirm-modal"
                      >
                        <X className="h-4.5 w-4.5" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                      Tem certeza que quer cancelar as entregas deste entregador <span className="text-slate-950 font-black tracking-wide underline decoration-rose-550/30 decoration-2">{targetDriverName}</span>?
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      Todos os pacotes vinculados a esta saída retornarão imediatamente para o status <span className="font-bold text-amber-600">pendente de carregamento</span> no checkout.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmCancelExpId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200 py-2.5 sm:py-2"
                    id="btn-cancel-modal-dismiss"
                  >
                    Não, Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onCancelExpedicao) {
                        onCancelExpedicao(confirmCancelExpId);
                      }
                      setConfirmCancelExpId(null);
                    }}
                    className="px-5 py-2.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border border-rose-700 flex items-center justify-center gap-1.5 hover:scale-[1.01]"
                    id="btn-cancel-modal-confirm"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Sim, Cancelar</span>
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL DE CONFIRMAÇÃO DE CANCELAMENTO DE TODAS AS ENTREGAS */}
      <AnimatePresence>
        {confirmCancelAllOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 shadow-2xl" id="modal-confirm-cancel-all-exp">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmCancelAllOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden z-10 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 rounded-full shrink-0 text-red-650">
                  <AlertCircle className="h-6 w-6 text-rose-600" />
                </div>
                <div className="space-y-1.5 text-left w-full min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-900 text-base font-sans">
                      Cancelar TODAS as Entregas
                    </h3>
                    <button
                      onClick={() => setConfirmCancelAllOpen(false)}
                      className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
                      id="btn-close-cancel-all-confirm-modal"
                    >
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                    Tem certeza que quer cancelar as entregas de <span className="text-slate-950 font-black text-rose-600 underline decoration-rose-500/30 decoration-2">{filteredExpeditions.length} entregador(es)</span> que estão em trânsito atualmente?
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Todos os volumes e pacotes de todas estas saídas ativas retornarão imediatamente para o status <span className="font-bold text-amber-600">pendente de carregamento</span> e estarão elegíveis para checkout novamente. Essa ação não pode ser desfeita.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmCancelAllOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200 py-2.5 sm:py-2"
                  id="btn-cancel-all-modal-dismiss"
                >
                  Não, Voltar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onCancelAllExpedicoes) {
                      const expIds = filteredExpeditions.map(e => e.id);
                      onCancelAllExpedicoes(expIds);
                    }
                    setConfirmCancelAllOpen(false);
                  }}
                  className="px-5 py-2.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border border-rose-700 flex items-center justify-center gap-1.5 hover:scale-[1.01]"
                  id="btn-cancel-all-modal-confirm"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Sim, Cancelar Todas</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE TRANSFERÊNCIA DE PACOTE */}
      <AnimatePresence>
        {transferModal.open && transferModal.packageItem && transferModal.sourceExpedicao && (() => {
          const { packageItem, sourceExpedicao } = transferModal;
          const sourceDriver = getDriver(sourceExpedicao.entregadorId);
          const sourceCompanyName = getCompany(packageItem.empresaId)?.nome || 'Empresa de Origem';

          // Outros entregadores que possuem expedições ativas em trânsito
          const activeDestinationCandidates = activeExpeditions.filter(exp => exp.id !== sourceExpedicao.id);

          // Entregadores ociosos do pátio que estão na mesma filial (ou geral) e não estão em trânsito
          const idleDrivers = entregadores.filter(d => {
            // Filtrar por filial se aplicável
            if (selectedFilialId !== 'all') {
              if (d.filialId && d.filialId !== selectedFilialId) return false;
            }
            // Não deve estar em trânsito atualmente
            const isCurrentlyInTransit = activeExpeditions.some(exp => exp.entregadorId === d.id);
            return !isCurrentlyInTransit;
          });

          const filteredActiveCandidates = activeDestinationCandidates.filter(exp => {
            const driver = getDriver(exp.entregadorId);
            return !targetDriverSearch || (driver && driver.nome.toLowerCase().includes(targetDriverSearch.toLowerCase()));
          });

          const filteredIdleDriversList = idleDrivers.filter(d => {
            return !targetDriverSearch || d.nome.toLowerCase().includes(targetDriverSearch.toLowerCase());
          });

          return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 shadow-2xl" id="modal-transfer-package">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTransferModal(prev => ({ ...prev, open: false }))}
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
                    <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shrink-0">
                      <ArrowLeftRight className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base font-sans">
                        Transferir Pacote de Rota
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Transfira a autoria do pacote para recalcular e creditar as comissões corretamente.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTransferModal(prev => ({ ...prev, open: false }))}
                    className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Detalhes do item a transferir */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider font-sans">Código de Barras</span>
                      <span className="font-mono text-xs font-black text-slate-800 tracking-widest mt-0.5 block">{packageItem.codigoBarras}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider font-sans">Empresa de Origem</span>
                      <span className="text-xs font-bold text-slate-750 mt-0.5 block">{sourceCompanyName}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 font-sans">Portador Atual (Levou errado)</span>
                      <span className="text-xs font-extrabold text-rose-650 mt-0.5 block">
                        {sourceDriver?.nome || 'Motorista A'}
                      </span>
                    </div>
                    <div className="bg-rose-50 text-rose-600 text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-lg border border-rose-100 font-mono">
                      Expedição #{sourceExpedicao.id}
                    </div>
                  </div>
                </div>

                {/* Destinatário da transferência */}
                <div className="space-y-2">
                  <label htmlFor="select-transfer-target" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide font-sans">
                    Escolha o motorista destino:
                  </label>
                  
                  {/* Busca rápida para motoristas no modal */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar motoristas por nome..."
                      value={targetDriverSearch}
                      onChange={(e) => setTargetDriverSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 tracking-wide focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-sans focus:border-blue-500"
                    />
                    {targetDriverSearch && (
                      <button
                        type="button"
                        onClick={() => setTargetDriverSearch('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-650 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    id="select-transfer-target"
                    value={transferModal.targetExpedicaoId}
                    onChange={(e) => setTransferModal(prev => ({ ...prev, targetExpedicaoId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-755 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="" disabled>--- Selecione o Destinatário ---</option>
                    
                    {filteredActiveCandidates.length > 0 && (
                      <optgroup label="Entregadores Ativos em Trânsito (Mesma Rota/Período)">
                        {filteredActiveCandidates.map(exp => {
                          const driver = getDriver(exp.entregadorId);
                          return (
                            <option key={exp.id} value={exp.id}>
                              {driver?.nome || 'Motorista'} (Viagem #{exp.id} - {exp.itens.filter(i => !['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(i.status)).length} pcts)
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {filteredIdleDriversList.length > 0 && (
                      <optgroup label="Entregadores Ociosos no Pátio (Iniciará Nova Viagem)">
                        {filteredIdleDriversList.map(d => (
                          <option key={d.id} value={`new_driver_${d.id}`}>
                            {d.nome} (Iniciar nova rota com este pacote)
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {filteredActiveCandidates.length === 0 && filteredIdleDriversList.length === 0 && (
                      <option value="" disabled>Nenhum entregador atende o filtro de busca</option>
                    )}
                  </select>
                </div>

                {/* Rodapé institucional com ações */}
                <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-end pt-3 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => setTransferModal(prev => ({ ...prev, open: false }))}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!transferModal.targetExpedicaoId}
                    onClick={handleConfirmTransfer}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border border-blue-700 flex items-center justify-center gap-1.5 hover:scale-[1.01]"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    <span>Confirmar Transferência</span>
                  </button>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL DE RETIRADA DE PACOTE (ZONA RURAL, AVARIA OU OUTRA CIDADE) */}
      <AnimatePresence>
        {retirarModal.open && retirarModal.packageItem && retirarModal.sourceExpedicao && (() => {
          const { packageItem, sourceExpedicao, reason, customReason } = retirarModal;
          const driver = getDriver(sourceExpedicao.entregadorId);
          const companyName = getCompany(packageItem.empresaId)?.nome || 'Empresa de Origem';

          return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 shadow-2xl" id="modal-retirar-package">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setRetirarModal(prev => ({ ...prev, open: false }))}
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
                    <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 shrink-0">
                      <CornerUpLeft className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base font-sans">
                        Retirar Pacote da Rota
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Retire o volume do motorista sem gerar débitos, comissões ou estatísticas ruins de desempenho.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRetirarModal(prev => ({ ...prev, open: false }))}
                    className="text-slate-400 hover:text-slate-650 transition p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Detalhes do item a retirar */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider font-sans">Código de Barras</span>
                      <span className="font-mono text-xs font-black text-slate-800 tracking-widest mt-0.5 block">{packageItem.codigoBarras}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider font-sans">Empresa de Origem</span>
                      <span className="text-xs font-bold text-slate-750 mt-0.5 block">{companyName}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 font-sans">Entregador Responsável</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">
                        {driver?.nome || 'Motorista'}
                      </span>
                    </div>
                    <div className="bg-purple-50 text-purple-700 text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-lg border border-purple-100 font-mono">
                      Expedição #{sourceExpedicao.id}
                    </div>
                  </div>
                </div>

                {/* Motivos da retirada */}
                <div className="space-y-3.5">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide font-sans">
                    Motivo da Retirada / Devolução Filial:
                  </span>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setRetirarModal(prev => ({ ...prev, reason: 'zona_rural' }))}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold flex flex-col transition cursor-pointer ${
                        reason === 'zona_rural' 
                          ? 'bg-purple-50/50 border-purple-300 text-purple-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>Zona Rural (Endereço Rural)</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Endereço impossibilitado de entrega rural regular.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRetirarModal(prev => ({ ...prev, reason: 'avariado' }))}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold flex flex-col transition cursor-pointer ${
                        reason === 'avariado' 
                          ? 'bg-purple-50/50 border-purple-300 text-purple-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>Pacote Avariado de Origem</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Produto ou pacote danificado pela transportadora.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRetirarModal(prev => ({ ...prev, reason: 'outra_cidade' }))}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold flex flex-col transition cursor-pointer ${
                        reason === 'outra_cidade' 
                          ? 'bg-purple-50/50 border-purple-300 text-purple-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>Outra Cidade / Não Atendida</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Endereço pertence a outra filial ou região não listada.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRetirarModal(prev => ({ ...prev, reason: 'outro' }))}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold flex flex-col transition cursor-pointer ${
                        reason === 'outro' 
                          ? 'bg-purple-50/50 border-purple-300 text-purple-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>Outro Motivo personalizado</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Digite o motivo no campo de texto abaixo.</span>
                    </button>
                  </div>

                  {reason === 'outro' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1 mt-2"
                    >
                      <input
                        type="text"
                        placeholder="Descreva o motivo da devolução..."
                        value={customReason}
                        onChange={(e) => setRetirarModal(prev => ({ ...prev, customReason: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Confirm actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-end pt-3 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => setRetirarModal(prev => ({ ...prev, open: false }))}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={reason === 'outro' && !customReason.trim()}
                    onClick={handleConfirmRetirar}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition border border-purple-700 flex items-center justify-center gap-1.5 hover:scale-[1.01]"
                  >
                    <CornerUpLeft className="h-4 w-4" />
                    <span>Confirmar Retirada Filial</span>
                  </button>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal de Histórico de Movimentações (Transferências e Retiradas) */}
      <AnimatePresence>
        {isTransferHistoryOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="modal-transfer-history">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">Histórico de Movimentação de Pacotes</h3>
                    <p className="text-xs text-slate-400">Log detalhado de transferências (entre entregadores) e retiradas (retorno ao estoque)</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsTransferHistoryOpen(false);
                    setHistorySearch('');
                    setHistorySelectedDriverId('');
                    setHistorySelectedDriverRole('any');
                    setHistoryTypeTab('all');
                  }}
                  className="p-1 px-3 py-1.5 cursor-pointer rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs transition border border-slate-200"
                >
                  Fechar
                </button>
              </div>

              {/* Filters */}
              <div className="p-4 bg-slate-50/20 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center">
                
                {/* Text search */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Filtrar por código de barras, entregador, operador ou observação..."
                    className="w-full bg-slate-50 focus:bg-white border border-slate-250 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none transition shadow-inner"
                  />
                  {historySearch && (
                    <button 
                      onClick={() => setHistorySearch('')}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Driver filter */}
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                  <div className="relative w-full sm:w-64">
                    <select
                      value={historySelectedDriverId}
                      onChange={(e) => setHistorySelectedDriverId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none transition"
                    >
                      <option value="">-- Todos os Entregadores --</option>
                      {entregadores
                        .slice()
                        .sort((a, b) => a.nome.localeCompare(b.nome))
                        .map(driver => (
                          <option key={driver.id} value={driver.id}>
                            {driver.nome}
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  {historySelectedDriverId && (
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setHistorySelectedDriverRole('any')}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer ${
                          historySelectedDriverRole === 'any'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        Envolve
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistorySelectedDriverRole('origin')}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer ${
                          historySelectedDriverRole === 'origin'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        Origem
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistorySelectedDriverRole('destination')}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer ${
                          historySelectedDriverRole === 'destination'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        Destino
                      </button>
                    </div>
                  )}

                  {(historySearch || historySelectedDriverId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistorySearch('');
                        setHistorySelectedDriverId('');
                        setHistorySelectedDriverRole('any');
                      }}
                      className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-extrabold text-xs rounded-2xl border border-rose-200 transition cursor-pointer self-start sm:self-auto"
                    >
                      Limpar Tudo
                    </button>
                  )}
                </div>

              </div>

              {/* Segmented log type filtering */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2 font-mono">Visualizar log de:</span>
                <button
                  type="button"
                  onClick={() => setHistoryTypeTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                    historyTypeTab === 'all'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span>Todos os Registros</span>
                  <span className="text-[10px] opacity-80 px-1.5 py-0.5 rounded-md bg-black/15 font-mono">
                    {transferencias.length + retiradas.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTypeTab('transfer')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                    historyTypeTab === 'transfer'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                  <span>Transferências</span>
                  <span className="text-[10px] opacity-80 px-1.5 py-0.5 rounded-md bg-black/15 font-mono">
                    {transferencias.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTypeTab('withdraw')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                    historyTypeTab === 'withdraw'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-purple-400"></span>
                  <span>Retiradas / Estoque</span>
                  <span className="text-[10px] opacity-80 px-1.5 py-0.5 rounded-md bg-black/15 font-mono">
                    {retiradas.length}
                  </span>
                </button>
              </div>

              {/* Content table */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6" id="transfer-history-list">
                {combinedHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
                    <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl border border-dashed border-slate-200">
                      <History className="h-8 w-8 stroke-[1.2]" />
                    </div>
                    <div>
                      <p className="text-slate-800 font-bold text-sm">Nenhum evento encontrado</p>
                      <p className="text-slate-400 text-xs mt-1">Experimente mudar os filtros ou o termo de busca selecionado</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="p-3.5 pl-4">Tipo</th>
                          <th className="p-3.5">Código de Barras (Limpo)</th>
                          <th className="p-3.5">Origem</th>
                          <th className="p-3.5">Destino / Detalhes</th>
                          <th className="p-3.5">Operador</th>
                          <th className="p-3.5 pr-4 text-right">Data & Hora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {combinedHistory.map((item) => {
                          const cleanCode = cleanBarcode(item.codigoBarras);
                          const isTransfer = item.logType === 'transfer';
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition group font-sans">
                              <td className="p-3.5 pl-4 whitespace-nowrap">
                                {isTransfer ? (
                                  <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100 uppercase tracking-wider">
                                    Transferência
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-[10px] font-black border border-purple-100 uppercase tracking-wider">
                                    Retirada
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 font-mono font-bold text-slate-800 break-all select-all">
                                {cleanCode}
                                {cleanCode !== item.codigoBarras && (
                                  <span className="block text-[9px] text-slate-400 font-sans font-medium select-none truncate max-w-44" title={item.codigoBarras}>
                                    QR: {item.codigoBarras}
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5">
                                <span className="font-bold text-slate-700 block truncate max-w-[150px]" title={item.origemEntregadorNome}>
                                  {item.origemEntregadorNome}
                                </span>
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  Exp. #{item.origemExpedicaoId}
                                </span>
                              </td>
                              <td className="p-3.5">
                                {isTransfer ? (
                                  <>
                                    <span className="font-bold text-emerald-700 block truncate max-w-[150px]" title={item.destinoEntregadorNome}>
                                      {item.destinoEntregadorNome}
                                    </span>
                                    <span className="block text-[10px] text-slate-400 font-mono">
                                      Exp. {item.destinoExpedicaoId === 'nova_expedicao' ? 'Nova Saída' : `#${item.destinoExpedicaoId}`}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-bold text-purple-700 block truncate max-w-[180px]" title={item.observacao}>
                                      {item.observacao}
                                    </span>
                                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                      Filial (Estoque)
                                    </span>
                                  </>
                                )}
                              </td>
                              <td className="p-3.5 text-slate-550 font-bold">
                                {item.usuarioNome || 'Sistema'}
                              </td>
                              <td className="p-3.5 pr-4 text-right text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                {new Date(item.dataHora).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Listando: {combinedHistory.length} registro(s)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsTransferHistoryOpen(false);
                    setHistorySearch('');
                    setHistorySelectedDriverId('');
                    setHistorySelectedDriverRole('any');
                    setHistoryTypeTab('all');
                  }}
                  className="px-4 py-2 cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl transition shadow-sm border border-slate-900"
                >
                  Fechar janela
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
