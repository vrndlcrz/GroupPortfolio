const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../../main/resources/static/vendor/js/three.min.js');
function theme(search = '') {
  const context = { THREE, URLSearchParams, location: { search }, document: { getElementById: () => null } };
  context.window=context;
  vm.runInNewContext(fs.readFileSync('src/main/resources/static/js/shared/theme.js','utf8'),context);
  return context.Theme;
}
test('absent and malformed golden settings use defaults', () => {
  const subject=theme(); subject.configure({goldenIntensity:'bad',skyDrift:'false'});
  assert.equal(subject.config.goldenIntensity,.8);assert.equal(subject.config.skyDrift,true);
  subject.configure({goldenIntensity:NaN});assert.equal(subject.config.goldenIntensity,.8);
});
test('golden intensity clamps and drift can be disabled; retired filter query has no effect', () => {
  const subject=theme('?filter=off');subject.configure({goldenIntensity:2,skyDrift:false});
  assert.equal(subject.config.goldenIntensity,1);assert.equal(subject.config.skyDrift,false);
  subject.configure({goldenIntensity:-1});assert.equal(subject.config.goldenIntensity,0);
});
test('vivid keeps luminance, boosts saturation, and does not lift black', () => {
  const subject=theme();subject.configure({goldenIntensity:.8});
  const before={},after={};new THREE.Color('#C89B63').getHSL(before);subject.vivid('#C89B63').getHSL(after);
  assert.ok(after.s>before.s);assert.ok(Math.abs(after.l-before.l)<1e-10);
  assert.equal(subject.vivid('#000000').getHexString(),'000000');
});
test('toon paint reuses a single three-step nearest-filter ramp', () => {
  const subject=theme();const one=subject.toon('#3FBF6B'),two=subject.toon('#F1E4BF');
  assert.equal(one,subject.toon('#3FBF6B'));assert.equal(one.gradientMap,two.gradientMap);
  assert.equal(one.gradientMap.image.width,3);assert.equal(one.gradientMap.minFilter,THREE.NearestFilter);
});
test('invisible click targets never acquire visible outline hulls', () => {
  const subject=theme();
  for(const material of [new THREE.MeshBasicMaterial({visible:false}),new THREE.MeshBasicMaterial({transparent:true,opacity:0})]) {
    const hitbox=new THREE.Mesh(new THREE.BoxGeometry(3.2,7.6,2),material);
    assert.equal(subject.addOutline(hitbox),null);assert.equal(hitbox.children.length,0);
  }
});
