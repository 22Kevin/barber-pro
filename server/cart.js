// Barber Pro — Carrinho de Produtos
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
