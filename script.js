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

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().load(
  "https://raw.githubusercontent.com/nikhil257/three-ocean-project/main/studio-background.hdr",
  (hdrTexture) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

    scene.environment = envMap;

    hdrTexture.dispose();
    pmremGenerator.dispose();

    console.log("HDRI loaded");
  }
);

let camera;

const loader = new GLTFLoader();

loader.load(
  "https://raw.githubusercontent.com/nikhil257/three-ocean-project/main/chatmodel.glb",

  (gltf) => {
    console.log("GLB loaded:", gltf);
    console.log("Cameras:", gltf.cameras);
    console.log("Scene:", gltf.scene);

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
  },

  undefined,

  (error) => {
    console.error("GLB loading error:", error);
  }
);

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
