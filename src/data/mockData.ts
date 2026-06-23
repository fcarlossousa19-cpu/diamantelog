/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Empresa, Entregador, Expedicao, Rota, Filial } from '../types';

export const INITIAL_FILIAIS: Filial[] = [
  { id: "filial-1", nome: "Filial São Paulo - Matriz", cnpj: "03.007.331/0001-41", cidade: "São Paulo", estado: "SP", endereco: "Av. Paulista, 1000, Bela Vista, São Paulo - SP" },
  { id: "filial-2", nome: "Filial Campinas", cnpj: "03.007.331/0001-42", cidade: "Campinas", estado: "SP", endereco: "Rua Francisco Glicério, 450, Centro, Campinas - SP" },
  { id: "filial-3", nome: "Filial Rio de Janeiro", cnpj: "03.007.331/0001-43", cidade: "Rio de Janeiro", estado: "RJ", endereco: "Av. Rio Branco, 200, Centro, Rio de Janeiro - RJ" }
];

export const INITIAL_EMPRESAS: Empresa[] = [
  {
    id: "emp-1",
    nome: "Mercado Livre",
    cnpj: "03.007.331/0001-41",
    endereco: "Av das Nações Unidas, 3003, Osasco - SP",
    email: "logistica@mercadolivre.com.br",
    contato: "(11) 3500-2400",
    valorPorPacote: 6.50,
    comissaoEntregador: 3.50,
    prefixos: "ML, ME, 3S, MELI"
  },
  {
    id: "emp-2",
    nome: "Shopee",
    cnpj: "35.635.824/0001-12",
    endereco: "Av. Brigadeiro Faria Lima, 3732, Pinheiros - São Paulo - SP",
    email: "shopee.log@shopee.com",
    contato: "(11) 2345-6789",
    valorPorPacote: 5.80,
    comissaoEntregador: 3.00,
    prefixos: "SP, SH, BR"
  },
  {
    id: "emp-3",
    nome: "Shein",
    cnpj: "42.112.541/0001-90",
    endereco: "Rua do Manifesto, 1200, Ipiranga - São Paulo - SP",
    email: "shein.distrib@sheingroup.com",
    contato: "(11) 98765-4321",
    valorPorPacote: 7.20,
    comissaoEntregador: 3.80,
    prefixos: "SHN, WY, NX"
  },
  {
    id: "emp-4",
    nome: "Amazon Brasil",
    cnpj: "15.436.940/0001-03",
    endereco: "Av. Juscelino Kubitschek, 2041, Itaim Bibi - São Paulo - SP",
    email: "amazon.logistica@amazon.com",
    contato: "(11) 4004-0101",
    valorPorPacote: 8.00,
    comissaoEntregador: 4.20,
    prefixos: "AM, AZ, AMZN"
  }
];

export const INITIAL_ENTREGADORES: Entregador[] = [
  {
    id: "ent-1",
    nome: "Carlos Augusto Silva",
    cpf: "123.456.789-00",
    endereco: "Rua das Flores, 123, Jardim Paulista, São Paulo - SP",
    email: "carlos.entregas@gmail.com",
    contato: "(11) 98111-2222",
    foto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
    filialId: "filial-1"
  },
  {
    id: "ent-2",
    nome: "Marcos Rogério Souza",
    cpf: "234.567.890-11",
    endereco: "Av. Central, 456, Centro, Santo André - SP",
    email: "marcos.express@outlook.com",
    contato: "(11) 98222-3333",
    foto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop",
    filialId: "filial-1"
  },
  {
    id: "ent-3",
    nome: "Juliane Costa Martins",
    cpf: "345.678.901-22",
    endereco: "Rua das Palmeiras, 789, Campinas - SP",
    email: "juliane.log@hotmail.com",
    contato: "(11) 98333-4444",
    foto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&auto=format&fit=crop",
    filialId: "filial-2"
  },
  {
    id: "ent-4",
    nome: "Roberto Antunes Santos",
    cpf: "456.789.012-33",
    endereco: "Alameda Santos, 1020, Cerqueira César - São Paulo - SP",
    email: "roberto.frete@gmail.com",
    contato: "(11) 98444-5555",
    foto: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop",
    filialId: "filial-1"
  }
];

export const INITIAL_ROTAS: Rota[] = [
  {
    id: "rot-1",
    nome: "Rota 01 - Centro Histórico",
    descricao: "Sé, República, Bela Vista, Liberdade e Consolação."
  },
  {
    id: "rot-2",
    nome: "Rota 02 - Zona Norte Express",
    descricao: "Santana, Tucuruvi, Vila Maria e Casa Verde."
  },
  {
    id: "rot-3",
    nome: "Rota 03 - Zona Sul Premium",
    descricao: "Itaim Bibi, Moema, Pinheiros, Vila Olímpia e Jardins."
  },
  {
    id: "rot-4",
    nome: "Rota 04 - Zona Leste Comercial",
    descricao: "Tatuapé, Mooca, Belenzinho, Brás e Penha."
  }
];

// Gerador de códigos de barras fictícios para mock
const genBarCode = (prefix: string, index: number) => {
  return `${prefix}${String(index).padStart(8, '0')}`;
};

// Gerar expedições históricas nos últimos 30 dias para preencher gráficos
export const getHistoricalExpeditions = (): Expedicao[] => {
  const list: Expedicao[] = [];
  const now = new Date();
  
  // Vamos criar cerca de 25 expedições representativas ao longo dos últimos 25 dias
  for (let i = 25; i >= 1; i--) {
    const dataExpedicao = new Date(now.getTime() - i * 24 * 60 * 60 * 1000 - (Math.random() * 4 * 60 * 60 * 1000));
    const dataRetorno = new Date(dataExpedicao.getTime() + (2 + Math.random() * 4) * 60 * 60 * 1000); // 2 a 6 horas de trajeto
    const tempoVolta = Math.round((dataRetorno.getTime() - dataExpedicao.getTime()) / (1000 * 60));

    // Entregador alternado
    const entregadorIdx = i % INITIAL_ENTREGADORES.length;
    const entregador = INITIAL_ENTREGADORES[entregadorIdx];

    // Empresas envolvidas nesta expedição
    const empresa1 = INITIAL_EMPRESAS[i % INITIAL_EMPRESAS.length];
    const empresa2 = INITIAL_EMPRESAS[(i + 1) % INITIAL_EMPRESAS.length];

    // Criar itens
    const pacotesQuantidade = 20 + (i % 5) * 12; // 20 a 68 pacotes
    const itens = [];
    const motivos = [
      "Destinatário Ausente (3 tentativas)",
      "Endereço Não Localizado / Incompleto",
      "Recusado pelo Destinatário",
      "Área Sem Cobertura / Risco de Segurança"
    ];

    for (let p = 0; p < pacotesQuantidade; p++) {
      const isML = p % 2 === 0;
      const emp = isML ? empresa1 : empresa2;
      
      // 93% entregues, 7% devolução
      const rate = Math.random();
      const status = rate > 0.07 ? 'entregue' : 'devolvido';
      const motivo = status === 'devolvido' ? motivos[Math.floor(Math.random() * motivos.length)] : undefined;
      const obs = status === 'devolvido' ? "Tentativa realizada sem sucesso." : undefined;

      itens.push({
        codigoBarras: genBarCode(emp.nome.substring(0, 2).toUpperCase(), i * 100 + p),
        empresaId: emp.id,
        status: status as 'entregue' | 'devolvido',
        motivoDevolucao: motivo,
        observacaoDevolucao: obs,
        dataHoraLeitura: dataRetorno.toISOString()
      });
    }

    list.push({
      id: `exp-hist-${i}`,
      entregadorId: entregador.id,
      empresaIds: Array.from(new Set([empresa1.id, empresa2.id])),
      dataHoraSaida: dataExpedicao.toISOString(),
      dataHoraRetorno: dataRetorno.toISOString(),
      itens,
      concluido: true,
      assinaturaEntregador: entregador.nome.split(' ').map(n => n[0]).join('') + '. ' + entregador.nome.split(' ').slice(-1)[0],
      tempoVoltaMinutos: tempoVolta,
      rotaId: INITIAL_ROTAS[i % INITIAL_ROTAS.length].id,
      filialId: entregador.filialId || "filial-1"
    });
  }

  // Adicionar uma expedição "pendente" (em andamento) hoje, para simular a operação real acontecendo
  const hojeCedo = new Date();
  hojeCedo.setHours(hojeCedo.getHours() - 3); // saiu há 3 horas
  
  list.push({
    id: "exp-ativa-1",
    entregadorId: "ent-1", // Carlos
    empresaIds: ["emp-1", "emp-2"], // Mercado Livre, Shopee
    dataHoraSaida: hojeCedo.toISOString(),
    concluido: false,
    rotaId: "rot-1",
    filialId: "filial-1", // Carlos belongs to filial-1
    itens: [
      { codigoBarras: "ML00045610", empresaId: "emp-1", status: "pendente" },
      { codigoBarras: "ML00045611", empresaId: "emp-1", status: "pendente" },
      { codigoBarras: "ML00045612", empresaId: "emp-1", status: "pendente" },
      { codigoBarras: "ML00045613", empresaId: "emp-1", status: "pendente" },
      { codigoBarras: "SP00078901", empresaId: "emp-2", status: "pendente" },
      { codigoBarras: "SP00078902", empresaId: "emp-2", status: "pendente" },
      { codigoBarras: "SP00078903", empresaId: "emp-2", status: "pendente" },
      { codigoBarras: "SP00078904", empresaId: "emp-2", status: "pendente" },
      { codigoBarras: "SP00078905", empresaId: "emp-2", status: "pendente" }
    ]
  });

  return list;
};
