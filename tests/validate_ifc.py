"""Onafhankelijke IFC-poort voor Open 3D Studio, deel 2: toetsen.

Leest het IFC dat tests/headless/export-scene.ts schreef en legt er de
strengste IfcOpenShell-validatie overheen: schema, attribuuttypes,
kardinaliteiten én alle EXPRESS WHERE-regels.

Twee lessen uit het Storax-zusterproject zitten hier bewust in:

1. ``express_rules=True`` is niet optioneel. Zonder die vlag toetst
   ``ifcopenshell.validate.validate`` geen enkele WHERE-regel — gemeten nul
   klachten op modellen die aantoonbaar schema-ongeldig waren. Drie fouten
   stonden daar maandenlang in met een groene poort.
2. De ``try/finally`` rond de validatie: de rule-executor zet
   ``ifcopenshell.settings.unpack_non_aggregate_inverses`` op True en zet hem
   pas op zijn laatste regel terug. Gooit een regel halverwege, dan blijft de
   vlag staan en produceert de poort daarna zelf valse klachten.

Exit 0: geen klachten. Exit 1: klachten (opgesomd). Exit 2: kon niet toetsen.

Gebruik:  python tests/validate_ifc.py [pad/naar/model.ifc]
Vereist:  pip install ifcopenshell pytest
          (pytest is geen keuze: de EXPRESS-rule-executor van IfcOpenShell
          leunt op pytest's assertion-rewriting — gemeten: zonder pytest valt
          ``validate(express_rules=True)`` om op ``No module named '_pytest'``)
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import ifcopenshell
    import ifcopenshell.validate
    import pytest  # noqa: F401 — zie de docstring: de rule-executor heeft dit nodig
except ModuleNotFoundError as ontbreekt:
    print(f"Poort kan niet toetsen: {ontbreekt}. Installeer met: pip install ifcopenshell pytest")
    sys.exit(2)


def complaints(path: Path) -> list[str]:
    """Alles wat de validator over dit bestand te zeggen heeft, één string per klacht.

    De json-logger en niet een tekstlogger: die laatste levert losse regels op,
    waardoor de naam van een WHERE-regel en zijn melding niet gegarandeerd bij
    elkaar staan. Alles van één klacht in één string houdt tellen en grep'en
    betrouwbaar; de naam van de regel staat onder 'attribute'.
    """
    model = ifcopenshell.open(str(path))
    stand = ifcopenshell.settings.unpack_non_aggregate_inverses
    logger = ifcopenshell.validate.json_logger()
    try:
        ifcopenshell.validate.validate(model, logger, express_rules=True)
    finally:
        ifcopenshell.settings.unpack_non_aggregate_inverses = stand
    return [
        " | ".join(f"{key}: {value}" for key, value in statement.items())
        for statement in logger.statements
    ]


def main(argv: list[str]) -> int:
    pad = Path(argv[1]) if len(argv) > 1 else Path(__file__).parent / "out" / "poort.ifc"
    if not pad.exists():
        print(f"Geen IFC op {pad} — draai eerst de export (npm run test:ifc).")
        return 2
    regels = complaints(pad)
    if regels:
        print(f"POORT ROOD — {len(regels)} klacht(en) op {pad.name}:")
        for regel in regels:
            print(f"  - {regel}")
        return 1
    print(f"POORT GROEN — {pad.name}: schema en alle EXPRESS WHERE-regels, 0 klachten.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
