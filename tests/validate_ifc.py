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


def complaints(model) -> list[str]:
    """Alles wat de validator over dit model te zeggen heeft, één string per klacht.

    De json-logger en niet een tekstlogger: die laatste levert losse regels op,
    waardoor de naam van een WHERE-regel en zijn melding niet gegarandeerd bij
    elkaar staan. Alles van één klacht in één string houdt tellen en grep'en
    betrouwbaar; de naam van de regel staat onder 'attribute'.
    """
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


def poortscene_expectations(model) -> list[str]:
    """Inhoudelijke verwachtingen voor de poortscène (export-scene.ts).

    Het schema hierboven zegt of het bestand geldig IFC is; deze sectie zegt of
    er ook in staat wat de scène heeft gekozen. De ligger staat bewust op
    HEA 160 (niet het template-default IPE 200): met de oude statische
    template-spec droeg het IFC hier het verkeerde profiel, en vóór de
    geometrie-stap was de body drie rechthoeken in plaats van een I-vorm.
    """
    problemen: list[str] = []
    liggers = [b for b in model.by_type("IfcBeam") if b.Name == "Stalen ligger"]
    if len(liggers) != 1:
        return [f"verwachtte precies één IfcBeam 'Stalen ligger', vond {len(liggers)}"]
    ligger = liggers[0]

    reps = ligger.Representation.Representations if ligger.Representation else []
    body = next((r for r in reps if r.RepresentationIdentifier == "Body"), None)
    if body is None or not body.Items:
        problemen.append("ligger heeft geen Body-representatie")
    else:
        profiel = getattr(body.Items[0], "SweptArea", None)
        if profiel is None or not profiel.is_a("IfcIShapeProfileDef"):
            soort = profiel.is_a() if profiel is not None else "geen"
            problemen.append(f"body-profiel van de ligger is {soort}, verwacht IfcIShapeProfileDef")
        elif profiel.ProfileName != "HEA 160":
            problemen.append(f"body-profiel heet {profiel.ProfileName!r}, verwacht 'HEA 160'")

    usages = [
        rel.RelatingMaterial
        for rel in model.by_type("IfcRelAssociatesMaterial")
        if ligger in rel.RelatedObjects and rel.RelatingMaterial.is_a("IfcMaterialProfileSetUsage")
    ]
    if len(usages) != 1:
        problemen.append(f"verwachtte één IfcMaterialProfileSetUsage op de ligger, vond {len(usages)}")
    else:
        profielen = usages[0].ForProfileSet.MaterialProfiles or []
        naam = profielen[0].Profile.ProfileName if profielen and profielen[0].Profile else None
        if naam != "HEA 160":
            problemen.append(f"materiaalprofiel van de ligger heet {naam!r}, verwacht 'HEA 160'")
    return problemen


def main(argv: list[str]) -> int:
    is_poortscene = len(argv) <= 1
    pad = Path(argv[1]) if len(argv) > 1 else Path(__file__).parent / "out" / "poort.ifc"
    if not pad.exists():
        print(f"Geen IFC op {pad} — draai eerst de export (npm run test:ifc).")
        return 2
    model = ifcopenshell.open(str(pad))
    regels = complaints(model)
    # Verwachtingen alleen op de poortscène zelf; een los aangereikt bestand
    # krijgt de kale schema-poort.
    verwachtingen = poortscene_expectations(model) if is_poortscene else []
    if regels or verwachtingen:
        if regels:
            print(f"POORT ROOD — {len(regels)} klacht(en) op {pad.name}:")
            for regel in regels:
                print(f"  - {regel}")
        for probleem in verwachtingen:
            print(f"VERWACHTING GESCHONDEN — {probleem}")
        return 1
    extra = " + verwachtingen poortscène" if is_poortscene else ""
    print(f"POORT GROEN — {pad.name}: schema en alle EXPRESS WHERE-regels, 0 klachten{extra}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
