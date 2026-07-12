console.log("THREE OCEAN VERSION 10");

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";


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

const ktx2Loader = new KTX2Loader();

ktx2Loader.setTranscoderPath(
  "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/basis/"
);

ktx2Loader.detectSupport(renderer);

ktx2Loader
  .loadAsync(
    "https://raw.githubusercontent.com/nikhil257/three-ocean-project/main/water-normal.ktx2"
  )
.then((texture) => {
  waterNormal = texture;

  waterNormal.wrapS = THREE.RepeatWrapping;
  waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.needsUpdate = true;

  if (ocean) {
    ocean.material.uniforms.uNormalTexture.value =
      waterNormal;

    ocean.material.uniforms.uNormalTexture.needsUpdate =
      true;
  }

  console.log("WATER NORMAL READY");
})
  .catch((error) => {
    console.error("WATER NORMAL ERROR", error);
  });


let camera;
let model;
let holeTarget;

// OCEAN 
let oceanGroup;
let ocean;
let waterNormal;
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

function createOcean() {
  oceanGroup = new THREE.Group();

  const oceanGeometry = new THREE.PlaneGeometry(
    1,
    1,
    75,
    75
  );

  const oceanMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uNormalTexture: {
        value: waterNormal,
      },
      uTime: {
        value: 0,
      },
      uColor: {
        value: new THREE.Color(0x7fcfff),
      },
      uLightPos: {
        value: new THREE.Vector3(
          0.85,
          2.98,
          -10
        ),
      },
      uLightIntensity: {
        value: 1.63,
      },
      uShine: {
        value: 22.6,
      },
      uDiffuse: {
        value: 0.54,
      },
      uDiffuseColor: {
        value: new THREE.Color(4681860),
      },
      uSpecularColor: {
        value: new THREE.Color(40959),
      },
      uNoiseScale: {
        value: 20.9,
      },
      uNoiseSpeed: {
        value: 0.56,
      },
      uAmplitude: {
        value: 0.3,
      },
      uFrequency: {
        value: 0.4,
      },
      uWaveSpeed: {
        value: 0.5,
      },
    },

    vertexShader: `
      varying vec4 vWorldPosition;

      uniform float uTime;
      uniform float uAmplitude;
      uniform float uFrequency;
      uniform float uWaveSpeed;

      void main() {
        vec3 transformedPosition = position;

        vWorldPosition =
          modelMatrix *
          vec4(transformedPosition, 1.0);

        transformedPosition.z += cos(
          (vWorldPosition.z - vWorldPosition.x)
          * -uFrequency
          + uTime * uWaveSpeed
        ) * uAmplitude;

        vWorldPosition =
          modelMatrix *
          vec4(transformedPosition, 1.0);

        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(transformedPosition, 1.0);
      }
    `,

    fragmentShader: `
      varying vec4 vWorldPosition;

      uniform vec3 uColor;
      uniform sampler2D uNormalTexture;
      uniform float uTime;
      uniform vec3 uLightPos;
      uniform float uLightIntensity;
      uniform float uShine;
      uniform float uDiffuse;
      uniform vec3 uDiffuseColor;
      uniform vec3 uSpecularColor;
      uniform float uNoiseScale;
      uniform float uNoiseSpeed;

      const vec3 lightColor = vec3(1.0);

      vec4 getNoise(
        vec2 uv,
        float time
      ) {
        vec2 uv0 =
          (uv / 103.0) +
          vec2(time / 17.0, time / 29.0);

        vec2 uv1 =
          uv / 107.0 -
          vec2(time / -19.0, time / 31.0);

        vec2 uv2 =
          uv / vec2(8907.0, 9803.0) +
          vec2(time / 101.0, time / 97.0);

        vec2 uv3 =
          uv / vec2(1091.0, 1027.0) -
          vec2(time / 109.0, time / -113.0);

        vec4 noise =
          texture2D(uNormalTexture, uv0) +
          texture2D(uNormalTexture, uv1) +
          texture2D(uNormalTexture, uv2) +
          texture2D(uNormalTexture, uv3);

        return noise * 0.5 - 1.0;
      }

      void sunLight(
        vec3 surfaceNormal,
        vec3 eyeDirection,
        float shiny,
        float spec,
        float diffuse,
        inout vec3 diffuseColor,
        inout vec3 specularColor
      ) {
        vec3 reflection = normalize(
          reflect(-uLightPos, surfaceNormal)
        );

        float direction = max(
          0.0,
          dot(eyeDirection, reflection)
        );

        specularColor +=
          pow(direction, shiny) *
          lightColor *
          spec;

        diffuseColor +=
          max(
            dot(uLightPos, surfaceNormal),
            0.0
          ) *
          lightColor *
          diffuse;
      }

      void main() {
        vec3 baseColor = uColor;

        vec4 noise = getNoise(
          vWorldPosition.xz * uNoiseScale,
          (uTime + 100.0) * uNoiseSpeed
        );

        vec3 surfaceNormal = normalize(
          noise.xzy * vec3(1.5, 1.0, 1.5)
        );

        vec3 diffuseLight = uDiffuseColor;
        vec3 specularLight = uSpecularColor;

        vec3 worldToEye =
          cameraPosition -
          vWorldPosition.xyz;

        vec3 eyeDirection =
          normalize(worldToEye);

        sunLight(
          surfaceNormal,
          eyeDirection,
          uShine,
          uLightIntensity,
          uDiffuse,
          diffuseLight,
          specularLight
        );

        float theta = max(
          dot(eyeDirection, surfaceNormal),
          0.0
        );

        float rf0 = 0.3;

        float reflectance =
          rf0 +
          (1.0 - rf0) *
          pow(1.0 - theta, 5.0);

        vec3 scatter =
          max(
            0.0,
            dot(surfaceNormal, eyeDirection)
          ) * baseColor;

        vec3 fakeReflection =
          vec3(0.35, 0.65, 0.85);

        vec3 albedo = mix(
          lightColor * diffuseLight * 0.3 +
          scatter,

          vec3(0.1) +
          fakeReflection * 0.9 +
          fakeReflection * specularLight,

          reflectance
        );

        gl_FragColor =
          vec4(albedo, 1.0);
      }
    `,

    side: THREE.DoubleSide,
  });

  ocean = new THREE.Mesh(
    oceanGeometry,
    oceanMaterial
  );

  ocean.rotation.x = -Math.PI / 2;
  ocean.scale.set(50, 50, 1);

  ocean.position.set(
    holeFixedPosition.x,
    holeFixedPosition.y - 2.5,
    holeFixedPosition.z + 25
  );

  oceanGroup.add(ocean);

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
