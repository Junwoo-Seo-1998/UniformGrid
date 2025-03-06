import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { Timer } from "three/addons/misc/Timer.js";
import Stats from 'three/addons/libs/stats.module.js'
//import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
//import { GUI } from 'dat.gui';

const renderer = new THREE.WebGLRenderer({ antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
const camControls = new OrbitControls(camera, renderer.domElement);
const timer = new Timer();

const worldBounds=[-1.0, 0.0, -1.0, 1.0, 2.0, 1.0];
let pickingControls;
let numSubsteps = 10;
let mainObj;
let stats;


let balls;

let sky, sun;

let play = false;

function onPlayStop() {
  play = !play;
  if (play) document.getElementById("play").innerText = "Stop";
  else document.getElementById("play").innerText = "Play";
}

function onRestart() {
  location.reload();
}

//helper class for vector math
class Vector3 {
  constructor(verts, ith) {
    this.verts = verts;
    this.start = ith * 3;
  }
  getIndex() {
    return this.start / 3;
  }
  getX() {
    return this.verts[this.start];
  }
  getY() {
    return this.verts[this.start + 1];
  }
  getZ() {
    return this.verts[this.start + 2];
  }
  setX(val) {
    this.verts[this.start] = val;
  }
  setY(val) {
    this.verts[this.start + 1] = val;
  }
  setZ(val) {
    this.verts[this.start + 2] = val;
  }

  set(vec) {
    this.verts[this.start] = vec.verts[vec.start];
    this.verts[this.start + 1] = vec.verts[vec.start + 1];
    this.verts[this.start + 2] = vec.verts[vec.start + 2];
  }

  add(vec) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] + vec.verts[vec.start];
    result[1] = this.verts[this.start + 1] + vec.verts[vec.start + 1];
    result[2] = this.verts[this.start + 2] + vec.verts[vec.start + 2];
    return new Vector3(result, 0);
  }

  sub(vec) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] - vec.verts[vec.start];
    result[1] = this.verts[this.start + 1] - vec.verts[vec.start + 1];
    result[2] = this.verts[this.start + 2] - vec.verts[vec.start + 2];
    return new Vector3(result, 0);
  }

  mul(val) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] * val;
    result[1] = this.verts[this.start + 1] * val;
    result[2] = this.verts[this.start + 2] * val;
    return new Vector3(result, 0);
  }

  addSet(vec) {
    this.verts[this.start] += vec.verts[vec.start];
    this.verts[this.start + 1] += vec.verts[vec.start + 1];
    this.verts[this.start + 2] += vec.verts[vec.start + 2];
  }

  subSet(vec) {
    this.verts[this.start] -= vec.verts[vec.start];
    this.verts[this.start + 1] -= vec.verts[vec.start + 1];
    this.verts[this.start + 2] -= vec.verts[vec.start + 2];
  }

  mulSet(val) {
    this.verts[this.start] *= val;
    this.verts[this.start + 1] *= val;
    this.verts[this.start + 2] *= val;
  }

  dot(vec) {
    return (
      this.verts[this.start] * vec.verts[vec.start] +
      this.verts[this.start + 1] * vec.verts[vec.start + 1] +
      this.verts[this.start + 2] * vec.verts[vec.start + 2]
    );
  }

  cross(vec) {
    let result = [0, 0, 0];
    result[0] =
      this.verts[this.start + 1] * vec.verts[vec.start + 2] -
      this.verts[this.start + 2] * vec.verts[vec.start + 1];
    result[1] =
      this.verts[this.start + 2] * vec.verts[vec.start] -
      this.verts[this.start] * vec.verts[vec.start + 2];
    result[2] =
      this.verts[this.start] * vec.verts[vec.start + 1] -
      this.verts[this.start + 1] * vec.verts[vec.start];
    return new Vector3(result, 0);
  }

  squareLen() {
    return (
      this.verts[this.start] * this.verts[this.start] +
      this.verts[this.start + 1] * this.verts[this.start + 1] +
      this.verts[this.start + 2] * this.verts[this.start + 2]
    );
  }

  len() {
    return Math.sqrt(
      this.verts[this.start] * this.verts[this.start] +
        this.verts[this.start + 1] * this.verts[this.start + 1] +
        this.verts[this.start + 2] * this.verts[this.start + 2]
    );
  }
}

class Hash {
  constructor(spacing, maxNumObjects) 
	{
    this.spacing=spacing
    this.tableSize=maxNumObjects*2;
    this.cellStart=new Int32Array(this.tableSize+1);
    this.cellEntries = new Int32Array(maxNumObjects);
		this.queryIds = new Int32Array(maxNumObjects);
		this.querySize = 0;
  }

  hashCoords(xi, yi, zi) {
    //randomly picked nums
    var h = (xi * 92837111) ^ (yi * 689287499) ^ (zi * 283923481);
    return Math.abs(h) % this.tableSize; 
  }

  intCoord(coord) {
    return Math.floor(coord / this.spacing);
  }

  hashPos(pos, nr) {
    return this.hashCoords(
      this.intCoord(pos[3 * nr]), 
      this.intCoord(pos[3 * nr + 1]),
      this.intCoord(pos[3 * nr + 2]));
  }

  create(pos) {
    var numObjects = Math.min(pos.length / 3, this.cellEntries.length);

    // determine cell sizes

    this.cellStart.fill(0);
    this.cellEntries.fill(0);

    for (var i = 0; i < numObjects; i++) {
      var h = this.hashPos(pos, i);
      this.cellStart[h]++;
    }

    // determine cells starts
    // partial sum

    var start = 0;
    for (var i = 0; i < this.tableSize; i++) {
      start += this.cellStart[i];
      this.cellStart[i] = start;
    }
    this.cellStart[this.tableSize] = start;	// guard

    // fill in objects ids

    for (var i = 0; i < numObjects; i++) {
      var h = this.hashPos(pos, i);
      this.cellStart[h]--;
      this.cellEntries[this.cellStart[h]] = i;
    }
  }

  query(pos, nr, maxDist) {
    var x0 = this.intCoord(pos[3 * nr] - maxDist);
    var y0 = this.intCoord(pos[3 * nr + 1] - maxDist);
    var z0 = this.intCoord(pos[3 * nr + 2] - maxDist);

    var x1 = this.intCoord(pos[3 * nr] + maxDist);
    var y1 = this.intCoord(pos[3 * nr + 1] + maxDist);
    var z1 = this.intCoord(pos[3 * nr + 2] + maxDist);

    this.querySize = 0;

    for (var xi = x0; xi <= x1; xi++) {
      for (var yi = y0; yi <= y1; yi++) {
        for (var zi = z0; zi <= z1; zi++) {
          var h = this.hashCoords(xi, yi, zi);
          var start = this.cellStart[h];
          var end = this.cellStart[h + 1];

          for (var i = start; i < end; i++) {
            this.queryIds[this.querySize] = this.cellEntries[i];
            this.querySize++;
          }
        }
      }
    }
  }
}


class Balls {
  constructor(radius, pos, vel, scene)
  {
    // physics data 

    this.radius = radius;
    this.pos = pos;
    this.prevPos = pos;
    this.vel = vel;
    this.matrix = new THREE.Matrix4();
    this.numBalls = Math.floor(pos.length / 3);
    this.hash = new Hash(2.0 * radius, this.numBalls);
    this.showCollisions = true;

    this.normal = new Float32Array(3);

    // visual mesh

    var geometry = new THREE.SphereGeometry( radius, 8, 8 );
    var material = new THREE.MeshPhongMaterial();

    this.visMesh = new THREE.InstancedMesh( geometry, material, this.numBalls );
    this.visMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); 

    this.ballColor = new THREE.Color(0xFF0000);
    this.ballCollisionColor = new THREE.Color(0xFF8000);

    var colors = new Float32Array(3 * this.numBalls);
    this.visMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3, false, 1);
    for (var i = 0; i < this.numBalls; i++) 
      this.visMesh.setColorAt(i, this.ballColor);

    scene.add(this.visMesh);

    console.log(this.numBalls);

    this.updateMesh();
  }

  updateMesh()
  {
    for (var i = 0; i < this.numBalls; i++) {
      this.matrix.makeTranslation(this.pos[3 * i], this.pos[3 * i + 1], this.pos[3 * i + 2]);
      this.visMesh.setMatrixAt(i, this.matrix);
    }
    this.visMesh.instanceMatrix.needsUpdate = true;
    this.visMesh.instanceColor.needsUpdate = true;
  }

  simulate(dt, gravity)
  {
    var minDist = 2.0 * this.radius;

    // integrate

    for (var i = 0; i < this.numBalls; i++) 
    {
      var vel=new Vector3(this.vel, i);
      var pos=new Vector3(this.pos, i);
      vel.addSet(gravity.mul(dt));
      var prevPos=new Vector3(this.prevPos, i);
      prevPos.set(pos);
      pos.addSet(vel.mul(dt));
    }

    
    this.hash.create(this.pos);

    // handle collisions

    for (var i = 0; i < this.numBalls; i++) 
    {

      this.visMesh.setColorAt(i, this.ballColor);

      // world collision (B0X)

      for (var dim = 0; dim < 3; dim++)
      {

        var nr = 3 * i + dim;
        if (this.pos[nr] < worldBounds[dim] + this.radius)
        {
          this.pos[nr] = worldBounds[dim] + this.radius;
          this.vel[nr] = - this.vel[nr];
          if (this.showCollisions)
            this.visMesh.setColorAt(i, this.ballCollisionColor);
        }
        else if (this.pos[nr] > worldBounds[dim + 3] - this.radius)
        {
          this.pos[nr] = worldBounds[dim + 3] - this.radius;
          this.vel[nr] = - this.vel[nr];
          if (this.showCollisions)
            this.visMesh.setColorAt(i, this.ballCollisionColor);
        }
      }
    

      //  interball collision

      this.hash.query(this.pos, i, 2.0 * this.radius);
      
      for (var nr = 0; nr < this.hash.querySize; nr++) 
      {
        var j = this.hash.queryIds[nr];

        var left=new Vector3(this.pos, i);
        var right=new Vector3(this.pos, j);
        var diff=left.sub(right);
        var d2 = diff.squareLen();

         // are the balls overlapping?

        if (d2 > 0.0 && d2 < minDist * minDist) 
        {
          var d = Math.sqrt(d2);

          var separateVec=diff.mul(1.0/d);	

          // separate the balls

          var corr = (minDist - d) * 0.5;

          left.addSet(separateVec.mul(corr));
          right.addSet(separateVec.mul(-corr));

          // reflect velocities along normal
          var velLeft=new Vector3(this.vel, i);
          var velRight=new Vector3(this.vel, j); 
          
          var vi=velLeft.dot(separateVec);
          var vj=velRight.dot(separateVec);
          
          velLeft.addSet(separateVec.mul(vj-vi));
          velRight.addSet(separateVec.mul(vi-vj));

          if (this.showCollisions)
            this.visMesh.setColorAt(i, this.ballCollisionColor);
        }
      }
    }
    
    this.updateMesh();
  }
}



//for event
function onMouseDown(event) {
  event.preventDefault();
}

function onMouseMove(event) {
  event.preventDefault();
}
function onMouseUp(event) {
  event.preventDefault();
}

const gravity = new Vector3([0, 0, 0], 0);

function awake() {
  window.addEventListener("resize", onWindowResize, false);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderWindow.appendChild(renderer.domElement);


  renderWindow.addEventListener("pointerdown", onMouseDown, false);
  renderWindow.addEventListener("pointermove", onMouseMove, false);
  renderWindow.addEventListener("pointerup", onMouseUp, false);

  document.getElementById("play").addEventListener("click", onPlayStop);
  document.getElementById("restart").addEventListener("click", onRestart);
  stats=new Stats();
  document.body.appendChild(stats.dom)
}

function start() {
  const effectController = {
    turbidity: 0.1,
    rayleigh: 1,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    elevation: 20,
    azimuth: 135,
    exposure: renderer.toneMappingExposure,
  };
  //var gui = new GUI();
  // Add Sky
  sky = new Sky();
  sky.scale.setScalar(4000);
  scene.add(sky);
  sun = new THREE.Vector3();

  const uniforms = sky.material.uniforms;
  uniforms["turbidity"].value = effectController.turbidity;
  uniforms["rayleigh"].value = effectController.rayleigh;
  const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
  const theta = THREE.MathUtils.degToRad(effectController.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  uniforms["sunPosition"].value.copy(sun);
  renderer.toneMappingExposure = effectController.exposure;

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
  //hemiLight.color.setHSL( 0.6, 1, 0.6 );
  //hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  //dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.setFromSphericalCoords(5, phi, theta);
  dirLight.position.multiplyScalar(30);
  scene.add(dirLight);

  dirLight.castShadow = false;
  dirLight.shadow.mapSize.width = 512;
  dirLight.shadow.mapSize.height = 512;

  // GROUND
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xe1aa72 });
  //groundMat.color.setHSL( 0.095, 1, 0.75 );

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.0001;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);

  //let body = new Cloths(scene, clothMesh);
  //mainObj = body;
  var radius = 0.025;

  var spacing = 3.0 * radius;
  var velRand = 0.2;

  var s = worldBounds;

  const geometry = new THREE.BoxGeometry( 2, 2, 2 ); 
  const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} ); 
  material.transparent=true;
  material.opacity=0.3;
  const cube = new THREE.Mesh( geometry, material ); 
  cube.position.y=1;
  scene.add( cube );

  var numX = Math.floor((s[3] - s[0] - 2.0 * spacing) / spacing);
  var numY = Math.floor((s[4] - s[1] - 2.0 * spacing) / spacing);
  var numZ = Math.floor((s[5] - s[2] - 2.0 * spacing) / spacing);

  var pos = new Float32Array(3 * numX * numY * numZ);
  var vel = new Float32Array(3 * numX * numY * numZ);
  vel.fill(0.0);

  for (var xi = 0; xi < numX; xi++) {
    for (var yi = 0; yi < numY; yi++) {
      for (var zi = 0; zi < numZ; zi++) {
        var x = 3 * ((xi * numY + yi) * numZ + zi);
        var y = x + 1;
        var z = x + 2;
        pos[x] = s[0] + spacing + xi * spacing;
        pos[y] = s[1] + spacing + yi * spacing;
        pos[z] = s[2] + spacing + zi * spacing;

        vel[x] = -velRand + 2.0 * velRand * Math.random();
        vel[y] = -velRand + 2.0 * velRand * Math.random();
        vel[z] = -velRand + 2.0 * velRand * Math.random();
      }
    }
  }

  balls=new Balls(radius, pos, vel, scene);

  camera.position.z = 3;
  camera.position.y = 4;
  camera.position.x = 3;
  //camera.lookAt(body.centerPos);
  //camControls.target = body.centerPos;
  camControls.update();
}

function Update(dt) {
  if (!play) return;
  balls.simulate(dt, gravity);

}

function UpdateLoop(timestamp) {
  requestAnimationFrame(UpdateLoop);
  timer.update(timestamp);
  camControls.update();
  Update(1.0 / 60.0);
  renderer.render(scene, camera);
  stats.update();
}

function main() {
  awake();
  start();
  UpdateLoop();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

main();
