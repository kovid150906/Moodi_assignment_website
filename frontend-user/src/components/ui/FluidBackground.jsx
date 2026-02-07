import { useEffect, useRef } from 'react';
import { Renderer, Transform, Program, Mesh, Vec2 } from 'ogl';

export function FluidBackground() {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const renderer = new Renderer({ dpr: 2 });
        const gl = renderer.gl;
        containerRef.current.appendChild(gl.canvas);
        gl.clearColor(0, 0, 0, 1);

        const scene = new Transform();

        function resize() {
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', resize, false);
        resize();

        const vertex = `
            attribute vec2 uv;
            attribute vec2 position;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 0, 1);
            }
        `;

        const fragment = `
            precision highp float;
            uniform float uTime;
            uniform vec2 uResolution;
            varying vec2 vUv;

            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.263, 0.416, 0.557);
                return a + b * cos(6.28318 * (c * t + d));
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
                vec2 uv0 = uv;
                vec3 finalColor = vec3(0.0);

                for (float i = 0.0; i < 4.0; i++) {
                    uv = fract(uv * 1.5) - 0.5;
                    float d = length(uv) * exp(-length(uv0));
                    vec3 col = palette(length(uv0) + i * 0.4 + uTime * 0.4);
                    d = sin(d * 8.0 + uTime) / 8.0;
                    d = abs(d);
                    d = pow(0.01 / d, 1.2);
                    finalColor += col * d;
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        const program = new Program(gl, {
            vertex,
            fragment,
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new Vec2(gl.canvas.width, gl.canvas.height) },
            },
        });

        const geometry = {
            position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
            uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
        };

        const mesh = new Mesh(gl, { geometry, program });
        mesh.setParent(scene);

        let animationId;
        function update(t) {
            animationId = requestAnimationFrame(update);
            program.uniforms.uTime.value = t * 0.001;
            program.uniforms.uResolution.value.set(gl.canvas.width, gl.canvas.height);
            renderer.render({ scene });
        }
        update(0);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
            if (containerRef.current && gl.canvas) {
                containerRef.current.removeChild(gl.canvas);
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 -z-10"
            style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
        />
    );
}
