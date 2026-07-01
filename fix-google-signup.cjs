const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// ── FIX: ao voltar do Google, restaurar plano e dados do sessionStorage ───────
// e pular direto para o step 4 (email/senha) sem precisar redigitar tudo
patch('server/landing/index.html',
`    if(params.get('google_signup')==='1'){
      var name = params.get('name')||'';
      var email = params.get('email')||'';
      var openId = params.get('openId')||'';
      // Abrir modal no step 1, pré-preenchendo dados do Google nos passos corretos
      openModal('Equipe','R$99,90');
      showStep(1);
      // Guardar dados do Google para preencher no step 4
      window._googleOpenId=openId;
      window._googleEmail=email;
      window._googleName=name;
      window._isGoogleSignup=true;
      // Pré-preencher nome e email do admin quando chegar no step 4
      window._googlePendingFill=true;
      // Limpar URL
      history.replaceState(null,'',window.location.pathname);
    }`,
`    if(params.get('google_signup')==='1'){
      var name = params.get('name')||'';
      var email = params.get('email')||'';
      var openId = params.get('openId')||'';
      // Guardar dados do Google
      window._googleOpenId=openId;
      window._googleEmail=email;
      window._googleName=name;
      window._isGoogleSignup=true;
      // Restaurar dados do sessionStorage (plano, nome da barbearia, etc.)
      var savedRaw = sessionStorage.getItem('signupData');
      var saved = null;
      try { saved = savedRaw ? JSON.parse(savedRaw) : null; } catch(e) {}
      // Abrir modal com o plano correto
      var planLabel = 'Equipe'; var planPrice = 'R$99,90';
      if (saved && saved.plan) {
        var pl = String(saved.plan).toLowerCase();
        if (pl === 'solo') { planLabel = 'Solo'; planPrice = 'R$49,90'; }
        else if (pl === 'studio' || pl === 'estúdio') { planLabel = 'Estúdio'; planPrice = 'R$169,90'; }
        else { planLabel = 'Equipe'; planPrice = 'R$99,90'; }
      }
      openModal(planLabel, planPrice);
      // Restaurar campos já preenchidos
      if (saved) {
        if (saved.shopName && document.getElementById('inputNomeBarbearia')) document.getElementById('inputNomeBarbearia').value = saved.shopName;
        if (saved.phone && document.getElementById('inputTelefone')) document.getElementById('inputTelefone').value = saved.phone;
        if (saved.city && document.getElementById('inputCidade')) document.getElementById('inputCidade').value = saved.city;
        if (saved.state && document.getElementById('inputEstado')) document.getElementById('inputEstado').value = saved.state;
      }
      // Pré-preencher nome e email do admin no step 4
      setTimeout(function() {
        var elName = document.getElementById('inputNomeAdmin');
        var elEmail = document.getElementById('inputEmail');
        var elSenha = document.getElementById('inputSenha');
        var elSenhaC = document.getElementById('inputSenhaConfirm');
        if (elName) elName.value = name;
        if (elEmail) elEmail.value = email;
        // Campos de senha ficam ocultos/opcionais para login Google
        if (elSenha) { elSenha.disabled = true; elSenha.closest && elSenha.closest('.form-field') && (elSenha.closest('.form-field').style.display = 'none'); }
        if (elSenhaC) { elSenhaC.disabled = true; elSenhaC.closest && elSenhaC.closest('.form-field') && (elSenhaC.closest('.form-field').style.display = 'none'); }
      }, 100);
      // Se tinha dados salvos, pular direto para step 4 (só falta confirmar email)
      // Se não tinha, começa do step 1 para preencher os dados
      if (saved && saved.shopName) {
        showStep(4);
      } else {
        showStep(1);
      }
      sessionStorage.removeItem('signupData');
      history.replaceState(null,'',window.location.pathname);
    }`,
'fix google-signup: restaurar plano + pular para step correto');

// ── FIX: startGoogleSignup salvar TODOS os dados, não só nome/tel/cidade/estado
// Salvar também cnpj, dias, horários, endereço para restaurar completamente
patch('server/landing/index.html',
`function startGoogleSignup(){var nome=document.getElementById('inputNomeBarbearia').value,tel=document.getElementById('inputTelefone').value,cidade=document.getElementById('inputCidade').value,estado=document.getElementById('inputEstado').value;sessionStorage.setItem('signupData',JSON.stringify({plan:currentPlan,price:currentPrice,shopName:nome,phone:tel,city:cidade,state:estado}));window.location.href='/admin/google-signup';}`,
`function startGoogleSignup(){
  var nome=document.getElementById('inputNomeBarbearia')?document.getElementById('inputNomeBarbearia').value:'';
  var tel=document.getElementById('inputTelefone')?document.getElementById('inputTelefone').value:'';
  var cidade=document.getElementById('inputCidade')?document.getElementById('inputCidade').value:'';
  var estado=document.getElementById('inputEstado')?document.getElementById('inputEstado').value:'';
  var cnpj=document.getElementById('inputCnpj')?document.getElementById('inputCnpj').value:'';
  var cep=document.getElementById('inputCep')?document.getElementById('inputCep').value:'';
  var rua=document.getElementById('inputRua')?document.getElementById('inputRua').value:'';
  var numero=document.getElementById('inputNumero')?document.getElementById('inputNumero').value:'';
  var abertura=document.getElementById('inputAbertura')?document.getElementById('inputAbertura').value:'09:00';
  var fechamento=document.getElementById('inputFechamento')?document.getElementById('inputFechamento').value:'19:00';
  sessionStorage.setItem('signupData',JSON.stringify({
    plan:currentPlan,price:currentPrice,shopName:nome,phone:tel,city:cidade,state:estado,
    cnpj:cnpj,cep:cep,address:rua,addressNumber:numero,openTime:abertura,closeTime:fechamento,
    workDays:activeDays
  }));
  window.location.href='/admin/google-signup';
}`,
'startGoogleSignup salva todos os campos');

// ── FIX: restaurar campos adicionais quando voltar do Google ─────────────────
patch('server/landing/index.html',
`        if (saved.city && document.getElementById('inputCidade')) document.getElementById('inputCidade').value = saved.city;
        if (saved.state && document.getElementById('inputEstado')) document.getElementById('inputEstado').value = saved.state;`,
`        if (saved.city && document.getElementById('inputCidade')) document.getElementById('inputCidade').value = saved.city;
        if (saved.state && document.getElementById('inputEstado')) document.getElementById('inputEstado').value = saved.state;
        if (saved.cnpj && document.getElementById('inputCnpj')) document.getElementById('inputCnpj').value = saved.cnpj;
        if (saved.cep && document.getElementById('inputCep')) document.getElementById('inputCep').value = saved.cep;
        if (saved.address && document.getElementById('inputRua')) document.getElementById('inputRua').value = saved.address;
        if (saved.addressNumber && document.getElementById('inputNumero')) document.getElementById('inputNumero').value = saved.addressNumber;
        if (saved.openTime && document.getElementById('inputAbertura')) document.getElementById('inputAbertura').value = saved.openTime;
        if (saved.closeTime && document.getElementById('inputFechamento')) document.getElementById('inputFechamento').value = saved.closeTime;
        if (saved.workDays && Array.isArray(saved.workDays)) activeDays = saved.workDays;`,
'restaurar campos adicionais do sessionStorage');

console.log('\nTotal: ' + ok + '/3');
