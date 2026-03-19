type SetOptions = {
  EX?: number;
  NX?: boolean;
};

type TransactionCommand =
  | { op: 'set'; key: string; value: string; options?: SetOptions }
  | { op: 'del'; key: string };

class MockRedisMulti {
  private readonly commands: TransactionCommand[] = [];

  constructor(private readonly client: MockRedisClient) {}

  set(key: string, value: string, options?: SetOptions): MockRedisMulti {
    this.commands.push({ op: 'set', key, value, options });
    return this;
  }

  del(key: string): MockRedisMulti {
    this.commands.push({ op: 'del', key });
    return this;
  }

  async exec(): Promise<unknown[] | null> {
    return this.client.execTransaction(this.commands);
  }
}

export class MockRedisClient {
  private readonly store = new Map<string, string>();
  private readonly versions = new Map<string, number>();
  private readonly watchedVersions = new Map<string, number>();
  private readonly setOptionsByKey = new Map<string, SetOptions | undefined>();
  private forcedConflicts = 0;

  async watch(...keys: string[]): Promise<'OK'> {
    for (const key of keys) {
      this.watchedVersions.set(key, this.getVersion(key));
    }
    return 'OK';
  }

  async unwatch(): Promise<'OK'> {
    this.watchedVersions.clear();
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, options?: SetOptions): Promise<string | null> {
    if (options?.NX && this.store.has(key)) {
      return null;
    }
    this.store.set(key, value);
    this.setOptionsByKey.set(key, options);
    this.bumpVersion(key);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    this.setOptionsByKey.delete(key);
    if (deleted) {
      this.bumpVersion(key);
      return 1;
    }
    return 0;
  }

  multi(): MockRedisMulti {
    return new MockRedisMulti(this);
  }

  forceConflictOnce(): void {
    this.forcedConflicts += 1;
  }

  getStoredValue(key: string): string | undefined {
    return this.store.get(key);
  }

  getLastSetOptions(key: string): SetOptions | undefined {
    return this.setOptionsByKey.get(key);
  }

  async execTransaction(commands: TransactionCommand[]): Promise<unknown[] | null> {
    if (this.forcedConflicts > 0) {
      this.forcedConflicts -= 1;
      this.watchedVersions.clear();
      return null;
    }

    for (const [key, watchedVersion] of this.watchedVersions.entries()) {
      if (this.getVersion(key) !== watchedVersion) {
        this.watchedVersions.clear();
        return null;
      }
    }

    const result: unknown[] = [];
    for (const command of commands) {
      if (command.op === 'set') {
        const setResult = await this.set(
          command.key,
          command.value,
          command.options,
        );
        result.push(setResult);
      } else {
        const delResult = await this.del(command.key);
        result.push(delResult);
      }
    }

    this.watchedVersions.clear();
    return result;
  }

  private bumpVersion(key: string): void {
    this.versions.set(key, this.getVersion(key) + 1);
  }

  private getVersion(key: string): number {
    return this.versions.get(key) ?? 0;
  }
}

export class MockRedisService {
  constructor(private readonly client: MockRedisClient) {}

  getClient(): MockRedisClient {
    return this.client;
  }
}
