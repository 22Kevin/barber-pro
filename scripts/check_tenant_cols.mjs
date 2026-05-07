import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '/home/ubuntu/barber_app/.env' });

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const tables = ['barbers','clients','services','products','appointments','sales','expenses','coupons','loyalty_config','loyalty_rewards','working_hours','blocked_slots','commission_configs','commission_entries','waitlist','return_message_configs','promotions','categories','shop_settings','reviews','subscription_plans','client_accounts','media_files','sale_items','client_points','coupon_uses'];
for (const t of tables) {
  try {
    const [rows] = await conn.execute('DESCRIBE ' + t);
    const cols = rows.map(r => r.Field);
    const hasTenant = cols.includes('tenantId');
    if (hasTenant) {
      console.log('HAS_TENANT: ' + t);
    } else {
      console.log('NO_TENANT: ' + t + ' -> ' + cols.join(','));
    }
  } catch(e) { console.log('MISSING: ' + t); }
}
await conn.end();
