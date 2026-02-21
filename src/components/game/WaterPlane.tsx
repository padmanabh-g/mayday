'use client'

export default function WaterPlane({ timeOfDay }: { timeOfDay: 'day' | 'night' }) {
  return (
    <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20000, 20000]} />
      <meshBasicMaterial
        color={timeOfDay === 'night' ? '#0a1a2a' : '#1a5276'}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}
