import { vi } from "vitest";

// A minimal, hand-rolled Supabase client stub for unit tests.
//
// Supabase's query builder is a Promise-returning chain. Each method on the
// builder returns `this`, and awaiting the chain returns `{ data, error }`.
// This stub keeps the same contract so test code can assert on the mocked
// methods and swap in canned responses per-table.
//
// Only the subset of methods actually used by our server actions is covered:
//   from, select, insert, update, delete, upsert, eq, in, lte, gte,
//   not, order, limit, maybeSingle, single
//
// Plus `rpc` and `auth.getUser` at the top level.

export type QueryResult = { data: unknown; error: unknown };

export type MockSupabase = {
  // table-level setup
  setTableResponse(table: string, response: QueryResult): void;
  setRpcResponse(fn: string, response: { data?: unknown; error?: unknown }): void;
  setUser(user: { id: string; email?: string } | null): void;

  // the underlying client exposed to the action
  client: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
    auth: {
      getUser: ReturnType<typeof vi.fn>;
    };
  };

  // introspection helpers for assertions
  fromCalls: string[];                            // table names in order
  insertedRows: Record<string, unknown[]>;        // table -> rows passed to .insert
  updatedRows: Record<string, unknown[]>;         // table -> patches passed to .update
  deletedTables: string[];                        // tables that got .delete() called
  rpcCalls: Array<{ fn: string; args: unknown }>;
};

export function createMockSupabase(): MockSupabase {
  const tableResponses = new Map<string, QueryResult>();
  const rpcResponses = new Map<string, { data?: unknown; error?: unknown }>();
  let currentUser: { id: string; email?: string } | null = null;

  const state: Pick<MockSupabase, "fromCalls" | "insertedRows" | "updatedRows" | "deletedTables" | "rpcCalls"> = {
    fromCalls: [],
    insertedRows: {},
    updatedRows: {},
    deletedTables: [],
    rpcCalls: [],
  };

  // The Supabase query builder is a chainable dynamic shape. Typing it fully
  // just so the mock can impersonate it isn't worth the ceremony here — the
  // tests consume this through the module mock, not directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildBuilder(table: string): any {
    const response: QueryResult = tableResponses.get(table) ?? { data: null, error: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};

    // chainable methods — all return the builder so awaits resolve to `response`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passthrough = (): any => builder;
    builder.select = vi.fn(passthrough);
    builder.insert = vi.fn((rows: unknown) => {
      state.insertedRows[table] = (state.insertedRows[table] ?? []).concat(
        Array.isArray(rows) ? rows : [rows]
      );
      return builder;
    });
    builder.update = vi.fn((patch: unknown) => {
      state.updatedRows[table] = (state.updatedRows[table] ?? []).concat([patch]);
      return builder;
    });
    builder.upsert = vi.fn(passthrough);
    builder.delete = vi.fn(() => {
      state.deletedTables.push(table);
      return builder;
    });
    builder.eq = vi.fn(passthrough);
    builder.in = vi.fn(passthrough);
    builder.lte = vi.fn(passthrough);
    builder.gte = vi.fn(passthrough);
    builder.lt = vi.fn(passthrough);
    builder.gt = vi.fn(passthrough);
    builder.not = vi.fn(passthrough);
    builder.order = vi.fn(passthrough);
    builder.limit = vi.fn(passthrough);
    builder.single = vi.fn(() => Promise.resolve(response));
    builder.maybeSingle = vi.fn(() => Promise.resolve(response));
    // Awaiting the chain itself resolves to the response.
    builder.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected);

    return builder;
  }

  const client = {
    from: vi.fn((table: string) => {
      state.fromCalls.push(table);
      return buildBuilder(table);
    }),
    rpc: vi.fn((fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      const r = rpcResponses.get(fn) ?? { data: null, error: null };
      return Promise.resolve(r);
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: currentUser }, error: null })
      ),
    },
  };

  return {
    client,
    fromCalls: state.fromCalls,
    insertedRows: state.insertedRows,
    updatedRows: state.updatedRows,
    deletedTables: state.deletedTables,
    rpcCalls: state.rpcCalls,
    setTableResponse(table, response) {
      tableResponses.set(table, response);
    },
    setRpcResponse(fn, response) {
      rpcResponses.set(fn, response);
    },
    setUser(user) {
      currentUser = user;
    },
  };
}
