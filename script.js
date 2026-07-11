import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const wrap = document.querySelector(".three-canvas-wrap");

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(wrap.clientWidth, wrap.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 0.7;

wrap.appendChild(renderer.domElement);

const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();

const glbPromise = gltfLoader.loadAsync(
  "https://raw.githubusercontent.com/nikhil257/three-ocean-project/main/chatmodel.glb"
);

const hdrPromise = rgbeLoader.loadAsync(
  "https://raw.githubusercontent.com/nikhil257/three-ocean-project/main/studio-background.hdr"
);

Promise.all([glbPromise, hdrPromise]).then(([gltf, hdrTexture]) => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);

  const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

  scene.environment = envMap;
  scene.environmentIntensity = 0.15;

  hdrTexture.dispose();
  pmremGenerator.dispose();

  scene.add(gltf.scene);

  gltf.scene.traverse((child) => {
    if (child.isLight) {
      if (child.name === "Back_Reflection_Loght") {
        child.intensity = 50;
      }

      if (child.name === "Top_light_2") {
        child.intensity = 30;
      }
    }
  });

  camera = gltf.cameras[0];

  if (!camera) {
    console.error("No camera found inside GLB");
    return;
  }

  camera.aspect = wrap.clientWidth / wrap.clientHeight;
  camera.updateProjectionMatrix();

  animate();
});

let camera;

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  if (!camera) return;

  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  renderer.setSize(width, height);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
