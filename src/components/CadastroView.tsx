/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Building2, 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Mail, 
  Phone, 
  MapPin, 
  FileCheck, 
  DollarSign, 
  Upload, 
  CheckCircle,
  Image as ImageIcon,
  Car,
  FileText,
  Lock,
  ShieldCheck,
  ShieldAlert,
  User as UserIcon,
  Check,
  Eye,
  EyeOff,
  Key,
  Star,
  ChevronDown,
  ChevronUp,
  Laptop,
  X
} from 'lucide-react';
import { Empresa, Entregador, Rota, User, UserPermissions, Filial } from '../types';
import { db, collection, getDocs, deleteDoc, doc, writeBatch } from '../lib/supabase';

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const truncated = digits.slice(0, 14);
  if (truncated.length <= 2) return truncated;
  if (truncated.length <= 5) return `${truncated.slice(0, 2)}.${truncated.slice(2)}`;
  if (truncated.length <= 8) return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5)}`;
  if (truncated.length <= 12) return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5, 8)}/${truncated.slice(8)}`;
  return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5, 8)}/${truncated.slice(8, 12)}-${truncated.slice(12)}`;
};

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const truncated = digits.slice(0, 11);
  if (truncated.length <= 3) return truncated;
  if (truncated.length <= 6) return `${truncated.slice(0, 3)}.${truncated.slice(3)}`;
  if (truncated.length <= 9) return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6)}`;
  return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6, 9)}-${truncated.slice(9)}`;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const truncated = digits.slice(0, 11);
  if (truncated.length <= 2) return truncated;
  if (truncated.length <= 6) return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
  if (truncated.length <= 10) return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
  return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
};

const ESTADOS_BRASIL = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' }
];

const CIDADES_POR_ESTADO: Record<string, string[]> = {
  SP: ['São Paulo', 'Campinas', 'Guarulhos', 'São Bernardo do Campo', 'Santo André', 'São José dos Campos', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Mauá', 'Mogi das Cruzes', 'Jundiaí', 'Piracicaba', 'Carapicuíba', 'Bauru', 'Itaquaquecetuba', 'São Vicente', 'Franca'],
  RJ: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'Campos dos Goytacazes', 'São João de Meriti', 'Petrópolis', 'Volta Redonda', 'Macaé', 'Cabo Frio', 'Angra dos Reis'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Poços de Caldas'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá', 'Apucarana'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Passo Fundo', 'Alvorada'],
  SC: ['Joinville', 'Florianópolis', 'Blumenau', 'São José', 'Chapecó', 'Itajaí', 'Criciúma', 'Jaraguá do Sul', 'Palhoça', 'Lages', 'Balneário Camboriú'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Teixeira de Freitas', 'Alagoinhas'],
  CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape'],
  PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns'],
  DF: ['Brasília', 'Taguatinga', 'Ceilândia', 'Samambaia', 'Plano Piloto', 'Guará', 'Sobradinho'],
  ES: ['Serra', 'Vila Velha', 'Cariacica', 'Vitória', 'Cachoeiro de Itapemirim', 'Linhares', 'Colatina'],
  GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade'],
  MA: ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Primavera do Leste'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã'],
  PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal', 'Parauapebas', 'Abetetuba'],
  PB: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa'],
  PI: ['Teresina', 'Parnaíba', 'Picos', 'Floriano'],
  RN: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba'],
  AL: ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios'],
  AC: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira'],
  AP: ['Macapá', 'Santana', 'Laranjal do Jari'],
  AM: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru'],
  TO: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional'],
  RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Cacoal'],
  RR: ['Boa Vista', 'Rorainópolis'],
  SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana']
};

interface CadastroViewProps {
  empresas: Empresa[];
  entregadores: Entregador[];
  rotas: Rota[];
  filiais: Filial[];
  onAddEmpresa: (emp: Empresa) => void | Promise<void>;
  onUpdateEmpresa: (empId: string, updated: Partial<Empresa>) => void | Promise<void>;
  onDeleteEmpresa: (empId: string) => void | Promise<void>;
  onAddEntregador: (ent: Entregador) => void | Promise<void>;
  onUpdateEntregador: (entId: string, updated: Partial<Entregador>) => void | Promise<void>;
  onDeleteEntregador: (entId: string) => void | Promise<void>;
  onAddRota: (r: Rota) => void | Promise<void>;
  onUpdateRota: (id: string, updated: Partial<Rota>) => void | Promise<void>;
  onDeleteRota: (id: string) => void | Promise<void>;
  onAddFilial: (f: Filial) => void | Promise<void>;
  onUpdateFilial: (id: string, updated: Partial<Filial>) => void | Promise<void>;
  onDeleteFilial: (id: string) => void | Promise<void>;
  
  // Novas props para suporte de usuários
  currentUser: User;
  usersList: User[];
  onUpdateUserPermissions: (userId: string, permissions: UserPermissions, filiais?: string[], defaultFilialId?: string, maxConnections?: number) => void;
  onAdminResetUserPassword: (userId: string, newPass: string) => void;
  onUpdateUserEmail: (userId: string, newEmail: string) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateSelfPassword: (newPass: string) => void;
  onRegisterUser: (newUser: User) => void;
  motivosDevolucao?: string[];
  onUpdateMotivos?: (motivos: string[]) => void;
  googleAuthConfig?: { isEnabled: boolean; googleClientId: string; allowedEmails: string[] };
  onUpdateGoogleAuthConfig?: (isEnabled: boolean, googleClientId: string, allowedEmails: string[]) => void | Promise<void>;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop"
];

export default function CadastroView({
  empresas,
  entregadores,
  rotas,
  filiais = [],
  onAddEmpresa,
  onUpdateEmpresa,
  onDeleteEmpresa,
  onAddEntregador,
  onUpdateEntregador,
  onDeleteEntregador,
  onAddRota,
  onUpdateRota,
  onDeleteRota,
  onAddFilial,
  onUpdateFilial,
  onDeleteFilial,
  
  currentUser,
  usersList,
  onUpdateUserPermissions,
  onAdminResetUserPassword,
  onUpdateUserEmail,
  onDeleteUser,
  onUpdateSelfPassword,
  onRegisterUser,
  motivosDevolucao = [],
  onUpdateMotivos,
  googleAuthConfig,
  onUpdateGoogleAuthConfig
}: CadastroViewProps) {
  // Toggle principal: 'entregador', 'empresa', 'rota', 'usuarios', 'filiais', 'motivos' ou 'sistema' (se master ou operacional)
  const [activeRegType, setActiveRegType] = useState<'entregador' | 'empresa' | 'rota' | 'usuarios' | 'filiais' | 'motivos' | 'sistema'>('entregador');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Controle de Formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Campos compartilhados
  const [formName, setFormName] = useState('');
  const [formDoc, setFormDoc] = useState(''); // CPF ou CNPJ
  const [formEndereco, setFormEndereco] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formContato, setFormContato] = useState('');
  const [formEstado, setFormEstado] = useState('SP'); // Usado na Filial como Estado
  const [showCustomCity, setShowCustomCity] = useState(false); // Se a cidade digitada é customizada
  const [formFilialEndereco, setFormFilialEndereco] = useState(''); // Endereço físico da filial para recibo
  const [formFilialLogo, setFormFilialLogo] = useState(''); // Logo da filial (base64 ou URL)
  const [formError, setFormError] = useState<string | null>(null); // Erros de validação do formulário
  const [formSuccess, setFormSuccess] = useState<string | null>(null); // Mensagem de sucesso do formulário
  
  // Campo de entregador
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [formPlacaVeiculo, setFormPlacaVeiculo] = useState('');
  const [formCnhDoc, setFormCnhDoc] = useState('');
  const [formFilialId, setFormFilialId] = useState(''); // ID da filial vinculada
  
  // Campos de empresa
  const [formValorPorPacote, setFormValorPorPacote] = useState('5.00');
  const [formComissaoEntregador, setFormComissaoEntregador] = useState('3.00');
  const [formPrefixos, setFormPrefixos] = useState('');
  
  // Campo de rota
  const [formDesc, setFormDesc] = useState('');

  // ESTADOS EXCLUSIVOS DE GERENCIAMENTO DE USUÁRIOS (Apenas Master)
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [registryToDelete, setRegistryToDelete] = useState<{ id: string; nome: string; type: 'entregador' | 'empresa' | 'rota' | 'filiais' } | null>(null);
  const [adminUserNewPassword, setAdminUserNewPassword] = useState('');
  const [adminUserEmail, setAdminUserEmail] = useState('');
  const [adminUserFiliais, setAdminUserFiliais] = useState<string[]>([]); // Filiais que o usuário editado tem acesso
  const [adminUserDefaultFilialId, setAdminUserDefaultFilialId] = useState<string>(''); // Filial padrão do usuário
  const [adminPermissions, setAdminPermissions] = useState<UserPermissions>({
    dashboard: true,
    expedicao: true,
    baixas: true,
    emRota: true,
    cadastro: true,
    folha: false,
    relatorios: false,
    tvPainel: true
  });
  const [openPermissionEditDropdown, setOpenPermissionEditDropdown] = useState<string | null>(null);
  const [openPermissionNewDropdown, setOpenPermissionNewDropdown] = useState<string | null>(null);
  const [adminUserSuccessMsg, setAdminUserSuccessMsg] = useState('');
  const [adminUserErrorMsg, setAdminUserErrorMsg] = useState('');

  // NOVOS ESTADOS PARA CRIAÇÃO DE NOVOS USUÁRIOS PELO MASTER
  const [newUserNome, setNewUserNome] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('');
  const [newUserConfirmarSenha, setNewUserConfirmarSenha] = useState('');
  const [newUserPalavraChave, setNewUserPalavraChave] = useState('');
  const [newUserSuccessMsg, setNewUserSuccessMsg] = useState('');
  const [newUserErrorMsg, setNewUserErrorMsg] = useState('');
  const [newUserPermissions, setNewUserPermissions] = useState<UserPermissions>({
    dashboard: true,
    expedicao: true,
    baixas: true,
    emRota: true,
    cadastro: false,
    folha: false,
    relatorios: false,
    tvPainel: true,
    alterar_estoque_salvo: false
  });
  const [newUserFiliais, setNewUserFiliais] = useState<string[]>([]);
  const [newUserDefaultFilialId, setNewUserDefaultFilialId] = useState<string>('');

  // ESTADOS DO REQUISITO DE RESET/LIMPEZA DO SISTEMA
  const [isCleaning, setIsCleaning] = useState(false);
  const [confirmCleanInput, setConfirmCleanInput] = useState('');
  const [cleanupSuccess, setCleanupSuccess] = useState(false);
  const [cleanupLogs, setCleanupLogs] = useState<string[]>([]);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  // ESTADOS DE ALTERAÇÃO DA PRÓPRIA SENHA (Todos usuários)
  const [selfNewPassword, setSelfNewPassword] = useState('');
  const [selfConfirmPassword, setSelfConfirmPassword] = useState('');
  const [selfSuccessMsg, setSelfSuccessMsg] = useState('');
  const [selfErrorMsg, setSelfErrorMsg] = useState('');
  const [showSelfPassInputs, setShowSelfPassInputs] = useState(false);

  // ESTADOS DA PORTA DE SEGURANÇA GOOGLE GATE
  const [showGoogleGateSettings, setShowGoogleGateSettings] = useState(false);
  const [tempGoogleClientId, setTempGoogleClientId] = useState(googleAuthConfig?.googleClientId || '');
  const [tempAllowedEmails, setTempAllowedEmails] = useState<string[]>(googleAuthConfig?.allowedEmails || []);
  const [newGoogleEmail, setNewGoogleEmail] = useState('');
  const [googleSaveStatus, setGoogleSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Sincronizar estados com props em tempo real
  React.useEffect(() => {
    if (googleAuthConfig) {
      setTempGoogleClientId(googleAuthConfig.googleClientId || '');
      setTempAllowedEmails(googleAuthConfig.allowedEmails || []);
    }
  }, [googleAuthConfig]);

  // Função para executar a limpeza geral de dados fictícios/testes, mantendo os cadastros
  const handleExecuteTestDataCleanup = async () => {
    if (!currentUser.isMaster) {
      setCleanupError("Apenas o usuário master pode realizar essa operação.");
      return;
    }
    if (confirmCleanInput.trim().toUpperCase() !== 'CONFIRMAR') {
      setCleanupError("Por favor, digite exatamente a palavra 'CONFIRMAR' para prosseguir.");
      return;
    }

    setIsCleaning(true);
    setCleanupError(null);
    setCleanupSuccess(false);
    setCleanupLogs([]);

    const log = (msg: string) => {
      setCleanupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      log("Iniciando limpeza total de dados operacionais e de teste...");

      // Coleções para limpar completamente
      const collectionsToClear = [
        'expedicoes',
        'movimentacoes_estoque',
        'estoque',
        'pacotes_cadastrados',
        'lixeira',
        'vales',
        'recibos_pagamento',
        'conciliacoes_diarias',
        'transferencias_pacotes'
      ];

      for (const colName of collectionsToClear) {
        log(`Buscando registros da coleção: ${colName}...`);
        const qSnap = await getDocs(collection(db, colName));
        if (qSnap.empty) {
          log(`Nenhum registro encontrado na coleção "${colName}".`);
          continue;
        }

        log(`Encontrado(s) ${qSnap.size} documento(s) em "${colName}". Removendo...`);
        
        let batch = writeBatch(db);
        let count = 0;
        let batchCount = 1;

        for (const d of qSnap.docs) {
          batch.delete(doc(db, colName, d.id));
          count++;
          
          if (count === 400) {
            log(`Executando lote ${batchCount} de remoções para "${colName}"...`);
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
            batchCount++;
          }
        }

        if (count > 0) {
          log(`Executando lote final de remoções para "${colName}"...`);
          await batch.commit();
        }

        log(`Coleção "${colName}" limpa com sucesso.`);
      }

      log("Limpeza de Banco de Dados Concluída com sucesso! Todos os dados operacionais foram limpos de forma permanente.");
      setCleanupSuccess(true);
      setConfirmCleanInput('');
    } catch (err) {
      console.error(err);
      setCleanupError(err instanceof Error ? err.message : String(err));
      log("ERRO OCORRIDO NA OPERAÇÃO DE LIMPEZA!");
    } finally {
      setIsCleaning(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cnhFileInputRef = useRef<HTMLInputElement>(null);
  const filialLogoInputRef = useRef<HTMLInputElement>(null);

  // Compactador de Imagens Base64 (max 200x200px, JPEG com qualidade 0.7)
  const resizeAndCompressImg = (originalBase64: string, maxWidth = 200, maxHeight = 200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = originalBase64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressed);
        } else {
          resolve(originalBase64);
        }
      };
      img.onerror = () => {
        resolve(originalBase64);
      };
    });
  };

  // Manipular upload de logo da filial (Base64)
  const handleFilialLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await resizeAndCompressImg(reader.result, 200, 200);
          setFormFilialLogo(compressed);
          console.log("[Photo Optimizer] Logo da filial compactada para < 200x200px!");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Manipular drag and drop de arquivos de imagem (Base64)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await resizeAndCompressImg(reader.result, 200, 200);
          setFormFotoUrl(compressed);
          console.log("[Photo Optimizer] Foto de perfil do entregador compactada para < 200x200px com sucesso!");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Manipular upload de documento de habilitação (CNH)
  const handleCnhUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          // Usamos 800x800 para a CNH para garantir que o texto (números, nome) continue 100% legível,
          // mas compactado (JPEG 0.7) para gerar um arquivo leve de ~50KB a 100KB (muito abaixo do limite do Firestore).
          const compressed = await resizeAndCompressImg(reader.result, 800, 800);
          setFormCnhDoc(compressed);
          console.log("[Photo Optimizer] Documento de habilitação (CNH) otimizado para < 800x800px para manter leitura e leveza!");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Preencher formulário para edição
  const handleStartEdit = (item: any, type: 'entregador' | 'empresa' | 'rota' | 'filiais') => {
    setEditingId(item.id);
    setFormName(item.nome);

    if (type === 'entregador') {
      setFormEndereco(item.endereco || '');
      setFormEmail(item.email || '');
      setFormContato(item.contato || '');
      setFormDoc(item.cpf);
      setFormFotoUrl(item.foto || '');
      setFormPlacaVeiculo(item.placaVeiculo || '');
      setFormCnhDoc(item.cnhDoc || '');
      setFormFilialId(item.filialId || '');
    } else if (type === 'empresa') {
      setFormEndereco(item.endereco || '');
      setFormEmail(item.email || '');
      setFormContato(item.contato || '');
      setFormDoc(item.cnpj);
      setFormValorPorPacote(String(item.valorPorPacote));
      setFormComissaoEntregador(String(item.comissaoEntregador));
      setFormPrefixos(item.prefixos || '');
    } else if (type === 'rota') {
      setFormEndereco(item.endereco || '');
      setFormEmail(item.email || '');
      setFormContato(item.contato || '');
      setFormDesc(item.descricao || '');
      setFormFilialId(item.filialId || '');
    } else if (type === 'filiais') {
      setFormDoc(item.cnpj || '');
      setFormEndereco(item.cidade || '');
      setFormFilialEndereco(item.endereco || '');
      setFormEstado(item.estado || 'SP');
      setFormEmail(item.email || '');
      setFormContato(item.contato || '');
      setFormFilialLogo(item.logo || '');
      const citiesOfState = CIDADES_POR_ESTADO[item.estado || 'SP'] || [];
      setShowCustomCity(item.cidade ? !citiesOfState.includes(item.cidade) : false);
    }
    setFormError(null);
  };

  // Resetar formulário
  const handleClearForm = () => {
    setEditingId(null);
    setFormName('');
    setFormDoc('');
    setFormEndereco('');
    setFormEmail('');
    setFormContato('');
    setFormFotoUrl('');
    setFormPlacaVeiculo('');
    setFormCnhDoc('');
    setFormValorPorPacote('5.00');
    setFormComissaoEntregador('3.00');
    setFormPrefixos('');
    setFormDesc('');
    setFormFilialId(filiais && filiais.length > 0 ? filiais[0].id : '');
    setFormEstado('SP');
    setShowCustomCity(false);
    setFormFilialEndereco('');
    setFormFilialLogo('');
    setFormError(null);
    setFormSuccess(null);
    
    setSelectedUserToEdit(null);
    setAdminUserNewPassword('');
    setAdminUserEmail('');
    setAdminUserSuccessMsg('');
    setAdminUserErrorMsg('');
    setAdminUserFiliais([]);
    setAdminUserDefaultFilialId('');
    setOpenPermissionEditDropdown(null);
    setOpenPermissionNewDropdown(null);

    // Limpar estados de criação de novo usuário
    setNewUserNome('');
    setNewUserUsername('');
    setNewUserSenha('');
    setNewUserConfirmarSenha('');
    setNewUserPalavraChave('');
    setNewUserSuccessMsg('');
    setNewUserErrorMsg('');
    setNewUserPermissions({
      dashboard: true,
      expedicao: true,
      baixas: true,
      emRota: true,
      cadastro: false,
      folha: false,
      relatorios: false,
      tvPainel: true,
      alterar_estoque_salvo: false
    });
    setNewUserFiliais([]);
    setNewUserDefaultFilialId('');
  };

  // Salvar adição ou edição
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const missingFields: string[] = [];

    if (activeRegType === 'filiais') {
      if (!formName.trim()) missingFields.push("Nome da Filial");
      if (!formDoc.trim()) missingFields.push("CNPJ da Filial");
      if (!formEndereco.trim()) missingFields.push("Cidade da Filial");
      if (!formFilialEndereco.trim()) missingFields.push("Endereço Completo");
    } else if (activeRegType === 'entregador') {
      if (!formName.trim()) missingFields.push("Nome Completo");
      if (!formDoc.trim()) missingFields.push("CPF");
    } else if (activeRegType === 'empresa') {
      if (!formName.trim()) missingFields.push("Razão Social / Nome da Empresa");
      if (!formDoc.trim()) missingFields.push("CNPJ da Empresa");
    } else if (activeRegType === 'rota') {
      if (!formName.trim()) missingFields.push("Nome da Rota");
      if (!formDesc.trim()) missingFields.push("Áreas / Bairros da Rota");
    } else if (activeRegType === 'motivos') {
      if (!formName.trim()) missingFields.push("Descrição do Motivo");
    }

    if (missingFields.length > 0) {
      setFormError(`Por favor, preencha todos os campos obrigatórios. Faltando: ${missingFields.join(', ')}`);
      return;
    }

    let savePromise: Promise<any> = Promise.resolve();

    if (activeRegType === 'entregador') {
      const entregadorData = {
        nome: formName,
        cpf: formDoc || "000.000.000-00",
        endereco: formEndereco,
        email: formEmail,
        contato: formContato,
        foto: formFotoUrl || PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)],
        placaVeiculo: formPlacaVeiculo,
        cnhDoc: formCnhDoc,
        filialId: formFilialId || (filiais && filiais.length > 0 ? filiais[0].id : ''),
        createdById: currentUser.id // Vinculado ao criador
      };

      if (editingId) {
        const res = onUpdateEntregador(editingId!, entregadorData);
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      } else {
        const res = onAddEntregador({
          id: `ent-${Date.now()}`,
          ...entregadorData
        });
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      }
    } else if (activeRegType === 'empresa') {
      const empresaData = {
        nome: formName,
        cnpj: formDoc || "00.000.000/0001-00",
        endereco: formEndereco,
        email: formEmail,
        contato: formContato,
        valorPorPacote: parseFloat(formValorPorPacote) || 5.00,
        comissaoEntregador: parseFloat(formComissaoEntregador) || 3.00,
        prefixos: formPrefixos,
        createdById: currentUser.id // Vinculado ao criador
      };

      if (editingId) {
        const res = onUpdateEmpresa(editingId, empresaData);
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      } else {
        const res = onAddEmpresa({
          id: `emp-${Date.now()}`,
          ...empresaData
        });
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      }
    } else if (activeRegType === 'rota') {
      const rotaData = {
        nome: formName,
        descricao: formDesc,
        filialId: formFilialId || (filiais && filiais.length > 0 ? filiais[0].id : ''),
        createdById: currentUser.id // Vinculado ao criador
      };

      if (editingId) {
        const res = onUpdateRota(editingId, rotaData);
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      } else {
        const res = onAddRota({
          id: `rot-${Date.now()}`,
          ...rotaData
        });
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      }
    } else if (activeRegType === 'filiais') {
      const filialData = {
        nome: formName,
        cnpj: formDoc,
        cidade: formEndereco,
        state: formEstado, // For backward compatibility with the schema if applicable, but set both state and estado to be safe
        estado: formEstado,
        endereco: formFilialEndereco,
        email: formEmail,
        contato: formContato,
        logo: formFilialLogo
      };

      if (editingId) {
        const res = onUpdateFilial(editingId, filialData);
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      } else {
        const res = onAddFilial({
          id: `filial-${Date.now()}`,
          ...filialData
        });
        savePromise = res instanceof Promise ? res : Promise.resolve(res);
      }
    } else if (activeRegType === 'motivos') {
      const motivoStr = formName.trim();
      if (onUpdateMotivos) {
        if (editingId) {
          const indexToEdit = motivosDevolucao.indexOf(editingId);
          if (indexToEdit !== -1) {
            const updatedList = [...motivosDevolucao];
            updatedList[indexToEdit] = motivoStr;
            savePromise = Promise.resolve(onUpdateMotivos(updatedList));
          }
        } else {
          if (!motivosDevolucao.includes(motivoStr)) {
            savePromise = Promise.resolve(onUpdateMotivos([motivoStr, ...motivosDevolucao]));
          }
        }
      }
    }

    savePromise
      .then(() => {
        let label = "do cadastro";
        if (activeRegType === 'entregador') label = `do entregador "${formName}"`;
        else if (activeRegType === 'empresa') label = `da empresa "${formName}"`;
        else if (activeRegType === 'rota') label = `da rota "${formName}"`;
        else if (activeRegType === 'filiais') label = `da filial "${formName}"`;
        else if (activeRegType === 'motivos') label = `do motivo de devolução "${formName}"`;

        console.log(`[Cadastro] Gravado com sucesso no Firebase: ${formName}`);
        setFormSuccess(`Os dados ${label} foram gravados e sincronizados com sucesso no Firebase!`);
        setFormError(null);
        alert(`Sucesso! Os dados ${label} foram salvos e sincronizados com o Firebase.`);
        handleClearForm();
      })
      .catch((err: any) => {
        let label = "do cadastro";
        if (activeRegType === 'entregador') label = `do entregador "${formName}"`;
        else if (activeRegType === 'empresa') label = `da empresa "${formName}"`;
        else if (activeRegType === 'rota') label = `da rota "${formName}"`;
        else if (activeRegType === 'filiais') label = `da filial "${formName}"`;
        else if (activeRegType === 'motivos') label = `do motivo de devolução "${formName}"`;

        console.error(`[Cadastro] Erro crítico ao salvar dados ${label} no Firestore:`, err);
        setFormError(`Falha ao gravar no Firebase: ${err?.message || String(err)}`);
        setFormSuccess(null);
        alert(`Erro ao salvar! Não foi possível sincronizar os dados ${label} com o banco em nuvem. Detalhes: ${err?.message || String(err)}`);
      });
  };

  // Lidar com a edição de um usuário pelo master
  const handleSelectUserForEdit = (user: User) => {
    setSelectedUserToEdit(user);
    setAdminUserNewPassword('');
    setAdminUserEmail(user.palavraChave || user.email || '');
    setAdminUserSuccessMsg('');
    setAdminUserErrorMsg('');
    setAdminPermissions({ ...user.permissions });
    setAdminUserFiliais(user.filiais || []);
    setAdminUserDefaultFilialId(user.defaultFilialId || '');
  };

  // Salvar alterações de permissões ou senha do usuário editado pelo master
  const handleSaveAdminUserChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToEdit) return;
    
    setAdminUserSuccessMsg('');
    setAdminUserErrorMsg('');

    const isTargetMaster = selectedUserToEdit.isMaster || selectedUserToEdit.id === 'usr-master' || selectedUserToEdit.username === 'master';

    if (isTargetMaster && adminUserNewPassword.trim()) {
      setAdminUserErrorMsg('A senha do Administrador Master é estritamente protegida e não pode ser alterada.');
      return;
    }

    try {
      // 1. Atualizar permissões (Master possui todas permanentes)
      if (!isTargetMaster) {
        onUpdateUserPermissions(selectedUserToEdit.id, adminPermissions, adminUserFiliais, adminUserDefaultFilialId);
      } else {
        onUpdateUserPermissions(selectedUserToEdit.id, selectedUserToEdit.permissions, selectedUserToEdit.filiais, selectedUserToEdit.defaultFilialId);
      }
      
      // 2. Definir nova senha, se informada
      if (adminUserNewPassword.trim() && !isTargetMaster) {
        if (adminUserNewPassword.trim().length < 4) {
          setAdminUserErrorMsg('A senha do usuário deve ter mais que 3 caracteres.');
          return;
        }
        onAdminResetUserPassword(selectedUserToEdit.id, adminUserNewPassword.trim());
      }

      // 3. Atualizar e-mail (Permitido para todos, inclusive o Master para definir o remetente da chave)
      if (adminUserEmail.trim()) {
        onUpdateUserEmail(selectedUserToEdit.id, adminUserEmail.trim());
      }

      setAdminUserSuccessMsg(`Configurações de @${selectedUserToEdit.username} salvas com sucesso!`);
      
      // Resetar formulário após atualizar
      setTimeout(() => {
        handleClearForm();
      }, 2000);
    } catch (err: any) {
      setAdminUserErrorMsg('Falha ao tentar atualizar configurações do usuário.');
    }
  };

  // Cadastro do funcionário finalizado sem verificação de simultâneos

  // Criar novo usuário operacional diretamente pelo Master
  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserSuccessMsg('');
    setNewUserErrorMsg('');

    const nome = newUserNome.trim();
    const usernameClean = newUserUsername.trim().toLowerCase();
    const keyword = newUserPalavraChave.trim();
    const senha = newUserSenha;

    if (!nome || !usernameClean || !keyword || !senha) {
      setNewUserErrorMsg('Todos os campos são obrigatórios.');
      return;
    }

    if (usernameClean.includes(' ')) {
      setNewUserErrorMsg('O nome de usuário não deve conter espaços.');
      return;
    }

    // Verificar se já existe
    const exists = usersList.some(u => u.username.toLowerCase() === usernameClean);
    if (exists) {
      setNewUserErrorMsg(`O usuário @${usernameClean} já está cadastrado.`);
      return;
    }

    if (senha.length < 4) {
      setNewUserErrorMsg('A senha do usuário deve ter mais que 3 caracteres.');
      return;
    }

    if (senha !== newUserConfirmarSenha) {
      setNewUserErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    const novoUsuario: User = {
      id: `usr-${Date.now()}`,
      username: usernameClean,
      nomeCompleto: nome,
      email: `${usernameClean}@diamantelog.com`,
      palavraChave: keyword,
      passwordHash: senha,
      permissions: newUserPermissions,
      filiais: newUserFiliais,
      defaultFilialId: newUserDefaultFilialId
    };

    onRegisterUser(novoUsuario);

    setNewUserSuccessMsg(`Usuário @${usernameClean} cadastrado com sucesso!`);
    
    setTimeout(() => {
      handleClearForm();
    }, 2000);
  };

  const toggleNewUserPermission = (key: keyof UserPermissions) => {
    setNewUserPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Alterar minha própria senha
  const handleUpdateSelfPassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelfSuccessMsg('');
    setSelfErrorMsg('');

    if (currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') {
      setSelfErrorMsg('A senha do usuário Administração Master é protegida por motivos de segurança e auditoria (dlog1a2b3c) e não pode ser alterada.');
      return;
    }

    if (!selfNewPassword.trim()) {
      setSelfErrorMsg('Digite uma senha válida.');
      return;
    }

    if (selfNewPassword.length < 4) {
      setSelfErrorMsg('Sua nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (selfNewPassword !== selfConfirmPassword) {
      setSelfErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    onUpdateSelfPassword(selfNewPassword);
    setSelfSuccessMsg('Sua senha de acesso foi atualizada com sucesso!');
    setSelfNewPassword('');
    setSelfConfirmPassword('');
    
    setTimeout(() => {
      setSelfSuccessMsg('');
      setShowSelfPassInputs(false);
    }, 3000);
  };

  // Todos os usuários agora têm acesso a todos os dados do sistema cadastrados (sem isolamento de dados)
  const isDataVisible = (item: any) => {
    return true;
  };

  const filteredEmpresas = empresas.filter(isDataVisible);
  const filteredEntregadores = entregadores.filter(isDataVisible);
  const filteredRotas = rotas.filter(isDataVisible);

  // Filtro de lista ativo conforme a aba selecionada e busca
  const filteredList = activeRegType === 'entregador'
    ? filteredEntregadores.filter(ent => ent.nome.toLowerCase().includes(searchTerm.toLowerCase()) || ent.cpf.includes(searchTerm))
    : activeRegType === 'empresa'
    ? filteredEmpresas.filter(emp => emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) || emp.cnpj.includes(searchTerm))
    : activeRegType === 'rota'
    ? filteredRotas.filter(rot => rot.nome.toLowerCase().includes(searchTerm.toLowerCase()) || rot.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    : activeRegType === 'filiais'
    ? (filiais || []).filter(fil => fil.nome.toLowerCase().includes(searchTerm.toLowerCase()) || (fil.cnpj && fil.cnpj.includes(searchTerm)) || (fil.cidade && fil.cidade.toLowerCase().includes(searchTerm.toLowerCase())))
    : activeRegType === 'motivos'
    ? (motivosDevolucao || []).filter(mot => mot.toLowerCase().includes(searchTerm.toLowerCase()))
    : usersList.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()) || u.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  // Toggle de permissões individuais para o formulário de admin
  const togglePermission = (key: keyof UserPermissions) => {
    setAdminPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-6" id="view-cadastro">
      
      {/* Comutador / Filtro de Cadastro */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap rounded-xl bg-slate-100 p-1 gap-1 shrink-0 w-full lg:w-auto" id="filter-switcher">
          <button
            onClick={() => { setActiveRegType('entregador'); setSearchTerm(''); handleClearForm(); }}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRegType === 'entregador'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="switch-reg-entregadores"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Entregadores</span>
          </button>
          
          <button
            onClick={() => { setActiveRegType('empresa'); setSearchTerm(''); handleClearForm(); }}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRegType === 'empresa'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="switch-reg-empresas"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Empresas</span>
          </button>

          <button
            onClick={() => { setActiveRegType('rota'); setSearchTerm(''); handleClearForm(); }}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRegType === 'rota'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="switch-reg-rotas"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Rotas</span>
          </button>

          <button
            onClick={() => { setActiveRegType('filiais'); setSearchTerm(''); handleClearForm(); }}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRegType === 'filiais'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="switch-reg-filiais"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Filiais</span>
          </button>

          <button
            onClick={() => { setActiveRegType('motivos'); setSearchTerm(''); handleClearForm(); }}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRegType === 'motivos'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="switch-reg-motivos"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Motivos Devolução</span>
          </button>

          {/* SÓ O USUÁRIO MASTER CONSEGUE TER ACESSO À ABA DE USUÁRIOS E PERMISSÕES */}
          {currentUser.isMaster && (
            <button
              onClick={() => { setActiveRegType('usuarios'); setSearchTerm(''); handleClearForm(); }}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition border border-emerald-500/10 ${
                activeRegType === 'usuarios'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/60'
              }`}
              id="switch-reg-usuarios"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Usuários & Permissões</span>
            </button>
          )}
        </div>

        {/* Busca */}
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="input-cadastro-search"
            type="text"
            placeholder={
              activeRegType === 'entregador' ? "Buscar por entregador ou CPF..." : 
              activeRegType === 'empresa' ? "Buscar empresa ou CNPJ..." : 
              activeRegType === 'rota' ? "Buscar por rotas..." :
              activeRegType === 'filiais' ? "Buscar por filial ou CNPJ..." : 
              activeRegType === 'motivos' ? "Buscar por motivos de devolução..." : "Buscar logins, nomes ou e-mails..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/50 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA DA ESQUERDA: FORMULÁRIO DE ADIÇÃO/EDIÇÃO */}
        {activeRegType !== 'sistema' && (
          <div className="space-y-6 lg:col-span-1">
          
          {/* FORMULÁRIO DINÂMICO DE CADASTRO PADRÃO */}
          {activeRegType !== 'usuarios' ? (
            currentUser.permissions.cadastro_readonly ? (
              <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-205 text-center space-y-4 shadow-sm">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-100">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Apenas Leitura</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  A criação, alteração ou exclusão de registros nesta tela está restrita por determinação do Administrador Master. Você possui privilégios de visualização global ativa na base de dados unificada.
                </p>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 pb-3 border-b border-slate-50 flex items-center justify-between" id="form-header-title">
                  <span>{editingId ? "Editar Informações" : "Novo Cadastro"}</span>
                  <span className="text-xs bg-blue-50 text-blue-600 font-semibold py-0.5 px-2 rounded-full lowercase">
                    {activeRegType}
                  </span>
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                  
                  {formError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex gap-2.5 items-start">
                      <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="block text-xs font-bold text-rose-750 uppercase">Campos Pendentes!</span>
                        <span className="block text-[10px] text-rose-600 font-semibold leading-normal">{formError}</span>
                      </div>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex gap-2.5 items-start" id="form-success-banner-registration">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="block text-xs font-bold text-emerald-800 uppercase">Salvo com Sucesso!</span>
                        <span className="block text-[10.5px] text-emerald-700 font-medium leading-normal">{formSuccess}</span>
                      </div>
                    </div>
                  )}

                  {/* Nome Completo / Nome da Empresa / Nome da Rota / Nome da Filial / Motivo */}
                  <div className="space-y-1">
                    <label htmlFor="reg-nome" className="block text-[11px] font-bold text-slate-400 uppercase">
                      {activeRegType === 'entregador' ? "Nome Completo" : activeRegType === 'empresa' ? "Razão Social / Nome da Empresa" : activeRegType === 'filiais' ? "Nome da Filial" : activeRegType === 'motivos' ? "Descrição do Motivo" : "Nome da Rota"}
                    </label>
                    <input
                      id="reg-nome"
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={activeRegType === 'entregador' ? "Ex: Marcelo de Souza Martins" : activeRegType === 'empresa' ? "Ex: Shopee Brasil Ltda" : activeRegType === 'filiais' ? "Ex: Filial São Paulo - Matriz" : activeRegType === 'motivos' ? "Ex: Destinatário Ausente (3 tentativas)" : "Ex: Rota 05 - Zona Central Express"}
                      className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                      autoComplete="one-time-code"
                    />
                  </div>

                  {/* Campo de Rota Exclusivo: Descrição */}
                  {activeRegType === 'rota' && (
                    <>
                      <div className="space-y-1">
                        <label htmlFor="reg-rota-desc" className="block text-[11px] font-bold text-slate-400 uppercase">
                          Áreas / Bairros da Rota
                        </label>
                        <textarea
                          id="reg-rota-desc"
                          required
                          rows={3}
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          placeholder="Ex: Pinheiros, Vila Madalena, Alto de Pinheiros..."
                          className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Seleção de Filial da Rota */}
                      <div className="space-y-1 pt-2">
                        <label htmlFor="reg-rota-filial" className="block text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-450" />
                          Filial Pertencente
                        </label>
                        <select
                          id="reg-rota-filial"
                          value={formFilialId}
                          onChange={(e) => setFormFilialId(e.target.value)}
                          className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                        >
                          <option value="" disabled>Selecione a filial...</option>
                          {filiais.map(f => (
                            <option key={f.id} value={f.id}>{f.nome} ({f.cidade})</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                {activeRegType !== 'rota' && activeRegType !== 'motivos' && (
                  <>
                    {/* CNPJ / CPF - Ajusta automaticamente */}
                    <div className="space-y-1">
                      <label htmlFor="reg-documento" className="block text-[11px] font-bold text-slate-400 uppercase">
                        {activeRegType === 'entregador' ? "CPF (Documento)" : activeRegType === 'filiais' ? "CNPJ da Filial" : "CNPJ da Empresa"}
                      </label>
                      <input
                        id="reg-documento"
                        type="text"
                        value={formDoc}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activeRegType === 'entregador') {
                            setFormDoc(formatCPF(val));
                          } else if (activeRegType === 'filiais' || activeRegType === 'empresa') {
                            setFormDoc(formatCNPJ(val));
                          } else {
                            setFormDoc(val);
                          }
                        }}
                        placeholder={activeRegType === 'entregador' ? "Ex: 123.456.789-00" : "Ex: 12.345.678/0001-00"}
                        className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="one-time-code"
                      />
                    </div>

                    {/* Endereço / Cidade / Estado Dinâmico */}
                    {activeRegType !== 'filiais' ? (
                      <div className="space-y-1">
                        <label htmlFor="reg-endereco" className="block text-[11px] font-bold text-slate-400 uppercase">
                          Endereço
                        </label>
                        <input
                          id="reg-endereco"
                          type="text"
                          value={formEndereco}
                          onChange={(e) => setFormEndereco(e.target.value)}
                          placeholder="Ex: Av das Nações, 410, São Paulo"
                          className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          autoComplete="one-time-code"
                        />
                      </div>
                    ) : (
                      <>
                        {/* Estado (UF) em primeiro para filial */}
                        <div className="space-y-1">
                          <label htmlFor="reg-estado" className="block text-[11px] font-bold text-slate-400 uppercase">
                            Estado (UF)
                          </label>
                          <select
                            id="reg-estado"
                            value={formEstado}
                            onChange={(e) => {
                              const newUf = e.target.value;
                              setFormEstado(newUf);
                              // Auto-selecionar a primeira cidade do estado escolhido
                              const cities = CIDADES_POR_ESTADO[newUf] || [];
                              if (cities.length > 0) {
                                setFormEndereco(cities[0]);
                                setShowCustomCity(false);
                              } else {
                                setFormEndereco('');
                                setShowCustomCity(true);
                              }
                            }}
                            className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          >
                            {ESTADOS_BRASIL.map(est => (
                              <option key={est.uf} value={est.uf}>
                                {est.nome} ({est.uf})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cidade da Filial dependente do Estado */}
                        <div className="space-y-1">
                          <label htmlFor="reg-endereco-cidade" className="block text-[11px] font-bold text-slate-400 uppercase">
                            Cidade da Filial
                          </label>
                          {!showCustomCity ? (
                            <select
                              id="reg-endereco-cidade"
                              value={formEndereco}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'OUTRA') {
                                  setShowCustomCity(true);
                                  setFormEndereco('');
                                } else {
                                  setFormEndereco(val);
                                }
                              }}
                              className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                            >
                              <option value="">Selecione a Cidade...</option>
                              {(CIDADES_POR_ESTADO[formEstado] || []).map(city => (
                                <option key={city} value={city}>{city}</option>
                              ))}
                              <option value="OUTRA">Outra cidade... (Especificar manualmente)</option>
                            </select>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                id="reg-endereco-cidade-input"
                                type="text"
                                value={formEndereco}
                                onChange={(e) => setFormEndereco(e.target.value)}
                                placeholder="Digite o nome da cidade"
                                className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                              />
                              {(CIDADES_POR_ESTADO[formEstado] || []).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowCustomCity(false);
                                    const firstCity = CIDADES_POR_ESTADO[formEstado]?.[0] || '';
                                    setFormEndereco(firstCity);
                                  }}
                                  className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-extrabold border border-slate-200 cursor-pointer shrink-0"
                                >
                                  Lista
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Endereço Completo da Filial em terceiro */}
                        <div className="space-y-1">
                          <label htmlFor="reg-filial-endereco" className="block text-[11px] font-bold text-slate-400 uppercase">
                            Endereço Completo da Filial
                          </label>
                          <input
                            id="reg-filial-endereco"
                            type="text"
                            value={formFilialEndereco}
                            onChange={(e) => setFormFilialEndereco(e.target.value)}
                            placeholder="Ex: Av. Francisco Glicério, 450, Centro... (para o recibo)"
                            className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            autoComplete="one-time-code"
                          />
                        </div>
                      </>
                    )}

                    {/* Email */}
                    <div className="space-y-1">
                      <label htmlFor="reg-email" className="block text-[11px] font-bold text-slate-400 uppercase">
                        E-mail
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="Ex: financeiro@operadora.com"
                        className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                        autoComplete="one-time-code"
                      />
                    </div>

                    {/* Contato / Telefone */}
                    <div className="space-y-1">
                      <label htmlFor="reg-contato" className="block text-[11px] font-bold text-slate-400 uppercase">
                        Telefone de Contato
                      </label>
                      <input
                        id="reg-contato"
                        type="text"
                        value={formContato}
                        onChange={(e) => setFormContato(formatPhone(e.target.value))}
                        placeholder="Ex: (11) 98765-4321"
                        className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                        autoComplete="one-time-code"
                      />
                    </div>
                  </>
                )}

                {activeRegType === 'filiais' && (
                  <div className="space-y-2 pt-3 border-t border-slate-150">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between">
                      <span>Logo da Filial / Empresa</span>
                      <span className="text-[9px] text-blue-500 font-extrabold font-mono uppercase bg-blue-50 px-1 py-0.5 rounded">
                        Somente Master
                      </span>
                    </label>

                    <div className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="relative shrink-0">
                        {formFilialLogo ? (
                          <div className="relative group">
                            <img 
                              src={formFilialLogo} 
                              alt="Logo Filial Preview" 
                              className="w-12 h-12 rounded-xl object-contain border border-slate-200 bg-white"
                              referrerPolicy="no-referrer"
                            />
                            {(currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') && (
                              <button
                                type="button"
                                onClick={() => setFormFilialLogo('')}
                                className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600 transition shadow-sm cursor-pointer"
                                title="Remover Logo"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-center text-teal-600">
                            <Building2 className="h-5 w-5 stroke-1.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {(currentUser.isMaster || currentUser.id === 'usr-master' || currentUser.username === 'master') ? (
                          <>
                            <p className="text-[10px] text-slate-400 leading-tight mb-1">
                              Selecione uma imagem quadrada (JPG, PNG) para identificar a filial.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => filialLogoInputRef.current?.click()}
                                className="text-[10px] text-blue-600 bg-white hover:bg-slate-55 shadow-sm border border-slate-155 px-2.5 py-1 rounded cursor-pointer font-bold"
                                id="btn-upload-filial-logo"
                              >
                                Escolher Imagem
                              </button>
                              <input 
                                type="file" 
                                ref={filialLogoInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleFilialLogoUpload} 
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-[10px] text-slate-400 leading-tight font-medium">
                            Apenas o usuário <span className="font-bold text-slate-600">Master</span> tem permissão para alterar ou cadastrar a logo da filial.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* SE FOR ENTREGADOR: Upload ou Seleção de Imagem */}
                {activeRegType === 'entregador' && (
                  <div className="space-y-2 pt-2 border-t border-slate-50">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">
                      Foto do Entregador (Identificação)
                    </label>
                    
                    <div className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="relative shrink-0">
                        {formFotoUrl ? (
                          <img 
                            src={formFotoUrl} 
                            alt="Preview" 
                            className="w-12 h-12 rounded-full object-cover border border-slate-200 cursor-pointer hover:scale-105 active:scale-95 hover:border-blue-300 transition duration-200"
                            title="Clique para ampliar a foto do entregador"
                            referrerPolicy="no-referrer"
                            onClick={() => {
                              const win = window.open();
                              if (win) {
                                win.document.write(`
                                  <html>
                                    <head>
                                      <title>Visualização de Foto - Perfil</title>
                                      <style>
                                        body {
                                          margin: 0;
                                          background-color: #0f172a;
                                          display: flex;
                                          align-items: center;
                                          justify-content: center;
                                          min-height: 100vh;
                                          font-family: system-ui, -apple-system, sans-serif;
                                        }
                                        img {
                                          max-width: 95vw;
                                          max-height: 95vh;
                                          border-radius: 12px;
                                          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
                                          object-fit: contain;
                                          border: 2px solid rgba(255, 255, 255, 0.1);
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <img src="${formFotoUrl}" alt="Preview" />
                                    </body>
                                  </html>
                                `);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-blue-100/60 rounded-full flex items-center justify-center text-blue-600 text-xs">
                            <ImageIcon className="h-5 w-5 stroke-1.5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-400 truncate leading-tight mb-1">
                          Arraste ou anexe um arquivo JPG de identificação.
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[10px] text-blue-600 bg-white hover:bg-slate-55 shadow-sm border border-slate-150 px-2.5 py-1 rounded cursor-pointer"
                          id="btn-upload-fake-file"
                        >
                          Selecionar Arquivo
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handlePhotoUpload} 
                        />
                      </div>
                    </div>

                    {/* Escolher um dos presets de testador rápido */}
                    <div className="mt-1">
                      <span className="block text-[9px] text-slate-400 uppercase font-semibold">Usar foto teste rápida:</span>
                      <div className="flex gap-1.5 mt-1">
                        {PRESET_AVATARS.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormFotoUrl(url)}
                            className={`w-7 h-7 rounded-full overflow-hidden border-2 transition ${
                              formFotoUrl === url ? 'border-blue-500 scale-105 shadow' : 'border-transparent hover:border-slate-300'
                            }`}
                          >
                            <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Placa do Veículo */}
                    <div className="space-y-1 pt-2 border-t border-slate-100">
                      <label htmlFor="reg-placa" className="block text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Car className="h-3.5 w-3.5 text-slate-450" />
                        Placa do Veículo
                      </label>
                      <input
                        id="reg-placa"
                        type="text"
                        value={formPlacaVeiculo}
                        onChange={(e) => setFormPlacaVeiculo(e.target.value.toUpperCase())}
                        placeholder="Ex: ABC1D23 ou BRA2E19"
                        className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-semibold block"
                      />
                    </div>

                    {/* Documento de Habilitação (CNH) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-slate-450" />
                        Documento de Habilitação (CNH)
                      </label>
                      
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-2">
                        {formCnhDoc ? (
                          <div className="flex flex-col gap-1.5 bg-white p-2 rounded-lg border border-slate-150">
                            <div className="flex items-center space-x-2 min-w-0">
                              <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                              </div>
                              <div className="truncate flex-1">
                                <p className="text-[10px] font-bold text-slate-700 truncate">
                                  {formCnhDoc.startsWith('data:application/pdf') ? 'CNH_Anexada.pdf' : 'CNH_Anexada.jpg'}
                                </p>
                                <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-0.5">
                                  <CheckCircle className="h-2 w-2" />
                                  Arquivo Carregado
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-end space-x-1 border-t border-slate-50 pt-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const win = window.open();
                                  if (win) {
                                    win.document.write(`<iframe src="${formCnhDoc}" style="border:none; width:100%; height:100%;"></iframe>`);
                                  }
                                }}
                                className="text-[9px] text-blue-600 hover:bg-blue-50 font-bold px-2 py-1 rounded transition cursor-pointer"
                              >
                                Visualizar
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormCnhDoc('')}
                                className="text-[9px] text-rose-600 hover:bg-rose-50 font-bold px-2 py-1 rounded transition cursor-pointer"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-3 border border-dashed border-slate-200 rounded-lg bg-white/50 text-center">
                            <Upload className="h-5 w-5 stroke-1.5 text-slate-400 mb-1" />
                            <p className="text-[9px] text-slate-400 font-semibold mb-2">
                              Selecione o documento de habilitação (CNH)
                            </p>
                            <button
                              type="button"
                              onClick={() => cnhFileInputRef.current?.click()}
                              className="text-[9px] text-blue-600 bg-white hover:bg-slate-50 shadow-xs border border-slate-200 px-2.5 py-1 rounded-md font-bold cursor-pointer"
                              id="btn-upload-cnh"
                            >
                              Anexar CNH
                            </button>
                            <input 
                              type="file" 
                              ref={cnhFileInputRef} 
                              className="hidden" 
                              accept="image/*,application/pdf" 
                              onChange={handleCnhUpload} 
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Seleção de Filial do Entregador */}
                    <div className="space-y-1 pt-2 border-t border-slate-100">
                      <label htmlFor="reg-entregador-filial" className="block text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-450" />
                        Filial do Entregador
                      </label>
                      <select
                        id="reg-entregador-filial"
                        value={formFilialId}
                        onChange={(e) => setFormFilialId(e.target.value)}
                        className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="" disabled>Selecione uma filial...</option>
                        {filiais.map(f => (
                          <option key={f.id} value={f.id}>{f.nome} ({f.cidade})</option>
                        ))}
                      </select>
                    </div>

                  </div>
                )}

                {/* SE FOR EMPRESA: Valores Administrativos */}
                {activeRegType === 'empresa' && (
                  <div className="space-y-3 pt-3 border-t border-slate-50" id="company-extra-fields">
                    <div className="grid grid-cols-2 gap-3" id="company-fees-fields">
                      <div className="space-y-1">
                        <label htmlFor="reg-taxa-dist" className="block text-[11px] font-bold text-slate-400 uppercase">
                          Valor p/ Pacote (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-slate-400">R$</span>
                          <input
                            id="reg-taxa-dist"
                            type="number"
                            step="0.10"
                            min="0.50"
                            value={formValorPorPacote}
                            onChange={(e) => setFormValorPorPacote(e.target.value)}
                            className="w-full bg-slate-50 pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="reg-taxa-comissao" className="block text-[11px] font-bold text-slate-400 uppercase">
                          Comissão Entr. (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-slate-400">R$</span>
                          <input
                            id="reg-taxa-comissao"
                            type="number"
                            step="0.10"
                            min="0.50"
                            value={formComissaoEntregador}
                            onChange={(e) => setFormComissaoEntregador(e.target.value)}
                            className="w-full bg-slate-50 pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700/80 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="reg-prefixos" className="block text-[11px] font-bold text-slate-400 uppercase">
                        Prefixos Código de Barras
                      </label>
                      <input
                        id="reg-prefixos"
                        type="text"
                        value={formPrefixos}
                        onChange={(e) => setFormPrefixos(e.target.value)}
                        placeholder="Ex: ML, ME, MELI"
                        className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none"
                      />
                      <span className="block text-[9px] text-slate-400 font-medium leading-normal mt-1">
                        Separe por vírgula. Permite identificar a empresa parceira automaticamente ao ler a etiqueta.
                      </span>
                    </div>
                  </div>
                )}

                {/* Botões de Submissão */}
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/5 transition text-center cursor-pointer"
                    id="btn-cadastro-salvar"
                  >
                    {editingId ? "Salvar Alterações" : "Efetuar Cadastro"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleClearForm}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold px-3 rounded-xl transition cursor-pointer"
                      id="btn-cadastro-cancelar"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

              </form>
            </div>
          )) : (
            
            // FORMULÁRIO EXCLUSIVO DE AUTENTICAÇÃO E PERMISSÕES (Se Master e aba 'usuarios' estiver ativa)
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-4 pb-3 border-b border-emerald-50 flex items-center justify-between">
                <span>Controle de Permissão</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Privilégio Master
                </span>
              </h3>

                    {selectedUserToEdit ? (
                <form onSubmit={handleSaveAdminUserChanges} className="space-y-4" autoComplete="off">
                  
                  {/* Info do usuário selecionado */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 space-y-1">
                    <p className="text-xs font-bold text-slate-700">{selectedUserToEdit.nomeCompleto}</p>
                    <p className="text-[10px] text-slate-500">Usuário: <span className="font-semibold text-blue-600">@{selectedUserToEdit.username}</span></p>
                    {selectedUserToEdit.isMaster && (
                      <p className="text-[9px] text-amber-700 bg-amber-50 rounded p-1 border border-amber-100 font-bold mt-1 leading-normal">
                        *(Insira a palavra-chave que será usada para redefinir a sua senha Master caso se esqueça).
                      </p>
                    )}
                  </div>

                  {/* Edição de Palavra-Chave */}
                  <div className="space-y-1.5">
                    <label htmlFor="admin-edit-email-input" className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Palavra-Chave de Recuperação
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        id="admin-edit-email-input"
                        type="text"
                        required
                        placeholder="Ex: dlogadmin2026 (Anote em local seguro)"
                        value={adminUserEmail}
                        onChange={(e) => setAdminUserEmail(e.target.value)}
                        className="w-full bg-slate-50 pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {adminUserSuccessMsg && (
                    <div className="bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl text-emerald-800 text-[11px] font-bold">
                      {adminUserSuccessMsg}
                    </div>
                  )}

                  {adminUserErrorMsg && (
                    <div className="bg-rose-50 border border-rose-150 p-2.5 rounded-xl text-rose-800 text-[11px] font-bold">
                      {adminUserErrorMsg}
                    </div>
                  )}

                  {/* Redefinição de senha */}
                  <div className="space-y-1.5 pt-1.5">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Definir Nova Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        disabled={selectedUserToEdit.isMaster}
                        placeholder={selectedUserToEdit.isMaster ? "Inalterável para o Administrador Master" : "Digite nova senha (master não vê a antiga)"}
                        value={adminUserNewPassword}
                        onChange={(e) => setAdminUserNewPassword(e.target.value)}
                        className="w-full bg-slate-50 pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        id="admin-reset-pwd-input"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 block font-medium leading-normal">
                      {selectedUserToEdit.isMaster 
                        ? "*(A senha do Administrador Master é protegida por auditoria técnica e não pode ser modificada)."
                        : "*(O master não poderá ver a senha atual do operador, apenas criar e sobrescrever uma nova)."
                      }
                    </span>
                  </div>

                  {/* LIMITE DE CONEXÕES SIMULTÂNEAS */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                  {/* Limite de Conexões Simultâneas removido */}
                  </div>

                  {/* CHECKBOX DE PERMISSÕES DINÂMICAS */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                      Permissões de Telas Autorizadas:
                    </label>
                    <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-150">
                      
                      {/* Dashboard */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.dashboard}
                            onChange={() => togglePermission('dashboard')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Painel Geral & BI</span>
                        </label>
                        {adminPermissions.dashboard && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'dashboard' ? null : 'dashboard')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.dashboard_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.dashboard_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'dashboard' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.dashboard_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, dashboard_readonly: !prev.dashboard_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia salvar alterações, carregar dados ou limpar métricas do BI.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expedição */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.expedicao}
                            onChange={() => togglePermission('expedicao')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Saída (Checkout Guia)</span>
                        </label>
                        {adminPermissions.expedicao && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'expedicao' ? null : 'expedicao')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.expedicao_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.expedicao_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'expedicao' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.expedicao_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, expedicao_readonly: !prev.expedicao_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Permite ver histórico, mas bloqueia o lançamento ou exclusão de Saídas de veículos.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Baixas */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.baixas}
                            onChange={() => togglePermission('baixas')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Baixa & Retorno</span>
                        </label>
                        {adminPermissions.baixas && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'baixas' ? null : 'baixas')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.baixas_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.baixas_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'baixas' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.baixas_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, baixas_readonly: !prev.baixas_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Permite ver pacotes e lotes de rota, mas impede alteração de status para entregue ou devolução.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Em Rota */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.emRota}
                            onChange={() => togglePermission('emRota')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Em Rota (Painel Ativo)</span>
                        </label>
                        {adminPermissions.emRota && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'emRota' ? null : 'emRota')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.emRota_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.emRota_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'emRota' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.emRota_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, emRota_readonly: !prev.emRota_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia ações de monitoramento e pausa da frota, tornando a aba puramente visual.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cadastros */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.cadastro}
                            onChange={() => togglePermission('cadastro')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Cadastros Dinâmicos</span>
                        </label>
                        {adminPermissions.cadastro && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'cadastro' ? null : 'cadastro')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.cadastro_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.cadastro_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'cadastro' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.cadastro_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, cadastro_readonly: !prev.cadastro_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia a criação, edição ou exclusão de Entregadores, Empresas, Rotas e Filiais.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Folha */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.folha}
                            onChange={() => togglePermission('folha')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Folha Salarial & Recibos</span>
                        </label>
                        {adminPermissions.folha && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'folha' ? null : 'folha')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.folha_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.folha_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'folha' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.folha_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, folha_readonly: !prev.folha_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Permite ver valores e holerites, mas bloqueia quitações de saldo, lançamentos extras ou adiantamentos.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Relatórios */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.relatorios}
                            onChange={() => togglePermission('relatorios')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Relatórios & Estratégia</span>
                        </label>
                        {adminPermissions.relatorios && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'relatorios' ? null : 'relatorios')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.relatorios_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.relatorios_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'relatorios' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.relatorios_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, relatorios_readonly: !prev.relatorios_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia download ou geração de relatórios oficiais e ações de limpeza no log do sistema.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Estoque */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.estoque !== false}
                            onChange={() => togglePermission('estoque')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Controle de Estoque</span>
                        </label>
                        {adminPermissions.estoque !== false && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'estoque' ? null : 'estoque')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                adminPermissions.estoque_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{adminPermissions.estoque_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'estoque' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1 border-b border-slate-100 pb-1.5 mb-1.5">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.estoque_readonly || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, estoque_readonly: !prev.estoque_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar (Read Only)<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia criação de novos pacotes, bipagem de chegada de estoque, e limpezas. Permite apenas visualização e filtros do extrato.</span></span>
                                  </label>

                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={adminPermissions.alterar_estoque_salvo || false}
                                      onChange={() => setAdminPermissions(prev => ({ ...prev, alterar_estoque_salvo: !prev.alterar_estoque_salvo }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Alterar Qtd Central Bipados do Dia Salvo<br /><span className="text-[9px] text-slate-400 font-medium">Permite alterar a quantidade total de pacotes inserida para cada empresa do dia mesmo depois que o registro de quantidade já foi salvo.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Painel TV */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={adminPermissions.tvPainel}
                            onChange={() => togglePermission('tvPainel')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Painel para TV (HDMI)</span>
                        </label>
                        {adminPermissions.tvPainel && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionEditDropdown(openPermissionEditDropdown === 'tvPainel' ? null : 'tvPainel')}
                              className="p-1.5 rounded-lg transition hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1 text-[10px] cursor-pointer font-semibold"
                              title="Painel informativo passivo"
                            >
                              <span>Modo TV</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionEditDropdown === 'tvPainel' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionEditDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionEditDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <div className="py-1 text-slate-500 font-medium leading-relaxed text-[11px]">
                                    Esta tela possui apenas o modo de exibição passiva para TV/HDMI, não permitindo ações de escrita e alteração de dados.
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                      {/* Acesso de Filiais para Edição de Usuário */}
                      <div className="space-y-2 pt-3 border-t border-slate-100">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Acesso de Filiais:
                        </label>
                        <p className="text-[10px] text-slate-400 leading-normal font-semibold">Habilite filiais autorizadas para este usuário e clique na estrela para definir a filial favorita (padrão de início).</p>
                        <div className="bg-slate-50 mt-2 rounded-xl border border-slate-150 divide-y divide-slate-150 overflow-hidden">
                          {filiais.map(f => {
                            const isAuthorized = adminUserFiliais.includes(f.id);
                            const isFavorite = adminUserDefaultFilialId === f.id;
                            return (
                              <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-100/50 transition">
                                <label className="flex items-center gap-2.5 text-xs text-slate-700 select-none cursor-pointer flex-1 font-bold">
                                  <input
                                    type="checkbox"
                                    checked={isAuthorized}
                                    onChange={() => {
                                      if (isAuthorized) {
                                        setAdminUserFiliais(prev => prev.filter(id => id !== f.id));
                                        if (isFavorite) {
                                          setAdminUserDefaultFilialId('');
                                        }
                                      } else {
                                        setAdminUserFiliais(prev => [...prev, f.id]);
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                  />
                                  <span className="truncate">{f.nome}</span>
                                </label>
                                
                                <button
                                  type="button"
                                  title={isFavorite ? "Remover filial favorita" : "Definir como filial favorita"}
                                  onClick={() => {
                                    if (isFavorite) {
                                      setAdminUserDefaultFilialId('');
                                    } else {
                                      setAdminUserDefaultFilialId(f.id);
                                      if (!isAuthorized) {
                                        setAdminUserFiliais(prev => [...prev, f.id]);
                                      }
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg transition-all duration-150 ${
                                    isFavorite 
                                      ? 'text-amber-500 hover:text-amber-600 scale-110' 
                                      : 'text-slate-300 hover:text-slate-400 hover:scale-105'
                                  }`}
                                >
                                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400' : 'fill-none'}`} />
                                </button>
                              </div>
                            );
                          })}
                          {filiais.length === 0 && (
                            <div className="p-3 text-center text-xs text-slate-400 font-medium">
                              Nenhuma filial cadastrada no sistema.
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                    >
                      Salvar Segurança do Usuário
                    </button>
                    <button
                      type="button"
                      onClick={handleClearForm}
                      className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Voltar
                    </button>
                  </div>

                </form>
              ) : (
                <form onSubmit={handleCreateNewUser} className="space-y-4" autoComplete="off">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-150">
                    <p className="text-xs font-bold text-slate-700">Cadastrar Novo Usuário</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Defina as credenciais, palavra-chave e telas de acesso.</p>
                  </div>

                  {/* Nome Completo */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos de Souza"
                      value={newUserNome}
                      onChange={(e) => setNewUserNome(e.target.value)}
                      className="w-full bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Nome de Usuário (@) */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Nome de Usuário (Sem espaços)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">@</span>
                      <input
                        type="text"
                        required
                        placeholder="Ex: carlos.souza"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        className="w-full bg-slate-50 pl-7 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Palavra-Chave de Recuperação */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Palavra-Chave de Recuperação
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: dlogcarlos2026 (Para emergências)"
                        value={newUserPalavraChave}
                        onChange={(e) => setNewUserPalavraChave(e.target.value)}
                        className="w-full bg-slate-50 pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Senha e Confirmar Senha */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Senha Inicial
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Mín. 4 dig."
                        value={newUserSenha}
                        onChange={(e) => setNewUserSenha(e.target.value)}
                        className="w-full bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Confirmar Senha
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Repita a senha"
                        value={newUserConfirmarSenha}
                        onChange={(e) => setNewUserConfirmarSenha(e.target.value)}
                        className="w-full bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {newUserSuccessMsg && (
                    <div className="bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl text-emerald-800 text-[11px] font-bold">
                      {newUserSuccessMsg}
                    </div>
                  )}

                  {newUserErrorMsg && (
                    <div className="bg-rose-50 border border-rose-150 p-2.5 rounded-xl text-rose-800 text-[11px] font-bold">
                      {newUserErrorMsg}
                    </div>
                  )}

                  {/* CHECKBOX DE PERMISSÕES PARA O NOVO USUÁRIO */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                      Permissões de Telas Autorizadas:
                    </label>
                    <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-150">
                      
                      {/* Dashboard */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.dashboard}
                            onChange={() => toggleNewUserPermission('dashboard')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Painel Geral & BI</span>
                        </label>
                        {newUserPermissions.dashboard && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'dashboard' ? null : 'dashboard')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.dashboard_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.dashboard_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'dashboard' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.dashboard_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, dashboard_readonly: !prev.dashboard_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Oculta dados financeiros sensíveis, de faturamento histórico e de margem real do BI.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expedição */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.expedicao}
                            onChange={() => toggleNewUserPermission('expedicao')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Saída (Checkout Guia)</span>
                        </label>
                        {newUserPermissions.expedicao && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'expedicao' ? null : 'expedicao')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.expedicao_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.expedicao_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'expedicao' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.expedicao_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, expedicao_readonly: !prev.expedicao_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia confirmação de saída de guias e alteração de quantidade de bicos.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Retorno */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.baixas}
                            onChange={() => toggleNewUserPermission('baixas')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Baixa & Retorno</span>
                        </label>
                        {newUserPermissions.baixas && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'baixas' ? null : 'baixas')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.baixas_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.baixas_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'baixas' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.baixas_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, baixas_readonly: !prev.baixas_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia confirmação de retornos, edições de bicos devolvidos e adiantamentos.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Em Rota */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.emRota}
                            onChange={() => toggleNewUserPermission('emRota')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Em Rota (Painel Ativo)</span>
                        </label>
                        {newUserPermissions.emRota && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'emRota' ? null : 'emRota')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.emRota_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.emRota_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'emRota' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.emRota_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, emRota_readonly: !prev.emRota_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia ações de monitoramento e pausa da frota, tornando a aba puramente visual.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cadastros */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.cadastro}
                            onChange={() => toggleNewUserPermission('cadastro')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Cadastros Dinâmicos</span>
                        </label>
                        {newUserPermissions.cadastro && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'cadastro' ? null : 'cadastro')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.cadastro_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-100 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.cadastro_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'cadastro' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.cadastro_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, cadastro_readonly: !prev.cadastro_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia a criação, edição ou exclusão de Entregadores, Empresas, Rotas e Filiais.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Folha */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.folha}
                            onChange={() => toggleNewUserPermission('folha')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Folha Salarial & Recibos</span>
                        </label>
                        {newUserPermissions.folha && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'folha' ? null : 'folha')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.folha_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.folha_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'folha' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.folha_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, folha_readonly: !prev.folha_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Permite ver valores e holerites, mas bloqueia quitações de saldo, lançamentos extras ou adiantamentos.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Relatórios */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.relatorios}
                            onChange={() => toggleNewUserPermission('relatorios')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Relatórios & Estratégia</span>
                        </label>
                        {newUserPermissions.relatorios && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'relatorios' ? null : 'relatorios')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.relatorios_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.relatorios_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'relatorios' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.relatorios_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, relatorios_readonly: !prev.relatorios_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia download ou geração de relatórios oficiais e ações de limpeza no log do sistema.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Estoque */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.estoque !== false}
                            onChange={() => toggleNewUserPermission('estoque')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Controle de Estoque</span>
                        </label>
                        {newUserPermissions.estoque !== false && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'estoque' ? null : 'estoque')}
                              className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] cursor-pointer ${
                                newUserPermissions.estoque_readonly 
                                  ? 'bg-amber-100/80 border border-amber-200 text-amber-700 font-bold' 
                                  : 'hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 font-semibold'
                              }`}
                              title="Configurar permissões minuciosas desta aba"
                            >
                              <span>{newUserPermissions.estoque_readonly ? 'Apenas Ver' : 'Total'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'estoque' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1 border-b border-slate-100 pb-1.5 mb-1.5">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.estoque_readonly || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, estoque_readonly: !prev.estoque_readonly }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Apenas Visualizar (Read Only)<br /><span className="text-[9px] text-slate-400 font-medium">Bloqueia criação de novos pacotes, bipagem de chegada de estoque, e limpezas. Permite apenas visualização e filtros do extrato.</span></span>
                                  </label>

                                  <label className="flex items-start gap-2 cursor-pointer select-none font-bold text-slate-600 hover:text-slate-800 py-1">
                                    <input
                                      type="checkbox"
                                      checked={newUserPermissions.alterar_estoque_salvo || false}
                                      onChange={() => setNewUserPermissions(prev => ({ ...prev, alterar_estoque_salvo: !prev.alterar_estoque_salvo }))}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0"
                                    />
                                    <span className="leading-tight">Alterar Qtd Central Bipados do Dia Salvo<br /><span className="text-[9px] text-slate-400 font-medium">Permite alterar a quantidade total de pacotes inserida para cada empresa do dia mesmo depois que o registro de quantidade já foi salvo.</span></span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Painel TV */}
                      <div className="relative flex items-center justify-between p-1.5 hover:bg-slate-100/30 rounded-lg border-t border-slate-100">
                        <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold select-none cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={newUserPermissions.tvPainel}
                            onChange={() => toggleNewUserPermission('tvPainel')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>Painel para TV (HDMI)</span>
                        </label>
                        {newUserPermissions.tvPainel && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenPermissionNewDropdown(openPermissionNewDropdown === 'tvPainel' ? null : 'tvPainel')}
                              className="p-1.5 rounded-lg transition hover:bg-slate-200 border border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1 text-[10px] cursor-pointer font-semibold"
                              title="Painel informativo passivo"
                            >
                              <span>Modo TV</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {openPermissionNewDropdown === 'tvPainel' && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenPermissionNewDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs text-slate-700">
                                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Ações autorizadas</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setOpenPermissionNewDropdown(null)} 
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                  
                                  <div className="py-1 text-slate-500 font-medium leading-relaxed text-[11px]">
                                    Esta tela possui apenas o modo de exibição passiva para TV/HDMI, não permitindo ações de escrita e alteração de dados.
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Limite de Conexões Simultâneas Novo Usuário removido */}

                  {/* Acesso de Filiais para Novo Usuário */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Acesso de Filiais:
                    </label>
                    <p className="text-[10px] text-slate-400 leading-normal font-semibold mb-2">Selecione quais filiais este usuário terá permissão e clique na estrela para definir a filial favorita (padrão de início).</p>
                    <div className="bg-slate-50 rounded-xl border border-slate-150 divide-y divide-slate-150 overflow-hidden">
                      {filiais.map(f => {
                        const isAuthorized = newUserFiliais.includes(f.id);
                        const isFavorite = newUserDefaultFilialId === f.id;
                        return (
                          <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-100/50 transition">
                            <label className="flex items-center gap-2.5 text-xs text-slate-700 select-none cursor-pointer flex-1 font-bold">
                              <input
                                type="checkbox"
                                checked={isAuthorized}
                                onChange={() => {
                                  if (isAuthorized) {
                                    setNewUserFiliais(prev => prev.filter(id => id !== f.id));
                                    if (isFavorite) {
                                      setNewUserDefaultFilialId('');
                                    }
                                  } else {
                                    setNewUserFiliais(prev => [...prev, f.id]);
                                  }
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <span className="truncate">{f.nome}</span>
                            </label>
                            
                            <button
                              type="button"
                              title={isFavorite ? "Remover filial favorita" : "Definir como filial favorita"}
                              onClick={() => {
                                if (isFavorite) {
                                  setNewUserDefaultFilialId('');
                                } else {
                                  setNewUserDefaultFilialId(f.id);
                                  if (!isAuthorized) {
                                    setNewUserFiliais(prev => [...prev, f.id]);
                                  }
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-all duration-150 ${
                                isFavorite 
                                  ? 'text-amber-500 hover:text-amber-600 scale-110' 
                                  : 'text-slate-300 hover:text-slate-400 hover:scale-105'
                              }`}
                            >
                              <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400' : 'fill-none'}`} />
                            </button>
                          </div>
                        );
                      })}
                      {filiais.length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-400 font-medium">
                          Nenhuma filial cadastrada no sistema.
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer text-center"
                  >
                    Efetuar Cadastro do Usuário
                  </button>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center text-[10px] text-amber-800 font-bold">
                    <p>💡 Para editar permissões de um usuário já existente ou redefinir a senha dele, selecione-o clicando diretamente na lista à direita.</p>
                  </div>
                </form>
              )}
            </div>

          )}

          {/* PAINEL DE ALTERAÇÃO DA PRÓPRIA SENHA DO OPERADOR CONECTADO. VISÍVEL APENAS NA ABA DE CADASTRO DE USUÁRIO */}
          {activeRegType === 'usuarios' && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <button
                type="button"
                onClick={() => setShowSelfPassInputs(!showSelfPassInputs)}
                className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 uppercase tracking-wider"
                id="btn-accordion-change-self-password"
              >
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-blue-500" />
                  <span>🔐 Alterar Minha Senha</span>
                </span>
                <span className="text-[10px] text-blue-600 font-bold">
                  {showSelfPassInputs ? 'recolher [-]' : 'expandir [+]'}
                </span>
              </button>

              {showSelfPassInputs && (
                <form onSubmit={handleUpdateSelfPassSubmit} className="space-y-3 mt-4 pt-4 border-t border-slate-50" autoComplete="off">
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Usuário atual: <span className="font-bold text-blue-600">@{currentUser.username} {currentUser.isMaster && '(Master)'}</span>.
                  </p>

                  {currentUser.isMaster && (
                    <div className="p-3 bg-amber-50 text-amber-950 text-[11px] leading-relaxed font-semibold rounded-xl border border-amber-200">
                      🔒 <strong className="text-amber-800">Senha do Master Protegida:</strong> A senha de acesso do Administrador Master foi definida permanentemente como <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 text-xs font-mono font-bold">dlog1a2b3c</code> e é inalterável, garantindo a integridade dos dados e auditoria do system.
                    </div>
                  )}

                  {selfSuccessMsg && (
                    <div className="p-2 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-lg border border-emerald-100">
                      {selfSuccessMsg}
                    </div>
                  )}

                  {selfErrorMsg && (
                    <div className="p-2 bg-rose-50 text-rose-800 text-[10px] font-bold rounded-lg border border-rose-100">
                      {selfErrorMsg}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="self-new-password" className="block text-[10px] font-bold text-slate-400 uppercase">
                      Nova Senha
                    </label>
                    <input
                      id="self-new-password"
                      required
                      disabled={currentUser.isMaster}
                      type="password"
                      placeholder={currentUser.isMaster ? "Bloqueado para o Master" : "Mínimo 4 caracteres"}
                      value={selfNewPassword}
                      onChange={(e) => setSelfNewPassword(e.target.value)}
                      className="w-full bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="self-confirm-password" className="block text-[10px] font-bold text-slate-400 uppercase">
                      Repita a Nova Senha
                    </label>
                    <input
                      id="self-confirm-password"
                      required
                      disabled={currentUser.isMaster}
                      type="password"
                      placeholder={currentUser.isMaster ? "Bloqueado para o Master" : "Confirme a nova senha"}
                      value={selfConfirmPassword}
                      onChange={(e) => setSelfConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={currentUser.isMaster}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold tracking-wider uppercase shadow cursor-pointer transition disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none"
                    id="submit-change-self-password"
                  >
                    {currentUser.isMaster ? "Alteração Bloqueada" : "Confirmar Nova Senha"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* PAINEL DE RESTRIÇÃO POR E-MAIL GOOGLE - REMOVIDO */}
          {false && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mt-4 animate-in fade-in" id="panel-google-identity-gate">
              <button
                type="button"
                onClick={() => setShowGoogleGateSettings(!showGoogleGateSettings)}
                className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 uppercase tracking-wider cursor-pointer font-sans"
                id="btn-accordion-google-gate"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <span>🛡️ Porta de Segurança (Google Gate)</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded ${googleAuthConfig?.isEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-slate-100 text-slate-500'}`}>{googleAuthConfig?.isEnabled ? 'ATIVO ●' : 'DESATIVADO'}</span>
                  <span>{showGoogleGateSettings ? 'recolher [-]' : 'expandir [+]'}</span>
                </span>
              </button>

              {showGoogleGateSettings && (
                <div className="space-y-4 mt-4 pt-4 border-t border-slate-100 font-sans">
                  <div className="p-3 bg-blue-50 text-blue-950 text-[11px] leading-relaxed font-semibold rounded-xl border border-blue-200">
                    💡 <strong>Como Funciona:</strong> Quando ativada, qualquer pessoa que abrir o link do sistema precisará primeiro autenticar sua conta Google. Se o e-mail não estiver na lista autorizada abaixo, a tela de login nem abrirá. Os e-mails <strong className="text-blue-900 font-bold font-mono">diamantelogsystem@gmail.com</strong> e <strong className="text-blue-900 font-bold font-mono">diamantelog.sistem@gmail.com</strong> sempre têm acesso pré-autorizado para emergências.
                  </div>

                  {/* Toggle de Status */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-150">
                    <div>
                      <span className="block text-xs font-bold text-slate-750">Ativar Restrição pelo Google</span>
                      <span className="text-[9.5px] text-slate-400 font-bold">Bloquear o acesso à tela de login à lista restrita</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={!!googleAuthConfig?.isEnabled}
                        onChange={async (e) => {
                          if (onUpdateGoogleAuthConfig) {
                            await onUpdateGoogleAuthConfig(
                              e.target.checked,
                              tempGoogleClientId,
                              tempAllowedEmails
                            );
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Google Client ID Config */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black text-slate-450 uppercase">
                        Google Client ID (Credencial GIS)
                      </label>
                      <button
                        type="button"
                        onClick={() => alert("Passos para obter seu Client ID:\n1. Acesse: console.cloud.google.com\n2. Crie ou selecione um projeto.\n3. Vá em 'APIs e Serviços' > 'Tela de consentimento OAuth' e configure.\n4. Vá em 'Credenciais' > 'Criar Credenciais' > 'ID do cliente OAuth'.\n5. Adicione a URL do sistema em 'Origens JavaScript autorizadas'.\n6. Copie o ID gerado e cole aqui!\n\nNota: Se deixado em branco, o sistema usará um ID padrão integrado.")}
                        className="text-[9.5px] text-blue-600 hover:underline font-extrabold cursor-pointer"
                      >
                        Como obter?
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: xxxxxxxx-xxxxxxx.apps.googleusercontent.com"
                      value={tempGoogleClientId}
                      onChange={(e) => setTempGoogleClientId(e.target.value)}
                      className="w-full bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Adicionar E-mails à lista branca */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider font-sans">
                      Adicionar E-mail Google Autorizado:
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        placeholder="Ex: operador@gmail.com"
                        value={newGoogleEmail}
                        onChange={(e) => setNewGoogleEmail(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const mail = newGoogleEmail.trim().toLowerCase();
                            if (mail && !tempAllowedEmails.includes(mail)) {
                              const updated = [...tempAllowedEmails, mail];
                              setTempAllowedEmails(updated);
                              setNewGoogleEmail('');
                              if (onUpdateGoogleAuthConfig) {
                                await onUpdateGoogleAuthConfig(!!googleAuthConfig?.isEnabled, tempGoogleClientId, updated);
                              }
                            }
                          }
                        }}
                        className="flex-1 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const mail = newGoogleEmail.trim().toLowerCase();
                          if (mail) {
                            if (!tempAllowedEmails.includes(mail)) {
                              const updated = [...tempAllowedEmails, mail];
                              setTempAllowedEmails(updated);
                              setNewGoogleEmail('');
                              if (onUpdateGoogleAuthConfig) {
                                await onUpdateGoogleAuthConfig(!!googleAuthConfig?.isEnabled, tempGoogleClientId, updated);
                              }
                            }
                          }
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition hover:scale-[1.01]"
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>

                  {/* Lista de E-mails Autorizados */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider font-sans">
                      E-mails Google Autorizados ({tempAllowedEmails.length})
                    </label>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 divide-y divide-slate-150 max-h-48 overflow-y-auto">
                      {tempAllowedEmails.map((emailString) => (
                        <div key={emailString} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 text-xs font-bold text-slate-750">
                          <span className="truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="break-all">{emailString}</span>
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              const updated = tempAllowedEmails.filter(e => e !== emailString);
                              setTempAllowedEmails(updated);
                              if (onUpdateGoogleAuthConfig) {
                                await onUpdateGoogleAuthConfig(!!googleAuthConfig?.isEnabled, tempGoogleClientId, updated);
                              }
                            }}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-extrabold hover:underline ml-2 shrink-0 cursor-pointer"
                          >
                            Excluir
                          </button>
                        </div>
                      ))}
                      {tempAllowedEmails.length === 0 && (
                        <div className="text-center py-3 text-[10.5px] font-bold text-slate-400">
                          Nenhum e-mail adicionado à lista branca.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botão de Salvação de ID do Cliente */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (onUpdateGoogleAuthConfig) {
                        setGoogleSaveStatus('saving');
                        try {
                          await onUpdateGoogleAuthConfig(
                            !!googleAuthConfig?.isEnabled,
                            tempGoogleClientId,
                            tempAllowedEmails
                          );
                          setGoogleSaveStatus('success');
                          setTimeout(() => setGoogleSaveStatus('idle'), 2000);
                        } catch (_) {
                          setGoogleSaveStatus('error');
                        }
                      }
                    }}
                    className={`w-full py-2 rounded-xl text-white text-[10px] font-extrabold uppercase tracking-wider cursor-pointer shadow-sm transition duration-150 ${
                      googleSaveStatus === 'success' 
                        ? 'bg-emerald-600 shadow-emerald-200' 
                        : googleSaveStatus === 'saving'
                        ? 'bg-slate-400'
                        : 'bg-blue-600 shadow-blue-200 hover:bg-blue-750'
                    }`}
                  >
                    {googleSaveStatus === 'success' 
                      ? '✓ ID do Cliente Gravado com Sucesso!' 
                      : googleSaveStatus === 'saving'
                      ? 'Salvando ID ...'
                      : 'Salvar Google Client ID'}
                  </button>
                </div>
              )}
            </div>
          )}

          </div>
        )}

        {/* COLUNA DA DIREITA: LISTAGEM DOS REGISTROS EXISTENTES OU CONFIGURAÇÕES DE SISTEMA */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 ${
          activeRegType === 'sistema' ? 'lg:col-span-3' : 'lg:col-span-2'
        }`}>
          
          {activeRegType === 'sistema' ? (
            <div className="space-y-6" id="panel-limpeza-sistema">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3 text-red-600 mb-2">
                  <div className="p-2.5 bg-red-50 rounded-xl">
                    <Trash2 className="h-6 w-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800">Limpeza de Dados (Reset Operacional / Fim de Testes)</h2>
                    <p className="text-xs text-slate-400 font-semibold">Esta ferramenta permite limpar a base de dados operacionais e de testes para iniciar a operação real do sistema.</p>
                  </div>
                </div>
              </div>

              {cleanupSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl space-y-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600 animate-bounce" />
                    <h4 className="font-extrabold text-xs uppercase tracking-wide">Banco de Dados Reinicializado com Sucesso!</h4>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed">
                    Todos os pacotes de teste, saídas, guias, folhas financeiras, vales e comprovantes de movimentações foram apagados permanentemente do Firestore.
                    O sistema agora está limpo e totalmente pronto para a operação real. Os cadastros de filiais, embarcadores/clientes, motoristas credenciados, rotas e logins de operadores foram perfeitamente preservados!
                  </p>
                </div>
              )}

              {cleanupError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl space-y-1 shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <ShieldAlert className="h-4 w-4 text-rose-600 animate-bounce" />
                    <span>Falha ao Processar Reinicialização:</span>
                  </div>
                  <p className="text-xs font-semibold">{cleanupError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed text-xs">
                {/* O QUE SERÁ EXCLUÍDO */}
                <div className="bg-rose-50/20 border border-rose-100 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5 font-extrabold text-rose-700 uppercase tracking-wide text-[10px]">
                    <span className="w-1.5 h-1.5 bg-rose-650 rounded-full animate-ping"></span>
                    <span>Itens a Serem Limpos de Forma Permanente</span>
                  </div>
                  <ul className="space-y-2 text-slate-600 font-semibold pl-1">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Saídas de Viagem:</strong> Todas as guias e expedições de entregadores (`expedicoes`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Estoque Físico na Filial:</strong> Todos os pacotes atualmente em estoque físico (`estoque`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Pacotes Cadastrados:</strong> Todos os volumes bipados ou importados (`pacotes_cadastrados`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Movimentações e Extrato:</strong> Histórico completo de fluxo de estoque (`movimentacoes_estoque`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Vales e Finanças:</strong> Registros operacionais de adiantamentos (`vales`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Histórico Financeiro:</strong> Comprovantes de recibos fechados (`recibos_pagamento`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Conciliações de Baixa:</strong> Registros de conferência diária (`conciliacoes_diarias`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Mesa de Operações:</strong> Devoluções de testes, logs e itens jogados na `lixeira`.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span><strong>Histórico de Transferências:</strong> Logs de passagens de volumes entre entregadores (`transferencias_pacotes`).</span>
                    </li>
                  </ul>
                </div>

                {/* O QUE NÃO SERÁ CLICADO OU EXCLUÍDO */}
                <div className="bg-slate-50/50 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5 font-extrabold text-emerald-800 uppercase tracking-wide text-[10px]">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <span>Cadastros & Configurações Preservados</span>
                  </div>
                  <ul className="space-y-2 text-slate-650 font-semibold pl-1">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Entregadores:</strong> Todas as credenciais de motoristas cadastrados.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Embarcadores (Empresas):</strong> Configurações de taxas e comissões corporativas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Filiais:</strong> Unidades logísticas registradas de distribuição.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Rotas de Transporte:</strong> Linhas mapeadas de entregas urbanas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span><strong>Usuários e Contas:</strong> Logins administrativos, operadores autorizados e senhas.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* CONSOLE DE LOGS DE EXECUÇÃO */}
              {cleanupLogs.length > 0 && (
                <div className="bg-slate-900 text-zinc-350 p-4 rounded-xl font-mono text-[10px] space-y-1.5 max-h-[180px] overflow-y-auto shadow-inner border border-slate-800">
                  <div className="text-zinc-500 border-b border-slate-800 pb-1 flex justify-between items-center text-[9px] font-bold">
                    <span>CONSOLE DO SERVIDOR DE LIMPEZA</span>
                    {isCleaning ? (
                      <span className="animate-pulse text-emerald-500 font-extrabold">&#9679; PROCESSANDO EXCLUSÕES</span>
                    ) : (
                      <span className="text-slate-450 font-extrabold">CONCLUÍDO</span>
                    )}
                  </div>
                  {cleanupLogs.map((lg, i) => (
                    <div key={`log-${i}`} className="whitespace-pre-wrap leading-relaxed">{lg}</div>
                  ))}
                </div>
              )}

              {/* BOX DE VERIFICAÇÃO DE SEGURANÇA */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-600 animate-pulse" />
                  <h4 className="font-extrabold text-xs text-amber-800 uppercase tracking-wide">ÁREA DE EXTREMA SEGURANÇA: OPERATOR CONFIRMATION</h4>
                </div>
                <p className="text-[11px] text-amber-900 leading-normal font-semibold">
                  Esta ação é irreversível e excluirá permanentemente milhares de registros de estoque, guias, folhas financeiras e pacotes de testes do sistema.
                  Para confirmar que você está ciente e concorda com a revalidação física do sistema, digite o termo de confirmação abaixo.
                </p>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 max-w-lg mt-2">
                  <div className="flex-1 space-y-1">
                    <label htmlFor="input-term-confirm" className="block text-[10px] font-bold text-slate-400 uppercase">
                      Digite <strong className="text-red-600 font-extrabold">CONFIRMAR</strong> para habilitar
                    </label>
                    <input
                      id="input-term-confirm"
                      type="text"
                      disabled={isCleaning}
                      placeholder="CONFIRMAR"
                      value={confirmCleanInput}
                      onChange={(e) => setConfirmCleanInput(e.target.value)}
                      className="w-full bg-white border border-amber-200 px-3 py-2 text-xs font-bold font-sans rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800 uppercase"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleExecuteTestDataCleanup}
                    disabled={isCleaning || confirmCleanInput.trim().toUpperCase() !== 'CONFIRMAR'}
                    className="md:self-end px-5 py-2.5 bg-red-605 hover:bg-red-700 text-white rounded-xl text-xs font-bold tracking-wider uppercase shadow-md transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5"
                  >
                    {isCleaning ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                        <span>Limpando dados...</span>
                      </span>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>REINICIALIZAR BANCO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-50">
                <h3 className="text-sm font-bold text-slate-800">
                  {activeRegType === 'entregador' ? "Entregadores Credenciados" : 
                   activeRegType === 'empresa' ? "Empresas Clientes Cadastradas" : 
                   activeRegType === 'rota' ? "Rotas de Entrega Mapeadas" : 
                   activeRegType === 'filiais' ? "Filiais Cadastradas" : 
                   activeRegType === 'motivos' ? "Motivos de Ocorrência / Devolução Cadastrados" : "Usuários do Sistema Cadastrados"}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                  {filteredList.length} {activeRegType === 'usuarios' ? 'logins' : 'registros'}
                </span>
              </div>

              {/* Mensagem educativa de base de dados unificada */}
              {activeRegType !== 'usuarios' && !currentUser.isMaster && (
                <div className="mb-4 bg-emerald-50/50 border border-emerald-100 text-emerald-800 p-2.5 rounded-xl text-[10.5px] font-medium leading-relaxed">
                  ✓ <strong>Base de Dados Compartilhada:</strong> Você possui acesso à conferência completa e unificada de todos os cadastros de {activeRegType === 'entregador' ? 'entregadores' : activeRegType === 'empresa' ? 'empresas' : activeRegType === 'filiais' ? 'filiais' : activeRegType === 'motivos' ? 'motivos de devolução' : 'rotas'} do sistema.
                </div>
              )}

              <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
            {filteredList.length === 0 ? (
              <div className="text-center py-24 text-slate-400 border border-dashed border-slate-100 rounded-xl text-xs">
                Nenhum cadastro encontrado para a aba atual.
              </div>
            ) : (
              activeRegType === 'motivos' ? (
                // LISTAGEM DE MOTIVOS DE DEVOLUÇÃO
                (filteredList as string[]).map((motivoStr, index) => (
                  <div 
                    key={`motivo-${index}`}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-100 gap-4"
                    id={`reg-row-motivo-${index}`}
                  >
                    <div className="flex items-start space-x-3.5">
                      <div className="w-12 h-12 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                        <FileText className="h-6 w-6 stroke-1.5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">{motivoStr}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold">Motivo salvado para ocorrências na baixa de pacotes</p>
                      </div>
                    </div>

                    {!currentUser.permissions.cadastro_readonly && (
                      <div className="flex items-center space-x-2 shrink-0 md:self-center self-end">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(motivoStr);
                            setFormName(motivoStr);
                          }}
                          className="p-2 bg-white hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition cursor-pointer"
                          id={`btn-edit-motivo-${index}`}
                          title="Editar motivo"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateMotivos) {
                              const idxInOriginal = motivosDevolucao.indexOf(motivoStr);
                              if (idxInOriginal !== -1) {
                                const updatedList = (motivosDevolucao || []).filter((_, idx) => idx !== idxInOriginal);
                                onUpdateMotivos(updatedList);
                                handleClearForm();
                              }
                            }
                          }}
                          className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition cursor-pointer"
                          id={`btn-delete-motivo-${index}`}
                          title="Excluir motivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : activeRegType !== 'usuarios' ? (
                // LISTAGEM DE CADASTROS PADRÃO (ENTREGADOR, EMPRESA, ROTA)
                filteredList.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-100 gap-4"
                    id={`reg-row-${item.id}`}
                  >
                    {/* Informações Básicas de Cadastro */}
                    <div className="flex items-start space-x-3.5">
                      
                      {/* Elemento Visual à Esquerda */}
                      {activeRegType === 'entregador' ? (
                        item.foto ? (
                          <img 
                            src={item.foto} 
                            alt={item.nome} 
                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0 cursor-pointer hover:scale-105 active:scale-95 hover:border-blue-300 transition duration-200"
                            title="Clique para ampliar a foto do entregador"
                            referrerPolicy="no-referrer"
                            onClick={() => {
                              const win = window.open();
                              if (win) {
                                win.document.write(`
                                  <html>
                                    <head>
                                      <title>${item.nome} - Foto de Perfil</title>
                                      <style>
                                        body {
                                          margin: 0;
                                          background-color: #0f172a;
                                          display: flex;
                                          align-items: center;
                                          justify-content: center;
                                          min-height: 100vh;
                                          font-family: system-ui, -apple-system, sans-serif;
                                        }
                                        img {
                                          max-width: 95vw;
                                          max-height: 95vh;
                                          border-radius: 12px;
                                          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
                                          object-fit: contain;
                                          border: 2px solid rgba(255, 255, 255, 0.1);
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <img src="${item.foto}" alt="${item.nome}" />
                                    </body>
                                  </html>
                                `);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0">
                            {item.nome.substring(0, 2).toUpperCase()}
                          </div>
                        )
                      ) : activeRegType === 'empresa' ? (
                        <div className="w-12 h-12 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <Building2 className="h-6 w-6 stroke-1.5" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-center text-purple-650 shrink-0">
                          <MapPin className="h-6 w-6 stroke-1.5" />
                        </div>
                      )}

                      {/* Detalhes do Registro dependendo do tipo */}
                      {activeRegType === 'rota' ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.nome}</h4>
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold font-mono">
                              ID: {item.id}
                            </span>
                            {item.filialId && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                                Filial: {filiais.find(f => f.id === item.filialId)?.nome || "Não encontrada"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 font-bold mt-1">
                            <span className="text-slate-400 font-medium">Bairros:</span> {item.descricao}
                          </p>
                        </div>
                      ) : activeRegType === 'filiais' ? (
                        <div className="flex gap-3 items-center">
                          {item.logo ? (
                            <img 
                              src={item.logo} 
                              alt="Logo" 
                              className="w-10 h-10 object-contain rounded-xl border border-slate-200 bg-white p-0.5 overflow-hidden shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-center text-teal-600 shrink-0">
                              <Building2 className="h-5 w-5 stroke-1.5" />
                            </div>
                          )}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-800 text-sm leading-tight truncate">{item.nome}</h4>
                              <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold font-mono shrink-0">
                                CNPJ: {item.cnpj || "Sem CNPJ"}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-0.5 gap-x-4 text-xs text-slate-500 leading-tight font-medium mt-1">
                              <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> <span className="truncate">{item.cidade || "Sem Cidade"} ({item.estado || "SP"}) {item.endereco ? ` - ${item.endereco}` : ''}</span></p>
                              {item.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400 shrink-0" /> <span className="truncate">{item.email}</span></p>}
                              {item.contato && <p className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400 shrink-0" /> <span className="truncate">{item.contato}</span></p>}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.nome}</h4>
                            <span className="text-[10px] bg-slate-250 text-slate-600 px-1.5 py-0.5 rounded font-bold font-mono">
                              {activeRegType === 'entregador' ? item.cpf : item.cnpj}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-0.5 gap-x-4 text-xs text-slate-500 leading-tight font-medium">
                            <p className="flex items-center gap-1"><MapPin className="h-3 w-3 inline text-slate-400" /> {item.endereco || "Sem endereço"}</p>
                            <p className="flex items-center gap-1"><Mail className="h-3 w-3 inline text-slate-400" /> {item.email || "Sem e-mail"}</p>
                            <p className="flex items-center gap-1"><Phone className="h-3 w-3 inline text-slate-400" /> {item.contato || "Sem contato"}</p>
                          </div>

                          {/* Informações adicionais de Veículo e Habilitação (CNH) */}
                          {activeRegType === 'entregador' && (
                            <div className="flex flex-wrap gap-2 pt-1.5 text-xs font-semibold">
                              {item.placaVeiculo ? (
                                <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-mono uppercase">
                                  <Car className="h-3.5 w-3.5 text-slate-500" />
                                  Placa: {item.placaVeiculo}
                                </span>
                              ) : (
                                <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-150 flex items-center gap-1 border-dashed">
                                  <Car className="h-3.5 w-3.5 text-slate-400" />
                                  Sem placa informada
                                </span>
                              )}

                              {item.cnhDoc ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const win = window.open();
                                    if (win) {
                                      win.document.write(`<iframe src="${item.cnhDoc}" style="border:none; width:100%; height:100%;"></iframe>`);
                                    }
                                  }}
                                  className="text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-150 flex items-center gap-1 cursor-pointer transition font-bold"
                                >
                                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                  Ver CNH Anexada
                                </button>
                              ) : (
                                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-155 flex items-center gap-1 border-dashed">
                                  <FileText className="h-3.5 w-3.5 text-amber-500" />
                                  CNH não anexada
                                </span>
                              )}

                              {item.filialId && (
                                <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-150 flex items-center gap-1">
                                  <Building2 className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
                                  <span>Filial: {filiais.find(f => f.id === item.filialId)?.nome || "Matriz"}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Taxas administrativas para empresas */}
                          {activeRegType === 'empresa' && (
                            <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
                              <span className="text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Receita por pacote: R$ {item.valorPorPacote.toFixed(2)}
                              </span>
                              <span className="text-emerald-700 bg-emerald-50/50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                <FileCheck className="h-3 w-3" />
                                Comissão repasse entregador: R$ {item.comissaoEntregador.toFixed(2)}
                              </span>
                              {item.prefixos && (
                                <span className="text-amber-700 bg-amber-50/50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1 font-mono">
                                  Prefixos: {item.prefixos}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Operação de Ações */}
                    {!currentUser.permissions.cadastro_readonly && (
                      <div className="flex items-center space-x-2 shrink-0 md:self-center self-end">
                        <button
                          onClick={() => handleStartEdit(item, activeRegType)}
                          className="p-2 bg-white hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition cursor-pointer"
                          id={`btn-edit-reg-${item.id}`}
                          title="Editar cadastro"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setRegistryToDelete({
                              id: item.id,
                              nome: item.nome,
                              type: activeRegType
                            });
                          }}
                          className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition cursor-pointer"
                          id={`btn-delete-reg-${item.id}`}
                          title="Excluir cadastro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                  </div>
                ))
              ) : (
                
                // RENDERING DE USUÁRIOS COMPLETO (Apenas Master)
                (filteredList as User[]).map((user) => (
                  <div 
                    key={user.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/55 rounded-xl border border-slate-150 gap-4"
                    id={`user-row-${user.username}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm ${
                        user.isMaster ? 'bg-emerald-600 text-white' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.isMaster ? '👑' : user.nomeCompleto.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-850 text-xs leading-none">{user.nomeCompleto}</span>
                          <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded leading-none">
                            @{user.username}
                          </span>
                           {/* Limite removido */}
                          {user.isMaster && (
                            <span className="text-[8.5px] font-extrabold font-mono uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded tracking-wider">
                              Master Inalterável
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>{user.email}</span>
                        </p>

                        {/* Visualização rápida de permissões ativas */}
                        <div className="flex items-center gap-1 mt-1 pt-1 border-t border-slate-100/45 flex-wrap">
                          <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Permissões:</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.dashboard ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>BI</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.expedicao ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>Checkout</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.baixas ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>Baixa</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.emRota ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>Rota</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.cadastro ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>Cadastro</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.folha ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>Folha</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.relatorios ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>BI Relat</span>
                          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-md ${user.permissions.tvPainel ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-200 text-slate-400'}`}>TV</span>
                        </div>

                        {/* Visualização rápida de filiais autorizadas */}
                        <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-dotted border-slate-200 flex-wrap">
                          <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Filiais:</span>
                          {user.isMaster ? (
                            <span className="text-[8px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Todas (Acesso Master Geral)</span>
                          ) : !user.filiais || user.filiais.length === 0 ? (
                            <span className="text-[8px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Sem Filial Permitida</span>
                          ) : (
                            user.filiais.map(fId => {
                              const fNome = filiais.find(f => f.id === fId)?.nome || fId;
                              return (
                                <span key={fId} className="text-[8px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{fNome}</span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações de Usuário pelo Master */}
                    <div className="flex items-center space-x-1.5 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleSelectUserForEdit(user)}
                        className={`p-2 bg-white hover:bg-slate-200 border text-slate-650 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                          selectedUserToEdit?.id === user.id ? 'border-emerald-500 text-emerald-600' : 'border-slate-200'
                        }`}
                        title="Alterar permissões e resetar senha"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Alterar</span>
                      </button>

                      {/* Botão de Excluir desabilitado se for o master */}
                      {!user.isMaster ? (
                        <button
                          onClick={() => {
                            setUserToDelete(user);
                          }}
                          className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition cursor-pointer"
                          title="Remover usuário por completo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="p-2 bg-slate-100 border border-slate-200 text-slate-400 rounded-lg text-[9px] font-bold select-none uppercase">
                          Trancado
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
          </>
          )}

        </div>

      </div>

      {/* Modal de confirmação seguro para exclusão de usuário */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="font-bold text-base text-slate-800">Confirmar Exclusão</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-normal font-semibold">
              Tem certeza que deseja excluir este usuário ({userToDelete.nomeCompleto})?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteUser(userToDelete.id);
                  if (selectedUserToEdit?.id === userToDelete.id) {
                    handleClearForm();
                  }
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer font-sans"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de conexões de usuários removido */}

      {/* Modal de confirmação seguro para exclusão de cadastros (todos os tipos) */}
      {registryToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="font-bold text-base text-slate-800">Confirmar Exclusão</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-normal font-semibold">
              {registryToDelete.type === 'entregador' && `Quer mesmo excluir este entregador "${registryToDelete.nome}"?`}
              {registryToDelete.type === 'empresa' && `Quer mesmo excluir esta empresa "${registryToDelete.nome}"?`}
              {registryToDelete.type === 'rota' && `Quer mesmo excluir esta rota "${registryToDelete.nome}"?`}
              {registryToDelete.type === 'filiais' && `Quer mesmo excluir esta filial "${registryToDelete.nome}"?`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRegistryToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingId === registryToDelete.id) {
                    handleClearForm();
                  }
                  if (registryToDelete.type === 'entregador') {
                    onDeleteEntregador(registryToDelete.id);
                  } else if (registryToDelete.type === 'empresa') {
                    onDeleteEmpresa(registryToDelete.id);
                  } else if (registryToDelete.type === 'rota') {
                    onDeleteRota(registryToDelete.id);
                  } else if (registryToDelete.type === 'filiais') {
                    onDeleteFilial(registryToDelete.id);
                  }
                  setRegistryToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer font-sans"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
