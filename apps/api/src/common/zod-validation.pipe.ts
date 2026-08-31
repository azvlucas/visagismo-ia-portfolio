import type { PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { validationError } from './http-error.js';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw validationError(parsed.error.flatten());
    }
    return parsed.data;
  }
}
