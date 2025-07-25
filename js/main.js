document.addEventListener('DOMContentLoaded', () => {
  // Game State
  const gameState = {
    currentMission: 0,
    inventory: [],
    upsideDownMode: false,
    permissions: {
      camera: false,
      location: false,
      vibration: false
    },
    assets: {
      loaded: false,
      progress: 0
    }
  };

  // DOM Elements
  const startButton = document.getElementById('start-button');
  const loader = document.getElementById('loader');
  const callScreen = document.getElementById('call-screen');
  const callerImage = document.getElementById('caller-image');
  const arScene = document.getElementById('ar-scene');
  const navigationArrow = document.getElementById('navigation-arrow');
  const upsideDownOverlay = document.createElement('div');
  upsideDownOverlay.classList.add('upside-down-filter', 'hidden');
  document.body.appendChild(upsideDownOverlay);

  // Mission Configuration
  const missions = [
    {
      id: 1,
      name: "Floresta das Trevas",
      type: "ar_model",
      location: {
        lat: -27.63054776462635,
        lng: -48.681133649550205
      },
      radius: 20,
      arContent: {
        type: "model",
        path: "assets/models/bicicleta-will.glb",
        scale: [1, 1, 1],
        position: [0, 0, -2]
      },
      audio: {
        completion: "assets/sounds/call/dustin-missao-1-completa.wav"
      }
    },
    {
      id: 2,
      name: "Casa do Will",
      type: "image_tracking",
      location: {
        lat: -27.630903061716687,
        lng: -48.67974685847095
      },
      radius: 20,
      arContent: {
        type: "image",
        image: "assets/img/the-big-bang-theory.jpg",
        overlay: "assets/gif/luzes-piscando.gif"
      },
      audio: {
        completion: "assets/sounds/call/dustin-missao-2-completa.wav"
      }
    },
    {
      id: 3,
      name: "Fuga do Demogorgon",
      type: "navigation",
      location: {
        lat: -27.630111492213196,
        lng: -48.67959126452254
      },
      radius: 20,
      audio: {
        completion: "assets/sounds/call/dustin-missao-3-completa.wav"
      }
    },
    {
      id: 4,
      name: "Loja Melvald's General Store",
      type: "ar_collect",
      location: {
        lat: -27.62568754766323,
        lng: -48.679824079211336
      },
      radius: 20,
      arContent: [
        { name: "taco", path: "assets/img/taco.png" },
        { name: "gasolina", path: "assets/img/gasolina.png" }
      ],
      audio: {
        completion: "assets/sounds/call/dustin-missao-4-completa.wav"
      }
    },
    {
      id: 5,
      name: "Laboratório Nacional de Hawkins",
      type: "image_tracking",
      location: {
        lat: -27.624056768580015,
        lng: -48.68124296486716
      },
      radius: 20,
      arContent: {
        type: "image",
        image: "assets/img/bloco-h.jpg",
        overlay: "assets/gif/portal.gif"
      },
      audio: {
        completion: "assets/sounds/call/dustin-missao-5-completa.wav"
      }
    },
    {
      id: 6,
      name: "Encontro com o Demogorgon",
      type: "combat",
      location: {
        lat: -27.630116851676945,
        lng: -48.67954178126999
      },
      radius: 20,
      audio: {
        intro: "assets/sounds/call/dustin-missao-6-completa.wav",
        completion: "assets/sounds/call/dustin-missao-7-completa.wav"
      }
    },
    {
      id: 7,
      name: "Resgate do Will",
      type: "image_tracking",
      location: {
        lat: -27.630903061716687, // Casa do Will
        lng: -48.67974685847095
      },
      radius: 20,
      arContent: {
        type: "model",
        path: "assets/models/castle_byers.glb"
      },
      audio: {
        completion: "assets/sounds/call/dustin-missao-8-completa.wav"
      }
    }
  ];

  // Permission Handler
  class PermissionHandler {
    async requestCameraPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        gameState.permissions.camera = true;
        return true;
      } catch (error) {
        console.error('Camera permission denied:', error);
        return false;
      }
    }

    async requestLocationPermission() {
      return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          reject(new Error('Geolocation not supported.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          () => {
            gameState.permissions.location = true;
            resolve(true);
          },
          (error) => {
            console.error('Location permission denied:', error);
            resolve(false);
          }
        );
      });
    }

    async requestVibrationPermission() {
      if ('vibrate' in navigator) {
        gameState.permissions.vibration = true;
      }
    }
  }

  // Audio Manager
  class AudioManager {
    constructor() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.audioCache = new Map();
    }

    resumeContext() {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    }

    async preloadAudio(audioFiles) {
      const promises = audioFiles.map(async (file) => {
        try {
          const response = await fetch(file);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.audioCache.set(file, audioBuffer);
        } catch (error) {
          console.error(`Error loading audio file: ${file}`, error);
        }
      });
      await Promise.all(promises);
    }

    playAudio(audioPath, options = {}) {
      const audioBuffer = this.audioCache.get(audioPath);
      if (audioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.loop = options.loop || false;
        source.start(0);
        if (options.onended) {
          source.onended = options.onended;
        }
      } else {
        console.warn(`Audio file not found in cache: ${audioPath}`);
        if (options.onended) {
          options.onended();
        }
      }
    }

    stopAll() {
      // This needs a more complex implementation to stop specific sounds.
    }
  }

  // Location Manager
  class LocationManager {
    constructor() {
      this.currentPosition = null;
      this.watchId = null;
    }

    startWatching(onUpdate) {
      if ('geolocation' in navigator) {
        this.watchId = navigator.geolocation.watchPosition(
          (position) => {
            this.currentPosition = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            };
            onUpdate(this.currentPosition);
          },
          (error) => {
            console.error('Error getting location:', error);
          },
          { enableHighAccuracy: true }
        );
      }
    }

    stopWatching() {
      if (this.watchId) {
        navigator.geolocation.clearWatch(this.watchId);
      }
    }

    getDistance(from, to) {
      const R = 6371e3; // metres
      const φ1 = from.lat * Math.PI / 180;
      const φ2 = to.lat * Math.PI / 180;
      const Δφ = (to.lat - from.lat) * Math.PI / 180;
      const Δλ = (to.lng - from.lng) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // in metres
    }

    getBearing(from, to) {
      const φ1 = from.lat * Math.PI / 180;
      const φ2 = to.lat * Math.PI / 180;
      const λ1 = from.lng * Math.PI / 180;
      const λ2 = to.lng * Math.PI / 180;

      const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
      const x = Math.cos(φ1) * Math.sin(φ2) -
                Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
      const θ = Math.atan2(y, x);
      return (θ * 180 / Math.PI + 360) % 360; // in degrees
    }
  }

  // Navigation Arrow
  class NavigationArrow {
    constructor(arrowElement) {
      this.arrowElement = arrowElement;
    }

    update(currentPosition, targetPosition) {
      if (!currentPosition || !targetPosition) return;

      const bearing = new LocationManager().getBearing(currentPosition, targetPosition);
      this.arrowElement.style.transform = `rotate(${bearing}deg)`;
    }

    show() {
      this.arrowElement.parentElement.classList.remove('hidden');
    }

    hide() {
      this.arrowElement.parentElement.classList.add('hidden');
    }
  }

  // Mission Manager
  class MissionManager {
    constructor(missions, game) {
      this.missions = missions;
      this.game = game;
      this.currentMissionIndex = -1;
    }

    startNextMission() {
      this.currentMissionIndex++;
      if (this.currentMissionIndex < this.missions.length) {
        const mission = this.missions[this.currentMissionIndex];
        this.game.startMission(mission);
      } else {
        // Game finished
        console.log("Parabéns, você terminou o jogo!");
        // Show completion screen
      }
    }
  }

  // Game Logic
  class StrangerThingsGame {
    constructor() {
      this.permissionHandler = new PermissionHandler();
      this.audioManager = new AudioManager();
      this.locationManager = new LocationManager();
      this.navigationArrow = new NavigationArrow(document.querySelector('.arrow-svg'));
      this.missionManager = new MissionManager(missions, this);
    }

    async init() {
      await this.permissionHandler.requestCameraPermission();
      await this.permissionHandler.requestLocationPermission();
      await this.permissionHandler.requestVibrationPermission();

      await this.audioManager.preloadAudio([
        'assets/sounds/call/dustin-intro.wav',
        'assets/sounds/call/dustin-missao-1-completa.wav',
        'assets/sounds/call/dustin-missao-2-completa.wav',
        'assets/sounds/call/dustin-missao-3-completa.wav',
        'assets/sounds/call/dustin-missao-4-completa.wav',
        'assets/sounds/call/dustin-missao-5-completa.wav',
        'assets/sounds/call/dustin-missao-6-completa.wav',
        'assets/sounds/call/dustin-missao-7-completa.wav',
        'assets/sounds/call/dustin-missao-8-completa.wav'
      ]);

      this.showIntroCall();
    }

    showIntroCall() {
      loader.classList.add('hidden');
      callScreen.classList.remove('hidden');
      callerImage.src = 'assets/img/dustin-call.png';

      callerImage.addEventListener('click', () => {
        callScreen.classList.add('hidden');
        this.audioManager.playAudio('assets/sounds/call/dustin-intro.wav', {
          onended: () => {
            arScene.classList.remove('hidden');
            this.missionManager.startNextMission();
          }
        });
      }, { once: true });
    }

    startMission(mission) {
      gameState.currentMission = mission.id;

      this.locationManager.startWatching((position) => {
        this.navigationArrow.update(position, mission.location);
        const distance = this.locationManager.getDistance(position, mission.location);

        if (distance <= mission.radius) {
          this.navigationArrow.hide();
          if (gameState.permissions.vibration) {
            navigator.vibrate([200, 100, 200]);
          }
          this.locationManager.stopWatching();
          this.startARExperience(mission);
        } else {
          this.navigationArrow.show();
        }
      });
    }

    startARExperience(mission) {
      switch (mission.type) {
        case 'ar_model':
          this.setupARModel(mission);
          break;
        case 'image_tracking':
          this.setupImageTracking(mission);
          break;
        case 'navigation':
          this.completeMission(mission);
          break;
        case 'ar_collect':
          this.setupARCollect(mission);
          break;
        case 'combat':
          this.setupCombat(mission);
          break;
      }
    }

    setupARModel(mission) {
      const model = document.createElement('a-entity');
      model.setAttribute('gltf-model', mission.arContent.path);
      model.setAttribute('scale', mission.arContent.scale.join(' '));
      model.setAttribute('position', mission.arContent.position.join(' '));
      model.setAttribute('gps-entity-place', `latitude: ${mission.location.lat}; longitude: ${mission.location.lng};`);

      model.addEventListener('click', () => {
        this.completeMission(mission);
      });

      arScene.querySelector('a-scene').appendChild(model);
    }

    setupImageTracking(mission) {
      const arSceneEl = arScene.querySelector('a-scene');
      const imageMarker = document.createElement('a-marker');
      imageMarker.setAttribute('type', 'pattern');
      imageMarker.setAttribute('url', mission.arContent.image);

      const overlay = document.createElement('a-image');
      overlay.setAttribute('src', mission.arContent.overlay);
      overlay.setAttribute('rotation', '-90 0 0');

      imageMarker.appendChild(overlay);
      arSceneEl.appendChild(imageMarker);

      imageMarker.addEventListener('markerFound', () => {
        if (mission.id === 5) {
          setTimeout(() => {
            this.enterUpsideDown();
            this.completeMission(mission);
          }, 3000);
        } else {
          setTimeout(() => {
            this.completeMission(mission);
          }, 10000);
        }
      });
    }

    setupARCollect(mission) {
      const arSceneEl = arScene.querySelector('a-scene');
      let collectedItems = 0;

      mission.arContent.forEach(item => {
        const entity = document.createElement('a-image');
        entity.setAttribute('src', item.path);
        entity.setAttribute('gps-entity-place', `latitude: ${mission.location.lat}; longitude: ${mission.location.lng};`);
        entity.setAttribute('look-at', '[gps-camera]');
        entity.setAttribute('width', '0.5');
        entity.setAttribute('height', '0.5');

        entity.addEventListener('click', () => {
          gameState.inventory.push(item.name);
          entity.parentNode.removeChild(entity);
          collectedItems++;
          if (collectedItems === mission.arContent.length) {
            this.completeMission(mission);
          }
        });

        arSceneEl.appendChild(entity);
      });
    }

    setupCombat(mission) {
      this.audioManager.playAudio(mission.audio.intro, {
        onended: () => {
          // Show Demogorgon
          const demogorgon = document.createElement('a-entity');
          demogorgon.setAttribute('gltf-model', 'assets/models/demogorgon.glb'); // Placeholder
          demogorgon.setAttribute('scale', '1 1 1');
          demogorgon.setAttribute('position', '0 0 -5');
          demogorgon.setAttribute('gps-entity-place', `latitude: ${mission.location.lat}; longitude: ${mission.location.lng};`);
          arScene.querySelector('a-scene').appendChild(demogorgon);

          // Create UI for combat
          const combatUI = document.createElement('div');
          combatUI.classList.add('combat-ui');

          const tacoButton = document.createElement('button');
          tacoButton.innerText = 'Usar Taco';
          tacoButton.addEventListener('click', () => {
            // Simulate attack
            setTimeout(() => {
              gasolinaButton.style.display = 'block';
            }, 3000);
          });

          const gasolinaButton = document.createElement('button');
          gasolinaButton.innerText = 'Usar Gasolina';
          gasolinaButton.style.display = 'none';
          gasolinaButton.addEventListener('click', () => {
            demogorgon.parentNode.removeChild(demogorgon);
            this.completeMission(mission);
          });

          combatUI.appendChild(tacoButton);
          combatUI.appendChild(gasolinaButton);
          document.body.appendChild(combatUI);
        }
      });
    }

    enterUpsideDown() {
      gameState.upsideDownMode = true;
      upsideDownOverlay.classList.remove('hidden');
    }

    completeMission(mission) {
      if (mission.audio && mission.audio.completion) {
        this.audioManager.playAudio(mission.audio.completion, {
          onended: () => {
            this.missionManager.startNextMission();
          }
        });
      } else {
        this.missionManager.startNextMission();
      }
    }
  }

  // Start the game
  startButton.addEventListener('click', () => {
    const game = new StrangerThingsGame();
    game.audioManager.resumeContext(); // Resume audio context on user interaction
    game.init();
  });

});