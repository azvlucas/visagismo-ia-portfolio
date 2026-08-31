import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_IMAGE_SYSTEM_PROMPT,
  IMAGE_SYSTEM_PROMPT_PLACEHOLDERS,
} from '@visagismo/generation';
import { appSettings, type Db } from '@visagismo/db';
import { DB } from '../db/db.module.js';

export const SETTING_IMAGE_SYSTEM_PROMPT = 'image_system_prompt';
export const SETTING_FEATURE_FLAGS = 'feature_flags';

export type FeatureFlags = {
  /** Mercado Pago / checkout pago (também respeita env PAYMENTS_ENABLED). */
  payments_enabled: boolean;
  /** Pipeline de geração de imagens. */
  generation_enabled: boolean;
  /** Site em manutenção. */
  maintenance_mode: boolean;
  /**
   * Quando true, o checkout do cliente pula o pagamento e enfileira a geração
   * imediatamente (campanha, beta, demo).
   */
  free_generation_enabled: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  payments_enabled: true,
  generation_enabled: true,
  maintenance_mode: false,
  free_generation_enabled: false,
};

@Injectable()
export class AdminSettingsService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  async getImageSystemPrompt(): Promise<{
    prompt: string;
    isDefault: boolean;
    defaultPrompt: string;
    placeholders: typeof IMAGE_SYSTEM_PROMPT_PLACEHOLDERS;
    updatedAt: string | null;
  }> {
    const stored = await this.readSetting(SETTING_IMAGE_SYSTEM_PROMPT);
    const prompt =
      typeof stored?.value === 'string' && stored.value.trim()
        ? stored.value
        : typeof stored?.value === 'object' &&
            stored?.value &&
            'text' in (stored.value as object) &&
            typeof (stored.value as { text: unknown }).text === 'string'
          ? (stored.value as { text: string }).text
          : DEFAULT_IMAGE_SYSTEM_PROMPT;

    const isDefault =
      !stored || prompt.trim() === DEFAULT_IMAGE_SYSTEM_PROMPT.trim();

    return {
      prompt,
      isDefault,
      defaultPrompt: DEFAULT_IMAGE_SYSTEM_PROMPT,
      placeholders: IMAGE_SYSTEM_PROMPT_PLACEHOLDERS,
      updatedAt: stored?.updatedAt?.toISOString() ?? null,
    };
  }

  async setImageSystemPrompt(text: string): Promise<{
    prompt: string;
    isDefault: boolean;
    updatedAt: string;
  }> {
    const prompt = text.trim() || DEFAULT_IMAGE_SYSTEM_PROMPT;
    const now = new Date();
    const value = { text: prompt };

    if (!this.db) {
      // fallback memória de processo (dev sem DB)
      memorySettings.set(SETTING_IMAGE_SYSTEM_PROMPT, {
        value,
        updatedAt: now,
      });
      return {
        prompt,
        isDefault: prompt === DEFAULT_IMAGE_SYSTEM_PROMPT,
        updatedAt: now.toISOString(),
      };
    }

    await this.db
      .insert(appSettings)
      .values({
        key: SETTING_IMAGE_SYSTEM_PROMPT,
        value,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: now },
      });

    return {
      prompt,
      isDefault: prompt.trim() === DEFAULT_IMAGE_SYSTEM_PROMPT.trim(),
      updatedAt: now.toISOString(),
    };
  }

  async resetImageSystemPrompt() {
    return this.setImageSystemPrompt(DEFAULT_IMAGE_SYSTEM_PROMPT);
  }

  /** Usado na geração — sempre resolve o texto efetivo */
  async resolveImageSystemPromptForGeneration(): Promise<string> {
    const { prompt } = await this.getImageSystemPrompt();
    return prompt;
  }

  async getFeatureFlags(): Promise<{
    flags: FeatureFlags;
    updatedAt: string | null;
  }> {
    const stored = await this.readSetting(SETTING_FEATURE_FLAGS);
    const flags = this.normalizeFeatureFlags(stored?.value);
    return {
      flags,
      updatedAt: stored?.updatedAt?.toISOString() ?? null,
    };
  }

  async setFeatureFlags(
    patch: Partial<FeatureFlags>,
  ): Promise<{ flags: FeatureFlags; updatedAt: string }> {
    const current = await this.getFeatureFlags();
    const flags: FeatureFlags = {
      ...current.flags,
      ...Object.fromEntries(
        Object.entries(patch).filter(([, v]) => typeof v === 'boolean'),
      ),
    };
    const now = new Date();
    await this.writeSetting(SETTING_FEATURE_FLAGS, flags, now);
    return { flags, updatedAt: now.toISOString() };
  }

  async isFreeGenerationEnabled(): Promise<boolean> {
    const { flags } = await this.getFeatureFlags();
    return flags.free_generation_enabled === true;
  }

  /** Config pública (sem segredos) para landing e wizard. */
  async getPublicConfig(): Promise<{
    freeGenerationEnabled: boolean;
    paymentsEnabled: boolean;
    generationEnabled: boolean;
    maintenanceMode: boolean;
  }> {
    const { flags } = await this.getFeatureFlags();
    return {
      freeGenerationEnabled: flags.free_generation_enabled === true,
      paymentsEnabled: flags.payments_enabled !== false,
      generationEnabled: flags.generation_enabled !== false,
      maintenanceMode: flags.maintenance_mode === true,
    };
  }

  private normalizeFeatureFlags(raw: unknown): FeatureFlags {
    const base = { ...DEFAULT_FEATURE_FLAGS };
    if (!raw || typeof raw !== 'object') return base;
    const o = raw as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[]) {
      if (typeof o[key] === 'boolean') {
        base[key] = o[key] as boolean;
      }
    }
    return base;
  }

  private async writeSetting(
    key: string,
    value: unknown,
    now: Date = new Date(),
  ): Promise<void> {
    if (!this.db) {
      memorySettings.set(key, { value, updatedAt: now });
      return;
    }
    await this.db
      .insert(appSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: now },
      });
  }

  private async readSetting(key: string): Promise<{
    value: unknown;
    updatedAt: Date;
  } | null> {
    if (!this.db) {
      return memorySettings.get(key) ?? null;
    }
    try {
      const [row] = await this.db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, key))
        .limit(1);
      if (!row) return null;
      return { value: row.value, updatedAt: row.updatedAt };
    } catch (err) {
      console.warn('app_settings read failed', err);
      return memorySettings.get(key) ?? null;
    }
  }
}

const memorySettings = new Map<
  string,
  { value: unknown; updatedAt: Date }
>();
