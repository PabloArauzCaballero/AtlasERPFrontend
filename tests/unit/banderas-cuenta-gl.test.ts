import { describe, expect, it } from "vitest";
import { BANDERAS_CUENTA_GL } from "@/lib/banderasCuentaGl";

describe("BANDERAS_CUENTA_GL", () => {
  it("cada bandera tiene etiqueta en español y ayuda, y ninguna es el nombre del campo partido por mayúsculas", () => {
    expect(BANDERAS_CUENTA_GL).toHaveLength(5);
    for (const bandera of BANDERAS_CUENTA_GL) {
      const derivada = bandera.name.replace(/([A-Z])/g, " $1");
      expect(bandera.label).not.toBe(derivada);
      expect(bandera.label).not.toMatch(
        /\b(is|requires|Control|Cost|Center|Profit|Partner|Tax|Code)\b/,
      );
      expect(bandera.tooltip.length).toBeGreaterThan(20);
    }
  });

  it("conserva los cinco nombres de campo que espera el servidor", () => {
    expect(BANDERAS_CUENTA_GL.map((b) => b.name)).toEqual([
      "isControlAccount",
      "requiresCostCenter",
      "requiresProfitCenter",
      "requiresPartner",
      "requiresTaxCode",
    ]);
  });
});
