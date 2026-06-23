/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Filial {
  id: string;
  nome: string;
  cnpj?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  email?: string;
  contato?: string;
  logo?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  email: string;
  contato: string;
  valorPorPacote: number;      // Quanto a empresa paga à distribuidora por pacote entregue
  comissaoEntregador: number;  // Quanto o entregador recebe por pacote entregue
  prefixos?: string;           // Prefixos de código de barras separados por vírgula (Ex: ML, 3S)
  createdById?: string;        // ID do usuário criador para isolamento
}

export interface Entregador {
  id: string;
  nome: string;
  cpf: string;
  endereco: string;
  email: string;
  contato: string;
  foto: string; // Base64 ou URL de exemplo
  placaVeiculo?: string;
  cnhDoc?: string; // Documento de CNH anexado (Base64 ou Mock PDF/Imagem)
  createdById?: string;        // ID do usuário criador para isolamento
  filialId?: string;           // ID da filial à qual pertence
}

export interface Pacote {
  codigoBarras: string;
  empresaId: string;
  status: 'pendente' | 'entregue' | 'devolvido' | 'retirado_filial' | 'retirado_zona_rural' | 'retirado_avariado' | 'retirado_outra_cidade';
  motivoDevolucao?: string;
  observacaoDevolucao?: string;
  dataHoraLeitura?: string;
}

export interface Expedicao {
  id: string;
  entregadorId: string;
  empresaIds: string[]; // Empresas vinculadas a este lote
  dataHoraSaida: string;
  dataHoraRetorno?: string;
  itens: Pacote[];
  concluido: boolean;
  assinaturaEntregador?: string; // Nome ou representação da assinatura
  tempoVoltaMinutos?: number;    // Calculado automaticamente na finalização
  rotaId?: string;
  rotaIds?: string[];
  createdById?: string;        // ID do usuário criador para isolamento
  filialId?: string;           // ID da filial no momento do checkout
}

export interface PreSetMotivo {
  id: string;
  motivo: string;
}

export interface Rota {
  id: string;
  nome: string;
  descricao: string;
  filialId?: string;           // ID da filial à qual pertence a rota
  createdById?: string;        // ID do usuário criador para isolamento
}

export interface UserPermissions {
  dashboard: boolean;
  dashboard_readonly?: boolean;
  expedicao: boolean;
  expedicao_readonly?: boolean;
  baixas: boolean;
  baixas_readonly?: boolean;
  emRota: boolean;
  emRota_readonly?: boolean;
  cadastro: boolean;
  cadastro_readonly?: boolean;
  folha: boolean;
  folha_readonly?: boolean;
  relatorios: boolean;
  relatorios_readonly?: boolean;
  tvPainel: boolean;
  tvPainel_readonly?: boolean;
  estoque?: boolean;
  estoque_readonly?: boolean;
  alterar_estoque_salvo?: boolean;
}

export interface User {
  id: string;
  username: string; // Nome de usuário único
  nomeCompleto: string; // Nome real completo
  email: string; // Email para recuperação
  passwordHash: string; // Armazenamento local simples em texto para fins de demonstração offline
  isMaster?: boolean; // Usuário master que nunca sai do sistema
  permissions: UserPermissions; // Permissões autorizadas pelo master
  recoveryKey?: string; // Chave de recuperação gerada aleatoriamente
  palavraChave?: string; // Palavra-chave definida pelo próprio usuário
  filiais?: string[]; // Filiais às quais este usuário tem permissão de acesso
  defaultFilialId?: string; // Filial selecionada como padrão
  foto?: string; // Foto de perfil no formato base64 ou URL
  maxConnections?: number; // Máximo de conexões simultâneas permitidas (0 ou undefined = sem limite)
}

export const MOTIVOS_PADRAO: string[] = [
  "Destinatário Ausente - Residência Fechada",
  "Destinatário Ausente (3 tentativas esgotadas)",
  "Destinatário Desconhecido no Local",
  "Endereço Não Localizado (Número não existe ou sem identificação)",
  "Endereço Incompleto (Falta bloco, apartamento ou lote/quadra)",
  "Recusado pelo Destinatário - Mercadoria avariada",
  "Recusado pelo Destinatário - Compra não reconhecida",
  "Recusado pelo Destinatário - Desistência/Desacordo",
  "Área com Restrição de Entrega (Risco de Segurança)",
  "Cliente Mudou-se",
  "Estabelecimento Fechado (Horário comercial encerrado)",
  "Avaria Física na Embalagem em Rota",
  "Roubo ou Furto de Carga (Ocorrência Policial)",
  "Problema Mecânico/Acidente com Veículo do Entregador",
  "Tempo Limite de Rota Excedido (Falta de tempo hábil)",
  "Chuva Forte, Alagamento ou Bloqueio de Via"
];

export interface ItemEstoque {
  codigoBarras: string;
  empresaId: string;
  quantidade: number;
  dataHoraAtualizacao: string;
  usuarioNome: string; // Nome do usuário que fez a bipagem/alteração
  filialId: string;    // Filial do estoque
}

export interface MovimentacaoEstoque {
  id: string;
  codigoBarras: string;
  empresaId: string;
  quantidade: number; // +X ou -X
  tipo: 'entrada' | 'saida' | 'devolucao' | 'exclusao' | 'devolucao_empresa' | 'retirada_filial' | 'retirado_zona_rural' | 'retirado_avariado' | 'retirado_outra_cidade';
  dataHora: string;
  usuarioNome: string; // Usuário que realizou a operação
  filialId: string;
  entregadorNome?: string; // Nome do entregador responsável (saída ou devolução)
  rotaNome?: string;       // Nome da rota (se houver)
}

export interface ItemLixeira {
  id: string; // unique trash ID
  tipo: 'empresa' | 'entregador' | 'rota' | 'filial' | 'usuario' | 'vale' | 'recibo' | 'motivo';
  label: string; // descriptive title (e.g., "Empresa: Swift Logistics")
  subLabel: string; // extra info (e.g., "CNPJ: 14.512.421/0001-22")
  dados: any; // complete serialized JSON of the item to be restored
  deletadoEm: string; // ISO timestamp
  deletadoPor: string; // operator who deleted the item
}

export interface Vale {
  id: string;
  entregadorId: string;
  entregadorNome: string;
  valor: number;
  dataHora: string;
  usuarioNome: string;
  filialId: string;
  observacao?: string;
}

export interface ReciboPagamento {
  id: string;
  entregadorId: string;
  entregadorNome: string;
  periodoInicio: string;
  periodoFim: string;
  totalDevolvidos: number;
  taxaAbatimento: number;
  totalAbatido: number;
  comissaoTotal: number;
  dataHora: string;
  usuarioNome: string;
  filialId: string;
}

export interface ConciliacaoDiaria {
  id: string; // YYYY-MM-DD-filialId-empresaId
  data: string; // YYYY-MM-DD
  filialId: string;
  empresaId: string;
  quantidadePatio: number;
  dataHoraAtualizacao: string;
  usuarioNome: string;
}

export interface TransferenciaPacote {
  id: string;
  codigoBarras: string;
  empresaId: string;
  origemExpedicaoId: string;
  origemEntregadorId: string;
  origemEntregadorNome: string;
  destinoExpedicaoId: string;
  destinoEntregadorId: string;
  destinoEntregadorNome: string;
  dataHora: string;
  usuarioNome: string;
  filialId: string;
}

export interface RetiradaPacote {
  id: string;
  codigoBarras: string;
  empresaId: string;
  origemExpedicaoId: string;
  origemEntregadorId: string;
  origemEntregadorNome: string;
  motivo: 'zona_rural' | 'avariado' | 'outra_cidade' | 'outro';
  observacao: string;
  dataHora: string;
  usuarioNome: string;
  filialId: string;
}





