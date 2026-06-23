/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  X, 
  ArrowLeft,
  Clock, 
  Truck, 
  Activity, 
  CheckCircle2, 
  MapPin, 
  Volume2, 
  VolumeX,
  Scan,
  Barcode,
  Building2,
  Calendar,
  AlertTriangle,
  FileText,
  User
} from 'lucide-react';
import { Empresa, Entregador, Expedicao, Rota, User as SystemUser, Filial } from '../types';
import { db, onSnapshot, doc } from '../lib/supabase';

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

const DiamondLogo = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Pavilion (Bottom part) */}
    <polygon points="4,32 30,32 50,88" fill="#0c4ca3" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="30,32 50,32 50,88" fill="#1d72d1" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="50,32 70,32 50,88" fill="#4fa3f7" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="70,32 96,32 50,88" fill="#89c5fd" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />

    {/* Crown (Top part) */}
    <polygon points="22,8 4,32 30,32" fill="#073166" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="22,8 30,32 50,32" fill="#0152b8" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="22,8 50,8 50,32" fill="#1b6ed1" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="78,8 96,32 70,32" fill="#60b1fc" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="78,8 70,32 50,32" fill="#3a92ee" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="78,8 50,8 50,32" fill="#5fb2ff" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

interface TvPainelViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  expedicoes: Expedicao[];
  rotas: Rota[];
  onClose: () => void;
  currentUser: SystemUser;
  filiais: Filial[];
  campanhaAtiva?: boolean;
}

type PanelViewMode = 'frota' | 'bipagem';

export default function TvPainelView({ empresas, entregadores, expedicoes, rotas, onClose, currentUser, filiais, campanhaAtiva = false }: TvPainelViewProps) {
  // Gestão de filiais permitidas e filial selecionada como padrão
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
      return 'all';
    }
    const permittedIds = currentUser.filiais || [];
    return permittedIds.length > 0 ? permittedIds[0] : '';
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<PanelViewMode>('bipagem'); // Padrão: bipagem solicitada como a principal agora!
  const [fontScale, setFontScale] = useState<number>(1);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Estado para armazenar o status do pátio editável com persistência local
  const [patioStatus, setPatioStatus] = useState<string>(() => {
    return safeStorage.getItem('tvPatioStatus') || 'FÉ NA MISSÃO';
  });

  useEffect(() => {
    safeStorage.setItem('tvPatioStatus', patioStatus);
  }, [patioStatus]);

  // Estados de sincronização de bipadas em tempo real com o localStorage
  const [activeScannedItems, setActiveScannedItems] = useState<Array<{ codigoBarras: string; empresaId: string }>>([]);
  const [activeEntregadorId, setActiveEntregadorId] = useState<string>('');
  const [activeRotaIds, setActiveRotaIds] = useState<string[]>([]);

  // Ranking de Campanha em Tempo Real (Top 3 Melhores Entregadores por taxa de sucesso)
  const topEntregadoresCampanha = useMemo(() => {
    return (entregadores || []).map(ent => {
      let entregues = 0;
      let devolvidos = 0;

      (expedicoes || []).forEach(exp => {
        if (exp.entregadorId === ent.id) {
          (exp.itens || []).forEach(item => {
            if (item.status === 'entregue') entregues++;
            if (item.status === 'devolvido') devolvidos++;
          });
        }
      });

      const total = entregues + devolvidos;
      const taxaSucesso = total > 0 ? Math.round((entregues / total) * 100) : 0;

      return {
        ...ent,
        entregues,
        devolvidos,
        taxaSucesso,
        total
      };
    })
    .filter(ent => ent.total > 0)
    .sort((a, b) => {
      if (b.taxaSucesso !== a.taxaSucesso) {
        return b.taxaSucesso - a.taxaSucesso;
      }
      return b.entregues - a.entregues;
    })
    .slice(0, 3);
  }, [entregadores, expedicoes]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sincronizar dados das bipagens ativos de outras abas ou da aba corrente via LocalStorage e banco central (Nuvem)
  useEffect(() => {
    const syncWithLocalStorage = () => {
      try {
        const rawItems = safeStorage.getItem('currentScannedItems');
        const rawDriverId = safeStorage.getItem('currentSelectedEntregadorId');
        const rawRotaIds = safeStorage.getItem('currentSelectedRotaIds');

        if (rawItems) {
          const parsed = JSON.parse(rawItems);
          if (Array.isArray(parsed)) {
            setActiveScannedItems(parsed);
          }
        } else {
          setActiveScannedItems([]);
        }

        if (rawDriverId) {
          setActiveEntregadorId(rawDriverId);
        } else {
          setActiveEntregadorId('');
        }

        if (rawRotaIds) {
          const parsed = JSON.parse(rawRotaIds);
          if (Array.isArray(parsed)) {
            setActiveRotaIds(parsed);
          }
        } else {
          setActiveRotaIds([]);
        }
      } catch (e) {
        console.error("Erro na sincronização HDMI do painel", e);
      }
    };

    // 1. Assinar sessões de triagem em tempo real via Banco de Dados Central (para TVs ou abas externas)
    let unsub: (() => void) | null = null;
    try {
      if (db) {
        unsub = onSnapshot(doc(db, 'user_sessions', 'active_triagem'), (snapshot: any) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data) {
              if (Array.isArray(data.scannedItems)) {
                setActiveScannedItems(data.scannedItems);
              } else {
                setActiveScannedItems([]);
              }
              setActiveEntregadorId(data.selectedEntregadorId || '');
              if (Array.isArray(data.selectedRotaIds)) {
                setActiveRotaIds(data.selectedRotaIds);
              } else {
                setActiveRotaIds([]);
              }
              return; // Sincronização centralizada obteve êxito, evita fallback
            }
          }
          // Se o documento existe mas foi apagado/limpo, faz fallback ou limpa
          syncWithLocalStorage();
        });
      }
    } catch (err) {
      console.warn("Erro ao registrar listener da triagem ativa centralizada:", err);
    }

    // 2. Se não houver db ativado ou em caso de perda temporária, carregar/sincronizar na montagem e escutar storage
    if (!unsub) {
      syncWithLocalStorage();
    }

    // Escutar eventos de armazenamento (segurança local e abas extras na mesma máquina)
    window.addEventListener('storage', syncWithLocalStorage);

    // Fast backup polling (400ms) para carregar caso necessário se o banco falhar
    const intervalId = setInterval(() => {
      // Se não tem canal de websocket/banco ativo, executa o polling
      if (!unsub) {
        syncWithLocalStorage();
      }
    }, 400);

    return () => {
      window.removeEventListener('storage', syncWithLocalStorage);
      clearInterval(intervalId);
      if (unsub) {
        try { unsub(); } catch (_) {}
      }
    };
  }, []);

  // Relógio do painel com segundos em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listener para fechar o modo TV ao teclar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filtrar apenas expedições ativas (em rota de entrega) de acordo com a filial selecionada
  const activeExpeditions = useMemo(() => {
    return expedicoes.filter(exp => {
      if (exp.concluido) return false;
      
      const expFilialId = exp.filialId || entregadores.find(d => d.id === exp.entregadorId)?.filialId;
      if (selectedFilialId !== 'all') {
        if (expFilialId !== selectedFilialId) return false;
      } else {
        if (expFilialId) {
          const permittedIds = userPermittedFiliais.map(f => f.id);
          if (!permittedIds.includes(expFilialId)) return false;
        }
      }
      return true;
    });
  }, [expedicoes, selectedFilialId, userPermittedFiliais, entregadores]);

  // Somas de estatísticas de pacotes hoje de acordo com a filial selecionada
  const generalStats = useMemo(() => {
    let activePacks = 0;
    let deliveredPacks = 0;
    let returnedPacks = 0;
    let totalTodayPacks = 0;

    expedicoes.forEach(exp => {
      const expFilialId = exp.filialId || entregadores.find(d => d.id === exp.entregadorId)?.filialId;
      if (selectedFilialId !== 'all') {
        if (expFilialId !== selectedFilialId) return;
      } else {
        if (expFilialId) {
          const permittedIds = userPermittedFiliais.map(f => f.id);
          if (!permittedIds.includes(expFilialId)) return;
        }
      }

      exp.itens.forEach(item => {
        if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(item.status)) {
          return;
        }
        totalTodayPacks++;
        if (!exp.concluido) {
          activePacks++;
        } else {
          if (item.status === 'entregue') deliveredPacks++;
          if (item.status === 'devolvido') returnedPacks++;
        }
      });
    });

    const successRate = (deliveredPacks + returnedPacks) > 0 
      ? Math.round((deliveredPacks / (deliveredPacks + returnedPacks)) * 100) 
      : 100;

    return {
      activePacks,
      deliveredPacks,
      returnedPacks,
      totalTodayPacks,
      successRate,
      activeVehicles: activeExpeditions.length
    };
  }, [expedicoes, activeExpeditions, selectedFilialId, userPermittedFiliais, entregadores]);

  // Rotatividade de motoristas na aba de frotas
  useEffect(() => {
    if (!autoScroll || activeExpeditions.length <= 4 || viewMode !== 'frota') return;
    
    const interval = setInterval(() => {
      setPageIndex(prev => {
        const totalPages = Math.ceil(activeExpeditions.length / 4);
        return (prev + 1) % totalPages;
      });
    }, 7000); // 7 segundos de exibição por página

    return () => clearInterval(interval);
  }, [autoScroll, activeExpeditions, viewMode]);

  // Objeto do entregador selecionado no momento
  const activeDriver = useMemo(() => {
    if (!activeEntregadorId) return null;
    return entregadores.find(d => d.id === activeEntregadorId) || null;
  }, [entregadores, activeEntregadorId]);

  // Nome do motorista/responsável de triagem selecionado no momento (Nome e Sobrenome apenas)
  const selectedResponsibleName = useMemo(() => {
    if (!activeDriver) return 'NENHUM SELECIONADO';
    const parts = activeDriver.nome.trim().split(/\s+/);
    if (parts.length <= 2) return activeDriver.nome.toUpperCase();
    return `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase();
  }, [activeDriver]);

  // Rotas selecionadas do entregador
  const selectedDriverRoutes = useMemo(() => {
    if (activeRotaIds.length === 0) return [];
    return rotas.filter(r => activeRotaIds.includes(r.id));
  }, [rotas, activeRotaIds]);

  // Lista reversa dos itens bipados (último lido em primeiro lugar absoluto!)
  const reversedScannedItems = useMemo(() => {
    // Retorna cópia com o índice original para controle preciso
    return [...activeScannedItems].reverse().map((item, index) => {
      const originalPosition = activeScannedItems.length - index;
      const matchingEmp = empresas.find(e => e.id === item.empresaId);
      return {
        ...item,
        originalPosition,
        empresaNome: matchingEmp?.nome || 'Empresa Independente',
        empresaPrefixo: matchingEmp?.prefixos ? matchingEmp.prefixos.split(',')[0] : 'N/D'
      };
    });
  }, [activeScannedItems, empresas]);

  // Empresa ativa associada ao último item lido ou primeira empresa ativa da lista de frotas/empresas
  const activeCompany = useMemo(() => {
    if (reversedScannedItems.length > 0) {
      const latestItem = reversedScannedItems[0];
      return empresas.find(e => e.id === latestItem.empresaId) || null;
    }
    return empresas[0] || null;
  }, [reversedScannedItems, empresas]);

  const companyInitials = useMemo(() => {
    if (!activeCompany) return 'DI';
    const cleanName = activeCompany.nome.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  }, [activeCompany]);

  const partnerBadgeColor = useMemo(() => {
    if (!activeCompany) return { bg: 'from-blue-600/20 to-indigo-500/10 text-blue-400 border-blue-500/30' };
    const name = activeCompany.nome.toLowerCase();
    if (name.includes('mercado') || name.includes('livre') || name.includes('ml')) {
      return { bg: 'from-yellow-500/20 to-amber-600/10 text-yellow-500 border-yellow-500/30' };
    }
    if (name.includes('shopee') || name.includes('shpf')) {
      return { bg: 'from-orange-500/20 to-red-500/10 text-orange-500 border-orange-500/30' };
    }
    if (name.includes('shein')) {
      return { bg: 'from-pink-500/20 to-rose-500/10 text-pink-500 border-pink-500/30' };
    }
    if (name.includes('amazon')) {
      return { bg: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30' };
    }
    return { bg: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30' };
  }, [activeCompany]);

  const getDriver = (driverId: string): Entregador | undefined => {
    return entregadores.find(d => d.id === driverId);
  };

  const getRouteNames = (exp: Expedicao) => {
    const ids = exp.rotaIds || (exp.rotaId ? [exp.rotaId] : []);
    return rotas
      .filter(r => ids.includes(r.id))
      .map(r => r.nome)
      .join(' + ') || 'Carga Avulsa';
  };

  const getElapsedTime = (startTimeStr: string) => {
    const diffMs = currentTime.getTime() - new Date(startTimeStr).getTime();
    if (diffMs <= 0) return "00:00:00";
    
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Sons de bip virtual discretos
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // Audio block guard
    }
  };

  // Seletor das expedições visíveis para paginação da frota
  const visibleExpeditions = useMemo(() => {
    if (activeExpeditions.length <= 4) return activeExpeditions;
    const startIndex = pageIndex * 4;
    return activeExpeditions.slice(startIndex, startIndex + 4);
  }, [activeExpeditions, pageIndex]);

  // Escala opcional de fonte
  const scaleStyles = useMemo(() => {
    if (fontScale === 1.2) return 'scale-[1.05] origin-center';
    if (fontScale === 1.4) return 'scale-[1.10] origin-center';
    return '';
  }, [fontScale]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col font-sans overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
      id="tv-optimized-panel"
    >
      {/* HEADER ULTRA COMPACTO - Configurado sob medida para notebook e responsivo para celulares */}
      <header className={`px-4 sm:px-6 py-2.5 sm:py-3 border-b shadow-xs shrink-0 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 transition-colors ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* LOGO E SELEÇÃO DE ABAS */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 sm:p-2 bg-blue-600 rounded-xl text-white shadow-xs shrink-0">
              <Tv className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xs sm:text-sm font-black tracking-wider text-blue-500 uppercase leading-none">
                DIAMANTE LOG
              </h1>
              <span className={`text-[8px] sm:text-[9px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} block mt-0.5`}>
                Sincronizador HDMI de Triagem
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700/30 hidden sm:block"></div>

          {/* CHAVE DE ABAS PARA OPERAÇÕES */}
          <div className="flex bg-slate-800/10 border border-slate-700/15 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => {
                setViewMode('bipagem');
                playBeep();
              }}
              className={`px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-black rounded-md transition flex items-center gap-1 ${
                viewMode === 'bipagem'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scan className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              <span>Triagem</span>
            </button>
            <button
              onClick={() => {
                setViewMode('frota');
                playBeep();
              }}
              className={`px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-black rounded-md transition flex items-center gap-1 ${
                viewMode === 'frota'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              <span>Frota ({activeExpeditions.length})</span>
            </button>
          </div>
        </div>

        {/* RELÓGIO E DATA (Esconde em telas menores para dar espaço ao close) */}
        <div className="hidden lg:flex items-center space-x-4">
          <div className="text-right hidden xl:flex flex-col items-end">
            <span className={`text-[9.5px] font-black uppercase tracking-widest block ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Status do Pátio
            </span>
            <div className="flex items-center gap-1.5 mt-1 select-none">
              <span className={`h-2.5 w-2.5 rounded-full animate-pulse block shrink-0 ${
                isDark ? 'bg-emerald-500' : 'bg-emerald-650'
              }`}></span>
              <input
                type="text"
                value={patioStatus}
                onChange={(e) => setPatioStatus(e.target.value.toUpperCase())}
                placeholder="DIGITE O STATUS"
                title="Clique para clicar e editar o status do pátio"
                className={`bg-transparent border-b border-dashed outline-none text-[13px] sm:text-[14px] font-black font-mono tracking-widest w-48 sm:w-56 text-right uppercase py-0.5 px-1 leading-none transition-all duration-150 rounded ${
                  isDark 
                    ? 'text-emerald-400 border-emerald-500/20 focus:border-emerald-400/80 hover:bg-emerald-500/5 focus:bg-emerald-500/10 placeholder-emerald-600/30' 
                    : 'text-emerald-600 border-emerald-600/20 focus:border-emerald-600/80 hover:bg-emerald-650/5 focus:bg-emerald-650/10 placeholder-emerald-700/30'
                }`}
              />
            </div>
          </div>

          <div className="h-7 w-px bg-slate-700/30 hidden xl:block"></div>

          <div className="flex items-center space-x-2 bg-blue-950/40 border border-blue-900/30 px-3 py-1.5 rounded-xl text-blue-400 shrink-0">
            <Clock className="h-4 w-4 animate-spin-slow" style={{ animationDuration: '40s' }} />
            <span className="text-sm font-black font-mono tracking-widest">
              {currentTime.toLocaleTimeString('pt-BR')}
            </span>
          </div>
        </div>

        {/* CONTROLES DO OPERADOR */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Sons */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playBeep();
            }}
            className={`p-1.5 sm:p-2 rounded-lg border transition ${
              soundEnabled 
                ? 'bg-blue-600/10 border-blue-600/20 text-blue-400 hover:bg-blue-600/20' 
                : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:bg-slate-800'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          {/* Zoom Control (Esconde em telas muito pequenas) */}
          <div className="hidden sm:flex items-center bg-slate-800/30 border border-slate-700/20 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setFontScale(1)}
              className={`px-1.5 py-0.5 text-[9px] font-black rounded ${fontScale === 1 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              title="Escala Padrão"
            >
              1x
            </button>
            <button
              onClick={() => setFontScale(1.2)}
              className={`px-1.5 py-0.5 text-[9px] font-black rounded ${fontScale === 1.2 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              title="Escala 1.2x"
            >
              1.2x
            </button>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition ${
              isDark 
                ? 'bg-white text-slate-900 border-white hover:bg-slate-100' 
                : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
            }`}
          >
            {isDark ? 'Claro' : 'Escuro'}
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black transition cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL OTMIZADO CONTRA OVERFLOW (h-full flex-1) */}
      <main className={`flex-1 overflow-hidden p-4 flex flex-col justify-between ${scaleStyles} leading-normal`}>
        
        {/* ABA DE TRIPAGEM E BIPAGEM DE PACOTES (MODO DE CONTROLE PEDIDO) */}
        {viewMode === 'bipagem' && (
          <div className="flex-1 flex flex-col justify-between space-y-4 overflow-hidden">
            
            {/* BANNER REAL REALÍSTICO COM DETALHAMENTO DO BANHEIRO DE ENTRADA DO ARQUIVO ANEXADO */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4 select-none shrink-0">
              
              {/* Esquerda: Tópico de Controle */}
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 shrink-0">
                  <Scan className="h-5 w-5 text-white stroke-[2.5]" />
                </div>
                <div>
                  <h2 className={`font-black font-sans text-white uppercase block leading-tight ${
                    campanhaAtiva ? 'text-xs sm:text-sm tracking-widest text-sky-200' : 'text-xl sm:text-2xl tracking-tight'
                  }`}>
                    CONTROLE DE SAÍDA
                  </h2>
                  <span className={`text-[10px] text-blue-200/80 font-bold block ${campanhaAtiva ? '' : 'sm:text-xs'}`}>
                    BIPAGEM DE PACOTES
                  </span>
                  {!campanhaAtiva && (
                    <p className="text-xs text-blue-100/90 font-medium leading-relaxed max-w-xl mt-1">
                      Bipe consecutivamente os códigos de barras dos cartões/volumes para triagem de carregamento.
                    </p>
                  )}
                </div>
              </div>

              {/* Centro: Podium da Campanha (Caso ativa) - Ampliado para Melhor Visualização na TV */}
              {campanhaAtiva && topEntregadoresCampanha.length > 0 && (
                <div className="flex items-end gap-5 h-32 sm:h-36 select-none border-l border-white/15 pl-6 ml-4 self-center shrink-0">
                  {(() => {
                    const sortedForPodium = [];
                    // 2º Lugar (Silver)
                    if (topEntregadoresCampanha[1]) {
                      sortedForPodium.push({ 
                        item: topEntregadoresCampanha[1], 
                        rank: 2, 
                        color: 'bg-gradient-to-t from-slate-400 to-slate-200 border-t border-slate-350', 
                        heightClass: 'h-[46px] sm:h-[52px]', 
                        textColor: 'text-slate-800',
                        medalEmoji: '🥈'
                      });
                    }
                    // 1º Lugar (Gold)
                    if (topEntregadoresCampanha[0]) {
                      sortedForPodium.push({ 
                        item: topEntregadoresCampanha[0], 
                        rank: 1, 
                        color: 'bg-gradient-to-t from-amber-500 to-amber-300 border-t border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.4)]', 
                        heightClass: 'h-[64px] sm:h-[72px] ring-2 ring-amber-400/50', 
                        textColor: 'text-amber-950',
                        medalEmoji: '🏆'
                      });
                    }
                    // 3º Lugar (Bronze)
                    if (topEntregadoresCampanha[2]) {
                      sortedForPodium.push({ 
                        item: topEntregadoresCampanha[2], 
                        rank: 3, 
                        color: 'bg-gradient-to-t from-amber-750 to-amber-600 border-t border-amber-700', 
                        heightClass: 'h-[32px] sm:h-[38px]', 
                        textColor: 'text-white',
                        medalEmoji: '🥉'
                      });
                    }

                    return sortedForPodium.map(({ item, rank, color, heightClass, textColor, medalEmoji }) => {
                      const firstName = item.nome.split(' ')[0];
                      const photoSizeClass = rank === 1 ? 'w-12 h-12' : 'w-10 h-10';
                      
                      return (
                        <div key={item.id} className="flex flex-col items-center justify-end w-18 sm:w-20 shrink-0 transition-all duration-300 animate-fade-in">
                          {/* Foto e Troféu */}
                          <div className="relative mb-1.5">
                            {item.foto ? (
                              <img 
                                src={item.foto} 
                                alt={item.nome} 
                                className={`${photoSizeClass} rounded-full object-cover border-2 shadow-md ${
                                  rank === 1 ? 'border-amber-400 ring-4 ring-amber-400/40' : 'border-white/60'
                                }`}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className={`${photoSizeClass} rounded-full text-xs font-black flex items-center justify-center border-2 shadow-xs ${
                                rank === 1 ? 'bg-amber-300 text-slate-800 border-amber-450' : 'bg-blue-600 text-white border-white/60'
                              }`}>
                                {item.nome.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            
                            {/* Troféu ou Medalha */}
                            <div className="absolute -top-1.5 -right-1.5 bg-slate-900/90 rounded-full w-5 h-5 shadow-md flex items-center justify-center border border-white/80 text-[11px] leading-none">
                              {medalEmoji}
                            </div>
                          </div>

                          {/* Barra do Ranking com Porcentagem de Sucesso */}
                          <div className={`w-full ${color} rounded-t-xl flex flex-col justify-start items-center shadow-md relative ${heightClass}`}>
                            <span className={`text-[10px] sm:text-xs font-extrabold tracking-wider font-mono mt-1 ${textColor}`}>
                              {item.taxaSucesso}%
                            </span>
                          </div>

                          {/* Nome do Entregador */}
                          <span className="text-[10px] sm:text-xs font-black text-blue-50 mt-1.5 truncate max-w-full block text-center leading-none select-none" title={item.nome}>
                            {firstName}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Direita: Responsável e Lidos no Momento (Exatamente como na foto do anexo) - Deixado Bem Maior */}
              <div className="bg-blue-900/70 border-2 border-blue-500/40 rounded-2xl p-4 sm:p-5 flex items-center justify-between space-x-6 sm:space-x-8 min-w-[340px] md:min-w-[420px] max-w-full lg:max-w-lg shadow-xl ring-4 ring-blue-500/10">
                <div className="space-y-2">
                  <span className="text-[11px] sm:text-xs font-black text-blue-200 uppercase tracking-[0.15em] block">
                    LIDOS NO MOMENTO
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse block"></span>
                    <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-emerald-400 flex flex-wrap items-center gap-1.5">
                      RESPONSÁVEL:
                      <strong className="text-white bg-blue-950 border-2 border-blue-800 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl shadow-xs text-sm sm:text-base font-black tracking-widest">
                        {selectedResponsibleName}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Caixa Branca de Itens do Anexo - Bem maior e mais destacada */}
                <div className="bg-white rounded-2xl px-5 py-3 sm:px-6 sm:py-4 text-center shadow-2xl border-2 border-white shrink-0 min-w-[100px] sm:min-w-[120px] select-none flex flex-col justify-center transform hover:scale-105 transition-transform duration-150">
                  <span className="text-4xl sm:text-5xl font-black text-blue-800 font-mono tracking-tight block leading-none">
                    {activeScannedItems.length}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-black text-blue-700 tracking-[0.2em] uppercase mt-1 block leading-none">
                    ITENS
                  </span>
                </div>
              </div>

            </div>

            {/* LISTA GIGANTE DE ITENS SENDO BIPADOS (ÚLTIMO LIDO EM PRIMEIRO LUGAR ABSOLUTO) */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Esquerda: Histórico e ÚLTIMO ITEM BIPADO (Em destaque absoluto) - 8 de 12 colunas */}
              <div className={`lg:col-span-8 border rounded-2xl p-4 flex flex-col min-h-0 overflow-hidden ${
                isDark ? 'bg-slate-900/20 border-slate-800/50' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="flex justify-between items-center mb-3 shrink-0">
                  <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-700'
                  }`}>
                    <Barcode className="h-4 w-4 text-blue-500" />
                    Fluxografia de Bipagens (Nova em Cima)
                  </h3>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-600 font-bold'}`}>
                    Total de Bipes da Sessão: {activeScannedItems.length}
                  </span>
                </div>

                {reversedScannedItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                    <div className={`p-4 rounded-full border mb-3 animate-pulse ${
                      isDark ? 'bg-slate-850 border-slate-800' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <Barcode className={`h-10 w-10 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-widest mt-1 ${
                      isDark ? 'text-slate-500' : 'text-slate-700'
                    }`}>
                      Nenhum item bipado nesta sessão
                    </span>
                    <p className={`text-[10px] max-w-xs mt-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-650 font-medium'
                    }`}>
                      Insira um entregador na aba Expedição e comece a ler os códigos de barras para transmitir o feed em tempo real.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    <AnimatePresence mode="popLayout">
                      {reversedScannedItems.map((item, idx) => {
                        const isLatest = idx === 0;
                        
                        return (
                          <motion.div
                            key={`${item.codigoBarras}-${item.originalPosition}`}
                            initial={isLatest ? { scale: 0.95, y: -10, opacity: 0 } : { opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-all duration-150 ${
                              isLatest
                                ? 'bg-blue-600/95 border-blue-400 text-white shadow-md shadow-blue-900/20 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 font-bold'
                                : isDark
                                ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200'
                                : 'bg-slate-50/70 border-slate-200 hover:border-blue-300 text-slate-900 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center space-x-3.5">
                              {/* Bolinha Indicadora de Sequência */}
                              <div className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center border-2 ${
                                isLatest 
                                  ? 'bg-white text-blue-800 border-white shadow-sm'
                                  : isDark
                                  ? 'bg-slate-800 border-slate-705 text-slate-350'
                                  : 'bg-white border-slate-300 text-slate-800 shadow-3xs'
                              }`}>
                                #{item.originalPosition}
                              </div>

                              <div>
                                <span className={`block text-[8px] font-black uppercase opacity-75 tracking-widest ${
                                  isLatest ? '' : isDark ? '' : 'text-slate-500 font-extrabold'
                                }`}>
                                  {isLatest ? '🚨 ÚLTIMO ITEM COLETADO' : `VOLUME COLETADO`}
                                </span>
                                <span className={`font-mono text-[15px] font-black tracking-widest block leading-tight ${
                                  isLatest ? 'text-white' : isDark ? '' : 'text-slate-950'
                                }`}>
                                  {item.codigoBarras}
                                </span>
                              </div>
                            </div>

                            {/* Detalhes da Empresa Responsável */}
                            <div className="flex items-center space-x-3">
                              <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                                isLatest
                                  ? 'bg-blue-950/80 border-blue-400 text-blue-200'
                                  : isDark
                                  ? 'bg-slate-850 text-blue-400 border-slate-750'
                                  : 'bg-blue-50/85 border-blue-200 text-blue-800'
                              }`}>
                                <Building2 className={`h-3.5 w-3.5 shrink-0 ${
                                  isLatest ? 'text-blue-400' : isDark ? 'text-blue-400' : 'text-blue-600'
                                }`} />
                                {item.empresaNome}
                              </span>

                              <div className={`text-right font-mono text-[10px] hidden sm:block ${
                                isLatest ? 'text-blue-100' : isDark ? 'text-slate-450' : 'text-slate-700 font-bold'
                              }`}>
                                <span className="block font-black">PARCEIRO</span>
                                <span className="text-[9px] font-black">Ref: {item.empresaPrefixo}*</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Direita: Informações do Entregador e Rotas - 4 de 12 colunas */}
              <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                
                {/* Perfil do Entregador Ativo */}
                <div className={`p-4 rounded-2xl border flex-1 flex flex-col justify-between shadow-xs transition-all duration-300 ${
                  isDark ? 'bg-slate-900/40 border-slate-850' : 'bg-white border-slate-200'
                }`}>
                  <div>
                    <span className="text-[9px] font-black text-blue-500 tracking-wider block uppercase">
                      Perfil de Carregamento
                    </span>
                    <h3 className={`text-sm font-extrabold mt-0.5 uppercase tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-850'
                    }`}>
                      Entregador Selecionado
                    </h3>

                    {activeDriver ? (
                      <div className="mt-4 space-y-4">
                        
                        {/* Foto e Informações Principais do Motorista */}
                        <div className={`flex items-center justify-between gap-4 border-b pb-4 ${
                          isDark ? 'border-slate-800/15' : 'border-slate-100'
                        }`}>
                          <div className="flex items-center gap-4 min-w-0">
                            {activeDriver.foto ? (
                              <img 
                                src={activeDriver.foto} 
                                alt={activeDriver.nome} 
                                className="w-28 h-28 rounded-2xl object-cover border-2 border-blue-500/80 shadow-xl ring-4 ring-blue-500/10 shrink-0" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/15 border-2 border-blue-500/30 text-blue-400 font-black flex flex-col items-center justify-center shrink-0 shadow-inner">
                                <span className="text-3xl leading-none">
                                  {activeDriver.nome.charAt(0).toUpperCase()}
                                </span>
                                <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase mt-1">
                                  DRV
                                </span>
                              </div>
                            )}
                            
                            <div className="truncate min-w-0">
                              <span className={`text-[8px] font-bold uppercase tracking-widest block ${
                                isDark ? 'text-slate-500' : 'text-slate-600 font-extrabold'
                              }`}>
                                Nome do Responsável
                              </span>
                              <h4 className="text-sm font-black text-blue-500 tracking-tight uppercase leading-none break-words my-1">
                                {selectedResponsibleName}
                              </h4>
                              
                              {/* Placa do Veículo formatada como Placa Mercosul realista */}
                              <div className="mt-1.5 flex flex-col items-start gap-1">
                                {activeDriver.placaVeiculo ? (
                                  <div className="bg-white border-2 border-blue-700 rounded px-2 py-0.5 text-slate-950 font-mono text-[11px] font-black shadow-xs flex items-center gap-1.5 leading-none">
                                    <span className="text-[7px] text-blue-800 font-sans tracking-tight block border-r border-slate-300 pr-1.5 leading-none font-black">BRASIL</span>
                                    {activeDriver.placaVeiculo.toUpperCase()}
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/15 leading-none">
                                    Sem Placa
                                  </span>
                                )}
                                <span className={`text-[8px] font-bold uppercase tracking-widest block leading-none mt-0.5 ${
                                  isDark ? 'text-slate-500' : 'text-slate-600 font-black'
                                }`}>
                                  VEÍCULO
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quadrado da Logo e Nome da Empresa Parceira - Transparent, clean and larger logo */}
                          <div className="flex flex-col items-center justify-center text-center shrink-0 w-40 select-none mr-2">
                            <div className="w-28 h-28 rounded-2xl bg-white flex items-center justify-center shadow-xl p-4 shrink-0 mb-2.5 ring-4 ring-blue-500/10">
                              <DiamondLogo className="h-20 w-20" />
                            </div>
                            <span className="text-[10px] font-black text-blue-500 tracking-wider block uppercase leading-none">DIAMANTE</span>
                            <span className={`text-[14px] font-black uppercase tracking-widest block leading-none mt-1.5 ${
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }`}>
                              LOG
                            </span>
                          </div>
                        </div>

                        {/* Rotas Selecionadas pra entrega dele */}
                        <div className="space-y-1.5 text-left">
                          <span className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${
                            isDark ? 'text-slate-400' : 'text-slate-700'
                          }`}>
                            Roteirização Vinculada ({selectedDriverRoutes.length})
                          </span>
                          
                          {selectedDriverRoutes.length === 0 ? (
                            <div className={`p-3 border rounded-xl text-center ${
                              isDark ? 'bg-slate-805/20 border-slate-800/40 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 font-bold'
                            }`}>
                              <p className="text-[9px]">
                                Nenhuma rota selecionada no painel de expedição.
                              </p>
                            </div>
                          ) : (
                            <div className="max-h-[135px] overflow-y-auto space-y-1 pr-1">
                              {selectedDriverRoutes.map(rota => (
                                <div 
                                  key={rota.id}
                                  className={`flex items-center justify-between p-2 rounded-xl border transition duration-150 ${
                                    isDark
                                      ? 'bg-blue-600/5 hover:bg-blue-600/10 border-blue-500/10 text-slate-300'
                                      : 'bg-blue-50/50 hover:bg-blue-50 border-blue-100 text-slate-850 font-bold shadow-3xs'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <div className={`p-1 rounded-lg shrink-0 ${
                                      isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-600 text-white shadow-xs'
                                    }`}>
                                      <MapPin className="h-3 w-3" />
                                    </div>
                                    <span className={`text-xs font-bold truncate ${
                                      isDark ? 'text-slate-300' : 'text-slate-900'
                                    }`}>
                                      {rota.nome}
                                    </span>
                                  </div>
                                  {rota.cidades && (
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-mono uppercase tracking-wide border ${
                                      isDark 
                                        ? 'bg-slate-800 text-slate-400 border-slate-750' 
                                        : 'bg-white text-slate-700 border-slate-200 font-bold'
                                    }`}>
                                      {rota.cidades.split(',')[0]}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-center p-6 space-y-3">
                        <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-full text-blue-500 animate-pulse">
                          <User className="h-6 w-6" />
                        </div>
                        <p className={`text-[10px] font-bold max-w-xs leading-relaxed ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          Aguardando seleção de um motorista na aba de expedição para transmitir os dados em tempo real.
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Atividade de Logística e status do pátio */}
                  <div className={`p-2.5 rounded-xl border mt-3 ${
                    isDark ? 'bg-slate-950/40 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700'
                  } flex items-center justify-between text-[10px]`}>
                    <span className="font-bold uppercase tracking-wider text-[8px]">Status HDMI Link</span>
                    <span className={`font-black font-mono tracking-widest flex items-center gap-1 text-[9px] ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      CONECTADO
                    </span>
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

        {/* ABA DE FROTA EM ROTA / VEÍCULOS EM OPERAÇÃO EXTERNA (LAYOUT SEGUNDO MODO) */}
        {viewMode === 'frota' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
            
            {/* Esquerda: Métricas compactas - 5 Colunas */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              
              <div className={`p-4 rounded-2xl border flex-1 flex flex-col justify-between shadow-xs ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <span className="text-[9px] font-black tracking-widest text-blue-500 uppercase block">INDICADORES DE FLUXO</span>
                  <h2 className={`text-md font-extrabold pb-2 border-b mt-0.5 ${
                    isDark ? 'border-slate-800/20 text-slate-100' : 'border-slate-100 text-slate-850'
                  }`}>Operações Ativas de Entrega</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 my-2">
                  <div className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20">
                    <span className={`text-[8px] font-black uppercase tracking-wider block ${isDark ? 'text-blue-400' : 'text-blue-750'}`}>Veículos em Rota</span>
                    <span className={`text-3xl font-black mt-1 font-mono block leading-none ${isDark ? 'text-blue-500' : 'text-blue-800'}`}>
                      {generalStats.activeVehicles}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className={`text-[8px] font-black uppercase tracking-wider block ${isDark ? 'text-amber-400' : 'text-amber-750'}`}>Volumes de Carga</span>
                    <span className={`text-3xl font-black mt-1 font-mono block leading-none ${isDark ? 'text-amber-500' : 'text-amber-800'}`}>
                      {generalStats.activePacks}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className={`text-[8px] font-black uppercase tracking-wider block ${isDark ? 'text-emerald-400' : 'text-emerald-750'}`}>Entregas Liquidadas</span>
                    <span className={`text-3xl font-black mt-1 font-mono block leading-none ${isDark ? 'text-emerald-500' : 'text-emerald-800'}`}>
                      {generalStats.deliveredPacks}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className={`text-[8px] font-black uppercase tracking-wider block ${isDark ? 'text-rose-400' : 'text-rose-750'}`}>Devoluções de Hoje</span>
                    <span className={`text-3xl font-black mt-1 font-mono block leading-none ${isDark ? 'text-rose-500' : 'text-rose-800'}`}>
                      {generalStats.returnedPacks}
                    </span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  isDark ? 'bg-slate-950/80 border-slate-850' : 'bg-slate-100 border-slate-150'
                }`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-[10px] font-black uppercase ${isDark ? 'text-slate-350' : 'text-slate-700'}`}>Eficiência das Baixas</span>
                    <span className={`text-sm font-black font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{generalStats.successRate}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${generalStats.successRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Caixa informativa sobre retorno de campo */}
              <div className={`p-3 rounded-2xl flex items-center space-x-3 text-[10px] font-bold border ${
                isDark 
                  ? 'bg-amber-500/5 border-amber-500/10 text-amber-500' 
                  : 'bg-amber-50 border-amber-200 text-amber-850 shadow-3xs'
              }`}>
                <AlertTriangle className={`h-5 w-5 shrink-0 ${isDark ? 'text-amber-500' : 'text-amber-600'}`} />
                <p>Verifique se as placas e CNH dos motoristas selecionados em rota estão devidamente atualizados no cadastro.</p>
              </div>

            </div>

            {/* Direita: Listagem de motoristas em rota de entrega - 7 Colunas */}
            <div className={`lg:col-span-7 p-4 rounded-2xl border flex flex-col min-h-0 overflow-hidden ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b mb-3 shrink-0 ${
                isDark ? 'border-slate-850' : 'border-slate-100'
              }`}>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className={`font-extrabold text-sm flex items-center gap-1.5 ${
                    isDark ? 'text-slate-200' : 'text-slate-850'
                  }`}>
                    <Truck className="h-4 w-4 text-blue-500" />
                    Frota em Trânsito ({activeExpeditions.length})
                  </h3>

                  {/* Filtro de Filial no Painel do Modo TV */}
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <select
                      id="select-filial-tv-frota"
                      value={selectedFilialId}
                      onChange={(e) => {
                        setSelectedFilialId(e.target.value);
                        setPageIndex(0); // Reset page selection
                      }}
                      className={`pl-7 pr-8 py-1.5 text-[10px] rounded-lg border font-black uppercase appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-slate-350 hover:text-slate-200' 
                          : 'bg-slate-50 border-slate-250 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {(currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') && (
                        <option value="all">TODAS FILIAIS</option>
                      )}
                      {userPermittedFiliais.map(f => (
                        <option key={f.id} value={f.id}>{f.nome.toUpperCase()}</option>
                      ))}
                      {userPermittedFiliais.length === 0 && (
                        <option value="" disabled>SEM FILIAL AUTORIZADA</option>
                      )}
                    </select>
                    <div className="absolute right-2.5 top-3 pointer-events-none border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-400 w-0 h-0"></div>
                  </div>
                </div>

                {activeExpeditions.length > 4 && (
                  <div className={`flex items-center space-x-2 border px-2 py-1 rounded ${
                    isDark ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50 border-slate-150'
                  }`}>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Pág. {pageIndex + 1}</span>
                    <button 
                      onClick={() => setAutoScroll(!autoScroll)}
                      className="text-[8px] bg-blue-600 text-white px-1 rounded font-black hover:bg-blue-700 transition cursor-pointer"
                    >
                      {autoScroll ? 'Pausar' : 'Girar'}
                    </button>
                  </div>
                )}
              </div>

              {activeExpeditions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <Truck className="h-10 w-10 text-slate-700 opacity-40 mb-2" />
                  <h4 className="text-xs font-black text-slate-500 uppercase">PÁTIO INTEGRALMENTE CONCLUÍDO</h4>
                  <p className="text-[10px] text-slate-450 max-w-xs mt-1">Nenhum motorista está com carga ativa nas ruas neste momento.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" ref={scrollContainerRef}>
                  <AnimatePresence mode="popLayout">
                    {visibleExpeditions.map((exp) => {
                      const driver = getDriver(exp.entregadorId);
                      return (
                        <motion.div
                          key={exp.id}
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            isDark ? 'bg-slate-950/70 border-slate-850' : 'bg-slate-50 border-slate-150'
                          }`}
                        >
                          <div className="flex items-center space-x-3 truncate">
                            {driver?.foto ? (
                              <img src={driver.foto} alt={driver.nome} className="w-10 h-10 rounded-full object-cover border border-blue-500 shrink-0" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-900 border border-blue-400 font-extrabold flex items-center justify-center text-xs shrink-0 font-sans shadow-3xs">
                                {driver?.nome.substring(0, 2).toUpperCase() || 'DR'}
                              </div>
                            )}

                            <div className="truncate">
                              <h4 className={`font-extrabold text-xs truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{driver?.nome}</h4>
                              <p className={`text-[10px] flex items-center gap-1 mt-0.5 truncate ${
                                isDark ? 'text-slate-400' : 'text-slate-600 font-bold'
                              }`}>
                                <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                                {getRouteNames(exp)}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px]">
                                {driver?.placaVeiculo ? (
                                  <span className={`border px-1 rounded font-bold uppercase ${
                                    isDark ? 'bg-slate-800 text-slate-300 border-slate-750' : 'bg-white text-slate-700 border-slate-250'
                                  }`}>
                                    🚙 PLACA: {driver.placaVeiculo}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Sem Placa</span>
                                )}
                                <span className={`border px-1.5 py-0.2 rounded font-black font-sans uppercase ${
                                  isDark ? 'bg-blue-950 border-blue-900 text-blue-400' : 'bg-blue-100 border-blue-200 text-blue-800 font-bold'
                                }`}>
                                  {exp.itens.length} pct
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[8px] font-bold text-slate-500 uppercase block">Tempo em Rota</span>
                            <span className={`text-md font-black font-mono block mt-0.5 tracking-wider ${
                              isDark ? 'text-emerald-400' : 'text-emerald-600'
                            }`}>
                              {getElapsedTime(exp.dataHoraSaida)}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

          </div>
        )}

        {/* RODAPÉ ULTRA DISCRETO CONGRUENTE COM O SISTEMA */}
        <footer className={`mt-3 py-1.5 border-t text-[10px] flex items-center justify-between text-slate-500 ${
          isDark ? 'border-slate-850' : 'border-slate-200'
        }`}>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-ping"></span>
            DIAMANTELOG-TV_DASHBOARD v2.5 • Conectado via HDMI Link
          </span>
          <span className="font-mono">Logística no notebook em tela cheia</span>
        </footer>

      {/* Botão de Fechar Flutuante para Dispositivos Móveis e Tablets para garantir visibilidade absoluta */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={onClose}
          className="flex items-center justify-center h-12 w-12 bg-rose-600 hover:bg-rose-750 active:scale-95 text-white rounded-full shadow-2xl transition-all cursor-pointer border-2 border-white/20 select-none"
          title="Voltar para as abas de saída"
        >
          <ArrowLeft className="h-6 w-6 stroke-[2.5]" />
        </button>
      </div>

      </main>

    </div>
  );
}
