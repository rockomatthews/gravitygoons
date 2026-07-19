"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function GravityWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = window.matchMedia("(max-width: 760px)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !compact, powerPreference: "high-performance" });
    renderer.setPixelRatio(compact ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 7);
    const group = new THREE.Group();
    scene.add(group);

    const chrome = new THREE.MeshPhysicalMaterial({ color: 0x101720, metalness: 0.92, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.12 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x00e5d4, emissive: 0x00675f, emissiveIntensity: 1.7, metalness: 0.45, roughness: 0.28 });
    const coral = new THREE.MeshStandardMaterial({ color: 0xff4b35, emissive: 0x6a0d08, emissiveIntensity: 1.4, metalness: 0.35, roughness: 0.32 });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.72, 0.16, compact ? 96 : 180, compact ? 14 : 24, 2, 5), chrome);
    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.96, compact ? 1 : 2), teal);
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.025, 12, compact ? 96 : 180), coral);
    orbit.rotation.x = Math.PI * 0.64;
    orbit.rotation.z = Math.PI * 0.16;
    group.add(knot, inner, orbit);

    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = compact ? 160 : 360;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 3.4 + ((i * 47) % 100) / 38;
      const angle = i * 2.399963;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius * 0.62;
      positions[i * 3 + 2] = ((i * 29) % 100) / 20 - 2.5;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0x8afff1, size: 0.025, transparent: true, opacity: 0.72 }));
    scene.add(particles);

    scene.add(new THREE.HemisphereLight(0xbefeff, 0x180512, 2.2));
    const rim = new THREE.PointLight(0xff4b35, 75, 18);
    rim.position.set(4, 2, 4);
    scene.add(rim);
    const key = new THREE.PointLight(0x22ffe9, 90, 18);
    key.position.set(-4, -1, 4);
    scene.add(key);

    const pointer = { x: 0, y: 0 };
    const handlePointer = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.7;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.5;
    };
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointer, { passive: true });

    let frame = 0;
    const start = performance.now();
    const draw = () => {
      const time = (performance.now() - start) / 1000;
      group.rotation.y = time * (reduceMotion ? 0.04 : 0.13) + pointer.x;
      group.rotation.x = Math.sin(time * 0.3) * 0.12 + pointer.y;
      inner.rotation.y = -time * 0.31;
      inner.rotation.z = time * 0.18;
      particles.rotation.z = time * 0.015;
      camera.position.x += (pointer.x * 0.8 - camera.position.x) * 0.025;
      camera.position.y += (-pointer.y * 0.6 - camera.position.y) * 0.025;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointer);
      particleGeometry.dispose();
      knot.geometry.dispose(); inner.geometry.dispose(); orbit.geometry.dispose();
      chrome.dispose(); teal.dispose(); coral.dispose();
      (particles.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="gravity-world" aria-hidden="true" />;
}
