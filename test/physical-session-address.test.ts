import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PHYSICAL_SESSION_ADDRESS,
  readPhysicalSessionAddress,
} from "../src/lib/physical-session-address.ts";

test("physical session address reads and trims the admin setting", () => {
  assert.equal(
    readPhysicalSessionAddress({ physicalSessionAddress: "  New clinic address  " }),
    "New clinic address",
  );
});

test("physical session address falls back when the setting is missing", () => {
  assert.equal(readPhysicalSessionAddress({}), DEFAULT_PHYSICAL_SESSION_ADDRESS);
  assert.equal(readPhysicalSessionAddress(null), DEFAULT_PHYSICAL_SESSION_ADDRESS);
});

test("physical session address follows the admin office matching the therapist location", () => {
  assert.equal(
    readPhysicalSessionAddress(
      {
        physicalSessionAddress: "Fallback address",
        offices: [
          { name: "Abuja (FCT)", addressLines: ["New Abuja clinic", "Abuja"] },
          { name: "Lagos", addressLines: ["New Lagos clinic", "Ikeja"] },
        ],
      },
      "Abuja · Online",
    ),
    "New Abuja clinic, Abuja, Abuja (FCT)",
  );
});
