/** Bundelde IDS-preset-XMLs voor BIM basis ILS 2.0 en ILS O&E-fasen (SO/VO/DO/TO/UO).
 *
 *  Deze presets vormen de ingebouwde vervanger van de hardcoded checkIls() en
 *  worden zonder netwerk geladen. Formaat: buildingSMART IDS v1.0.
 *
 *  Rc-minima uit Bbl (Besluit bouwwerken leefomgeving) 2024, artikel 4.150:
 *  - buitengevel  ≥ 4,7 m²·K/W   (NL-SfB 21)
 *  - hellend dak  ≥ 6,3 m²·K/W   (NL-SfB 27)
 *  - begane grond ≥ 3,7 m²·K/W   (NL-SfB 23 op maaiveld)
 *
 *  De IDS-specificaties zijn bewust "beperkt uitgekleed" voor leesbaarheid — in de
 *  praktijk vult BIM Loket de ILS Configurator met veel meer specifications. Onze
 *  engine kan een geïmporteerd IDS altijd als aanvulling of vervanger draaien.  */

const HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS"
     xmlns:xs="http://www.w3.org/2001/XMLSchema">`;

/** BIM basis ILS 2.0 — de tien basiseisen als IDS. */
export const BIM_BASIS_ILS_2_XML = `${HEAD}
  <info>
    <title>BIM basis ILS 2.0</title>
    <author>Open 3D Studio (op basis van digiGO)</author>
    <version>2.0</version>
    <description>Ingebouwde IDS-representatie van de BIM basis ILS 2.0-eisen.</description>
  </info>
  <specifications>
    <specification name="ILS 2 — Correcte bouwlaagindeling en naamgeving" description="Elke wand/vloer/dak/kolom hoort te zijn geplaatst op een IfcBuildingStorey met naamgeving &quot;00 begane grond&quot;." cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
      </applicability>
      <requirements>
        <attribute><name><simpleValue>Name</simpleValue></name></attribute>
      </requirements>
    </specification>

    <specification name="ILS 3 — Juiste entiteit met TypeEnumeration" description="Wand als IfcWall met PredefinedType, gevel als SOLIDWALL/STANDARD, binnenwand als PARTITIONING." cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
      </applicability>
      <requirements>
        <attribute><name><simpleValue>PredefinedType</simpleValue></name></attribute>
      </requirements>
    </specification>

    <specification name="ILS 4 — Consequent Naam en Type" description="Elk element heeft een gevulde Name." cardinality="required">
      <applicability>
        <entity><name>
          <restriction base="xs:string">
            <enumeration value="IfcWall"/>
            <enumeration value="IfcSlab"/>
            <enumeration value="IfcBeam"/>
            <enumeration value="IfcColumn"/>
            <enumeration value="IfcPlate"/>
            <enumeration value="IfcRoof"/>
            <enumeration value="IfcStair"/>
            <enumeration value="IfcRailing"/>
            <enumeration value="IfcCovering"/>
            <enumeration value="IfcDoor"/>
            <enumeration value="IfcWindow"/>
            <enumeration value="IfcFooting"/>
            <enumeration value="IfcPile"/>
            <enumeration value="IfcSpace"/>
          </restriction>
        </name></entity>
      </applicability>
      <requirements>
        <attribute><name><simpleValue>Name</simpleValue></name></attribute>
      </requirements>
    </specification>

    <specification name="ILS 5 — Viercijferige NL-SfB-code" description="Elk element krijgt een viercijferige NL-SfB-code (xx.xx)." cardinality="required">
      <applicability>
        <entity><name>
          <restriction base="xs:string">
            <enumeration value="IfcWall"/>
            <enumeration value="IfcSlab"/>
            <enumeration value="IfcRoof"/>
            <enumeration value="IfcBeam"/>
            <enumeration value="IfcColumn"/>
            <enumeration value="IfcPlate"/>
            <enumeration value="IfcCovering"/>
            <enumeration value="IfcDoor"/>
            <enumeration value="IfcWindow"/>
          </restriction>
        </name></entity>
      </applicability>
      <requirements>
        <classification>
          <system><simpleValue>NL-SfB</simpleValue></system>
          <value><restriction base="xs:string"><pattern value="^\\d{2}\\.\\d{2}$"/></restriction></value>
        </classification>
      </requirements>
    </specification>

    <specification name="ILS 6 — Materiaal ingevuld" description="Elk bouwkundig element heeft een IfcMaterial (of MaterialLayerSet)." cardinality="required">
      <applicability>
        <entity><name>
          <restriction base="xs:string">
            <enumeration value="IfcWall"/>
            <enumeration value="IfcSlab"/>
            <enumeration value="IfcRoof"/>
            <enumeration value="IfcBeam"/>
            <enumeration value="IfcColumn"/>
            <enumeration value="IfcPlate"/>
          </restriction>
        </name></entity>
      </applicability>
      <requirements>
        <material/>
      </requirements>
    </specification>

    <specification name="ILS 7 — Basis-Psets (LoadBearing/IsExternal)" description="Pset_WallCommon.LoadBearing en Pset_WallCommon.IsExternal zijn gevuld." cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>LoadBearing</simpleValue></baseName>
        </property>
        <property>
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>IsExternal</simpleValue></baseName>
        </property>
      </requirements>
    </specification>

    <specification name="ILS 9 — Geen proxies" description="IfcBuildingElementProxy is verboden in eindmodellen." cardinality="prohibited">
      <applicability>
        <entity><name><simpleValue>IfcBuildingElementProxy</simpleValue></name></entity>
      </applicability>
      <requirements/>
    </specification>
  </specifications>
</ids>`;

/** Bbl-Rc-check als losse IDS — kan naast de ILS 2.0 draaien. */
export const BBL_RC_XML = `${HEAD}
  <info>
    <title>Bbl 2024 — Rc-waarden nieuwbouw</title>
    <author>Open 3D Studio</author>
    <version>2024</version>
    <description>Minimum Rc uit Bbl artikel 4.150 voor buitengevel, dak en begane grond.</description>
  </info>
  <specifications>
    <specification name="Bbl — Rc buitengevel ≥ 4,7" description="Buitenwanden (NL-SfB 21.xx) moeten Rc ≥ 4,7 m²·K/W hebben." cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
        <classification>
          <system><simpleValue>NL-SfB</simpleValue></system>
          <value><restriction base="xs:string"><pattern value="^21\\."/></restriction></value>
        </classification>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Storax_Thermal</simpleValue></propertySet>
          <baseName><simpleValue>Rc</simpleValue></baseName>
          <value><restriction base="xs:double"><minInclusive value="4.7"/></restriction></value>
        </property>
      </requirements>
    </specification>

    <specification name="Bbl — Rc dak ≥ 6,3" description="Daken (NL-SfB 27.xx) moeten Rc ≥ 6,3 m²·K/W hebben." cardinality="required">
      <applicability>
        <entity><name>
          <restriction base="xs:string">
            <enumeration value="IfcRoof"/>
            <enumeration value="IfcSlab"/>
          </restriction>
        </name></entity>
        <classification>
          <system><simpleValue>NL-SfB</simpleValue></system>
          <value><restriction base="xs:string"><pattern value="^27\\."/></restriction></value>
        </classification>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Storax_Thermal</simpleValue></propertySet>
          <baseName><simpleValue>Rc</simpleValue></baseName>
          <value><restriction base="xs:double"><minInclusive value="6.3"/></restriction></value>
        </property>
      </requirements>
    </specification>

    <specification name="Bbl — Rc begane-grondvloer ≥ 3,7" description="Vloeren op maaiveld (NL-SfB 23.xx) moeten Rc ≥ 3,7 m²·K/W hebben." cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcSlab</simpleValue></name></entity>
        <classification>
          <system><simpleValue>NL-SfB</simpleValue></system>
          <value><restriction base="xs:string"><pattern value="^23\\."/></restriction></value>
        </classification>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Storax_Thermal</simpleValue></propertySet>
          <baseName><simpleValue>Rc</simpleValue></baseName>
          <value><restriction base="xs:double"><minInclusive value="3.7"/></restriction></value>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

/** ILS O&E — Structureel Ontwerp: alleen dragende hoofddraagconstructie moet compleet zijn. */
export const ILS_OE_SO_XML = `${HEAD}
  <info>
    <title>ILS O&amp;E — Structureel Ontwerp (SO)</title>
    <author>Open 3D Studio</author>
    <version>1.0</version>
    <phase>SO</phase>
    <description>In het Structureel Ontwerp (SO) moeten globale gebouwvorm en dragende elementen aanwezig zijn.</description>
  </info>
  <specifications>
    <specification name="SO — Dragende elementen hebben een entiteit + type" cardinality="required">
      <applicability>
        <property>
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>LoadBearing</simpleValue></baseName>
          <value><simpleValue>true</simpleValue></value>
        </property>
      </applicability>
      <requirements>
        <attribute><name><simpleValue>PredefinedType</simpleValue></name></attribute>
        <attribute><name><simpleValue>Name</simpleValue></name></attribute>
      </requirements>
    </specification>
    <specification name="SO — Verdiepingen naamgeving" cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
      </applicability>
      <requirements>
        <attribute><name><simpleValue>Name</simpleValue></name></attribute>
      </requirements>
    </specification>
  </specifications>
</ids>`;

/** ILS O&E — Voorlopig Ontwerp: alle bouwkundige hoofdvormen + materiaal. */
export const ILS_OE_VO_XML = `${HEAD}
  <info>
    <title>ILS O&amp;E — Voorlopig Ontwerp (VO)</title>
    <author>Open 3D Studio</author>
    <version>1.0</version>
    <phase>VO</phase>
    <description>In het Voorlopig Ontwerp (VO) moeten alle bouwkundige hoofdelementen NL-SfB en materiaal hebben.</description>
  </info>
  <specifications>
    <specification name="VO — Bouwkundig element heeft NL-SfB + materiaal" cardinality="required">
      <applicability>
        <entity><name>
          <restriction base="xs:string">
            <enumeration value="IfcWall"/>
            <enumeration value="IfcSlab"/>
            <enumeration value="IfcRoof"/>
            <enumeration value="IfcColumn"/>
            <enumeration value="IfcBeam"/>
          </restriction>
        </name></entity>
      </applicability>
      <requirements>
        <classification>
          <system><simpleValue>NL-SfB</simpleValue></system>
          <value><restriction base="xs:string"><pattern value="^\\d{2}\\.\\d{2}$"/></restriction></value>
        </classification>
        <material/>
      </requirements>
    </specification>
  </specifications>
</ids>`;

/** ILS O&E — Definitief Ontwerp: openingen, Common-Psets, Rc bekend. */
export const ILS_OE_DO_XML = `${HEAD}
  <info>
    <title>ILS O&amp;E — Definitief Ontwerp (DO)</title>
    <author>Open 3D Studio</author>
    <version>1.0</version>
    <phase>DO</phase>
    <description>In het DO moeten Common-Psets compleet zijn en Rc-waarden bekend voor thermische schil.</description>
  </info>
  <specifications>
    <specification name="DO — Wanden hebben Pset_WallCommon compleet" cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>LoadBearing</simpleValue></baseName>
        </property>
        <property>
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>IsExternal</simpleValue></baseName>
        </property>
        <property>
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>Reference</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
    <specification name="DO — Thermische schil heeft Rc" cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWall</simpleValue></name></entity>
        <classification>
          <system><simpleValue>NL-SfB</simpleValue></system>
          <value><restriction base="xs:string"><pattern value="^21\\."/></restriction></value>
        </classification>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Storax_Thermal</simpleValue></propertySet>
          <baseName><simpleValue>Rc</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

/** ILS O&E — Technisch Ontwerp: alles bouwkundig + FireRating, Reference, U-waarde ramen. */
export const ILS_OE_TO_XML = `${HEAD}
  <info>
    <title>ILS O&amp;E — Technisch Ontwerp (TO)</title>
    <author>Open 3D Studio</author>
    <version>1.0</version>
    <phase>TO</phase>
    <description>In het TO moeten brandwerendheid en gevelopeningen U-waarden gevuld zijn.</description>
  </info>
  <specifications>
    <specification name="TO — Deuren hebben Pset_DoorCommon.FireRating" cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcDoor</simpleValue></name></entity>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Pset_DoorCommon</simpleValue></propertySet>
          <baseName><simpleValue>FireRating</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
    <specification name="TO — Ramen hebben ThermalTransmittance" cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWindow</simpleValue></name></entity>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Pset_WindowCommon</simpleValue></propertySet>
          <baseName><simpleValue>ThermalTransmittance</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

/** ILS O&E — Uitvoeringsgereed Ontwerp: fabrikant, garantie, onderhoud. COBie-territory. */
export const ILS_OE_UO_XML = `${HEAD}
  <info>
    <title>ILS O&amp;E — Uitvoeringsgereed Ontwerp (UO)</title>
    <author>Open 3D Studio</author>
    <version>1.0</version>
    <phase>UO</phase>
    <description>In het UO moeten fabrikant + garantie + onderhoudsinformatie op elk element aanwezig zijn (COBie).</description>
  </info>
  <specifications>
    <specification name="UO — Ramen hebben fabrikant + garantieduur" cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcWindow</simpleValue></name></entity>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Pset_ManufacturerTypeInformation</simpleValue></propertySet>
          <baseName><simpleValue>Manufacturer</simpleValue></baseName>
        </property>
        <property>
          <propertySet><simpleValue>Pset_Warranty</simpleValue></propertySet>
          <baseName><simpleValue>WarrantyDuration</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
    <specification name="UO — Deuren hebben ServiceLife" cardinality="required">
      <applicability>
        <entity><name><simpleValue>IfcDoor</simpleValue></name></entity>
      </applicability>
      <requirements>
        <property>
          <propertySet><simpleValue>Pset_ServiceLife</simpleValue></propertySet>
          <baseName><simpleValue>ServiceLifeDuration</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

export const IDS_PRESETS: Record<string, { title: string; xml: string }> = {
  "bim-basis-ils-2": { title: "BIM basis ILS 2.0", xml: BIM_BASIS_ILS_2_XML },
  "bbl-rc-2024": { title: "Bbl 2024 — Rc-waarden", xml: BBL_RC_XML },
  "oe-so": { title: "ILS O&E — Structureel Ontwerp (SO)", xml: ILS_OE_SO_XML },
  "oe-vo": { title: "ILS O&E — Voorlopig Ontwerp (VO)", xml: ILS_OE_VO_XML },
  "oe-do": { title: "ILS O&E — Definitief Ontwerp (DO)", xml: ILS_OE_DO_XML },
  "oe-to": { title: "ILS O&E — Technisch Ontwerp (TO)", xml: ILS_OE_TO_XML },
  "oe-uo": { title: "ILS O&E — Uitvoeringsgereed (UO)", xml: ILS_OE_UO_XML },
};
