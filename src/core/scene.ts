import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state } from './state';
import { STEP } from '../config/cubeConfig';

/** 初始化 Three.js 场景、相机、渲染器、光照、地面与轨道控制，并写入 state。 */
export function initScene(): void {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0c);
  scene.fog = new THREE.Fog(0x0a0a0c, 18, 32);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(6.2, 5.6, 8.2);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.getElementById('app')!.appendChild(renderer.domElement);

  const resizeObserver = new ResizeObserver(() => onResize());
  resizeObserver.observe(document.getElementById('app')!);
  onResize();

  // 光照（与原版一致）
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(8, 12, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
  fillLight.position.set(-8, 4, -6);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffaa66, 0.4);
  rimLight.position.set(-4, -6, 8);
  scene.add(rimLight);

  // 地面阴影
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.35 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -state.ORDER * STEP / 2 - 0.6;
  ground.receiveShadow = true;
  scene.add(ground);

  // 控制
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 4;
  controls.maxDistance = 22;
  controls.enablePan = false;

  // 射线
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  state.controls = controls;
  state.raycaster = raycaster;
  state.pointer = pointer;
}

/** 自适应 #app 尺寸更新相机与渲染器（与原版一致）。 */
export function onResize(): void {
  const app = document.getElementById('app');
  if (!app || !state.camera || !state.renderer) return;
  const width = app.clientWidth;
  const height = app.clientHeight;
  if (width === 0 || height === 0) return;

  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);
}

/** 重建魔方后同步地面高度（由 cubeModel 调用）。 */
export function syncGround(): void {
  if (!state.scene) return;
  const ground = state.scene.children.find((c) => (c as THREE.Mesh).geometry instanceof THREE.CircleGeometry) as THREE.Mesh | undefined;
  if (ground) ground.position.y = -state.ORDER * STEP / 2 - 0.6;
}
