import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { tools } from '../../mod.ts';
import type { PluginContext, ToolContext } from '../../types.ts';

// Mock PluginContext
const mockContext: PluginContext & ToolContext = {
  pluginId: 'cortex-plugin-database-explorer',
  pluginDir: '/tmp/plugins/cortex-plugin-database-explorer',
  state: {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    list: async () => ({}),
  },
  config: {
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
  },
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  host: {
    registerTool: () => {},
    unregisterTool: () => {},
  },
  sessionId: 'test-session',
  workingDir: '/tmp',
  agentId: 'test-agent',
  workspaceDir: '/tmp',
};

function findTool(name: string) {
  const tool = tools.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

Deno.test('tools array — exports all tools', () => {
  assertEquals(tools.length, 6);
  assertEquals(tools[0].definition.name, 'db_connect');
  assertEquals(tools[1].definition.name, 'db_query');
  assertEquals(tools[2].definition.name, 'db_list_tables');
  assertEquals(tools[3].definition.name, 'db_describe_table');
  assertEquals(tools[4].definition.name, 'db_generate_migration');
  assertEquals(tools[5].definition.name, 'db_explain_query');
});

Deno.test('db_connect — rejects empty connection_string', async () => {
  const tool = findTool('db_connect');
  const result = await tool.execute({ 'connection_string': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('db_query — rejects empty query', async () => {
  const tool = findTool('db_query');
  const result = await tool.execute({ 'query': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('db_list_tables — tool is defined with name and description', () => {
  const tool = findTool('db_list_tables');
  assertEquals(typeof tool.definition.description, 'string');
  assertEquals(tool.definition.description.length > 0, true);
});

Deno.test('db_describe_table — rejects empty table_name', async () => {
  const tool = findTool('db_describe_table');
  const result = await tool.execute({ 'table_name': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('db_generate_migration — rejects empty description', async () => {
  const tool = findTool('db_generate_migration');
  const result = await tool.execute({ 'description': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('db_explain_query — rejects empty query', async () => {
  const tool = findTool('db_explain_query');
  const result = await tool.execute({ 'query': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('all tools return durationMs', async () => {
  for (const tool of tools) {
    const args: Record<string, unknown> = {};
    const result = await tool.execute(args, mockContext);
    assertEquals(typeof result.durationMs, 'number');
    assertEquals(result.durationMs >= 0, true);
  }
});
