import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  X, 
  Search, 
  RotateCcw, 
  Building2, 
  Truck, 
  MapPin, 
  Home, 
  User, 
  Calendar,
  AlertTriangle,
  Info,
  Coins,
  Receipt,
  HelpCircle
} from 'lucide-react';
import { ItemLixeira } from '../types';

interface LixeiraModalProps {
  isOpen: boolean;
  onClose: () => void;
  lixeira: ItemLixeira[];
  onRestore: (item: ItemLixeira) => void;
  onPermanentDelete: (trashId: string) => void;
  onEmptyTrash: () => void;
}

export default function LixeiraModal({
  isOpen,
  onClose,
  lixeira,
  onRestore,
  onPermanentDelete,
  onEmptyTrash
}: LixeiraModalProps) {
  const [trashSearch, setTrashSearch] = useState('');
  const [trashFilter, setTrashFilter] = useState('all');
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemLixeira | null>(null);

  if (!isOpen) return null;

  // Helper to calculate days remaining
  const calculateDaysRemaining = (deletedAtStr: string) => {
    const deletedAt = new Date(deletedAtStr);
    const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const filteredTrash = lixeira.filter(item => {
    const matchesSearch = item.label.toLowerCase().includes(trashSearch.toLowerCase()) || 
                          item.subLabel.toLowerCase().includes(trashSearch.toLowerCase());
    const matchesType = trashFilter === 'all' || item.tipo === trashFilter;
    return matchesSearch && matchesType;
  });

  // Calculate counts for each filter dynamically
  const getCount = (type: string) => {
    if (type === 'all') return lixeira.length;
    return lixeira.filter(item => item.tipo === type).length;
  };

  // Helper to render type-specific icons
  const renderTypeIcon = (tipo: string) => {
    const iconClass = "h-5 w-5";
    switch (tipo) {
      case 'empresa':
        return <Building2 className={`${iconClass} text-blue-600`} />;
      case 'entregador':
        return <Truck className={`${iconClass} text-purple-600`} />;
      case 'rota':
        return <MapPin className={`${iconClass} text-amber-600`} />;
      case 'filial':
        return <Home className={`${iconClass} text-pink-600`} />;
      case 'vale':
        return <Coins className={`${iconClass} text-yellow-600`} />;
      case 'recibo':
        return <Receipt className={`${iconClass} text-indigo-600`} />;
      case 'motivo':
        return <HelpCircle className={`${iconClass} text-rose-550`} />;
      default:
        return <User className={`${iconClass} text-emerald-600`} />;
    }
  };

  const getTypeStyle = (tipo: string) => {
    switch (tipo) {
      case 'empresa':
        return { bg: 'bg-blue-50/70 border-blue-100', text: 'text-blue-700', label: 'Empresa' };
      case 'entregador':
        return { bg: 'bg-purple-50/70 border-purple-100', text: 'text-purple-700', label: 'Entregador' };
      case 'rota':
        return { bg: 'bg-amber-50/70 border-amber-100', text: 'text-amber-700', label: 'Rota' };
      case 'filial':
        return { bg: 'bg-pink-50/70 border-pink-100', text: 'text-pink-700', label: 'Filial' };
      case 'vale':
        return { bg: 'bg-yellow-50/70 border-yellow-105', text: 'text-yellow-750', label: 'Vale' };
      case 'recibo':
        return { bg: 'bg-indigo-50/70 border-indigo-105', text: 'text-indigo-750', label: 'Recibo' };
      case 'motivo':
        return { bg: 'bg-rose-50/70 border-rose-105', text: 'text-rose-750', label: 'Motivo' };
      default:
        return { bg: 'bg-emerald-50/70 border-emerald-100', text: 'text-emerald-700', label: 'Usuário' };
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop with elegant micro blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs"
        id="trash-backdrop"
      />

      {/* Card Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 15 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
        className="relative bg-white w-full max-w-2xl h-[85vh] max-h-[740px] rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10 font-sans"
        id="trash-modal-container"
      >
        {showConfirmEmpty && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-50 text-center animate-fade-in text-white rounded-3xl">
            <div className="p-4 bg-rose-500/15 rounded-full border border-rose-500/30 mb-4 text-rose-500">
              <AlertTriangle className="h-10 w-10 animate-pulse" />
            </div>
            <h3 className="text-lg font-black tracking-tight text-white uppercase">Esvaziar Lixeira?</h3>
            <p className="text-xs text-slate-300 max-w-sm mt-2.5 leading-relaxed font-semibold">
              Esta ação é permanente e irreversível. Todos os <strong>{lixeira.length}</strong> itens salvos serão excluídos definitivamente de nossa nuvem de dados.
            </p>
            <div className="flex gap-3 justify-center mt-6 w-full max-w-xs">
              <button
                onClick={() => {
                  onEmptyTrash();
                  setShowConfirmEmpty(false);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Sim, Limpar Tudo
              </button>
              <button
                onClick={() => setShowConfirmEmpty(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {itemToDelete && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-50 text-center animate-fade-in text-white rounded-3xl">
            <div className="p-4 bg-rose-500/15 rounded-full border border-rose-500/30 mb-4 text-rose-500">
              <AlertTriangle className="h-10 w-10 animate-pulse" />
            </div>
            <h3 className="text-lg font-black tracking-tight text-white uppercase">Excluir Permanentemente?</h3>
            <p className="text-xs text-slate-300 max-w-sm mt-2.5 leading-relaxed font-semibold">
              Esta ação é permanente e irreversível. O item <strong className="text-rose-400">{itemToDelete.label}</strong> será excluído definitivamente da nuvem de dados sem possibilidade de restauração.
            </p>
            <div className="flex gap-3 justify-center mt-6 w-full max-w-xs">
              <button
                onClick={() => {
                  onPermanentDelete(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Sim, Excluir
              </button>
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Modern Polished Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-5 px-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700/60 shadow-inner flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white tracking-tight">Lixeira do Sistema</h3>
                <span className="bg-rose-500/15 border border-rose-505/20 text-rose-350 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  {lixeira.length} item{lixeira.length !== 1 ? 'ns' : ''}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono mt-0.5">
                Retenção automática de 30 dias para segurança
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {lixeira.length > 0 && (
              <button
                onClick={() => setShowConfirmEmpty(true)}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-650 text-rose-400 hover:text-white border border-rose-500/35 hover:border-transparent text-xs font-bold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5"
                id="btn-empty-trash"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpar Lixeira</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-450 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition-all duration-150 cursor-pointer border border-slate-800/40"
              id="btn-close-trash"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Enhanced Search & Category Pills bar */}
        <div className="p-5 bg-slate-50 border-b border-slate-200/60 flex flex-col gap-4 shrink-0">
          {/* Search box with Icon */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar registros deletados por nome, detalhe..."
              value={trashSearch}
              onChange={(e) => setTrashSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-slate-400 rounded-2xl py-2.5 pl-10 pr-9 text-xs font-medium focus:ring-2 focus:ring-slate-100 focus:outline-none text-slate-800 placeholder-slate-400 shadow-xs transition-all duration-150"
              id="input-trash-search"
            />
            {trashSearch && (
              <button 
                onClick={() => setTrashSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 rounded-full h-5 w-5 flex items-center justify-center transition-colors"
                id="btn-clear-trash-search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Styled Selection tabs with dynamic statistics bubbles */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-none">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'empresa', label: 'Empresas' },
              { id: 'entregador', label: 'Entregadores' },
              { id: 'rota', label: 'Rotas' },
              { id: 'filial', label: 'Filiais' },
              { id: 'usuario', label: 'Usuários' },
              { id: 'vale', label: 'Vales' },
              { id: 'recibo', label: 'Recibos' },
              { id: 'motivo', label: 'Motivos Dev' }
            ].map(tab => {
              const count = getCount(tab.id);
              const isSelected = trashFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTrashFilter(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                      : count === 0
                        ? 'bg-slate-50 border-slate-150 text-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                  }`}
                  id={`tab-trash-${tab.id}`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold font-mono transition-colors ${
                    isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content body List */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/30 space-y-3" id="trash-list-scroll">
          {filteredTrash.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-4">
              <div className="p-4 bg-slate-100/80 rounded-full border border-slate-200/60 text-slate-400 shadow-inner">
                <Trash2 className="h-10 w-10 text-slate-400" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="font-bold text-slate-800 text-sm">Nenhum item na lixeira</h4>
                <p className="text-xs text-slate-400 leading-normal">
                  {lixeira.length === 0 
                    ? 'A lixeira está vazia. Registros que você excluir das listas de cadastros ou de movimentações financeiras ficarão salvos temporariamente aqui por segurança.'
                    : 'Não encontramos registros correspondentes ao filtro ou busca selecionada.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 font-mono px-1">
                <span className="flex items-center gap-1.5">
                  <span>Mostrando {filteredTrash.length} registro{filteredTrash.length !== 1 ? 's' : ''}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="normal-case font-semibold text-slate-400">Clique para restaurar</span>
                </span>
                <span className="lowercase normal-case font-medium text-slate-400 hidden sm:inline">Exclusão permanente é definitiva</span>
              </div>

              {/* Grid with animation */}
              <div className="grid grid-cols-1 gap-3" id="trash-items-grid">
                {filteredTrash.map(item => {
                  const daysLeft = calculateDaysRemaining(item.deletadoEm);
                  const isExpired = daysLeft <= 0;
                  const typeStyles = getTypeStyle(item.tipo);

                  return (
                    <div 
                      key={item.id}
                      className="bg-white border border-slate-200/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 relative overflow-hidden group"
                    >
                      {/* Left colored thick indicator strip depending on entity type */}
                      <div className={`absolute left-0 inset-y-0 w-1.5 ${
                        item.tipo === 'empresa' ? 'bg-blue-500' :
                        item.tipo === 'entregador' ? 'bg-purple-500' :
                        item.tipo === 'rota' ? 'bg-amber-500' :
                        item.tipo === 'filial' ? 'bg-pink-500' : 
                        item.tipo === 'vale' ? 'bg-yellow-500' :
                        item.tipo === 'recibo' ? 'bg-indigo-500' :
                        item.tipo === 'motivo' ? 'bg-rose-500' : 'bg-emerald-500'
                      }`} />

                      {/* Main record details Container */}
                      <div className="flex items-start gap-3.5 pl-2">
                        {/* Elegant Type Circle Icon container in sync with type */}
                        <div className={`p-3 rounded-2xl shrink-0 border mt-0.5 flex items-center justify-center ${typeStyles.bg}`}>
                          {renderTypeIcon(item.tipo)}
                        </div>

                        {/* Text fields */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-lg font-mono tracking-wider ${
                              item.tipo === 'empresa' ? 'bg-blue-100/70 text-blue-800' :
                              item.tipo === 'entregador' ? 'bg-purple-100/70 text-purple-800' :
                              item.tipo === 'rota' ? 'bg-amber-100/70 text-amber-800' :
                              item.tipo === 'filial' ? 'bg-pink-100/70 text-pink-800' : 
                              item.tipo === 'vale' ? 'bg-yellow-105 text-yellow-800' : 
                              item.tipo === 'recibo' ? 'bg-indigo-105 text-indigo-800' : 
                              item.tipo === 'motivo' ? 'bg-rose-105 text-rose-800' : 'bg-emerald-100/70 text-emerald-800'
                            }`}>
                              {typeStyles.label}
                            </span>

                            {/* Deletion protection alerts countdown pill */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1.5 ${
                              daysLeft > 15 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                : daysLeft > 5 
                                  ? 'bg-amber-50 text-amber-800 border border-amber-100' 
                                  : 'bg-rose-50 text-rose-800 border border-rose-100 animate-pulse'
                            }`}>
                              <span className={`h-1 w-1 rounded-full ${
                                daysLeft > 15 ? 'bg-emerald-500' : daysLeft > 5 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} />
                              {isExpired ? 'Expira hoje!' : `Resta ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`}
                            </span>
                          </div>

                          <h4 className="font-extrabold text-[14px] text-slate-850 tracking-tight">
                            {item.label}
                          </h4>
                          
                          <p className="text-xs text-slate-500 font-mono font-medium">
                            {item.subLabel}
                          </p>

                          {/* Historical context row */}
                          <div className="text-[10px] text-slate-400 font-sans flex flex-wrap items-center gap-x-2 pt-1">
                            <span className="flex items-center gap-1">
                              <span>Excluído por:</span> 
                              <span className="font-bold text-slate-600">{item.deletadoPor || 'Sistema'}</span>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>{new Date(item.deletadoEm).toLocaleString('pt-BR')}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tactile and streamlined actions group */}
                      <div className="flex items-center gap-2 shrink-0 pl-2 sm:pl-0 sm:ml-auto">
                        <button
                          type="button"
                          onClick={() => onRestore(item)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-bold rounded-2xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-xs border border-slate-200 hover:border-slate-900"
                          title="Restaurar de volta às tabelas de cadastros"
                          id={`btn-restore-${item.id}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Restaurar</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all duration-150 cursor-pointer border border-transparent hover:border-rose-100"
                          title="Excluir Definitivamente"
                          id={`btn-perm-delete-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Informative design footer explaining security and operation limits */}
        <div className="p-4 bg-slate-50 border-t border-slate-150 text-[11px] text-slate-500 font-medium flex items-center justify-center gap-2 shrink-0">
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>
            Registros protegidos permanecem aqui por <span className="font-bold text-slate-700">30 dias</span> salvaguardando erros operacionais.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
