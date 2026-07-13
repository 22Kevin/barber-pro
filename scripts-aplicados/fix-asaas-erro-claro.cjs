const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Melhorar mensagem de erro 403 do Asaas com diagnóstico claro
patch('server/admin-routes.ts',
  `      // Criar subconta no Asaas
      const subAccount = await createAsaasSubAccount({`,
  `      // Verificar se a chave API é válida para criar subcontas (precisa ser chave master)
      if (!process.env.ASAAS_API_KEY || process.env.ASAAS_API_KEY.length < 10) {
        res.redirect("/admin/configuracoes?tab=pagamentos&error=" + encodeURIComponent("Chave Asaas não configurada no servidor")); return;
      }

      // Criar subconta no Asaas
      const subAccount = await createAsaasSubAccount({`,
  'validação chave Asaas antes de criar subconta'
);

// Melhorar o catch para exibir mensagem do Asaas
patch('server/admin-routes.ts',
  `    } catch (e: any) {
      console.error("[asaas/setup]", e.message, e.response?.data);
      res.redirect("/admin/configuracoes?tab=pagamentos&error=" + encodeURIComponent(e.response?.data?.errors?.[0]?.description || e.message || "Erro ao criar conta"));
    }
  });

  // POST /admin/configuracoes/asaas/sync`,
  `    } catch (e: any) {
      const asaasMsg = e.response?.data?.errors?.[0]?.description
        || e.response?.data?.error
        || e.response?.data?.message
        || e.message
        || "Erro ao criar conta";
      const statusCode = e.response?.status;
      console.error("[asaas/setup] status:", statusCode, "msg:", asaasMsg, "data:", JSON.stringify(e.response?.data ?? {}));
      const userMsg = statusCode === 403
        ? "Acesso negado pelo Asaas. Verifique se a chave API é da conta master (não de subconta)."
        : statusCode === 400
        ? "Dados inválidos: " + asaasMsg
        : asaasMsg;
      res.redirect("/admin/configuracoes?tab=pagamentos&error=" + encodeURIComponent(userMsg));
    }
  });

  // POST /admin/configuracoes/asaas/sync`,
  'mensagem de erro Asaas mais clara'
);

console.log('\nTotal: ' + ok + '/2');

// Adicionar log detalhado no catch existente
const fs2 = require('fs');
let c2 = fs2.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
const old2 = `    } catch (e: any) {
      const msg = encodeURIComponent(e?.response?.data?.errors?.[0]?.description ?? e.message ?? "Erro ao criar conta");
      res.redirect(\`/admin/configuracoes?tab=pagamentos&error=\${msg}\`);
    }
  });

  // POST /admin/configuracoes/asaas/sync`;
const new2 = `    } catch (e: any) {
      const statusCode = e.response?.status;
      const asaasMsg = e?.response?.data?.errors?.[0]?.description ?? e?.response?.data?.error ?? e.message ?? "Erro ao criar conta";
      console.error("[asaas/setup] status:", statusCode, "msg:", asaasMsg, "body:", JSON.stringify(e?.response?.data ?? {}));
      const userMsg = statusCode === 403
        ? "Acesso negado pelo Asaas (403). Verifique se a ASAAS_API_KEY é da conta master."
        : statusCode === 400
        ? "Dados inválidos: " + asaasMsg
        : asaasMsg;
      res.redirect(\`/admin/configuracoes?tab=pagamentos&error=\${encodeURIComponent(userMsg)}\`);
    }
  });

  // POST /admin/configuracoes/asaas/sync`;
if (c2.includes(old2)) {
  c2 = c2.replace(old2, new2);
  fs2.writeFileSync('server/admin-routes.ts', c2, 'utf8');
  console.log('OK: catch setup com log e msg 403');
} else console.log('MISS: catch setup');
