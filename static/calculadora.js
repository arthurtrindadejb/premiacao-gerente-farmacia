// Motor de cálculo ao vivo — espelha calculo.py para dar feedback instantâneo.
// O valor gravado de verdade é sempre recalculado no servidor ao salvar.

function brl(v) {
  return 'R$ ' + Math.max(0, v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Como os ajustes podem ser negativos (penalidade), essa versão não trava em zero.
function brlSinal(v) {
  const sinal = v < 0 ? '-' : '';
  return sinal + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function atingimento(item) {
  if (item.meta <= 0) return 0;
  if (!item.inverso) return item.realizado / item.meta;
  return (2 * item.meta - item.realizado) / item.meta;
}

function multiplicador(ating, minimoPct, tetoPct, multMin, multMax) {
  const minimo = minimoPct / 100;
  const teto = tetoPct / 100;
  if (ating < minimo) return 0;
  if (ating <= 1.0) {
    if (minimo >= 1.0) return 1.0;
    const fracao = (ating - minimo) / (1.0 - minimo);
    return multMin + fracao * (1.0 - multMin);
  }
  if (ating <= teto) {
    if (teto <= 1.0) return 1.0;
    const fracao = (ating - 1.0) / (teto - 1.0);
    return 1.0 + fracao * (multMax - 1.0);
  }
  return multMax;
}

function calcularBloco(lista, tetoBloco) {
  const gatilho = lista.some(it => it.eh_gatilho && atingimento(it) < it.minimo_pct / 100);
  let total = 0;
  const premios = lista.map(it => {
    if (gatilho) return 0;
    const mult = multiplicador(atingimento(it), it.minimo_pct, it.teto_pct, it.mult_min, it.mult_max);
    const multMax = it.mult_max || 1.0;
    const premio = (tetoBloco * it.peso / 100) * (mult / multMax);
    total += premio;
    return premio;
  });
  total = Math.min(tetoBloco, total);
  return { total, gatilho, premios };
}

function parseNumero(texto) {
  const limpo = String(texto).trim().replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

// Monta as linhas da tabela uma única vez (não é chamado a cada tecla digitada,
// pra não perder o foco/cursor de quem está preenchendo o "Realizado").
function montarBloco(bloco) {
  const tbody = document.getElementById('tbody-' + bloco);
  tbody.innerHTML = '';
  itens[bloco].forEach((it, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.nome}${it.eh_gatilho ? ' <span title="Gatilho do bloco" style="color:#c2410c;">⚑</span>' : ''}</td>
      <td>${it.meta.toLocaleString('pt-BR')}${it.inverso ? ' <small style="color:var(--gray-400);">(mín)</small>' : ''}</td>
      <td>${it.peso}%</td>
      <td><input class="ci ci-val" type="text" inputmode="decimal" autocomplete="off" value="${it.realizado}" oninput="alterarRealizado('${bloco}',${i},this.value)"></td>
      <td id="ating-${bloco}-${i}">0%</td>
      <td><input class="ci ci-calc" id="calc-${bloco}-${i}" readonly value="R$ 0,00"></td>
      <td class="td-status no-print"><span class="dot" id="dot-${bloco}-${i}"></span></td>`;
    tbody.appendChild(tr);
  });
}

// Só atualiza os valores calculados (não recria os campos de digitação).
function renderBloco(bloco, tetoBloco) {
  const { total, gatilho, premios } = calcularBloco(itens[bloco], tetoBloco);

  itens[bloco].forEach((it, i) => {
    const ating = atingimento(it);
    document.getElementById('ating-' + bloco + '-' + i).textContent = (ating * 100).toFixed(0) + '%';
    document.getElementById('calc-' + bloco + '-' + i).value = brl(premios[i]);
    const dot = document.getElementById('dot-' + bloco + '-' + i);
    dot.className = 'dot ' + (ating >= 1 ? 'dot-ok' : ating >= it.minimo_pct / 100 ? 'dot-warn' : 'dot-fail');
  });

  document.getElementById('total-' + bloco).textContent = brl(total);
  return { total, gatilho };
}

function alterarRealizado(bloco, i, valor) {
  itens[bloco][i].realizado = parseNumero(valor);
  atualizar();
}

// Monta as linhas de ajustes uma única vez (chamado no início e após add/remover).
function montarAjustes() {
  const tbody = document.getElementById('tbody-ajustes');
  tbody.innerHTML = '';
  ajustes.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="ci ci-name" value="${String(a.nome).replace(/"/g, '&quot;')}" oninput="alterarAjusteNome(${i},this.value)" placeholder="Ex: bônus campanha, desconto uniforme..."></td>
      <td><input class="ci ci-val" type="text" inputmode="decimal" autocomplete="off" value="${a.valor}" oninput="alterarAjusteValor(${i},this.value)"></td>
      <td class="td-del no-print"><button type="button" class="btn-del" onclick="delAjuste(${i})" title="Remover">✕</button></td>`;
    tbody.appendChild(tr);
  });
}

function addAjuste() {
  ajustes.push({ nome: '', valor: 0 });
  montarAjustes();
  atualizar();
}

function delAjuste(i) {
  ajustes.splice(i, 1);
  montarAjustes();
  atualizar();
}

function alterarAjusteNome(i, valor) {
  ajustes[i].nome = valor;
}

function alterarAjusteValor(i, valor) {
  ajustes[i].valor = parseNumero(valor);
  atualizar();
}

function atualizar() {
  const teto = gerenteInfo.teto;
  const tetoA = teto * gerenteInfo.peso_a / 100;
  const tetoB = teto * gerenteInfo.peso_b / 100;
  const tetoC = teto * gerenteInfo.peso_c / 100;
  document.getElementById('h-A').textContent = brl(tetoA);
  document.getElementById('h-B').textContent = brl(tetoB);
  document.getElementById('h-C').textContent = brl(tetoC);
  document.getElementById('r-teto-lbl').textContent = brl(teto);

  const { total: totalA, gatilho: gatilhoA } = renderBloco('A', tetoA);
  const { total: totalB, gatilho: gatilhoB } = renderBloco('B', tetoB);
  const { total: totalC, gatilho: gatilhoC } = renderBloco('C', tetoC);

  const somaAjustes = ajustes.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
  document.getElementById('ajustes-total').textContent = brlSinal(somaAjustes);

  const bruto = totalA + totalB + totalC + somaAjustes;
  const total = Math.max(0, bruto);
  const pct = teto > 0 ? Math.min(100, total / teto * 100) : 0;

  document.getElementById('r-total').textContent = brl(total);
  document.getElementById('p-total').textContent = brl(total);
  document.getElementById('r-a').textContent = brl(totalA);
  document.getElementById('r-b').textContent = brl(totalB);
  document.getElementById('r-c').textContent = brl(totalC);
  document.getElementById('p-a').textContent = brl(totalA);
  document.getElementById('p-b').textContent = brl(totalB);
  document.getElementById('p-c').textContent = brl(totalC);
  document.getElementById('r-prog').style.width = pct.toFixed(1) + '%';
  document.getElementById('r-pct').textContent = pct.toFixed(0) + '% do Prêmio Total';

  let html = '';
  if (gatilhoA) html += '<div class="alert-box a-danger">⛔ Gatilho do Bloco A disparado — bloco zerado</div>';
  if (gatilhoB) html += '<div class="alert-box a-danger">⛔ Gatilho do Bloco B disparado — bloco zerado</div>';
  if (gatilhoC) html += '<div class="alert-box a-danger">⛔ Gatilho do Bloco C disparado — bloco zerado</div>';
  if (bruto < 0) html += '<div class="alert-box a-warn">⚠ Os ajustes descontam mais que o prêmio ganho — total travado em R$ 0,00</div>';
  if (!gatilhoA && !gatilhoB && !gatilhoC && bruto >= 0 && total >= teto * 0.99) html += '<div class="alert-box a-ok">✅ Premiação máxima — excelência total</div>';
  document.getElementById('r-alerts').innerHTML = html;
}

function salvar() {
  const msg = document.getElementById('msg-salvar');
  msg.textContent = 'Salvando...';
  fetch(SALVAR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
    body: JSON.stringify({ itens, ajustes }),
  })
    .then(r => r.json().then(data => ({ status: r.status, data })))
    .then(({ status, data }) => {
      if (status !== 200) throw new Error(data.erro || 'Falha ao salvar');
      msg.textContent = 'Salvo às ' + new Date().toLocaleTimeString('pt-BR');
    })
    .catch(err => { msg.textContent = 'Erro ao salvar: ' + err.message; });
}

['A', 'B', 'C'].forEach(montarBloco);
montarAjustes();
atualizar();
