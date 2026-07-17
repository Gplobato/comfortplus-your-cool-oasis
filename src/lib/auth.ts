export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

export function passwordRequirements(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isStrongPassword(password: string) {
  return Object.values(passwordRequirements(password)).every(Boolean);
}

export function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid_credentials|invalid login credentials/i.test(message)) {
    return "Usuário/e-mail ou senha inválidos.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (/user already registered|already been registered/i.test(message)) {
    return "Não foi possível criar a conta. Tente entrar ou recuperar a senha.";
  }
  if (/password/i.test(message)) {
    return "A senha não atende aos requisitos de segurança.";
  }
  return "Não foi possível concluir a autenticação. Tente novamente.";
}
