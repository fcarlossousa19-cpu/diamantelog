/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Upload, 
  Check, 
  Search, 
  Trash2, 
  Plus, 
  AlertCircle, 
  Building2, 
  Calendar, 
  X, 
  FileCheck, 
  Database, 
  ListChecks,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType, cleanBarcode, collection, doc, setDoc, deleteDoc, query, where, onSnapshot, writeBatch } from '../lib/supabase';
import { Empresa, Filial, ConciliacaoDiaria, User as SystemUser } from '../types';

export interface PacoteCadastrado {
  id: string; // codigoBarras_empresaId_data
  codigoBarras: string;
  empresaId: string;
  filialId: string;
  data: string; // YYYY-MM-DD
  registradoEm: string;
  usuarioNome: string;
}

export function getPacoteId(code: string, empresaId: string, date: string): string {
  // Substitui caracteres que são separadores de caminho ou inválidos no Firestore (/, \, #, $, ?, [, ], espaço) por hífen
  const sanitizedCode = code.trim().replace(/[\/\\#\$\?\[\]\s]/g, '-').toUpperCase();
  return `${sanitizedCode}_${empresaId}_${date}`;
}

interface PacotesViewProps {
  empresas: Empresa[];
  filiais: Filial[];
  currentUser: SystemUser;
  conciliacoesDiarias: ConciliacaoDiaria[];
  onUpdateConciliacao: (conciliacao: ConciliacaoDiaria) => Promise<void> | void;
}

export default function PacotesView({
  empresas,
  filiais,
  currentUser,
  conciliacoesDiarias,
  onUpdateConciliacao
}: PacotesViewProps) {
  // Sincronizar Filiais Permitidas do Usuário
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
    const permittedIds = currentUser.filiais || [];
    if (permittedIds.length > 0) return permittedIds[0];
    return (filiais && filiais.length > 0) ? filiais[0].id : '';
  });

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Manual input
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded packages from DB
  const [packages, setPackages] = useState<PacoteCadastrado[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Excel parsing states
  const [fileDetails, setFileDetails] = useState<{ name: string; size: number } | null>(null);
  const [excelDataRows, setExcelDataRows] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedColIndex, setSelectedColIndex] = useState<number>(-1);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Feedback
  const [errorFeedback, setErrorFeedback] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen to registered packages for selected Filial and Date
  useEffect(() => {
    if (!selectedFilialId || !selectedDate) {
      setPackages([]);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'pacotes_cadastrados'),
      where('filialId', '==', selectedFilialId),
      where('data', '==', selectedDate)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: PacoteCadastrado[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as PacoteCadastrado);
      });
      // Sort by registered timestamp
      list.sort((a, b) => new Date(b.registradoEm).getTime() - new Date(a.registradoEm).getTime());
      setPackages(list);
      setIsLoading(false);
    }, (err) => {
      console.error("Erro ao escutar pacotes cadastrados: ", err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [selectedFilialId, selectedDate]);

  // Filtering packages locally by search query and company
  const filteredPackages = useMemo(() => {
    return packages.filter(p => {
      const matchCompany = selectedEmpresaId ? p.empresaId === selectedEmpresaId : true;
      const matchQuery = searchQuery.trim() 
        ? p.codigoBarras.toUpperCase().includes(searchQuery.toUpperCase())
        : true;
      return matchCompany && matchQuery;
    });
  }, [packages, selectedEmpresaId, searchQuery]);

  // Play Beep Sound helper
  const playWebBeep = (freq = 800, dur = 0.1) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Parse Excel/CSV file with xlsx library
  const processFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setErrorFeedback("Formato de arquivo inválido. Por favor, envie um arquivo Excel (.xlsx, .xls) ou CSV.");
      setTimeout(() => setErrorFeedback(''), 5000);
      return;
    }

    setFileDetails({ name: file.name, size: file.size });
    setErrorFeedback('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const isCsv = ext === 'csv';
        
        // Se for CSV, lemos como texto bruto para não fazer parse automático de números longos em floats (evitando perda de precisão)
        // Se for Excel (xlsx, xls), ativamos leituras de metadados para podermos obter valores formatados
        const workbook = XLSX.read(data, { 
          type: 'binary',
          raw: isCsv,
          cellNF: true,
          cellText: true,
          cellDates: true
        });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays (matrix)
        // No CSV, mantemos 'raw' para pegar os textos puros. No Excel, raw: false faz com que prefira o texto formatado (.w) ao valor cru (.v) em ponto flutuante
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { 
          header: 1,
          raw: isCsv,
          defval: ''
        });
        
        if (rows.length === 0) {
          setErrorFeedback("A planilha parece estar vazia.");
          resetFileState();
          return;
        }

        setExcelDataRows(rows);

        // Descobre a quantidade máxima de colunas em qualquer linha do Excel para garantir que não vamos perder nenhuma coluna
        let maxCols = 0;
        rows.forEach(r => {
          if (Array.isArray(r) && r.length > maxCols) {
            maxCols = r.length;
          }
        });

        // Detect columns and headers
        const parsedHeaders: string[] = [];
        const firstRow = rows[0] || [];
        
        for (let i = 0; i < maxCols; i++) {
          const val = firstRow[i];
          parsedHeaders.push(val ? String(val).trim() : `Coluna ${i + 1}`);
        }
        setHeaders(parsedHeaders);

        // Smart column index detection (looks for "codigo", "barras", "barcode", "vol", etc.)
        let detectedIndex = -1;
        for (let i = 0; i < parsedHeaders.length; i++) {
          const lowerHeader = parsedHeaders[i].toLowerCase();
          if (
            lowerHeader.includes('cod') || 
            lowerHeader.includes('barr') || 
            lowerHeader.includes('barc') || 
            lowerHeader.includes('pack') || 
            lowerHeader.includes('volume') ||
            lowerHeader.includes('rastre') ||
            lowerHeader.includes('etiquet')
          ) {
            detectedIndex = i;
            break;
          }
        }

        // Se não encontrou por palavra-chave do cabeçalho, escaneia as primeiras linhas para identificar a coluna com códigos válidos
        if (detectedIndex === -1 && rows.length > 0) {
          const colScores = new Array(maxCols).fill(0);
          const scanRowsCount = Math.min(10, rows.length);
          for (let r = 0; r < scanRowsCount; r++) {
            const row = rows[r];
            if (Array.isArray(row)) {
              for (let c = 0; c < row.length; c++) {
                const val = row[c] ? String(row[c]).trim() : '';
                // Códigos de rastreio ou barras geralmente possuem caracteres alfanuméricos e tamanho >= 6
                if (val && val.length >= 6 && /^[A-Z0-9\-_]+$/i.test(val)) {
                  colScores[c] += 1;
                }
              }
            }
          }
          let bestCol = 0;
          let maxScore = -1;
          for (let c = 0; c < colScores.length; c++) {
            if (colScores[c] > maxScore) {
              maxScore = colScores[c];
              bestCol = c;
            }
          }
          if (maxScore > 0) {
            detectedIndex = bestCol;
          }
        }

        if (detectedIndex === -1) {
          detectedIndex = 0;
        }

        setSelectedColIndex(detectedIndex);
        playWebBeep(600, 0.05);
      } catch (err) {
        console.error(err);
        setErrorFeedback("Ocorreu um erro ao decodificar a planilha do Excel.");
        resetFileState();
      }
    };

    reader.readAsBinaryString(file);
  };

  const resetFileState = () => {
    setFileDetails(null);
    setExcelDataRows([]);
    setHeaders([]);
    setSelectedColIndex(-1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Extract barcode values from selected column index
  const extractedBarcodes = useMemo(() => {
    if (excelDataRows.length === 0 || selectedColIndex === -1) return [];
    
    const codes: string[] = [];
    
    // Check if the first row at selectedColIndex is a header
    const firstRowVal = excelDataRows[0] && excelDataRows[0][selectedColIndex] 
      ? String(excelDataRows[0][selectedColIndex]).trim().toLowerCase() 
      : '';
    const isFirstRowHeader = ['cod', 'barr', 'rastr', 'etiquet', 'volume', 'pack', 'id', 'coluna'].some(keyword => 
      firstRowVal.includes(keyword)
    );
    const startIndex = isFirstRowHeader ? 1 : 0;

    for (let i = startIndex; i < excelDataRows.length; i++) {
      const row = excelDataRows[i];
      if (row && row[selectedColIndex] !== undefined && row[selectedColIndex] !== null) {
        const val = cleanBarcode(String(row[selectedColIndex]));
        if (val && val.length >= 4) {
          codes.push(val);
        }
      }
    }
    return Array.from(new Set(codes)); // Remove duplicates in Excel
  }, [excelDataRows, selectedColIndex]);

  // Handle Manual code scan/submitting
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFilialId) {
      setErrorFeedback("Você precisa selecionar uma Filial ativa primeiro!");
      setTimeout(() => setErrorFeedback(''), 4000);
      return;
    }
    if (!selectedEmpresaId) {
      setErrorFeedback("Você precisa selecionar a Empresa parceira antes!");
      setTimeout(() => setErrorFeedback(''), 4000);
      return;
    }
    if (!barcodeInput.trim()) return;

    const code = cleanBarcode(barcodeInput);

    // Check duplicate
    const isDuplicate = packages.some(p => p.codigoBarras === code && p.empresaId === selectedEmpresaId);
    if (isDuplicate) {
      playWebBeep(350, 0.25);
      setErrorFeedback(`O pacote "${code}" já está cadastrado para esta empresa hoje!`);
      setTimeout(() => setErrorFeedback(''), 4000);
      setBarcodeInput('');
      return;
    }

    const docId = getPacoteId(code, selectedEmpresaId, selectedDate);
    const payload: PacoteCadastrado = {
      id: docId,
      codigoBarras: code,
      empresaId: selectedEmpresaId,
      filialId: selectedFilialId,
      data: selectedDate,
      registradoEm: new Date().toISOString(),
      usuarioNome: currentUser.nomeCompleto || currentUser.username
    };

    try {
      await setDoc(doc(db, 'pacotes_cadastrados', payload.id), payload);
      
      // Update count in STOCK control automatically (increase by 1)
      const matchesOfThisCompanyAndDay = packages.filter(p => p.empresaId === selectedEmpresaId).length + 1;
      
      const conciliacaoId = `${selectedDate}_${selectedFilialId}_${selectedEmpresaId}`;
      const newConciliacao: ConciliacaoDiaria = {
        id: conciliacaoId,
        data: selectedDate,
        filialId: selectedFilialId,
        empresaId: selectedEmpresaId,
        quantidadePatio: matchesOfThisCompanyAndDay,
        dataHoraAtualizacao: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username
      };

      await onUpdateConciliacao(newConciliacao);

      playWebBeep(920, 0.08);
      setSuccessFeedback(`Pacote ${code} cadastrado e estoque atualizado!`);
      setTimeout(() => setSuccessFeedback(''), 3000);
      setBarcodeInput('');
    } catch (err: any) {
      console.error(err);
      setErrorFeedback("Erro ao registrar o pacote no banco.");
    }
  };

  // Import Action triggered on submiting Excel spreadsheet
  const handleImportExcelData = async () => {
    if (!selectedFilialId) {
      setErrorFeedback("Selecione a Filial ativa antes de continuar.");
      return;
    }
    if (!selectedEmpresaId) {
      setErrorFeedback("⚠️ IMPORTANTE: Selecione a Empresa para a qual os códigos pertencem!");
      return;
    }
    if (extractedBarcodes.length === 0) {
      setErrorFeedback("Não há códigos de barras válidos extraídos para importar.");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setErrorFeedback('');
    setSuccessFeedback('');

    const totalCount = extractedBarcodes.length;
    const batchSize = 100; // Chunk into smaller chunks to provide real-time progression visual bar
    const chunks: string[][] = [];
    
    for (let i = 0; i < totalCount; i += batchSize) {
      chunks.push(extractedBarcodes.slice(i, i + batchSize));
    }

    try {
      let importedCount = 0;
      
      // We process batches nicely
      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const storeBatch = writeBatch(db);

        chunk.forEach(code => {
          const docId = getPacoteId(code, selectedEmpresaId, selectedDate);
          const itemDocRef = doc(db, 'pacotes_cadastrados', docId);
          const payload: PacoteCadastrado = {
            id: docId,
            codigoBarras: code,
            empresaId: selectedEmpresaId,
            filialId: selectedFilialId,
            data: selectedDate,
            registradoEm: new Date().toISOString(),
            usuarioNome: currentUser.nomeCompleto || currentUser.username
          };
          storeBatch.set(itemDocRef, payload);
        });

        // Commit batch chunk
        await storeBatch.commit();
        importedCount += chunk.length;
        setImportProgress(Math.min(95, Math.round((importedCount / totalCount) * 100)));
      }

      // Query database again or rely on snapshot count
      // To get accurate final count of registered packages of this company of this selected date
      // We can read from our updated packages list. Note: snapshot listener will trigger,
      // but to be perfectly synchronous we compute total count:
      const existingAllPacotesForCompany = packages.filter(p => p.empresaId === selectedEmpresaId && p.data === selectedDate);
      const combinedCodesSet = new Set([
        ...existingAllPacotesForCompany.map(p => p.codigoBarras),
        ...extractedBarcodes
      ]);
      const finalActiveTotalCountForStock = combinedCodesSet.size;

      // Update Conciliacao de Estoque with the total imported count!
      const conciliacaoId = `${selectedDate}_${selectedFilialId}_${selectedEmpresaId}`;
      const newConciliacao: ConciliacaoDiaria = {
        id: conciliacaoId,
        data: selectedDate,
        filialId: selectedFilialId,
        empresaId: selectedEmpresaId,
        quantidadePatio: finalActiveTotalCountForStock,
        dataHoraAtualizacao: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username
      };

      await onUpdateConciliacao(newConciliacao);

      setImportProgress(100);
      playWebBeep(1000, 0.15);
      
      setSuccessFeedback(`Sucesso absoluta! Relação de ${totalCount} pacotes cadastrada na base de dados! O estoque da empresa foi atualizado para ${finalActiveTotalCountForStock} pacotes para o dia de hoje.`);
      resetFileState();
    } catch (err: any) {
      console.error(err);
      let errMsg = "Desconhecido";
      if (err instanceof Error) {
        errMsg = err.message;
      } else if (err && typeof err === 'object') {
        errMsg = JSON.stringify(err);
      } else if (err) {
        errMsg = String(err);
      }
      setErrorFeedback(`Ocorreu um erro ao salvar o lote na base: ${errMsg}`);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'pacotes_cadastrados');
      } catch (e) {
        // catch the thrown error from handler
      }
    } finally {
      setTimeout(() => {
        setIsImporting(false);
      }, 1000);
    }
  };

  // Delete individual code
  const handleDeletePackage = async (p: PacoteCadastrado) => {
    if (!confirm(`Sabe que isso removerá o código "${p.codigoBarras}" da base? O estoque será recalculado.`)) return;

    try {
      await deleteDoc(doc(db, 'pacotes_cadastrados', p.id));
      
      // Decrement quantity in stock control
      const newQty = Math.max(0, packages.filter(x => x.empresaId === p.empresaId).length - 1);
      
      const conciliacaoId = `${p.data}_${p.filialId}_${p.empresaId}`;
      const newConciliacao: ConciliacaoDiaria = {
        id: conciliacaoId,
        data: p.data,
        filialId: p.filialId,
        empresaId: p.empresaId,
        quantidadePatio: newQty,
        dataHoraAtualizacao: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username
      };

      await onUpdateConciliacao(newConciliacao);

      setSuccessFeedback("Pacote excluído e estoque reescalonado!");
      setTimeout(() => setSuccessFeedback(''), 2500);
    } catch (e) {
      console.error(e);
      setErrorFeedback("Erro ao remover o pacote.");
    }
  };

  // Clean entire list of packages for the selected date, filial and company
  const handleZerarDia = async () => {
    if (!selectedEmpresaId) {
      alert("Por favor, selecione uma empresa primeiro.");
      return;
    }
    const empName = empresas.find(e => e.id === selectedEmpresaId)?.nome || "Empresa";
    if (!confirm(`🚨 CUIDADO EXTREMO! Tem certeza absoluta que deseja LIMPAR TODOS os pacotes cadastrados para a empresa [${empName}] na data [${selectedDate}]? Isso redefinirá a quantidade do Controle de Estoque para ZERO.`)) return;

    setIsLoading(true);
    try {
      const targets = packages.filter(p => p.empresaId === selectedEmpresaId);
      
      // Batch delete
      if (targets.length > 0) {
        const batch = writeBatch(db);
        targets.forEach(p => {
          batch.delete(doc(db, 'pacotes_cadastrados', p.id));
        });
        await batch.commit();
      }

      // Update Stock to 0
      const conciliacaoId = `${selectedDate}_${selectedFilialId}_${selectedEmpresaId}`;
      const newConciliacao: ConciliacaoDiaria = {
        id: conciliacaoId,
        data: selectedDate,
        filialId: selectedFilialId,
        empresaId: selectedEmpresaId,
        quantidadePatio: 0,
        dataHoraAtualizacao: new Date().toISOString(),
        usuarioNome: currentUser.nomeCompleto || currentUser.username
      };

      await onUpdateConciliacao(newConciliacao);
      playWebBeep(300, 0.35);
      setSuccessFeedback(`Todos os cadastros do dia para [${empName}] foram zerados.`);
      setTimeout(() => setSuccessFeedback(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorFeedback("Erro ao limpar dados do dia.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="view-cadastro-pacotes">
      
      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3.5 py-1 rounded-full text-xs font-bold font-heading uppercase tracking-wide border border-blue-105">
            <Sparkles className="h-3 w-3" /> Cadastro de Carga Externa
          </div>
          <h2 className="text-xl font-extrabold text-slate-850 tracking-tight">
            Importação & Registro Geral de Volumes
          </h2>
          <p className="text-xs text-slate-400 font-semibold max-w-2xl">
            Cadastre os códigos de barras manualmente ou faça a importação automatizada de dados em lote vindos de arquivos em planilhas Excel para sincronização em tempo real do Controle de Estoque do dia.
          </p>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filial */}
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Filial Ativa</span>
            <select
              value={selectedFilialId}
              onChange={(e) => setSelectedFilialId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:ring-1 focus:ring-blue-550 cursor-pointer outline-hidden min-w-[140px]"
              id="select-filial-pacotes"
            >
              <option value="">Selecione...</option>
              {userPermittedFiliais.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          {/* Data Carga */}
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Data da Carga</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-750 px-3 py-2 rounded-xl focus:ring-1 focus:ring-blue-550 cursor-pointer outline-hidden"
              id="input-date-pacotes"
            />
          </div>
        </div>
      </div>

      {/* FEEDBACKS */}
      <AnimatePresence>
        {errorFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0 }}
            className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs"
            id="panel-error-pacotes"
          >
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <span>{errorFeedback}</span>
          </motion.div>
        )}
        {successFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0 }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs"
            id="panel-success-pacotes"
          >
            <FileCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>{successFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA: CADASTRADORES E ARQUIVOS (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SELETOR DE EMPRESA COBRADO CONECTADO */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-50 p-2 rounded-xl">
                <Building2 className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="font-extrabold text-slate-850 text-sm">
                Empresa Parceira Responsável (Obrigatório)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Define a qual empresa parceira de logística pertencem estes volumes. O estoque diário correspondente a essa empresa será auto-preenchido com a quantidade final de códigos importados.
            </p>
            <div className="relative">
              <select
                value={selectedEmpresaId}
                onChange={(e) => setSelectedEmpresaId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 pl-4 pr-10 py-3.5 rounded-2xl outline-hidden focus:ring-2 focus:ring-indigo-550 cursor-pointer appearance-none"
                id="select-empresa-cadastro-pacotes"
              >
                <option value="">Selecione a empresa associada...</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.nome} (Prefixos: {e.prefixos || 'Sem prefixos'})</option>
                ))}
              </select>
              <div className="absolute right-4 top-4.5 pointer-events-none text-slate-400">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </div>
            </div>
          </div>

          {/* BOX 1: ARQUIVO EXCEL / IMPORTADOR EM LOTE */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-50 p-2 rounded-xl">
                  <Database className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="font-extrabold text-slate-850 text-sm">
                  Importação Automática via Excel (.xlsx / .csv)
                </h3>
              </div>
              
              {fileDetails && (
                <button 
                  onClick={resetFileState}
                  className="text-slate-400 hover:text-rose-500 transition text-[10px] uppercase font-bold"
                >
                  Limpar Arquivo
                </button>
              )}
            </div>

            {/* DRAG OVER AREA */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition duration-200 ${
                isDragOver ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200 bg-slate-50/30 hover:bg-slate-50"
              }`}
              id="drop-zone-excel-import"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {fileDetails ? (
                <div className="space-y-2">
                  <div className="mx-auto bg-emerald-100 text-emerald-600 p-3 h-12 w-12 rounded-full flex items-center justify-center">
                    <FileCheck className="h-6 w-6" />
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-800 break-all">
                    {fileDetails.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {(fileDetails.size / 1024).toFixed(1)} KB carregado com sucesso
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto bg-slate-100 text-slate-500 p-3.5 h-12 w-12 rounded-full flex items-center justify-center">
                    <Upload className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-black text-slate-700">
                    Solte sua planilha de cargas aqui
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold max-w-sm">
                    Arraste ou clique para selecionar. Suporta planilhas padrão excel (.xlsx) ou planilhas CSV básicas extraídas de sistemas TMS parceiros.
                  </p>
                </div>
              )}
            </div>

            {/* SELEÇÃO DE COLUNA DO EXCEL E PREVISÃO */}
            {excelDataRows.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-2xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Coluna de Código de Barras Detectada
                    </label>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      Selecione qual coluna contém os dados de rastreio/barcodes.
                    </p>
                  </div>
                  <select
                    value={selectedColIndex}
                    onChange={(e) => {
                      setSelectedColIndex(Number(e.target.value));
                      playWebBeep(500, 0.05);
                    }}
                    className="bg-white border border-slate-200 text-xs font-black text-slate-700 px-3.5 py-2 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden min-w-[150px] cursor-pointer"
                  >
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Previsão visual */}
                {extractedBarcodes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <span>Amostra de Envio ({extractedBarcodes.length} Códigos Diferentes)</span>
                      <span className="text-emerald-600 font-black">Previsualização Ativa</span>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-150 p-2.5 max-h-[140px] overflow-y-auto font-mono text-[11px] text-slate-600 divide-y divide-slate-100 divide-dashed">
                      {extractedBarcodes.slice(0, 200).map((code, index) => (
                        <div key={index} className="py-1 flex justify-between items-center">
                          <span className="font-semibold text-slate-700">{code}</span>
                          <span className="text-[9px] font-black text-indigo-500 uppercase">Volume #{index + 1}</span>
                        </div>
                      ))}
                      {extractedBarcodes.length > 200 && (
                        <div className="py-1 text-center font-bold text-slate-400 text-[10px]">
                          ... + {extractedBarcodes.length - 200} códigos adicionais na fila ...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* IMPORT ACTION TRIGGER BUTTON */}
                <button
                  type="button"
                  onClick={handleImportExcelData}
                  disabled={isImporting || !selectedEmpresaId || extractedBarcodes.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] duration-150 text-white font-heavy text-xs py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-200 disabled:text-slate-450 disabled:cursor-not-allowed shadow-xs"
                >
                  {isImporting ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processando e Importando Cargas... {importProgress}%</span>
                    </div>
                  ) : (
                    <>
                      <ListChecks className="h-4 w-4" />
                      <span>
                        Importar {extractedBarcodes.length} Pacotes {selectedEmpresaId ? `para [${empresas.find(e => e.id === selectedEmpresaId)?.nome}]` : ''}
                      </span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </div>

          {/* BOX 2: REGISTRO MANUAL / BIPAGEM UNITÁRIA */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 p-2 rounded-xl">
                <Plus className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="font-extrabold text-slate-850 text-sm">
                Registro Manual de Códigos Individuais
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Bipe diretamente no leitor ou digite o código de barras do pacote. Ideal para adicionar volumes excedentes que entraram após a importação inicial do arquivo de romaneio.
            </p>

            <form onSubmit={handleManualSubmit} className="flex gap-2.5">
              <input
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
                placeholder="Escaneie ou digite o código de barras do volume..."
                disabled={!selectedEmpresaId || !selectedFilialId}
                className="flex-1 bg-slate-50 disabled:bg-slate-100 border border-slate-200 pl-4 pr-4 py-3 rounded-2xl text-xs text-slate-750 font-bold placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="submit"
                disabled={!barcodeInput.trim() || !selectedEmpresaId || !selectedFilialId}
                className="bg-blue-600 hover:bg-blue-750 text-white font-heavy text-xs px-5 py-3 rounded-2xl transition duration-150 disabled:bg-slate-200 disabled:cursor-not-allowed cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Check className="h-4 w-4" />
                <span>Salvar</span>
              </button>
            </form>
          </div>
        </div>

        {/* COLUNA DIREITA: HISTÓRICO DO DIA (5 Colunas) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col h-[525px]">
            
            {/* Titulo & Filtros */}
            <div className="space-y-4 shrink-0 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 p-2 rounded-xl">
                    <ListChecks className="h-4 w-4 text-indigo-650" />
                  </div>
                  <h3 className="font-extrabold text-slate-850 text-sm">
                    Pacotes do Dia ({filteredPackages.length})
                  </h3>
                </div>
                
                {selectedEmpresaId && filteredPackages.length > 0 && (
                  <button
                    onClick={handleZerarDia}
                    className="text-rose-500 hover:text-rose-700 font-black text-[10px] uppercase tracking-wide cursor-pointer flex items-center gap-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                    Zerar Empresa
                  </button>
                )}
              </div>

              {/* Barra de Busca de Volumes */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-405" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar código de barras..."
                  className="w-full bg-slate-50/70 border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-[11px] font-bold outline-hidden focus:ring-2 focus:ring-indigo-550"
                />
              </div>
            </div>

            {/* Lista Scroll */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2 text-left">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center p-8">
                  <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] text-slate-400 font-bold mt-2">Buscando pacotes no servidor...</p>
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="bg-slate-50 p-4 rounded-full text-slate-300">
                    <Package className="h-10 w-10 text-slate-300" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-650">Nenhum pacote registrado</p>
                    <p className="text-[10px] text-slate-400 font-semibold max-w-[220px]">
                      {searchQuery 
                        ? "Nenhum volume corresponde à pesquisa atual."
                        : "Não há registro de importação ou bipagem manual para os filtros selecionados."
                      }
                    </p>
                  </div>
                </div>
              ) : (
                filteredPackages.map((pkg) => {
                  const empName = empresas.find(e => e.id === pkg.empresaId)?.nome || 'Empresa';
                  return (
                    <div 
                      key={pkg.id}
                      className="bg-slate-50/50 border border-slate-150 p-3 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-50 transition duration-150 group"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-800 truncate" title={pkg.codigoBarras}>
                          {pkg.codigoBarras}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] bg-slate-200/80 text-slate-650 px-1.5 py-0.5 rounded-md font-bold uppercase">
                            {empName}
                          </span>
                          <span className="text-[8px] text-slate-400 font-semibold">
                            por {pkg.usuarioNome || 'Sistema'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePackage(pkg)}
                        className="text-slate-350 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition duration-150 shrink-0 cursor-pointer opacity-80 group-hover:opacity-100"
                        title="Remover pacote"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Info Resumo */}
            {filteredPackages.length > 0 && (
              <div className="shrink-0 mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Total Filtrado:</span>
                <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-black text-xs">
                  {filteredPackages.length} pacotes
                </span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* FOOTER INFORMATIVO */}
      <div className="bg-sky-50/30 border border-sky-100/60 rounded-3xl p-5 flex items-start gap-3.5">
        <Info className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-left text-xs text-sky-850">
          <h4 className="font-extrabold">Como funciona a integração com o Estoque?</h4>
          <p className="font-medium leading-relaxed text-slate-500 text-[11px]">
            Toda vez que você importa uma relação em Excel ou registra um pacote nesta aba, o montante cumulativo de volumes daquela empresa na Data da Carga selecionada é salvo diretamente como a <strong>&quot;Quantidade Pátio&quot;</strong> na <strong>Controladoria de Estoque Diário</strong>. O sistema utilizará esta quantidade base para subtrair das saídas lançadas (Bipagem de Guias de Romaneio de Saída) e aferir as perdas, sobras e conciliações fiscais.
          </p>
        </div>
      </div>

    </div>
  );
}
