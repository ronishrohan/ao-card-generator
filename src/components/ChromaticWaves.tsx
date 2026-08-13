"use client";

import { Camera, Mesh, Plane, Program, Renderer, RenderTarget } from "ogl";
import { useEffect, useRef } from "react";

// Exported so the share export can re-render the same dot grid offscreen.
export const wavesVertexShader = `#version 300 es
in vec2 position; in vec2 uv; out vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position,0.,1.);}`;

export const wavesFragmentShader = `#version 300 es
precision mediump float;
uniform float uTime; uniform vec2 uResolution; out vec4 color; in vec2 vUv;
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 inv(vec4 r){return 1.79284291400159-.85373472095314*r;}
float noise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz),l=1.-g;vec3 i1=min(g,l.zxy),i2=max(g,l.zxy);vec3 x1=x0-i1+C.xxx,x2=x0-i2+C.yyy,x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));vec3 ns=.142857*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z),x_=floor(j*ns.z),y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy,y=y_*ns.x+ns.yyyy,h=1.-abs(x)-abs(y),b0=vec4(x.xy,y.xy),b1=vec4(x.zw,y.zw),s0=floor(b0)*2.+1.,s1=floor(b1)*2.+1.,sh=-step(h,vec4(0.)),a0=b0.xzyw+s0.xzyw*sh.xxyy,a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x),p1=vec3(a0.zw,h.y),p2=vec3(a1.xy,h.z),p3=vec3(a1.zw,h.w);vec4 n=inv(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=n.x;p1*=n.y;p2*=n.z;p3*=n.w;vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m*=m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
void main(){float a=uResolution.x/max(uResolution.y,1.);vec2 uv=(vUv-.5)*vec2(a,1.)+.5;float n=abs(noise(vec3(uv*1.8,uTime*.5)));float gridScale=47.;vec2 cell=fract(uv*gridScale)-.5;float radius=clamp(pow(n,7.)+0.1,0.,1.)*.5;float aa=fwidth(length(cell))+.002;float dotMask=1.-smoothstep(radius-aa,radius+aa,length(cell));color=vec4(vec3(1.),dotMask*.34);}`;

export function ChromaticWaves({ visible = true }: { visible?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 2), alpha: true });
    const gl = renderer.gl;
    gl.canvas.style.display = "block";
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    el.appendChild(gl.canvas);
    const camera = new Camera(gl, { near: 0.1, far: 100 });
    camera.orthographic({ left: -1, right: 1, bottom: -1, top: 1, near: 0.1, far: 100 });
    const target = new RenderTarget(gl);
    const program = new Program(gl, { vertex: wavesVertexShader, fragment: wavesFragmentShader, uniforms: { uTime: { value: 0 }, uResolution: { value: [1, 1] } } });
    const mesh = new Mesh(gl, { geometry: new Plane(gl, { width: 2, height: 2 }), program });
    let frame = 0;
    const resize = () => { renderer.setSize(el.clientWidth, el.clientHeight); program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height]; };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const tick = (time: number) => { program.uniforms.uTime.value = time * 0.001; renderer.render({ scene: mesh, camera, target }); renderer.render({ scene: mesh, camera }); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); gl.canvas.remove(); };
  }, []);
  return <div ref={ref} aria-hidden="true" className={`pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen transition-opacity duration-700 ${visible ? "opacity-15" : "opacity-0"}`} />;
}
