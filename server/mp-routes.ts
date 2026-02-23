import type { Express } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import * as db from "./db";

function getMpClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return null;
  return new MercadoPagoConfig({ accessToken });
}

async function handlePaymentApproved(paymentId: string) {
  const mpClient = getMpClient();
  if (!mpClient) return;

  try {
    const payment = new Payment(mpClient);
    const paymentData = await payment.get({ id: paymentId });

    if (paymentData.status !== "approved") return;

    const externalRef = paymentData.external_reference;
    if (!externalRef) return;

    const ref = JSON.parse(externalRef) as {
      appointmentId: number;
      clientId: number;
      barberId: number;
      serviceId: number;
      servicePrice: number;
      date: string;
      startTime: string;
    };

    // Cria a venda no sistema como paga via Mercado Pago
    const service = await db.getServiceById(ref.serviceId);
    const serviceName = service?.name ?? "Serviço";
    const price = String(ref.servicePrice);

    await db.createSale(
      {
        clientId: ref.clientId,
        barberId: ref.barberId,
        appointmentId: ref.appointmentId,
        subtotal: price,
        discount: "0",
        total: price,
        paymentMethod: "mercado_pago",
        paymentStatus: "paid",
        mercadoPagoPaymentId: paymentId,
        notes: `Pago via Mercado Pago. ID: ${paymentId}`,
      } as any,
      [
        {
          itemType: "service",
          itemId: ref.serviceId,
          itemName: serviceName,
          quantity: 1,
          unitPrice: price,
          total: price,
        },
      ]
    );

    // Atualiza o status do agendamento para confirmado
    await db.updateAppointment(ref.appointmentId, { status: "confirmed" } as any);

    console.log(`[MP] Pagamento aprovado: appointmentId=${ref.appointmentId}, paymentId=${paymentId}`);
  } catch (err) {
    console.error("[MP] Erro ao processar pagamento aprovado:", err);
  }
}

export function registerMercadoPagoRoutes(app: Express) {
  // Webhook do Mercado Pago — recebe notificações de pagamento
  app.post("/api/mp/webhook", async (req, res) => {
    try {
      const { type, data } = req.body;
      if (type === "payment" && data?.id) {
        await handlePaymentApproved(String(data.id));
      }
      res.sendStatus(200);
    } catch (err) {
      console.error("[MP] Webhook error:", err);
      res.sendStatus(500);
    }
  });

  // Páginas de retorno após o pagamento (o usuário é redirecionado para cá pelo Checkout Pro)
  app.get("/api/mp/success", async (req, res) => {
    const paymentId = req.query.payment_id as string;
    if (paymentId) {
      await handlePaymentApproved(paymentId).catch(console.error);
    }
    // Redireciona para o app via deep link
    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Pagamento confirmado</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#fff;">
          <h1 style="color:#22C55E">✅ Pagamento confirmado!</h1>
          <p>Seu agendamento foi confirmado. Você pode fechar esta janela e voltar ao app.</p>
          <script>
            setTimeout(() => { window.close(); }, 3000);
          </script>
        </body>
      </html>
    `);
  });

  app.get("/api/mp/failure", (_req, res) => {
    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Pagamento não concluído</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#fff;">
          <h1 style="color:#EF4444">❌ Pagamento não concluído</h1>
          <p>Houve um problema com o pagamento. Você pode fechar esta janela e tentar novamente no app.</p>
          <script>
            setTimeout(() => { window.close(); }, 3000);
          </script>
        </body>
      </html>
    `);
  });

  app.get("/api/mp/pending", (_req, res) => {
    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Pagamento em análise</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#fff;">
          <h1 style="color:#F59E0B">⏳ Pagamento em análise</h1>
          <p>Seu pagamento está sendo processado. Você receberá uma confirmação em breve. Pode fechar esta janela.</p>
          <script>
            setTimeout(() => { window.close(); }, 3000);
          </script>
        </body>
      </html>
    `);
  });
}
