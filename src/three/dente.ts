import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { gsap } from 'gsap'

/**
 * Molar inferior procedural: nenhum modelo ou textura é baixado.
 * Estados: inicio, implante (explode em coroa/pilar/parafuso), clareamento (cor pela escala),
 * alinhador (placa transparente desce sobre a coroa), prevencao.
 */

export type Estado = 'inicio' | 'implante' | 'clareamento' | 'alinhador' | 'prevencao'

interface Params {
  explodir: number
  raiz: number
  cor: number
  placa: number
  escala: number
  inclina: number
  entrada: number
}

const ESTADOS: Record<Estado, Partial<Params>> = {
  inicio: { explodir: 0, raiz: 1, cor: 0.8, placa: 0, escala: 1, inclina: 0.22 },
  implante: { explodir: 1, raiz: 0, cor: 0.9, placa: 0, escala: 0.86, inclina: 0.08 },
  clareamento: { explodir: 0, raiz: 1, placa: 0, escala: 1.12, inclina: 0.42 },
  alinhador: { explodir: 0, raiz: 1, cor: 0.85, placa: 1, escala: 1.1, inclina: 0.3 },
  prevencao: { explodir: 0, raiz: 1, cor: 1, placa: 0, escala: 1, inclina: 0.18 },
}

const COR_A3 = new THREE.Color('#d9bf8c')
const COR_B1 = new THREE.Color('#f8f5ee')

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

function geometriaCoroa(seg: number) {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75))
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  g = mergeVertices(g)
  const p = g.attributes.position as THREE.BufferAttribute
  const cuspides = [
    [0.46, 0.4],
    [-0.46, 0.4],
    [0.46, -0.4],
    [-0.46, -0.4],
    [0, 0.52],
  ]
  for (let i = 0; i < p.count; i++) {
    const ox = p.getX(i), oy = p.getY(i), oz = p.getZ(i)
    // superelipsoide: deixa a esfera "quadradinha" como a coroa de um molar
    let x = Math.sign(ox) * Math.pow(Math.abs(ox), 0.62)
    let z = Math.sign(oz) * Math.pow(Math.abs(oz), 0.62)
    let y = Math.sign(oy) * Math.pow(Math.abs(oy), 0.9)

    const topo = smooth(0.3, 0.95, oy)
    let h = 0
    for (const [cx, cz] of cuspides) h += Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 0.075) * 0.24
    const sulco = Math.exp(-(x * x) / 0.005) * 0.11 + Math.exp(-(z * z) / 0.008) * 0.07
    y += topo * (h - sulco - 0.16)

    // bojo lateral e colo (estreitamento perto da gengiva)
    const bojo = 1 + 0.04 * Math.exp(-((oy - 0.2) ** 2) / 0.06)
    const colo = 1 - 0.3 * smooth(0.0, -1, oy)
    x *= bojo * colo * 0.98
    z *= bojo * colo * 0.86
    p.setXYZ(i, x, y * 0.72, z)
  }
  g.computeVertexNormals()
  return g
}

function geometriaRaiz(lado: number, comprimento: number, seg: number) {
  // perfil girado (lathe): largo no colo, afinando até uma ponta arredondada
  const perfil: THREE.Vector2[] = []
  const n = 40
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const r = 0.44 * Math.pow(1 - t, 0.5) * (1 - 0.35 * t)
    perfil.push(new THREE.Vector2(Math.max(r, 0.0001), -t * comprimento))
  }
  const g = new THREE.LatheGeometry(perfil, seg)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i)
    const y = p.getY(i)
    const t = -y / comprimento
    z *= 0.7
    // as duas raízes se afastam no meio e voltam um pouco na ponta, como num molar inferior
    x += lado * (0.42 * t - 0.2 * t * t)
    p.setXYZ(i, x, y, z)
  }
  g.translate(lado * 0.34, -0.3, 0)
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
    const theta = Math.atan2(z, x)
    const fase = theta + (y / passo) * Math.PI * 2
    const rosca = 0.06 * Math.pow(0.5 + 0.5 * Math.sin(fase), 2.2) * smooth(-alt / 2, -alt / 2 + 0.2, y) * (1 - smooth(alt / 2 - 0.15, alt / 2, y))
    const k = (r + rosca) / r
    p.setXYZ(i, x * k, y, z * k)
  }
  g.computeVertexNormals()
  return g
}

export interface Dente {
  irPara(estado: Estado): void
  definirCor(v: number, animar?: boolean): void
  pausar(p: boolean): void
}

export function iniciarDente(canvas: HTMLCanvasElement, opcoes: { reduzido: boolean; inicial?: Estado }): Dente | null {
  const movel = window.matchMedia('(max-width: 900px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !movel, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, movel ? 1.5 : 2))
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const cena = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture
  cena.environmentIntensity = 0.9

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0.2, 7.5)

  const chave = new THREE.DirectionalLight(0xffffff, 1.6)
  chave.position.set(-3, 4, 5)
  const contorno = new THREE.DirectionalLight(0xf2c4cc, 1.3)
  contorno.position.set(3, 1, -4)
  cena.add(chave, contorno, new THREE.AmbientLight(0xe6eef5, 0.25))

  const seg = movel ? 96 : 160

  const esmalte = new THREE.MeshPhysicalMaterial({
    color: COR_B1.clone(),
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    sheen: 0.5,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color('#ffffff'),
    specularIntensity: 0.8,
  })
  const cemento = new THREE.MeshPhysicalMaterial({ color: '#e9dcc0', roughness: 0.55, transparent: true, side: THREE.DoubleSide })
  const titanio = new THREE.MeshPhysicalMaterial({ color: '#b3bac2', metalness: 1, roughness: 0.3, transparent: true })
  const ouro = new THREE.MeshPhysicalMaterial({ color: '#d2b373', metalness: 1, roughness: 0.25, transparent: true })
  // placa do alinhador: vidro azulado, visível mas deixando o dente aparecer
  const placaMat = new THREE.MeshPhysicalMaterial({
    color: '#bcd3ea', metalness: 0, roughness: 0.06, transparent: true, opacity: 0,
    clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.6, iridescenceIOR: 1.3, depthWrite: false, side: THREE.DoubleSide,
    specularIntensity: 1,
  })
  const placaBorda = new THREE.MeshBasicMaterial({ color: '#7fa3c6', transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false })

  const geoCoroa = geometriaCoroa(seg)
  const coroa = new THREE.Mesh(geoCoroa, esmalte)
  const raizes = new THREE.Group()
  raizes.add(new THREE.Mesh(geometriaRaiz(-1, 2.15, movel ? 32 : 56), cemento), new THREE.Mesh(geometriaRaiz(1, 1.95, movel ? 32 : 56), cemento))

  const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.5, 6, 1), ouro)
  const parafuso = new THREE.Mesh(geometriaParafuso(movel ? 64 : 96), titanio)
  const placa = new THREE.Group()
  const placaCasca = new THREE.Mesh(geoCoroa, placaMat)
  placaCasca.scale.set(1.09, 1.08, 1.11)
  const placaContorno = new THREE.Mesh(geoCoroa, placaBorda)
  placaContorno.scale.set(1.11, 1.1, 1.13)
  placa.add(placaContorno, placaCasca)

  const dente = new THREE.Group()
  dente.add(coroa, raizes, pilar, parafuso, placa)
  dente.position.y = 0.85
  const pivo = new THREE.Group()
  pivo.add(dente)
  cena.add(pivo)

  const params: Params = { explodir: 0, raiz: 1, cor: 0.8, placa: 0, escala: 1, inclina: 0.22, entrada: opcoes.reduzido ? 1 : 0, ...ESTADOS[opcoes.inicial ?? 'inicio'] }
  const ponteiro = { x: 0, y: 0, ax: 0, ay: 0 }
  let pausado = false
  let larg = 1, alt = 1, deslX = 0, deslY = 0, escalaBase = 1

  function layout() {
    larg = canvas.clientWidth || window.innerWidth
    alt = canvas.clientHeight || window.innerHeight
    renderer.setSize(larg, alt, false)
    camera.aspect = larg / alt
    camera.updateProjectionMatrix()
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const visW = visH * camera.aspect
    const estreito = larg < 900
    deslX = estreito ? 0 : visW * 0.235
    deslY = estreito ? visH * 0.26 : 0
    escalaBase = estreito ? Math.min(0.44, visW * 0.2) : Math.min(0.74, visH * 0.18)
  }
  layout()
  const ro = new ResizeObserver(layout)
  ro.observe(canvas)

  if (!opcoes.reduzido) {
    window.addEventListener('pointermove', (e) => {
      ponteiro.x = (e.clientX / window.innerWidth) * 2 - 1
      ponteiro.y = (e.clientY / window.innerHeight) * 2 - 1
    }, { passive: true })
    gsap.to(params, { entrada: 1, duration: 2.2, ease: 'expo.out', delay: 0.1 })
  }

  const cor = new THREE.Color()
  let ultimo = performance.now()
  let giro = -0.75

  function quadro() {
    if (pausado) return
    const agora = performance.now()
    const dt = Math.min((agora - ultimo) / 1000, 0.05)
    ultimo = agora
    if (!opcoes.reduzido) giro += dt * (0.28 + 0.2 * params.explodir)
    ponteiro.ax += (ponteiro.x - ponteiro.ax) * 0.05
    ponteiro.ay += (ponteiro.y - ponteiro.ay) * 0.05

    const e = params.entrada
    pivo.position.set(deslX, deslY + (1 - e) * -0.8, 0)
    const s = escalaBase * params.escala * (0.85 + 0.15 * e)
    pivo.scale.setScalar(s)
    pivo.rotation.set(params.inclina + ponteiro.ay * 0.12, giro + ponteiro.ax * 0.3 + (1 - e) * -1.4, -0.08)

    cor.copy(COR_A3).lerp(COR_B1, params.cor)
    esmalte.color.copy(cor)

    // implante: a coroa sobe, o pilar e o parafuso entram por baixo, as raízes somem
    const x = params.explodir
    coroa.position.y = x * 0.62
    pilar.position.y = -0.52 + (1 - x) * -0.9
    parafuso.position.y = -1.42 + (1 - x) * -1.2
    titanio.opacity = ouro.opacity = x
    pilar.visible = parafuso.visible = x > 0.01
    pilar.rotation.y = -giro * 0.5
    parafuso.rotation.y = giro * 1.4

    raizes.position.y = (1 - params.raiz) * -0.7
    cemento.opacity = params.raiz
    raizes.visible = params.raiz > 0.01

    placa.position.y = coroa.position.y + 0.02 + (1 - params.placa) * 1.6
    placaMat.opacity = params.placa * 0.55
    placaBorda.opacity = params.placa * 0.35
    placa.visible = params.placa > 0.01

    renderer.render(cena, camera)
  }
  renderer.setAnimationLoop(quadro)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ultimo = performance.now() })

  let corManual: number | null = null
  return {
    irPara(estado) {
      const alvo = { ...ESTADOS[estado] }
      if (estado === 'clareamento') alvo.cor = corManual ?? 0
      gsap.to(params, { ...alvo, duration: opcoes.reduzido ? 0 : 1.3, ease: 'power3.inOut', overwrite: 'auto' })
    },
    definirCor(v, animar = true) {
      corManual = v
      gsap.to(params, { cor: v, duration: animar && !opcoes.reduzido ? 0.6 : 0, ease: 'power2.out', overwrite: 'auto' })
    },
    pausar(p) {
      if (p === pausado) return
      pausado = p
      if (!p) ultimo = performance.now()
    },
  }
}
