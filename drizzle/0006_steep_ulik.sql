CREATE INDEX "idx_appointments_barber_date_status" ON "appointments" USING btree ("barberId","date","status");--> statement-breakpoint
CREATE INDEX "idx_appointments_client_id" ON "appointments" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_appointments_date" ON "appointments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_appointments_status_date" ON "appointments" USING btree ("status","date");--> statement-breakpoint
CREATE INDEX "idx_sales_barber_date" ON "sales" USING btree ("barberId","createdAt");--> statement-breakpoint
CREATE INDEX "idx_sales_client_id" ON "sales" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_sales_payment_status" ON "sales" USING btree ("paymentStatus");