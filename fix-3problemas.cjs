const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1: auto-migrate — adicionar coluna cpfCnpj se não existir
// ═══════════════════════════════════════════════════════════════════════════
patch('server/auto-migrate.ts',
  `    // ── Filiais (Plano Estúdio) ──────────────────────────────────────────────`,
  `    // ── used_trials: coluna cpfCnpj pode não existir em bancos antigos ────────
    { name: 'used_trials."cpfCnpj"', sql: \`ALTER TABLE used_trials ADD COLUMN IF NOT EXISTS "cpfCnpj" VARCHAR(20)\` },
    // ── Filiais (Plano Estúdio) ──────────────────────────────────────────────`,
  'auto-migrate cpfCnpj em used_trials'
);

// ═══════════════════════════════════════════════════════════════════════════
// FIX 2: cancelamento — não deixar o insert de used_trials travar o cancel
//         e garantir redirect correto mesmo sem Asaas configurado
// ═══════════════════════════════════════════════════════════════════════════
patch('server/admin-routes.ts',
  `        await dbConn.execute(sql\`
          INSERT INTO used_trials (email, "cpfCnpj", "tenantId", reason)
          VALUES (
            \${barber.email.toLowerCase()},
            \${cleanCpfCnpj ?? null},
            \${barber.tenantId},
            'cancelled'
          )
          ON CONFLICT DO NOTHING
        \`);
      } catch {}`,
  `        // Usar rawQuery para evitar erro de coluna não existente
        if (!_pool) await db.getDb();
        if (_pool) {
          await _pool.query(
            \`INSERT INTO used_trials (email, "cpfCnpj", "tenantId", reason)
             VALUES ($1, $2, $3, 'cancelled') ON CONFLICT DO NOTHING\`,
            [barber.email.toLowerCase(), cleanCpfCnpj ?? null, barber.tenantId]
          ).catch(() => {});
        }
      } catch {}`,
  'cancelamento usa rawQuery para used_trials'
);

// ═══════════════════════════════════════════════════════════════════════════
// FIX 3: onboarding — plano correto passado ao submitRegistration
// O bug: submitRegistration lê currentPlan mas o modal pode ter sido aberto
// com nome em português (Estúdio) e a comparação falhava por encoding
// ═══════════════════════════════════════════════════════════════════════════
patch('server/landing/index.html',
  `,plan=currentPlan.toLowerCase()==='equipe'?'team':(currentPlan.toLowerCase()==='est\\u00fadio'||currentPlan.toLowerCase()==='studio'?'studio':'solo')`,
  `,plan=(function(){var p=String(currentPlan||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');return p==='equipe'||p==='team'?'team':p==='studio'||p==='estudio'?'studio':'solo';})()`,
  'plano correto no onboarding (normalize NFD)'
);

console.log('\nTotal: ' + ok + '/3');
