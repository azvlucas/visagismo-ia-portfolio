import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  packages,
  orderQuestionnaires,
  orders,
  type Db,
} from '@visagismo/db';
import {
  type CreateOrderInput,
  type OrderAccessInput,
  type PatchOrderInput,
  type SessionExchangeInput,
  questionnairePayloadSchema,
} from '@visagismo/shared';
import { DB } from '../db/db.module.js';
import { ApiHttpException } from '../common/http-error.js';
import {
  generateAccessCode,
  generateCapabilityToken,
  generateOrderNumber,
  hashCapabilityToken,
  normalizeAccessCode,
  normalizeEmail,
  signOrderSession,
  verifyCapabilityToken,
  verifyOrderSession,
} from '../auth/order-crypto.js';
import { memoryOrders } from './orders.memory.js';
import {
  type OrderRecord,
  type PublicOrderView,
  toPublicOrder,
} from './order.types.js';
import { PackagesService } from '../packages/packages.service.js';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db | null,
    @Inject(PackagesService) private readonly packagesService: PackagesService,
  ) {}

  async onModuleInit() {
    if (!this.db) {
      console.warn(
        JSON.stringify({
          orders: 'memory_only',
          warning:
            'DATABASE_URL ausente — pedidos serão perdidos no redeploy',
        }),
      );
      return;
    }
    try {
      const [row] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(isNull(orders.deletedAt));
      console.log(
        JSON.stringify({
          orders: 'postgres',
          count: row?.count ?? 0,
          note: 'Admin lista e findById usam o banco',
        }),
      );
    } catch (err) {
      console.error('orders onModuleInit count failed', err);
    }
  }

  /** Lista pedidos persistidos (admin / métricas). */
  async listRecords(filters?: {
    status?: string;
    email?: string;
    q?: string;
    limit?: number;
  }): Promise<OrderRecord[]> {
    const limit = filters?.limit ?? 200;

    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(orders)
          .where(isNull(orders.deletedAt))
          .orderBy(desc(orders.createdAt))
          .limit(limit);

        const mapped: OrderRecord[] = [];
        for (const row of rows) {
          const full = await this.findById(row.id);
          if (full) mapped.push(full);
        }

        let list = mapped;
        if (filters?.status) {
          list = list.filter((o) => o.status === filters.status);
        }
        if (filters?.email) {
          const e = filters.email.toLowerCase();
          list = list.filter((o) => o.customerEmailNormalized.includes(e));
        }
        if (filters?.q) {
          const q = filters.q.toLowerCase();
          list = list.filter(
            (o) =>
              o.orderNumber.toLowerCase().includes(q) ||
              o.customerName.toLowerCase().includes(q) ||
              o.customerEmailNormalized.includes(q),
          );
        }
        // Re-hidrata cache em memória para reprocess/cancel no mesmo processo
        for (const o of list) memoryOrders.save(o);
        return list;
      } catch (err) {
        console.warn('orders.listRecords DB failed — memory', err);
      }
    }

    let list = memoryOrders.listAll();
    if (filters?.status) {
      list = list.filter((o) => o.status === filters.status);
    }
    if (filters?.email) {
      const e = filters.email.toLowerCase();
      list = list.filter((o) => o.customerEmailNormalized.includes(e));
    }
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmailNormalized.includes(q),
      );
    }
    return list.slice(0, limit);
  }

  async create(
    input: CreateOrderInput,
  ): Promise<{ order: PublicOrderView; sessionToken: string }> {
    const pkg = await this.resolvePackage(
      input.packageId ?? input.packageSlug ?? '',
    );
    if (!pkg.isActive) {
      throw new ApiHttpException('PACKAGE_INACTIVE', HttpStatus.BAD_REQUEST);
    }

    const capabilityToken = generateCapabilityToken();
    const now = new Date();
    const order: OrderRecord = {
      id: randomUUID(),
      orderNumber: generateOrderNumber(),
      customerName: input.name.trim(),
      customerEmail: input.email.trim(),
      customerEmailNormalized: normalizeEmail(input.email),
      status: 'draft',
      packageId: pkg.id,
      packageSlug: pkg.slug,
      packageName: pkg.name,
      packagePriceCents: pkg.priceCents,
      packageSnapshot: {
        estimatedSlaHours:
          'estimatedSlaHours' in pkg ? pkg.estimatedSlaHours : undefined,
        imageCount: 'imageCount' in pkg ? pkg.imageCount : undefined,
        features: 'features' in pkg ? pkg.features : undefined,
      },
      accessTokenHash: hashCapabilityToken(capabilityToken),
      accessCode: generateAccessCode(),
      tokenVersion: 0,
      accessRevokedAt: null,
      consentPrivacyAt: null,
      consentImageProcessingAt: null,
      marketingOptInAt: null,
      ageAttestedAt: null,
      questionnaireCompletedAt: null,
      paidAt: null,
      completedAt: null,
      expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
      version: 1,
      createdAt: now,
      updatedAt: now,
      questionnaire: { schemaVersion: 1 },
      questionnaireSchemaVersion: 1,
    };

    await this.persistCreate(order);

    const session = await signOrderSession({
      orderId: order.id,
      tokenVersion: order.tokenVersion,
      status: order.status,
      paidAt: order.paidAt,
    });

    return {
      order: toPublicOrder(order, { includeAccessCode: true }),
      sessionToken: session.token,
    };
  }

  async getById(
    orderId: string,
    sessionJwt: string | undefined,
  ): Promise<PublicOrderView> {
    const order = await this.requireAuthorizedOrder(orderId, sessionJwt);
    return toPublicOrder(order, { includeAccessCode: true });
  }

  /**
   * Acesso recorrente: e-mail + código de 6 dígitos → sessão do pedido.
   * Mensagem genérica em falha (não revelar se o e-mail existe).
   */
  async accessByEmailAndCode(
    input: OrderAccessInput,
  ): Promise<{ order: PublicOrderView; sessionToken: string }> {
    const email = normalizeEmail(input.email);
    const code = normalizeAccessCode(input.accessCode);
    if (code.length !== 6) {
      throw new ApiHttpException(
        'UNAUTHORIZED',
        HttpStatus.UNAUTHORIZED,
        'E-mail ou código inválidos.',
      );
    }

    const order = await this.findByEmailAndAccessCode(email, code);
    if (!order || order.deletedAt) {
      throw new ApiHttpException(
        'UNAUTHORIZED',
        HttpStatus.UNAUTHORIZED,
        'E-mail ou código inválidos.',
      );
    }
    if (order.accessRevokedAt) {
      throw new ApiHttpException('ACCESS_REVOKED', HttpStatus.FORBIDDEN);
    }

    // Retenção do resultado (após conclusão)
    const retentionDays = Number(
      process.env.RETENTION_GENERATED_DAYS ??
        process.env.NEXT_PUBLIC_RETENTION_GENERATED_DAYS ??
        90,
    );
    if (order.completedAt && retentionDays > 0) {
      const limit =
        order.completedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000;
      if (Date.now() > limit) {
        throw new ApiHttpException(
          'ACCESS_REVOKED',
          HttpStatus.FORBIDDEN,
          'O prazo de retenção deste resultado expirou.',
        );
      }
    }

    const session = await signOrderSession({
      orderId: order.id,
      tokenVersion: order.tokenVersion,
      status: order.status,
      paidAt: order.paidAt,
    });

    return {
      order: toPublicOrder(order, { includeAccessCode: true }),
      sessionToken: session.token,
    };
  }

  async patch(
    orderId: string,
    input: PatchOrderInput,
    sessionJwt: string | undefined,
  ): Promise<{ order: PublicOrderView; sessionToken?: string }> {
    const order = await this.requireAuthorizedOrder(orderId, sessionJwt);

    if (order.status !== 'draft') {
      throw new ApiHttpException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Só é possível editar pedidos em rascunho.',
      );
    }

    const now = new Date();
    let next: OrderRecord = {
      ...order,
      updatedAt: now,
      version: order.version + 1,
    };

    if (input.name) {
      next.customerName = input.name.trim();
    }

    if (input.questionnaire) {
      const merged = {
        schemaVersion: 1 as const,
        likedStyles: [] as string[],
        dislikedStyles: [] as string[],
        restrictions: '',
        desiredHairLength: 'any' as const,
        openToColorChange: false,
        ...next.questionnaire,
        ...input.questionnaire,
      };
      next.questionnaire = merged;
      next.questionnaireSchemaVersion = 1;

      const complete = questionnairePayloadSchema.safeParse(merged);
      if (complete.success) {
        next.questionnaire = complete.data as unknown as Record<string, unknown>;
        next.questionnaireCompletedAt = now;
      }
    }

    if (input.consentPrivacy === true) {
      next.consentPrivacyAt = now;
    }
    if (input.consentImageProcessing === true) {
      next.consentImageProcessingAt = now;
    }
    if (input.marketingOptIn === true) {
      next.marketingOptInAt = now;
    } else if (input.marketingOptIn === false) {
      next.marketingOptInAt = null;
    }
    if (input.ageAttested === true) {
      next.ageAttestedAt = now;
    }

    await this.persistUpdate(next);

    // Sliding refresh if session is present
    let sessionToken: string | undefined;
    if (sessionJwt) {
      const claims = await verifyOrderSession(sessionJwt);
      if (claims) {
        const remaining = (claims.exp ?? 0) - Math.floor(Date.now() / 1000);
        const fullTtl = 24 * 60 * 60;
        if (remaining < fullTtl * 0.25) {
          const session = await signOrderSession({
            orderId: next.id,
            tokenVersion: next.tokenVersion,
            status: next.status,
            paidAt: next.paidAt,
          });
          sessionToken = session.token;
        }
      }
    }

    return {
      order: toPublicOrder(next),
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  async exchangeSession(
    input: SessionExchangeInput,
  ): Promise<{ order: PublicOrderView; sessionToken: string }> {
    const order = await this.findById(input.orderId);
    if (!order) {
      throw new ApiHttpException('INVALID_TOKEN', HttpStatus.UNAUTHORIZED);
    }

    if (order.accessRevokedAt) {
      throw new ApiHttpException('ACCESS_REVOKED', HttpStatus.FORBIDDEN);
    }

    if (!verifyCapabilityToken(input.token, order.accessTokenHash)) {
      throw new ApiHttpException('INVALID_TOKEN', HttpStatus.UNAUTHORIZED);
    }

    const session = await signOrderSession({
      orderId: order.id,
      tokenVersion: order.tokenVersion,
      status: order.status,
      paidAt: order.paidAt,
    });

    return {
      order: toPublicOrder(order, { includeAccessCode: true }),
      sessionToken: session.token,
    };
  }

  /** Public for other modules (photos, checkout). */
  async requireSession(
    orderId: string,
    sessionJwt: string | undefined,
  ): Promise<OrderRecord> {
    return this.requireAuthorizedOrder(orderId, sessionJwt);
  }

  async getOrderRecord(orderId: string): Promise<OrderRecord | null> {
    return this.findById(orderId);
  }

  async saveOrder(order: OrderRecord): Promise<void> {
    order.updatedAt = new Date();
    await this.persistUpdate(order);
    // Also ensure full status fields written
    memoryOrders.save(order);
  }

  private async requireAuthorizedOrder(
    orderId: string,
    sessionJwt: string | undefined,
  ): Promise<OrderRecord> {
    if (!sessionJwt) {
      throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const claims = await verifyOrderSession(sessionJwt);
    if (!claims || claims.sub !== orderId) {
      throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const order = await this.findById(orderId);
    if (!order) {
      throw new ApiHttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (order.accessRevokedAt) {
      throw new ApiHttpException('ACCESS_REVOKED', HttpStatus.FORBIDDEN);
    }

    if (order.tokenVersion !== claims.tokenVersion) {
      throw new ApiHttpException('INVALID_TOKEN', HttpStatus.UNAUTHORIZED);
    }

    return order;
  }

  /**
   * Resolve package by real UUID, known offline-fallback UUIDs, or slug.
   * Offline fallback IDs (0000…0001/2/3) map to essencial/completo/premium when DB has different UUIDs.
   */
  private async resolvePackage(packageId: string) {
    const FALLBACK_ID_TO_SLUG: Record<string, string> = {
      '00000000-0000-4000-8000-000000000001': 'essencial',
      '00000000-0000-4000-8000-000000000002': 'completo',
      '00000000-0000-4000-8000-000000000003': 'premium',
    };

    const active = await this.packagesService.listActive();
    const byId = active.find((p) => p.id === packageId);
    if (byId) return byId;

    const slugHint = FALLBACK_ID_TO_SLUG[packageId] ?? packageId;
    const bySlug = active.find((p) => p.slug === slugHint || p.slug === packageId);
    if (bySlug) return bySlug;

    // DB: may exist but inactive — distinguish errors
    if (this.db) {
      try {
        const [byUuid] = await this.db
          .select()
          .from(packages)
          .where(and(eq(packages.id, packageId), isNull(packages.deletedAt)))
          .limit(1);
        if (byUuid) {
          if (!byUuid.isActive) {
            throw new ApiHttpException(
              'PACKAGE_INACTIVE',
              HttpStatus.BAD_REQUEST,
            );
          }
          return {
            id: byUuid.id,
            slug: byUuid.slug,
            name: byUuid.name,
            priceCents: byUuid.priceCents,
            isActive: byUuid.isActive,
            imageCount: byUuid.imageCount,
            estimatedSlaHours: byUuid.estimatedSlaHours,
            features: byUuid.features ?? [],
          };
        }

        const slug = FALLBACK_ID_TO_SLUG[packageId];
        if (slug) {
          const [bySlugRow] = await this.db
            .select()
            .from(packages)
            .where(and(eq(packages.slug, slug), isNull(packages.deletedAt)))
            .limit(1);
          if (bySlugRow) {
            if (!bySlugRow.isActive) {
              throw new ApiHttpException(
                'PACKAGE_INACTIVE',
                HttpStatus.BAD_REQUEST,
              );
            }
            return {
              id: bySlugRow.id,
              slug: bySlugRow.slug,
              name: bySlugRow.name,
              priceCents: bySlugRow.priceCents,
              isActive: bySlugRow.isActive,
              imageCount: bySlugRow.imageCount,
              estimatedSlaHours: bySlugRow.estimatedSlaHours,
              features: bySlugRow.features ?? [],
            };
          }
        }
      } catch (err) {
        if (err instanceof ApiHttpException) throw err;
        console.warn('resolvePackage DB error', err);
      }
    }

    // Offline fallback catalog
    const offline = active.find(
      (p) =>
        p.id === packageId ||
        p.slug === packageId ||
        p.slug === FALLBACK_ID_TO_SLUG[packageId],
    );
    if (offline) return offline;

    throw new ApiHttpException(
      'PACKAGE_INACTIVE',
      HttpStatus.BAD_REQUEST,
      'Pacote não encontrado ou indisponível. Atualize a página e escolha o pacote novamente.',
    );
  }

  private async findByEmailAndAccessCode(
    emailNormalized: string,
    accessCode: string,
  ): Promise<OrderRecord | null> {
    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.customerEmailNormalized, emailNormalized),
              eq(orders.accessCode, accessCode),
              isNull(orders.deletedAt),
            ),
          )
          .orderBy(desc(orders.createdAt))
          .limit(5);

        // Prefer paid / completed orders
        const preferred =
          rows.find((r) =>
            [
              'completed',
              'partially_completed',
              'processing',
              'queued',
              'payment_approved',
              'awaiting_payment',
            ].includes(r.status),
          ) ?? rows[0];

        if (preferred) {
          return this.findById(preferred.id);
        }
      } catch (err) {
        console.warn('findByEmailAndAccessCode DB failed', err);
      }
    }

    const mem = memoryOrders
      .listAll()
      .filter(
        (o) =>
          o.customerEmailNormalized === emailNormalized &&
          o.accessCode === accessCode &&
          !o.deletedAt,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return mem[0] ?? null;
  }

  private async findById(id: string): Promise<OrderRecord | null> {
    if (this.db) {
      try {
        const [row] = await this.db
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (!row) return memoryOrders.getById(id);

        const [q] = await this.db
          .select()
          .from(orderQuestionnaires)
          .where(eq(orderQuestionnaires.orderId, id))
          .limit(1);

        // Package display fields
        let packageSlug = 'package';
        let packageName = 'Pacote';
        try {
          const [pkg] = await this.db
            .select()
            .from(packages)
            .where(eq(packages.id, row.packageId))
            .limit(1);
          if (pkg) {
            packageSlug = pkg.slug;
            packageName = pkg.name;
          }
        } catch {
          // ignore
        }

        return {
          id: row.id,
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          customerEmail: row.customerEmail,
          customerEmailNormalized: row.customerEmailNormalized,
          status: row.status,
          packageId: row.packageId,
          packageSlug,
          packageName,
          packagePriceCents: row.packagePriceCents ?? 0,
          packageSnapshot: row.packageSnapshot,
          accessTokenHash: row.accessTokenHash,
          accessCode: row.accessCode ?? '000000',
          tokenVersion: row.tokenVersion,
          accessRevokedAt: row.accessRevokedAt,
          consentPrivacyAt: row.consentPrivacyAt,
          consentImageProcessingAt: row.consentImageProcessingAt,
          marketingOptInAt: row.marketingOptInAt,
          ageAttestedAt: row.ageAttestedAt,
          questionnaireCompletedAt: row.questionnaireCompletedAt,
          paidAt: row.paidAt,
          completedAt: row.completedAt,
          expiresAt: row.expiresAt,
          version: row.version,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          questionnaire: (q?.payload as Record<string, unknown>) ?? {
            schemaVersion: 1,
          },
          questionnaireSchemaVersion: q?.schemaVersion ?? 1,
        };
      } catch {
        return memoryOrders.getById(id);
      }
    }

    return memoryOrders.getById(id);
  }

  private async persistCreate(order: OrderRecord): Promise<void> {
    // Always keep memory cache for single-node admin metrics
    memoryOrders.save(order);
    if (this.db) {
      try {
        await this.db.insert(orders).values({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerEmailNormalized: order.customerEmailNormalized,
          status: order.status,
          packageId: order.packageId,
          packagePriceCents: order.packagePriceCents,
          // Garante imageCount do pacote (Premium=12 etc.) após reload do DB
          packageSnapshot: order.packageSnapshot,
          accessTokenHash: order.accessTokenHash,
          accessCode: order.accessCode,
          tokenVersion: order.tokenVersion,
          expiresAt: order.expiresAt,
          version: order.version,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        });
        await this.db.insert(orderQuestionnaires).values({
          orderId: order.id,
          payload: order.questionnaire,
          schemaVersion: order.questionnaireSchemaVersion,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        });
      } catch (err) {
        console.error(
          'orders.persistCreate DB failed — pedido só em memória (some no redeploy)',
          err,
        );
        if (
          process.env.REQUIRE_DB === 'true' ||
          process.env.NODE_ENV === 'production'
        ) {
          throw err;
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.error(
        'orders.persistCreate: sem DATABASE_URL — pedido não sobrevive a redeploy',
      );
    }
  }

  private async persistUpdate(order: OrderRecord): Promise<void> {
    memoryOrders.save(order);
    if (this.db) {
      try {
        await this.db
          .update(orders)
          .set({
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerEmailNormalized: order.customerEmailNormalized,
            status: order.status,
            packageSnapshot: order.packageSnapshot,
            packagePriceCents: order.packagePriceCents,
            consentPrivacyAt: order.consentPrivacyAt,
            consentImageProcessingAt: order.consentImageProcessingAt,
            marketingOptInAt: order.marketingOptInAt,
            ageAttestedAt: order.ageAttestedAt,
            questionnaireCompletedAt: order.questionnaireCompletedAt,
            paidAt: order.paidAt,
            completedAt: order.completedAt,
            expiresAt: order.expiresAt,
            accessRevokedAt: order.accessRevokedAt,
            tokenVersion: order.tokenVersion,
            deletedAt: order.deletedAt ?? null,
            failureMessagePublic: order.failureMessagePublic ?? null,
            version: order.version,
            updatedAt: order.updatedAt,
          })
          .where(eq(orders.id, order.id));

        await this.db
          .insert(orderQuestionnaires)
          .values({
            orderId: order.id,
            payload: order.questionnaire,
            schemaVersion: order.questionnaireSchemaVersion,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          })
          .onConflictDoUpdate({
            target: orderQuestionnaires.orderId,
            set: {
              payload: order.questionnaire,
              schemaVersion: order.questionnaireSchemaVersion,
              updatedAt: order.updatedAt,
            },
          });
      } catch (err) {
        console.error(
          'orders.persistUpdate DB failed — alteração só em memória',
          err,
        );
        if (
          process.env.REQUIRE_DB === 'true' ||
          process.env.NODE_ENV === 'production'
        ) {
          throw err;
        }
      }
    }
  }
}
