export type AdminRole = 'admin' | 'operator';

export interface AdminUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const usersByEmail = new Map<string, AdminUserRecord>();
const usersById = new Map<string, AdminUserRecord>();
/** refresh jti → admin user id */
const refreshTokens = new Map<string, { userId: string; exp: number }>();

export const memoryAdminUsers = {
  save(user: AdminUserRecord) {
    usersByEmail.set(user.email.toLowerCase(), user);
    usersById.set(user.id, user);
  },

  getByEmail(email: string) {
    return usersByEmail.get(email.toLowerCase()) ?? null;
  },

  getById(id: string) {
    return usersById.get(id) ?? null;
  },

  list() {
    return [...usersById.values()];
  },

  saveRefresh(jti: string, userId: string, exp: number) {
    refreshTokens.set(jti, { userId, exp });
  },

  takeRefresh(jti: string) {
    const row = refreshTokens.get(jti);
    if (!row) return null;
    if (row.exp < Math.floor(Date.now() / 1000)) {
      refreshTokens.delete(jti);
      return null;
    }
    return row;
  },

  revokeRefresh(jti: string) {
    refreshTokens.delete(jti);
  },
};
