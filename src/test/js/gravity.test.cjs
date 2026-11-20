const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('../../main/resources/static/vendor/js/three.min.js');
function setup(){
  const context={THREE,matchMedia:()=>({matches:false}),console};context.window=context;
  context.gsap={to(target,vars){for(const key of ['x','y','z'])if(key in vars)target[key]=vars[key];return {kill(){}}},killTweensOf(){},delayedCall(){return {kill(){}}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../main/resources/static/js/classroom/scene.js'),'utf8'),context);
  const desk=Object.create(context.DeskScene.prototype);
  Object.assign(desk,{scene:new THREE.Scene(),roomGroup:new THREE.Group(),deskGroup:new THREE.Group(),
    classroomFloatRoots:[],studentBags:[],antiGravityTweens:[],antiGravityResetTweens:[],renderer:{shadowMap:{}},interactionBlocked:()=>false});
  desk.scene.add(desk.roomGroup,desk.deskGroup);
  return desk;
}
test('whole-room floating includes people, bags and fixtures, without moving the building shell',()=>{
  const desk=setup();const teacher=new THREE.Group(),student=new THREE.Group(),bag=new THREE.Group(),board=new THREE.Group(),wall=new THREE.Group();
  desk.roomGroup.add(teacher,student,bag,board,wall);desk.classroomFloatRoots.push(teacher,student,board);desk.studentBags.push({mesh:bag});
  for(const [i,obj] of [teacher,student,bag,board].entries())obj.position.set(i,i/2,-i);
  const homes=[desk.deskGroup,teacher,student,bag,board].map(o=>o.position.clone());
  desk.triggerAntiGravity();
  for(const [i,obj] of [desk.deskGroup,teacher,student,bag,board].entries())assert.notEqual(obj.position.y,homes[i].y);
  assert.equal(wall.position.y,0);
  desk.stopAntiGravity();desk.finishAntiGravityReset();
  [desk.deskGroup,teacher,student,bag,board].forEach((o,i)=>assert.ok(o.position.equals(homes[i])));
  desk.triggerAntiGravity();desk.stopAntiGravity();desk.triggerAntiGravity();desk.stopAntiGravity();desk.finishAntiGravityReset();
  [desk.deskGroup,teacher,student,bag,board].forEach((o,i)=>assert.ok(o.position.equals(homes[i])));
});
test('a fixture and its invisible click target retain their relative alignment',()=>{
  const desk=setup();const mesh=new THREE.Group(),hit=new THREE.Group();mesh.position.set(3,2,1);hit.position.set(3,2.1,1);
  desk.roomGroup.add(mesh,hit);const group=desk.groupFloatingObjects('wrapper',[mesh,hit]);
  desk.classroomFloatRoots.push(hit); // A nested target must not get a second independent tween.
  const before=hit.getWorldPosition(new THREE.Vector3()).sub(mesh.getWorldPosition(new THREE.Vector3()));
  desk.triggerAntiGravity();desk.scene.updateMatrixWorld(true);
  const after=hit.getWorldPosition(new THREE.Vector3()).sub(mesh.getWorldPosition(new THREE.Vector3()));
  assert.ok(Math.abs(before.length()-after.length())<1e-10);assert.ok(desk.antiGravityRoots.includes(group));assert.ok(!desk.antiGravityRoots.includes(hit));
});
