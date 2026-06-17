# cortex-plugin-database-explorer

Connect to PostgreSQL, MySQL, SQLite, and MongoDB databases.

## Installation

```bash
cortex plugin install marketplace:cortex-plugin-database-explorer
cortex plugin install github:CortexPrism/cortex-plugin-database-explorer
cortex plugin install ./manifest.json
```

## Tools

### db_connect

Connect to a database.

- `connection_string` (string, required) — Connection string (stored as secret)
- `db_type` (string, required) — postgresql, mysql, sqlite, mongodb

### db_query

Execute a database query.

- `query` (string, required) — SQL query or MongoDB aggregation
- `params` (string, optional) — JSON array of query parameters
- `limit` (number, default: 100) — Maximum rows to return

### db_list_tables

List all tables/collections. No parameters.

### db_describe_table

Describe a table or collection schema.

- `table_name` (string, required) — Table or collection name

### db_generate_migration

Generate a database migration.

- `description` (string, required) — Migration description
- `from_schema` (string, optional) — Source schema
- `to_schema` (string, optional) — Target schema

### db_explain_query

Explain query execution plan.

- `query` (string, required) — SQL query to explain

## Configuration

Set default database type and connection string under the "Connection" section in plugin settings.

## Development

```bash
deno cache mod.ts
deno task test
deno fmt
deno lint
```

## License

MIT
