-- Índices de performance para colunas tenantId e campos frequentemente consultados
-- Executar no PostgreSQL Railway

-- Tabelas com tenantId direto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_barbers_tenant_id ON barbers("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_barbers_tenant_active ON barbers("tenantId", "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_tenant_id ON clients("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_tenant_active ON clients("tenantId", "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_tenant_id ON services("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_tenant_active ON services("tenantId", "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant_id ON products("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant_active ON products("tenantId", "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupons_tenant_id ON coupons("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_tenant_id ON promotions("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_settings_tenant_id ON shop_settings("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_config_tenant_id ON loyalty_config("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_rewards_tenant_id ON loyalty_rewards("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_tenant_id ON sales("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_tenant_id ON expenses("tenantId");

-- Índices em colunas de data (frequentemente filtradas)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_barber_date ON appointments("barberId", date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_date ON expenses(date);

-- Índices em colunas de status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_barber_status ON appointments("barberId", status);

-- Índice para busca de clientes por nome
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_name ON clients(name);

-- Índice para busca de agendamentos por cliente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_client_id ON appointments("clientId");

-- Índice para reviews
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_tenant_id ON reviews("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_client_id ON reviews("clientId");

-- Índice para waitlist
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_tenant_barber ON waitlist("tenantId", "barberId");

SELECT 'Índices criados com sucesso!' as status;
