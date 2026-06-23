/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderSync, 
  Download,
  LayoutDashboard, 
  Scan, 
  RotateCcw, 
  UserPlus, 
  Receipt, 
  BarChart3, 
  MapPin, 
  Truck,
  Activity,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
  AlertCircle,
  Menu,
  X,
  Tv,
  Camera,
  Trash2,
  Upload,
  ClipboardList,
  AlertTriangle,
  Package,
  RefreshCcw,
  FileDown,
  FileUp,
  Database,
  Smartphone,
  QrCode,
  Copy,
  Check,
  Laptop
} from 'lucide-react';

import { Empresa, Entregador, Expedicao, Pacote, Rota, User, UserPermissions, Filial, ItemEstoque, MovimentacaoEstoque, ItemLixeira, Vale, ReciboPagamento, ConciliacaoDiaria, MOTIVOS_PADRAO, TransferenciaPacote, RetiradaPacote } from './types';
import { INITIAL_EMPRESAS, INITIAL_ENTREGADORES, INITIAL_ROTAS, INITIAL_FILIAIS, getHistoricalExpeditions } from './data/mockData';

import { db, handleFirestoreError, OperationType, auth, cleanUndefined, syncAllTablesForce, getDocFromServer, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch, query, where, hasFirebasePermissionError } from './lib/supabase';

// Importando as sub-views modulares carregadas de craft
import DashboardView from './components/DashboardView';
import ExpedicaoView from './components/ExpedicaoView';
import BaixaView from './components/BaixaView';
import CadastroView from './components/CadastroView';
import FolhaSalarialView from './components/FolhaSalarialView';
import RelatoriosView from './components/RelatoriosView';
import EmRotaView from './components/EmRotaView';
import TvPainelView from './components/TvPainelView';
import LoginView from './components/LoginView';
import EstoqueView from './components/EstoqueView';
import LixeiraModal from './components/LixeiraModal';
import PacotesView from './components/PacotesView';

const DiamondLogo = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Pavilion (Bottom part) */}
    <polygon points="4,32 30,32 50,88" fill="#0c4ca3" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="30,32 50,32 50,88" fill="#1e73be" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="50,32 70,32 50,88" fill="#1e73be" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="70,32 96,32 50,88" fill="#0c4ca3" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    
    {/* Crown (Top part) */}
    <polygon points="4,32 30,32 20,12" fill="#3389db" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="30,32 50,32 50,12" fill="#58a0e5" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="30,32 50,12 20,12" fill="#4fa0ec" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    
    <polygon points="70,32 50,32 50,12" fill="#58a0e5" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="70,32 50,12 80,12" fill="#4fa0ec" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
    <polygon points="96,32 70,32 80,12" fill="#3389db" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const persisted = localStorage.getItem('logi_activeTab');
      if (persisted) return persisted;
    } catch (_) {}
    return 'expedicao';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [selectedEntregadorIdForBaixa, setSelectedEntregadorIdForBaixa] = useState<string>('');
  const [isTvMode, setIsTvMode] = useState<boolean>(false);

  // ==========================================
  // ESTADOS DE AUTENTICAÇÃO E USUÁRIOS
  // ==========================================
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Clear legacy localStorage cache to enforce security
    try {
      localStorage.removeItem('logi_currentUser');
    } catch (e) {
      console.warn("Storage access warning:", e);
    }
    
    // Verificar se a navegação é uma atualização de tela (F5) ou se possui o parâmetro de cache buster (?cb=...)
    let isReload = false;
    try {
      if (window.location.search.includes('cb=')) {
        isReload = true;
      } else {
        const navs = performance.getEntriesByType('navigation');
        if (navs && navs.length > 0) {
          isReload = (navs[0] as PerformanceNavigationTiming).type === 'reload';
        } else {
          isReload = performance.navigation?.type === 1; // Fallback legacy TYPE_RELOAD
        }
      }
    } catch (_) {}

    // Se NÃO for recarregamento voluntário (F5), mas sim abertura de histórico, novo link, voltar/avançar,
    // limpamos a sessão por segurança, obrigando o usuário a informar o login/senha de acesso.
    if (!isReload) {
      try {
        sessionStorage.removeItem('logi_currentUser');
      } catch (_) {}
      return null;
    }

    try {
      const saved = sessionStorage.getItem('logi_currentUser');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.isMaster || parsed.id === 'usr-master' || parsed.username === 'master')) {
          parsed.passwordHash = 'dlog1a2b3c';
          parsed.isMaster = true;
          parsed.permissions = {
            dashboard: true,
            dashboard_readonly: false,
            expedicao: true,
            expedicao_readonly: false,
            baixas: true,
            baixas_readonly: false,
            emRota: true,
            emRota_readonly: false,
            cadastro: true,
            cadastro_readonly: false,
            folha: true,
            folha_readonly: false,
            relatorios: true,
            relatorios_readonly: false,
            tvPainel: true,
            tvPainel_readonly: false
          };
        }
        return parsed;
      }
    } catch (e) {
      console.warn("Storage access warning:", e);
    }
    return null;
  });

  // ==========================================
  // SISTEMA DE CORREÇÃO DE CACHE PARA O CHROME (F5 / Hard Reload)
  // ==========================================
  useEffect(() => {
    // 1. Limpa o Cache Storage na inicialização para carregar arquivos limpos
    const cleanCacheStorage = async () => {
      try {
        if ('caches' in window) {
          const keys = await window.caches.keys();
          for (const key of keys) {
            await window.caches.delete(key);
          }
          console.log('Cache Storage limpo com sucesso na inicialização.');
        }
      } catch (err) {
        console.warn('Erro ao limpar Cache Storage na inicialização:', err);
      }
    };
    cleanCacheStorage();

    // 2. Intercepta teclas F5, Ctrl+R e Cmd+R para fazer uma limpeza profunda e forçar hard reload
    const handleRefreshKeys = async (e: KeyboardEvent) => {
      const isF5 = e.key === 'F5';
      const isCtrlR = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r';

      if (isF5 || isCtrlR) {
        e.preventDefault(); // Impede o reload simples e cacheado do Chrome
        console.log('Intercepção de recarregamento detectada. Limpando cache e forçando atualização...');

        try {
          if ('caches' in window) {
            const keys = await window.caches.keys();
            for (const key of keys) {
              await window.caches.delete(key);
            }
          }
        } catch (_) {}

        // Executa o recarregamento anexando um parâmetro de data (cache buster) para obrigar o Chrome a ignorar o cache físico
        const urlObj = new URL(window.location.href);
        urlObj.searchParams.set('cb', Date.now().toString());
        window.location.replace(urlObj.toString());
      }
    };

    window.addEventListener('keydown', handleRefreshKeys);
    return () => {
      window.removeEventListener('keydown', handleRefreshKeys);
    };
  }, []);

  // ==========================================
  // CONEXÕES SIMULTÂNEAS: DESATIVADO
  // ==========================================

  const [backupHistory, setBackupHistory] = useState<any>(undefined);
  const [isBackupLoading, setIsBackupLoading] = useState<boolean>(false);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const profilePhotoInputRef = React.useRef<HTMLInputElement>(null);
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'DIAMANTE LOG';
    try {
      localStorage.setItem('logi_activeTab', activeTab);
    } catch (_) {}
  }, [activeTab]);

  // Desativa de forma agressiva e em tempo real sugestões de preenchimento/autocomplete do navegador
  useEffect(() => {
    const disableAutocomplete = () => {
      // Inputs normais
      const inputs = document.querySelectorAll(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="range"])'
      );
      
      inputs.forEach(el => {
        const input = el as HTMLInputElement;
        
        // Verifica se o campo deve ser ignorado por ser desabilitado ou readonly nativo de nível de aplicativo
        if (input.hasAttribute('disabled') || (input.hasAttribute('readonly') && input.getAttribute('data-ac-managed') !== 'true')) {
          input.setAttribute('data-ac-managed', 'skip');
          return;
        }
        
        if (input.getAttribute('data-ac-managed') === 'skip') {
          return;
        }

        // Garante autocomplete="new-password" para bloquear sugestões de texto e senhas
        if (input.getAttribute('autocomplete') !== 'new-password') {
          input.setAttribute('autocomplete', 'new-password');
        }

        // Atributos de saneamento adicionais contra palpites do corretor do navegador
        if (!input.hasAttribute('autocorrect')) input.setAttribute('autocorrect', 'off');
        if (!input.hasAttribute('spellcheck')) input.setAttribute('spellcheck', 'false');

        if (!input.hasAttribute('data-ac-managed')) {
          input.setAttribute('data-ac-managed', 'true');

          // Se não estiver em foco no momento, torna-o temporariamente readonly para enganar o autofill do Chrome
          if (document.activeElement !== input) {
            input.setAttribute('readonly', 'readonly');
          }

          const makeWritable = () => {
            if (input.getAttribute('data-ac-managed') === 'true') {
              input.removeAttribute('readonly');
            }
          };

          input.addEventListener('focus', makeWritable);
          input.addEventListener('mousedown', makeWritable);
          input.addEventListener('touchstart', makeWritable);

          input.addEventListener('blur', () => {
            setTimeout(() => {
              if (document.activeElement !== input && input.getAttribute('data-ac-managed') === 'true') {
                input.setAttribute('readonly', 'readonly');
              }
            }, 120);
          });
        } else {
          // Se já é gerenciado, sincroniza de acordo com o foco atual
          if (document.activeElement !== input) {
            if (!input.hasAttribute('readonly')) {
              input.setAttribute('readonly', 'readonly');
            }
          } else {
            input.removeAttribute('readonly');
          }
        }
      });
      
      // Selects
      const selects = document.querySelectorAll('select');
      selects.forEach(select => {
        if (!select.hasAttribute('autocomplete') || select.getAttribute('autocomplete') !== 'off') {
          select.setAttribute('autocomplete', 'off');
        }
      });

      // Forms
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        if (!form.hasAttribute('autocomplete') || form.getAttribute('autocomplete') !== 'off') {
          form.setAttribute('autocomplete', 'off');
        }
      });
    };

    disableAutocomplete();

    // Registra listeners para eventos de foco e clique globais adicionais, garantindo processamento rápido
    document.addEventListener('focusin', disableAutocomplete);
    document.addEventListener('click', disableAutocomplete);

    // Monitora modificações na página (para abas que carregam dinamicamente novos campos, novos modais, etc)
    const observer = new MutationObserver(() => {
      disableAutocomplete();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', disableAutocomplete);
      document.removeEventListener('click', disableAutocomplete);
    };
  }, []);

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem selecionada é muito grande! Escolha uma imagem de até 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // 1. Atualizar no Firestore
          const updatedUser = { ...currentUser!, foto: reader.result as string };
          setDoc(doc(db, 'users', updatedUser.id), updatedUser).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${updatedUser.id}`));
          
          // 2. Atualiza o estado e SessionStorage do usuário logado de forma instantânea
          setCurrentUser(updatedUser);
          try {
            sessionStorage.setItem('logi_currentUser', JSON.stringify(updatedUser));
          } catch (_) {}
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfilePhoto = () => {
    if (!currentUser) return;
    if (confirm("Deseja realmente remover a sua foto de perfil e usar o avatar de iniciais padrão?")) {
      const updatedUser = { ...currentUser };
      delete updatedUser.foto;
      setDoc(doc(db, 'users', updatedUser.id), updatedUser).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${updatedUser.id}`));
      
      setCurrentUser(updatedUser);
      try {
        sessionStorage.setItem('logi_currentUser', JSON.stringify(updatedUser));
      } catch (_) {}
    }
  };

  // ==========================================
  // LÓGICA E CONTROLE DE BACKUP & RESTAURAÇÃO (MASTER ONLY)
  // Sistema de Backup Diário Rotativo de 7 Dias garantindo zero perda e zero lixo no Cloud D1
  // ==========================================
  const DAYS_OF_WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  const triggerDatabaseBackup = async (auto = false) => {
    setIsBackupLoading(true);
    try {
      // Compilar o backup diretamente do estado em tempo real sincronizado de forma instantânea
      const collections: Record<string, any[]> = {
        filiais,
        empresas,
        entregadores,
        expedicoes,
        rotas,
        estoque,
        movimentacoes_estoque: movimentacoesEstoque,
        lixeira,
        vales,
        recibos_pagamento: recibos,
        conciliacoes_diarias: conciliacoesDiarias,
        transferencias_pacotes: transferencias,
        retiradas_pacotes: retiradas,
        users
      };
      
      // Manter configs do backup limpa (remover qualquer histórico anterior do payload backup para peso ideal)
      const cleanCollections = { ...collections };
      if (cleanCollections.configs) {
        cleanCollections.configs = cleanCollections.configs.filter(
          (c: any) => c.id && c.id !== 'backup_history' && !c.id.startsWith('backup_data_')
        );
      }

      const currentDayName = DAYS_OF_WEEK[new Date().getDay()];

      // 1. Salvar o backup físico em documento individual isolado por dia da semana
      const backupDataDoc = doc(db, 'configs', `backup_data_${currentDayName}`);
      await setDoc(backupDataDoc, {
        id: `backup_data_${currentDayName}`,
        data: JSON.stringify(cleanCollections)
      });

      // 2. Atualizar o índice central leve contendo os timestamps de cada dia
      const existingBackups = backupHistory?.backups || [];
      const updatedBackups = [
        ...existingBackups.filter((b: any) => b.dayName !== currentDayName),
        {
          dayName: currentDayName,
          lastBackupTime: new Date().toISOString(),
          auto
        }
      ];
      updatedBackups.sort((a: any, b: any) => new Date(b.lastBackupTime).getTime() - new Date(a.lastBackupTime).getTime());

      const backupIndexObj = {
        id: 'backup_history',
        lastBackupTime: new Date().toISOString(),
        auto,
        backups: updatedBackups
      };

      await setDoc(doc(db, 'configs', 'backup_history'), backupIndexObj);
      setIsBackupLoading(false);
      return backupIndexObj;
    } catch (err) {
      setIsBackupLoading(false);
      console.error("Erro ao gerar backup de segurança:", err);
      throw err;
    }
  };

  const restoreDatabaseFromBackup = async (backupDataString: string) => {
    setIsBackupLoading(true);
    try {
      const collectionsToRestore = JSON.parse(backupDataString);
      
      const tables = [
        'filiais', 'empresas', 'entregadores', 'rotas', 'users', 'estoque', 
        'movimentacoes_estoque', 'lixeira', 'vales', 'recibos_pagamento', 
        'conciliacoes_diarias', 'configs', 'pacotes_cadastrados', 
        'transferencias_pacotes', 'retiradas_pacotes'
      ];

      // Compilar a tabela de coleções existentes no estado
      const currentDB: Record<string, any[]> = {
        filiais,
        empresas,
        entregadores,
        expedicoes,
        rotas,
        estoque,
        movimentacoes_estoque: movimentacoesEstoque,
        lixeira,
        vales,
        recibos_pagamento: recibos,
        conciliacoes_diarias: conciliacoesDiarias,
        transferencias_pacotes: transferencias,
        retiradas_pacotes: retiradas,
        users
      };

      const batch = writeBatch();
      
      // 1. Limpar registros obsoletos (preservando backups vigentes de outros dias!)
      Object.keys(currentDB).forEach(colName => {
        if (!tables.includes(colName)) return;
        const items = currentDB[colName] || [];
        items.forEach((item: any) => {
          if (colName === 'configs' && item.id && (item.id === 'backup_history' || item.id.startsWith('backup_data_'))) return;
          const docId = item.id || (item.codigoBarras ? `${item.codigoBarras}_${item.filialId || ''}` : '');
          if (docId) {
            batch.delete(doc(db, colName, docId));
          }
        });
      });

      // 2. Injetar todos os dados do Backup restaurado
      Object.keys(collectionsToRestore).forEach(colName => {
        if (!tables.includes(colName)) return;
        const items = collectionsToRestore[colName] || [];
        items.forEach((item: any) => {
          const docId = item.id || item.codigoBarras;
          if (docId) {
            batch.set(doc(db, colName, docId), item);
          }
        });
      });

      await batch.commit();
      setIsBackupLoading(false);
      return true;
    } catch (err) {
      setIsBackupLoading(false);
      console.error("Falha ao restaurar dados do backup:", err);
      throw err;
    }
  };

  const restoreDatabaseFromBackupSlot = async (dayName: string) => {
    setIsBackupLoading(true);
    try {
      const backupDocRef = doc(db, 'configs', `backup_data_${dayName}`);
      const snapshot = await getDocFromServer(backupDocRef);
      if (!snapshot.exists() || !snapshot.data()?.data) {
        throw new Error(`Dados do backup correspondente a ${dayName} não localizados.`);
      }
      const backupObj = snapshot.data();
      const success = await restoreDatabaseFromBackup(backupObj.data);
      return success;
    } catch (err) {
      setIsBackupLoading(false);
      console.error(`Erro ao restaurar backup rotativo (${dayName}):`, err);
      throw err;
    }
  };

  useEffect(() => {
    if (currentUser?.isMaster && backupHistory !== undefined) {
      if (backupHistory === null) {
        console.log("Inicializando o primeiro backup automático do sistema...");
        triggerDatabaseBackup(true).catch(console.error);
      } else if (backupHistory.lastBackupTime) {
        const lastDate = new Date(backupHistory.lastBackupTime);
        const diffTime = Math.abs(Date.now() - lastDate.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays >= 1) {
          console.log(`Iniciando auto-backup diário periódico: ${diffDays.toFixed(1)} dias desde o último.`);
          triggerDatabaseBackup(true).catch(console.error);
        }
      }
    }
  }, [currentUser, backupHistory]);

  const downloadBackupJSON = async () => {
    setIsBackupLoading(true);
    try {
      const collections: Record<string, any[]> = {
        filiais,
        empresas,
        entregadores,
        expedicoes,
        rotas,
        estoque,
        movimentacoes_estoque: movimentacoesEstoque,
        lixeira,
        vales,
        recibos_pagamento: recibos,
        conciliacoes_diarias: conciliacoesDiarias,
        transferencias_pacotes: transferencias,
        retiradas_pacotes: retiradas,
        users
      };
      
      const cleanCollections = { ...collections };
      const rawJSON = JSON.stringify(cleanCollections, null, 2);
      const blob = new Blob([rawJSON], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      downloadAnchor.download = `expedlog_backup_${timestamp}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Falha ao gerar o arquivo de backup para download.");
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!confirm("Isso irá apagar os dados atuais do banco de dados e restaurar o arquivo selecionado. Deseja continuar?")) {
        e.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error("Formato de arquivo inválido.");
          }
          
          await restoreDatabaseFromBackup(content);
          alert("Backup local restaurado e sincronizado com sucesso absoluto!");
        } catch (err) {
          alert("Ocorreu um erro ao processar o arquivo de backup. Verifique se o JSON é válido.");
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  const [users, setUsers] = useState<User[]>([]);

  // ==========================================
  // ESTADOS DAS ENTIDADES PRINCIPAIS (DURÁVEIS)
  // ==========================================
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [expedicoes, setExpedicoes] = useState<Expedicao[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);

  // Estados de Estoque e Movimentação (Rastreabilidade)
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [movimentacoesEstoque, setMovimentacoesEstoque] = useState<MovimentacaoEstoque[]>([]);

  // Lixeira do Sistema para Exclusão Segura com Período de Recuperação
  const [lixeira, setLixeira] = useState<ItemLixeira[]>([]);
  const [vales, setVales] = useState<Vale[]>([]);
  const [recibos, setRecibos] = useState<ReciboPagamento[]>([]);
  const [conciliacoesDiarias, setConciliacoesDiarias] = useState<ConciliacaoDiaria[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaPacote[]>([]);
  const [retiradas, setRetiradas] = useState<RetiradaPacote[]>([]);
  const [motivosDevolucao, setMotivosDevolucao] = useState<string[]>(MOTIVOS_PADRAO);
  const [campanhaAtiva, setCampanhaAtiva] = useState<boolean>(false);
  const [isTrashOpen, setIsTrashOpen] = useState<boolean>(false);
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStep, setImportStep] = useState<string>('');
  const [pendingBackupData, setPendingBackupData] = useState<any | null>(null);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Garantir que as permissões do usuário logado estejam sempre preenchidas em tempo de execução para evitar tela em branco (null dereference)
  if (currentUser && (!currentUser.permissions || typeof currentUser.permissions !== 'object')) {
    currentUser.permissions = {
      dashboard: true,
      dashboard_readonly: false,
      expedicao: true,
      expedicao_readonly: false,
      baixas: true,
      baixas_readonly: false,
      emRota: true,
      emRota_readonly: false,
      cadastro: true,
      cadastro_readonly: false,
      folha: false,
      folha_readonly: true,
      relatorios: false,
      relatorios_readonly: true,
      tvPainel: true,
      tvPainel_readonly: false,
      estoque: true
    };
  }

  useEffect(() => {
    const handleBeforePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforePrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
    };
  }, []);

  const syncLixeira = async (updatedList: ItemLixeira[]) => {
    try {
      // Find items in updatedList that are NOT in local lixeira state (needs to be created/updated)
      const toWrite = updatedList.filter(item => !lixeira.some(x => x.id === item.id));
      for (const item of toWrite) {
        await setDoc(doc(db, 'lixeira', item.id), cleanUndefined(item));
      }
      // Find items in local lixeira state that are NOT in updatedList (needs to be deleted)
      const toDelete = lixeira.filter(item => !updatedList.some(x => x.id === item.id));
      for (const item of toDelete) {
        await deleteDoc(doc(db, 'lixeira', item.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'lixeira');
    }
  };

  // Carregar dados iniciais do Firebase / Firestore em tempo real
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Por favor, verifique a sua configuração do Firebase.");
        }
      }
    };
    testConnection();

    // Purga automática removida por segurança para evitar qualquer exclusão não solicitada de dados cadastrados.

    // 1. Sincronização de Filiais
    const unsubFiliais = onSnapshot(collection(db, 'filiais'), (snapshot) => {
      const list: Filial[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Filial));
      setFiliais(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'filiais'));

    // 2. Sincronização de Empresas
    const unsubEmpresas = onSnapshot(collection(db, 'empresas'), (snapshot) => {
      const list: Empresa[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Empresa));
      setEmpresas(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'empresas'));

    // 3. Sincronização de Entregadores
    const unsubEntregadores = onSnapshot(collection(db, 'entregadores'), (snapshot) => {
      const list: Entregador[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Entregador));
      setEntregadores(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'entregadores'));

    // 4. Sincronização de Rotas
    const unsubRotas = onSnapshot(collection(db, 'rotas'), (snapshot) => {
      const list: Rota[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Rota));
      setRotas(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'rotas'));

    // 5. Sincronização de Expedições
    const unsubExpedicoes = onSnapshot(collection(db, 'expedicoes'), (snapshot) => {
      const list: Expedicao[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Expedicao));
      list.sort((a, b) => new Date(b.dataHoraSaida).getTime() - new Date(a.dataHoraSaida).getTime());
      setExpedicoes(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'expedicoes'));

    // 6. Sincronização de Usuários
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: User[] = [];
      snapshot.forEach(doc => list.push(doc.data() as User));
      
      const configuredMaster: User = {
        id: 'usr-master',
        username: 'master',
        nomeCompleto: 'Administrador Master',
        email: 'diamantelogsystem@gmail.com',
        palavraChave: 'master',
        passwordHash: 'dlog1a2b3c',
        isMaster: true,
        permissions: {
          dashboard: true,
          dashboard_readonly: false,
          expedicao: true,
          expedicao_readonly: false,
          baixas: true,
          baixas_readonly: false,
          emRota: true,
          emRota_readonly: false,
          cadastro: true,
          cadastro_readonly: false,
          folha: true,
          folha_readonly: false,
          relatorios: true,
          relatorios_readonly: false,
          tvPainel: true,
          tvPainel_readonly: false
        }
      };

      if (snapshot.empty) {
        setDoc(doc(db, 'users', configuredMaster.id), configuredMaster).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${configuredMaster.id}`));
      } else {
        const masterIdx = list.findIndex(u => u.id === 'usr-master' || u.username === 'master' || u.isMaster);
        if (masterIdx > -1) {
          list[masterIdx] = {
            ...list[masterIdx],
            id: 'usr-master',
            username: 'master',
            passwordHash: 'dlog1a2b3c',
            isMaster: true,
            permissions: {
              dashboard: true,
              dashboard_readonly: false,
              expedicao: true,
              expedicao_readonly: false,
              baixas: true,
              baixas_readonly: false,
              emRota: true,
              emRota_readonly: false,
              cadastro: true,
              cadastro_readonly: false,
              folha: true,
              folha_readonly: false,
              relatorios: true,
              relatorios_readonly: false,
              tvPainel: true,
              tvPainel_readonly: false
            }
          };
        } else {
          setDoc(doc(db, 'users', configuredMaster.id), configuredMaster).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${configuredMaster.id}`));
        }
        setUsers(list);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));

    // 7. Sincronização de Estoque com autolimpeza ao virar o dia
    const unsubEstoque = onSnapshot(collection(db, 'estoque'), (snapshot) => {
      const list: ItemEstoque[] = [];
      const todayDateStr = (() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      })();

      const oldStockIds: string[] = [];

      snapshot.forEach(docSnap => {
        const item = docSnap.data() as ItemEstoque;
        if (item) {
          const itemDate = item.dataHoraAtualizacao ? item.dataHoraAtualizacao.substring(0, 10) : '';
          // Se a data do pacote no estoque é mais antiga que hoje, apaga-o
          if (itemDate && itemDate < todayDateStr) {
            oldStockIds.push(`${item.filialId}_${item.codigoBarras}`);
          } else {
            list.push(item);
          }
        }
      });

      if (oldStockIds.length > 0) {
        console.log(`[Auto-Limpeza Estoque] Removendo ${oldStockIds.length} pacotes de dias anteriores no estoque por virada de dia.`);
        const batch = writeBatch(db);
        oldStockIds.forEach(id => {
          batch.delete(doc(db, 'estoque', id));
        });
        batch.commit().catch(err => {
          console.error("Erro na auto-limpeza do estoque ao virar o dia:", err);
        });
      }

      setEstoque(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'estoque'));

    // 8. Sincronização de Movimentações de Estoque
    const unsubMovimentacoes = onSnapshot(collection(db, 'movimentacoes_estoque'), (snapshot) => {
      const list: MovimentacaoEstoque[] = [];
      snapshot.forEach(doc => list.push(doc.data() as MovimentacaoEstoque));
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      setMovimentacoesEstoque(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'movimentacoes_estoque'));

    // 9. Sincronização de Lixeira
    const unsubLixeira = onSnapshot(collection(db, 'lixeira'), (snapshot) => {
      const list: ItemLixeira[] = [];
      snapshot.forEach(doc => list.push(doc.data() as ItemLixeira));
      list.sort((a, b) => new Date(b.deletadoEm).getTime() - new Date(a.deletadoEm).getTime());
      setLixeira(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'lixeira'));

    // 10. Sincronização de Vales
    const unsubVales = onSnapshot(collection(db, 'vales'), (snapshot) => {
      const list: Vale[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Vale));
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      setVales(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vales'));

    // 11. Sincronização de Recibos de Pagamento
    const unsubRecibos = onSnapshot(collection(db, 'recibos_pagamento'), (snapshot) => {
      const list: ReciboPagamento[] = [];
      snapshot.forEach(doc => list.push(doc.data() as ReciboPagamento));
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      setRecibos(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'recibos_pagamento'));

    // 12. Sincronização de Conciliações Diárias
    const unsubConciliacoes = onSnapshot(collection(db, 'conciliacoes_diarias'), (snapshot) => {
      const list: ConciliacaoDiaria[] = [];
      snapshot.forEach(doc => list.push(doc.data() as ConciliacaoDiaria));
      setConciliacoesDiarias(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'conciliacoes_diarias'));

    // 13. Sincronização de Motivos de Devolução
    const unsubMotivos = onSnapshot(doc(db, 'configs', 'motivos_devolucao'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const lista = data.lista || [];
        if (lista.length === 0 || (lista.length <= 8 && lista.includes("Cliente Mudou-se"))) {
          // Se a lista estiver vazia ou for o padrão antigo reduzido, atualiza com a lista de motivos ampliada do sistema
          setDoc(doc(db, 'configs', 'motivos_devolucao'), { id: 'motivos_devolucao', lista: MOTIVOS_PADRAO }).catch(console.error);
          setMotivosDevolucao(MOTIVOS_PADRAO);
        } else {
          setMotivosDevolucao(lista);
        }
      } else {
        // Se ainda não existir o documento, inicializa no Firestore com os motivos padrão do sistema
        setDoc(doc(db, 'configs', 'motivos_devolucao'), { id: 'motivos_devolucao', lista: MOTIVOS_PADRAO }).catch(console.error);
        setMotivosDevolucao(MOTIVOS_PADRAO);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'configs/motivos_devolucao'));

    // 14. Sincronização de Transferências de Pacotes Log
    const unsubTransferencias = onSnapshot(collection(db, 'transferencias_pacotes'), (snapshot) => {
      const list: TransferenciaPacote[] = [];
      snapshot.forEach(doc => list.push(doc.data() as TransferenciaPacote));
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      setTransferencias(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'transferencias_pacotes'));

    // 14.5. Sincronização de Retiradas de Pacotes Log
    const unsubRetiradas = onSnapshot(collection(db, 'retiradas_pacotes'), (snapshot) => {
      const list: RetiradaPacote[] = [];
      snapshot.forEach(doc => list.push(doc.data() as RetiradaPacote));
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      setRetiradas(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'retiradas_pacotes'));

    // 15. Sincronização da Campanha para TV e Dashboard
    const unsubCampanha = onSnapshot(doc(db, 'configs', 'campanha'), (snapshot) => {
      if (snapshot.exists()) {
        setCampanhaAtiva(!!snapshot.data().ativa);
      } else {
        setCampanhaAtiva(false);
      }
    }, (err) => {
      console.warn("Erro ao sincronizar campanha, utilizando offline:", err);
    });

    // 16. Sincronização do Histórico do Backup
    const unsubBackupHistory = onSnapshot(doc(db, 'configs', 'backup_history'), (snapshot) => {
      if (snapshot.exists()) {
        setBackupHistory(snapshot.data());
      } else {
        setBackupHistory(null);
      }
    }, (err) => {
      console.warn("Erro ao sincronizar histórico de backup, usando offline:", err);
    });

    return () => {
      unsubFiliais();
      unsubEmpresas();
      unsubEntregadores();
      unsubRotas();
      unsubExpedicoes();
      unsubUsers();
      unsubEstoque();
      unsubMovimentacoes();
      unsubLixeira();
      unsubVales();
      unsubRecibos();
      unsubConciliacoes();
      unsubMotivos();
      unsubTransferencias();
      unsubRetiradas();
      unsubCampanha();
      unsubBackupHistory();
    };
  }, []);

  // Limpeza automática de pacotes de importação antigos (Mais de 7 dias) executada a cada domingo
  useEffect(() => {
    const runPacotesCleanup = async () => {
      try {
        const today = new Date();
        const isSunday = today.getDay() === 0;

        if (!isSunday) return;

        const todayStr = today.toISOString().split('T')[0];
        const lastRun = localStorage.getItem('last_cleanup_pacotes_date');
        if (lastRun === todayStr) return;

        // Determinar limite de data: 7 dias atrás
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 7);
        const yyyy = limitDate.getFullYear();
        const mm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const dd = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = `${yyyy}-${mm}-${dd}`;

        const q = query(
          collection(db, 'pacotes_cadastrados'),
          where('data', '<', limitDateStr)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          localStorage.setItem('last_cleanup_pacotes_date', todayStr);
          return;
        }

        let batch = writeBatch(db);
        let count = 0;

        for (const docSnap of snapshot.docs) {
          batch.delete(docSnap.ref);
          count++;
          if (count === 500) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }

        console.log(`[Limpeza de Pacotes] Excluídos pacotes antigos com data anterior a ${limitDateStr}`);
        localStorage.setItem('last_cleanup_pacotes_date', todayStr);
      } catch (error) {
        console.error("Erro na limpeza automática de pacotes antigos:", error);
      }
    };

    const timeoutId = setTimeout(runPacotesCleanup, 6000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Forçar redirecionamento se a aba atual violar as permissões atribuídas do usuário logado
  useEffect(() => {
    if (currentUser) {
      const perms = currentUser.permissions;
      const tabMap: { [key: string]: boolean } = {
        dashboard: perms.dashboard,
        expedicao: perms.expedicao,
        baixas: perms.baixas,
        'em-rota': perms.emRota,
        cadastro: perms.cadastro,
        pacotes: perms.cadastro,
        folha: perms.folha,
        relatorios: perms.relatorios,
        estoque: perms.estoque !== false,
      };

      // Se a aba selecionada atual não está permitida nas chaves de segurança
      if (!tabMap[activeTab]) {
        // Encontra a primeira permitida para o operador usar
        const firstAllowed = Object.keys(tabMap).find(k => tabMap[k]);
        if (firstAllowed) {
          setActiveTab(firstAllowed);
        }
      }
    }
  }, [currentUser, activeTab]);

  // Helpers de sincronização Firebase Firestore (Substituindo LocalStorage)

  const syncExpedicoes = async (updatedList: Expedicao[]) => {
    const updatedEstoque = [...estoque];
    const newMovs: MovimentacaoEstoque[] = [];
    const changedEstoque = new Map<string, ItemEstoque>();

    // 1. Detect newly ADDED expeditions (checkout/saída de carga) -> AUTOMATIC ENTRADA IN STOCK
    updatedList.forEach(nextExp => {
      const isNew = !expedicoes.some(pe => pe.id === nextExp.id);
      if (isNew) {
        const driver = entregadores.find(d => d.id === nextExp.entregadorId);
        const driverName = driver ? driver.nome : 'Entregador';
        const route = rotas.find(r => r.id === nextExp.rotaId || (nextExp.rotaIds && nextExp.rotaIds.includes(r.id)));
        const routeName = route ? route.nome : 'Rota';
        const nextItens = nextExp.itens || [];

        nextItens.forEach((item, idx) => {
          const uniqueId = `mov-in-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
          // Record inbound transaction in stock log
          newMovs.push({
            id: uniqueId,
            codigoBarras: item.codigoBarras,
            empresaId: item.empresaId,
            quantidade: 1,
            tipo: 'entrada',
            dataHora: nextExp.dataHoraSaida || new Date().toISOString(),
            usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
            filialId: nextExp.filialId || '',
            entregadorNome: driverName,
            rotaNome: routeName
          });

          // Add to active stock quantity (+1)
          const sIdx = updatedEstoque.findIndex(st => st.codigoBarras === item.codigoBarras && st.filialId === (nextExp.filialId || ''));
          if (sIdx > -1) {
            updatedEstoque[sIdx] = {
              ...updatedEstoque[sIdx],
              quantidade: updatedEstoque[sIdx].quantidade + 1,
              dataHoraAtualizacao: nextExp.dataHoraSaida || new Date().toISOString(),
              usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema'
            };
            changedEstoque.set(`${updatedEstoque[sIdx].filialId}_${updatedEstoque[sIdx].codigoBarras}`, updatedEstoque[sIdx]);
          } else {
            const newItem: ItemEstoque = {
              codigoBarras: item.codigoBarras,
              empresaId: item.empresaId,
              quantidade: 1,
              dataHoraAtualizacao: nextExp.dataHoraSaida || new Date().toISOString(),
              usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
              filialId: nextExp.filialId || ''
            };
            updatedEstoque.push(newItem);
            changedEstoque.set(`${newItem.filialId}_${newItem.codigoBarras}`, newItem);
          }
        });
      }
    });

    // 2. Detect REMOVED expeditions (cancellations/reversions) -> REVERT ENTRADA IN STOCK
    expedicoes.forEach(prevExp => {
      const isRemoved = !updatedList.some(ne => ne.id === prevExp.id);
      if (isRemoved) {
        const driver = entregadores.find(d => d.id === prevExp.entregadorId);
        const driverName = driver ? driver.nome : 'Entregador';
        const route = rotas.find(r => r.id === prevExp.rotaId || (prevExp.rotaIds && prevExp.rotaIds.includes(r.id)));
        const routeName = route ? route.nome : 'Rota';
        const prevItens = prevExp.itens || [];

        prevItens.forEach((item, idx) => {
          const uniqueId = `mov-ret-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
          // Record excision transaction
          newMovs.push({
            id: uniqueId,
            codigoBarras: item.codigoBarras,
            empresaId: item.empresaId,
            quantidade: 1,
            tipo: 'exclusao',
            dataHora: prevExp.dataHoraSaida || new Date().toISOString(),
            usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
            filialId: prevExp.filialId || '',
            entregadorNome: driverName,
            rotaNome: routeName
          });

          // Subtract 1 from active stock
          const sIdx = updatedEstoque.findIndex(st => st.codigoBarras === item.codigoBarras && st.filialId === (prevExp.filialId || ''));
          if (sIdx > -1) {
            updatedEstoque[sIdx] = {
              ...updatedEstoque[sIdx],
              quantidade: Math.max(0, updatedEstoque[sIdx].quantidade - 1),
              dataHoraAtualizacao: prevExp.dataHoraSaida || new Date().toISOString(),
              usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema'
            };
            changedEstoque.set(`${updatedEstoque[sIdx].filialId}_${updatedEstoque[sIdx].codigoBarras}`, updatedEstoque[sIdx]);
          } else {
            const newItem: ItemEstoque = {
              codigoBarras: item.codigoBarras,
              empresaId: item.empresaId,
              quantidade: 0,
              dataHoraAtualizacao: prevExp.dataHoraSaida || new Date().toISOString(),
              usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
              filialId: prevExp.filialId || ''
            };
            updatedEstoque.push(newItem);
            changedEstoque.set(`${newItem.filialId}_${newItem.codigoBarras}`, newItem);
          }
        });
      }
    });

    // 3. Detect status updates (delivered / returned) on existing expeditions -> SE CORRESPONDER A BAIXA E RETORNO
    updatedList.forEach(nextExp => {
      const prevExp = expedicoes.find(pe => pe.id === nextExp.id);
      if (prevExp) {
        const driver = entregadores.find(d => d.id === nextExp.entregadorId);
        const driverName = driver ? driver.nome : 'Entregador';
        const route = rotas.find(r => r.id === nextExp.rotaId || (nextExp.rotaIds && nextExp.rotaIds.includes(r.id)));
        const routeName = route ? route.nome : 'Rota';
        const nextItens = nextExp.itens || [];
        const prevItens = prevExp.itens || [];

        nextItens.forEach((nextItem, itemIdx) => {
          const prevItem = prevItens[itemIdx];
          
          if (prevItem && prevItem.status === 'pendente') {
            // TRANSITION TO 'entregue' (SAÍDA DE ESTOQUE DEFINITIVA)
            if (nextItem.status === 'entregue') {
              const uniqueId = `mov-out-${Date.now()}-${itemIdx}-${Math.random().toString(36).substr(2, 4)}`;
              newMovs.push({
                id: uniqueId,
                codigoBarras: nextItem.codigoBarras,
                empresaId: nextItem.empresaId,
                quantidade: 1,
                tipo: 'saida',
                dataHora: nextExp.dataHoraRetorno || new Date().toISOString(),
                usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
                filialId: nextExp.filialId || '',
                entregadorNome: driverName,
                rotaNome: routeName
              });

              const sIdx = updatedEstoque.findIndex(st => st.codigoBarras === nextItem.codigoBarras && st.filialId === (nextExp.filialId || ''));
              if (sIdx > -1) {
                updatedEstoque[sIdx] = {
                  ...updatedEstoque[sIdx],
                  quantidade: Math.max(0, updatedEstoque[sIdx].quantidade - 1),
                  dataHoraAtualizacao: nextExp.dataHoraRetorno || new Date().toISOString(),
                  usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema'
                };
                changedEstoque.set(`${updatedEstoque[sIdx].filialId}_${updatedEstoque[sIdx].codigoBarras}`, updatedEstoque[sIdx]);
              } else {
                const newItem: ItemEstoque = {
                  codigoBarras: nextItem.codigoBarras,
                  empresaId: nextItem.empresaId,
                  quantidade: 0,
                  dataHoraAtualizacao: nextExp.dataHoraRetorno || new Date().toISOString(),
                  usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
                  filialId: nextExp.filialId || ''
                };
                updatedEstoque.push(newItem);
                changedEstoque.set(`${newItem.filialId}_${newItem.codigoBarras}`, newItem);
              }
            } 
            // TRANSITION TO 'devolvido' (PERSISTE NO ESTOQUE COMO RETORNO/DEVOLUÇÃO)
            else if (nextItem.status === 'devolvido') {
              const uniqueId = `mov-dev-${Date.now()}-${itemIdx}-${Math.random().toString(36).substr(2, 4)}`;
              newMovs.push({
                id: uniqueId,
                codigoBarras: nextItem.codigoBarras,
                empresaId: nextItem.empresaId,
                quantidade: 1,
                tipo: 'devolucao',
                dataHora: nextExp.dataHoraRetorno || new Date().toISOString(),
                usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
                filialId: nextExp.filialId || '',
                entregadorNome: driverName,
                rotaNome: routeName
              });

              // Remains in stock (quantity stays 1 since we did +1 when creating the route and it was not delivered)
              // Just ensure it exists in the active stock list
              const sIdx = updatedEstoque.findIndex(st => st.codigoBarras === nextItem.codigoBarras && st.filialId === (nextExp.filialId || ''));
              if (sIdx === -1) {
                const newItem: ItemEstoque = {
                  codigoBarras: nextItem.codigoBarras,
                  empresaId: nextItem.empresaId,
                  quantidade: 1,
                  dataHoraAtualizacao: nextExp.dataHoraRetorno || new Date().toISOString(),
                  usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
                  filialId: nextExp.filialId || ''
                };
                updatedEstoque.push(newItem);
                changedEstoque.set(`${newItem.filialId}_${newItem.codigoBarras}`, newItem);
              } else {
                // If it is in stock but has another update timestamp, let's refresh the update date
                updatedEstoque[sIdx] = {
                  ...updatedEstoque[sIdx],
                  dataHoraAtualizacao: nextExp.dataHoraRetorno || new Date().toISOString(),
                  usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema'
                };
                changedEstoque.set(`${updatedEstoque[sIdx].filialId}_${updatedEstoque[sIdx].codigoBarras}`, updatedEstoque[sIdx]);
              }
            }
            // TRANSITION TO 'retirado_filial' ou classificações específicas (FICA EM POSSE DA FILIAL, SEM COMISSÃO OU PERFORMANCE)
            else if (['retirado_filial', 'retirado_zona_rural', 'retirado_avariado', 'retirado_outra_cidade'].includes(nextItem.status)) {
              const uniqueId = `mov-retirada-${Date.now()}-${itemIdx}-${Math.random().toString(36).substr(2, 4)}`;
              // Map nextItem.status directly to movement tipo
              const currentStatusType = nextItem.status as any;
              newMovs.push({
                id: uniqueId,
                codigoBarras: nextItem.codigoBarras,
                empresaId: nextItem.empresaId,
                quantidade: 1,
                tipo: currentStatusType,
                dataHora: nextItem.dataHoraLeitura || new Date().toISOString(),
                usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
                filialId: nextExp.filialId || '',
                entregadorNome: driverName,
                rotaNome: routeName
              });

              // Remains in stock (quantity stays 1)
              const sIdx = updatedEstoque.findIndex(st => st.codigoBarras === nextItem.codigoBarras && st.filialId === (nextExp.filialId || ''));
              if (sIdx === -1) {
                const newItem: ItemEstoque = {
                  codigoBarras: nextItem.codigoBarras,
                  empresaId: nextItem.empresaId,
                  quantidade: 1,
                  dataHoraAtualizacao: nextItem.dataHoraLeitura || new Date().toISOString(),
                  usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema',
                  filialId: nextExp.filialId || ''
                };
                updatedEstoque.push(newItem);
                changedEstoque.set(`${newItem.filialId}_${newItem.codigoBarras}`, newItem);
              } else {
                updatedEstoque[sIdx] = {
                  ...updatedEstoque[sIdx],
                  dataHoraAtualizacao: nextItem.dataHoraLeitura || new Date().toISOString(),
                  usuarioNome: currentUser?.nomeCompleto || currentUser?.username || 'Sistema'
                };
                changedEstoque.set(`${updatedEstoque[sIdx].filialId}_${updatedEstoque[sIdx].codigoBarras}`, updatedEstoque[sIdx]);
              }
            }
          }
        });
      }
    });

    // Optimistically update React State immediately (Zero Lag)
    setExpedicoes(updatedList);
    setEstoque(updatedEstoque);
    if (newMovs.length > 0) {
      setMovimentacoesEstoque(prev => {
        const sorted = [...newMovs, ...prev];
        return sorted.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      });
    }

    try {
      const batch = writeBatch(db);
      
      newMovs.forEach(m => {
        batch.set(doc(db, 'movimentacoes_estoque', m.id), cleanUndefined(m));
      });
      changedEstoque.forEach((st, stockId) => {
        batch.set(doc(db, 'estoque', stockId), cleanUndefined(st));
      });
      updatedList.forEach(item => {
        batch.set(doc(db, 'expedicoes', item.id), cleanUndefined(item));
      });
      expedicoes.forEach(item => {
        if (!updatedList.some(x => x.id === item.id)) {
          batch.delete(doc(db, 'expedicoes', item.id));
        }
      });

      await batch.commit();

      // Forçar atualização do cache de rede imediatamente para sincronização ultrarrápida (Zero Latência) em outras telas
      await syncAllTablesForce();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'expedicoes');
    }
  };

  const handleClearTodayExpedicoes = async (targetDateStr: string) => {
    const updated = expedicoes.filter(exp => {
      if (!exp.dataHoraSaida) return true;
      const expDate = exp.dataHoraSaida.substring(0, 10);
      return expDate !== targetDateStr;
    });
    await syncExpedicoes(updated);
  };

  const handleUpdateEstoque = async (updatedEstoque: ItemEstoque[], updatedMovimentacoes: MovimentacaoEstoque[]) => {
    setEstoque(updatedEstoque);
    setMovimentacoesEstoque(updatedMovimentacoes);
    try {
      const promises: Promise<any>[] = [];
      
      updatedEstoque.forEach(st => {
        const stockId = `${st.filialId}_${st.codigoBarras}`;
        promises.push(setDoc(doc(db, 'estoque', stockId), cleanUndefined(st)));
      });
      estoque.forEach(st => {
        if (!updatedEstoque.some(x => x.codigoBarras === st.codigoBarras && x.filialId === st.filialId)) {
          const stockId = `${st.filialId}_${st.codigoBarras}`;
          promises.push(deleteDoc(doc(db, 'estoque', stockId)));
        }
      });
      updatedMovimentacoes.forEach(m => {
        promises.push(setDoc(doc(db, 'movimentacoes_estoque', m.id), cleanUndefined(m)));
      });
      movimentacoesEstoque.forEach(m => {
        if (!updatedMovimentacoes.some(x => x.id === m.id)) {
          promises.push(deleteDoc(doc(db, 'movimentacoes_estoque', m.id)));
        }
      });

      await Promise.all(promises);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'estoque');
    }
  };

  // ==========================================
  // METODOS CRUD - Empresas
  // ==========================================
  const handleAddEmpresa = async (nuevaEmpresa: Empresa) => {
    try {
      await setDoc(doc(db, 'empresas', nuevaEmpresa.id), cleanUndefined(nuevaEmpresa));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'empresas');
      throw err;
    }
  };

  const handleUpdateEmpresa = async (empId: string, updatedParams: Partial<Empresa>) => {
    try {
      const target = empresas.find(e => e.id === empId);
      if (target) {
        const updated = { ...target, ...updatedParams };
        await setDoc(doc(db, 'empresas', empId), cleanUndefined(updated));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'empresas');
      throw err;
    }
  };

  const handleDeleteEmpresa = async (empId: string) => {
    const target = empresas.find(e => e.id === empId);
    if (target) {
      const newItem: ItemLixeira = {
        id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        tipo: 'empresa',
        label: `Empresa: ${target.nome}`,
        subLabel: `CNPJ: ${target.cnpj || 'Sem CNPJ'} | Valor p/ Pacote: R$ ${target.valorPorPacote || 0}`,
        dados: target,
        deletadoEm: new Date().toISOString(),
        deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
      };
      await syncLixeira([newItem, ...lixeira]);
    }
    try {
      await deleteDoc(doc(db, 'empresas', empId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'empresas');
      throw err;
    }
  };

  // ==========================================
  // METODOS CRUD - Entregadores
  // ==========================================
  const handleAddEntregador = async (nuevoEntregador: Entregador) => {
    try {
      await setDoc(doc(db, 'entregadores', nuevoEntregador.id), cleanUndefined(nuevoEntregador));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'entregadores');
      throw err;
    }
  };

  const handleUpdateEntregador = async (entId: string, updatedParams: Partial<Entregador>) => {
    try {
      const target = entregadores.find(e => e.id === entId);
      if (target) {
        const updated = { ...target, ...updatedParams };
        await setDoc(doc(db, 'entregadores', entId), cleanUndefined(updated));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'entregadores');
      throw err;
    }
  };

  const handleDeleteEntregador = async (entId: string) => {
    const target = entregadores.find(e => e.id === entId);
    if (target) {
      const newItem: ItemLixeira = {
        id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        tipo: 'entregador',
        label: `Entregador: ${target.nome}`,
        subLabel: `CPF: ${target.cpf || 'Sem CPF'} | Contato: ${target.contato || 'N/D'}`,
        dados: target,
        deletadoEm: new Date().toISOString(),
        deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
      };
      syncLixeira([newItem, ...lixeira]);
    }
    try {
      await deleteDoc(doc(db, 'entregadores', entId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'entregadores');
      throw err;
    }
  };

  // ==========================================
  // METODOS CRUD - Rotas
  // ==========================================
  const handleAddRota = async (nuevaRota: Rota) => {
    try {
      await setDoc(doc(db, 'rotas', nuevaRota.id), cleanUndefined(nuevaRota));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'rotas');
      throw err;
    }
  };

  const handleUpdateRota = async (id: string, updatedParams: Partial<Rota>) => {
    try {
      const target = rotas.find(r => r.id === id);
      if (target) {
        const updated = { ...target, ...updatedParams };
        await setDoc(doc(db, 'rotas', id), cleanUndefined(updated));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'rotas');
      throw err;
    }
  };

  const handleDeleteRota = async (id: string) => {
    const target = rotas.find(r => r.id === id);
    if (target) {
      const newItem: ItemLixeira = {
        id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        tipo: 'rota',
        label: `Rota: ${target.nome}`,
        subLabel: `${target.descricao || 'Sem descrição'}`,
        dados: target,
        deletadoEm: new Date().toISOString(),
        deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
      };
      await syncLixeira([newItem, ...lixeira]);
    }
    try {
      await deleteDoc(doc(db, 'rotas', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'rotas');
      throw err;
    }
  };

  // ==========================================
  // METODOS CRUD - Filiais
  // ==========================================
  const handleAddFilial = async (novaFilial: Filial) => {
    try {
      await setDoc(doc(db, 'filiais', novaFilial.id), cleanUndefined(novaFilial));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'filiais');
      throw err;
    }
  };

  const handleUpdateFilial = async (id: string, updatedParams: Partial<Filial>) => {
    try {
      const target = filiais.find(fil => fil.id === id);
      if (target) {
        const updated = { ...target, ...updatedParams };
        await setDoc(doc(db, 'filiais', id), cleanUndefined(updated));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'filiais');
      throw err;
    }
  };

  const handleDeleteFilial = async (id: string) => {
    const target = filiais.find(f => f.id === id);
    if (target) {
      const newItem: ItemLixeira = {
        id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        tipo: 'filial',
        label: `Filial: ${target.nome}`,
        subLabel: `CNPJ: ${target.cnpj || 'Sem CNPJ'} | Cidade: ${target.cidade || 'N/D'}`,
        dados: target,
        deletadoEm: new Date().toISOString(),
        deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
      };
      await syncLixeira([newItem, ...lixeira]);
    }
    try {
      await deleteDoc(doc(db, 'filiais', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'filiais');
      throw err;
    }
  };

  // ==========================================
  // METODOS DA LIXEIRA - RESTAURAÇÃO E EXCLUSÃO DEFINITIVA
  // ==========================================
  const handleRestoreFromTrash = (item: ItemLixeira) => {
    if (item.tipo === 'empresa') {
      const alreadyExists = empresas.some(e => e.id === item.dados.id);
      if (!alreadyExists) {
        setDoc(doc(db, 'empresas', item.dados.id), cleanUndefined(item.dados))
          .catch(err => handleFirestoreError(err, OperationType.WRITE, 'empresas'));
      }
    } else if (item.tipo === 'entregador') {
      const alreadyExists = entregadores.some(e => e.id === item.dados.id);
      if (!alreadyExists) {
        setDoc(doc(db, 'entregadores', item.dados.id), cleanUndefined(item.dados))
          .catch(err => handleFirestoreError(err, OperationType.WRITE, 'entregadores'));
      }
    } else if (item.tipo === 'rota') {
      const alreadyExists = rotas.some(r => r.id === item.dados.id);
      if (!alreadyExists) {
        setDoc(doc(db, 'rotas', item.dados.id), cleanUndefined(item.dados))
          .catch(err => handleFirestoreError(err, OperationType.WRITE, 'rotas'));
      }
    } else if (item.tipo === 'filial') {
      const alreadyExists = filiais.some(f => f.id === item.dados.id);
      if (!alreadyExists) {
        setDoc(doc(db, 'filiais', item.dados.id), cleanUndefined(item.dados))
          .catch(err => handleFirestoreError(err, OperationType.WRITE, 'filiais'));
      }
    } else if (item.tipo === 'usuario') {
      const alreadyExists = users.some(u => u.id === item.dados.id);
      if (!alreadyExists) {
        const updated = [...users, item.dados];
        setUsers(updated);
        try {
          localStorage.setItem('logi_users', JSON.stringify(updated));
        } catch (_) {}
      }
    } else if (item.tipo === 'vale') {
      const alreadyExists = vales.some(v => v.id === item.dados.id);
      if (!alreadyExists) {
        handleAddVale(item.dados);
      }
    } else if (item.tipo === 'recibo') {
      const alreadyExists = recibos.some(r => r.id === item.dados.id);
      if (!alreadyExists) {
        handleAddRecibo(item.dados);
      }
    } else if (item.tipo === 'motivo') {
      const alreadyExists = motivosDevolucao.includes(item.dados.motivo);
      if (!alreadyExists) {
        handleUpdateMotivos([item.dados.motivo, ...motivosDevolucao]);
      }
    }

    // Remove from trash list
    const updatedTrash = lixeira.filter(t => t.id !== item.id);
    syncLixeira(updatedTrash);
  };

  const handlePermanentlyDeleteFromTrash = (trashId: string) => {
    const updatedTrash = lixeira.filter(t => t.id !== trashId);
    syncLixeira(updatedTrash);
  };

  const handleEmptyTrash = () => {
    syncLixeira([]);
  };

  // ==========================================
  // METODOS DE BACKUP INTERNO E DE SEGURANÇA
  // ==========================================
  const handleExportBackup = () => {
    try {
      const backupData = {
        system: "DIAMANTE LOG",
        version: "2.5.1",
        backupDate: new Date().toISOString(),
        data: {
          users,
          empresas,
          entregadores,
          expedicoes,
          rotas,
          filiais,
          estoque,
          movimentacoesEstoque,
          lixeira
        }
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const formattedDate = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute("download", `diamantelog_backup_${formattedDate}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("Erro ao exportar dados de backup: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSelectFileForBackupMsg = (file: File) => {
    setBackupErrorMsg(null);
    setBackupSuccessMsg(null);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const backup = JSON.parse(text);
          if (!backup || (backup.system !== "Expedlog" && backup.system !== "DIAMANTE LOG")) {
            setBackupErrorMsg("O arquivo selecionado não é um backup oficial do DIAMANTE LOG.");
            return;
          }
          if (!backup.data) {
            setBackupErrorMsg("Dados do backup vazios ou corrompidos.");
            return;
          }
          setPendingBackupData(backup.data);
        } catch (err) {
          setBackupErrorMsg("Falha ao analisar arquivo JSON: " + (err instanceof Error ? err.message : String(err)));
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setBackupErrorMsg("Erro no carregamento do arquivo: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const executeBackupRestore = async (parsedData: any) => {
    setIsImporting(true);
    setBackupErrorMsg(null);
    setBackupSuccessMsg(null);
    setImportProgress(0);
    setImportStep("Iniciando gravação de dados...");
    try {
      const operations: { ref: any; data: any }[] = [];

      if (parsedData.filiais && Array.isArray(parsedData.filiais)) {
        parsedData.filiais.forEach((item: any) => {
          operations.push({ ref: doc(db, 'filiais', item.id), data: cleanUndefined(item) });
        });
      }
      if (parsedData.empresas && Array.isArray(parsedData.empresas)) {
        parsedData.empresas.forEach((item: any) => {
          operations.push({ ref: doc(db, 'empresas', item.id), data: cleanUndefined(item) });
        });
      }
      if (parsedData.entregadores && Array.isArray(parsedData.entregadores)) {
        parsedData.entregadores.forEach((item: any) => {
          operations.push({ ref: doc(db, 'entregadores', item.id), data: cleanUndefined(item) });
        });
      }
      if (parsedData.rotas && Array.isArray(parsedData.rotas)) {
        parsedData.rotas.forEach((item: any) => {
          operations.push({ ref: doc(db, 'rotas', item.id), data: cleanUndefined(item) });
        });
      }
      if (parsedData.expedicoes && Array.isArray(parsedData.expedicoes)) {
        parsedData.expedicoes.forEach((item: any) => {
          operations.push({ ref: doc(db, 'expedicoes', item.id), data: cleanUndefined(item) });
        });
      }
      if (parsedData.estoque && Array.isArray(parsedData.estoque)) {
        parsedData.estoque.forEach((item: any) => {
          const stockId = `${item.filialId || ''}_${item.codigoBarras || ''}`;
          operations.push({ ref: doc(db, 'estoque', stockId), data: cleanUndefined(item) });
        });
      }
      if (parsedData.movimentacoesEstoque && Array.isArray(parsedData.movimentacoesEstoque)) {
        parsedData.movimentacoesEstoque.forEach((item: any) => {
          operations.push({ ref: doc(db, 'movimentacoes_estoque', item.id), data: cleanUndefined(item) });
        });
      }
      if (parsedData.lixeira && Array.isArray(parsedData.lixeira)) {
        parsedData.lixeira.forEach((item: any) => {
          operations.push({ ref: doc(db, 'lixeira', item.id), data: cleanUndefined(item) });
        });
      }
      if (parsedData.users && Array.isArray(parsedData.users)) {
        parsedData.users.forEach((item: any) => {
          operations.push({ ref: doc(db, 'users', item.id), data: cleanUndefined(item) });
        });
      }

      const totalOperations = operations.length;
      if (totalOperations === 0) {
        setImportProgress(100);
        setImportStep("Nenhum dado encontrado para importar.");
      } else {
        // Executes Firestore writes smoothly in chunked sequential batches of 150 items
        const chunkSize = 150;
        const totalLotes = Math.ceil(totalOperations / chunkSize);
        
        // Start from exactly 0% representation
        setImportProgress(0);
        let currentVisualProgress = 0;

        for (let i = 0; i < totalOperations; i += chunkSize) {
          const slice = operations.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          slice.forEach(op => {
            batch.set(op.ref, op.data);
          });
          
          const loteNum = Math.floor(i / chunkSize) + 1;
          setImportStep(`Sincronizando lote ${loteNum} de ${totalLotes}...`);
          
          const targetProgress = Math.round(((i + slice.length) / totalOperations) * 100);
          
          // Execute Firestore batch commit
          let isCommitFinished = false;
          const commitPromise = batch.commit().then(() => {
            isCommitFinished = true;
          });

          // While commit is in progress, smoothly increment visual progress up to targetProgress - 3
          while (!isCommitFinished) {
            const maxAllowedVisual = Math.max(0, targetProgress - 3);
            if (currentVisualProgress < maxAllowedVisual) {
              currentVisualProgress += 1;
              setImportProgress(currentVisualProgress);
            }
            await new Promise(resolve => setTimeout(resolve, 60));
          }

          // Ensure the promise is fully resolved
          await commitPromise;

          // Smoothly fill up to targetProgress of this batch to prevent sudden visual jumps
          while (currentVisualProgress < targetProgress) {
            currentVisualProgress += 1;
            setImportProgress(currentVisualProgress);
            await new Promise(resolve => setTimeout(resolve, 15));
          }

          // Quick pause between batches for smooth rendering transition
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      setImportStep("Sincronização concluída com sucesso!");
      setImportProgress(100);
      await new Promise(resolve => setTimeout(resolve, 400));

      setImportStep("Atualizando interface local...");

      // Instantly update React States to avoid screen lag
      if (parsedData.filiais && Array.isArray(parsedData.filiais)) setFiliais(parsedData.filiais);
      if (parsedData.empresas && Array.isArray(parsedData.empresas)) setEmpresas(parsedData.empresas);
      if (parsedData.entregadores && Array.isArray(parsedData.entregadores)) setEntregadores(parsedData.entregadores);
      if (parsedData.rotas && Array.isArray(parsedData.rotas)) setRotas(parsedData.rotas);
      if (parsedData.expedicoes && Array.isArray(parsedData.expedicoes)) setExpedicoes(parsedData.expedicoes);
      if (parsedData.estoque && Array.isArray(parsedData.estoque)) setEstoque(parsedData.estoque);
      if (parsedData.movimentacoesEstoque && Array.isArray(parsedData.movimentacoesEstoque)) setMovimentacoesEstoque(parsedData.movimentacoesEstoque);
      if (parsedData.lixeira && Array.isArray(parsedData.lixeira)) setLixeira(parsedData.lixeira);
      if (parsedData.users && Array.isArray(parsedData.users)) setUsers(parsedData.users);

      setBackupSuccessMsg("Backup restaurado e sincronizado com sucesso em todos os seus dispositivos!");
      setPendingBackupData(null);
      setTimeout(() => {
        setIsBackupRestoreOpen(false);
        setBackupSuccessMsg(null);
      }, 3000);
    } catch (err) {
      setBackupErrorMsg("Falha ao gravar informações: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log("Instalação do usuário:", outcome);
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Erro no instalador:", err);
      }
    } else {
      alert(
        "Como Instalar o DIAMANTE LOG no seu dispositivo:\n\n" +
        "💻 Computador (Chrome/Edge/Brave):\n" +
        "1. No lado de fora da barra de endereços (URL), clique no botão de instalar (ícone de computador ou '+' que aparece).\n" +
        "2. Confirme clicando em 'Instalar'.\n\n" +
        "📱 Android (Chrome):\n" +
        "1. Abra o menu tocando nos 3 pontinhos no canto superior direito.\n" +
        "2. Toque em 'Instalar aplicativo' ou 'Adicionar à tela inicial'.\n\n" +
        "🍎 iPhone/iPad (Safari):\n" +
        "1. Toque no botão de Compartilhar (com a flechinha apontada para cima na parte inferior).\n" +
        "2. Toque em 'Adicionar à Tela de Início'."
      );
    }
  };

  // ==========================================
  // METODOS CRUD - Saídas/Expedições
  // ==========================================
  const handleAddExpedicao = (nuevaExpedicao: Expedicao) => {
    syncExpedicoes([nuevaExpedicao, ...expedicoes]);
  };

  const handleCancelExpedicao = (expId: string) => {
    const updated = expedicoes.filter(exp => exp.id !== expId);
    syncExpedicoes(updated);
  };

  const handleCancelAllExpedicoes = (expIds: string[]) => {
    const updated = expedicoes.filter(exp => !expIds.includes(exp.id));
    syncExpedicoes(updated);
  };

  const handleAddVale = async (novoVale: Vale) => {
    setVales(prev => [novoVale, ...prev]);
    try {
      await setDoc(doc(db, 'vales', novoVale.id), cleanUndefined(novoVale));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'vales');
    }
  };

  const handleDeleteVale = async (valeId: string) => {
    const target = vales.find(v => v.id === valeId);
    if (target) {
      const newItem: ItemLixeira = {
        id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        tipo: 'vale',
        label: `Vale: ${target.entregadorNome}`,
        subLabel: `Valor: R$ ${target.valor} | Data/Hora: ${new Date(target.dataHora).toLocaleString('pt-BR')}${target.observacao ? ` | Obs: ${target.observacao}` : ''}`,
        dados: target,
        deletadoEm: new Date().toISOString(),
        deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
      };
      await syncLixeira([newItem, ...lixeira]);
    }
    setVales(prev => prev.filter(v => v.id !== valeId));
    try {
      await deleteDoc(doc(db, 'vales', valeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'vales');
    }
  };

  const handleAddRecibo = async (novoRecibo: ReciboPagamento) => {
    setRecibos(prev => [novoRecibo, ...prev]);
    try {
      await setDoc(doc(db, 'recibos_pagamento', novoRecibo.id), cleanUndefined(novoRecibo));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'recibos_pagamento');
    }
  };

  const handleDeleteRecibo = async (reciboId: string) => {
    const target = recibos.find(r => r.id === reciboId);
    if (target) {
      const newItem: ItemLixeira = {
        id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        tipo: 'recibo',
        label: `Recibo: ${target.entregadorNome}`,
        subLabel: `Valor Pago: R$ ${target.valorPago} | Referência: ${target.periodoReferencia} | Pago em: ${new Date(target.dataHoraGeracao).toLocaleString('pt-BR')}`,
        dados: target,
        deletadoEm: new Date().toISOString(),
        deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
      };
      await syncLixeira([newItem, ...lixeira]);
    }
    setRecibos(prev => prev.filter(r => r.id !== reciboId));
    try {
      await deleteDoc(doc(db, 'recibos_pagamento', reciboId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'recibos_pagamento');
    }
  };

  const handleUpdateConciliacao = async (conciliacao: ConciliacaoDiaria) => {
    setConciliacoesDiarias(prev => {
      const idx = prev.findIndex(c => c.id === conciliacao.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = conciliacao;
        return copy;
      } else {
        return [...prev, conciliacao];
      }
    });
    try {
      await setDoc(doc(db, 'conciliacoes_diarias', conciliacao.id), cleanUndefined(conciliacao));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'conciliacoes_diarias');
    }
  };

  const handleUpdateMotivos = async (novosMotivos: string[]) => {
    // Intercept deleted motives to put them in the Lixeira (Trash bin)
    const deletedMotives = motivosDevolucao.filter(m => !novosMotivos.includes(m));
    if (deletedMotives.length > 0) {
      const newTrashItems = [...lixeira];
      for (const target of deletedMotives) {
        const newItem: ItemLixeira = {
          id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          tipo: 'motivo',
          label: `Motivo Devolução: ${target}`,
          subLabel: `Motivo customizado de devolução`,
          dados: { motivo: target },
          deletadoEm: new Date().toISOString(),
          deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
        };
        newTrashItems.unshift(newItem);
      }
      await syncLixeira(newTrashItems);
    }

    setMotivosDevolucao(novosMotivos);
    try {
      await setDoc(doc(db, 'configs', 'motivos_devolucao'), { id: 'motivos_devolucao', lista: novosMotivos });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'configs/motivos_devolucao');
    }
  };

  const handleFinalizeExpedicao = (expId: string, itensFinalizados: Pacote[], tempoVoltaMinutos: number) => {
    const updated = expedicoes.map(exp => {
      if (exp.id === expId) {
        return {
          ...exp,
          pacotes: itensFinalizados,
          tempoVoltaMinutos,
          status: 'finalizado' as const,
          dataHoraRetorno: new Date().toISOString()
        };
      }
      return exp;
    });
    syncExpedicoes(updated);
  };

  // ==========================================
  // ACOES DE BANCO DE USUARIOS (AUTENTICACAO & GESTAO)
  // ==========================================
  const handleRegisterUser = async (newUser: User) => {
    try {
      await setDoc(doc(db, 'users', newUser.id), newUser);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${newUser.id}`);
    }
  };

  const handleUpdateUserPassword = async (username: string, newPass: string) => {
    const clean = username.trim().toLowerCase();
    const matchedUserIndex = users.findIndex(u => u.username.toLowerCase() === clean);
    
    if (matchedUserIndex === -1) {
      return { success: false, message: 'Usuário não localizado.' };
    }
    const matchedUser = users[matchedUserIndex];
    if (matchedUser.isMaster || matchedUser.id === 'usr-master' || matchedUser.username === 'master') {
      return { success: false, message: 'A senha do usuário master é protegida e não pode ser alterada.' };
    }
    
    try {
      const updatedUser = { ...matchedUser, passwordHash: newPass, recoveryKey: undefined };
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
      return { success: true, message: 'Senha alterada!' };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${matchedUser.id}`);
      return { success: false, message: 'Erro ao alterar a senha.' };
    }
  };

  const handleGenerateRecoveryKey = async (usernameOrEmail: string) => {
    const clean = usernameOrEmail.trim().toLowerCase();
    const matchedUserIndex = users.findIndex(u => 
      u.username.toLowerCase() === clean || 
      u.email.toLowerCase() === clean
    );
    
    if (matchedUserIndex === -1) {
      return { success: false, key: '', email: '', message: 'Usuário ou e-mail correspondente não localizado.' };
    }
    
    const matchedUser = users[matchedUserIndex];
    // Gerar palavra-chave aleatória numérica de 4 dígitos
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const recoveryKey = `DIAMANTE-${randomCode}`;
    
    try {
      const updatedUser = { ...matchedUser, recoveryKey };
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
      return { 
        success: true, 
        key: recoveryKey, 
        email: matchedUser.email, 
        message: 'Chave enviada!' 
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${matchedUser.id}`);
      return { success: false, key: '', email: '', message: 'Erro ao gerar chave de recuperação.' };
    }
  };

  const handleUpdateUserPermissions = async (userId: string, permissions: UserPermissions, filiais?: string[], defaultFilialId?: string, maxConnections?: number) => {
    const matchedUser = users.find(u => u.id === userId);
    if (!matchedUser) return;

    try {
      const updatedUser = { 
        ...matchedUser, 
        permissions,
        filiais: filiais !== undefined ? filiais : matchedUser.filiais,
        defaultFilialId: defaultFilialId !== undefined ? defaultFilialId : matchedUser.defaultFilialId,
        maxConnections: maxConnections !== undefined ? maxConnections : matchedUser.maxConnections
      };
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
      
      // Se o usuário alterado for o que está logado no momento, sincroniza
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUser);
        try {
          sessionStorage.setItem('logi_currentUser', JSON.stringify(updatedUser));
        } catch (_) {}
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
    }
  };

  const handleAdminResetUserPassword = async (userId: string, newPass: string) => {
    const userToReset = users.find(u => u.id === userId);
    if (!userToReset || userToReset.isMaster || userToReset.id === 'usr-master' || userToReset.username === 'master') {
      return; // Cannot reset master password
    }
    try {
      const updatedUser = { ...userToReset, passwordHash: newPass };
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
    }
  };

  const handleUpdateUserEmail = async (userId: string, newEmailOrKeyword: string) => {
    const matchedUser = users.find(u => u.id === userId);
    if (!matchedUser) return;
    
    const cleanVal = newEmailOrKeyword.trim();
    try {
      const updatedUser = { 
        ...matchedUser, 
        email: cleanVal.includes('@') ? cleanVal : `${matchedUser.username}@diamantelog.com`, 
        palavraChave: cleanVal 
      };
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);

      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUser);
        try {
          sessionStorage.setItem('logi_currentUser', JSON.stringify(updatedUser));
        } catch (_) {}
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDel = users.find(u => u.id === userId);
    if (!userToDel || userToDel.isMaster) return; // Segurança contra exclusão de conta Master
    
    const newItem: ItemLixeira = {
      id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      tipo: 'usuario',
      label: `Usuário: ${userToDel.nomeCompleto} (@${userToDel.username})`,
      subLabel: `Email: ${userToDel.email || 'Sem Email'} | Permissões customizadas`,
      dados: userToDel,
      deletadoEm: new Date().toISOString(),
      deletadoPor: currentUser ? (currentUser.nomeCompleto || currentUser.username) : 'Sistema'
    };
    await syncLixeira([newItem, ...lixeira]);

    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleUpdateSelfPassword = async (newPass: string) => {
    if (!currentUser) return;
    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      return; // Master password is protected and cannot be changed
    }
    
    try {
      const updatedUser = { ...currentUser, passwordHash: newPass };
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
      
      setCurrentUser(updatedUser);
      try {
        sessionStorage.setItem('logi_currentUser', JSON.stringify(updatedUser));
      } catch (_) {}
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.id}`);
    }
  };

  // ==========================================
  // INTEGRAÇÃO DE BARRA DE LOGIN SE NÃO LOGADO
  // ==========================================
  if (!currentUser) {
    return (
      <LoginView
        users={users}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          try {
            sessionStorage.setItem('logi_currentUser', JSON.stringify(user));
          } catch (_) {}
          setActiveTab('expedicao');
        }}
        onRegisterUser={handleRegisterUser}
        onUpdateUserPassword={handleUpdateUserPassword}
        onGenerateRecoveryKey={handleGenerateRecoveryKey}
      />
    );
  }

  const defaultFilialObj = filiais.find(f => f.id === currentUser?.defaultFilialId) || filiais[0];
  const defaultFilialName = defaultFilialObj ? defaultFilialObj.nome : 'DIAMANTE LOG';
  const defaultFilialLogo = defaultFilialObj ? defaultFilialObj.logo : undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans" id="root-app-container">
      
      {/* 1. SIDEBAR LATERAL (DESKTOP) */}
      <aside className="w-72 bg-blue-900 text-white flex flex-col shrink-0 border-r border-blue-950 sticky top-0 h-screen hidden md:flex print:hidden shadow-xl" id="sidebar-desktop">
        
        {/* LOGO E TÍTULO DA EMPRESA */}
        <div className="p-5 border-b border-blue-850 bg-blue-950/40 flex items-center gap-3.5">
          <div className="p-1 bg-white rounded-xl flex items-center justify-center shadow-md h-13 w-13 shrink-0">
            {defaultFilialLogo ? (
              <img 
                src={defaultFilialLogo} 
                alt="Logo" 
                className="h-11 w-11 object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            ) : (
              <DiamondLogo className="h-10 w-10 text-blue-900" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black font-heading tracking-tight leading-snug text-white uppercase break-words" title={defaultFilialName}>
              {defaultFilialName}
            </h1>
            <p className="text-[8.5px] font-black text-blue-200/80 leading-none mt-1.5 tracking-wider uppercase">
              Sistema DIAMANTE LOG
            </p>
          </div>
        </div>

        {/* OPERADOR ATIVO & DESCONECTAR */}
        <div className="mx-4 mt-5 p-3 bg-blue-950/60 rounded-xl border border-blue-800/50 flex items-center justify-between gap-2.5 mb-4 shadow-inner" id="sidebar-user-profile-card">
          <button 
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition text-left cursor-pointer group"
            title="Ver e substituir foto de perfil"
          >
            {/* Avatar circular */}
            {currentUser?.foto ? (
              <img 
                src={currentUser.foto} 
                alt={currentUser.nomeCompleto} 
                className="w-8 h-8 rounded-full object-cover shrink-0 select-none shadow-md border border-white/10 group-hover:scale-105 transition"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-md border border-white/10 group-hover:scale-105 transition ${
                currentUser?.isMaster ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'
              } text-white`}>
                {currentUser?.isMaster ? '👑' : currentUser?.nomeCompleto.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Infos do usuário */}
            <div className="text-left leading-tight min-w-0">
              <p className="text-[11px] font-black tracking-wide text-white truncate max-w-[125px] group-hover:text-blue-200 transition" title={currentUser?.nomeCompleto}>
                {currentUser?.nomeCompleto}
              </p>
              <span className="inline-flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] text-blue-300 font-mono tracking-wider font-semibold uppercase">@{currentUser?.username}</span>
              </span>
            </div>
          </button>
          
          {/* Botão de sair no formato de porta */}
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem('logi_currentUser');
                sessionStorage.removeItem('logi_sessionId');
              } catch (_) {}
              setCurrentUser(null);
              setActiveTab('expedicao');
            }}
            className="p-2 bg-blue-900/60 hover:bg-rose-500/90 text-blue-200 hover:text-white rounded-lg transition duration-150 cursor-pointer border border-blue-800/40 hover:border-rose-400/40 shrink-0"
            title="Sair do Sistema"
            id="btn-logout-sidebar-status"
          >
            <LogOut className="h-4 w-4 shrink-0 transition" />
          </button>
        </div>

        {/* PROJEÇÃO EM TV (CONFIRMANDO PERMISSIONS REQUISITIONS) */}
        {currentUser.permissions.tvPainel && (
          <div className="px-4 mb-4">
            <button
              onClick={() => setIsTvMode(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 border border-blue-400/30 font-black text-xs text-white rounded-xl shadow-lg hover:from-blue-750 hover:to-violet-750 hover:scale-[1.01] transition-all duration-200 cursor-pointer"
              id="btn-trigger-tv-mode-sidebar-desktop"
            >
              <Tv className="h-4 w-4 text-indigo-100 animate-pulse" />
              <span>📺 Painel para TV (HDMI)</span>
            </button>
          </div>
        )}

        {/* LISTA DE PÁGINAS / ABAS DE NAVEGAÇÃO LATERAL CONFORME PERMISSÕES */}
        <div className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-2">Operações & BI</p>
          
          {currentUser.permissions.dashboard && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-dashboard-desktop"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Painel Geral & BI</span>
            </button>
          )}

          {currentUser.permissions.expedicao && (
            <button
              onClick={() => setActiveTab('expedicao')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'expedicao'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-expedicao-desktop"
            >
              <Scan className="h-4 w-4 shrink-0" />
              <span>Saída (Checkout Guia)</span>
            </button>
          )}

          {currentUser.permissions.baixas && (
            <button
              onClick={() => setActiveTab('baixas')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'baixas'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-baixas-desktop"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>Baixa & Retorno</span>
            </button>
          )}

          {currentUser.permissions.emRota && (
            <button
              onClick={() => setActiveTab('em-rota')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'em-rota'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-em-rota-desktop"
            >
              <Truck className="h-4 w-4 shrink-0 font-bold" />
              <span>Em Rota (Painel Ativo)</span>
            </button>
          )}

          {(!currentUser.permissions || currentUser.permissions.estoque !== false) && (
            <button
              onClick={() => setActiveTab('estoque')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'estoque'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-estoque-desktop"
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>Controle de Estoque</span>
            </button>
          )}

          {currentUser.permissions.cadastro && (
            <button
              onClick={() => setActiveTab('pacotes')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'pacotes'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-pacotes-desktop"
            >
              <Package className="h-4 w-4 shrink-0" />
              <span>Cadastro de Pacotes</span>
            </button>
          )}

          {(currentUser.permissions.cadastro || currentUser.permissions.folha || currentUser.permissions.relatorios) && (
            <>
              <div className="h-px bg-blue-800/40 my-4" />
              <p className="px-3 text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-2">Administração</p>
            </>
          )}

          {currentUser.permissions.cadastro && (
            <button
              onClick={() => setActiveTab('cadastro')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'cadastro'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-cadastro-desktop"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              <span>Cadastros Dinâmicos</span>
            </button>
          )}

          {currentUser.permissions.folha && (
            <button
              onClick={() => setActiveTab('folha')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'folha'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-folha-desktop"
            >
              <Receipt className="h-4 w-4 shrink-0" />
              <span>Folha Salarial & Recibos</span>
            </button>
          )}

          {currentUser.permissions.relatorios && (
            <button
              onClick={() => setActiveTab('relatorios')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'relatorios'
                  ? 'bg-white text-blue-900 shadow-md transform scale-[1.02]'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
              id="nav-tab-relatorios-desktop"
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span>Relatórios & Estratégia</span>
            </button>
          )}

          {/* Lixeira do Sistema no Sidebar */}
          <button
            onClick={() => setIsTrashOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 text-blue-100 hover:bg-blue-800/50 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
            id="nav-tab-lixeira-desktop"
          >
            <div className="flex items-center space-x-3">
              <Trash2 className="h-4 w-4 shrink-0 text-blue-200" />
              <span>Lixeira</span>
            </div>
            {lixeira.length > 0 && (
              <span className="bg-rose-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                {lixeira.length}
              </span>
            )}
          </button>

          {/* Botão de Backup Interno */}
          <button
            onClick={() => setIsBackupRestoreOpen(true)}
            className="w-full flex items-center space-x-3 px-4 py-3 text-blue-100 hover:bg-blue-800/50 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
            id="nav-tab-backup-desktop"
          >
            <FolderSync className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Backup & Restauração</span>
          </button>

          {/* Botão de Instalar App */}
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center space-x-3 px-4 py-3 text-blue-100 hover:bg-emerald-800/50 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer bg-emerald-700/10 border border-emerald-500/20"
            id="nav-tab-install-desktop"
          >
            <Smartphone className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Instalar Aplicativo (PWA) {deferredPrompt && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse inline-block ml-1" />}</span>
          </button>


        </div>

        {/* CARD INFERIOR SIMPLIFICADO */}
        <div className="p-4 border-t border-blue-950 bg-blue-950/20 text-center text-[10px] text-blue-300/60 font-bold tracking-wider">
          DIAMANTE LOG v2.5.1
        </div>
      </aside>

      {/* 2. HEADER MOBILE (APARECE APENAS EM DISPOSITIVOS MÓVEIS) */}
      <header className="bg-blue-900 text-white px-4 py-3.5 border-b border-blue-950 flex items-center justify-between md:hidden print:hidden shadow-md shrink-0" id="header-mobile">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1 px-2.5 py-1.5 rounded-lg bg-blue-950/40 text-white hover:bg-blue-800 border border-blue-800 shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div className="bg-white p-0.5 rounded-lg h-9 w-9 flex items-center justify-center shrink-0 shadow-sm">
              {defaultFilialLogo ? (
                <img 
                  src={defaultFilialLogo} 
                  alt="Logo" 
                  className="h-8 w-8 object-contain rounded-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <DiamondLogo className="h-7 w-7 text-blue-900" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-black font-heading tracking-tight text-white leading-tight uppercase truncate" title={defaultFilialName}>
                {defaultFilialName}
              </h1>
              <p className="text-[8px] font-black text-emerald-400 leading-none mt-1 tracking-wider uppercase">
                {activeTab === 'dashboard' && 'Painel Geral & BI'}
                {activeTab === 'expedicao' && 'Saída (Checkout Guia)'}
                {activeTab === 'baixas' && 'Baixa & Retorno'}
                {activeTab === 'em-rota' && 'Em Rota (Painel Ativo)'}
                {activeTab === 'cadastro' && 'Cadastros Dinâmicos'}
                {activeTab === 'folha' && 'Folha Salarial & Recibos'}
                {activeTab === 'relatorios' && 'Relatórios & Estratégia'}
                {activeTab === 'estoque' && 'Controle de Estoque'}
                {activeTab === 'pacotes' && 'Cadastro de Pacotes'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center space-x-1 bg-emerald-500/20 active:bg-emerald-500/30 px-2 py-1 rounded-md border border-emerald-500/30 text-emerald-300 font-bold text-[9px] cursor-pointer"
            title="Sincronizar PC & Celular"
          >
            <span className="h-1.5 w-1.5 inline-block rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Sincronizar</span>
          </button>

          <div className="flex items-center space-x-1.5 bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-805 shrink-0">
            <span className="h-1.5 w-1.5 inline-block rounded-full bg-emerald-400"></span>
            <span className="text-[9px] font-bold font-mono text-blue-200">@{currentUser.username}</span>
          </div>
        </div>
      </header>

      {/* 3. MENU LATERAL MÓVEL (DRAWER ANIMADO) */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="relative z-50 md:hidden" id="mobile-sidebar-drawer">
            {/* Backdrop escurecido */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black"
            />

            {/* Gaveta do Menu */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-80 bg-blue-900 text-white flex flex-col shadow-2xl"
            >
              {/* Topo do Menu Mobile */}
              <div className="p-5 border-b border-blue-950 flex items-center justify-between bg-blue-950/40">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-1 bg-white rounded-xl flex items-center justify-center shadow-md h-11 w-11 shrink-0">
                    {defaultFilialLogo ? (
                      <img 
                        src={defaultFilialLogo} 
                        alt="Logo" 
                        className="h-9 w-9 object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <DiamondLogo className="h-8 w-8 text-blue-900" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-black font-heading tracking-tight leading-snug text-white uppercase break-words" title={defaultFilialName}>
                      {defaultFilialName}
                    </h2>
                    <p className="text-[8px] font-black text-blue-200/80 leading-none mt-1 tracking-wider uppercase">
                      Sistema DIAMANTE LOG
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-blue-950 hover:bg-blue-800 text-blue-200 animate-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Botões do Menu Mobile filtrados */}
              <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                
                {currentUser.permissions.dashboard && (
                  <button
                    onClick={() => {
                      setActiveTab('dashboard');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'dashboard'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Painel Geral & BI</span>
                  </button>
                )}

                {currentUser.permissions.expedicao && (
                  <button
                    onClick={() => {
                      setActiveTab('expedicao');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'expedicao'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <Scan className="h-4 w-4" />
                    <span>Saída (Checkout Guia)</span>
                  </button>
                )}

                {currentUser.permissions.baixas && (
                  <button
                    onClick={() => {
                      setActiveTab('baixas');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'baixas'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Baixa & Retorno</span>
                  </button>
                )}

                {currentUser.permissions.emRota && (
                  <button
                    onClick={() => {
                      setActiveTab('em-rota');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'em-rota'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <Truck className="h-4 w-4" />
                    <span>Em Rota (Painel Ativo)</span>
                  </button>
                )}

                {(!currentUser.permissions || currentUser.permissions.estoque !== false) && (
                  <button
                    onClick={() => {
                      setActiveTab('estoque');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'estoque'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span>Controle de Estoque</span>
                  </button>
                )}

                {currentUser.permissions.cadastro && (
                  <button
                    onClick={() => {
                      setActiveTab('pacotes');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'pacotes'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <Package className="h-4 w-4" />
                    <span>Cadastro de Pacotes</span>
                  </button>
                )}

                {(currentUser.permissions.cadastro || currentUser.permissions.folha || currentUser.permissions.relatorios) && (
                  <div className="h-px bg-blue-800/40 my-4" />
                )}

                {currentUser.permissions.cadastro && (
                  <button
                    onClick={() => {
                      setActiveTab('cadastro');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'cadastro'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Cadastros Dinâmicos</span>
                  </button>
                )}

                {currentUser.permissions.folha && (
                  <button
                    onClick={() => {
                      setActiveTab('folha');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'folha'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <Receipt className="h-4 w-4" />
                    <span>Folha Salarial & Recibos</span>
                  </button>
                )}

                {currentUser.permissions.relatorios && (
                  <button
                    onClick={() => {
                      setActiveTab('relatorios');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all relative ${
                      activeTab === 'relatorios'
                        ? 'bg-white text-blue-900 shadow-md'
                        : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>Relatórios & Estratégia</span>
                  </button>
                )}

                {/* BOTÃO DA LIXEIRA PARA MOBILE */}
                <div className="h-px bg-blue-800/40 my-3" />
                <button
                  onClick={() => {
                    setIsTrashOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-rose-950/20 text-rose-200 border border-rose-800/25 hover:bg-rose-900/40 rounded-xl text-xs font-bold transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <Trash2 className="h-4 w-4 text-rose-400" />
                    <span>Lixeira do Sistema</span>
                  </div>
                  {lixeira.length > 0 && (
                    <span className="bg-rose-600 text-white font-mono text-[9px] px-2 py-0.5 rounded-full font-black">
                      {lixeira.length}
                    </span>
                  )}
                </button>

                {/* BACKUP E INSTALAÇÃO MOBILE */}
                <button
                  onClick={() => {
                    setIsBackupRestoreOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full mt-2 flex items-center space-x-3 px-4 py-3 bg-amber-950/20 text-amber-20 border border-amber-800/25 hover:bg-amber-900/40 rounded-xl text-xs font-bold transition-all text-blue-100"
                >
                  <FolderSync className="h-4 w-4 text-amber-400" />
                  <span>Backup & Restauração</span>
                </button>

                <button
                  onClick={() => {
                    handleInstallClick();
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full mt-2 flex items-center space-x-3 px-4 py-3 bg-emerald-950/25 text-emerald-20 border border-emerald-800/25 hover:bg-emerald-900/40 rounded-xl text-xs font-bold transition-all text-blue-100"
                >
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  <span>Instalar Aplicativo (PWA) {deferredPrompt && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse inline-block ml-0.5" />}</span>
                </button>


              </div>

              {/* INFO PROFILE MOBILE DRAWER COM SAIDA */}
              <div className="p-4 border-t border-blue-950 bg-blue-950/40 space-y-2.5 pb-6">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                    currentUser.isMaster ? 'bg-emerald-600 text-white' : 'bg-blue-800 text-blue-200'
                  }`}>
                    {currentUser.isMaster ? '👑' : currentUser.nomeCompleto.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white leading-none mb-0.5">{currentUser.nomeCompleto}</p>
                    <p className="text-[9px] text-blue-300 font-mono">@{currentUser.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    try {
                      sessionStorage.removeItem('logi_currentUser');
                      sessionStorage.removeItem('logi_sessionId');
                    } catch (_) {}
                    setCurrentUser(null);
                    setActiveTab('expedicao');
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-650 hover:bg-rose-700 rounded-xl text-xs font-bold text-white transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sair do Sistema</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. CONTEÚDO PRINCIPAL (OCUPA O ESPAÇO À DIREITA NO DESKTOP, EMBAIXO NO MOBILE) */}
      <div className="flex-1 flex flex-col min-w-0" id="app-workspace-container">
        
        {/* TOPBAR SECUNDÁRIA (BRANCO E AZUL) */}
        <header className="bg-white border-b border-sky-100 px-6 py-4 hidden md:flex items-center justify-between print:hidden" id="desktop-top-bar">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-sans">
              Setor
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-3.5 py-1 rounded-full font-bold font-heading uppercase tracking-wide border border-blue-100">
              {activeTab === 'dashboard' && 'Painel Geral & BI'}
              {activeTab === 'expedicao' && 'Saída (Checkout Guia)'}
              {activeTab === 'baixas' && 'Baixa & Retorno'}
              {activeTab === 'em-rota' && 'Em Rota (Painel Ativo)'}
              {activeTab === 'cadastro' && 'Cadastros Dinâmicos'}
              {activeTab === 'folha' && 'Folha Salarial & Recibos'}
              {activeTab === 'relatorios' && 'Relatórios & Estratégia'}
              {activeTab === 'estoque' && 'Controle de Estoque'}
              {activeTab === 'pacotes' && 'Cadastro de Pacotes'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser.permissions.tvPainel && (
              <button
                onClick={() => setIsTvMode(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs border border-blue-500 hover:from-blue-700 hover:to-indigo-750 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-150 cursor-pointer"
                id="btn-trigger-tv-mode-topbar"
              >
                <Tv className="h-4 w-4 text-white animate-pulse" />
                <span>Painel para TV (HDMI)</span>
              </button>
            )}
            
            {/* Indicador de Sincronia */}
            <button 
              onClick={() => setIsSyncModalOpen(true)}
              className={`flex items-center space-x-1.5 h-7 px-3 rounded-xl border cursor-pointer transition ${
                hasFirebasePermissionError 
                  ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200" 
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}
              title={
                hasFirebasePermissionError 
                  ? "Modo Off-line Ativo (falha de permissão no Firebase Firestore. Siga para o menu de sincronia para ver detalhes)" 
                  : "Sincronizar Computador & Celular"
              }
            >
              <span className={`h-2 w-2 rounded-full animate-pulse ${hasFirebasePermissionError ? "bg-amber-500" : "bg-emerald-500"}`}></span>
              <span className="text-[11px] font-bold">
                Logística Sync:{" "}
                <span className={hasFirebasePermissionError ? "text-amber-700 font-extrabold" : "text-emerald-700"}>
                  {hasFirebasePermissionError ? "Off-line Integrado" : "Nuvem Ativa"}
                </span>
              </span>
            </button>
          </div>
        </header>

        {/* ÁREA DE TRABALHO DAS SUB-VIEWS COM ANIMATION */}
        <main className="flex-1 p-4 md:p-8" id="app-workspace">
          {hasFirebasePermissionError && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-xs" id="firebase-permission-warning-banner">
              <div className="flex items-start md:items-center gap-3">
                <span className="text-lg leading-none">⚠️</span>
                <div>
                  <span className="font-bold block md:inline text-amber-800 text-[13px]">Atenção: Modo Off-line Integrado Ativo</span>
                  <div className="mt-1 md:mt-0 text-slate-700 leading-relaxed text-[11.5px]">
                    O banco de dados em nuvem do Firebase está ativo, mas retornou erro de permissão (<i>Missing or insufficient permissions</i>). 
                    O aplicativo ativou automaticamente o modo off-line e está operando de forma 100% segura, gravando os dados localmente no seu computador.
                  </div>
                </div>
              </div>
              <a 
                href="https://console.firebase.google.com/" 
                target="_blank" 
                rel="noreferrer"
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition uppercase tracking-wider text-center"
              >
                Configurar no Firebase Console
              </a>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.995, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.995, y: -5 }}
              transition={{ duration: 0.16 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && currentUser.permissions.dashboard && (
                <DashboardView 
                  empresas={empresas} 
                  entregadores={entregadores} 
                  expedicoes={expedicoes} 
                  rotas={rotas}
                  campanhaAtiva={campanhaAtiva}
                  onNavigate={(tab, entregadorId) => {
                    if (tab === 'baixas' && entregadorId) {
                      setSelectedEntregadorIdForBaixa(entregadorId);
                    }
                    setActiveTab(tab);
                  }}
                />
              )}

              {activeTab === 'expedicao' && currentUser.permissions.expedicao && (
                <ExpedicaoView 
                  empresas={empresas} 
                  entregadores={entregadores} 
                  rotas={rotas}
                  onAddExpedicao={handleAddExpedicao}
                  currentUser={currentUser}
                  filiais={filiais}
                  expedicoes={expedicoes}
                  conciliacoesDiarias={conciliacoesDiarias}
                />
              )}

              {activeTab === 'baixas' && currentUser.permissions.baixas && (
                <BaixaView 
                  empresas={empresas} 
                  entregadores={entregadores} 
                  expedicoes={expedicoes} 
                  onFinalizeExpedicao={handleFinalizeExpedicao}
                  syncExpedicoes={syncExpedicoes}
                  initialEntregadorId={selectedEntregadorIdForBaixa}
                  onClearInitialEntregadorId={() => setSelectedEntregadorIdForBaixa('')}
                  currentUser={currentUser}
                  filiais={filiais}
                  motivosDevolucao={motivosDevolucao}
                />
              )}

              {activeTab === 'em-rota' && currentUser.permissions.emRota && (
                <EmRotaView 
                  empresas={empresas} 
                  entregadores={entregadores} 
                  expedicoes={expedicoes}
                  rotas={rotas}
                  currentUser={currentUser}
                  filiais={filiais}
                  onOpenTvMode={() => setIsTvMode(true)}
                  onCancelExpedicao={handleCancelExpedicao}
                  onCancelAllExpedicoes={handleCancelAllExpedicoes}
                  syncExpedicoes={syncExpedicoes}
                  transferencias={transferencias}
                  retiradas={retiradas}
                />
              )}

              {activeTab === 'cadastro' && currentUser.permissions.cadastro && (
                <CadastroView 
                  empresas={empresas}
                  entregadores={entregadores}
                  rotas={rotas}
                  filiais={filiais}
                  onAddEmpresa={handleAddEmpresa}
                  onUpdateEmpresa={handleUpdateEmpresa}
                  onDeleteEmpresa={handleDeleteEmpresa}
                  onAddEntregador={handleAddEntregador}
                  onUpdateEntregador={handleUpdateEntregador}
                  onDeleteEntregador={handleDeleteEntregador}
                  onAddRota={handleAddRota}
                  onUpdateRota={handleUpdateRota}
                  onDeleteRota={handleDeleteRota}
                  onAddFilial={handleAddFilial}
                  onUpdateFilial={handleUpdateFilial}
                  onDeleteFilial={handleDeleteFilial}
                  
                  // Gestão de usuários
                  currentUser={currentUser}
                  usersList={users}
                  onUpdateUserPermissions={handleUpdateUserPermissions}
                  onAdminResetUserPassword={handleAdminResetUserPassword}
                  onUpdateUserEmail={handleUpdateUserEmail}
                  onDeleteUser={handleDeleteUser}
                  onUpdateSelfPassword={handleUpdateSelfPassword}
                  onRegisterUser={handleRegisterUser}
                  motivosDevolucao={motivosDevolucao}
                  onUpdateMotivos={handleUpdateMotivos}
                  
                  
                />
              )}

              {activeTab === 'pacotes' && currentUser.permissions.cadastro && (
                <PacotesView 
                  empresas={empresas}
                  filiais={filiais}
                  currentUser={currentUser}
                  conciliacoesDiarias={conciliacoesDiarias}
                  onUpdateConciliacao={handleUpdateConciliacao}
                />
              )}

              {activeTab === 'folha' && currentUser.permissions.folha && (
                <FolhaSalarialView 
                  empresas={empresas} 
                  entregadores={entregadores} 
                  expedicoes={expedicoes}
                  currentUser={currentUser}
                  filiais={filiais}
                  vales={vales}
                  onAddVale={handleAddVale}
                  onDeleteVale={handleDeleteVale}
                  recibos={recibos}
                  onAddRecibo={handleAddRecibo}
                  onDeleteRecibo={handleDeleteRecibo}
                />
              )}

              {activeTab === 'relatorios' && currentUser.permissions.relatorios && (
                <RelatoriosView 
                  empresas={empresas} 
                  entregadores={entregadores} 
                  expedicoes={expedicoes}
                  currentUser={currentUser}
                  filiais={filiais}
                />
              )}

              {activeTab === 'estoque' && (!currentUser.permissions || currentUser.permissions.estoque !== false) && (
                <EstoqueView 
                  empresas={empresas} 
                  entregadores={entregadores} 
                  expedicoes={expedicoes}
                  rotas={rotas}
                  currentUser={currentUser}
                  filiais={filiais}
                  estoque={estoque}
                  movimentacoesEstoque={movimentacoesEstoque}
                  onUpdateEstoque={handleUpdateEstoque}
                  usersList={users}
                  conciliacoesDiarias={conciliacoesDiarias}
                  onUpdateConciliacao={handleUpdateConciliacao}
                  onClearTodayExpedicoes={handleClearTodayExpedicoes}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* RODAPÉ DO CONTEÚDO */}
        <footer className="bg-white border-t border-sky-100 text-slate-500 text-xs py-4 px-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 print:hidden" id="app-footer">
          <div className="flex items-center space-x-2 text-slate-600 font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>DIAMANTE LOG & Distribuição © 2026. Todos os direitos reservados.</span>
          </div>
          <div className="flex gap-4 font-medium">
            <a href="mailto:diamantelogsystem@gmail.com" className="hover:text-blue-600 transition underline">Atendimento Suporte</a>
            <span className="text-slate-300">|</span>
            <span>Estilo Azul e Branco Ativo</span>
          </div>
        </footer>

      </div>

      {isTvMode && currentUser.permissions.tvPainel && (
        <TvPainelView
          empresas={empresas}
          entregadores={entregadores}
          expedicoes={expedicoes}
          rotas={rotas}
          currentUser={currentUser}
          filiais={filiais}
          campanhaAtiva={campanhaAtiva}
          onClose={() => setIsTvMode(false)}
        />
      )}

      {/* 5. MODAL DE VISUALIZAÇÃO E SUBSTITUIÇÃO DA FOTO DO PERFIL */}
      <AnimatePresence>
        {profileModalOpen && currentUser && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 shadow-2xl" id="modal-profile-photo-change">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProfileModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white w-full max-w-sm rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden z-10"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-6 text-white text-center relative">
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition cursor-pointer"
                  title="Fechar"
                  id="btn-close-profile-modal"
                >
                  <X className="h-4 w-4" />
                </button>
                <h3 className="font-bold text-lg font-heading">Foto de Perfil</h3>
                <p className="text-xs text-blue-200 mt-1 uppercase tracking-wider font-semibold">@{currentUser.username}</p>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col items-center">
                
                {/* Large Profile Visualizer */}
                <div className="relative group mb-6">
                  {currentUser.foto ? (
                    <img
                      src={currentUser.foto}
                      alt={currentUser.nomeCompleto}
                      className="w-36 h-36 rounded-full object-cover border-4 border-slate-50 shadow-lg ring-4 ring-blue-50"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-36 h-36 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-lg border-4 border-slate-50 ring-4 ring-blue-50 ${
                      currentUser.isMaster ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      {currentUser.isMaster ? '👑' : currentUser.nomeCompleto.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  {/* Overlay camera button on visualizer */}
                  <button
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg border border-white hover:scale-105 transition cursor-pointer"
                    title="Carregar nova foto"
                    id="btn-upload-camera-overlay"
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                </div>

                {/* User Info details */}
                <div className="text-center mb-6">
                  <h4 className="font-bold text-slate-800 text-md leading-tight">{currentUser.nomeCompleto}</h4>
                  <p className="text-xs text-slate-400 mt-1">{currentUser.email}</p>
                  {currentUser.isMaster && (
                    <span className="inline-block mt-2 text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Acesso Master
                    </span>
                  )}
                </div>
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={profilePhotoInputRef}
                  accept="image/*"
                  onChange={handleProfilePhotoChange}
                  className="hidden"
                  id="profile-photo-file-input"
                />

                {/* Action buttons */}
                <div className="w-full space-y-2">
                  <button
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition duration-150 cursor-pointer border border-blue-700"
                    id="btn-substitute-photo"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Substituir Foto</span>
                  </button>

                  {currentUser.foto && (
                    <button
                      onClick={handleRemoveProfilePhoto}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 hover:bg-rose-150 text-rose-600 hover:text-rose-700 font-bold text-xs rounded-xl transition duration-150 cursor-pointer border border-rose-100"
                      id="btn-remove-photo"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Remover Foto</span>
                    </button>
                  )}

                  <button
                    onClick={() => setProfileModalOpen(false)}
                    className="w-full py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition duration-150 cursor-pointer border border-slate-200"
                    id="btn-cancel-photo-edit"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL DA LIXEIRA DO SISTEMA */}
      <AnimatePresence>
        <LixeiraModal
          isOpen={isTrashOpen}
          onClose={() => setIsTrashOpen(false)}
          lixeira={lixeira}
          onRestore={handleRestoreFromTrash}
          onPermanentDelete={handlePermanentlyDeleteFromTrash}
          onEmptyTrash={handleEmptyTrash}
        />
      </AnimatePresence>

      {/* 7. MODAL DE BACKUP E RESTAURAÇÃO DE DADOS */}
      <AnimatePresence>
        {isBackupRestoreOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" id="modal-backup-container">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
              id="modal-backup-card"
            >
              {/* Header */}
              <div className="bg-blue-900 p-5 text-white relative">
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderSync className="h-6 w-6 text-amber-400" />
                    <div>
                      <h3 className="text-xs font-extrabold tracking-tight">Cópia de Segurança</h3>
                      <p className="text-blue-200 text-[10px] font-bold">Esquema Interno DIAMANTE LOG</p>
                    </div>
                  </div>
                  {!isImporting && (
                    <button
                      onClick={() => setIsBackupRestoreOpen(false)}
                      className="p-1 rounded-lg bg-blue-950/40 text-blue-200 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Corpo */}
              <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
                {backupSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl text-center">
                    {backupSuccessMsg}
                  </div>
                )}
                {backupErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-205 text-rose-700 text-xs font-semibold rounded-xl text-center">
                    {backupErrorMsg}
                  </div>
                )}

                {isImporting ? (
                  <div className="p-4 flex flex-col items-center justify-center space-y-5 py-8 animate-fade-in text-center">
                    <div className="relative flex items-center justify-center">
                      {/* Outer animated rotating border */}
                      <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-100 border-t-amber-500"></div>
                      <span className="absolute text-sm font-black text-slate-800 font-mono">
                        {importProgress}%
                      </span>
                    </div>
                    <div className="space-y-1.5 w-full">
                      <p className="text-xs font-extrabold text-slate-800 tracking-tight">
                        {importStep || "Carregando..."}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold max-w-[200px] mx-auto leading-normal">
                        Não feche o navegador ou mude de aba até o término da gravação.
                      </p>
                    </div>
                    {/* Horizontal progress bar with modern styling */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-50 relative shadow-inner">
                      <div 
                        className="bg-amber-500 h-full transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${importProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : !pendingBackupData ? (
                  <>
                    {/* Cloud Database Backup Section (Master Only) */}
                    {currentUser?.isMaster && (
                      <div className="p-4 bg-indigo-50/65 rounded-2xl border border-indigo-100/50 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-indigo-700 shrink-0" />
                            <span className="text-[11px] font-black text-indigo-900 uppercase tracking-tight">Cópia de Segurança na Nuvem</span>
                          </div>
                          <span className="text-[9px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                            D1 Nuvem
                          </span>
                        </div>

                        <div className="bg-white/90 p-3 rounded-xl border border-indigo-100/30 text-left">
                          {backupHistory?.lastBackupTime ? (
                            <p className="text-[11.5px] text-slate-700 leading-normal font-semibold">
                              Lançamento do Último Backup:<br />
                              <span className="text-indigo-700 font-mono font-black text-[11px] block mt-0.5">
                                {new Date(backupHistory.lastBackupTime).toLocaleDateString('pt-BR')} às {new Date(backupHistory.lastBackupTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[9px] text-slate-400 block font-bold leading-normal mt-1">
                                {backupHistory.auto ? "✓ Registrado automaticamente pelo sistema" : "✓ Realizado manualmente por administrador"}
                              </span>
                            </p>
                          ) : (
                            <p className="text-[10px] text-amber-700 font-bold leading-normal flex items-center gap-1">
                              <span>⚠ Nenhum backup em nuvem registrado de imediato.</span>
                            </p>
                          )}
                        </div>

                        {/* List of 7-day rolling backups */}
                        <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-100/30 text-left space-y-2">
                          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-tight block px-0.5 border-b border-indigo-100 pb-1">
                            pontos de restauração (Últimos 7 dias rotativos)
                          </span>
                          {backupHistory?.backups && backupHistory.backups.length > 0 ? (
                            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5">
                              {backupHistory.backups.map((slot: any) => (
                                <div 
                                  key={slot.dayName} 
                                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 border border-slate-100/55 text-[11px] font-medium text-slate-700"
                                >
                                  <div className="flex flex-col">
                                    <span className="capitalize font-extrabold text-indigo-950">
                                      {slot.dayName}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-400">
                                      {new Date(slot.lastBackupTime).toLocaleDateString('pt-BR')} às {new Date(slot.lastBackupTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      {slot.auto ? " (Auto)" : " (Manual)"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      if (isBackupLoading) return;
                                      if (confirm(`ATENÇÃO: Deseja restaurar os dados gravados no backup de ${slot.dayName}? Isso substituirá todas as informações correntes do banco de dados.`)) {
                                        try {
                                          await restoreDatabaseFromBackupSlot(slot.dayName);
                                          alert("Banco de dados D1 restaurado e sincronizado com sucesso absoluto!");
                                        } catch (e) {
                                          alert("Falha na restauração do backup.");
                                        }
                                      }
                                    }}
                                    disabled={isBackupLoading}
                                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 disabled:opacity-40 font-extrabold text-[9px] rounded-md transition cursor-pointer"
                                  >
                                    Restaurar
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-bold leading-normal p-1 italic">
                              Nenhum ponto de restauração gravado nos slots ainda. Gere o primeiro backup manual ou aguarde o auto-backup diário!
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1">
                          <button
                            onClick={async () => {
                              if (isBackupLoading) return;
                              try {
                                await triggerDatabaseBackup(false);
                                alert("Cópia de segurança gerada com sucesso e sincronizada no Cloud D1!");
                              } catch (e) {
                                alert("Incapaz de registrar backup no D1.");
                              }
                            }}
                            disabled={isBackupLoading}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-[11px] rounded-xl transition cursor-pointer"
                          >
                            <RefreshCcw className={`h-3 w-3 shrink-0 ${isBackupLoading ? 'animate-spin' : ''}`} />
                            <span>Gerar Novo Backup Manual em Nuvem (D1)</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-500 leading-relaxed font-semibold text-center my-1.5">
                      Você também pode exportar um arquivo JSON completo das suas coleções ou importar uma cópia offline local:
                    </p>

                    {/* Seção 1: Exportação */}
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-blue-800" />
                        <span className="text-[11px] font-black text-blue-900">Gerar Nova Cópia (Backup)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                        Exporta todas as filiais, rotas, entregas e usuários em um arquivo consolidado <code className="bg-blue-100 text-blue-700 px-1 rounded font-bold font-mono">.json</code>.
                      </p>
                      <button
                        onClick={handleExportBackup}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-lg transition duration-155 cursor-pointer"
                      >
                        Baixar Cópia (.json)
                      </button>
                    </div>

                    {/* Seção 2: Importação */}
                    <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-amber-800" />
                        <span className="text-[11px] font-black text-amber-900">Restaurar Cópia Anterior</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                        Escolha um arquivo de backup para restaurar informações na nuvem em tempo real.
                      </p>
                      <label className="block">
                        <div className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] rounded-lg text-center cursor-pointer transition duration-155">
                          Upload & Carregar Backup
                        </div>
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleSelectFileForBackupMsg(file);
                            }
                            e.target.value = ''; // Reset input to allow re-upload
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-4 text-center animate-fade-in">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 mx-auto border border-amber-200">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-amber-900 uppercase">Confirmar Restauração?</h4>
                      <p className="text-[10px] text-slate-650 font-semibold leading-relaxed mt-2.5">
                        Esta operação irá restaurar todos os cadastros e dados contidos no arquivo diretamente na nuvem sincronizada do DIAMANTE LOG.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => executeBackupRestore(pendingBackupData)}
                        className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition"
                      >
                        Sim, Restaurar
                      </button>
                      <button
                        onClick={() => setPendingBackupData(null)}
                        className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-750 text-[11px] font-bold rounded-lg cursor-pointer transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsBackupRestoreOpen(false)}
                  disabled={isImporting}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-black rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. MODAL DE AJUDA PARA SINCRONIZAÇÃO ENTRE DISPOSITIVOS */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" id="modal-sync-container">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col"
              id="modal-sync-box"
            >
              {/* Cabeçalho */}
              <div className="p-5 border-b border-slate-50 bg-sky-50/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                      <FolderSync className="h-4.5 w-4.5 animate-spin-slow" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-blue-900 uppercase tracking-wide">
                        Sincronização de Dispositivos
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold m-0">
                        Como acessar o mesmo banco de dados no PC e Celular
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSyncModalOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-150 text-slate-400 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-6 space-y-5 text-center max-h-[80vh] overflow-y-auto">
                <div className="text-[11px] font-semibold text-slate-550 leading-relaxed text-left bg-emerald-500/5 p-4 rounded-2xl border border-emerald-400/20">
                  ⚠️ <strong className="text-emerald-800">Regra de Conectividade:</strong> Para visualizar os mesmos usuários, saídas, guias, folhas salariais e todos os registros no computador e no celular, você precisa estar acessando <strong className="text-blue-900">exatamente o mesmo endereço (Link)</strong> em ambos os dispositivos. Se usar links diferentes (como os links provisórios dev e pre-), os dados ficarão em bancos celulares separados!
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5">
                  <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1 w-full justify-center">
                    <QrCode className="h-4 w-4 text-blue-700" /> Abra no celular via QR Code
                  </span>
                  
                  <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-150 relative">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`} 
                      alt="QR Code de Sincronia" 
                      className="h-44 w-44 object-contain rounded-md"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <p className="text-[9px] text-slate-400 font-bold leading-normal max-w-[280px]">
                    Aponte a câmera do seu celular para este QR Code para abrir instantaneamente o sistema com o mesmo banco de dados sincronizado.
                  </p>
                </div>

                {/* Copiar Link */}
                <div className="space-y-2.5 text-left">
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                    <Laptop className="h-4 w-4 text-slate-500" /> Link do Servidor Ativo
                  </span>
                  
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-100 text-slate-700 font-mono text-[10px] p-2.5 rounded-xl truncate font-bold border border-slate-200">
                      {window.location.href}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Link de sincronia copiado com sucesso absoluto!");
                      }}
                      className="px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl flex items-center justify-center cursor-pointer transition gap-1.5"
                      title="Copiar Link"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="text-[11px] font-black">Copiar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Rodapé */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsSyncModalOpen(false)}
                  className="px-5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-black rounded-lg cursor-pointer transition"
                >
                  Confirmado
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
