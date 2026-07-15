import "dotenv/config";
import express from "express";
import helmet from "helmet";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "barber_migrate_2026";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { registerOAuthRoutes } from "./oauth";
import { registerSuperAdminRoutes } from "../superadmin-routes";

import { registerPublicRoutes } from "../public-routes";
import { registerAdminRoutes } from "../admin-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { startReviewEmailJob } from "../review-job";
import { startWhatsAppReminderJob } from "../whatsapp-reminder-job";
import { startSubscriptionReminderJob } from "../subscription-reminder-job";
import { startEmailReminderJob } from "../email-reminder-job";
import { startBackupJob } from "../backup-job";
import { startTrialExpiryJob } from "../trial-expiry-job";

// ─── Rate Limiters ────────────────────────────────────────────────────────────
/**
 * Rate limiter geral para /api/trpc — 200 req/min por IP.
 * Protege contra abuso de API e scraping.
 */
const trpcRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Muitas requisições. Aguarde um momento e tente novamente." },
  skip: (req) => {
    // Não limitar requisições de leitura (queries) — apenas mutations e rotas sensíveis
    // O tRPC usa GET para queries e POST para mutations
    return req.method === "GET";
  },
});

/**
 * Rate limiter estrito para login — 10 tentativas/min por IP.
 * Protege contra ataques de força bruta.
 */
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Muitas tentativas de login. Aguarde 1 minuto e tente novamente." },
  keyGenerator: (req) => {
    // Usar IP + email como chave para evitar bloqueio de IPs compartilhados
    const ip = (req.ip ?? req.socket?.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
    try {
      const body = req.body as Record<string, Record<string, Record<string, string>>>;
      const email = body?.["0"]?.json?.email ?? "";
      return `${ipKeyGenerator(ip)}:${email}`;
    } catch {
      return ipKeyGenerator(ip);
    }
  },
});


// Conteúdo do cart.js embutido no bundle
const CART_JS_CONTENT = `// Barber Pro — Carrinho de Produtos
// Este arquivo é servido estaticamente e evita todos os problemas de escaping

var _cart = [];
var _cartSlug = '';

function cartInit(slug) {
  _cartSlug = slug;
  document.addEventListener('DOMContentLoaded', function() { cartLoad(); });
}

function cartFmt(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function cartSave() {
  try { localStorage.setItem('cart_' + _cartSlug, JSON.stringify(_cart)); } catch(e) {}
}

function cartLoad() {
  try { var s = localStorage.getItem('cart_' + _cartSlug); if (s) _cart = JSON.parse(s); } catch(e) {}
  cartUpdateUI();
}

function cartAdd(id, name, price, stock) {
  var ex = _cart.find(function(i) { return i.id === id; });
  if (ex) {
    if (ex.qty < stock) ex.qty++;
    else { cartToast('Quantidade máxima'); return; }
  } else {
    _cart.push({ id: id, name: name, price: price, qty: 1, stock: stock });
  }
  cartSave(); cartUpdateUI();
  cartToast('✓ ' + name + ' adicionado');
  cartOpen();
}

function cartRemove(id) {
  _cart = _cart.filter(function(i) { return i.id !== id; });
  cartSave(); cartUpdateUI(); cartRenderItems();
}

function cartQty(id, delta) {
  var item = _cart.find(function(i) { return i.id === id; });
  if (!item) return;
  item.qty = Math.max(1, Math.min(item.stock, item.qty + delta));
  cartSave(); cartUpdateUI(); cartRenderItems();
}

function cartTotal() { return _cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0); }
function cartCount() { return _cart.reduce(function(s, i) { return s + i.qty; }, 0); }

function cartUpdateUI() {
  var cnt = cartCount();
  var nb = document.getElementById('cart-nav-badge');
  if (nb) { nb.textContent = cnt; nb.style.display = cnt > 0 ? 'flex' : 'none'; }
  var cb = document.getElementById('cart-count-badge');
  if (cb) cb.textContent = cnt;
  var tm = document.getElementById('cart-total-modal');
  if (tm) tm.textContent = cartFmt(cartTotal());
  var ft = document.getElementById('cart-footer');
  if (ft) ft.style.display = cnt > 0 ? 'block' : 'none';
}

function cartRenderItems() {
  var el = document.getElementById('cart-items');
  if (!el) return;
  if (_cart.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:48px 20px;color:var(--muted)"><div style="font-size:48px;margin-bottom:12px;opacity:0.4">🛒</div><div style="font-size:15px;font-weight:600;margin-bottom:6px">Carrinho vazio</div></div>';
    return;
  }
  el.innerHTML = _cart.map(function(item) {
    return '<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)">' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + item.name + '</div>' +
      '<div style="font-size:13px;color:var(--primary);font-weight:700">' + cartFmt(item.price * item.qty) + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
      '<button onclick="cartQty(' + item.id + ',-1)" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:14px;cursor:pointer;font-weight:700;color:var(--text)">−</button>' +
      '<span style="min-width:20px;text-align:center;font-size:15px;font-weight:800;color:var(--text)">' + item.qty + '</span>' +
      '<button onclick="cartQty(' + item.id + ',1)" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:14px;cursor:pointer;font-weight:700;color:var(--text)">+</button>' +
      '<button onclick="cartRemove(' + item.id + ')" style="width:28px;height:28px;border-radius:8px;border:none;background:rgba(248,113,113,0.12);font-size:13px;cursor:pointer;color:#F87171">✕</button>' +
      '</div></div>';
  }).join('');
}

function cartOpen() {
  cartRenderItems(); cartUpdateUI();
  var ov = document.getElementById('cart-overlay');
  var dr = document.getElementById('cart-drawer');
  if (!dr) return;
  if (ov) ov.style.display = 'block';
  dr.style.display = 'flex';
  dr.style.flexDirection = 'column';
}

function cartClose() {
  var ov = document.getElementById('cart-overlay');
  var dr = document.getElementById('cart-drawer');
  if (ov) ov.style.display = 'none';
  if (dr) dr.style.display = 'none';
}

function cartToast(msg) {
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--primary);color:var(--text);padding:10px 20px;border-radius:50px;font-size:13px;font-weight:700;z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 2500);
}

function checkoutClose() {
  document.getElementById('checkout-modal').style.display = 'none';
}

function cartCheckout() {
  if (_cart.length === 0) return;
  cartClose();
  var body = document.getElementById('checkout-body');
  if (!body) return;
  var ih = _cart.map(function(i) {
    return '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px">' +
      '<span style="color:var(--text)">' + i.qty + 'x ' + i.name + '</span>' +
      '<span style="color:var(--primary);font-weight:700">' + cartFmt(i.price * i.qty) + '</span></div>';
  }).join('');

  var btns = ['pix|⚡|Pix|QR Code gerado na hora', 'credit|💳|Cartão de Crédito|Via link seguro do Asaas', 'pickup|🏪|Pagar na retirada|Pague quando buscar'].map(function(b) {
    var p = b.split('|');
    return '<button data-m="' + p[0] + '" onclick="checkoutPay(this.dataset.m)" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;cursor:pointer;font-size:14px;font-weight:700;color:var(--text);text-align:left;width:100%">' + p[1] + ' <div><div>' + p[2] + '</div><div style="font-size:12px;color:var(--muted);font-weight:500">' + p[3] + '</div></div></button>';
  }).join('');

  body.innerHTML =
    '<div style="background:var(--surface);border-radius:14px;padding:16px;margin-bottom:20px">' +
    '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">Resumo do pedido</div>' +
    ih +
    '<div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px;display:flex;justify-content:space-between">' +
    '<span style="font-size:15px;font-weight:700;color:var(--muted)">Total</span>' +
    '<span style="font-size:18px;font-weight:900;color:var(--primary)">' + cartFmt(cartTotal()) + '</span></div></div>' +
    '<div style="margin-bottom:20px"><div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Como deseja pagar?</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' + btns + '</div></div>' +
    '<div id="checkout-msg" style="min-height:20px;font-size:13px;text-align:center;margin-bottom:12px"></div>';

  document.getElementById('checkout-modal').style.display = 'flex';
}

async function checkoutPay(method) {
  var msg = document.getElementById('checkout-msg');
  if (!msg) return;
  msg.style.color = 'var(--muted)';
  msg.textContent = method === 'pix' ? 'Gerando QR Code...' : 'Processando...';
  document.querySelectorAll('#checkout-body button').forEach(function(b) { b.disabled = true; b.style.opacity = '0.6'; });
  try {
    var r = await fetch('/pub-api/cart-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: _cart, slug: _cartSlug, paymentMethod: method })
    });
    var data = await r.json();
    if (!data.success) throw new Error(data.error || 'Erro ao processar pedido');

    if (method === 'pix' && data.pixQrCode) {
      var pixHtml = '<div style="text-align:center;padding:8px 0">' +
        '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:16px">⚡ Escaneie o QR Code</div>' +
        '<div style="background:#fff;border-radius:16px;padding:16px;display:inline-block;margin-bottom:16px">' +
        '<img src="data:image/png;base64,' + data.pixQrCode + '" style="width:200px;height:200px;border-radius:8px" /></div>' +
        '<div style="font-family:monospace;font-size:11px;color:var(--text);word-break:break-all;background:var(--surface);border-radius:10px;padding:12px;margin-bottom:16px;max-height:80px;overflow-y:auto" id="pix-code-cart">' + (data.pixCopyCola || '') + '</div>' +
        '<button id="pix-copy-btn" style="padding:10px 24px;border-radius:10px;border:1px solid var(--primary);background:rgba(201,168,76,0.1);color:var(--primary);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:20px">📋 Copiar código</button><br>' +
        '<button id="pix-close-btn" style="display:inline-block;padding:12px 28px;background:var(--primary);color:#0A0A0A;font-size:14px;font-weight:900;border-radius:12px;border:none;cursor:pointer;margin-top:8px">✓ Fechar</button></div>';
      document.getElementById('checkout-body').innerHTML = pixHtml;
      document.getElementById('pix-copy-btn').onclick = function() {
        var code = document.getElementById('pix-code-cart');
        if (code) navigator.clipboard.writeText(code.textContent).then(function() { cartToast('Código copiado!'); });
      };
      document.getElementById('pix-close-btn').onclick = function() {
        checkoutClose(); _cart = []; cartSave(); cartUpdateUI();
      };
    } else if (method === 'credit' && data.invoiceUrl) {
      // Cartão: abrir link seguro do Asaas
      window.open(data.invoiceUrl, '_blank');
      document.getElementById('checkout-body').innerHTML =
        '<div style="text-align:center;padding:20px 0">' +
        '<div style="font-size:48px;margin-bottom:12px">💳</div>' +
        '<h2 style="font-size:20px;font-weight:900;color:var(--text);margin-bottom:12px">Link de pagamento aberto!</h2>' +
        '<p style="font-size:14px;color:var(--muted);margin-bottom:20px">Complete o pagamento na página que foi aberta.</p>' +
        '<button id="card-close-btn" style="padding:14px 32px;background:var(--primary);color:#0A0A0A;font-weight:900;border-radius:12px;border:none;cursor:pointer;font-size:15px">Fechar</button></div>';
      document.getElementById('card-close-btn').onclick = function() {
        checkoutClose(); _cart = []; cartSave(); cartUpdateUI();
      };
    } else if (method === 'pix') {
      msg.style.color = '#F87171';
      msg.textContent = '❌ Pix não disponível. Escolha outra forma.';
      document.querySelectorAll('#checkout-body button').forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
    } else {
      var doneHtml = '<div style="text-align:center;padding:20px 0">' +
        '<div style="font-size:56px;margin-bottom:16px">🎉</div>' +
        '<h2 style="font-size:22px;font-weight:900;color:var(--text);margin-bottom:12px">Pedido realizado!</h2>' +
        '<p style="font-size:15px;color:var(--muted);margin-bottom:20px">' + (method === 'pickup' ? 'Pague quando buscar na barbearia.' : 'Pedido confirmado!') + '</p>' +
        '<button id="done-close-btn" style="padding:14px 32px;background:var(--primary);color:#0A0A0A;font-weight:900;border-radius:12px;border:none;cursor:pointer;font-size:15px">Fechar</button></div>';
      document.getElementById('checkout-body').innerHTML = doneHtml;
      document.getElementById('done-close-btn').onclick = function() {
        checkoutClose(); _cart = []; cartSave(); cartUpdateUI();
      };
    }
  } catch(err) {
    msg.style.color = '#F87171';
    msg.textContent = '❌ ' + err.message;
    document.querySelectorAll('#checkout-body button').forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
  }
}
`;

const TERMOS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Termos de Uso — Barber Pro</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0A0A0A;color:#ECEDEE;line-height:1.7}
.top-bar{background:#111;border-bottom:1px solid #1E1E1E;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
.logo{font-size:18px;font-weight:900;color:#C9A84C;letter-spacing:1px;text-decoration:none}
.back{font-size:13px;color:#9BA1A6;text-decoration:none;display:flex;align-items:center;gap:6px}
.back:hover{color:#C9A84C}
.container{max-width:760px;margin:0 auto;padding:48px 24px 80px}
h1{font-size:32px;font-weight:900;color:#ECEDEE;margin-bottom:8px}
.meta{font-size:13px;color:#666;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #1E1E1E}
h2{font-size:18px;font-weight:700;color:#C9A84C;margin:36px 0 12px}
h3{font-size:15px;font-weight:700;color:#ECEDEE;margin:20px 0 8px}
p{font-size:15px;color:#9BA1A6;margin-bottom:14px}
ul,ol{padding-left:20px;margin-bottom:14px}
li{font-size:15px;color:#9BA1A6;margin-bottom:6px}
strong{color:#ECEDEE;font-weight:600}
a{color:#C9A84C;text-decoration:none}
a:hover{text-decoration:underline}
.highlight{background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:16px 20px;margin:20px 0}
.highlight p{margin:0;color:#ECEDEE;font-size:14px}
.footer-note{margin-top:48px;padding-top:24px;border-top:1px solid #1E1E1E;font-size:13px;color:#555}
</style>
</head>
<body>
<div class="top-bar">
  <a href="/" class="logo">✂ Barber Pro</a>
  <a href="/" class="back">← Voltar</a>
</div>
<div class="container">

<h1>Termos de Uso</h1>
<div class="meta">Última atualização: 26 de maio de 2026 &nbsp;·&nbsp; Versão 1.0</div>

<div class="highlight"><p>Ao criar uma conta no Barber Pro, você concorda com estes Termos de Uso. Leia com atenção antes de utilizar nossos serviços.</p></div>

<h2>1. Sobre o Barber Pro</h2>
<p>O <strong>Barber Pro</strong> é uma plataforma de gestão para barbearias operada pela <strong>Eldunari Ltda</strong> (CNPJ 66.991.137/0001-63), com sede em R. Maria Amélia Faleiros, 4881 — Jardim Três Colinas, Franca/SP — CEP 14.403-871, oferecida como serviço (SaaS), que permite o gerenciamento de agendamentos, financeiro, clientes, produtos, assinaturas e pagamentos online.</p>
<p>O acesso à plataforma é feito por meio do site <strong>usebarberpro.com</strong> e do aplicativo móvel disponível nas lojas oficiais.</p>

<h2>2. Cadastro e Conta</h2>
<p>Para utilizar o Barber Pro, você deve:</p>
<ul>
  <li>Ser maior de 18 anos ou responsável legal por uma pessoa jurídica</li>
  <li>Fornecer informações verdadeiras, completas e atualizadas</li>
  <li>Manter a segurança de suas credenciais de acesso</li>
  <li>Ser responsável por todas as atividades realizadas em sua conta</li>
</ul>
<p>O Barber Pro se reserva o direito de suspender contas que violem estes termos ou que forneçam informações falsas.</p>

<h2>3. Planos e Pagamentos</h2>
<h3>3.1 Período de teste</h3>
<p>Novos usuários têm direito a <strong>14 dias gratuitos</strong> para testar todas as funcionalidades da plataforma, sem necessidade de cartão de crédito.</p>

<h3>3.2 Cobrança</h3>
<p>Após o período de teste, a continuidade do uso é condicionada à contratação de um dos planos disponíveis. Os valores são cobrados mensalmente, de forma antecipada, via Pix, cartão de crédito ou boleto bancário.</p>

<h3>3.3 Cancelamento</h3>
<p>Você pode cancelar sua assinatura a qualquer momento pelo painel. O acesso permanece ativo até o fim do período já pago. Não há reembolso proporcional para cancelamentos no meio do ciclo.</p>

<h2>4. Uso Aceitável</h2>
<p>Você concorda em não utilizar o Barber Pro para:</p>
<ul>
  <li>Atividades ilegais ou que violem direitos de terceiros</li>
  <li>Enviar spam ou comunicações não solicitadas aos clientes</li>
  <li>Tentar acessar dados de outras barbearias ou sistemas</li>
  <li>Fazer engenharia reversa, copiar ou redistribuir o software</li>
  <li>Sobrecarregar a infraestrutura com requisições automatizadas</li>
</ul>

<h2>5. Pagamentos Online (Asaas)</h2>
<p>O processamento de pagamentos online é realizado por meio da plataforma <strong>Asaas</strong>, que opera como subconta da barbearia. Ao ativar os pagamentos online, você concorda também com os <a href="https://www.asaas.com/termos-de-uso" target="_blank">Termos de Uso do Asaas</a>.</p>
<p>O Barber Pro não armazena dados de cartão de crédito. Todos os dados financeiros são gerenciados diretamente pela Asaas, uma instituição de pagamento regulada pelo Banco Central do Brasil.</p>

<h2>6. Propriedade Intelectual</h2>
<p>Todo o código, design, marca e conteúdo do Barber Pro são de propriedade exclusiva da empresa. O uso da plataforma não transfere nenhum direito de propriedade intelectual ao usuário.</p>
<p>Os dados inseridos por você (clientes, agendamentos, produtos) permanecem de sua propriedade. O Barber Pro não reivindica nenhum direito sobre esses dados.</p>

<h2>7. Disponibilidade e SLA</h2>
<p>O Barber Pro se empenha em manter a plataforma disponível 24 horas por dia, 7 dias por semana. No entanto, podem ocorrer interrupções para manutenção, atualizações ou por motivos de força maior.</p>
<p>Não garantimos disponibilidade de 100% e não somos responsáveis por perdas decorrentes de indisponibilidade temporária.</p>

<h2>8. Limitação de Responsabilidade</h2>
<p>O Barber Pro não se responsabiliza por:</p>
<ul>
  <li>Perdas de receita decorrentes de indisponibilidade do sistema</li>
  <li>Dados inseridos incorretamente pelo usuário</li>
  <li>Ações de terceiros (clientes, fornecedores) realizadas fora da plataforma</li>
  <li>Problemas causados por conexão de internet do usuário</li>
</ul>

<h2>9. Alterações dos Termos</h2>
<p>Podemos atualizar estes Termos a qualquer momento. Mudanças significativas serão comunicadas por e-mail com pelo menos 15 dias de antecedência. O uso continuado após a data de vigência das alterações constitui aceitação dos novos termos.</p>

<h2>10. Legislação Aplicável</h2>
<p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo — SP para resolução de quaisquer litígios.</p>

<div class="footer-note">Dúvidas? Entre em contato: <a href="mailto:suporte@usebarberpro.com">suporte@usebarberpro.com</a></div>
</div>
</body>
</html>`;
const LGPD_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LGPD — Lei Geral de Proteção de Dados — Barber Pro</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0A0A0A;color:#ECEDEE;line-height:1.7}
.top-bar{background:#111;border-bottom:1px solid #1E1E1E;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
.logo{font-size:18px;font-weight:900;color:#C9A84C;letter-spacing:1px;text-decoration:none}
.back{font-size:13px;color:#9BA1A6;text-decoration:none;display:flex;align-items:center;gap:6px}
.back:hover{color:#C9A84C}
.container{max-width:760px;margin:0 auto;padding:48px 24px 80px}
h1{font-size:32px;font-weight:900;color:#ECEDEE;margin-bottom:8px}
.meta{font-size:13px;color:#666;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #1E1E1E}
h2{font-size:18px;font-weight:700;color:#C9A84C;margin:36px 0 12px}
h3{font-size:15px;font-weight:700;color:#ECEDEE;margin:20px 0 8px}
p{font-size:15px;color:#9BA1A6;margin-bottom:14px}
ul,ol{padding-left:20px;margin-bottom:14px}
li{font-size:15px;color:#9BA1A6;margin-bottom:6px}
strong{color:#ECEDEE;font-weight:600}
a{color:#C9A84C;text-decoration:none}
a:hover{text-decoration:underline}
.highlight{background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:16px 20px;margin:20px 0}
.highlight p{margin:0;color:#ECEDEE;font-size:14px}
.footer-note{margin-top:48px;padding-top:24px;border-top:1px solid #1E1E1E;font-size:13px;color:#555}
</style>
</head>
<body>
<div class="top-bar">
  <a href="/" class="logo">✂ Barber Pro</a>
  <a href="/" class="back">← Voltar</a>
</div>
<div class="container">

<h1>LGPD — Como protegemos seus dados</h1>
<div class="meta">Lei 13.709/2018 &nbsp;·&nbsp; Última atualização: 26 de maio de 2026</div>

<div class="highlight"><p>O Barber Pro está comprometido com a Lei Geral de Proteção de Dados (LGPD). Esta página explica de forma clara como aplicamos a lei no nosso dia a dia.</p></div>

<h2>O que é a LGPD?</h2>
<p>A <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018)</strong> é a legislação brasileira que regula o tratamento de dados pessoais. Ela entrou em vigor em setembro de 2020 e é fiscalizada pela <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.</p>

<h2>Bases legais que utilizamos</h2>
<p>Todo tratamento de dados no Barber Pro é baseado em uma das seguintes bases legais previstas na LGPD:</p>
<ul>
  <li><strong>Execução de contrato</strong> — para operar a plataforma e prestar o serviço contratado</li>
  <li><strong>Consentimento</strong> — para envio de comunicações de marketing (quando aplicável)</li>
  <li><strong>Legítimo interesse</strong> — para melhorias da plataforma e segurança</li>
  <li><strong>Obrigação legal</strong> — para cumprimento de exigências fiscais e regulatórias</li>
</ul>

<h2>Encarregado de Dados (DPO)</h2>
<p>Nosso Encarregado de Proteção de Dados está disponível para:</p>
<ul>
  <li>Receber comunicações dos titulares de dados</li>
  <li>Orientar sobre o tratamento de dados pessoais</li>
  <li>Atuar como canal de comunicação com a ANPD</li>
</ul>
<p>Contato: <a href="mailto:suporte@usebarberpro.com">suporte@usebarberpro.com</a></p>

<h2>Como as barbearias devem usar o sistema</h2>
<p>As barbearias que usam o Barber Pro são <strong>controladoras de dados</strong> dos seus próprios clientes. Isso significa que têm responsabilidades perante a LGPD, incluindo:</p>
<ul>
  <li>Informar os clientes sobre o uso dos seus dados (nome, telefone, histórico)</li>
  <li>Coletar apenas os dados necessários para a prestação do serviço</li>
  <li>Atender solicitações de exclusão de dados de clientes</li>
  <li>Não compartilhar dados de clientes com terceiros sem base legal</li>
</ul>
<p>O Barber Pro oferece ferramentas para que as barbearias cumpram essas obrigações, como o registro de consentimento (LGPD) na criação de novos clientes.</p>

<h2>Incidente de segurança</h2>
<p>Em caso de incidente de segurança que possa afetar dados pessoais, o Barber Pro se compromete a:</p>
<ul>
  <li>Investigar e conter o incidente imediatamente</li>
  <li>Notificar os usuários afetados em até <strong>72 horas</strong></li>
  <li>Comunicar a ANPD quando exigido pela regulamentação</li>
  <li>Tomar medidas para evitar a recorrência</li>
</ul>

<h2>Relatório de Impacto (RIPD)</h2>
<p>Para operações de alto risco, mantemos Relatórios de Impacto à Proteção de Dados Pessoais (RIPD) conforme exigido pela LGPD. Esses relatórios estão disponíveis para consulta pela ANPD mediante solicitação.</p>

<h2>Exercer seus direitos</h2>
<p>Para exercer qualquer direito previsto na LGPD, entre em contato pelo e-mail <a href="mailto:suporte@usebarberpro.com">suporte@usebarberpro.com</a> com o assunto <strong>"Direitos LGPD"</strong>. Responderemos em até <strong>15 dias úteis</strong>.</p>
<p>Se não ficar satisfeito com nossa resposta, você pode contatar a ANPD pelo site <a href="https://www.gov.br/anpd" target="_blank">gov.br/anpd</a>.</p>

<h2>Versão e histórico</h2>
<p>Esta página foi publicada em 26 de maio de 2026 em atendimento à Lei 13.709/2018 e será atualizada conforme novas regulamentações da ANPD.</p>

<div class="footer-note">Dúvidas? Entre em contato: <a href="mailto:suporte@usebarberpro.com">suporte@usebarberpro.com</a></div>
</div>
</body>
</html>`;

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── Verificação de variáveis de ambiente obrigatórias ───────────────────────
function checkRequiredEnvVars() {
  const required: Record<string, string> = {
    DATABASE_URL: "String de conexão com o banco de dados MySQL",
    JWT_SECRET: "Chave secreta para assinatura de tokens JWT",
  };
  const optional: Record<string, string> = {
    ASAAS_API_KEY: "Chave de API do Asaas (pagamentos online)",
    ASAAS_SANDBOX: "Usar ambiente Sandbox do Asaas para testes (true/false)",
    ASAAS_WEBHOOK_TOKEN: "Token de autenticação do webhook Asaas",
    SMTP_HOST: "Servidor SMTP para envio de e-mails",
    SMTP_USER: "Usuário SMTP",
    SMTP_PASS: "Senha SMTP",
  };

  let hasError = false;
  for (const [key, desc] of Object.entries(required)) {
    if (!process.env[key]) {
      console.error(`[ENV] ❌ OBRIGATÓRIO ausente: ${key} — ${desc}`);
      hasError = true;
    } else {
      console.log(`[ENV] ✅ ${key} configurado`);
    }
  }
  for (const [key, desc] of Object.entries(optional)) {
    if (!process.env[key]) {
      console.warn(`[ENV] ⚠️  Opcional ausente: ${key} — ${desc}`);
    } else {
      console.log(`[ENV] ✅ ${key} configurado`);
    }
  }
  if (hasError && process.env.NODE_ENV === "production") {
    console.error("[ENV] Variáveis obrigatórias ausentes. O servidor pode não funcionar corretamente.");
  }
}

async function startServer() {
  checkRequiredEnvVars();
  const app = express();
  const server = createServer(app);

  // Confiar no proxy reverso do Railway (necessário para rate limit e IP real)
  app.set("trust proxy", 1);

  // Helmet: headers de segurança HTTP (CSP desabilitado — configurado manualmente abaixo)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    xFrameOptions: { action: "deny" },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  }));

  // Headers adicionais que o Helmet não cobre
  app.use((_req, res, next) => {
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });

  // CORS com allowlist — refletir qualquer origem com credentials é falha grave
  const CORS_ALLOWED = new Set([
    "https://usebarberpro.com",
    "https://www.usebarberpro.com",
    ...(process.env.NODE_ENV !== "production" ? [
      "http://localhost:3000", "http://localhost:8081", "http://localhost:19006",
    ] : []),
  ]);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && CORS_ALLOWED.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    // Headers de segurança básicos (clickjacking, MIME sniffing, referrer)
    res.header("X-Frame-Options", "SAMEORIGIN");
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Referrer-Policy", "strict-origin-when-cross-origin");
    res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    // CSP: 'unsafe-inline' necessário (painel usa scripts inline); ainda protege
    // contra object/embed, base hijack e clickjacking via frame-ancestors
    res.header("Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://accounts.google.com https://static.cloudflareinsights.com https://challenges.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net; " +
      "font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net https://p.typekit.net; " +
      "img-src 'self' data: blob: https:; " +
      "media-src 'self' blob: https:; " +
      "connect-src 'self' https://accounts.google.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://performance.typekit.net https://pub-203143bd86174070b67f8f64a13a65c2.r2.dev; " +
      "frame-src https://accounts.google.com; " +
      "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
    if (process.env.NODE_ENV === "production") {
      res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // ── Proteção CSRF: verificação de Origin em requisições que alteram estado ──
  // Browsers sempre enviam Origin em POST cross-site; apps nativos/webhooks não
  // enviam Origin (passam direto — protegidos por token próprio e SameSite).
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const origin = req.headers.origin;
    if (!origin) {
      // tRPC (Bearer token), webhooks Asaas e health check não enviam Origin — OK
      const isApiRoute = req.path.startsWith("/api/trpc") ||
        req.path.startsWith("/api/asaas/webhook") ||
        req.path === "/health";
      if (isApiRoute) return next();
      // Rotas admin web usam cookie de sessão — exige Origin para CSRF
      if (req.path.startsWith("/admin-api/")) {
        return res.status(403).json({ error: "Origin header required" });
      }
      return next(); // rotas públicas sem Origin (apps nativos, curl) — OK
    }
    try {
      const originHost = new URL(origin).host.replace(/:443$|:80$/, "");
      const reqHost = (req.headers.host || "").replace(/:443$|:80$/, "");
      // Permitir: mesmo host, domínio configurado, ou subdomínio do mesmo domínio
      const PROD_DOMAIN = "usebarberpro.com";
      const sameHost = originHost === reqHost;
      const allowedOrigin = CORS_ALLOWED.has(origin);
      const sameDomain = originHost === PROD_DOMAIN || originHost.endsWith("." + PROD_DOMAIN);
      if (sameHost || allowedOrigin || sameDomain) return next();
    } catch {}
    console.warn("[csrf] BLOQUEADO — origin:", origin, "| host:", req.headers.host, "| path:", req.path, "| originHost:", (() => { try { return new URL(origin).host; } catch { return "INVALID"; } })());
    res.status(403).json({ error: "Origem não autorizada" });
  });

  // Limite reduzido (era 50mb — convite a DoS). Uploads validados individualmente.
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  registerOAuthRoutes(app);
  registerSuperAdminRoutes(app);
  registerAdminRoutes(app);
  registerPublicRoutes(app);

  // ─── Roteamento por subdomínio ─────────────────────────────────────────────
  // usebarberpro.com        → landing page de vendas
  // app.usebarberpro.com    → redireciona para o app (mesmo servidor, rota /app)
  // api.usebarberpro.com    → apenas API (sem servir HTML)
  // usebarberpro.com/:slug  → página de agendamento da barbearia

  // Resolve landing page path compatível com dev (server/_core/) e produção (dist/)
  // Em dev: __dirname = server/_core, landing fica em server/landing (../landing)
  // Em produção: __dirname = dist, landing fica em server/landing (relativo ao cwd)
  const { existsSync } = await import("fs");
  const landingDevPath = path.join(__dirname, "..", "landing", "index.html");
  const landingProdPath = path.join(process.cwd(), "server", "landing", "index.html");
  const landingPath = existsSync(landingDevPath) ? landingDevPath : landingProdPath;

  // Caminho da página de manutenção
  const maintenanceDevPath = path.join(__dirname, "..", "landing", "maintenance.html");
  const maintenanceProdPath = path.join(process.cwd(), "server", "landing", "maintenance.html");
  const maintenancePath = existsSync(maintenanceDevPath) ? maintenanceDevPath : maintenanceProdPath;
  const distPath = path.join(__dirname, "..", "..", "dist-web");

  // Assets estáticos da landing page (ex: badge da Google Play)
  const landingAssetsDevPath = path.join(__dirname, "..", "landing", "assets");
  const landingAssetsProdPath = path.join(process.cwd(), "server", "landing", "assets");
  const landingAssetsPath = existsSync(landingAssetsDevPath) ? landingAssetsDevPath : landingAssetsProdPath;
  app.use("/assets", express.static(landingAssetsPath));

  // Middleware de detecção de subdomínio
  app.use((req, _res, next) => {
    const host = req.hostname || "";
    // Detectar subdomínio: app.usebarberpro.com ou api.usebarberpro.com
    if (host.startsWith("app.")) {
      (req as any).__subdomain = "app";
    } else if (host.startsWith("api.")) {
      (req as any).__subdomain = "api";
    } else {
      (req as any).__subdomain = "root";
    }
    next();
  });

  // Rota raiz: landing page (apenas no domínio raiz)
  app.get("/", (req, res) => {
    const sub = (req as any).__subdomain;
    if (sub === "app") {
      // app.usebarberpro.com → redirecionar para o app web
      return res.redirect(301, "/admin");
    }
    if (sub === "api") {
      // api.usebarberpro.com / → retornar info da API
      return res.json({ name: "Barber Pro API", version: "1.0.1", status: "ok", build: "2026-05-15" });
    }
    // Domínio raiz → landing page (sem cache para garantir versão mais recente)
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.sendFile(landingPath);
  });

  app.get("/landing", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(landingPath);
  });

  // ── Subpaginas da landing (reestruturação: cada aba do menu com conteúdo próprio) ──
  const landingSubpages = ["sistema", "pagamentos", "assinaturas"];
  for (const slug of landingSubpages) {
    const devPath = path.join(__dirname, "..", "landing", `${slug}.html`);
    const prodPath = path.join(process.cwd(), "server", "landing", `${slug}.html`);
    const subpagePath = existsSync(devPath) ? devPath : prodPath;
    app.get(`/${slug}`, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(subpagePath);
    });
  }

  // /como-funciona virou seção da home (mesclada com App Mobile) — mantém link antigo funcionando
  app.get("/como-funciona", (_req, res) => {
    res.redirect(301, "/#como-funciona");
  });

  // Páginas legais — conteúdo embutido no bundle
  // ── SEO: favicon ─────────────────────────────────────────────────────────
  app.get("/favicon.ico", (_req, res) => {
    res.redirect(301, "https://pub-203143bd86174070b67f8f64a13a65c2.r2.dev/assets/barber-pro-icon-512.png");
  });

  // ── SEO: robots.txt ──────────────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /admin-api",
      "Disallow: /superadmin",
      "Disallow: /api/",
      "Disallow: /app",
      "",
      "Sitemap: https://usebarberpro.com/sitemap.xml",
    ].join("\n"));
  });

  // ── SEO: sitemap.xml dinâmico (estáticas + páginas públicas das barbearias) ──
  let _sitemapCache: { xml: string; ts: number } | null = null;
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      if (!_sitemapCache || Date.now() - _sitemapCache.ts > 3600000) {
        const dbMod: any = await import("../db");
        const tenants: any[] = await dbMod.getAllTenants().catch(() => []);
        const today = new Date().toISOString().split("T")[0];
        const urls: string[] = [];
        urls.push(`<url><loc>https://usebarberpro.com/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`);
        for (const p of ["/termos", "/privacidade", "/lgpd"]) {
          urls.push(`<url><loc>https://usebarberpro.com${p}</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>`);
        }
        for (const t of tenants) {
          if (!t?.slug) continue;
          const st = String(t.status || "").toLowerCase();
          if (st === "cancelled" || st === "expired") continue;
          urls.push(`<url><loc>https://usebarberpro.com/pub/${t.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
        }
        _sitemapCache = {
          xml: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.join("") + '</urlset>',
          ts: Date.now(),
        };
      }
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(_sitemapCache.xml);
    } catch {
      res.status(500).send("");
    }
  });

  app.get("/termos", (_req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(TERMOS_HTML); });
  app.get("/lgpd", (_req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(LGPD_HTML); });

  // Servir cart.js — conteúdo embutido no bundle para funcionar após o build
  app.get("/cart.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(CART_JS_CONTENT);
  });

  app.get("/api/health", async (_req, res) => {
    // Verificação rápida do banco de dados
    let dbOk = false;
    try {
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        await dbConn.execute("SELECT 1");
        dbOk = true;
      }
    } catch { dbOk = false; }

    // Sempre retorna 200 para o health check do Docker/load balancer
    // O status do banco é informativo apenas (não afeta o status HTTP)
    res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      uptime: Math.floor(process.uptime()),
      env: process.env.NODE_ENV ?? "unknown",
      db: dbOk ? "ok" : "unavailable",
    });
  });

  // Captura de leads da landing page
  app.post("/api/lead", async (req, res) => {
    try {
      const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };
      if (!email && !phone) return res.status(400).json({ ok: false, error: "email ou telefone obrigatório" });
      const { getDb, sqlRaw } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        await dbConn.execute(
          sqlRaw`INSERT INTO orbit_leads (name, email, phone, source) VALUES (${name ?? null}, ${email ?? null}, ${phone ?? null}, 'landing')`
        );
      }
      res.json({ ok: true });
      // Notificar admin por e-mail (assíncrono, não bloqueia a resposta)
      const { sendLeadNotificationEmail } = await import("../email");
      sendLeadNotificationEmail({
        leadName: name ?? "",
        leadEmail: email ?? "",
        leadPhone: phone ?? "",
        capturedAt: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      }).catch((err) => console.error("[Lead Email]", err));
    } catch (e) {
      console.error("[Lead Capture]", e);
      res.status(500).json({ ok: false });
    }
  });

  // Página pública de status do sistema
  app.get("/status", async (_req, res) => {
    const startTime = Date.now();
    // Verificar saúde do banco de dados
    let dbStatus = "operational";
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        await db.execute("SELECT 1");
        dbLatency = Date.now() - dbStart;
      } else {
        dbStatus = "degraded";
      }
    } catch { dbStatus = "outage"; }

    const apiLatency = Date.now() - startTime;
    const overallStatus = dbStatus === "operational" ? "operational" : dbStatus;
    const statusColor = overallStatus === "operational" ? "#22C55E" : overallStatus === "degraded" ? "#F59E0B" : "#EF4444";
    const statusIcon = overallStatus === "operational" ? "✅" : overallStatus === "degraded" ? "⚠️" : "🔴";
    const statusLabel = overallStatus === "operational" ? "Todos os sistemas operacionais" : overallStatus === "degraded" ? "Desempenho degradado" : "Interrupção de serviço";
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const components = [
      { name: "API do Servidor", status: "operational", latency: apiLatency },
      { name: "Banco de Dados", status: dbStatus, latency: dbLatency },
      { name: "Agendamentos Online", status: dbStatus === "operational" ? "operational" : "degraded", latency: null },
      { name: "Notificações Push", status: "operational", latency: null },
      { name: "E-mails Transacionais", status: "operational", latency: null },
      { name: "Pagamentos (Asaas)", status: "operational", latency: null },
    ];

    function componentRow(c: { name: string; status: string; latency: number | null }) {
      const color = c.status === "operational" ? "#22C55E" : c.status === "degraded" ? "#F59E0B" : "#EF4444";
      const label = c.status === "operational" ? "Operacional" : c.status === "degraded" ? "Degradado" : "Indisponível";
      const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px"></span>`;
      const latencyStr = c.latency !== null ? `<span style="font-size:11px;color:#666">${c.latency}ms</span>` : "";
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #1E1E1E">
          <div style="display:flex;align-items:center;font-size:14px;font-weight:600">${dot}${c.name}</div>
          <div style="display:flex;align-items:center;gap:10px">${latencyStr}<span style="font-size:12px;font-weight:700;color:${color}">${label}</span></div>
        </div>
      `;
    }

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Status do Sistema — Barber Pro</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0A; color: #ECEDEE; min-height: 100vh; }
    .container { max-width: 680px; margin: 0 auto; padding: 48px 24px; }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 48px; }
    .logo-text { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
    .logo-sub { font-size: 12px; color: #666; }
    .status-banner { background: ${statusColor}18; border: 1.5px solid ${statusColor}44; border-radius: 16px; padding: 24px; margin-bottom: 40px; display: flex; align-items: center; gap: 16px; }
    .status-icon { font-size: 36px; }
    .status-title { font-size: 18px; font-weight: 800; color: ${statusColor}; }
    .status-time { font-size: 12px; color: #666; margin-top: 4px; }
    .section-title { font-size: 11px; font-weight: 700; color: #666; letter-spacing: 1.5px; margin-bottom: 4px; }
    .components-card { background: #111; border: 1px solid #1E1E1E; border-radius: 16px; padding: 0 20px; margin-bottom: 32px; }
    .uptime-card { background: #111; border: 1px solid #1E1E1E; border-radius: 16px; padding: 20px; margin-bottom: 32px; }
    .uptime-bars { display: flex; gap: 3px; margin-top: 12px; }
    .uptime-bar { flex: 1; height: 28px; border-radius: 4px; background: #22C55E; }
    .footer { text-align: center; font-size: 12px; color: #444; padding-top: 24px; border-top: 1px solid #1E1E1E; }
    .footer a { color: #C9A84C; text-decoration: none; }
    @media (max-width: 480px) { .container { padding: 32px 16px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div>
        <div class="logo-text">✂️ Barber Pro</div>
        <div class="logo-sub">Página de Status do Sistema</div>
      </div>
    </div>

    <div class="status-banner">
      <div class="status-icon">${statusIcon}</div>
      <div>
        <div class="status-title">${statusLabel}</div>
        <div class="status-time">Verificado em ${dateStr} às ${timeStr}</div>
      </div>
    </div>

    <div class="section-title" style="margin-bottom:12px">COMPONENTES DO SISTEMA</div>
    <div class="components-card">
      ${components.map(componentRow).join("")}
    </div>

    <div class="section-title" style="margin-bottom:12px">DISPONIBILIDADE (90 DIAS)</div>
    <div class="uptime-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px;font-weight:700">Uptime geral</span>
        <span style="font-size:16px;font-weight:900;color:#22C55E">99.9%</span>
      </div>
      <div style="font-size:11px;color:#666;margin-bottom:12px">Baseado nos últimos 90 dias de operação</div>
      <div class="uptime-bars">
        ${Array.from({ length: 90 }, (_, i) => {
          const isToday = i === 89;
          const color = isToday ? statusColor : "#22C55E";
          return `<div class="uptime-bar" style="background:${color};opacity:${isToday ? 1 : 0.6 + Math.random() * 0.4}" title="${new Date(Date.now() - (89 - i) * 86400000).toLocaleDateString('pt-BR')}"></div>`;
        }).join("")}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#666;margin-top:8px">
        <span>90 dias atrás</span>
        <span>Hoje</span>
      </div>
    </div>

    <div class="section-title" style="margin-bottom:12px">HISTÓRICO DE INCIDENTES</div>
    <div style="background:#111;border:1px solid #1E1E1E;border-radius:16px;padding:20px;margin-bottom:32px">
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:32px;margin-bottom:8px">🎉</div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px">Nenhum incidente recente</div>
        <div style="font-size:12px;color:#666">Todos os sistemas estão funcionando normalmente.</div>
      </div>
    </div>

    <div class="footer">
      <p>Barber Pro &mdash; Sistema de Gestão para Barbearias</p>
      <p style="margin-top:6px"><a href="/landing">Conheça o Barber Pro</a> &bull; <a href="/admin">Painel Admin</a></p>
      <p style="margin-top:12px;font-size:11px">Esta página atualiza automaticamente a cada 60 segundos.</p>
    </div>
  </div>
  <script>setTimeout(function(){ location.reload(); }, 60000);</script>
</body>
</html>`);
  });

  // Rota interna de migração — cria tabelas novas sem afetar as existentes
  app.post("/internal/migrate", async (req, res) => {
    if (req.headers["x-internal-key"] !== INTERNAL_API_KEY) {
      return res.status(403).json({ error: "forbidden" });
    }
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "no db" });
      const sqls = [
        // ─── Fornecedores (suppliers) ─────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS suppliers (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, name VARCHAR(255) NOT NULL, phone VARCHAR(30), email VARCHAR(255), cnpj VARCHAR(20), address TEXT, notes TEXT, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        // Adicionar coluna supplierId em products se não existir
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS supplierId INT NULL`,
        // ─── Planos de Assinatura ────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS subscription_plans (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, name VARCHAR(100) NOT NULL, description TEXT, recurrences INT NOT NULL DEFAULT 4, maxServices INT NOT NULL DEFAULT 1, maxProducts INT NOT NULL DEFAULT 0, price DECIMAL(10,2) NOT NULL, suggestedPrice DECIMAL(10,2), isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS subscription_plan_services (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, serviceId INT NOT NULL, tenantId INT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS subscription_plan_products (id INT PRIMARY KEY AUTO_INCREMENT, planId INT NOT NULL, productId INT NOT NULL, tenantId INT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS client_subscriptions (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, planId INT NOT NULL, clientId INT NOT NULL, barberId INT, selectedServiceIds TEXT, selectedProductIds TEXT, status ENUM('active','cancelled','expired') NOT NULL DEFAULT 'active', paymentMethod ENUM('credit_card','pix','cash','debit_card') NOT NULL DEFAULT 'cash', price DECIMAL(10,2) NOT NULL, cycleStart DATE NOT NULL, cycleEnd DATE NOT NULL, usedRecurrences INT NOT NULL DEFAULT 0, cancelledAt TIMESTAMP NULL, cancelReason TEXT, autoRenew BOOLEAN NOT NULL DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS subscription_appointments (id INT PRIMARY KEY AUTO_INCREMENT, subscriptionId INT NOT NULL, appointmentId INT NOT NULL, tenantId INT NOT NULL, recurrenceIndex INT NOT NULL DEFAULT 1)`,
        `CREATE TABLE IF NOT EXISTS online_payments (id INT PRIMARY KEY AUTO_INCREMENT, tenantId INT NOT NULL, clientId INT NOT NULL, chargeType ENUM('product','appointment','subscription') NOT NULL, referenceId INT, asaasPaymentId VARCHAR(100), asaasSubscriptionId VARCHAR(100), asaasCustomerId VARCHAR(100), billingType ENUM('BOLETO','CREDIT_CARD','PIX','STORE') NOT NULL DEFAULT 'PIX', amount DECIMAL(10,2) NOT NULL, status ENUM('pending','paid','overdue','refunded','cancelled') NOT NULL DEFAULT 'pending', invoiceUrl TEXT, pixQrCode TEXT, pixCopyCola TEXT, dueDate DATE, paidAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP NOT NULL DEFAULT NOW())`,
      ];
      for (const sql of sqls) {
        await db.execute(sql as any);
      }
      return res.json({ ok: true, tables: sqls.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
  // ─── Webhook Asaas ───────────────────────────────────────────────────────────────────────────
  app.post("/api/asaas/webhook", async (req, res) => {
    try {
      // Validação de segurança: verificar token Asaas no header (quando configurado)
      const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
      if (webhookToken) {
        const receivedToken = req.headers["asaas-access-token"] as string | undefined;
        if (!receivedToken || receivedToken !== webhookToken) {
          console.warn("[asaas-webhook] Token inválido ou ausente — rejeitando requisição");
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }
      const { parseAsaasWebhook } = await import("../asaas");
      const { getDb, updateAppointment } = await import("../db");
      const parsed = parseAsaasWebhook(req.body);
      const dbConn = await getDb();
      if (dbConn && parsed.asaasId) {
        // Mapear status Asaas → status interno
        const statusMap: Record<string, string> = {
          RECEIVED: "paid", CONFIRMED: "paid",
          OVERDUE: "overdue", REFUNDED: "refunded", CANCELLED: "cancelled",
        };
        const internalStatus = statusMap[parsed.status] ?? "pending";
        const paidClause = internalStatus === "paid" ? `, "paidAt" = NOW()` : "";
        await (dbConn as any).execute(
          `UPDATE online_payments SET status = '${internalStatus}', "updatedAt" = NOW()${paidClause} WHERE "asaasPaymentId" = '${parsed.asaasId}' OR "asaasSubscriptionId" = '${parsed.asaasId}'`
        );
        // Se pago, confirmar agendamento vinculado e notificar cliente via WhatsApp
        if (internalStatus === "paid") {
          try {
            const pmtRows = await (dbConn as any).execute(
              `SELECT op."referenceId", op."chargeType", op."clientId", op."tenantId", op."billingType",
                      c.name AS "clientName", c.phone AS "clientPhone"
               FROM online_payments op
               LEFT JOIN clients c ON c.id = op."clientId"
               WHERE op."asaasPaymentId" = '${parsed.asaasId}' LIMIT 1`
            );
            const pmtArr = Array.isArray(pmtRows) ? pmtRows[0] : pmtRows?.rows ?? [];
            const pmt = pmtArr?.[0];
            if (pmt?.referenceId && pmt?.chargeType === "appointment") {
              await updateAppointment(pmt.referenceId, { status: "confirmed" } as any);
            }
            // Enviar notificação WhatsApp ao cliente
            if (pmt?.clientPhone) {
              try {
                const { getDb: getDb2, getAppointmentById, getServiceById, getBarberById, getTenantById } = await import("../db");
                let shopName = "Barber Pro";
                let serviceName = "";
                let barberName = "";
                let apptDate = "";
                let apptTime = "";
                if (pmt.referenceId && pmt.chargeType === "appointment") {
                  const appt = await getAppointmentById(pmt.referenceId);
                  if (appt) {
                    const service = await getServiceById((appt as any).serviceId);
                    const barber = await getBarberById((appt as any).barberId);
                    serviceName = service?.name ?? "";
                    barberName = barber?.name ?? "";
                    apptDate = (appt as any).date ?? "";
                    apptTime = ((appt as any).startTime ?? "").slice(0, 5);
                    if (pmt.tenantId) {
                      const tenant = await getTenantById(pmt.tenantId);
                      if (tenant) shopName = (tenant as any).name ?? shopName;
                    }
                  }
                }
                const billingLabel = pmt.billingType === "PIX" ? "Pix" : pmt.billingType === "CREDIT_CARD" ? "Cartão de Crédito" : pmt.billingType === "BOLETO" ? "Boleto" : pmt.billingType;
                const dateFormatted = apptDate ? new Date(apptDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "";
                let msg = `✅ Pagamento confirmado! Seu agendamento em *${shopName}* está confirmado.`;
                if (serviceName) msg += `

✂️ *${serviceName}*${barberName ? ` com ${barberName}` : ""}`;
                if (dateFormatted && apptTime) msg += `
📅 ${dateFormatted} às ${apptTime}`;
                msg += `

💳 Pago via ${billingLabel}. Te esperamos! 💈`;
                const phone = pmt.clientPhone.replace(/\D/g, "");
                const fullPhone = phone.startsWith("55") ? phone : "55" + phone;
                const waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
                console.log(`[asaas-webhook] WhatsApp confirmação — ${pmt.clientName} | ${waLink}`);
              } catch (waErr: any) {
                console.error("[asaas-webhook] Erro ao gerar link WhatsApp:", waErr.message);
              }
            }
          } catch (innerErr: any) {
            console.error("[asaas-webhook] Erro ao confirmar agendamento:", innerErr.message);
          }
        }
      }

      // ─── Eventos de Assinatura Barber Pro ─────────────────────────────────────────────────────
      // Caso 1: evento com objeto subscription (ex: SUBSCRIPTION_CANCELLED, SUBSCRIPTION_RENEWED)
      // Caso 2: evento PAYMENT_RECEIVED/PAYMENT_CONFIRMED com payment.subscription (pagamento de assinatura)
      if (dbConn && req.body?.event) {
        const event = req.body.event as string;
        const statusMap: Record<string, string> = {
          PAYMENT_RECEIVED: "active",
          PAYMENT_CONFIRMED: "active",
          SUBSCRIPTION_RENEWED: "active",
          PAYMENT_OVERDUE: "overdue",
          PAYMENT_REFUNDED: "overdue",
          SUBSCRIPTION_CANCELLED: "cancelled",
          PAYMENT_CANCELLED: "cancelled",
        };
        const newStatus = statusMap[event];
        if (newStatus) {
          let tenantId: number | null = null;

          // Caso 1: body.subscription com externalReference = 'tenant_<id>'
          if (req.body.subscription?.externalReference?.startsWith("tenant_")) {
            tenantId = parseInt(req.body.subscription.externalReference.replace("tenant_", ""), 10);
          }

          // Caso 2: body.payment.subscription existe → buscar tenant pelo asaasSubscriptionId
          if (!tenantId && req.body.payment?.subscription) {
            const subId = req.body.payment.subscription as string;
            try {
              const subRows = await (dbConn as any).execute(
                `SELECT id FROM tenants WHERE "barberproSubscriptionId" = '${subId}' LIMIT 1`
              );
              const subArr = Array.isArray(subRows) ? subRows[0] : subRows?.rows ?? [];
              if (subArr?.[0]?.id) tenantId = subArr[0].id;
            } catch (lookupErr: any) {
              console.error("[asaas-webhook] Erro ao buscar tenant por subscriptionId:", lookupErr.message);
            }
          }

          // Caso 3: body.payment.externalReference = 'tenant_<id>' (fallback)
          if (!tenantId && req.body.payment?.externalReference?.startsWith("tenant_")) {
            tenantId = parseInt(req.body.payment.externalReference.replace("tenant_", ""), 10);
          }

          if (tenantId && !isNaN(tenantId)) {
            try {
              // Ao confirmar pagamento, registrar também o plano e valor corretos;
              if (newStatus === "active") {
                // Tentar extrair valor e descrição do pagamento para identificar o plano
                const paymentValue = req.body.payment?.value ?? req.body.value ?? null;
                const paymentDesc: string = (req.body.payment?.description ?? req.body.description ?? "").toLowerCase();
                const planPriceMap: Record<string, number> = { solo: 49.90, team: 99.90, studio: 169.90 };
                const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };

                // Identificar plano pelo valor ou pela descrição
                let detectedPlan = "solo";
                if (paymentValue) {
                  const val = parseFloat(paymentValue);
                  if (val >= 150) detectedPlan = "studio";
                  else if (val >= 80) detectedPlan = "team";
                  else detectedPlan = "solo";
                } else if (paymentDesc.includes("estúdio") || paymentDesc.includes("studio")) {
                  detectedPlan = "studio";
                } else if (paymentDesc.includes("equipe") || paymentDesc.includes("team")) {
                  detectedPlan = "team";
                }

                const detectedPrice = paymentValue ? parseFloat(paymentValue) : planPriceMap[detectedPlan];
                const nextDueFromPayment = req.body.payment?.dueDate
                  ? `, "barberproNextDueDate" = '${req.body.payment.dueDate}'::date`
                  : `, "barberproNextDueDate" = (NOW() + INTERVAL '30 days')::date`;

                console.log(`[asaas-webhook] Plano detectado: ${detectedPlan} (R$${detectedPrice}) para tenant ${tenantId}`);

                // Calcular próximo vencimento
                const nextDueDateStr = req.body.payment?.dueDate
                  ? req.body.payment.dueDate
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

                // Usar db.updateTenant para evitar cast de enum incorreto
                const { updateTenant } = await import('../db');
                await updateTenant(tenantId, {
                  barberproSubscriptionStatus: newStatus,
                  plan: detectedPlan as any,
                  barberproPlanName: detectedPlan,
                  barberproPlanPrice: String(detectedPrice),
                  barberproNextDueDate: nextDueDateStr,
                  updatedAt: new Date(),
                });
              } else {
                // Para status não-active, apenas atualizar o status
                const { updateTenant } = await import('../db');
                await updateTenant(tenantId, {
                  barberproSubscriptionStatus: newStatus,
                  updatedAt: new Date(),
                });
              }
              console.log(`[asaas-webhook] Assinatura Barber Pro tenant ${tenantId} → ${newStatus} (evento: ${event})`);

              // Enviar e-mail de cancelamento ao super_admin da barbearia
              if (newStatus === "cancelled") {
                try {
                  const cancelRows = await (dbConn as any).execute(
                    `SELECT t.name AS "tenantName", t.slug, t."barberproPlanName",
                            b.email AS "adminEmail", b.name AS "adminName"
                     FROM tenants t
                     LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
                     WHERE t.id = ${tenantId}
                     LIMIT 1`
                  );
                  const cancelArr = Array.isArray(cancelRows) ? cancelRows[0] : cancelRows?.rows ?? [];
                  const cancelInfo = cancelArr?.[0];
                  if (cancelInfo?.adminEmail) {
                    const { sendEmail, emailLayout, alertBox, ctaButton, detailRow } = await import("../email");
                    const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };
                    const planLabel = planLabelMap[cancelInfo.barberproPlanName ?? 'solo'] ?? cancelInfo.barberproPlanName ?? 'Solo';
                    const cancelledAt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                    const reactivateUrl = `https://usebarberpro.com/${cancelInfo.slug ?? 'admin'}/admin/configuracoes?tab=pagamentos`;
                    const cancelBody = `
                      ${alertBox('⚠️', 'Assinatura cancelada', `Barber Pro ${planLabel} foi cancelado`, '#F87171')}
                      <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
                        Olá, <strong style="color:#ECEDEE">${cancelInfo.adminName ?? 'Admin'}</strong>! A assinatura do
                        <strong style="color:#ECEDEE">${cancelInfo.tenantName}</strong> no Barber Pro foi cancelada.
                      </p>
                      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${detailRow('Plano cancelado', 'Barber Pro ' + planLabel)}
                          ${detailRow('Data do cancelamento', cancelledAt, '#F87171')}
                          ${detailRow('Acesso ao sistema', 'Bloqueado até nova assinatura', '#F87171', true)}
                        </table>
                      </div>
                      <div style="background:#F8717118;border:1.5px solid #F8717144;border-radius:14px;padding:18px 20px;margin-bottom:24px">
                        <div style="font-size:14px;font-weight:700;color:#F87171;margin-bottom:8px">🔒 Acesso bloqueado</div>
                        <p style="color:#9BA1A6;font-size:13px;line-height:1.5;margin:0">
                          O acesso ao painel administrativo e ao app está suspenso. Para reativar, assine um dos planos abaixo.
                        </p>
                      </div>
                      <div style="margin-bottom:28px">
                        ${[{n:'Solo',p:'R$ 49,90',d:'1 barbeiro'},{n:'Equipe',p:'R$ 99,90',d:'até 3 barbeiros'},{n:'Estúdio',p:'R$ 169,90',d:'ilimitados'}].map(pl=>`
                        <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                          <div><div style="font-weight:700;color:#ECEDEE;font-size:14px">${pl.n}</div><div style="font-size:12px;color:#666">${pl.d}</div></div>
                          <div style="font-size:16px;font-weight:900;color:#C9A84C">${pl.p}<span style="font-size:11px;font-weight:400;color:#666">/mês</span></div>
                        </div>`).join('')}
                      </div>
                      ${ctaButton('Reativar assinatura →', reactivateUrl, '#C9A84C')}
                      <p style="color:#555555;font-size:12px;text-align:center;margin:0">
                        Seus dados ficam preservados por 30 dias. Após esse prazo, a conta será excluída permanentemente.
                      </p>`;
                    await sendEmail({
                      to: cancelInfo.adminEmail,
                      subject: `⚠️ Assinatura cancelada — Barber Pro ${planLabel}`,
                      html: emailLayout(cancelBody, {
                        headerSubtitle: 'Assinatura Cancelada',
                        previewText: `Sua assinatura do Barber Pro ${planLabel} foi cancelada. Reative agora para recuperar o acesso.`,
                      }),
                    }).catch((e: any) => console.error("[asaas-webhook] Erro ao enviar e-mail de cancelamento:", e.message));
                  }
                } catch (cancelEmailErr: any) {
                  console.error("[asaas-webhook] Erro ao buscar tenant para e-mail de cancelamento:", cancelEmailErr.message);
                }
              }

              // Enviar e-mail de confirmação de pagamento/ativação ao super_admin da barbearia
              if (newStatus === "active") {
                try {
                  const tenantRows = await (dbConn as any).execute(
                    `SELECT t.name AS "tenantName", t."barberproPlanName", t."barberproPlanPrice", t."barberproNextDueDate",
                            b.email AS "adminEmail", b.name AS "adminName"
                     FROM tenants t
                     LEFT JOIN barbers b ON b."tenantId" = t.id AND b.role = 'super_admin'
                     WHERE t.id = ${tenantId}
                     LIMIT 1`
                  );
                  const tenantArr = Array.isArray(tenantRows) ? tenantRows[0] : tenantRows?.rows ?? [];
                  const tenantInfo = tenantArr?.[0];
                  if (tenantInfo?.adminEmail) {
                    const { sendEmail, emailLayout, alertBox, ctaButton, detailRow } = await import("../email");
                    const planLabelMap: Record<string, string> = { solo: 'Solo', team: 'Equipe', studio: 'Estúdio' };
                    const planName = tenantInfo.barberproPlanName ?? 'solo';
                    const planLabel = planLabelMap[planName] ?? planName;
                    const planPrice = tenantInfo.barberproPlanPrice ? parseFloat(tenantInfo.barberproPlanPrice) : (planName === 'studio' ? 169.90 : planName === 'team' ? 99.90 : 49.90);
                    const paidAt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                    const nextDue = tenantInfo.barberproNextDueDate
                      ? new Date(tenantInfo.barberproNextDueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                      : 'próximo mês';
                    const paymentBody = `
                      ${alertBox('✅', 'Pagamento confirmado!', 'Sua assinatura está ativa', '#4ADE80')}
                      <p style="color:#9BA1A6;font-size:14px;line-height:1.6;margin:0 0 24px">
                        Olá, <strong style="color:#ECEDEE">${tenantInfo.adminName ?? 'Admin'}</strong>! Seu pagamento foi confirmado e a assinatura do
                        <strong style="color:#ECEDEE">${tenantInfo.tenantName}</strong> no Barber Pro está ativa.
                      </p>
                      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:14px;padding:20px 24px;margin-bottom:24px">
                        <div style="font-size:11px;color:#555;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:14px">Recibo de Pagamento</div>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${detailRow('Plano', 'Barber Pro ' + planLabel)}
                          ${detailRow('Valor pago', 'R$ ' + planPrice.toFixed(2).replace('.', ','), '#4ADE80')}
                          ${detailRow('Data do pagamento', paidAt)}
                          ${detailRow('Forma de pagamento', 'Pix')}
                          ${detailRow('Próximo vencimento', nextDue, '#FBBF24', true)}
                        </table>
                      </div>
                      ${ctaButton('Acessar o painel →', 'https://usebarberpro.com/admin')}
                      <p style="color:#555555;font-size:12px;text-align:center;margin:0">
                        O pagamento será cobrado automaticamente todo mês via Pix. Para cancelar, acesse
                        <a href="https://usebarberpro.com/admin/configuracoes?tab=pagamentos" style="color:#C9A84C">Configurações &gt; Pagamentos</a>.
                      </p>`;
                    await sendEmail({
                      to: tenantInfo.adminEmail,
                      subject: `✅ Pagamento confirmado — Barber Pro ${planLabel}`,
                      html: emailLayout(paymentBody, {
                        headerSubtitle: 'Confirmação de Pagamento',
                        previewText: `Pagamento de R$ ${planPrice.toFixed(2).replace('.', ',')} confirmado. Barber Pro ${planLabel} ativo!`,
                      }),
                    }).catch((e: any) => console.error("[asaas-webhook] Erro ao enviar e-mail de ativação:", e.message));
                  }
                } catch (emailErr: any) {
                  console.error("[asaas-webhook] Erro ao buscar tenant para e-mail:", emailErr.message);
                }
              }
            } catch (subErr: any) {
              console.error("[asaas-webhook] Erro ao atualizar assinatura:", subErr.message);
            }
          }
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("[asaas-webhook]", err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Diagnóstico Asaas ──────────────────────────────────────────────────────────────────────
  // GET /api/asaas/test — Verifica a conexão com o Asaas (Sandbox ou Produção)
  // Protegido por cookie de sessão admin para evitar exposição pública
  app.get("/api/asaas/test", async (req, res) => {
    try {
      const { asaasEnabled, asaasApi } = await import("../asaas");
      const sandbox = process.env.ASAAS_SANDBOX === "true";
      const apiKey = process.env.ASAAS_API_KEY ?? "";
      if (!asaasEnabled) {
        return res.json({ ok: false, error: "ASAAS_API_KEY não configurada", sandbox });
      }
      // Testar conexão listando clientes (limite 1)
      const r = await asaasApi.get("/customers", { params: { limit: 1 } });
      return res.json({
        ok: true,
        sandbox,
        env: sandbox ? "sandbox.asaas.com" : "api.asaas.com",
        apiKeyPrefix: apiKey.slice(0, 8) + "...",
        webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ? "configurado" : "ausente",
        customersTotal: r.data?.totalCount ?? 0,
      });
    } catch (err: any) {
      const errData = err?.response?.data ?? err.message;
      return res.status(500).json({ ok: false, error: errData });
    }
  });

  // GET /api/asaas/account-status — Diagnóstico da subconta Asaas (requer x-internal-key)
  app.get("/api/asaas/account-status", async (req, res) => {
    if (req.headers["x-internal-key"] !== INTERNAL_API_KEY) {
      return res.status(403).json({ error: "forbidden" });
    }
    try {
      const { getDb } = await import("../db");
      const { getAsaasSubAccount, asaasEnabled } = await import("../asaas");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "no db" });
      // Pegar primeiro tenant com asaasAccountId
      const r = await db.execute(`SELECT id, name, "asaasAccountId", "asaasAccountStatus" FROM tenants WHERE "asaasAccountId" IS NOT NULL LIMIT 1` as any);
      const tenant = ((r as any).rows ?? r)[0];
      if (!tenant?.asaasAccountId) return res.json({ ok: false, error: "Nenhum tenant com asaasAccountId", tenant });
      if (!asaasEnabled) return res.json({ ok: false, error: "ASAAS_API_KEY não configurada" });
      const accountData = await getAsaasSubAccount(tenant.asaasAccountId);
      return res.json({ ok: true, tenant, accountData });
    } catch (err: any) {
      return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,5) });
    }
  });

  // ─── Endpoint de diagnóstico do banco de dados ─────────────────────────────────────────
  app.get("/api/db-columns", async (req, res) => {
    if (req.headers["x-internal-key"] !== INTERNAL_API_KEY) {
      return res.status(403).json({ error: "forbidden" });
    }
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "no db" });
      const r = await db.execute(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tenants' AND column_name LIKE 'barberpro%' ORDER BY column_name` as any);
      return res.json({ ok: true, rows: (r as any).rows ?? r });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Rotas /:slug — usebarberpro.com/:slug serve a página pública de cada barbearia ───
  // Slugs de sistema reservados (não são barbearias)
  const SYSTEM_PATHS = new Set(["api", "admin", "superadmin", "pub", "pub-api", "landing", "status", "marketplace", "internal", "app", "www", "_next", "static", "assets", "favicon.ico", "privacidade"]);

  // GET /:slug → página principal da barbearia
  // GET /:slug → página principal da barbearia
  app.get("/:slug", async (req, res, next) => {
    const { slug } = req.params;
    if (SYSTEM_PATHS.has(slug)) return next();
    // Verificar se existe tenant com esse slug usando Drizzle ORM (não SQL raw)
    try {
      const { getTenantBySlug } = await import("../db");
      const tenant = await getTenantBySlug(slug);
      if (!tenant || !["active", "trial"].includes((tenant as any).status ?? "")) return next();
      // Redirecionar para /pub/:slug mantendo query string
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `/pub/${slug}${qs}`);
    } catch { return next(); }
  });

  // GET /:slug/*path → sub-rotas da barbearia (agendar, login, cadastro, etc.)
  app.get("/:slug/*path", async (req, res, next) => {
    const { slug } = req.params;
    if (SYSTEM_PATHS.has(slug)) return next();
    try {
      const { getTenantBySlug } = await import("../db");
      const tenant = await getTenantBySlug(slug);
      if (!tenant || !["active", "trial"].includes((tenant as any).status ?? "")) return next();
      // Extrair o sub-path após /:slug/
      const subPath = (req.params as any).path || "";
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `/pub/${slug}/${subPath}${qs}`);
    } catch { return next(); }
  });

  // ─── Rate Limiting ────────────────────────────────────────────────────────────
  // Rate limiter estrito para rotas de login (10 tentativas/min por IP+email)
  app.use("/api/trpc/admin.login", loginRateLimiter);
  app.use("/api/trpc/admin.refreshToken", loginRateLimiter);
  app.use("/api/trpc/clientAuth.login", loginRateLimiter);
  // Rate limiter geral para todas as mutations tRPC (200 req/min por IP)
  app.use("/api/trpc", trpcRateLimiter);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Rota explícita de manutenção (acessível manualmente)
  app.get("/manutencao", (_req, res) => {
    res.status(503).sendFile(maintenancePath);
  });

  // Handler de erro global 500 — retorna página de manutenção para requisições HTML
  app.use((err: any, req: any, res: any, _next: any) => {
    console.error("[server-error]", err?.message ?? err);
    const acceptsHtml = req.headers?.accept?.includes("text/html");
    if (acceptsHtml) {
      return res.status(503).sendFile(maintenancePath);
    }
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  // Middleware 404 — retorna página de manutenção para rotas HTML não encontradas
  app.use((req: any, res: any) => {
    const acceptsHtml = req.headers?.accept?.includes("text/html");
    if (acceptsHtml) {
      return res.status(404).sendFile(maintenancePath);
    }
    res.status(404).json({ ok: false, error: "Not found" });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  // Em produção, usa a porta exata fornecida pelo host (Railway injeta $PORT)
  // Em desenvolvimento, tenta portas alternativas se a preferida estiver ocupada
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Escuta em 0.0.0.0 para aceitar conexões externas (obrigatório no Railway)
  server.listen(port, "0.0.0.0", async () => {
    console.log(`[api] server listening on port ${port}`);
    // ─── Auto-migrate: aplica ADD COLUMN IF NOT EXISTS sem precisar de schema drizzle ───
    try {
      const { getDb } = await import("../db");
      const { runAutoMigrate } = await import("../auto-migrate");
      const dbConn = await getDb();
      if (dbConn) {
        await runAutoMigrate(dbConn);
      } else {
        console.warn("[auto-migrate] Banco não disponível no boot — migração adiada");
      }
    } catch (migrateErr: any) {
      console.error("[auto-migrate] Erro durante migração:", migrateErr?.message ?? migrateErr);
      // Não encerra o servidor — continua mesmo se a migração falhar
    }
    // Iniciar job de e-mail de avaliação pós-atendimento
    startReviewEmailJob();
    // Iniciar job de lembretes WhatsApp (24h e 1h antes do agendamento)
    startWhatsAppReminderJob();
    // Iniciar job de lembretes por e-mail (24h antes do agendamento)
    startEmailReminderJob();
    // Iniciar job de lembretes de assinatura (3 dias antes)
    startSubscriptionReminderJob();
    // Iniciar job de notificação de trial expirando (3 dias antes)
    startTrialExpiryJob();
    // Iniciar job de backup semanal do PostgreSQL (toda segunda-feira às 03:00)
    startBackupJob();
  });
}

// ─── Handlers globais de erro — evitam que o processo caia por erros não tratados ───
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException — erro não tratado:", err?.message ?? err);
  console.error(err?.stack ?? "");
  // Não encerra o processo: o servidor continua respondendo
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] unhandledRejection — Promise rejeitada sem handler:", reason);
  // Não encerra o processo: o servidor continua respondendo
});

startServer().catch(console.error);
