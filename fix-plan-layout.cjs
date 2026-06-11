const fs = require('fs');
let content = fs.readFileSync('app/onboarding/plan-selection.tsx').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// Corrigir layout do cabeçalho
rep(
  `                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                      {plan.name}
                    </Text>
                    <Text style={[styles.planDesc, isSelected && styles.planDescSelected]}>
                      {plan.description}
                    </Text>
                  </View>
                  <View style={styles.priceBox}>
                    <Text style={[styles.priceCurrency, isSelected && styles.priceSelected]}>R$</Text>
                    <Text style={[styles.priceValue, isSelected && styles.priceSelected]}>
                      {(isAnnual ? PRICES.annual[plan.key] : PRICES.monthly[plan.key]).toFixed(2).replace(".", ",")}
                    </Text>
                    <Text style={[styles.pricePeriod, isSelected && styles.pricePeriodSelected]}>/mês</Text>
                  </View>
                  {isAnnual && (
                    <Text style={{ fontSize: 11, color: isSelected ? "#0A0A0A99" : "#666", marginTop: 2 }}>
                      Total anual R$ {PRICES.annualTotal[plan.key].toFixed(2).replace(".", ",")}
                    </Text>
                  )}`,
  `                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                      {plan.name}
                    </Text>
                    <Text style={[styles.planDesc, isSelected && styles.planDescSelected]}>
                      {plan.description}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={styles.priceBox}>
                      <Text style={[styles.priceCurrency, isSelected && styles.priceSelected]}>R$</Text>
                      <Text style={[styles.priceValue, isSelected && styles.priceSelected]}>
                        {(isAnnual ? PRICES.annual[plan.key] : PRICES.monthly[plan.key]).toFixed(2).replace(".", ",")}
                      </Text>
                      <Text style={[styles.pricePeriod, isSelected && styles.pricePeriodSelected]}>/mês</Text>
                    </View>
                    {isAnnual && (
                      <Text style={{ fontSize: 11, color: isSelected ? "#0A0A0A88" : "#666", marginTop: 2 }}>
                        Total R$ {PRICES.annualTotal[plan.key].toFixed(2).replace(".", ",")}
                      </Text>
                    )}
                  </View>`,
  'layout cabecalho'
);

fs.writeFileSync('app/onboarding/plan-selection.tsx', content, 'utf8');
console.log('Total: '+c+' mudancas');
