export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "AuthError";
    this.status = options?.status ?? 400;
    this.code = options?.code ?? "AUTH_ERROR";
  }
}

export class ProviderNotFoundError extends AuthError {
  constructor(providerId: string) {
    super(`Провайдер ${providerId} не найден`, {
      status: 400,
      code: "PROVIDER_NOT_FOUND",
    });
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = "Неверные учётные данные") {
    super(message, { status: 401, code: "INVALID_CREDENTIALS" });
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor(identifier: string) {
    super(`Пользователь ${identifier} уже существует`, {
      status: 409,
      code: "USER_EXISTS",
    });
  }
}
