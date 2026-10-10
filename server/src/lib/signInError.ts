export interface SignInFailure {
  status: number;
  message: string;
  logReason: string;
}

interface AuthErrorLike {
  status?: number;
  code?: string;
}

export function classifySignInError(err: AuthErrorLike | null | undefined): SignInFailure {
  if (!err) {
    return { status: 401, message: 'Wrong ID or password', logReason: 'no-session' };
  }
  const code = err.code ?? 'none';
  const status = err.status ?? 0;
  if (code === 'email_not_confirmed') {
    return {
      status: 403,
      message: 'Your account email is not confirmed. Contact reception.',
      logReason: `code=${code}`,
    };
  }
  if (code === 'invalid_credentials' || (code === 'none' && status === 400)) {
    return { status: 401, message: 'Wrong ID or password', logReason: `code=${code} status=${status}` };
  }
  return {
    status: 503,
    message: 'Sign-in service error. Try again or contact reception.',
    logReason: `code=${code} status=${status}`,
  };
}
