import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Stars } from "@react-three/drei";
import { motion } from "framer-motion";
import { Snowflake } from "lucide-react";
import type { Mesh } from "three";

const AnimatedSphere = () => {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.35;
      ref.current.rotation.x += delta * 0.15;
    }
  });
  return (
    <Float speed={2} rotationIntensity={1.2} floatIntensity={2}>
      <Sphere ref={ref} args={[1.4, 128, 128]}>
        <MeshDistortMaterial
          color="#5eb8ff"
          emissive="#0a2fbf"
          emissiveIntensity={0.6}
          distort={0.45}
          speed={2.2}
          roughness={0.15}
          metalness={0.85}
        />
      </Sphere>
      <Sphere args={[1.75, 64, 64]}>
        <meshBasicMaterial color="#3aa0ff" wireframe transparent opacity={0.18} />
      </Sphere>
    </Float>
  );
};

const Scene = () => (
  <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
    <ambientLight intensity={0.4} />
    <pointLight position={[5, 5, 5]} intensity={2} color="#66d9ff" />
    <pointLight position={[-5, -3, -2]} intensity={1.5} color="#1e40ff" />
    <Suspense fallback={null}>
      <AnimatedSphere />
      <Stars radius={40} depth={50} count={2500} factor={4} saturation={0} fade speed={1} />
    </Suspense>
  </Canvas>
);

const Index = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#020617]">
      {/* Deep space gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, #0b1f5c 0%, #050f30 45%, #01030d 100%)",
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(94,184,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(94,184,255,0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#3aa0ff]/20 blur-[120px] animate-pulse" />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#1e40ff]/25 blur-[120px] animate-pulse"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Scan line */}
      <motion.div
        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#66d9ff]/70 to-transparent"
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      {/* 3D Scene — centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[min(90vw,600px)] h-[min(90vw,600px)]">
          <Scene />
        </div>
      </div>

      {/* Content overlay */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-between py-12 px-6 pointer-events-none">
        {/* Top: brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center gap-2 text-white/90"
        >
          <Snowflake className="w-5 h-5 text-[#66d9ff]" />
          <span className="text-sm font-bold tracking-[0.3em] uppercase">ComfortPlus</span>
        </motion.div>

        {/* Center-bottom: EM BREVE */}
        <div className="flex flex-col items-center gap-6 mt-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="text-[#66d9ff]/70 text-xs tracking-[0.5em] uppercase font-mono"
          >
            [ Sistema Inicializando ]
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
            className="text-white font-extrabold tracking-tight text-center leading-none"
            style={{
              fontSize: "clamp(4rem, 18vw, 12rem)",
              textShadow: "0 0 60px rgba(102,217,255,0.5), 0 0 120px rgba(30,64,255,0.3)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            EM{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #66d9ff 0%, #3aa0ff 50%, #1e40ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              BREVE
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="h-px w-64 bg-gradient-to-r from-transparent via-[#66d9ff] to-transparent"
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="text-white/60 text-sm md:text-base tracking-wider text-center max-w-md"
          >
            Estamos preparando algo especial. Aguarde.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 1 }}
            className="flex items-center gap-2 mt-4"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-[#66d9ff]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        </div>

        {/* Bottom: footer info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 1 }}
          className="flex items-center justify-between w-full max-w-4xl text-[10px] md:text-xs font-mono text-white/40 tracking-widest uppercase"
        >
          <span>V1.0.0</span>
          <span className="hidden md:inline">CNPJ 41.353.783/0001-74</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#66d9ff] animate-pulse" />
            Online
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
