import { describe, expect, it, vi } from "vitest";

const listProposals = vi.hoisted(() => vi.fn());
vi.mock("@/services/b2bService", () => ({ b2bService: { listProposals } }));

const { loadAcceptedProposals } = await import("@/services/optionLoaders");

describe("loadAcceptedProposals", () => {
  it("sólo ofrece las propuestas aceptadas (de un borrador o una enviada no nace un contrato)", async () => {
    listProposals.mockResolvedValue([
      {
        id: "1",
        proposalNumber: "PROP-1",
        tradeName: "Tienda A",
        status: "DRAFT",
      },
      {
        id: "2",
        proposalNumber: "PROP-2",
        tradeName: "Tienda B",
        status: "SENT",
      },
      {
        id: "3",
        proposalNumber: "PROP-3",
        tradeName: "Tienda C",
        status: "ACCEPTED",
      },
      {
        id: "4",
        proposalNumber: "PROP-4",
        accountId: "acc-4",
        status: "accepted",
      },
    ]);
    expect(await loadAcceptedProposals()).toEqual([
      { value: "3", label: "PROP-3 — Tienda C" },
      { value: "4", label: "PROP-4 — acc-4" },
    ]);
  });

  it("sin propuestas devuelve una lista vacía", async () => {
    listProposals.mockResolvedValue([]);
    expect(await loadAcceptedProposals()).toEqual([]);
  });
});
