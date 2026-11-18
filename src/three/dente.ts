import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { gsap } from 'gsap'

/**
 * Molar inferior procedural (nenhum modelo ou textura é baixado).
 * inicio: gira com um anel de escaneamento passando · implante: coroa, pilar e parafuso separados ·
 * clareamento: cor pela escala A3→B1 · alinhador: placa transparente encaixa · prevencao: dente inteiro.
 */

export type Estado = 'inicio' | 'implante' | 'clareamento' | 'alinhador' | 'prevencao'

interface Params {
  explodir: number
  raiz: number
  cor: number
  placa: number
  escala: number
  inclina: number
  scan: number
  entrada: number
  trilha: number
}

const ESTADOS: Record<Estado, Partial<Params>> = {
  inicio: { explodir: 0, raiz: 1, cor: 0.85, placa: 0, escala: 1, inclina: 0.2, scan: 1 },
  implante: { explodir: 1, raiz: 0, cor: 0.95, placa: 0, escala: 0.84, inclina: 0.08, scan: 0 },
  clareamento: { explodir: 0, raiz: 1, placa: 0, escala: 1.08, inclina: 0.4, scan: 0 },
  alinhador: { explodir: 0, raiz: 1, cor: 0.9, placa: 1, escala: 1.04, inclina: 0.3, scan: 0 },
  prevencao: { explodir: 0, raiz: 1, cor: 1, placa: 0, escala: 0.98, inclina: 0.16, scan: 0 },
}

// multiplicam a cor por vértice da coroa: A3 amarela tudo, B1 deixa a cor natural do esmalte
const COR_A3 = new THREE.Color('#e3c089')
const COR_B1 = new THREE.Color('#ffffff')

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/**
 * Coroa de primeiro molar inferior: 5 cúspides (3 vestibulares, 2 linguais, as linguais mais altas),
 * sulco central ondulado, sulcos vestibular e lingual, mesa oclusal mais estreita que o bojo
 * e colo estreitando até a junção com a raiz. A cor vem por vértice: marfim no colo, branco no meio,
 * translúcido azulado nas pontas das cúspides e sombra dentro dos sulcos.
 */
const CUSPIDES: [number, number, number][] = [
  [-0.56, 0.44, 0.15], // mesiovestibular
  [0.0, 0.5, 0.14], // distovestibular
  [0.56, 0.4, 0.105], // distal
  [-0.44, -0.44, 0.185], // mesiolingual
  [0.44, -0.44, 0.165], // distolingual
]

function geometriaCoroa(seg: number) {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.8))
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  g = mergeVertices(g)
  const p = g.attributes.position as THREE.BufferAttribute
  const cores = new Float32Array(p.count * 3)
  const cColo = new THREE.Color('#ecdcbc'), cMeio = new THREE.Color('#fbf9f4'), cPonta = new THREE.Color('#e9eff7'), cSulco = new THREE.Color('#c4ad85')
  const c = new THREE.Color()

  for (let i = 0; i < p.count; i++) {
    const ox = p.getX(i), oy = p.getY(i), oz = p.getZ(i)
    let x = Math.sign(ox) * Math.pow(Math.abs(ox), 0.55)
    let z = Math.sign(oz) * Math.pow(Math.abs(oz), 0.55)
    let y = Math.sign(oy) * Math.pow(Math.abs(oy), 0.8)

    const topo = smooth(0.22, 0.97, oy)
    let h = 0
    for (const [cx, cz, a] of CUSPIDES) h += Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 0.07) * a * 1.3
    const zc = 0.06 * Math.sin(x * 3.2)
    const central = Math.exp(-((z - zc) ** 2) / 0.0035) * 0.085 * (1 - smooth(0.7, 1, Math.abs(x)))
    const vestibular = (Math.exp(-((x + 0.28) ** 2) / 0.0025) * 0.05 + Math.exp(-((x - 0.3) ** 2) / 0.0025) * 0.032) * smooth(0.05, 0.6, z)
    const lingual = Math.exp(-(x * x) / 0.0025) * 0.05 * smooth(-0.05, -0.6, z)
    const fossa = Math.exp(-(x * x + z * z) / 0.01) * 0.03
    const sulco = central + vestibular + lingual + fossa
    const ruido = Math.sin(9 * ox + 2 * oz) * Math.sin(7 * oz - 3 * oy) * Math.sin(11 * oy + ox) * 0.007

    y += topo * (h - sulco - 0.13) + ruido

    const mesa = 1 - 0.1 * smooth(0.3, 1, oy)
    const bojo = 1 + 0.03 * Math.exp(-((oy - 0.1) ** 2) / 0.06)
    const colo = 1 - 0.5 * smooth(0.05, -0.9, oy)
    const k = mesa * bojo * colo * (1 + ruido)
    x *= k * 1.06
    z *= k * 0.9
    p.setXYZ(i, x, y * 0.8, z)

    c.copy(cColo).lerp(cMeio, smooth(-0.85, 0.5, oy))
    c.lerp(cPonta, clamp01(h * 4.5) * topo * 0.85)
    c.lerp(cSulco, clamp01(sulco * 10) * topo * 0.9)
    cores.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  g.computeVertexNormals()
  return g
}

/**
 * Raiz mesial ou distal: largas no sentido vestíbulo-lingual e finas no mésio-distal,
 * unidas num tronco perto do colo e separando depois da furca; as duas pontas curvam para distal.
 */
function geometriaRaiz(lado: number, comprimento: number, seg: number) {
  const perfil: THREE.Vector2[] = []
  const n = 56
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const r = 0.5 * Math.pow(1 - t, 0.55) * (1 - 0.2 * t)
    perfil.push(new THREE.Vector2(Math.max(r, 0.0001), -t * comprimento))
  }
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(perfil, seg)
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  g = mergeVertices(g)
  const p = g.attributes.position as THREE.BufferAttribute
  const cores = new Float32Array(p.count * 3)
  const cTopo = new THREE.Color('#f0e5cf'), cPonta = new THREE.Color('#dcc79f')
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i)
    const y = p.getY(i)
    const t = -y / comprimento
    x *= 0.74
    z *= 1.22 * (1 - 0.3 * t)
    // sulco longitudinal raso no meio da face da raiz
    x *= 1 - 0.12 * Math.exp(-(z * z) / 0.02) * smooth(0.1, 0.4, t)
    x += lado * (0.17 + 0.27 * smooth(0.15, 0.85, t)) + 0.16 * t * t
    p.setXYZ(i, x, y, z)
    c.copy(cTopo).lerp(cPonta, Math.pow(t, 1.3))
    cores.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  g.translate(0, -0.22, 0)
  g.computeVertexNormals()
  return g
}

function geometriaParafuso(seg: number) {
  const alt = 1.5
  const g = new THREE.CylinderGeometry(0.27, 0.17, alt, seg, Math.round(seg * 1.8), false)
  const p = g.attributes.position as THREE.BufferAttribute
  const passo = 0.13
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-4 || Math.abs(y) > alt / 2 - 0.02) continue
    const fase = Math.atan2(z, x) + (y / passo) * Math.PI * 2
    const rosca = 0.06 * Math.pow(0.5 + 0.5 * Math.sin(fase), 2.2) * smooth(-alt / 2, -alt / 2 + 0.2, y) * (1 - smooth(alt / 2 - 0.15, alt / 2, y))
    const k = (r + rosca) / r
    p.setXYZ(i, x * k, y, z * k)
  }
  g.computeVertexNormals()
  return g
}

export interface Dente {
  irPara(estado: Estado, naTrilha?: boolean): void
  definirCor(v: number): void
  girarComRolagem(p: number): void
  pausar(p: boolean): void
}

export function iniciarDente(canvas: HTMLCanvasElement, opcoes: { reduzido: boolean; inicial?: Estado }): Dente | null {
  const movel = window.matchMedia('(max-width: 900px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, movel ? 1.6 : 2))
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const cena = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
  cena.environmentIntensity = 0.75

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0.2, 7.5)

  const chave = new THREE.DirectionalLight(0xffffff, 1.7)
  chave.position.set(-3, 4, 5)
  const azul = new THREE.DirectionalLight(0x5b8cff, 2.4)
  azul.position.set(4, 0.5, -3)
  const azulBaixo = new THREE.DirectionalLight(0x3b82f6, 0.9)
  azulBaixo.position.set(-2, -4, 2)
  const preenche = new THREE.DirectionalLight(0xfff6ea, 0.7)
  preenche.position.set(1, -3, 4)
  cena.add(chave, azul, azulBaixo, preenche, new THREE.AmbientLight(0xe8f0ff, 0.3))

  const seg = movel ? 110 : 170
  const esmalte = new THREE.MeshPhysicalMaterial({
    color: COR_B1.clone(), vertexColors: true, roughness: 0.13, ior: 1.62, specularIntensity: 1,
    clearcoat: 1, clearcoatRoughness: 0.09, sheen: 0.35, sheenRoughness: 0.3, sheenColor: new THREE.Color('#dfe9ff'),
  })
  const cemento = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.4, transparent: true })
  const titanio = new THREE.MeshPhysicalMaterial({ color: '#c3cad3', metalness: 1, roughness: 0.26, transparent: true })
  const ouro = new THREE.MeshPhysicalMaterial({ color: '#d6b878', metalness: 1, roughness: 0.22, transparent: true })
  const placaMat = new THREE.MeshPhysicalMaterial({
    color: '#a9c8ff', roughness: 0.05, transparent: true, opacity: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    iridescence: 0.7, iridescenceIOR: 1.3, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1,
  })
  const placaBorda = new THREE.MeshBasicMaterial({ color: '#3b82f6', transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false })
  const anelMat = new THREE.MeshBasicMaterial({ color: '#3b82f6', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  const discoMat = new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })

  const geoCoroa = geometriaCoroa(seg)
  const coroa = new THREE.Mesh(geoCoroa, esmalte)
  const raizes = new THREE.Group()
  raizes.add(new THREE.Mesh(geometriaRaiz(-1, 2.2, movel ? 48 : 72), cemento), new THREE.Mesh(geometriaRaiz(1, 2.0, movel ? 48 : 72), cemento))
  const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.5, 6, 1), ouro)
  const parafuso = new THREE.Mesh(geometriaParafuso(movel ? 72 : 110), titanio)

  const placa = new THREE.Group()
  const casca = new THREE.Mesh(geoCoroa, placaMat)
  casca.scale.set(1.09, 1.08, 1.11)
  const contorno = new THREE.Mesh(geoCoroa, placaBorda)
  contorno.scale.set(1.11, 1.1, 1.13)
  placa.add(contorno, casca)

  // anel de escaneamento: sobe e desce pelo dente na abertura
  const scan = new THREE.Group()
  const anel = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.012, 8, 160), anelMat)
  anel.rotation.x = Math.PI / 2
  const disco = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.45, 96), discoMat)
  disco.rotation.x = Math.PI / 2
  scan.add(anel, disco)

  const dente = new THREE.Group()
  dente.add(coroa, raizes, pilar, parafuso, placa)
  dente.position.y = 0.85
  const pivo = new THREE.Group()
  pivo.add(dente)
  cena.add(pivo, scan)

  const params: Params = { explodir: 0, raiz: 1, cor: 0.85, placa: 0, escala: 1, inclina: 0.2, scan: 0, entrada: opcoes.reduzido ? 1 : 0, trilha: 0, ...ESTADOS[opcoes.inicial ?? 'inicio'] }
  const ponteiro = { x: 0, y: 0, ax: 0, ay: 0 }
  let pausado = false
  let visW = 1, visH = 1, estreito = false
  let giroRolagem = 0, giroRolagemSuave = 0

  function layout() {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    visW = visH * camera.aspect
    estreito = w < 900
  }
  layout()
  new ResizeObserver(layout).observe(canvas)

  if (!opcoes.reduzido) {
    window.addEventListener('pointermove', (e) => {
      ponteiro.x = (e.clientX / window.innerWidth) * 2 - 1
      ponteiro.y = (e.clientY / window.innerHeight) * 2 - 1
    }, { passive: true })
    gsap.to(params, { entrada: 1, duration: 2.4, ease: 'expo.out', delay: 0.1 })
  }

  const cor = new THREE.Color()
  let ultimo = performance.now()
  let giro = -0.75
  let tempo = 0

  function quadro() {
    if (pausado) return
    const agora = performance.now()
    const dt = Math.min((agora - ultimo) / 1000, 0.05)
    ultimo = agora
    tempo += dt
    if (!opcoes.reduzido) giro += dt * (0.22 + 0.15 * params.explodir) * (1 - params.trilha * 0.6)
    ponteiro.ax += (ponteiro.x - ponteiro.ax) * 0.05
    ponteiro.ay += (ponteiro.y - ponteiro.ay) * 0.05
    giroRolagemSuave += (giroRolagem - giroRolagemSuave) * 0.08

    // posição: abertura à direita (computador) ou em cima (celular); trilha idem, um pouco menor no celular
    const e = params.entrada
    const t = params.trilha
    // no celular, dentro da trilha, o dente fica menor e mais alto para o cartão de texto caber inteiro
    const baseEsc = estreito ? Math.min(0.46, visW * 0.21) * (1 - 0.46 * t) : Math.min(0.76, visH * 0.185)
    const x = estreito ? 0 : visW * (0.235 - 0.01 * t)
    const y = estreito ? visH * (0.2 + 0.15 * t) : 0
    pivo.position.set(x, y + (1 - e) * -0.8, 0)
    pivo.scale.setScalar(baseEsc * params.escala * (0.85 + 0.15 * e))
    pivo.rotation.set(params.inclina + ponteiro.ay * 0.12, giro + giroRolagemSuave + ponteiro.ax * 0.3 + (1 - e) * -1.4, -0.08)

    cor.copy(COR_A3).lerp(COR_B1, params.cor)
    esmalte.color.copy(cor)

    const xp = params.explodir
    coroa.position.y = xp * 0.62
    pilar.position.y = -0.52 + (1 - xp) * -0.9
    parafuso.position.y = -1.42 + (1 - xp) * -1.2
    titanio.opacity = ouro.opacity = xp
    pilar.visible = parafuso.visible = xp > 0.01
    pilar.rotation.y = -giro * 0.5
    parafuso.rotation.y = giro * 1.4

    raizes.position.y = (1 - params.raiz) * -0.7
    cemento.opacity = params.raiz
    raizes.visible = params.raiz > 0.01

    placa.position.y = coroa.position.y + 0.02 + (1 - params.placa) * 1.6
    placaMat.opacity = params.placa * 0.3
    placaBorda.opacity = params.placa * 0.22
    placa.visible = params.placa > 0.01

    // escaneamento: percorre do topo da coroa até a ponta das raízes
    const sOn = params.scan * e
    scan.visible = sOn > 0.01
    if (scan.visible) {
      const fase = (Math.sin(tempo * 0.9) + 1) / 2
      const altura = 1.55 - fase * 3.9
      scan.position.copy(pivo.position)
      scan.position.y += (dente.position.y + altura) * pivo.scale.y
      scan.scale.setScalar(pivo.scale.x * (altura > 0.1 ? 1 : 0.62 + 0.38 * smooth(-2.4, 0.1, altura)))
      scan.rotation.set(pivo.rotation.x * 0.6, 0, 0)
      anelMat.opacity = sOn * 0.95
      discoMat.opacity = sOn * 0.12
    }

    renderer.render(cena, camera)
  }
  renderer.setAnimationLoop(quadro)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ultimo = performance.now() })

  let corManual: number | null = null
  return {
    irPara(estado, naTrilha = false) {
      const alvo: Partial<Params> = { ...ESTADOS[estado], trilha: naTrilha ? 1 : 0 }
      if (estado === 'clareamento') alvo.cor = corManual ?? 0
      gsap.to(params, { ...alvo, duration: opcoes.reduzido ? 0 : 1.2, ease: 'power3.inOut', overwrite: 'auto' })
    },
    definirCor(v) {
      corManual = v
      gsap.to(params, { cor: v, duration: opcoes.reduzido ? 0 : 0.6, ease: 'power2.out', overwrite: 'auto' })
    },
    girarComRolagem(p) {
      giroRolagem = p * Math.PI * 2
    },
    pausar(p) {
      if (p === pausado) return
      pausado = p
      if (!p) ultimo = performance.now()
    },
  }
}
