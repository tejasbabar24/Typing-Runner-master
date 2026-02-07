#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float time;

void main() {
  vec2 uv = vUv - 0.5;
  float dist = length(uv);

  float ring =
      smoothstep(0.45, 0.35, dist) -
      smoothstep(0.55, 0.45, dist);

  float fire = sin(dist * 15.0 - time * 4.0) * 0.5 + 0.5;
  float laser = abs(sin(time * 6.0 + dist * 25.0));

  vec3 color = vec3(
    1.0,
    0.3 + fire * 0.3,
    laser * 0.8
  );

  float alpha = ring * 0.75;
  fragColor = vec4(color, alpha);
}
