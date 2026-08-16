import { describe, expect, it } from "vitest";

import { inferBridgeIdentity } from "../src/features/extraction/infer-bridge-identity.js";

describe("inferBridgeIdentity", () => {
  it("reads Nummer, Bauwerksname, and road from a typical title page", () => {
    const inferred = inferBridgeIdentity([
      {
        textContent: `nach DIN 1076
Bauwerksname
Nächst gelegener Ort
Schlingenbachtalbrücke
Vilkerath
Bauwerksbuch
Nummer
Straße IBwNr
5009705 1
004-107,058 A 4`
      }
    ]);

    expect(inferred).toEqual({
      externalStructureNumber: "5009705",
      name: "Schlingenbachtalbrücke",
      road: "A 4"
    });
  });
});
