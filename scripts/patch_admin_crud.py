"""
Patch: substitui renderServicos por versão com CRUD completo e adiciona renderProdutos e renderNovoProduto.
"""
import re

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'r') as f:
    content = f.read()

# ── 1. Substituir renderServicos ──────────────────────────────────────────────
old_servicos_start = "async function renderServicos(req: Request, res: Response) {"
old_servicos_end = "  res.send(adminLayout(\"Serviços\", \"servicos\", body, barber?.name));\n}"

start_idx = content.find(old_servicos_start)
end_idx = content.find(old_servicos_end, start_idx) + len(old_servicos_end)

new_servicos = '''async function renderServicos(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const services = await db.getAllServicesWithMedia(false);
  const saved = req.query.saved === "1";
  const deleted = req.query.deleted === "1";
  const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
  const editService = editId ? services.find((s: any) => s.id === editId) : null;

  const formHtml = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">${editService ? "✏️ Editar Serviço" : "➕ Novo Serviço"}</div>
      </div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/servicos${editService ? `?edit=${editService.id}` : ""}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Nome do Serviço *</label>
              <input class="form-input" type="text" name="name" value="${esc(editService?.name ?? "")}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$) *</label>
              <input class="form-input" type="number" name="price" step="0.01" min="0" value="${editService?.price ?? ""}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Duração (minutos) *</label>
              <input class="form-input" type="number" name="durationMinutes" min="5" step="5" value="${editService?.durationMinutes ?? 30}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-input" name="isActive">
                <option value="true" ${!editService || editService.isActive ? "selected" : ""}>Ativo</option>
                <option value="false" ${editService && !editService.isActive ? "selected" : ""}>Inativo</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-input" name="description" rows="3" style="resize:vertical">${esc(editService?.description ?? "")}</textarea>
          </div>
          <div style="display:flex;gap:12px;margin-top:8px">
            <button type="submit" class="btn btn-primary" style="padding:12px 28px">${editService ? "Salvar Alterações" : "Criar Serviço"}</button>
            ${editService ? `<a href="/admin/servicos" class="btn" style="padding:12px 20px;background:var(--surface2);color:var(--text)">Cancelar</a>` : ""}
          </div>
        </form>
      </div>
    </div>
  `;

  const tableHtml = services.length === 0
    ? `<div style="text-align:center;padding:40px;color:var(--muted)">Nenhum serviço cadastrado ainda.</div>`
    : `<table class="table">
        <thead><tr><th>Nome</th><th>Preço</th><th>Duração</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${services.map((s: any) => `
            <tr>
              <td><strong>${esc(s.name)}</strong>${s.description ? `<br><small style="color:var(--muted)">${esc(s.description.substring(0, 60))}${s.description.length > 60 ? "..." : ""}</small>` : ""}</td>
              <td style="font-weight:700;color:var(--primary)">R$ ${parseFloat(s.price).toFixed(2).replace(".", ",")}</td>
              <td>${s.durationMinutes} min</td>
              <td>${s.isActive ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-muted">Inativo</span>`}</td>
              <td>
                <div style="display:flex;gap:8px">
                  <a href="/admin/servicos?edit=${s.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">✏️ Editar</a>
                  <form method="POST" action="/admin/servicos/toggle" style="display:inline" onsubmit="return confirm('Alterar status?')">
                    <input type="hidden" name="id" value="${s.id}" />
                    <input type="hidden" name="isActive" value="${!s.isActive}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">${s.isActive ? "⏸ Desativar" : "▶ Ativar"}</button>
                  </form>
                  <form method="POST" action="/admin/servicos/delete" style="display:inline" onsubmit="return confirm('Excluir este serviço? Esta ação não pode ser desfeita.')">
                    <input type="hidden" name="id" value="${s.id}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#EF444422;color:#F87171">🗑 Excluir</button>
                  </form>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Serviço salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Serviço excluído com sucesso!</div>` : ""}
    ${formHtml}
    <div class="card">
      <div class="card-header"><div class="card-title">✂️ Serviços Cadastrados (${services.length})</div></div>
      <div class="card-body">${tableHtml}</div>
    </div>
  `;
  res.send(adminLayout("Serviços", "servicos", body, barber?.name));
}'''

content = content[:start_idx] + new_servicos + content[end_idx:]

# ── 2. Adicionar renderProdutos (substituir a função existente se houver, ou inserir antes de renderFinanceiro) ──
# Verificar se já existe renderProdutos
if 'async function renderProdutos(' in content:
    # Substituir a existente
    prod_start = content.find('async function renderProdutos(')
    # Encontrar o fim da função (próximo "async function" ou "export function")
    next_func = content.find('\nasync function ', prod_start + 10)
    if next_func == -1:
        next_func = content.find('\nexport function ', prod_start + 10)
    old_prod = content[prod_start:next_func]
else:
    # Inserir antes de renderFinanceiro
    next_func = content.find('async function renderFinanceiro(')
    old_prod = ''

new_produtos = '''async function renderProdutos(req: Request, res: Response) {
  const session = (req as any).adminSession as { barberId: number; role: string };
  const barber = await db.getBarberById(session.barberId);
  const products = await db.getAllProductsWithMedia(false);
  const saved = req.query.saved === "1";
  const deleted = req.query.deleted === "1";
  const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
  const editProduct = editId ? products.find((p: any) => p.id === editId) : null;

  const formHtml = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">${editProduct ? "✏️ Editar Produto" : "➕ Novo Produto"}</div>
      </div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/produtos${editProduct ? `?edit=${editProduct.id}` : ""}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Nome do Produto *</label>
              <input class="form-input" type="text" name="name" value="${esc(editProduct?.name ?? "")}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$) *</label>
              <input class="form-input" type="number" name="price" step="0.01" min="0" value="${editProduct?.price ?? ""}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-input" name="productType">
                <option value="sale" ${!editProduct || editProduct.productType === "sale" ? "selected" : ""}>Venda</option>
                <option value="internal" ${editProduct?.productType === "internal" ? "selected" : ""}>Uso interno</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estoque atual</label>
              <input class="form-input" type="number" name="stockQuantity" min="0" value="${editProduct?.stockQuantity ?? 0}" />
            </div>
            <div class="form-group">
              <label class="form-label">Alerta mínimo de estoque</label>
              <input class="form-input" type="number" name="minStockAlert" min="0" value="${editProduct?.minStockAlert ?? 5}" />
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-input" name="isActive">
                <option value="true" ${!editProduct || editProduct.isActive ? "selected" : ""}>Ativo</option>
                <option value="false" ${editProduct && !editProduct.isActive ? "selected" : ""}>Inativo</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-input" name="description" rows="3" style="resize:vertical">${esc(editProduct?.description ?? "")}</textarea>
          </div>
          <div style="display:flex;gap:12px;margin-top:8px">
            <button type="submit" class="btn btn-primary" style="padding:12px 28px">${editProduct ? "Salvar Alterações" : "Criar Produto"}</button>
            ${editProduct ? `<a href="/admin/produtos" class="btn" style="padding:12px 20px;background:var(--surface2);color:var(--text)">Cancelar</a>` : ""}
          </div>
        </form>
      </div>
    </div>
  `;

  const tableHtml = products.length === 0
    ? `<div style="text-align:center;padding:40px;color:var(--muted)">Nenhum produto cadastrado ainda.</div>`
    : `<table class="table">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${products.map((p: any) => `
            <tr>
              <td><strong>${esc(p.name)}</strong>${p.description ? `<br><small style="color:var(--muted)">${esc(p.description.substring(0, 50))}${p.description.length > 50 ? "..." : ""}</small>` : ""}</td>
              <td><span class="badge ${p.productType === "sale" ? "badge-success" : "badge-muted"}">${p.productType === "sale" ? "Venda" : "Interno"}</span></td>
              <td style="font-weight:700;color:var(--primary)">R$ ${parseFloat(p.price).toFixed(2).replace(".", ",")}</td>
              <td>
                <span style="color:${p.stockQuantity <= p.minStockAlert ? "var(--error)" : "var(--success)"}">
                  ${p.stockQuantity} un.
                </span>
                ${p.stockQuantity <= p.minStockAlert ? `<br><small style="color:var(--error)">⚠ Estoque baixo</small>` : ""}
              </td>
              <td>${p.isActive ? `<span class="badge badge-success">Ativo</span>` : `<span class="badge badge-muted">Inativo</span>`}</td>
              <td>
                <div style="display:flex;gap:8px">
                  <a href="/admin/produtos?edit=${p.id}" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">✏️ Editar</a>
                  <form method="POST" action="/admin/produtos/toggle" style="display:inline" onsubmit="return confirm('Alterar status?')">
                    <input type="hidden" name="id" value="${p.id}" />
                    <input type="hidden" name="isActive" value="${!p.isActive}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:var(--surface2);color:var(--text)">${p.isActive ? "⏸ Desativar" : "▶ Ativar"}</button>
                  </form>
                  <form method="POST" action="/admin/produtos/delete" style="display:inline" onsubmit="return confirm('Excluir este produto?')">
                    <input type="hidden" name="id" value="${p.id}" />
                    <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#EF444422;color:#F87171">🗑 Excluir</button>
                  </form>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

  const body = `
    ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Produto salvo com sucesso!</div>` : ""}
    ${deleted ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:var(--success);padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">✅ Produto excluído com sucesso!</div>` : ""}
    ${formHtml}
    <div class="card">
      <div class="card-header"><div class="card-title">📦 Produtos Cadastrados (${products.length})</div></div>
      <div class="card-body">${tableHtml}</div>
    </div>
  `;
  res.send(adminLayout("Produtos", "produtos", body, barber?.name));
}
'''

if old_prod:
    content = content[:prod_start] + new_produtos + content[next_func:]
else:
    # Inserir antes de renderFinanceiro
    fin_idx = content.find('// ─── Financeiro')
    if fin_idx == -1:
        fin_idx = content.find('async function renderFinanceiro(')
    content = content[:fin_idx] + new_produtos + '\n' + content[fin_idx:]

# ── 3. Adicionar link "Produtos" no menu de navegação do adminLayout ──────────
# Verificar se já existe link para produtos
if '"/admin/produtos"' not in content:
    content = content.replace(
        '{ href: "/admin/servicos", label: "✂️ Serviços" }',
        '{ href: "/admin/servicos", label: "✂️ Serviços" },\n    { href: "/admin/produtos", label: "📦 Produtos" }'
    )

# ── 4. Adicionar rotas CRUD no registerAdminRoutes ────────────────────────────
routes_to_add = '''
  // ─── CRUD Serviços ────────────────────────────────────────────────────────
  app.get("/admin/servicos", requireAdminAuth, (req, res) => renderServicos(req, res));
  app.post("/admin/servicos", requireAdminAuth, async (req: Request, res: Response) => {
    const { name, description, price, durationMinutes, isActive } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    if (editId) {
      await db.updateService(editId, { name, description, price, durationMinutes: parseInt(durationMinutes), isActive: isActive === "true" });
    } else {
      await db.createService({ name, description, price, durationMinutes: parseInt(durationMinutes), isActive: isActive === "true" });
    }
    res.redirect("/admin/servicos?saved=1");
  });
  app.post("/admin/servicos/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, isActive } = req.body;
    await db.updateService(parseInt(id), { isActive: isActive === "true" });
    res.redirect("/admin/servicos");
  });
  app.post("/admin/servicos/delete", requireAdminAuth, async (req: Request, res: Response) => {
    const { id } = req.body;
    await db.deleteService(parseInt(id));
    res.redirect("/admin/servicos?deleted=1");
  });

  // ─── CRUD Produtos ────────────────────────────────────────────────────────
  app.get("/admin/produtos", requireAdminAuth, (req, res) => renderProdutos(req, res));
  app.post("/admin/produtos", requireAdminAuth, async (req: Request, res: Response) => {
    const { name, description, price, productType, stockQuantity, minStockAlert, isActive } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;
    if (editId) {
      await db.updateProduct(editId, { name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true" });
    } else {
      await db.createProduct({ name, description, price, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true" });
    }
    res.redirect("/admin/produtos?saved=1");
  });
  app.post("/admin/produtos/toggle", requireAdminAuth, async (req: Request, res: Response) => {
    const { id, isActive } = req.body;
    await db.updateProduct(parseInt(id), { isActive: isActive === "true" });
    res.redirect("/admin/produtos");
  });
  app.post("/admin/produtos/delete", requireAdminAuth, async (req: Request, res: Response) => {
    const { id } = req.body;
    await db.deleteProduct(parseInt(id));
    res.redirect("/admin/produtos?deleted=1");
  });
'''

# Inserir antes do fechamento do registerAdminRoutes
close_marker = '  app.get("/admin/clientes/:id"'
if close_marker in content:
    content = content.replace(close_marker, routes_to_add + '\n' + close_marker, 1)

# ── 5. Remover rota duplicada de /admin/servicos se existir ───────────────────
# Remover a linha antiga: app.get("/admin/servicos", requireAdminAuth, (req, res) => renderServicos(req, res));
# que pode estar no bloco de rotas original
lines = content.split('\n')
seen_servicos_get = False
seen_produtos_get = False
new_lines = []
for line in lines:
    stripped = line.strip()
    if stripped == 'app.get("/admin/servicos", requireAdminAuth, (req, res) => renderServicos(req, res));':
        if seen_servicos_get:
            continue  # pular duplicata
        seen_servicos_get = True
    if stripped == 'app.get("/admin/produtos", requireAdminAuth, (req, res) => renderProdutos(req, res));':
        if seen_produtos_get:
            continue
        seen_produtos_get = True
    new_lines.append(line)
content = '\n'.join(new_lines)

with open('/home/ubuntu/barber_app/server/admin-routes.ts', 'w') as f:
    f.write(content)

print("OK: CRUD de serviços e produtos adicionado ao admin-routes.ts")
