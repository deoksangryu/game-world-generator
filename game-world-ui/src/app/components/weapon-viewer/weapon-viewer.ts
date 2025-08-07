import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Weapon } from '../../models/game-world.interface';

@Component({
  selector: 'app-weapon-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weapon-viewer.html',
  styleUrls: ['./weapon-viewer.scss']
})
export class WeaponViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() weapon!: Weapon;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationId?: number;

  ngOnInit() {
    this.initThreeJS();
  }

  ngAfterViewInit() {
    this.setupRenderer();
    this.loadModel();
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.controls) {
      this.controls.dispose();
    }
  }

  private initThreeJS() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      300 / 200, // aspect ratio will be updated in setupRenderer
      0.1,
      1000
    );
    this.camera.position.z = 5;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00d4ff, 0.5, 100);
    pointLight.position.set(0, 5, 5);
    this.scene.add(pointLight);
  }

  private setupRenderer() {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    
    const rect = canvas.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.enableZoom = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2.0;
  }

  private loadModel() {
    if (!this.weapon.glbModelUrl) {
      // Create a simple placeholder if no model is available
      this.createPlaceholder();
      return;
    }

    const loader = new GLTFLoader();
    loader.load(
      this.weapon.glbModelUrl,
      (gltf) => {
        const model = gltf.scene;
        
        // Scale and center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxSize = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxSize;
        model.scale.setScalar(scale);
        
        model.position.sub(center.multiplyScalar(scale));
        
        this.scene.add(model);
      },
      (progress) => {
        console.log('Loading progress:', progress);
      },
      (error) => {
        console.error('Error loading model:', error);
        this.createPlaceholder();
      }
    );
  }

  private createPlaceholder() {
    // Create a simple sword-like shape as placeholder
    const group = new THREE.Group();
    
    // Blade
    const bladeGeometry = new THREE.BoxGeometry(0.2, 3, 0.05);
    const bladeMaterial = new THREE.MeshPhongMaterial({ color: 0xc0c0c0 });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 1;
    group.add(blade);
    
    // Handle
    const handleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8);
    const handleMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.8;
    group.add(handle);
    
    // Guard
    const guardGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.1);
    const guardMaterial = new THREE.MeshPhongMaterial({ color: 0x404040 });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = -0.2;
    group.add(guard);
    
    this.scene.add(group);
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    if (this.controls) {
      this.controls.update();
    }
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getRarityColor(rarity: string): string {
    const colors = {
      common: '#9ca3af',
      uncommon: '#10b981',
      rare: '#3b82f6',
      epic: '#8b5cf6',
      legendary: '#f59e0b'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  }

  getRarityText(rarity: string): string {
    const texts = {
      common: '일반',
      uncommon: '고급',
      rare: '희귀',
      epic: '영웅',
      legendary: '전설'
    };
    return texts[rarity as keyof typeof texts] || texts.common;
  }
} 