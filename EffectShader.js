import * as THREE from 'https://cdn.skypack.dev/pin/three@v0.137.0-X5O2PK3x44y1WRry67Kr/mode=imports/optimized/three.js';
const EffectShader = {

    uniforms: {

        'envMap': { value: null },
        'projMat': { value: new THREE.Matrix4() },
        'viewMat': { value: new THREE.Matrix4() },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        'time': { value: 0.0 },
        'armMat1': { value: new THREE.Matrix4() },
        'armMat2': { value: new THREE.Matrix4() },
        'legMat1': { value: new THREE.Matrix4() },
        'legMat2': { value: new THREE.Matrix4() },
        'headMat': { value: new THREE.Matrix4() },
        'progress': { value: 0 }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		uniform samplerCube envMap;
    varying vec2 vUv;
    uniform mat4 projMat;
    uniform mat4 viewMat;
    uniform mat4 projectionMatrixInv;
    uniform mat4 viewMatrixInv;
    uniform float time;
    uniform mat4 armMat1;
    uniform mat4 armMat2;
    uniform mat4 legMat1;
    uniform mat4 legMat2;
    uniform mat4 headMat;
    uniform float progress;
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
float permute(float x){return floor(mod(((x*34.0)+1.0)*x, 289.0));}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}

vec4 grad4(float j, vec4 ip){
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www; 

  return p;
}

float snoise(vec4 v){
  const vec2  C = vec2( 0.138196601125010504,  // (5 - sqrt(5))/20  G4
                        0.309016994374947451); // (sqrt(5) - 1)/4   F4
// First corner
  vec4 i  = floor(v + dot(v, C.yyyy) );
  vec4 x0 = v -   i + dot(i, C.xxxx);

// Other corners

// Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
  vec4 i0;

  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
//  i0.x = dot( isX, vec3( 1.0 ) );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;

//  i0.y += dot( isYZ.xy, vec2( 1.0 ) );
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;

  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  // i0 now contains the unique values 0,1,2,3 in each channel
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

  //  x0 = x0 - 0.0 + 0.0 * C 
  vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
  vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
  vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
  vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;

// Permutations
  i = mod(i, 289.0); 
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
// Gradients
// ( 7*7*6 points uniformly over a cube, mapped onto a 4-octahedron.)
// 7*7*6 = 294, which is close to the ring size 17*17 = 289.

  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

// Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));

// Mix contributions from the five corners
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

}
float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}
    float sdSphere(vec3 p, vec3 c, float radius) {
      return length(p - c) - radius; 
    }
    float sdRoundBox( vec3 p, vec3 c, vec3 b, float r )
{
  p -= c;
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}
float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
{
  vec3 pa = p - a, ba = b - a;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return length( pa - ba*h ) - r;
}

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }
    float opSmoothSubtraction( float d1, float d2, float k ) {
      float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
      return mix( d2, -d1, h ) + k*h*(1.0-h); }
    mat4 translationMatrix(vec3 translate) {
      return mat4(
        1.0, 0.0, 0.0, translate.x,
        0.0, 1.0, 0.0, translate.y,
        0.0, 0.0, 1.0, translate.z,
        0.0, 0.0, 0.0, 1.0
      );
    }
    vec4 opSmoothUnionColor( float d1, float d2, vec3 col1, vec3 col2, float k ) {
      float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
      vec4 res = vec4(
          mix( col2.x, col1.x, h ) - k*h*(1.0-h),
          mix( col2.y, col1.y, h ) - k*h*(1.0-h),
          mix( col2.z, col1.z, h ) - k*h*(1.0-h),
          mix( d2, d1, h ) - k*h*(1.0-h)
  
       );
      return res; 
  }
  
    mat4 rotationMatrix(vec3 origin, vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  origin.x,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  origin.y,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           origin.z,
                0.0,                                0.0,                                0.0,                                1.0);
}
highp float random(vec2 co)
{
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}
    vec4 map(vec3 p) {
      /*float c = 50.0;
      vec2 prevXZ = vec2(p.x, p.z);
      p.x = mod(p.x + 0.5 * c, c) - c * 0.5 + 10.0 * noise(vec3(round(p.x / c), 0.0, 0.0));;
      p.z = mod(p.z + 0.5 * c, c) - c * 0.5 + 10.0 * noise(vec3(round(p.z / c), 0.0, 0.0));*/
      float c = 50.0;
      vec3 oldP = p;
      p.x = mod(p.x + 0.5 * c, c) - c * 0.5;
      p.z = mod(p.z + 0.5 * c - progress, c) - c * 0.5;
      vec3 headP = (headMat * vec4(p, 1.0)).xyz;
      float eye = min(sdSphere(headP, vec3(-1.5, 10.0, 3.0 - 0.625), 0.625), sdSphere(headP, vec3(1.5, 10.0, 3.0 - 0.625), 0.625));
      float mouth = sdCapsule(headP, vec3(-1.5, 8.0, 2.0), vec3(1.5, 8.0, 2.0), 0.5);
      float headDist = opSmoothSubtraction(min(eye, mouth), sdSphere(headP, vec3(0.0, 10.0, 0.0), 3.0), 0.25);
      float bodyDist = sdRoundBox(headP, vec3(0.0, 0.0, 0.0), vec3(2.5, 5.0, 1.0), 1.0);
      float torsoDist = smin(headDist, bodyDist, 3.0);
      vec3 leg1P = (legMat1 * vec4(p, 1.0)).xyz;
      vec3 leg2P = (legMat2 * vec4(p, 1.0)).xyz;
      float upperLeg1 = sdCapsule(leg1P, vec3(-2.0, 0.0, 0.0), vec3(-2.0, -6.25, 0.5), 1.0);
      float upperLeg2 = sdCapsule(leg2P, vec3(2.0, 0.0, 0.0), vec3(2.0, -6.25, 0.5), 1.0);
      float lowerLeg1 = sdCapsule(leg1P, vec3(-2.0, -6.25, 0.5), vec3(-2.0, -12.5, 0.0), 1.0);
      float lowerLeg2 = sdCapsule(leg2P, vec3(2.0, -6.25, 0.5), vec3(2.0, -12.5, 0.0), 1.0);
      float upperLeg = min(upperLeg1, upperLeg2);
      float lowerLeg = min(lowerLeg1, lowerLeg2);
      float leg = smin(upperLeg, lowerLeg, 0.25);
      vec3 arm1P = (armMat1 * vec4(p, 1.0)).xyz;
      vec3 arm2P = (armMat2 * vec4(p, 1.0)).xyz;
      float upperArm1 = sdCapsule(arm1P, vec3(-3.5, 0.0, 0.0), vec3(-5.5, -7.5, 0.5), 1.0);
      float upperArm2 = sdCapsule(arm2P, vec3(3.5, 0.0, 0.0), vec3(5.5, -7.5, 0.5), 1.0);
      float lowerArm1 = sdCapsule(arm1P, vec3(-5.5, -7.5, 0.5), vec3(-5.5, -11.5, 0.0), 1.0);
      float lowerArm2 = sdCapsule(arm2P, vec3(5.5, -7.5, 0.5), vec3(5.5, -11.5, 0.0), 1.0);
      float upperArm = min(upperArm1, upperArm2);
      float lowerArm = min(lowerArm1, lowerArm2);
      float arm = smin(upperArm, lowerArm, 0.25);
      float shoulder1 = sdSphere(headP, vec3(-2.5, 4.0, 0.0), 1.75);
      float shoulder2 = sdSphere(headP, vec3(2.5, 4.0, 0.0), 1.75);
      arm = smin(arm, min(shoulder1, shoulder2), 2.0);
      //float limb = min(arm, leg);
      float body = min(smin(torsoDist, leg, 1.5), smin(torsoDist, arm, 0.33));
      float abyss = (p.y + mix(-40.0, 0.0, smoothstep(0.0, 1.0, clamp(oldP.z * 0.01, 0.0, 1.0)))) + 17.0;
      float finalDist = smin(body, abyss, 2.0);
      vec3 color = opSmoothUnionColor(body, abyss, vec3(1.0), vec3(0.0), 2.0).xyz;
      if (finalDist < 0.1) {
        if (color.x > 0.01 && color.x < 0.99) {
          finalDist += 0.25 * mix(noise(vec3(oldP + time)), noise(vec3(p + time)), color.x);
        } else {
          finalDist += 0.25 * noise(vec3(mix(oldP, p, round(color.x)) + time));
        }
      }
      return vec4(finalDist, color);
    }
    vec3 getNormal(vec3 p) {
      return normalize(vec3(
        map(p + vec3(0.001, 0.0, 0.0)).x - map(p - vec3(0.001, 0.0, 0.0)).x,
        map(p + vec3(0.0, 0.001, 0.0)).x - map(p - vec3(0.0, 0.001, 0.0)).x,
        map(p + vec3(0.0, 0.0, 0.001)).x - map(p - vec3(0.0, 0.0, 0.001)).x
      ));
    }
		void main() {
      vec3 origin = (viewMatrixInv * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 direction = (projectionMatrixInv * vec4(vUv * 2.0 - 1.0, 0.0, 1.0)).xyz;
      direction = (viewMatrixInv * vec4(direction, 0.0)).xyz;
      direction = normalize(direction);
      float dist = 0.0;
      vec3 col = mix(vec3(0.5, 0.8, 1.0), vec3(0.25, 0.4, 1.0), pow(max(direction.y, 0.0), 1.0));
      vec3 lightDir = normalize(vec3(0.5, 0.8, 0.92));
      vec3 matColor = vec3(1.0, 0.0, 1.0);
      for(int i = 0; i < 2048; i++) {
        vec3 samplePoint = origin + dist * direction;
        vec4 sceneDist = map(samplePoint);
        if (sceneDist.x < 0.001) {
          vec3 normal = getNormal(samplePoint);
          float c = 50.0;
          vec2 cell = vec2(floor((samplePoint.x + 0.5 * c) / c), floor((samplePoint.z + 0.5 * c - progress) / c));
          matColor =mix(vec3(random(vec2(cell.x + 0.025, cell.y+ 0.025)), random(vec2(cell.y+ 0.025, cell.x+0.025)), random(vec2(cell.x * cell.y+0.025, cell.x + cell.y+0.025))), vec3(0.25), clamp(1.0 - sceneDist.y, 0.0, 1.0));
          vec3 diffuse = matColor * vec3(0.25 + 0.75 * clamp(dot(lightDir, normal), 0.0, 1.0));
          float specular = clamp(dot(direction, reflect(lightDir, normal)), 0.0, 1.0);
          col = mix(col, diffuse + pow(specular, 32.0), exp(-(1.0 / 217.0) * distance(origin, samplePoint)));
          break;
        }
        dist += sceneDist.x;
        if (dist > 1000.0) {
          break;
        }
      }
      gl_FragColor = vec4(col, 1.0);
		}`

};

export { EffectShader };