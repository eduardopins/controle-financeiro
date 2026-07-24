import { describe, it, expect } from "vitest";
import {
  brl, diffMonths, diffDays, addMonthsToKey, monthKeyFromDate,
  invoiceMonthForPurchase, isDueIn, monthlyValue, outstanding,
} from "../lib/domain";

describe("brl (formatação de moeda)", () => {
  it("formata valores positivos em Real", () => {
    const out = brl(1234.5);
    expect(out).toMatch(/^R\$\s?1\.234,50$/);
  });
  it("trata null/undefined como zero em vez de quebrar", () => {
    expect(brl(null)).toMatch(/^R\$\s?0,00$/);
    expect(brl(undefined)).toMatch(/^R\$\s?0,00$/);
  });
  it("formata valores negativos (reembolsos)", () => {
    expect(brl(-50)).toMatch(/^-R\$\s?50,00$/);
  });
});

describe("diffMonths", () => {
  it("conta meses entre duas chaves no mesmo ano", () => {
    expect(diffMonths("2026-01", "2026-04")).toBe(3);
  });
  it("conta meses virando o ano", () => {
    expect(diffMonths("2025-11", "2026-02")).toBe(3);
  });
  it("retorna negativo quando o destino é antes da origem", () => {
    expect(diffMonths("2026-05", "2026-02")).toBe(-3);
  });
  it("retorna zero pro mesmo mês", () => {
    expect(diffMonths("2026-07", "2026-07")).toBe(0);
  });
});

describe("addMonthsToKey", () => {
  it("soma meses dentro do mesmo ano", () => {
    expect(addMonthsToKey("2026-03", 2)).toBe("2026-05");
  });
  it("vira o ano ao somar além de dezembro", () => {
    expect(addMonthsToKey("2026-11", 3)).toBe("2027-02");
  });
  it("vira o ano pra trás ao subtrair antes de janeiro", () => {
    expect(addMonthsToKey("2026-01", -1)).toBe("2025-12");
  });
  it("lida com deslocamentos grandes (mais de 12 meses)", () => {
    expect(addMonthsToKey("2026-01", 14)).toBe("2027-03");
  });
});

describe("diffDays", () => {
  it("conta dias entre duas datas", () => {
    expect(diffDays("2026-07-01", "2026-07-10")).toBe(9);
  });
  it("retorna negativo quando a segunda data é anterior", () => {
    expect(diffDays("2026-07-10", "2026-07-01")).toBe(-9);
  });
  it("não sofre o bug clássico de fuso horário virando um dia", () => {
    // new Date("2026-07-01") (sem horário) interpretaria como UTC e poderia
    // "voltar" um dia em fusos negativos como o do Brasil — diffDays usa
    // T00:00:00 explícito justamente pra evitar isso.
    expect(diffDays("2026-01-01", "2026-01-02")).toBe(1);
  });
});

describe("invoiceMonthForPurchase (mês da fatura de uma compra)", () => {
  it("compra até o dia do fechamento cai na fatura do mês corrente", () => {
    expect(invoiceMonthForPurchase("2026-07-10", 15)).toBe("2026-07");
    expect(invoiceMonthForPurchase("2026-07-15", 15)).toBe("2026-07"); // no dia exato do fechamento ainda entra
  });
  it("compra depois do fechamento cai na fatura do mês seguinte", () => {
    expect(invoiceMonthForPurchase("2026-07-16", 15)).toBe("2026-08");
  });
  it("compra no fim do ano, depois do fechamento, vira janeiro do ano seguinte", () => {
    expect(invoiceMonthForPurchase("2026-12-20", 15)).toBe("2027-01");
  });
  it("sem dia de fechamento definido, usa o mês corrido da compra", () => {
    expect(invoiceMonthForPurchase("2026-07-20", null)).toBe("2026-07");
  });
});

describe("isDueIn (se um gasto está \"ativo\" num mês)", () => {
  const parcelado = { first_month: "2026-05", installments: 3, is_recurring: false };
  it("está devido durante o período das parcelas", () => {
    expect(isDueIn(parcelado, "2026-05")).toBe(true);
    expect(isDueIn(parcelado, "2026-06")).toBe(true);
    expect(isDueIn(parcelado, "2026-07")).toBe(true);
  });
  it("não está mais devido depois da última parcela", () => {
    expect(isDueIn(parcelado, "2026-08")).toBe(false);
  });
  it("não está devido antes da primeira parcela", () => {
    expect(isDueIn(parcelado, "2026-04")).toBe(false);
  });
  const recorrente = { first_month: "2026-05", is_recurring: true, installments: 1 };
  it("gasto recorrente fica devido indefinidamente a partir do início", () => {
    expect(isDueIn(recorrente, "2026-05")).toBe(true);
    expect(isDueIn(recorrente, "2030-01")).toBe(true);
  });
  it("gasto recorrente não está devido antes de começar", () => {
    expect(isDueIn(recorrente, "2026-04")).toBe(false);
  });
});

describe("monthlyValue (valor de uma parcela/mês)", () => {
  it("divide o valor total pelo número de parcelas", () => {
    const exp = { total_amount: 300, installments: 3, is_recurring: false };
    expect(monthlyValue(exp)).toBe(100);
  });
  it("gasto recorrente usa o valor cheio (não divide)", () => {
    const exp = { total_amount: 150, installments: 1, is_recurring: true };
    expect(monthlyValue(exp)).toBe(150);
  });
  it("aplica um ajuste manual (override) quando existe pro mês", () => {
    const exp = { id: "e1", total_amount: 300, installments: 3, is_recurring: false };
    const overrides = new Map([["e1|2026-06", { amount: 250 }]]);
    expect(monthlyValue(exp, "2026-06", overrides)).toBe(250);
  });
  it("ajuste marcado como removido zera o valor daquele mês", () => {
    const exp = { id: "e1", total_amount: 300, installments: 3, is_recurring: false };
    const overrides = new Map([["e1|2026-06", { removed: true }]]);
    expect(monthlyValue(exp, "2026-06", overrides)).toBe(0);
  });
});

describe("outstanding (quanto ainda falta pagar, usado no limite do cartão)", () => {
  it("gasto à vista integral conta o valor cheio enquanto não quitado", () => {
    const exp = { total_amount: 100, installments: 1, is_recurring: false, first_month: "2026-07" };
    expect(outstanding(exp, "2026-07")).toBe(100);
  });
  it("reembolso conta como valor negativo (libera limite de verdade)", () => {
    const exp = { total_amount: -50, is_refund: true };
    expect(outstanding(exp)).toBe(-50);
  });
  it("parcelamento reduz o saldo devedor conforme os meses passam", () => {
    const exp = { total_amount: 300, installments: 3, is_recurring: false, first_month: "2026-05" };
    expect(outstanding(exp, "2026-05")).toBe(300); // nada pago ainda
    expect(outstanding(exp, "2026-06")).toBe(200); // 1 parcela já "passou"
    expect(outstanding(exp, "2026-08")).toBe(0); // todas as parcelas já passaram
  });
});
