// Script para adicionar coluna googleId na tabela barbers
import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não encontrada");
  process.exit(1);
}

const conn = await createConnection(url);

try {
  // Verificar se a coluna já existe
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbers' AND COLUMN_NAME = 'googleId'`
  );
  
  if (rows.length > 0) {
    console.log("✅ Coluna googleId já existe na tabela barbers");
  } else {
    await conn.execute(
      `ALTER TABLE barbers ADD COLUMN googleId VARCHAR(128) NULL AFTER passwordHash`
    );
    console.log("✅ Coluna googleId adicionada com sucesso na tabela barbers");
  }
} catch (err) {
  console.error("Erro:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
