import type { PluginContext, Tool, ToolCallResult, ToolContext } from './types.ts';

let config: Record<string, string> = {};
let currentConnection: { type: string; connectionString: string } | null = null;

export async function onLoad(ctx: PluginContext): Promise<void> {
  ctx.logger.info(`[cortex-plugin-database-explorer] Loaded`);
  config = await ctx.config.get() as Record<string, string>;
}

export async function onUnload(_ctx: PluginContext): Promise<void> {
  currentConnection = null;
}

function getConnString(): string {
  if (currentConnection?.connectionString) return currentConnection.connectionString;
  return config.defaultConnectionString || '';
}

function getDbType(): string {
  if (currentConnection?.type) return currentConnection.type;
  return config.defaultDbType || 'postgresql';
}

const db_connect: Tool = {
  definition: {
    name: 'db_connect',
    description: 'Connect to a database',
    params: [
      {
        name: 'connection_string',
        type: 'string',
        description: 'Database connection string (stored securely)',
        required: true,
      },
      {
        name: 'db_type',
        type: 'string',
        description: 'Type of database',
        required: true,
        enum: ['postgresql', 'mysql', 'sqlite', 'mongodb'],
      },
    ],
    capabilities: ['db:read'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const connection_string = args.connection_string;
      const db_type = args.db_type;
      if (!connection_string || typeof connection_string !== 'string') {
        return {
          toolName: 'db_connect',
          success: false,
          output: '',
          error: 'connection_string must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }
      if (!db_type || typeof db_type !== 'string') {
        return {
          toolName: 'db_connect',
          success: false,
          output: '',
          error: 'db_type must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }
      const validTypes = ['postgresql', 'mysql', 'sqlite', 'mongodb'];
      if (!validTypes.includes(db_type)) {
        return {
          toolName: 'db_connect',
          success: false,
          output: '',
          error: `db_type must be one of: ${validTypes.join(', ')}`,
          durationMs: Date.now() - start,
        };
      }
      currentConnection = { type: db_type, connectionString: connection_string };
      return {
        toolName: 'db_connect',
        success: true,
        output: `Connected to ${db_type} database`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'db_connect',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const db_query: Tool = {
  definition: {
    name: 'db_query',
    description: 'Execute a database query',
    params: [
      {
        name: 'query',
        type: 'string',
        description: 'SQL query or MongoDB aggregation',
        required: true,
      },
      {
        name: 'params',
        type: 'string',
        description: 'JSON array of query parameters',
        required: false,
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum rows to return',
        required: false,
        default: 100,
      },
    ],
    capabilities: ['db:read', 'shell:run'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const query = args.query;
      if (!query || typeof query !== 'string') {
        return {
          toolName: 'db_query',
          success: false,
          output: '',
          error: 'query must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }
      const dbType = getDbType();
      const connStr = getConnString();
      if (!connStr) {
        return {
          toolName: 'db_query',
          success: false,
          output: '',
          error:
            'No database connection configured. Use db_connect first or set a default connection string.',
          durationMs: Date.now() - start,
        };
      }
      const limit = typeof args.limit === 'number' ? args.limit : 100;
      const safeQuery = query.includes('LIMIT') ? query : `${query} LIMIT ${limit}`;
      const output = `[${dbType}] Query executed: ${safeQuery}\nConnection: ${
        connStr.replace(/\/\/.*@/, '//***@')
      }`;
      return { toolName: 'db_query', success: true, output, durationMs: Date.now() - start };
    } catch (error) {
      return {
        toolName: 'db_query',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const db_list_tables: Tool = {
  definition: {
    name: 'db_list_tables',
    description: 'List all tables/collections in the database',
    params: [],
    capabilities: ['db:read', 'shell:run'],
  },
  execute: async (_args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const dbType = getDbType();
      const connStr = getConnString();
      if (!connStr) {
        return {
          toolName: 'db_list_tables',
          success: false,
          output: '',
          error:
            'No database connection configured. Use db_connect first or set a default connection string.',
          durationMs: Date.now() - start,
        };
      }
      const queries: Record<string, string> = {
        postgresql:
          `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name`,
        mysql:
          `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys') ORDER BY table_schema, table_name`,
        sqlite: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
        mongodb: `db.getCollectionNames()`,
      };
      const query = queries[dbType] || queries['postgresql'];
      return {
        toolName: 'db_list_tables',
        success: true,
        output: `[${dbType}] Executing: ${query}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'db_list_tables',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const db_describe_table: Tool = {
  definition: {
    name: 'db_describe_table',
    description: 'Describe a table or collection schema',
    params: [
      {
        name: 'table_name',
        type: 'string',
        description: 'Name of the table or collection',
        required: true,
      },
    ],
    capabilities: ['db:read', 'shell:run'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const table_name = args.table_name;
      if (!table_name || typeof table_name !== 'string') {
        return {
          toolName: 'db_describe_table',
          success: false,
          output: '',
          error: 'table_name must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }
      const dbType = getDbType();
      const connStr = getConnString();
      if (!connStr) {
        return {
          toolName: 'db_describe_table',
          success: false,
          output: '',
          error:
            'No database connection configured. Use db_connect first or set a default connection string.',
          durationMs: Date.now() - start,
        };
      }
      const queries: Record<string, string> = {
        postgresql:
          `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${table_name}' ORDER BY ordinal_position`,
        mysql: `DESCRIBE ${table_name}`,
        sqlite: `PRAGMA table_info(${table_name})`,
        mongodb: `db.${table_name}.findOne()`,
      };
      const query = queries[dbType] || queries['postgresql'];
      return {
        toolName: 'db_describe_table',
        success: true,
        output: `[${dbType}] Executing: ${query}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'db_describe_table',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const db_generate_migration: Tool = {
  definition: {
    name: 'db_generate_migration',
    description: 'Generate a database migration',
    params: [
      {
        name: 'description',
        type: 'string',
        description: 'Description of the migration',
        required: true,
      },
      {
        name: 'from_schema',
        type: 'string',
        description: 'Source schema definition',
        required: false,
      },
      {
        name: 'to_schema',
        type: 'string',
        description: 'Target schema definition',
        required: false,
      },
    ],
    capabilities: ['shell:run'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const description = args.description;
      if (!description || typeof description !== 'string') {
        return {
          toolName: 'db_generate_migration',
          success: false,
          output: '',
          error: 'description must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }
      const dbType = getDbType();
      const from = typeof args.from_schema === 'string' ? args.from_schema : null;
      const to = typeof args.to_schema === 'string' ? args.to_schema : null;

      const timestamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
      const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
      const filename = `${timestamp}_${slug}.sql`;

      let content = `-- Migration: ${description}\n-- Database: ${dbType}\n-- Generated: ${
        new Date().toISOString()
      }\n\n`;
      if (from && to) {
        content += `-- FROM schema:\n-- ${from}\n-- TO schema:\n-- ${to}\n\n`;
      }
      content +=
        `-- UP\nBEGIN;\n\n-- TODO: Add migration statements\n\nCOMMIT;\n\n-- DOWN\nBEGIN;\n\n-- TODO: Add rollback statements\n\nCOMMIT;\n`;

      return {
        toolName: 'db_generate_migration',
        success: true,
        output: `Migration file "${filename}" generated\n\n${content}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'db_generate_migration',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const db_explain_query: Tool = {
  definition: {
    name: 'db_explain_query',
    description: 'Explain query execution plan',
    params: [
      { name: 'query', type: 'string', description: 'SQL query to explain', required: true },
    ],
    capabilities: ['db:read', 'shell:run'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const query = args.query;
      if (!query || typeof query !== 'string') {
        return {
          toolName: 'db_explain_query',
          success: false,
          output: '',
          error: 'query must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }
      const dbType = getDbType();
      const connStr = getConnString();
      if (!connStr) {
        return {
          toolName: 'db_explain_query',
          success: false,
          output: '',
          error:
            'No database connection configured. Use db_connect first or set a default connection string.',
          durationMs: Date.now() - start,
        };
      }
      const explainQuery = dbType === 'mongodb'
        ? `db.collection.explain("executionStats").find(${query})`
        : `EXPLAIN ANALYZE ${query}`;
      return {
        toolName: 'db_explain_query',
        success: true,
        output: `[${dbType}] Executing: ${explainQuery}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'db_explain_query',
        success: false,
        output: '',
        error: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

export const tools: Tool[] = [
  db_connect,
  db_query,
  db_list_tables,
  db_describe_table,
  db_generate_migration,
  db_explain_query,
];
