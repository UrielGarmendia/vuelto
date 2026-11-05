import { Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { Group } from 'three';

const ACCENT = '#D9653B';
const CREAM = '#F6F2EC';

function Coin({ onReady }: { onReady?: () => void }) {
  const group = useRef<Group>(null);
  // Pointer drag on the canvas and, where allowed without a prompt, device tilt.
  const node = useThree((s) => s.gl.domElement);
  const input = useRef({
    dragX: 0,
    dragY: 0,
    tiltX: 0,
    tiltY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });
  useEffect(() => {
    const s = input.current;
    const down = (e: PointerEvent) => {
      s.dragging = true;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      node.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      s.dragX += (e.clientX - s.lastX) * 0.012;
      s.dragY += (e.clientY - s.lastY) * 0.012;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
    };
    const up = () => (s.dragging = false);
    // iOS needs a permission prompt for motion; we don't ask for it just for a flourish.
    const orient = (e: DeviceOrientationEvent) => {
      s.tiltX = ((e.beta ?? 45) - 45) * 0.01;
      s.tiltY = (e.gamma ?? 0) * 0.01;
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    window.addEventListener('deviceorientation', orient);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      window.removeEventListener('deviceorientation', orient);
    };
  }, [node]);
  const announced = useRef(false);
  useFrame((_, dt) => {
    if (!group.current) return;
    if (!announced.current) {
      announced.current = true;
      onReady?.();
    }
    // Idle spin, plus drag momentum that decays back toward the idle pose.
    if (!input.current.dragging) {
      input.current.dragX *= 0.94;
      input.current.dragY *= 0.94;
    }
    const { dragX, dragY, tiltX, tiltY } = input.current;
    const rotation = group.current.rotation;
    const targetX = 0.25 + dragY + tiltX;
    rotation.x += (targetX - rotation.x) * Math.min(1, dt * 6);
    rotation.y += dt * 0.6 + dragX * dt * 4 + tiltY * dt;
  });

  return (
    <group ref={group}>
      {/* Body: a short cylinder facing the camera. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 0.2, 96]} />
        <meshStandardMaterial color={ACCENT} metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Raised rim on both faces. */}
      {[0.1, -0.1].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <torusGeometry args={[1.12, 0.045, 16, 96]} />
          <meshStandardMaterial color={ACCENT} metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
      {/* The "V" mark, front and back. */}
      {[0.11, -0.11].map((z) => (
        <group key={z} position={[0, 0, z]} rotation={[0, z < 0 ? Math.PI : 0, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.24, 0.02, 0]} rotation={[0, 0, -side * 0.5]}>
              <boxGeometry args={[0.16, 0.95, 0.03]} />
              <meshStandardMaterial color={CREAM} metalness={0.3} roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function CoinScene({
  className,
  onReady,
}: {
  className?: string;
  /** Called on the first rendered frame, so callers can swap out a placeholder. */
  onReady?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Stop rendering when off screen or in a background tab.
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState === 'visible');
    const io = new IntersectionObserver(([entry]) => {
      inView = !!entry?.isIntersecting;
      update();
    });
    io.observe(node);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <div ref={container} className={`touch-none ${className ?? ''}`}>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.2], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} />
        {/* Local studio lighting: no HDR download, so it works offline. */}
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={3} position={[0, 3, 4]} scale={[6, 2, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[-4, 0, 2]} scale={[2, 6, 1]} />
          <Lightformer form="ring" intensity={2} position={[4, -1, 3]} scale={2} />
        </Environment>
        <Coin onReady={onReady} />
      </Canvas>
    </div>
  );
}
