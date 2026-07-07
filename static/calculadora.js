// Motor de cálculo ao vivo — espelha calculo.py para dar feedback instantâneo.
// O valor gravado de verdade é sempre recalculado no servidor ao salvar.

function brl(v) {
  return 'R$ ' + Math.max(0, v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function atualizar() {
  advertencia = document.getElementById('g-adv').checked;
  desvio = document.getElementById('g-dev').checked;

  const teto = gerenteInfo.teto;
  const tetoA = teto * gerenteInfo.peso_a / 100;
  const tetoB = teto * gerenteInfo.peso_b / 100;
  const tetoC = teto * gerenteInfo.peso_c / 100;
  document.getElementById('h-A').textContent = brl(tetoA);
  document.getElementById('h-B').textContent = brl(tetoB);
  document.getElementById('h-C').textContent = brl(tetoC);
  document.getElementById('r-teto-lbl').textContent = brl(teto);

  const { total: rawA, gatilho: gatilhoA } = renderBloco('A', tetoA);
  const { total: rawB, gatilho: gatilhoB } = renderBloco('B', tetoB);
  const { total: rawC, gatilho: gatilhoC } = renderBloco('C', tetoC);

  let totalA = rawA, totalB = rawB, totalC = rawC;
  if (desvio) { totalA = totalB = totalC = 0; }
  else if (advertencia) { totalA *= 0.7; totalB *= 0.7; totalC *= 0.7; }

  const total = totalA + totalB + totalC;
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
  if (desvio) html += '<div class="alert-box a-danger">⛔ Desvio de conduta — premiação zerada</div>';
  else if (advertencia) html += '<div class="alert-box a-warn">⚠ Advertência formal — desconto de 30%</div>';
  if (gatilhoA) html += '<div class="alert-box a-danger">⛔ Gatilho do Bloco A disparado — bloco zerado</div>';
  if (gatilhoB) html += '<div class="alert-box a-danger">⛔ Gatilho do Bloco B disparado — bloco zerado</div>';
  if (gatilhoC) html += '<div class="alert-box a-danger">⛔ Gatilho do Bloco C disparado — bloco zerado</div>';
  if (!desvio && !gatilhoA && !gatilhoB && !gatilhoC && total >= teto * 0.99) html += '<div class="alert-box a-ok">✅ Premiação máxima — excelência total</div>';
  document.getElementById('r-alerts').innerHTML = html;
}

function salvar() {
  const msg = document.getElementById('msg-salvar');
  msg.textContent = 'Salvando...';
  fetch(SALVAR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
    body: JSON.stringify({ itens, advertencia, desvio }),
  })
    .then(r => r.json().then(data => ({ status: r.status, data })))
    .then(({ status, data }) => {
      if (status !== 200) throw new Error(data.erro || 'Falha ao salvar');
      msg.textContent = 'Salvo às ' + new Date().toLocaleTimeString('pt-BR');
    })
    .catch(err => { msg.textContent = 'Erro ao salvar: ' + err.message; });
}

['A', 'B', 'C'].forEach(montarBloco);
atualizar();
