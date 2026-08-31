import { HttpException, HttpStatus } from '@nestjs/common';
import {
  ERROR_MESSAGES_PT,
  type ErrorCode,
} from '@visagismo/shared';

export class ApiHttpException extends HttpException {
  constructor(
    code: ErrorCode | string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    message?: string,
    details?: unknown,
  ) {
    const resolvedMessage =
      message ??
      (code in ERROR_MESSAGES_PT
        ? ERROR_MESSAGES_PT[code as ErrorCode]
        : 'Erro na requisição.');

    super(
      {
        error: {
          code,
          message: resolvedMessage,
          ...(details !== undefined ? { details } : {}),
        },
      },
      status,
    );
  }
}

export function validationError(details: unknown) {
  return new ApiHttpException(
    'VALIDATION_ERROR',
    HttpStatus.BAD_REQUEST,
    ERROR_MESSAGES_PT.VALIDATION_ERROR,
    details,
  );
}
