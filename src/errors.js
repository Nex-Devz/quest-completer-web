export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export class AuthError extends Error {
  constructor(message = 'Discord rejected this token.') {
    super(message);
    this.name = 'AuthError';
    this.status = 401;
    this.code = 'invalid_token';
  }
}

export class DiscordError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'DiscordError';
    this.status = status;
    this.code = 'discord_error';
  }
}
