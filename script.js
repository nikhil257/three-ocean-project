console.log("THREE OCEAN VERSION 10");

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const wrap = document.querySelector(".three-canvas-wrap");
const whiteFlash = document.querySelector(".white-flash");
const oceanCTA = document.querySelector(".ocean-cta");

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
let holeTarget;

// OCEAN 
let oceanGroup;
let ocean;
let oceanRevealed = false;

// camera moves to center to dive in
let cameraStartPosition;
let holeFixedPosition;
let cameraScrollProgress = 0;

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

    model.userData.startY = model.position.y + 0.3;
    model.userData.startScale = model.scale.clone();
    model.userData.startRotationX = model.rotation.x;
    model.userData.startRotationY = model.rotation.y;

    // HOLE TARGET DEBUG - for center moving camera

    holeTarget = new THREE.Object3D();

    holeTarget.position.set(0, 0, 0);

    model.add(holeTarget);


    model.position.y = model.userData.startY - 0.6;

    model.material.transparent = true;
    model.material.opacity = 0;

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

    // Camera moving center to dive in
    cameraStartPosition = new THREE.Vector3();

  camera.getWorldPosition(cameraStartPosition);

    model.position.y = model.userData.startY;
model.updateMatrixWorld(true);

holeFixedPosition = new THREE.Vector3();
holeTarget.getWorldPosition(holeFixedPosition);

createOcean();

model.position.y = model.userData.startY - 0.6;
model.updateMatrixWorld(true);

setupCameraScroll();

    console.log("SCENE READY");

    animate();
  })
  .catch((error) => {
    console.error("Scene loading error:", error);
  });


// OCEAN WORLD

// CUSTOM OCEAN

function createOcean() {
  oceanGroup = new THREE.Group();

  const oceanGeometry = new THREE.PlaneGeometry(
    200,
    200,
    256,
    256
  );

  const oceanMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
      },
    },

    vertexShader: `
      uniform float uTime;

      varying float vWave;
      varying vec3 vWorldPosition;

      void main() {
        vec3 pos = position;

        float wave1 =
          sin(pos.x * 0.35 + uTime * 0.8) * 0.18;

        float wave2 =
          sin(pos.y * 0.55 - uTime * 0.6) * 0.12;

        float wave3 =
          sin(
            (pos.x + pos.y) * 0.22 +
            uTime * 0.45
          ) * 0.08;

        float wave =
          wave1 +
          wave2 +
          wave3;

        pos.z += wave;

        vWave = wave;

        vec4 worldPosition =
          modelMatrix * vec4(pos, 1.0);

        vWorldPosition = worldPosition.xyz;

        gl_Position =
          projectionMatrix *
          viewMatrix *
          worldPosition;
      }
    `,

    fragmentShader: `
      varying float vWave;
      varying vec3 vWorldPosition;

      void main() {
        vec3 deepColor =
          vec3(0.005, 0.04, 0.12);

        vec3 surfaceColor =
          vec3(0.02, 0.28, 0.42);

        float waveMix =
          smoothstep(-0.25, 0.35, vWave);

        vec3 color = mix(
          deepColor,
          surfaceColor,
          waveMix
        );

        float highlight =
          smoothstep(0.18, 0.38, vWave);

        color += highlight * 0.18;

        gl_FragColor =
          vec4(color, 1.0);
      }
    `,

    side: THREE.DoubleSide,
  });

  ocean = new THREE.Mesh(
    oceanGeometry,
    oceanMaterial
  );

  ocean.rotation.x = -Math.PI / 2;

  ocean.position.set(
    holeFixedPosition.x,
    holeFixedPosition.y - 2.5,
    holeFixedPosition.z + 25
  );

  oceanGroup.add(ocean);


  // SKY DOME

  const skyGeometry =
    new THREE.SphereGeometry(
      100,
      32,
      32
    );

  const skyMaterial =
    new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPosition;

        void main() {
          vPosition = position;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(position, 1.0);
        }
      `,

      fragmentShader: `
        varying vec3 vPosition;

        void main() {
          float height =
            normalize(vPosition).y;

          vec3 horizonColor =
            vec3(0.65, 0.82, 0.92);

          vec3 skyColor =
            vec3(0.05, 0.20, 0.42);

          float mixValue =
            smoothstep(
              -0.1,
              0.8,
              height
            );

          vec3 color = mix(
            horizonColor,
            skyColor,
            mixValue
          );

          gl_FragColor =
            vec4(color, 1.0);
        }
      `,

      side: THREE.BackSide,
    });

  const sky = new THREE.Mesh(
    skyGeometry,
    skyMaterial
  );

  sky.position.copy(holeFixedPosition);

  oceanGroup.add(sky);

  oceanGroup.visible = false;

  scene.add(oceanGroup);
}

// OCEAN REVEAL

function revealOcean() {
  if (oceanRevealed) return;

  oceanRevealed = true;

  const tl = gsap.timeline();

  tl.set(whiteFlash, {
    visibility: "visible",
  });

  tl.to(whiteFlash, {
    opacity: 1,
    duration: 0.8,
    ease: "power2.inOut",
  });

  tl.call(() => {
    model.visible = false;
    oceanGroup.visible = true;
  });

  tl.to(whiteFlash, {
    opacity: 0,
    duration: 1.2,
    ease: "power2.inOut",
  });

  tl.set(whiteFlash, {
    visibility: "hidden",
  });

  tl.set(oceanCTA, {
    visibility: "visible",
    pointerEvents: "auto",
  });

  tl.fromTo(
    oceanCTA,
    {
      opacity: 0,
      scale: 0.95,
    },
    {
      opacity: 1,
      scale: 1,
      duration: 1,
      ease: "power3.out",
    }
  );
}


// MODEL ENTRANCE

function playModelEntrance() {
  if (!modelEntranceReady || !model) {
    modelEntranceTriggered = true;
    return;
  }

  modelEntranceTriggered = true;

  const tl = gsap.timeline({
    onComplete: () => {
      modelEntranceComplete = true;
    },
  });

  tl.to(
    model.position,
    {
      y: model.userData.startY,
      duration: 1.8,
      ease: "power3.out",
    },
    0
  );


  tl.to(
    model.material,
    {
      opacity: 1,
      duration: 1.2,
      ease: "power2.out",
    },
    0
  );
}

window.addEventListener(
  "flowdojo:model-enter",
  playModelEntrance
);


// CAMERA SCROLL

function setupCameraScroll() {
  gsap.to(
    { progress: 0 },
    {
      progress: 1,

      scrollTrigger: {
        trigger: ".three-hero",
        start: "top top",
        end: "+=3000",
        scrub: 1,
        pin: true,
      },

onUpdate() {
  cameraScrollProgress =
    this.targets()[0].progress;

  if (
    cameraScrollProgress >= 0.98 &&
    !oceanRevealed
  ) {
    revealOcean();
  }
},
    }
  );
}

// MOUSE MOVEMENT

window.addEventListener("mousemove", (event) => {
  mouse.x =
    (event.clientX / window.innerWidth) * 2 - 1;

  mouse.y =
    (event.clientY / window.innerHeight) * 2 - 1;

  const maxRotation =
    THREE.MathUtils.degToRad(25);

  targetRotation.y = mouse.x * maxRotation;
  targetRotation.x = mouse.y * maxRotation;
});


// ANIMATION LOOP

function animate() {
  requestAnimationFrame(animate);

  if (model) {
  const time = clock.getElapsedTime();

  const modelControl = 1 - THREE.MathUtils.smoothstep(
    cameraScrollProgress,
    0.5,
    0.65
  );

  if (modelEntranceComplete) {
    model.position.y =
      model.userData.startY +
      Math.sin(time * 1.2) * 0.15 * modelControl;
  }

  model.rotation.x = THREE.MathUtils.lerp(
    model.rotation.x,
    model.userData.startRotationX +
      targetRotation.x * modelControl,
    0.05
  );

  model.rotation.y = THREE.MathUtils.lerp(
    model.rotation.y,
    model.userData.startRotationY +
      targetRotation.y * modelControl,
    0.05
  );
}

  // moving center -camera dive in
if (
  camera &&
  holeFixedPosition &&
  cameraStartPosition
) {
  const direction = new THREE.Vector3()
    .subVectors(
      holeFixedPosition,
      cameraStartPosition
    )
    .normalize();

  const approachPosition = holeFixedPosition
    .clone()
    .addScaledVector(direction, -0.5);

  const divePosition = holeFixedPosition
    .clone()
    .addScaledVector(direction, 5);

  const forwardLookTarget = holeFixedPosition
    .clone()
    .addScaledVector(direction, 10);

  let cameraWorldPosition;

  if (cameraScrollProgress <= 0.6) {
    const progress =
      cameraScrollProgress / 0.6;

    const smoothProgress =
      THREE.MathUtils.smoothstep(
        progress,
        0,
        1
      );

    cameraWorldPosition = new THREE.Vector3()
      .lerpVectors(
        cameraStartPosition,
        approachPosition,
        smoothProgress
      );
  } else {
    const progress =
      (cameraScrollProgress - 0.6) / 0.4;

    const smoothProgress =
      THREE.MathUtils.smoothstep(
        progress,
        0,
        1
      );

    cameraWorldPosition = new THREE.Vector3()
      .lerpVectors(
        approachPosition,
        divePosition,
        smoothProgress
      );
  }

  if (camera.parent) {
    camera.parent.worldToLocal(
      cameraWorldPosition
    );
  }

  camera.position.copy(cameraWorldPosition);

  camera.lookAt(forwardLookTarget);
}

if (ocean && oceanGroup?.visible) {
  ocean.material.uniforms.uTime.value =
    clock.getElapsedTime();
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
