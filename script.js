console.log("THREE OCEAN VERSION 7");

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
renderer.toneMappingExposure = 0.9;

wrap.appendChild(renderer.domElement);

const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();

let camera;
let model;

let modelEntranceReady = false;
let modelEntranceTriggered = false;
let modelEntranceComplete = false;

const mouse = {
  x: 0,
  y: 0,
};

const targetRotation = {
  x: 0,
  y: 0,
};

const clock = new THREE.Clock();

const glbPromise = gltfLoader.loadAsync(
  "https://raw.githubusercontent.com/nikhil257/three-ocean-project/main/chatmodel.glb"
);

const hdrPromise = rgbeLoader.loadAsync(
  "https://raw.githubusercontent.com/nikhil257/three-ocean-project/main/studio-background.hdr"
);

Promise.all([glbPromise, hdrPromise])
  .then(([gltf, hdrTexture]) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const envMap =
      pmremGenerator.fromEquirectangular(hdrTexture).texture;

    scene.environment = envMap;
    scene.environmentIntensity = 0.15;

    hdrTexture.dispose();
    pmremGenerator.dispose();

    scene.add(gltf.scene);

    model = gltf.scene.getObjectByName("Curve");

    if (!model) {
      console.error("Model mesh not found");
      return;
    }

    model.userData.startY = model.position.y;
    model.userData.startRotationX = model.rotation.x;
    model.userData.startRotationY = model.rotation.y;

    model.position.y = model.userData.startY - 0.6;

    modelEntranceReady = true;

    if (modelEntranceTriggered) {
      playModelEntrance();
    }

    // RIM LIGHT TARGET

    const rimTarget = new THREE.Object3D();

    rimTarget.position.set(0, 0, 0);

    scene.add(rimTarget);

    // LEFT RIM LIGHT

    const rimLightLeft = new THREE.SpotLight(
      0xffffff,
      120,
      0,
      Math.PI / 5,
      0.3,
      2
    );

    rimLightLeft.position.set(-4, 3, -4);
    rimLightLeft.target = rimTarget;

    scene.add(rimLightLeft);

    // RIGHT RIM LIGHT

    const rimLightRight = new THREE.SpotLight(
      0x8f5cff,
      100,
      0,
      Math.PI / 5,
      0.3,
      2
    );

    rimLightRight.position.set(4, 2, -4);
    rimLightRight.target = rimTarget;

    scene.add(rimLightRight);

    // GLB LIGHTS

    gltf.scene.traverse((child) => {
      if (!child.isLight) return;

      if (child.name === "Back_Reflection_Loght") {
        child.intensity = 50;
      }

      if (child.name === "Top_light_2") {
        child.intensity = 30;
      }
    });

    // CAMERA

    camera = gltf.cameras[0];

    if (!camera) {
      console.error("No camera found inside GLB");
      return;
    }

    camera.aspect =
      wrap.clientWidth / wrap.clientHeight;

    camera.updateProjectionMatrix();

    console.log("SCENE READY");

    animate();
  })
  .catch((error) => {
    console.error("Scene loading error:", error);
  });


// MODEL ENTRANCE

function playModelEntrance() {
  if (!modelEntranceReady || !model) {
    modelEntranceTriggered = true;
    return;
  }

  modelEntranceTriggered = true;

  gsap.to(model.position, {
    y: model.userData.startY,
    duration: 1.8,
    ease: "power3.out",

    onComplete: () => {
      modelEntranceComplete = true;
    },
  });
}

window.addEventListener(
  "flowdojo:model-enter",
  playModelEntrance
);


// MOUSE MOVEMENT

window.addEventListener("mousemove", (event) => {
  mouse.x =
    (event.clientX / window.innerWidth) * 2 - 1;

  mouse.y =
    (event.clientY / window.innerHeight) * 2 - 1;

  const maxRotation =
    THREE.MathUtils.degToRad(25);

  targetRotation.y =
    mouse.x * maxRotation;

  targetRotation.x =
    mouse.y * maxRotation;
});


// ANIMATION LOOP

function animate() {
  requestAnimationFrame(animate);

  if (model) {
    const time = clock.getElapsedTime();

    // FLOAT ONLY AFTER ENTRANCE

    if (modelEntranceComplete) {
      model.position.y =
        model.userData.startY +
        Math.sin(time * 1.2) * 0.15;
    }

    // CURSOR ROTATION

    model.rotation.x = THREE.MathUtils.lerp(
      model.rotation.x,
      model.userData.startRotationX +
        targetRotation.x,
      0.05
    );

    model.rotation.y = THREE.MathUtils.lerp(
      model.rotation.y,
      model.userData.startRotationY +
        targetRotation.y,
      0.05
    );
  }

  renderer.render(scene, camera);
}


// RESIZE

window.addEventListener("resize", () => {
  if (!camera) return;

  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  renderer.setSize(width, height);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
