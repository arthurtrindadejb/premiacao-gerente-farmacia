"""Fórmula de premiação — função pura, sem Flask nem banco.

Usada tanto para calcular quanto para validar o que foi enviado pelo
navegador: o valor gravado nunca é aceito sem ser recalculado aqui.
"""


def atingimento(realizado, meta, inverso):
    if meta <= 0:
        return 0.0
    if not inverso:
        return realizado / meta
    # menor é melhor (ex.: turnover): realizado=0 -> 200%, realizado=meta -> 100%
    return (2 * meta - realizado) / meta


def multiplicador(ating, minimo_pct, teto_pct, mult_min, mult_max):
    minimo = minimo_pct / 100
    teto = teto_pct / 100
    if ating < minimo:
        return 0.0
    if ating <= 1.0:
        if minimo >= 1.0:
            return 1.0
        fracao = (ating - minimo) / (1.0 - minimo)
        return mult_min + fracao * (1.0 - mult_min)
    if ating <= teto:
        if teto <= 1.0:
            return 1.0
        fracao = (ating - 1.0) / (teto - 1.0)
        return 1.0 + fracao * (mult_max - 1.0)
    return mult_max


def calcular_item(item, teto_bloco, gatilho_disparado):
    """item: dict com meta, peso, realizado, inverso, minimo_pct, teto_pct, mult_min, mult_max."""
    ating = atingimento(item["realizado"], item["meta"], item["inverso"])
    if gatilho_disparado:
        premio = 0.0
    else:
        mult = multiplicador(
            ating, item["minimo_pct"], item["teto_pct"], item["mult_min"], item["mult_max"]
        )
        teto_item = teto_bloco * item["peso"] / 100
        premio = teto_item * mult
    return ating, premio


def calcular_bloco(itens, teto_bloco):
    gatilho_disparado = any(
        item["eh_gatilho"]
        and atingimento(item["realizado"], item["meta"], item["inverso"]) < item["minimo_pct"] / 100
        for item in itens
    )

    total = 0.0
    premios = []
    for item in itens:
        ating, premio = calcular_item(item, teto_bloco, gatilho_disparado)
        premios.append(premio)
        total += premio

    total = min(teto_bloco, total)
    return total, gatilho_disparado, premios


def calcular_mes(gerente, itens_por_bloco, advertencia, desvio):
    """gerente: dict com teto, peso_a, peso_b, peso_c.
    itens_por_bloco: {'A': [...], 'B': [...], 'C': [...]}.

    Retorna dict com totais por bloco, gatilhos disparados, prêmio calculado
    por item (na mesma ordem de entrada) e o total do mês.
    """
    teto_a = gerente["teto"] * gerente["peso_a"] / 100
    teto_b = gerente["teto"] * gerente["peso_b"] / 100
    teto_c = gerente["teto"] * gerente["peso_c"] / 100

    total_a, gatilho_a, premios_a = calcular_bloco(itens_por_bloco.get("A", []), teto_a)
    total_b, gatilho_b, premios_b = calcular_bloco(itens_por_bloco.get("B", []), teto_b)
    total_c, gatilho_c, premios_c = calcular_bloco(itens_por_bloco.get("C", []), teto_c)

    if desvio:
        total_a = total_b = total_c = 0.0
    elif advertencia:
        total_a *= 0.7
        total_b *= 0.7
        total_c *= 0.7

    total = total_a + total_b + total_c

    return {
        "teto_a": teto_a,
        "teto_b": teto_b,
        "teto_c": teto_c,
        "total_a": total_a,
        "total_b": total_b,
        "total_c": total_c,
        "total": total,
        "gatilho_a": gatilho_a,
        "gatilho_b": gatilho_b,
        "gatilho_c": gatilho_c,
        "premios": {"A": premios_a, "B": premios_b, "C": premios_c},
    }
