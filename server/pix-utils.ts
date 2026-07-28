// server/pix-utils.ts
//
// Geração de código Pix "copia e cola" (padrão EMV/BR Code do Banco Central),
// usando a chave Pix própria de cada barbearia — SEM passar pelo Asaas, sem
// taxa por transação.
//
// Usado tanto pelo app mobile (server/routers.ts) quanto pelo painel web
// (server/admin-routes.ts) — mesma função, mesmo resultado nos dois lugares,
// conforme decidido: toda mudança de pagamento vale pros dois painéis.

export function generatePixPayload(params: {
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId: string;
  description: string;
  pixKey?: string;
}): string {
  const { merchantName, merchantCity, amount, txId } = params;
  const pixKey = params.pixKey || "barber-pro@demo.pix";
  const gui = "BR.GOV.BCB.PIX";
  const pixKeyField = `0114${pixKey.length.toString().padStart(2, "0")}${pixKey}`;
  const additionalData = `0503${txId.substring(0, 25).padEnd(25, "0")}`;
  const merchantAccountInfo = `0014${gui.length.toString().padStart(2, "0")}${gui}${pixKeyField}${additionalData}`;
  const amountStr = amount.toFixed(2);
  const fields = [
    `000201`,
    `010212`,
    `26${merchantAccountInfo.length.toString().padStart(2, "0")}${merchantAccountInfo}`,
    `52040000`,
    `5303986`,
    `54${amountStr.length.toString().padStart(2, "0")}${amountStr}`,
    `5802BR`,
    `59${merchantName.substring(0, 25).length.toString().padStart(2, "0")}${merchantName.substring(0, 25)}`,
    `60${merchantCity.substring(0, 15).length.toString().padStart(2, "0")}${merchantCity.substring(0, 15)}`,
    `6207`,
  ];
  const payload = fields.join("") + "6304";
  // CRC16-CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}
