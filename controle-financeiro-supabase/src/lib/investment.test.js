import { describe, it, expect } from "vitest";
import { investmentMonthlyRate } from "../lib/domain";

describe("investmentMonthlyRate (conversão de taxa anual do CDI pra mensal)", () => {
  it("retorna null se a caixinha não tem % do CDI definido", () => {
    expect(investmentMonthlyRate({ cdi_percent: null }, 10.5)).toBeNull();
  });
  it("retorna null se não tem a taxa anual do CDI (ainda não carregou)", () => {
    expect(investmentMonthlyRate({ cdi_percent: 100 }, null)).toBeNull();
  });
  it("100% do CDI a 10,5% ao ano dá a taxa mensal equivalente composta", () => {
    // (1.105)^(1/12) - 1 ≈ 0,8355% a.m.
    const rate = investmentMonthlyRate({ cdi_percent: 100 }, 10.5);
    expect(rate).toBeCloseTo(0.8355, 3);
  });
  it("115% do CDI rende mais que 100% do CDI, na mesma taxa anual", () => {
    const rate100 = investmentMonthlyRate({ cdi_percent: 100 }, 10.5);
    const rate115 = investmentMonthlyRate({ cdi_percent: 115 }, 10.5);
    expect(rate115).toBeGreaterThan(rate100);
  });
});
