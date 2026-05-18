#!/usr/bin/env python3
"""
Adiciona o 6º argumento (breadcrumb) nas chamadas adminLayout do admin-routes.ts.
Estratégia: substituir cada chamada específica pelo padrão de texto exato.
"""

import re

with open("/home/ubuntu/barber_app/server/admin-routes.ts", "r") as f:
    content = f.read()

# Mapeamento: texto a encontrar → breadcrumb a adicionar
# Formato: (old_suffix, new_suffix)
# old_suffix é o final da chamada adminLayout antes do fechamento )
# new_suffix é o que substitui

replacements = [
    # Dashboard — nível 1, sem breadcrumb (é a raiz)
    # Agenda
    (
        'adminLayout(`Agenda — ${fmtDate(dateStr)}`, "agenda", body, barber?.name, _tp)',
        'adminLayout(`Agenda — ${fmtDate(dateStr)}`, "agenda", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Agenda",href:"/admin/agenda"}])'
    ),
    # Clientes (lista)
    (
        'adminLayout("Clientes", "clientes", body, barber?.name, _tp)',
        'adminLayout("Clientes", "clientes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Clientes",href:"/admin/clientes"}])'
    ),
    # Serviços
    (
        'adminLayout("Serviços", "servicos", body, barber?.name, _tp)',
        'adminLayout("Serviços", "servicos", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Serviços",href:"/admin/servicos"}])'
    ),
    # Produtos
    (
        'adminLayout("Produtos", "produtos", body, barber?.name, _tp)',
        'adminLayout("Produtos", "produtos", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Produtos",href:"/admin/produtos"}])'
    ),
    # Financeiro
    (
        'adminLayout("Financeiro", "financeiro", body, barber?.name, _tp)',
        'adminLayout("Financeiro", "financeiro", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Financeiro",href:"/admin/financeiro"}])'
    ),
    # Configurações
    (
        'adminLayout("Configurações", "configuracoes", body, barber?.name, _tp)',
        'adminLayout("Configurações", "configuracoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Configurações",href:"/admin/configuracoes"}])'
    ),
    # Novo Agendamento
    (
        'adminLayout("Novo Agendamento", "agenda", body, barber?.name, _tp)',
        'adminLayout("Novo Agendamento", "agenda", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Agenda",href:"/admin/agenda"},{label:"Novo Agendamento",href:"/admin/novo-agendamento"}])'
    ),
    # Relatórios
    (
        'adminLayout("Relatórios", "relatorios", body, barber?.name, _tp)',
        'adminLayout("Relatórios", "relatorios", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Relatórios",href:"/admin/relatorios"}])'
    ),
    # Página do Cliente
    (
        'adminLayout("Página do Cliente", "pagina-cliente", body, barber?.name, _tp)',
        'adminLayout("Página do Cliente", "pagina-cliente", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Página do Cliente",href:"/admin/pagina-cliente"}])'
    ),
    # Cliente individual
    (
        'adminLayout(`Cliente: ${(client as any).name}`, "clientes", body, barber?.name, _tp)',
        'adminLayout(`Cliente: ${(client as any).name}`, "clientes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Clientes",href:"/admin/clientes"},{label:(client as any).name,href:"#"}])'
    ),
    # Fidelidade
    (
        'adminLayout("Fidelidade", "fidelidade", body, barber?.name, _tp)',
        'adminLayout("Fidelidade", "fidelidade", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Fidelidade",href:"/admin/fidelidade"}])'
    ),
    # Cupons
    (
        'adminLayout("Cupons", "cupons", body, barber?.name, _tp)',
        'adminLayout("Cupons", "cupons", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Fidelidade",href:"/admin/fidelidade"},{label:"Cupons",href:"/admin/cupons"}])'
    ),
    # Avaliações
    (
        'adminLayout("Avaliações", "avaliacoes", body, barber?.name, _tp)',
        'adminLayout("Avaliações", "avaliacoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Avaliações",href:"/admin/avaliacoes"}])'
    ),
    # Comissões
    (
        'adminLayout("Comissões", "comissoes", body, barber?.name, _tp)',
        'adminLayout("Comissões", "comissoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Comissões",href:"/admin/comissoes"}])'
    ),
    # Lista de Espera
    (
        'adminLayout("Lista de Espera", "lista-espera", body, barber?.name, _tp)',
        'adminLayout("Lista de Espera", "lista-espera", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Lista de Espera",href:"/admin/lista-espera"}])'
    ),
    # Assinaturas
    (
        'adminLayout("Assinaturas", "assinaturas", body, barber?.name, _tp)',
        'adminLayout("Assinaturas", "assinaturas", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Assinaturas",href:"/admin/assinaturas"}])'
    ),
    # Planos de Assinatura
    (
        'adminLayout("Planos de Assinatura", "planos", body, barber?.name, _tp)',
        'adminLayout("Planos de Assinatura", "planos", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Planos de Assinatura",href:"/admin/planos"}])'
    ),
    # Estoque
    (
        'adminLayout("Estoque", "estoque", body, barber?.name, _tp)',
        'adminLayout("Estoque", "estoque", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Estoque",href:"/admin/estoque"}])'
    ),
    # Histórico de Estoque
    (
        'adminLayout(`Histórico — ${esc(product.name)}`, "estoque", body, barber?.name, _tp)',
        'adminLayout(`Histórico — ${esc(product.name)}`, "estoque", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Estoque",href:"/admin/estoque"},{label:`Histórico — ${esc(product.name)}`,href:"#"}])'
    ),
    # Retorno Automático
    (
        'adminLayout("Retorno Automático", "retorno-automatico", body, barber?.name, _tp)',
        'adminLayout("Retorno Automático", "retorno-automatico", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Retorno Automático",href:"/admin/retorno-automatico"}])'
    ),
    # Promoções
    (
        'adminLayout("Promoções", "promocoes", body, barber?.name, _tp)',
        'adminLayout("Promoções", "promocoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Promoções",href:"/admin/promocoes"}])'
    ),
    # Conversão de Promoções
    (
        'adminLayout("Conversão de Promoções", "conversao-promocoes", body, barber?.name, _tp)',
        'adminLayout("Conversão de Promoções", "conversao-promocoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Promoções",href:"/admin/promocoes"},{label:"Conversão",href:"/admin/conversao-promocoes"}])'
    ),
    # Meu Perfil
    (
        'adminLayout("Meu Perfil", "meu-perfil", body, barber?.name, _tp)',
        'adminLayout("Meu Perfil", "meu-perfil", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Meu Perfil",href:"/admin/meu-perfil"}])'
    ),
    # Chat WhatsApp (lista)
    (
        'adminLayout("Chat WhatsApp", "chat", body, barber?.name, _tp)',
        'adminLayout("Chat WhatsApp", "chat", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Chat WhatsApp",href:"/admin/chat"}])'
    ),
    # Chat individual
    (
        'adminLayout(`Chat — ${client.name}`, "chat", body, barber?.name, _tp)',
        'adminLayout(`Chat — ${client.name}`, "chat", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Chat WhatsApp",href:"/admin/chat"},{label:client.name,href:"#"}])'
    ),
    # Minhas Comissões
    (
        'adminLayout("Minhas Comissões", "minhas-comissoes", body, barber?.name, _tp)',
        'adminLayout("Minhas Comissões", "minhas-comissoes", body, barber?.name, _tp, [{label:"Dashboard",href:"/admin"},{label:"Minhas Comissões",href:"/admin/minhas-comissoes"}])'
    ),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"✅ Substituído: {old[:60]}...")
    else:
        print(f"⚠️  NÃO encontrado: {old[:60]}...")

with open("/home/ubuntu/barber_app/server/admin-routes.ts", "w") as f:
    f.write(content)

print(f"\nTotal: {count}/{len(replacements)} substituições realizadas")
