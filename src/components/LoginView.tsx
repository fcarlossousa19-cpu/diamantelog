/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  User as UserIcon, 
  Mail, 
  UserPlus, 
  ArrowRight, 
  RefreshCw, 
  ShieldAlert, 
  Key, 
  CheckCircle2, 
  MailWarning, 
  CheckCheck,
  Eye,
  EyeOff,
  Laptop
} from 'lucide-react';
import { User, UserPermissions } from '../types';
import { db, collection, getDocs, deleteDoc, doc, setDoc, syncAllTablesForce } from '../lib/supabase';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  users: User[];
  onRegisterUser: (newUser: User) => void | Promise<void>;
  onUpdateUserPassword: (usernameOrEmail: string, newPass: string) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  onGenerateRecoveryKey: (usernameOrEmail: string) => { success: boolean; key: string; email: string; message: string } | Promise<{ success: boolean; key: string; email: string; message: string }>;

}

const DiamondLogoBig = () => (
  <svg viewBox="0 0 100 100" className="h-16 w-16 mx-auto mb-4" fill="none" xmlns="http://www.w3.org/2000/svg">
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

export default function LoginView({
  onLoginSuccess,
  users,
  onRegisterUser,
  onUpdateUserPassword,
  onGenerateRecoveryKey
}: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'verifyKey'>('login');
  
  // Google Auth Verification States
  const [googleUserEmail, setGoogleUserEmail] = useState<string>(() => {
    return sessionStorage.getItem('verifiedGoogleEmail') || '';
  });
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string>('');

  const isGoogleProtected = false;

  const isEmailAuthorized = (email: string) => {
    return true;
  };

  const hasAuthorizedEmail = false;

  const handleGoogleVerify = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isAllowed = isEmailAuthorized(cleanEmail);
    
    if (isAllowed) {
      setGoogleUserEmail(cleanEmail);
      setUnauthorizedEmail('');
      sessionStorage.setItem('verifiedGoogleEmail', cleanEmail);
    } else {
      setUnauthorizedEmail(cleanEmail);
      setGoogleUserEmail('');
      sessionStorage.removeItem('verifiedGoogleEmail');
    }
  };

  // Google Auth disabled

  
  const masterUser = users.find(u => u.username === 'master' || u.isMaster || u.id === 'usr-master');
  const senderEmail = masterUser?.email || 'diamantelogsystem@gmail.com';
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Register fields
  const [regNome, setRegNome] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPalavraChave, setRegPalavraChave] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  
  // Forgot / Recovery fields
  const [recoveryInput, setRecoveryInput] = useState(''); // username
  const [verificationCode, setVerificationCode] = useState(''); // keyword
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // Alerts and notices
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active Connections Restriction States
  const [blockingSessionConflict, setBlockingSessionConflict] = useState(false);
  const [blockingUser, setBlockingUser] = useState<User | null>(null);
  const [activeConnectionsCount, setActiveConnectionsCount] = useState(0);
  const [connectionsLimit, setConnectionsLimit] = useState(1);
  const [conflictingSessions, setConflictingSessions] = useState<any[]>([]);
  const [isCheckingSessions, setIsCheckingSessions] = useState(false);
  const [isDisconnectingOthers, setIsDisconnectingOthers] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Clear messages on switcher
  const transitionTo = (newMode: 'login' | 'register' | 'forgot' | 'verifyKey') => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const formattedUsername = username.trim().toLowerCase();
    
    // Find user
    const foundUser = users.find(u => u.username.toLowerCase() === formattedUsername);
    
    if (!foundUser) {
      setErrorMsg('Nome de usuário não cadastrado.');
      return;
    }
    
    if (foundUser.passwordHash !== password) {
      setErrorMsg('Senha incorreta. Tente novamente.');
      return;
    }
    
    // Fazer login direto
    onLoginSuccess(foundUser);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanPalavraChave = regPalavraChave.trim();
    
    if (!regNome.trim() || !cleanUsername || !cleanPalavraChave || !regPassword) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      return;
    }
    
    if (cleanUsername.includes(' ')) {
      setErrorMsg('O nome de usuário não deve conter espaços.');
      return;
    }
    
    // Check taken username
    const exists = users.some(u => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      setErrorMsg(`O usuário "@${cleanUsername}" já está em uso.`);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    // Default permissions for normal users: they can access standard logistics screens,
    // but cannot see administrative screens unless granted, and CANNOT see users list anyway.
    const defaultPermissions: UserPermissions = {
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
      tvPainel_readonly: false
    };

    const newUser: User = {
      id: `usr-${Date.now()}`,
      username: cleanUsername,
      nomeCompleto: regNome.trim(),
      email: `${cleanUsername}@diamantelog.com`,
      palavraChave: cleanPalavraChave,
      passwordHash: regPassword,
      permissions: defaultPermissions
    };

    onRegisterUser(newUser);
    
    setSuccessMsg('Conta criada com sucesso! Entre agora.');
    setUsername(cleanUsername);
    setPassword(regPassword);
    
    // Reset forms
    setRegNome('');
    setRegUsername('');
    setRegPalavraChave('');
    setRegPassword('');
    setRegConfirmPassword('');
    
    // Move to login after delay
    setTimeout(() => {
      transitionTo('login');
    }, 1505);
  };

  const handleResetPasswordWithKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = recoveryInput.trim().toLowerCase();
    const cleanKeyword = verificationCode.trim().toLowerCase();

    if (!cleanUsername) {
      setErrorMsg('Por favor, informe seu usuário.');
      return;
    }

    if (!cleanKeyword) {
      setErrorMsg('Por favor, informe sua palavra-chave de recuperação.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    // Find the user
    const matchedUser = users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!matchedUser) {
      setErrorMsg('Nome de usuário não cadastrado.');
      return;
    }

    // Verify recovery word
    const userKeyword = (matchedUser.palavraChave || '').trim().toLowerCase();
    if (!userKeyword || userKeyword !== cleanKeyword) {
      setErrorMsg('Palavra-chave incorreta para este usuário.');
      return;
    }

    // Execute reset!
    const res = onUpdateUserPassword(matchedUser.username, newPassword);
    const { success, message } = ('then' in res || res instanceof Promise) ? await res : res;

    if (!success) {
      setErrorMsg(message);
      return;
    }

    setSuccessMsg('Senha alterada com absoluto sucesso!');
    setUsername(matchedUser.username);
    setPassword(newPassword);

    // Clear forms
    setRecoveryInput('');
    setVerificationCode('');
    setNewPassword('');
    setConfirmNewPassword('');

    // Push to login
    setTimeout(() => {
      transitionTo('login');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white" id="login-view-page">
      
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/5 border border-slate-100 flex flex-col" id="login-card">
        
        {/* BANNER SUPERIOR */}
        <div className="bg-blue-900 p-8 text-center text-white relative">
          <div className="absolute inset-0 bg-radial-gradient from-blue-750 to-blue-900 opacity-90"></div>
          <div className="relative z-10">
            <DiamondLogoBig />
            <h2 className="text-xl font-extrabold tracking-tight font-heading">
              DIAMANTE LOG
            </h2>
            <p className="text-blue-200 text-xs mt-1 font-medium select-none">
              Controle de Distribuição e Coletas Integradas
            </p>
          </div>
        </div>

        {/* ÁREA DO FORMULÁRIO */}
        <div className="p-8 flex-1">
          
          {/* ALERTAS */}
          {errorMsg && (
            <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl flex items-start gap-2.5 text-xs font-bold" id="login-error-alert">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl flex items-start gap-2.5 text-xs font-bold" id="login-success-alert">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FORMS */}
          {isGoogleProtected && !hasAuthorizedEmail ? (
            <div className="flex flex-col items-center justify-center py-2 space-y-4 font-sans" id="google-verification-gate">
              <div className="bg-blue-50 text-blue-900 text-center p-4 rounded-2xl border border-blue-150 flex flex-col items-center gap-1.5 shadow-sm">
                <Lock className="h-5 w-5 text-blue-600 mb-0.5" />
                <span className="font-extrabold text-[12px] uppercase tracking-wider text-blue-800">Acesso Restrito ao Sistema</span>
                <span className="text-[11px] leading-relaxed text-slate-600 font-medium">
                  Este sistema da Diamante Log possui controle de segurança rígido. Libere o acesso autenticando um e-mail do Google autorizado.
                </span>
              </div>

              {unauthorizedEmail && (
                <div className="bg-rose-50 border border-rose-100 text-rose-850 p-4 rounded-2xl flex flex-col gap-1.5 text-[11px] font-semibold leading-relaxed w-full shadow-sm" id="google-gate-error">
                  <div className="flex items-center gap-2 text-rose-700 font-black text-xs">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 animate-pulse" />
                    <span>E-mail Não Autorizado!</span>
                  </div>
                  <span>
                    O e-mail do Google <code className="bg-rose-100 px-1 py-0.5 rounded text-rose-900 font-bold font-mono text-[10px] break-all">{unauthorizedEmail}</code> não está cadastrado na lista de acessos permitidos.
                  </span>
                  <span className="text-rose-600 font-extrabold mt-1">
                    Por favor, solicite a liberação deste e-mail ao administrador Master do sistema.
                  </span>
                </div>
              )}

              <div className="w-full flex flex-col items-center py-4 space-y-2">
                <div id="google-signin-btn-container" className="flex justify-center h-11 min-w-[240px]"></div>
                
                {unauthorizedEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnauthorizedEmail('');
                      const google = (window as any).google;
                      google?.accounts?.id?.prompt();
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-bold hover:underline transition mt-2 cursor-pointer"
                  >
                    Tentar outro e-mail do Google
                  </button>
                )}
              </div>

              <div className="pt-2 text-center text-[9px] text-slate-400 font-black uppercase tracking-wider select-none">
                🔒 Proteção de Conexão Google Partner
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
            
            {/* TELA DE LOGIN */}
            {mode === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin}
                className="space-y-4"
                id="form-login-view"
              >
                <div className="text-center mb-6">
                  <h3 className="text-md font-bold text-slate-800">Acesse sua Conta</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Informe suas credenciais para gerenciar a frota</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Usuário</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="text"
                      placeholder="Ex: master ou operador"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                      id="login-username-input"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Senha de Acesso</label>
                    <button 
                      type="button"
                      onClick={() => transitionTo('forgot')}
                      className="text-[10px] text-blue-600 hover:underline font-bold"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha secreta"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 pl-10 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                      id="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                  id="login-submit-button"
                >
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="text-center pt-4 border-t border-slate-50 text-[10px] text-slate-400 font-bold">
                  Sistema de uso restrito da DIAMANTE LOG.
                </div>
              </motion.form>
            )}

            {/* TELA DE REGISTRO */}
            {mode === 'register' && (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleRegister}
                className="space-y-3"
                id="form-register-view"
              >
                <div className="text-center mb-4">
                  <h3 className="text-md font-bold text-slate-800">Criar Novo Acesso</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cadastre-se para obter acesso operacional</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase block">Seu Nome Completo</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={regNome}
                    onChange={(e) => setRegNome(e.target.value)}
                    className="w-full bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    id="reg-nome-completo"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase block">Nome de Usuário (@)</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: joao.silva (Sem espaços)"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    id="reg-username-login"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase block">Palavra-Chave para Recuperação</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      required
                      type="text"
                      placeholder="Ex: dlogjoao2026 (Guarde com cuidado)"
                      value={regPalavraChave}
                      onChange={(e) => setRegPalavraChave(e.target.value)}
                      className="w-full bg-slate-50 pl-10 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      id="reg-palavra-chave"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase block">Senha</label>
                    <input
                      required
                      type="password"
                      placeholder="Mín. 4 dig."
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      id="reg-password-str"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase block">Confirmar</label>
                    <input
                      required
                      type="password"
                      placeholder="Repita a senha"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      id="reg-password-confirm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-1.5 transition-all mt-3"
                  id="reg-submit-button"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Cadastrar Minha Conta</span>
                </button>

                <div className="text-center pt-3 border-t border-slate-50 text-[11px] text-slate-500 font-medium">
                  Já possui conta?{' '}
                  <button
                    type="button"
                    onClick={() => transitionTo('login')}
                    className="text-blue-600 hover:underline font-bold"
                    id="btn-switch-to-login"
                  >
                    Acessar login
                  </button>
                </div>
              </motion.form>
            )}

            {/* ESQUECI A SENHA - PALAVRA-CHAVE DE RECUPERAÇÃO */}
            {mode === 'forgot' && (
              <motion.form
                key="forgot"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleResetPasswordWithKeyword}
                className="space-y-3.5"
                id="form-forgot-password-keyword"
              >
                <div className="text-center mb-4">
                  <h3 className="text-md font-bold text-slate-800">Recuperação de Senha</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Defina uma nova senha usando sua palavra-chave cadastrada</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Seu Usuário</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="text"
                      placeholder="Nome de usuário cadastrado"
                      value={recoveryInput}
                      onChange={(e) => setRecoveryInput(e.target.value)}
                      className="w-full bg-slate-50 pl-10 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      id="recovery-username"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Sua Palavra-Chave</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="text"
                      placeholder="Digite sua palavra-chave"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full bg-slate-50 pl-10 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      id="recovery-keyword"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Nova Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="password"
                      placeholder="Mínimo de 4 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 pl-10 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      id="recovery-new-password"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Confirmar Nova Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="password"
                      placeholder="Repita a nova senha exata"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full bg-slate-50 pl-10 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      id="recovery-confirm-password"
                    />
                  </div>
                </div>

                {/* HELP BANNER FOR MISSING KEYWORDS */}
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 text-center mt-2 shadow-sm text-xs font-bold text-rose-650">
                  <p>Caso não lembre, procure o T.I da empresa.</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-1.5 transition-all mt-4"
                  id="reset-password-keyword-submit"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Salvar Nova Senha</span>
                </button>

                <div className="text-center pt-3 border-t border-slate-50 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => transitionTo('login')}
                    className="text-slate-500 hover:text-slate-850 font-bold"
                  >
                    Voltar para Login
                  </button>
                </div>
              </motion.form>
            )}

          </AnimatePresence>
          )}

          {isGoogleProtected && hasAuthorizedEmail && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold" id="google-verified-session-pill">
              <span className="flex items-center gap-1.5 text-slate-500">
                <CheckCheck className="h-4 w-4 text-emerald-500" />
                <span>Google verificado: <strong className="text-slate-700">{googleUserEmail}</strong></span>
              </span>
              <button 
                type="button" 
                onClick={() => {
                  sessionStorage.removeItem('verifiedGoogleEmail');
                  setGoogleUserEmail('');
                }}
                className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer font-bold shrink-0 ml-2"
              >
                Mudar conta
              </button>
            </div>
          )}

        </div>

      </div>

      {/* FOOTER DO SELETOR DE LOGIN */}
      <p className="text-slate-500 text-[10px] font-medium mt-6 tracking-wide leading-normal text-center max-w-sm select-none">
        DIAMANTE LOG Cloud v2.5 • Sistema de controle integrado de frotas e distribuição monitorada por satélite.
      </p>

    </div>
  );
}
