import * as THREE from "three";

/** BCF 2.1-export: één issue met camera-standpunt en schermafbeelding.
 *  Bevat een minimale eigen ZIP-schrijver (store, geen compressie). */

// ---------------------------------------------------------------- zip (store)
const crcTable = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    t[n] = v >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) crc = (crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
  const u32 = (v: number) =>
    new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]);
  const cat = (...parts: Uint8Array[]) => {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = cat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.data.length), u32(f.data.length),
      u16(name.length), u16(0), name, f.data,
    );
    central.push(
      cat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(f.data.length), u32(f.data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
      ),
    );
    chunks.push(local);
    offset += local.length;
  }
  const centralBlob = cat(...central);
  const eocd = cat(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBlob.length), u32(offset), u16(0),
  );
  return cat(...chunks, centralBlob, eocd);
}

// ---------------------------------------------------------------- bcf
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function makeBcfIssue(opts: {
  title: string;
  description?: string;
  author?: string;
  /** three.js-camera: positie/richting/omhoog worden omgerekend naar IFC (z-omhoog) */
  camera: THREE.Camera;
  snapshotPng: Uint8Array;
}): Uint8Array {
  const guid = crypto.randomUUID();
  const vpGuid = crypto.randomUUID();
  const now = new Date().toISOString();
  const author = opts.author ?? "Open 3D Studio";

  const pos = new THREE.Vector3();
  opts.camera.getWorldPosition(pos);
  const dir = new THREE.Vector3();
  opts.camera.getWorldDirection(dir);
  const up = (opts.camera as THREE.PerspectiveCamera).up.clone();
  // three (x, y-omhoog, z) -> IFC/BCF (x, -z, y)
  const ifc = (v: THREE.Vector3) => ({ x: v.x, y: -v.z, z: v.y });
  const p = ifc(pos);
  const d = ifc(dir);
  const u = ifc(up);

  // orthografische camera's krijgen een OrthogonalCamera-element met de juiste schaal
  const ortho = opts.camera as THREE.OrthographicCamera;
  const isOrtho = (opts.camera as { isOrthographicCamera?: boolean }).isOrthographicCamera === true;
  const cameraXml = isOrtho
    ? `<OrthogonalCamera>
    <CameraViewPoint><X>${p.x}</X><Y>${p.y}</Y><Z>${p.z}</Z></CameraViewPoint>
    <CameraDirection><X>${d.x}</X><Y>${d.y}</Y><Z>${d.z}</Z></CameraDirection>
    <CameraUpVector><X>${u.x}</X><Y>${u.y}</Y><Z>${u.z}</Z></CameraUpVector>
    <ViewToWorldScale>${(ortho.top - ortho.bottom) / (ortho.zoom || 1)}</ViewToWorldScale>
  </OrthogonalCamera>`
    : `<PerspectiveCamera>
    <CameraViewPoint><X>${p.x}</X><Y>${p.y}</Y><Z>${p.z}</Z></CameraViewPoint>
    <CameraDirection><X>${d.x}</X><Y>${d.y}</Y><Z>${d.z}</Z></CameraDirection>
    <CameraUpVector><X>${u.x}</X><Y>${u.y}</Y><Z>${u.z}</Z></CameraUpVector>
    <FieldOfView>${(opts.camera as THREE.PerspectiveCamera).fov ?? 60}</FieldOfView>
  </PerspectiveCamera>`;

  const version = `<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1"><DetailedVersion>2.1</DetailedVersion></Version>`;
  const markup = `<?xml version="1.0" encoding="UTF-8"?>
<Markup>
  <Topic Guid="${guid}" TopicType="Issue" TopicStatus="Open">
    <Title>${xmlEscape(opts.title)}</Title>
    <CreationDate>${now}</CreationDate>
    <CreationAuthor>${xmlEscape(author)}</CreationAuthor>
    ${opts.description ? `<Description>${xmlEscape(opts.description)}</Description>` : ""}
  </Topic>
  <Viewpoints Guid="${vpGuid}">
    <Viewpoint>viewpoint.bcfv</Viewpoint>
    <Snapshot>snapshot.png</Snapshot>
  </Viewpoints>
</Markup>`;
  const viewpoint = `<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo Guid="${vpGuid}">
  ${cameraXml}
</VisualizationInfo>`;

  const enc = new TextEncoder();
  return makeZip([
    { name: "bcf.version", data: enc.encode(version) },
    { name: `${guid}/markup.bcf`, data: enc.encode(markup) },
    { name: `${guid}/viewpoint.bcfv`, data: enc.encode(viewpoint) },
    { name: `${guid}/snapshot.png`, data: opts.snapshotPng },
  ]);
}
