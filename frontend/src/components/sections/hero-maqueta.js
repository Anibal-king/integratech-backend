/**
 * Maqueta 3D del inicio (Hero.astro): un sitio esquemático con lo que hace la
 * empresa, de la subestación al rack. Cada grupo de equipos corresponde a un
 * servicio de la base (por id) y lleva un marcador con su ícono. Pasar el mouse
 * (o Tab) por un marcador cambia el titular del hero por el servicio; clic/Enter
 * lo fija (ver «Rótulo» más abajo y Hero.astro).
 *
 *  - three.js se pide después de pintar la página: no retrasa el titular ni los botones.
 *  - El lienzo cubre todo el hero, pero la maqueta se encuadra (setViewOffset) dentro
 *    del área .hero__zona del marco, ocupando ~75 % de su ancho.
 *  - Arrastrar en horizontal dentro del marco gira la maqueta; el scroll vertical sigue libre.
 *  - Solo dibuja mientras está en pantalla y la pestaña está visible.
 *  - prefers-reduced-motion: sin giro automático, sin flujo de energía, sin entrada.
 *  - Si WebGL no está disponible, el hero queda con su fondo de plano (sin maqueta).
 */
const AZUL = 0x6cb6ec; // --color-accent-light
const AZUL_CLARO = 0x9fd2f7; // aristas: más contraste sobre el navy
const BLANCO = 0xffffff;
const NAVY = 0x0b2a4a; // --color-navy
const ACENTO = 0x1f74b5; // --color-accent

const vivas = new WeakSet();
let threePromesa = null;
const cargarThree = () => (threePromesa ??= import('three'));

const easeOut = (t) => 1 - Math.pow(1 - t, 4); // aproxima cubic-bezier(0.23, 1, 0.32, 1)

export function iniciarMaquetas() {
  document.querySelectorAll('[data-maqueta]').forEach((el) => {
    if (vivas.has(el) || el.offsetParent === null) return;
    vivas.add(el);
    montar(el).catch((err) => {
      console.warn('[hero] maqueta 3D no disponible:', err);
      el.dataset.estado = 'error';
    });
  });
}

async function montar(el) {
  const cont = el.querySelector('.hero__escena');
  const capa = el.querySelector('.hero__marcadores');
  const marco = el.querySelector('.hero__marco');
  const zonaEl = el.querySelector('.hero__zona');
  el.dataset.estado = 'cargando';

  // Franja de celular: copias de las capas de servicio del rótulo (un solo marcado)
  const franjaEl = el.querySelector('.hero__franja');
  if (franjaEl && !franjaEl.childElementCount) {
    el.querySelectorAll('.hero__rotulo .hero__capa--servicio').forEach((c) => franjaEl.append(c.cloneNode(true)));
  }
  // Precarga de las fotos de los servicios (ya cargó la página): al pasar el mouse
  // aparecen listas, no en blanco.
  el.querySelectorAll('img[data-src]').forEach((img) => {
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
  });

  const servicios = JSON.parse(el.dataset.maqueta);
  const porId = new Map(servicios.map((s) => [s.id, s]));
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const THREE = await cargarThree();
  if (!el.isConnected) return;

  // ---------- Render ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  cont.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  const mundo = new THREE.Group();
  scene.add(mundo);

  // ---------- Materiales por grupo (para resaltar uno y atenuar el resto) ----------
  const grupos = new Map(); // id -> { grupo, fill, edge, ancla, t0 }
  function nuevoGrupo(id, ancla) {
    const fill = new THREE.MeshBasicMaterial({
      color: NAVY, transparent: true, opacity: 0.88,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    const edge = new THREE.LineBasicMaterial({ color: AZUL_CLARO, transparent: true, opacity: 1 });
    const grupo = new THREE.Group();
    mundo.add(grupo);
    const g = { grupo, fill, edge, ancla: new THREE.Vector3(...ancla), retraso: grupos.size };
    grupos.set(id, g);
    return g;
  }
  /** Caja/cilindro/etc. con cara translúcida + aristas. */
  function pieza(g, geom, x, y, z, rot = [0, 0, 0]) {
    const m = new THREE.Mesh(geom, g.fill);
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 25), g.edge);
    const o = new THREE.Group();
    o.add(m, l);
    o.position.set(x, y, z);
    o.rotation.set(...rot);
    g.grupo.add(o);
    return o;
  }
  const caja = (g, w, h, d, x, y, z, rot) => pieza(g, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, rot);
  const cil = (g, r, h, x, y, z, seg = 12, rot) => pieza(g, new THREE.CylinderGeometry(r, r, h, seg), x, y + h / 2, z, rot);
  function lineas(g, puntos) {
    const geo = new THREE.BufferGeometry().setFromPoints(puntos.map((p) => new THREE.Vector3(...p)));
    const l = new THREE.LineSegments(geo, g.edge);
    g.grupo.add(l);
    return l;
  }

  // ---------- Terreno ----------
  const rejilla = new THREE.GridHelper(30, 30, AZUL, AZUL);
  rejilla.material.transparent = true;
  rejilla.material.opacity = 0.18;
  mundo.add(rejilla);
  const losa = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(26, 0.02, 18)),
    new THREE.LineBasicMaterial({ color: AZUL, transparent: true, opacity: 0.6 })
  );
  mundo.add(losa);

  // ---------- 3 · Industrial: nave con extractores + subestación ----------
  {
    const g = nuevoGrupo(3, [-7, 6.2, -3.5]);
    caja(g, 8, 3, 5, -7, 0, -3.5);
    const techo = new THREE.Shape([new THREE.Vector2(-2.5, 0), new THREE.Vector2(2.5, 0), new THREE.Vector2(0, 1.4)]);
    pieza(g, new THREE.ExtrudeGeometry(techo, { depth: 8, bevelEnabled: false }), -11, 3, -3.5, [0, Math.PI / 2, 0]);
    for (const x of [-9.4, -7, -4.6]) cil(g, 0.32, 0.6, x, 4.25, -3.5, 10);
    // Portón
    lineas(g, [[-9, 0, -0.99], [-9, 2.2, -0.99], [-9, 2.2, -0.99], [-7.2, 2.2, -0.99], [-7.2, 2.2, -0.99], [-7.2, 0, -0.99]]);
    // Subestación: transformador con aletas y bushings, cerca perimetral
    caja(g, 1.6, 1.8, 1.2, -9.5, 0, 3);
    for (let i = 0; i < 5; i++) caja(g, 0.06, 1.3, 0.9, -10.4 - i * 0.12, 0.25, 3);
    for (const x of [-10, -9.5, -9]) cil(g, 0.09, 0.6, x, 1.8, 3, 8);
    const f = [[-11.5, 1.3], [-7.6, 1.3], [-7.6, 4.8], [-11.5, 4.8]];
    const cerca = [];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = f[i], [bx, bz] = f[(i + 1) % 4];
      cerca.push([ax, 1.4, az], [bx, 1.4, bz], [ax, 0, az], [ax, 1.4, az]);
    }
    lineas(g, cerca);
  }

  // ---------- 5 · Auditorías: tablero principal + analizador con forma de onda ----------
  let onda = null;
  {
    const g = nuevoGrupo(5, [-4.6, 5.2, 3.2]);
    caja(g, 2, 2.2, 0.7, -4.6, 0, 3.2);
    lineas(g, [[-5.55, 0.2, 3.56], [-5.55, 2.0, 3.56], [-4.6, 0.2, 3.56], [-4.6, 2.0, 3.56], [-3.65, 0.2, 3.56], [-3.65, 2.0, 3.56]]);
    // Pantalla del analizador flotando sobre el tablero
    lineas(g, [[-5.8, 2.9, 3.2], [-3.4, 2.9, 3.2], [-3.4, 2.9, 3.2], [-3.4, 4.3, 3.2], [-3.4, 4.3, 3.2], [-5.8, 4.3, 3.2], [-5.8, 4.3, 3.2], [-5.8, 2.9, 3.2], [-4.6, 2.2, 3.2], [-4.6, 2.9, 3.2]]);
    const N = 64;
    const pos = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    onda = { geo, pos, N, mat: new THREE.LineBasicMaterial({ color: BLANCO, transparent: true, opacity: 0.95 }) };
    g.grupo.add(new THREE.Line(geo, onda.mat));
    g.extra = onda.mat;
  }

  // ---------- 1 · Automatización: tablero abierto + conveyor con motor ----------
  let cajasConveyor = [];
  {
    const g = nuevoGrupo(1, [1.2, 4.4, 4.6]);
    caja(g, 1.3, 2.3, 0.6, -1.2, 0, 4.4);
    caja(g, 0.05, 2.1, 1.2, -0.55, 0.1, 5.25, [0, -0.55, 0]); // puerta abierta
    for (const y of [0.6, 1.2, 1.8]) lineas(g, [[-1.75, y, 4.72], [-0.65, y, 4.72]]);
    // Conveyor
    caja(g, 5.2, 0.25, 0.9, 2.4, 0.9, 4.6);
    for (const x of [0.1, 2.4, 4.7]) for (const z of [4.25, 4.95]) caja(g, 0.08, 0.9, 0.08, x, 0, z);
    cil(g, 0.32, 0.7, 5.4, 0.85, 4.6, 12, [Math.PI / 2, 0, 0]); // motor
    for (let i = 0; i < 3; i++) {
      const c = caja(g, 0.6, 0.45, 0.6, 0.3 + i * 1.7, 1.15, 4.6);
      cajasConveyor.push(c);
    }
  }

  // ---------- 6 · Mantenimiento: planta de emergencia + aire acondicionado + luminarias ----------
  {
    const g = nuevoGrupo(6, [0.4, 4.2, -4.6]);
    caja(g, 3.4, 1.6, 1.4, 0.4, 0, -4.6);
    for (let i = 0; i < 6; i++) lineas(g, [[-1.31, 0.3 + i * 0.2, -5.15], [-1.31, 0.3 + i * 0.2, -4.05]]); // radiador
    cil(g, 0.12, 1.4, 1.6, 1.6, -4.6, 8); // escape
    caja(g, 1.4, 0.3, 1.6, 0.4, 1.6, -4.6); // tanque/techo
    for (const x of [3.4, 4.6]) {
      caja(g, 1, 0.9, 1, x, 0, -1.4);
      pieza(g, new THREE.CylinderGeometry(0.35, 0.35, 0.02, 16), x, 0.92, -1.4);
    }
    // Luminarias a lo largo del camino
    for (const x of [-4, -0.5, 3, 6.5, 10]) {
      cil(g, 0.06, 3, x, 0, 1.3, 6);
      caja(g, 0.9, 0.06, 0.08, x + 0.42, 3, 1.3);
      caja(g, 0.4, 0.12, 0.25, x + 0.8, 2.9, 1.3);
    }
  }

  // ---------- 2 · Comercial: data center en corte + pararrayos + CCTV ----------
  {
    const g = nuevoGrupo(2, [7.5, 7.4, -3.6]);
    const edif = caja(g, 6.4, 4, 5, 7.5, 0, -3.6);
    edif.children[0].visible = false; // solo aristas: se ve el interior
    for (let i = 0; i < 6; i++) caja(g, 0.7, 2.2, 1, 5.3 + i * 0.85, 0, -4.4);
    for (let i = 0; i < 6; i++) caja(g, 0.7, 2.2, 1, 5.3 + i * 0.85, 0, -2.6);
    lineas(g, [[5, 2.6, -3.5], [10.2, 2.6, -3.5]]); // bandeja de cableado
    cil(g, 0.05, 2.6, 10, 4, -5.4, 6); // pararrayos
    pieza(g, new THREE.ConeGeometry(0.14, 0.4, 8), 10, 6.8, -5.4);
    caja(g, 0.35, 0.22, 0.22, 4.55, 3.4, -1.15); // cámara CCTV
  }

  // ---------- 4 · Renovable y calidad: campo solar + UPS / baterías ----------
  {
    const g = nuevoGrupo(4, [8.6, 3.6, 5]);
    for (let fila = 0; fila < 2; fila++)
      for (let i = 0; i < 4; i++) {
        const x = 6.3 + i * 1.55, z = 4 + fila * 2;
        caja(g, 0.06, 0.7, 0.06, x, 0, z + 0.3);
        caja(g, 1.4, 0.05, 1.3, x, 0.75, z, [-0.4, 0, 0]);
      }
    caja(g, 1.2, 1.8, 0.8, 11.6, 0, 5);
    for (const y of [0.4, 0.8, 1.2]) lineas(g, [[11.05, y, 5.41], [12.15, y, 5.41]]);
  }

  // ---------- Red eléctrica: canalizaciones y pulsos de energía ----------
  const rutas = [
    [[-9.5, 0.05, 3], [-4.6, 0.05, 3]], // subestación → tablero principal
    [[-4.6, 0.05, 3.2], [-4.6, 0.05, 2], [-1.2, 0.05, 2], [-1.2, 0.05, 4.4]], // → automatización
    [[-4.6, 0.05, 2], [0.4, 0.05, 2], [0.4, 0.05, -3.8]], // → planta (transferencia)
    [[0.4, 0.05, 2], [7.5, 0.05, 2], [7.5, 0.05, -1.1]], // → data center
    [[11.6, 0.05, 5], [11.6, 0.05, 2], [7.5, 0.05, 2]], // solar/UPS → red
    [[-7, 0.05, -1], [-7, 0.05, 2], [-4.6, 0.05, 2]], // nave
  ].map((pts) => {
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i]), new THREE.Vector3(...pts[i + 1])));
    return path;
  });
  const matRed = new THREE.LineDashedMaterial({ color: AZUL, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.7 });
  for (const p of rutas) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(p.getSpacedPoints(40)), matRed);
    l.computeLineDistances();
    mundo.add(l);
  }
  const PULSOS = rutas.length * 2;
  const pulsosPos = new Float32Array(PULSOS * 3);
  const pulsosGeo = new THREE.BufferGeometry();
  pulsosGeo.setAttribute('position', new THREE.BufferAttribute(pulsosPos, 3));
  const pulsos = new THREE.Points(pulsosGeo, new THREE.PointsMaterial({ color: BLANCO, size: 0.32, transparent: true, opacity: 0.95 }));
  pulsos.visible = !reducido;
  mundo.add(pulsos);

  // ---------- Rótulo: el titular cambia por el servicio ----------
  // Cada capa tiene data-fase: (nada) = fuera, a la izquierda · 'dentro' · 'sale' = hacia
  // la derecha. Las transiciones viven en CSS, así un cambio a mitad de camino
  // simplemente retoma desde donde va (interrumpible).
  const rotulo = el.querySelector('.hero__rotulo');
  const franja = franjaEl;
  const anuncio = el.querySelector('.hero__anuncio');
  const capasDe = (raiz) => new Map(
    [...(raiz?.querySelectorAll('.hero__capa') ?? [])].map((c) => [c.dataset.capa === 'inicio' ? null : Number(c.dataset.capa), c])
  );
  const capasRotulo = capasDe(rotulo);
  const capasFranja = capasDe(franja);
  const tituloOriginal = capasRotulo.get(null)?.querySelector('h1')?.textContent.trim() ?? '';
  const SALIDA = 380; // ms: lo que tarda en salir la capa (el enlace sale último)
  const relojes = new Map();
  function fase(capa, f) {
    clearTimeout(relojes.get(capa));
    if (f === 'dentro') {
      if (capa.dataset.fase === 'dentro') return;
      // Desde el reposo: asienta la posición izquierda antes de entrar
      if (!capa.dataset.fase) void capa.offsetWidth;
      capa.dataset.fase = 'dentro';
    } else if (capa.dataset.fase === 'dentro') {
      capa.dataset.fase = 'sale';
      relojes.set(capa, setTimeout(() => { if (capa.dataset.fase === 'sale') delete capa.dataset.fase; }, SALIDA));
    }
  }
  const cambiar = (capas, id) => capas.forEach((c, cid) => fase(c, cid === id ? 'dentro' : 'fuera'));
  let mostrado = null;
  function mostrar(id) {
    if (!rotulo || id === mostrado) return;
    mostrado = id;
    cambiar(capasRotulo, id);
    const s = id !== null ? porId.get(id) : null;
    anuncio.textContent = s ? `${s.nombre}. ${s.descripcion ?? ''}` : tituloOriginal;
  }
  // Servicio que no cabe en la altura reservada: primero el título baja un paso;
  // si aún no cabe, «Qué incluye» muestra 3 puntos en lugar de 4.
  // Las capas son absolutas: medir no mueve nada en la página.
  function medir() {
    capasRotulo.forEach((c, id) => {
      if (id === null) return;
      c.removeAttribute('data-menor');
      c.removeAttribute('data-compacto');
      const cabe = () => c.scrollHeight <= c.clientHeight + 1;
      if (!cabe()) c.setAttribute('data-menor', '');
      if (!cabe()) c.setAttribute('data-compacto', '');
    });
  }
  let anchoRotulo = 0;
  const roRotulo = new ResizeObserver(([e]) => {
    if (Math.abs(e.contentRect.width - anchoRotulo) < 1) return;
    anchoRotulo = e.contentRect.width;
    medir();
  });
  if (rotulo) roRotulo.observe(rotulo);
  document.fonts?.ready.then(medir);

  // Celular: si el titular está fuera de pantalla al fijar, se muestra en la franja
  const movil = matchMedia('(max-width: 1023px)');
  let franjaAbierta = false;
  let franjaCierre = 0;
  function titularFuera() {
    const r = rotulo.getBoundingClientRect();
    const tope = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    return Math.min(r.bottom, innerHeight) - Math.max(r.top, tope) < r.height / 2;
  }
  function franjaPara(id) {
    if (!franja) return;
    clearTimeout(franjaCierre);
    if (id !== null && (franjaAbierta || (movil.matches && titularFuera()))) {
      franjaAbierta = true;
      franja.hidden = false;
      cambiar(capasFranja, id);
    } else if (franjaAbierta) {
      franjaAbierta = false;
      cambiar(capasFranja, null);
      franjaCierre = setTimeout(() => { franja.hidden = true; }, SALIDA);
    }
  }

  // ---------- Marcadores (HTML) ----------
  const icono = (id) => el.querySelector(`template[data-icono-de="${id}"]`)?.innerHTML ?? '';
  const marcadores = new Map();
  for (const [id] of grupos) {
    const s = porId.get(id);
    if (!s) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hero__hot';
    b.innerHTML = icono(id);
    b.setAttribute('aria-label', `${s.nombre}: fijar el servicio`);
    b.setAttribute('aria-pressed', 'false');
    b.dataset.id = String(id);
    b.addEventListener('click', () => fijar(fijo === id ? null : id));
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') entrar(id); });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') salir(); });
    // Teclado: Tab muestra el servicio igual que el hover; Enter lo fija (click)
    b.addEventListener('focus', () => { if (b.matches(':focus-visible')) entrar(id); });
    b.addEventListener('blur', () => salir());
    capa.appendChild(b);
    marcadores.set(id, b);
  }

  // ---------- Resaltado + rótulo ----------
  let fijo = null;
  function resaltar(id) {
    for (const [gid, g] of grupos) {
      const on = id === null || gid === id;
      g.edge.color.setHex(id !== null && gid === id ? BLANCO : AZUL_CLARO);
      g.edge.opacity = on ? 1 : 0.22;
      g.fill.color.setHex(id !== null && gid === id ? ACENTO : NAVY);
      g.fill.opacity = on ? (id !== null ? 0.55 : 0.88) : 0.35;
      if (g.extra) g.extra.opacity = on ? 0.95 : 0.25;
    }
    marcadores.forEach((b, mid) => b.toggleAttribute('data-activo', mid === id));
    mostrar(id);
    pedirFrame();
  }
  function fijar(id) {
    clearTimeout(cierre);
    fijo = id;
    marcadores.forEach((b, mid) => {
      b.toggleAttribute('data-fijo', mid === id);
      b.setAttribute('aria-pressed', String(mid === id));
    });
    rotulo?.toggleAttribute('data-fijo', id !== null);
    resaltar(id);
    franjaPara(id);
    pausaGiro = performance.now();
  }

  // Pasar el mouse = vista previa; la maqueta se detiene mientras está sobre un ícono.
  // Al salir se espera un instante: de un ícono a otro el titular cambia directo,
  // sin volver al original en medio. Con un servicio fijado el hover no cambia nada.
  let sobre = false;
  let cierre = 0;
  function entrar(id) {
    clearTimeout(cierre);
    sobre = true;
    if (fijo === null) resaltar(id);
  }
  function salir() {
    sobre = false;
    clearTimeout(cierre);
    if (fijo === null) cierre = setTimeout(() => { if (fijo === null && !sobre) resaltar(null); }, 220);
  }

  // Soltar: Esc, o clic fuera de los íconos y del servicio mostrado.
  // El clic que fija tiene como destino el ícono (.hero__hot) y aquí se ignora;
  // el clic que cierra un arrastre de la maqueta tampoco cuenta como «fuera».
  let trasArrastre = false;
  const alPresionar = () => { trasArrastre = false; };
  document.addEventListener('pointerdown', alPresionar, true);
  const alClic = (e) => {
    if (trasArrastre) { trasArrastre = false; return; }
    if (fijo === null) return;
    if (e.target.closest?.('.hero__hot, .hero__rotulo, .hero__franja')) return;
    fijar(null);
  };
  document.addEventListener('click', alClic);
  const alTeclado = (e) => { if (e.key === 'Escape' && fijo !== null) fijar(null); };
  document.addEventListener('keydown', alTeclado);

  // ---------- Giro: arrastre horizontal + giro automático lento ----------
  let yaw = -0.55, yawObjetivo = yaw;
  let arrastre = null;
  let pausaGiro = 0;
  // El arrastre vive en el marco (el lienzo no recibe eventos: está detrás del texto)
  const lienzo = marco;
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.hero__hot, a, button')) return;
    arrastre = { x: e.clientX, id: e.pointerId, movio: false };
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const dx = e.clientX - arrastre.x;
    if (!arrastre.movio && Math.abs(dx) > 4) {
      arrastre.movio = true;
      lienzo.setPointerCapture(e.pointerId);
      el.dataset.arrastrando = '';
    }
    if (arrastre.movio) {
      yawObjetivo += dx * 0.008;
      arrastre.x = e.clientX;
      pausaGiro = performance.now();
      pedirFrame();
    }
  });
  const soltar = () => {
    // Un arrastre (pasó el umbral de 4px) no cuenta como «clic fuera»
    if (arrastre?.movio) trasArrastre = true;
    arrastre = null;
    delete el.dataset.arrastrando;
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  // ---------- Estado del bucle (antes de ajustar(), que ya pide un frame) ----------
  let visible = true;
  let raf = 0;
  let ultimo = performance.now();
  const inicio = performance.now();
  const v = new THREE.Vector3();
  function pedirFrame() { if (!raf) raf = requestAnimationFrame(frame); }

  // ---------- Tamaño ----------
  let ancho = 1, alto = 1;
  function ajustar() {
    ancho = cont.clientWidth || 1;
    alto = cont.clientHeight || 1;
    renderer.setSize(ancho, alto, false);
    camera.aspect = ancho / alto;
    // Zona donde vive la maqueta (fracciones del lienzo), medida desde .hero__zona.
    // OCUPA/1.1: la losa termina ocupando ~75 % del ancho del marco (1.1 = margen de giro).
    const c = cont.getBoundingClientRect();
    const z = zonaEl.getBoundingClientRect();
    if (z.width > 0 && z.height > 0) {
      zona = {
        cx: (z.left + z.width / 2 - c.left) / ancho,
        cy: (z.top + z.height * 0.46 - c.top) / alto, // un poco arriba: el peso visual está en los edificios
        ancho: (z.width / ancho) * OCUPA,
        alto: z.height / alto,
      };
    }
    // Solo se dibuja dentro del marco: nada se sale del borde
    const m = marco.getBoundingClientRect();
    const arriba = m.top - c.top + 1;
    const abajo = m.bottom - c.top - 1;
    renderer.setScissor(m.left - c.left + 1, alto - abajo, m.width - 2, Math.max(0, abajo - arriba));
    renderer.setScissorTest(true);
    camera.setViewOffset(ancho, alto, -(zona.cx - 0.5) * ancho, (0.5 - zona.cy) * alto, ancho, alto);
    camera.updateProjectionMatrix();
    distCam = distanciaPara(yaw);
    encuadrar();
    pedirFrame();
  }
  const OCUPA = 0.75 * 1.1;
  let zona = { cx: 0.5, ancho: 1, cy: 0.5, alto: 1 };
  // Distancia para que la losa (26 × 18) quepa a lo ancho en el ángulo actual
  const TAN_V = Math.tan((camera.fov * Math.PI) / 360);
  function distanciaPara(a) {
    const anchoVisible = 26 * Math.abs(Math.cos(a)) + 18 * Math.abs(Math.sin(a));
    const porAncho = (anchoVisible / 2) / (TAN_V * camera.aspect * zona.ancho) * 1.1;
    const porAlto = 8.6 / (TAN_V * zona.alto); // que tampoco se corte arriba/abajo
    return Math.max(porAncho, porAlto);
  }
  let distCam = 50;
  function encuadrar() {
    const elev = 0.62;
    camera.position.set(0, Math.sin(elev) * distCam, Math.cos(elev) * distCam);
    camera.lookAt(0, 0.8, 0.4);
  }
  const ro = new ResizeObserver(ajustar);
  ro.observe(cont);
  ro.observe(zonaEl);
  ajustar();

  // ---------- Bucle (solo mientras se ve) ----------
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; pedirFrame(); });
  io.observe(cont);

  function frame(ahora) {
    raf = 0;
    if (destruida) return;
    if (!el.isConnected) return destruir();
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const t = (ahora - inicio) / 1000;

    // Entrada: cada grupo "se levanta" del plano, escalonado
    let entrando = false;
    for (const g of grupos.values()) {
      const p = reducido ? 1 : Math.min(1, Math.max(0, (t * 1000 - 80 - g.retraso * 70) / 650));
      g.grupo.scale.y = Math.max(0.001, easeOut(p));
      if (p < 1) entrando = true;
    }

    const quieto = reducido || fijo !== null || sobre || arrastre || ahora - pausaGiro < 3500;
    if (!quieto) yawObjetivo += dt * 0.07;
    yaw += (yawObjetivo - yaw) * Math.min(1, dt * 9);
    mundo.rotation.y = yaw;
    distCam += (distanciaPara(yaw) - distCam) * Math.min(1, dt * 6);
    encuadrar();

    if (!reducido) {
      // Pulsos de energía por las canalizaciones
      for (let i = 0; i < PULSOS; i++) {
        const ruta = rutas[i % rutas.length];
        const u = (t * 0.22 + i / PULSOS + (i % 2) * 0.5) % 1;
        ruta.getPointAt(u, v);
        pulsosPos.set([v.x, 0.12, v.z], i * 3);
      }
      pulsosGeo.attributes.position.needsUpdate = true;
      // Cajas en el conveyor
      cajasConveyor.forEach((c, i) => { c.position.x = -0.2 + ((t * 0.6 + i * 1.7) % 5.1); });
    }
    if (onda) {
      for (let i = 0; i < onda.N; i++) {
        const x = i / (onda.N - 1);
        const fase = reducido ? 0 : t * 3;
        const y = Math.sin(x * Math.PI * 6 + fase) * 0.42 + Math.sin(x * Math.PI * 30 + fase * 2) * 0.06;
        onda.pos.set([-5.7 + x * 2.2, 3.6 + y, 3.2], i * 3);
      }
      onda.geo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);

    // Marcadores sobre su grupo
    mundo.updateMatrixWorld();
    for (const [id, b] of marcadores) {
      v.copy(grupos.get(id).ancla);
      v.y *= grupos.get(id).grupo.scale.y;
      mundo.localToWorld(v).project(camera);
      // `translate` (no `transform`): el `scale` de hover/press se aplica antes y no lo desplaza
      b.style.translate = `${(v.x * 0.5 + 0.5) * ancho}px ${(-v.y * 0.5 + 0.5) * alto}px`;
    }

    if (el.dataset.estado !== 'listo') el.dataset.estado = 'listo';
    const animando = !reducido || entrando || Math.abs(yawObjetivo - yaw) > 0.0005;
    if (visible && !document.hidden && animando) pedirFrame();
  }
  document.addEventListener('visibilitychange', pedirFrame);
  // View transitions: al salir de la página se libera el contexto WebGL
  document.addEventListener('astro:before-swap', destruir, { once: true });

  let destruida = false;
  function destruir() {
    if (destruida) return;
    destruida = true;
    cancelAnimationFrame(raf);
    clearTimeout(cierre);
    clearTimeout(franjaCierre);
    relojes.forEach(clearTimeout);
    ro.disconnect();
    roRotulo.disconnect();
    document.removeEventListener('click', alClic);
    document.removeEventListener('pointerdown', alPresionar, true);
    io.disconnect();
    document.removeEventListener('keydown', alTeclado);
    document.removeEventListener('visibilitychange', pedirFrame);
    renderer.dispose();
    renderer.forceContextLoss();
  }

  pedirFrame();
}
