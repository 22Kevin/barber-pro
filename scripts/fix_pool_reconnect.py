with open('/home/ubuntu/barber_app/server/db.ts', 'r') as f:
    c = f.read()

# Verificar se já foi corrigido
if 'resetPool' in c:
    print("INFO: reconexao automatica ja configurada")
    exit(0)

# Localizar o bloco do pool
marker = "let _db: ReturnType<typeof drizzle> | null = null;\nlet _pool: Pool | null = null;"
if marker not in c:
    print("ERRO: marcador nao encontrado")
    exit(1)

# Adicionar resetPool antes do getDb
old_pool_section = "let _db: ReturnType<typeof drizzle> | null = null;\nlet _pool: Pool | null = null;\n// Lazily create the drizzle instance so local tooling can run without a DB.\nexport async function getDb() {"
new_pool_section = """let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Reconexão automática: limpa o pool se houver erro de conexão SSL/timeout
function resetPool() {
  if (_pool) {
    _pool.end().catch(() => {});
    _pool = null;
    _db = null;
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {"""

if old_pool_section in c:
    c = c.replace(old_pool_section, new_pool_section, 1)
    print("OK: resetPool adicionado")
else:
    print("ERRO: bloco getDb nao encontrado")
    exit(1)

# Adicionar o listener de erro no pool
old_pool_init = """      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
      _db = drizzle(_pool);"""

new_pool_init = """      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
      // Reconexão automática em erros de conexão SSL/timeout
      _pool.on('error', (err: Error) => {
        console.warn('[Database] Pool error, will reconnect on next request:', err.message);
        resetPool();
      });
      _db = drizzle(_pool);"""

if old_pool_init in c:
    c = c.replace(old_pool_init, new_pool_init, 1)
    print("OK: listener de erro adicionado")
else:
    print("SKIP: bloco pool init nao encontrado (pode ja estar correto)")

with open('/home/ubuntu/barber_app/server/db.ts', 'w') as f:
    f.write(c)
print("Arquivo salvo")
